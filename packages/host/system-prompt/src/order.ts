/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thứ tự CHUẨN của bản lắp: mục prompt, schema tool (`toolOrder` + mốc rest) — và
 *      các thông điệp lỗi mà bản gốc ném, để hai bên hành xử y hệt trên cùng đầu vào.
 */

import type { PromptSection, ToolSchema } from "./types.ts";

/** Mốc dành riêng trong `toolOrder` cho các tool KHÔNG được liệt kê. */
export const TOOL_ORDER_REST = "<unlisted-tools>";

/**
 * So tên theo CODE-UNIT — không phụ thuộc locale, nên thứ tự giống nhau trên mọi máy.
 * Nhận: hai tên.
 * Trả: -1 / 0 / 1 như một comparator chuẩn.
 */
export function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Xếp mục prompt theo chỗ đặt tường minh, rồi theo tên cho tất định.
 * Nhận: hai mục đã lắp.
 * Trả: hiệu thứ tự, hoặc so tên khi bằng thứ tự.
 */
export function comparePromptSections(a: PromptSection, b: PromptSection): number {
  return a.order - b.order || compareNames(a.name, b.name);
}

/**
 * Xếp schema tool theo tên (code-unit).
 * Nhận: hai schema tool.
 * Trả: -1 / 0 / 1 theo tên.
 */
export function compareToolNames(a: ToolSchema, b: ToolSchema): number {
  return compareNames(a.name, b.name);
}

/**
 * Kiểm tên trùng và mốc {@link TOOL_ORDER_REST} bắt buộc trong `toolOrder`.
 * Nhận: danh sách tên tool đã cấu hình (có thể vắng).
 * Trả: chính danh sách đó khi hợp lệ; ném lỗi khi trùng tên hoặc thiếu mốc rest.
 */
export function validateToolOrder(toolOrder: readonly string[] | undefined): readonly string[] | undefined {
  if (toolOrder === undefined) return undefined;
  const seen = new Set<string>();
  for (const name of toolOrder) {
    if (seen.has(name)) throw new Error(`toolOrder lists "${name}" more than once`);
    seen.add(name);
  }
  if (!seen.has(TOOL_ORDER_REST)) throw new Error(`toolOrder must contain the "${TOOL_ORDER_REST}" rest entry (where unlisted tools are inserted)`);
  return toolOrder;
}

/**
 * Áp `toolOrder` đã cấu hình, chèn tool không liệt kê theo thứ tự từ điển tại
 * {@link TOOL_ORDER_REST}. Tên lạ ném lỗi; tên HỢP LỆ nhưng bị giới hạn ở phạm vi này có thể vắng.
 * Nhận: các tool gom được, `toolOrder`, và tập tên đã biết.
 * Trả: mảng tool theo thứ tự chuẩn.
 */
export function orderTools(tools: ToolSchema[], toolOrder: readonly string[] | undefined, knownNames: ReadonlySet<string>): ToolSchema[] {
  if (tools.find((tool) => tool.name === TOOL_ORDER_REST) !== undefined) throw new Error(`tool provider returned reserved tool name "${TOOL_ORDER_REST}" (reserved for toolOrder's rest entry)`);
  if (toolOrder === undefined) return tools.sort(compareToolNames);
  const unknown = toolOrder.filter((name) => name !== TOOL_ORDER_REST && !knownNames.has(name));
  if (unknown.length > 0) throw new Error(`toolOrder lists unregistered tool${unknown.length > 1 ? "s" : ""} ${unknown.map((name) => `"${name}"`).join(", ")}; known tools: ${[...knownNames].sort().join(", ") || "(none)"}`);
  const listed = new Set(toolOrder);
  const rest = tools.filter((tool) => !listed.has(tool.name)).sort(compareToolNames);
  return toolOrder.flatMap((name) => (name === TOOL_ORDER_REST ? rest : tools.filter((tool) => tool.name === name)));
}
