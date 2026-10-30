import Button from '@/components/Button';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import AlbumPicker from '@/features/album-list/AlbumPicker';
import useAddAlbumAction from '@/features/album-list/actions/add-album-action/useAddAlbumAction';
import useAlbums from '@/features/albums-context/useAlbums';
import useScrollY from '@/hooks/useScrollY';

export default function AddToAlbumScreen({ route, navigation }) {
  const { addAssetsToAlbum } = useAlbums();
  const promptAddAlbum = useAddAlbumAction();
  const runWithProgress = useRunWithProgress();

  const { scrollY, onScroll } = useScrollY();

  async function handleAddAssetsToAlbum(album) {
    // After a failure or a Cancel the screen stays, so the user can go on (what was added stays).
    if (await runWithProgress((batchOptions) => addAssetsToAlbum(album, route.params.assetIds, batchOptions))) {
      navigation.goBack();
    }
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        centerSlot="Add to Album"
        scrollY={scrollY}
        rightSlot={<Button variant="primary" icon="add" onPress={promptAddAlbum} accessibilityLabel="New album" />}
      />
      <AlbumPicker onPick={handleAddAssetsToAlbum} paddingTop={MODAL_HEADER_HEIGHT} onScroll={onScroll} />
    </ModalSheet>
  );
}
