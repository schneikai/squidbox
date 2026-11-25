import type { AssetRecord } from '@squidbox/shared';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import AssetImage from '@/components/AssetImage';
import Button from '@/components/Button';
import VideoLengthBadge from '@/components/VideoLengthBadge';
import cornerStyles from '@/styles/cornerStyles';
import { press, radii } from '@/styles/designTokens';
import type { PostAsset as BuiltPostAsset } from '@/utils/posts/buildPostAsset';

// What PostCard builds the strip's items with (buildPostAssets): a row, or a record just added from
// the camera roll.
export type EditorPostAsset = BuiltPostAsset<AssetRecord>;

export type PostAssetProps = {
  postAsset: EditorPostAsset;
  onPress: (postAsset: EditorPostAsset) => void;
  onDelete: (postAsset: EditorPostAsset) => void;
  onLongPress: () => void;
  isActive: boolean;
  style: StyleProp<ViewStyle>;
};

// One tile of the post editor's media strip: a tap opens it, × in its top right corner takes it out, a
// video's length at the bottom.
// style is for layout only (its size).
export default function PostAsset({ postAsset, onPress, onDelete, onLongPress, isActive, style }: PostAssetProps) {
  const asset = postAsset.asset;

  return (
    <ScaleDecorator>
      <Pressable
        onPress={() => onPress(postAsset)}
        onLongPress={onLongPress}
        accessibilityLabel={asset.mediaType === 'video' ? 'Show video' : 'Show photo'}
        disabled={isActive}
        style={({ pressed }) => [styles.tile, style, pressed && press.flat]}
      >
        <AssetImage asset={asset} />
        <VideoLengthBadge duration={asset.duration} />
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
