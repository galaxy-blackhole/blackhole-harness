/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test cổng brand-rename (task-146): đổi tên DSH→GBH phải ĐẢO NGƯỢC được chính xác (chỉ đổi tên, không đổi logic)
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { applyBrandRename, applyBrandRenameSafe, assertRenameOnly, BRAND_RENAMES, countBrandRenames, DIST_READ_NAMES, reverseBrandRename } from "../../packages/tools/brand-rename/src/index.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

describe("task-146 · brand rename DSH → GBH", () => {
  test("1 · đổi tên xuôi: __DSH_ → __GBH_ và --dsh-boot-bg → --gbh-boot-bg", () => {
    const goc = 'globalThis["__DSH_TRANSPORT__"]; style="--dsh-boot-bg:#fff"';
    const doi = applyBrandRename(goc);
    expect(doi).toBe('globalThis["__GBH_TRANSPORT__"]; style="--gbh-boot-bg:#fff"');
  });

  test("2 · cổng NGƯỢC: reverse(apply(x)) === x (chứng minh chỉ đổi tên)", () => {
    const goc = 'a=globalThis.__DSH_LOCALE__;b=globalThis["__DSH_BOOT__"];c="--dsh-boot-bg"';
    expect(reverseBrandRename(applyBrandRename(goc))).toBe(goc);
  });

  test("3 · đổi tên idempotent theo nghĩa: apply 2 lần === apply 1 lần", () => {
    const goc = 'globalThis["__DSH_BOOT__"]';
    const mot = applyBrandRename(goc);
    expect(applyBrandRename(mot)).toBe(mot);
  });

  test("4 · countBrandRenames đếm đúng số lần từng cặp", () => {
    const goc = '__DSH_A__ __DSH_B__ --dsh-boot-bg';
    const dem = countBrandRenames(goc);
    expect(dem.find((muc) => muc.from === "__DSH_")?.count).toBe(2);
    expect(dem.find((muc) => muc.from === "--dsh-")?.count).toBe(1);
  });

  test("5 · assertRenameOnly: artefact chỉ đổi tên thì ĐẠT (không ném)", () => {
    const goc = 'x=globalThis["__DSH_FILE_UPLOAD__"]';
    expect(() => assertRenameOnly(goc, applyBrandRename(goc))).not.toThrow();
  });

  test("6 · assertRenameOnly NÉM khi artefact bị đổi LOGIC (ngoài phần tên)", () => {
    const goc = 'x=globalThis["__DSH_FILE_UPLOAD__"]';
    const hong = 'x=globalThis["__GBH_FILE_UPLOAD__"];y=1';
    expect(() => assertRenameOnly(goc, hong)).toThrow();
  });

  test("7 · assertRenameOnly NÉM khi còn sót __DSH_", () => {
    const goc = 'a=globalThis["__DSH_X__"]';
    const hong = 'a=globalThis["__DSH_X__"]';
    expect(() => assertRenameOnly(goc, hong)).not.toThrow();
    expect(() => assertRenameOnly("z", '__DSH_con_sot')).toThrow();
  });

  test("8 · bản đồ chuẩn có đúng 2 cặp và phủ mọi tên DSH toàn cục", () => {
    expect(BRAND_RENAMES.length).toBe(2);
    const goc = '__DSH_ANYTHING__';
    expect(applyBrandRename(goc)).toBe("__GBH_ANYTHING__");
  });

  test("9 · áp lên bundle STOCK của locale rồi đảo ngược ⇒ khớp byte gốc (bằng chứng chỉ đổi tên)", () => {
    const path = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-locale", "lib", "client.js");
    const goc = readFileSync(path, "utf8");
    const doi = applyBrandRename(goc);
    expect(reverseBrandRename(doi)).toBe(goc);
    expect(doi.includes("__DSH_LOCALE__")).toBe(false);
    expect(doi.includes("__GBH_LOCALE__")).toBe(true);
  });

  test("10 · vỏ SPA dist (stock) đọc 4 tên __DSH_* ⇒ bước (c) phải rename ĐỒNG THỜI cả dist", () => {
    const path = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist", "assets");
    const files = ["index-CN7NIWNw.js"];
    const noiDung = files.map((name) => readFileSync(join(path, name), "utf8")).join(String.fromCharCode(10));
    for (const ten of ["__DSH_BOOT__", "__DSH_BOOT_READY__", "__DSH_TRANSPORT__", "__DSH_CODE_ICON_INSTANCE__"]) {
      expect(noiDung.includes(ten)).toBe(true);
    }
  });
});

describe("task-146 · cổng chất lượng bản đồ rename", () => {
  test("11 · CẤM rename sớm 4 tên mà vỏ SPA dist đang đọc (tới hết bước b)", () => {
    // Danh sách phải là NGUỒN SỰ THẬT duy nhất của 4 tên này.
    // 20/10/2026 — bước (c) đã rename ĐỒNG THỜI vỏ SPA dist + 3 gói transport ⇒ 4 tên NGUỒN SỰ THẬT
    // giờ mang tên GBH (Lead chốt: giữ nguyên 4 tên `__GBH_*` khi chuẩn hoá so byte).
    expect(DIST_READ_NAMES).toEqual([
      "__GBH_BOOT__",
      "__GBH_BOOT_READY__",
      "__GBH_TRANSPORT__",
      "__GBH_CODE_ICON_INSTANCE__",
    ]);
    for (const ten of DIST_READ_NAMES) {
      // Bản đồ THÔ sẽ đổi (đó là lý do phải có biến thể SAFE)…
      expect(applyBrandRename(ten)).toBe(ten.replace("__DSH_", "__GBH_"));
      // …nhưng biến thể SAFE phải GIỮ NGUYÊN cho tới bước (c).
      expect(applyBrandRenameSafe(ten)).toBe(ten);
    }
  });

  test("12 · applyBrandRenameSafe vẫn đổi các tên KHÔNG nằm trong danh sách cấm", () => {
    expect(applyBrandRenameSafe("__DSH_LOCALE__")).toBe("__GBH_LOCALE__");
    expect(applyBrandRenameSafe("--dsh-boot-bg")).toBe("--gbh-boot-bg");
  });

  test("13 · artefact THẬT của client/locale đã rename ở build (bước a): 0 __DSH_LOCALE__, 1 __GBH_LOCALE__", () => {
    const path = join(REPO, "packages", "client", "locale", "lib", "client.js");
    const code = readFileSync(path, "utf8");
    expect(code.includes("__DSH_LOCALE__")).toBe(false);
    expect(code.split("__GBH_LOCALE__").length - 1).toBe(1);
  });
});