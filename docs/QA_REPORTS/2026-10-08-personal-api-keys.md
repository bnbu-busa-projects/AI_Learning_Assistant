# Encrypted Personal API Keys

Date: 2026-10-08

## Behavior

App-saved keys are encrypted with Fernet in SQLite schema v5, linked to each
account. Personal keys take priority over the shared developer key. Saving only
model settings preserves the key. Replacement affects only that account.
Connectivity tests and generation use the same personal reference. Unsaved
connectivity-test keys do not overwrite saved keys. Shared developer configuration
and old shared profiles remain compatible. Users must re-enter prior personal
keys once; the old shared-file implementation overwrote them.

The master key stays outside SQLite, in an operator environment value or an
atomically generated owner-only runtime file. Missing encryption storage returns
sanitized errors and never silently replaces the master key over existing data.
The key file and database must be backed up securely, with the key kept separately.

## Files

Implementation: `backend/core/model_settings.py`, `backend/core/model_secrets.py`,
`backend/core/runs.py`, `backend/providers/openai_compatible.py`,
`backend/storage/sqlite.py`, `backend/requirements.txt`, `compose.yml`, and secret
exclusions. Tests cover API settings, repository migration, concurrent saves,
generation ownership, shared fallback, restart persistence, encryption failures,
ciphertext tampering, and environment-supplied encryption keys.

README, specification, architecture, model-settings/schema/error contracts, ADR
011, and the implementation ledger describe the final design.

## Verification

Full backend suite (Python 3.11 with Playwright Chromium):

```sh
python -m pytest backend/tests -q --tb=short
```

Result: 117 passed. After selecting the default encryption file relative to the
repository database, the focused settings/key/storage suite passed again: 21 tests.
Shell syntax and `git diff --check` pass.

Docker end-to-end smoke (`bash scripts/smoke_e2e.sh`) passed with temporary
mounted data and a mock model provider. It exercised registration, login, uploads,
account-specific key save/test, PDF conversion, manifests, downloads, and static
workbench assets. The key is absent from the raw database bytes; the runtime
master-key file is created. Temporary resources were cleaned up.

The initial Docker download encountered repeated Debian HTTP 502 errors. The
browser dependency step now uses Debian HTTPS sources with download retries.
The retry completed successfully.

Live deployment: `docker compose -p ai-learning-assistant up --build -d` completed.
The recreated container is healthy and `/health` returns `{"status":"ok"}`.
SQLite migrated from schema v4 to v5. Before and after deployment, counts match:
3 users, 13 sessions, and 3 model profiles. SQLite integrity and foreign-key checks
pass. There are no encrypted personal records yet: existing users must save their
own key once to replace their legacy shared reference.

No remaining human decisions. Preserve the generated master-key file when backing
up/restoring the data; neither accounts nor shared service credentials were reset.
