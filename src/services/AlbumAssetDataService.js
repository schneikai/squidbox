import { updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { getAlbumRef } from "services/AlbumDataService";
import { getAssetRef } from "services/AssetDataService";
import { docSnapshotToData } from "services/DataService";

// TODO: Right now it's not possible to get Firebase documents by a list of ids.
// You need to fetch them individually or use "where in" and query in batches
// of 10 (10 is the limit for "where in" queries).
// https://stackoverflow.com/questions/46721517/google-firestore-how-to-get-several-documents-by-multiple-ids-in-one-round-tri

// TODO: This needs to filter and sort!
export function getAlbumAssets(album, { limit = undefined } = {}) {
  if (album.assets.length === 0) return Promise.resolve([]);
  const getDocs = album.assets.slice(0, limit).map((id) => getDoc(getAssetRef(id)));
  return Promise.all(getDocs).then((docSnaps) => {
    const assets = docSnaps.map((docSnap) => docSnapshotToData(docSnap));
    // remove deleted assets
    return assets.filter((asset) => !asset.isDeleted);
  });
}

export function addAssetsToAlbum(albumId, assets) {
  const assetIds = assetsToAssetIds(assets);
  return updateDoc(getAlbumRef(albumId), {
    assets: arrayUnion(...assetIds),
  });
}

export function removeAssetsFromAlbum(albumId, assets) {
  const assetIds = assetsToAssetIds(assets);
  return updateDoc(getAlbumRef(albumId), {
    assets: arrayRemove(...assetIds),
  });
}

function assetsToAssetIds(assets) {
  return assets.map((asset) => asset.id);
}
