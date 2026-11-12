/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Test bảng chữ tiếng Việt cho META bundle: phủ đủ bundle của ta + tra được theo tên stock,
 *      và trả undefined cho gói không có trong bảng (để Host rơi về meta gốc).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BUNDLE_META_VI, bundleMetaVi } from "../../packages/host/bundle-labels/src/index.ts";
import { DOI_TEN, quyTen } from "../../packages/host/plugin-manager/src/bundle-rename.ts";

describe("plugin-manager — meta bundle tiếng Việt", () => {
  test("bảng có tiêu đề và mô tả cho mọi mục, không rỗng", () => {
    const muc = Object.entries(BUNDLE_META_VI);
    expect(muc.length).toBeGreaterThanOrEqual(20);
    for (const [, chu] of muc) {
      expect(chu.title.length).toBeGreaterThan(0);
      expect(chu.description.length).toBeGreaterThan(0);
    }
  });

  test("tra được theo tên gói của ta và theo tên gói stock", () => {
    // 25/10/2026 (ADR 0022): kỹ năng đổi sang quy ước ghi công bằng văn bản nên tiêu đề đổi theo.
    expect(bundleMetaVi("@galaxy-blackhole/gbh-badge-skill-bundle")?.title).toBe("Ghi công Galaxy Blackhole");
    expect(bundleMetaVi("@deepseek-ai/dsh-experimental-badge-skill-bundle")?.title).toBe("Ghi công Galaxy Blackhole");
    expect(bundleMetaVi("khong-co-goi-nay")).toBeUndefined();
    expect(bundleMetaVi(undefined, "@deepseek-ai/dsh-experimental-ralph-bundle")?.title).toBe("Vòng lặp Ralph");
  });

  test("chữ trong bảng khớp locale/vi.json của gói bundle tương ứng", () => {
    const goc = join(import.meta.dir, "..", "..", "packages", "host", "bundle-badge-skill-bundle", "locale", "vi.json");
    const duLieu = JSON.parse(readFileSync(goc, "utf8")) as { meta: { title: string; description: string } };
    const chu = bundleMetaVi("@galaxy-blackhole/gbh-badge-skill-bundle");
    expect(chu?.title).toBe(duLieu.meta.title);
    expect(chu?.description).toBe(duLieu.meta.description);
  });
});

describe("plugin-manager — quy tên gói stock về tên gói ta", () => {
  test("bảng có đủ cặp và mọi giá trị đều là gói của ta", () => {
    const muc = Object.entries(DOI_TEN);
    expect(muc.length).toBeGreaterThanOrEqual(280);
    for (const [stock, ta] of muc) {
      expect(stock.startsWith("@deepseek-ai/")).toBe(true);
      expect(ta.startsWith("@galaxy-blackhole/gbh-")).toBe(true);
    }
  });

  test("quy tên gói và giữ subpath", () => {
    expect(quyTen("@deepseek-ai/dsh-experimental-agent-team")).toBe("@galaxy-blackhole/gbh-experimental-agent-team");
    // Subpath phải được GIỮ NGUYÊN khi đổi phần tên gói (dùng cặp có trong bảng).
    expect(quyTen("@deepseek-ai/dsh-session/tools")).toBe("@galaxy-blackhole/gbh-session/tools");
    expect(quyTen("@galaxy-blackhole/gbh-bundle")).toBe("@galaxy-blackhole/gbh-bundle");
    expect(quyTen("khong-co-goi-nay")).toBe("khong-co-goi-nay");
  });
});
