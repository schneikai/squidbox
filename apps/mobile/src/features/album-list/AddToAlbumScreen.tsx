import { useLocalSearchParams, useNavigation } from 'expo-router';

import Button from '@/components/Button';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import AlbumPicker from '@/features/album-list/AlbumPicker';
import useAddAlbumAction from '@/features/album-list/actions/add-album-action/useAddAlbumAction';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import useAlbums from '@/features/albums-context/useAlbums';
import listParam from '@/lib/listParam';
import { layout } from '@/styles/designTokens';

export default function AddToAlbumScreen() {
  const navigation = useNavigation();
  const { assetIds } = useLocalSearchParams<{ assetIds: string }>();
  const { addAssetsToAlbum } = useAlbums();
  const promptAddAlbum = useAddAlbumAction();
  const runWithProgress = useRunWithProgress();

  async function handleAddAssetsToAlbum(album: AlbumListRow) {
    // After a failure or a Cancel the screen stays, so the user can go on (what was added stays).
    if (await runWithProgress((batchOptions) => addAssetsToAlbum(album, listParam(assetIds), batchOptions))) {
      navigation.goBack();
    }
  }

  return (
    <ModalSheet>
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Add to Album"
        trailing={<Button variant="primary" icon="add" onPress={promptAddAlbum} accessibilityLabel="New album" />}
      />
      <AlbumPicker onPick={handleAddAssetsToAlbum} paddingTop={layout.sheetContentTop} />
    </ModalSheet>
  );
}
