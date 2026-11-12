/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-client-hmr (row client-hmr): giao thuc khung + nua host + nua browser.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSseDecoder, parsePluginsEventFrame, sseData } from "../../packages/client/client-hmr/src/frames.ts";
import { EVENTS_ENDPOINT, PACKAGE_NAME } from "../../packages/client/client-hmr/src/ids.ts";
import { type HmrContext, apply } from "../../packages/client/client-hmr/src/index.ts";
import { type ClientContext, type ShellTransport, createPlugin } from "../../packages/client/client-hmr/src/plugin.ts";
import { PACKAGE_NAME as PKG_NAME } from "../../packages/client/client-hmr/src/ids.ts";
void PKG_NAME;

/** Response SSE gia, ghi lai dung nhung gi host da ghi ra. */
function fakeResponse(): {
  status: number | null;
  headers: Record<string, string> | null;
  chunks: string[];
  closed: boolean;
  writeHead(status: number, headers?: Record<string, string>): void;
  write(chunk: string): void;
  end(): void;
  on(event: "close", handler: () => void): void;
  destroy(): void;
} {
  const state = {
    status: null as number | null,
    headers: null as Record<string, string> | null,
    chunks: [] as string[],
    closed: false,
    writeHead(status: number, headers?: Record<string, string>): void {
      state.status = status;
      state.headers = headers ?? {};
    },
    write(chunk: string): void {
      state.chunks.push(chunk);
    },
    end(): void {
      state.closed = true;
    },
    on(_event: "close", _handler: () => void): void {},
    destroy(): void {},
  };
  return state;
}

/** Context host gia co DUNG hinh dang module that (chi nhung gi row nay dung). */
function fakeHostContext(options: { onRebuilt?: (id: string, rev: string) => void } = {}): {
  ctx: HmrContext;
  routes: { kind: string; path: string; handler: (req: { method?: string }, res: ReturnType<typeof fakeResponse>) => void }[];
  rebuiltIds: string[];
  effects: (() => void)[];
  graphHandlers: (() => void)[];
  rebuiltHandlers: ((id: string, rev: string) => void)[];
} {
  const routes: { kind: string; path: string; handler: (req: { method?: string }, res: ReturnType<typeof fakeResponse>) => void }[] = [];
  const rebuiltIds: string[] = [];
  const effects: (() => void)[] = [];
  const graphHandlers: (() => void)[] = [];
  const rebuiltHandlers: ((id: string, rev: string) => void)[] = [];
  const ctx = {
    clientModules: {
      graph: () => ({ entries: [] as { id: string }[] }),
      artifactBaseline: () => undefined,
      rebuilt: (id: string) => {
        rebuiltIds.push(id);
        options.onRebuilt?.(id, "rev-test");
      },
      onGraphChanged: (handler: () => void) => {
        graphHandlers.push(handler);
        return () => undefined;
      },
      onRebuilt: (handler: (id: string, rev: string) => void) => {
        rebuiltHandlers.push(handler);
        return () => undefined;
      },
    },
    webServer: {
      register: (route: { kind: string; path: string; handler: (req: { method?: string }, res: ReturnType<typeof fakeResponse>) => void }) => {
        routes.push(route);
        return () => undefined;
      },
    },
    effect: (callback: () => () => void) => {
      effects.push(callback());
    },
    logger: { warn: () => undefined },
  } as unknown as HmrContext;
  return { ctx, routes, rebuiltIds, effects, graphHandlers, rebuiltHandlers };
}

describe("row client-hmr — giao thuc khung /plugins/events", () => {
  test("ca 1: boc dung khung graph va rebuilt, loai la thi giu nguyen, sai dinh dang thi bao invalid", () => {
    expect(parsePluginsEventFrame({ type: "graph", graph: { entries: [] } })).toEqual({
      kind: "frame",
      frame: { type: "graph", graph: { entries: [] } },
    });
    expect(parsePluginsEventFrame({ type: "rebuilt", id: "ui-sidebar", rev: "abc" })).toEqual({
      kind: "frame",
      frame: { type: "rebuilt", id: "ui-sidebar", rev: "abc" },
    });
    expect(parsePluginsEventFrame({ type: "tuong-lai" })).toEqual({ kind: "unknown" });
    expect(parsePluginsEventFrame({ type: "rebuilt", id: "x" })).toEqual({ kind: "invalid" });
    expect(parsePluginsEventFrame(null)).toEqual({ kind: "invalid" });
  });

  test("ca 2: bo boc SSE qua nhieu chunk (dong bi cat doi), bo qua dong chu thich", () => {
    const decoder = createSseDecoder();
    const frame = sseData({ type: "rebuilt", id: "x", rev: "1" });
    const cut = Math.floor(frame.length / 2);
    expect(decoder.feed(": connected\n\n")).toEqual([]);
    expect(decoder.feed(frame.slice(0, cut))).toEqual([]);
    expect(decoder.feed(frame.slice(cut))).toEqual([JSON.stringify({ type: "rebuilt", id: "x", rev: "1" })]);
  });
});

describe("row client-hmr — nua host", () => {
  test("ca 3: dang ky dung route tuyet doi, mo ket noi thi ghi header SSE + loi chao + anh chup do thi, POST thi 405", () => {
    const host = fakeHostContext();
    apply(host.ctx, {});
    expect(host.routes.map((route) => route.path + ":" + route.kind)).toEqual([EVENTS_ENDPOINT + ":exact"]);
    const route = host.routes[0];
    const ok = fakeResponse();
    route?.handler({ method: "GET" }, ok);
    expect(ok.status).toBe(200);
    expect(ok.headers?.["content-type"]).toBe("text/event-stream");
    expect(ok.chunks[0]).toBe(": connected\n\n");
    expect(ok.chunks[1]).toBe(sseData({ type: "graph", graph: { entries: [] } }));
    const bad = fakeResponse();
    route?.handler({ method: "POST" }, bad);
    expect(bad.status).toBe(405);
    expect(bad.closed).toBe(true);
  });

  test("ca 4: bundle doi chu ky giua hai vong poll thi goi clientModules.rebuilt dung mot lan", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gbh-hmr-test-"));
    const bundle = join(dir, "client.js");
    writeFileSync(bundle, "a");
    const rebuilds: string[] = [];
    const host = fakeHostContext();
    (host.ctx.clientModules as unknown as { graph: () => { entries: { id: string }[] } }).graph = () => ({ entries: [{ id: "ui-sidebar" }] });
    // Baseline phai la chu ky THAT cua file, neu khong row se publish ngay khi bat dau theo doi.
    const seed = statSync(bundle);
    (host.ctx.clientModules as unknown as { artifactBaseline: (id: string) => { path: string; mtimeMs: number; ctimeMs: number; size: number } | undefined }).artifactBaseline =
      () => ({ path: bundle, mtimeMs: seed.mtimeMs, ctimeMs: seed.ctimeMs, size: seed.size });
    (host.ctx.clientModules as unknown as { rebuilt: (id: string) => void }).rebuilt = (id: string) => {
      rebuilds.push(id);
    };
    apply(host.ctx, { pollIntervalMs: 10 });
    expect(rebuilds).toEqual([]);
    writeFileSync(bundle, "b-moi-hon");
    const later = new Date(Date.now() + 5000);
    utimesSync(bundle, later, later);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(rebuilds).toEqual(["ui-sidebar"]);
  });
});

describe("row client-hmr — nua browser", () => {
  test("ca 5: transport cua vo → graph thi sync, rebuilt thi reload, khung sai thi chi warn", async () => {
    const synced: unknown[] = [];
    const reloaded: [string, string][] = [];
    const warned: string[] = [];
    const frames = [
      sseData({ type: "graph", graph: { entries: [{ id: "a" }] } }),
      sseData({ type: "rebuilt", id: "ui-sidebar", rev: "r2" }),
      "data: {khong-json}\n\n",
    ].join("");
    const transport: ShellTransport = {
      fetch: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          body: {
            getReader: () => {
              let sent = false;
              return {
                read: () => {
                  if (sent) return Promise.resolve({ done: true as const });
                  sent = true;
                  return Promise.resolve({ done: false as const, value: { data: frames } });
                },
              };
            },
          },
        }),
    };
    // 20/10/2026 — LÔ ĐỔI TÊN BRAND: `__DSH_TRANSPORT__` → `__GBH_TRANSPORT__`. Đây là MỘT trong BỐN tên vỏ
    // dist PHẢI giữ dạng GBH (DIST_READ_NAMES) — test phải gắn đúng tên mà nửa browser thật đọc.
    (globalThis as unknown as { __GBH_TRANSPORT__?: ShellTransport }).__GBH_TRANSPORT__ = transport;
    const effects: (() => void)[] = [];
    const ctx = {
      modules: {
        entries: {
          sync: (graph: unknown) => {
            synced.push(graph);
          },
          reload: (id: string, rev: string) => {
            reloaded.push([id, rev]);
          },
        },
      },
      effect: (callback: () => () => void) => {
        effects.push(callback());
      },
      logger: { warn: (message: string) => warned.push(message), error: () => undefined },
    } as unknown as ClientContext;
    const plugin = createPlugin(() => undefined);
    expect(plugin.name).toBe("client-hmr");
    expect(plugin.inject).toEqual(["modules"]);
    plugin.apply(ctx);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(synced).toEqual([{ entries: [{ id: "a" }] }]);
    expect(reloaded).toEqual([["ui-sidebar", "r2"]]);
    expect(warned.length).toBe(1);
    delete (globalThis as unknown as { __GBH_TRANSPORT__?: ShellTransport }).__GBH_TRANSPORT__;
    for (const dispose of effects) dispose();
  });

  test("ca 9 (CANH — su co 17/10): row HAI ID => apply goi lan hai phai la NO-OP", async () => {
    // Do luong cua tm-host-api: tuong quan 100% giua row ket "loading" va row HAI ID (bundle bi goi 2 lan).
    const effects: (() => void)[] = [];
    const ctx = {
      modules: { entries: { sync: () => undefined, reload: () => undefined } },
      effect: (callback: () => () => void) => {
        effects.push(callback());
      },
      logger: { warn: () => undefined, error: () => undefined },
    } as unknown as ClientContext;
    // Cờ chống cài hai lần là phạm vi MODULE (đúng thiết kế), nên ca này nạp module TƯƠI để không dính cờ
    // của các ca trước trong cùng file.
    const freshSpecifier: string = "../../packages/client/client-hmr/src/plugin.ts?case9";
    const fresh = (await import(freshSpecifier)) as typeof import("../../packages/client/client-hmr/src/plugin.ts");
    const plugin = fresh.createPlugin(() => undefined);
    plugin.apply(ctx);
    const afterFirst = effects.length;
    expect(afterFirst).toBeGreaterThan(0);
    plugin.apply(ctx);
    expect(effects.length).toBe(afterFirst);
    for (const dispose of effects) dispose();
  });

  test("ca 10 (CANH — su co 17/10): apply nem loi thi PHAI in ra roi VAN nem tiep", async () => {
    // Cordis nuot loi cua apply => khong ai biet vi sao row ket. Truoc khi sua, nhom mat may tieng chi vi dieu nay.
    const logged: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args[0]);
    };
    const boom = new Error("service da duoc dang ky");
    const ctx = {
      modules: { entries: { sync: () => undefined, reload: () => undefined } },
      effect: () => {
        throw boom;
      },
      logger: { warn: () => undefined, error: () => undefined },
    } as unknown as ClientContext;
    const freshSpecifier: string = "../../packages/client/client-hmr/src/plugin.ts?case10";
    const fresh = (await import(freshSpecifier)) as typeof import("../../packages/client/client-hmr/src/plugin.ts");
    const plugin = fresh.createPlugin(() => undefined);
    let thrown: unknown = null;
    try {
      plugin.apply(ctx);
    } catch (error) {
      thrown = error;
    } finally {
      console.error = originalError;
    }
    expect(thrown).toBe(boom);
    expect(String(logged[0] ?? "")).toContain("apply nem loi");
  });

  test("ca 7 (CANH — luat 17/10): chua do duoc 0 loi console o lab thi KHONG duoc khai gbh.row", async () => {
    // Hai su co lam app TRANG ngay 17/10 deu do khai gbh.row khi chua du dieu kien:
    // (1) artifact client khong ton tai => ENOENT luc boot; (2) moduleIds chua ca id stock => duplicate factory.
    const pkg = (await import("../../packages/client/client-hmr/package.json")) as {
      gbh?: { row?: unknown; draft?: unknown; tests?: string[] };
    };
    // Khai gbh.row la BAT BUOC de lab:row biet row nao bi thay (do duoc: rut khai bao => lab bao
    // 'chua khai gbh.row ... lab can metadata do'). Cai KHONG duoc phep la mount khi lab chua sach —
    // nen canh o day la: row + moduleIds DUNG, va y dinh build ro rang.
    const row = (pkg.gbh as { row?: { id?: string; moduleIds?: string[]; tests?: string[] } } | undefined)?.row;
    expect(row?.id).toBe("client-hmr");
    expect(row?.moduleIds).toEqual([PACKAGE_NAME]);
    // Alias id stock: sau task-52 (aliasRows trong packages/client/modules/src/combos.ts) entry alias dung
    // DUNG url+rev cua row so huu nen bundle KHONG chay lan hai, khai alias la an toan va can thiet de
    // consumer cu (bundle nao require id stock) phan giai duoc. Truoc task-52 thi nguoc lai: N id = N lan nap.
    const aliases = (pkg.gbh as { row?: { aliases?: string[] } } | undefined)?.row?.aliases ?? [];
    expect(aliases).toEqual(["@deepseek-ai/dsh-client-hmr"]);
    expect(aliases).not.toContain(PACKAGE_NAME);
    expect(row?.tests).toEqual(["tests/client/client-hmr.test.ts"]);
  });

  test("ca 8 (CANH): artifact client phai TON TAI va bundle KHONG duoc chua id stock", async () => {
    const bundle = await Bun.file(new URL("../../packages/client/client-hmr/lib/client.js", import.meta.url)).text();
    expect(bundle.length).toBeGreaterThan(0);
    expect(bundle).toContain("__ModuleLoader__");
    // Dung DUNG phep kiem cua Lead: chuoi ID STOCK o dang literal trong bundle => nghi trung dang ky.
    // (Khong dung regex tran /@deepseek-ai/ vi ten do con xuat hien trong comment giai thich.)
    // PHEP KIEM DUNG (Lead dinh chinh 17/10/2026): bundle HOP LE luon chua require("@deepseek-ai/...")
    // — do la LOI GOI require, khong phai id DANG KY — nen KHONG duoc grep chung. Phai:
    // (1) dem loi goi dang ky = 1; (2) PHAN GIAI tham so id (literal hoac hang) va khang dinh id do
    // khong phai id stock; (3) doi chieu gbh.row.moduleIds khi da khai.
    expect(bundle.match(/\.load\(/gu)?.length).toBe(1);
    const idArg = (bundle.match(/\.load\(\s*\{\s*id:\s*([^,]+),/u)?.[1] ?? "").trim();
    let resolvedId = idArg.replace(/^["']|["']$/gu, "");
    if (!resolvedId.startsWith("@")) {
      const declaration = bundle.match(new RegExp("(?:var|const|let)\\s+" + resolvedId + "\\s*=\\s*[\"']([^\"']+)[\"']", "u"));
      resolvedId = declaration?.[1] ?? "";
    }
    expect(resolvedId).toBe(PACKAGE_NAME);
    expect(resolvedId.startsWith("@deepseek-ai/")).toBe(false);
  });

  test("ca 6: bundle client dang ky DUNG MOT id module la ten package cua ta", async () => {
    const registered: string[] = [];
    (globalThis as unknown as { __ModuleLoader__: { load(registration: { id: string; factory: unknown }): void } }).__ModuleLoader__ = {
      load: (registration) => {
        registered.push(registration.id);
      },
    };
    // Duong dan de trong BIEN nen TypeScript khong thu phan giai (bun van nap luc chay).
    const entry: string = "../../packages/client/client-hmr/src/client.ts";
    await import(entry);
    expect(registered).toEqual([PACKAGE_NAME]);
    delete (globalThis as unknown as { __ModuleLoader__?: unknown }).__ModuleLoader__;
  });
});
