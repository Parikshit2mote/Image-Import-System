const { google } = require('googleapis');
const AWS = require('aws-sdk');
const { insertImageMetadata } = require('./database');
const axios = require('axios');
require('dotenv').config();

// Configure Google Drive API
const drive = google.drive({
  version: 'v3',
  auth: process.env.GOOGLE_API_KEY // or OAuth2 client if needed
});

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

/**
 * List files in a Google Drive folder
 * Returns array of { id, name, mimeType }
 */
async function listGoogleDriveFiles(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType)'
  });
  return res.data.files || [];
}

/**
 * Download file from Google Drive
 * Returns a buffer
 */
async function downloadFileFromDrive(fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

/**
 * Upload file to S3
 * Returns public URL
 */
async function uploadToS3(file) {
  const buffer = await downloadFileFromDrive(file.id);
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: file.name,
    Body: buffer,
    ContentType: file.mimeType
  };
  await s3.upload(params).promise();
  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.name}`;
}

/**
 * Process a Google Drive folder job
 */
async function processGoogleDriveFolder(job) {
  const { folder_id } = job;

  console.log('Importing Google Drive folder:', folder_id);

  // 1️⃣ Get files
  const files = await listGoogleDriveFiles(folder_id);

  for (const file of files) {
    try {
      // 2️⃣ Upload to S3
      const url = await uploadToS3(file);

      // 3️⃣ Save metadata to DB
      await insertImageMetadata({
        url,
        source: 'google_drive',
        folder_id
      });

      console.log('Saved metadata for', file.name);
    } catch (err) {
      console.error('Error processing file', file.name, err.message);
    }
  }

  console.log('Google Drive import done');
}

/**
 * Placeholder for Dropbox folder processing
 */
async function processDropboxFolder(job) {
  console.log('Importing Dropbox folder');
  // Implement Dropbox logic similarly
}

module.exports = {
  processGoogleDriveFolder,
  processDropboxFolder
};
