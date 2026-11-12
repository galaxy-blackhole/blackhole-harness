/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-util-time: chạy CÙNG đầu vào trên bản của ta và bundle gốc
 *      @deepseek-ai/dsh-util-time, so từng kết quả (chuẩn hoá, từ chối, alias).
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { canonicalClientTimeZone as ours } from "../../packages/host/util-time/src/index.ts";

/** Bundle gốc trong cây cài của kernel. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-util-time", "lib", "index.js");

/** Bề mặt hai bản. */
interface Surface {
  /** Chuẩn hoá múi giờ người gọi khai. */
  canonicalClientTimeZone(value: string): string | undefined;
}

/**
 * Nạp bundle gốc như ESM thật để A/B cùng môi trường.
 * Nhận: không.
 * Trả: bề mặt bản gốc.
 */
async function stock(): Promise<Surface> {
  return (await import(STOCK)) as Surface;
}

describe("util-time — bề mặt export", () => {
  test("export 1 = 1 đúng tên như bản gốc", async () => {
    const theirs = await stock();
    expect(Object.keys(theirs)).toEqual(["canonicalClientTimeZone"]);
    expect(typeof ours).toBe("function");
  });
});

describe("util-time — canonicalClientTimeZone A/B", () => {
  const inputs = [
    "UTC",
    "utc",
    "Asia/Ho_Chi_Minh",
    "asia/ho_chi_minh",
    "America/New_York",
    "Europe/Paris",
    "Etc/GMT+5",
    "GMT",
    "Not/AZone",
    "UTC+7",
    "Asia/Sai_Gon",
    "",
    " UTC",
    "UTC ",
    "Asia/Ho Chi Minh",
    "Asia//Ho_Chi_Minh",
    "1Asia/Zone",
  ];

  test("mọi đầu vào cho CÙNG kết quả giữa hai bản", async () => {
    const theirs = await stock();
    for (const value of inputs) {
      expect({ value, ours: ours(value), theirs: theirs.canonicalClientTimeZone(value) }).toEqual({
        value,
        ours: ours(value),
        theirs: theirs.canonicalClientTimeZone(value),
      });
    }
  });

  test("tên chuẩn được trả về (alias ⇒ tên canonical do Intl quyết)", () => {
    for (const value of inputs) {
      const result = ours(value);
      if (result === undefined) continue;
      expect(result).toBe(new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone);
    }
  });

  test("từ chối đúng tập: chuỗi rỗng, có khoảng trắng biên, không phải 'UTC', sai khuôn IANA", () => {
    for (const value of ["", " UTC", "UTC ", "utc", "UTC+7", "Not/AZone", "Asia/Ho Chi Minh", "Asia//Ho_Chi_Minh", "1Asia/Zone"]) {
      expect(ours(value)).toBeUndefined();
    }
    expect(ours("UTC")).toBe("UTC");
  });
});
