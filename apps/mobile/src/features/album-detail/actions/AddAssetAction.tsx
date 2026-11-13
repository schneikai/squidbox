import Button from '@/components/Button';
import AddMediaMenu from '@/features/asset-picker/AddMediaMenu';
import useAlbums from '@/providers/albums/useAlbums';
import type { AlbumRow } from '@/sync/db/schema';

type AddAssetActionProps = { album: AlbumRow };
export default function AddAssetAction({ album }: AddAssetActionProps) {
  const { addAssetsToAlbum } = useAlbums();

  return (
    <AddMediaMenu
      trigger={({ toggle }) => <Button variant="primary" icon="add" onPress={toggle} accessibilityLabel="Add" />}
      exclude={{ albumId: album.id }}
      onAdd={(assets) => addAssetsToAlbum(album, assets)}
    />
  );
}
