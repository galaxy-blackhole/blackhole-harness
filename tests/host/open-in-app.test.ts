/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hanh vi cho package @galaxy-blackhole/gbh-host-open-in-app (M4b dot 1).
 */
import { describe, expect, test } from "bun:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { apply, Config, inject, name, resolveInternals } from "../../packages/host/open-in-app/src/index.ts";
import { darwinCandidates, openCommand, resolveCatalog } from "../../packages/host/open-in-app/src/catalog.ts";
import { extractBundleIconPng } from "../../packages/host/open-in-app/src/icons.ts";

/** Route do plugin dang ky (lay tu fake webServer). */
interface RegisteredRoute {
  kind: "exact" | "prefix";
  path: string;
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}

/** Ket qua mot lan goi route. */
interface RouteResult {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

/**
 * Dung context gia + webServer gia de goi plugin nhu kernel goi.
 * @param rejection - gia tri connection.requestRejection tra ve (undefined = cho qua).
 * @returns route da dang ky, ham goi route, va so lan effect duoc dang ky.
 */
function harness(rejection: 401 | 403 | undefined = undefined): {
  routes: RegisteredRoute[];
  call: (path: string, init?: { method?: string; headers?: Record<string, string>; body?: Uint8Array | Buffer }) => Promise<RouteResult>;
  effects: number;
} {
  const routes: RegisteredRoute[] = [];
  const webServer = {
    register: (route: RegisteredRoute): (() => void) => {
      routes.push(route);
      return () => undefined;
    },
  };
  const connection = { requestRejection: (): 401 | 403 | undefined => rejection };
  // 09/11/2026 (Lead duyệt): plugin nay BAT BUOC seam `subprocess.resolveExecutable` (stock lib/index.js:391-392 ném khi
  // thiếu). Context giả phải cấp seam y như kernel thật, nếu không apply ném và mọi ca plugin sẽ đỏ oan.
  const subprocess = { resolveExecutable: async (ten: string): Promise<string> => ten };
  const ctx = {
    get: (service: string) =>
      service === "webServer" ? webServer : service === "connection" ? connection : service === "subprocess" ? subprocess : undefined,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    effect: (callback: () => () => void) => {
      harnessCount.effects += 1;
      callback();
    },
  };
  apply(ctx as never, Config({} as never) as never);
  return {
    routes,
    effects: harnessCount.effects,
    call: async (path, init = {}) => {
      const route = routes.find((entry) => (entry.kind === "exact" ? entry.path === path : path.startsWith(entry.path + "/")));
      if (route === undefined) throw new Error("khong co route cho " + path);
      const chunks = init.body === undefined ? [] : [init.body];
      const req = {
        method: init.method ?? "GET",
        url: path,
        headers: init.headers ?? {},
        async *[Symbol.asyncIterator]() {
          for (const chunk of chunks) yield chunk;
        },
      } as unknown as IncomingMessage;
      const headers: Record<string, string> = {};
      const parts: Buffer[] = [];
      let status = 0;
      const res = {
        writeHead: (code: number, extra?: Record<string, string>) => {
          status = code;
          Object.assign(headers, extra ?? {});
          return res;
        },
        end: (chunk?: unknown) => {
          if (chunk !== undefined && chunk !== null) parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
          return res;
        },
      } as unknown as ServerResponse;
      await route.handler(req, res);
      return { status, headers, body: Buffer.concat(parts) };
    },
  };
}

/** Bo dem effect giua cac lan dung harness. */
const harnessCount = { effects: 0 };

/**
 * KHÓA HÀNH VI (09/11/2026, Lead + review chốt cách (a)): chỗ NÉM phải nằm trong HÀM THUẦN `resolveInternals`
 * — đúng như DSH stock (`lib/index.js:391-392` ném trong `resolveInternals`, KHÔNG ném trong `apply()`).
 * Vì thế `apply()` thiếu seam vẫn phải đăng ký đủ route (không chết cả plugin), còn hàm thuần thì fail-loud.
 */
describe("hàng rào seam subprocess (chốt hành vi 09/11/2026 — cách (a) như DSH)", () => {
  test("apply() KHÔNG ném khi thiếu seam, nhưng resolveInternals() NÉM (fail-loud đúng chỗ)", () => {
    const ctxThieuSeam = {
      get: (service: string) =>
        service === "webServer"
          ? { register: () => () => undefined }
          : service === "connection"
            ? { requestRejection: () => undefined }
            : undefined,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
      effect: () => () => undefined,
    };
    // apply() KHÔNG được ném khi thiếu seam (3 route vẫn phải đăng ký được như stock)
    expect(() => apply(ctxThieuSeam as never, Config({} as never) as never)).not.toThrow();
    // nhưng hàm thuần thì NÉM (fail-loud đúng chỗ như stock lib/index.js:391-392)
    expect(() => resolveInternals({})).toThrow(/thieu seam subprocess\.resolveExecutable/);
  });
});

describe("catalog", () => {
  test("5 id dung thu tu oracle va loc theo bundle ton tai", async () => {
    expect(name).toBe("open-in-app");
    expect(inject).toEqual(["webServer", "connection", "subprocess"]);
    expect(darwinCandidates().map((entry) => entry.id)).toEqual(["finder", "vscode", "xcode", "iterm", "terminal"]);
    const none = await resolveCatalog("darwin", async () => false);
    expect(none).toEqual([]);
    const some = await resolveCatalog("darwin", async (path) => path.includes("Finder"));
    expect(some.map((entry) => entry.id)).toEqual(["finder"]);
    expect(await resolveCatalog("linux", async () => true)).toEqual([]);
  });

  test("lenh mo dung dang open -a <bundle> <path>", () => {
    const finder = darwinCandidates()[0]!;
    const command = openCommand(finder, "/Users/example/Project");
    expect(command.command).toBe("open");
    expect(command.args).toEqual(["-a", "/System/Library/CoreServices/Finder.app", "/Users/example/Project"]);
  });
});

describe("icon: plutil + sips", () => {
  test("trich icon cua mot bundle that ra PNG 128px (dung bang co che upstream)", () => {
    const png = extractBundleIconPng("/System/Library/CoreServices/Finder.app", 10000);
    expect(png).not.toBeNull();
    const bytes = png as Buffer;
    // PNG magic: 89 50 4e 47 0d 0a 1a 0a
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    // IHDR width/height 128x128 (byte 16..23) va mau RGBA (byte 25 = 6).
    expect(bytes.readUInt32BE(16)).toBe(128);
    expect(bytes.readUInt32BE(20)).toBe(128);
    expect(bytes.readUInt8(25)).toBe(6);
  });

  test("bundle khong ton tai tra null (route se 404)", () => {
    expect(extractBundleIconPng("/khong/ton/tai.app", 2000)).toBeNull();
  });
});

describe("plugin open-in-app", () => {
  test("dang ky dung 3 route: apps (exact), icon (prefix), open (exact)", () => {
    const rig = harness();
    expect(rig.routes.map((route) => route.kind + " " + route.path)).toEqual([
      "exact /open-in-app/apps",
      "prefix /open-in-app/icon",
      "exact /open-in-app/open",
    ]);
    expect(rig.effects).toBe(1);
  });

  test("route apps tra JSON dung 5 id va content-type JSON", async () => {
    const rig = harness();
    const result = await rig.call("/open-in-app/apps");
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toContain("application/json");
    const parsed = JSON.parse(result.body.toString("utf8")) as { apps: string[] };
    expect(parsed.apps).toEqual(["finder", "vscode", "xcode", "iterm", "terminal"]);
    expect(result.body.length).toBe(55);
  });

  test("route icon tra PNG 128x128 va 404 khi id la", async () => {
    const rig = harness();
    const found = await rig.call("/open-in-app/icon/finder");
    expect(found.status).toBe(200);
    expect(found.headers["content-type"]).toBe("image/png");
    expect(found.body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(found.body.readUInt32BE(16)).toBe(128);
    const missing = await rig.call("/open-in-app/icon/khong-co");
    expect(missing.status).toBe(404);
  });

  test("hang rao tin cay: connection tu choi thi tra 401 va KHONG tra du lieu", async () => {
    const rig = harness(401);
    const blocked = await rig.call("/open-in-app/apps");
    expect(blocked.status).toBe(401);
    expect(blocked.body.length).toBe(0);
    const rig403 = harness(403);
    expect((await rig403.call("/open-in-app/icon/finder")).status).toBe(403);
  });

  test("route open: chan method/media-type/qua kho, va validate app + path", async () => {
    const rig = harness();
    const json = { "content-type": "application/json" };
    expect((await rig.call("/open-in-app/open")).status).toBe(405);
    expect((await rig.call("/open-in-app/open", { method: "POST", headers: { "content-type": "text/plain" } })).status).toBe(415);
    const huge = Buffer.alloc(70 * 1024, 0x61);
    expect((await rig.call("/open-in-app/open", { method: "POST", headers: json, body: huge })).status).toBe(413);
    const badApp = Buffer.from(JSON.stringify({ app: "khong-co", path: "/tmp" }), "utf8");
    expect((await rig.call("/open-in-app/open", { method: "POST", headers: json, body: badApp })).status).toBe(400);
    const badPath = Buffer.from(JSON.stringify({ app: "finder", path: "tuong-doi" }), "utf8");
    expect((await rig.call("/open-in-app/open", { method: "POST", headers: json, body: badPath })).status).toBe(400);
    // Bai hoc ADR 0004 §8: body di qua duong Uint8Array (khong phai Buffer) van phai doc dung byte.
    const uint8 = new Uint8Array(badApp.buffer.slice(badApp.byteOffset, badApp.byteOffset + badApp.byteLength));
    const result = await rig.call("/open-in-app/open", { method: "POST", headers: json, body: uint8 });
    expect(result.status).toBe(400);
    const parsed = JSON.parse(result.body.toString("utf8")) as { error: { code: string } };
    expect(parsed.error.code).toBe("open-in-app/request");
  });
});
