#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# plain-english rewrite wrapper (Pi port of gvzdv/claudish-to-english).
#
# Usage: rewrite.sh <message-file> [user-question]
#
# Reads the assistant message from <message-file> (deleted on exit). The
# optional $2 is the user's question, passed as CONTEXT ONLY and truncated
# to 800 codepoints. Prints the plain-language rewrite on stdout.
#
# All provider/LLM work is done by the vendored providers.sh, taken verbatim
# from https://github.com/gvzdv/claudish-to-english (MIT, Copyright 2026
# Mike Gvozdev). Config is upstream's: CLAUDISH_PROVIDER, CLAUDISH_MODEL,
# CLAUDISH_TIMEOUT, CLAUDISH_STUB, CLAUDISH_PROMPT_FILE, CLAUDISH_LANG, ...
# See providers.sh for the full list.
#
# FAIL-OPEN CONTRACT: stdout carries either a complete rewrite or nothing.
# On any problem we print nothing and exit 0, so the extension simply shows
# the original message. A fixable setup problem may print a one-line reason
# on stderr; the extension surfaces it once per session as a transient
# notification.
# ---------------------------------------------------------------------------
set -uo pipefail

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
DBG_ROOT="${TMPDIR:-/tmp}/plain-english"
mkdir -p "$DBG_ROOT" 2>/dev/null || true
dbg() { [ "${CLAUDISH_DEBUG:-0}" = "1" ] && printf '%s [%s] %s\n' "$(date '+%H:%M:%S')" "$$" "$*" >> "$DBG_ROOT/debug.log" 2>/dev/null; return 0; }
pass_through() { dbg "pass_through"; exit 0; }

[ $# -ge 1 ] && [ -r "$1" ] || exit 0
# Capture in a variable: an EXIT trap fires with the positional parameters of
# the context where exit happened (a function's, here), where $1 is unset.
MSG_FILE="$1"
trap 'rm -f "$MSG_FILE" 2>/dev/null' EXIT

LLM_TIMEOUT="${CLAUDISH_TIMEOUT:-45}"

# Provider layer (ollama/codex/anthropic/openai), vendored verbatim from
# upstream. Missing or broken file -> fail open.
. "$SELF_DIR/providers.sh" 2>/dev/null || exit 0

full="$(cat "$1" 2>/dev/null)"
[ -n "$full" ] || pass_through

# CLAUDISH_STUB=1: deterministic stub for testing the display plumbing
# without a live model.
if [ "${CLAUDISH_STUB:-0}" = "1" ]; then
  printf '%s' "STUB-SIMPLIFIED (this text came from rewrite.sh, not the model)"
  exit 0
fi

# Base system prompt (upstream default: the plain-language rewrite).
sys="You rewrite the assistant's message into much simpler, plain language. Write the rewrite in the same language as the message you are rewriting. Keep every fact, name, number, and file path. Use short sentences and everyday words. Leave fenced code blocks unchanged. Output ONLY the rewritten message with no preamble, labels, or commentary."

# CLAUDISH_PROMPT_FILE replaces the whole prompt (upstream behavior); an
# empty or unreadable file falls back to the built-in default above.
if [ -n "${CLAUDISH_PROMPT_FILE:-}" ] && [ -r "${CLAUDISH_PROMPT_FILE}" ]; then
  _p="$(cat "${CLAUDISH_PROMPT_FILE}" 2>/dev/null)"
  [ -n "$_p" ] && sys="$_p"
fi

# Point of view framing: a fact about the input, not a style choice, so it
# applies even over a custom prompt (kept from upstream).
sys="$sys"$'\n\n'"The text you are given is a message the assistant wrote to the user. In it, \"I\", \"me\", and \"my\" refer to the assistant; \"you\" and \"your\" refer to the user. Keep that same point of view in the rewrite — never swap the two, and never address the assistant."

# Context only: the original user question (truncated to 800 codepoints,
# safe on multibyte boundaries inside jq).
userq="${2:-}"
if [ -n "$userq" ]; then
  userq="$(printf '%s' "$userq" | jq -j '.[0:800]' 2>/dev/null)" || userq="${2:-}"
  [ -n "$userq" ] && sys="$sys"$'\n\n'"For context, the user asked the assistant: \"$userq\". Use this only to understand the message. Do NOT rewrite, answer, or repeat the user's question — rewrite only the assistant's message that follows."
fi

llm_complete "$sys" "$full" || exit 0

# Empty/failed rewrite -> fail open, with a one-line stderr reason when the
# cause is a fixable setup problem (unreachable provider, missing key,
# model not pulled, timeout).
if [ -z "$rewrite" ]; then
  llm_notice_why
  [ -n "${NOTICE_WHY:-}" ] && printf '%s\n' "$NOTICE_WHY" >&2
  pass_through
fi

printf '%s' "$rewrite"
