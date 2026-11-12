/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc ĐỐI CHỨNG ÂM cho harness "dải peer": phép kiểm phải BẮT được từng kiểu lệch (dải khác stock ·
 *      dải không phủ bản kernel · thiếu tên trong peerDependencies), và phải ĐẠT với manifest đúng
 *      quy ước — kể cả gói GBH-ONLY (không có stock, dải theo quy ước chung của kernel).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { peerRangeProblems } from "./peer-range-harness.ts";

/** Các thư mục tạm đã tạo — dọn trong `afterAll`. */
const tempDirs: string[] = [];

/**
 * Dựng một thư mục gói GIẢ với manifest cho trước.
 * Nhận: label — nhãn ngắn trong tên thư mục; manifest — nội dung package.json.
 * Trả: đường dẫn thư mục gói.
 */
function fakePackage(label: string, manifest: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "gbh-peer-range-" + label + "-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest, null, 2));
  return dir;
}

/** Manifest nền của một gói CÓ stock (`dsh-storage-json` khai cordis `~4.0.5-alpha.2`). */
const WITH_STOCK = {
  name: "@galaxy-blackhole/gbh-fake",
  gbh: { peers: ["@deepseek-ai/cordis"], provenance: { stock: "@deepseek-ai/dsh-storage-json" } },
  peerDependencies: { "@deepseek-ai/cordis": "~4.0.5-alpha.2" },
};

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe("peerRangeProblems — ĐỐI CHỨNG ÂM trên manifest dựng tay", () => {
  test("manifest ĐÚNG quy ước (dải = stock, phủ kernel) ⇒ RỖNG", () => {
    expect(peerRangeProblems(fakePackage("ok", WITH_STOCK))).toEqual([]);
  });

  test("dải LỆCH stock ⇒ báo ĐÚNG tên peer + hai dải", () => {
    const dir = fakePackage("drift", {
      ...WITH_STOCK,
      // `^4.0.5` VẪN phủ bản kernel 4.0.5 nhưng KHÁC chuỗi dải stock (~4.0.5-alpha.2) ⇒ chỉ vi phạm parity.
      peerDependencies: { "@deepseek-ai/cordis": "^4.0.5" },
    });
    const problems = peerRangeProblems(dir);
    expect(problems).toContain("@deepseek-ai/cordis: dải ta khai ^4.0.5 ≠ dải stock ~4.0.5-alpha.2");
    // Dải lệch vẫn PHỦ bản kernel 4.0.5 ⇒ chỉ có ĐÚNG MỘT vi phạm (parity), không báo oan thêm.
    expect(problems).toHaveLength(1);
  });

  test("dải KHÔNG phủ bản kernel đang chạy ⇒ báo vi phạm semver (chặn drift rc.5)", () => {
    const dir = fakePackage("semver", {
      name: "@galaxy-blackhole/gbh-fake-gbh-only",
      gbh: { peers: ["@deepseek-ai/cordis"] },
      // Ghim ĐÚNG 4.0.4 ⇒ KHÔNG phủ bản kernel đang chạy 4.0.5.
      peerDependencies: { "@deepseek-ai/cordis": "4.0.4" },
    });
    const problems = peerRangeProblems(dir);
    expect(problems.some((problem) => problem.includes("KHÔNG phủ bản kernel 4.0.5"))).toBe(true);
  });

  test("THIẾU tên trong peerDependencies ⇒ báo đúng tên", () => {
    const dir = fakePackage("missing", { ...WITH_STOCK, peerDependencies: {} });
    expect(peerRangeProblems(dir)).toEqual(["@deepseek-ai/cordis: thiếu trong peerDependencies"]);
  });

  test("gói GBH-ONLY (không stock) — dải theo quy ước kernel ⇒ ĐẠT; dải lạ ⇒ BỊ BẮT", () => {
    const inConvention = fakePackage("gbh-only-ok", {
      name: "@galaxy-blackhole/gbh-fake-gbh-only",
      gbh: { peers: ["@deepseek-ai/cordis"] },
      peerDependencies: { "@deepseek-ai/cordis": "~4.0.5-alpha.2" },
    });
    expect(peerRangeProblems(inConvention)).toEqual([]);
    const odd = fakePackage("gbh-only-odd", {
      name: "@galaxy-blackhole/gbh-fake-gbh-only",
      gbh: { peers: ["@deepseek-ai/cordis"] },
      peerDependencies: { "@deepseek-ai/cordis": "4.0.5-alpha.2" },
    });
    expect(peerRangeProblems(odd).some((problem) => problem.includes("không nằm trong quy ước kernel"))).toBe(true);
  });
});
