import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import AssistantBubble from './AssistantBubble';
import ChatOptionCard, { type ChatOptionCardProps } from './ChatOptionCard';
import ReplyError from './ReplyError';
import type { AssistantChatMessage } from './chatSessions';

import Icon from '@/components/Icon';
import InkContext, { DEFAULT_INK } from '@/components/InkContext';
import Text from '@/components/Text';
import useAfterDelay from '@/hooks/useAfterDelay';
import useReduceMotion from '@/hooks/useReduceMotion';
import { colors, layout, motion, sizes, space } from '@/styles/designTokens';

// A reasoning model's first drafting turn can take a while: after this, the card says it still works.
const SLOW_MS = 20_000;

type AssistantMessageProps = Pick<ChatOptionCardProps, 'contactsById' | 'onMoreLikeThis' | 'onUse'> & {
  reply: AssistantChatMessage;
  onRetry: (() => void) | null;
  // The line under the options once one was used (usedNote), or null.
  usedNote: string | null;
};

/**
 * One of the assistant's replies (`reply`, a chat message): a spinner while it's written, what went
 * wrong with Retry (`onRetry`, for the last reply only), or what it says (AssistantBubble) and its
 * options for the post as ChatOptionCards, their chips' contacts from `contactsById`, with `usedNote`
 * under them once one was used.
 */
function AssistantMessage({ reply, contactsById, onRetry, onMoreLikeThis, onUse, usedNote }: AssistantMessageProps) {
  if (reply.status === 'loading') return <ThinkingLine />;

  if (reply.status === 'error') return <ReplyError error={reply.error} onRetry={onRetry} />;

  return (
    <View style={styles.reply}>
      {!!reply.reply.text && <AssistantBubble value={reply.reply} contactsById={contactsById} />}
      {reply.postOptions.map((value, index) => (
        <ChatOptionCard
          key={`${index}:${value.text}`}
          value={value}
          style={styles.option}
          contactsById={contactsById}
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

// "Thinking" as a small grey line where the reply will be, and "Still writing" once it takes longer
// than SLOW_MS, its three dots lighting up one after another (still, with Reduce Motion).
function ThinkingLine() {
  const isSlow = useAfterDelay(true, SLOW_MS);
  const isReduced = useReduceMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (isReduced) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, motion.pulse), -1);
    return () => cancelAnimation(progress);
  }, [isReduced, progress]);

  const label = isSlow ? 'Still writing' : 'Thinking';
  return (
    <InkContext.Provider value={STATUS_INK}>
      <View style={styles.status} accessible accessibilityLabel={`${label}…`}>
        <Text variant="label">{label}</Text>
        {DOTS.map((index) => (
          <ThinkingDot key={index} index={index} progress={progress} />
        ))}
      </View>
    </InkContext.Provider>
  );
}

// Its grey is see-through black (`text.status`), the line and its dots alike.
const STATUS_INK = { ...DEFAULT_INK, secondary: colors.text.status };
const DOTS = [0, 1, 2];
type ThinkingDotProps = { index: number; progress: SharedValue<number> };

// A dot is hidden until its turn comes in the cycle, then shows until the cycle starts over.
function ThinkingDot({ index, progress }: ThinkingDotProps) {
  const style = useAnimatedStyle(() => {
    const start = (index + 1) / (DOTS.length + 1);
    return { opacity: progress.value >= start ? 1 : 0 };
  });

  return (
    <Animated.View style={style}>
      <Text variant="label">.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // In line with a bubble's text.
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
  },
  // An option card leaves the user's side free, like the assistant's bubble.
  option: {
    marginRight: layout.chatOtherSide,
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
