import { initializeApp } from "firebase/app";
import { initializeFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Thoughts on authentication:

// Firebase authentication only works with internet connection.
// Once the user is signed-in for the first time they can be authenticated
// even if the device is offline (TODO: check that this is really the case!)

// We use signInAnonymously in App.js this allows us to protect the users data in Firebase Database.
// Every record we create has a uid that matches auth.currentUser.uid
// In Firebase Database we have a a access rule like this:
//   allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;

// A user's UID never changes. So after you sign in a user anonymously,
// the UID will remain the same (even when you call signInAnonymously again), until you call signout,
// or until the user uninstalls the app.
// Source: https://stackoverflow.com/questions/47854428/how-constant-is-the-firebase-anonymous-id

// TODO: To allow sync between different devices the anonymous user must be converted
// to a email/password user and the user has to signin via username and password. See:
// https://firebase.google.com/docs/auth/web/anonymous-auth?hl=en#convert-an-anonymous-account-to-a-permanent-account

const firebaseConfig = {
  apiKey: "AIzaSyBzIzpI-BTOEocdVBJePeDhykTL06qHRDo",
  authDomain: "summertime-5b81f.firebaseapp.com",
  projectId: "summertime-5b81f",
  storageBucket: "summertime-5b81f.appspot.com",
  messagingSenderId: "582114312770",
  appId: "1:582114312770:web:b47dddc3a5e6bac42f23db",
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
});

export const auth = getAuth(app);

export function getUserId() {
  const uid = auth.currentUser.uid;
  if (!uid) throw "Failed to get UserID!";
  return uid;
}
