import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import Text from '@/components/Text';
import postTags from '@/features/post-chat/postTags';
import seesLine from '@/features/post-chat/seesLine';
import sentMentions from '@/features/post-chat/sentMentions';
import type { LiveChat } from '@/features/post-chat/useChatSession';
import useChatTags from '@/features/post-chat/useChatTags';
import useMentions from '@/features/post-chat/useMentions';

type SeesLineProps = { chat: Pick<LiveChat, 'assets' | 'tagEdits' | 'mentionEdits'> };

/**
 * What the assistant goes on while it writes the first ideas, as one grey line under the tray's
 * cards: "Looking at the photos…" while they are tagged, "Sees a, b" (seesLine, with the `chat`'s
 * tag edits) and "Mentions @x" (the handles it sends); nothing without any. It reads the photos and
 * mentions only while it shows, and starts no tagging: the turn does.
 */
export default function SeesLine({ chat }: SeesLineProps) {
  const { assets, tagEdits, mentionEdits } = chat;
  const assetIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const tagging = useChatTags(assets);
  const found = useMentions(assetIds);
  const rows = tagging.rows ?? [];
  const tagsText = seesLine(rows, tagging.isTagging, postTags(rows, tagEdits), null);
  const handles = sentMentions(found, mentionEdits);
  const parts = [
    tagging.isTagging && 'Looking at the photos…',
    tagsText !== null && `Sees ${tagsText}`,
    handles.length > 0 && `Mentions ${handles.join(', ')}`,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <Text variant="hint" numberOfLines={1} style={styles.line}>
      {parts.join(' · ')}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: {
    flexShrink: 1,
  },
});
