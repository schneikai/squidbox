import { useLayoutEffect } from "react";
import { SafeAreaView, Pressable, Text, Alert } from "react-native";
import { handleError } from "services/ErrorHandling";
import to from "await-to-js";
import AlbumList from "components/AlbumList";
import { useAlbums, createAlbum } from "services/AlbumDataService";
import buttonStyles from "styles/buttonStyles";

export default function AlbumIndexScreen({ route, navigation }) {
  // TODO: This must use pagination!
  const [albums] = useAlbums();

  function addAlbum() {
    Alert.prompt("Album name", undefined, (name) => {
      doAddAlbum(name);
    });
  }

  async function doAddAlbum(name) {
    const [err, album] = await to(createAlbum({ name }));
    if (err) {
      handleError("Failed to add album!", err);
      return;
    }
    navigateToAlbumDetail(album);
  }

  function navigateToAlbumDetail(album) {
    navigation.navigate("AlbumDetail", { album });
  }

  function onPressAlbum(album) {
    navigateToAlbumDetail(album);
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => {
        return (
          <Pressable onPress={addAlbum} style={buttonStyles.headerButton}>
            <Text style={buttonStyles.headerButtonText}>Add</Text>
          </Pressable>
        );
      },
    });
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <AlbumList albums={albums} onPressAlbum={onPressAlbum} />
    </SafeAreaView>
  );
}
