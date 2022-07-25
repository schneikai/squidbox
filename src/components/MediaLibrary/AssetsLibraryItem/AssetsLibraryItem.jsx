import { StyleSheet, View, Text, Pressable, Image } from "react-native";
import formatVideoDuration from "services/formatVideoDuration";

export default function AssetsLibraryItem({ item, width, onSelectAsset, isAssetSelected }) {
  return (
    <Pressable onPress={() => onSelectAsset(item)}>
      {!!item.duration && <Text style={styles.videoDuration}>{formatVideoDuration(item.duration)}</Text>}
      {isAssetSelected(item) && <View style={styles.isSelected}></View>}
      <Image source={{ uri: item.uri }} style={[styles.image, { width: width }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: {
    aspectRatio: 1,
    resizeMode: "cover",
  },
  isSelected: {
    width: 15,
    height: 15,
    backgroundColor: "blue",
    borderRadius: 10,
    position: "absolute",
    zIndex: 1,
    bottom: 10,
    right: 10,
    borderColor: "white",
    borderWidth: 2,
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
});
