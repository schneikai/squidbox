import { FlatList, useWindowDimensions } from "react-native";
import AssetListItem from "components/AssetList/AssetListItem";

export default function AssetList({ assets, onPressAsset, isSelectMode, isAssetSelected }) {
  const numColumns = 3;
  const window = useWindowDimensions();
  const width = window.width / numColumns;

  return (
    <FlatList
      data={assets}
      numColumns={numColumns}
      renderItem={({ item }) => (
        <AssetListItem
          asset={item}
          width={width}
          onPressAsset={onPressAsset}
          isSelectMode={isSelectMode}
          isAssetSelected={isAssetSelected}
        />
      )}
      keyExtractor={(item) => item.id}
    />
  );
}
