export { default } from "components/AssetLibrary/AssetLibrary";

// Open the asset libary
// Returns promise that resolves with an array of assets
export function openAssetLibrary(navigation) {
  return new Promise(function (resolve, reject) {
    // TODO: Find a workaround for "Non-serializable values were found in the navigation state."
    navigation.navigate("AssetLibrary", {
      callback: (assets) => resolve(assets),
    });
  });
}
