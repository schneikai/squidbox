import type { AssetRecord, ChatSubjectKind } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

import ChatSubjectLines from './ChatSubjectLines';
import fullAlbumName from './fullAlbumName';
import type { LiveChat } from './useChatSession';
import type { ChatTagging } from './useChatTags';
import type { Mentions } from './useMentions';
import type { ListEdits } from './withEdits';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import Text from '@/components/Text';
import useAssetAlbums from '@/hooks/useAssetAlbums';
import { colors, layout, sizes } from '@/styles/designTokens';
import countMediaTypes from '@/utils/assets/countMediaTypes';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

const THUMB_SIZE = sizes.thumbnailSmall;
const SUBJECTS: Record<ChatSubjectKind, string> = { draft: 'New post', edit: 'Edit post', post: 'This post' };

type ChatSubjectCardProps = {
  kind: ChatSubjectKind;
  // The posts of the thread, the post's own included.
  postCount: number;
  assets: AssetRecord[];
  tagging: ChatTagging;
  tagEdits: ListEdits;
  onEditTags: LiveChat['editTags'];
  mentions: Mentions | undefined;
  onEditMentions: LiveChat['editMentions'];
};

/**
 * What the chat is about, at its top: the post's first photos, "New post · 2 Photos · <album>" (the
 * album named when every photo is in it; "Edit post" for a saved post; "· thread of 3" after the
 * name for a thread, the photos those of all its posts), what the assistant sees in
 * them and the handles it may mention, as grey lines a tap edits (ChatSubjectLines: `tagging`,
 * useChatTags', with the post's tag edits `tagEdits`, changed with `onEditTags`; `mentions`,
 * usePostChat's, changed with `onEditMentions`).
 */
export default function ChatSubjectCard({
  kind,
  postCount,
  assets,
  tagging,
  tagEdits,
  onEditTags,
  mentions,
  onEditMentions,
}: ChatSubjectCardProps) {
  const assetIds = assets.map((asset) => asset.id);
  const albums = useAssetAlbums({ assetIds }, { isLive: false });

  const albumName = fullAlbumName(albums, assetIds);
  const counts = countMediaTypes(assets);
  const title = [
    SUBJECTS[kind],
    postCount > 1 && `thread of ${postCount}`,
    assets.length > 0 && getAssetCountInfo(counts),
    albumName,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card padded>
      <View style={styles.header}>
        {assets.length > 0 && (
          <View style={styles.thumbs}>
            {assets.slice(0, 2).map((asset, index) => (
              <CoverImage key={asset.id} asset={asset} style={[styles.thumb, index > 0 && styles.overlapping]} />
            ))}
          </View>
        )}
        <Text size="small" numberOfLines={2} style={styles.title}>
          {title}
        </Text>
      </View>
      <ChatSubjectLines
        assetIds={assetIds}
        albums={albums}
        tagging={tagging}
        mentions={mentions}
        chat={{ tagEdits, editTags: onEditTags, editMentions: onEditMentions }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.rowLeadingGap,
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
    // eslint-disable-next-line no-restricted-syntax -- the thumbs overlap by a share of their width
    marginLeft: -THUMB_SIZE * 0.4,
  },
  title: {
    flex: 1,
  },
});
