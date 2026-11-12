/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Model cua ba loai the trong row ui-tool: the doc tep (read) · the diff · the tim kiem (grep/glob)
 */

import { parsedToolCall, singleResultText } from "./model-tool-call.ts";
import { abbreviateHomePath, recordedAbsolutePath, relativizeToCwd } from "./paths.ts";

/** Du lieu tho cua mot khoi goi tool trong Session log (ban goc khong dat kieu, ta giu 'any' cho gon). */
type Wire = any;

/** Muc day du cua phan noi dung bi luoc bo trong mot ket qua giu lai (ban goc: kieu `Omitted`). */
type Omitted = { kind: "none" } | { kind: "exact"; count: number } | { kind: "unknown" };

/** Whether a model-supplied argument is a 1-based line position or count: an integer of at least 1. */
export function positiveInteger$1(value: Wire): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/**
 * Kiem tra mot lan goi `read` da du de dung the doc chuyen biet chua.
 * Nhan: block — khoi goi tool dang chay hoac da xong.
 * Tra: true khi ten tool la `read` va `file_path`/`offset`/`limit` deu hop le.
 */
export function validReadCall(block: Wire): boolean {
  const call: Wire = parsedToolCall(block);
  if (call?.name !== "read") return false;
  const { file_path: path, offset, limit } = call.args;
  if (typeof path !== "string" || path.trim() === "") return false;
  if (offset !== void 0 && !positiveInteger$1(offset)) return false;
  if (limit !== void 0 && !positiveInteger$1(limit)) return false;
  return true;
}

/**
 * Loc metadata doc tep da luu cua mot ket qua `read` thanh khuon dung duoc.
 * Nhan: meta — truong meta cua ket qua tool (du lieu tu day, khong tin duoc).
 * Tra: { path, offset, lines, totalLines, lang? } da kiem, hoac null khi sai khuon.
 */
export function readMeta(meta: Wire): Wire {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
  const { path, offset, lines, totalLines, lang } = meta;
  if (typeof path !== "string" || typeof offset !== "number" || !Number.isInteger(offset) || offset < 1) return null;
  if (typeof totalLines !== "number" || !Number.isInteger(totalLines) || totalLines < 0 || !Array.isArray(lines)) return null;
  if (lang !== void 0 && typeof lang !== "string") return null;
  const narrowed: Wire[] = [];
  let previous = offset - 1;
  for (const line of lines) {
    if (typeof line !== "object" || line === null || Array.isArray(line)) return null;
    const { number, text } = line;
    if (typeof number !== "number" || !Number.isInteger(number) || number < 1 || number <= previous) return null;
    if (number > totalLines || typeof text !== "string") return null;
    previous = number;
    narrowed.push({
      number,
      text
    });
  }
  return {
    path,
    offset,
    lines: narrowed,
    totalLines,
    ...lang === void 0 ? {} : { lang }
  };
}

/**
 * The line one `read` call was about, from its arguments.
 *
 * `offset` is the read tool's own 1-based start line, so opening the path can
 * land where the model looked. Available while the call is still running,
 * unlike the persisted metadata, because the arguments carry it. The arguments
 * are model-produced JSON: only an integer of at least 1 is a line, and a call
 * whose `offset` is anything else names none.
 * @param block - running or settled Tool block.
 * @returns the 1-based line, or undefined when the call named none.
 */
export function readCallLine(block: Wire): number | undefined {
  if (!validReadCall(block)) return void 0;
  const call: Wire = parsedToolCall(block);
  const { offset } = call?.args ?? {};
  return positiveInteger$1(offset) ? offset : void 0;
}

/**
 * Derive a settled root read card after validating its persisted metadata and
 * model-facing read envelope.
 * @param block - running or settled Tool block.
 * @param sessionCwd - the session workspace root; a workspace-rooted absolute
 *   path label displays relative to it. Absent leaves the path as authored.
 * @param home - host account home; a leftover POSIX home path displays as `~`.
 * @returns the read-card props, or null for the generic path.
 */
export function readCardModel(block: Wire, sessionCwd: string | undefined, home: string | undefined): Wire {
  if (block.parentCallId !== void 0 || !("kind" in block) || block.isError) return null;
  if (!validReadCall(block)) return null;
  const meta = readMeta(block.meta);
  if (meta === null) return null;
  const text: Wire = singleResultText(block);
  if (text === void 0) return null;
  if (/^<path>[^\n]*<\/path>\n<type>file<\/type>\n<content>\n([\s\S]*)\n<\/content>$/u.exec(text)?.[1] === void 0) return null;
  return {
    label: abbreviateHomePath(relativizeToCwd(meta.path, sessionCwd), home),
    lines: meta.lines,
    totalLines: meta.totalLines,
    lang: meta.lang
  };
}

/**
 * Narrow opaque result metadata's `diffs` to well-formed hunks.
 * @param diffs - the metadata field to validate.
 * @returns the validated hunks, or null when the payload is not usable.
 */
export function narrowDiffs(diffs: Wire): Wire {
  if (!Array.isArray(diffs) || diffs.length === 0) return null;
  const out: Wire[] = [];
  for (const hunk of diffs) {
    if (typeof hunk !== "object" || hunk === null) return null;
    const { path, oldText, newText } = hunk;
    if (typeof path !== "string") return null;
    if (oldText !== null && typeof oldText !== "string") return null;
    if (typeof newText !== "string") return null;
    out.push({
      path,
      oldText,
      newText
    });
  }
  return out;
}

/**
 * Dung diff ma lenh goc (write · edit · str_replace_editor) DINH lam, tu tham so cua no.
 * Nhan: block — khoi goi tool dang chay hoac da xong.
 * Tra: { tool, diff } hoac null khi khong phai lenh ghi/sua tep nao.
 */
export function intendedDiff(block: Wire): Wire {
  const parsed: Wire = parsedToolCall(block);
  if (parsed === null) return null;
  if (parsed.name === "str_replace_editor") {
    const { command, path, file_text: fileText, old_str: oldText, new_str: newText } = parsed.args;
    if (typeof path !== "string" || path.trim() === "") return null;
    if (command === "create") {
      if (fileText !== void 0 && typeof fileText !== "string") return null;
      return {
        tool: "str_replace_editor",
        diff: {
          path,
          oldText: null,
          newText: fileText ?? ""
        }
      };
    }
    if (command === "str_replace") {
      if (oldText !== void 0 && typeof oldText !== "string") return null;
      if (newText !== void 0 && typeof newText !== "string") return null;
      return {
        tool: "str_replace_editor",
        diff: {
          path,
          oldText: oldText ?? null,
          newText: newText ?? ""
        }
      };
    }
    return null;
  }
  const { file_path: path } = parsed.args;
  if (typeof path !== "string" || path.trim() === "") return null;
  if (parsed.name === "write") {
    const { content } = parsed.args;
    return typeof content === "string" ? {
      tool: "write",
      diff: {
        path,
        oldText: null,
        newText: content
      }
    } : null;
  }
  if (parsed.name !== "edit") return null;
  const { old_string: oldText, new_string: newText, replace_all: replaceAll } = parsed.args;
  if (typeof oldText !== "string" || typeof newText !== "string") return null;
  if (replaceAll !== void 0 && typeof replaceAll !== "boolean") return null;
  return {
    tool: "edit",
    diff: {
      path,
      oldText: oldText || null,
      newText
    }
  };
}

/**
 * Doc diff da ap dung tu meta ket qua: rong · danh sach hunk · hoac null khi meta sai khuon.
 * Nhan: meta — truong meta cua ket qua tool (du lieu tu day).
 * Tra: mang hunk da kiem, chuoi "empty" khi rong, hoac null khi khong dung duoc.
 */
export function appliedDiffs(meta: Wire): Wire {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
  const diffs = meta.diffs;
  if (!Array.isArray(diffs)) return null;
  if (diffs.length === 0) return "empty";
  return narrowDiffs(diffs);
}

/**
 * Derive running diffs for root write/edit and `str_replace_editor`
 * create/replace calls, plus applied settled diffs for root write/edit calls.
 * A successful write with valid empty metadata uses its argument-derived
 * whole-file diff, matching create and identical-overwrite presentation;
 * `str_replace_editor` settles through Generic because it has no result view.
 * @param block - running or settled Tool block.
 * @returns the diff-card props, or null for the generic path.
 */
export function diffCardModel(block: Wire): Wire {
  if (block.parentCallId !== void 0) return null;
  const intended = intendedDiff(block);
  if (intended === null) return null;
  if (!("kind" in block)) return { card: { diffs: [intended.diff] } };
  if (intended.tool === "str_replace_editor") return null;
  if (block.isError) return null;
  const applied = appliedDiffs(block.meta);
  if (applied === null || applied === "empty") return intended.tool === "write" ? { card: { diffs: [intended.diff] } } : null;
  const path = recordedAbsolutePath(block.meta, "path");
  return { card: { diffs: applied.map((diff: Wire) => diff.path === path ? {
    ...diff,
    path: intended.diff.path
  } : diff) } };
}

/**
 * Xac dinh mot lan goi tool co phai lenh tim kiem `grep`/`glob` hop le khong.
 * Nhan: block — khoi goi tool dang chay hoac da xong.
 * Tra: "grep" hoac "glob", hoac null khi ten tool/tham so khong hop le.
 */
export function validSearchCall(block: Wire): string | null {
  const call: Wire = parsedToolCall(block);
  if (call === null) return null;
  const { pattern, path } = call.args;
  if (typeof pattern !== "string") return null;
  if (call.name === "grep" && pattern === "") return null;
  if (call.name === "glob" && pattern.trim() === "") return null;
  if (call.name !== "grep" && call.name !== "glob") return null;
  if (path !== void 0 && (typeof path !== "string" || path.trim() === "")) return null;
  if (call.name === "grep") {
    const { include } = call.args;
    if (include !== void 0 && (typeof include !== "string" || !validInclude(include))) return null;
  }
  return call.name;
}

/**
 * Kiem tra mot glob include cua `grep` co dung dang mot mau duy nhat khong (khong dau `!`, khong dau `,` ngoai ngoac).
 * Nhan: include — gia tri tham so `include` do model sinh ra.
 * Tra: true khi dung dang mot mau duy nhat.
 */
export function validInclude(include: string): boolean {
  if (include.trim() === "" || include.startsWith("!")) return false;
  let braceDepth = 0;
  for (const character of include) if (character === "{") braceDepth += 1;
  else if (character === "}") braceDepth = Math.max(0, braceDepth - 1);
  else if (character === "," && braceDepth === 0) return false;
  return true;
}

/**
 * Loc danh sach tep ket qua tim kiem (moi tep kem cac dong khop) thanh khuon dung duoc.
 * Nhan: value — truong `files` trong meta cua ket qua grep (du lieu tu day).
 * Tra: mang { path, matches } da kiem, hoac null khi sai khuon.
 */
export function searchFiles(value: Wire): Wire {
  if (!Array.isArray(value)) return null;
  const files: Wire[] = [];
  for (const file of value) {
    if (typeof file !== "object" || file === null || Array.isArray(file)) return null;
    const { path, matches } = file;
    if (typeof path !== "string" || !Array.isArray(matches)) return null;
    const narrowed: Wire[] = [];
    for (const match of matches) {
      if (typeof match !== "object" || match === null || Array.isArray(match)) return null;
      const { lineNumber, line } = match;
      if (typeof lineNumber !== "number" || !Number.isInteger(lineNumber) || lineNumber < 1) return null;
      if (typeof line !== "string") return null;
      narrowed.push({
        lineNumber,
        line
      });
    }
    files.push({
      path,
      matches: narrowed
    });
  }
  return files;
}

/**
 * Gop cac khoi text cua mot ket qua thanh mot chuoi (bo khoi khong phai text), rong thi tra undefined.
 * Nhan: content — mang khoi noi dung cua ket qua tool.
 * Tra: chuoi da noi bang xuong dong, hoac undefined khi khong co text nao.
 */
export function flattenContent(content: Wire): string | undefined {
  const text = content.filter((block: Wire) => block.type === "text" && typeof block.text === "string").map((block: Wire) => block.text).join("\n");
  return text === "" ? void 0 : text;
}

/**
 * Derive a settled root grep/glob card from persisted metadata.
 * @param block - running or settled Tool block.
 * @returns search-card props, or null for the generic path.
 */
export function searchCardModel(block: Wire): Wire {
  if (block.parentCallId !== void 0 || !("kind" in block) || block.isError) return null;
  const tool = validSearchCall(block);
  if (tool === null) return null;
  if (typeof block.meta !== "object" || block.meta === null || Array.isArray(block.meta)) return null;
  const meta = block.meta;
  if (typeof meta.truncated !== "boolean") return null;
  if (typeof meta.total !== "number" || !Number.isInteger(meta.total) || meta.total < 0) return null;
  const common = {
    truncated: meta.truncated,
    total: meta.total
  };
  const recovery = meta.truncated ? flattenContent(block.content) : void 0;
  if (tool === "grep") {
    if (meta.shape !== "matches") return null;
    const files = searchFiles(meta.files);
    return files === null ? null : {
      recovery,
      card: {
        kind: "matches",
        files,
        ...common
      }
    };
  }
  if (meta.shape !== "paths" || !Array.isArray(meta.paths)) return null;
  if (!meta.paths.every((path: Wire) => typeof path === "string")) return null;
  return {
    recovery,
    card: {
      kind: "paths",
      paths: [...meta.paths],
      ...common
    }
  };
}

// Ban goc con hai lenh tao bo ma hoa o pham vi module (doan duoi cua vung nay) — giu nguyen cho trung thanh.
new TextEncoder();
new TextDecoder();

/**
 * Standardized, false-precision-safe wording for one {@link Omitted} value —
 * the "may standardize omission wording" half the library owns. `exact` prints
 * the count (`Omitted 3 items`); `unknown` prints NO count because the caller
 * did not provide one. `none` is the empty string.
 *
 * @param omitted The omission metadata from a retainer result.
 * @param unit The noun for the omitted quantity (`items`, `bytes`, `chars`, `lines`).
 * @returns A neutral clause (no trailing space), or `''` when nothing was omitted.
 */
export function describeOmitted(omitted: Omitted, unit: string): string {
  switch (omitted.kind) {
    case "none": return "";
    case "exact": return `Omitted ${omitted.count} ${unit}.`;
    case "unknown": return `More ${unit} were omitted.`;
  }
}
