import useAssets from '@/features/assets-context/useAssets';
import buildAssetAsync from '@/utils/assets/buildAssetAsync';
import deleteAssetFilesAndThumbnailsAsync from '@/utils/assets/deleteAssetFilesAndThumbnailsAsync';
import imagePickerMediaTypeToAssetMediaType from '@/utils/assets/imagePickerMediaTypeToAssetMediaType';
import pickImageFromMediaLibrary from '@/utils/media-library/pickImageFromMediaLibrary';

export default function useAddAssetsFromCameraRoll({ onStart, onProgress, onFinish }) {
  const { addAssetsAsync } = useAssets();

  async function addAssetsFromCameraRollAsync() {
    const imagePickerResults = await pickImageFromMediaLibrary();
    const newAssets = [];

    if (onStart) onStart();

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
