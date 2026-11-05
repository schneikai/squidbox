// The browser's file picker needs no media library permission (expo-media-library has none on web).
export default async function getMediaLibraryPermissionAsync() {
  return true;
}
