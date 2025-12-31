/**
 * Folder Processor - Processes Google Drive/Dropbox folders synchronously
 * Used when background workers are not available (e.g., Render free tier)
 */
require('dotenv').config();

const { google } = require('googleapis');
const db = require('./database');

const GOOGLE_DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY || '';

/**
 * Google Drive Client for listing and downloading files
 */
class GoogleDriveProcessor {
  constructor() {
    this.drive = null;
    if (GOOGLE_DRIVE_API_KEY) {
      try {
        this.drive = google.drive({
          version: 'v3',
          auth: GOOGLE_DRIVE_API_KEY
        });
      } catch (error) {
        console.error('Failed to initialize Google Drive:', error);
      }
    }
  }

  async listFilesInFolder(folderId) {
    if (!this.drive) {
      throw new Error('Google Drive API key not configured');
    }

    const files = [];
    let pageToken = null;

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

    return files.filter(f => f.mimeType && f.mimeType.startsWith('image/'));
  }

  async getFileMetadata(fileId) {
    // Get file metadata without downloading (free - no storage costs)
    if (this.drive) {
      try {
        const fileMetadata = await this.drive.files.get({
          fileId: fileId,
          fields: 'id, name, mimeType, size'
        });

        return {
          mimeType: fileMetadata.data.mimeType || 'image/jpeg',
          size: parseInt(fileMetadata.data.size) || 0
        };
      } catch (error) {
        console.error(`Error getting metadata for ${fileId}:`, error.message);
        // Return defaults if API fails
        return {
          mimeType: 'image/jpeg',
          size: 0
        };
      }
    }
    
    // Fallback defaults
    return {
      mimeType: 'image/jpeg',
      size: 0
    };
  }
}

/**
 * Process Google Drive folder and save images to database
 */
async function processGoogleDriveFolder(folderId, folderUrl) {
  const processor = new GoogleDriveProcessor();
  
  console.log(`Processing Google Drive folder: ${folderId}`);
  
  // List files in folder
  const files = await processor.listFilesInFolder(folderId);
  console.log(`Found ${files.length} images in folder`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Process each file (no downloads - just metadata, completely free!)
  for (const file of files) {
    try {
      console.log(`Processing: ${file.name}`);
      
      // Get file metadata (no download - free!)
      const metadata = await processor.getFileMetadata(file.id);
      
      // Generate storage path (reference to Google Drive file - no storage costs!)
      const storagePath = `https://drive.google.com/file/d/${file.id}/view`;
      
      // Save to database (using free PostgreSQL on Render)
      await db.insertImageMetadata({
        name: file.name,
        google_drive_id: file.id,
        dropbox_id: null,
        size: metadata.size || file.size || 0,
        mime_type: metadata.mimeType || file.mimeType || 'image/jpeg',
        storage_path: storagePath,
        source: 'google_drive'
      });
      
      console.log(`Saved: ${file.name}`);
      successCount++;
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`Folder processing complete: ${successCount} successful, ${errorCount} errors`);
  return { successCount, errorCount, total: files.length };
}

module.exports = {
  processGoogleDriveFolder
};

