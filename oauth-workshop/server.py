"""Local example API: verify a Firebase ID token, then return its subject."""
import json
import os
from pathlib import Path
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import cachecontrol
from dotenv import load_dotenv
from google.auth import exceptions, jwt
from google.auth.transport.requests import Request
from google.oauth2 import id_token
import requests

load_dotenv(Path(__file__).with_name(".env.local"))
certificate_request = Request(session=cachecontrol.CacheControl(requests.Session()))


class InvalidToken(ValueError):
    pass


def public_certificates(url, **kwargs):
    return certificate_request(url, timeout=5, **kwargs)


def verify_identity(token, project_id, request=public_certificates):
    """Verify the signature AND the Firebase claims; never merely decode a JWT."""
    if not project_id or project_id == "replace-me":
        raise RuntimeError("Set VITE_FIREBASE_PROJECT_ID in .env.local and restart Python.")
    try:
        header = jwt.decode_header(token)
        if header.get("alg") != "RS256" or not header.get("kid"):
            raise InvalidToken("Invalid token header")
        # Google verifies signature, audience, issued-at and expiry with public keys.
        claims = id_token.verify_firebase_token(token, request, audience=project_id)
        # Apply the remaining Firebase-specific checks from the official docs.
        if claims.get("iss") != f"https://securetoken.google.com/{project_id}":
            raise InvalidToken("Wrong issuer")
        uid = claims.get("sub")
        if not isinstance(uid, str) or not 1 <= len(uid) <= 128:
            raise InvalidToken("Invalid subject")
        now = time.time()
        for key in ("iat", "exp", "auth_time"):
            if type(claims.get(key)) is not int:
                raise InvalidToken("Invalid timestamp")
        if not 0 <= claims["auth_time"] <= now or claims["iat"] > now or claims["exp"] <= now:
            raise InvalidToken("Invalid timestamp")
        return {"uid": uid, "projectId": project_id, "verified": True}
    except exceptions.TransportError:
        raise  # Network problems are service failures, not proof of a bad token.
    except (ValueError, TypeError, KeyError, exceptions.GoogleAuthError) as error:
        raise InvalidToken("Firebase ID token was not accepted") from error


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if status == 401:
            self.send_header("WWW-Authenticate", "Bearer")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/health":
            return self.send_json(200, {"status": "ready"})
        if self.path != "/api/me":
            return self.send_json(404, {"error": "Not found"})
        headers = self.headers.get_all("Authorization") or []
        parts = headers[0].split() if len(headers) == 1 else []
        if len(parts) != 2 or parts[0].lower() != "bearer" or len(parts[1]) > 8192:
            return self.send_json(401, {"error": "A Firebase ID token is required."})
        try:
            identity = verify_identity(parts[1], os.getenv("VITE_FIREBASE_PROJECT_ID", ""))
            self.send_json(200, identity)
        except InvalidToken:
            self.send_json(401, {"error": "Token rejected. Sign in again and check the project configuration."})
        except RuntimeError as error:
            self.send_json(503, {"error": str(error)})
        except (exceptions.TransportError, requests.RequestException):
            self.send_json(503, {"error": "Cannot fetch Google certificates. Check the server's internet connection."})

    def log_message(self, format, *args):
        # Avoid logging request paths, tokens, or personal information.
        pass


if __name__ == "__main__":
    print("Python API: http://127.0.0.1:8000 (Ctrl+C to stop)", flush=True)
    print("Open the app through Vite at http://localhost:5173", flush=True)
    try:
        HTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nAPI stopped.")
