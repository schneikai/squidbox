import type { AssetRecord } from '@squidbox/shared';
import type { ImagePickerAsset } from 'expo-image-picker';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PickedAsset } from '../src/utils/assets/buildAssetAsync';

const alert = vi.fn();
vi.mock('react-native', () => ({ Alert: { alert: (...args: unknown[]) => alert(...args) } }));

const LIBRARY = { id: 'lib-1' };
vi.mock('../src/library/useOpenLibrary', () => ({ default: () => ({ paths: LIBRARY }) }));
vi.mock('../src/library/current', () => ({ openLibraryId: () => LIBRARY.id }));
const removeAssetFiles = vi.fn();
vi.mock('../src/library/fs', () => ({ removeAssetFiles }));

const addAssetsAsync = vi.fn();
vi.mock('../src/features/assets-context/useAssets', () => ({ default: () => ({ addAssetsAsync }) }));

const picked = vi.fn<() => Promise<ImagePickerAsset[]>>();
vi.mock('../src/utils/media-library/pickImageFromMediaLibrary', () => ({ default: () => picked() }));

const readMetadata = vi.fn();
vi.mock('../src/features/assets-context/getPickedAssetMetadataAsync', () => ({ default: readMetadata }));

const deletePath = vi.fn();
vi.mock('../src/utils/files/deletePath', () => ({ default: deletePath }));

vi.mock('../src/utils/assets/buildAssetAsync', () => ({
  default: async ({ sourceFileUri, ...fields }: PickedAsset) => ({ ...fields, id: sourceFileUri }) as AssetRecord,
}));

const { default: useAddAssetsFromCameraRoll } =
  await import('../src/features/assets-context/useAddAssetsFromCameraRoll');

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
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    picked.mockResolvedValue([pickerAsset('a'), pickerAsset('b'), pickerAsset('c')]);
    readMetadata.mockImplementation(async ({ assetId }: ImagePickerAsset) => {
      if (assetId === 'b') throw new Error('Photos refused');
      return METADATA;
    });
  });

  it('a photo whose metadata cannot be read is not added, its file removed and the user told', async () => {
    const added = await useAddAssetsFromCameraRoll({})();

    expect(added.map((asset) => asset.id)).toEqual(['file:///cache/a.jpg', 'file:///cache/c.jpg']);
    expect(added[0]).toMatchObject({ takenAt: METADATA.creationTime, latitude: 47.5, originalFilename: 'IMG_1.JPG' });
    expect(addAssetsAsync).toHaveBeenCalledWith(added);
    expect(deletePath).toHaveBeenCalledWith('file:///cache/b.jpg');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe("1 item wasn't added");
  });

  it('progress counts a skipped photo, ending at 100', async () => {
    const onProgress = vi.fn();
    await useAddAssetsFromCameraRoll({ onProgress })();
    expect(onProgress.mock.calls.map(([percent]) => Math.round(percent))).toEqual([33, 67, 100]);
  });
});
