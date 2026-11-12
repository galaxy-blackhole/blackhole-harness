/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Đọc composition của một revision (module đang hoạt động + hàng đã làm phẳng) — port 1:1
 *      `activeCompositionModules`, `disabledContribution`, `combineDisabled`, `flattenRows`,
 *      `definitionComposition`, `mountedCompositionRows`.
 */

import { isJsExpr } from "@deepseek-ai/cordis-plugin-loader";

import { entryListProblem } from "./definition.ts";

import type { ActiveModule, CompositionRow, EntryRow, MountedTree } from "./types.ts";

/**
 * Đọc các module đang hoạt động của một cây đã mount, theo thứ tự Loader.
 * Nhận: tree — cây revision đang giữ.
 * Trả: tham chiếu module đã tách khỏi entry.
 */
export function activeCompositionModules(tree: MountedTree): ActiveModule[] {
  const modules: ActiveModule[] = [];
  for (const entry of tree.entries()) {
    if (entry.options.group || entry.disabled || entry.fiber?.state !== 2) continue;
    const ownerTree = entry.parent.tree;
    const baseUrl = ownerTree.ctx.baseUrl;
    modules.push({
      moduleName: entry.options.name,
      ...(baseUrl === undefined ? {} : { baseUrl }),
      useHostBase: ownerTree === (tree as unknown as typeof ownerTree),
    });
  }
  return modules;
}

/**
 * Đóng góp của MỘT node `disabled` vào trạng thái bật hiệu dụng, đúng cách Loader đọc: biểu thức `!!js`
 * được hỏi evaluator — từ chối (throw) thì để lượt mount quyết — còn lại tắt khi `Boolean(value)`.
 * Nhận: value — node `disabled` thô của một hàng; evaluateExpression — evaluator của ngữ cảnh Loader.
 * Trả: true (tắt), false (bật), hoặc "conditional".
 */
export function disabledContribution(value: unknown, evaluateExpression: (source: string) => unknown): boolean | "conditional" {
  if (isJsExpr(value as never)) {
    try {
      return Boolean(evaluateExpression((value as { readonly __jsExpr: string }).__jsExpr));
    } catch {
      return "conditional";
    }
  }
  return Boolean(value);
}

/**
 * Kết hợp trạng thái disabled của nhóm cha với của chính hàng, đúng cách Loader đi qua nhóm sở hữu.
 * Nhận: outer — đóng góp đã kết hợp của tổ tiên; own — đóng góp của hàng.
 * Trả: trạng thái disabled hiệu dụng của hàng.
 */
export function combineDisabled(outer: boolean | "conditional", own: boolean | "conditional"): boolean | "conditional" {
  if (outer === true || own === true) return true;
  if (outer === "conditional" || own === "conditional") return "conditional";
  return false;
}

/**
 * Làm phẳng MỘT danh sách hàng đã parse thành các hàng plugin; hàng NHÓM là cấu trúc (con thừa kế
 * `disabled` của nó) nên chỉ con được phát.
 * Nhận: rows — hàng đã parse; outerDisabled — disabled đã kết hợp của nhóm cha; evaluateExpression —
 * evaluator cho `!!js`; found — mảng tích luỹ.
 * Trả: không (ghi vào `found`).
 */
export function flattenRows(
  rows: readonly EntryRow[],
  outerDisabled: boolean | "conditional",
  evaluateExpression: (source: string) => unknown,
  found: CompositionRow[],
): void {
  for (const row of rows) {
    const disabled = combineDisabled(outerDisabled, disabledContribution(row.disabled, evaluateExpression));
    if (row.group === true) {
      flattenRows(row.config ?? [], disabled, evaluateExpression, found);
      continue;
    }
    found.push({
      entryId: typeof row.id === "string" && row.id !== "" ? row.id : null,
      moduleName: row.name,
      enabled: disabled === true ? false : disabled === "conditional" ? "conditional" : true,
      ...(isJsExpr(row.disabled as never) ? { condition: (row.disabled as { readonly __jsExpr: string }).__jsExpr } : {}),
    });
  }
}

/**
 * Làm phẳng các plugin con đã khai để CHẨN ĐOÁN trước khi activate thành công.
 * Nhận: rows — hàng con đã parse; evaluateExpression — evaluator cho disabled.
 * Trả: danh sách hàng đã phẳng, hoặc chẩn đoán cấu hình.
 */
export function definitionComposition(
  rows: readonly EntryRow[],
  evaluateExpression: (source: string) => unknown,
): { readonly rows: CompositionRow[] } | { readonly broken: string } {
  const problem = entryListProblem(rows);
  if (problem !== undefined) return { broken: problem };
  const found: CompositionRow[] = [];
  flattenRows(rows, false, evaluateExpression, found);
  return { rows: found };
}

/**
 * Các hàng plugin của MỘT composition đang sống, theo thứ tự entry Loader.
 * Nhận: tree — cây của revision đang sống.
 * Trả: hàng kèm trạng thái bật do Loader đánh giá và trạng thái fiber.
 */
export function mountedCompositionRows(tree: MountedTree): CompositionRow[] {
  const found: CompositionRow[] = [];
  const owner = tree.ctx.fiber.entry;
  const prefix = owner === undefined ? "" : owner.id + ":";
  for (const entry of tree.entries()) {
    if (entry.options.group) continue;
    found.push({
      entryId: entry.id.slice(prefix.length),
      moduleName: entry.options.name,
      enabled: !entry.disabled,
      ...(isJsExpr(entry.options.disabled as never) ? { condition: (entry.options.disabled as { readonly __jsExpr: string }).__jsExpr } : {}),
      ...(entry.fiber === undefined ? {} : { fiberState: entry.fiber.state }),
    });
  }
  return found;
}
