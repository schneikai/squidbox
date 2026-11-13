import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const permissions = vi.fn();
const getLocation = vi.fn();
vi.mock('expo-media-library', () => ({
  getPermissionsAsync: () => permissions(),
  Asset: class {
    getFavorite = async () => false;
    getCreationTime = async () => 1;
    getFilename = async () => 'IMG_1.JPG';
    getLocation = () => getLocation();
  },
}));

const { default: getPickedAssetMetadataAsync } = await import('../src/providers/assets/getPickedAssetMetadataAsync');

describe('getPickedAssetMetadataAsync', () => {
  beforeEach(() => {
    getLocation.mockRejectedValue(new Error('Asset not found'));
  });

  it('a failed read under full Photos access throws', async () => {
    permissions.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
    await expect(getPickedAssetMetadataAsync({ assetId: 'a', type: 'image' })).rejects.toThrow('Asset not found');
  });

  it('a failed read under Limited Photos access leaves the details out (a photo outside the selection)', async () => {
    permissions.mockResolvedValue({ granted: true, accessPrivileges: 'limited' });
    expect(await getPickedAssetMetadataAsync({ assetId: 'a', type: 'image' })).toBeNull();
  });
});
