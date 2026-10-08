# ADR 011: Encrypted Account-Specific Model API Keys

Status: Accepted
Date: 2026-10-08

## Context

Users have separate profiles, but app saves previously overwrote the shared
`MODEL_API_KEY`. The user requested independent keys and discussed storing user
information appropriately in SQLite before authorizing implementation, testing,
and a Docker rebuild. This decision supersedes the shared-file storage behavior.

## Decision

Personal keys are encrypted with cryptography's Fernet authenticated encryption
and stored in a new `model_secrets` table linked to the user. SQLite schema v5 adds
this table without altering existing users or profiles. Profile metadata retains
only an opaque `user:<sha256(user_id)>` reference. No API returns ciphertext or
raw keys. The cryptography dependency provides established encryption primitives.

The master key stays outside SQLite, supplied through `MODEL_KEY_ENCRYPTION_KEY`
or an owner-only `MODEL_KEY_ENCRYPTION_FILE`. The default file is generated
atomically beside the database and persists across container rebuilds. It must
be backed up securely and excluded from Git and Docker build contexts.

Shared `env:MODEL_API_KEY` references remain compatible. Users who save a personal
key use it before the shared server key. Settings-only saves preserve it. Key
replacement changes only that user's encrypted record. Missing encryption storage
fails safely rather than generating a new master key over existing encrypted data
or falling back to billing the shared service key.

## Compatibility

The API field shape is unchanged; secret-reference values gain a new kind.
Schema v5 migration retains registered users, sessions, and profiles. Existing
shared profiles keep using the shared key until each user saves a personal key.
Previously overwritten keys cannot be recovered or assigned automatically.

Existing shared credentials and account records are not cleared during deployment.
Master-key rotation requires re-encryption and is outside this change.
