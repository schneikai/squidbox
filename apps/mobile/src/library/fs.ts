import * as FileSystem from 'expo-file-system/legacy';

// expo-sqlite keeps every database under this folder (it exists once a database has been opened).
const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;

// Every database file on this device, by name.
export async function listDatabaseNames(): Promise<string[]> {
  const info = await FileSystem.getInfoAsync(SQLITE_DIR);
  if (!info.exists) return [];
  return FileSystem.readDirectoryAsync(SQLITE_DIR);
}
