const { insertImageMetadata } = require('./database');
// import S3 utils, Google Drive utils you already wrote

async function processGoogleDriveFolder(job) {
  const { folder_id } = job;

  console.log('Importing Google Drive folder:', folder_id);

  // 👉 reuse code from import-service here
  // loop files
  // upload to S3
  // insert metadata using insertImageMetadata()

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
