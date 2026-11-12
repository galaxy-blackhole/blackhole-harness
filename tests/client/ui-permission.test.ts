/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hanh vi row ui-permission: bundle dang ky 2 id module, 2 slot + 2 tu dien, catalog co chot the he,
 *      hang cai dat ghi dung mot duong dan defaultPreset, popup /permission va hop xac nhan rui ro
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackage } from "../../packages/client/ui-permission/build.ts";
import { makeCatalogDirectory, type PermissionCatalog, type SnapshotStore } from "../../packages/client/ui-permission/src/catalog.ts";
import { makeSettingsController } from "../../packages/client/ui-permission/src/settings-store.ts";
import { makePermissionSelect } from "../../packages/client/ui-permission/src/permission-select.ts";
import {
  displayPermissionPreset,
  displayPresetName,
  optionBadge,
  permissionLabel,
} from "../../packages/client/ui-permission/src/presentation.ts";
import {
  AUTO_REVIEW_PRESET,
  FULL_ACCESS_PRESET,
  NS_ACCESS,
  NS_SETTINGS,
  PACKAGE_NAME,
  STOCK_PACKAGE_NAME,
} from "../../packages/client/ui-permission/src/ids.ts";
import { accessEn, en } from "../../packages/client/ui-permission/src/locales.ts";

/** Store toi gian DUNG hinh dang that (getSnapshot/set/update/subscribe) — khong rong hon. */
function store<T>(initial: T): SnapshotStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    set: (next) => {
      value = next;
      for (const l of listeners) l();
    },
    update: (mutate) => {
      mutate(value);
      for (const l of listeners) l();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Catalog mau giong Host that: 4 lua chon cho phien, 3 lua chon mac dinh (khong co "auto"). */
const CATALOG: PermissionCatalog = {
  options: [
    { value: "read-only", name: "read-only", description: "Chi doc" },
    { value: "workspace-write", name: "workspace-write" },
    { value: FULL_ACCESS_PRESET, name: FULL_ACCESS_PRESET, description: "Toan quyen" },
    { value: AUTO_REVIEW_PRESET, name: AUTO_REVIEW_PRESET },
  ],
  defaultPreset: "workspace-write",
  defaultOptions: [
    { value: "read-only", name: "read-only" },
    { value: "workspace-write", name: "workspace-write" },
    { value: FULL_ACCESS_PRESET, name: FULL_ACCESS_PRESET },
  ],
};

/** Nạp bundle da build trong window gia va tra ve cac dang ky + factory dau tien. */
async function loadRegistration(): Promise<{
  ids: string[];
  factory: (require: (spec: string) => unknown) => { inject: string[]; apply: (ctx: unknown) => void };
}> {
  const out = await mkdtemp(join(tmpdir(), "gbh-permission-"));
  const built = await buildPackage(out);
  const code = readFileSync(built[1] ?? "", "utf8");
  const calls: { id: string; factory: (require: (spec: string) => unknown) => never }[] = [];
  // Bundle doc globalThis.__ModuleLoader__ (trong trinh duyet globalThis === window), nen stub phai nam o globalThis.
  const scope = globalThis as unknown as { __ModuleLoader__?: unknown };
  const previous = scope.__ModuleLoader__;
  // 20/10/2026: artefact de-bundle đăng ký bằng `window.__ModuleLoader__.load(` (đúng khuôn bundle gốc và
  // đúng cổng `check:rows`). Trình duyệt có `window === globalThis`, Bun thì không ⇒ cấp stub.
  const scopeWindow = globalThis as unknown as { window?: unknown };
  const previousWindow = scopeWindow.window;
  scopeWindow.window = globalThis;
  scope.__ModuleLoader__ = {
    load: (registration: { id: string; factory: (require: (spec: string) => unknown) => never }) => calls.push(registration),
  };
  try {
    new Function(code)();
  } finally {
    scope.__ModuleLoader__ = previous;
    if (previousWindow === undefined) delete scopeWindow.window;
    else scopeWindow.window = previousWindow;
  }
  const first = calls[0];
  if (first === undefined) throw new Error("bundle khong dang ky factory nao");
  return { ids: calls.map((c) => c.id), factory: first.factory };
}

describe("ui-permission — be mat bundle", () => {
  test("dang ky DUNG MOT id module (id cua ta) va khong co ESM", async () => {
    const { ids } = await loadRegistration();
    // Khuon #2: id goc KHONG dang ky trong bundle — no di qua gbh.row.aliases de tang nap sinh entry alias.
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_PACKAGE_NAME);
    const out = await mkdtemp(join(tmpdir(), "gbh-permission-src-"));
    const built = await buildPackage(out);
    const code = readFileSync(built[1] ?? "", "utf8");
    expect(/^\s*(import|export)\s/m.test(code)).toBe(false);
  });

  test("inject dung 10 seam cua ban goc va apply dang ky 2 tu dien + 2 slot occupant", async () => {
    const { factory } = await loadRegistration();
    const dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[] = [];
    const occupants: { definition: Record<string, unknown>; component: unknown }[] = [];
    const decorated: Record<string, unknown>[] = [];
    const effects: string[] = [];
    const plugin = factory((spec: string) => {
      if (spec === "react/jsx-runtime") return { jsx: () => undefined, jsxs: () => undefined, Fragment: "Fragment" };
      if (spec === "react") return { useState: (v: unknown) => [v, () => undefined], useEffect: () => undefined };
      if (spec .endsWith("-client-store")) return { createSnapshotStore: store };
      return {
        Menu: "Menu",
        RiskConfirmation: "RiskConfirmation",
        IconChevronDownOutlineRegular: "Chevron",
        PermissionIconReadOnlyRegular: "IcoReadOnly",
        PermissionIconWorkspaceWriteRegular: "IcoWorkspace",
        PermissionIconFullAccessRegular: "IcoFull",
        PermissionIconAutoReviewRegular: "IcoAuto",
      };
    }) as unknown as { inject: string[]; apply: (ctx: unknown) => void };

    expect(plugin.inject).toEqual([
      "commandUi",
      "connection",
      "sessions",
      "slots",
      "locale",
      "remote",
      "remote.permissionPresets",
      "remote.settings",
      "configForms",
      "settingsSchema",
    ]);

    const connection = { generation: { getSnapshot: () => ({ id: "gen-1" }), subscribe: () => () => undefined } };
    const ctx = {
      get: (name: string) =>
        name === "commandUi"
          ? {
              decorate: (definition: Record<string, unknown>) => {
                decorated.push(definition);
                return () => undefined;
              },
              dismiss: () => undefined,
            }
          : connection,
      effect: (callback: () => unknown, label?: string) => {
        effects.push(label ?? "?");
        callback();
      },
      locale: {
        bind: (namespace: string) => (key: string) => namespace + "." + key,
        register: (namespace: string, copy: Record<string, Record<string, string>>) => {
          dictionaries.push({ namespace, copy });
          return () => undefined;
        },
      },
      slots: {
        register: (definition: Record<string, unknown>, component: unknown) => {
          occupants.push({ definition, component });
          return () => undefined;
        },
        inject: (_slot: string, register: () => unknown) => {
          register();
        },
      },
      sessions: { binding: () => undefined },
      configForms: {
        describe: () => ({
          getSnapshot: () => ({ view: undefined, error: null }),
          subscribe: () => () => undefined,
          ensure: async () => undefined,
          acceptView: () => undefined,
        }),
      },
      remote: {
        $on: () => () => undefined,
        permissionPresets: { catalog: async () => ({ ok: true, value: CATALOG }) },
        settings: { mutate: async () => ({ ok: true, value: {} }) },
      },
    };
    plugin.apply(ctx);

    expect(dictionaries.map((d) => d.namespace).sort()).toEqual([NS_ACCESS, NS_SETTINGS]);
    expect(Object.keys(dictionaries.find((d) => d.namespace === NS_SETTINGS)?.copy["en"] ?? {}).length).toBe(12);
    expect(Object.keys(dictionaries.find((d) => d.namespace === NS_ACCESS)?.copy["en"] ?? {}).length).toBe(17);

    expect(occupants.map((o) => o.definition["name"])).toEqual(["settings.general.item", "conversation.input.permission"]);
    const row = occupants[0]?.definition ?? {};
    expect(row["id"]).toBe("permission");
    expect(row["order"]).toBe(-20);
    expect(row["locale"]).toBe(NS_SETTINGS);
    const injected = (row["inject"] as () => Record<string, unknown>)();
    expect(Object.keys(injected)).toEqual(["hooks", "load", "select"]);
    expect(Object.keys(injected["hooks"] as Record<string, unknown>)).toEqual(["permission"]);

    const chipDefinition = occupants[1]?.definition ?? {};
    expect(chipDefinition["locale"]).toBe(NS_ACCESS);
    const chipInjected = (chipDefinition["inject"] as (id: string) => Record<string, unknown>)("s-1");
    expect(Object.keys(chipInjected)).toEqual(["hooks", "select"]);
    expect(Object.keys(chipInjected["hooks"] as Record<string, unknown>)).toEqual(["permissionCatalog"]);

    expect(decorated.length).toBe(1);
    expect(decorated[0]?.["name"]).toBe("permission");
    expect((decorated[0]?.["ui"] as Record<string, unknown>)["kind"]).toBe("popupSelect");
    expect(effects).toContain("ui-permission: /permission decoration");
  });
});

describe("ui-permission — thu muc catalog", () => {
  test("doc duoc catalog, nhip vo hieu khi catalog doi, va xoa gia tri khi doi the he", async () => {
    let generationId: string | undefined = "gen-1";
    let catalogListener: (() => void) | undefined;
    let generationListener: (() => void) | undefined;
    const ctx = {
      get: () => ({
        generation: {
          getSnapshot: () => ({ id: generationId }),
          subscribe: (l: () => void) => {
            generationListener = l;
            return () => undefined;
          },
        },
      }),
      remote: {
        $on: (event: string, listener: () => void) => {
          if (event === "permission-presets/catalog-changed") catalogListener = listener;
          return () => undefined;
        },
        permissionPresets: { catalog: async () => ({ ok: true, value: CATALOG }) },
      },
    };
    const directory = makeCatalogDirectory(ctx as never, store);
    expect(await directory.load()).toEqual(CATALOG);
    expect(directory.store.getSnapshot().value).toEqual(CATALOG);

    catalogListener?.();
    expect(directory.invalidations.getSnapshot().count).toBe(1);
    await directory.load();
    expect(directory.store.getSnapshot().value).toEqual(CATALOG);

    generationId = "gen-2";
    generationListener?.();
    expect(directory.store.getSnapshot().value).toBeNull();
    expect(directory.invalidations.getSnapshot().count).toBe(2);
    directory.dispose();
  });
});

describe("ui-permission — hang cai dat (mac dinh phien moi)", () => {
  /** Dung bo dieu khien voi mot guong describe cho truoc va ghi lai moi lan mutate. */
  function makeController(options: { writable?: boolean; view?: boolean } = {}) {
    const writes: { namespace: string; operations: readonly unknown[]; revision: number }[] = [];
    const snapshot = {
      view:
        options.view === false
          ? undefined
          : {
              writable: options.writable ?? true,
              namespaces: [
                { ns: "permission", revision: 7, value: { defaultPreset: "read-only" } },
                { ns: "other", revision: 1, value: {} },
              ],
            },
      error: null,
    };
    const describeFace = {
      getSnapshot: () => snapshot,
      subscribe: () => () => undefined,
      ensure: async () => undefined,
      acceptView: () => undefined,
    };
    const catalogStore = store({ value: CATALOG });
    const controller = makeSettingsController(
      describeFace as never,
      {
        remote: {
          settings: {
            mutate: async (namespace: string, operations: readonly unknown[], revision: number) => {
              writes.push({ namespace, operations, revision });
              return { ok: true, value: snapshot.view };
            },
          },
        },
      } as never,
      { store: catalogStore, load: async () => CATALOG },
      store,
    );
    return { controller, writes };
  }

  test("derive ra gia tri + lua chon tu descriptor va catalog", async () => {
    const { controller } = makeController();
    await controller.load();
    const state = controller.store.getSnapshot();
    expect(state.status).toBe("ready");
    expect(state.writable).toBe(true);
    expect(state.currentValue).toBe("read-only");
    expect(state.revision).toBe(7);
    expect(state.options.map((o) => o.id)).toEqual(["read-only", "workspace-write", FULL_ACCESS_PRESET]);
    expect(state.options[2]?.label).toBe("Full access");
  });

  test("select ghi DUNG mot duong dan defaultPreset kem revision cua descriptor", async () => {
    const { controller, writes } = makeController();
    await controller.load();
    await controller.select(FULL_ACCESS_PRESET);
    expect(writes).toEqual([
      { namespace: "permission", operations: [{ op: "set", path: ["defaultPreset"], value: FULL_ACCESS_PRESET }], revision: 7 },
    ]);
  });

  test("khong ghi khi Host khong cho phep hoac khong cong bo namespace", async () => {
    const readOnly = makeController({ writable: false });
    await readOnly.controller.load();
    await readOnly.controller.select(FULL_ACCESS_PRESET);
    expect(readOnly.writes.length).toBe(0);

    const missing = makeController({ view: false });
    await missing.controller.load();
    await missing.controller.select(FULL_ACCESS_PRESET);
    expect(missing.writes.length).toBe(0);
  });
});

describe("ui-permission — hien thi va chip quyen", () => {
  test("nhan san pham, kebab-case va nhan cua Host", () => {
    expect(displayPresetName("read-only")).toBe("Read Only");
    expect(displayPresetName("do-not-touch")).toBe("Do Not Touch");
    expect(displayPresetName("Nhan cua Host")).toBe("Nhan cua Host");
    expect(displayPermissionPreset("workspace-write", "workspace-write")).toBe("Workspace Write");
    expect(displayPermissionPreset("workspace-write", "workspace-write", (key) => en[key])).toBe("Workspace Write");
    expect(displayPermissionPreset("custom-preset", "custom-preset")).toBe("Custom Preset");
    expect(displayPermissionPreset("read-only", "Chi xem")).toBe("Chi xem");
  });

  test("auto lay copy tu tu dien va mang badge EXP; cac preset khac khong co badge", () => {
    const t = (key: keyof typeof accessEn): string => accessEn[key];
    expect(permissionLabel(AUTO_REVIEW_PRESET, AUTO_REVIEW_PRESET, t)).toBe("Auto review");
    expect(optionBadge(AUTO_REVIEW_PRESET, t)).toBe("EXP");
    expect(optionBadge("read-only", t)).toBeUndefined();
    expect(permissionLabel("read-only", "read-only", t)).toBe("Read Only");
  });

  test("chip quyen tra null khi thieu projection/catalog, va ve nhan hien hanh khi du", () => {
    const tree = (type: unknown, props: Record<string, unknown>): unknown => ({ type, props });
    const runtime = { jsx: tree, jsxs: tree, Fragment: "Fragment" };
    const react = { useState: (v: unknown) => [v, () => undefined], useEffect: () => undefined };
    const primitives = { Menu: "Menu", RiskConfirmation: "RiskConfirmation", IconChevronDownOutlineRegular: "Chevron" };
    const Select = makePermissionSelect(runtime as never, react as never, primitives as never, new Map());
    const select = async (): Promise<boolean> => true;

    expect(
      Select({
        locked: false,
        select,
        usePermissionCatalog: () => null,
        useProjection: () => ({ currentValue: "read-only" }),
        t: (key: string) => key,
      }),
    ).toBeNull();
    const withCatalog = Select({
      locked: false,
      select,
      usePermissionCatalog: () => CATALOG,
      useProjection: () => ({ currentValue: AUTO_REVIEW_PRESET }),
      t: (key: string) => key,
    }) as { props: { children: unknown[] } };
    const menu = withCatalog.props.children[0] as { props: { items: { id: string; label: unknown }[]; selectedId: string } };
    expect(menu.props.selectedId).toBe(AUTO_REVIEW_PRESET);
    expect(menu.props.items.length).toBe(4);
    const autoItem = menu.props.items.find((i) => i.id === AUTO_REVIEW_PRESET) as { label: { props: { "aria-label": string } } };
    expect(autoItem.label.props["aria-label"]).toBe("auto.label auto.badge");
  });
});

describe("ui-permission — vo bao ve apply (bundle HAI id)", () => {
  /** Dung mot ctx toi thieu chi de dem so lan dang ky (khong can day du seam). */
  function countingContext(throwOnRegister = false) {
    const seen = { dictionaries: 0, occupants: 0, injectedSlots: 0, effects: 0 };
    const connection = { generation: { getSnapshot: () => ({ id: "gen-1" }), subscribe: () => () => undefined } };
    const ctx = {
      get: (name: string) =>
        name === "commandUi"
          ? { decorate: () => () => undefined, dismiss: () => undefined }
          : connection,
      effect: (callback: () => unknown) => {
        seen.effects += 1;
        callback();
      },
      locale: {
        bind: () => (key: string) => key,
        register: () => {
          seen.dictionaries += 1;
          return () => undefined;
        },
      },
      slots: {
        register: () => {
          if (throwOnRegister) throw new Error("slot da duoc dang ky");
          seen.occupants += 1;
          return () => undefined;
        },
        inject: (_slot: string, register: () => unknown) => {
          seen.injectedSlots += 1;
          register();
        },
      },
      sessions: { binding: () => undefined },
      configForms: {
        describe: () => ({
          getSnapshot: () => ({ view: undefined, error: null }),
          subscribe: () => () => undefined,
          ensure: async () => undefined,
          acceptView: () => undefined,
        }),
      },
      remote: {
        $on: () => () => undefined,
        permissionPresets: { catalog: async () => ({ ok: true, value: CATALOG }) },
        settings: { mutate: async () => ({ ok: true, value: {} }) },
      },
    };
    return { ctx, seen };
  }

  /** Seed require dung hinh dang that (khong rong hon). */
  const seed = (spec: string): unknown => {
    if (spec === "react/jsx-runtime") return { jsx: () => undefined, jsxs: () => undefined, Fragment: "Fragment" };
    if (spec === "react") return { useState: (v: unknown) => [v, () => undefined], useEffect: () => undefined };
    if (spec .endsWith("-client-store")) return { createSnapshotStore: store };
    return {
      Menu: "Menu",
      RiskConfirmation: "RiskConfirmation",
      IconChevronDownOutlineRegular: "Chevron",
      PermissionIconReadOnlyRegular: "IcoReadOnly",
      PermissionIconWorkspaceWriteRegular: "IcoWorkspace",
      PermissionIconFullAccessRegular: "IcoFull",
      PermissionIconAutoReviewRegular: "IcoAuto",
    };
  };

  test("CANON · ban goc KHONG latch: goi apply HAI lan ⇒ dang ky HAI lan (port 1:1, khong tu chan)", async () => {
    const { factory } = await loadRegistration();
    const plugin = factory(seed) as unknown as { apply: (ctx: unknown) => void };
    const first = countingContext();
    plugin.apply(first.ctx);
    expect(first.seen.occupants).toBe(2);
    expect(first.seen.dictionaries).toBe(2);
    plugin.apply(first.ctx);
    expect(first.seen.occupants).toBe(4);
  });

  test("CANON · factory goi hai lan tra HAI plugin khac nhau, moi plugin co inject/apply nhu ban goc", async () => {
    const { factory } = await loadRegistration();
    const a = factory(seed) as unknown as { inject: string[]; apply: (ctx: unknown) => void };
    const b = factory(seed) as unknown as { inject: string[]; apply: (ctx: unknown) => void };
    expect(a).not.toBe(b);
    expect(typeof a.apply).toBe("function");
    expect(typeof b.apply).toBe("function");
    expect(b.inject).toEqual(a.inject);
  });

  test("apply nem loi thi IN RA roi NEM TIEP (khong nuot loi)", async () => {
    const { factory } = await loadRegistration();
    const plugin = factory(seed) as unknown as { apply: (ctx: unknown) => void };
    const { ctx } = countingContext(true);
    const logged: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };
    let thrown: unknown = null;
    try {
      plugin.apply(ctx);
    } catch (error: unknown) {
      thrown = error;
    } finally {
      console.error = original;
    }
    expect(thrown instanceof Error).toBe(true);
    expect((thrown as Error).message).toContain("slot da duoc dang ky");
    // 20/10/2026 (CANON): bản gốc KHÔNG in log trước khi ném — artefact de-bundle port 1:1 nên cũng không in.
    expect(logged.length).toBe(0);

    // LUAT 18/10/2026: co CHI duoc bat SAU KHI applyInner chay xong. Lan cai vua nem KHONG duoc tinh la
    // "da cai" — neu tinh, lan sau se thoat som va slot khong bao gio duoc dang ky lai (React #130).
    const retry = countingContext();
    plugin.apply(retry.ctx);
    expect(retry.seen.occupants).toBe(2);
    expect(retry.seen.dictionaries).toBe(2);
  });

  test("task-180 · ĐĂNG KÝ qua METHOD của __ModuleLoader__ (Loader dùng `this`) — lỗi gọi không buộc `this` làm module không bao giờ đăng ký", async () => {
    // Loader THẬT lưu module vào CHÍNH nó (`this`). Stub dưới đây cố tình phụ thuộc `this` để bắt lỗi
    // "var f = load; f(...)" — dạng gọi đã làm dòng Permission biến mất trên app thật.
    const scope = globalThis as unknown as { __ModuleLoader__?: unknown };
    const previous = scope.__ModuleLoader__;
    const registered: unknown[] = [];
    const loader = {
      modules: registered,
      load(entry: unknown): void {
        // Chỉ chạy được khi `this` là loader; gọi trích rời ⇒ `this` undefined ⇒ ném.
        (this as { modules: unknown[] }).modules.push(entry);
      },
    };
    // 20/10/2026: artefact de-bundle goi `window.__ModuleLoader__.load(` (dung khuon bundle goc va dung cong
    // `check:rows`). Trong trinh duyet `window === globalThis`; o Bun KHONG co `window` ⇒ cap stub de ca test
    // kiem dung hanh vi that (goi load duoi dang METHOD, Loader phu thuoc `this`).
    const scopeWindow = globalThis as unknown as { window?: unknown };
    const previousWindow = scopeWindow.window;
    scopeWindow.window = globalThis;
    scope.__ModuleLoader__ = loader;
    try {
      const pkgDir = join(import.meta.dir, "..", "..", "packages", "client", "ui-permission");
      await import(join(pkgDir, "lib", "client.js") + "?task180=" + String(Date.now()));
      expect(registered.length).toBe(1);
    } finally {
      if (previous === undefined) delete scope.__ModuleLoader__;
      else scope.__ModuleLoader__ = previous;
      if (previousWindow === undefined) delete scopeWindow.window;
      else scopeWindow.window = previousWindow;
    }
  });
});

