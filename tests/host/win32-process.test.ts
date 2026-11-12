/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-win32-process: byte-identical tuyệt đối với stock + export surface dạng VĂN BẢN
 *      + metadata draft. GHI RÕ: nhánh WIN32 (koffi) KHÔNG quan sát được trên darwin — koffi không load, nên các ca
 *      hành vi win32 chỉ chạy được trên Windows; ở đây kiểm byte/hằng số/thuần văn bản.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assembleHostParts } from "../../packages/host/win32-process/build.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Nguồn stock. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-win32-process");
/** Gói ta. */
const OURS = join(REPO, "packages/host/win32-process");
/** sha256 buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");
/** Tách danh sách tên export từ văn bản bundle. */
const exportTokens = (text: string): string[] => {
  const match = /export \{([^}]*)\};/u.exec(text);
  return (match?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean).sort();
};

describe("A · artefact byte-identical (cổng byte tuyệt đối)", () => {
  test("lib/index.js trùng TỪNG BYTE + sha", () => {
    expect(readFileSync(join(OURS, "lib/index.js")).equals(readFileSync(join(STOCK, "lib/index.js")))).toBe(true);
    expect(sha(readFileSync(join(OURS, "lib/index.js")))).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("assembleHostParts() + newline === stock", () => {
    expect(assembleHostParts() + "\n").toBe(readFileSync(join(STOCK, "lib/index.js"), "utf8"));
  });

  test("README ghi rõ nhánh win32 không quan sát được trên darwin", () => {
    const readme = readFileSync(join(OURS, "README.md"), "utf8");
    expect(readme.toLowerCase()).toContain("win32");
    expect(readme).toMatch(/koffi/iu);
    expect(readme).toMatch(/darwin/iu);
  });
});

describe("B · export surface dạng VĂN BẢN (không import được vì koffi)", () => {
  test("tập tên export của ta === stock (>= 20 tên)", () => {
    const ours = exportTokens(readFileSync(join(OURS, "lib/index.js"), "utf8"));
    const stock = exportTokens(readFileSync(join(STOCK, "lib/index.js"), "utf8"));
    expect(ours).toEqual(stock);
    expect(ours.length).toBeGreaterThanOrEqual(20);
  });

  test("hằng số/định danh đặc trưng có mặt ở CẢ HAI bản", () => {
    const ours = readFileSync(join(OURS, "lib/index.js"), "utf8");
    const stock = readFileSync(join(STOCK, "lib/index.js"), "utf8");
    expect(ours.includes("ERROR_INSUFFICIENT_BUFFER")).toBe(stock.includes("ERROR_INSUFFICIENT_BUFFER"));
    expect(ours.includes("Win32Error")).toBe(stock.includes("Win32Error"));
    expect(ours.includes("loadWin32ProcessBindings")).toBe(stock.includes("loadWin32ProcessBindings"));
  });

  test("GHI CHÚ win32-unobservable: trên darwin koffi KHÔNG dùng được cho lời gọi native (import có thể lười)", async () => {
    const stockText = readFileSync(join(STOCK, "lib/index.js"), "utf8");
    let imported: Record<string, unknown> | undefined;
    let failure = "";
    try {
      imported = (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>;
    } catch (error) {
      failure = String((error as Error).message ?? error);
    }
    if (imported !== undefined) {
      // Bundle nạp được (koffi lười tải) ⇒ vẫn so surface qua module thật; nhánh win32 chỉ lộ khi gọi hàm native.
      expect(Object.keys(imported).sort()).toEqual(exportTokens(stockText));
    } else {
      expect(failure.length).toBeGreaterThan(0);
      expect(/koffi|Cannot find module|not supported|ERR_DLOPEN|invalid ELF|dylib/iu.test(failure)).toBe(true);
    }
  });
});

describe("C · metadata gói", () => {
  test("provenance {stock, version, sha} khớp stock", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; sha?: string } } };
    expect(m.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-win32-process");
    expect(m.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("draft + KHÔNG gbh.row/row_unmounted_ly_do (không mount)", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> };
    expect(typeof m.gbh["draft"]).toBe("string");
    expect(m.gbh["row"]).toBeUndefined();
    expect(m.gbh["row_unmounted_ly_do"]).toBeUndefined();
  });

  test("exports đúng các subpath runtime stock có + peers chép stock", () => {
    const ours = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { exports: Record<string, string>; peerDependencies: Record<string, string> };
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { exports: Record<string, unknown>; peerDependencies: Record<string, string> };
    const runtimeKeys = Object.keys(stock.exports).filter((k) => k !== "./src/*" && k !== "./package.json").map((k) => k);
    for (const key of runtimeKeys) expect(Object.keys(ours.exports)).toContain(key);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(ours.peerDependencies, stock.peerDependencies)).toBe(true);
  });
});
