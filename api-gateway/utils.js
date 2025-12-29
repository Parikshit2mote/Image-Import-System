/**
 * Utility functions
 */

/**
 * Extract folder ID from Google Drive URL
 */
function extractFolderId(url) {
  const patterns = [
    /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract folder ID from Dropbox URL
 */
function extractDropboxFolderId(url) {
  const patterns = [
    /dropbox\.com\/sh\/([a-zA-Z0-9_-]+)/,
    /dropbox\.com\/s\/([a-zA-Z0-9_-]+)/,
    /\/sh\/([a-zA-Z0-9_-]+)/,
    /\/s\/([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

module.exports = {
  extractFolderId,
  extractDropboxFolderId
};







