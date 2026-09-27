import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, configured } from './firebase.js';

const signInButton = document.getElementById('sign-in');
const signOutButton = document.getElementById('sign-out');
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export let currentUser = null;
export let authVersion = 0;
let busy = false;
let loading = true;

// 1. Connect the button directly to Google's sign-in flow.
signInButton.onclick = async () => {
  if (busy || !configured) return;
  setBusy(true);
  showAuthMessage('Opening Google sign-in…');
  try {
    // TODO 1 — Your code here: Open Google sign-in and await it. Remove the throw below.
    throw new Error('TODO 1: connect Google sign-in in src/auth.js.');
    showAuthMessage('Google sign-in finished.');
  } catch (error) {
    showSignInError(error.code, error.message);
  } finally {
    setBusy(false);
  }
};

// 2. Let Firebase's observer drive the account interface.
if (configured) {
  renderLoading();
  // TODO 2 — Your code here: Listen for auth changes and update the UI. Replace the line below.
  renderSignedOut();
} else {
  document.getElementById('setup').hidden = false;
  renderSignedOut();
  document.getElementById('status').textContent = 'Setup needed';
}

// 3. Sign out. The observer clears the previous account's interface.
signOutButton.onclick = async () => {
  if (busy || !configured) return;
  setBusy(true);
  try {
    // TODO 3 — Your code here: Sign out with Firebase. Remove the throw below.
    throw new Error('TODO 3: connect sign-out in src/auth.js.');
    showAuthMessage('Signed out of this app.');
  } catch (error) {
    showSignInError(error.code, error.message);
  } finally {
    setBusy(false);
  }
};

// UI helpers. Account text is always rendered as text, never as HTML.
function updateButtons() {
  signInButton.disabled = !configured || busy || loading;
  signInButton.hidden = Boolean(currentUser);
  signOutButton.hidden = !currentUser;
  signOutButton.disabled = busy;
  document.getElementById('verify').disabled = !currentUser || busy;
}

function setBusy(value) {
  busy = value;
  updateButtons();
}

function renderLoading() {
  loading = true;
  document.getElementById('status').textContent = 'Checking…';
  document.getElementById('guest').hidden = true;
  document.getElementById('account').hidden = true;
  updateButtons();
}

function clearTransientUserState() {
  currentUser = null;
  authVersion += 1; // Invalidates API results started for a previous account.
  for (const id of ['name', 'email', 'uid', 'auth-message']) {
    document.getElementById(id).textContent = '';
  }
  document.getElementById('server-result').textContent = 'No request yet. Predict what the server will say.';
}

function renderAccount(displayName, user) {
  currentUser = user;
  loading = false;
  document.getElementById('status').textContent = 'Signed in';
  document.getElementById('guest').hidden = true;
  document.getElementById('account').hidden = false;
  document.getElementById('name').textContent = displayName;
  document.getElementById('email').textContent = user.email || '';
  document.getElementById('uid').textContent = user.uid;
  updateButtons();
}

function renderSignedOut() {
  currentUser = null;
  loading = false;
  document.getElementById('status').textContent = 'Signed out';
  document.getElementById('guest').hidden = false;
  document.getElementById('account').hidden = true;
  updateButtons();
}

function showAuthMessage(message) {
  document.getElementById('auth-message').textContent = message;
}

function showSignInError(code, fallback) {
  const messages = {
    'auth/popup-closed-by-user': 'Sign-in cancelled. You can try again.',
    'auth/cancelled-popup-request': 'A sign-in window is already open.',
    'auth/popup-blocked': 'Allow popups for localhost and click Continue again.',
    'auth/unauthorized-domain': 'Add localhost in Firebase Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed': 'Enable Google in Firebase Authentication → Sign-in method.',
    'auth/network-request-failed': 'Check your internet connection and try again.',
    'auth/invalid-api-key': 'Check your Firebase web config in .env.local, then restart Vite.',
  };
  showAuthMessage(messages[code] || fallback || 'Something went wrong. Try again.');
}
