/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test goi product-analytics — khuon bundle mot id tren ARTIFACT, doi chung nua browser va be mat Remote voi chinh bundle goc, cong idempotent, policy va report
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

import { HOST_INJECT, PACKAGE_NAME, POLICY_STREAM_NAME, ROW_NAME, SERVICE_NAME, STOCK_PACKAGE_NAME } from "../../packages/client/product-analytics/src/ids.ts";
import { createAnalyticsService, createPlugin, type ClientContext } from "../../packages/client/product-analytics/src/plugin.ts";
import { ProductAnalytics } from "../../packages/client/product-analytics/src/service.ts";
import { remoteMethods } from "../../packages/client/product-analytics/src/remote-surface.ts";
import { PRODUCT_ATTRIBUTE_KEYS, PRODUCT_EVENT_NAMES, type ProductAnalyticsConfig, type ProductEvent } from "../../packages/client/product-analytics/src/types.ts";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "product-analytics");
/** Thu muc ban goc trong kernel (CHI DOC) — dung de doi chung tung buoc. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-product-analytics", "lib");

/** Mot lan dang ky id module bat duoc tu bundle client. */
interface Registration {
  /** Id module bundle tu khai. */
  id: string;
  /** Factory ma tang nap goi khi vat chat hoa module. */
  factory: (require: (specifier: string) => unknown) => unknown;
}

/**
 * Nap mot bundle client that trong `window` gia va bat lai dang ky cua no.
 * Nhan: file — duong dan bundle da build.
 * Tra: dang ky (id + factory) ma bundle tu khai.
 */
async function loadBundle(file: string): Promise<Registration> {
  let captured: Registration | undefined;
  const global = globalThis as { window?: unknown };
  const previous = global.window;
  global.window = { __ModuleLoader__: { load: (registration: Registration) => { captured = registration; } } };
  try {
    await import(pathToFileURL(file).href + "?case=" + Math.random().toString(36).slice(2));
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
  if (captured === undefined) throw new Error("bundle khong dang ky id nao: " + file);
  return captured;
}

/**
 * `require` gia cho bundle GOC cua DSH (no chi doi lop Service cua cordis).
 * Nhan: specifier — ten module bi require.
 * Tra: module gia tuong ung.
 */
function stockRequire(specifier: string): unknown {
  if (specifier === "@deepseek-ai/cordis") {
    return {
      Service: class {
        /**
         * Base gia: ban goc chi can `super(ctx, name)` chay duoc.
         * Nhan: _ctx — context; _name — ten service.
         */
        constructor(_ctx: unknown, _name: string) {}
      },
    };
  }
  throw new Error("require khong mong doi: " + specifier);
}

/**
 * Liet ke ten export cua mot file ESM da build (khong can import).
 * Nhan: text — noi dung file.
 * Tra: tap ten export.
 */
function exportNames(text: string): Set<string> {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") names.add(name);
    }
  }
  return names;
}

/** Mot khung policy gia de dieu khien luong tu test. */
interface PushedFrame {
  /** Gia tri policy. */
  value: boolean;
  /** Dem so lan Gateway nghie thuc khung. */
  accepted: () => void;
}

/** Context phia trang gia: ghi lai provide/effect/report va cho test day khung policy. */
interface FakeClient {
  /** Context truyen cho plugin. */
  ctx: ClientContext;
  /** Service da duoc phoi theo ten. */
  provided: Map<string, unknown>;
  /** Su kien da goi len Host. */
  reports: ProductEvent[];
  /** Cac ham don dep da dang ky. */
  disposers: (() => void)[];
  /** Lua chon mo luong ($stream) da nhan, hoac undefined khi khong mo. */
  streamOptions: { name: string } | undefined;
  /** So lan luong bi dispose. */
  disposed: number;
  /** So khung da duoc accept. */
  accepted: number;
  /** Day mot khung policy vao luong. */
  push(value: boolean): Promise<void>;
}

/**
 * Dung context phia trang gia (khong keo harness vao test).
 * Nhan: khong co.
 * Tra: context gia kem bo dieu khien de kiem.
 */
function fakeClient(): FakeClient {
  const provided = new Map<string, unknown>();
  const reports: ProductEvent[] = [];
  const disposers: (() => void)[] = [];
  const queue: PushedFrame[] = [];
  let wake: (() => void) | undefined;
  const state = { streamOptions: undefined as { name: string } | undefined, disposed: 0, accepted: 0 };
  const ctx = {
    provide: (name: string, value: unknown) => {
      provided.set(name, value);
      return () => undefined;
    },
    effect: (callback: () => void | (() => void)) => {
      const dispose = callback();
      if (typeof dispose === "function") disposers.push(dispose);
      return () => undefined;
    },
    remote: {
      productAnalytics: {
        report: async (event: ProductEvent) => {
          reports.push(event);
          return undefined;
        },
        watchPolicy: async function* (): AsyncIterable<boolean> { /* ban goc cung khai ham nay; test khong dung */ },
      },
      $stream: (options: { name: string }) => {
        state.streamOptions = options;
        const iterator = {
          next: async (): Promise<IteratorResult<{ value: boolean; accept(): void }>> => {
            while (queue.length === 0) await new Promise<void>((resolve) => { wake = resolve; });
            const frame = queue.shift() as PushedFrame;
            return { done: false, value: { value: frame.value, accept: frame.accepted } };
          },
        };
        return {
          [Symbol.asyncIterator]: () => iterator,
          dispose: () => {
            state.disposed += 1;
          },
        };
      },
    },
  };
  const frame = (value: boolean): PushedFrame => ({ value, accepted: () => { state.accepted += 1; } });
  return {
    ctx: ctx as unknown as ClientContext,
    provided,
    reports,
    disposers,
    get streamOptions() { return state.streamOptions; },
    get disposed() { return state.disposed; },
    get accepted() { return state.accepted; },
    push: async (value: boolean) => {
      queue.push(frame(value));
      wake?.();
      wake = undefined;
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

/** Context Host gia: du cho Service constructor + tra service + event + effect. */
interface FakeHost {
  /** Context truyen cho service. */
  ctx: never;
  /** Cac gia tri settings.configure da nhan. */
  configureCalls: { auto: boolean }[];
  /** Bam mot event cordis cho moi listener. */
  emit(name: string, ...args: unknown[]): void;
  /** Chay moi ham don dep cua effect da dang ky. */
  dispose(): void;
}

/**
 * Dung context Host gia voi tap service cho truoc.
 * Nhan: services — anh xa ten service sang gia tri tra ve cua ctx.get.
 * Tra: context gia kem bo dieu khien event/effect.
 */
function fakeHost(services: Record<string, unknown> = {}): FakeHost {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const disposers: (() => void)[] = [];
  const configureCalls: { auto: boolean }[] = [];
  const child = {
    settings: { configure: (value: { auto: boolean }) => { configureCalls.push(value); } },
    effect: (callback: () => void | (() => void)) => {
      const dispose = callback();
      if (typeof dispose === "function") disposers.push(dispose);
      return () => undefined;
    },
    get: (name: string) => services[name],
  };
  const ctx = {
    reflect: { provide: () => () => undefined },
    get: (name: string) => services[name],
    on: (name: string, listener: (...args: unknown[]) => void) => {
      const set = listeners.get(name) ?? new Set<(...args: unknown[]) => void>();
      set.add(listener);
      listeners.set(name, set);
      return () => {
        set.delete(listener);
      };
    },
    effect: (callback: () => void | (() => void)) => {
      const dispose = callback();
      if (typeof dispose === "function") disposers.push(dispose);
      return () => undefined;
    },
    inject: (_deps: string[], callback: (value: unknown) => void) => {
      callback(child);
      return () => undefined;
    },
    fiber: {},
  };
  return {
    ctx: ctx as never,
    configureCalls,
    emit: (name: string, ...args: unknown[]) => {
      for (const listener of [...(listeners.get(name) ?? [])]) listener(...args);
    },
    dispose: () => {
      for (const dispose of disposers) dispose();
      disposers.length = 0;
    },
  };
}

/**
 * Bo theo doi cong tac enabled gia duoc (observable cua schemastery).
 * Nhan: value — gia tri ban dau.
 * Tra: doi tuong co get() va ham doi gia tri.
 */
function observable(value: boolean): { get(): boolean; set(next: boolean): void } {
  let current = value;
  return {
    get: () => current,
    set: (next: boolean) => {
      current = next;
    },
  };
}
describe("row product-analytics — manifest khai mot id + aliases", () => {
  test("gbh.row: moduleIds = [id ta] · aliases giu id goc · config y ban goc", () => {
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      name: string;
      gbh: { row: { id: string; moduleIds: string[]; aliases: string[]; config: Record<string, unknown>; tests: string[] } };
    };
    expect(meta.name).toBe(PACKAGE_NAME);
    expect(meta.gbh.row.id).toBe(ROW_NAME);
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_PACKAGE_NAME);
    expect(meta.gbh.row.tests.length).toBeGreaterThan(0);
    // Cau hinh giu NGUYEN bo cua row goc trong cay plugin (enabled + appVersion).
    expect(meta.gbh.row.config).toEqual({ enabled: true, appVersion: { js: "process.env.DSH_CLIENT_VERSION" } });
  });

  test("dsh.client: platform web + inject dung goi nhu ban goc", () => {
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { dsh: { client: { platform: string; inject: string[] } } };
    const stock = JSON.parse(readFileSync(join(STOCK, "..", "package.json"), "utf8")) as { dsh: { client: { platform: string; inject: string[] } } };
    expect(meta.dsh.client.platform).toBe(stock.dsh.client.platform);
    // 20/10/2026 — ID goi da REWRITE CO CHU DICH sang @galaxy-blackhole/gbh-*: quy id ta -> id stock roi so
    //   DEEP-EQUAL (sameAfterIdMap, giu THU TU), KHONG noi contains.
    expect(sameAfterIdMap(meta.dsh.client.inject, stock.dsh.client.inject)).toBe(true);
  });
});

describe("nua browser — doi chung voi CHINH bundle goc", () => {
  test("inject trung ban goc va ca hai deu phoi service qua apply", async () => {
    const ours = await loadBundle(join(OURS, "lib", "client.js"));
    const stock = await loadBundle(join(STOCK, "client.js"));
    const oursModule = ours.factory(stockRequire) as { inject: string[]; apply: (ctx: unknown) => void };
    const stockModule = stock.factory(stockRequire) as { inject: string[]; apply: (ctx: unknown) => void };
    expect(oursModule.inject).toEqual(stockModule.inject);
    expect(stockModule.inject).toEqual(["remote", "remote.productAnalytics"]);
    expect(typeof oursModule.apply).toBe("function");
    expect(typeof stockModule.apply).toBe("function");
  });
});
describe("nua browser — hanh vi service productAnalytics", () => {
  test("khong co dshDesktop thi KHONG mo luong policy va track() khong gui gi", () => {
    const fake = fakeClient();
    const service = createAnalyticsService(fake.ctx);
    expect(fake.streamOptions).toBeUndefined();
    expect(service.enabled).toBe(false);
    service.track("sidebar_menu_click", { menu_name: "terminal" });
    expect(fake.reports.length).toBe(0);
  });

  test("co dshDesktop: policy bat/tat quyen thu, accept duoc goi, dispose dong luong", async () => {
    const global = globalThis as { dshDesktop?: unknown };
    global.dshDesktop = {};
    try {
      const fake = fakeClient();
      const service = createAnalyticsService(fake.ctx);
      expect(fake.streamOptions?.name).toBe(POLICY_STREAM_NAME);
      await fake.push(true);
      expect(service.enabled).toBe(true);
      expect(fake.accepted).toBe(1);
      service.track("sidebar_menu_click", { menu_name: "terminal" }, 1700000000000);
      expect(fake.reports).toEqual([
        { eventName: "sidebar_menu_click", attributes: { menu_name: "terminal" }, timestamp: 1700000000000 },
      ]);
      await fake.push(false);
      expect(service.enabled).toBe(false);
      service.track("sidebar_menu_click", { menu_name: "terminal" });
      expect(fake.reports.length).toBe(1);
      service.dispose();
      expect(fake.disposed).toBe(1);
      expect(service.enabled).toBe(false);
    } finally {
      delete global.dshDesktop;
    }
  });
});

describe("nua browser — cong chong cai hai lan", () => {
  test("co PHAM VI MODULE, bat SAU khi applyInner chay xong, va chan lan cai thu hai", async () => {
    const fresh = (await import(pathToFileURL(join(OURS, "src", "plugin.ts")).href + "?fresh=" + Math.random().toString(36).slice(2))) as typeof import("../../packages/client/product-analytics/src/plugin.ts");
    const plugin = fresh.createPlugin(() => undefined);
    expect(plugin.name).toBe(ROW_NAME);
    expect(plugin.inject).toEqual(["remote", "remote.productAnalytics"]);
    // Ca 1: applyInner NEM giua duong (provide hong) ⇒ co KHONG duoc bat ⇒ lan sau con chay that.
    const broken = fakeClient();
    (broken.ctx as unknown as { provide: () => void }).provide = () => {
      throw new Error("provide hong");
    };
    expect(() => plugin.apply(broken.ctx)).toThrow();
    // Ca 2: ctx tot ⇒ phoi service that.
    const good = fakeClient();
    plugin.apply(good.ctx);
    expect(good.provided.has(SERVICE_NAME)).toBe(true);
    expect(good.disposers.length).toBe(1);
    // Ca 3: lan cai thu hai (ctx KHAC) ⇒ NO-OP, khong phoi lai service.
    const second = fakeClient();
    plugin.apply(second.ctx);
    expect(second.provided.size).toBe(0);
  });

  test("ma nguon: co o PHAM VI MODULE va bat SAU loi goi applyInner", () => {
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    const guard = src.indexOf("let bundleInstalled = false;");
    const flip = src.indexOf("bundleInstalled = true;");
    expect(guard).toBeGreaterThan(-1);
    expect(flip).toBeGreaterThan(guard);
    expect(src.indexOf("applyInner(ctx);")).toBeLessThan(flip);
  });
});
describe("nua host — be mat Remote doi chung voi CHINH bundle goc", () => {
  test("dung ba phuong thuc + che do stream nhu ban goc, namespace productAnalytics", async () => {
    const host = fakeHost();
    const stockModule = (await import(pathToFileURL(join(STOCK, "index.js")).href)) as { default: new (ctx: never, config: unknown) => object };
    const ours = new ProductAnalytics(host.ctx, { enabled: true, appVersion: "1.2.3" });
    const theirs = new stockModule.default(host.ctx, { enabled: true, appVersion: "1.2.3" });
    const markers = (service: object): string[] => remoteMethods(service).map((marker) => marker.method + ":" + (marker.mode ?? "direct"));
    expect(markers(ours)).toEqual(markers(theirs));
    expect(markers(ours)).toEqual(["enabled:direct", "watchPolicy:stream", "report:direct"]);
    const binding = (ours as unknown as { typertRemote: { serviceKey: string; namespace: string } }).typertRemote;
    expect(binding.serviceKey).toBe(SERVICE_NAME);
    expect(binding.namespace).toBe(SERVICE_NAME);
    // Inject cua nua host: deepseekAccount la that; productTelemetry tra bang ctx.get luc goi (co ghi ly do o ids.ts).
    expect(ProductAnalytics.inject).toEqual(HOST_INJECT);
    expect(ProductAnalytics.inject).not.toContain("productTelemetry");
    expect(host.configureCalls).toEqual([{ auto: false }]);
  });
});

describe("nua host — hanh vi policy", () => {
  test("enabled() doc config LIVE (khong snapshot) va dispose tat cong tac", () => {
    const host = fakeHost();
    expect(new ProductAnalytics(host.ctx, { enabled: true }).enabled()).toBe(true);
    expect(new ProductAnalytics(host.ctx, { enabled: false }).enabled()).toBe(false);
    expect(new ProductAnalytics(host.ctx, {}).enabled()).toBe(true);
    const toggle = observable(true);
    const live = new ProductAnalytics(host.ctx, { enabled: toggle });
    expect(live.enabled()).toBe(true);
    toggle.set(false);
    expect(live.enabled()).toBe(false);
    const disposed = fakeHost();
    const service = new ProductAnalytics(disposed.ctx, { enabled: true });
    disposed.dispose();
    expect(service.enabled()).toBe(false);
  });

  test("watchPolicy: gia tri dau tien, phat lai khi config doi, ket thuc khi huy", async () => {
    const host = fakeHost();
    const toggle = observable(true);
    const service = new ProductAnalytics(host.ctx, { enabled: toggle });
    const controller = new AbortController();
    const iterator = service.watchPolicy(controller.signal)[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toBe(true);
    toggle.set(false);
    host.emit("loader/volatile-update");
    expect((await iterator.next()).value).toBe(false);
    controller.abort();
    host.emit("loader/volatile-update");
    expect((await iterator.next()).done).toBe(true);
  });
});
/** Backend telemetry gia ghi lai ban ghi de doi chieu. */
interface RecordingSink {
  /** Ban ghi da nhan. */
  records: Record<string, unknown>[];
  /** Ghi mot ban ghi. */
  emit(record: unknown): void;
}

/**
 * Dung backend telemetry gia.
 * Nhan: khong co.
 * Tra: backend ghi lai moi ban ghi.
 */
function recordingSink(): RecordingSink {
  const records: Record<string, unknown>[] = [];
  return {
    records,
    emit: (record: unknown) => {
      records.push(record as Record<string, unknown>);
    },
  };
}

describe("nua host — hanh vi report", () => {
  test("day ban ghi co body + danh tinh thiet bi + app_version", async () => {
    const sink = recordingSink();
    const host = fakeHost({
      deepseekAccount: { getDeviceIdentity: async () => ({ deviceId: "dev-1", userId: "u-1", osVersion: "macOS 26" }) },
      productTelemetry: sink,
    });
    const service = new ProductAnalytics(host.ctx, { enabled: true, appVersion: "1.2.3" });
    await service.report({ eventName: "sidebar_menu_click", attributes: { menu_name: "terminal" }, timestamp: 5 });
    expect(sink.records).toEqual([
      {
        eventName: "sidebar_menu_click",
        body: "sidebar_menu_click",
        timestamp: 5,
        attributes: { menu_name: "terminal", device_id: "dev-1", user_id: "u-1", app_version: "1.2.3", os_version: "macOS 26" },
      },
    ]);
  });

  test("thieu backend productTelemetry thi BO QUA (khac ban goc CO Y) va khong nem", async () => {
    const host = fakeHost({ deepseekAccount: { getDeviceIdentity: async () => ({ deviceId: "dev-1" }) } });
    const service = new ProductAnalytics(host.ctx, { enabled: true, appVersion: "1.2.3" });
    await service.report({ eventName: "desktop_app_launch", attributes: {}, timestamp: 1 });
    expect(service.enabled()).toBe(true);
  });

  test("tat cong tac thi KHONG doc danh tinh va khong day gi", async () => {
    const sink = recordingSink();
    let identityCalls = 0;
    const host = fakeHost({
      deepseekAccount: {
        getDeviceIdentity: async () => {
          identityCalls += 1;
          return {};
        },
      },
      productTelemetry: sink,
    });
    const service = new ProductAnalytics(host.ctx, { enabled: false });
    await service.report({ eventName: "desktop_app_launch", attributes: {}, timestamp: 1 });
    expect(identityCalls).toBe(0);
    expect(sink.records.length).toBe(0);
  });

  test("nha cung cap danh tinh nem loi thi van day ban ghi, chi thieu truong danh tinh", async () => {
    const sink = recordingSink();
    const host = fakeHost({
      deepseekAccount: { getDeviceIdentity: async () => { throw new Error("chua dang nhap"); } },
      productTelemetry: sink,
    });
    const service = new ProductAnalytics(host.ctx, { enabled: true, appVersion: "1.2.3" });
    await service.report({ eventName: "api_key_save_click", attributes: {}, timestamp: 7 });
    expect(sink.records).toEqual([
      { eventName: "api_key_save_click", body: "api_key_save_click", timestamp: 7, attributes: { app_version: "1.2.3" } },
    ]);
  });

  test("session/event compaction/start ⇒ report context_compression dung trigger_type", async () => {
    const sink = recordingSink();
    const host = fakeHost({ deepseekAccount: { getDeviceIdentity: async () => ({}) }, productTelemetry: sink });
    const service = new ProductAnalytics(host.ctx, { enabled: true, appVersion: "1.2.3" });
    expect(service.enabled()).toBe(true);
    host.emit("session/event", { id: "s-1" }, { type: "compaction/start", data: { turn: 4 } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    host.emit("session/event", { id: "s-2" }, { type: "compaction/start", data: { turn: null } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    host.emit("session/event", { id: "s-3" }, { type: "turn/start", data: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sink.records.map((record) => [record.eventName, (record.attributes as Record<string, unknown>).session_id, (record.attributes as Record<string, unknown>).trigger_type])).toEqual([
      ["context_compression", "s-1", "auto"],
      ["context_compression", "s-2", "manual"],
    ]);
  });
});

describe("danh muc su kien — doi chung bang cham cua ban goc", () => {
  test("22 ten su kien va 24 thuoc tinh trung bang cham trong typert.host.js", () => {
    const schema = readFileSync(join(STOCK, "typert.host.js"), "utf8");
    // Ban goc sinh CA hai bien the (union thuong + strictObject) nen moi ten xuat hien hai lan ⇒ so theo TAP.
    const stockEvents = [...new Set([...schema.matchAll(/'eventName': z\.literal\("([^"]+)"\)/g)].map((match) => match[1] as string))];
    const stockKeys = [...new Set([...schema.matchAll(/'(\w+)': z\./g)].map((match) => match[1] as string))].filter((key) => key !== "eventName" && key !== "attributes" && key !== "timestamp");
    expect(stockEvents.length).toBe(22);
    expect([...PRODUCT_EVENT_NAMES].sort()).toEqual([...stockEvents].sort());
    expect([...PRODUCT_ATTRIBUTE_KEYS].sort()).toEqual([...stockKeys].sort());
  });
});

describe("row product-analytics — khuon bundle (doc ARTIFACT da build)", () => {
  test("lib/client.js dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((match) => JSON.parse(match[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Khoa lai: id goc di qua gbh.row.aliases; dang ky no ⇒ bundle chay hai lan ⇒ app trang.
    expect(ids).not.toContain(STOCK_PACKAGE_NAME);
    expect(code.includes(STOCK_PACKAGE_NAME)).toBe(false);
  });

  test("lib/index.js la ban ESM that va xuat lop service o dang default", () => {
    const text = readFileSync(join(OURS, "lib", "index.js"), "utf8");
    expect(existsSync(join(OURS, "lib", "index.js"))).toBe(true);
    expect(exportNames(text).has("default")).toBe(true);
    expect(text.includes("ProductAnalytics")).toBe(true);
  });
});
