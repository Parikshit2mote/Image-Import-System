/**
 * Import Service - Node.js
 * Reads folder import jobs from queue, lists Google Drive/Dropbox folders,
 * and pushes individual image tasks to worker queue
 */
require('dotenv').config();

const redis = require('redis');
const { google } = require('googleapis');

// Configuration
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_DB = process.env.REDIS_DB || 0;

const FOLDER_IMPORT_QUEUE = 'folder_import_queue'; // Read from this queue
const IMAGE_TASK_QUEUE = 'image_task_queue'; // Push to this queue

const GOOGLE_DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY || '';

const QUEUE_TIMEOUT = 5; // seconds

// Initialize Redis client
const redisClient = redis.createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  console.log('Import Service Redis Client Connected');
});

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
        console.log('Google Drive API service initialized');
      } catch (error) {
        console.error(`Failed to initialize Google Drive service: ${error.message}`);
      }
    } else {
      console.warn('Google Drive API key not set. Some features may be limited.');
    }
  }

  async listFilesInFolder(folderId) {
    const files = [];
    let pageToken = null;

    try {
      if (!this.drive) {
        throw new Error('Google Drive API service not available');
      }

      do {
        const response = await this.drive.files.list({
          q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
          fields: 'nextPageToken, files(id, name, mimeType, size)',
          pageToken: pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        files.push(...(response.data.files || []));
        pageToken = response.data.nextPageToken;
      } while (pageToken);

      console.log(`Found ${files.length} image files in folder ${folderId}`);
      
      // Filter only image files
      return files.filter(f => f.mimeType && f.mimeType.startsWith('image/'));
    } catch (error) {
      console.error(`Error listing files in folder ${folderId}: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Dropbox Client (Bonus feature - simplified)
 */
class DropboxClient {
  async listFilesInFolder(folderId, folderUrl) {
    // Simplified implementation - would need Dropbox API for full functionality
    console.warn('Dropbox folder listing requires Dropbox API. Returning empty list.');
    return [];
  }
}

/**
 * Import Service
 */
class ImportService {
  constructor() {
    this.driveClient = new GoogleDriveClient();
    this.dropboxClient = new DropboxClient();
  }

  async processFolderJob(job) {
    console.log(`Processing folder job: ${job.job_id} (${job.source})`);
    
    try {
      let files = [];

      // List files from folder based on source
      if (job.source === 'dropbox') {
        files = await this.dropboxClient.listFilesInFolder(job.folder_id, job.folder_url);
      } else {
        files = await this.driveClient.listFilesInFolder(job.folder_id);
      }

      console.log(`Found ${files.length} images in folder ${job.folder_id}`);

      // Push each image as a task to worker queue
      for (const file of files) {
        const imageTask = {
          job_id: job.job_id,
          folder_id: job.folder_id,
          folder_url: job.folder_url,
          file_id: file.id || file.fileId,
          file_name: file.name,
          mime_type: file.mimeType || 'image/jpeg',
          file_size: file.size ? parseInt(file.size) : null,
          source: job.source
        };

        // Push to worker queue (FIFO)
        await redisClient.rPush(IMAGE_TASK_QUEUE, JSON.stringify(imageTask));
        console.log(`Queued image task: ${file.name}`);
      }

      console.log(`Completed processing folder job ${job.job_id}: ${files.length} images queued`);
    } catch (error) {
      console.error(`Error processing folder job ${job.job_id}: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Main service loop
 */
async function main() {
  console.log('Starting Import Service...');

  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    process.exit(1);
  }

  const importService = new ImportService();

  // Graceful shutdown handler
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: shutting down gracefully');
    await redisClient.quit();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT signal received: shutting down gracefully');
    await redisClient.quit();
    process.exit(0);
  });

  // Service loop
  while (true) {
    try {
      // Block and wait for folder import job (FIFO queue)
      const result = await redisClient.blPop(
        redis.commandOptions({ isolated: true }),
        FOLDER_IMPORT_QUEUE,
        QUEUE_TIMEOUT
      );

      if (result) {
        const job = JSON.parse(result.element);
        console.log(`Received folder job: ${job.job_id}`);

        try {
          await importService.processFolderJob(job);
          console.log(`Completed folder job: ${job.job_id}`);
        } catch (error) {
          console.error(`Error processing folder job ${job.job_id}: ${error.message}`);
          // Job failed but we continue processing other jobs
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
        console.error(`Error in import service loop: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

// Start service
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


