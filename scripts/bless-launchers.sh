#!/bin/zsh
# bless-launchers.sh
#
# Recreate the root .command launcher stubs from scripts/stub-templates/
# on fresh inodes so com.apple.provenance / com.apple.macl xattrs are gone.
# macOS adds those xattrs whenever Cursor (or any other GUI app) writes
# the files, and AppleSystemPolicy then kills the script with SIGKILL
# when you double-click it from Finder, before the launcher log file is
# even created.
#
# This script must be run from YOUR OWN Terminal.app, NOT from inside
# Cursor's terminal. If you run it from Cursor, macOS will immediately
# re-tag the new files with the same provenance and the bless has no
# lasting effect. Invoke with the explicit interpreter so the script
# itself is never execve'd directly:
#
#   bash scripts/bless-launchers.sh
#
# Safe to re-run.

set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)" || exit 1
cd "$ROOT_DIR" || exit 1

TEMPLATE_DIR="${ROOT_DIR}/scripts/stub-templates"
PROVENANCE_FOUND=0

has_provenance() {
  local f="$1"
  /usr/bin/xattr -p com.apple.provenance "$f" >/dev/null 2>&1
}

bless_one() {
  local name="$1"
  local target="${ROOT_DIR}/${name}"
  local template="${TEMPLATE_DIR}/${name}"

  if [ ! -f "$template" ]; then
    echo "fail:    missing template ${template}"
    return 1
  fi

  local tmp="${target}.bless.$$"
  if /bin/cp "$template" "$tmp" \
       && /bin/rm -f "$target" \
       && /bin/mv "$tmp" "$target" \
       && /bin/chmod 0755 "$target"; then
    echo "blessed: ${name}"
    return 0
  fi

  echo "fail:    ${name}"
  [ -f "$tmp" ] && /bin/rm -f "$tmp"
  return 1
}

echo "Launcher stub repair"
echo "Project: ${ROOT_DIR}"
echo

echo "Before bless:"
for f in run_web.command run_desktop.command; do
  if [ ! -f "$f" ]; then
    printf '  %s -> missing\n' "$f"
    continue
  fi
  printf '  %s ->\n' "$f"
  if has_provenance "$f"; then
    PROVENANCE_FOUND=1
    echo "    com.apple.provenance: PRESENT (Finder double-click will fail)"
  else
    echo "    com.apple.provenance: absent"
  fi
  /usr/bin/xattr -l "$f" 2>/dev/null | sed 's/^/    /' || echo "    (no xattrs)"
done
echo

FAILURES=0
for f in run_web.command run_desktop.command; do
  bless_one "$f" || FAILURES=$((FAILURES + 1))
done

echo
echo "After bless:"
STILL_TAGGED=0
for f in run_web.command run_desktop.command; do
  if [ ! -f "$f" ]; then
    printf '  %s -> missing\n' "$f"
    FAILURES=$((FAILURES + 1))
    continue
  fi
  printf '  %s ->\n' "$f"
  /usr/bin/xattr -l "$f" 2>/dev/null | sed 's/^/    /' || echo "    (no xattrs)"
  if has_provenance "$f"; then
    STILL_TAGGED=1
  fi
done

echo
if [ "$FAILURES" -gt 0 ]; then
  echo "Bless finished with file errors. Fix the failures above and re-run."
  exit 1
fi

if [ "$STILL_TAGGED" -eq 1 ]; then
  echo "com.apple.provenance is still present on at least one stub."
  echo "You ran this from inside Cursor or another sandboxed GUI app."
  echo "Re-run from your own Terminal.app window:"
  echo "  cd ${ROOT_DIR}"
  echo "  bash scripts/bless-launchers.sh"
  exit 1
fi

if [ "$PROVENANCE_FOUND" -eq 1 ]; then
  echo "Stubs are clean. Double-click run_web.command to verify:"
  echo "  [1/5] Checking Docker CLI..."
else
  echo "Stubs were already clean. No repair was required."
fi
