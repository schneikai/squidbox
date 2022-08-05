import { useState, useRef, useEffect } from "react";
import { useWindowDimensions, FlatList } from "react-native";
import * as ExpoMediaLibrary from "expo-media-library";
import to from "await-to-js";
import { handleError } from "services/ErrorHandling";
import AssetsLibraryItem from "components/MediaLibrary/AssetsLibraryItem";

export default function AssetsLibrary({ onSelectAsset, isAssetSelected }) {
  const [isLoading, setIsLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const endCursorRef = useRef(null);
  const numColumns = 3;
  const window = useWindowDimensions();
  const width = window.width / numColumns;

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
    if (isLoading) return;
    setIsLoading(true);

    const options = {
      first: 100,
      mediaType: ["photo", "video"],
    };

    // On iOS there is a album called "Recents" which contains the recentyl added
    // photos and is the default when using the media library picker.
    // We try to get that album here and display its files. If we cant get the album
    // we display files orderd by creationTime.

    const [errAlbum, album] = await to(getRecentAlbum());
    if (errAlbum) {
      handleError("Failed to get recent album!", errAlbum);
      return;
    }

    if (album) {
      options["album"] = album;
    } else {
      options["sortBy"] = "creationTime";
    }

    if (endCursorRef.current) options["after"] = endCursorRef.current;

    const [errAssetsResponse, assetsResponse] = await to(ExpoMediaLibrary.getAssetsAsync(options));
    if (errAssetsResponse) {
      handleError("Failed to get recent assets!", errAssetsResponse);
      return;
    }
    setAssets((assets) => [...assets, ...assetsResponse.assets]);
    endCursorRef.current = assetsResponse.endCursor;
    setIsLoading(false);
  }

  async function getRecentAlbum() {
    const albums = await ExpoMediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    return albums.find((album) => album.title === "Recents");
  }

  return (
    <FlatList
      data={assets}
      numColumns={numColumns}
      renderItem={({ item }) => (
        <AssetsLibraryItem item={item} width={width} onSelectAsset={onSelectAsset} isAssetSelected={isAssetSelected} />
      )}
      keyExtractor={(item) => item.id}
      onEndReached={loadAssets}
    />
  );
}
