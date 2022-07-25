import { Pressable, Text, StyleSheet, View } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import AssetImage from "components/AssetImage";
import formatVideoDuration from "services/formatVideoDuration";

export default function AssetListItem({ asset, width, onPressAsset, isSelectMode, isAssetSelected }) {
  return (
    <Pressable onPress={() => onPressAsset(asset)}>
      {isSelectMode && (
        <View style={[styles.selectedIndicator, isAssetSelected(asset) && styles.selectedIndicatorSelected]}></View>
      )}

      {!isSelectMode && (
        <>
          {asset.isFavorite && <AntDesign name="heart" size={16} style={styles.isFavorite} />}
          {asset.isUploaded && <Ionicons name="cloud" size={16} style={styles.uploadStatus} />}
          {!asset.isUploaded && <Ionicons name="cloud-offline" size={16} style={styles.uploadStatus} />}
        </>
      )}

      {!!asset.duration && <Text style={styles.videoDuration}>{formatVideoDuration(asset.duration)}</Text>}
      <AssetImage asset={asset} style={[styles.image, { width: width }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: {
    aspectRatio: 1,
    // use "contain" to see aspect ratio of the image
    // TODO: Maybe make this configurable because sometimes you are
    // looking for landscape or portrait picture in particular.
    resizeMode: "cover",
    backgroundColor: "lightgrey",
  },
  isFavorite: {
    position: "absolute",
    zIndex: 1,
    color: "#fff",
    bottom: 5,
    left: 5,
  },
  uploadStatus: {
    position: "absolute",
    zIndex: 1,
    color: "#fff",
    top: 5,
    right: 5,
  },
  videoDuration: {
    position: "absolute",
    zIndex: 1,
    bottom: 5,
    right: 5,
    fontSize: 11,
    color: "white",
    fontWeight: "600",
  },

  selectedIndicator: {
    position: "absolute",
    width: 15,
    height: 15,
    right: 5,
    bottom: 5,
    zIndex: 1,
    borderRadius: 10,
    borderColor: "white",
    borderWidth: 2,
  },
  selectedIndicatorSelected: {
    backgroundColor: "blue",
  },
});
