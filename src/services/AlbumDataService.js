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
} from "firebase/firestore";
import { querySnapshotToData, docSnapshotToData } from "services/DataService";
import { getTimestamp } from "services/TimeService";
import { getUserId } from "root/firebase.config";

const DB_NAME = "albums";

function getBaseScope() {
  return [where("uid", "==", getUserId()), where("isDeleted", "==", false)];
}

function getDefaultOrderBy() {
  return [orderBy("createdAt", "desc")];
}

export function getAlbumRef(albumId) {
  return doc(db, DB_NAME, albumId);
}

export async function getAllAlbums() {
  const q = query(collection(db, DB_NAME), ...getBaseScope(), ...getDefaultOrderBy());

  const querySnapshot = await getDocs(q);
  return querySnapshotToData(querySnapshot);
}

export async function getAlbumsWithAsset(assetId) {
  const q = query(collection(db, DB_NAME), ...getBaseScope(), where("assets", "array-contains", assetId));

  const querySnapshot = await getDocs(q);
  return querySnapshotToData(querySnapshot);
}

export function useAlbum(albumId, initialValue) {
  const [album, setAlbum] = useState(initialValue);

  useEffect(() => {
    return onSnapshot(getAlbumRef(albumId), (docSnapshot) => {
      setAlbum(docSnapshotToData(docSnapshot));
    });
  }, []);

  return [album];
}

export function useAlbums() {
  const [albums, setAlbums] = useState();

  useEffect(() => {
    async function getData() {
      const q = query(collection(db, DB_NAME), ...getBaseScope(), ...getDefaultOrderBy());
      return onSnapshot(q, (querySnapshot) => {
        setAlbums(querySnapshotToData(querySnapshot));
      });
    }
    return getData();
  }, []);

  return [albums];
}

export async function getAlbum(albumId) {
  const docSnapshot = await getDoc(getAlbumRef(albumId));
  if (!docSnapshot.exists()) throw "Album not found!";
  return docSnapshotToData(docSnapshot);
}

export async function createAlbum(data) {
  const uid = getUserId();

  const docRef = await addDoc(collection(db, DB_NAME), {
    ...{
      uid: uid,
      isFavorite: false,
      isDeleted: false,
      createdAt: getTimestamp(),
      lastPostedAt: null,
      assets: [],
    },
    ...data,
  });
  return await getAlbum(docRef.id);
}

export function updateAlbum(albumId, data) {
  return updateDoc(doc(db, DB_NAME, albumId), data);
}

export function markAlbumDeleted(albumId) {
  return updateDoc(doc(db, DB_NAME, albumId), { isDeleted: true });
}

export function deleteAlbum(albumId) {
  return deleteDoc(doc(db, DB_NAME, albumId));
}
