import { type ComponentRef, memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import type { IdeasRun } from './ideasRun';

import Card from '@/components/Card';
import Icon from '@/components/Icon';
import OptionCard from '@/components/OptionCard';
import Text from '@/components/Text';
import ChatOptionCard from '@/features/post-chat/ChatOptionCard';
import ReplyError from '@/features/post-chat/ReplyError';
import useBreath from '@/hooks/useBreath';
import usePagerScrollEnd from '@/hooks/usePagerScrollEnd';
import useTrayInset from '@/hooks/useTrayInset';
import { colors, disabledOpacity, press, radii, sizes, space } from '@/styles/designTokens';

const CARD_GAP = space.sm;
const INTERVAL = sizes.ideaCard.width + CARD_GAP;
// The skeleton cards while ideas are written.
const SKELETONS = [0, 1, 2];
// The page dots shown at most, around the current card.
const MAX_DOTS = 9;

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
 * last) does. Three skeleton cards while its first reply is written. Page dots under it, one per
 * card, hidden from VoiceOver.
 */
function IdeasCarousel({ run, onUse, onMore, onRetry, isBusy }: IdeasCarouselProps) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const inset = useTrayInset();
  const breath = useBreath();
  const { items, isWriting, error } = run;
  const isWritingMore = isWriting && items.length > 0;
  const trailingCount = isWriting ? SKELETONS.length : 1;
  const pageCount = items.length + trailingCount;

  // The page is read where the snap has settled, not on every scroll event.
  const settleAt = useCallback((x: number) => setPage(Math.round(x / INTERVAL)), []);
  usePagerScrollEnd(scrollRef, settleAt);

  // More was tapped: show where its ideas come in.
  useEffect(() => {
    if (isWritingMore) scrollRef.current?.scrollTo({ x: items.length * INTERVAL, animated: true });
  }, [isWritingMore, items.length]);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    settleAt(event.nativeEvent.contentOffset.x);
  }

  function trailing() {
    if (isWriting) return SKELETONS.map((key) => <SkeletonCard key={key} breath={breath} />);
    if (error) {
      return <ReplyError error={error.message} onRetry={error.canRetry ? onRetry : null} style={styles.card} />;
    }
    return <MoreCard onPress={onMore} disabled={isBusy} />;
  }

  return (
    <View style={styles.carousel}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={INTERVAL}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={[styles.content, { paddingHorizontal: inset }]}
      >
        {items.map((item) =>
          item.index === null ? (
            <OptionCard key={`${item.replyId}:text`} text={item.text} style={styles.card} />
          ) : (
            <ChatOptionCard
              key={`${item.replyId}:${item.index}`}
              text={item.text}
              replyId={item.replyId}
              index={item.index}
              onMoreLikeThis={null}
              onUse={onUse}
              style={styles.card}
            />
          ),
        )}
        {trailing()}
      </ScrollView>
      {pageCount > 1 && <PageDots count={pageCount} current={Math.min(page, pageCount - 1)} />}
    </View>
  );
}

type MoreCardProps = { onPress: () => void; disabled: boolean };

// The last card: More, as big as an idea.
function MoreCard({ onPress, disabled }: MoreCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="More ideas"
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

// A card while its idea is written: two bars that breathe (useBreath, one breath for all the cards).
function SkeletonCard({ breath }: SkeletonCardProps) {
  const breathStyle = useAnimatedStyle(() => ({ opacity: interpolate(breath.value, [0, 1], [1, 0.45]) }));

  return (
    <Card padded style={styles.card} accessibilityLabel="Writing an idea">
      <Animated.View style={[styles.bars, breathStyle]}>
        <View style={[styles.bar, styles.barLong]} />
        <View style={[styles.bar, styles.barShort]} />
      </Animated.View>
    </Card>
  );
}

type PageDotsProps = { count: number; current: number };

// One dot per card, the current one violet; at most MAX_DOTS, around the current card.
function PageDots({ count, current }: PageDotsProps) {
  const start = Math.max(0, Math.min(current - Math.floor(MAX_DOTS / 2), count - MAX_DOTS));
  const pages = Array.from({ length: Math.min(count, MAX_DOTS) }, (_, index) => start + index);

  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pages.map((index) => (
        <View key={index} style={[styles.dot, index === current && styles.dotCurrent]} />
      ))}
    </View>
  );
}

const DOT = space.xs + space.hair;

export default memo(IdeasCarousel);

const styles = StyleSheet.create({
  carousel: {
    gap: space.sm,
  },
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
  bars: {
    gap: space.sm,
  },
  bar: {
    height: space.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.accent.light,
  },
  barLong: {
    width: '90%',
  },
  barShort: {
    width: '60%',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xs,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pill,
    backgroundColor: colors.accent.border,
  },
  dotCurrent: {
    backgroundColor: colors.accent.base,
  },
});
