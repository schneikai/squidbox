import type { AssetRecord } from '@squidbox/shared';

import { openLibraryId } from '@/library/current';
import { removeAssetFiles } from '@/library/fs';
import useOpenLibrary from '@/library/useOpenLibrary';
import getPickedAssetMetadataAsync from '@/providers/assets/getPickedAssetMetadataAsync';
import useAssets from '@/providers/assets/useAssets';
import buildAssetAsync from '@/utils/assets/buildAssetAsync';
import imagePickerMediaTypeToAssetMediaType from '@/utils/assets/imagePickerMediaTypeToAssetMediaType';
import pickImageFromMediaLibrary from '@/utils/media-library/pickImageFromMediaLibrary';

type AddAssetsOptions = {
  onStart?: () => void;
  onProgress?: (percent: number) => void;
  onFinish?: () => void;
};

export default function useAddAssetsFromCameraRoll({ onStart, onProgress, onFinish }: AddAssetsOptions) {
  const { addAssetsAsync } = useAssets();
  const { paths: library } = useOpenLibrary();

  async function addAssetsFromCameraRollAsync(): Promise<AssetRecord[]> {
    try {
      // The picker only resolves once iOS has exported the picked files, which can take seconds.
      // Starting the progress overlay as the picker opens means it is already showing when the
      // picker closes, instead of a silent pause before the new assets appear.
      const imagePickerResults = await pickImageFromMediaLibrary({ onOpen: onStart });
      if (!imagePickerResults || imagePickerResults.length === 0) return [];

      // The files go into this screen's library; the records must too (a sign-in meanwhile would
      // open another one), else the files are removed again.
      const newAssets: AssetRecord[] = [];
      try {
        for (const result of imagePickerResults) {
          // Its metadata only (the picker exported the file).
          const assetInfo = await getPickedAssetMetadataAsync(result);
          const newAsset = await buildAssetAsync(
            {
              // iOS always exports these with a picked file; one missing stays out, so newRecord's
              // schema parse rejects the asset, as it always has (never 0, a wrong size).
              mediaLibraryAssetId: result.assetId ?? undefined,
              sourceFileUri: result.uri,
              mediaType: imagePickerMediaTypeToAssetMediaType(result.type),
              // Whole numbers, as the shared asset schema has them.
              fileSize: result.fileSize === undefined ? undefined : Math.round(result.fileSize),
              width: Math.round(result.width),
              height: Math.round(result.height),
              duration: result.duration,
              isFavorite: assetInfo?.isFavorite ?? false,
              takenAt: assetInfo?.creationTime == null ? null : Math.round(assetInfo.creationTime),
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
