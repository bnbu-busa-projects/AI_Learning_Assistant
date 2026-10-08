from __future__ import annotations

import os
import tempfile
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from backend.storage.sqlite import SQLiteRepository


class ModelSecretError(Exception):
    """A sanitized storage error that never exposes a key or ciphertext."""


def _encryption_file(repo: SQLiteRepository) -> Path:
    configured = os.getenv("MODEL_KEY_ENCRYPTION_FILE")
    database = Path(repo.engine.url.database or "data/app.sqlite")
    return Path(configured) if configured else database.parent / "model-key-encryption.key"


def _cipher(repo: SQLiteRepository, *, create: bool) -> Fernet:
    try:
        key = os.getenv("MODEL_KEY_ENCRYPTION_KEY")
        if key:
            return Fernet(key.encode("ascii"))
        path = _encryption_file(repo)
        if not path.exists():
            if not create or repo.has_model_secrets():
                raise ModelSecretError("The API-key encryption key is unavailable. Restore the server encryption key.")
            path.parent.mkdir(parents=True, exist_ok=True)
            # Publish a complete, owner-only key file without replacing a key
            # another request may have created concurrently.
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".encryption-", delete=False) as temporary:
                temporary_path = Path(temporary.name)
                temporary.write(Fernet.generate_key())
            try:
                try:
                    os.link(temporary_path, path)
                except FileExistsError:
                    pass
            finally:
                temporary_path.unlink()
        return Fernet(path.read_bytes().strip())
    except ModelSecretError:
        raise
    except (OSError, ValueError, UnicodeError):
        raise ModelSecretError("The API-key encryption storage is unavailable or misconfigured.") from None


def encrypt_api_key(api_key: str, repo: SQLiteRepository) -> str:
    return _cipher(repo, create=True).encrypt(api_key.encode("utf-8")).decode("ascii")


def decrypt_api_key(encrypted_api_key: str, repo: SQLiteRepository) -> str:
    try:
        return _cipher(repo, create=False).decrypt(encrypted_api_key.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeError):
        raise ModelSecretError("The saved API key cannot be decrypted. Restore the server encryption key or save your key again.") from None
