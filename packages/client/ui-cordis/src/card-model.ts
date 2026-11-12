/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mô hình hiển thị ổn định theo replay của ba loại tool call vòng đời Cordis (define · run · stop/undefine) — port 1:1 vùng #region card-model.js
 */

import type {
  CordisDynamicPackageId,
  CordisDynamicPluginId,
  CordisDynamicPluginRunId,
  CordisDynamicRunMode,
} from "./events.ts";

/** Vòng đời của chính lời gọi tool. */
export type CordisToolState = "running" | "ok" | "error" | "stopped";

/** Một mẩu nội dung trong kết quả tool call. */
export interface CordisBlockContentItem {
  /** Loại mẩu: `text` hoặc loại khác (khi đó in JSON). */
  readonly type: string;
  /** Chữ của mẩu `text`. */
  readonly text?: string | undefined;
}

/**
 * Khối tool call mà card đọc. ĐANG CHẠY khi THIẾU `kind`; ĐÃ KẾT THÚC khi CÓ `kind` — đúng phép thử
 * `"kind" in block` của bản gốc.
 */
export interface CordisToolBlock {
  /** Có mặt ⇒ lời gọi đã kết thúc (có kết quả đóng băng). */
  readonly kind?: string | undefined;
  /** Tham số thô của lời gọi đang chạy. */
  readonly argsRaw?: string | undefined;
  /** Lời gọi đã kết thúc (bản ghi đóng băng). */
  readonly call?: { readonly argsRaw?: string | undefined } | undefined;
  /** Nội dung kết quả. */
  readonly content?: readonly CordisBlockContentItem[] | undefined;
  /** Lỗi của lời gọi. */
  readonly error?: { readonly name: string; readonly code: string } | undefined;
  /** Lời gọi trả lỗi. */
  readonly isError?: boolean | undefined;
  /** Siêu dữ liệu Host gửi kèm kết quả. */
  readonly meta?: unknown;
  /** Số thứ tự trong log hội thoại. */
  readonly seq?: number | undefined;
}

/** Dữ liệu trình bày đã đóng băng của `cordis_define`. */
export interface CordisDefineCard {
  /** Id Plugin (khi Host đã nhận). */
  readonly pluginId: CordisDynamicPluginId | null;
  /** Id Package bất biến. */
  readonly packageId: CordisDynamicPackageId | null;
  /** Tên hiển thị. */
  readonly name: string | null;
  /** Mục đích. */
  readonly purpose: string | null;
  /** Mã nửa host. */
  readonly hostCode: string | null;
  /** Mã nửa client. */
  readonly clientCode: string | null;
  /** Kết quả dạng chữ. */
  readonly output: string | null;
  /** Câu lỗi rút gọn (dòng đầu của kết quả khi lỗi). */
  readonly errorSummary: string | null;
  /** Vòng đời lời gọi. */
  readonly state: CordisToolState;
}

/** Dữ liệu trình bày đã đóng băng của `cordis_run`. */
export interface CordisRunCard {
  /** Id Plugin. */
  readonly pluginId: CordisDynamicPluginId | null;
  /** Id Package. */
  readonly packageId: CordisDynamicPackageId | null;
  /** Id lần chạy. */
  readonly pluginRunId: CordisDynamicPluginRunId | null;
  /** Chế độ chạy (`run`/`update`). */
  readonly mode: CordisDynamicRunMode | null;
  /** Số thứ tự log của kết quả. */
  readonly seq: number | null;
  /** Kết quả dạng chữ. */
  readonly output: string | null;
  /** Câu lỗi rút gọn. */
  readonly errorSummary: string | null;
  /** Vòng đời lời gọi. */
  readonly state: CordisToolState;
}

/** Dữ liệu trình bày đã đóng băng của `cordis_stop` hoặc `cordis_undefine`. */
export interface CordisActionCard {
  /** Id Plugin bị tác động. */
  readonly pluginId: CordisDynamicPluginId | null;
  /** Kết quả dạng chữ. */
  readonly output: string | null;
  /** Câu lỗi rút gọn. */
  readonly errorSummary: string | null;
  /** Vòng đời lời gọi. */
  readonly state: CordisToolState;
}

/**
 * Ký tự xuống dòng, dựng bằng MÃ ký tự thay vì viết escape trong chuỗi.
 * ⚠️ BẪY ĐÃ ĐO 19/10/2026: bộ in của Bun (Bun.build 1.3.14) in chuỗi chứa escape \\n thành TEMPLATE NHIỀU DÒNG
 *    và chèn luôn thụt lề của dòng vào trong literal ⇒ chuỗi thành "xuống dòng + 4 dấu cách" ⇒
 *    \`indexOf("\\n")\` không khớp nữa và \`errorSummary\` in cả khối nhiều dòng. Viết bằng
 *    \`String.fromCharCode(10)\` thì bộ in không thể biến đổi, và artifact giữ đúng nghĩa.
 */
const NEWLINE = String.fromCharCode(10);

/**
 * Lấy dòng đầu của một chuỗi nhiều dòng.
 * Nhận: chuỗi gốc.
 * Trả: phần trước ký tự xuống dòng đầu tiên (hoặc cả chuỗi khi chỉ một dòng).
 */
function firstLine(text: string): string {
  const newline = text.indexOf(NEWLINE);
  return newline === -1 ? text : text.slice(0, newline);
}

/**
 * Đọc một trường chuỗi khác rỗng.
 * Nhận: bảng nguồn và tên khoá.
 * Trả: chuỗi khi có giá trị khác rỗng, ngược lại null.
 */
function stringAt(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Đọc một trường object khác null.
 * Nhận: bảng nguồn và tên khoá.
 * Trả: object khi đúng kiểu, ngược lại null.
 */
function objectAt(source: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = source[key];
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * Phân tích tham số thô của lời gọi tool.
 * Nhận: chuỗi JSON thô.
 * Trả: object đã parse, hoặc null khi JSON hỏng / không phải object.
 */
function parseArgs(argsRaw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(argsRaw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Ghép kết quả tool call thành chữ.
 * Nhận: khối đã kết thúc.
 * Trả: chữ của các mẩu nội dung, hoặc mô tả lỗi khi rỗng, hoặc null.
 */
function resultText(block: CordisToolBlock): string | null {
  const content = block.content ?? [];
  const text = content
    .map((item) => (item.type === "text" ? item.text ?? "" : JSON.stringify(item, null, 2)))
    .join(NEWLINE);
  if (text !== "") return text;
  return block.error === undefined ? null : `${block.error.name}: ${block.error.code}`;
}

/**
 * Suy ra vòng đời của lời gọi.
 * Nhận: khối tool call.
 * Trả: `running` · `stopped` (bị ngắt) · `error` · `ok`.
 */
function stateOf(block: CordisToolBlock): CordisToolState {
  if (!("kind" in block)) return "running";
  if (block.error?.code === "interrupted") return "stopped";
  return block.isError === true ? "error" : "ok";
}

/**
 * Đọc siêu dữ liệu Host gửi kèm kết quả.
 * Nhận: khối tool call.
 * Trả: object siêu dữ liệu khi lời gọi đã kết thúc, không lỗi và meta là object; ngược lại null.
 */
function metaObject(block: CordisToolBlock): Record<string, unknown> | null {
  if (!("kind" in block) || block.isError === true || typeof block.meta !== "object" || block.meta === null) return null;
  return block.meta as Record<string, unknown>;
}

/**
 * Suy ra một thẻ Define từ lát cắt call/result đã đóng băng.
 * Nhận: block — khối tool call đang chạy hoặc đã kết thúc.
 * Trả: các trường của thẻ Define đã chuẩn hoá.
 */
export function cordisDefineCard(block: CordisToolBlock): CordisDefineCard {
  const settled = "kind" in block;
  const argsRaw = (settled ? block.call?.argsRaw : block.argsRaw) ?? "";
  const args = parseArgs(argsRaw);
  const code = args === null ? null : objectAt(args, "code");
  const state = stateOf(block);
  const output = settled ? resultText(block) : null;
  const meta = metaObject(block);
  const rawName = argsRaw === "" ? null : firstLine(argsRaw);
  return {
    pluginId: meta === null ? null : stringAt(meta, "pluginId"),
    packageId: meta === null ? null : stringAt(meta, "packageId"),
    name: args === null ? rawName : stringAt(args, "name") ?? rawName,
    purpose: args === null ? null : stringAt(args, "purpose"),
    hostCode: code === null ? null : stringAt(code, "host"),
    clientCode: code === null ? null : stringAt(code, "client"),
    output,
    errorSummary: state === "error" && output !== null ? firstLine(output) : null,
    state,
  };
}

/**
 * Suy ra một thẻ Run cùng siêu dữ liệu kích hoạt thành công.
 * Nhận: block — khối tool call đang chạy hoặc đã kết thúc.
 * Trả: các trường của thẻ Run đã chuẩn hoá.
 */
export function cordisRunCard(block: CordisToolBlock): CordisRunCard {
  const settled = "kind" in block;
  const args = parseArgs((settled ? block.call?.argsRaw : block.argsRaw) ?? "");
  const meta = metaObject(block);
  const state = stateOf(block);
  const output = settled ? resultText(block) : null;
  const rawMode = args === null ? null : stringAt(args, "mode");
  const argsPluginId = args === null ? null : stringAt(args, "pluginId");
  const argsPackageId = args === null ? null : stringAt(args, "packageId");
  return {
    pluginId: meta === null ? argsPluginId : stringAt(meta, "pluginId") ?? argsPluginId,
    packageId: meta === null ? argsPackageId : stringAt(meta, "packageId") ?? argsPackageId,
    pluginRunId: meta === null ? null : stringAt(meta, "pluginRunId"),
    mode: rawMode === "run" || rawMode === "update" ? rawMode : null,
    seq: settled ? block.seq ?? null : null,
    output,
    errorSummary: state === "error" && output !== null ? firstLine(output) : null,
    state,
  };
}

/**
 * Suy ra một thẻ Stop hoặc Remove từ lát cắt call/result đã đóng băng.
 * Nhận: block — khối tool call đang chạy hoặc đã kết thúc.
 * Trả: các trường của thẻ thao tác vòng đời đã chuẩn hoá.
 */
export function cordisActionCard(block: CordisToolBlock): CordisActionCard {
  const settled = "kind" in block;
  const args = parseArgs((settled ? block.call?.argsRaw : block.argsRaw) ?? "");
  const state = stateOf(block);
  const output = settled ? resultText(block) : null;
  return {
    pluginId: args === null ? null : stringAt(args, "pluginId") ?? stringAt(args, "id"),
    output,
    errorSummary: state === "error" && output !== null ? firstLine(output) : null,
    state,
  };
}
