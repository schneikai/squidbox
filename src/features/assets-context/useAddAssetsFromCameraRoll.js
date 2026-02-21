import * as MediaLibrary from 'expo-media-library';

import useAssets from '@/features/assets-context/useAssets';
import buildAssetAsync from '@/utils/assets/buildAssetAsync';
import deleteAssetFilesAndThumbnailsAsync from '@/utils/assets/deleteAssetFilesAndThumbnailsAsync';
import imagePickerMediaTypeToAssetMediaType from '@/utils/assets/imagePickerMediaTypeToAssetMediaType';
import pickImageFromMediaLibrary from '@/utils/media-library/pickImageFromMediaLibrary';

export default function useAddAssetsFromCameraRoll({ onStart, onProgress, onFinish }) {
  const { addAssetsAsync } = useAssets();

  async function addAssetsFromCameraRollAsync() {
    const imagePickerResults = await pickImageFromMediaLibrary();

    if (!imagePickerResults || imagePickerResults.length === 0) return [];

    // Picker has closed — show the loader immediately before any heavy work.
    if (onStart) onStart();

    // Fetch isFavorite for each asset (moved here from pickImageFromMediaLibrary
    // so it runs with the loader visible rather than causing a blank delay).
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
    } finally {
      if (onFinish) onFinish();
    }

    await addAssetsAsync(newAssets);

    return newAssets;
  }

  return addAssetsFromCameraRollAsync;
}
