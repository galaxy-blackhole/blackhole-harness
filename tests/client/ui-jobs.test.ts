/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test that cho row ui-jobs: khuon bundle MOT id + CONG CHONG CAI HAI LAN (lan dau nem ⇒ co van false
 *      ⇒ lan hai dang ky lai du) — thay cho khung cho 3 ca expect(true) truoc day
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Thu muc goi cua ta. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-jobs");
/** Ten package cua ta — id duy nhat artifact tu khai. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-jobs";

/** Mot dang ky bat duoc tu bundle. */
interface Registration {
  /** Id module bundle tu khai. */
  id: string;
  /** Factory cua bundle. */
  factory: (require: (spec: string) => unknown) => Record<string, unknown>;
}

/**
 * Nap bundle .js trong window gia roi lay MOI loi goi dang ky.
 * @param path - duong dan bundle da build.
 * @returns danh sach dang ky (moi lan nap la mot INSTANCE MODULE moi).
 */
function loadRegistrations(path: string): Registration[] {
  const seen: Registration[] = [];
  const loader = {
    load: (registration: Registration): void => {
      seen.push(registration);
    },
  };
  // Bundle ui-jobs goi THANG globalThis.__ModuleLoader__ (khong qua window) ⇒ phai gan ca hai.
  const globals = globalThis as unknown as { __ModuleLoader__?: unknown };
  const before = globals.__ModuleLoader__;
  globals.__ModuleLoader__ = loader;
  try {
    new Function("window", readFileSync(path, "utf8"))({ __ModuleLoader__: loader });
  } finally {
    globals.__ModuleLoader__ = before;
  }
  return seen;
}

/** Require gia cho Cac module ma nua client ui-jobs can. */
function moduleStub(): (spec: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown => ({ type, props: props ?? {}, key });
  return (spec: string): unknown => {
    if (spec === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (spec === "react") {
      return {
        Fragment: "Fragment",
        useState: (initial: unknown): [unknown, () => void] => [initial, () => undefined],
        useRef: (initial: unknown): { current: unknown } => ({ current: initial }),
        useEffect: (): void => undefined,
        useMemo: (factory: () => unknown): unknown => factory(),
        useCallback: (fn: unknown): unknown => fn,
        memo: (component: unknown): unknown => component,
      };
    }
    if (spec === "react-dom") return { createPortal: (node: unknown): unknown => node };
    // Nguyen thuy: chi can ton tai o luc DUNG component (test nay khong render).
    if (spec .endsWith("-client-ui-primitives")) return new Proxy({}, { get: () => "Primitive" });
    throw new Error("module la: " + spec);
  };
}

/** Ban ghi cua context gia. */
interface Recorder {
  /** Nhan hieu ung. */
  effects: string[];
  /** Namespace tu dien da dang ky. */
  dictionaries: string[];
  /** Slot da inject. */
  injected: string[];
  /** Slot da register. */
  registered: Record<string, unknown>[];
}

/**
 * Dung context gia phia browser cho row ui-jobs.
 * @returns cap { ctx, record }.
 */
function harness(): { ctx: Record<string, unknown>; record: Recorder } {
  const record: Recorder = { effects: [], dictionaries: [], injected: [], registered: [] };
  const ctx: Record<string, unknown> = {
    effect: (run: () => unknown, label?: string): unknown => {
      record.effects.push(label ?? "?");
      return run();
    },
    locale: {
      register: (namespace: string): (() => void) => {
        record.dictionaries.push(namespace);
        return () => undefined;
      },
      bind: (): ((key: string) => string) => (key: string) => key,
    },
    slots: {
      inject: (slot: string, callback: () => unknown): unknown => {
        record.injected.push(slot);
        return callback();
      },
      register: (occupant: Record<string, unknown>): (() => void) => {
        record.registered.push(occupant);
        return () => undefined;
      },
    },
    jobs: {
      state: { getSnapshot: () => ({}), subscribe: () => () => undefined },
      watchRows: (): (() => void) => () => undefined,
      observe: (): (() => void) => () => undefined,
      kill: async (): Promise<{ ok: boolean }> => ({ ok: true }),
    },
  };
  return { ctx, record };
}

describe("row ui-jobs — khuon bundle + cong idempotent", () => {
  test("bundle dang ky DUNG MOT id (id cua ta)", () => {
    const registrations = loadRegistrations(join(OURS, "lib", "client.js"));
    expect(registrations.map((entry) => entry.id)).toEqual([PACKAGE_NAME]);
  });

  test("cong chong cai hai lan: PHAM VI MODULE, bat SAU khi dang ky xong, KHONG khoa theo ctx", () => {
    // MOT instance module ap cho BA ctx khac nhau (dung ca that HAI ENTRY ⇒ HAI ctx).
    const registration = loadRegistrations(join(OURS, "lib", "client.js"))[0];
    if (registration === undefined) throw new Error("bundle khong dang ky gi");
    const plugin = registration.factory(moduleStub()) as unknown as { apply(ctx: unknown): void };
    const first = harness();
    const register = (first.ctx.locale as { register: (ns: string, ...rest: unknown[]) => unknown }).register;
    (first.ctx.locale as { register: unknown }).register = () => {
      throw new Error("dang ky tu dien hong giua duong");
    };
    expect(() => plugin.apply(first.ctx)).toThrow();
    (first.ctx.locale as { register: unknown }).register = register;
    // Lan hai (ctx KHAC) phai dang ky LAI DU — co chi duoc bat sau khi applyInner xong.
    const second = harness();
    plugin.apply(second.ctx);
    expect(second.record.dictionaries).toEqual(["job"]);
    expect(second.record.injected).toEqual(["conversation.session.header.actions"]);
    expect(second.record.registered.length).toBe(1);
    // Lan thu ba: bản gốc KHÔNG có latch phạm vi module — mỗi ctx tự đăng ký đủ (đúng hành vi stock sau de-bundle).
    const third = harness();
    plugin.apply(third.ctx);
    expect(third.record.dictionaries).toEqual(["job"]);
    // Bản gốc đăng ký slot occupant ở MỖI ctx (không có latch phạm vi module) ⇒ 1, không phải 0.
    expect(third.record.registered.length).toBe(1);
    // Nạp MODULE MỚI ⇒ vẫn đăng ký như mọi lần (hành vi stock: không khoá theo module).
    const freshRegistration = loadRegistrations(join(OURS, "lib", "client.js"))[0];
    const fresh = freshRegistration?.factory(moduleStub()) as unknown as { apply(ctx: unknown): void };
    const fourth = harness();
    fresh.apply(fourth.ctx);
    expect(fourth.record.registered.length).toBe(1);
  });
});
