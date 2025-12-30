require('dotenv').config();

const { insertImageMetadata } = require('./database');
const Minio = require('minio');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/* ===========================
   MinIO Client Configuration
   =========================== */

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY
});

const BUCKET = process.env.MINIO_BUCKET;

/* ===========================
   Ensure bucket exists
   =========================== */
async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, 'us-east-1');
    console.log(`Created MinIO bucket: ${BUCKET}`);
  }
}

/* ===========================
   Upload image to MinIO
   =========================== */
async function uploadToMinIO(imageUrl) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer'
  });

  const fileName = `${uuidv4()}.jpg`;

  await minioClient.putObject(
    BUCKET,
    fileName,
    response.data,
    {
      'Content-Type': response.headers['content-type']
    }
  );

  return `${process.env.MINIO_PUBLIC_URL}/${BUCKET}/${fileName}`;
}

/* ===========================
   Google Drive Folder Handler
   =========================== */
/**
 * job payload format:
 * {
 *   job_id,
 *   folder_id,
 *   images: [ "https://image-url-1", "https://image-url-2" ]
 * }
 */
async function processGoogleDriveFolder(job) {
  const { folder_id, images } = job;

  console.log('Importing folder:', folder_id);

  if (!images || !Array.isArray(images)) {
    console.warn('No images found in job payload');
    return;
  }

  await ensureBucket();

  for (const imageUrl of images) {
    try {
      const storedUrl = await uploadToMinIO(imageUrl);

      await insertImageMetadata({
        url: storedUrl,
        source: 'google_drive',
        folder_id
      });

      console.log('Saved image:', storedUrl);
    } catch (err) {
      console.error('Failed image import:', err.message);
    }
  }

  console.log('Folder import completed');
}

/* ===========================
   Dropbox (future)
   =========================== */
async function processDropboxFolder(job) {
  console.log('Dropbox import not implemented yet');
}

module.exports = {
  processGoogleDriveFolder,
  processDropboxFolder
};
