/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		function terminalExitLabel(model, t) {
			if (model == null || model.card.background || !terminalFailed(model)) return null;
			const { exitCode, signal } = model.card;
			if (signal !== void 0) return t("terminal.signal", { signal });
			if (exitCode == null) return t("terminal.noExitCode");
			return t("terminal.exitCode", { code: exitCode });
		}
		/**
		* Resolve a shell call's workdir for display: an absolute path is used as-is,
		* a relative one joins under the session workspace, and an omitted one is the
		* session workspace. Without a session cwd, a relative path stays as authored
		* and an omitted one stays absent.
		* @param workdir - the raw call's workdir, if any.
		* @param sessionCwd - the session workspace root, if the caller knows it.
		* @returns the working directory for the prompt label, or undefined.
		*/
		function resolveTerminalCwd(workdir, sessionCwd) {
			if (workdir === void 0 || workdir === "") return sessionCwd;
			if (sessionCwd === void 0 || sessionCwd === "") return normalizeSegments(workdir);
			return normalizeSegments(resolveWorkspacePath(sessionCwd, workdir));
		}
		/**
		* Collapse `.` and `..` segments so the prompt label names the directory the
		* command actually ran in. The bash executor resolves the workdir before
		* running, so a joined `/w/app/..` must display as `w`, not as `..`. Separators
		* are preserved as authored (a Windows path keeps its backslashes) because this
		* value is only ever displayed; a `..` that would climb past the root is
		* dropped, which is what a filesystem does with it. A UNC path's `server` and
		* `share` are part of its root, not poppable segments: Windows cannot climb
		* above a share, so `\\\\server\\share` with a `..` stays there.
		* @param path - a joined or absolute path, possibly carrying `.`/`..` segments.
		* @returns the same path with those segments resolved.
		*/
		function normalizeSegments(path) {
			if (!/(?:^|[/\\])\.\.?(?:[/\\]|$)/.test(path)) return path;
			const unc = /^[/\\]{2}([^/\\]+)[/\\]+([^/\\]+)/.exec(path);
			if (unc !== null) {
				const [matched, server, share] = unc;
				const root = `\\\\${String(server)}\\${String(share)}`;
				const rest = collapse(path.slice(matched.length), true);
				return rest === "" ? root : `${root}\\${rest}`;
			}
			const separator = path.includes("\\") && !path.includes("/") ? "\\" : "/";
			const rooted = /^[/\\]/.test(path);
			const drive = /^[A-Za-z]:/.exec(path)?.[0] ?? "";
			const body = collapse(path.slice(drive.length), rooted || drive !== "", separator);
			const leading = rooted ? separator : "";
			return drive === "" ? `${leading}${body}` : `${drive}${rooted ? leading : separator}${body}`;
		}
		/**
		* Collapse the `.`/`..` segments of a path body against a known root state.
		* @param body - the path after any drive letter or UNC root.
		* @param rooted - the body hangs off a root, so a `..` at its top is dropped
		*   the way a filesystem drops one; without a root the `..` is kept, since it
		*   stays meaningful against a cwd this function cannot see.
		* @param separator - separator to rejoin with (default `/`).
		* @returns the collapsed body, without leading or trailing separators.
		*/
		function collapse(body, rooted, separator = "/") {
			const kept = [];
			for (const segment of body.split(/[/\\]/)) {
				if (segment === "" || segment === ".") continue;
				if (segment === "..") {
					if (kept.length > 0 && kept[kept.length - 1] !== "..") kept.pop();
					else if (!rooted) kept.push(segment);
					continue;
				}
				kept.push(segment);
			}
			return kept.join(separator);
		}
		function shellCall(name, args) {
			if (name !== "bash" && name !== "pwsh") return null;
			const { command, description, timeoutMs, workdir, run_in_background: background } = args;
			if (typeof command !== "string" || command.trim() === "") return null;
			if (timeoutMs !== void 0 && (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0)) return null;
			if (workdir !== void 0 && typeof workdir !== "string") return null;
			if (background !== void 0 && typeof background !== "boolean") return null;
			if (description === void 0) return {
				kind: "shell",
				command,
				description: void 0,
				workdir: void 0,
				persistent: true,
				background: false
			};
			if (typeof description !== "string" || description.trim() === "") return null;
			return {
				kind: "shell",
				command,
				description,
				workdir,
				persistent: false,
				background: background === true
			};
		}
		/**
		* Identify a background shell launch whose result acknowledges a job, not its exit.
		* @param block - Tool block at any call stage.
		* @returns whether the call requests a background shell job.
		*/
		function isBackgroundShellCall(block) {
			const parsed = parsedToolCall(block);
			return parsed !== null && shellCall(parsed.name, parsed.args)?.background === true;
		}
		/**
		* Identify a settled root call from the persistent Bash or PowerShell tool.
		* Its result stays on the generic input/output path because the persistent
		* shell can report resets and partial output without one process exit status.
		* @param block - running or settled Tool block.
		* @returns whether the block is a settled persistent-shell call.
		*/
		function isSettledPersistentShellCall(block) {
			if (!("kind" in block) || block.parentCallId !== void 0) return false;
			const parsed = parsedToolCall(block);
			if (parsed === null) return false;
			return shellCall(parsed.name, parsed.args)?.persistent === true;
		}
		/**
		* Identify a settled foreground shell preview whose spill footer can hide the exit marker.
		* @param block - running or settled Tool block.
		* @returns whether the shell output must remain generic without an inferred exit status.
		*/
		function isSpilledShellCall(block) {
			if (!("kind" in block)) return false;
			const parsed = parsedToolCall(block);
			if (parsed === null) return false;
			const call = shellCall(parsed.name, parsed.args);
			if (call === null || call.background) return false;
			const output = singleResultText(block);
			return output !== void 0 && hasSpillNotice(output);
		}
		function terminalSendCall(name, args) {
			if (name !== "terminal_send") return null;
			const { sessionId, text, submit, run_in_background: background } = args;
			if (typeof sessionId !== "string" || sessionId === "" || typeof text !== "string") return null;
			if (submit !== void 0 && typeof submit !== "boolean") return null;
			if (background !== void 0 && typeof background !== "boolean") return null;
			return {
				kind: "terminal-send",
				text,
				sessionId,
				background: background === true
			};
		}
		/**
		* Parse the marker literals owned by `@deepseek-ai/dsh-shell/render` without
		* importing that Host-only package into the Client dependency graph.
		* @param text - rendered shell result text.
		* @returns output with a trailing exit-code or signal marker extracted.
		*/
		function parseExitStatus(text) {
			const signal = /\n\[killed by signal: ([^\]\n]+)\]$/.exec(text);
			if (signal?.[1] !== void 0) return {
				output: text.slice(0, signal.index),
				signal: signal[1]
			};
			const exit = /\n\[exit code: (-?\d+|null)\]$/.exec(text);
			if (exit?.[1] !== void 0) return {
				output: text.slice(0, exit.index),
				exitCode: exit[1] === "null" ? null : Number(exit[1])
			};
			return {
				output: text,
				exitCode: 0
			};
		}
		/**
		* Derive terminal props for supported shell and terminal-send calls, including
		* nested PTC dispatch calls. Standard shell results parse their final status
		* marker. Successful background shell launches retain only their command after
		* settlement; persistent shell results, spill previews, background terminal sends,
		* errors, and malformed input use the generic path. {@link isSettledPersistentShellCall} lets that generic
		* persistent result remain expandable without inventing one process status.
		* @param block - running or settled Tool block.
		* @param sessionCwd - original workspace root used only for old results without recorded cwd.
		* @returns locale-neutral terminal-card data, or null for the generic path.
		*/
		function terminalCardModel(block, sessionCwd) {
			const parsed = parsedToolCall(block);
			if (parsed === null) return null;
			const call = shellCall(parsed.name, parsed.args) ?? terminalSendCall(parsed.name, parsed.args);
			if (call === null || call.kind === "terminal-send" && call.background) return null;
			const copy = call.kind === "shell" ? {
				kind: "shell",
				command: call.command,
				description: call.description
			} : {
				kind: "terminal-send",
				text: call.text,
				sessionId: call.sessionId
			};
			const workdir = call.kind === "shell" ? call.workdir : void 0;
			const absoluteRequestCwd = workdir !== void 0 && isAbsoluteWorkspacePath(workdir) ? normalizeSegments(workdir) : void 0;
			const cwd = "kind" in block ? recordedAbsolutePath(block.meta, "cwd") ?? (call.kind === "shell" && block.parentCallId === void 0 ? resolveTerminalCwd(workdir, sessionCwd) : absoluteRequestCwd) : absoluteRequestCwd;
			if (!("kind" in block)) return {
				copy,
				card: {
					cwd,
					output: void 0,
					exitCode: void 0,
					signal: void 0,
					running: true,
					...call.kind === "shell" && call.background ? { background: call.background } : {}
				}
			};
			if (block.isError || call.kind === "shell" && call.persistent || isSpilledShellCall(block)) return null;
			if (call.kind === "shell" && call.background) return {
				copy,
				card: {
					cwd,
					running: false,
					background: call.background
				}
			};
			const output = singleResultText(block);
			if (output === void 0) return null;
			const status = call.kind === "terminal-send" ? { output } : parseExitStatus(output);
			return {
				copy,
				card: {
					cwd,
					output: status.output,
					exitCode: status.exitCode,
					signal: status.signal,
					running: false
				}
			};
		}
		//#endregion
		//#region lib/types/client/tool/models/web-card-model.js
		function validWebCall(block) {
			const call = parsedToolCall(block);
			if (call === null) return null;
			if (call.name === "web_search") {
				const { queries } = call.args;
				if (!Array.isArray(queries) || queries.length === 0) return null;
				return queries.every((query) => typeof query === "string" && query.trim() !== "") ? call.name : null;
			}
			if (call.name === "web_fetch") {
				const { url } = call.args;
				return typeof url === "string" && url.trim() !== "" ? call.name : null;
			}
			return null;
		}
		function webSources(value) {
			if (!Array.isArray(value)) return null;
			const sources = [];
			for (const source of value) {
				if (typeof source !== "object" || source === null || Array.isArray(source)) return null;
				const { url, title, snippet, publishedAt } = source;
				if (typeof url !== "string") return null;
				if (title !== void 0 && typeof title !== "string") return null;
				if (snippet !== void 0 && typeof snippet !== "string") return null;
				if (publishedAt !== void 0 && typeof publishedAt !== "string") return null;
				sources.push({
					url,
					...title === void 0 ? {} : { title },
					...snippet === void 0 ? {} : { snippet },
					...publishedAt === void 0 ? {} : { publishedAt }
				});
			}
			return sources;
		}
		/**
		* Derive a settled root web-search or web-fetch card from persisted metadata.
		* @param block - running or settled Tool block.
		* @returns web-card props, or null for the generic path.
		*/
		function webCardModel(block) {
			if (block.parentCallId !== void 0 || !("kind" in block) || block.isError) return null;
			const tool = validWebCall(block);
			if (tool === null || typeof block.meta !== "object" || block.meta === null || Array.isArray(block.meta)) return null;
			const meta = block.meta;
			if (typeof meta.truncated !== "boolean") return null;
			if (tool === "web_search") {
				const sources = webSources(meta.sources);
				if (sources === null || meta.answer !== void 0 && typeof meta.answer !== "string") return null;
				return {
					kind: "search",
					answer: meta.answer,
					sources,
					truncated: meta.truncated
				};
			}
			if (typeof meta.url !== "string") return null;
			if (typeof meta.statusCode !== "number" || !Number.isInteger(meta.statusCode)) return null;
			return {
				kind: "fetch",
				url: meta.url,
				statusCode: meta.statusCode,
				truncated: meta.truncated
			};
		}
		/**
		* Read the openable URL of a web_fetch call from its arguments.
		* @param block - running or settled Tool block.
		* @returns the http(s) URL, or undefined for another tool, protocol, or unparsable argument.
		*/
		function webFetchHref(block) {
			const call = parsedToolCall(block);
			if (call?.name !== "web_fetch" || typeof call.args.url !== "string") return void 0;
			const { url } = call.args;
			try {
				const { protocol } = new URL(url);
				return protocol === "http:" || protocol === "https:" ? url : void 0;
			} catch {
				return;
			}
		}
		//#endregion
		//#region lib/types/client/tool/models/auto-review-denial.js
		/**
		* Normalize only the user-visible copy; the durable error keeps the raw reason.
		* @param reason - raw persisted reviewer reason, or null when none was recorded.
		* @returns one display line, or null when the reason has no displayable text.
		*/
		function normalizeAutoReviewReason(reason) {
			if (reason === null) return null;
			const normalized = reason.trim().replace(/[\r\n\u2028\u2029]+/gu, " ");
			return normalized === "" ? null : normalized;
		}
		/**
		* Resolve the collapsed identity and the single expanded OUT line.
		* @param denial - locale-neutral persisted denial facts.
		* @param t - conversation-namespace translator.
		* @returns localized summary and output text for the Tool row.
		*/
		function localizeAutoReviewDenial(denial, t) {
			const reason = normalizeAutoReviewReason(denial.reason) ?? t("tool.autoReviewReasonFallback");
			return {
				summary: t("tool.autoReviewRejected"),
				output: t("tool.autoReviewNotExecuted", { reason })
			};
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region lib/types/client/tool/models/primitive-labels.js
		/** Localized copy adapters for Cordis-free UI primitives used by Tool cards. */
		/**
		* Localize the shared code-card toolbar.
		* @param t - Conversation locale seat.
		* @returns Language fallback and wrapping actions.
		*/
		function codeToolbarLabels(t) {
			return {
				codeLabel: t("codeBlock.title"),
				wrapLabel: t("codeBlock.wrap"),
				unwrapLabel: t("codeBlock.unwrap")
			};
		}
		/**
		* Build localized Markdown chrome labels.
		* @param t - Conversation locale seat.
		* @returns Markdown chrome labels.
		*/
		function markdownLabels(t) {
			return {
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied"),
					toolbarLabels: codeToolbarLabels(t)
				},
				footnotes: t("markdown.footnotes")
			};
		}
		/**
		* Build localized diff-card chrome labels.
		* @param t - Conversation locale seat.
		* @returns Diff-card chrome labels.
		*/
		function diffBlockLabels(t) {
			return {
				...codeToolbarLabels(t),
				copy: t("copy"),
				copied: t("copied"),
				collapseAria: t("diff.collapseAria"),
				expandAria: (count) => t("diff.expandAria", { count }),
				collapse: t("collapse"),
				expand: (count) => t("diff.expandRest", { count })
			};
		}
		/**
		* Build localized read-card chrome labels.
		* @param t - Conversation locale seat.
		* @returns Read-card chrome labels.
export {};
