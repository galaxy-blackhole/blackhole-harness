/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 05/11/2026
 * desc Phụ lục kiểm manifest/artifact/ownership của gói experimental-api-speech-to-text — tách khỏi tệp test chính
 *      để giữ luật ≤1000 dòng/tệp; import side-effect từ experimental-api-speech-to-text.test.ts, không xoá ca nào.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "experimental-api-speech-to-text");
/** node_modules kernel — nơi cả hai bản phân giải peer. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Thư mục gói stock (CHỈ ĐỌC) — oracle. */
const STOCK_DIR = join(APP_MODULES, "@deepseek-ai", "dsh-experimental-api-speech-to-text");
/** Hình dạng tối thiểu của package.json mà phụ lục đọc. */
interface ManifestShape {
  /** Tên package. */
  readonly name?: string;
  /** Cờ private. */
  readonly private?: boolean;
  /** Loại module. */
  readonly type?: string;
  /** Điểm vào chính. */
  readonly main?: string;
  /** Bảng exports. */
  readonly exports?: Record<string, unknown>;
  /** Metadata gbh. */
  readonly gbh?: { readonly row?: Record<string, unknown> };
}
/** package.json của ta. */
const OUR_PKG = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as ManifestShape;
/** package.json của stock. */
const STOCK_PKG = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as ManifestShape;
/** Id package của ta. */
const OUR_ID = String(OUR_PKG.name);
/** Id package stock. */
const STOCK_ID = String(STOCK_PKG.name);

describe("(j) manifest + artifact + ownership — assert thật (reviewer 19/10/2026)", () => {
  test("(j1) package.json: name/private/type/exports + gbh.row mirror dump-now2", () => {
    expect(String(OUR_PKG.name)).toBe(OUR_ID);
    expect(String(STOCK_PKG.name)).toBe(STOCK_ID);
    expect(OUR_PKG.private).toBe(true);
    expect(String(OUR_PKG.type)).toBe("module");
    expect(String(OUR_PKG.main)).toBe("lib/index.js");
    const exportsMap = OUR_PKG.exports ?? {};
    expect(exportsMap["./typert"]).toBe("./lib/typert.host.js");
    expect(exportsMap["./remote"]).toBe("./lib/typert.remote-client.js");
    // 08/11/2026 (Lead chốt chính sách types): CÓ `lib/types/index.d.ts` thì giữ lib/types; KHÔNG có thì dùng
    // `./src/index.ts`. Gói này KHÔNG có lib/types ⇒ kỳ vọng `./src/index.ts`; phần còn lại của "." phải y stock.
    const stockDot = (STOCK_PKG.exports ?? {})["."] as Record<string, unknown>;
    const hasLibTypes = existsSync(join(PKG, "lib", "types", "index.d.ts"));
    expect(exportsMap["."]).toEqual({ ...stockDot, types: hasLibTypes ? "./lib/types/index.d.ts" : "./src/index.ts" });
    const row = (OUR_PKG.gbh?.row ?? {}) as Record<string, unknown>;
    expect(String(row.id)).toBe("api-speech-to-text");
    expect(row.moduleIds).toEqual([OUR_ID]);
    expect(row.aliases).toEqual([STOCK_ID]);
    expect(row.tests).toEqual(["tests/host/experimental-api-speech-to-text.test.ts"]);
    expect(row.config).toBeUndefined();
    expect(row.inject).toBeUndefined();
    expect(row.disabled).toBeUndefined();
  });

  test("(j2) artifact: 3 tệp tồn tại + ownership 0 id stock · id ta đúng số lần", () => {
    for (const file of ["index.js", "typert.host.js", "typert.remote-client.js"]) {
      const path = join(PKG, "lib", file);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, "utf8");
      expect(text.split(STOCK_ID).length - 1).toBe(0);
    }
    const hostCount = readFileSync(join(PKG, "lib", "typert.host.js"), "utf8").split(OUR_ID).length - 1;
    const remoteCount = readFileSync(join(PKG, "lib", "typert.remote-client.js"), "utf8").split(OUR_ID).length - 1;
    expect(hostCount).toBeGreaterThanOrEqual(9);
    expect(remoteCount).toBeGreaterThanOrEqual(8);
    const srcStock = readFileSync(join(PKG, "src", "typert-host.ts"), "utf8").split(STOCK_ID).length - 1;
    expect(srcStock).toBe(0);
    const testPath = join(REPO, "tests", "host", "experimental-api-speech-to-text.test.ts");
    expect(existsSync(testPath)).toBe(true);
    const cases = readFileSync(testPath, "utf8").match(/^\s*test\("/gmu)?.length ?? 0;
    expect(cases).toBeGreaterThanOrEqual(10);
  });
});
