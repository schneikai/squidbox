import * as FileSystem from 'expo-file-system/legacy';

/** The file at `uri`, base64 encoded. */
export default function readFileAsBase64Async(uri) {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
