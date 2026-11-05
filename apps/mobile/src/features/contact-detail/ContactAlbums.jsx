import { router } from 'expo-router';
import { Text } from 'react-native';

import ThumbnailRow from '@/components/ThumbnailRow';
import albumLastPostedText from '@/features/album-list/albumLastPostedText';
import useAlbumRows from '@/features/album-list/useAlbumRows';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

/** The albums a contact is on, as rows that open their album; `emptyText` while there are none. */
export default function ContactAlbums({ contactId, emptyText }) {
  const { rows: albums } = useAlbumRows({ contactId });

  if (!albums) return null;
  if (albums.length === 0) return <Text style={listTextStyles.subtitle}>{emptyText}</Text>;

  return [...albums]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((album, index) => (
      <ThumbnailRow
        key={album.id}
        asset={album.cover}
        title={album.name}
        subtitle={`${pluralizeText('1 Asset', '%{count} Assets', album.assetCount)} · ${albumLastPostedText(album)}`}
        isLast={index === albums.length - 1}
        onPress={() => router.push(`/album/${album.id}`)}
      />
    ));
}
