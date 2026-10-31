import { Pressable, StyleSheet } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import AssetImage from '@/components/AssetImage';
import Button from '@/components/Button';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { press, radii, scale } from '@/styles/designTokens';
import formatVideoDuration from '@/utils/formatVideoDuration';

// One tile of the post editor's media strip: × in its top right corner, a video's length at the bottom.
// style is for layout only (its size).
export default function PostAsset({ postAsset, onDelete, onLongPress, isActive, style }) {
  const asset = postAsset.asset;

  return (
    <ScaleDecorator>
      <Pressable
        onLongPress={onLongPress}
        disabled={isActive}
        style={({ pressed }) => [styles.tile, style, pressed && press.flat]}
      >
        <AssetImage asset={asset} />
        {!!asset.duration && (
          <ThumbnailBadge label={formatVideoDuration(asset.duration)} style={styles.videoDuration} />
        )}
        <Button
          variant="overlay"
          icon="close"
          onPress={() => onDelete(postAsset)}
          accessibilityLabel="Remove from post"
          style={styles.deleteButton}
        />
      </Pressable>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  deleteButton: {
    position: 'absolute',
    top: scale(6),
    right: scale(6),
  },
  videoDuration: {
    position: 'absolute',
    bottom: scale(6),
    right: scale(6),
  },
});
