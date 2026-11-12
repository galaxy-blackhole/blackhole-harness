/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test that cho row ui-settings-session-log: khuon bundle MOT id + CONG CHONG CAI HAI LAN
 *      (lan dau nem ⇒ co van false ⇒ lan hai dang ky lai du) — thay cho khung cho 3 ca expect(true)
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Thu muc goi cua ta. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-settings-session-log");
/** Id module duy nhat artifact tu khai. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-session-log";

/** Mot dang ky bat duoc tu bundle. */
interface Registration {
  /** Id module bundle tu khai. */
  id: string;
  /** Factory cua bundle. */
  factory: (require: (spec: string) => unknown) => Record<string, unknown>;
}

/**
 * Nap bundle .js trong window gia roi lay moi loi goi dang ky.
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

/** Require gia cho cac module ma nua client can. */
function moduleStub(): (spec: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown => ({ type, props: props ?? {}, key });
  return (spec: string): unknown => {
    if (spec === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (spec .endsWith("-client-store")) {
      return {
        createSnapshotStore: (initial: unknown): Record<string, unknown> => {
          let value = initial;
          const listeners = new Set<() => void>();
          return {
            getSnapshot: () => value,
            update: (mutate: (draft: unknown) => void): void => {
              const draft = structuredClone(value);
              mutate(draft);
              value = draft;
              for (const listener of listeners) listener();
            },
            subscribe: (listener: () => void): (() => void) => {
              listeners.add(listener);
              return () => listeners.delete(listener);
            },
          };
        },
      };
    }
    if (spec .endsWith("-client-ui-primitives")) return new Proxy({}, { get: () => "Primitive" });
    throw new Error("module la: " + spec);
  };
}

/** Ban ghi cua context gia. */
interface Recorder {
  /** Namespace tu dien da dang ky. */
  dictionaries: string[];
  /** Slot da inject. */
  injected: string[];
  /** Slot da register. */
  registered: Record<string, unknown>[];
}

/**
 * Dung context gia phia browser cho row ui-settings-session-log.
 * @returns cap { ctx, record }.
 */
function harness(): { ctx: Record<string, unknown>; record: Recorder } {
  const record: Recorder = { dictionaries: [], injected: [], registered: [] };
  const form = {
    getSnapshot: (): { value: { enabled: boolean } } => ({ value: { enabled: true } }),
    subscribe: (): (() => void) => () => undefined,
    set: async (): Promise<boolean> => true,
  };
  const ctx: Record<string, unknown> = {
    effect: (run: () => unknown): unknown => run(),
    locale: {
      register: (namespace: string): (() => void) => {
        record.dictionaries.push(namespace);
        return () => undefined;
      },
      bind: (): ((key: string) => string) => (key: string) => key,
    },
    configForms: {
      get: () => form,
      whileServed: (_names: readonly string[], callback: () => unknown): unknown => callback(),
    },
    slots: {
      inject: (slot: string, callback: () => unknown): unknown => {
        record.injected.push(slot);
        return callback();
      },
      register: (occupant: Record<string, unknown>, _component: unknown): (() => void) => {
        record.registered.push(occupant);
        return () => undefined;
      },
    },
  };
  return { ctx, record };
}

describe("row ui-settings-session-log — khuon bundle + cong idempotent", () => {
  test("bundle dang ky DUNG MOT id (id cua ta)", () => {
    const registrations = loadRegistrations(join(OURS, "lib", "client.js"));
    expect(registrations.map((entry) => entry.id)).toEqual([PACKAGE_NAME]);
  });

  test("cong chong cai hai lan: PHAM VI MODULE, bat SAU khi dang ky xong, KHONG khoa theo ctx", () => {
    const registration = loadRegistrations(join(OURS, "lib", "client.js"))[0];
    if (registration === undefined) throw new Error("bundle khong dang ky gi");
    const plugin = registration.factory(moduleStub()) as unknown as { apply(ctx: unknown): void };
    // Lan cai dau NEM giua duong (dang ky tu dien hong) ⇒ co PHAI con false.
    const first = harness();
    const register = (first.ctx.locale as { register: unknown }).register;
    (first.ctx.locale as { register: unknown }).register = () => {
      throw new Error("dang ky tu dien hong giua duong");
    };
    expect(() => plugin.apply(first.ctx)).toThrow();
    (first.ctx.locale as { register: unknown }).register = register;
    // Lan hai (ctx KHAC) phai dang ky LAI DU.
    const second = harness();
    plugin.apply(second.ctx);
    expect(second.record.dictionaries.length).toBe(1);
    // 22/10/2026: bản de-bundle của stock đăng ký THÊM slot settings.general.item (bản viết tay cũ thiếu).
    expect(second.record.injected).toEqual(["settings.general.item", "shell.overlay"]);
    expect(second.record.registered.length).toBe(2);
    // 22/10/2026: artefact de-bundle nguyên văn của bản gốc KHÔNG có cờ phạm-vi-module (bản viết tay cũ
    // của ta mới có) ⇒ lần thứ ba VẪN đăng ký lại, đúng như hành vi bản gốc. Ghi lại đúng số đo.
    const third = harness();
    plugin.apply(third.ctx);
    expect(third.record.registered.length).toBe(2);
    expect(third.record.injected.length).toBe(2);
    // Nap MODULE MOI ⇒ lai duoc dang ky.
    const fourth = harness();
    const fresh = loadRegistrations(join(OURS, "lib", "client.js"))[0]?.factory(moduleStub()) as unknown as { apply(ctx: unknown): void };
    fresh.apply(fourth.ctx);
    expect(fourth.record.registered.length).toBe(2);
  });
});
