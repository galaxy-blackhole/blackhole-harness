/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-client-ui-session: so bề mặt export, inject, hiệu ứng
 *      của apply() và hành vi của adapter với chính bundle gốc của DSH
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "../../packages/client/ui-session/src/ids.ts";

/** Đường dẫn bundle gốc (chỉ đọc). */
const STOCK = join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-session/lib/client.js");
/** Đường dẫn bundle của ta. */
const OURS = join(import.meta.dir, "../../packages/client/ui-session/lib/client.js");

/** Bản ghi những gì apply() gọi trên seam slots. */
interface SlotsLog {
  roots: Record<string, unknown>[];
  scopes: { name: string; adapter: unknown }[];
}

/** Seam slots giả, ĐÚNG hình dạng module thật mà row require. */
function slotsStub(log: SlotsLog): Record<string, unknown> {
  return {
    standardHookPropName: (name: string) => "use" + name.charAt(0).toUpperCase() + name.slice(1),
    bindStoreScope: (value: unknown) => log.scopes.push({ name: "bindStoreScope", adapter: value }),
    provideRoot: (root: Record<string, unknown>) => log.roots.push(root),
    installScope: (name: string, adapter: unknown) => log.scopes.push({ name, adapter }),
  };
}

/** Context giả: effect chạy ngay, ghi lại nhãn hiệu ứng. */
function contextStub(sessions: unknown, log: SlotsLog): { ctx: Record<string, unknown>; effects: string[]; listeners: Record<string, unknown>[] } {
  const effects: string[] = [];
  const listeners: Record<string, unknown>[] = [];
  const ctx = {
    effect: (callback: () => unknown, label?: string) => {
      effects.push(String(label));
      const dispose = callback();
      return typeof dispose === "function" ? (dispose as () => void) : () => {};
    },
    sessions,
    slots: slotsStub(log),
    remote: {
      $on: (event: string, listener: (sessionId: string, running: boolean) => void) => {
        listeners.push({ event, listener });
        return () => {};
      },
    },
    remoteAccess: { source: (kind: string, sessionId: string, action: string) => kind + ":" + sessionId + ":" + action },
  };
  return { ctx, effects, listeners };
}

/** Service sessions giả: danh sách phiên có thể theo dõi. */
function sessionsStub(byId: Record<string, { running: boolean; retainedBy: { mainView?: number } }>, phase = "ready"): Record<string, unknown> {
  const listeners = new Set<() => void>();
  const list = {
    value: { ids: Object.keys(byId), byId: Object.fromEntries(Object.entries(byId).map(([id, row]) => [id, { id, ...row }])), phase },
    listeners,
    getSnapshot: () => list.value,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const bindings = new Map<string, unknown>();
  for (const id of Object.keys(byId)) {
    bindings.set(id, {
      sessionId: id,
      ctx: { effect: () => () => {} },
      session: {
        projections: { faceOf: (key: string) => (inner: string) => key + "/" + inner },
        retainedBy: byId[id]?.retainedBy ?? {},
      },
    });
  }
  const retainInfos = new Map<string, unknown>();
  for (const id of Object.keys(byId)) {
    const infoListeners = new Set<() => void>();
    retainInfos.set(id, {
      value: { retainedBy: byId[id]?.retainedBy ?? {} },
      listeners: infoListeners,
      getSnapshot: () => ({ retainedBy: byId[id]?.retainedBy ?? {} }),
      subscribe: (listener: () => void) => {
        infoListeners.add(listener);
        return () => infoListeners.delete(listener);
      },
    });
  }
  return {
    list,
    binding: (sessionId: string) => bindings.get(sessionId),
    retainInfo: (sessionId: string) => retainInfos.get(sessionId),
  };
}

/** require giả ĐÚNG hình dạng module thật. */
function requireStub(log: SlotsLog): (id: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown) => ({ type, props: { ...props, key } });
  return (id: string): unknown => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (id .endsWith("-client-store")) return { notifySubscribers: (listeners: Set<() => void>, label: string) => { void label; for (const listener of [...listeners]) listener(); } };
    if (id .endsWith("-client-ui-slots")) return slotsStub(log);
    if (id === "@deepseek-ai/cordis") {
      return {
        Service: class Service {
          ctx: unknown;
          name: string;
          constructor(ctx: unknown, name: string) {
            this.ctx = ctx;
            this.name = name;
          }
        },
      };
    }
    throw new Error("module lạ: " + id);
  };
}

/** Nạp một bundle trong window giả và trả mọi lời gọi đăng ký. */
async function loadBundle(path: string): Promise<{ id: string; factory: (require: (id: string) => unknown) => Record<string, unknown> }[]> {
  const code = await Bun.file(path).text();
  const seen: { id: string; factory: (require: (id: string) => unknown) => Record<string, unknown> }[] = [];
  new Function("window", code)({
    __ModuleLoader__: {
      load: (registration: { id: string; factory: (require: (id: string) => unknown) => Record<string, unknown> }): void => {
        seen.push(registration);
      },
    },
  });
  return seen;
}

/** Chuẩn hoá tên package của hai bên về một chỗ giữ để so cấu trúc. */
function normalize(value: unknown): unknown {
  // Hàm của hai bên là hai thực thể khác nhau; so theo vai trò chứ không so danh tính.
  if (typeof value === "function") return "Fn";
  if (typeof value === "string") {
    return value.replaceAll(PACKAGE_NAME, "PKG").replaceAll(STOCK_PACKAGE_NAME, "PKG");
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = normalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Bề mặt adapter mà test chạm tới. */
interface AdapterFace {
  /** Nguồn trạng thái phiên. */
  sessionStatus: { getSnapshot(): Map<string, unknown> };
  /** Đăng ký một miền tương tác đang chờ. */
  registerPendingInteraction(
    precedence: (interaction: { key: string; sessionId: string }) => number,
  ): (interaction: { key: string; sessionId: string }, delegate: () => unknown) => () => void;
}

/** Constructor của adapter. */
type UiSessionCtor = new (ctx: unknown, sessions: unknown) => AdapterFace;

/** Hàm apply của row. */
type ApplyFn = (ctx: unknown) => void;

/** Adapter theo phạm vi mà seam slots nhận. */
interface ScopeAdapter {
  /** Nguồn cho một tham chiếu phiên. */
  bindingSource(reference: unknown): { getSnapshot(): unknown };
  /** Render vùng session. */
  renderArea(binding: unknown, props: unknown): unknown;
}

/**
 * Đọc ảnh chụp nguồn của phiên chính từ adapter mà apply() đã cài.
 * Nhận: log seam slots.
 * Trả: giá trị ảnh chụp, hoặc null.
 */
function readCurrent(log: SlotsLog): unknown {
  const scope = log.scopes.find((entry) => entry.name === "session");
  if (scope === undefined) return null;
  const adapter = scope.adapter as { current?: { getSnapshot(): unknown } };
  const source = adapter.current;
  return source === undefined ? null : source.getSnapshot();
}

describe("row ui-session — chống cài hai lần + không nuốt lỗi (sự cố 20:1x)", () => {
  test("ca 1: apply gọi HAI lần ⇒ lần hai là NO-OP (đếm hiệu ứng không tăng)", async () => {
    // Nạp module TƯƠI: cờ `installed` ở phạm vi module sẽ dính giữa các ca nếu dùng chung module.
    const spec: string = "../../packages/client/ui-session/src/plugin.ts?case-idem";
    const fresh = (await import(spec)) as { createPlugin: (requireFn: (id: string) => unknown) => { apply(ctx: unknown): void } };
    const log: SlotsLog = { roots: [], scopes: [] };
    const plugin = fresh.createPlugin(requireStub(log));
    const sessions = sessionsStub({ s1: { running: false, retainedBy: { mainView: 1 } } });
    const first = contextStub(sessions, log);
    plugin.apply(first.ctx);
    const afterFirst = { roots: log.roots.length, scopes: log.scopes.length };
    // Đúng kịch bản thật: hai plugin instance của cùng bundle, CÙNG một ctx ⇒ lần hai là NO-OP.
    plugin.apply(first.ctx);
    expect({ roots: log.roots.length, scopes: log.scopes.length }).toEqual(afterFirst);
    expect(afterFirst.roots).toBe(1);
    // LUẬT CHUNG chốt 17/10/2026: boolean PHẠM VI MODULE, KHÔNG khoá theo ctx — vì ca thật là
    // HAI ENTRY ⇒ HAI CTX (parent.extend({fiber})). Nên ctx MỚI cũng phải bị chặn.
    const second = contextStub(sessions, log);
    plugin.apply(second.ctx);
    expect(second.effects.length).toBe(0);
    expect({ roots: log.roots.length, scopes: log.scopes.length }).toEqual(afterFirst);
  });

  test("ca 2: apply NÉM lỗi ⇒ đúng MỘT dòng console.error VÀ lỗi vẫn được ném tiếp", async () => {
    const spec: string = "../../packages/client/ui-session/src/plugin.ts?case-throw";
    const fresh = (await import(spec)) as { createPlugin: (requireFn: (id: string) => unknown) => { apply(ctx: unknown): void } };
    const log: SlotsLog = { roots: [], scopes: [] };
    const plugin = fresh.createPlugin(requireStub(log));
    const sessions = sessionsStub({ s1: { running: false, retainedBy: { mainView: 1 } } });
    const context = contextStub(sessions, log);
    // Làm seam slots ném ngay ở bước cài đầu tiên.
    (context.ctx as { slots: { provideRoot: () => unknown } }).slots.provideRoot = () => {
      throw new Error("seam slots ném khi cài");
    };
    const original = console.error;
    const logged: unknown[] = [];
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };
    let thrown = "";
    try {
      plugin.apply(context.ctx);
    } catch (error) {
      thrown = String((error as Error).message);
    } finally {
      console.error = original;
    }
    expect(logged.length).toBe(1);
    expect(String((logged[0] as unknown[])[0])).toContain("apply ném lỗi");
    expect(thrown).toBe("seam slots ném khi cài");
  });
});

describe("row ui-session — hình dạng bundle", () => {
  test("bundle của ta đăng ký ĐÚNG MỘT id (id gốc khai ở aliases), KHÔNG có cú pháp ESM", async () => {
    const registrations = await loadBundle(OURS);
    // Luật chốt 17/10: bundle CHỈ tự khai id của ta; id gốc khai ở gbh.row.aliases để tầng nạp phát entry
    // alias trỏ cùng URL — tự đăng ký id gốc là TRÙNG khi row gốc còn bật (check:rows chặn đúng ca đó).
    expect(registrations.map((entry) => entry.id)).toEqual([PACKAGE_NAME]);
    const meta = (await Bun.file(join(import.meta.dir, "../../packages/client/ui-session/package.json")).json()) as {
      gbh: { row: { moduleIds: string[]; aliases: string[] } };
    };
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_PACKAGE_NAME);
    const code = await Bun.file(OURS).text();
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
  });

  test("bề mặt export của factory TRÙNG bản gốc (UiSession · apply · inject)", async () => {
    const take = async (path: string): Promise<Record<string, unknown>> => {
      const registration = (await loadBundle(path))[0];
      if (registration === undefined) throw new Error("bundle không đăng ký gì: " + path);
      return registration.factory(requireStub({ roots: [], scopes: [] }));
    };
    const stock = await take(STOCK);
    const ours = await take(OURS);
    expect(Object.keys(ours ?? {}).sort()).toEqual(Object.keys(stock ?? {}).sort());
    expect(Object.keys(ours ?? {}).sort()).toEqual(["UiSession", "apply", "inject"]);
    expect(normalize(ours?.inject)).toEqual(normalize(stock?.inject));
    expect(normalize(ours?.inject)).toEqual(["sessions", "slots", "remote", "remoteAccess"]);
    expect(typeof ours?.apply).toBe("function");
    expect(typeof ours?.UiSession).toBe("function");
  });
});

describe("row ui-session — đối chứng hành vi với bản gốc", () => {
  test("apply() gọi ĐÚNG chuỗi cấu hình như bản gốc (provideRoot · installScope · provide)", async () => {
    const run = async (path: string): Promise<unknown> => {
      const log: SlotsLog = { roots: [], scopes: [] };
      const registrations = await loadBundle(path);
      const registration = registrations[0];
      if (registration === undefined) throw new Error("bundle không đăng ký gì");
      const factoryExports = registration.factory(requireStub(log));
      const sessions = sessionsStub({ s1: { running: false, retainedBy: { mainView: 1 } } });
      const context = contextStub(sessions, log);
      if (factoryExports === undefined) throw new Error("bundle không cấp apply");
      const applyFn = factoryExports["apply"] as ApplyFn;
      applyFn(context.ctx);
      const root = log.roots[0] ?? {};
      return normalize({
        effectLabels: context.effects,
        remoteEvents: context.listeners.map((entry) => entry.event),
        rootHookNames: Object.keys((root.hooks ?? {}) as object),
        rootKeyedHookNames: Object.keys((root.keyedHooks ?? {}) as object),
        scopeNames: log.scopes.filter((entry) => entry.name !== "bindStoreScope").map((entry) => entry.name),
        adapterKeys: Object.keys(((log.scopes.find((entry) => entry.name === "session")?.adapter ?? {}) as Record<string, unknown>)),
        current: normalize(readCurrent(log)),
      });
    };
    const stock = await run(STOCK);
    const ours = await run(OURS);
    expect(ours).toEqual(stock);
    // Khẳng định đinh: chuỗi cấu hình do row ta cài, đúng như bản gốc.
    const shaped = ours as {
      effectLabels: string[];
      remoteEvents: string[];
      rootHookNames: string[];
      rootKeyedHookNames: string[];
      scopeNames: string[];
      adapterKeys: string[];
      current: { key?: string; props: Record<string, unknown> };
    };
    expect(shaped.effectLabels).toEqual(["ui-session: Session binding projection", "uiSession.provide()"]);
    expect(shaped.remoteEvents).toEqual(["api-session/status"]);
    expect(shaped.rootHookNames).toEqual(["sessions", "sessionStatus"]);
    expect(shaped.rootKeyedHookNames).toEqual(["sessionRetainInfo", "sessionAccess"]);
    expect(shaped.scopeNames).toEqual(["session"]);
    expect(shaped.adapterKeys).toEqual(["current", "bindingSource", "renderArea"]);
    expect(shaped.current.key).toBe("s1");
    expect(shaped.current.props).toEqual({ sessionId: "s1" });
  });

  test("trạng thái phiên và tương tác đang chờ HÀNH XỬ như bản gốc", async () => {
    const run = async (path: string): Promise<unknown> => {
      const log: SlotsLog = { roots: [], scopes: [] };
      const registrations = await loadBundle(path);
      const registration = registrations[0];
      if (registration === undefined) throw new Error("bundle không đăng ký gì");
      const factoryExports = registration.factory(requireStub(log));
      const sessions = sessionsStub({ s1: { running: true, retainedBy: { mainView: 1 } }, s2: { running: false, retainedBy: {} } });
      const context = contextStub(sessions, log);
      const ctorRaw = factoryExports === undefined ? undefined : factoryExports["UiSession"];
      if (typeof ctorRaw !== "function") throw new Error("bundle không cấp UiSession");
      const UiSession = ctorRaw as UiSessionCtor;
      const service = new UiSession(context.ctx, sessions);
      const status = service.sessionStatus.getSnapshot();
      const publish = service.registerPendingInteraction(() => 5);
      const released: string[] = [];
      const unpublish = publish({ key: "k1", sessionId: "s2" }, () => released.push("d1"));
      const afterPublish = [...service.sessionStatus.getSnapshot().entries()].map(([id, value]) => [id, normalize(value)]);
      // Khoá trùng phải ném ĐÚNG thông điệp của bản gốc.
      let duplicate = "";
      try {
        publish({ key: "k1", sessionId: "s2" }, () => undefined);
      } catch (error) {
        duplicate = String((error as Error).message);
      }
      unpublish();
      const afterRelease = [...service.sessionStatus.getSnapshot().keys()];
      return normalize({
        initial: [...status.entries()].map(([id, value]) => [id, normalize(value)]),
        afterPublish,
        afterRelease,
        duplicate,
        released,
      });
    };
    const stock = await run(STOCK);
    const ours = await run(OURS);
    expect(ours).toEqual(stock);
    expect((ours as { duplicate: string }).duplicate).toBe("ui-session: duplicate pending interaction key 'k1'");
  });

  test("liên kết vắng mặt và phạm vi phiên dựng ĐÚNG cây như bản gốc", async () => {
    const run = async (path: string): Promise<unknown> => {
      const log: SlotsLog = { roots: [], scopes: [] };
      const registrations = await loadBundle(path);
      const registration = registrations[0];
      if (registration === undefined) throw new Error("bundle không đăng ký gì");
      const factoryExports = registration.factory(requireStub(log));
      const sessions = sessionsStub({ s1: { running: true, retainedBy: { mainView: 1 } } });
      const context = contextStub(sessions, log);
      if (factoryExports === undefined) throw new Error("bundle không cấp apply");
      const applyFn = factoryExports["apply"] as ApplyFn;
      applyFn(context.ctx);
      const scope = log.scopes.find((entry) => entry.name === "session");
      if (scope === undefined) throw new Error("apply() không cài phạm vi nào");
      const adapter = scope.adapter as ScopeAdapter;
      const absent = adapter.bindingSource(undefined).getSnapshot();
      const bindingOf = sessions.binding as (sessionId: string) => unknown;
      const bound = adapter.bindingSource({ binding: bindingOf("s1"), sessionId: "s1" }).getSnapshot();
      return normalize({
        absent,
        bound,
        empty: adapter.renderArea(absent, { empty: () => "EMPTY", children: "CHILD" }),
        filled: adapter.renderArea(bound, { empty: () => "EMPTY", children: "CHILD" }),
      });
    };
    const stock = await run(STOCK);
    const ours = await run(OURS);
    expect(ours).toEqual(stock);
  });
});
