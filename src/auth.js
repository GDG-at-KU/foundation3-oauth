// Complete the three authentication functions below.
import { signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, provider } from './firebase.js';

export function signIn() {
  // TODO 1: return signInWithPopup(auth, provider);
  throw new Error('TODO 1: connect the Google sign-in button in src/auth.js.');
}

export function observeAuth(onChange) {
  // TODO 2: return onAuthStateChanged(auth, onChange);
  // This placeholder intentionally shows the signed-out view until you wire it.
  onChange(null);
  return () => {};
}

export function signOut() {
  // TODO 3: return firebaseSignOut(auth);
  throw new Error('TODO 3: connect sign-out in src/auth.js.');
}
