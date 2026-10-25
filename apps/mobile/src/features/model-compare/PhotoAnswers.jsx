import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import ModelAnswers from './ModelAnswers';

import CoverImage from '@/components/CoverImage';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { scale } from '@/styles/designTokens';

const PHOTO_SIZE = scale(96);
// Room between the sticky photo and whatever covers the top of the list.
const STICKY_GAP = 8;

// Memoized: it gets only its photo's results and taps, so the other photos settling leave it be.
export default memo(PhotoAnswers);

/**
 * A photo of a vision round, tappable to open it, beside every model's tags for it. While its cards
 * scroll by, the photo sticks `stickyTop` below the top of the list (`scrollY`, the list's offset;
 * the row must sit directly in the list's content) until the row's end pushes it out.
 */
function PhotoAnswers({
  asset,
  letters,
  namesById,
  results,
  taps,
  roundNumber,
  toggle,
  onOpenPhoto,
  scrollY,
  stickyTop,
}) {
  const rowY = useSharedValue(0);
  const rowHeight = useSharedValue(0);
  const stickyStyle = useAnimatedStyle(() => {
    const pinned = scrollY.value + stickyTop + STICKY_GAP - rowY.value;
    return { transform: [{ translateY: Math.min(Math.max(pinned, 0), Math.max(rowHeight.value - PHOTO_SIZE, 0)) }] };
  });

  function handleLayout({ nativeEvent: { layout } }) {
    rowY.value = layout.y;
    rowHeight.value = layout.height;
  }

  return (
    <View style={styles.row} onLayout={handleLayout}>
      <Animated.View style={stickyStyle}>
        <Pressable onPress={() => onOpenPhoto(asset)} accessibilityRole="imagebutton" accessibilityLabel="Open photo">
          <CoverImage asset={asset} style={styles.photo}>
            <ThumbnailBadge icon="expand" style={styles.expand} />
          </CoverImage>
        </Pressable>
      </Animated.View>
      <View style={styles.cards}>
        <ModelAnswers
          answerKey={asset.id}
          kind="vision"
          letters={letters}
          namesById={namesById}
          results={results}
          taps={taps}
          roundNumber={roundNumber}
          toggle={toggle}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  expand: {
    position: 'absolute',
    right: 6,
    bottom: 6,
  },
  cards: {
    flex: 1,
    gap: 12,
  },
});
