---
name: plain-english
description: Rewrite a draft (email, board comms, any assistant message) into simple plain language using a local LLM provider. Use when asked to "make this plain English", simplify a draft, or plain-language rewrite an email or message.
---

# plain-english

Rewrites a draft into much simpler, plain language. Keeps every fact, name,
number, and file path; leaves fenced code blocks unchanged. Fails open: if the
provider is unreachable, misconfigured, or times out, it prints nothing and
exits 0, so a caller can fall back to the original text.

## Usage

- Draft in a file: `plain-english/skill-rewrite.sh path/to/draft.md`
- Draft on stdin: `cat draft.md | plain-english/skill-rewrite.sh`

The rewrite is printed on stdout. Do not edit the caller's draft in place;
show or send the rewritten text instead.

## How it works

`skill-rewrite.sh` copies the draft to a temp file and calls `rewrite.sh`
(next to it), which does the LLM call. The upstream rewrite pipeline and the
provider layer (`providers.sh`, vendored verbatim from
https://github.com/gvzdv/claudish-to-english, MIT, Copyright 2026 Mike
Gvozdev) are unchanged by this skill.

## Configuration

Same providers and env vars as upstream (`rewrite.sh` / `providers.sh`):
`CLAUDISH_PROVIDER` (ollama/codex/anthropic/openai), `CLAUDISH_MODEL`,
`CLAUDISH_TIMEOUT`, `CLAUDISH_PROMPT_FILE` (replaces the rewrite prompt),
`CLAUDISH_LANG`, `CLAUDISH_STUB=1` for a deterministic test stub,
`CLAUDISH_DEBUG=1` for a debug log under `${TMPDIR:-/tmp}/plain-english/`.
See `providers.sh` for the full list.

This harness-agnostic skill works from any agent (Pi, Claude Code, Codex) that
can run a shell script: resolve this SKILL.md's directory, then run
`skill-rewrite.sh` from there.
