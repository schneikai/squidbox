import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';

import AddAssetButton from './AddAssetButton';
import PostAsset from './PostAsset';
import useAssetPickerHandler from './useAssetPickerHandler';

import ProgressModal from '@/components/ProgressModal';
import useAssets from '@/features/assets-context/useAssets';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';
import assetRefsToPostAssets from '@/utils/posts/assetRefsToPostAssets';
import buildPostAssets from '@/utils/posts/buildPostAssets';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

const LIST_VERTICAL_PADDING = 80;

export default function PostAssetsEditor({ assetRefs, onChange }) {
  const { assets } = useAssets();
  const [postAssets, setPostAssets] = useState(assetRefsToPostAssets(assetRefs, assets));
  const [assetCountInfo, setAssetCountInfo] = useState('');
  const { width: screenWidth } = useWindowDimensions();
  const [progress, setProgress] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const handleAddAssets = useAssetPickerHandler({
    addAssetsToPost: addPostAssets,
    onStart: () => {
      setProgressVisible(true);
    },
    onProgress: (progress) => {
      setProgress(progress);
    },
    onFinish: () => {
      setProgressVisible(false);
      setProgress(0);
    },
  });

  const itemDimension = {
    width: screenWidth / 2.5,
    height: screenWidth - LIST_VERTICAL_PADDING * 2,
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

  return (
    <>
      <ProgressModal visible={progressVisible} progress={progress} />
      <View style={[styles.container, { width: screenWidth, height: screenWidth }]}>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: LIST_VERTICAL_PADDING,
    paddingLeft: 15,
    backgroundColor: 'lightgray',
  },
  assetCountInfo: {
    paddingLeft: 5,
    fontSize: 12,
    color: 'gray',
    fontWeight: 'bold',
  },
});
