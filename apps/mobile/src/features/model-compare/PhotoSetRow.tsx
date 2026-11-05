import { StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import CoverImage, { type CoverImageProps } from '@/components/CoverImage';
import Text from '@/components/Text';
import { Row, Section } from '@/components/settings-list/SettingsList';
import { sizes, space } from '@/styles/designTokens';
import pluralizeText from '@/utils/pluralizeText';

const SHOWN = 3;

export type PhotoSetRowProps = {
  assets: (NonNullable<CoverImageProps['asset']> & { id: string })[];
  detail?: string | null;
  onPick: () => void;
};

// The photos a vision compare tags: the first few ("+N" on the last for the rest), how many, a
// `detail` line under the count ("Same as last time"), and a button to pick them.
export default function PhotoSetRow({ assets, detail, onPick }: PhotoSetRowProps) {
  const count = assets.length;
  const hidden = count - SHOWN;

  return (
    <Section>
      <Row
        leading={
          count > 0 ? (
            <View style={styles.thumbs}>
              {assets.slice(0, SHOWN).map((asset, index) => (
                <CoverImage
                  key={asset.id}
                  asset={asset}
                  moreCount={index === SHOWN - 1 ? hidden : 0}
                  moreCorner="bottomRightSmall"
                  style={styles.thumb}
                />
              ))}
            </View>
          ) : null
        }
        label={
          <Text variant="title" size="small" numberOfLines={1}>
            {count === 0 ? 'No photos' : pluralizeText('%{count} photo', '%{count} photos', count)}
          </Text>
        }
        description={count > 0 && detail ? detail : undefined}
        size="small"
      >
        <Button label={count === 0 ? 'Pick photos' : 'Change'} onPress={onPick} size="small" />
      </Row>
    </Section>
  );
}

const styles = StyleSheet.create({
  thumbs: {
    flexDirection: 'row',
    gap: space.xs,
  },
  thumb: {
    width: sizes.thumbnailSmall,
    height: sizes.thumbnailSmall,
  },
});
