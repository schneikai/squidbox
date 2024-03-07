import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import AssetImage from '@/components/AssetImage';
import formatVideoDuration from '@/utils/formatVideoDuration';

export default function PostAsset({ postAsset, onDelete, onLongPress, isActive, itemDimension }) {
  const asset = postAsset.asset;

  return (
    <ScaleDecorator>
      <TouchableOpacity onLongPress={onLongPress} disabled={isActive} style={[styles.rowItem, itemDimension]}>
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(postAsset)}>
          <Text style={styles.deleteButtonText}>X</Text>
        </TouchableOpacity>
        {!!asset.duration && <Text style={styles.videoDuration}>{formatVideoDuration(asset.duration)}</Text>}
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
    top: 5,
    right: 5,
    padding: 8,
    backgroundColor: 'rgba(255,0,0,0.6)',
    zIndex: 10,
  },
  deleteButtonText: {
    color: 'white',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    zIndex: 10,
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
