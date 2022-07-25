import { StyleSheet, ScrollView, View, useWindowDimensions } from "react-native";
import AssetImage from "components/AssetImage";

export default function PostAssets({ postAssets }) {
  const window = useWindowDimensions();

  return (
    <ScrollView
      horizontal={true}
      showsHorizontalScrollIndicator={false}
      pagingEnabled
      bounces={false}
      style={styles.container}
    >
      {postAssets.map((postAsset) => (
        <View key={postAsset.id} style={[{ width: window.width }, styles.asset]}>
          <AssetImage asset={postAsset.asset} style={styles.assetImage} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 350,
  },
  asset: {
    backgroundColor: "lightgrey",
  },
  assetImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
});
