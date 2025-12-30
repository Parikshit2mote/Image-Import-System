const { insertImageMetadata } = require('./database');
const { uploadToS3, listGoogleDriveFiles } = require('./utils'); // your S3 + GDrive helpers

async function processGoogleDriveFolder(job) {
  const { folder_id } = job;

  console.log('Importing Google Drive folder:', folder_id);

  // Get all files in the folder
  const files = await listGoogleDriveFiles(folder_id);

  for (const file of files) {
    // Upload file to S3
    const url = await uploadToS3(file);

    // Save metadata to DB
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
