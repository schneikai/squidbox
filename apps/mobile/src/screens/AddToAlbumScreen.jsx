import { Alert, View } from 'react-native';

import GradientButton from '@/components/GradientButton';
import Icon from '@/components/Icon';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import AlbumPicker from '@/features/album-list/AlbumPicker';
import useAlbums from '@/features/albums-context/useAlbums';
import useScrollY from '@/hooks/useScrollY';
import { colors } from '@/styles/designTokens';

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
        rightSlot={
          <GradientButton onPress={handleAddAlbum}>
            <Icon name="add" color={colors.textInverse} />
          </GradientButton>
        }
      />
      <AlbumPicker onPick={handleAddAssetsToAlbum} paddingTop={MODAL_HEADER_HEIGHT} onScroll={onScroll} />
    </View>
  );
}
