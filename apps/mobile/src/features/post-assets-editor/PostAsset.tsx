import type { AssetRecord } from '@squidbox/shared';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import AssetImage from '@/components/AssetImage';
import Button from '@/components/Button';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import cornerStyles from '@/styles/cornerStyles';
import { press, radii } from '@/styles/designTokens';
import formatVideoDuration from '@/utils/formatVideoDuration';
import type { PostAsset as BuiltPostAsset } from '@/utils/posts/buildPostAsset';

// What PostCard builds the strip's items with (buildPostAssets): a row, or a record just added from
// the camera roll.
type EditorPostAsset = BuiltPostAsset<AssetRecord>;

export type PostAssetProps = {
  postAsset: EditorPostAsset;
  onDelete: (postAsset: EditorPostAsset) => void;
  onLongPress: () => void;
  isActive: boolean;
  style: StyleProp<ViewStyle>;
};

// One tile of the post editor's media strip: × in its top right corner, a video's length at the bottom.
// style is for layout only (its size).
export default function PostAsset({ postAsset, onDelete, onLongPress, isActive, style }: PostAssetProps) {
  const asset = postAsset.asset;

  return (
    <ScaleDecorator>
      <Pressable
        onLongPress={onLongPress}
        disabled={isActive}
        style={({ pressed }) => [styles.tile, style, pressed && press.flat]}
      >
        <AssetImage asset={asset} />
        {!!asset.duration && <ThumbnailBadge label={formatVideoDuration(asset.duration)} corner="bottomRight" />}
        <Button
          variant="secondary"
          size="small"
          isInverse
          icon="close"
          onPress={() => onDelete(postAsset)}
          accessibilityLabel="Remove from post"
          style={cornerStyles.topRight}
        />
      </Pressable>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  // A thumbnail outside a post's card, like every CoverImage.
  tile: {
    borderRadius: radii.cover,
    overflow: 'hidden',
  },
});
