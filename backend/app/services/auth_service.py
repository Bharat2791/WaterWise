import base64
import hashlib
import hmac
import json
import secrets
import time

from app.config import settings

PASSWORD_ITERATIONS = 310_000
TOKEN_LIFETIME_SECONDS = 12 * 60 * 60


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${_encode(salt)}${_encode(digest)}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_encoded, digest_encoded = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        expected = _decode(digest_encoded)
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            _decode(salt_encoded),
            int(iterations),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, role: str) -> str:
    payload = json.dumps(
        {"sub": user_id, "role": role, "exp": int(time.time()) + TOKEN_LIFETIME_SECONDS},
        separators=(",", ":"),
    ).encode("utf-8")
    encoded_payload = _encode(payload)
    signature = hmac.new(settings.AUTH_SECRET_KEY.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded_payload}.{_encode(signature)}"


def decode_access_token(token: str) -> dict:
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        expected_signature = hmac.new(
            settings.AUTH_SECRET_KEY.encode("utf-8"),
            encoded_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(_decode(encoded_signature), expected_signature):
            raise ValueError("Invalid signature.")
        payload = json.loads(_decode(encoded_payload))
        if not isinstance(payload.get("sub"), int) or payload.get("role") not in {"citizen", "receiver"}:
            raise ValueError("Invalid token claims.")
        if not isinstance(payload.get("exp"), int) or payload["exp"] <= int(time.time()):
            raise ValueError("Expired token.")
        return payload
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise ValueError("Invalid or expired access token.") from error


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
