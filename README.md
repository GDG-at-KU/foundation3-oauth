# Next Step — Google Sign-In Starter

A plain JavaScript application tracker with Firebase Google sign-in and a Python identity API. The interface includes searchable fictional applications, summary counters, an account panel, and token verification. The starter leaves three connections in `src/auth.js` as TODOs: sign-in, auth-state observation, and sign-out. The completed version implements all three.

The layout, visual styling, and fictional application examples are adapted from [build-your-first-webapp-starter-fall26](https://github.com/GDG-at-KU/build-your-first-webapp-starter-fall26). The charcoal welcome panel, green line art, pastel counters, and outlined controls continue that project's interface.

## Requirements

- Node.js 22.12 or later
- Python 3.11 or later
- A Google account and internet access

The steps below cover setup from an unconfigured copy. Run commands from the project folder.

## 1. Start the frontend

```sh
npm ci
npm run dev
```

Open **http://localhost:5173** in a browser. The initial **Setup needed** message is expected. Leave this terminal running.

In PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## 2. Configure Firebase

1. Open [Firebase Console](https://console.firebase.google.com/) and create or select a project.
2. Register a **Web app** under Project settings → General → Your apps. Hosting is not required.
3. Open Authentication → Sign-in method, enable **Google**, choose the support email, and save.
4. Under Authentication → Settings → Authorized domains, add **localhost** if it is missing. Enter the hostname without a scheme or port.
5. Copy `.env.example` to `.env.local` and fill in the four values from the web app's `firebaseConfig`:

| Firebase config field | Environment variable |
| --- | --- |
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

Use values from the same project. `projectId` is a name such as `example-project-123`, not the numeric project number or the `1:…:web:…` app ID. The Python API reads this same project ID.

Restart Vite after changing `.env.local`. Restart Python too if it is already running. The setup warning checks for filled values; a successful Google sign-in verifies that the configuration works.

Firebase web configuration identifies the client project and is included in browser code. This example does not require a service-account private key. Keep local configuration in the ignored `.env.local` file; `.env.example` contains placeholders only.

## 3. Connect authentication

Open `src/auth.js`. The provider, both button handlers, the auth-state observer, and UI helpers are in this file. `firebase.js` initializes the Firebase client; `main.js` sends API requests.

**TODO 1 — Sign in:** inside `signInButton.onclick`, replace the TODO and its placeholder `throw` with:

```js
await signInWithPopup(auth, provider);
```

The surrounding `try/catch` displays a readable error, and `finally` restores the controls. Keep those parts in place.

**TODO 2 — Observe state:** replace the placeholder inside the `if (configured)` block, after `renderLoading()`, with:

```js
const unsubscribe = onAuthStateChanged(auth, (user) => {
  clearTransientUserState();
  if (user) {
    renderAccount(user.displayName || 'Welcome!', user);
  } else {
    renderSignedOut();
  }
});
if (import.meta.hot) import.meta.hot.dispose(unsubscribe);
```

The cleanup line prevents duplicate observers during Vite hot reload. After TODO 1, the popup can work while the account panel still shows signed out; TODO 2 connects the authenticated user to the UI.

**TODO 3 — Sign out:** inside `signOutButton.onclick`, replace the TODO and its placeholder `throw` with:

```js
await signOut(auth);
```

The observer receives `null` after sign-out, clears the account details and previous API response, and shows the signed-out view. The handlers also prevent duplicate clicks while an operation is pending.

Save and refresh after each change. Sign in, refresh to observe the restored session, then sign out. Cancellation should show a readable message and allow another attempt. These interactions work without the Python API.

### Checkpoints

Load a checkpoint with:

```sh
npm run checkpoint -- 03-state
```

| Checkpoint | Included implementation |
| --- | --- |
| `03-start` | Three TODOs |
| `03-signin` | Sign-in |
| `03-state` | Sign-in and auth-state observer |
| `03-complete` | Sign-in, observer, and sign-out |

The command backs up the current `src/auth.js` under `backups/` before replacing it. Firebase configuration is preserved. Refresh the browser after switching checkpoints. Checkpoints change code only; they do not configure a Firebase project.

## 4. Start the Python API

Open a second terminal in the project folder.

Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe server.py
```

macOS / Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python server.py
```

Python listens on `127.0.0.1:8000`. Vite forwards `/api` requests to it, so continue using the app at **http://localhost:5173**. Press Ctrl+C in each terminal to stop the processes. On later runs, start Vite and Python again; reinstall dependencies only when they change.

## Verify the flow

1. Sign in and inspect the Firebase user ID in the account panel.
2. Click **Ask server who I am**. The API should return `200` and the same UID.
3. Click **Try without a token**. This intentionally omits the token and should return `401`, even while signed in.
4. Refresh. The auth observer should restore the account panel after initialization.
5. Sign out. The name, email, UID, and previous API result should clear.
6. Cancel another sign-in attempt. The page should remain usable.

## How it works

```text
Google sign-in
  → Firebase establishes the app's authenticated user
  → onAuthStateChanged updates the account panel

API request
  → user.getIdToken() obtains a Firebase ID token
  → the browser sends Authorization: Bearer <token>
  → Python verifies the token's signature and claims
  → the API returns the verified subject as uid
```

`getIdToken()` returns a **Firebase ID token**, not a Google API access token. The Firebase SDK manages the Google sign-in integration, browser auth persistence, and token refresh. The Python request uses an Authorization header. This example does not implement session cookies or manually store tokens. Signing out of this app does not sign you out of google.com.

The API uses Google's `google-auth` verifier and public certificates to check the signature, audience, issued-at time, and expiry. It also checks Firebase-specific issuer, subject, and timestamp requirements. It derives the UID from the verified token rather than trusting an ID supplied separately by the browser.

### Scope

The tracker uses local fictional records from `src/sample-data.js`. Search, status filtering, and note expansion work while signed out. Signing in does not assign these records to an account or make them private; the account panel and API result are separate from the example list. Summary counters describe all sample records, regardless of the active filter.

This example has no database, role system, or resource-ownership rules. Authentication establishes identity; access to protected resources requires authorization checks as well.

The API does not query whether an account has been disabled or its sessions revoked. An otherwise valid issued token remains usable until expiry. Signing out clears the current browser session. Deployment requires HTTPS, a production server, resource authorization, and an appropriate revocation policy.

## Project structure

```text
src/firebase.js        Firebase configuration and initialization
src/auth.js            Provider, button handlers, observer, and account UI
src/main.js            Authenticated API requests and response display
src/tracker.js         Application list, summary, and filter rendering
src/config.js          App name, labels, and accent color
src/sample-data.js     Fictional application records
src/applications.js    Record validation and filtering
src/summary.js         Application, interview, and submitted counts
src/style.css          Page styles
index.html             Page structure
server.py              Firebase token verification and /api/me
checkpoints/           Incremental auth implementations
scripts/checkpoint.mjs Checkpoint switching and backups
scripts/package.py    Source ZIP packaging
tests/                 API and browser checks
```

Customize the title, description, and labels in `src/config.js`; edit fictional records in `src/sample-data.js`. Keep IDs unique and preserve the `saved`, `applied`, and `interview` status values. Account behavior remains in `src/auth.js`, so auth checkpoints preserve tracker customizations.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Setup needed | The file is exactly `.env.local`, all four values are filled, and Vite was restarted. Check for an accidental `.txt` extension. |
| Unauthorized domain | Add `localhost` to Firebase Auth's Authorized domains and use `http://localhost:5173`. |
| Operation not allowed | Enable Google in Firebase Authentication for the configured project. |
| Popup blocked | Allow popups for localhost and click again. Use a normal browser tab rather than an embedded preview. |
| Google rejects an account | Check whether the account's organization permits the sign-in flow. |
| Popup succeeds but account panel stays signed out | Complete the auth-state observer and refresh. |
| API connection failure | Keep Python running in the second terminal and check that dependencies installed successfully. |
| 401 when sending a token | Check the project configuration in both processes, restart them, sign in again, and check the computer clock. |
| 503 | Read the response message; configure the project ID or restore the server's internet access. |
| Port already in use | Stop the earlier process using port 5173 or 8000. |

## Development checks

Build the frontend:

```sh
npm run build
```

Run API tests:

```powershell
# Windows
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

```sh
# macOS / Linux
.venv/bin/python -m unittest discover -s tests -v
```

The API tests generate RSA tokens and exercise signature verification with a test certificate. They require no Firebase credentials or Google requests.

For browser checks, keep both servers running, then run:

```sh
npx playwright install chromium
npm run test:browser
```

Browser tests simulate the Firebase boundary and check real missing-token requests to Python. Use the manual flow above to check Google sign-in with your own project.

Create source archives with `python scripts/package.py` (`python3` on macOS/Linux). Packaging uses an explicit file list and excludes local configuration, dependencies, build output, backups, and Git history.

## References

- [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- [Firebase auth-state observer](https://firebase.google.com/docs/auth/web/manage-users)
- [Firebase token verification requirements](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Google's Python token verifier](https://googleapis.dev/python/google-auth/latest/reference/google.oauth2.id_token.html)
