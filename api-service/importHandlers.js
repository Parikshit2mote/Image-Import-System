require('dotenv').config();

const { insertImageMetadata } = require('./database');
const Minio = require('minio');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/* ===========================
   MinIO Client Configuration (Lazy Initialization)
   =========================== */

let minioClient = null;
let BUCKET = null;

function getMinioClient() {
  if (!minioClient) {
    const endPoint = process.env.MINIO_ENDPOINT;
    if (!endPoint) {
      throw new Error('MINIO_ENDPOINT environment variable is not set. MinIO client cannot be initialized.');
    }
    
    minioClient = new Minio.Client({
      endPoint: endPoint,
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
    });
    
    BUCKET = process.env.MINIO_BUCKET || 'images';
  }
  return minioClient;
}

/* ===========================
   Ensure bucket exists
   =========================== */
async function ensureBucket() {
  const client = getMinioClient();
  const bucket = BUCKET || process.env.MINIO_BUCKET || 'images';
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket, 'us-east-1');
    console.log(`Created MinIO bucket: ${bucket}`);
  }
}

/* ===========================
   Upload image to MinIO
   =========================== */
async function uploadToMinIO(imageUrl) {
  const client = getMinioClient();
  const bucket = BUCKET || process.env.MINIO_BUCKET || 'images';
  
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer'
  });

  const fileName = `${uuidv4()}.jpg`;

  await client.putObject(
    bucket,
    fileName,
    response.data,
    {
      'Content-Type': response.headers['content-type']
    }
  );

  return `${process.env.MINIO_PUBLIC_URL || ''}/${bucket}/${fileName}`;
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
