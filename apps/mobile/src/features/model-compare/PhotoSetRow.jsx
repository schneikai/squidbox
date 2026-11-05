import { StyleSheet, Text as RNText, View } from 'react-native';

import Button from '@/components/Button';
import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import Text from '@/components/Text';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { SCREEN_PADDING } from '@/constants';
import { layout, scale, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
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
        <Text variant="title" size="small" numberOfLines={1}>
          {count === 0 ? 'No photos' : pluralizeText('%{count} photo', '%{count} photos', count)}
        </Text>
        {!!detail && count > 0 && <RNText style={listTextStyles.subtitle}>{detail}</RNText>}
      </View>
      <Button label={count === 0 ? 'Pick photos' : 'Change'} onPress={onPick} size="small" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: layout.rowPaddingYCompact,
  },
  thumbs: {
    flexDirection: 'row',
    gap: space.xs,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  more: {
    position: 'absolute',
    right: layout.badgeInsetSmall,
    bottom: layout.badgeInsetSmall,
  },
  text: {
    flex: 1,
  },
});
