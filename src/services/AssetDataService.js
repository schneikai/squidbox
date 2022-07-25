import { useState, useEffect } from "react";
import { db } from "root/firebase.config";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  limit,
} from "firebase/firestore";
import { querySnapshotToData, docSnapshotToData } from "services/DataService";
import { getAssetThumbnail } from "services/AssetThumbnailService";
import { getTimestamp } from "services/TimeService";
import { getUserId } from "root/firebase.config";

const DB_NAME = "assets";

function getBaseScope() {
  return [where("uid", "==", getUserId()), where("isDeleted", "==", false)];
}

function getDefaultOrderBy() {
  return [orderBy("createdAt", "desc")];
}

export function getAssetRef(id) {
  return doc(db, DB_NAME, id);
}

export async function getAllAssets(lmt) {
  const queryParams = [...getBaseScope(), ...getDefaultOrderBy()];
  if (lmt) queryParams.push(limit(lmt));

  const q = query(collection(db, DB_NAME), ...queryParams);

  const querySnapshot = await getDocs(q);
  return querySnapshotToData(querySnapshot);
}

export async function getAssetsForUpload() {
  const q = query(
    collection(db, DB_NAME),
    ...getBaseScope(),
    where("isUploaded", "==", false),
    orderBy("createdAt", "asc")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshotToData(querySnapshot);
}

export function useAssets() {
  const [assets, setAssets] = useState();

  useEffect(() => {
    async function getData() {
      const q = query(collection(db, DB_NAME), ...getBaseScope(), ...getDefaultOrderBy());
      return onSnapshot(q, (querySnapshot) => {
        setAssets(querySnapshotToData(querySnapshot));
      });
    }
    return getData();
  }, []);

  return [assets];
}

export async function createFromMediaLibrary(mediaLibraryAsset) {
  const uid = getUserId();
  const { uri: thumbnailUri } = await getAssetThumbnail(mediaLibraryAsset.localUri, mediaLibraryAsset.mediaType);

  const docRef = await addDoc(collection(db, DB_NAME), {
    uid: uid,
    mediaType: mediaLibraryAsset.mediaType,
    filename: mediaLibraryAsset.filename,
    width: mediaLibraryAsset.width,
    height: mediaLibraryAsset.height,
    duration: mediaLibraryAsset.duration,
    orientation: mediaLibraryAsset.orientation || null,
    mediaLibraryAssetId: mediaLibraryAsset.id,
    createdAt: getTimestamp(),
    lastPostedAt: null,

    // Local file and thumbnail
    fileUri: mediaLibraryAsset.localUri,
    thumbnailUri: thumbnailUri,

    // Cloud file and thumbnail
    // When asset is uploaded to cloud storage fileURL and thumbnailUrl
    // are set and fileUri and thumbnailUri is removed. isUploaded is set to true.
    fileUrl: null,
    thumbnailUrl: null,
    isUploaded: false,

    isFavorite: false,
    isDeleted: false,
  });

  const docSnapshot = await getDoc(docRef);
  return docSnapshotToData(docSnapshot);
}

export async function updateAsset(id, data) {
  return updateDoc(getAssetRef(id), data);
}

export async function markAssetDeleted(id) {
  return updateDoc(getAssetRef(id), { isDeleted: true });
}

// Right now, assets can only be marked as deleted. When we add real delete
// we need to delete fileUrl and thumbnailUrl from the storage
// and thumbnailUri locally!
// export async function deleteAsset(id) {
//   return deleteDoc(getAssetRef(id));
// }
