import * as MediaLibrary from 'expo-media-library';

import useAssets from '@/features/assets-context/useAssets';
import { openLibraryId } from '@/library/current';
import { removeAssetFiles } from '@/library/fs';
import useLibrary from '@/library/useLibrary';
import buildAssetAsync from '@/utils/assets/buildAssetAsync';
import imagePickerMediaTypeToAssetMediaType from '@/utils/assets/imagePickerMediaTypeToAssetMediaType';
import pickImageFromMediaLibrary from '@/utils/media-library/pickImageFromMediaLibrary';

export default function useAddAssetsFromCameraRoll({ onStart, onProgress, onFinish }) {
  const { addAssetsAsync } = useAssets();
  const { paths: library } = useLibrary();

  async function addAssetsFromCameraRollAsync() {
    try {
      // The picker only resolves once iOS has exported the picked files, which can take seconds.
      // Starting the progress overlay as the picker opens means it is already showing when the
      // picker closes, instead of a silent pause before the new assets appear.
      const imagePickerResults = await pickImageFromMediaLibrary({ onOpen: onStart });
      if (!imagePickerResults || imagePickerResults.length === 0) return [];

      // The files go into this screen's library; the records must too (a sign-in meanwhile would
      // open another one), else the files are removed again.
      const newAssets = [];
      try {
        for (const result of imagePickerResults) {
          // Its metadata only (the picker exported the file); null outside a Limited Photos selection.
          const assetInfo = await MediaLibrary.getAssetInfoAsync(result.assetId, { shouldDownloadFromNetwork: false });
          const newAsset = await buildAssetAsync(
            {
              mediaLibraryAssetId: result.assetId,
              sourceFileUri: result.uri,
              mediaType: imagePickerMediaTypeToAssetMediaType(result.type),
              // Whole numbers, as the shared asset schema has them.
              fileSize: Math.round(result.fileSize),
              width: Math.round(result.width),
              height: Math.round(result.height),
              duration: result.duration,
              isFavorite: assetInfo?.isFavorite ?? false,
              takenAt: assetInfo?.creationTime ?? null,
              originalFilename: assetInfo?.filename ?? result.fileName ?? null,
              latitude: assetInfo?.location?.latitude ?? null,
              longitude: assetInfo?.location?.longitude ?? null,
            },
            library,
          );
          newAssets.push(newAsset);
          if (onProgress) onProgress((newAssets.length / imagePickerResults.length) * 100);
        }
        if (openLibraryId() !== library.id) throw new Error('The library changed while the photos were added');
      } catch (e) {
        await removeAssetFiles(newAssets, library);
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
