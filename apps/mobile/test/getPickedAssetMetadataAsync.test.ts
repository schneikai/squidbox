import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const getLocation = vi.fn();
vi.mock('expo-media-library', () => ({
  Asset: class {
    getFavorite = async () => true;
    getCreationTime = async () => 1;
    getFilename = async () => 'IMG_1.JPG';
    getLocation = () => getLocation();
  },
}));

const { default: getPickedAssetMetadataAsync } = await import('../src/providers/assets/getPickedAssetMetadataAsync');

// As iOS's picker gives them: positive degrees with a ref, a local time with its offset.
const EXIF = {
  DateTimeOriginal: '2024:06:01 14:03:22',
  OffsetTimeOriginal: '+02:00',
  GPSLatitude: 47.5,
  GPSLatitudeRef: 'N',
  GPSLongitude: 11.1,
  GPSLongitudeRef: 'W',
};
const PICKED = { assetId: 'a', type: 'image', exif: EXIF, fileName: 'IMG_9.HEIC' } as const;

describe('getPickedAssetMetadataAsync', () => {
  beforeEach(() => {
    getLocation.mockResolvedValue({ latitude: 1, longitude: 2 });
  });

  it("the details are Photos' own when Photos gives them", async () => {
    expect(await getPickedAssetMetadataAsync(PICKED)).toEqual({
      isFavorite: true,
      creationTime: 1,
      filename: 'IMG_1.JPG',
      location: { latitude: 1, longitude: 2 },
    });
  });

  it("the details come from the file's EXIF and name when Photos can't give them (Limited access)", async () => {
    getLocation.mockRejectedValue(new Error('Asset not found'));
    expect(await getPickedAssetMetadataAsync(PICKED)).toEqual({
      isFavorite: false,
      creationTime: Date.UTC(2024, 5, 1, 12, 3, 22),
      filename: 'IMG_9.HEIC',
      location: { latitude: 47.5, longitude: -11.1 },
    });
  });

  it('a file without EXIF date or GPS (a video) is added without them', async () => {
    expect(await getPickedAssetMetadataAsync({ assetId: null, type: 'video', exif: null, fileName: null })).toEqual({
      isFavorite: false,
      creationTime: null,
      filename: null,
      location: null,
    });
  });
});
