/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Giàn test dùng chung cho row ui-goal: element giả, React giả, ui-primitives giả, ngữ cảnh
 *      client giả, bộ khung có trạng thái, helper soi cây/dựng props, và helper nạp artifact
 *      (CSS gốc + manifest) — tách khỏi ui-goal.test.ts cho cổng file-length xanh
 */

import { expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { GoalPrimitives, GoalReact } from "../../packages/client/ui-goal/src/goal-bar.ts";
import { createPlugin } from "../../packages/client/ui-goal/src/plugin.ts";

/**
 * Element giả: chỉ ghi lại type/props/key để soi cây.
 * Nhận: không (chỉ là kiểu dữ liệu).
 * Trả: hình dạng element giả mà mọi helper soi cây dùng.
 */
export interface Element {
  /** Loại element. */
  type: unknown;
  /** Props. */
  props: Record<string, unknown>;
  /** Khoá. */
  key?: unknown;
}

/**
 * jsx giả: KHÔNG render sâu — chỉ dựng cây element.
 * Nhận: type, props và key (tuỳ chọn) của element cần dựng.
 * Trả: element giả `{ type, props, key }`.
 */
export function fakeJsx(type: unknown, props: Record<string, unknown>, key?: unknown): Element {
  return { type, props, key };
}

/**
 * Bản ghi của React giả.
 * Nhận: không (chỉ là kiểu dữ liệu).
 * Trả: hình dạng bản ghi mà makeReact ghi setState/cleanup vào.
 */
export interface ReactRecord {
  /** Các lần gọi setState. */
  setState: { index: number; value: unknown }[];
  /** Các hàm dọn dẹp đã đăng ký. */
  cleanups: (() => void)[];
}

/**
 * React giả: đủ cho một lượt render. CỐ Ý KHÔNG có jsx/jsxs (module react thật cũng không có).
 * Nhận: bản ghi.
 * Trả: runtime hook + memo.
 */
export function makeReact(record: ReactRecord) {
  let stateIndex = 0;
  return {
    useState<T>(initial: T): [T, (next: T) => void] {
      const index = stateIndex;
      stateIndex += 1;
      return [initial, (value: T) => record.setState.push({ index, value })];
    },
    useRef<T>(initial: T): { current: T } {
      return { current: initial };
    },
    useEffect(callback: () => void | (() => void)): void {
      const cleanup = callback();
      if (typeof cleanup === "function") record.cleanups.push(cleanup);
    },
    useCallback<T>(callback: T): T {
      return callback;
    },
    memo<T>(component: T): T {
      return component;
    },
  };
}

/**
 * ui-primitives giả: các component đánh dấu. KHÔNG gọi marker khi dựng cây (jsx giả không render sâu),
 * nên test phải so DANH TÍNH component thay vì đếm lời gọi.
 * Nhận: không có.
 * Trả: bề mặt nguyên thuỷ + mảng `calls` để soi nếu cần.
 */
export function makePrimitives() {
  const calls: string[] = [];
  const marker = (name: string) => (props: Record<string, unknown>) => {
    calls.push(name);
    return { type: name, props };
  };
  return {
    calls,
    InlineEditor: marker("InlineEditor"),
    Tooltip: marker("Tooltip"),
    IconGoalOutlineRegular: marker("IconGoalOutlineRegular"),
    IconCheckOutlineRegular: marker("IconCheckOutlineRegular"),
    IconCloseOutlineRegular: marker("IconCloseOutlineRegular"),
    IconPauseOutlineRegular: marker("IconPauseOutlineRegular"),
    IconPlayOutlineRegular: marker("IconPlayOutlineRegular"),
    IconEditOutlineRegular: marker("IconEditOutlineRegular"),
    IconTrashOutlineRegular: marker("IconTrashOutlineRegular"),
    ReferenceChip: marker("ReferenceChip"),
  } as GoalPrimitives & { calls: string[] };
}

/**
 * Runtime gộp ĐÚNG như plugin.ts: jsx/jsxs riêng, hook riêng.
 * Nhận: bản ghi React giả để hứng setState/cleanup.
 * Trả: GoalReact đủ jsx/jsxs + bốn hook cho goal-bar.
 */
export function shellDeps(record: ReactRecord): GoalReact {
  const hooks = makeReact(record);
  return {
    jsx: fakeJsx,
    jsxs: fakeJsx,
    useState: hooks.useState,
    useRef: hooks.useRef,
    useEffect: hooks.useEffect,
    useCallback: hooks.useCallback,
  };
}

/**
 * Từ điển giả: trả nguyên khoá để soi.
 * Nhận: khoá từ điển.
 * Trả: chính khoá đó (không dịch).
 */
export const t = (key: string): string => key;

/**
 * Danh sách con của một node: jsx nhận MỘT con (không phải mảng) nên phải chuẩn hoá.
 * Nhận: element cần lấy con.
 * Trả: mảng con (một phần tử nếu props.children không phải mảng).
 */
export function listOf(node: Element): unknown[] {
  const raw = node.props.children;
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Element lá của một node.
 * Nhận: element cần lấy con.
 * Trả: mảng con ĐÚNG là element (đã lọc giá trị nguyên thuỷ).
 */
export function childrenOf(node: Element): Element[] {
  return listOf(node).filter((child): child is Element => typeof child === 'object' && child !== null && 'type' in child);
}

/**
 * Cây của một component: gọi thẳng hàm component với props.
 * Nhận: hàm component và props cần render.
 * Trả: element gốc của cây.
 */
export function render(component: (props: never) => unknown, props: Record<string, unknown>): Element {
  return (component as unknown as (p: Record<string, unknown>) => Element)(props);
}

/**
 * Bản ghi nối dây của ngữ cảnh giả.
 * Nhận: không (chỉ là kiểu dữ liệu).
 * Trả: hình dạng bản ghi mà makeCtx ghi mọi lời gọi nối dây vào.
 */
export interface CtxRecord {
  /** Định nghĩa chiếu đã đăng ký. */
  events: unknown[];
  /** Rule văn bản đã đăng ký. */
  userText: unknown[];
  /** Hiệu ứng vòng đời. */
  effects: { label: string; callback: () => unknown }[];
  /** Từ điển đã đăng ký. */
  dictionaries: { ns: string; dicts: unknown }[];
  /** Các lời gọi slots.inject. */
  injections: { name: string; register: () => void }[];
  /** Các lời gọi slots.register. */
  registrations: { options: Record<string, unknown>; component: unknown }[];
  /** Các sự kiện ctx đã nghe. */
  onEvents: string[];
}

/**
 * Ngữ cảnh client giả: ghi lại mọi lời gọi nối dây.
 * Nhận: mặt phiên (nếu cần cho đường vạt chất hoá của dock) và Remote goals giả.
 * Trả: `{ ctx, record }`.
 */
export function makeCtx(options: {
  binding?: unknown;
  goals?: Record<string, unknown>;
  projectionSnapshot?: unknown;
}) {
  const record: CtxRecord = {
    events: [],
    userText: [],
    effects: [],
    dictionaries: [],
    injections: [],
    registrations: [],
    onEvents: [],
  };
  const projection = {
    getSnapshot: () => options.projectionSnapshot,
    subscribe: () => () => undefined,
  };
  const session = {
    getSnapshot: () => ({ running: false, openState: "open" }),
    subscribe: () => () => undefined,
    projections: { faceOf: () => projection },
  };
  const binding = options.binding ?? { session };
  const ctx = {
    effect: (callback: () => unknown, label: string) => {
      record.effects.push({ label, callback });
      callback();
    },
    on: (event: string) => {
      record.onEvents.push(event);
      return () => undefined;
    },
    locale: {
      register: (ns: string, dicts: unknown) => {
        record.dictionaries.push({ ns, dicts });
        return () => undefined;
      },
    },
    sessions: {
      binding: () => binding,
      using: (_sessionId: string, _options: unknown, run: (reference: unknown) => Promise<unknown>) => run({ binding }),
    },
    remote: {
      $on: () => () => undefined,
      goals: options.goals ?? {},
    },
    slots: {
      inject: (name: string, register: () => void) => {
        record.injections.push({ name, register });
      },
      register: (slotOptions: Record<string, unknown>, component: unknown) => {
        record.registrations.push({ options: slotOptions, component });
      },
    },
    uiConversation: {
      events: { register: (definition: unknown) => record.events.push(definition) },
      userText: { register: (rule: unknown) => record.userText.push(rule) },
    },
  };
  return { ctx, record };
}

/**
 * require giả mà plugin cần (react/jsx-runtime, react, ui-primitives).
 * Nhận: specifier mà plugin yêu cầu.
 * Trả: module giả tương ứng (mặc định là ui-primitives).
 */
export function fakeRequire(specifier: string): unknown {
  if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx };
  if (specifier === "react") return makeReact({ setState: [], cleanups: [] });
  return makePrimitives();
}

/** Số thứ tự dùng để mỗi ca nạp một INSTANCE MODULE riêng. */
let pluginModuleSeq = 0;

/**
 * Nạp MODULE TƯƠI của plugin (cờ chống cài hai lần là PHẠM VI MODULE — dùng lại createPlugin của
 * lần import trước thì ca sau bị cờ chặn và không đăng ký gì).
 * Nhận: không.
 * Trả: mặt plugin mới (createPlugin của instance module vừa nạp).
 */
export async function freshPlugin(): Promise<ReturnType<typeof createPlugin>> {
  pluginModuleSeq += 1;
  const spec = "../../packages/client/ui-goal/src/plugin.ts?fresh=" + String(pluginModuleSeq);
  const mod = (await import(spec)) as { createPlugin: typeof createPlugin };
  return mod.createPlugin(fakeRequire);
}

/**
 * Bộ khung có TRẠNG THÁI giữ giữa các lần render, mô phỏng React thật.
 * Nhận: không.
 * Trả: { deps, setState, reset } — runtime hook, bản ghi setState và hàm đặt lại con trỏ hook.
 */
export function makeStateful() {
  const states: unknown[] = [];
  const initialized: boolean[] = [];
  const depSlots: Record<number, unknown[]> = {};
  const setState: { index: number; value: unknown }[] = [];
  let index = 0;
  const deps: GoalReact = {
    jsx: fakeJsx,
    jsxs: fakeJsx,
    useState<T>(initial: T): [T, (next: T) => void] {
      const at = index++;
      if (initialized[at] !== true) {
        states[at] = initial;
        initialized[at] = true;
      }
      return [states[at] as T, (value: T) => { states[at] = value; setState.push({ index: at, value }); }];
    },
    useRef<T>(initial: T): { current: T } {
      const at = 100 + index;
      if (initialized[at] !== true) {
        states[at] = { current: initial };
        initialized[at] = true;
      }
      index += 1;
      return states[at] as { current: T };
    },
    useEffect(callback: () => void | (() => void), deps: unknown[] = []): void {
      // React CHỈ chạy lại khi deps đổi; chạy mỗi lượt render sẽ xoá sạch trạng thái vừa đặt.
      const at = 200 + index;
      index += 1;
      const previous = depSlots[at] as unknown[] | undefined;
      const changed =
        previous === undefined || previous.length !== deps.length || deps.some((dep, at2) => !Object.is(dep, previous[at2]));
      if (!changed) return;
      depSlots[at] = [...deps];
      callback();
    },
    useCallback<T>(callback: T): T {
      return callback;
    },
  };
  return {
    deps,
    setState,
    /** Đặt lại con trỏ hook trước mỗi lượt render. */
    reset: () => { index = 0; },
  };
}

/**
 * Tìm nút theo `aria-label` trong cây.
 * Nhận: element gốc và nhãn cần tìm.
 * Trả: nút đầu tiên khớp nhãn, hoặc undefined.
 */
export function buttonByLabel(root: Element, label: string): Element | undefined {
  const found: Element[] = [];
  const walk = (node: unknown): void => {
    if (typeof node !== "object" || node === null || !("type" in node)) return;
    const element = node as Element;
    if (element.type === "button" && element.props["aria-label"] === label) found.push(element);
    for (const child of listOf(element)) walk(child);
  };
  walk(root);
  return found[0];
}

/**
 * Tìm element theo loại (component đánh dấu).
 * Nhận: element gốc và loại cần tìm.
 * Trả: element đầu tiên khớp loại, hoặc undefined.
 */
export function elementByType(root: unknown, type: unknown): Element | undefined {
  const found: Element[] = [];
  const walk = (node: unknown): void => {
    if (typeof node !== "object" || node === null || !("type" in node)) return;
    const element = node as Element;
    if (element.type === type) found.push(element);
    for (const child of listOf(element)) walk(child);
  };
  walk(root);
  return found[0];
}

/**
 * Props tối thiểu của dải.
 * Nhận: các props ghi đè (tuỳ chọn).
 * Trả: { calls, props } — nhật ký lời gọi hành động và props đã trộn.
 */
export function barProps(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const actions = {
    onEdit: (objective: string) => { calls.push("edit:" + objective); return Promise.resolve({ ok: true, error: { code: "", message: "" } }); },
    onPause: () => { calls.push("pause"); return Promise.resolve({ ok: true, error: { code: "", message: "" } }); },
    onResume: () => { calls.push("resume"); return Promise.resolve({ ok: true, error: { code: "", message: "" } }); },
    onClear: () => { calls.push("clear"); return Promise.resolve({ ok: true, error: { code: "", message: "" } }); },
  };
  return {
    calls,
    props: {
      goal: { id: "g1", revision: 3, phase: "active", objective: "mục tiêu" },
      activation: "armed",
      t,
      ...actions,
      ...overrides,
    } as Record<string, unknown>,
  };
}

/**
 * Bỏ mọi khoảng trắng để so phần CSS, không phụ thuộc cách xuống dòng.
 * Nhận: văn bản CSS.
 * Trả: văn bản đã bỏ hết khoảng trắng.
 */
export const squash = (text: string): string => text.split(/\s+/).join("");

/**
 * Rút chuỗi CSS mà package gốc nhúng trong bundle client.
 * Nhận: tên module ("GoalBar" | "GoalCommandInputView").
 * Trả: văn bản CSS nguyên gốc.
 */
export async function stockCss(name: string): Promise<string> {
  const path = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-goal", "lib", "client.js");
  const source = await readFile(path, "utf8");
  const pattern = name === "GoalBar" ? /const css\$1 = "((?:[^"\\]|\\.)*)";/ : /const css = "((?:[^"\\]|\\.)*)";/;
  const match = pattern.exec(source);
  expect(match).not.toBeNull();
  return JSON.parse('"' + (match?.[1] ?? "") + '"') as string;
}

/**
 * Đọc manifest của gói ta.
 * Nhận: không.
 * Trả: nội dung package.json của packages/client/ui-goal.
 */
export const oursManifest = async (): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(join(import.meta.dir, "..", "..", "packages", "client", "ui-goal", "package.json"), "utf8")) as Record<string, unknown>;

/**
 * Đọc manifest gói gốc trong kernel.
 * Nhận: không.
 * Trả: nội dung package.json của @deepseek-ai/dsh-client-ui-goal.
 */
export const stockManifest = async (): Promise<Record<string, unknown>> =>
  JSON.parse(
    await readFile(join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-goal", "package.json"), "utf8"),
  ) as Record<string, unknown>;
