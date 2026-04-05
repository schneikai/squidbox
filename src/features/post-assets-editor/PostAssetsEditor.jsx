import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';

import AddAssetButton from './AddAssetButton';
import PostAsset from './PostAsset';
import useAssetPickerHandler from './useAssetPickerHandler';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useAssets from '@/features/assets-context/useAssets';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';
import assetRefsToPostAssets from '@/utils/posts/assetRefsToPostAssets';
import buildPostAsset from '@/utils/posts/buildPostAsset';
import buildPostAssets from '@/utils/posts/buildPostAssets';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';
import { colors, scale } from '@/styles/designTokens';

const LIST_VERTICAL_PADDING = 80;

export default function PostAssetsEditor({ assetRefs, onChange, getRandomAsset, randomizeRef }) {
  const { assets } = useAssets();
  const [postAssets, setPostAssets] = useState(assetRefsToPostAssets(assetRefs, assets));
  const [assetCountInfo, setAssetCountInfo] = useState('');
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

  useEffect(() => {
    const assetCountInfo = getAssetCountInfo(postAssets.map((postAsset) => postAsset.asset));
    setAssetCountInfo(assetCountInfo);
    onChange(postAssetsToAssetRefs(postAssets));
  }, [postAssets]);

  function addPostAssets(assets) {
    setPostAssets((postAssets) => [...postAssets, ...buildPostAssets(assets)]);
  }

  function deletePostAsset(postAsset) {
    setPostAssets((postAssets) => postAssets.filter((x) => x.id !== postAsset.id));
  }

  function handleRandomizeAsset() {
    const asset = getRandomAsset?.();
    if (asset) setPostAssets([buildPostAsset(asset)]);
  }

  useEffect(() => {
    if (randomizeRef) randomizeRef.current = handleRandomizeAsset;
  });

  return (
    <View style={[styles.container, { width, height: width }]}>
      <DraggableFlatList
        data={postAssets}
        horizontal
        showsHorizontalScrollIndicator={false}
        onDragEnd={({ data }) => setPostAssets(data)}
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
