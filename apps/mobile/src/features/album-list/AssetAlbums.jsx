import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native';

import ThumbnailRow from '@/components/ThumbnailRow';
import albumLastPostedText from '@/features/album-list/albumLastPostedText';
import useAssetAlbums from '@/hooks/useAssetAlbums';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

const identity = (onPress) => onPress;

/**
 * The albums holding any of `assetIds`, live and in the albums' custom order, as rows that each
 * open their album and say when it was last posted; `emptyText` shows instead while there are none
 * (nothing until they've been read). `guardPress` may wrap the rows' presses (useDetailsPanelDrag's);
 * `isLive: false` reads them once (useLiveQuery's).
 */
export default function AssetAlbums({ assetIds, emptyText, guardPress = identity, isLive }) {
  const navigation = useNavigation();
  const albums = useAssetAlbums(assetIds, { isLive });

  if (!albums) return null;
  if (albums.length === 0) return <Text style={listTextStyles.subtitle}>{emptyText}</Text>;

  return albums.map((album, index) => (
    <ThumbnailRow
      key={album.id}
      asset={album.cover}
      title={album.name}
      subtitle={`${pluralizeText('1 Asset', '%{count} Assets', album.assetCount)} · ${albumLastPostedText(album)}`}
      isLast={index === albums.length - 1}
      onPress={guardPress(() => navigation.push('AlbumScreen', { albumId: album.id }))}
    />
  ));
}
