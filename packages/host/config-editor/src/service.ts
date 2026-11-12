/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026 — sửa gốc "ghi cấu hình bị từ chối": dùng `hmr.applyPatches` (đường SỐNG, lấy
 *   entry Include từ loader) trước, chỉ rơi về `reconcileProfilePatches` của kernel khi hồ sơ không có hmr
 *   hoặc hmr không có bề mặt đó. Lý do: kernel tra WeakMap `bootstrapIncludes` khoá theo ctx lúc boot ⇒
 *   hồ sơ compose bằng bundle patch của ta luôn trượt ⇒ mọi `settings/mutate` bị `settings/rejected`
 *   ("dsh: profile reload requires the root Include entry"). Đo thật 11/11/2026 trên app 5439.
 * desc Dịch vụ `ctx.configEditor`: đọc cấu hình thừa kế + ghi đè của profile, và ghi config THÔ đầy đủ
 *      của một plugin vào tệp patch rồi đối soát qua đúng đường Loader — bản viết lại của
 *      @deepseek-ai/dsh-config-editor.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Service, resolveConfig } from "@deepseek-ai/cordis";
import type { Context, Plugin } from "@deepseek-ai/cordis";
import type { Entry, EntryOptions } from "@deepseek-ai/cordis-plugin-loader";
import {
  composeEntries,
  loadProfileDirectory,
  readProfilePatches,
  reconcileProfilePatches,
} from "@deepseek-ai/dsh-app-boot";
import type { Profile } from "@deepseek-ai/dsh-app-boot";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import {
  EMPTY_PATCH_LIST,
  PATCH_FILE_MODE,
  flatten,
  parsePatchDocument,
  patchListOf,
  restoreJsExpressions,
  writeConfigRow,
} from "./patch.ts";
import type { ConfigChange, HmrSeam } from "./types.ts";

/** Tên dịch vụ mà kernel cấp cho row này (giữ NGUYÊN VĂN để gói khác gọi `ctx.get("configEditor")`). */
const SERVICE_NAME = "configEditor";

/** Chỉ số trạng thái fiber ACTIVE của cordis (`FiberState.ACTIVE`). */
const FIBER_ACTIVE = 2;

/**
 * Đọc seam HMR của kernel, nếu có — dò BA ctx như `plugin-manager` làm (11/11/2026).
 *
 * VÌ SAO BA ĐƯỜNG: ctx của một row có thể là ctx CON của cây include ⇒ `ctx.get("hmr")` trượt dù dịch vụ
 * có thật; `plugin-manager` đã phải dò `ownerContext` → `ownerContext.root` → `this.ctx.root` mới thấy
 * (ghi ở manager.ts hmrService). Trượt seam ⇒ lượt ghi rơi về kernel `reconcileProfilePatches` và chết ở
 * WeakMap `bootstrapIncludes` (đúng lỗi đang sửa).
 * @param ctx - context sở hữu dịch vụ.
 * @returns seam HMR, hoặc `undefined` khi không ctx nào cấp seam đó.
 */
function hmrSeamOf(ctx: Context): HmrSeam | undefined {
  const candidates: unknown[] = [ctx, (ctx as unknown as { root?: unknown }).root];
  for (const candidate of candidates) {
    const scope = candidate as { get?: (name: string) => unknown } | undefined;
    if (scope === undefined || typeof scope.get !== "function") continue;
    try {
      const seam = scope.get("hmr") as HmrSeam | undefined;
      if (seam !== undefined) return seam;
    } catch {
      // ctx chưa inject dịch vụ ⇒ thử đường kế tiếp, không làm chết lượt ghi.
    }
  }
  return undefined;
}

/**
 * Áp một danh sách patch của profile vào cây ĐANG CHẠY — chọn đường SỐNG trước, kernel sau.
 *
 * VÌ SAO (11/11/2026 — đo thật trên app 5439): `settings/mutate` cho namespace `ui-settings` bị Host từ chối
 * `settings/rejected: dsh: profile reload requires the root Include entry` ⇒ công tắc "Công cụ lập trình"
 * (và MỌI công tắc trong Cài đặt) không lưu được. Nguyên nhân: `reconcileProfilePatches` của kernel tra
 * WeakMap `bootstrapIncludes` khoá theo ctx LÚC BOOT; hồ sơ của ta compose bằng bundle patch nên ctx mà
 * plugin nhìn thấy không khớp ⇒ ném ngay dòng đầu (trước khi chạm tệp, nên không có tác dụng phụ).
 * Đường đúng đã đóng ở VÒNG 60 cho công tắc bundle: lấy entry Include từ loader rồi làm 3 bước cuối của
 * kernel — bề mặt đó là `hmr.applyPatches`. Không có hmr (hồ sơ tối giản, test) ⇒ giữ NGUYÊN đường kernel.
 * Hàm ĐỨNG NGOÀI lớp (không phải method): bề mặt prototype của `ConfigEditor` phải khớp bản gốc từng tên.
 * @param ownerContext - context của dịch vụ (mang `root` để rơi về đường kernel).
 * @param patches - danh sách patch đầy đủ của lượt này.
 * @param requiredIds - id entry mà trạng thái inactive sau lượt áp là lỗi.
 * @param hmr - seam HMR đã đọc một lần cho cả lượt ghi (cùng thể hiện với `runExclusive`).
 * @returns hoàn tất sau khi Include nhận patch mới.
 */
async function reconcilePatches(
  ownerContext: Context,
  patches: ReturnType<typeof readProfilePatches>,
  requiredIds: readonly string[],
  hmr: HmrSeam | undefined,
): Promise<void> {
  if (hmr?.applyPatches !== undefined) {
    const applied = await hmr.applyPatches(patches, requiredIds);
    if (applied !== undefined) return;
  }
  await reconcileProfilePatches(ownerContext.root, patches, "dsh", requiredIds);
}

/** Sửa cấu hình do profile sở hữu, tuần tự hoá với vòng nạp lại nóng của Loader. */
export class ConfigEditor extends Service {
  /** Hai seam phải sẵn sàng trước khi dịch vụ được dùng. */
  static inject = ["loader", "profileContext"];

  /** Context sở hữu dịch vụ — nơi tra `loader`, `profileContext` và seam HMR. */
  private readonly ownerContext: Context;

  /**
   * Đăng ký dịch vụ `configEditor` trong context sở hữu.
   * @param ownerContext - context của chính plugin này.
   */
  constructor(ownerContext: Context) {
    super(ownerContext, SERVICE_NAME);
    this.ownerContext = ownerContext;
  }

  /** Tệp patch của profile mà dịch vụ này sửa. */
  get documentPath(): string {
    return this.ownerContext.profileContext.patchPath;
  }

  /**
   * Liệt kê các row cấu hình địa chỉ được của profile.
   * Row của Include lồng nhau có chủ sở hữu cấu hình riêng, nên bị loại; id trùng cũng bị loại.
   * @returns các entry đang hoạt động có id patch DUY NHẤT.
   */
  entries(): Entry[] {
    const candidates = [...this.ownerContext.loader.entries()].filter(
      (entry) => entry.parent.tree.ctx.fiber.entry?.id === "include",
    );
    const counts = new Map<string, number>();
    for (const entry of candidates) counts.set(entry.options.id, (counts.get(entry.options.id) ?? 0) + 1);
    return candidates.filter((entry) => counts.get(entry.options.id) === 1);
  }

  /**
   * Đọc giá trị thừa kế và giá trị ghi đè tường minh của các entry đang hoạt động.
   * @returns từng entry kèm hai lớp giá trị đã tách rời khỏi tài liệu gốc.
   */
  configuration(): Array<{ entry: Entry; inherited: Record<string, unknown>; override: Record<string, unknown> }> {
    const profile = this.ownerContext.profileContext;
    const loaded = loadProfileDirectory("dsh", profile.dir, profile.installAnchor);
    const entries = this.entries();
    const overridden = new Set(
      loaded.patches
        .filter((patch) => patch.insert === undefined && Object.hasOwn(patch, "config"))
        .map((patch) => patch.id),
    );
    const composed = new Map<string, EntryOptions>();
    if (entries.some((entry) => !overridden.has(entry.options.id))) {
      for (const row of flatten(composeEntries([...loaded.layers.map((layer) => layer.patches), loaded.patches]))) {
        if (!composed.has(row.id)) composed.set(row.id, row);
      }
    }
    return entries.map((entry) => ({
      entry,
      inherited: overridden.has(entry.options.id)
        ? this.inherited(entry, loaded)
        : structuredClone(composed.get(entry.options.id)?.config ?? {}),
      override: structuredClone(
        loaded.patches.findLast((row) => row.id === entry.options.id && row.config !== undefined)?.config ?? {},
      ),
    }));
  }

  /**
   * Đọc lớp giá trị thừa kế của một entry: bỏ mọi ghi đè config của chính row đó rồi soạn lại các lớp còn lại.
   * @param entry - entry cần đọc lớp thừa kế.
   * @param loaded - profile đã nạp (các lớp bundle + lớp người dùng).
   * @returns config thừa kế, đã tách rời khỏi tài liệu.
   */
  private inherited(entry: Entry, loaded: Profile): Record<string, unknown> {
    const patches = loaded.patches.map((patch) => {
      if (patch.id !== entry.options.id || patch.insert !== undefined) return patch;
      const rest = { ...patch };
      Reflect.deleteProperty(rest, "config");
      return rest;
    });
    const row = flatten(composeEntries([...loaded.layers.map((layer) => layer.patches), patches])).find(
      (candidate) => candidate.id === entry.options.id,
    );
    return structuredClone(row?.config ?? {});
  }

  /**
   * Kiểm, ghi bền, rồi đối soát cấu hình kế tiếp của một plugin; các trường thường giữ luật vòng đời bình thường.
   * @param entry - entry Loader hiện tại; cũng dùng để phát hiện entry bị thay trong lúc ghi.
   * @param change - phép suy ra config THÔ từ entry hiện tại và lớp thừa kế của nó.
   * @returns hoàn tất sau khi Loader đối soát xong.
   */
  async edit(entry: Entry, change: ConfigChange): Promise<void> {
    // Đọc seam MỘT lần: lượt ghi và lượt áp patch phải dùng CÙNG một dịch vụ hmr (runExclusive ↔ applyPatches).
    const hmr = hmrSeamOf(this.ownerContext);
    const run = async (): Promise<void> => {
      const path = this.documentPath;
      await withFileLock(join(this.ownerContext.profileContext.dir, "package.json"), async () => {
        if (!this.entries().includes(entry) || entry.fiber === undefined) {
          throw new Error("Configuration entry is no longer available");
        }
        const beforePatches = readProfilePatches("dsh", this.ownerContext.profileContext);
        await reconcilePatches(this.ownerContext, beforePatches, [], hmr);
        if (!this.entries().includes(entry)) throw new Error("Configuration entry changed during reload");
        const profile = this.ownerContext.profileContext;
        const current = structuredClone(entry.options.config ?? {}) as Record<string, unknown>;
        const inherited = this.inherited(entry, loadProfileDirectory("dsh", profile.dir, profile.installAnchor));
        const next = change(current, inherited);
        const fiber = entry.fiber;
        if (fiber.state !== FIBER_ACTIVE) throw new Error("Configuration plugin is no longer active");
        const resolved = fiber.ctx.waterfall(fiber, "internal/config", next, () => next);
        resolveConfig(fiber.runtime as Plugin.Runtime, resolved);
        let before: string;
        try {
          before = await readFile(path, "utf8");
        } catch (error) {
          if ((error as { code?: string }).code !== "ENOENT") throw error;
          before = EMPTY_PATCH_LIST;
        }
        const patch = parsePatchDocument(before);
        writeConfigRow(patch, { id: entry.options.id, name: entry.options.name }, next, inherited);
        restoreJsExpressions(patch.document);
        const patches = readProfilePatches("dsh", profile, {
          ...loadProfileDirectory("dsh", profile.dir, profile.installAnchor),
          patches: patchListOf(patch.document),
        });
        const landed = flatten(composeEntries([patches])).find((row) => row.id === entry.options.id)?.config ?? {};
        if (!isDeepStrictEqual(landed, next)) {
          throw new Error(`Configuration for "${entry.options.id}" is overridden by a home patch or command-line overlay`);
        }
        await writeFileAtomic(path, String(patch.document), { mode: PATCH_FILE_MODE });
        try {
          await reconcilePatches(this.ownerContext, patches, [entry.options.id], hmr);
        } catch (error) {
          await writeFileAtomic(path, before, { mode: PATCH_FILE_MODE });
          await reconcilePatches(this.ownerContext, beforePatches, [], hmr);
          throw error;
        }
      });
    };
    await (hmr === undefined ? run() : hmr.runExclusive(run));
  }
}
