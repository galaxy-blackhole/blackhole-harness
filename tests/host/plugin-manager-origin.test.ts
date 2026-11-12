/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test cho phép PHÂN LOẠI GỐC của plugin (`origin`) — 11/11/2026: đo được trang Plugins xếp gói lõi stock
 *      `@deepseek-ai/dsh-terminal` (phụ thuộc của CHÍNH bản cài DSH, KHÔNG khai `dsh.bundle`) vào nhóm
 *      "Plugin đã cài" kèm badge đỏ "Trục trặc". Test dựng hồ sơ TẠM với node_modules trỏ vào gói stock THẬT
 *      trong repo, rồi khẳng định: gói stock ⇒ KHÔNG vào nhóm người dùng; gói cài thật ⇒ vào nhóm người dùng;
 *      gói stock không bao giờ bị coi là "đang bật" như một lớp bundle.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bundleOrigin, isBundleEnabled } from "../../packages/host/plugin-manager/src/origin.ts";
import { bundleManifest } from "../../packages/host/plugin-manager/src/operations.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Bản cài DSH (kernel) — nguồn của mọi gói "đi kèm bản cài". */
const KERNEL = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Manifest của app DSH — `installAnchor` thật mà host dùng (xem profile-boot: INSTALL_ANCHOR). */
const ANCHOR = join(KERNEL, "dsh", "package.json");
/** Gói LÕI stock đã gây ra sự cố: seam terminal, KHÔNG khai `dsh.bundle`. */
const STOCK_TERMINAL = "@deepseek-ai/dsh-terminal";
/** Gói LÕI stock CÓ khai `dsh.bundle` (dùng để chứng minh nhánh "core" của phép phân loại). */
const STOCK_BASE = "@deepseek-ai/dsh-base";

/**
 * Dựng một hồ sơ tạm: `package.json` + `node_modules/<tên>` trỏ vào gói THẬT trong repo.
 * Nhận: `deps` — tên gói sẽ nằm trong `dependencies` của hồ sơ; `bundles` — tên nằm trong `dsh.profile.bundles`.
 * Trả: đường dẫn thư mục hồ sơ.
 */
function hoSoTam(deps: readonly string[], bundles: readonly string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "gbh-origin-"));
  const modules = join(dir, "node_modules", "@deepseek-ai");
  mkdirSync(modules, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "gbh-profile-test", private: true, dependencies: Object.fromEntries(deps.map((n) => [n, "0.2.1-alpha.4"])), dsh: { profile: { bundles: [...bundles] } } }, undefined, 2), "utf8");
  for (const name of new Set([...deps, ...bundles])) {
    const ngan = name.slice(name.indexOf("/") + 1);
    const nguon = join(KERNEL, ngan);
    if (existsSync(nguon)) symlinkSync(nguon, join(modules, ngan));
  }
  return dir;
}

describe("phân loại gốc plugin — gói lõi stock KHÔNG phải plugin người dùng", () => {
  test("gói stock đi kèm bản cài, không cài, không chọn ⇒ core", () => {
    expect(bundleOrigin({ shipped: true, installed: false, enabled: false })).toBe("core");
  });

  test("gói NGƯỜI DÙNG cài vào hồ sơ ⇒ user", () => {
    expect(bundleOrigin({ shipped: false, installed: true, enabled: true })).toBe("user");
    expect(bundleOrigin({ shipped: true, installed: true, enabled: false })).toBe("user");
  });

  test("gói được profile CHỌN (bundle bật) ⇒ user, kể cả khi bản cài cũng cấp nó", () => {
    expect(bundleOrigin({ shipped: true, installed: false, enabled: true })).toBe("user");
  });

  test("gói KHÔNG khai dsh.bundle không bao giờ là lớp bundle đang bật — dù khoá tên trùng", () => {
    // Đây đúng là lỗi 11/11/2026: `gbh-terminal-bundle` và `@deepseek-ai/dsh-terminal` cùng khoá "terminal",
    // nên phép so danh tính lớp nói "đang bật" cho một gói không mount được row nào ⇒ sinh dòng lỗi not-bundle.
    expect(isBundleEnabled(false, true)).toBe(false);
    expect(isBundleEnabled(true, true)).toBe(true);
    expect(isBundleEnabled(true, false)).toBe(false);
  });
  test("gói stock THẬT trong node_modules của hồ sơ: dsh-terminal KHÔNG phải bundle", () => {
    const dir = hoSoTam([], []);
    expect(bundleManifest(STOCK_TERMINAL, dir, ANCHOR)).toBeUndefined();
    const laBundle = bundleManifest(STOCK_TERMINAL, dir, ANCHOR) !== undefined;
    expect(isBundleEnabled(laBundle, true)).toBe(false);
    expect(bundleOrigin({ shipped: true, installed: false, enabled: isBundleEnabled(laBundle, true) })).toBe("core");
  });

  test("cùng hồ sơ: một bundle stock THẬT thì resolve được và bị xếp core", () => {
    const dir = hoSoTam([], []);
    const info = bundleManifest(STOCK_BASE, dir, ANCHOR);
    expect(info).toBeDefined();
    expect(bundleOrigin({ shipped: true, installed: false, enabled: false })).toBe("core");
  });

  test("gói NGƯỜI DÙNG cài thật trong hồ sơ ⇒ user, không phải core", () => {
    const dir = hoSoTam([STOCK_BASE], [STOCK_BASE]);
    expect(bundleManifest(STOCK_BASE, dir, ANCHOR)).toBeDefined();
    expect(bundleOrigin({ shipped: true, installed: true, enabled: true })).toBe("user");
  });
});

describe("hợp đồng dữ liệu: mọi dòng listBundles đều mang cờ origin", () => {
  test("không có bundles.push nào thiếu origin", () => {
    const text = require("node:fs").readFileSync(join(REPO, "packages", "host", "plugin-manager", "src", "list-bundles.ts"), "utf8") as string;
    const pushes = text.split("bundles.push({").slice(1);
    expect(pushes.length).toBeGreaterThanOrEqual(4);
    for (const push of pushes) {
      const dong = push.slice(0, push.indexOf("});"));
      expect(dong).toContain("origin,");
    }
  });
});