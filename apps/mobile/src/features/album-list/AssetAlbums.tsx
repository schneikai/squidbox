import { router } from 'expo-router';
import { Text } from 'react-native';

import ThumbnailRow from '@/components/ThumbnailRow';
import albumLastPostedText from '@/features/album-list/albumLastPostedText';
import type { AlbumSubsetScope } from '@/features/album-list/albumQuery';
import useAssetAlbums from '@/hooks/useAssetAlbums';
import unguarded, { type GuardPress } from '@/lib/unguarded';
import listTextStyles from '@/styles/listTextStyles';
import type { LiveOptions } from '@/sync/useLiveQuery';
import pluralizeText from '@/utils/pluralizeText';

type AssetAlbumsProps = { scope: AlbumSubsetScope; emptyText: string; guardPress?: GuardPress } & Pick<
  LiveOptions,
  'isLive'
>;

/**
 * The albums of `scope` (`{ assetIds }`: holding any of the assets; `{ contactId }`: a contact is
 * on), live and in the albums' custom order, as rows that each open their album and say when it was
 * last posted; `emptyText` shows instead while there are none (nothing until they've been read).
 * `guardPress` may wrap the rows' presses (useDetailsPanelDrag's); `isLive: false` reads them once
 * (useLiveQuery's).
 */
export default function AssetAlbums({ scope, emptyText, guardPress = unguarded, isLive }: AssetAlbumsProps) {
  const albums = useAssetAlbums(scope, { isLive });

  if (!albums) return null;
  if (albums.length === 0) return <Text style={listTextStyles.subtitle}>{emptyText}</Text>;

  return albums.map((album, index) => (
    <ThumbnailRow
      key={album.id}
      asset={album.cover}
      title={album.name}
      subtitle={`${pluralizeText('1 Asset', '%{count} Assets', album.assetCount)} · ${albumLastPostedText(album)}`}
      isLast={index === albums.length - 1}
      onPress={guardPress(() => router.push(`/album/${album.id}`))}
    />
  ));
}
