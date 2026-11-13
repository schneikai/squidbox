import type { ImagePickerAsset } from 'expo-image-picker';
import { Asset, getPermissionsAsync } from 'expo-media-library';
import { Platform } from 'react-native';

// The camera roll's own details for a photo or video from the image picker: favorite, date taken
// (ms), file name and location. Null without an id (a picker result outside the library) or when
// the read fails under Limited Photos access (a photo outside the selection is hidden from the app,
// so there is nothing more to get). Any other failed read throws: a photo saved without them would
// keep them lost on every device. Reads each field on its own, so the file itself is never fetched
// (from iCloud, say).
export default async function getPickedAssetMetadataAsync({
  assetId,
  type,
}: Pick<ImagePickerAsset, 'assetId' | 'type'>) {
  if (!assetId) return null;
  try {
    const asset = new Asset(mediaLibraryId(assetId, type));
    const [isFavorite, creationTime, filename, location] = await Promise.all([
      asset.getFavorite(),
      asset.getCreationTime(),
      asset.getFilename(),
      asset.getLocation(),
    ]);
    return { isFavorite, creationTime, filename, location };
  } catch (error) {
    if ((await getPermissionsAsync()).accessPrivileges === 'limited') return null;
    throw error;
  }
}

// The picker gives the Photos local identifier (iOS) or the MediaStore row id (Android); the media
// library names an asset by its `ph://` URI or its content URI.
function mediaLibraryId(assetId: string, type: ImagePickerAsset['type']): string {
  if (Platform.OS === 'android') {
    const collection = type === 'video' ? 'video' : 'images';
    return `content://media/external/${collection}/media/${assetId}`;
  }
  return `ph://${assetId}`;
}
