import { Directory, File } from 'expo-file-system';

// Deletes the file at `uri`, or the folder with everything in it when `uri` ends in a slash. A path
// that doesn't exist is left be.
export default function deletePath(uri: string): void {
  const entry = uri.endsWith('/') ? new Directory(uri) : new File(uri);
  if (entry.exists) entry.delete();
}
