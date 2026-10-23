import IconButton from '@/components/IconButton';
import useAlbums from '@/features/albums-context/useAlbums';
import AddMediaMenu from '@/features/asset-picker/AddMediaMenu';

export default function AddAssetAction({ album }) {
  const { addAssetsToAlbum } = useAlbums();

  return (
    <AddMediaMenu
      trigger={({ toggle }) => <IconButton variant="primary" icon="add" onPress={toggle} accessibilityLabel="Add" />}
      exclude={{ albumId: album.id }}
      onAdd={(assets) => addAssetsToAlbum(album, assets)}
    />
  );
}
