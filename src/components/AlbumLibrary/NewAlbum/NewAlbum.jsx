import { StyleSheet, View, Pressable, Text, useWindowDimensions } from "react-native";
import { LIST_PADDING, getItemWidth } from "components/AlbumList/AlbumList";
import { styles as albumListItemStyles } from "components/AlbumList/AlbumListItem/AlbumListItem";
import { Ionicons } from "@expo/vector-icons";

export default function NewAlbum({ onPress }) {
  const window = useWindowDimensions();
  const width = getItemWidth(window.width);

  return (
    <View style={styles.container}>
      <View style={[styles.itemContainer, { width: width }]}>
        <Pressable style={styles.newAlbum} onPress={onPress}>
          <Ionicons name="images-outline" style={styles.newAlbumIcon} />
        </Pressable>
        <Text style={albumListItemStyles.title}>New Album...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: LIST_PADDING,
    alignItems: "center",
  },
  itemContainer: {
    padding: 10,
  },
  newAlbum: {
    backgroundColor: "lightgrey",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  newAlbumIcon: {
    color: "grey",
    fontSize: 60,
  },
});
