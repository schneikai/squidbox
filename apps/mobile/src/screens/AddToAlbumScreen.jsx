import { Alert, View } from 'react-native';

import IconButton from '@/components/IconButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import AlbumPicker from '@/features/album-list/AlbumPicker';
import useAlbums from '@/features/albums-context/useAlbums';
import useScrollY from '@/hooks/useScrollY';

export default function AddToAlbumScreen({ route, navigation }) {
  const { addAlbum, addAssetsToAlbum } = useAlbums();
  const runWithProgress = useRunWithProgress();

  const { scrollY, onScroll } = useScrollY();

  async function handleAddAssetsToAlbum(album) {
    // After a failure or a Cancel the screen stays, so the user can go on (what was added stays).
    if (await runWithProgress((batchOptions) => addAssetsToAlbum(album, route.params.assetIds, batchOptions))) {
      navigation.goBack();
    }
  }

  function handleAddAlbum() {
    Alert.prompt('Album name', undefined, (name) => {
      if (name) addAlbum({ name });
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Add to Album"
        scrollY={scrollY}
        rightSlot={<IconButton variant="primary" icon="add" onPress={handleAddAlbum} accessibilityLabel="New album" />}
      />
      <AlbumPicker onPick={handleAddAssetsToAlbum} paddingTop={MODAL_HEADER_HEIGHT} onScroll={onScroll} />
    </View>
  );
}
