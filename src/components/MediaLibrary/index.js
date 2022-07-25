import { createFromMediaLibrary } from "services/AssetDataService";
import to from "await-to-js";

export { default } from "components/MediaLibrary/MediaLibrary";

// Open the media libary
// Returns promise that resolves with an array of mediaLibraryAssets
export function openMediaLibrary(navigation) {
  return new Promise(function (resolve, reject) {
    // TODO: Find a workaround for "Non-serializable values were found in the navigation state."
    navigation.navigate("MediaLibrary", {
      callback: (mediaLibraryAssets) => resolve(mediaLibraryAssets),
    });
  });
}

// Opens the media library and creates assets from the selected files.
// Returns array of Assets
// Throws error if assets cannot be created.
export async function addAssetsFromMediaLibrary(navigation) {
  const mediaLibraryAssets = await openMediaLibrary(navigation);

  const assets = [];

  for (const mediaLibraryAsset of mediaLibraryAssets) {
    const [err, asset] = await to(createFromMediaLibrary(mediaLibraryAsset));
    if (err) {
      throw err;
    }
    assets.push(asset);
  }

  return assets;
}
