/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-util-crypto: chạy CÙNG đầu vào trên bản của ta và bundle gốc
 *      @deepseek-ai/dsh-util-crypto, so từng byte/chuỗi.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bytesToBase64 as oursBase64, randomUUID as oursUUID } from "../../packages/host/util-crypto/src/index.ts";

/** Bundle gốc trong cây cài của kernel. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-util-crypto", "lib", "index.js");

/** Bề mặt hai bản. */
interface CryptoSurface {
  /** Mã hoá bytes thành base64. */
  bytesToBase64(data: Uint8Array): string;
  /** Sinh UUID v4. */
  randomUUID(): string;
}

/**
 * Nạp bundle gốc như ESM thật để A/B cùng một môi trường.
 * Nhận: không.
 * Trả: bề mặt của bản gốc.
 */
async function stock(): Promise<CryptoSurface> {
  return (await import(STOCK)) as CryptoSurface;
}

describe("util-crypto — bề mặt export", () => {
  test("export 2 = 2 đúng tên như bản gốc", async () => {
    const theirs = await stock();
    expect(Object.keys(theirs).sort()).toEqual(["bytesToBase64", "randomUUID"]);
    expect(typeof oursBase64).toBe("function");
    expect(typeof oursUUID).toBe("function");
  });

  test("nguồn của ta KHÔNG dùng crypto.randomUUID (đúng lý do bản gốc nêu)", () => {
    const text = readFileSync(join(import.meta.dir, "..", "..", "packages", "host", "util-crypto", "src", "index.ts"), "utf8");
    // Bỏ COMMENT trước khi kiểm: JSDoc của gói CỐ Ý nhắc "crypto.randomUUID" để giải thích vì sao KHÔNG dùng nó.
    const code = text
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//") && !line.trim().startsWith("/*"))
      .join("\n");
    expect(code).not.toContain("crypto.randomUUID");
    expect(code).toContain("getRandomValues");
  });
});

describe("util-crypto — bytesToBase64 A/B", () => {
  const cases: { label: string; data: Uint8Array }[] = [
    { label: "rỗng", data: new Uint8Array(0) },
    { label: "1 byte", data: new Uint8Array([0]) },
    { label: "32.767 byte (dưới biên lô)", data: new Uint8Array(32767).map((_, index) => index % 256) },
    { label: "32.768 byte (đúng biên lô)", data: new Uint8Array(32768).map((_, index) => (index * 7) % 256) },
    { label: "100.000 byte (nhiều lô)", data: new Uint8Array(100000).map((_, index) => (index * 13) % 256) },
    { label: "mọi byte 0–255", data: new Uint8Array(256).map((_, index) => index) },
  ];

  test("mọi ca cho CHUỖI BẰNG NHAU giữa hai bản", async () => {
    const theirs = await stock();
    for (const item of cases) {
      expect({ label: item.label, value: oursBase64(item.data) }).toEqual({ label: item.label, value: theirs.bytesToBase64(item.data) });
    }
  });

  test("kết quả cũng bằng btoa tham chiếu và độ dài đúng công thức base64", () => {
    for (const item of cases) {
      const expected = btoa(Array.from(item.data, (byte) => String.fromCharCode(byte)).join(""));
      expect(oursBase64(item.data)).toBe(expected);
      expect(oursBase64(item.data).length).toBe(Math.ceil(item.data.length / 3) * 4);
    }
  });
});

describe("util-crypto — randomUUID A/B", () => {
  /** Khuôn UUID v4 chặt: hex thường, version 4, variant 8/9/a/b. */
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

  test("hai bản đều cho UUID đúng khuôn v4 (100 mẫu mỗi bên)", async () => {
    const theirs = await stock();
    for (let index = 0; index < 100; index += 1) {
      expect(oursUUID()).toMatch(UUID_V4);
      expect(theirs.randomUUID()).toMatch(UUID_V4);
    }
  });

  test("2.000 UUID của ta KHÔNG trùng nhau", () => {
    const seen = new Set<string>();
    for (let index = 0; index < 2000; index += 1) seen.add(oursUUID());
    expect(seen.size).toBe(2000);
  });

  test("cả hai bản KHÔNG gọi crypto.randomUUID (bẫy: gán để ném nếu bị gọi)", async () => {
    const theirs = await stock();
    const original = globalThis.crypto.randomUUID;
    let called = 0;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: (): string => {
        called += 1;
        throw new Error("khong duoc goi crypto.randomUUID");
      },
    });
    try {
      expect(oursUUID()).toMatch(UUID_V4);
      expect(theirs.randomUUID()).toMatch(UUID_V4);
      expect(called).toBe(0);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: original });
    }
  });
});
