import { type ComponentRef, memo, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import type { IdeasRun } from './ideasRun';

import Card from '@/components/Card';
import Icon from '@/components/Icon';
import OptionCard from '@/components/OptionCard';
import Text from '@/components/Text';
import ChatOptionCard from '@/features/post-chat/ChatOptionCard';
import ReplyError from '@/features/post-chat/ReplyError';
import useBreath from '@/hooks/useBreath';
import useTrayInset from '@/hooks/useTrayInset';
import { colors, disabledOpacity, lineHeights, press, radii, sizes, space } from '@/styles/designTokens';

const CARD_GAP = space.sm;
const INTERVAL = sizes.ideaCard.width + CARD_GAP;
// The skeleton cards while ideas are written.
const SKELETONS = [0, 1, 2];
// A skeleton's lines, as wide as an idea's lines of small text, the last one short.
const SKELETON_LINES = ['100%', '94%', '97%', '58%'] as const;

type IdeasCarouselProps = {
  run: IdeasRun;
  onUse: ((replyId: string, index: number) => void) | null;
  onMore: () => void;
  onRetry: () => void;
  // While another reply is written in the chat: More waits.
  isBusy: boolean;
};

/**
 * A run's ideas as cards side by side, swiped one at a time, all as tall as the tallest: each idea
 * with Use (`onUse(replyId, index)`; Copy without it) and no ⋯, then one card of the same size,
 * More (`onMore`); while More is written, skeleton cards take its place and the carousel scrolls to
 * the first, and after a failure the error with Retry (`onRetry`, when the run's reply is the chat's
 * last) does. Three skeleton cards while its first reply is written. It shows the idea last used
 * (marked Used) as it is used, in the tray or the chat.
 */
function IdeasCarousel({ run, onUse, onMore, onRetry, isBusy }: IdeasCarouselProps) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const inset = useTrayInset();
  const breath = useBreath();
  // The idea last used (in the tray or the chat), which the carousel shows when the tray unfolds:
  // it goes there as the tray folds, unseen.
  const lastUsed = run.items.findLastIndex((item) => item.isUsed);

  useEffect(() => {
    if (run.isFolded && lastUsed >= 0) scrollRef.current?.scrollTo({ x: lastUsed * INTERVAL, animated: false });
  }, [run.isFolded, lastUsed]);

  // More was tapped: show where its ideas come in.
  useEffect(() => {
    if (run.isWriting && run.items.length > 0) {
      scrollRef.current?.scrollTo({ x: run.items.length * INTERVAL, animated: true });
    }
  }, [run.isWriting, run.items.length]);

  const { items, isWriting, error } = run;

  function trailing() {
    if (isWriting) return SKELETONS.map((key) => <SkeletonCard key={key} breath={breath} />);
    if (error) {
      return <ReplyError error={error.message} onRetry={error.canRetry ? onRetry : null} style={styles.card} />;
    }
    return <MoreCard onPress={onMore} disabled={isBusy} />;
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={INTERVAL}
      decelerationRate="fast"
      contentContainerStyle={[styles.content, { paddingHorizontal: inset }]}
    >
      {items.map((item) =>
        item.index === null ? (
          <OptionCard key={`${item.replyId}:text`} text={item.text} textSize="small" style={styles.card} />
        ) : (
          <ChatOptionCard
            key={`${item.replyId}:${item.index}`}
            text={item.text}
            replyId={item.replyId}
            index={item.index}
            onMoreLikeThis={null}
            onUse={onUse}
            isUsed={item.isUsed}
            textSize="small"
            style={styles.card}
          />
        ),
      )}
      {trailing()}
    </ScrollView>
  );
}

type MoreCardProps = { onPress: () => void; disabled: boolean };

// The last card: More, as big as an idea.
function MoreCard({ onPress, disabled }: MoreCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="More"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && press.flat, disabled && styles.disabled]}
    >
      <Card padded style={styles.more}>
        <Icon name="refresh" size={sizes.icon} color={colors.accent.base} />
        <Text variant="assistant">More</Text>
      </Card>
    </Pressable>
  );
}

type SkeletonCardProps = { breath: SharedValue<number> };

// A card while its idea is written: bars on the lines of the idea's small text (its line height,
// about its letters' height), breathing (useBreath, one breath for all the cards).
function SkeletonCard({ breath }: SkeletonCardProps) {
  const breathStyle = useAnimatedStyle(() => ({ opacity: interpolate(breath.value, [0, 1], [1, 0.45]) }));

  return (
    <Card padded style={styles.card} accessibilityLabel="Writing an idea">
      <Animated.View style={breathStyle}>
        {SKELETON_LINES.map((width) => (
          <View key={width} style={styles.line}>
            <View style={[styles.bar, { width }]} />
          </View>
        ))}
      </Animated.View>
    </Card>
  );
}

export default memo(IdeasCarousel);

const styles = StyleSheet.create({
  content: {
    gap: CARD_GAP,
  },
  card: {
    width: sizes.ideaCard.width,
    minHeight: sizes.ideaCard.minHeight,
  },
  disabled: {
    opacity: disabledOpacity,
  },
  more: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  line: {
    height: lineHeights.subheadline,
    justifyContent: 'center',
  },
  bar: {
    height: space.sm + space.hair,
    borderRadius: radii.pill,
    backgroundColor: colors.accent.border,
  },
});
