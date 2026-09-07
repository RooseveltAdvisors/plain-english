# claudish-to-english-pi

Pi port of [gvzdv/claudish-to-english](https://github.com/gvzdv/claudish-to-english) (MIT, Copyright 2026 Mike Gvozdev).

Display-only plain-English rewrite of assistant messages. The saved transcript stays original. Fail open if the rewriter is down.

This is a **Pi extension**, not a prompt skill: a skill would change the model text. Claude's original uses a `MessageDisplay` hook; Pi uses an extension (`message_end` / TUI-only entry) with the same rewriter.

Install: copy or symlink the extension into `~/.pi/agent/extensions/`. See the original README for ollama/API providers.
