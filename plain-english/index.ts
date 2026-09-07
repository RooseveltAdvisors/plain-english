/**
 * plain-english - Pi port of gvzdv/claudish-to-english.
 * Original: https://github.com/gvzdv/claudish-to-english
 * (MIT, Copyright 2026 Mike Gvozdev)
 *
 * Shows a plain-English rewrite of each assistant message in the TUI. The
 * rewrite is stored as a TUI-only custom entry: it never participates in
 * LLM context and never replaces the saved assistant message.
 *
 * The rewrite itself is produced by rewrite.sh + the vendored providers.sh
 * (ollama / codex / anthropic / openai; CLAUDISH_* env config, identical to
 * upstream).
 *
 * Fail open: if the rewriter is disabled, down, misconfigured, or times
 * out, nothing is appended and the original message stands.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENTRY_TYPE = "plain-english";

interface PlainEnglishData {
	text?: string;
}

function envInt(name: string, fallback: number): number {
	const raw = Number.parseInt(process.env[name] ?? "", 10);
	return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** Concatenated text blocks of a message content (string or block array). */
function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((b) => !!b && typeof b === "object" && (b as { type?: string }).type === "text")
			.map((b) => (b as { text?: string }).text ?? "")
			.join("");
	}
	return "";
}

/** Prose length gate: strip fenced code blocks, count non-space chars (upstream rule). */
function proseLength(text: string): number {
	let outside = "";
	let inFence = false;
	for (const line of text.split("\n")) {
		if (line.trimStart().startsWith("```")) inFence = !inFence;
		else if (!inFence) outside += line;
	}
	return outside.replace(/\s/g, "").length;
}

/** Last real user message on the branch: context only, never rewritten. */
function lastUserQuestion(ctx: ExtensionContext): string {
	try {
		const entries = ctx.sessionManager.getBranch() as Array<{
			type?: string;
			message?: { role?: string; isMeta?: boolean; content?: unknown };
		}>;
		for (let i = entries.length - 1; i >= 0; i--) {
			const e = entries[i];
			if (e?.type === "message" && e.message?.role === "user" && !e.message.isMeta) {
				return textOf(e.message.content).slice(0, 2000);
			}
		}
	} catch {
		// No context is fine; the rewrite works without it.
	}
	return "";
}

const selfDir =
	typeof __dirname !== "undefined"
		? __dirname
		: dirname(fileURLToPath(import.meta.url));

export default function (pi: ExtensionAPI) {
	const script = join(selfDir, "rewrite.sh");
	const offFile = join(homedir(), ".pi", "plain-english-off");
	const minChars = envInt("CLAUDISH_MIN_CHARS", 200);
	const timeoutMs = (envInt("CLAUDISH_TIMEOUT", 45) + 5) * 1000;

	let noticeShown = false;
	let lastHandledKey = "";

	pi.registerEntryRenderer<PlainEnglishData>(ENTRY_TYPE, (entry, _opts, theme) => {
		const data = entry.data;
		if (!data?.text) return new Text("", 0, 0);
		const container = new Container();
		container.addChild(new Text(theme.fg("dim", "────────────────────────"), 0, 0));
		container.addChild(new Text(theme.bold("In plain English:"), 0, 0));
		container.addChild(new Markdown(data.text, 0, 0, getMarkdownTheme()));
		return container;
	});

	pi.on("session_start", () => {
		noticeShown = false;
	});

	pi.on("message_end", (event, ctx) => {
		if (ctx.mode !== "tui") return;
		const message = event.message as {
			role?: string;
			id?: string;
			stopReason?: string;
			content?: unknown;
		};
		if (message?.role !== "assistant") return;
		if (message.stopReason === "aborted") return;

		const text = textOf(message.content);
		if (proseLength(text) < minChars) return;

		// Dedupe re-fires of the same finalized message. Assistant messages may
		// carry no id (provider-dependent), so fall back to a content hash.
		const key = message.id || `hash:${text}`;
		if (key === lastHandledKey) return;
		lastHandledKey = key;

		if (process.env.CLAUDISH_ENABLED === "0") return;
		try {
			if (existsSync(offFile)) return;
		} catch {
			return; // fail open
		}

		const userq = lastUserQuestion(ctx);

		void (async () => {
			let dir = "";
			try {
				dir = await mkdtemp(join(tmpdir(), "plain-english-"));
				const msgFile = join(dir, "msg.txt");
				await writeFile(msgFile, text);
				const res = await pi.exec("bash", [script, msgFile, ...(userq ? [userq] : [])], {
					timeout: timeoutMs,
				});
				const rewrite = (res.stdout ?? "").trim();
				if (rewrite) {
					pi.appendEntry<PlainEnglishData>(ENTRY_TYPE, { text: rewrite });
				} else {
					// Fail open. Surface a fixable-setup reason once per session.
					const why = (res.stderr ?? "").trim().split("\n")[0];
					if (why && !noticeShown) {
						noticeShown = true;
						ctx.ui.notify(`plain-english: ${why}`, "warning");
					}
				}
			} catch {
				// fail open: no rewrite, no notice
			} finally {
				if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
			}
		})();
	});
}
