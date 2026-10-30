import { Pressable, StyleSheet } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import AssetImage from '@/components/AssetImage';
import Button from '@/components/Button';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { press } from '@/styles/designTokens';
import formatVideoDuration from '@/utils/formatVideoDuration';

export default function PostAsset({ postAsset, onDelete, onLongPress, isActive, itemDimension }) {
  const asset = postAsset.asset;

  return (
    <ScaleDecorator>
      <Pressable
        onLongPress={onLongPress}
        disabled={isActive}
        style={({ pressed }) => [styles.rowItem, itemDimension, pressed && press.flat]}
      >
        <Button
          variant="secondary"
          colorPalette="danger"
          icon="close"
          size="small"
          onPress={() => onDelete(postAsset)}
          accessibilityLabel="Remove from post"
          style={styles.deleteButton}
        />
        {!!asset.duration && (
          <ThumbnailBadge label={formatVideoDuration(asset.duration)} style={styles.videoDuration} />
        )}
        <AssetImage asset={asset} />
      </Pressable>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  rowItem: {
    padding: 5,
  },
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  videoDuration: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    zIndex: 10,
  },
});
