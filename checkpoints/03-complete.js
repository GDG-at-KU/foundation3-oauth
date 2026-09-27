import { signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, provider } from './firebase.js';

export function signIn() {
  return signInWithPopup(auth, provider);
}

export function observeAuth(onChange) {
  return onAuthStateChanged(auth, onChange);
}

export function signOut() {
  return firebaseSignOut(auth);
}
