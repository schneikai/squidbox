import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import CoverImage from '@/components/CoverImage';
import PictureRow from '@/components/PictureRow';
import { sizes } from '@/styles/designTokens';
import type { AlbumListRow } from '@/sync/queries/albumQuery';

/**
 * The starred albums atop the Albums tab: each one's cover, small and square, with its name, side by
 * side, opening the album.
 */
type StarredAlbumRowProps = { albums: AlbumListRow[] };

export default function StarredAlbumRow({ albums }: StarredAlbumRowProps) {
  return (
    <PictureRow
      testID="starred-albums"
      items={albums}
      keyOf={albumId}
      picture={cover}
      label={albumName}
      onPress={openAlbum}
    />
  );
}

const albumId = (album: AlbumListRow) => album.id;
const albumName = (album: AlbumListRow) => album.name;
const cover = (album: AlbumListRow) => <CoverImage asset={album.cover} style={styles.cover} />;
const openAlbum = (album: AlbumListRow) => router.navigate(`/album/${album.id}`);

const styles = StyleSheet.create({
  cover: {
    width: sizes.avatar.medium,
    height: sizes.avatar.medium,
  },
});
