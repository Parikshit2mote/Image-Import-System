const { insertImageMetadata } = require('./database');

async function processGoogleDriveFolder(job) {
  const { folder_id } = job;

  console.log('Importing Google Drive folder:', folder_id);

  // ⚠️ TEMPORARY MOCK (to prove DB works)
  // Later replace this with real Google Drive file list
  const fakeFiles = [
    {
      name: 'test-image.jpg',
      id: 'drive-file-id-123',
      size: 123456,
      mimeType: 'image/jpeg',
      storagePath: 'https://fake-s3-url/test-image.jpg'
    }
  ];

  for (const file of fakeFiles) {
    await insertImageMetadata({
      name: file.name,
      google_drive_id: file.id,
      size: file.size,
      mime_type: file.mimeType,
      storage_path: file.storagePath,
      source: 'google_drive'
    });

    console.log('Saved metadata for:', file.name);
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
