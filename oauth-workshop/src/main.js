import { configured } from './firebase.js';
import { signIn, observeAuth, signOut } from './auth.js';

const $ = (id) => document.getElementById(id);
let currentUser = null;
let generation = 0;
let requestNumber = 0;
let busy = false;

function buttons() {
  $('sign-in').disabled = !configured || busy;
  $('sign-in').hidden = Boolean(currentUser);
  $('sign-out').hidden = !currentUser;
  $('sign-out').disabled = busy;
  $('verify').disabled = !currentUser || busy;
}

function renderUser(user) {
  currentUser = user;
  generation += 1;
  requestNumber += 1; // Discard results started for a previous account.
  $('status').textContent = user ? 'Signed in' : 'Signed out';
  $('guest').hidden = Boolean(user);
  $('account').hidden = !user;
  $('name').textContent = user?.displayName || (user ? 'Google account' : '');
  $('email').textContent = user?.email || '';
  $('uid').textContent = user?.uid || '';
  $('server-result').textContent = 'No request yet. Predict what the server will say.';
  buttons();
}

function explain(error) {
  const messages = {
    'auth/popup-closed-by-user': 'Sign-in cancelled. You can try again.',
    'auth/cancelled-popup-request': 'A sign-in window is already open.',
    'auth/popup-blocked': 'Allow popups for localhost and click Continue again.',
    'auth/unauthorized-domain': 'Add localhost in Firebase Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed': 'Enable Google in Firebase Authentication → Sign-in method.',
    'auth/network-request-failed': 'Check your internet connection and try again.',
    'auth/invalid-api-key': 'Check your Firebase web config in .env.local, then restart Vite.',
  };
  return messages[error.code] || error.message || 'Something went wrong. Try again.';
}

async function runAuth(action, success) {
  if (busy) return;
  busy = true;
  buttons();
  $('auth-message').textContent = 'Working…';
  try {
    await action(); // Called directly from a click, preserving popup permission.
    $('auth-message').textContent = success;
  } catch (error) {
    $('auth-message').textContent = explain(error);
  } finally {
    busy = false;
    buttons();
  }
}

$('sign-in').addEventListener('click', () => runAuth(signIn, 'Google sign-in finished. The auth observer controls the account panel.'));
$('sign-out').addEventListener('click', () => runAuth(signOut, 'Signed out of this app.'));

async function askServer(withToken) {
  const user = currentUser;
  const startGeneration = generation;
  const thisRequest = ++requestNumber;
  const stillCurrent = () => thisRequest === requestNumber && startGeneration === generation;
  $('server-result').textContent = 'Waiting for Python…';
  try {
    const headers = {};
    if (withToken) {
      if (!user) throw new Error('Sign in first.');
      // Firebase manages token refresh. This is NOT the Google access token.
      headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }
    if (!stillCurrent()) return;
    const response = await fetch('/api/me', { headers, signal: AbortSignal.timeout(10000) });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); }
    catch { throw new Error('Start the Python server in terminal 2, then try again.'); }
    if (!stillCurrent()) return;
    $('server-result').textContent = response.ok
      ? `${response.status} OK · Verified by Python\nUser ID: ${body.uid}\nProject: ${body.projectId}`
      : `${response.status} · ${body.error}${response.status === 401 && !withToken ? '\nExpected! No token means no verified identity.' : ''}`;
  } catch (error) {
    if (stillCurrent()) $('server-result').textContent = error.name === 'TimeoutError'
      ? 'The request timed out. Check Python and your internet connection.'
      : explain(error);
  }
}

$('verify').addEventListener('click', () => askServer(true));
$('no-token').addEventListener('click', () => askServer(false));
if (configured) {
  const unsubscribe = observeAuth(renderUser);
  if (import.meta.hot) import.meta.hot.dispose(unsubscribe);
} else {
  $('setup').hidden = false;
  renderUser(null);
  $('status').textContent = 'Setup needed';
}
