import { StyleSheet, Text, View } from 'react-native';

import ItSeesRow from './ItSeesRow';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import { SCREEN_PADDING } from '@/constants';
import sortAlbumsByCustomOrder from '@/features/album-list/actions/sort-albums-action/sortAlbumsByCustomOrder';
import useAlbumRows from '@/features/album-list/useAlbumRows';
import { colors, scale, typography } from '@/styles/designTokens';
import countMediaTypes from '@/utils/assets/countMediaTypes';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

const THUMB_SIZE = scale(36);
const SUBJECTS = { draft: 'New post' };

/**
 * What the chat is about, at its top: the post's first photos, "New post · 2 Photos · <album>", what
 * the assistant sees in them (ItSeesRow, from `tagging`, useAssetTags'; a tag opens the photo's tags
 * with `onOpenTags(assetId)`) and the handles it may mention (`mentions`, useMentions').
 */
export default function ChatSubjectCard({ kind, assets, tagging, mentions, onOpenTags }) {
  const assetIds = assets.map((asset) => asset.id);
  const { rows: albums } = useAlbumRows({ assetIds }, { isLive: false });

  const albumName = albums && [...albums].sort(sortAlbumsByCustomOrder)[0]?.name;
  const counts = countMediaTypes(assets);
  const title = [SUBJECTS[kind], assets.length > 0 && getAssetCountInfo(counts), albumName].filter(Boolean).join(' · ');
  const mentionsFrom = mentions?.fromAlbum ? (albumName ?? 'the album') : 'your posts';

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        {assets.length > 0 && (
          <View style={styles.thumbs}>
            {assets.slice(0, 2).map((asset, index) => (
              <CoverImage key={asset.id} asset={asset} style={[styles.thumb, index > 0 && styles.overlapping]} />
            ))}
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {tagging.rows && tagging.rows.length > 0 && (
        <ItSeesRow rows={tagging.rows} attempts={tagging.attempts} onOpen={onOpenTags} onRetry={tagging.retry} />
      )}
      {mentions?.handles.length > 0 && (
        <Text style={styles.mentions}>
          Mentions from {mentionsFrom}: {mentions.handles.slice(0, 5).join(', ')}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SCREEN_PADDING * 0.75,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thumbs: {
    flexDirection: 'row',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderWidth: 2,
    borderColor: colors.background.surface,
  },
  overlapping: {
    marginLeft: -THUMB_SIZE * 0.4,
  },
  title: {
    flex: 1,
    fontSize: typography.subheadline,
    color: colors.text.primary,
  },
  mentions: {
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
});
