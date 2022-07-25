import { getInfoAsync } from "expo-file-system";

export async function getFileInfo(uri) {
  return await getInfoAsync(uri);
}

export async function fileExists(uri) {
  const { exists } = await getFileInfo(uri);
  return exists;
}

export async function getFileSize(uri) {
  const { size } = await getFileInfo(uri);
  return size;
}

// Returns file extension from given file name
// getFileExtension("IMG_0027.JPG")
//   => "JPG"
export function getFileExtension(filename) {
  // https://stackoverflow.com/questions/680929/how-to-extract-extension-from-filename-string-in-javascript
  const re = /(?:\.([^.]+))?$/;
  return re.exec(filename)[1];
}
