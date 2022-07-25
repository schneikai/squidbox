import uuid from "react-native-uuid";
import { getDoc } from "firebase/firestore";
import { getAssetRef, updateAsset } from "services/AssetDataService";
import { getAlbumsWithAsset, updateAlbum } from "services/AlbumDataService";
import { docSnapshotToData } from "services/DataService";

export function newPostAsset(asset) {
  return { id: uuid.v4(), assetId: asset.id, asset: asset };
}

// This will remove full asset data from post assets and only keep the assetId.
// This is the format we save the post assets on the server.
export function removeAssets(postAssets) {
  return postAssets.map((postAsset) => ({ id: postAsset.id, assetId: postAsset.assetId }));
}

// This will load the full asset data for the given post assets.
export async function loadAssets(postAssets, { limit = undefined } = {}) {
  if (postAssets.length === 0) return Promise.resolve(postAssets);
  const postAssetLimited = postAssets.slice(0, limit);

  // TODO: Right now it's not possible to get Firebase documents by a list of ids.
  // You need to fetch them individually or use "where in" and query in batches
  // of 10 (10 is the limit for "where in" queries).
  // https://stackoverflow.com/questions/46721517/google-firestore-how-to-get-several-documents-by-multiple-ids-in-one-round-tri
  const getDocs = postAssetLimited.map((postAsset) => getDoc(getAssetRef(postAsset.assetId)));

  const assets = await Promise.all(getDocs).then((docSnaps) => {
    const assets = docSnaps.map((docSnap) => docSnapshotToData(docSnap));
    return assets.filter((asset) => !asset.isDeleted);
  });

  return postAssetLimited
    .map((postAsset) => {
      const asset = assets.find((asset) => asset.id === postAsset.assetId);
      if (!asset) return null;
      return { ...postAsset, asset: asset };
    })
    .filter(Boolean);
}

export async function updateLastPostedAt(postAssets, timestamp) {
  for (const postAsset of postAssets) {
    updateAsset(postAsset.assetId, { lastPostedAt: timestamp });
    const albums = await getAlbumsWithAsset(postAsset.assetId);
    for (const album of albums) {
      updateAlbum(album.id, { lastPostedAt: timestamp });
    }
  }
}
