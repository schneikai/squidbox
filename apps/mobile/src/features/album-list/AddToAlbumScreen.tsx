import { useLocalSearchParams, useNavigation } from 'expo-router';
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import CoverImage from '@/components/CoverImage';
import EmptyState from '@/components/EmptyState';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import SheetSearchField from '@/components/SheetSearchField';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useAddAlbumAction from '@/features/album-list/actions/add-album-action/useAddAlbumAction';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import albumAssetCountText from '@/features/album-list/albumAssetCountText';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useAlbums from '@/features/albums-context/useAlbums';
import useSearchText from '@/hooks/useSearchText';
import useSheetSearchList from '@/hooks/useSheetSearchList';
import listParam from '@/lib/listParam';
import { sizes } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

/**
 * Adds the assets (`?assetIds=`) to the album tapped and closes. The user's albums, not archived ones,
 * in the Albums tab's sort (useSortAlbumsAction), as a compact list like the Lists screen under a search
 * field pinned under the header (SheetSearchField). + makes a new album.
 */
export default function AddToAlbumScreen() {
  const navigation = useNavigation();
  const { assetIds } = useLocalSearchParams<{ assetIds: string }>();
  const promptAddAlbum = useAddAlbumAction();
  const listProps = useSheetSearchList({ hasGutter: true });
  const { field, searchText } = useSearchText();
  const { sortOrder } = useSortAlbumsAction();
  // Follows the deferred search, so the rows (AlbumRows) re-render once the search catches up.
  const { albums } = usePreparedAlbums({ sortOrder, searchText, showSmartAlbums: false, showDeleted: false });

  return (
    <ModalSheet testID="add-to-album-sheet">
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Add to Album"
        trailing={<Button variant="primary" icon="add" onPress={promptAddAlbum} accessibilityLabel="New album" />}
      />
      <SheetSearchField {...field} placeholder="Search albums…" />
      <ScrollView {...listProps}>
        {searchText && albums.length === 0 ? (
          <EmptyState icon="search" title="No albums match" />
        ) : (
          <AlbumRows albums={albums} assetIds={assetIds} />
        )}
      </ScrollView>
    </ModalSheet>
  );
}

type AlbumRowsProps = { albums: AlbumListRow[]; assetIds: string };

// The albums in one card, each its cover, name and number of assets; a tap adds the assets to it and
// closes the sheet. No chevron: a tap adds, it doesn't open the album. None (and no search): nothing,
// the header's + makes one. Memo, with only plain props, so a keystroke in the field re-renders none of it.
const AlbumRows = memo(function AlbumRows({ albums, assetIds }: AlbumRowsProps) {
  const navigation = useNavigation();
  const { addAssetsToAlbum } = useAlbums();
  const runWithProgress = useRunWithProgress();

  async function handleAddAssetsToAlbum(album: AlbumListRow) {
    // After a failure or a Cancel the screen stays, so the user can go on (what was added stays).
    if (await runWithProgress((batchOptions) => addAssetsToAlbum(album, listParam(assetIds), batchOptions))) {
      navigation.goBack();
    }
  }

  if (albums.length === 0) return null;

  return (
    <Section>
      {albums.map((album) => (
        <Row
          key={album.id}
          leading={<CoverImage asset={album.cover} style={styles.cover} />}
          label={
            <View style={styles.labels}>
              <Text style={listTextStyles.name}>{album.name}</Text>
              <Text style={listTextStyles.detail}>{albumAssetCountText(album.assetCount)}</Text>
            </View>
          }
          onPress={() => handleAddAssetsToAlbum(album)}
        />
      ))}
    </Section>
  );
});

const styles = StyleSheet.create({
  cover: {
    width: sizes.thumbnailSmall,
    height: sizes.thumbnailSmall,
  },
  labels: {
    flex: 1,
  },
});
