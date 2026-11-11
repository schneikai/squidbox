import { StyleSheet } from 'react-native';

import Text from '@/components/Text';
import postTags from '@/features/post-chat/postTags';
import seesLine from '@/features/post-chat/seesLine';
import type { PostIdeas } from '@/features/post-ideas/usePostIdeas';

type SeesLineProps = Pick<PostIdeas, 'tagging' | 'mentions'> & { tagEdits: NonNullable<PostIdeas['chat']>['tagEdits'] };

/**
 * What the assistant goes on while it writes the first ideas, as one grey line under the tray's
 * cards: "Sees a, b · Mentions @x" (seesLine's tags with the chat's `tagEdits`, `mentions`, those it
 * sends), or "Looking at the photos…" while they are tagged; nothing without either. It starts no
 * tagging: the turn does.
 */
export default function SeesLine({ tagging, mentions, tagEdits }: SeesLineProps) {
  const rows = tagging.rows ?? [];
  const tags = postTags(rows, tagEdits);
  const { isLooking } = seesLine(rows, tagging.isTagging, tags);
  const handles = mentions?.handles ?? [];
  const parts = [
    isLooking ? 'Looking at the photos…' : tags.length > 0 && `Sees ${tags.join(', ')}`,
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
