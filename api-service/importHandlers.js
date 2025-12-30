const { insertImageMetadata } = require('./database');
const { listGoogleDriveFiles, uploadToS3 } = require('./utils');

async function processGoogleDriveFolder(job) {
  const { folder_id } = job;

  console.log('Importing Google Drive folder:', folder_id);

  // 1️⃣ Get files from Google Drive
  const files = await listGoogleDriveFiles(folder_id); // implement this to return array of files

  for (const file of files) {
    // 2️⃣ Upload file to S3
    const url = await uploadToS3(file); // returns the S3 URL

    // 3️⃣ Save metadata to DB
    await insertImageMetadata({
      url,
      source: 'google_drive',
      folder_id
    });

    console.log('Saved metadata for', file.name);
  }

  console.log('Google Drive import done');
}



async function processDropboxFolder(job) {
  console.log('Importing Dropbox folder');

  // reuse dropbox logic here
}

module.exports = {
  processGoogleDriveFolder,
  processDropboxFolder
};
