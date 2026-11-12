/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-client-ui-sidebar-terminal: so từ điển, phím tắt, kiểu tab,
 *      ba occupant slot và cây render với chính bundle gốc, cộng hình dạng HAI bundle (entry + chunk)
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { en, zh } from "../../packages/client/ui-sidebar-terminal/src/locales.ts";
import { createPlugin as createPluginType } from "../../packages/client/ui-sidebar-terminal/src/plugin.ts";
import { withoutVi, viDictionary } from "../lib/vi-locale.ts";

/**
 * Nạp module plugin TƯƠI cho mỗi ca.
 * Nhận: nhãn ca (tạo spec khác nhau để không dùng chung cờ phạm vi module).
 * Trả: hàm createPlugin của module vừa nạp.
 */
async function freshCreatePlugin(label: string): Promise<typeof createPluginType> {
  const spec: string = "../../packages/client/ui-sidebar-terminal/src/plugin.ts?" + label;
  const fresh = (await import(spec)) as { createPlugin: typeof createPluginType };
  return fresh.createPlugin;
}

/** Bản ghi những gì plugin đăng ký với context giả. */
interface Registration {
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
  shortcuts: Record<string, unknown>[];
  tabTypes: Record<string, unknown>[];
  slots: { slot: string; definition: Record<string, unknown>; component: unknown }[];
  closeHandlers: string[];
}

/** require giả: jsx runtime, react, ui-primitives và chunk giả. */
function moduleStub(counter: { id: number }): ((id: string) => unknown) & { async?: (path: string) => Promise<Record<string, unknown>> } {
  const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown) => ({ type, props: { ...props, key } });
  const stub = ((id: string): unknown => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (id === "react") {
      return {
        useId: () => "id" + String(counter.id++),
        useState: <T,>(initial: T): [T, (value: T) => void] => [initial, () => undefined],
        useRef: <T,>(initial?: T) => ({ current: initial }),
        useEffect: () => undefined,
        useLayoutEffect: () => undefined,
        lazy: () => "Lazy",
        Suspense: "Suspense",
      };
    }
    if (id .endsWith("-client-ui-primitives")) {
      return {
        Button: "Button",
        Menu: "Menu",
        ShortcutKeys: "ShortcutKeys",
        PluginArtworkTerminal: "PluginArtworkTerminal",
        IconChevronDownOutlineRegular: "IconChevronDown",
        IconPlusOutlineRegular: "IconPlus",
      };
    }
    throw new Error("module lạ: " + id);
  }) as ((id: string) => unknown) & { async?: (path: string) => Promise<Record<string, unknown>> };
  stub.async = async () => ({ TerminalBody: "TerminalBody" });
  return stub;
}

/** Dựng context giả ghi lại mọi đăng ký. */
function harness(): { ctx: unknown; registration: Registration } {
  const registration: Registration = { dictionaries: [], shortcuts: [], tabTypes: [], slots: [], closeHandlers: [] };
  const ctx = {
    effect: (callback: () => unknown): unknown => callback(),
    locale: {
      bind: () => (key: string, params?: Record<string, string>) => (params === undefined ? key : key + ":" + JSON.stringify(params)),
      register: (namespace: string, copy: Record<string, Record<string, string>>): void => {
        registration.dictionaries.push({ namespace, copy });
      },
    },
    slots: {
      inject: (slot: string, register: () => unknown): void => {
        register();
        const last = registration.slots[registration.slots.length - 1];
        if (last !== undefined) last.slot = slot;
      },
      register: (definition: Record<string, unknown>, component: unknown): void => {
        registration.slots.push({ slot: "", definition, component });
      },
    },
    sidebarRight: {
      openTabs: { getSnapshot: () => [{ id: "t1", kind: "terminal" }], subscribe: () => () => undefined },
      tabDomain: { occurrence: () => ({ navigation: { getSnapshot: () => ({ params: { terminalId: "term-1" }, address: "content-1" }) } }) },
      commandTarget: () => ({ sessionId: "s1" }),
      openTabFromTarget: () => undefined,
      registerCloseHandler: (kind: string): void => {
        registration.closeHandlers.push(kind);
      },
    },
    sidebarRightTabs: {
      register: (definition: Record<string, unknown>): void => {
        registration.tabTypes.push(definition);
      },
    },
    webTerminals: {
      retainTabs: () => undefined,
      launchShells: async () => ({ shells: [] }),
      selectShell: () => undefined,
      view: () => ({ state: { phase: "loading" }, mount: () => undefined }),
      close: () => undefined,
    },
    theme: { getTheme: () => ({ fontFamilies: { terminal: "" }, fontSizes: { terminal: 12 } }) },
    on: () => () => undefined,
    shortcuts: {
      catalog: { entries: [] },
      register: (definition: Record<string, unknown>): void => {
        registration.shortcuts.push(definition);
      },
    },
  };
  return { ctx, registration };
}

/** Nạp một bundle .js đã build trong window giả rồi lấy lời gọi đăng ký đầu tiên. */
async function loadRegistration(path: string): Promise<{ id: string; chunk?: string; factory: (require: (id: string) => unknown) => unknown }> {
  const code = await Bun.file(path).text();
  const seen: { id: string; chunk?: string; factory: (require: (id: string) => unknown) => unknown }[] = [];
  const fakeWindow = {
    __ModuleLoader__: {
      load: (registration: { id: string; chunk?: string; factory: (require: (id: string) => unknown) => unknown }): void => {
        seen.push(registration);
      },
    },
  };
  new Function("window", code)(fakeWindow);
  const first = seen[0];
  if (first === undefined) throw new Error("bundle không đăng ký gì: " + path);
  return first;
}

/** Chuẩn hoá tên package và tiền tố lớp của hai bên để so cấu trúc. */
function normalize(value: unknown): unknown {
  // Hàm dựng phần tử của hai bên là hai thực thể khác nhau; so theo vai trò chứ không so danh tính.
  if (typeof value === "function") return "Fn";
  if (typeof value === "string") {
    return value
      .replaceAll("@galaxy-blackhole/gbh-client-ui-sidebar-terminal", "PKG")
      .replaceAll("@deepseek-ai/dsh-client-ui-sidebar-terminal", "PKG")
      .replaceAll("gbhTerm_", "LOP_")
      .replaceAll("_UE8Aa_", "LOP_")
      .replaceAll("gbhTermzju_", "GUIDE_")
      .replaceAll("zjup-W_", "GUIDE_")
      .replaceAll("gbhTermyms_", "TITLE_")
      .replaceAll("ymsBma_", "TITLE_");
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = normalize((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

describe("row ui-sidebar-terminal — đối chứng với bản gốc", () => {
  test("từ điển đăng ký TRÙNG KHỚP từng chuỗi với bản gốc", async () => {
    const stockReg = await loadRegistration(join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-sidebar-terminal/lib/client.js"));
    const stock = harness();
    (stockReg.factory(moduleStub({ id: 1 })) as { apply(ctx: unknown): void }).apply(stock.ctx);
    const mine = harness();
    const createPlugin = await freshCreatePlugin("case-1");
    createPlugin(moduleStub({ id: 1 })).apply(mine.ctx as never);
    expect(normalize(withoutVi(mine.registration.dictionaries))).toEqual(normalize(withoutVi(stock.registration.dictionaries)));
    // 18/10/2026 — tiếng Việt là phần THÊM CÓ CHỦ ĐÍCH: vẫn khẳng định nó có mặt và đủ khoá.
    expect(Object.keys(viDictionary(mine.registration.dictionaries) ?? {}).length).toBe(Object.keys(en).length);
    expect(Object.keys(en).length).toBe(Object.keys(zh).length);
    expect(Object.keys(en).length).toBeGreaterThanOrEqual(21);
  });

  test("phím tắt · kiểu tab · ba slot · hàm đóng tab TRÙNG KHỚP cấu trúc với bản gốc", async () => {
    const stockReg = await loadRegistration(join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-sidebar-terminal/lib/client.js"));
    const stock = harness();
    (stockReg.factory(moduleStub({ id: 1 })) as { apply(ctx: unknown): void }).apply(stock.ctx);
    const mine = harness();
    const createPlugin = await freshCreatePlugin("case-2");
    createPlugin(moduleStub({ id: 1 })).apply(mine.ctx as never);
    const shape = (registration: Registration): unknown =>
      normalize({
        shortcutIds: registration.shortcuts.map((entry) => entry.id),
        shortcutDefaults: registration.shortcuts.map((entry) => Object.keys((entry.defaults ?? {}) as object).sort()),
        shortcutRegions: registration.shortcuts.map((entry) => entry.regions),
        tabTypeKind: registration.tabTypes.map((entry) => entry.kind),
        tabTypeGuide: registration.tabTypes.map((entry) => ((entry.guide ?? []) as { id: string; order: number }[]).map((guide) => ({ id: guide.id, order: guide.order }))),
        slots: registration.slots.map((entry) => entry.slot),
        slotKeys: registration.slots.map((entry) => entry.definition.key),
        closeHandlers: registration.closeHandlers,
      });
    expect(shape(mine.registration)).toEqual(shape(stock.registration));
    expect(shape(mine.registration)).toEqual({
      shortcutIds: ["terminal.new"],
      shortcutDefaults: [["desktop:linux", "desktop:macos", "desktop:windows", "web:macos", "web:windows"]],
      shortcutRegions: [["page", "editable", "terminal"]],
      tabTypeKind: ["terminal"],
      tabTypeGuide: [[{ id: "new", order: 20 }]],
      slots: ["sidebar.right.tab.guide.entry", "sidebar.right.pane.tab", "sidebar.right.pane.tab.title"],
      slotKeys: ["PKG", "PKG", "PKG"],
      closeHandlers: ["terminal"],
    });
  });

  test("cây render của TerminalGuide và TerminalTitle TRÙNG KHỚP từng dòng với bản gốc", async () => {
    const stockReg = await loadRegistration(join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-sidebar-terminal/lib/client.js"));
    const stock = harness();
    (stockReg.factory(moduleStub({ id: 7 })) as { apply(ctx: unknown): void }).apply(stock.ctx);
    const mine = harness();
    const createPlugin = await freshCreatePlugin("case-3");
    createPlugin(moduleStub({ id: 7 })).apply(mine.ctx as never);
    const props = {
      title: "Terminal",
      description: "Run commands",
      kind: "new",
      useTabInfo: () => ({ tab: { id: "t1", visible: true, title: "Terminal", actions: { openTab: () => undefined } } }),
      loadShells: async () => ({ shells: [{ path: "/bin/zsh", name: "zsh" }], selectedShell: "/bin/zsh" }),
      selectShell: () => undefined,
      t: (key: string, params?: Record<string, string>) => (params === undefined ? key : key + ":" + JSON.stringify(params)),
      useShortcuts: () => ({ id: "terminal.new", aria: "Control+`", keys: ["Control", "`"] }),
      useTerminal: () => "Terminal",
      view: () => ({ rename: () => undefined }),
    };
    const render = (registration: Registration, index: number): unknown =>
      (registration.slots[index]?.component as (p: Record<string, unknown>) => unknown)(props);
    expect(normalize(render(mine.registration, 0))).toEqual(normalize(render(stock.registration, 0)));
    expect(normalize(render(mine.registration, 2))).toEqual(normalize(render(stock.registration, 2)));
  });
});

describe("row ui-sidebar-terminal — hình dạng hai bundle", () => {
  test("entry đăng ký ĐÚNG MỘT id (id gốc do TẦNG NẠP phát qua aliases), KHÔNG có cú pháp ESM", async () => {
    const code = await Bun.file(join(import.meta.dir, "../../packages/client/ui-sidebar-terminal/lib/client.js")).text();
    const ids: string[] = [];
    new Function("window", code)({ __ModuleLoader__: { load: (registration: { id: string }): void => { ids.push(registration.id); } } });
    // Luật chốt 17/10: bundle CHỈ tự khai id của ta; id gốc khai ở gbh.row.aliases để tầng nạp phát entry
    // alias trỏ cùng URL — tự đăng ký id gốc là TRÙNG khi row gốc còn bật (check:rows chặn đúng ca đó).
    expect(ids.length).toBe(1);
    expect(ids[0]).toBe("@galaxy-blackhole/gbh-client-ui-sidebar-terminal");
    const meta = (await Bun.file(join(import.meta.dir, "../../packages/client/ui-sidebar-terminal/package.json")).json()) as {
      gbh: { row: { moduleIds: string[]; aliases: string[] } };
    };
    expect(meta.gbh.row.moduleIds).toEqual(["@galaxy-blackhole/gbh-client-ui-sidebar-terminal"]);
    expect(meta.gbh.row.aliases).toContain("@deepseek-ai/dsh-client-ui-sidebar-terminal");
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
  });

  test("chunk lazy tự khai id + tên chunk, có xterm BÊN TRONG, không ESM", async () => {
    const path = join(import.meta.dir, "../../packages/client/ui-sidebar-terminal/lib/client.terminal.js");
    const code = await Bun.file(path).text();
    const registration = await loadRegistration(path);
    expect(registration.id).toBe("@galaxy-blackhole/gbh-client-ui-sidebar-terminal");
    expect(registration.chunk).toBe("client.terminal.js");
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
    expect(code.includes("xterm")).toBe(true);
    expect(/require\("@xterm\/xterm"\)/u.test(code)).toBe(false);
    const face = registration.factory(moduleStub({ id: 1 })) as { TerminalBody?: unknown };
    expect(typeof face.TerminalBody).toBe("function");
  });

  test("nửa host export ĐÚNG tập export của bản gốc (apply)", async () => {
    const load = async (path: string): Promise<Record<string, unknown>> => (await import(path)) as Record<string, unknown>;
    const stock = await load(join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-sidebar-terminal/lib/index.js"));
    expect(Object.keys(stock).filter((key) => key !== "default").sort()).toEqual(["apply"]);
    const ours = await load(join(import.meta.dir, "../../packages/client/ui-sidebar-terminal/lib/index.js"));
    expect(Object.keys(ours).filter((key) => key !== "default").sort()).toEqual(["apply"]);
  });

  test("ca chống cài hai lần: apply lần thứ hai cho CÙNG ctx là NO-OP (không thêm đăng ký)", async () => {
    const mine = harness();
    const registration = mine.registration;
    const createPlugin = await freshCreatePlugin("case-4");
    createPlugin(moduleStub({ id: 1 })).apply(mine.ctx as never);
    const afterFirst = {
      slots: registration.slots.length,
      shortcuts: registration.shortcuts.length,
      tabTypes: registration.tabTypes.length,
      dictionaries: registration.dictionaries.length,
    };
    expect(afterFirst.slots + afterFirst.shortcuts + afterFirst.tabTypes).toBeGreaterThan(0);
    // Đúng ca hai id module: factory gọi LẦN HAI (plugin instance KHÁC, CÙNG module) ⇒ NO-OP.
    createPlugin(moduleStub({ id: 1 })).apply(mine.ctx as never);
    expect(registration.slots.length).toBe(afterFirst.slots);
    expect(registration.shortcuts.length).toBe(afterFirst.shortcuts);
    expect(registration.tabTypes.length).toBe(afterFirst.tabTypes);
    expect(registration.dictionaries.length).toBe(afterFirst.dictionaries);
    // LUẬT CHUNG chốt 17/10/2026: boolean PHẠM VI MODULE, KHÔNG khoá theo ctx — ca thật là HAI ENTRY
    // ⇒ HAI CTX (parent.extend({fiber})). Nên ctx MỚI cũng phải bị chặn.
    const other = harness();
    createPlugin(moduleStub({ id: 2 })).apply(other.ctx as never);
    expect(other.registration.slots.length).toBe(0);
    expect(other.registration.shortcuts.length).toBe(0);
  });

  test("ca log lỗi: apply ném lỗi ⇒ ĐÚNG MỘT dòng console.error và lỗi vẫn được ném tiếp", async () => {
    const mine = harness();
    const broken = mine.ctx as unknown as Record<string, unknown>;
    delete broken["effect"];
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]): void => {
      calls.push(args);
    };
    try {
      const createPlugin = await freshCreatePlugin("case-6");
      expect(() => createPlugin(moduleStub({ id: 1 })).apply(broken as never)).toThrow();
    } finally {
      console.error = original;
    }
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.[0])).toContain("gbh-client-ui-sidebar-terminal: apply nem loi");
  });

  test("cổng chống cài hai lần: cờ PHẠM VI MODULE, bật SAU khi đăng ký xong, KHÔNG khoá theo ctx", async () => {
    // MỘT instance plugin áp cho BA ctx khác nhau (đúng ca thật HAI ENTRY ⇒ HAI ctx).
    const plugin = (await freshCreatePlugin("guard"))(moduleStub({ id: 1 }));
    const first = harness();
    const original = (first.ctx as unknown as { locale: { register: unknown } }).locale.register;
    (first.ctx as unknown as { locale: { register: unknown } }).locale.register = () => {
      throw new Error("đăng ký từ điển hỏng giữa đường");
    };
    expect(() => plugin.apply(first.ctx as never)).toThrow();
    (first.ctx as unknown as { locale: { register: unknown } }).locale.register = original;
    // Lần hai (ctx KHÁC) phải đăng ký LẠI ĐỦ.
    const second = harness();
    plugin.apply(second.ctx as never);
    expect(second.registration.dictionaries.length).toBe(1);
    expect(second.registration.slots.length).toBeGreaterThan(0);
    // Lần ba: cờ đã bật ⇒ KHÔNG gọi effect nào.
    const third = harness();
    let effects = 0;
    const effect = (third.ctx as unknown as { effect: (cb: () => unknown, label?: string) => unknown }).effect;
    (third.ctx as unknown as { effect: unknown }).effect = (cb: () => unknown, label?: string): unknown => {
      effects += 1;
      return effect(cb, label);
    };
    plugin.apply(third.ctx as never);
    expect(effects).toBe(0);
    // Nạp MODULE MỚI thì lại đăng ký được (cờ là phạm vi module).
    const fourth = harness();
    (await freshCreatePlugin("guard-2"))(moduleStub({ id: 1 })).apply(fourth.ctx as never);
    expect(fourth.registration.slots.length).toBeGreaterThan(0);
  });
});
