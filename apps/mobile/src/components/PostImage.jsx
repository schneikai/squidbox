import { StyleSheet, View } from 'react-native';

import AssetImage from '@/components/AssetImage';
import SuperPressable from '@/components/SuperPressable';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { radii, scale } from '@/styles/designTokens';

const IMAGE_ELEMENT_HEIGHT = scale(240);
const GAP = scale(4);

// A post's pictures as rounded tiles: one or two side by side, three as one and a column of two,
// four or more as a 2×2 grid with "+N" for the rest. With `onPressAsset(asset)` each tile opens its
// picture (the post screen); without it the tiles are part of whatever holds them (a list card).
export default function PostImage({ assets, onPressAsset }) {
  const tile = (asset) => <Tile key={asset.id} asset={asset} onPressAsset={onPressAsset} />;

  switch (assets.length) {
    case 0:
      return null;
    case 1:
    case 2:
      return <View style={[styles.frame, styles.row]}>{assets.map(tile)}</View>;
    case 3:
      return (
        <View style={[styles.frame, styles.row]}>
          {tile(assets[0])}
          <View style={[styles.half, styles.column]}>{assets.slice(1).map(tile)}</View>
        </View>
      );
    default:
      return (
        <View style={[styles.frame, styles.column]}>
          <View style={[styles.half, styles.row]}>{assets.slice(0, 2).map(tile)}</View>
          <View style={[styles.half, styles.row]}>{assets.slice(2, 4).map(tile)}</View>
          {assets.length > 4 && <ThumbnailBadge label={`+${assets.length - 4}`} style={styles.moreImages} />}
        </View>
      );
  }
}

// Each picture in its own box: a loading placeholder fills its box, not the whole row.
function Tile({ asset, onPressAsset }) {
  if (!onPressAsset) {
    return (
      <View style={styles.tile}>
        <AssetImage asset={asset} />
      </View>
    );
  }
  return (
    <SuperPressable style={styles.tile} onPress={() => onPressAsset(asset)}>
      <AssetImage asset={asset} />
    </SuperPressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: IMAGE_ELEMENT_HEIGHT,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  column: {
    gap: GAP,
  },
  half: {
    flex: 1,
  },
  tile: {
    flex: 1,
    borderRadius: radii.cover,
    overflow: 'hidden',
  },
  moreImages: {
    position: 'absolute',
    bottom: scale(10),
    right: scale(10),
  },
});
