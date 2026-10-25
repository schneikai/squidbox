import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import ModelAnswers from './ModelAnswers';

import CoverImage from '@/components/CoverImage';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { scale } from '@/styles/designTokens';

const PHOTO_SIZE = scale(96);

// Memoized: it gets only its photo's results and taps, so the other photos settling leave it be.
export default memo(PhotoAnswers);

// A photo of a vision round, tappable to open it, beside every model's tags for it.
function PhotoAnswers({ asset, letters, namesById, results, taps, roundNumber, toggle, onOpenPhoto }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onOpenPhoto(asset)} accessibilityRole="imagebutton" accessibilityLabel="Open photo">
        <CoverImage asset={asset} style={styles.photo}>
          <ThumbnailBadge icon="expand" style={styles.expand} />
        </CoverImage>
      </Pressable>
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
