import { StyleSheet, View } from 'react-native';

import AssetImage from '@/components/AssetImage';
import ThumbnailBadge from '@/components/ThumbnailBadge';

const IMAGE_ELEMENT_HEIGHT = 240;

export default function PostImage({ assets }) {
  switch (assets.length) {
    case 0:
      return null;
    case 1:
    case 2:
      return (
        <View style={styles.row}>
          {assets.map((asset, index) => (
            <View key={index} style={styles.cell}>
              <AssetImage asset={asset} />
            </View>
          ))}
        </View>
      );
    case 3:
      return (
        <View style={styles.row}>
          <View style={styles.cell}>
            <AssetImage asset={assets[0]} />
          </View>
          <View style={styles.cell}>
            <View style={styles.cell}>
              <AssetImage asset={assets[1]} />
            </View>
            <View style={styles.cell}>
              <AssetImage asset={assets[2]} />
            </View>
          </View>
        </View>
      );
    default:
      return <PostImageFourImages assets={assets} />;
  }
}

function PostImageFourImages({ assets }) {
  const moreImages = assets.length - 4;

  return (
    <View style={[styles.row, styles.grid]}>
      {assets.slice(0, 4).map((asset, index) => (
        <View key={index} style={styles.quarter}>
          <AssetImage asset={asset} />
        </View>
      ))}
      {moreImages > 0 && <ThumbnailBadge label={`+${moreImages}`} style={styles.moreImages} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: IMAGE_ELEMENT_HEIGHT,
  },
  // Each picture in its own box: a loading placeholder fills its box, not the whole row.
  cell: {
    flex: 1,
  },
  grid: {
    flexWrap: 'wrap',
  },
  quarter: {
    height: IMAGE_ELEMENT_HEIGHT / 2,
    width: '50%',
  },
  moreImages: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
});
