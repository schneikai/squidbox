import { StyleSheet, View } from 'react-native';

import AssetImage from '@/components/AssetImage';
import SuperPressable from '@/components/SuperPressable';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import VideoLengthBadge from '@/components/VideoLengthBadge';
import { radii, scale, space } from '@/styles/designTokens';
import type { AssetRow } from '@/sync/db/schema';

const IMAGE_ELEMENT_HEIGHT = scale(240);
const GAP = space.xs;

// A post's pictures as rounded tiles: one or two side by side, three as one and a column of two,
// four or more as a 2×2 grid with "+N" for the rest. A video's tile shows its length, except the
// tile that carries the "+N". With `onPressAsset(asset)` each tile opens its picture (the post
// screen); without it the tiles are part of whatever holds them (a list card).
export type PostImageProps = { assets: AssetRow[]; onPressAsset?: (asset: AssetRow) => void };
export default function PostImage({ assets, onPressAsset }: PostImageProps) {
  const tile = (asset: AssetRow) => (
    <Tile
      key={asset.id}
      asset={asset}
      onPressAsset={onPressAsset}
      isLengthShown={!(assets.length > 4 && asset === assets[3])}
    />
  );

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
          {assets.length > 4 && <ThumbnailBadge label={`+${assets.length - 4}`} corner="bottomRight" />}
        </View>
      );
  }
}

type TileProps = { asset: AssetRow; onPressAsset?: PostImageProps['onPressAsset']; isLengthShown: boolean };

// Each picture in its own box: a loading placeholder fills its box, not the whole row.
function Tile({ asset, onPressAsset, isLengthShown }: TileProps) {
  const content = (
    <>
      <AssetImage asset={asset} />
      {isLengthShown && <VideoLengthBadge duration={asset.duration} />}
    </>
  );
  if (!onPressAsset) return <View style={styles.tile}>{content}</View>;
  return (
    <SuperPressable style={styles.tile} onPress={() => onPressAsset(asset)}>
      {content}
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
    borderRadius: radii.postPicture,
    overflow: 'hidden',
  },
});
