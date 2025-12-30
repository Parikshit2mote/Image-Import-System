const { insertImageMetadata } = require('./database');
const { uploadToMiniIO } = require('./miniio'); // implement this

async function processGoogleDriveFolder(job) {
  const { folder_id, files } = job; // files can be array of {name, buffer}

  console.log('Importing folder:', folder_id);

  for (const file of files) {
    try {
      const url = await uploadToMiniIO(file); // returns MiniIO URL
      await insertImageMetadata({
        url,
        source: 'google_drive',
        folder_id
      });
      console.log('Saved metadata for', file.name);
    } catch (err) {
      console.error('Error processing file', file.name, err.message);
    }
  }

  console.log('Import done');
}


/**
 * Placeholder for Dropbox folder processing
 */
async function processDropboxFolder(job) {
  console.log('Importing Dropbox folder');
  // Implement Dropbox logic similarly
}

module.exports = {
  processGoogleDriveFolder,
  processDropboxFolder
};
