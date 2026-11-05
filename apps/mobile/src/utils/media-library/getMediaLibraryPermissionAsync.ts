import { getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library';

export default async function getMediaLibraryPermissionAsync(): Promise<boolean> {
  let res = await getPermissionsAsync();
  if (!res.granted) {
    res = await requestPermissionsAsync();
  }
  return res.granted;
}
