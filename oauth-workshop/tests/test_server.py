"""Exercise real signature validation with independently generated RSA tokens."""
import base64
import datetime
import json
import time
import unittest
from unittest.mock import patch
from http.server import HTTPServer
from threading import Thread
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import NameOID

from server import Handler, InvalidToken, verify_identity
from google.auth.exceptions import TransportError


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


class VerificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "token-verification-test")])
        now = datetime.datetime.now(datetime.timezone.utc)
        cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
                .public_key(cls.key.public_key()).serial_number(x509.random_serial_number())
                .not_valid_before(now - datetime.timedelta(days=1))
                .not_valid_after(now + datetime.timedelta(days=1))
                .sign(cls.key, hashes.SHA256()))
        cls.cert = cert.public_bytes(serialization.Encoding.PEM).decode()

    def token(self, **changes):
        now = int(time.time())
        payload = {"iss": "https://securetoken.google.com/test-project",
                   "aud": "test-project", "sub": "test-user-123",
                   "iat": now - 10, "exp": now + 3600, "auth_time": now - 20}
        payload.update(changes)
        body = b64(json.dumps({"alg": "RS256", "kid": "test-key"}).encode()) + "." + b64(json.dumps(payload).encode())
        signature = self.key.sign(body.encode(), padding.PKCS1v15(), hashes.SHA256())
        return body + "." + b64(signature)

    def request(self, url, **kwargs):
        self.assertEqual(url, "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com")
        return type("Response", (), {"status": 200, "data": json.dumps({"test-key": self.cert}).encode()})()

    def verify(self, token):
        return verify_identity(token, "test-project", self.request)

    def test_signed_token_returns_verified_subject(self):
        self.assertEqual(self.verify(self.token()), {"uid": "test-user-123", "projectId": "test-project", "verified": True})

    def test_wrong_project_issuer_expiry_and_future_times(self):
        now = int(time.time())
        for changes in [{"aud": "other-project"}, {"iss": "https://attacker.invalid"},
                        {"exp": now - 30}, {"iat": now + 3600},
                        {"auth_time": now + 3600}, {"sub": ""}, {"sub": "x" * 129},
                        {"auth_time": None}]:
            with self.subTest(changes=changes), self.assertRaises(InvalidToken):
                self.verify(self.token(**changes))

    def test_tampered_payload_is_rejected(self):
        token = self.token().split(".")
        payload = json.loads(base64.urlsafe_b64decode(token[1] + "=="))
        payload["sub"] = "someone-else"
        token[1] = b64(json.dumps(payload).encode())
        with self.assertRaises(InvalidToken):
            self.verify(".".join(token))

    def test_malformed_token_is_rejected(self):
        with self.assertRaises(InvalidToken):
            self.verify("not-a-jwt")

    def call_api(self, token=None, path="/api/me", project="test-project", offline=False):
        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        try:
            with patch.dict("os.environ", {"VITE_FIREBASE_PROJECT_ID": project}), patch(
                "server.certificate_request", side_effect=TransportError("offline") if offline else self.request
            ):
                request = Request(f"http://127.0.0.1:{server.server_port}{path}", headers=headers)
                try:
                    response = urlopen(request, timeout=3)
                except HTTPError as error:
                    response = error
                with response:
                    self.assertEqual(response.headers["Cache-Control"], "no-store")
                    return response.status, json.load(response)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_api_rejects_missing_and_invalid_proof(self):
        self.assertEqual(self.call_api()[0], 401)
        self.assertEqual(self.call_api("not-a-jwt")[0], 401)
        self.assertEqual(self.call_api(self.token(aud="other-project"))[0], 401)

    def test_api_returns_only_verified_identity(self):
        status, result = self.call_api(self.token(email="private@example.com"))
        self.assertEqual(status, 200)
        self.assertEqual(result, {"uid": "test-user-123", "projectId": "test-project", "verified": True})

    def test_api_distinguishes_config_and_network_failures(self):
        self.assertEqual(self.call_api(self.token(), project="")[0], 503)
        self.assertEqual(self.call_api(self.token(), offline=True)[0], 503)

    def test_api_does_not_accept_identity_from_query_string(self):
        self.assertEqual(self.call_api(path="/api/me?uid=test-user-123")[0], 404)


if __name__ == "__main__":
    unittest.main()
