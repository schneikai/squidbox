import * as MediaLibrary from 'expo-media-library';

import useAssets from '@/features/assets-context/useAssets';
import buildAssetAsync from '@/utils/assets/buildAssetAsync';
import deleteAssetFilesAndThumbnailsAsync from '@/utils/assets/deleteAssetFilesAndThumbnailsAsync';
import imagePickerMediaTypeToAssetMediaType from '@/utils/assets/imagePickerMediaTypeToAssetMediaType';
import pickImageFromMediaLibrary from '@/utils/media-library/pickImageFromMediaLibrary';

export default function useAddAssetsFromCameraRoll({ onStart, onProgress, onFinish }) {
  const { addAssetsAsync } = useAssets();

  async function addAssetsFromCameraRollAsync() {
    try {
      // The picker only resolves once iOS has exported the picked files, which can take seconds.
      // Starting the progress overlay as the picker opens means it is already showing when the
      // picker closes, instead of a silent pause before the new assets appear.
      const imagePickerResults = await pickImageFromMediaLibrary({ onOpen: onStart });
      if (!imagePickerResults || imagePickerResults.length === 0) return [];

      for (const result of imagePickerResults) {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(result.assetId);
        result.isFavorite = assetInfo.isFavorite;
      }

      const newAssets = [];
      try {
        for (const result of imagePickerResults) {
          const newAsset = await buildAssetAsync({
            mediaLibraryAssetId: result.assetId,
            sourceFileUri: result.uri,
            mediaType: imagePickerMediaTypeToAssetMediaType(result.type),
            fileSize: result.fileSize,
            width: result.width,
            height: result.height,
            duration: result.duration,
            isFavorite: result.isFavorite,
          });
          newAssets.push(newAsset);
          if (onProgress) onProgress((newAssets.length / imagePickerResults.length) * 100);
        }
      } catch (e) {
        await deleteAssetFilesAndThumbnailsAsync(newAssets);
        throw e;
      }

      await addAssetsAsync(newAssets);
      return newAssets;
    } finally {
      // Hide only once the assets are saved, so they are in the list when the overlay goes away.
      if (onFinish) onFinish();
    }
  }

  return addAssetsFromCameraRollAsync;
}
