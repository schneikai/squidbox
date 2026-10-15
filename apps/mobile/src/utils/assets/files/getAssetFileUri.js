import getAssetFilesDirectory from './getAssetFilesDirectory';

export default function getAssetFileUri(filename, library) {
  return `${getAssetFilesDirectory(library)}${filename}`;
}
