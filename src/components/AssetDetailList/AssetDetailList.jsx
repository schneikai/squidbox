import { useState, useRef } from "react";
import { SafeAreaView, useWindowDimensions, FlatList } from "react-native";
import AssetDetail from "components/AssetDetail";
import Toolbar from "components/AssetDetailList/Toolbar";

export default function AssetDetailList({
  asset,
  assets,
  onDeleteAsset,
  onDownloadAsset,
  onToggleAssetFavorite,
  onAddToAlbum,
  onCreatePost,
}) {
  const [currentAsset, setCurrentAsset] = useState(asset);
  const window = useWindowDimensions();
  const windowWidth = window.width;
  const initialScrollIndex = assets.findIndex((x) => x.id === asset.id);

  const onViewableItemsChangedRef = useRef(({ viewableItems }) => {
    if (viewableItems.length === 1) {
      setCurrentAsset(viewableItems[0].item);
    } else {
      setCurrentAsset(null);
    }
  });

  return (
    <SafeAreaView>
      <FlatList
        data={assets}
        keyExtractor={(asset) => asset.id}
        renderItem={({ item }) => <AssetDetail asset={item} width={windowWidth} />}
        getItemLayout={(data, index) => ({ length: windowWidth, offset: windowWidth * index, index })}
        initialScrollIndex={initialScrollIndex}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 90 }}
      />
      <Toolbar
        asset={currentAsset}
        onToggleAssetFavorite={onToggleAssetFavorite}
        onDownloadAsset={onDownloadAsset}
        onDeleteAsset={onDeleteAsset}
        onAddToAlbum={onAddToAlbum}
        onCreatePost={onCreatePost}
      />
    </SafeAreaView>
  );
}
