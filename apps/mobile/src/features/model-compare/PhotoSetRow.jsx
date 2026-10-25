import { StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import TextButton from '@/components/TextButton';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { SCREEN_PADDING } from '@/constants';
import { colors, scale, typography } from '@/styles/designTokens';
import pluralizeText from '@/utils/pluralizeText';

const SHOWN = 3;
const THUMB_SIZE = scale(34);

// The photos a vision compare tags: the first few ("+N" on the last for the rest), how many, a
// `detail` line under the count ("Same as last time"), and a button to pick them.
export default function PhotoSetRow({ assets, detail, onPick }) {
  const count = assets.length;
  const hidden = count - SHOWN;

  return (
    <Card style={styles.card}>
      {count > 0 && (
        <View style={styles.thumbs}>
          {assets.slice(0, SHOWN).map((asset, index) => (
            <CoverImage key={asset.id} asset={asset} style={styles.thumb}>
              {index === SHOWN - 1 && hidden > 0 && <ThumbnailBadge label={`+${hidden}`} style={styles.more} />}
            </CoverImage>
          ))}
        </View>
      )}
      <View style={styles.text}>
        <Text style={styles.count} numberOfLines={1}>
          {count === 0 ? 'No photos' : pluralizeText('%{count} photo', '%{count} photos', count)}
        </Text>
        {!!detail && count > 0 && <Text style={styles.detail}>{detail}</Text>}
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
    position: 'absolute',
    right: 2,
    bottom: 2,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  count: {
    fontSize: typography.subheadline,
    fontWeight: '600',
    color: colors.text.primary,
  },
  detail: {
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
});
