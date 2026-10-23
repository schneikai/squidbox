import { StyleSheet, TouchableOpacity } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import AssetImage from '@/components/AssetImage';
import IconButton from '@/components/IconButton';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { sizes } from '@/styles/designTokens';
import formatVideoDuration from '@/utils/formatVideoDuration';

export default function PostAsset({ postAsset, onDelete, onLongPress, isActive, itemDimension }) {
  const asset = postAsset.asset;

  return (
    <ScaleDecorator>
      <TouchableOpacity onLongPress={onLongPress} disabled={isActive} style={[styles.rowItem, itemDimension]}>
        <IconButton
          variant="destructive"
          icon="close"
          size={sizes.iconSmall}
          onPress={() => onDelete(postAsset)}
          accessibilityLabel="Remove from post"
          style={styles.deleteButton}
        />
        {!!asset.duration && (
          <ThumbnailBadge label={formatVideoDuration(asset.duration)} style={styles.videoDuration} />
        )}
        <AssetImage asset={asset} />
      </TouchableOpacity>
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
