/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-brand: chạy CÙNG đầu vào trên bản của ta và bundle gốc
 *      @deepseek-ai/dsh-brand, khẳng định brand KHÔNG đổi giá trị lúc chạy.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { brandNumber as oursNumber, brandString as oursString } from "../../packages/host/brand/src/index.ts";

/** Bundle gốc trong cây cài của kernel. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-brand", "lib", "index.js");

/** Bề mặt hai bản. */
interface Surface {
  /** Gắn brand cho string. */
  brandString(value: string): string;
  /** Gắn brand cho number. */
  brandNumber(value: number): number;
}

/**
 * Nạp bundle gốc như ESM thật để A/B cùng môi trường.
 * Nhận: không.
 * Trả: bề mặt bản gốc.
 */
async function stock(): Promise<Surface> {
  return (await import(STOCK)) as Surface;
}

describe("brand — bề mặt export", () => {
  test("export 2 = 2 đúng tên như bản gốc", async () => {
    const theirs = await stock();
    expect(Object.keys(theirs).sort()).toEqual(["brandNumber", "brandString"]);
    expect(typeof oursString).toBe("function");
    expect(typeof oursNumber).toBe("function");
  });
});

describe("brand — KHÔNG đổi giá trị lúc chạy (A/B)", () => {
  const strings = ["", "a", "session-1", "0", "  khoảng trắng  ", "🙂 tiếng Việt", "x".repeat(10_000)];
  const numbers = [0, -0, 1, -1, 0.5, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.NaN, Number.POSITIVE_INFINITY];

  test("brandString trả ĐÚNG chuỗi đầu vào, hai bản như nhau", async () => {
    const theirs = await stock();
    for (const value of strings) {
      expect({ v: value, ours: oursString(value), theirs: theirs.brandString(value) }).toEqual({ v: value, ours: value, theirs: value });
    }
  });

  test("brandNumber trả ĐÚNG số đầu vào (kể cả NaN/±Infinity/-0), hai bản như nhau", async () => {
    const theirs = await stock();
    for (const value of numbers) {
      expect({ ours: oursNumber(value), theirs: theirs.brandNumber(value) }).toEqual({ ours: value, theirs: value });
    }
    expect(Object.is(oursNumber(-0), -0)).toBe(true);
    expect(Object.is(theirs.brandNumber(-0), -0)).toBe(true);
  });

  test("hai bản cài độc lập cho giá trị DÙNG LẪN nhau được (không giữ danh tính)", async () => {
    const theirs = await stock();
    expect(oursString(theirs.brandString("id-1"))).toBe("id-1");
    expect(theirs.brandString(oursString("id-2"))).toBe("id-2");
    expect(oursNumber(theirs.brandNumber(42))).toBe(42);
  });
});
