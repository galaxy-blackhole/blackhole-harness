/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho HAI manifest typert của @galaxy-blackhole/gbh-llm: dữ liệu generated phải bằng
 *      stock sau khi align ownership id, đúng luật typert-loader "manifest phải owned bởi gói export nó".
 */

import { deepStrictEqual, ok } from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

/** Gốc repo (tệp nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "llm");
/** node_modules của kernel — nơi hai bản phân giải peer (zod, remote-info). */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Thư mục stock (oracle, chỉ đọc). */
const STOCK = join(APP_MODULES, "@deepseek-ai", "dsh-llm", "lib");
/** Thư mục tạm chứa artifact build; dọn ở afterAll. */
const BASE = mkdtempSync(join(tmpdir(), "gbh-llm-typert-ab-"));
/** Thư mục artifact (buildPackage dọn rồi ghi vào đây). */
const OUT = join(BASE, "pkg");
/** package.json của ta. */
const OUR_PKG = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { name: string; exports?: Record<string, string> };
/** package.json của stock. */
const STOCK_PKG = JSON.parse(readFileSync(join(APP_MODULES, "@deepseek-ai", "dsh-llm", "package.json"), "utf8")) as { name: string; exports?: Record<string, string> };
/** RemoteInfo của một bên. */
type RemoteInfo = { package: string; methods: Record<string, Obj>; spec: Obj };
/** Bản ghi JSON bất kỳ. */
type Obj = Record<string, unknown>;
/** Hai module manifest nạp trong beforeAll. */
let oursHost: { TYPERT: Obj };
let oursRemote: { TYPERT_REMOTE: RemoteInfo; default: RemoteInfo };
let stockHost: { TYPERT: Obj };
let stockRemote: { TYPERT_REMOTE: RemoteInfo; default: RemoteInfo };
beforeAll(async () => {
  symlinkSync(APP_MODULES, join(BASE, "node_modules"), "dir");
  const { buildPackage } = (await import(join(PKG, "build.ts"))) as {
    buildPackage(outDir?: string): Promise<{ service: string; typertHost: string; typertRemoteClient: string }>;
  };
  const built = await buildPackage(OUT);
  oursHost = (await import(pathToFileURL(built.typertHost).href)) as typeof oursHost;
  oursRemote = (await import(pathToFileURL(built.typertRemoteClient).href)) as typeof oursRemote;
  stockHost = (await import(pathToFileURL(join(STOCK, "typert.host.js")).href)) as typeof stockHost;
  stockRemote = (await import(pathToFileURL(join(STOCK, "typert.remote-client.js")).href)) as typeof stockRemote;
});
afterAll(() => {
  rmSync(BASE, { recursive: true, force: true });
});
/** Dữ liệu JSON thuần: bỏ hàm lazy-create nên hai module instance so sánh được (như mọi ca A/B manifest khác). */
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

/** Đổi id gói stock sang id của ta trong dữ liệu JSON (manifest phải owned bởi gói export nó). */
function align(value: unknown): unknown {
  return JSON.parse(JSON.stringify(json(value)).split(STOCK_PKG.name).join(OUR_PKG.name)) as unknown;
}
describe("llm typert A/B", () => {
  test("(a) TYPERT host DEEP EQUAL stock sau align ownership", () => {
    deepStrictEqual(align(stockHost.TYPERT), json(oursHost.TYPERT));
  });
  test("(b) ownership: id của ta trong manifest, không còn id stock", () => {
    expect(oursHost.TYPERT.package).toBe(OUR_PKG.name);
    expect(oursRemote.TYPERT_REMOTE.package).toBe(OUR_PKG.name);
    expect(stockHost.TYPERT.package).toBe(STOCK_PKG.name);
    expect(JSON.stringify(oursHost.TYPERT).includes(STOCK_PKG.name)).toBe(false);
    expect(JSON.stringify(oursRemote.TYPERT_REMOTE.methods).includes(STOCK_PKG.name)).toBe(false);
  });
  test("(c) TYPERT_REMOTE: methods/trường method khớp stock", () => {
    const ours = oursRemote.TYPERT_REMOTE;
    const stock = stockRemote.TYPERT_REMOTE;
    deepStrictEqual(Object.keys(ours.methods).sort(), Object.keys(stock.methods).sort());
    for (const key of Object.keys(stock.methods).sort()) {
      const a = ours.methods[key] ?? {};
      const b = stock.methods[key] ?? {};
      expect(a.service).toBe(b.service);
      expect(a.implementation).toBe(b.implementation);
      deepStrictEqual(a.invocation, b.invocation);
      deepStrictEqual(a.scope, b.scope);
    }
  });
  test("(d) jsonSchema + codec của từng method EQUAL sau align (bỏ hàm lazy + instance)", () => {
    /** Dữ liệu JSON thuần: bỏ hàm (schema create) và class instance (ResultValue) để so cấu trúc. */
    const plain = (value: unknown): unknown =>
      JSON.parse(JSON.stringify(value, (_key, val) => (typeof val === "function" ? undefined : val))) as unknown;
    const ours = oursRemote.TYPERT_REMOTE;
    const stock = stockRemote.TYPERT_REMOTE;
    for (const key of Object.keys(stock.methods).sort()) {
      const a = (ours.methods[key] ?? {}) as Obj;
      const b = (stock.methods[key] ?? {}) as Obj;
      expect(plain(a)).toEqual(plain(align(b)));
    }
  });
  test("(e) default export === named; host KHÔNG default export", () => {
    expect(oursRemote.default).toBe(oursRemote.TYPERT_REMOTE);
    expect(stockRemote.default).toBe(stockRemote.TYPERT_REMOTE);
    expect("default" in oursHost).toBe(false);
    expect("default" in stockHost).toBe(false);
    expect(oursHost.TYPERT.face).toBe("host");
  });
  test("(f) exports './typert' + './remote' đúng đích và artifact tồn tại", () => {
    const oursExports = OUR_PKG.exports ?? {};
    const pick = (value: unknown): unknown => (typeof value === "string" ? value : (value as Obj | undefined)?.default);
    expect(pick(oursExports["./typert"])).toBe("./lib/typert.host.js");
    expect(pick(oursExports["./remote"])).toBe("./lib/typert.remote-client.js");
    const stockExports = STOCK_PKG.exports ?? {};
    expect(pick(stockExports["./typert"])).toBe("./lib/typert.host.js");
    expect(pick(stockExports["./remote"])).toBe("./lib/typert.remote-client.js");
    ok(readFileSync(join(OUT, "typert.host.js")).byteLength > 0);
    ok(readFileSync(join(OUT, "typert.remote-client.js")).byteLength > 0);
  });
});
