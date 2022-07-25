import { useState, useEffect } from "react";
import { SafeAreaView, Alert } from "react-native";
import Header from "components/AlbumLibrary/Header";
import NewAlbum from "components/AlbumLibrary/NewAlbum";
import AlbumList from "components/AlbumList";
import { handleError } from "services/ErrorHandling";
import { getAllAlbums, createAlbum } from "services/AlbumDataService";
import to from "await-to-js";

export default function AlbumLibrary({
  navigation,
  route: {
    params: { callback },
  },
}) {
  const [albums, setAlbums] = useState([]);

  useEffect(() => {
    // TODO: This might need pagination
    getAllAlbums()
      .then((albums) => setAlbums(albums))
      .catch((err) => handleError("Failed to load albums!", err));
  }, []);

  function onCancel() {
    navigation.goBack();
  }

  function onPressAlbum(album) {
    callback(album);
    navigation.goBack();
  }

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
    callback(album);
    navigation.goBack();
  }

  return (
    <SafeAreaView>
      <Header onCancel={onCancel} />
      <NewAlbum onPress={addAlbum} />
      <AlbumList albums={albums} onPressAlbum={onPressAlbum} />
    </SafeAreaView>
  );
}
