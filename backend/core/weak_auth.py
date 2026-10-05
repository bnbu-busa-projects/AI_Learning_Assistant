from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from backend.storage.sqlite import SQLiteRepository

PASSWORD_MIN_LENGTH = 8
PASSWORD_HASH_ITERATIONS = 120_000
SESSION_TTL_DAYS = 7


class AuthError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        fields: list[dict[str, str]] | None = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = fields or []
        super().__init__(message)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def role_for_email(email: str) -> str:
    normalized = normalize_email(email)
    if normalized.endswith("@bnbu.edu.cn"):
        return "teacher"
    raise AuthError(
        400,
        "unknown_email_domain",
        "Use a BNBU institutional email address to register.",
    )


def hash_password(password: str, salt_hex: str | None = None) -> str:
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt.hex()}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest = stored_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256" or iterations != str(PASSWORD_HASH_ITERATIONS):
        return False
    candidate = hash_password(password, salt_hex).split("$", 3)[3]
    return hmac.compare_digest(candidate, digest)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _expires_at() -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
    return expires.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _validate_register_password(password: str, confirm_password: str) -> None:
    fields: list[dict[str, str]] = []
    if len(password) < PASSWORD_MIN_LENGTH:
        fields.append({"field": "password", "rule": "min_length"})
    if password != confirm_password:
        fields.append({"field": "confirm_password", "rule": "match"})
    if fields:
        raise AuthError(400, "validation_error", "Password validation failed.", fields)


def register_user(
    repo: SQLiteRepository,
    *,
    email: str,
    password: str,
    confirm_password: str,
) -> dict[str, str]:
    normalized_email = normalize_email(email)
    role = role_for_email(normalized_email)
    _validate_register_password(password, confirm_password)

    if repo.get_user_by_email(normalized_email):
        raise AuthError(409, "conflict", "Email is already registered.")

    user = repo.create_user(
        email=normalized_email,
        role=role,
        password_hash=hash_password(password),
    )
    return {"status": "success", "email": user["email"], "role": user["role"]}


def login_user(repo: SQLiteRepository, *, email: str, password: str) -> dict[str, str]:
    normalized_email = normalize_email(email)
    role_for_email(normalized_email)
    user = repo.get_user_by_email(normalized_email)
    if not user or not verify_password(password, user["password_hash"]):
        raise AuthError(401, "unauthorized", "Invalid email or password.")

    token = secrets.token_urlsafe(32)
    expires_at = _expires_at()
    repo.create_session(
        user_id=user["id"],
        token_hash=token_hash(token),
        expires_at=expires_at,
    )
    return {
        "token": token,
        "role": user["role"],
        "email": user["email"],
        "expires_at": expires_at,
    }


def current_user_from_authorization(
    repo: SQLiteRepository,
    authorization: str | None,
) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthError(401, "unauthorized", "Missing or invalid bearer token.")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise AuthError(401, "unauthorized", "Missing or invalid bearer token.")

    hashed_token = token_hash(token)
    session = repo.get_session_by_token_hash(hashed_token)
    if not session or not hmac.compare_digest(session["token_hash"], hashed_token):
        raise AuthError(401, "unauthorized", "Missing or invalid bearer token.")

    expires_at = session.get("expires_at")
    if expires_at and _parse_timestamp(expires_at) <= datetime.now(timezone.utc):
        raise AuthError(401, "unauthorized", "Missing or invalid bearer token.")

    user = repo.get_user(session["user_id"])
    if not user:
        raise AuthError(401, "unauthorized", "Missing or invalid bearer token.")
    return user
