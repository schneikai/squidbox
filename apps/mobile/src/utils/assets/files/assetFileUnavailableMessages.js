// What to tell the user when getAssetFileStatusAsync finds a file that can't be had.
const assetFileUnavailableMessages = {
  notUploaded: {
    title: 'Not uploaded yet',
    message: 'Only on the device it was added on. Back it up there to see it here.',
  },
  signedOut: {
    title: 'Not signed in',
    message: 'Sign in to get files that are only in the cloud.',
  },
};

export default assetFileUnavailableMessages;
