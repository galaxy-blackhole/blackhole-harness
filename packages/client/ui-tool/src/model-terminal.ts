/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mo hinh du lieu cua the terminal (bash, pwsh, terminal_send) va the web (web_search, web_fetch) trong row ui-tool
 */

import { parsedToolCall, singleResultText } from "./model-tool-call.ts";
import { hasSpillNotice } from "./model-spill.ts";
import { isAbsoluteWorkspacePath, recordedAbsolutePath, resolveWorkspacePath } from "./paths.ts";

/** Mot lan goi shell da chuan hoa (bash · pwsh); thieu description nghia la shell thuong truc. */
interface ShellCall {
  /** Loai lan goi — shell. */
  kind: "shell";
  /** Lenh goc do Tool soan. */
  command: string;
  /** Mo ta goc; undefined voi shell thuong truc. */
  description: string | undefined;
  /** Thu muc lam viec goc; undefined voi shell thuong truc. */
  workdir: string | undefined;
  /** Shell thuong truc (khong co mo ta) hay khong. */
  persistent: boolean;
  /** Chay nen hay khong. */
  background: boolean;
}

/** Mot lan goi terminal_send da chuan hoa. */
interface TerminalSendCall {
  /** Loai lan goi — terminal-send. */
  kind: "terminal-send";
  /** Van ban gui vao phien. */
  text: string;
  /** Phien terminal nhan van ban. */
  sessionId: string;
  /** Chay nen hay khong. */
  background: boolean;
}

/** Trang thai thoat boc tu van ban ket qua shell. */
interface ExitStatus {
  /** Phan output truoc marker trang thai. */
  output: string;
  /** Ma thoat; thieu khi ket qua chi bao tin hieu. */
  exitCode?: number | null;
  /** Tin hieu ket lieu; thieu khi ket qua chi bao ma thoat. */
  signal?: string;
}

/** Mot nguon cua ket qua web_search da chuan hoa. */
interface WebSource {
  /** Dia chi nguon. */
  url: string;
  /** Tieu de nguon, neu co. */
  title?: string;
  /** Trich doan nguon, neu co. */
  snippet?: string;
  /** Thoi diem cong bo nguon, neu co. */
  publishedAt?: string;
}

/**
 * Build the TerminalBlock display copy from the conversation locale seat —
 * the one place the primitive's label surface pairs with this package's
 * dictionary, shared by every terminal render site (chat row, bash row,
 * details panel).
 * @param t - the render site's conversation locale seat.
 * @returns the full label set for {@link TerminalBlockProps}'s `labels`.
 */
export function terminalBlockLabels(t: any): any {
  return {
    commandLine: (line: any) => t("terminal.commandLine", { n: line }),
    signal: (signal: any) => t("terminal.signal", { signal }),
    exitCode: (code: any) => t("terminal.exitCode", { code }),
    noExitCode: t("terminal.noExitCode"),
    running: t("terminal.running"),
    failed: t("terminal.failed"),
    done: t("terminal.done"),
    copy: t("copy"),
    copied: t("copied"),
    noOutput: t("terminal.noOutput"),
    collapseAria: t("terminal.collapseAria"),
    collapse: t("collapse"),
    expandAria: (hidden: any) => t("terminal.expandAria", { n: hidden }),
    expand: (hidden: any) => t("terminal.expandRest", { n: hidden })
  };
}
/**
 * Resolve locale-owned `terminal_send` copy while preserving Tool-authored
 * shell commands and descriptions verbatim.
 * @param model - locale-neutral terminal card data.
 * @param t - the render site's conversation locale seat.
 * @returns terminal props and description ready for rendering.
 */
export function localizeTerminalCardModel(model: any, t: any): any {
  if (model.copy.kind === "shell") return {
    card: {
      command: model.copy.command,
      ...model.card
    },
    description: model.copy.description
  };
  return {
    card: {
      command: model.copy.text === "" ? t("terminal.sendInput") : model.copy.text,
      ...model.card
    },
    description: t("terminal.session", { sessionId: model.copy.sessionId })
  };
}
/**
 * True when a settled terminal card reports a failing exit — a non-zero code,
 * an explicitly missing exit code, or a terminating signal. The bash tool settles
 * a failing command as a completed call (`isError` stays false: the exit status is result data), so
 * the row retains that failure state alongside its exit capsule.
 * @param model - a derived terminal card.
 * @returns whether the card's exit status is a failure.
 */
export function terminalFailed(model: any): boolean {
  const { exitCode, signal, running } = model.card;
  return running !== true && (exitCode !== void 0 && exitCode !== 0 || signal !== void 0);
}
/**
 * Localize a settled foreground command's exit status without inventing a code.
 * @param model - terminal card, absent for generic execution errors.
 * @param t - conversation locale.
 * @returns the capsule label, or null for running, background, or successful calls.
 */
export function terminalExitLabel(model: any, t: any): string | null {
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
export function resolveTerminalCwd(workdir: any, sessionCwd: any): string | undefined {
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
export function normalizeSegments(path: string): string {
  if (!/(?:^|[/\\])\.\.?(?:[/\\]|$)/.test(path)) return path;
  const unc = /^[/\\]{2}([^/\\]+)[/\\]+([^/\\]+)/.exec(path);
  if (unc !== null) {
    const [, server, share] = unc;
    const root = `\\\\${String(server)}\\${String(share)}`;
    const rest = collapse(path.slice(unc[0].length), true);
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
export function collapse(body: string, rooted: boolean, separator = "/"): string {
  const kept: string[] = [];
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
/**
 * Chuan hoa mot lan goi shell (bash · pwsh) tu ten tool va tham so tho.
 * Nhan: name — ten tool; args — tham so tho cua lan goi.
 * Tra: lan goi da chuan hoa (shell thuong truc khi thieu description), hoac null khi sai khuon.
 */
export function shellCall(name: any, args: any): ShellCall | null {
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
export function isBackgroundShellCall(block: any): boolean {
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
export function isSettledPersistentShellCall(block: any): boolean {
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
export function isSpilledShellCall(block: any): boolean {
  if (!("kind" in block)) return false;
  const parsed = parsedToolCall(block);
  if (parsed === null) return false;
  const call = shellCall(parsed.name, parsed.args);
  if (call === null || call.background) return false;
  const output = singleResultText(block);
  return output !== void 0 && hasSpillNotice(output);
}
/**
 * Chuan hoa mot lan goi terminal_send tu ten tool va tham so tho.
 * Nhan: name — ten tool; args — tham so tho cua lan goi.
 * Tra: lan goi terminal_send da chuan hoa, hoac null khi sai khuon.
 */
export function terminalSendCall(name: any, args: any): TerminalSendCall | null {
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
export function parseExitStatus(text: string): ExitStatus {
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
export function terminalCardModel(block: any, sessionCwd?: any): any {
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
  const status: ExitStatus = call.kind === "terminal-send" ? { output } : parseExitStatus(output);
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
/**
 * Nhan dien mot lan goi web_search hoac web_fetch hop le va tra ten tool.
 * Nhan: block — khoi Tool dang chay hoac da ket thuc.
 * Tra: "web_search" hoac "web_fetch", hoac null khi khong phai lan goi web hop le.
 */
export function validWebCall(block: any): string | null {
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
/**
 * Doc danh sach nguon cua ket qua web_search tu metadata da luu (khong tin du lieu la).
 * Nhan: value — gia tri meta.sources tho.
 * Tra: mang nguon da chuan hoa, hoac null khi sai khuon.
 */
export function webSources(value: any): WebSource[] | null {
  if (!Array.isArray(value)) return null;
  const sources: WebSource[] = [];
  for (const source of value) {
    if (typeof source !== "object" || source === null || Array.isArray(source)) return null;
    const { url, title, snippet, publishedAt } = source as any;
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
export function webCardModel(block: any): any {
  if (block.parentCallId !== void 0 || !("kind" in block) || block.isError) return null;
  const tool = validWebCall(block);
  if (tool === null || typeof block.meta !== "object" || block.meta === null || Array.isArray(block.meta)) return null;
  const meta: any = block.meta;
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
export function webFetchHref(block: any): string | undefined {
  const call = parsedToolCall(block);
  if (call?.name !== "web_fetch" || typeof call.args.url !== "string") return void 0;
  const url = call.args.url as string;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : void 0;
  } catch {
    return;
  }
}
