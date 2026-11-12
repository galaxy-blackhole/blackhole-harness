/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test A/B cho NỬA HOST của @galaxy-blackhole/gbh-api-workspace-controller: hai giàn giống hệt nhau
 *      trên Context cordis THẬT + sổ Workspace GIẢ + seam chọn thư mục GIẢ, chạy CẢ bản ta (build từ
 *      build.ts) lẫn bundle gốc — so feed, 8 lệnh, chọn thư mục và defaults.
 *      11/11/2026: thư mục mặc định đổi sang `Documents/galaxy` (sai khác CÓ CHỦ Ý) — A/B so HÀNH VI (lệnh native
 *      + lỗi) và KHOÁ riêng hai đầu đường dẫn; thêm ca TƯƠNG THÍCH cho Workspace cũ dưới `deepseek-harness`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, win32 } from "node:path";
import { pathToFileURL } from "node:url";

const REPO = join(import.meta.dir, "..", "..");
const PKG = join(REPO, "packages", "host", "api-workspace-controller");
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-workspace-controller");
const STOCK = join(STOCK_PKG, "lib", "index.js");
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
const WORKSPACE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-workspace", "lib", "index.js");
const PICKER = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-host-directory-picker", "lib", "index.js");
const CREATED = "2026-01-01T00:00:00.000Z";
const UPDATED = "2026-01-02T00:00:00.000Z";
const EMPTY = { path: "/", home: "/", crumbs: [], entries: [], truncated: false };

/** Một Workspace giả. */
interface Ws {
  id: string;
  path: string;
  title: string;
  sessionIds: string[];
  createdAt: string;
  updatedAt: string;
  setTitle(title: string): Promise<void>;
  insertSessionBefore(sessionId: string, beforeSessionId?: string): Promise<void>;
}

/** Module controller hai bên. */
interface Mod {
  WorkspaceController: new (ctx: any, config?: Record<string, unknown>) => any;
  DirectoryPickerController: new (ctx: any) => any;
  default: unknown;
}

/** Module defaults của một bên. */
interface Defaults {
  DEFAULT_WORKSPACE_DIRECTORY: string;
  /** Tên thư mục CHA — chỉ bản của ta xuất (bản gốc viết cứng "deepseek-harness", sai khác CÓ CHỦ Ý 11/11/2026). */
  WORKSPACE_PARENT_DIRECTORY?: string;
  validateDocumentsDirectory(directory: string, platform?: string): string;
  defaultWorkspaceDirectory(documentsDirectory: string | undefined, signal: AbortSignal, internals?: Record<string, unknown>): Promise<string>;
}

const { Context: ContextCtor } = (await import(pathToFileURL(CORDIS).href)) as { Context: new () => any };
const W = (await import(pathToFileURL(WORKSPACE).href)) as any;
const { DirectoryPickerError } = (await import(pathToFileURL(PICKER).href)) as {
  DirectoryPickerError: new (code: string, path: string, message: string) => Error;
};
const oursFeed = (await import(pathToFileURL(join(PKG, "src", "feed.ts")).href)) as { workspaceView(w: unknown): unknown };
const stockFeed = (await import(pathToFileURL(join(STOCK_PKG, "lib", "types", "feed.js")).href)) as { workspaceView(w: unknown): unknown };
const oursDefaults = (await import(pathToFileURL(join(PKG, "src", "defaults.ts")).href)) as Defaults;
// stock không xuất helper defaults ở lib/index.js; oracle là module nội bộ CHỈ ĐỌC của chính gói đó.
const stockDefaults = (await import(pathToFileURL(join(STOCK_PKG, "lib", "types", "default-directory.js")).href)) as Defaults;

let TEMP = "";

/** Build gói ta vào mkdtemp, symlink node_modules, chờ tối đa 240s cho nguồn ổn định. */
async function buildOurs(): Promise<string> {
  TEMP = mkdtempSync(join(tmpdir(), "gbh-awc-"));
  const deadline = Date.now() + 240_000;
  const { buildPackage } = (await import(pathToFileURL(join(PKG, "build.ts")).href)) as {
    buildPackage(outDir?: string): Promise<string>;
  };
  for (;;) {
    try {
      const artifact = await buildPackage(TEMP);
      symlinkSync(join(PKG, "node_modules"), join(dirname(artifact), "node_modules"), "dir");
      return artifact;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

const ARTIFACT = await buildOurs();
const ours = (await import(pathToFileURL(ARTIFACT).href + "?v=" + Date.now())) as Mod;
const stock = (await import(pathToFileURL(STOCK).href)) as Mod;

afterAll(() => {
  if (TEMP !== "") rmSync(TEMP, { recursive: true, force: true });
});

/** Một Workspace giả mới. */
function ws(id: string, path: string, title: string, sessionIds: string[] = []): Ws {
  return {
    id,
    path,
    title,
    sessionIds: [...sessionIds],
    createdAt: CREATED,
    updatedAt: CREATED,
    async setTitle(next: string): Promise<void> {
      this.title = next;
      this.updatedAt = UPDATED;
    },
    async insertSessionBefore(sessionId: string, beforeSessionId?: string): Promise<void> {
      if (!this.sessionIds.includes(sessionId)) {
        throw new W.WorkspaceMoveInvalidError(
          "cannot move session '" + sessionId + "' in workspace '" + this.path + "': the session is not accounted",
        );
      }
      if (beforeSessionId !== undefined && !this.sessionIds.includes(beforeSessionId)) {
        throw new W.WorkspaceMoveInvalidError(
          "cannot move session '" + sessionId + "' before '" + beforeSessionId + "' in workspace '" + this.path + "': the anchor session is not accounted",
        );
      }
      if (beforeSessionId === sessionId) return;
      const without = this.sessionIds.filter((value) => value !== sessionId);
      const at = beforeSessionId === undefined ? without.length : without.indexOf(beforeSessionId);
      this.sessionIds = [...without.slice(0, at), sessionId, ...without.slice(at)];
    },
  };
}

const alpha = (): Ws => ws("w1", "/ws/alpha", "alpha", ["s1", "s2"]);
const beta = (): Ws => ws("w2", "/ws/beta", "beta", ["s3"]);
const alphaView = (): Record<string, unknown> => ({
  workspaceId: "w1",
  path: "/ws/alpha",
  title: "alpha",
  sessionIds: ["s1", "s2"],
  createdAt: CREATED,
  updatedAt: CREATED,
});
const betaView = (): Record<string, unknown> => ({
  workspaceId: "w2",
  path: "/ws/beta",
  title: "beta",
  sessionIds: ["s3"],
  createdAt: CREATED,
  updatedAt: CREATED,
});
const recordOf = (workspace: Ws): Record<string, unknown> => ({
  path: workspace.path,
  title: workspace.title,
  sessionIds: [...workspace.sessionIds],
  createdAt: workspace.createdAt,
  updatedAt: workspace.updatedAt,
});
const fail = (code: string, details: unknown, cause?: unknown): Record<string, unknown> => ({
  code,
  details,
  marker: true,
  name: "RemoteError",
  ...(cause === undefined ? {} : { cause }),
});

/** Chuẩn hoá một giá trị bị ném. */
function failureOf(error: any): any {
  const c = error?.cause;
  const cause =
    c === undefined
      ? undefined
      : c instanceof Error
        ? {
            name: c.name,
            message: c.message,
            ...(typeof (c as any).code === "string" ? { code: (c as any).code } : {}),
            ...(typeof (c as any).path === "string" ? { path: (c as any).path } : {}),
            ...((c as any).activity === undefined ? {} : { activity: (c as any).activity }),
          }
        : String(c);
  return {
    name: error?.name,
    code: typeof error?.code === "string" ? error.code : undefined,
    message: error?.message,
    details: error?.details,
    marker: error?.isDSHRemoteError,
    cause,
  };
}

/** Chạy một phép gọi và trả lỗi đã chuẩn hoá. */
async function rejection(run: () => Promise<unknown> | unknown): Promise<any> {
  try {
    return { code: "KHONG NEM", message: "tra ve: " + JSON.stringify(await run()) };
  } catch (error) {
    return failureOf(error);
  }
}

/** Chạy CÙNG kịch bản trên bản ta rồi bản gốc. */
async function both<T>(run: (plugin: Mod) => Promise<T>): Promise<[T, T]> {
  return [await run(ours), await run(stock)];
}

/** Dựng giàn Workspace trên Context cordis THẬT + sổ đăng ký GIẢ. */
function rig(plugin: Mod, o: any = {}): any {
  const items: Ws[] = o.workspaces ?? [];
  const archived: string[] = [...(o.archived ?? [])];
  const pinned: string[] = [...(o.pinned ?? [])];
  const known = new Set<string>(o.sessions ?? ["s1", "s2", "s3", "s9"]);
  const active: Map<string, unknown[]> = o.active ?? new Map();
  const archiveCalls: { sessionId: string; options: Record<string, unknown> }[] = [];
  const registrations: { kind: string; declaration: unknown }[] = [];
  const access = { allowed: o.allowed ?? (() => true) };
  let nextId = items.length + 1;
  const absolute = (path: string): void => {
    if (!posix.isAbsolute(path)) throw new TypeError("Workspace path is not fully qualified: '" + path + "'");
  };
  const find = (id: string): Ws | undefined => items.find((workspace) => workspace.id === String(id));
  const registry = {
    list: () => [...items],
    get: (id: string) => find(id),
    resolveByPath: async (path: string) => {
      absolute(path);
      return items.find((workspace) => workspace.path === path);
    },
    create: async (path: string) => {
      absolute(path);
      const workspace = ws("w" + nextId++, path, posix.basename(path));
      items.push(workspace);
      return workspace;
    },
    delete: async (id: string) => {
      const at = items.findIndex((workspace) => workspace.id === String(id));
      if (at < 0) return false;
      items.splice(at, 1);
      return true;
    },
    insertBefore: async (id: string, before?: string) => {
      if (find(id) === undefined) throw new W.WorkspaceOrderInvalidError(String(id));
      if (before !== undefined && find(before) === undefined) throw new W.WorkspaceOrderInvalidError(String(before));
      const moved = find(id) as Ws;
      const rest = items.filter((workspace) => workspace !== moved);
      const at = before === undefined ? rest.length : rest.findIndex((workspace) => workspace.id === String(before));
      rest.splice(at, 0, moved);
      items.splice(0, items.length, ...rest);
      return items.map((workspace) => workspace.id);
    },
    archiveSession: async (sessionId: string, options: { stopActivity?: boolean } = {}) => {
      archiveCalls.push({ sessionId: String(sessionId), options });
      const id = String(sessionId);
      if (archived.includes(id)) return;
      if (!known.has(id)) throw new W.WorkspaceUnknownSessionError(id, "archive");
      const activity = active.get(id);
      if (activity !== undefined && options.stopActivity !== true) throw new W.WorkspaceActiveSessionError(id, activity);
      if (activity !== undefined) active.delete(id);
      archived.push(id);
      const pin = pinned.indexOf(id);
      if (pin >= 0) pinned.splice(pin, 1);
    },
    unarchiveSession: async (sessionId: string) => {
      const at = archived.indexOf(String(sessionId));
      if (at >= 0) archived.splice(at, 1);
    },
    pinSession: async (sessionId: string) => {
      const id = String(sessionId);
      if (pinned.includes(id)) return;
      if (archived.includes(id)) throw new W.WorkspaceArchivedSessionPinError(id);
      if (!known.has(id)) throw new W.WorkspaceUnknownSessionError(id, "pin");
      pinned.unshift(id);
    },
    unpinSession: async (sessionId: string) => {
      const at = pinned.indexOf(String(sessionId));
      if (at >= 0) pinned.splice(at, 1);
    },
    initializeDefault: async (resolve: () => Promise<string>) => (o.initialize === undefined ? undefined : o.initialize(resolve)),
    get archivedSessionIds() {
      return [...archived];
    },
    get pinnedSessionIds() {
      return [...pinned];
    },
  };
  const real = new ContextCtor();
  real.provide("directoryPicker", {
    capability: () => ({
      kind: "browse",
      list: async () => EMPTY,
      createDirectory: async (path: string, name: string) => path + "/" + name,
    }),
  });
  const ctx = new Proxy(real as any, {
    get(target, prop) {
      if (prop === "workspaceRegistry") return registry;
      if (prop === "remoteAccess") return { allows: (resource: { kind: string; id: string }) => access.allowed(resource) };
      if (prop === "typert") {
        return {
          resources: {
            register(kind: string, declaration: unknown) {
              registrations.push({ kind, declaration });
              return () => undefined;
            },
          },
        };
      }
      if (prop === "logger") return { error() {}, warn() {}, info() {} };
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return {
    service: new plugin.WorkspaceController(ctx, o.config ?? {}),
    real,
    items,
    archived,
    pinned,
    archiveCalls,
    registrations,
    access,
    emitState: () =>
      real.emit("domain/changed", {
        domain: "workspace",
        table: "",
        operation: "put",
        value: {
          initialized: true,
          workspaceIds: items.map((workspace) => workspace.id),
          archivedSessionIds: [...archived],
          pinnedSessionIds: [...pinned],
        },
      }),
    emitRecord: (id: string, record: Record<string, unknown>) =>
      real.emit("domain/changed", { domain: "workspace", table: "workspaces", operation: "put", key: id, value: record }),
    emitDeleted: (id: string) =>
      real.emit("domain/changed", { domain: "workspace", table: "workspaces", operation: "deleted", key: id }),
  };
}

/** Mở một thế hệ follow. */
function feedOf(side: any): { next(): Promise<any>; close(): Promise<void> } {
  const controller = new AbortController();
  const iterator = side.service.follow(controller.signal)[Symbol.asyncIterator]();
  return {
    next: async () => (await iterator.next()).value,
    close: async () => {
      controller.abort();
      await iterator.return?.(undefined);
    },
  };
}

/** Dựng DirectoryPickerController trên Context thật + năng lực giả. */
function pickerOf(plugin: Mod, capability: any): any {
  const real = new ContextCtor();
  const ctx = new Proxy(real as any, {
    get(target, prop) {
      if (prop === "directoryPicker") return { capability: () => capability };
      if (prop === "logger") return { error() {}, warn() {}, info() {} };
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return new plugin.DirectoryPickerController(ctx);
}

/** Thông điệp lỗi của schema Config (sentinel khi không ném). */
function configFailure(statics: any, raw: unknown): string {
  try {
    statics.Config(raw);
    return "KHONG NEM";
  } catch (error) {
    return (error as Error).message;
  }
}

/** Dựng service với cấu hình hỏng và trả lỗi constructor. */
function constructorFailure(plugin: Mod, config: Record<string, unknown>): any {
  try {
    rig(plugin, { config });
    return { code: "KHONG NEM" };
  } catch (error) {
    return failureOf(error);
  }
}

describe("bề mặt gói + dựng service", () => {
  test("export ARTIFACT BẰNG bản gốc (DirectoryPickerController · WorkspaceController · default)", () => {
    expect(existsSync(ARTIFACT)).toBe(true);
    const names = (module: Mod): string[] => Object.keys(module).sort();
    expect(names(ours)).toEqual(names(stock));
    expect(names(ours)).toEqual(["DirectoryPickerController", "WorkspaceController", "default"]);
    expect(ours.default).toBe(ours.WorkspaceController);
    expect(stock.default).toBe(stock.WorkspaceController);
  });

  test("static inject + Config + marker Remote TRÙNG bản gốc", () => {
    const a = ours.WorkspaceController as any;
    const b = stock.WorkspaceController as any;
    expect(a.inject).toEqual(b.inject);
    expect(a.inject).toEqual(["remoteAccess", "typert", "workspaceRegistry"]);
    expect(String(a.Config)).toBe(String(b.Config));
    expect(a.Config({})).toEqual(b.Config({}));
    expect(a.Config({})).toEqual({ documentsLookupTimeoutMs: 10_000 });
    for (const raw of [{ documentsLookupTimeoutMs: 0 }, { documentsLookupTimeoutMs: 1.5 }, { documentsDirectory: 3 }]) {
      expect(configFailure(a, raw)).toBe(configFailure(b, raw));
      expect(configFailure(a, raw)).not.toBe("KHONG NEM");
    }
    const ra = rig(ours);
    const rb = rig(stock);
    expect(ra.registrations).toEqual(rb.registrations);
    expect(ra.registrations).toEqual([{ kind: "workspace", declaration: { field: "workspaceId" } }]);
    expect((ours.DirectoryPickerController as any).inject).toEqual(["directoryPicker"]);
    const relative = constructorFailure(ours, { documentsDirectory: "relative/docs" });
    expect(relative).toEqual(constructorFailure(stock, { documentsDirectory: "relative/docs" }));
    expect(relative.message).toBe("Documents directory must be fully qualified: 'relative/docs'");
  });
});

describe("feed — baseline + increment", () => {
  test("baseline + workspaceView đủ sáu trường (A/B)", async () => {
    const workspace = ws("w1", "/ws/alpha", "alpha", ["s1", "s2"]);
    expect(oursFeed.workspaceView(workspace)).toEqual(stockFeed.workspaceView(workspace));
    expect(oursFeed.workspaceView(workspace)).toEqual(alphaView());
    const trace = await both(async (plugin) => {
      const side = rig(plugin, { workspaces: [alpha(), beta()], archived: ["s9"], pinned: ["s1"] });
      const feed = feedOf(side);
      try {
        return await feed.next();
      } finally {
        await feed.close();
      }
    });
    expect(trace[0]).toEqual(trace[1]);
    expect(trace[0]).toEqual({
      type: "baseline",
      value: { items: [alphaView(), betaView()], archivedSessionIds: ["s9"], pinnedSessionIds: ["s1"] },
    });
  });

  test("Workspace mới ⇒ upsert rồi order (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const side = rig(plugin, { workspaces: [alpha(), beta()] });
      const feed = feedOf(side);
      await feed.next();
      side.items.push(ws("w3", "/ws/gamma", "gamma"));
      side.emitState();
      const frames = [await feed.next(), await feed.next()];
      await feed.close();
      return frames;
    });
    expect(trace[0]).toEqual(trace[1]);
    expect(trace[0].map((frame: any) => frame.type)).toEqual(["upsert", "order"]);
    expect(trace[0][0].workspace).toEqual({
      workspaceId: "w3",
      path: "/ws/gamma",
      title: "gamma",
      sessionIds: [],
      createdAt: CREATED,
      updatedAt: CREATED,
    });
    expect(trace[0][1]).toEqual({ type: "order", workspaceIds: ["w1", "w2", "w3"] });
  });

  test("cùng nội dung ⇒ KHÔNG frame; archived/pinned + đổi order ⇒ đúng ba frame (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const side = rig(plugin, { workspaces: [alpha(), beta()], archived: ["s9"], pinned: ["s1"] });
      const feed = feedOf(side);
      await feed.next();
      side.emitState();
      side.archived.push("s1", "s2");
      side.pinned.push("s2");
      side.emitState();
      const first = await feed.next();
      const second = await feed.next();
      side.items.reverse();
      side.emitState();
      const third = await feed.next();
      await feed.close();
      return [first, second, third];
    });
    expect(trace[0]).toEqual(trace[1]);
    expect(trace[0]).toEqual([
      { type: "archived", archivedSessionIds: ["s9", "s1", "s2"] },
      { type: "pinned", pinnedSessionIds: ["s1", "s2"] },
      { type: "order", workspaceIds: ["w2", "w1"] },
    ]);
  });

  test("remove + changedWorkspaceView qua domain record (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const removed = rig(plugin, { workspaces: [alpha(), beta()] });
      const feed = feedOf(removed);
      await feed.next();
      removed.items.splice(1, 1);
      removed.emitDeleted("w2");
      removed.emitDeleted("w2");
      removed.emitDeleted("w9");
      removed.items.splice(0, 1);
      removed.emitDeleted("w1");
      const removals = [await feed.next(), await feed.next()];
      await feed.close();
      // stock không xuất changedWorkspaceView; hành vi được đo qua service.follow.
      const changed = rig(plugin, { workspaces: [alpha(), beta()] });
      const changedFeed = feedOf(changed);
      await changedFeed.next();
      const first = changed.items[0] as Ws;
      first.title = "alpha-2";
      first.sessionIds = ["s2"];
      first.updatedAt = UPDATED;
      changed.emitRecord("w1", recordOf(first));
      const upsert = await changedFeed.next();
      changed.emitRecord("w9", { path: "/ws/ghost", title: "ghost", sessionIds: [], createdAt: CREATED, updatedAt: CREATED });
      const second = changed.items[1] as Ws;
      second.title = "beta-2";
      changed.emitRecord("w2", recordOf(second));
      const next = await changedFeed.next();
      await changedFeed.close();
      return { removals, upserts: [upsert, next] };
    });
    expect(trace[0]).toEqual(trace[1]);
    expect(trace[0].removals).toEqual([
      { type: "remove", workspaceId: "w2" },
      { type: "remove", workspaceId: "w1" },
    ]);
    expect(trace[0].upserts[0]).toEqual({
      type: "upsert",
      workspace: {
        workspaceId: "w1",
        path: "/ws/alpha",
        title: "alpha-2",
        sessionIds: ["s2"],
        createdAt: CREATED,
        updatedAt: UPDATED,
      },
    });
    expect(trace[0].upserts[1]).toMatchObject({ type: "upsert", workspace: { workspaceId: "w2", title: "beta-2" } });
  });

  test("remoteAccess lọc baseline + replace khi Workspace đã giao hết được phép (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const side = rig(plugin, { workspaces: [alpha(), beta()] });
      const feed = feedOf(side);
      await feed.next();
      side.access.allowed = (resource: { kind: string; id: string }) =>
        resource.kind === "workspace" ? resource.id === "w1" : resource.id === "s1";
      const second = side.items[1] as Ws;
      second.title = "beta-2";
      side.emitRecord("w2", recordOf(second));
      const replace = await feed.next();
      await feed.close();
      const filtered = rig(plugin, {
        workspaces: [alpha(), beta()],
        allowed: (resource: { kind: string; id: string }) =>
          resource.kind === "workspace" ? resource.id === "w1" : resource.id === "s1",
      });
      const filteredFeed = feedOf(filtered);
      const baseline = await filteredFeed.next();
      await filteredFeed.close();
      return { replace, baseline };
    });
    expect(trace[0]).toEqual(trace[1]);
    const value = { items: [{ ...alphaView(), sessionIds: ["s1"] }], archivedSessionIds: [], pinnedSessionIds: [] };
    expect(trace[0].replace).toEqual({ type: "replace", value });
    expect(trace[0].baseline).toEqual({ type: "baseline", value });
  });

  test("tín hiệu đã huỷ TRƯỚC ⇒ AbortError, không frame (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const side = rig(plugin, { workspaces: [alpha()] });
      const controller = new AbortController();
      controller.abort();
      try {
        await side.service.follow(controller.signal)[Symbol.asyncIterator]().next();
        return { code: "KHONG NEM", message: "co frame" };
      } catch (error) {
        return failureOf(error);
      }
    });
    expect(trace[0]).toEqual(trace[1]);
    expect(trace[0]).toMatchObject({ name: "AbortError", message: "The operation was aborted." });
  });
});

describe("commands — lệnh ghi sổ đăng ký", () => {
  test("create: idempotent + tương đối/win32 ⇒ workspace/invalid-path + cause (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const side = rig(plugin, { workspaces: [alpha()] });
      return [
        await side.service.create({ path: "/ws/alpha" }),
        await side.service.create({ path: "/ws/new" }),
        await rejection(() => side.service.create({ path: "relative/ws" })),
        await rejection(() => side.service.create({ path: "C:\\Users\\ws" })),
      ];
    });
    expect(trace[0]).toEqual(trace[1]);
    const [existing, created, relative, win] = trace[0] as any[];
    expect(existing).toMatchObject({ workspace: alphaView(), created: false });
    expect(created).toMatchObject({ workspace: { workspaceId: "w2", path: "/ws/new", title: "new" }, created: true });
    expect(relative).toMatchObject(
      fail("workspace/invalid-path", { path: "relative/ws" }, {
        name: "TypeError",
        message: "Workspace path is not fully qualified: 'relative/ws'",
      }),
    );
    expect(relative.message).toBe(
      'cannot create a Workspace at "relative/ws": Workspace path is not fully qualified: \'relative/ws\'',
    );
    expect(win).toMatchObject(fail("workspace/invalid-path", { path: "C:\\Users\\ws" }));
  });

  test("rename: thành công · rỗng · trùng tên · không tồn tại (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const side = rig(plugin, { workspaces: [alpha(), beta()] });
      return [
        await side.service.rename({ workspaceId: "w1", title: "  gamma  " }),
        await rejection(() => side.service.rename({ workspaceId: "w1", title: "   " })),
        await rejection(() => side.service.rename({ workspaceId: "w1", title: "beta" })),
        await rejection(() => side.service.rename({ workspaceId: "nope", title: "gamma" })),
      ];
    });
    expect(trace[0]).toEqual(trace[1]);
    const [renamed, blank, conflict, missing] = trace[0] as any[];
    expect(renamed).toMatchObject({ workspace: { ...alphaView(), title: "gamma", updatedAt: UPDATED } });
    expect(blank).toMatchObject(fail("gateway/bad-request", {}));
    expect(blank.message).toBe("Workspace rename requires a non-blank title");
    expect(conflict).toMatchObject(fail("workspace/name-conflict", { name: "beta" }));
    expect(missing).toMatchObject(fail("workspace/not-found", { workspaceId: "nope" }));
  });

  test("delete + insertBefore: biên nhận · thứ tự mới · not-found (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const side = rig(plugin, { workspaces: [alpha(), beta(), ws("w3", "/ws/gamma", "gamma")] });
      return {
        deleted: await side.service.delete({ workspaceId: "w1" }),
        left: side.items.map((workspace: Ws) => workspace.id),
        missingDelete: await rejection(() => side.service.delete({ workspaceId: "nope" })),
        moved: await side.service.insertBefore({ workspaceId: "w3", beforeWorkspaceId: "w2" }),
        tail: await side.service.insertBefore({ workspaceId: "w2" }),
        missingSource: await rejection(() => side.service.insertBefore({ workspaceId: "w9" })),
        missingAnchor: await rejection(() => side.service.insertBefore({ workspaceId: "w3", beforeWorkspaceId: "w9" })),
      };
    });
    expect(trace[0]).toEqual(trace[1]);
    expect(trace[0].deleted).toEqual({ deleted: true });
    expect(trace[0].left).toEqual(["w2", "w3"]);
    expect(trace[0].moved).toEqual({ workspaceIds: ["w3", "w2"] });
    expect(trace[0].tail).toEqual({ workspaceIds: ["w3", "w2"] });
    expect(trace[0].missingDelete).toMatchObject(fail("workspace/not-found", { workspaceId: "nope" }));
    expect(trace[0].missingSource).toMatchObject(fail("workspace/not-found", { workspaceId: "w9" }));
    expect(trace[0].missingAnchor).toMatchObject(fail("workspace/not-found", { workspaceId: "w9" }));
  });

  test("insertSessionBefore: di chuyển + move-invalid kèm details+cause (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const side = rig(plugin, { workspaces: [ws("w1", "/ws/alpha", "alpha", ["s1", "s2", "s3"]), beta()] });
      return [
        await side.service.insertSessionBefore({ workspaceId: "w1", sessionId: "s3", beforeSessionId: "s1" }),
        await side.service.insertSessionBefore({ workspaceId: "w1", sessionId: "s1" }),
        await rejection(() => side.service.insertSessionBefore({ workspaceId: "w1", sessionId: "s9" })),
        await rejection(() => side.service.insertSessionBefore({ workspaceId: "w1", sessionId: "s1", beforeSessionId: "s9" })),
        await rejection(() => side.service.insertSessionBefore({ workspaceId: "nope", sessionId: "s1" })),
      ];
    });
    expect(trace[0]).toEqual(trace[1]);
    const [first, second, unaccounted, anchor, missing] = trace[0] as any[];
    expect(first).toMatchObject({ workspace: { sessionIds: ["s3", "s1", "s2"] } });
    expect(second).toMatchObject({ workspace: { sessionIds: ["s3", "s2", "s1"] } });
    expect(unaccounted).toMatchObject(
      fail("workspace/move-invalid", { workspaceId: "w1", sessionId: "s9" }, {
        name: "WorkspaceMoveInvalidError",
        message: "cannot move session 's9' in workspace '/ws/alpha': the session is not accounted",
      }),
    );
    expect(anchor).toMatchObject(
      fail("workspace/move-invalid", { workspaceId: "w1", sessionId: "s1", beforeSessionId: "s9" }, {
        name: "WorkspaceMoveInvalidError",
        message: "cannot move session 's1' before 's9' in workspace '/ws/alpha': the anchor session is not accounted",
      }),
    );
    expect(missing).toMatchObject(fail("workspace/not-found", { workspaceId: "nope" }));
  });

  test("archive/unarchive: session-active · stopActivity · not-found · idempotent (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const side = rig(plugin, {
        workspaces: [alpha()],
        archived: [],
        sessions: ["s1", "active"],
        active: new Map([["active", [{ kind: "turn" }]]]),
      });
      return {
        values: [
          await side.service.archiveSession({ sessionId: "s1" }),
          await rejection(() => side.service.archiveSession({ sessionId: "active" })),
          await side.service.archiveSession({ sessionId: "active", stopActivity: true }),
          await rejection(() => side.service.archiveSession({ sessionId: "s9" })),
          await side.service.unarchiveSession({ sessionId: "s1" }),
          await side.service.unarchiveSession({ sessionId: "s9" }),
        ],
        calls: side.archiveCalls,
      };
    });
    expect(trace[0]).toEqual(trace[1]);
    const [first, active, stopped, unknown, restored, idempotent] = trace[0].values as any[];
    expect(first).toEqual({ archivedSessionIds: ["s1"] });
    expect(active).toMatchObject(
      fail("workspace/session-active", { sessionId: "active", activity: [{ kind: "turn" }] }, {
        name: "WorkspaceActiveSessionError",
        message: "cannot archive session 'active': the session is active (turn)",
        activity: [{ kind: "turn" }],
      }),
    );
    expect(stopped).toEqual({ archivedSessionIds: ["s1", "active"] });
    expect(unknown).toMatchObject(fail("session/not-found", { sessionId: "s9" }));
    expect(restored).toEqual({ archivedSessionIds: ["active"] });
    expect(idempotent).toEqual({ archivedSessionIds: ["active"] });
    expect(trace[0].calls).toEqual([
      { sessionId: "s1", options: {} },
      { sessionId: "active", options: {} },
      { sessionId: "active", options: { stopActivity: true } },
      { sessionId: "s9", options: {} },
    ]);
  });

  test("pin/unpin: thứ tự ghim · archived-pin · not-found · idempotent (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const side = rig(plugin, { workspaces: [alpha()], archived: ["s9"], sessions: ["s1", "s2", "s9"] });
      return [
        await side.service.pinSession({ sessionId: "s1" }),
        await side.service.pinSession({ sessionId: "s2" }),
        await side.service.pinSession({ sessionId: "s1" }),
        await rejection(() => side.service.pinSession({ sessionId: "s9" })),
        await rejection(() => side.service.pinSession({ sessionId: "s8" })),
        await side.service.unpinSession({ sessionId: "s2" }),
        await side.service.unpinSession({ sessionId: "s8" }),
      ];
    });
    expect(trace[0]).toEqual(trace[1]);
    expect(trace[0][0]).toEqual({ pinnedSessionIds: ["s1"] });
    expect(trace[0][1]).toEqual({ pinnedSessionIds: ["s2", "s1"] });
    expect(trace[0][2]).toEqual({ pinnedSessionIds: ["s2", "s1"] });
    expect(trace[0][3]).toMatchObject(fail("gateway/bad-request", {}));
    expect(trace[0][4]).toMatchObject(fail("session/not-found", { sessionId: "s8" }));
    expect(trace[0][5]).toEqual({ pinnedSessionIds: ["s1"] });
    expect(trace[0][6]).toEqual({ pinnedSessionIds: ["s1"] });
  });

});

describe("directory-picker — chọn thư mục phía Host", () => {
  test("pick: thành công · null · lỗi hạ tầng · abort kèm lý do · unavailable (A/B)", async () => {
    const trace = await both(async (plugin) => {
      let call = 0;
      const native = pickerOf(plugin, { kind: "native", async pick() { return ++call === 1 ? "/chosen" : null; } });
      const plain = pickerOf(plugin, { kind: "native", async pick() { throw new Error("boom"); } });
      const controller = new AbortController();
      controller.abort(new Error("caller gone"));
      const aborted = pickerOf(plugin, { kind: "native", async pick(signal: AbortSignal) { throw signal.reason; } });
      const browseOnly = pickerOf(plugin, { kind: "browse", async list() { return EMPTY; }, async createDirectory() { return "/x"; } });
      return [
        await native.pick(new AbortController().signal),
        await native.pick(new AbortController().signal),
        await rejection(() => plain.pick(new AbortController().signal)),
        await rejection(() => aborted.pick(controller.signal)),
        await rejection(() => browseOnly.pick(new AbortController().signal)),
      ];
    });
    expect(trace[0]).toEqual(trace[1]);
    expect(trace[0].slice(0, 2)).toEqual(["/chosen", null]);
    expect(trace[0][2]).toMatchObject({
      code: "gateway/internal",
      message: "directory picker failed: boom",
      cause: { name: "Error", message: "boom" },
    });
    expect(trace[0][3]).toMatchObject({
      code: "gateway/cancelled",
      message: "directory picker was aborted",
      cause: { name: "Error", message: "caller gone" },
    });
    expect(trace[0][4]).toMatchObject(fail("directory-picker/unavailable", { capability: "browse" }));
  });

  test("list: một cấp · unreadable · abort · thiếu browse ⇒ unavailable (A/B)", async () => {
    const listing = { path: "/a", home: "/home/x", crumbs: [{ name: "/", path: "/", hidden: false }, { name: "a", path: "/a", hidden: false }], entries: [{ name: "b", path: "/a/b", hidden: false }], truncated: false };
    const trace = await both(async (plugin) => {
      const browse = pickerOf(plugin, { kind: "browse", async list(path: string | undefined) { return { ...listing, path: path ?? "/home/x" }; }, async createDirectory() { return "/x"; } });
      const unreadable = pickerOf(plugin, { kind: "browse", async list() { throw new DirectoryPickerError("directory-unreadable", "/secret", "cannot read /secret"); }, async createDirectory() { return "/x"; } });
      const controller = new AbortController();
      controller.abort(new Error("gone"));
      const aborted = pickerOf(plugin, { kind: "browse", async list() { throw controller.signal.reason; }, async createDirectory() { return "/x"; } });
      const nativeOnly = pickerOf(plugin, { kind: "native", async pick() { return null; } });
      return [
        await browse.list("/a", new AbortController().signal),
        await browse.list(undefined, new AbortController().signal),
        await rejection(() => unreadable.list("/secret", new AbortController().signal)),
        await rejection(() => aborted.list("/a", controller.signal)),
        await rejection(() => nativeOnly.list("/a", new AbortController().signal)),
      ];
    });
    expect(trace[0]).toEqual(trace[1]);
    expect(trace[0][0]).toEqual(listing);
    expect(trace[0][1]).toEqual({ ...listing, path: "/home/x" });
    expect(trace[0][2]).toMatchObject(
      fail("directory-picker/unreadable", { path: "/secret" }, {
        name: "DirectoryPickerError",
        message: "cannot read /secret",
        code: "directory-unreadable",
        path: "/secret",
      }),
    );
    expect(trace[0][3]).toMatchObject({ code: "gateway/cancelled", message: "directory listing was aborted" });
    expect(trace[0][4]).toMatchObject(fail("directory-picker/unavailable", { capability: "native" }));
  });

  test("createDirectory: một đoạn hợp lệ + 8 payload hỏng + exists/create-failed/unreadable (A/B)", async () => {
    const trace = await both(async (plugin) => {
      const picker = pickerOf(plugin, { kind: "browse", async list() { return EMPTY; }, async createDirectory(path: string, name: string) { return path + "/" + name; } });
      const failing = (error: Error) => pickerOf(plugin, { kind: "browse", async list() { return EMPTY; }, async createDirectory() { throw error; } });
      const broken = (path: unknown, name: unknown) => rejection(() => picker.createDirectory(path, name));
      return {
        valid: [await picker.createDirectory("/parent", "new"), await picker.createDirectory("/parent", "sub dir")],
        invalid: [
          await broken("/parent", ""),
          await broken("/parent", "   "),
          await broken("/parent", "."),
          await broken("/parent", ".."),
          await broken("/parent", "a/b"),
          await broken("/parent", "a\\b"),
          await broken(undefined, undefined),
          await broken("/parent", 42),
        ],
        browse: [
          await rejection(() =>
            failing(new DirectoryPickerError("directory-exists", "/p/new", "already exists")).createDirectory("/p", "new"),
          ),
          await rejection(() =>
            failing(new DirectoryPickerError("directory-create-failed", "/p/new", "cannot create")).createDirectory("/p", "new"),
          ),
          await rejection(() => failing(new Error("boom")).createDirectory("/p", "new")),
        ],
      };
    });
    expect(trace[0]).toEqual(trace[1]);
    expect(trace[0].valid).toEqual(["/parent/new", "/parent/sub dir"]);
    for (const failure of trace[0].invalid) {
      expect(failure).toMatchObject({
        code: "gateway/bad-request",
        message: "invalid payload for host.createDirectory",
        details: { issues: expect.any(Array) },
        marker: true,
        name: "RemoteError",
      });
    }
    expect(trace[0].invalid[0].details).toEqual({
      issues: [{ code: "custom", path: [], message: "host.createDirectory requires a single non-blank path segment name" }],
    });
    expect(trace[0].browse[0]).toMatchObject(fail("directory-picker/exists", { path: "/p/new" }));
    expect(trace[0].browse[1]).toMatchObject(fail("directory-picker/create-failed", { path: "/p/new" }));
    expect(trace[0].browse[2]).toMatchObject({ code: "gateway/internal", message: "boom" });
  });
});

