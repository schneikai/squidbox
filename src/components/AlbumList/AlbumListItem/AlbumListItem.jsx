import { useEffect, useState } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { getAlbumAssets } from "services/AlbumAssetDataService";
import AssetImage from "components/AssetImage";
import { handleError } from "services/ErrorHandling";
import { dateToFromNow } from "services/TimeService";

export default function AlbumListItem({ album, width, onPressAlbum }) {
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    getAlbumAssets(album, { limit: 4 })
      .then((assets) => setAssets(assets))
      .catch((err) => handleError("Failed to load asset!", err));
  }, [album]);

  return (
    <Pressable onPress={() => onPressAlbum(album)}>
      <View style={[styles.container, { width: width }]}>
        <View style={styles.album}>
          {assets.map((asset) => (
            <AssetImage key={asset.id} asset={asset} style={styles.albumImage} />
          ))}
        </View>
        <Text style={styles.title}>{album.name}</Text>
        <Text style={styles.assetCount}>{album.assets.length} Files</Text>
        <Text style={styles.assetCount}>
          Posted: {album.lastPostedAt ? dateToFromNow(album.lastPostedAt) : "never"}
        </Text>
      </View>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  album: {
    aspectRatio: 1,
    backgroundColor: "lightgrey",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  albumImage: {
    width: "50%",
    height: 0, // If I remove the height and flexWrap is set the images disappear
    aspectRatio: 1,
  },
  title: {
    marginTop: 4,
  },
  assetCount: {
    color: "grey",
  },
});
