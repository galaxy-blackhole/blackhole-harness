/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cong N1-N4 (tools/check/no-dsh-assets.ts): luat bat dung ca that + trang thai repo hien tai
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkN1,
  checkN3,
  checkN4,
  DSH_BRAND_STRING,
  DSH_FAVICON_SHA256,
  DSH_WORDMARK_PREFIX,
  FISH_PATH_PREFIX,
  ICON_TOKEN_ALLOWLIST,
  REPO_ROOT,
  runNoDshAssets,
} from "../../tools/check/no-dsh-assets.ts";
import { GBH_LOGO_SOURCE_SHA256 } from "../../packages/client/ui-primitives/src/brand.ts";
import { brandNeutral, brandToGbh, GBH_BRAND, neutralDict, neutralOutcome, STOCK_BRAND } from "../lib/brand-neutral.ts";

/**
 * Dung mot cay gia de kiem luat (khong dung repo that).
 * Nhận: files — map đường dẫn tương đối -> nội dung.
 * Trả: gốc thư mục tạm (người gọi tự xoá).
 */
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "gbh-nodsh-"));
  for (const [rel, text] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, text, "utf8");
  }
  return root;
}

describe("N1 — asset thương hiệu DSH", () => {
  test("bắt fish logo và wordmark DSH trong phần ta sở hữu", () => {
    const root = fixture({
      "packages/client/x/src/a.ts": 'const FISH = "' + FISH_PATH_PREFIX + ' 1.4";',
      "packages/client/x/src/b.ts": 'const W = "' + DSH_WORDMARK_PREFIX + '";',
    });
    try {
      const findings = checkN1(root);
      expect(findings.map((finding) => finding.rule)).toEqual(["N1", "N1"]);
      expect(findings.map((finding) => finding.file).sort()).toEqual(["packages/client/x/src/a.ts", "packages/client/x/src/b.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("repo hiện tại: 0 phát hiện N1", () => {
    expect(checkN1()).toEqual([]);
  }, 30_000);
});

describe("N2 — chuỗi thương hiệu DSH", () => {
  test("có phát hiện khi locale còn chuỗi thương hiệu DSH", () => {
    const root = fixture({ "packages/client/x/src/locales.ts": 'export const en = { brand: "' + DSH_BRAND_STRING + '" };' });
    try {
      const findings = runNoDshAssets(root).findings.filter((finding) => finding.rule === "N2");
      expect(findings.length).toBe(1);
      expect(findings[0]?.detail).toContain("x1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("repo hiện tại: 0 file còn chuỗi thương hiệu DSH (trần ĐÃ HẠ 16 → 0 ngày 18/10/2026)", () => {
    // Lịch sử trần: 16 file lúc kiểm kê (system prompt 3 · web-runtime 1 · shell-env 2 · llm-deepseek-account 2 ·
    // subprocess 2 · ui-layout 2 · locales 6 gói) → task-17 dọn hết 18/10/2026 ⇒ trần = 0.
    // KHÔNG được nâng trần: chuỗi thương hiệu DSH quay lại là cổng ĐỎ.
    const findings = runNoDshAssets().findings.filter((finding) => finding.rule === "N2");
    const files = new Set(findings.map((finding) => finding.file));
    expect([...files]).toEqual([]);
  }, 30_000);
});

describe("N3 — icon chưa khai trong sổ GBH", () => {
  test("bắt tên icon lạ trong bundle client", () => {
    const root = fixture({ "packages/client/x/lib/client.js": "var a = require(\"react\"); var b = IconKhongCoTrongSo;" });
    try {
      const findings = checkN3(root);
      expect(findings.length).toBe(1);
      expect(findings[0]?.detail).toContain("IconKhongCoTrongSo");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("repo hiện tại: 0 phát hiện; allowlist là danh sách ĐÓNG có lý do", () => {
    expect(checkN3()).toEqual([]);
    expect(Object.keys(ICON_TOKEN_ALLOWLIST).sort()).toEqual(["IconActions", "IconCalendarOutlineRegular", "IconClose"]);
    for (const reason of Object.values(ICON_TOKEN_ALLOWLIST)) expect(reason.length).toBeGreaterThan(10);
  }, 30_000);
});

describe("N4 — asset thương hiệu GBH truy được về nguồn", () => {
  test("repo hiện tại: asset khớp sha256 nguồn, không có bản sao favicon DSH", () => {
    expect(checkN4()).toEqual([]);
  }, 30_000);

  test("bắt asset sai sha256 nguồn", () => {
    const root = fixture({ "packages/client/ui-primitives/assets/gbh-logo.svg": "<svg>khong-phai-logo</svg>" });
    try {
      const findings = checkN4(root);
      expect(findings.some((finding) => finding.rule === "N4")).toBe(true);
      expect(GBH_LOGO_SOURCE_SHA256).toHaveLength(64);
      expect(DSH_FAVICON_SHA256).toHaveLength(64);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("hàm chuẩn hoá thương hiệu (tests/lib/brand-neutral.ts) — không được che khác biệt thật", () => {
  test("brandNeutral/brandToGbh CHỈ đổi đúng tên thương hiệu, giữ nguyên phần còn lại", () => {
    expect(brandNeutral("x " + GBH_BRAND + " y")).toBe("x " + STOCK_BRAND + " y");
    expect(brandNeutral("khong co thuong hieu")).toBe("khong co thuong hieu");
    expect(brandNeutral(GBH_BRAND + " · " + GBH_BRAND)).toBe(STOCK_BRAND + " · " + STOCK_BRAND);
    expect(brandToGbh("z " + STOCK_BRAND + " w")).toBe("z " + GBH_BRAND + " w");
    expect(brandToGbh(brandNeutral("q " + GBH_BRAND + " r"))).toBe("q " + GBH_BRAND + " r");
    // Khác biệt KHÁC (chữ, số, khoảng trắng) phải lộ ra: đây là ca chống lạm dụng.
    expect(brandNeutral("x " + GBH_BRAND + " y")).not.toBe("x " + GBH_BRAND + " y");
    expect(brandNeutral("x " + GBH_BRAND + " z")).not.toBe("x " + STOCK_BRAND + " y");
  });

  test("neutralDict đệ quy mọi chuỗi, giữ nguyên cấu trúc và giá trị không phải chuỗi", () => {
    expect(neutralDict({ a: GBH_BRAND, b: ["x " + GBH_BRAND], c: 1, d: true, e: null })).toEqual({
      a: STOCK_BRAND,
      b: ["x " + STOCK_BRAND],
      c: 1,
      d: true,
      e: null,
    });
    expect(neutralDict("z " + GBH_BRAND + " w")).toBe("z " + STOCK_BRAND + " w");
  });

  test("neutralOutcome chỉ chuẩn hoá err.message, giữ nguyên mọi trường khác", () => {
    const result = { err: { code: "X", message: "a " + GBH_BRAND + " b", kernelClass: true } };
    expect(neutralOutcome(result)).toEqual({ err: { code: "X", message: "a " + STOCK_BRAND + " b", kernelClass: true } });
    expect(neutralOutcome({ ok: 7 })).toEqual({ ok: 7 });
    // Khác biệt thật trong message KHÔNG bị che: đổi một chữ mà vẫn khác sau chuẩn hoá.
    expect(neutralOutcome({ err: { message: "a " + GBH_BRAND + " c" } })).not.toEqual(neutralOutcome(result));
  });
});

describe("Tổng hợp", () => {
  test("CẢ BỐN LUẬT = 0 trên repo thật (N2 đã dọn xong ở task-17)", () => {
    const { status } = runNoDshAssets(REPO_ROOT);
    expect(status.N1).toBe(0);
    expect(status.N3).toBe(0);
    expect(status.N4).toBe(0);
    expect(status.N2).toBe(0);
  }, 60_000);
});
