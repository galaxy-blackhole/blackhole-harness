/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phép thu thập DANH TÍNH gói cho MỘT request: entry đang hoạt động của cây Loader + module
 *      trong bố cục preset của agent gọi request, khử trùng theo (tên, phiên bản) rồi sắp xếp
 *      TẤT ĐỊNH theo mã ký tự (không phụ thuộc ICU/locale của host, như bản gốc).
 */

import { brandString } from "./brand.ts";
import type { PackageIdentityResolver } from "./identity.ts";
import type {
  ActiveEntry,
  AgentPresets,
  DeepSeekPluginPackageIdentity,
  LoaderTree,
  PluginPackageInventoryContext,
} from "./types.ts";

/**
 * Liệt kê entry ĐANG HOẠT ĐỘNG của một cây Loader.
 * Nhận: cây Loader (`ctx.loader`).
 * Trả: mảng entry đã rút về `{ moduleName, baseUrl? }` — bỏ entry NHÓM, entry bị TẮT, và entry
 *      có fiber KHÔNG ở trạng thái ACTIVE (số 2, như bản gốc).
 * @param tree - cây Loader cần đọc.
 * @returns danh sách entry đang hoạt động.
 */
export function activeEntries(tree: LoaderTree): ActiveEntry[] {
  return [...tree.entries()]
    .filter((entry) => !entry.options.group && !entry.disabled && entry.fiber?.state === 2)
    .map((entry) => ({
      moduleName: entry.options.name,
      ...(entry.parent.tree.ctx.baseUrl === undefined ? {} : { baseUrl: entry.parent.tree.ctx.baseUrl }),
    }));
}

/**
 * So sánh hai chuỗi theo MÃ KÝ TỰ, độc lập dữ liệu ICU và locale của host.
 * Nhận: hai chuỗi cần so.
 * Trả: -1 / 0 / 1 — đúng thứ tự mà bản gốc dùng cho dây (`<` và `>`), KHÔNG phải `localeCompare`.
 * @param left - chuỗi thứ nhất.
 * @param right - chuỗi thứ hai.
 * @returns số âm, 0, hoặc số dương.
 */
export function compareWireText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Thu thập danh tính các gói đang hoạt động cho MỘT request.
 * Nhận: context plugin · bộ phân giải của lần cài này · base URL host · sổ "đã cảnh báo" của lần
 * cài này · id phiên của request (có thể vắng).
 * Trả: mảng danh tính đã khử trùng theo `(name, version)` và SẮP XẾP theo (tên, phiên bản).
 * Mỗi module KHÔNG ĐỌC ĐƯỢC chỉ cảnh báo MỘT lần cho cả vòng đời lần cài (sổ `unreadable`).
 * @param ctx - context plugin.
 * @param resolver - bộ phân giải danh tính.
 * @param hostBaseUrl - base URL của host, dùng cho module đánh dấu `useHostBase`.
 * @param unreadable - sổ tên module đã cảnh báo.
 * @param sessionId - id phiên của request, hoặc undefined.
 * @returns danh tính các gói đang hoạt động.
 */
export function collectActivePluginPackages(
  ctx: PluginPackageInventoryContext,
  resolver: PackageIdentityResolver,
  hostBaseUrl: string,
  unreadable: Set<string>,
  sessionId: string | undefined,
): DeepSeekPluginPackageIdentity[] {
  const entries = activeEntries(ctx.loader);
  const presets = ctx.get("agentPresets") as AgentPresets | undefined;
  if (sessionId !== undefined && presets !== undefined) {
    const agent = ctx.agents.get(brandString(sessionId));
    if (agent !== undefined) {
      for (const composition of presets.inspectCompositions(agent.ctx)) {
        entries.push(
          ...composition.modules.map((module) => {
            const { useHostBase, ...entry } = module;
            return {
              ...entry,
              ...(useHostBase ? { bareBaseUrl: hostBaseUrl } : {}),
            } as unknown as ActiveEntry;
          }),
        );
      }
    }
  }
  const unique = new Map<string, DeepSeekPluginPackageIdentity>();
  for (const activeEntry of entries) {
    let identity: DeepSeekPluginPackageIdentity | undefined;
    try {
      identity = resolver.resolve(activeEntry);
    } catch (error) {
      if (!unreadable.has(activeEntry.moduleName)) {
        unreadable.add(activeEntry.moduleName);
        ctx.logger.warn(
          "plugin-package-inventory-deepseek: omitting unreadable package identity for %s: %o",
          activeEntry.moduleName,
          error,
        );
      }
      continue;
    }
    if (identity === undefined) continue;
    unique.set(`${identity.name}\u0000${identity.version ?? ""}`, identity);
  }
  return [...unique.values()].sort(
    (left, right) =>
      compareWireText(left.name, right.name) || compareWireText(left.version ?? "", right.version ?? ""),
  );
}
