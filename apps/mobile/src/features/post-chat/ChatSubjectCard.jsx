import { StyleSheet, Text, View } from 'react-native';

import ItSeesRow from './ItSeesRow';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import IntroText from '@/components/IntroText';
import { SCREEN_PADDING } from '@/constants';
import useAssetAlbums from '@/hooks/useAssetAlbums';
import { colors, scale, typography } from '@/styles/designTokens';
import countMediaTypes from '@/utils/assets/countMediaTypes';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

const THUMB_SIZE = scale(36);
const SUBJECTS = { draft: 'New post', edit: 'Edit post' };

/**
 * What the chat is about, at its top: the post's first photos, "New post · 2 Photos · <album>" (the
 * album named when every photo is in it; "Edit post" for a saved post), what the assistant sees in
 * them (ItSeesRow, from `tagging`, useAssetTags', with the post's tag edits `tagEdits`, changed with
 * `onEditTags`) and the handles it may mention (`mentions`, useMentions'), as grey lines.
 */
export default function ChatSubjectCard({ kind, assets, tagging, tagEdits, onEditTags, mentions }) {
  const assetIds = assets.map((asset) => asset.id);
  const albums = useAssetAlbums(assetIds, { isLive: false });

  const albumName = albums?.find((album) => album.heldCount === new Set(assetIds).size)?.name;
  const counts = countMediaTypes(assets);
  const title = [SUBJECTS[kind], assets.length > 0 && getAssetCountInfo(counts), albumName].filter(Boolean).join(' · ');
  // The handles come from every album holding any of the photos, so the album is named only when it
  // is the one.
  const mentionsFrom = mentions?.fromAlbum ? (albums?.length === 1 && albumName) || 'your albums' : 'your posts';

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
        <ItSeesRow
          rows={tagging.rows}
          attempts={tagging.attempts}
          isTagging={tagging.isTagging}
          untagged={tagging.untagged}
          tagEdits={tagEdits}
          onEditTags={onEditTags}
          onRetry={tagging.retry}
        />
      )}
      {mentions?.handles.length > 0 && (
        <IntroText label="Mentions">
          {mentions.handles.slice(0, 5).join(', ')} from {mentionsFrom}
        </IntroText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SCREEN_PADDING * 0.75,
    gap: 6,
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
});
