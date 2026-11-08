import { useLocalSearchParams, useNavigation } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import CoverImage from '@/components/CoverImage';
import EmptyState from '@/components/EmptyState';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import SheetSearchField from '@/components/SheetSearchField';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import { Row, Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import useAddAlbumAction from '@/features/album-list/actions/add-album-action/useAddAlbumAction';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useAlbums from '@/features/albums-context/useAlbums';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSearchText from '@/hooks/useSearchText';
import listParam from '@/lib/listParam';
import { sizes } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

/**
 * Adds the assets (`?assetIds=`) to the album tapped and closes. The user's albums, not archived ones,
 * in the Albums tab's sort (useSortAlbumsAction), as a compact list like the Lists screen under a search
 * field pinned under the header (SheetSearchField). + makes a new album.
 */
export default function AddToAlbumScreen() {
  const navigation = useNavigation();
  const { assetIds } = useLocalSearchParams<{ assetIds: string }>();
  const { addAssetsToAlbum } = useAlbums();
  const promptAddAlbum = useAddAlbumAction();
  const runWithProgress = useRunWithProgress();
  const padding = useScreenPadding('sheet-search');
  const { field, searchText } = useSearchText();
  const { sortOrder } = useSortAlbumsAction();
  const { albums } = usePreparedAlbums({ sortOrder, searchText, showSmartAlbums: false, showDeleted: false });

  async function handleAddAssetsToAlbum(album: AlbumListRow) {
    // After a failure or a Cancel the screen stays, so the user can go on (what was added stays).
    if (await runWithProgress((batchOptions) => addAssetsToAlbum(album, listParam(assetIds), batchOptions))) {
      navigation.goBack();
    }
  }

  return (
    <ModalSheet testID="add-to-album-sheet">
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Add to Album"
        trailing={<Button variant="primary" icon="add" onPress={promptAddAlbum} accessibilityLabel="New album" />}
      />
      <SheetSearchField {...field} placeholder="Search albums" />
      <ScrollView
        contentContainerStyle={[styles.content, padding]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {albums.length > 0 ? (
          <Section>
            {albums.map((album) => (
              <AlbumRow key={album.id} album={album} onPress={() => handleAddAssetsToAlbum(album)} />
            ))}
          </Section>
        ) : (
          searchText.trim() !== '' && <EmptyState icon="search" title="No albums match" />
        )}
      </ScrollView>
    </ModalSheet>
  );
}

type AlbumRowProps = { album: AlbumListRow; onPress: () => void };

// An album to add to: its cover, name and number of assets. No chevron: a tap adds, it doesn't open it.
function AlbumRow({ album, onPress }: AlbumRowProps) {
  return (
    <Row
      leading={<CoverImage asset={album.cover} style={styles.cover} />}
      label={
        <View style={styles.labels}>
          <Text style={listTextStyles.name}>{album.name}</Text>
          <Text style={listTextStyles.detail}>{pluralizeText('1 Asset', '%{count} Assets', album.assetCount)}</Text>
        </View>
      }
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
  cover: {
    width: sizes.thumbnailSmall,
    height: sizes.thumbnailSmall,
  },
  labels: {
    flex: 1,
  },
});
