/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-client-ui-settings-plugins (row ui-settings-plugins):
 *      A/B voi bundle GOC chay trong CUNG mot gia, ledger tab, CSS, vong doi, HMR va duong loi
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withoutVi, viDictionary } from "../lib/vi-locale.ts";

/** Gốc repo (tests/client → ../..). */
const REPO = join(import.meta.dir, "..", "..");

/** Bundle nửa browser của bản gốc DSH (CHỈ ĐỌC — nguồn đối chiếu oracle). */
const STOCK_BUNDLE = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-plugins/lib/client.js");

/** Id module của package ta. */
const OUR_PACKAGE = "@galaxy-blackhole/gbh-client-ui-settings-plugins";

/** Id module của package gốc. */
const STOCK_PACKAGE = "@deepseek-ai/dsh-client-ui-settings-plugins";

/** Id gắn vào thẻ `<style data-plugin-css>` của nửa client. */
const STYLE_TAG_ID = OUR_PACKAGE + "/PluginsSettingsSection.module.css";

/** Slot điều hướng Settings mà mục Plugins chiếm một chỗ. */
const SECTION_SLOT = "settings.section";

/** Slot chứa các tab do tính năng khác đóng góp. */
const TAB_SLOT = "settings.plugins.tab";

/** Id SLOT OCCUPANT của mục Plugins (KHÔNG phải id module). */
const SECTION_OCCUPANT = "plugins";

/** Namespace từ điển của mục Plugins. */
const LOCALE_KEY = "settings.plugins";

/** Một lời gọi `__ModuleLoader__.load` mà bundle đã thực hiện. */
interface Registration {
  /** Id module bundle tự khai. */
  id: string;
  /** Factory lười nhận `require` và trả export của module. */
  factory: (require: (specifier: string) => unknown) => unknown;
}

/** Bề mặt plugin mà factory trả về. */
interface PluginFace {
  /** Điểm vào phía browser. */
  apply(ctx: unknown): void;
  /** Seam service mà plugin cần. */
  inject: string[];
}

/** Một tab đã chiếu từ ledger. */
interface TabEntry {
  /** Id occupant. */
  id: string;
  /** Thứ tự hiển thị. */
  order: number;
  /** Nhãn đã bản địa hoá. */
  label: string;
}

/** Business face mà section bơm cho renderer. */
interface InjectedFace {
  /** Hook cho chrome tab. */
  hooks: {
    /** Ledger tab. */
    tabs: {
      /** Đọc ledger hiện tại. */
      getSnapshot(): TabEntry[];
      /** Theo dõi đổi ledger + từ điển. */
      subscribe(listener: () => void): () => void;
    };
  };
}

/**
 * Chạy một bundle như thẻ `<script>` classic trong một `window` giả.
 * Nhận: `code` — nguồn bundle.
 * Trả: các đăng ký mà bundle thực hiện (ném khi bundle chứa cú pháp ESM).
 */
function runBundle(code: string): Registration[] {
  const registrations: Registration[] = [];
  const facade = {
    load: (registration: Registration): void => {
      registrations.push(registration);
    },
  };
  // Bundle có thể đọc facade qua `window` (bản gốc DSH) hoặc qua `globalThis` (bản của ta) —
  // trong browser hai thứ đó là MỘT, nên gia phải dựng cả hai đường.
  const scope = globalThis as unknown as { __ModuleLoader__?: unknown };
  const previous = scope.__ModuleLoader__;
  scope.__ModuleLoader__ = facade;
  try {
    new Function("window", code)({ __ModuleLoader__: facade });
  } finally {
    if (previous === undefined) delete scope.__ModuleLoader__;
    else scope.__ModuleLoader__ = previous;
  }
  return registrations;
}

/** Một occupant trong sổ giả của slot tab. */
interface LedgerEntry {
  /** Tuỳ chọn đăng ký của occupant. */
  options: { id?: string; order?: number; label?: unknown };
}

/** Bảng ghi mọi lời gọi seam mà `apply` thực hiện — dùng để so A/B. */
interface SeamLog {
  /** Nhãn các hiệu ứng đã đăng ký. */
  effects: string[];
  /** Namespace đã buộc thành hàm dịch. */
  bound: string[];
  /** Từ điển đã đăng ký. */
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
  /** Slot đã `inject` vào. */
  injected: string[];
  /** Occupant đã đăng ký trong từng slot. */
  registered: { slot: string; definition: Record<string, unknown>; component: unknown }[];
  /** Số lần gỡ đăng ký (từ điển hoặc occupant). */
  disposed: number;
}

/** Context giả phía browser: đủ cho mục Plugins và đổi được sổ/revision để thử hook. */
interface FakeContext {
  /** Context truyền cho `apply`. */
  ctx: unknown;
  /** Bảng ghi seam. */
  log: SeamLog;
  /** Sổ occupant của slot tab (mảng sống, đẩy thêm được). */
  ledger: LedgerEntry[];
  /** Tăng số phiên bản sổ (mô phỏng một lần đăng ký/gỡ occupant). */
  bumpVersion(): void;
  /** Tăng revision từ điển (mô phỏng đổi ngôn ngữ). */
  bumpRevision(): void;
  /** Kích mọi listener đã subscribe vào sổ tab. */
  fireLedger(): void;
  /** Kích mọi listener đã subscribe vào từ điển. */
  fireLocale(): void;
}

/**
 * Dựng context giả với sổ occupant và kho từ điển quan sát được.
 * Nhận: `entries` — sổ occupant ban đầu của slot tab.
 * Trả: context giả kèm bảng ghi.
 */
function fakeContext(entries: LedgerEntry[] = []): FakeContext {
  const log: SeamLog = { effects: [], bound: [], dictionaries: [], injected: [], registered: [], disposed: 0 };
  const slotListeners: (() => void)[] = [];
  const localeListeners: (() => void)[] = [];
  const state = { version: 1, revision: 1 };
  const ctx = {
    effect: (callback: () => void | (() => void), label: string): void => {
      log.effects.push(label);
      callback();
    },
    locale: {
      bind: (namespace: string): ((key: string) => string) => {
        log.bound.push(namespace);
        return (key: string): string => {
          const dictionary = log.dictionaries.find((entry) => entry.namespace === namespace);
          return dictionary?.copy.en?.[key] ?? key;
        };
      },
      register: (namespace: string, copy: Record<string, Record<string, string>>): (() => void) => {
        log.dictionaries.push({ namespace, copy });
        return () => {
          log.disposed += 1;
        };
      },
      getSnapshot: (): { revision: number } => ({ revision: state.revision }),
      subscribe: (listener: () => void): (() => void) => {
        localeListeners.push(listener);
        return () => {
          const index = localeListeners.indexOf(listener);
          if (index >= 0) localeListeners.splice(index, 1);
        };
      },
    },
    slots: {
      getVersion: (): number => state.version,
      entries: (): LedgerEntry[] => entries,
      subscribe: (_slot: string, listener: () => void): (() => void) => {
        slotListeners.push(listener);
        return () => {
          const index = slotListeners.indexOf(listener);
          if (index >= 0) slotListeners.splice(index, 1);
        };
      },
      inject: (slot: string, register: () => unknown): void => {
        log.injected.push(slot);
        register();
      },
      register: (definition: Record<string, unknown>, component: unknown): (() => void) => {
        log.registered.push({
          slot: typeof definition.name === "string" ? definition.name : "",
          definition,
          component,
        });
        return () => {
          log.disposed += 1;
        };
      },
    },
  };
  return {
    ctx,
    log,
    ledger: entries,
    bumpVersion: () => {
      state.version += 1;
    },
    bumpRevision: () => {
      state.revision += 1;
    },
    fireLedger: () => {
      for (const listener of [...slotListeners]) listener();
    },
    fireLocale: () => {
      for (const listener of [...localeListeners]) listener();
    },
  };
}

/** Trạng thái hook giả, sống qua các lần render của một "phiên component". */
const hooks = {
  cursor: 0,
  cells: [] as unknown[],
  deps: [] as (readonly unknown[] | undefined)[],
  pending: [] as (() => void)[],
  scheduled: false,
};

/** Reset con trỏ hook trước mỗi lần render. */
function beginRender(): void {
  hooks.cursor = 0;
  hooks.pending = [];
  hooks.scheduled = false;
}

/**
 * Bảng hook React giả — cùng một bản cho cả hai bên A/B nên lệch cấu trúc vẫn lộ ra.
 * Nhận: không.
 * Trả: object hook để tiêm vào `require("react")`.
 */
function fakeReactApi(): Record<string, unknown> {
  return {
    useId: (): string => "r0",
    useRef: <T>(initial: T): { current: T } => {
      const cell = hooks.cursor;
      hooks.cursor += 1;
      hooks.cells[cell] ??= { current: initial };
      return hooks.cells[cell] as { current: T };
    },
    useState: <S>(initial?: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void] => {
      const cell = hooks.cursor;
      hooks.cursor += 1;
      if (!(cell in hooks.cells)) {
        hooks.cells[cell] = typeof initial === "function" ? (initial as () => S)() : initial;
      }
      const setter = (value: S | ((previous: S) => S)): void => {
        const previous = hooks.cells[cell] as S;
        const next = typeof value === "function" ? (value as (from: S) => S)(previous) : value;
        if (next !== previous) {
          hooks.cells[cell] = next;
          hooks.scheduled = true;
        }
      };
      return [hooks.cells[cell] as S, setter];
    },
    useEffect: (effect: () => void | (() => void), deps: readonly unknown[]): void => {
      const cell = hooks.cursor;
      hooks.cursor += 1;
      const previous = hooks.deps[cell];
      const changed =
        previous === undefined || previous.length !== deps.length || previous.some((value, index) => value !== deps[index]);
      if (!changed) return;
      hooks.deps[cell] = deps;
      hooks.pending.push(() => {
        effect();
      });
    },
  };
}

/** Cây element giả (kết quả của jsx runtime giả). */
interface FakeElement {
  /** Loại node (tên thẻ hoặc "Fragment"). */
  type: unknown;
  /** Props của node. */
  props: Record<string, unknown>;
  /** Khoá React. */
  key: unknown;
}

/**
 * `require` giả mà bảng module cấp cho factory: chỉ seam tĩnh, specifier khác là lỗi.
 * Nhận: không.
 * Trả: hàm require.
 */
function fakeRequire(): (specifier: string) => unknown {
  const modules: Record<string, unknown> = {
    react: fakeReactApi(),
    "react/jsx-runtime": {
      Fragment: "Fragment",
      jsx: (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key }),
      jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key }),
    },
    "@deepseek-ai/dsh-client-ui-slots": {
      resolveSlotLabel: (label: unknown): string | undefined =>
        typeof label === "string" ? label : typeof label === "function" ? String((label as () => unknown)()) : undefined,
    },
  };
  return (specifier: string): unknown => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    if (!(specifier in modules)) throw new Error("test: khong duoc require " + specifier);
    return modules[specifier];
  };
}

/**
 * Nạp một bundle rồi gọi factory của nó để lấy bề mặt plugin.
 * Nhận: `code` — nguồn bundle.
 * Trả: bề mặt plugin và các đăng ký mà bundle khai.
 */
function loadPlugin(code: string): { face: PluginFace; registrations: Registration[] } {
  const registrations = runBundle(code);
  const registration = registrations[0];
  if (registration === undefined) throw new Error("test: bundle khong dang ky module nao");
  const face = registration.factory(fakeRequire()) as PluginFace;
  return { face, registrations };
}

/** Phiên render giả: giữ state, gắn ref, render lại khi state đổi. */
interface RenderSession {
  /** Cây element của lần render hiện tại. */
  render(): FakeElement;
  /** Chạy một hành động rồi render lại nếu state đổi. */
  act(action: (tree: FakeElement) => void): void;
  /** Id các tab đã nhận focus, theo thứ tự. */
  focused: string[];
}

/**
 * Mở một phiên render cho component với props cho trước.
 * Nhận: `component` — component cần render, `props` — props renderer bind.
 * Trả: phiên render có thể `act` để mô phỏng tương tác.
 */
function renderSession(component: unknown, props: Record<string, unknown>): RenderSession {
  const focused: string[] = [];
  const run = (): FakeElement => {
    beginRender();
    const tree = (component as (input: Record<string, unknown>) => unknown)(props) as FakeElement;
    const pending = hooks.pending;
    hooks.pending = [];
    for (const effect of pending) effect();
    attachRefs(tree, focused);
    return tree;
  };
  let tree = run();
  return {
    render: () => tree,
    act: (action: (current: FakeElement) => void): void => {
      action(tree);
      while (hooks.scheduled) tree = run();
    },
    focused,
  };
}

/** Đọc các con của một element giả. */
function childrenOf(element: FakeElement): unknown[] {
  const children = element.props?.children;
  if (Array.isArray(children)) return children;
  if (children === undefined) return [];
  return [children];
}

/**
 * Gắn ref của mọi node trong cây (React commit-time) để `focus()` quan sát được.
 * Nhận: `value` — cây element, `focused` — mảng ghi id tab đã nhận focus.
 * Trả: không.
 */
function attachRefs(value: unknown, focused: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) attachRefs(item, focused);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const element = value as FakeElement;
  const ref = element.props?.ref;
  const id = element.props?.id;
  if (typeof ref === "function") {
    (ref as (node: unknown) => void)({
      focus: (): void => {
        if (typeof id === "string") focused.push(id);
      },
    });
  }
  for (const child of childrenOf(element)) attachRefs(child, focused);
}

/**
 * Chuẩn hoá cây element thành dữ liệu so sánh được (hàm → nhãn, khoá sắp xếp).
 * Nhận: `value` — giá trị bất kỳ trong cây.
 * Trả: bản sao chỉ gồm dữ liệu.
 */
function snapshot(value: unknown): unknown {
  if (typeof value === "function") return "[function]";
  if (Array.isArray(value)) return value.map((item) => snapshot(item));
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = snapshot((value as Record<string, unknown>)[key]);
  }
  return out;
}

/** Nguồn bundle của ta (build một lần cho cả file test). */
let ourCode: string | undefined;

/**
 * Build nửa client của ta vào thư mục tạm rồi trả nguồn bundle (đọc đúng artifact đã build).
 * Nhận: không.
 * Trả: nguồn `lib/client.js` của package ta.
 */
async function bundleOfOurs(): Promise<string> {
  if (ourCode !== undefined) return ourCode;
  const { buildPackage } = await import("../../packages/client/ui-settings-plugins/build.ts");
  const out = await mkdtemp(join(tmpdir(), "gbh-ui-settings-plugins-"));
  await buildPackage(out);
  ourCode = readFileSync(join(out, "client.js"), "utf8");
  return ourCode;
}

/** Sổ occupant mẫu: ba tab với thứ tự đăng ký khác thứ tự hiển thị. */
const SAMPLE_LEDGER: LedgerEntry[] = [
  { options: { id: "inventory", order: 20, label: "Plugin inventory" } },
  { options: { id: "market", order: 10, label: () => "Plugin market" } },
  { options: { id: "team", order: 30, label: "Agent team" } },
];

/**
 * Đọc business face đã bơm vào section.
 * Nhận: `fake` — context giả đã chạy `apply`.
 * Trả: face `{ hooks: { tabs } }`.
 */
function readInjected(fake: FakeContext): InjectedFace {
  const section = fake.log.registered.find((entry) => entry.slot === SECTION_SLOT);
  const inject = section?.definition.inject;
  if (typeof inject !== "function") throw new Error("test: section thieu inject");
  return (inject as () => InjectedFace)();
}

/**
 * Props renderer bind cho mục Plugins, đọc thẳng từ sổ của context giả.
 * Nhận: `fake` — context giả đã chạy `apply`.
 * Trả: props giả.
 */
function sectionProps(fake: FakeContext): Record<string, unknown> {
  const injected = readInjected(fake);
  return {
    t: (key: string): string => {
      const dictionary = fake.log.dictionaries.find((entry) => entry.namespace === LOCALE_KEY);
      return dictionary?.copy.en?.[key] ?? key;
    },
    useTabs: (selector: (value: readonly TabEntry[]) => unknown): unknown => selector(injected.hooks.tabs.getSnapshot()),
    renderSlot: (_slot: string, _props: Record<string, unknown>, options: { only: string }): unknown => ({
      slot: TAB_SLOT,
      only: options.only,
    }),
  };
}

/** CSS của bản gốc, đọc từ chính bundle stock (nguồn đối chiếu). */
function stockCss(): string {
  const code = readFileSync(STOCK_BUNDLE, "utf8");
  const match = /const css = ("(?:[^"\\]|\\.)*")/u.exec(code);
  if (match?.[1] === undefined) throw new Error("test: khong doc duoc CSS cua bundle goc");
  return JSON.parse(match[1]) as string;
}

/**
 * Phân tích CSS thành bảng selector → tập thuộc tính (đã sắp xếp).
 * Nhận: `css` — văn bản CSS.
 * Trả: Map selector đã chuẩn hoá (`::` → `:`, gộp khoảng trắng) → danh sách thuộc tính.
 */
function cssProperties(css: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const block of css.split("}")) {
    const start = block.indexOf("{");
    if (start < 0) continue;
    const body = block.slice(start + 1);
    const properties = body
      .split(";")
      .map((declaration) => declaration.split(":")[0]?.trim() ?? "")
      .filter((name) => name !== "")
      .sort();
    for (const selector of block.slice(0, start).split(",")) {
      const key = selector.trim().replace(/::/gu, ":").replace(/\s+/gu, " ");
      if (key !== "") out.set(key, properties);
    }
  }
  return out;
}

/** Một thẻ `<style>` do nửa client chèn vào document giả. */
interface StyleTag {
  /** Nội dung stylesheet. */
  textContent: string;
  /** Thuộc tính `data-plugin`. */
  plugin: string;
  /** Thuộc tính `data-plugin-css`. */
  pluginCss: string;
}

/** Nguồn bundle của ta đã chạy trong một document giả (cache cho cả file test). */
let domRun: {
  /** Nạp bundle (chưa gọi factory) rồi gọi factory hai lần. */
  tagsAfterFirstFactory: StyleTag[];
  tagsAfterSecondFactory: StyleTag[];
  tagsAtLoad: number;
} | undefined;

/**
 * Chạy bundle của ta với một `document` giả để đo việc chèn CSS và tính lười của bundle.
 * Nhận: không.
 * Trả: số thẻ style lúc nạp, sau lần gọi factory thứ nhất và thứ hai.
 */
async function runInFakeDocument(): Promise<NonNullable<typeof domRun>> {
  if (domRun !== undefined) return domRun;
  const code = await bundleOfOurs();
  const tags: StyleTag[] = [];
  const documentStub = {
    querySelector: (selector: string): unknown =>
      tags.find((tag) => selector.includes(tag.pluginCss)) === undefined ? null : tags.find((tag) => selector.includes(tag.pluginCss)),
    createElement: (): unknown => {
      const tag = { textContent: "", dataset: { plugin: "", pluginCss: "" } };
      const record: StyleTag = {
        get textContent() {
          return tag.textContent;
        },
        get plugin() {
          return tag.dataset.plugin;
        },
        get pluginCss() {
          return tag.dataset.pluginCss;
        },
      };
      tags.push(record);
      return tag;
    },
    head: { appendChild: (): void => undefined },
  };
  const globalScope = globalThis as unknown as { document?: unknown };
  globalScope.document = documentStub;
  try {
    const registrations = runBundle(code);
    const tagsAtLoad = tags.length;
    const registration = registrations[0];
    if (registration === undefined) throw new Error("test: bundle khong dang ky module nao");
    registration.factory(fakeRequire());
    const tagsAfterFirstFactory = [...tags];
    registration.factory(fakeRequire());
    domRun = { tagsAtLoad, tagsAfterFirstFactory, tagsAfterSecondFactory: [...tags] };
  } finally {
    delete globalScope.document;
  }
  return domRun;
}

/** Nạp cả hai bên trong cùng một gia để so A/B. */
async function bothSides(): Promise<{ ours: { face: PluginFace }; stock: { face: PluginFace } }> {
  return {
    ours: loadPlugin(await bundleOfOurs()),
    stock: loadPlugin(readFileSync(STOCK_BUNDLE, "utf8")),
  };
}

describe("row ui-settings-plugins — nửa client", () => {
  test("ca 1: hành vi chính — cùng seam, cùng từ điển, cùng định nghĩa section như bản gốc", async () => {
    const { ours, stock } = await bothSides();
    expect(ours.face.inject).toEqual(stock.face.inject);
    expect(ours.face.inject).toEqual(["slots", "locale"]);
    const oursCtx = fakeContext();
    const stockCtx = fakeContext();
    ours.face.apply(oursCtx.ctx);
    stock.face.apply(stockCtx.ctx);
    expect(oursCtx.log.bound).toEqual(stockCtx.log.bound);
    expect(oursCtx.log.effects).toEqual(stockCtx.log.effects);
    expect(withoutVi(oursCtx.log.dictionaries)).toEqual(withoutVi(stockCtx.log.dictionaries));
    expect(Object.keys(viDictionary(oursCtx.log.dictionaries) ?? {}).length).toBe(52);
    expect(oursCtx.log.dictionaries[0]?.namespace).toBe(LOCALE_KEY);
    expect(oursCtx.log.dictionaries[0]?.copy.zh?.nav).toBe("内置插件");
    expect(oursCtx.log.injected).toEqual([SECTION_SLOT]);
    const oursSection = oursCtx.log.registered[0];
    const stockSection = stockCtx.log.registered[0];
    expect(typeof oursSection?.component).toBe("function");
    expect(snapshot({ ...oursSection?.definition, inject: undefined })).toEqual(
      snapshot({ ...stockSection?.definition, inject: undefined }),
    );
    expect(oursSection?.definition).toMatchObject({
      name: SECTION_SLOT,
      id: SECTION_OCCUPANT,
      order: 15,
      locale: LOCALE_KEY,
      children: { [TAB_SLOT]: { kind: "list", scope: "root" } },
    });
  });

  test("ca 2: ledger tab và cây element khớp bản gốc trên cùng đầu vào", async () => {
    const { ours, stock } = await bothSides();
    const oursCtx = fakeContext(SAMPLE_LEDGER);
    const stockCtx = fakeContext(SAMPLE_LEDGER);
    ours.face.apply(oursCtx.ctx);
    stock.face.apply(stockCtx.ctx);
    const oursTree = renderSession(oursCtx.log.registered[0]?.component, sectionProps(oursCtx)).render();
    const stockTree = renderSession(stockCtx.log.registered[0]?.component, sectionProps(stockCtx)).render();
    expect(snapshot(oursTree)).toEqual(snapshot(stockTree));
    const tabs = readInjected(oursCtx).hooks.tabs.getSnapshot();
    expect(tabs.map((tab) => tab.id)).toEqual(["market", "inventory", "team"]);
    expect(tabs.map((tab) => tab.label)).toEqual(["Plugin market", "Plugin inventory", "Agent team"]);
    expect(tabs.map((tab) => tab.order)).toEqual([10, 20, 30]);
  });

  test("ca 3: ledger rỗng / occupant khuyết trường — không ném, giống bản gốc", async () => {
    const { ours, stock } = await bothSides();
    const broken: LedgerEntry[] = [{ options: {} }, { options: { order: 5 } }];
    const oursBroken = fakeContext(broken);
    const stockBroken = fakeContext(broken);
    ours.face.apply(oursBroken.ctx);
    stock.face.apply(stockBroken.ctx);
    const oursTabs = readInjected(oursBroken).hooks.tabs.getSnapshot();
    expect(snapshot(oursTabs)).toEqual(snapshot(readInjected(stockBroken).hooks.tabs.getSnapshot()));
    expect(oursTabs).toEqual([
      { id: "", order: 0, label: "" },
      { id: "", order: 5, label: "" },
    ]);
    const emptyCtx = fakeContext([]);
    // Cờ chống cài hai lần là PHẠM VI MODULE ⇒ ca con này phải dùng một INSTANCE MODULE MỚI (nạp lại bundle).
    loadPlugin(await bundleOfOurs()).face.apply(emptyCtx.ctx);
    const emptyTree = renderSession(emptyCtx.log.registered[0]?.component, sectionProps(emptyCtx)).render();
    expect(JSON.stringify(snapshot(emptyTree))).toContain("This deployment exposes no plugin views.");
    expect(JSON.stringify(snapshot(emptyTree))).not.toContain('"role":"tablist"');
  });

  test("ca 3b: cổng chống cài hai lần — PHẠM VI MODULE, bật SAU khi đăng ký xong, KHÔNG khoá theo ctx", async () => {
    const plugin = loadPlugin(await bundleOfOurs());
    // Lần cài đầu NÉM giữa đường (đăng ký từ điển hỏng) ⇒ cờ PHẢI còn false.
    const broken = fakeContext([]);
    // `FakeContext.ctx` cố ý là `unknown` (apply nhận unknown); ca này cần THAY một method của seam từ điển
    // ⇒ mở một VIEW có kiểu trên ĐÚNG vật thể đó (không `any`, không đổi hành vi).
    const brokenLocale = (broken.ctx as { locale: { register: () => void } }).locale;
    brokenLocale.register = () => {
      throw new Error("đăng ký hỏng giữa đường");
    };
    expect(() => plugin.face.apply(broken.ctx)).toThrow();
    // Cùng INSTANCE MODULE, ctx KHÁC ⇒ phải đăng ký lại ĐỦ (khoá theo ctx thì ca này trượt).
    const second = fakeContext([]);
    plugin.face.apply(second.ctx);
    expect(second.log.injected).toEqual([SECTION_SLOT]);
    expect(second.log.registered.length).toBe(1);
    // Lần thứ ba: cờ đã bật ⇒ KHÔNG đăng ký gì thêm.
    const third = fakeContext([]);
    plugin.face.apply(third.ctx);
    expect(third.log.registered.length).toBe(0);
    expect(third.log.injected.length).toBe(0);
    // Nạp MODULE MỚI thì lại được phép đăng ký.
    const other = fakeContext([]);
    loadPlugin(await bundleOfOurs()).face.apply(other.ctx);
    expect(other.log.registered.length).toBe(1);
  });

  test("ca 4: đăng ký ĐÚNG id — id của ta + KHOÁ ALIAS id gốc, occupant giữ id 'plugins'", async () => {
    const ours = runBundle(await bundleOfOurs());
    // Từ 17/10/2026 (phần C): bundle đăng ký THÊM id gốc làm khoá alias, vì entry stock khác vẫn inject id
    // đó và id đó biến mất khỏi đồ thị khi ta thay row.
    expect(ours.map((entry) => entry.id)).toEqual([OUR_PACKAGE]);
    const stock = runBundle(readFileSync(STOCK_BUNDLE, "utf8"));
    expect(stock.map((entry) => entry.id)).toEqual([STOCK_PACKAGE]);
  });

  test("ca 4b: KHÔNG bundle nào require module gốc ⇒ không cần alias id stock (đo trên cây đã cài)", () => {
    const root = join(REPO, "apps/host/node_modules/@deepseek-ai");
    const dependents: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name !== "lib") walk(full);
          continue;
        }
        if (name !== "client.js") continue;
        if (readFileSync(full, "utf8").slice(0, 4096).includes('require("' + STOCK_PACKAGE + '")')) {
          dependents.push(full);
        }
      }
    };
    walk(root);
    expect(dependents).toEqual([]);
  });

  test("ca 5: bundle là script classic, nạp LƯỢI, chèn CSS đúng một lần với đúng id", async () => {
    const run = await runInFakeDocument();
    expect(run.tagsAtLoad).toBe(0);
    expect(run.tagsAfterFirstFactory).toHaveLength(1);
    expect(run.tagsAfterSecondFactory).toHaveLength(1);
    const tag = run.tagsAfterFirstFactory[0];
    expect(tag?.plugin).toBe(OUR_PACKAGE);
    expect(tag?.pluginCss).toBe(STYLE_TAG_ID);
    expect(tag?.textContent).toContain("." + "pbvGtq_section");
    expect(tag?.textContent).toContain("var(--dsw-alias-label-primary)");
  });

  test("ca 6: CSS — cùng bộ selector và cùng thuộc tính mỗi selector như bản gốc", async () => {
    const run = await runInFakeDocument();
    const ours = cssProperties(run.tagsAfterFirstFactory[0]?.textContent ?? "");
    const stock = cssProperties(stockCss());
    expect([...ours.keys()].sort()).toEqual([...stock.keys()].sort());
    for (const [selector, properties] of stock) expect(ours.get(selector)).toEqual(properties);
  });

  test("ca 7: bàn phím — Arrow/Home/End đổi tab và focus, phím lạ bị bỏ qua", async () => {
    const { ours } = await bothSides();
    const fake = fakeContext(SAMPLE_LEDGER);
    ours.face.apply(fake.ctx);
    const session = renderSession(fake.log.registered[0]?.component, sectionProps(fake));
    const tabs = findTabs(session.render());
    expect(tabs).toHaveLength(3);
    expect(tabs.map((tab) => tab.props.id)).toEqual(["r0-tab-market", "r0-tab-inventory", "r0-tab-team"]);
    const second = tabs[1];
    if (second === undefined) throw new Error("test: thieu tab thu hai");
    const prevented: string[] = [];
    const press = (name: string): void => {
      session.act(() => {
        (second.props.onKeyDown as (event: { key: string; preventDefault(): void }) => void)({
          key: name,
          preventDefault: () => prevented.push(name),
        });
      });
    };
    press("ArrowRight");
    expect(session.focused).toEqual(["r0-tab-team"]);
    press("Home");
    expect(session.focused).toEqual(["r0-tab-team", "r0-tab-market"]);
    press("ArrowLeft");
    expect(session.focused).toEqual(["r0-tab-team", "r0-tab-market", "r0-tab-market"]);
    press("End");
    expect(session.focused).toEqual(["r0-tab-team", "r0-tab-market", "r0-tab-market", "r0-tab-team"]);
    press("PageDown");
    expect(prevented).toEqual(["ArrowRight", "Home", "ArrowLeft", "End"]);
    const active = findTabs(session.render()).filter((tab) => tab.props["aria-selected"] === true);
    expect(active.map((tab) => tab.props.id)).toEqual(["r0-tab-team"]);
    expect(JSON.stringify(snapshot(session.render()))).toContain('"hidden":true');
  });

  test("ca 8: getSnapshot memoize theo (version sổ, revision từ điển); subscribe gỡ CẢ HAI nguồn", async () => {
    const { ours } = await bothSides();
    const fake = fakeContext(SAMPLE_LEDGER);
    ours.face.apply(fake.ctx);
    const tabs = readInjected(fake).hooks.tabs;
    const first = tabs.getSnapshot();
    expect(tabs.getSnapshot()).toBe(first);
    fake.bumpVersion();
    fake.ledger.push({ options: { id: "late", order: 15, label: "Late" } });
    const second = tabs.getSnapshot();
    expect(second).not.toBe(first);
    expect(second.map((tab) => tab.id)).toEqual(["market", "late", "inventory", "team"]);
    fake.bumpRevision();
    expect(tabs.getSnapshot()).not.toBe(second);
    const fired: string[] = [];
    const off = tabs.subscribe(() => fired.push("tick"));
    fake.fireLedger();
    fake.fireLocale();
    expect(fired).toHaveLength(2);
    off();
    fake.fireLedger();
    fake.fireLocale();
    expect(fired).toHaveLength(2);
  });

  test("ca 9: HMR — chạy lại bundle sau invalidate chỉ đăng ký MỘT id, không trùng factory", async () => {
    const code = await bundleOfOurs();
    const table = new Map<string, unknown>();
    const execute = (): void => {
      for (const registration of runBundle(code)) {
        if (table.has(registration.id)) throw new Error("test: trung factory " + registration.id);
        table.set(registration.id, registration.factory);
      }
    };
    execute();
    expect([...table.keys()]).toEqual([OUR_PACKAGE]);
    // HMR: nạp lại bundle phải đăng ký lại ĐÚNG hai khoá đó, không sinh factory trùng.
    table.delete(OUR_PACKAGE);
    expect(() => execute()).not.toThrow();
    expect([...table.keys()]).toEqual([OUR_PACKAGE]);
  });

  test("ca 10: đường lỗi — thiếu facade / thiếu seam thì hỏng NGAY bằng TypeError, giống bản gốc", async () => {
    const code = await bundleOfOurs();
    const run = (source: string): unknown => new Function("window", source)({});
    // TIEN DE CUA CA NAY LA "khong co bo nap". `__ModuleLoader__` la bien TOAN CUC nen mot file test
    // khac co the de lai no => test xanh khi chay RIENG nhung DO khi chay ca suite (da xay ra that
    // 17/10/2026). Tu bao dam tien de roi tra lai nguyen trang, thay vi tin vao thu tu chay.
    const g = globalThis as Record<string, unknown>;
    const saved = g.__ModuleLoader__;
    delete g.__ModuleLoader__;
    try {
      expect(() => run(code)).toThrow(TypeError);
      expect(() => run(readFileSync(STOCK_BUNDLE, "utf8"))).toThrow(TypeError);
    } finally {
      if (saved !== undefined) g.__ModuleLoader__ = saved;
    }
    expect(() => loadPlugin(code).face.apply({})).toThrow(TypeError);
  });
});

/**
 * Lấy các nút tab đã render từ cây element.
 * Nhận: `tree` — cây element giả.
 * Trả: các nút có `role="tab"` theo thứ tự DOM.
 */
function findTabs(tree: unknown): FakeElement[] {
  const out: FakeElement[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const element = value as FakeElement;
    if (element.props?.role === "tab") out.push(element);
    for (const child of childrenOf(element)) walk(child);
  };
  walk(tree);
  return out;
}
