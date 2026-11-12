/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B cho resolveDistIndex (task-157 nhánh B): ƯU TIÊN dist của ta, FALLBACK dist stock, fail-soft
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { resolveDistIndex } from "../../packages/host/web-runtime/src/dist.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

describe("task-157 · resolveDistIndex ưu tiên dist của ta", () => {
  test("1 · dist CỦA TA tồn tại ⇒ trả đúng dist của ta (đã qua brand-rename)", () => {
    const path = resolveDistIndex();
    expect(path.endsWith(join("host-frontend-static", "dist", "index.html"))).toBe(true);
    expect(existsSync(path)).toBe(true);
  });

  test("2 · dist của ta có token mang brand GBH, KHÔNG còn token DSH", () => {
    const goc = join(REPO, "packages", "host", "host-frontend-static", "dist", "assets");
    const css = "index-BxpfOGf3.css";
    const text = require("node:fs").readFileSync(join(goc, css), "utf8") as string;
    expect(text.includes("--gbh-boot-bg")).toBe(true);
    expect(text.includes("--dsh-boot-bg")).toBe(false);
  });

  test("3 · gói dist stock vẫn tồn tại để FALLBACK (không bị xoá/sửa)", () => {
    const stock = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist", "index.html");
    expect(existsSync(stock)).toBe(true);
  });

  test("4 · hàm KHÔNG ném khi dist của ta thiếu (nhánh fallback dùng try/catch, fail-soft)", async () => {
    const source = await Bun.file(join(REPO, "packages", "host", "web-runtime", "src", "dist.ts")).text();
    // 20/10/2026 — KHÔNG phải lỗi brand: task-157 nhánh B đổi hàm từ MỘT ứng viên sang DANH SÁCH ba bố cục
    // + vòng existsSync, nên ca này (ghim dòng `if (existsSync(cuaTa)) return cuaTa;`) ĐỎ oan. Giữ nguyên
    // Ý ĐỊNH và siết lại theo hình dạng hiện tại: (a) dist CỦA TA đứng đầu và thoát sớm khi tồn tại,
    // (b) fallback stock vẫn nằm trong try/catch (fail-soft) và chỉ chạy SAU vòng ứng viên.
    expect(source.includes('join(goc, "..", "host-frontend-static", "dist", "index.html")')).toBe(true);
    expect(source.includes("if (existsSync(ungVien)) return ungVien;")).toBe(true);
    expect(source.includes("catch {")).toBe(true);
    const vongUngVien = source.indexOf("if (existsSync(ungVien)) return ungVien;");
    const fallbackStock = source.indexOf("const require = createRequire(import.meta.url);");
    expect(vongUngVien).toBeGreaterThan(-1);
    expect(fallbackStock).toBeGreaterThan(vongUngVien);
  });
});
