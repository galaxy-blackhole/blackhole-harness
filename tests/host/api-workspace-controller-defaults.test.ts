/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test TÁCH RIÊNG cho phần "thư mục lần dùng đầu" của @galaxy-blackhole/gbh-api-workspace-controller
 *      (tách khỏi api-workspace-controller.test.ts vì tệp đó đã chạm ngưỡng 1000 dòng): A/B với bản gốc —
 *      hành vi (lệnh native + lỗi) phải y hệt, ĐƯỜNG DẪN thì sai khác CÓ CHỦ Ý (`Documents/galaxy`), kèm ca
 *      TƯƠNG THÍCH chứng minh Workspace cũ dưới `deepseek-harness` vẫn mở được và không bị tạo trùng.
 */
import { describe, expect, test } from "bun:test";
import { join, posix, win32 } from "node:path";
import { pathToFileURL } from "node:url";

const REPO = join(import.meta.dir, "..", "..");
const PKG = join(REPO, "packages", "host", "api-workspace-controller");
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-workspace-controller");
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
const WORKSPACE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-workspace", "lib", "index.js");
const CREATED = "2026-01-01T00:00:00.000Z";
const EMPTY = { path: "/", home: "/", crumbs: [], entries: [], truncated: false };

/** Module defaults của một bên. */
interface Defaults {
  DEFAULT_WORKSPACE_DIRECTORY: string;
  /** Tên thư mục CHA — chỉ bản của ta xuất (bản gốc viết cứng "deepseek-harness", sai khác CÓ CHỦ Ý 11/11/2026). */
  WORKSPACE_PARENT_DIRECTORY?: string;
  validateDocumentsDirectory(directory: string, platform?: string): string;
  defaultWorkspaceDirectory(documentsDirectory: string | undefined, signal: AbortSignal, internals?: Record<string, unknown>): Promise<string>;
}

/** Module controller của một bên (chỉ phần tệp này dùng). */
interface Mod {
  WorkspaceController: new (ctx: unknown, config?: Record<string, unknown>) => any;
}

/** Một Workspace giả. */
interface Ws {
  id: string;
  path: string;
  title: string;
  sessionIds: string[];
  createdAt: string;
  updatedAt: string;
}

const { Context: ContextCtor } = (await import(pathToFileURL(CORDIS).href)) as { Context: new () => any };
const W = (await import(pathToFileURL(WORKSPACE).href)) as any;
const oursDefaults = (await import(pathToFileURL(join(PKG, "src", "defaults.ts")).href)) as Defaults;
// Stock KHÔNG xuất helper defaults ở lib/index.js; oracle là module nội bộ CHỈ ĐỌC của chính gói đó.
const stockDefaults = (await import(pathToFileURL(join(STOCK_PKG, "lib", "types", "default-directory.js")).href)) as Defaults;
/** Bản ta: import ARTEFACT đã build trong repo (tệp A/B riêng đã chứng minh build sinh đúng artefact). */
const ours = (await import(pathToFileURL(join(PKG, "lib", "index.js")).href)) as Mod;
const stock = (await import(pathToFileURL(join(STOCK_PKG, "lib", "index.js")).href)) as Mod;

/** Một Workspace giả mới. */
function ws(id: string, path: string, title: string, sessionIds: string[] = []): Ws {
  return { id, path, title, sessionIds: [...sessionIds], createdAt: CREATED, updatedAt: CREATED };
}

/** Chuẩn hoá một giá trị bị ném (đủ cho ba ca của tệp này). */
function failureOf(error: any): any {
  return { name: error?.name, code: typeof error?.code === "string" ? error.code : undefined, message: error?.message };
}

/** Chạy một phép gọi và trả lỗi đã chuẩn hoá. */
async function rejection(run: () => Promise<unknown> | unknown): Promise<any> {
  try {
    return { code: "KHONG NEM", message: "tra ve: " + JSON.stringify(await run()) };
  } catch (error) {
    return failureOf(error);
  }
}

/**
 * Dựng giàn tối thiểu: Context cordis THẬT + sổ Workspace GIẢ (chỉ phần `initializeDefault` cần).
 * @param plugin - module controller (ta hoặc bản gốc).
 * @param o - workspaces có sẵn, config, và hàm `initialize` mô phỏng nhánh chặn của sổ đăng ký.
 * @returns service, sổ giả (items) và Context thật.
 */
function rig(plugin: Mod, o: any = {}): any {
  const items: Ws[] = o.workspaces ?? [];
  const absolute = (path: string): void => {
    if (!posix.isAbsolute(path)) throw new TypeError("Workspace path is not fully qualified: '" + path + "'");
  };
  const registry = {
    list: () => [...items],
    get: (id: string) => items.find((workspace) => workspace.id === String(id)),
    resolveByPath: async (path: string) => {
      absolute(path);
      return items.find((workspace) => workspace.path === path);
    },
    create: async (path: string) => {
      absolute(path);
      const workspace = ws("w" + String(items.length + 1), path, posix.basename(path));
      items.push(workspace);
      return workspace;
    },
    initializeDefault: async (resolve: () => Promise<string>) => (o.initialize === undefined ? undefined : o.initialize(resolve)),
    get archivedSessionIds() {
      return [];
    },
    get pinnedSessionIds() {
      return [];
    },
  };
  const real = new ContextCtor();
  real.provide("directoryPicker", {
    capability: () => ({ kind: "browse", list: async () => EMPTY, createDirectory: async (path: string, name: string) => path + "/" + name }),
  });
  const ctx = new Proxy(real as any, {
    get(target, prop) {
      if (prop === "workspaceRegistry") return registry;
      if (prop === "remoteAccess") return { allows: () => true };
      if (prop === "typert") return { resources: { register: () => () => undefined } };
      if (prop === "logger") return { error() {}, warn() {}, info() {} };
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { service: new plugin.WorkspaceController(ctx, o.config ?? {}), real, items };
}

/** Chạy CÙNG kịch bản trên bản ta rồi bản gốc. */
async function both<T>(run: (plugin: Mod) => Promise<T>): Promise<[T, T]> {
  return [await run(ours), await run(stock)];
}

describe("defaults + thư mục lần dùng đầu (tách riêng, 11/11/2026)", () => {
  test("defaultWorkspaceDirectory: override · darwin/win32/linux stub · abort (A/B)", async () => {
    const cases = [
      { platform: "darwin", override: undefined, stdout: "/Users/x/Documents\n", abort: false },
      { platform: "win32", override: undefined, stdout: "C:\\Users\\x\\Documents\r\n", abort: false },
      { platform: "linux", override: undefined, stdout: "/home/x/Documents\n", abort: false },
      { platform: "linux", override: undefined, stdout: "/home/x\n", abort: false },
      { platform: "linux", override: undefined, stdout: "\n", abort: false },
      { platform: "aix", override: undefined, stdout: "", abort: false },
      { platform: "darwin", override: "/Volumes/Docs", stdout: undefined, abort: false },
      { platform: "darwin", override: undefined, stdout: "/Users/x/Documents\n", abort: true },
    ] as any[];
    const probe = async (module: Defaults, item: any) => {
      const calls: any[] = [];
      const controller = new AbortController();
      if (item.abort) controller.abort();
      const internals = {
        platform: item.platform,
        home: "/home/x",
        run: async (command: string, args: string[], _signal: AbortSignal, mode: string) => {
          calls.push({ command, args, mode });
          if (item.stdout === undefined) throw new Error("native command must not run");
          return { stdout: item.stdout };
        },
      };
      try {
        return { value: await module.defaultWorkspaceDirectory(item.override, controller.signal, internals), calls };
      } catch (error) {
        return { failure: failureOf(error), calls };
      }
    };
    const ourTrace = await Promise.all(cases.map((item) => probe(oursDefaults, item)));
    const stockTrace = await Promise.all(cases.map((item) => probe(stockDefaults, item)));
    /* HÀNH VI (lệnh native đã chạy) y hệt bản gốc; chỉ ĐƯỜNG DẪN thành công là sai khác có chủ ý. */
    expect(ourTrace.map((entry) => entry.calls)).toEqual(stockTrace.map((entry) => entry.calls));
    expect(ourTrace.map((entry) => entry.failure?.message)).toEqual(stockTrace.map((entry) => entry.failure?.message));
    expect(ourTrace.map((entry) => entry.value ?? entry.failure?.message)).toEqual([
      posix.join("/Users/x/Documents", "galaxy", "default-workspace"),
      win32.join("C:\\Users\\x\\Documents", "galaxy", "default-workspace"),
      posix.join("/home/x/Documents", "galaxy", "default-workspace"),
      "system Documents directory is unavailable",
      "system Documents directory is unavailable",
      "system Documents directory is unavailable on aix",
      posix.join("/Volumes/Docs", "galaxy", "default-workspace"),
      "The operation was aborted.",
    ]);
    /* KHOÁ SAI KHÁC: bản gốc vẫn ở deepseek-harness — ai "sửa" test cho khớp bản gốc thì ca này đỏ. */
    expect(stockTrace.map((entry) => entry.value ?? entry.failure?.message)).toEqual([
      posix.join("/Users/x/Documents", "deepseek-harness", "default-workspace"),
      win32.join("C:\\Users\\x\\Documents", "deepseek-harness", "default-workspace"),
      posix.join("/home/x/Documents", "deepseek-harness", "default-workspace"),
      "system Documents directory is unavailable",
      "system Documents directory is unavailable",
      "system Documents directory is unavailable on aix",
      posix.join("/Volumes/Docs", "deepseek-harness", "default-workspace"),
      "The operation was aborted.",
    ]);
    expect(oursDefaults.DEFAULT_WORKSPACE_DIRECTORY).toBe("default-workspace");
    expect(oursDefaults.WORKSPACE_PARENT_DIRECTORY).toBe("galaxy");
  });

  test("initializeDefault qua service: override Documents · undefined · abort (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const resolved: string[] = [];
      const side = rig(plugin, {
        config: { documentsDirectory: "/Volumes/Docs" },
        initialize: async (resolve: () => Promise<string>) => {
          const path = await resolve();
          resolved.push(path);
          return ws("default", path, "default-workspace");
        },
      });
      const value = await side.service.initializeDefault(new AbortController().signal);
      const missingSide = rig(plugin, { initialize: async () => undefined });
      const missing = await missingSide.service.initializeDefault(new AbortController().signal);
      const controller = new AbortController();
      controller.abort();
      const abortFailure = await rejection(() => side.service.initializeDefault(controller.signal));
      return { value, resolved, missing, abortFailure };
    });
    /* So A/B sau khi quy thư mục cha của TA về thư mục cha của bản gốc: mọi thứ khác phải y hệt. */
    const quyVeGoc = (value: unknown): unknown => JSON.parse(JSON.stringify(value).split("/galaxy/").join("/deepseek-harness/"));
    expect(quyVeGoc(trace[0])).toEqual(trace[1]);
    expect(trace[0].value).toEqual({
      workspace: {
        workspaceId: "default",
        path: posix.join("/Volumes/Docs", "galaxy", "default-workspace"),
        title: "default-workspace",
        sessionIds: [],
        createdAt: CREATED,
        updatedAt: CREATED,
      },
    });
    expect(trace[0].resolved).toEqual([posix.join("/Volumes/Docs", "galaxy", "default-workspace")]);
    /* Đối chứng: bản gốc vẫn dựng dưới deepseek-harness — phép quy đổi ở trên chỉ chạm đúng một chỗ. */
    expect(trace[1].resolved).toEqual([posix.join("/Volumes/Docs", "deepseek-harness", "default-workspace")]);
    expect(trace[0].missing).toBeUndefined();
    expect(trace[0].abortFailure).toMatchObject({ name: "AbortError", message: "The operation was aborted." });
  });

  test("TƯƠNG THÍCH: Workspace cũ dưới deepseek-harness vẫn mở được, KHÔNG tạo bản mới dưới galaxy", async () => {
    /* Hai điều phải cùng đúng để người dùng cũ không mất gì:
       (1) đường dẫn đã đăng ký được ĐỌC LẠI NGUYÊN VĂN (không di trú, không viết lại) — sổ đăng ký lưu đường
           dẫn tuyệt đối trong `storages/workspace.json`, nên đổi thư mục mặc định KHÔNG chạm tới nó;
       (2) Host KHÔNG dựng bản mặc định mới khi sổ đã có Workspace nào (hợp đồng của dsh-workspace
           `initializeDefault`: `state.workspaceIds.length > 0 || … ⇒ undefined`). */
    const OLD = "/Users/x/Documents/deepseek-harness/default-workspace";
    const resolved: string[] = [];
    const trace = await both(async (plugin) => {
      const side = rig(plugin, {
        config: { documentsDirectory: "/Users/x/Documents" },
        workspaces: [ws("old", OLD, "default-workspace")],
        initialize: async (resolve: () => Promise<string>) => {
          /* Mô phỏng ĐÚNG nhánh chặn của sổ đăng ký: đã có Workspace ⇒ không gọi resolve, không tạo gì. */
          if (side.items.length > 0) return undefined;
          const path = await resolve();
          resolved.push(path);
          return ws("default", path, "default-workspace");
        },
      });
      const before = side.items.map((item: Ws) => ({ id: item.id, path: item.path }));
      const value = await side.service.initializeDefault(new AbortController().signal);
      const after = side.items.map((item: Ws) => ({ id: item.id, path: item.path }));
      return { value, before, after };
    });
    expect(trace[0]).toEqual(trace[1]);
    /* Không tạo bản trùng: vẫn đúng MỘT Workspace, đường dẫn cũ nguyên văn, và không ai gọi resolver. */
    expect(trace[0].value).toBeUndefined();
    expect(trace[0].after).toEqual([{ id: "old", path: OLD }]);
    expect(trace[0].before).toEqual(trace[0].after);
    expect(resolved).toEqual([]);
    /* Vẫn mở được: sổ đăng ký (nguồn của feed Workspace ở UI) giữ ĐÚNG đường dẫn cũ — không di trú, không mất. */
    expect(trace[0].after.map((entry: { path: string }) => entry.path)).toEqual([OLD]);
  });
});
