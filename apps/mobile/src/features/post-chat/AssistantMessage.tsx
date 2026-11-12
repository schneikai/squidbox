import { memo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import AssistantBubble from './AssistantBubble';
import ChatOptionCard, { type ChatOptionCardProps } from './ChatOptionCard';
import ReplyError from './ReplyError';
import type { AssistantChatMessage } from './chatSessions';

import Card from '@/components/Card';
import Icon from '@/components/Icon';
import Text from '@/components/Text';
import useAfterDelay from '@/hooks/useAfterDelay';
import { colors, layout, sizes, space } from '@/styles/designTokens';

// A reasoning model's first drafting turn can take a while: after this, the card says it still works.
const SLOW_MS = 20_000;

type AssistantMessageProps = Pick<ChatOptionCardProps, 'onMoreLikeThis' | 'onUse'> & {
  reply: AssistantChatMessage;
  onRetry: (() => void) | null;
  // The line under the options once one was used (usedNote), or null.
  usedNote: string | null;
};

/**
 * One of the assistant's replies (`reply`, a chat message): a spinner while it's written, what went
 * wrong with Retry (`onRetry`, for the last reply only), or what it says (AssistantBubble) and its
 * options for the post as ChatOptionCards, with `usedNote` under them once one was used.
 */
function AssistantMessage({ reply, onRetry, onMoreLikeThis, onUse, usedNote }: AssistantMessageProps) {
  if (reply.status === 'loading') return <ThinkingCard />;

  if (reply.status === 'error') return <ReplyError error={reply.error} onRetry={onRetry} />;

  return (
    <View style={styles.reply}>
      {!!reply.reply && <AssistantBubble text={reply.reply} />}
      {reply.postOptions.map((text, index) => (
        <ChatOptionCard
          key={`${index}:${text}`}
          text={text}
          replyId={reply.id}
          index={index}
          onMoreLikeThis={onMoreLikeThis}
          onUse={onUse}
        />
      ))}
      {usedNote && (
        <View style={styles.used}>
          <Icon name="check" size={sizes.menuIcon} color={colors.text.secondary} />
          <Text variant="hint">{usedNote}</Text>
        </View>
      )}
    </View>
  );
}

export default memo(AssistantMessage);

// "Thinking…", and "Still writing…" once it takes longer than SLOW_MS.
function ThinkingCard() {
  const isSlow = useAfterDelay(true, SLOW_MS);

  return (
    <Card padded style={styles.status}>
      <ActivityIndicator color={colors.text.secondary} />
      <Text variant="status" style={styles.statusText}>
        {isSlow ? 'Still writing…' : 'Thinking…'}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    // One line: a compact row's height.
    paddingVertical: layout.rowPaddingYCompact,
  },
  statusText: {
    flex: 1,
  },
  reply: {
    gap: layout.cardGap,
  },
  used: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: layout.cardInset,
  },
});
