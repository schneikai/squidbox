import type { ImagePickerAsset } from 'expo-image-picker';
import { Asset } from 'expo-media-library';
import { Platform } from 'react-native';

import detailsFromExif from '@/utils/media-library/detailsFromExif';

// The camera roll's own details for a photo or video from the image picker: favorite, date taken
// (ms), file name and location. Reads each field on its own, so the file itself is never fetched
// (from iCloud, say). When Photos can't give them, the details come from the picked file instead:
// its EXIF date and place (picked with `exif: true`) and the picker's file name, not a favorite.
// That happens for every photo picked outside the selection under Limited Photos access (Apple's
// picker shows the whole library, the app sees only the selection), for a picker result outside the
// library (no id), and for a photo deleted in the moment between picking and reading.
export default async function getPickedAssetMetadataAsync({
  assetId,
  type,
  exif,
  fileName,
}: Pick<ImagePickerAsset, 'assetId' | 'type' | 'exif' | 'fileName'>) {
  if (assetId) {
    try {
      const asset = new Asset(mediaLibraryId(assetId, type));
      const [isFavorite, creationTime, filename, location] = await Promise.all([
        asset.getFavorite(),
        asset.getCreationTime(),
        asset.getFilename(),
        asset.getLocation(),
      ]);
      return { isFavorite, creationTime, filename, location };
    } catch {
      // Falls through to the file's own details.
    }
  }
  return { isFavorite: false, ...detailsFromExif(exif), filename: fileName ?? null };
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
