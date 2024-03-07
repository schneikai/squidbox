import { useState, useEffect, useRef } from 'react';
import { SafeAreaView, FlatList, StyleSheet, useWindowDimensions } from 'react-native';

import AssetHeader from '@/components/AssetHeader';
import HeaderActions from '@/components/HeaderActions';
import VideoControls from '@/components/VideoControls';
import AssetItem from '@/features/asset-detail/AssetItem';
import DownloadAssetAction from '@/features/asset-detail/actions/DownloadAssetAction';
import MoreAction from '@/features/asset-detail/actions/MoreAction';
import ToggleFavoriteAssetAction from '@/features/asset-detail/actions/ToggleFavoriteAssetAction';
import useAssets from '@/features/assets-context/useAssets';
import { MEDIA_TYPES } from '@/utils/assets/constants';

export default function AssetScreen({ route, navigation }) {
  const { assets, setAssetsDeleted } = useAssets();
  const [asset, setAsset] = useState(assets[route.params.assetId]);
  const [assetIds, setAssetIds] = useState(route.params.assetIds);

  const window = useWindowDimensions();
  const windowWidth = window.width;
  const initialScrollIndex = assetIds.findIndex((x) => x === route.params.assetId);

  useEffect(() => {
    // If state was updated, we need to update the asset.
    let updatedAsset = assets[asset.id];

    // If asset was deleted we need to remove it from the list of assets
    // and get the next asset from the list.
    if (updatedAsset.isDeleted) {
      const assetIndex = assetIds.findIndex((x) => x === asset.id);
      const newAssetId = assetIds[assetIndex + 1] || assetIds[assetIndex - 1];
      setAssetIds((assetIds) => assetIds.filter((x) => x !== asset.id));
      updatedAsset = assets[newAssetId];
    }

    setAsset(updatedAsset);
  }, [assets]);

  const onViewableItemsChangedRef = useRef(({ viewableItems }) => {
    const assetId = viewableItems && viewableItems.length > 0 && viewableItems[0].item;
    if (!assetId) return;
    setAsset(assets[assetId]);
  });

  return (
    <SafeAreaView style={styles.container}>
      <AssetHeader asset={asset} onPressBack={() => navigation.goBack()}>
        <HeaderActions>
          <ToggleFavoriteAssetAction asset={asset} />
          <DownloadAssetAction asset={asset} />
          <MoreAction asset={asset} navigation={navigation} onDeleteAsset={(asset) => setAssetsDeleted([asset.id])} />
        </HeaderActions>
      </AssetHeader>

      <FlatList
        data={assetIds}
        keyExtractor={(assetId) => assetId}
        renderItem={({ item: assetId }) => {
          const asset = assets[assetId];
          if (!asset) return null;
          return <AssetItem asset={asset} style={{ width: windowWidth }} />;
        }}
        getItemLayout={(data, index) => ({ length: windowWidth, offset: windowWidth * index, index })}
        initialScrollIndex={initialScrollIndex}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 90 }}
      />

      {asset && asset.mediaType === MEDIA_TYPES.VIDEO && <VideoControls asset={asset} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
