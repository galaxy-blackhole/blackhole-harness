/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 09/11/2026
 * desc Ap danh sach patch cua profile vao entry Include dang chay: go cac row da bi bo khoi danh sach
 *      (chi qua group cha, khong ghi tep) roi cap nhat `patches` cho include — nhanh ma kernel
 *      `recompose()` dung, tach khoi service.ts vi file da cham tran 1000 dong.
 */
import type { Context } from "@deepseek-ai/cordis";
import { prepareProfilePatches } from "@deepseek-ai/dsh-app-boot";

/** Context kernel nhin qua goc do dong: `loader` (entries · await) va `logger` (cung kieu service dung). */
type KernelCtx = Record<string, any>;

/** Mot row Loader nhin qua goc do dong (chi doc id, parent va subtree). */
type LoaderRow = {
  options?: { id?: unknown; config?: { patches?: readonly unknown[] } };
  parent?: { tree?: unknown; remove?(id: string): unknown };
  subtree?: unknown;
};

/** Du lieu mot luot ap patch: context kernel, context chu ho so va danh sach patch DAY DU. */
export interface ApplyProfilePatchesOptions {
  /** Context kernel có `loader` (nguồn row) và `logger` — cùng kiểu động mà service đang dùng. */
  readonly ctx: KernelCtx;
  /** Context so huu co service `profileContext` — `prepareProfilePatches` can no de tinh row bi go. */
  readonly owner: Context;
  /** Danh sach patch DAY DU cua luot nay (bundle · profile · home · `--patch` overlay · telemetry). */
  readonly patches: readonly any[];
}

/** Chuẩn hoá id row: kernel đặt tiền tố `include:`/`group:` cho row lồng nhau. */
function normalizeId(id: string): string {
  return id.replace(/^(include|group):/, "");
}

/** Mọi id khai trong một danh sách patch, kể cả row nằm trong `insert`/`config` của group. */
function idsOf(patches: readonly unknown[]): Set<string> {
  const ids = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const row = node as { id?: unknown };
    if (typeof row.id === "string") ids.add(normalizeId(row.id));
    for (const value of Object.values(row)) walk(value);
  };
  walk(patches);
  return ids;
}

/**
 * Ap danh sách patch vào entry Include đang chạy: gỡ row mà danh sách CŨ đã compose nhưng danh sách
 * MỚI không còn, rồi cập nhật `patches` cho include và chờ Loader lặng.
 *
 * 09/11/2026 (bug "cordis.yml thành 1368 dòng"): hai điều kiện dưới đây là bắt buộc, không phải tối ưu.
 * (a) Chỉ gỡ row mà CHÍNH danh sách cũ đã compose và nằm trong CÂY INCLUDE — đúng như kernel
 *     `recompose` (app-boot part-05: `composed.has(id) && !listed.has(id)`). Hỏi "không có trong danh
 *     sách mới" là gỡ oan row do overlay `--patch` chèn và row do plugin tạo lúc chạy.
 * (b) Chỉ gỡ qua group cha (`EntryGroup.remove`). `ctx.loader.remove()` của kernel gỡ xong còn
 *     `entry.parent.tree.write()` (cordis-plugin-loader) ⇒ ghi CẢ CÂY đã compose vào leaf
 *     `cordis.yml` (materialize 1368 dòng, phá hợp đồng "leaf luôn là []").
 * @param options - context kernel, context chủ hồ sơ, và danh sách patch đầy đủ của lượt này.
 * @returns `{ warnings: [] }` sau khi include đã nhận patch mới, hoặc `undefined` khi không có entry
 *          Include để áp (người gọi rơi về `recomposeProfile` của kernel).
 * @throws Khi chuẩn bị patch hoặc `include.update` thất bại (người gọi bắt và giữ hành vi cũ).
 */
export async function applyProfilePatches(options: ApplyProfilePatchesOptions): Promise<{ warnings: string[] } | undefined> {
  const { ctx, owner, patches } = options;
  const includeEntry = [...ctx.loader.entries()].map((row) => row as LoaderRow).find((row) => row.options?.id === "include");
  const config = includeEntry?.options?.config as ({ path: string; patches?: readonly unknown[] } & Record<string, unknown>) | undefined;
  if (includeEntry === undefined || config === undefined || typeof (includeEntry as { update?: unknown }).update !== "function") return undefined;
  const parent = includeEntry.parent as { tree?: { ctx?: { baseUrl?: string } }; remove?(id: string): unknown } | undefined;
  const baseUrl = parent?.tree?.ctx?.baseUrl;
  if (typeof baseUrl !== "string") return undefined;
  const { patches: _cu, ...includeConfig } = config;
  const parentURL = new URL(".", new URL(config.path, baseUrl)).href;
  // 09/11/2026 P0 "tat bundle khong dung row": prepareProfilePatches() tra NGUYEN patches khi ctx
  // truyen vao KHONG co service 'profileContext' => entry.update nhan patches THO, include khong tinh
  // duoc row nao bi GO => row cua bundle da tat van chay. Vi vay phai truyen ctx CO profileContext.
  const prepared = prepareProfilePatches(owner, [...patches], parentURL, "dsh");
  const previous = idsOf(config.patches ?? []);
  const next = idsOf(prepared as readonly unknown[]);
  const includeTree = includeEntry.subtree;
  const dropped = [...ctx.loader.entries()].map((row) => row as LoaderRow).filter((row) => {
    const id = row.options?.id;
    if (typeof id !== "string" || id === "include") return false;
    if (includeTree === undefined || row.parent?.tree !== includeTree) return false;
    if (!previous.has(normalizeId(id))) return false;
    return !next.has(normalizeId(id));
  });
  let removed = 0;
  for (const row of dropped) {
    const id = String(row.options?.id ?? "");
    try {
      row.parent?.remove?.(id);
      removed += 1;
    } catch (error) {
      ctx.logger.warn("hmr: khong go duoc row %s: %s", id, String(error));
    }
  }
  if (removed > 0) await ctx.loader.await();
  await (includeEntry as unknown as { update(options: unknown): Promise<unknown> }).update({ config: { ...includeConfig, patches: prepared } });
  await ctx.loader.await();
  return { warnings: [] };
}
