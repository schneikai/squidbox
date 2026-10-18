import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';

import AddAssetButton from './AddAssetButton';
import PostAsset from './PostAsset';
import useAssetPickerHandler from './useAssetPickerHandler';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useHaptics from '@/hooks/useHaptics';
import { colors, scale } from '@/styles/designTokens';
import countMediaTypes from '@/utils/assets/countMediaTypes';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';
import buildPostAssets from '@/utils/posts/buildPostAssets';

const LIST_VERTICAL_PADDING = 80;

// The post's assets ([{ id, asset }]) as an orderable strip; `onChange` gets the new list.
export default function PostAssetsEditor({ postAssets, onChange }) {
  const { width } = useWindowDimensions();
  const { show, hide, updateProgress } = useProgressOverlay();
  const haptics = useHaptics();
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

  const assetCountInfo = getAssetCountInfo(countMediaTypes(postAssets.map((postAsset) => postAsset.asset)));

  function addPostAssets(assets) {
    onChange([...postAssets, ...buildPostAssets(assets)]);
  }

  function deletePostAsset(postAsset) {
    onChange(postAssets.filter((x) => x.id !== postAsset.id));
  }

  function handleDragEnd({ data, from, to }) {
    if (from !== to) haptics.drop();
    onChange(data);
  }

  return (
    <View style={[styles.container, { width, height: width }]}>
      <DraggableFlatList
        data={postAssets}
        horizontal
        showsHorizontalScrollIndicator={false}
        onDragBegin={haptics.lift}
        onDragEnd={handleDragEnd}
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
