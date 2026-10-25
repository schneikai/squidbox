import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import TextButton from '@/components/TextButton';
import { SCREEN_PADDING } from '@/constants';
import { colors, radii, scale, typography } from '@/styles/designTokens';

const SHOWN = 4;
const THUMB_SIZE = scale(36);

// The photos a vision compare tags: the first few, "+N" for the rest, how many, whether they're
// the last compare's, and a button to pick them.
export default function PhotoSetRow({ assets, isLastTime, onPick }) {
  const count = assets.length;
  const hidden = count - SHOWN;

  return (
    <Card style={styles.card}>
      {count > 0 && (
        <View style={styles.thumbs}>
          {assets.slice(0, SHOWN).map((asset) => (
            <CoverImage key={asset.id} asset={asset} style={styles.thumb} />
          ))}
          {hidden > 0 && (
            <View style={[styles.thumb, styles.more]}>
              <Text style={styles.moreLabel}>+{hidden}</Text>
            </View>
          )}
        </View>
      )}
      <View style={styles.text}>
        <Text style={styles.count}>{count === 0 ? 'No photos' : `${count} ${count === 1 ? 'photo' : 'photos'}`}</Text>
        {isLastTime && count > 0 && <Text style={styles.detail}>Same as last time</Text>}
      </View>
      <TextButton label={count === 0 ? 'Pick photos' : 'Change'} onPress={onPick} size="small" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  thumbs: {
    flexDirection: 'row',
    gap: 6,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  more: {
    borderRadius: radii.cover,
    backgroundColor: colors.background.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreLabel: {
    fontSize: typography.subheadline,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  count: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  detail: {
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
});
