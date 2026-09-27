import { signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, provider } from './firebase.js';

export function signIn() {
  return signInWithPopup(auth, provider);
}

export function observeAuth(onChange) {
  // TODO 2: return onAuthStateChanged(auth, onChange);
  onChange(null);
  return () => {};
}

export function signOut() {
  // TODO 3: return firebaseSignOut(auth);
  throw new Error('TODO 3: connect sign-out in src/auth.js.');
}
