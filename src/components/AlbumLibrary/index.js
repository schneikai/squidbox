export { default } from "components/AlbumLibrary/AlbumLibrary";

// Open the album libary
// Returns promise that resolves with the selected album
export function openAlbumLibrary(navigation) {
  return new Promise(function (resolve, reject) {
    // TODO: Find a workaround for "Non-serializable values were found in the navigation state."
    navigation.navigate("AlbumLibrary", {
      callback: (album) => resolve(album),
    });
  });
}
