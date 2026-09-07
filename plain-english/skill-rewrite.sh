#!/usr/bin/env bash
# Skill entry point: rewrite a draft file (or stdin) into plain English via
# rewrite.sh, without letting rewrite.sh delete the caller's draft.
# Usage: skill-rewrite.sh [draft-file]   (reads stdin when no file given)
set -uo pipefail
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"

tmp="$(mktemp "${TMPDIR:-/tmp}/plain-english-skill-XXXXXX")" || exit 0
trap 'rm -f "$tmp" 2>/dev/null' EXIT

if [ $# -ge 1 ]; then
  [ -r "$1" ] && cat "$1" > "$tmp" || exit 0
else
  cat > "$tmp"
fi

"$SELF_DIR/rewrite.sh" "$tmp"
