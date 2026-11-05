import type { ImagePickerAsset } from 'expo-image-picker';

import { type AssetMediaType, MEDIA_TYPES } from './constants';

export default function imagePickerMediaTypeToAssetMediaType(mediaType: ImagePickerAsset['type']): AssetMediaType {
  switch (mediaType) {
    case 'image':
      return MEDIA_TYPES.IMAGE;
    case 'video':
      return MEDIA_TYPES.VIDEO;
    default:
      throw new Error(`Unsupported media type: ${mediaType}`);
  }
}
