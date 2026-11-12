/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dựng phần PENDING_ACTION từ nhật ký đã ghi: lời gọi native lấy schema từ header yêu cầu, lời
 *      gọi con PTC lấy schema ràng buộc lúc bind. Nguyên văn hành vi gói gốc (lib/index.js dòng 77–208).
 */

import { isRecord, parseLoggedArguments, sameJson } from "./json.ts";
import { scopedCallKey } from "./history.ts";
import type { PendingExecution, PtcStart, ReviewAction, ToolCallEvent } from "./types.ts";

/** Một schema tool đã kiểm đủ hai trường mà bộ duyệt gửi cho model. */
export interface LoggedSchema {
  /** Tên tool mà yêu cầu duyệt khẳng định. */
  readonly name: string;
  /** Mô tả tool. */
  readonly description: string;
  /** JSON Schema tham số. */
  readonly parameters: Record<string, unknown>;
}

/**
 * Kiểm hai trường BẮT BUỘC của một schema tool đã ghi.
 * Nhận: `value` — schema (của header hoặc của bind PTC); `expectedName` — tên tool phải khẳng định;
 * `mode` — nhãn xuất hiện trong thông điệp lỗi (`native` hoặc `PTC`).
 * Trả: schema đã chuẩn hoá; ném khi thiếu `description` chuỗi hoặc `parameters` là bản ghi.
 */
export function loggedSchema(
  value: { readonly description?: unknown; readonly parameters?: unknown },
  expectedName: string,
  mode: string,
): LoggedSchema {
  if (typeof value.description !== "string" || !isRecord(value.parameters)) {
    throw new Error(`auto-review: the pending ${mode} tool schema is incomplete`);
  }
  return { name: expectedName, description: value.description, parameters: value.parameters };
}

/**
 * Dựng hành động đang chờ cho một lời gọi NATIVE.
 * Nhận: `exec` — lời gọi đang chờ; `headerTools` — danh sách schema của header yêu cầu gần nhất;
 * `logged` — sự kiện `tool/call` khớp danh tính.
 * Trả: hành động `native` đã đóng băng dữ liệu nguồn; ném khi lời gọi lệch nhật ký, schema thiếu/mơ hồ.
 */
export function nativeAction(
  exec: PendingExecution,
  headerTools: readonly unknown[] | undefined,
  logged: ToolCallEvent,
): ReviewAction {
  if (logged.data.name !== exec.name || !sameJson(parseLoggedArguments(logged.data.arguments), exec.arguments)) {
    throw new Error("auto-review: the pending native call disagrees with its logged action");
  }
  const schemas = (Array.isArray(headerTools) ? headerTools : []).filter(
    (schema) => isRecord(schema) && schema["name"] === exec.name,
  );
  const [candidate] = schemas;
  if (candidate === undefined || schemas.length !== 1) {
    throw new Error("auto-review: the pending native tool schema is missing or ambiguous");
  }
  // Bộ lọc phía trên đã bảo đảm `candidate` là bản ghi có `name` khớp; `loggedSchema` kiểm hai trường còn lại.
  const schema = loggedSchema(candidate as { description?: unknown; parameters?: unknown }, exec.name, "native");
  return {
    mode: "native",
    name: schema.name,
    description: schema.description,
    parameters: schema.parameters,
    arguments: exec.arguments,
  };
}

/**
 * Dựng hành động đang chờ cho một lời gọi con PTC.
 * Nhận: `exec` — lời gọi con đang chờ; `start` — mốc `tool/ptc-dispatch-start` của chính nó;
 * `visibleParentKeys` — tập khoá lời gọi cha ĐÃ thấy trên bề mặt.
 * Trả: hành động `ptc-inner`; ném khi lời gọi lệch nhật ký hoặc schema bind thiếu/không khớp tên.
 */
export function ptcAction(exec: PendingExecution, start: PtcStart, visibleParentKeys: ReadonlySet<string>): ReviewAction {
  const { event } = start;
  if (
    !visibleParentKeys.has(scopedCallKey(start.step, event.data.parentCallId)) ||
    event.data.rootCallId !== exec.rootCallId ||
    event.data.name !== exec.name ||
    !sameJson(event.data.arguments, exec.arguments)
  ) {
    throw new Error("auto-review: the pending PTC call disagrees with its logged action");
  }
  if (exec.schema === undefined || exec.schema.name !== exec.name) {
    throw new Error("auto-review: the pending PTC binding schema is missing or inconsistent");
  }
  const schema = loggedSchema(exec.schema, exec.name, "PTC");
  return {
    mode: "ptc-inner",
    name: schema.name,
    description: schema.description,
    parameters: schema.parameters,
    arguments: exec.arguments,
  };
}
