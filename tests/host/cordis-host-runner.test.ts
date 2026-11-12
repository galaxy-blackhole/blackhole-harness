/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho gói cordis-host-runner (runner transport lõi): mặt export · prototype 2 service · Config ·
 *      guard · sandbox · registry · lifecycle · đăng ký service trên Context cordis THẬT · guard chống trùng service
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as guard from "../../packages/host/cordis-host-runner/src/guard.ts";
import * as lifecycle from "../../packages/host/cordis-host-runner/src/lifecycle.ts";
import * as registryModule from "../../packages/host/cordis-host-runner/src/registry.ts";
import * as sandbox from "../../packages/host/cordis-host-runner/src/sandbox.ts";

/** Thư mục gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const OURS = join(REPO, "packages", "host", "cordis-host-runner");
/** Bản gốc (CHỈ ĐỌC) — oracle. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-cordis-host-runner");
/** Cordis THẬT của kernel. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Nạp module ta đã build. */
async function ourModule(): Promise<Record<string, unknown>> {
  return (await import(join(OURS, "lib", "index.js"))) as Record<string, unknown>;
}

/** Nạp module gốc. */
async function stockModule(): Promise<Record<string, unknown>> {
  return (await import(join(STOCK, "lib", "index.js"))) as Record<string, unknown>;
}

/** Nạp module gốc trong lib/types (để A/B helper). */
async function stockLeaf(name: string): Promise<Record<string, unknown>> {
  return (await import(join(STOCK, "lib", "types", name + ".js"))) as Record<string, unknown>;
}

/** Tên method công khai của một class. */
function protoNames(ctor: { prototype: Record<string, unknown> }): string[] {
  return Object.getOwnPropertyNames(ctor.prototype).filter((name) => name !== "constructor").sort();
}

/** Chụp lỗi thành hình dạng so sánh được. */
function capture(run: () => unknown): { name?: string; message: string } {
  try {
    run();
    return { message: "<khong-nem>" };
  } catch (error) {
    const failure = error as Error;
    return { name: failure.name, message: failure.message };
  }
}

describe("cordis-host-runner — mặt export + prototype 2 service", () => {
  test("lib/index.js export ĐÚNG tập khoá như gốc", async () => {
    expect(Object.keys(await ourModule()).sort()).toEqual(Object.keys(await stockModule()).sort());
    expect(Object.keys(await ourModule()).sort()).toEqual([
      "ApprovalRequestId", "CordisDynamicPackageId", "CordisDynamicPluginId", "CordisDynamicPluginRunId",
      "CordisInspectRegistryService", "DynamicCordisRunnerService", "default",
    ]);
  });

  test("default LÀ DynamicCordisRunnerService", async () => {
    const module = await ourModule();
    expect(module["default"]).toBe(module["DynamicCordisRunnerService"]);
  });

  test("prototype DynamicCordisRunnerService trùng KHÍT bản gốc (42 method)", async () => {
    const module = await ourModule();
    const theirs = await stockModule();
    const mine = protoNames(module["DynamicCordisRunnerService"] as { prototype: Record<string, unknown> });
    expect(mine).toEqual(protoNames(theirs["DynamicCordisRunnerService"] as { prototype: Record<string, unknown> }));
    expect(mine.length).toBe(43);
  });

  test("prototype CordisInspectRegistryService trùng KHÍT bản gốc (6 method)", async () => {
    const module = await ourModule();
    const theirs = await stockModule();
    const mine = protoNames(module["CordisInspectRegistryService"] as { prototype: Record<string, unknown> });
    expect(mine).toEqual(protoNames(theirs["CordisInspectRegistryService"] as { prototype: Record<string, unknown> }));
    expect(mine).toEqual(["list", "query", "queryClient", "register", "resolveClientQuery", "syncClientManifest"]);
  });

  test("String(Config) trùng từng ký tự", async () => {
    const module = await ourModule();
    const theirs = await stockModule();
    const configOf = (m: Record<string, unknown>): unknown => (m["DynamicCordisRunnerService"] as { Config: unknown }).Config;
    expect(String(configOf(module))).toBe(String(configOf(theirs)));
  });

  test("4 brand id là hàm và cho cùng kết quả với bản gốc", async () => {
    const module = await ourModule();
    const theirs = await stockModule();
    for (const name of ["ApprovalRequestId", "CordisDynamicPackageId", "CordisDynamicPluginId", "CordisDynamicPluginRunId"]) {
      const mine = module[name] as (value: string) => unknown;
      const other = theirs[name] as (value: string) => unknown;
      expect(typeof mine).toBe("function");
      expect(mine("x1")).toEqual(other("x1"));
    }
  });

  test("locale en/zh chép NGUYÊN VĂN", () => {
    for (const file of ["en.json", "zh.json"]) {
      expect(readFileSync(join(OURS, "locale", file)).equals(readFileSync(join(STOCK, "locale", file)))).toBe(true);
    }
  });
});

describe("cordis-host-runner — guard A/B", () => {
  test("normalizeHandler: tên method hoa/thường + handler", async () => {
    const theirs = await stockLeaf("guard");
    const fnMine = guard.normalizeHandler as (m: unknown, f: unknown) => unknown;
    const fnTheirs = theirs["normalizeHandler"] as (m: unknown, f: unknown) => unknown;
    const handler = async (): Promise<unknown> => "ok";
    for (const method of ["run", "Run", "RUN"]) {
      expect(capture(() => fnMine(method, handler))).toEqual(capture(() => fnTheirs(method, handler)));
    }
  });

  test("isPlugin: nhận/loại các hình dạng plugin", async () => {
    const theirs = await stockLeaf("guard");
    const fnMine = guard.isPlugin as (v: unknown) => boolean;
    const fnTheirs = theirs["isPlugin"] as (v: unknown) => boolean;
    for (const value of [null, {}, { name: "p", apply: () => {} }, "x", 1]) expect(fnMine(value)).toBe(fnTheirs(value));
  });

  test("pluginName: trùng bản gốc", async () => {
    const theirs = await stockLeaf("guard");
    const fnMine = guard.pluginName as (p: unknown) => string;
    const fnTheirs = theirs["pluginName"] as (p: unknown) => string;
    for (const plugin of [{ name: "p" }, { name: "p", apply: () => {} }]) expect(fnMine(plugin)).toBe(fnTheirs(plugin));
  });

  test("sandboxDefineTool: schema sai ⇒ cùng thông điệp lỗi", async () => {
    const theirs = await stockLeaf("guard");
    const fnMine = guard.sandboxDefineTool as (o: unknown) => unknown;
    const fnTheirs = theirs["sandboxDefineTool"] as (o: unknown) => unknown;
    for (const options of [{}, { name: "" }, { name: "t", parameters: {} }, "x"]) {
      expect(capture(() => fnMine(options))).toEqual(capture(() => fnTheirs(options)));
    }
  });
});

describe("cordis-host-runner — sandbox A/B", () => {
  test("precheckCode: code hợp lệ/rỗng/import ⇒ cùng kết quả hoặc cùng lỗi", async () => {
    const theirs = await stockLeaf("sandbox");
    const mine = sandbox.precheckCode as (code: string, half: string) => void;
    const other = theirs["precheckCode"] as (code: string, half: string) => void;
    for (const code of ["const a = 1;", "", "import x from 'y';", "export default 1;"]) {
      expect(capture(() => mine(code, "code.host"))).toEqual(capture(() => other(code, "code.host")));
    }
  });

  test("syntaxErrorContext: trùng chuỗi ngữ cảnh lỗi", async () => {
    const theirs = await stockLeaf("sandbox");
    const mine = sandbox.syntaxErrorContext as (e: Error) => string;
    const other = theirs["syntaxErrorContext"] as (e: Error) => string;
    const error = new SyntaxError("Unexpected token");
    expect(mine(error)).toBe(other(error));
  });

  test("parseErrorMessage: trùng cả hai nửa host/client", async () => {
    const theirs = await stockLeaf("sandbox");
    const mine = sandbox.parseErrorMessage as (half: string, context: string) => string;
    const other = theirs["parseErrorMessage"] as (half: string, context: string) => string;
    const contexts = [
      "dynamic package \`code.host\` failed to parse:\nconst a = 1 as Foo;",
      "SyntaxError: Unexpected token\n  at cordis-dyn-1.js:1:1",
      "",
    ];
    for (const context of contexts) {
      for (const half of ["code.host", "code.client"]) expect(mine(half, context)).toBe(other(half, context));
    }
  });

  test("createSandbox: cùng bộ khoá bề mặt", async () => {
    const theirs = await stockLeaf("sandbox");
    const mine = sandbox.createSandbox as (id: string, extra?: Record<string, unknown>) => Record<string, unknown>;
    const other = theirs["createSandbox"] as (id: string, extra?: Record<string, unknown>) => Record<string, unknown>;
    expect(Object.keys(mine("demo-1")).sort()).toEqual(Object.keys(other("demo-1")).sort());
  });
});

describe("cordis-host-runner — registry + lifecycle A/B", () => {
  test("DynamicCordisRegistry: mint id + add/get/all trùng bản gốc", async () => {
    const theirs = await stockLeaf("registry");
    // `typeof` của lớp KHÔNG đủ chồng lấn với chữ ký dựng ⇒ cast qua `unknown` (TS2352); đây là A/B với lớp ngoại lai.
    const Mine = registryModule.DynamicCordisRegistry as unknown as new () => Record<string, unknown>;
    const Theirs = theirs["DynamicCordisRegistry"] as unknown as new () => Record<string, unknown>;
    const mine = new Mine();
    const other = new Theirs();
    expect(Object.keys(mine).sort()).toEqual(Object.keys(other).sort());
    const mint = (instance: Record<string, unknown>, key: string): unknown => (instance[key] as () => unknown)();
    for (const key of ["nextPlugin", "nextPackage", "nextRun", "nextApproval"]) {
      expect(capture(() => mint(mine, key))).toEqual(capture(() => mint(other, key)));
    }
  });

  test("lifecycle.missingServices: Context rỗng ⇒ cùng danh sách service thiếu", async () => {
    const theirs = await stockLeaf("lifecycle");
    const mine = lifecycle.missingServices as (ctx: unknown, fiber: unknown) => string[];
    const other = theirs["missingServices"] as (ctx: unknown, fiber: unknown) => string[];
    const ctx = { get: (): undefined => undefined };
    const fiber = { inject: ["tools", "llm", "sessions"] };
    expect(mine(ctx, fiber)).toEqual(other(ctx, fiber));
  });

  test("types.ts: 0 export runtime như bản gốc", async () => {
    const mine = Object.keys((await import(join(OURS, "lib", "types.js"))) as Record<string, unknown>).sort();
    const other = Object.keys((await import(join(STOCK, "lib", "types", "types.js"))) as Record<string, unknown>).sort();
    expect(mine).toEqual(other);
    expect(mine).toEqual([]);
  });
});

describe("cordis-host-runner — đăng ký service trên Context THẬT (chống trùng)", () => {
  test("constructor đăng ký đúng tên service dynamicCordisRunner (cả hai bản)", async () => {
    const cordis = (await import(CORDIS)) as { Context: new () => Record<string, unknown> };
    const module = await ourModule();
    const theirs = await stockModule();
    const Mine = module["DynamicCordisRunnerService"] as new (ctx: unknown, config: unknown) => unknown;
    const Theirs = theirs["DynamicCordisRunnerService"] as new (ctx: unknown, config: unknown) => unknown;
    const config = (module["DynamicCordisRunnerService"] as { Config: (v: unknown) => unknown }).Config({});
    const oursCtx = new cordis.Context();
    const theirsCtx = new cordis.Context();
    let oursError: string | null = null;
    let theirsError: string | null = null;
    try { new Mine(oursCtx, config); } catch (error) { oursError = (error as Error).message; }
    try { new Theirs(theirsCtx, config); } catch (error) { theirsError = (error as Error).message; }
    // Cùng điều kiện thiếu seam ⇒ cùng hành vi; nếu dựng được thì cả hai đều có service.
    expect(oursError === null).toBe(theirsError === null);
    if (oursError === null) {
      expect(oursCtx["dynamicCordisRunner"]).toBeDefined();
      expect(theirsCtx["dynamicCordisRunner"]).toBeDefined();
      expect(oursCtx["cordisInspect"]).toBeDefined();
      expect(theirsCtx["cordisInspect"]).toBeDefined();
    }
  });

  test("KHÔNG gói nào trong packages/ đăng ký trùng 2 service này (chống trùng khi mount)", () => {
    const files = [join(REPO, "packages", "host", "api-remotes"), join(REPO, "packages", "host", "typert-gateway")];
    for (const dir of files) {
      for (const relative of ["src/index.ts", "src/service.ts", "src/plugin.ts"]) {
        const path = join(dir, relative);
        let text = "";
        try { text = readFileSync(path, "utf8"); } catch { continue; }
        expect(text.includes("super(ctx, \"dynamicCordisRunner\"")).toBe(false);
        expect(text.includes("super(ctx, 'dynamicCordisRunner'")).toBe(false);
        expect(text.includes("super(ctx, \"cordisInspect\"")).toBe(false);
        expect(text.includes("super(ctx, 'cordisInspect'")).toBe(false);
      }
    }
  });

  test("row PARKED đúng quy ước (chưa gbh.row)", () => {
    interface Row { id?: string; tests?: string[] }
    interface Park { ly_do?: string; row?: Row }
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh?: { row?: Row; park?: Park; row_unmounted_ly_do?: Park } };
    const mounted = meta.gbh?.row;
    const parked = meta.gbh?.row_unmounted_ly_do ?? meta.gbh?.park;
    const row = mounted ?? parked?.row;
    expect(row?.id).toBe("cordis-host-runner");
    expect(row?.tests).toContain("tests/host/cordis-host-runner.test.ts");
    if (mounted !== undefined) expect(parked).toBeUndefined();
    else expect(typeof parked?.ly_do).toBe("string");
  });
});
