/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Doc inventory plugin tu cay Loader + cac seam cua kernel (khong cache).
 */
import type { Context } from "@deepseek-ai/cordis";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BUNDLE_THU_NGHIEM_GBH, bundleMetaVi, ICON_BUNDLE_GBH } from "@galaxy-blackhole/gbh-host-bundle-labels";
import { fiberPhaseOf, pluginEntryId, type AgentPresetPluginGroup, type PluginInventoryEntry, type PluginInventorySnapshot, type PluginLocalizedMeta } from "./types.ts";

/** Mot entry cua cay Loader (chi khai phan ta dung — seam cua kernel). */
interface LoaderEntry {
  readonly id: string;
  readonly options: { readonly name: string; readonly group?: unknown };
  readonly disabled: boolean;
  readonly fiber?: { readonly state: unknown };
  readonly parent: { readonly tree: { readonly ctx: { readonly baseUrl?: string } } };
}

/** Seam loader cua kernel. */
interface LoaderLike { entries(): Iterable<LoaderEntry>; }

/** Seam pluginPackages cua kernel: metadata hien thi theo package. */
interface PluginPackagesLike { metaOf(name: string, baseUrl: string): PluginLocalizedMeta | undefined; }

/** Seam agentPresets cua kernel: roster preset khi deployment compose. */
interface AgentPresetsLike {
  compositionInventory(): Promise<readonly (Omit<AgentPresetPluginGroup, "rows"> & {
    readonly rows: readonly (Omit<AgentPresetPluginRowShape, "fiberPhase"> & { readonly fiberState?: unknown })[];
  })[]>;
}

/** Hinh dang row composition truoc khi doi fiberState thanh fiberPhase. */
interface AgentPresetPluginRowShape {
  readonly entryId: string | null;
  readonly moduleName: string;
  readonly enabled: boolean | "conditional";
  readonly condition?: string;
}

/**
 * Doc inventory hien tai truc tiep tu cay Loader (khong giu cache nao).
 *
 * Cordis da tu duy tri Entry.fiber va Fiber.state qua cac su kien plugin/status, nen mot cache thu hai chi them
 * mot nguon su that nua phai dong bo — dung nhu upstream.
 * @param ctx - context co seam loader (+ tuy chon pluginPackages / agentPresets / pluginManager).
 * @returns anh chup inventory, kem metadata hien thi va composition tung preset khi co roster.
 */
export async function readPluginInventory(ctx: Context): Promise<PluginInventorySnapshot> {
  const loader = ctx.get("loader") as LoaderLike | undefined;
  const packages = ctx.get("pluginPackages") as PluginPackagesLike | undefined;
  const entries: PluginInventoryEntry[] = [];
  if (loader !== undefined) {
    for (const entry of loader.entries()) {
      if (entry.options.group !== undefined) continue;
      const baseUrl = entry.parent.tree.ctx.baseUrl;
      const meta = baseUrl === undefined ? undefined : packages?.metaOf(entry.options.name, baseUrl);
      entries.push({
        entryId: pluginEntryId(entry.id),
        moduleName: entry.options.name,
        enabled: !entry.disabled,
        fiberPhase: entry.fiber === undefined ? null : fiberPhaseOf(entry.fiber.state),
        ...(meta === undefined ? {} : { meta }),
      });
    }
  }
  // 10/11/2026 (dev-5, Lead duyệt P2 + lỗi chủ dự án "tắt plugin ⇒ thẻ mất khỏi danh sách"): bản gốc CHỈ đọc
  //   loader.entries() nên bundle ĐANG TẮT (không mount) không có thẻ. Bù entry cho bundle đã khai trong
  //   `dsh.profile.bundles` mà KHÔNG có row đang mount, để client giữ thẻ với công tắc OFF.
  //   meta lấy từ gói dùng chung `@galaxy-blackhole/gbh-host-bundle-labels` (nhãn tiếng Việt + icon THẬT);
  //   kernel `pluginPackages.metaOf` không có icon của ta nên client phải render glyph mặc định.
  //   Đây là sai khác CÓ CHỦ ĐÍCH so với stock (stock không bù entry) — đã ghi vào GBH-SAI-KHAC-CO-CHU-DICH.md.
  const profileContext = ctx.get("profileContext") as { readonly dir?: string } | undefined;
  if (profileContext?.dir !== undefined) {
    try {
      const manifest = JSON.parse(readFileSync(join(profileContext.dir, "package.json"), "utf8")) as {
        dsh?: { profile?: { bundles?: readonly string[] } };
      };
      const trongHoSo = new Set(manifest.dsh?.profile?.bundles ?? []);
      // 10/11/2026 (dev-5, Lead đo r105: tắt 1 bundle ⇒ 5/5 thẻ còn 4/5): khi TẮT, plugin-manager XOÁ tên khỏi
      //   `dsh.profile.bundles` (giống stock `dsh-plugin-manager/lib/index.js:2295`) ⇒ đọc riêng profile thì chính
      //   bundle vừa tắt không còn tên ⇒ không bù được entry ⇒ mất thẻ. Nguồn bù = HẰNG 12 tên ∪ profile;
      //   `enabled` = tên có trong profile (còn trong profile ⇒ đang bật).
      const nguon = [...new Set([...BUNDLE_THU_NGHIEM_GBH, ...trongHoSo])];
      const daCo = new Set(entries.map((entry) => entry.moduleName));
      for (const name of nguon) {
        if (daCo.has(name)) continue;
        const chuTa = bundleMetaVi(name);
        if (chuTa === undefined) continue;
        const icon = ICON_BUNDLE_GBH[name];
        entries.push({
          entryId: pluginEntryId(name),
          moduleName: name,
          enabled: trongHoSo.has(name),
          fiberPhase: null,
          meta: { title: chuTa.title, description: chuTa.description, ...(icon === undefined ? {} : { icon }) },
        });
      }
    } catch {
      // Hồ sơ chưa đọc được (lần boot đầu, quyền…) ⇒ giữ nguyên inventory từ loader, không làm hỏng trang Plugin.
    }
  }
  const management = ctx.get("pluginManager") === undefined ? {} : { managementAvailable: true };
  const presets = ctx.get("agentPresets") as AgentPresetsLike | undefined;
  if (presets === undefined) return { entries, ...management };
  const composition = await presets.compositionInventory();
  const baseUrl = (ctx as { baseUrl?: string }).baseUrl;
  return {
    entries,
    agentPresets: composition.map((preset) => ({
      ...preset,
      rows: preset.rows.map(({ fiberState, ...row }) => {
        const meta = baseUrl === undefined ? undefined : packages?.metaOf(row.moduleName, baseUrl);
        return {
          ...row,
          fiberPhase: fiberPhaseOf(fiberState),
          ...(meta === undefined ? {} : { meta }),
        };
      }),
    })),
    ...management,
  };
}
