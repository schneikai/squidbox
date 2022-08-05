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
import { loadAssets } from "services/PostAssetDataService";

const DB_NAME = "posts";

function getBaseScope() {
  return [where("uid", "==", getUserId()), where("isDeleted", "==", false)];
}

function getDefaultOrderBy() {
  return [orderBy("postedAt", "desc")];
}

export function getPostRef(postId) {
  return doc(db, DB_NAME, postId);
}

export function usePosts() {
  const [posts, setPosts] = useState();

  useEffect(() => {
    const q = query(collection(db, DB_NAME), ...getBaseScope(), ...getDefaultOrderBy());
    const unsub = onSnapshot(q, (querySnapshot) => {
      setPosts(querySnapshotToData(querySnapshot));
    });

    return () => {
      unsub();
    };
  }, []);

  return [posts];
}

export async function getPost(postId) {
  const docSnapshot = await getDoc(getPostRef(postId));
  if (!docSnapshot.exists()) throw "Post not found!";
  return docSnapshotToData(docSnapshot);
}

export async function createPost(data) {
  const uid = getUserId();
  const postData = {
    ...{
      uid: uid,
      isFavorite: false,
      isDeleted: false,
      createdAt: getTimestamp(),
      postedAt: getTimestamp(),
      postAssets: [],
      text: "",
    },
    ...data,
  };

  const docRef = await addDoc(collection(db, DB_NAME), postData);
  return await getPost(docRef.id);
}

export function updatePost(postId, data) {
  return updateDoc(doc(db, DB_NAME, postId), data);
}

export function markPostDeleted(postId) {
  return updateDoc(doc(db, DB_NAME, postId), { isDeleted: true });
}

// Not used yet
// export function deletePost(postId) {
//   return deleteDoc(doc(db, DB_NAME, postId));
// }

export function newPostData() {
  return {
    text: "",
    postAssets: [],
    postedAt: null,
  };
}

export async function toPostData(post) {
  const postAssets = await loadAssets(post.postAssets);
  return {
    text: post.text,
    postAssets: postAssets,
    postedAt: post.postedAt,
  };
}

export async function toPostDataForRepost(post) {
  const postData = await toPostData(post);
  delete postData.postedAt;
  return postData;
}
