import type { AssetRecord } from '@squidbox/shared';
import type { ImagePickerAsset } from 'expo-image-picker';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PickedAsset } from '../src/utils/assets/buildAssetAsync';

const LIBRARY = { id: 'lib-1' };
vi.mock('../src/library/useOpenLibrary', () => ({ default: () => ({ paths: LIBRARY }) }));
vi.mock('../src/library/current', () => ({ openLibraryId: () => LIBRARY.id }));
const removeAssetFiles = vi.fn();
vi.mock('../src/library/fs', () => ({ removeAssetFiles }));

const addAssetsAsync = vi.fn();
vi.mock('../src/providers/assets/useAssets', () => ({ default: () => ({ addAssetsAsync }) }));

const picked = vi.fn<() => Promise<ImagePickerAsset[]>>();
vi.mock('../src/utils/media-library/pickImageFromMediaLibrary', () => ({ default: () => picked() }));

const readMetadata = vi.fn();
vi.mock('../src/providers/assets/getPickedAssetMetadataAsync', () => ({ default: readMetadata }));

vi.mock('../src/utils/assets/buildAssetAsync', () => ({
  default: async ({ sourceFileUri, ...fields }: PickedAsset) => ({ ...fields, id: sourceFileUri }) as AssetRecord,
}));

const { default: useAddAssetsFromCameraRoll } = await import('../src/providers/assets/useAddAssetsFromCameraRoll');

function pickerAsset(name: string): ImagePickerAsset {
  return { assetId: name, uri: `file:///cache/${name}.jpg`, type: 'image', width: 10, height: 10 } as ImagePickerAsset;
}

const METADATA = {
  isFavorite: true,
  creationTime: 1_700_000_000_000,
  filename: 'IMG_1.JPG',
  location: { latitude: 47.5, longitude: 11.1 },
};

describe('useAddAssetsFromCameraRoll', () => {
  beforeEach(() => {
    picked.mockResolvedValue([pickerAsset('a'), pickerAsset('b'), pickerAsset('c')]);
    readMetadata.mockResolvedValue(METADATA);
  });

  it('every picked photo is added with its details', async () => {
    const added = await useAddAssetsFromCameraRoll({})();

    expect(added.map((asset) => asset.id)).toEqual([
      'file:///cache/a.jpg',
      'file:///cache/b.jpg',
      'file:///cache/c.jpg',
    ]);
    expect(added[0]).toMatchObject({
      isFavorite: true,
      takenAt: METADATA.creationTime,
      latitude: 47.5,
      longitude: 11.1,
      originalFilename: 'IMG_1.JPG',
    });
    expect(addAssetsAsync).toHaveBeenCalledWith(added);
  });

  it('progress ends at 100', async () => {
    const onProgress = vi.fn();
    await useAddAssetsFromCameraRoll({ onProgress })();
    expect(onProgress.mock.calls.map(([percent]) => Math.round(percent))).toEqual([33, 67, 100]);
  });
});
