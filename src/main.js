import { currentUser, authVersion } from './auth.js';

const $ = (id) => document.getElementById(id);
let requestNumber = 0;

async function askServer(withToken) {
  const user = currentUser;
  const startGeneration = authVersion;
  const thisRequest = ++requestNumber;
  const stillCurrent = () => thisRequest === requestNumber && startGeneration === authVersion;
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
      : error.message || 'Could not reach the API. Check the Python server.';
  }
}

$('verify').addEventListener('click', () => askServer(true));
$('no-token').addEventListener('click', () => askServer(false));
