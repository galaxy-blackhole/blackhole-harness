/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test cho nửa browser của trang Plugins: tách "thành phần LÕI" khỏi "Plugin đã cài" và bỏ badge đỏ cho
 *      gói lõi. Vì sao test đọc ARTEFACT: nửa browser đã de-bundle (task-203) nên `lib/client.js` mới là mã
 *      đang chạy — test TRÍCH đúng đoạn mã đó ra khỏi artefact rồi chạy, không kiểm bản sao nào khác.
 *      11/11/2026: sự cố "Plugin đã cài" liệt kê `@deepseek-ai/dsh-terminal` kèm badge đỏ "Trục trặc".
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { patchArtefact } from "../../packages/client/ui-plugin-manager/build.ts";
import { ARTEFACT_PATCHES } from "../../packages/client/ui-plugin-manager/src/artefact-patches.ts";

/** Gói của trang Plugins. */
const PKG = join(import.meta.dir, "..", "..", "packages", "client", "ui-plugin-manager");
/** Artefact nửa browser đang được mount. */
const ARTEFACT = join(PKG, "lib", "client.js");
/** Mã nguồn của artefact. */
const CODE = readFileSync(ARTEFACT, "utf8");

/**
 * Cắt một đoạn mã LIÊN TỤC khỏi artefact, từ dòng khớp `dau` tới hết dòng khớp `cuoi`.
 * Nhận: `dau`/`cuoi` — chuỗi nhận dạng dòng đầu và dòng cuối.
 * Trả: đoạn mã đã cắt (nguyên văn, giữ thụt lề).
 */
function cat(dau: string, cuoi: string): string {
  const lines = CODE.split("\n");
  const a = lines.findIndex((line) => line.includes(dau));
  if (a < 0) throw new Error("không thấy dòng đầu: " + dau);
  const b = lines.findIndex((line, i) => i > a && line.includes(cuoi));
  if (b < 0) throw new Error("không thấy dòng cuối: " + cuoi);
  return lines.slice(a, b + 1).join("\n");
}

/** Một gói như artefact nhìn thấy (`BundleInfo` đã thành view). */
interface Goi {
  name: string;
  official: boolean;
  installed: boolean;
  enabled: boolean;
  origin?: "user" | "core";
  error?: { code: string };
}

/** Tập gói dựng sẵn cho mỗi ca. */
const GOI_STOCK_LOI: Goi = { name: "@galaxy-blackhole/gbh-terminal", official: false, installed: false, enabled: true, origin: "core", error: { code: "not-bundle" } };
const GOI_NGUOI_DUNG: Goi = { name: "@deepseek-ai/dsh-subagent-codex", official: false, installed: true, enabled: true, origin: "user" };
const GOI_CORE_BUNDLE: Goi = { name: "@galaxy-blackhole/gbh-base", official: false, installed: false, enabled: false, origin: "core" };

/**
 * Chạy đoạn gom nhóm THẬT trong artefact trên một tập gói.
 * Nhận: `packages` — các gói. Trả: ba danh sách mà trang dùng để vẽ.
 */
function gomNhom(packages: readonly Goi[]): { mine: Goi[]; coreRows: Goi[]; listed: Goi[] } {
  const snippet = cat("const originOf = (pkg) =>", "const mine = listed.filter");
  const run = new Function("state", "BUILTIN_PROFILE_BUNDLES", snippet + "\nreturn { listed, mine, coreRows };") as (
    state: { packages: readonly Goi[] },
    builtin: ReadonlySet<string>,
  ) => { mine: Goi[]; coreRows: Goi[]; listed: Goi[] };
  return run({ packages }, new Set(["@deepseek-ai/dsh-web-app"]));
}

/**
 * Chạy `packageStatus` THẬT trong artefact.
 * Nhận: `pkg` — một gói. Trả: trạng thái thẻ mang.
 */
function trangThai(pkg: Goi): "problem" | "running" | "disabled" {
  const lines = CODE.split("\n");
  const dau = lines.findIndex((line) => line.includes("function packageStatus(pkg) {"));
  if (dau < 0) throw new Error("không thấy packageStatus trong artefact");
  const cuoi = lines.findIndex((line, i) => i > dau && line.trim() === "}");
  if (cuoi < 0) throw new Error("không thấy dấu đóng của packageStatus");
  const than = lines.slice(dau, cuoi + 1).join("\n");
  const status = new Function("return (" + than + ");")() as (p: Goi) => "problem" | "running" | "disabled";
  return status(pkg);
}

describe("nhóm \"Plugin đã cài\" chỉ chứa plugin NGƯỜI DÙNG", () => {
  test("gói lõi stock (origin core) KHÔNG vào nhóm người dùng, vào nhóm Thành phần lõi", () => {
    const { mine, coreRows } = gomNhom([GOI_STOCK_LOI, GOI_NGUOI_DUNG]);
    expect(mine.some((pkg) => pkg.name === GOI_STOCK_LOI.name)).toBe(false);
    expect(coreRows.some((pkg) => pkg.name === GOI_STOCK_LOI.name)).toBe(true);
    expect(coreRows.some((pkg) => pkg.name === GOI_NGUOI_DUNG.name)).toBe(false);
  });

  test("gói NGƯỜI DÙNG cài thật vẫn vào nhóm người dùng", () => {
    const { mine, coreRows } = gomNhom([GOI_STOCK_LOI, GOI_NGUOI_DUNG]);
    expect(mine.some((pkg) => pkg.name === GOI_NGUOI_DUNG.name)).toBe(true);
    expect(coreRows.some((pkg) => pkg.name === GOI_NGUOI_DUNG.name)).toBe(false);
  });

  test("Host cũ không trả cờ origin ⇒ giữ nguyên cách xếp (không mất thẻ)", () => {
    const cu: Goi = { name: "dsh-plugin-vi-du", official: false, installed: true, enabled: true };
    const { mine } = gomNhom([cu]);
    expect(mine.some((pkg) => pkg.name === cu.name)).toBe(true);
  });
});

describe("badge: thành phần lõi KHÔNG mang trạng thái trục trặc", () => {
  test("gói lõi có lỗi not-bundle vẫn KHÔNG phải problem", () => {
    expect(trangThai(GOI_STOCK_LOI)).not.toBe("problem");
  });

  test("gói NGƯỜI DÙNG có lỗi thì vẫn báo problem (không nuốt chẩn đoán thật)", () => {
    expect(trangThai({ ...GOI_NGUOI_DUNG, error: { code: "incompatible-version" } })).toBe("problem");
  });

  test("thẻ lõi mang nhãn trung tính `statusCore`, không phải `statusProblem`", () => {
    expect(CODE).toContain('pkg.origin === "core" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag');
    expect(CODE).toContain('children: resolveText({ en: "Core", zh: "核心", vi: "Lõi" })');
  });
});

describe("artefact: bảng vá và từ điển", () => {
  test("artefact đã ở trạng thái vá xong (áp lại là no-op)", () => {
    expect(patchArtefact(ARTEFACT)).toBe(0);
  });

  test("mọi phép vá đều đã có mặt trong artefact", () => {
    for (const [ten, , to] of ARTEFACT_PATCHES) expect(CODE.includes(to) ? ten : "THIEU " + ten).toBe(ten);
  });

  test("nhãn lõi đi qua resolveText — KHÔNG thêm khoá vào từ điển (cổng A/B đòi 221 khoá)", () => {
    const vi = JSON.parse(readFileSync(join(PKG, "locale", "vi-chrome.json"), "utf8")) as Record<string, string>;
    expect(Object.keys(vi).length).toBe(221);
    expect(vi.coreTitle).toBeUndefined();
    expect(CODE).toContain('vi: "Thành phần lõi"');
  });

  test("nhóm lõi được vẽ bằng renderGroup riêng", () => {
    expect(CODE).toContain('renderGroup("core", resolveText({ en: "Core components", zh: "核心组件", vi: "Thành phần lõi" }), coreRows.map(packageCard))');
  });
});