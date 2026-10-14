import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';

import AddAssetButton from './AddAssetButton';
import PostAsset from './PostAsset';
import useAssetPickerHandler from './useAssetPickerHandler';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import { colors, scale } from '@/styles/designTokens';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';
import buildPostAssets from '@/utils/posts/buildPostAssets';

const LIST_VERTICAL_PADDING = 80;

// The post's assets ([{ id, asset }]) as an orderable strip; `onChange` gets the new list.
export default function PostAssetsEditor({ postAssets, onChange }) {
  const { width } = useWindowDimensions();
  const { show, hide, updateProgress } = useProgressOverlay();
  const handleAddAssets = useAssetPickerHandler({
    addAssetsToPost: addPostAssets,
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  const itemDimension = {
    width: width / 2.5,
    height: width - LIST_VERTICAL_PADDING * 2,
  };

  const counts = { photo: 0, video: 0 };
  for (const { asset } of postAssets) counts[asset.mediaType] += 1;
  const assetCountInfo = getAssetCountInfo(counts);

  function addPostAssets(assets) {
    onChange([...postAssets, ...buildPostAssets(assets)]);
  }

  function deletePostAsset(postAsset) {
    onChange(postAssets.filter((x) => x.id !== postAsset.id));
  }

  return (
    <View style={[styles.container, { width, height: width }]}>
      <DraggableFlatList
        data={postAssets}
        horizontal
        showsHorizontalScrollIndicator={false}
        onDragEnd={({ data }) => onChange(data)}
        keyExtractor={(postAsset) => postAsset.id}
        renderItem={({ item: postAsset, drag, isActive }) => (
          <PostAsset
            postAsset={postAsset}
            onDelete={deletePostAsset}
            onLongPress={drag}
            isActive={isActive}
            itemDimension={itemDimension}
          />
        )}
        ListFooterComponent={<AddAssetButton onAdd={handleAddAssets} itemDimension={itemDimension} />}
      />
      {postAssets.length > 0 && <Text style={styles.assetCountInfo}>{assetCountInfo}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: LIST_VERTICAL_PADDING,
    paddingLeft: 15,
    backgroundColor: colors.glassSurface,
  },
  assetCountInfo: {
    paddingLeft: 5,
    fontSize: scale(12),
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
});
