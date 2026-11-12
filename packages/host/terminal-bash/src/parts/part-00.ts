/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN 1/2 của bundle gốc @deepseek-ai/dsh-terminal-bash (dòng 1–240: import + config + sanitizer) — sinh tự động từ bundle gốc, không sửa tay
 */
// @ts-nocheck

import { TerminalBackendCleanupError, TerminalError } from "@deepseek-ai/dsh-terminal";
import { ENCODING_PREAMBLE, resolvePwshPath } from "@deepseek-ai/dsh-pwsh-local";
import z from "@deepseek-ai/schemastery";
import { Buffer } from "node:buffer";
import { createLazyRequire } from "@deepseek-ai/dsh-lazy-require";
//#region lib/types/config.js
/** Validated configuration for the local PTY backend. */
/** Bash dialect default executable. */
const DEFAULT_BASH_SHELL = "/bin/bash";
/** Bash dialect default arguments (interactive, profile-free). */
const DEFAULT_BASH_ARGS = [
	"--noprofile",
	"--norc",
	"-i"
];
/** Pwsh dialect default arguments (interactive host, profile-free). */
const DEFAULT_PWSH_ARGS = ["-NoLogo", "-NoProfile"];
/**
* Resolve the effective per-dialect shell specification. Defaulting is this
* explicit step: an unset or empty `shellPath`/`shellArgs` selects the
* dialect's defaults, while a non-empty explicit value always wins.
* (Schemastery materializes an absent optional array as `[]`, so emptiness —
* not just `undefined` — means "dialect default".)
* @param config - Schemastery-resolved plugin configuration.
* @returns the fully resolved configuration.
*/
function resolveConfig(config) {
	const shellDialect = config.shellDialect ?? "bash";
	return {
		...config,
		shellDialect,
		shellPath: config.shellPath !== void 0 && config.shellPath.length > 0 ? config.shellPath : shellDialect === "pwsh" ? resolvePwshPath() : DEFAULT_BASH_SHELL,
		shellArgs: config.shellArgs !== void 0 && config.shellArgs.length > 0 ? config.shellArgs : shellDialect === "pwsh" ? DEFAULT_PWSH_ARGS : DEFAULT_BASH_ARGS
	};
}
/** Schemastery config exposed by the plugin. */
const Config = z.object({
	backendType: z.string().default("shell"),
	shellDialect: z.union(["bash", "pwsh"]).default("bash"),
	shellPath: z.string().required(false),
	shellArgs: z.array(z.string()).required(false),
	rows: z.number().default(40),
	cols: z.number().default(160),
	scrollbackLines: z.number().default(1e4),
	scrollbackMaxBytes: z.number().default(4 * 1024 * 1024),
	maxReadBytes: z.number().default(256 * 1024),
	pollIntervalMs: z.number().default(50),
	exactProbeAfterMs: z.number().default(150),
	idleSilenceMs: z.number().default(3e3),
	handoffGraceMs: z.number().default(500),
	promptTailGraceMs: z.number().default(0),
	timeoutMs: z.number().default(3e4),
	disposeGraceMs: z.number().default(3e3)
});
/**
* Assert every effective numeric config field is a positive safe integer — except
* `promptTailGraceMs`, whose zero is the documented "no extension" value — and that bounds
* compose.
* @param config - Schemastery-resolved plugin configuration.
* @returns Narrows the input to the fully resolved configuration.
*/
function validateConfig(config) {
	const resolved = config;
	if (resolved.backendType.length === 0) throw new Error("terminal-bash: backendType must be non-empty");
	if (resolved.shellPath.length === 0) throw new Error("terminal-bash: shellPath must be non-empty");
	for (const [name, value] of Object.entries(resolved)) {
		if (name === "promptTailGraceMs") continue;
		if (typeof value === "number" && (!Number.isSafeInteger(value) || value <= 0)) throw new Error(`terminal-bash: ${name} must be a positive safe integer`);
	}
	if (typeof resolved.promptTailGraceMs === "number" && (!Number.isSafeInteger(resolved.promptTailGraceMs) || resolved.promptTailGraceMs < 0)) throw new Error("terminal-bash: promptTailGraceMs must be a non-negative safe integer");
	if (resolved.maxReadBytes > resolved.scrollbackMaxBytes) throw new Error("terminal-bash: maxReadBytes must not exceed scrollbackMaxBytes");
	if (resolved.handoffGraceMs < resolved.pollIntervalMs) throw new Error("terminal-bash: handoffGraceMs must be at least pollIntervalMs so one readiness poll runs inside the grace window");
	if (resolved.promptTailGraceMs !== 0 && resolved.promptTailGraceMs < resolved.pollIntervalMs) throw new Error("terminal-bash: promptTailGraceMs must be zero or at least pollIntervalMs so a nonzero tolerance contains one readiness poll");
}
/** Exact printable prompt emitted after the private marker. */
const CONTROLLED_PROMPT = "dsh> ";
/**
* Remove CSI/OSC/short escape sequences while preserving split-sequence carry.
* Full terminal emulation is deliberately deferred; ordinary line output and
* the private prompt marker are the supported contract.
*/
var TerminalSanitizer = class {
	maxPendingBytes;
	pending = "";
	discardMode;
	discardOscEscape = false;
	trailingCarriageReturn = false;
	trackingPromptTail = false;
	constructor(maxPendingBytes) {
		this.maxPendingBytes = maxPendingBytes;
	}
	/**
	* Consume one decoded `node-pty` data chunk.
	* @param chunk - decoded terminal data.
	* @returns Printable text and whether the private prompt marker completed.
	*/
	push(chunk) {
		this.pending += this.discardPrefix(chunk);
		let text = "";
		let prompt = false;
		let includePromptTail = this.trackingPromptTail;
		let promptTail = "";
		let index = 0;
		const appendText = (value) => {
			text += value;
			if (this.trackingPromptTail) promptTail += value;
		};
		while (index < this.pending.length) {
			const escape = this.pending.indexOf("\x1B", index);
			if (escape < 0) {
				appendText(this.pending.slice(index));
				index = this.pending.length;
				break;
			}
			appendText(this.pending.slice(index, escape));
			if (escape + 1 >= this.pending.length) {
				index = escape;
				break;
			}
			const kind = this.pending[escape + 1];
			if (kind === "]") {
				const bel = this.pending.indexOf("\x07", escape + 2);
				const stringTerminator = this.pending.indexOf("\x1B\\", escape + 2);
				let end = -1;
				if (bel >= 0 && stringTerminator >= 0) end = Math.min(bel + 1, stringTerminator + 2);
				else if (bel >= 0) end = bel + 1;
				else if (stringTerminator >= 0) end = stringTerminator + 2;
				if (end < 0) {
					index = escape;
					break;
				}
				const terminatorBytes = this.pending[end - 1] === "\x07" ? 1 : 2;
				if (this.pending.slice(escape + 2, end - terminatorBytes).startsWith("133;D;")) {
					prompt = true;
					this.trackingPromptTail = true;
					includePromptTail = true;
					promptTail = "";
				}
				index = end;
				continue;
			}
			if (kind === "[") {
				let end = escape + 2;
				while (end < this.pending.length) {
					const code = this.pending.charCodeAt(end);
					if (code >= 64 && code <= 126) break;
					end += 1;
				}
				if (end >= this.pending.length) {
					index = escape;
					break;
				}
				index = end + 1;
				continue;
			}
			index = escape + 2;
		}
		this.pending = this.pending.slice(index);
		this.enforcePendingBound();
		return {
			text: this.normalizeText(text),
			prompt,
			...includePromptTail ? { promptTail } : {}
		};
	}
	/**
	* Flush a trailing printable fragment when the PTY exits.
	* @returns Remaining printable text; incomplete escapes are discarded.
	*/
	flush() {
		const text = this.pending.startsWith("\x1B") ? "" : this.pending;
		this.pending = "";
		this.discardMode = void 0;
		this.discardOscEscape = false;
		this.trackingPromptTail = false;
		const normalized = this.normalizeText(text);
		if (!this.trailingCarriageReturn) return normalized;
		this.trailingCarriageReturn = false;
		return `${normalized}\n`;
	}
	normalizeText(text) {
		let complete = this.trailingCarriageReturn ? `\r${text}` : text;
		this.trailingCarriageReturn = false;
		if (complete.endsWith("\r")) {
			complete = complete.slice(0, -1);
			this.trailingCarriageReturn = true;
		}
		return normalizeTerminalText(complete);
	}
	enforcePendingBound() {
		if (Buffer.byteLength(this.pending) <= this.maxPendingBytes) return;
		this.discardMode = this.pending[1] === "]" ? "osc" : "csi";
		this.pending = "";
	}
	discardPrefix(chunk) {
		if (this.discardMode === void 0) return chunk;
		if (this.discardMode === "csi") {
			for (let index = 0; index < chunk.length; index += 1) {
				const code = chunk.charCodeAt(index);
				if (code >= 64 && code <= 126) {
					this.discardMode = void 0;
					return chunk.slice(index + 1);
				}
			}
			return "";
		}
		let index = 0;
		if (this.discardOscEscape) {
			this.discardOscEscape = false;
			if (chunk.startsWith("\\")) {
				this.discardMode = void 0;
				return chunk.slice(1);
			}
		}
		while (index < chunk.length) {
			if (chunk[index] === "\x07") {
				this.discardMode = void 0;
				return chunk.slice(index + 1);
			}
			if (chunk[index] === "\x1B") {
				if (chunk[index + 1] === "\\") {
					this.discardMode = void 0;
					return chunk.slice(index + 2);
				}
				if (index + 1 === chunk.length) this.discardOscEscape = true;
			}
			index += 1;
		}
		return "";
	}
};
/**
* Normalize CRLF and standalone carriage returns for line-oriented rendering.
* @param text - sanitized terminal text.
* @returns Line-normalized text with BEL removed.
*/
function normalizeTerminalText(text) {
	return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replaceAll("\x07", "");
}
//#endregion

export {};
