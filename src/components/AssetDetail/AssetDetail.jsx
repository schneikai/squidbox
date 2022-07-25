import { View, StyleSheet, Text } from "react-native";
import AssetImage from "components/AssetImage";
import { dateToFromNow } from "services/TimeService";

export default function AssetDetail({ asset, width }) {
  return (
    <View style={[styles.imageContainer, { width: width }]}>
      {asset.lastPostedAt && <Text style={styles.lastPostedAt}>{dateToFromNow(asset.lastPostedAt)}</Text>}
      <AssetImage asset={asset} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  lastPostedAt: {
    position: "absolute",
    top: 10,
    right: 10,
    opacity: 0.25,
  },
});
