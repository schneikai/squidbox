import { FlatList, useWindowDimensions, StyleSheet } from "react-native";
import AlbumListItem from "components/AlbumList/AlbumListItem";

export const LIST_PADDING = 10;
export const NUM_COLUMNS = 2;

export function getItemWidth(windowWidth) {
  return windowWidth / NUM_COLUMNS - LIST_PADDING;
}

export default function AlbumList({ albums, onPressAlbum }) {
  const window = useWindowDimensions();
  const width = getItemWidth(window.width);

  return (
    <FlatList
      data={albums}
      numColumns={NUM_COLUMNS}
      renderItem={({ item }) => <AlbumListItem album={item} width={width} onPressAlbum={onPressAlbum} />}
      keyExtractor={(item) => item.id}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: LIST_PADDING,
  },
});
