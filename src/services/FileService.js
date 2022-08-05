import { documentDirectory, getInfoAsync } from "expo-file-system";
import path from "path";

export async function getFileInfo(uri) {
  // If this is done on a file that doesn't exist it throws error
  // instead of returning exists: false.
  // It seems that's a bug in expo although I coudn't find
  // anything online.
  try {
    return await getInfoAsync(uri);
  } catch (e) {
    if (e.message.includes("isn't readable")) {
      return { exists: false, isDirectory: false };
    } else {
      throw e;
    }
  }
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

export function expandPath(path) {
  if (path.startsWith("file://")) return path;
  path.join(documentDirectory, path);
}
