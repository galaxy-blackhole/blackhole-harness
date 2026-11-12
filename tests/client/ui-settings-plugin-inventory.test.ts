/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-client-ui-settings-plugin-inventory: so từ điển, đăng ký
 *      slot và CÂY RENDER với chính bundle gốc, cộng các ca hành vi và hình dạng bundle
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";

import { NS, en, zh } from "../../packages/client/ui-settings-plugin-inventory/src/locales.ts";
import { moduleShortName, presetLabel } from "../../packages/client/ui-settings-plugin-inventory/src/inventory-model.ts";
/** Kieu cua module plugin (giu nguyen chu ky that de khong phai khai lai). */
type PluginModule = typeof import("../../packages/client/ui-settings-plugin-inventory/src/plugin.ts");

/**
 * Nap module TUOI cho MOI ca.
 *
 * Cong idempotent co mot phan o PHAM VI MODULE (boolean), nen dung lai module cu se lam ca thu hai bi
 * chan ngay tu dau (su co that 17/10/2026 khi them cong ngoai). Them query vao specifier de moi ca co
 * mot module rieng; giu bien kieu `string` de TS khong phan giai duong dan co query.
 */
let createPlugin: PluginModule["createPlugin"];
beforeEach(async () => {
  const spec: string = "../../packages/client/ui-settings-plugin-inventory/src/plugin.ts?case" + String(Date.now());
  createPlugin = ((await import(spec)) as PluginModule).createPlugin;
});


import { presetDisplayText } from "../../packages/client/ui-settings-plugin-inventory/src/preset-display.ts";
import { withoutVi, viDictionary } from "../lib/vi-locale.ts";

/** Một phần tử trong cây render giả. */
interface FakeElement {
  /** Loại phần tử. */
  type: unknown;
  /** Props đã truyền. */
  props: Record<string, unknown>;
}

/** Bản ghi những gì plugin đăng ký với context giả. */
interface Registration {
  /** Từ điển đã đăng ký theo namespace. */
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
  /** Định nghĩa occupant slot. */
  slots: { slot: string; definition: Record<string, unknown>; component: unknown }[];
}

/** require giả: jsx runtime (có Fragment), react và ui-primitives. */
function moduleStub(counter: { id: number }): (id: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown): FakeElement => ({ type, props: { ...props, key } });
  return (id: string): unknown => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (id === "react") {
      return {
        useId: (): string => "id" + String(counter.id++),
        useState: <T,>(initial: T): [T, (value: T) => void] => [initial, () => undefined],
        useEffect: (): undefined => undefined,
        useMemo: <T,>(factory: () => T): T => factory(),
      };
    }
    if (id .endsWith("-client-ui-primitives")) {
      return {
        IconChevronDownOutlineRegular: "IconChevronDown",
        IconSearchOutlineRegular: "IconSearch",
        StateDot: "StateDot",
        Tag: "Tag",
        Menu: "Menu",
      };
    }
    throw new Error("module lạ: " + id);
  };
}

/**
 * Dựng context giả ghi lại từ điển và occupant slot.
 * Nhận: bộ đếm useId dùng chung để hai bên ra cùng id.
 * Trả: { ctx, registration, stub }.
 */
function harness(counter: { id: number }): {
  ctx: unknown;
  registration: Registration;
  stub: (id: string) => unknown;
} {
  const registration: Registration = { dictionaries: [], slots: [] };
  const ctx = {
    effect: (callback: () => unknown): unknown => callback(),
    locale: {
      bind: (namespace: string) => (key: string) => (namespace === NS ? (en as Record<string, string>)[key] ?? key : key),
      register: (namespace: string, copy: Record<string, Record<string, string>>): void => {
        registration.dictionaries.push({ namespace, copy });
      },
      resolveText: (text: unknown): string => (typeof text === "string" ? text : String((text as { en?: string })?.en ?? "")),
    },
    remote: { pluginInventory: { list: async () => ({ ok: true, value: { agentPresets: [], entries: [] } }) } },
    modules: { entries: { state: { syncing: false, failures: [] }, retry: async () => undefined } },
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
    logger: { error: (): void => undefined },
  };
  return { ctx, registration, stub: moduleStub(counter) };
}

/**
 * Nạp một bundle .js đã build trong window giả rồi lấy factory của nó.
 * Nhận: đường dẫn file bundle.
 * Trả: factory của bundle.
 */
async function loadFactory(path: string): Promise<(require: (id: string) => unknown) => { apply(ctx: unknown): void }> {
  const code = await Bun.file(path).text();
  let factory: ((require: (id: string) => unknown) => { apply(ctx: unknown): void }) | undefined;
  const fakeWindow = {
    __ModuleLoader__: {
      load: (registration: { factory: typeof factory }): void => {
        factory = registration.factory;
      },
    },
  };
  new Function("window", code)(fakeWindow);
  if (factory === undefined) throw new Error("bundle không đăng ký factory nào");
  return factory;
}

/**
 * Chuẩn hoá cây render thành chuỗi để so hai bên: tên thẻ, lớp, aria-*, chữ.
 * Nhận: phần tử gốc và bộ đếm chiều sâu.
 * Trả: chuỗi mô tả cây.
 */
function serialize(node: unknown, depth = 0): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return " ".repeat(depth) + String(node) + "\n";
  if (Array.isArray(node)) return node.map((child) => serialize(child, depth)).join("");
  const element = node as FakeElement;
  const props = element.props;
  const parts: string[] = [];
  for (const key of Object.keys(props).filter((name) => name !== "children").sort()) {
    if (key === "key") continue;
    const value = props[key];
    if (value === undefined || value === null || typeof value === "function") continue;
    const text = typeof value === "object" ? "[obj]" : String(value);
    // Tiền tố lớp CSS của hai bên khác nhau (mỗi gói tự đặt) — chuẩn hoá trước khi so cây.
    parts.push(key + "=" + text.replace(/qSYn7G_|gbhInv_/gu, "LOP_"));
  }
  const type = typeof element.type === "string" ? element.type : String((element.type as { name?: string })?.name ?? element.type);
  return " ".repeat(depth) + type + (parts.length === 0 ? "" : " " + parts.join(" ")) + "\n" + serialize(props.children, depth + 1);
}

describe("row ui-settings-plugin-inventory — đối chứng với bản gốc", () => {
  test("từ điển đăng ký TRÙNG KHỚP từng chuỗi với bản gốc (74 chuỗi)", async () => {
    const stockFactory = await loadFactory(
      join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-plugin-inventory/lib/client.js"),
    );
    const stock = harness({ id: 1 });
    stockFactory(stock.stub).apply(stock.ctx);
    const mine = harness({ id: 1 });
    createPlugin(mine.stub).apply(mine.ctx as never);
    expect(withoutVi(mine.registration.dictionaries)).toEqual(withoutVi(stock.registration.dictionaries));
    expect(Object.keys(viDictionary(mine.registration.dictionaries) ?? {}).length).toBeGreaterThanOrEqual(37);
    expect(mine.registration.dictionaries[0]?.namespace).toBe(NS);
    expect(Object.keys(en).length).toBe(37);
  });

  test("đăng ký occupant slot TRÙNG KHỚP: slot · id · order · locale · nhãn · khoá inject", async () => {
    const stockFactory = await loadFactory(
      join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-plugin-inventory/lib/client.js"),
    );
    const stock = harness({ id: 7 });
    stockFactory(stock.stub).apply(stock.ctx);
    const mine = harness({ id: 7 });
    createPlugin(mine.stub).apply(mine.ctx as never);
    const shapeOf = (registration: Registration): unknown => {
      const entry = registration.slots[0];
      if (entry === undefined) throw new Error("không đăng ký slot nào");
      const definition = entry.definition;
      return {
        slot: entry.slot,
        name: definition.name,
        id: definition.id,
        order: definition.order,
        locale: definition.locale,
        label: (definition.label as () => string)(),
        inject: Object.keys((definition.inject as () => Record<string, unknown>)()).sort(),
      };
    };
    expect(shapeOf(mine.registration)).toEqual(shapeOf(stock.registration));
    expect(shapeOf(mine.registration)).toEqual({
      slot: "settings.plugins.tab",
      name: "settings.plugins.tab",
      id: "all",
      order: 10,
      locale: NS,
      label: "Plugin list",
      inject: ["hooks", "list", "presetName", "resolveText", "retryClient"],
    });
  });

  test("CÂY RENDER ở trạng thái đang đọc dữ liệu TRÙNG KHỚP với bản gốc", async () => {
    const stockFactory = await loadFactory(
      join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-plugin-inventory/lib/client.js"),
    );
    const render = (registration: Registration): string => {
      const component = registration.slots[0]?.component as (props: Record<string, unknown>) => unknown;
      return serialize(
        component({
          list: () => new Promise(() => undefined),
          presetName: (preset: { id: string }) => preset.id,
          resolveText: (text: unknown) => String(text),
          t: (key: string, params?: Record<string, string>) => {
            const base = (en as Record<string, string>)[key] ?? key;
            return params === undefined ? base : Object.entries(params).reduce((acc, [name, value]) => acc.replace("{" + name + "}", value), base);
          },
          useClientSync: (selector: (snapshot: unknown) => unknown) => selector({ syncing: false, failures: [] }),
          retryClient: () => undefined,
        }),
      );
    };
    const stock = harness({ id: 1 });
    stockFactory(stock.stub).apply(stock.ctx);
    const mine = harness({ id: 1 });
    createPlugin(mine.stub).apply(mine.ctx as never);
    const stockTree = render(stock.registration);
    const mineTree = render(mine.registration);
    expect(mineTree).toBe(stockTree);
    expect(mineTree).toContain("Reading plugins");
    expect(mineTree).toContain("LOP_skeletonCard");
  });
});

describe("row ui-settings-plugin-inventory — hành vi và hình dạng bundle", () => {
  test("rút gọn tên module và nhãn preset đúng như bản gốc", () => {
    expect(moduleShortName("@deepseek-ai/dsh-client-ui-settings-shell")).toBe("ui-settings-shell");
    expect(moduleShortName("@galaxy-blackhole/dsh-host-webserver")).toBe("webserver");
    expect(moduleShortName("cordis-plugin-foo")).toBe("foo");
    expect(presetDisplayText({ id: "standard", rows: [] }, (key) => "T:" + key)).toEqual({
      name: "T:presetStandardName",
      description: "T:presetStandardDescription",
    });
    expect(presetDisplayText({ id: "mine", name: "Của tôi", rows: [] }, (key) => key)).toEqual({ name: "Của tôi" });
    expect(
      presetLabel({ id: "p", isDefault: true, rows: [] }, (key, params) => key + ":" + String(params?.name), () => "P"),
    ).toBe("presetOptionDefault:P");
  });

  test("nửa host export ĐÚNG tập export của bản gốc (apply)", async () => {
    const load = async (path: string): Promise<Record<string, unknown>> => (await import(path)) as Record<string, unknown>;
    const stock = await load(join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-plugin-inventory/lib/index.js"));
    const stockExports = Object.keys(stock).filter((key) => key !== "default").sort();
    expect(stockExports).toEqual(["apply"]);
    const ours = await load(join(import.meta.dir, "../../packages/client/ui-settings-plugin-inventory/lib/index.js"));
    expect(Object.keys(ours).filter((key) => key !== "default").sort()).toEqual(stockExports);
    expect(typeof ours.apply).toBe("function");
  });

  test("nửa client đã build là SCRIPT CLASSIC đăng ký đúng MOT id, không có cú pháp ESM", async () => {
    const code = await Bun.file(
      join(import.meta.dir, "../../packages/client/ui-settings-plugin-inventory/lib/client.js"),
    ).text();
    const ids: string[] = [];
    const fakeWindow = { __ModuleLoader__: { load: (registration: { id: string }): void => { ids.push(registration.id); } } };
    new Function("window", code)(fakeWindow);
    expect(ids.length).toBe(1);   // LUAT 17/10/2026: bundle chi tu khai MOT id; id goc khai o gbh.row.aliases
    // LUAT 17/10/2026: id goc KHONG tu dang ky trong bundle (no o gbh.row.aliases) => chi con id cua ta.
    expect(new Set(ids)).toEqual(new Set(["@galaxy-blackhole/gbh-client-ui-settings-plugin-inventory"]));
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
  });

  test("từ điển en/zh cùng tập khoá và giữ nguyên bản tiếng Trung", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    expect(Object.keys(en).length).toBe(37);
    expect(zh.tab).toBe("插件列表");
    expect(en.tab).toBe("Plugin list");
  });
});
