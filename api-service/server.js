/**
 * API Service - Node.js/Express
 * Receives HTTP requests and sends jobs to queue
 */
const {
  processGoogleDriveFolder,
  processDropboxFolder
} = require('./importHandlers');

const express = require('express');
const cors = require('cors');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const { body, query, validationResult } = require('express-validator');
require('dotenv').config();

const db = require('./database');
const { extractFolderId, extractDropboxFolderId } = require('./utils');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: '*' // For testing, or set frontend URL in production
}));
// Middleware
app.use(express.json());


app.get('/', (req, res) => {
  res.json({
    message: 'API is running'
  });
});


// Redis connection - support both REDIS_URL and separate host/port (for Render compatibility)
const redisClient = process.env.REDIS_URL 
  ? redis.createClient({ url: process.env.REDIS_URL })
  : redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });


redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  console.log('Redis Client Connected');
});

// Initialize Redis connection
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
})();

const FOLDER_IMPORT_QUEUE = 'folder_import_queue';

// Initialize database on startup
db.initDatabase();

/**
 * POST /import/google-drive
 * Import images from a Google Drive folder URL
 * Sends job to import-service via queue
 */
app.post(
  '/import/google-drive',
  [
    body('folder_url')
      .isURL()
      .withMessage('folder_url must be a valid URL'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { folder_url } = req.body;
      
      // Extract folder ID from URL
      const folderId = extractFolderId(folder_url);
      if (!folderId) {
        return res.status(400).json({
          error: 'Invalid Google Drive folder URL. Expected format: https://drive.google.com/drive/folders/FOLDER_ID'
        });
      }

      // Generate job ID
      const jobId = uuidv4();

      // Send job to import-service queue (FIFO)
      const jobData = {
        job_id: jobId,
        folder_id: folderId,
        folder_url: folder_url,
        source: 'google_drive'
      };

      await redisClient.rPush(FOLDER_IMPORT_QUEUE, JSON.stringify(jobData));

      return res.status(200).json({
        job_id: jobId,
        status: 'queued',
        folder_url: folder_url
      });
    } catch (error) {
      console.error('Error in /import/google-drive:', error);
      return res.status(500).json({
        error: `Failed to enqueue import job: ${error.message}`
      });
    }
  }
);

/**
 * POST /import/dropbox
 * Import images from a Dropbox folder URL (Bonus feature)
 * Sends job to import-service via queue
 */
app.post(
  '/import/dropbox',
  [
    body('folder_url')
      .isURL()
      .withMessage('folder_url must be a valid URL'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { folder_url } = req.body;
      
      // Extract folder ID from URL
      const folderId = extractDropboxFolderId(folder_url);
      if (!folderId) {
        return res.status(400).json({
          error: 'Invalid Dropbox folder URL. Expected format: https://www.dropbox.com/sh/xxxxx or https://www.dropbox.com/s/xxxxx'
        });
      }

      // Generate job ID
      const jobId = uuidv4();

      // Send job to import-service queue (FIFO)
      const jobData = {
        job_id: jobId,
        folder_id: folderId,
        folder_url: folder_url,
        source: 'dropbox'
      };

      await redisClient.rPush(FOLDER_IMPORT_QUEUE, JSON.stringify(jobData));

      return res.status(200).json({
        job_id: jobId,
        status: 'queued',
        folder_url: folder_url
      });
    } catch (error) {
      console.error('Error in /import/dropbox:', error);
      return res.status(500).json({
        error: `Failed to enqueue import job: ${error.message}`
      });
    }
  }
);

/**
 * GET /images
 * Get list of all imported images with metadata
 */
app.get(
  '/images',
  [
    query('source').optional().isIn(['google_drive', 'dropbox']),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { source, limit = 100, offset = 0 } = req.query;

      // Get images from database
      const result = await db.getImages({
        source: source || null,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return res.status(200).json({
        images: result.images,
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Error in /images:', error);
      return res.status(500).json({
        error: `Failed to retrieve images: ${error.message}`
      });
    }
  }
);

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  try {
    // Check Redis connection
    await redisClient.ping();
    return res.status(200).json({
      status: 'healthy',
      service: 'api-service'
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await redisClient.quit();
  process.exit(0);
});

async function startQueueWorker() {
  console.log('Background worker started');

  while (true) {
    try {
      const result = await redisClient.blPop(FOLDER_IMPORT_QUEUE, 0);
      
      if (!result || !result.element) continue;
      const job = JSON.parse(result.element);
      console.log('Processing job:', job.job_id);

      if (job.source === 'google_drive') {
        await processGoogleDriveFolder(job);
      }

      if (job.source === 'dropbox') {
        await processDropboxFolder(job);
      }

    } catch (err) {
      console.error('Worker error:', err);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Only start queue worker if ENABLE_QUEUE_WORKER is set to 'true'
// This allows the API service to run as a web service only (for Render free tier)
if (process.env.ENABLE_QUEUE_WORKER === 'true') {
  startQueueWorker().catch(err => {
    console.error('Failed to start queue worker:', err);
  });
} else {
  console.log('Queue worker disabled (ENABLE_QUEUE_WORKER not set to true)');
  console.log('API service running in web-only mode (suitable for Render free tier)');
}



module.exports = app;

