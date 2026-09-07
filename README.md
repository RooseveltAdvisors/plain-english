# plain-english

A [Pi](https://github.com/badlogic/pi-mono) extension that shows a
**plain-English rewrite** of each assistant message, produced by a **local
LLM via ollama** (default), the **codex CLI**, the **Anthropic API**, or any
**OpenAI-compatible API**. It is **display-only**: the saved transcript and
the model's context keep the original text - only what you read on screen
gains an extra block below the message.

Port of [gvzdv/claudish-to-english](https://github.com/gvzdv/claudish-to-english)
(MIT, Copyright 2026 Mike Gvozdev) from Claude Code to Pi. The Claude
original hooks `MessageDisplay`; the Pi port listens to `message_end` and
appends a TUI-only custom entry rendered by `registerEntryRenderer`, which
never participates in LLM context and never replaces the stored assistant
message.

> Fail open: if anything goes wrong (provider down, timeout, missing key or
> dependency), nothing is appended and you simply see the original message.
> A fixable setup problem surfaces once per session as a one-line warning.

## Install

```bash
mkdir -p ~/.pi/agent/extensions
cp -r plain-english ~/.pi/agent/extensions/
# or: ln -s "$PWD/plain-english" ~/.pi/agent/extensions/plain-english
```

Then restart pi (or run `/reload`).

## Requirements

With the default `ollama` provider this shells out to a **local** model:

| Requirement | Why | Install |
|---|---|---|
| **ollama**, running | Does the rewriting, locally | `brew install ollama` then `ollama serve` |
| A pulled model | The actual rewriter | `ollama pull gemma4:26b-mlx` (choose a model that fits your memory; the default tag is macOS-only, override with `CLAUDISH_MODEL` elsewhere) |
| `jq`, `curl` | JSON + HTTP plumbing | usually preinstalled |

Warm the model once after `ollama serve` (the first call is a slow cold
load): `ollama run gemma4:26b-mlx "hi"`.

With `CLAUDISH_PROVIDER=anthropic` or `openai` you need only `jq`, `curl`,
and an API key - see the [upstream README](https://github.com/gvzdv/claudish-to-english#providers).

If the local model is not ready, the extension does nothing to your text -
the original shows unchanged. That is by design, not a bug.

## Configuration

Environment variables, identical to upstream (read them in `providers.sh`):

| Variable | Default | Meaning |
|---|---|---|
| `CLAUDISH_ENABLED` | `1` | Master switch |
| `CLAUDISH_PROVIDER` | `ollama` | `ollama` / `codex` / `anthropic` / `openai` |
| `CLAUDISH_MODEL` | provider default | Overrides the provider's model |
| `CLAUDISH_MIN_CHARS` | `200` | Skip messages shorter than this (prose, code stripped) |
| `CLAUDISH_TIMEOUT` | `45` | LLM client timeout in seconds |
| `CLAUDISH_PROMPT_FILE` | unset | File holding a replacement rewrite prompt |
| `CLAUDISH_LANG` | unset | Force an output language (e.g. `English`); set empty to keep the message's language |
| `CLAUDISH_STUB` | `0` | Deterministic stub instead of the LLM (display-mechanics testing) |
| `CLAUDISH_DEBUG` | `0` | Write `/tmp/plain-english/debug.log` |
| `CLAUDISH_NOTICE` | upstream | Upstream env; the Pi port always shows its one-line warning via a transient notification |

Kill switch: `touch ~/.pi/plain-english-off` pauses rewrites (re-checked per
message); delete the file to resume.

## Differences from the Claude original

- Display path: Pi custom entry (TUI-only) instead of a `MessageDisplay`
  rewrite. The assistant message itself is never modified, on screen or in
  the session file - the rewrite renders *below* it.
- No streaming buffer: Pi delivers the finalized message whole, so the
  chunk-buffering machinery is not needed.
- No `/claudish` control command, Markdown-file hook, or style presets
  (`tldr` / `5y` / `caveman`); the base plain-language rewrite is ported,
  plus `CLAUDISH_PROMPT_FILE` for custom prompts.
- The once-per-session setup warning appears as a transient notification
  rather than an on-screen append.

## Credits

Based on [claudish-to-english](https://github.com/gvzdv/claudish-to-english)
by Mike Gvozdev. `plain-english/providers.sh` is vendored from upstream
verbatim; MIT license, see [LICENSE](LICENSE).

MIT License. Copyright (c) 2026 Mike Gvozdev. Copyright (c) 2026 Roosevelt
Advisors (Pi port).
