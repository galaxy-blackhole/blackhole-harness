/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Thân của `pluginManager/listBundles` — tách khỏi manager.ts (11/11/2026) vì manager.ts đã ở 998/1000
 *      dòng và phép phân loại `origin` cần thêm chỗ. Mỗi dòng trả về mang cờ `origin` (`user` = plugin người
 *      dùng cài/chọn · `core` = thành phần lõi đi kèm bản cài DSH), và gói KHÔNG khai `dsh.bundle` không còn bị
 *      coi là "đang bật" ⇒ hết dòng lỗi `not-bundle` cho `@deepseek-ai/dsh-terminal`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  OFFICIAL_ON_DEMAND_CATALOG, OPTIONAL_BUNDLES, bundlePatchPaths, evaluatePluginCompatibility, getDshRuntimeVersion,
  readPluginMeta, readProfileManifest, readProfileVersionExemptions, resolveBundleDir,
} from "@deepseek-ai/dsh-app-boot";
import type { OfficialBundleCatalogEntry, ProfileContext, ProfileManifest } from "@deepseek-ai/dsh-app-boot";

import { ICON_BUNDLE_GBH, bundleMetaVi, traMetaVi } from "@galaxy-blackhole/gbh-host-bundle-labels";
import { KHONG_HO_TRO, laCungBundle, quyTen, quyTenBundle } from "./bundle-rename.ts";
import { BUNDLE_THU_NGHIEM_GBH, entryCatalogThuNghiem, laStockCoBanGbh } from "./catalog-thu-nghiem.ts";
import { ManagementFailure, incompatiblePlugin } from "./failure.ts";
import { dependencySpec } from "./install-spec.ts";
import { bundleSelection, managementError } from "./manager-support.ts";
import { metaBundle } from "./meta-bundle.ts";
import { officialBundleInstallTarget } from "./official-install-target.ts";
import { bundleManifest } from "./operations.ts";
import { bundleOrigin, isBundleEnabled } from "./origin.ts";
import type { BundleInfo, ManagementError, ReadOnlyReason } from "./types.ts";

/**
 * Bundle bị ẨN khỏi danh sách plugin. 22/10/2026: ẩn bundle badge-skill (artwork gốc còn thương hiệu DSH);
 * 25/10/2026: BỎ ẩn — kỹ năng đã đổi sang quy ước văn bản nên hiện lại trong "Plugin thử nghiệm". Giữ hằng để
 * lần sau cần ẩn lại.
 */
const AN_BADGE_SKILL: ReadonlySet<string> = new Set([]);

/** Phần mà thân `listBundles` cần từ service (bundle quản trị được bảo vệ + row của patch bundle). */
export interface ListBundlesDeps {
  /** Bundle này có chứa module quản trị (hoặc chính include của row này) không. */
  protectsManager(name: string): boolean;
  /** Rows + overrides mà patch của một bundle khai, ghép với các entry đang sống của Loader. */
  declaredRows(name: string, info: ProfileManifest): Pick<BundleInfo, "rows" | "overrides">;
}
/**
 * Đọc các bundle đã cài, do bản cài cấp, và mục danh mục Official offline, cộng các tên không-bundle đã chọn.
 * Một dependency không có bundle patch chỉ được liệt kê như vấn đề `not-bundle` khi nó đang được chọn.
 * Nhận: không. Trả: version package, description, spec cài được, row, metadata hiển thị, lựa chọn kích hoạt,
 * việc bản cài có cấp bundle không, và khả năng gỡ.
 */
export function listBundlesFor(profile: ProfileContext, deps: ListBundlesDeps): Promise<BundleInfo[]> {
  const manifest = readProfileManifest("dsh", profile.dir);
  const exemptions = readProfileVersionExemptions(profile.dir);
  const selected = bundleSelection(manifest);
  const recorded = manifest.dependencies ?? {};
  const dependencies = Object.keys(recorded);
  const installation = JSON.parse(readFileSync(profile.installAnchor, "utf8")) as { dependencies?: Record<string, string> };
  const catalog = new Map<string, OfficialBundleCatalogEntry>(
    OFFICIAL_ON_DEMAND_CATALOG.map((entry): [string, OfficialBundleCatalogEntry] => [entry.packageName, entry]),
  );
  // 10/11/2026 (dev-5, Lead đo r106): client vẽ thẻ từ `listBundles`; khi TẮT, tên bị xoá khỏi `selected` và không
  //   có ở 3 nguồn còn lại ⇒ vòng lặp không duyệt tới ⇒ bundle đang tắt KHÔNG có entry ⇒ thẻ biến mất. Nguồn thứ 5
  //   = hằng 12 bundle thử nghiệm (`bundle-labels`) ⇒ tắt vẫn còn entry với `enabled:false`.
  const names = [...new Set([...selected, ...dependencies, ...Object.keys(installation.dependencies ?? {}), ...catalog.keys(), ...BUNDLE_THU_NGHIEM_GBH])];
  // 08/11/2026 (dev-5, Lead chốt hướng (B) lớp 2 — response listBundles trả 34 bundle, nửa là bản STOCK trùng
  const coBanTa = (tenTa: string, ten: string): boolean => {
    // 08/11/2026 (Lead đo sau restart r44: `resolveBundleDir` trả undefined cho MỌI bundle của ta vì chúng nằm
    if (traMetaVi(tenTa) || traMetaVi(ten)) return true;
    try {
      const dir = resolveBundleDir("dsh", tenTa, profile.installAnchor, profile.dir);
      return dir !== undefined && existsSync(join(dir, "package.json"));
    } catch {
      return false;
    }
  };
  // 08/11/2026 (Lead — ĐO ĐƯỢC, thay cho cách dựa vào bảng đổi tên): bảng `DOI_TEN_BUNDLE` nằm TRONG artefact,
  const goiGbh = names.filter((t) => t.startsWith("@galaxy-blackhole/gbh-"));
  /** Bỏ hậu tố hình thức để so khoá tính năng: '-bundle' và '-profile'. */
  const gonKhoa = (ten: string): string => ten.replace(/^@[^/]+\//, "").replace(/-bundle$/, "").replace(/-profile$/, "");
  /** true khi hồ sơ có bundle GBH phủ cùng khoá tính năng với tên stock thử nghiệm. */
  const coBanGbhCung = (khoaStock: string): boolean =>
    goiGbh.some((g) => {
      const a = gonKhoa(khoaStock);
      const b = gonKhoa(g).replace(/^gbh-/, "");
      return a.length >= 4 && (a === b || a.includes(b) || b.includes(a));
    });
  // 08/11/2026 (Lead duyệt (b)): tập bundle GBH THỬ NGHIỆM = đúng 12 bản stock bị lọc dưới đây (quy tên).
  const tenThuNghiemGbh = new Set<string>();
  const hienThi = names.filter((ten) => {
    const laThuNghiemStock = ten.startsWith("@deepseek-ai/dsh-experimental-");
    if (!laThuNghiemStock) return true;
    const khoa = ten.slice("@deepseek-ai/dsh-experimental-".length);
    // 10/11/2026 (dev-5, Lead đo: công tắc trên UI gửi target = id STOCK): phép suy động `coBanGbhCung` RỖNG khi
    //   `names` không còn id stock ⇒ entry stock vẫn lọt ⇒ client render cặp đôi (GBH bật/VI + stock tắt/EN).
    //   Thêm phép kiểm bằng danh sách HẰNG `BUNDLE_THU_NGHIEM_GBH` (không suy động) ⇒ loại hẳn id stock.
    const bot = coBanGbhCung(khoa) || laStockCoBanGbh(ten);
    if (bot) tenThuNghiemGbh.add(quyTenBundle(ten));
    return !bot;
  });
  for (const entry of entryCatalogThuNghiem(names, tenThuNghiemGbh, (ten) => catalog.has(ten))) {
    catalog.set(entry.packageName, entry);
  }
  const bundles: BundleInfo[] = [];
  const runtimeVersion = getDshRuntimeVersion();
  for (const name of hienThi) {
    // 22/10/2026: ẩn bundle badge-skill (artwork gốc còn thương hiệu DSH) — xem AN_BADGE_SKILL.
    if (AN_BADGE_SKILL.has(name)) continue;
    // 25/10/2026: ẩn bundle chưa port (bật là lỗi not-bundle / cài từ npm là hỏng) — xem KHONG_HO_TRO.
    if (KHONG_HO_TRO.has(name)) continue;
    const installed = dependencies.includes(name);
    // 08/11/2026 (dev-5, Lead chốt cơ chế sau r76): GBH ship 12 bundle thử nghiệm **1:1 trong profile**, đánh dấu
    const optional = OPTIONAL_BUNDLES.includes(name) || BUNDLE_THU_NGHIEM_GBH.includes(name);
    // 25/10/2026 — hồ sơ của ta chọn bundle bằng TÊN ĐÃ QUY (`@galaxy-blackhole/gbh-…`), còn danh mục
    const tenQuy = quyTenBundle(name);
    // 10/11/2026 (dev-6): so theo DANH TÍNH lớp bundle — hồ sơ có thể khai tên của ta trong khi công tắc
    //   gửi id stock (và ngược lại). So chuỗi thô làm công tắc hiện SAI vị trí: thẻ GBH báo TẮT trong khi
    //   row vẫn mount vì lớp đang được khai bằng cách viết kia (đo thật: setBundleEnabled nhận id stock).
    // 11/11/2026 (Lead đo: trang Plugins gắn badge đỏ cho `@deepseek-ai/dsh-terminal`): `enabled` CHỈ có nghĩa
    //   với gói thật sự khai `dsh.bundle`. Gói lõi không khai bundle mà vẫn bị phép so KHOÁ TÍNH NĂNG coi là
    //   "đang bật" (`gbh-terminal-bundle` và `dsh-terminal` cùng khoá "terminal") ⇒ sinh dòng lỗi
    //   `not-bundle` cho một gói không mount được row nào. Đọc manifest MỘT lần ở đây rồi dùng lại bên dưới.
    const shipped = Object.hasOwn(installation.dependencies ?? {}, name);
    let info: ProfileManifest | undefined;
  let infoError: unknown;
  try {
    info = bundleManifest(name, profile.dir, profile.installAnchor);
  } catch (error) {
    // Không resolve được gói: coi như KHÔNG phải bundle ở đây, nhưng nhớ lỗi để nhánh dưới báo đúng chẩn đoán.
    infoError = error;
  }
    const enabled = isBundleEnabled(info !== undefined, selected.some((viet) => laCungBundle(viet, name)));
    const origin = bundleOrigin({ shipped, installed, enabled });
    const offered = catalog.get(name);
    const official = optional || offered !== undefined;
    let target: Pick<BundleInfo, "installTarget"> = {};
    let targetError: ManagementError | undefined;
    if (offered !== undefined) {
      try {
        target = { installTarget: officialBundleInstallTarget(name, profile.installAnchor, runtimeVersion) };
      } catch (error) {
        targetError = managementError(error);
      }
    }
    const chuTaCatalog = bundleMetaVi(name);
    const catalogMeta: Pick<BundleInfo, "meta"> = chuTaCatalog === undefined ? (offered === undefined ? {} : { meta: offered.meta }) : { meta: chuTaCatalog };
    if (offered !== undefined && !installed && !shipped) {
      bundles.push({ name: quyTenBundle(name), official, availability: "missing", ...catalogMeta, ...target, origin, enabled, installed, optional,
        removable: enabled, rows: [], overrides: [],
        ...(targetError !== undefined ? { error: targetError } : enabled ? { error: { code: "not-bundle" } as ManagementError } : {}) });
      continue;
    }
    // Installation-owned copies remain protected even if a profile also declares their names.
    const owned = installed && !shipped;
    const removable = owned || (enabled && !installed && !shipped);
    const sourceOf = (packageName?: string): Pick<BundleInfo, "source"> =>
      owned ? { source: dependencySpec(name, recorded[name]!, profile.dir, packageName) } : {};
    const readOnlyReason: ReadOnlyReason | undefined = deps.protectsManager(name) ? "management-required" : undefined;
    let availability: BundleInfo["availability"] = "missing";
    let version: string | undefined;
    try {
      if (infoError !== undefined) throw infoError;
      availability = shipped ? "installation" : "profile";
      if (info === undefined) {
        // 11/11/2026: gói KHÔNG khai `dsh.bundle` chỉ lên trang khi CHÍNH PROFILE khai nó (lỗi cấu hình thật của
        //   người dùng) hoặc khi nó là mục danh mục. Gói lõi đi kèm bản cài thì im lặng — nó không phải plugin.
        if (installed || offered !== undefined)
          bundles.push({ name: quyTenBundle(name), official, availability, ...metaBundle(name, quyTen(name), catalogMeta), ...target, ...sourceOf(), origin, enabled, installed, optional,
            removable: removable && readOnlyReason === undefined, ...(readOnlyReason === undefined ? {} : { readOnlyReason }),
            error: targetError ?? { code: "not-bundle" } as ManagementError, rows: [], overrides: [] });
        continue;
      }
      version = info.version;
      const compatibility = evaluatePluginCompatibility(info, exemptions);
      if (compatibility !== undefined && !compatibility.exempted)
        throw new ManagementFailure("incompatible-version", [incompatiblePlugin(compatibility)]);
      const dir = resolveBundleDir("dsh", name, profile.installAnchor, profile.dir);
      // 22/10/2026: Host chỉ đọc meta bundle từ bản cài (kernel, en/zh) ⇒ ưu tiên bảng chữ tiếng Việt
      // của ta để trang Plugins hiện tiếng Việt mà không phải sửa gói stock nào.
      const chuTa = bundleMetaVi(name, info.name);
      const meta = chuTa ?? offered?.meta ?? readPluginMeta(info.name ?? name, pathToFileURL(join(dir, "package.json")).href);
      bundles.push({ name: quyTenBundle(name), official, availability, ...target, ...(version === undefined ? {} : { version }),
        ...(chuTa === undefined ? (info.description === undefined || info.description === "" ? {} : { description: info.description }) : { description: chuTa.description }),
        ...(meta === undefined ? {} : { meta }), ...sourceOf(info.name), origin, enabled, installed, optional,
        removable: removable && readOnlyReason === undefined, ...(readOnlyReason === undefined ? {} : { readOnlyReason }),
        ...deps.declaredRows(name, info), ...(targetError === undefined ? {} : { error: targetError }) });
    } catch (error) {
      if (enabled || installed || optional || offered !== undefined)
        bundles.push({ name: quyTenBundle(name), official, availability, ...metaBundle(name, quyTen(name), catalogMeta), ...target, ...(version === undefined ? {} : { version }),
          ...sourceOf(), origin, enabled, installed, optional, removable: removable && readOnlyReason === undefined,
          ...(readOnlyReason === undefined ? {} : { readOnlyReason }), error: targetError ?? managementError(error),
          rows: [], overrides: [] });
    }
  }
  // 08/11/2026 (dev-5, Lead chốt hướng (B), bằng chứng: response `pluginManager/listBundles` còn
  return Promise.resolve(bundles.map((bundle): BundleInfo => {
    const chuTa = bundleMetaVi(bundle.name, quyTen(bundle.name));
    if (chuTa === undefined) return bundle;
    return {
      ...bundle,
      description: chuTa.description,
      meta: {
        ...(bundle.meta ?? {}),
        title: chuTa.title,
        description: chuTa.description,
        // 10/11/2026 (dev-5, Lead chỉ đúng chỗ sai): client đọc `pkg.meta.icon` (ui-plugin-manager/lib/client.js:2857)
        // nên icon PHẢI nằm TRONG `meta`, không phải top-level. Áp ở điểm DUY NHẤT này để mọi nhánh đều có.
        ...(ICON_BUNDLE_GBH[bundle.name] === undefined ? {} : { icon: ICON_BUNDLE_GBH[bundle.name] }),
        // 08/11/2026 (dev-5, Lead duyệt (b)): dấu để client xếp bundle GBH vào mục "Plugin thử nghiệm" —
        // client stock khoá theo TIỀN TỐ TÊN (ui-plugin-manager/lib/client.js packageText) nên bundle ta
        // (gbh-terminal-bundle…) rơi vào danh sách chính. Kèm deviation §2.
        ...(tenThuNghiemGbh.has(bundle.name) ? { category: "experimental" } : {}),
      },
    };
  }));
}
