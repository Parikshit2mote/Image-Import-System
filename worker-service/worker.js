/**
 * Worker Service - Node.js
 * Downloads images from Google Drive/Dropbox and uploads to S3/MinIO
 */
require('dotenv').config();

const redis = require('redis');
const mysql = require('mysql2/promise');
const { google } = require('googleapis');
const axios = require('axios');
const AWS = require('aws-sdk');
const Minio = require('minio');

// Configuration
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_DB = process.env.REDIS_DB || 0;
const IMAGE_TASK_QUEUE = 'image_task_queue'; // Read from this queue

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'mysql',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'image_import',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const USE_AWS_S3 = process.env.USE_AWS_S3 === 'true';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'images';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';

const GOOGLE_DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY || '';

// Worker configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds
const QUEUE_TIMEOUT = 5; // seconds

// Initialize database pool
const dbPool = mysql.createPool(MYSQL_CONFIG);

// Initialize Redis client
const redisClient = redis.createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  console.log('Worker Service Redis Client Connected');
});

/**
 * Storage Client - abstraction for S3/MinIO
 */
class StorageClient {
  constructor() {
    if (USE_AWS_S3) {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: AWS_REGION
      });
      this.bucket = AWS_S3_BUCKET;
      this.isMinio = false;
    } else {
      const endpoint = MINIO_ENDPOINT.replace('https://', '').replace('http://', '');
      const [host, port] = endpoint.split(':');
      
      this.minioClient = new Minio.Client({
        endPoint: host,
        port: parseInt(port) || 9000,
        useSSL: MINIO_USE_SSL,
        accessKey: MINIO_ACCESS_KEY,
        secretKey: MINIO_SECRET_KEY
      });
      this.bucket = MINIO_BUCKET;
      this.isMinio = true;
      this.ensureBucket();
    }
  }

  async ensureBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket);
        console.log(`Created bucket: ${this.bucket}`);
      }
    } catch (error) {
      console.error(`Error checking/creating bucket: ${error.message}`);
    }
  }

  async uploadFile(fileData, objectName, contentType) {
    try {
      if (this.isMinio) {
        // MinIO upload
        await this.minioClient.putObject(
          this.bucket,
          objectName,
          Buffer.from(fileData),
          fileData.length,
          {
            'Content-Type': contentType
          }
        );
        return `s3://${this.bucket}/${objectName}`;
      } else {
        // AWS S3 upload
        await this.s3.putObject({
          Bucket: this.bucket,
          Key: objectName,
          Body: Buffer.from(fileData),
          ContentType: contentType
        }).promise();
        return `s3://${this.bucket}/${objectName}`;
      }
    } catch (error) {
      console.error(`Error uploading file ${objectName}: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Google Drive Client
 */
class GoogleDriveClient {
  constructor() {
    this.apiKey = GOOGLE_DRIVE_API_KEY;
    this.drive = null;
    
    if (this.apiKey) {
      try {
        this.drive = google.drive({
          version: 'v3',
          auth: this.apiKey
        });
      } catch (error) {
        console.error(`Failed to initialize Google Drive service: ${error.message}`);
      }
    }
  }

  async downloadFile(fileId, fileName = null) {
    try {
      if (this.drive) {
        // Use Google Drive API
        const fileMetadata = await this.drive.files.get({
          fileId: fileId,
          fields: 'mimeType, size'
        });

        const response = await this.drive.files.get(
          { fileId: fileId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );

        const buffer = Buffer.from(response.data);
        const mimeType = fileMetadata.data.mimeType || 'application/octet-stream';
        const size = parseInt(fileMetadata.data.size) || buffer.length;

        return { buffer, mimeType, size };
      } else {
        // Fallback: Use direct download link for public files
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const response = await axios.get(downloadUrl, {
          responseType: 'arraybuffer',
          maxRedirects: 5
        });

        let buffer = Buffer.from(response.data);
        
        // Handle virus scan warning page
        if (buffer.toString().includes('virus scan warning') || 
            buffer.toString().substring(0, 500).toLowerCase().includes('<html')) {
          const downloadUrlConfirm = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
          const confirmResponse = await axios.get(downloadUrlConfirm, {
            responseType: 'arraybuffer'
          });
          buffer = Buffer.from(confirmResponse.data);
        }

        const mimeType = response.headers['content-type'] || 'image/jpeg';
        const size = buffer.length;

        return { buffer, mimeType, size };
      }
    } catch (error) {
      console.error(`Error downloading file ${fileId}: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Dropbox Client (Bonus feature)
 */
class DropboxClient {
  async downloadFile(fileId, fileUrl) {
    try {
      // Convert sharing link to direct download
      let downloadUrl = fileUrl;
      if (fileUrl && fileUrl.includes('?dl=0')) {
        downloadUrl = fileUrl.replace('?dl=0', '?dl=1');
      } else if (fileUrl && fileUrl.includes('?')) {
        downloadUrl = fileUrl + '&dl=1';
      } else if (fileUrl) {
        downloadUrl = fileUrl + '?dl=1';
      } else {
        downloadUrl = `https://www.dropbox.com/s/${fileId}?dl=1`;
      }

      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer'
      });

      const buffer = Buffer.from(response.data);
      const mimeType = response.headers['content-type'] || 'application/octet-stream';
      const size = buffer.length;

      return { buffer, mimeType, size };
    } catch (error) {
      console.error(`Error downloading Dropbox file: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Worker Service
 */
class WorkerService {
  constructor() {
    this.storage = new StorageClient();
    this.driveClient = new GoogleDriveClient();
    this.dropboxClient = new DropboxClient();
  }

  async processImageTaskWithRetry(task, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.processImageTask(task);
        return; // Success
      } catch (error) {
        console.error(`Attempt ${attempt}/${retries} failed for ${task.file_name}: ${error.message}`);
        
        if (attempt === retries) {
          throw new Error(`Failed after ${retries} attempts: ${error.message}`);
        }
        
        // Exponential backoff
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async processImageTask(task) {
    console.log(`Processing image: ${task.file_name} (${task.file_id})`);

    // Download file
    let fileData, mimeType, size;

    if (task.source === 'dropbox') {
      const result = await this.dropboxClient.downloadFile(
        task.file_id,
        task.folder_url
      );
      fileData = result.buffer;
      mimeType = result.mimeType;
      size = result.size;
    } else {
      const result = await this.driveClient.downloadFile(task.file_id, task.file_name);
      fileData = result.buffer;
      mimeType = result.mimeType;
      size = result.size;
    }

    // Use task mime type or detected
    if (!mimeType || !mimeType.startsWith('image/')) {
      mimeType = task.mime_type || 'image/jpeg';
    }

    // Use task size or detected size
    if (task.file_size && task.file_size > 0) {
      size = task.file_size;
    }

    // Generate storage path
    const objectName = `images/${task.source}/${task.file_id}/${task.file_name}`;

    // Upload to storage
    const storagePath = await this.storage.uploadFile(
      fileData,
      objectName,
      mimeType
    );

    // Save metadata to database with retry
    await this.saveImageMetadataWithRetry({
      name: task.file_name,
      google_drive_id: task.source === 'google_drive' ? task.file_id : null,
      dropbox_id: task.source === 'dropbox' ? task.file_id : null,
      size: size,
      mime_type: mimeType,
      storage_path: storagePath,
      source: task.source
    });

    console.log(`Successfully processed: ${task.file_name}`);
  }

  async saveImageMetadataWithRetry(imageData, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const connection = await dbPool.getConnection();
        try {
          const query = `
            INSERT INTO image_metadata 
            (name, google_drive_id, dropbox_id, size, mime_type, storage_path, source)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          await connection.execute(query, [
            imageData.name,
            imageData.google_drive_id,
            imageData.dropbox_id,
            imageData.size,
            imageData.mime_type,
            imageData.storage_path,
            imageData.source
          ]);

          console.log(`Saved metadata for ${imageData.name}`);
          return;
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error(`Attempt ${attempt}/${retries} failed to save metadata: ${error.message}`);
        
        if (attempt === retries) {
          throw new Error(`Failed to save metadata after ${retries} attempts: ${error.message}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
}

/**
 * Main worker loop
 */
async function main() {
  console.log('Starting Worker Service...');

  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    process.exit(1);
  }

  const workerService = new WorkerService();

  // Graceful shutdown handler
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: shutting down gracefully');
    await redisClient.quit();
    await dbPool.end();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT signal received: shutting down gracefully');
    await redisClient.quit();
    await dbPool.end();
    process.exit(0);
  });

  // Worker loop
  while (true) {
    try {
      // Block and wait for image task (FIFO queue)
      const result = await redisClient.blPop(
        redis.commandOptions({ isolated: true }),
        IMAGE_TASK_QUEUE,
        QUEUE_TIMEOUT
      );

      if (result) {
        const task = JSON.parse(result.element);
        console.log(`Received image task: ${task.file_name}`);

        try {
          await workerService.processImageTaskWithRetry(task);
          console.log(`Completed image task: ${task.file_name}`);
        } catch (error) {
          console.error(`Error processing image task ${task.file_name}: ${error.message}`);
          // Task failed but we continue processing other tasks
          // In production, you might want to push to a dead letter queue
        }
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.error('Redis connection error, retrying in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else if (error.name === 'TimeoutError') {
        // Timeout is normal when queue is empty, continue
        continue;
      } else {
        console.error(`Error in worker loop: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

// Start worker
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


