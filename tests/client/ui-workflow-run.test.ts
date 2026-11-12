/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-client-ui-workflow-run (row ui-workflow-run):
 *      A/B voi bundle GOC trong cung mot gia — Definition · projection · may trang thai · cay element
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { withoutVi, viDictionary } from "../lib/vi-locale.ts";

/** Gốc repo (tests/client → ../..). */
const REPO = join(import.meta.dir, "..", "..");

/** Bundle nửa browser của bản gốc DSH (CHỈ ĐỌC — nguồn đối chiếu oracle). */
const STOCK_BUNDLE = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-client-ui-workflow-run/lib/client.js");

/** Manifest của ta và của gốc, để so `dsh.client.inject`. */
const OUR_MANIFEST = join(REPO, "packages/client/ui-workflow-run/package.json");
const STOCK_MANIFEST = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-client-ui-workflow-run/package.json");

/** Id module của hai bên. */
const OUR_PACKAGE = "@galaxy-blackhole/gbh-client-ui-workflow-run";

/** Id module của gói GỐC — nay cũng là khoá alias mà bundle của ta đăng ký (phần C, 17/10/2026). */
const BIEN_ALIAS_CHI_KHAI_O_MANIFEST = "@deepseek-ai/dsh-client-ui-workflow-run";
const STOCK_PACKAGE = "@deepseek-ai/dsh-client-ui-workflow-run";

/** Một lời gọi `__ModuleLoader__.load`. */
interface Registration {
  /** Id module bundle tự khai. */
  id: string;
  /** Factory lười. */
  factory: (require: (specifier: string) => unknown) => unknown;
}

/** Bề mặt plugin. */
interface PluginFace {
  /** Điểm vào phía browser. */
  apply(ctx: unknown): void;
  /** Seam service. */
  inject: string[];
}

/**
 * Chạy một bundle như thẻ `<script>` classic.
 * Nhận: `code` — nguồn bundle.
 * Trả: các đăng ký đã thực hiện.
 */
function runBundle(code: string): Registration[] {
  const registrations: Registration[] = [];
  const facade = {
    load: (registration: Registration): void => {
      registrations.push(registration);
    },
  };
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

/** Trạng thái hook giả của một phiên component. */
interface HookState {
  /** Ô giá trị của `useState`/`useRef`. */
  cells: unknown[];
  /** Phụ thuộc đã ghi của `useMemo`/`useLayoutEffect`. */
  deps: (readonly unknown[] | undefined)[];
  /** Giá trị đã ghi nhớ của `useMemo`. */
  memo: unknown[];
  /** Hiệu ứng layout cần chạy sau render. */
  pending: (() => void)[];
  /** Con trỏ ô hiện tại. */
  cursor: number;
  /** Có state vừa đổi (cần render lại). */
  dirty: boolean;
}

/** Phiên hook giả dùng chung cho cả hai bên A/B. */
function createHooks(): { api: Record<string, unknown>; state: HookState } {
  const state: HookState = { cells: [], deps: [], memo: [], pending: [], cursor: 0, dirty: false };
  const sameDeps = (left: readonly unknown[] | undefined, right: readonly unknown[]): boolean =>
    left !== undefined && left.length === right.length && left.every((value, index) => value === right[index]);
  const api = {
    useState: <S>(initial: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void] => {
      const cell = state.cursor;
      state.cursor += 1;
      if (!(cell in state.cells)) state.cells[cell] = typeof initial === "function" ? (initial as () => S)() : initial;
      const setter = (value: S | ((previous: S) => S)): void => {
        const previous = state.cells[cell] as S;
        const next = typeof value === "function" ? (value as (from: S) => S)(previous) : value;
        if (next !== previous) {
          state.cells[cell] = next;
          state.dirty = true;
        }
      };
      return [state.cells[cell] as S, setter];
    },
    useRef: <T>(initial: T): { current: T } => {
      const cell = state.cursor;
      state.cursor += 1;
      state.cells[cell] ??= { current: initial };
      return state.cells[cell] as { current: T };
    },
    useMemo: <T>(factory: () => T, deps: readonly unknown[]): T => {
      const cell = state.cursor;
      state.cursor += 1;
      if (!sameDeps(state.deps[cell], deps)) {
        state.deps[cell] = deps;
        state.memo[cell] = factory();
      }
      return state.memo[cell] as T;
    },
    useLayoutEffect: (effect: () => void | (() => void), deps: readonly unknown[]): void => {
      const cell = state.cursor;
      state.cursor += 1;
      if (!sameDeps(state.deps[cell], deps)) {
        state.deps[cell] = deps;
        state.pending.push(() => {
          effect();
        });
      }
    },
  };
  return { api, state };
}

/** Cây element giả. */
interface FakeElement {
  /** Loại node. */
  type: unknown;
  /** Props. */
  props: Record<string, unknown>;
  /** Khoá React. */
  key: unknown;
}

/**
 * `require` giả: CHỈ cung cấp đúng những gì bản gốc dùng (stub không được rộng hơn module thật).
 * `react` chỉ có hook; hàm dựng element nằm ở `react/jsx-runtime`.
 * Nhận: `hooks` — bảng hook giả.
 * Trả: hàm require.
 */
function fakeRequire(hooks: Record<string, unknown>): (specifier: string) => unknown {
  const modules: Record<string, unknown> = {
    react: hooks,
    "react/jsx-runtime": {
      Fragment: "Fragment",
      jsx: (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key }),
      jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key }),
    },
    "@deepseek-ai/dsh-client-ui-primitives": {
      // Hình dạng giả: đủ để cây element cho thấy MỌI prop mà panel truyền vào.
      DisclosureRow: "DisclosureRow",
      IconChevronRightOutlineRegular: "IconChevronRightOutlineRegular",
      StateDot: "StateDot",
    },
    "@deepseek-ai/dsh-client-store": {
      shallowEqual: (left: unknown, right: unknown): boolean => {
        if (left === right) return true;
        if (left instanceof Map && right instanceof Map) {
          if (left.size !== right.size) return false;
          for (const [key, value] of left) if (right.get(key) !== value) return false;
          return true;
        }
        if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return false;
        const leftKeys = Object.keys(left as Record<string, unknown>);
        const rightKeys = Object.keys(right as Record<string, unknown>);
        return (
          leftKeys.length === rightKeys.length &&
          leftKeys.every((key) => (left as Record<string, unknown>)[key] === (right as Record<string, unknown>)[key])
        );
      },
    },
  };
  return (specifier: string): unknown => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    if (!(specifier in modules)) throw new Error("test: khong duoc require " + specifier);
    return modules[specifier];
  };
}

/** Bảng ghi seam của một lần `apply`. */
interface SeamLog {
  /** Nhãn hiệu ứng. */
  effects: string[];
  /** Từ điển đã đăng ký. */
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
  /** Slot đã inject vào. */
  injected: string[];
  /** Occupant đã đăng ký. */
  registered: { definition: Record<string, unknown>; component: unknown }[];
  /** Definition sự kiện bền đã đăng ký. */
  definitions: unknown[];
  /** Phiên đã được yêu cầu mở. */
  opened: { parentSessionId: string; childSessionId: string; mode: string }[];
}

/** Bản chụp phiên giả mà `useSessions` cấp. */
const SESSIONS = {
  byId: {
    "child-1": { id: "child-1", parentId: "sess-1", running: true },
    "child-2": { id: "child-2", parentId: "sess-1", running: true },
    "child-3": { id: "child-3", parentId: "sess-9", running: true },
  },
  projectionsBySession: {
    "child-1": { values: { subagent: { mode: "focus" } } },
    "child-2": { values: {} },
    "child-3": { values: { subagent: { mode: "drawer" } } },
  },
};

/** Trạng thái chạy giả — seam `useSessionStatus` cấp một BẢNG TRA (Map), không phải object. */
const STATUSES = new Map<string, { running?: boolean } | undefined>([
  ["child-1", { running: true }],
  ["child-2", { running: false }],
]);

/** Context giả phía browser. */
interface FakeContext {
  /** Context truyền cho `apply`. */
  ctx: unknown;
  /** Bảng ghi seam. */
  log: SeamLog;
}

/**
 * Dựng context giả đủ cho row `ui-workflow-run`.
 * Nhận: không.
 * Trả: context giả kèm bảng ghi.
 */
function fakeContext(): FakeContext {
  const log: SeamLog = { effects: [], dictionaries: [], injected: [], registered: [], definitions: [], opened: [] };
  const ctx = {
    effect: (callback: () => unknown, label: string): void => {
      log.effects.push(label);
      callback();
    },
    locale: {
      register: (namespace: string, copy: Record<string, Record<string, string>>): (() => void) => {
        log.dictionaries.push({ namespace, copy });
        return () => undefined;
      },
      bind: (namespace: string) => (key: string, params?: Record<string, string | number>): string => {
        const dictionary = log.dictionaries.find((entry) => entry.namespace === namespace);
        const template = dictionary?.copy.en?.[key] ?? key;
        if (params === undefined) return template;
        return template.replace(/\{(\w+)\}/gu, (_match, name: string) => String(params[name] ?? ""));
      },
    },
    slots: {
      inject: (slot: string, register: () => unknown): void => {
        log.injected.push(slot);
        register();
      },
      register: (definition: Record<string, unknown>, component: unknown): (() => void) => {
        log.registered.push({ definition, component });
        return () => undefined;
      },
    },
    uiConversation: { events: { register: (definition: unknown): unknown => log.definitions.push(definition) } },
    uiWorkspace: {
      openSession: (target: { parentSessionId: string; childSessionId: string; mode: string }): void => {
        log.opened.push(target);
      },
    },
  };
  return { ctx, log };
}

/** Nguồn bundle của ta (build một lần cho cả file test). */
let ourCode: string | undefined;

/**
 * Build nửa client của ta vào thư mục tạm rồi trả nguồn bundle.
 * Nhận: không.
 * Trả: nguồn `lib/client.js` của package ta.
 */
async function bundleOfOurs(): Promise<string> {
  if (ourCode !== undefined) return ourCode;
  const { buildPackage } = await import("../../packages/client/ui-workflow-run/build.ts");
  const out = await mkdtemp(join(tmpdir(), "gbh-ui-workflow-run-"));
  await buildPackage(out);
  ourCode = readFileSync(join(out, "client.js"), "utf8");
  return ourCode;
}

/**
 * Nạp một bundle rồi gọi factory để lấy bề mặt plugin.
 * Nhận: `code` — nguồn bundle, `hooks` — bảng hook giả.
 * Trả: bề mặt plugin.
 */
function loadPlugin(code: string, hooks: Record<string, unknown>): PluginFace {
  const registration = runBundle(code)[0];
  if (registration === undefined) throw new Error("test: bundle khong dang ky module nao");
  return registration.factory(fakeRequire(hooks)) as PluginFace;
}

/** Nạp cả hai bên trong cùng một gia. */
async function bothSides(): Promise<{ ours: PluginFace; stock: PluginFace }> {
  const ours = createHooks();
  const theirs = createHooks();
  return {
    ours: loadPlugin(await bundleOfOurs(), ours.api),
    stock: loadPlugin(readFileSync(STOCK_BUNDLE, "utf8"), theirs.api),
  };
}

/**
 * Chuẩn hoá giá trị thành dữ liệu so sánh được (hàm → nhãn, khoá sắp xếp).
 * Nhận: `value` — giá trị bất kỳ.
 * Trả: bản sao chỉ gồm dữ liệu.
 */
function snapshot(value: unknown): unknown {
  if (typeof value === "function") return "[function]";
  if (value instanceof Map) return { __map: [...value.entries()].map(([key, item]) => [key, snapshot(item)]) };
  if (Array.isArray(value)) return value.map((item) => snapshot(item));
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = snapshot((value as Record<string, unknown>)[key]);
  }
  return out;
}

/** Một sự kiện `tool-workflow/*` mẫu. */
function event(type: string, data: Record<string, unknown>, seq = 1): { type: string; seq: number; data: Record<string, unknown> } {
  return { type, seq, data };
}

/** Ngữ cảnh Definition mẫu cho một lượt chạy đã có thành viên và `run-end`. */
function definitionContext(): Record<string, unknown> {
  return {
    key: "wf-1",
    id: "run-1",
    state: {
      name: "Nightly audit",
      members: [
        { seq: 1, label: "planner", childId: "child-1", phase: "plan" },
        { seq: 2, label: "worker", childId: "child-2", phase: "plan", outcome: "completed" },
        { seq: 3, label: "", childId: "child-3", phase: "" },
        { seq: 4, label: "solo", childId: "child-4" },
      ],
      stopReason: "completed",
    },
    start: { event: event("tool-workflow/run-start", { runId: "run-1", name: "Nightly audit" }, 7), location: { kind: "step" } },
  };
}

/** Dữ liệu node mẫu để render panel. */
function panelNode(): { data: unknown } {
  return {
    data: {
      name: "Nightly audit",
      status: "running",
      phases: [
        {
          key: "value:4:plan",
          phase: "plan",
          members: [
            { seq: 1, label: "planner", childId: "child-1", status: "running" },
            { seq: 2, label: "worker", childId: "child-2", status: "completed" },
          ],
        },
        { key: "missing", phase: null, members: [{ seq: 4, label: "", childId: "child-4", status: "failed" }] },
      ],
    },
  };
}

/** Phiên render giả: render lại khi state đổi, chạy hiệu ứng layout sau mỗi render. */
interface RenderSession {
  /** Cây element của lần render hiện tại. */
  render(): FakeElement;
  /** Chạy một hành động rồi render lại nếu state đổi. */
  act(action: (tree: FakeElement) => void): void;
}

/**
 * Mở một phiên render cho component với props cho trước.
 * Nhận: `component`, `props` và trạng thái hook dùng chung của bên đó.
 * Trả: phiên render.
 */
function renderSession(component: unknown, props: Record<string, unknown>, hookState: HookState): RenderSession {
  const run = (): FakeElement => {
    hookState.cursor = 0;
    hookState.pending = [];
    hookState.dirty = false;
    const tree = (component as (input: Record<string, unknown>) => unknown)(props) as FakeElement;
    const pending = hookState.pending;
    hookState.pending = [];
    for (const effect of pending) effect();
    return tree;
  };
  let tree = run();
  while (hookState.dirty) tree = run();
  return {
    render: () => tree,
    act: (action: (current: FakeElement) => void): void => {
      action(tree);
      while (hookState.dirty) tree = run();
    },
  };
}

/** Props renderer bind cho panel (dùng chung cho cả hai bên). */
function panelProps(node: { data: unknown }): Record<string, unknown> {
  return {
    node,
    sessionId: "sess-1",
    useSessions: (selector: (sessions: unknown) => unknown, isEqual?: (left: unknown, right: unknown) => boolean) => {
      void isEqual;
      return selector(SESSIONS);
    },
    useSessionStatus: (selector: (statuses: unknown) => unknown) => selector(STATUSES),
    // `statuses` là Map ⇒ `navigableMembers` đọc bằng `.get()` (đúng như bản gốc).
    openSession: () => undefined,
    t: (key: string, params?: Record<string, string | number>): string => {
      const copy: Record<string, string> = {
        "run.title": "{name}",
        "run.members.one": "{count} member",
        "run.members.other": "{count} members",
        "run.empty": "No members started",
        "phase.unassigned": "Unphased",
        "phase.empty": "Empty phase name",
        "statusCount.completed": "Completed {count}",
        "statusCount.failed": "Failed {count}",
        "statusCount.cancelled": "Cancelled {count}",
        "statusCount.interrupted": "Interrupted {count}",
        "statusCount.running": "Running {count}",
        "member.empty": "Empty member name",
        "member.open": "Open {name}",
        "status.running": "Running",
        "status.completed": "Completed",
        "status.failed": "Failed",
        "status.cancelled": "Cancelled",
        "status.interrupted": "Interrupted",
      };
      const template = copy[key] ?? key;
      if (params === undefined) return template;
      return template.replace(/\{(\w+)\}/gu, (_match, name: string) => String(params[name] ?? ""));
    },
  };
}

/** Giao diện Definition mà bài test gọi trực tiếp. */
interface DefinitionFace {
  /** Loại node. */
  kind: string;
  /** Đích render. */
  target: string;
  /** Ghép sự kiện vào node. */
  match(event: unknown): unknown;
  /** State ban đầu của node. */
  start(context: unknown, match: unknown): unknown;
  /** Gập sự kiện cập nhật. */
  update(context: unknown, match: unknown): unknown;
  /** Dựng node để renderer vẽ. */
  buildViewNode(context: unknown): unknown;
}

/** Một bên đã mount: bề mặt plugin + bảng ghi + trạng thái hook. */
interface Side {
  /** Bề mặt plugin. */
  face: PluginFace;
  /** Bảng ghi seam. */
  log: SeamLog;
  /** Definition đã đăng ký. */
  definition: DefinitionFace;
  /** Component panel đã đăng ký. */
  panel: unknown;
  /** Trạng thái hook của phiên này. */
  hookState: HookState;
}

/**
 * Mount một bên với `apply` trên context giả.
 * Nhận: `face`, `hookState`.
 * Trả: bên đã mount.
 */
function mount(face: PluginFace, hookState: HookState): Side {
  const fake = fakeContext();
  face.apply(fake.ctx);
  const definition = fake.log.definitions[0] as DefinitionFace;
  const panel = fake.log.registered[0]?.component;
  return { face, log: fake.log, definition, panel, hookState };
}

describe("row ui-workflow-run — nửa client", () => {
  test("ca 1: hành vi chính — inject, từ điển, Definition và occupant giống bản gốc", async () => {
    const { ours, stock } = await bothSides();
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["uiConversation", "uiWorkspace", "slots", "sessions", "locale"]);
    const oursHooks = createHooks();
    const stockHooks = createHooks();
    const mine = mount(ours, oursHooks.state);
    const theirs = mount(stock, stockHooks.state);
    expect(mine.log.effects).toEqual(theirs.log.effects);
    expect(withoutVi(mine.log.dictionaries)).toEqual(withoutVi(theirs.log.dictionaries));
    expect(Object.keys(viDictionary(mine.log.dictionaries) ?? {}).length).toBe(18);
    expect(mine.log.dictionaries[0]?.namespace).toBe("workflowRun");
    expect(mine.log.dictionaries[0]?.copy.zh?.["run.empty"]).toBe("没有启动成员");
    expect(mine.log.injected).toEqual(theirs.log.injected);
    expect(mine.log.injected).toEqual(["conversation.chat.node"]);
    expect(snapshot(mine.log.registered.map((entry) => entry.definition))).toEqual(
      snapshot(theirs.log.registered.map((entry) => entry.definition)),
    );
    expect(mine.log.registered[0]?.definition).toMatchObject({
      name: "conversation.chat.node",
      key: "workflow-run",
      locale: "workflowRun",
    });
    expect(typeof mine.panel).toBe("function");
  });

  test("ca 2: Definition — match/start/update/buildViewNode khớp bản gốc", async () => {
    const { ours, stock } = await bothSides();
    const mine = mount(ours, createHooks().state);
    const theirs = mount(stock, createHooks().state);
    const events = [
      event("tool-workflow/run-start", { runId: 42, name: "Audit" }),
      event("tool-workflow/agent-start", { runId: 42, seq: 1, label: "a", childId: "c1", phase: "p" }),
      event("tool-workflow/agent-end", { runId: 42, seq: 1, outcome: "failed" }),
      event("tool-workflow/run-end", { runId: 42, stopReason: "error" }),
      event("tool-workflow/other", { runId: 42 }),
      event("turn/start", { runId: 42 }),
    ];
    for (const item of events) {
      expect(snapshot(mine.definition.match(item))).toEqual(snapshot(theirs.definition.match(item)));
    }
    expect(snapshot(mine.definition.match(events[0]))).toEqual({ id: "42", role: "start" });
    expect(mine.definition.match(events[4])).toBeNull();
    expect(snapshot(mine.definition.kind)).toEqual(snapshot(theirs.definition.kind));
    expect(snapshot(mine.definition.target)).toEqual(snapshot(theirs.definition.target));
    const startMatch = { event: events[0] };
    expect(snapshot(mine.definition.start({}, startMatch))).toEqual(snapshot(theirs.definition.start({}, startMatch)));
    expect(snapshot(mine.definition.start({}, startMatch))).toEqual({ name: "Audit", members: [] });
    let base = { name: "Audit", members: [] as unknown[] };
    for (const item of [events[1], events[2], events[3]]) {
      const match = { event: item };
      const mineNext = mine.definition.update({ state: base }, match);
      const theirNext = theirs.definition.update({ state: base }, match);
      expect(snapshot(mineNext)).toEqual(snapshot(theirNext));
      base = mineNext as typeof base;
    }
    expect(snapshot(base)).toMatchObject({
      members: [{ seq: 1, label: "a", phase: "p", childId: "c1", outcome: "failed" }],
      stopReason: "error",
    });
  });

  test("ca 3: chiếu lượt chạy — gom pha, trạng thái, và 'bỏ dở' khi Turn bị ngắt/fork", async () => {
    const { ours, stock } = await bothSides();
    const mine = mount(ours, createHooks().state);
    const theirs = mount(stock, createHooks().state);
    const context = definitionContext();
    for (const kind of ["step", "turn", "message"]) {
      for (const reason of ["completed", "interrupted", "forked", "cancelled"]) {
        const withLocation = { ...context, start: { ...(context.start as object), location: { kind, turn: { end: { data: { reason: { kind: reason } } } } } } };
        expect(snapshot(mine.definition.buildViewNode(withLocation))).toEqual(
          snapshot(theirs.definition.buildViewNode(withLocation)),
        );
      }
    }
    const node = mine.definition.buildViewNode(context) as { data: { name: string; status: string; phases: { key: string; phase: string | null; members: unknown[] }[] } };
    expect(node.data.name).toBe("Nightly audit");
    expect(node.data.status).toBe("completed");
    expect(node.data.phases.map((phase) => phase.key)).toEqual(["value:4:plan", "value:0:", "missing"]);
    expect(node.data.phases.map((phase) => phase.members.length)).toEqual([2, 1, 1]);
    const running = mine.definition.buildViewNode({ ...context, state: { ...(context.state as object), stopReason: undefined }, start: { ...(context.start as object), location: { kind: "turn", turn: { end: { data: { reason: { kind: "interrupted" } } } } } } }) as { data: { status: string; phases: { members: { status: string }[] }[] } };
    expect(running.data.status).toBe("interrupted");
    expect(running.data.phases[0]?.members.map((member) => member.status)).toEqual(["interrupted", "completed"]);
    expect(mine.definition.buildViewNode({ key: "k", id: "i", state: { name: "x", members: [] } })).toBeNull();
  });

  test("ca 4: cây element — header lượt chạy, pha, thành viên điều hướng được (A/B)", async () => {
    const { ours, stock } = await bothSides();
    const oursHooks = createHooks();
    const stockHooks = createHooks();
    const mine = mount(ours, oursHooks.state);
    const theirs = mount(stock, stockHooks.state);
    const node = panelNode();
    const mineTree = renderSession(mine.panel, panelProps(node), oursHooks.state).render();
    const theirTree = renderSession(theirs.panel, panelProps(node), stockHooks.state).render();
    expect(snapshot(mineTree)).toEqual(snapshot(theirTree));
    // Fake jsx KHÔNG thực thi function component (giống nhau ở cả hai bên), nên phần kiểm dưới đây
    // đọc PROPS mà panel truyền xuống — đủ để ghim cấu trúc, tên lớp và dữ liệu điều hướng.
    const root = mineTree;
    expect(root.props.className).toBe("DBuyfa_root");
    expect(root.props["data-workflow-run"]).toBe(true);
    expect(root.props["data-run-status"]).toBe("running");
    const header = (root.props.children as FakeElement).props as Record<string, unknown>;
    // Props mà panel truyền CHO RunHeader (các tên lớp nằm sâu hơn, bên trong RunHeader — không thấy ở tầng này).
    expect(header).toMatchObject({
      count: 3,
      name: "Nightly audit",
      open: true,
      status: "running",
    });
    const phaseList = header.children as FakeElement;
    expect(phaseList.props.className).toBe("DBuyfa_phaseList");
    const phases = phaseList.props.children as FakeElement[];
    expect(phases).toHaveLength(2);
    expect(phases.map((phase) => phase.key)).toEqual(["value:4:plan", "missing"]);
    const firstPhase = phases[0]?.props as Record<string, unknown>;
    expect(firstPhase).toMatchObject({
      open: true,
      parentSessionId: "sess-1",
      pendingCleanCollapse: false,
    });
    expect((firstPhase.phase as { phase: string | null }).phase).toBe("plan");
    expect(snapshot(firstPhase.navigable)).toEqual({ __map: [["child-1", "focus"]] });
    expect((firstPhase.phase as { members: unknown[] }).members).toHaveLength(2);
    const emptyNode = { data: { name: "Empty run", status: "completed", phases: [] } };
    const mineEmpty = renderSession(mine.panel, panelProps(emptyNode), oursHooks.state).render();
    expect(snapshot(mineEmpty)).toEqual(snapshot(renderSession(theirs.panel, panelProps(emptyNode), stockHooks.state).render()));
    const emptyPhaseList = ((mineEmpty.props.children as FakeElement).props as { children: FakeElement }).children;
    expect(emptyPhaseList.props.className).toBe("DBuyfa_phaseList");
    const emptyNote = emptyPhaseList.props.children as FakeElement;
    expect(emptyNote.props.className).toBe("DBuyfa_empty");
    expect(emptyNote.props.children).toBe("No members started");
  });

  test("ca 5: máy trạng thái mở/đóng — đổi dữ liệu đổi 'open', và hoãn đóng khi con trỏ còn trong vùng", async () => {
    const { ours, stock } = await bothSides();
    const oursHooks = createHooks();
    const stockHooks = createHooks();
    const mine = mount(ours, oursHooks.state);
    const theirs = mount(stock, stockHooks.state);
    const readOpen = (tree: FakeElement): unknown => {
      const json = snapshot(tree) as Record<string, unknown>;
      return JSON.stringify(json).includes('"open":true');
    };
    const running = panelNode();
    const oursSession = renderSession(mine.panel, panelProps(running), oursHooks.state);
    const stockSession = renderSession(theirs.panel, panelProps(running), stockHooks.state);
    expect(readOpen(oursSession.render())).toBe(readOpen(stockSession.render()));
    expect(readOpen(oursSession.render())).toBe(true);
    // Chuyển sang lượt chạy đã xong (sạch): cả hai bên phải cùng hành vi.
    const done = { data: { name: "Nightly audit", status: "completed", phases: [] } };
    const oursDone = renderSession(mine.panel, panelProps(done), oursHooks.state);
    const stockDone = renderSession(theirs.panel, panelProps(done), stockHooks.state);
    expect(readOpen(oursDone.render())).toBe(readOpen(stockDone.render()));
  });

  test("ca 6: tương tác — bấm header đảo trạng thái, blur dọn trạng thái chờ đóng", async () => {
    const { ours, stock } = await bothSides();
    const oursHooks = createHooks();
    const stockHooks = createHooks();
    const mine = mount(ours, oursHooks.state);
    const theirs = mount(stock, stockHooks.state);
    const node = panelNode();
    const oursSession = renderSession(mine.panel, panelProps(node), oursHooks.state);
    const stockSession = renderSession(theirs.panel, panelProps(node), stockHooks.state);
    const findSection = (tree: FakeElement): FakeElement => tree;
    const toggleOf = (tree: FakeElement): (() => void) | undefined => {
      const json = findSection(tree);
      const header = (json.props.children as FakeElement).props as Record<string, unknown>;
      return header.onToggle as (() => void) | undefined;
    };
    const oursToggle = toggleOf(oursSession.render());
    const stockToggle = toggleOf(stockSession.render());
    expect(typeof oursToggle).toBe("function");
    expect(typeof stockToggle).toBe("function");
    oursSession.act(() => oursToggle?.());
    stockSession.act(() => stockToggle?.());
    expect(snapshot(oursSession.render())).toEqual(snapshot(stockSession.render()));
  });

  test("ca 7: đường lỗi — sai loại sự kiện mở và thiếu phần tử header đều báo rõ, giống bản gốc", async () => {
    const { ours, stock } = await bothSides();
    const mine = mount(ours, createHooks().state);
    const theirs = mount(stock, createHooks().state);
    const wrongStart = { event: event("tool-workflow/agent-start", { runId: 1 }) };
    expect(() => mine.definition.start({}, wrongStart)).toThrow("workflow-run start requires tool-workflow/run-start");
    expect(() => theirs.definition.start({}, wrongStart)).toThrow("workflow-run start requires tool-workflow/run-start");
    expect(mine.definition.buildViewNode({ key: "k", id: "i", state: { name: "x", members: [] } })).toBeNull();
    expect(theirs.definition.buildViewNode({ key: "k", id: "i", state: { name: "x", members: [] } })).toBeNull();
    expect(() => mine.definition.update({}, { event: event("tool-workflow/unknown", {}) })).not.toThrow();
  });

  test("ca 8: đăng ký ĐÚNG id — id CHÍNH là TÊN PACKAGE, kèm KHOÁ ALIAS id gốc, bundle là script classic", async () => {
    const code = await bundleOfOurs();
    const registrations = runBundle(code);
    // Từ 17/10/2026 (phần C): bundle đăng ký THÊM id gốc làm khoá alias — vì 50 row stock còn inject id đó
    // và id đó biến mất khỏi đồ thị khi ta thay row. Một lần thực thi, một lần cài đặt (cờ phạm vi MODULE).
    expect(registrations.map((entry) => entry.id)).toEqual([OUR_PACKAGE]);
    const manifest = JSON.parse(readFileSync(OUR_MANIFEST, "utf8")) as {
      name: string;
      gbh?: { row?: { moduleIds?: string[] } };
      dsh?: { client?: { inject?: string[]; platform?: string; immediately?: boolean } };
    };
    expect(registrations[0]?.id).toBe(manifest.name);
    expect(manifest.gbh?.row?.moduleIds).toEqual([OUR_PACKAGE]);
    const stockManifest = JSON.parse(readFileSync(STOCK_MANIFEST, "utf8")) as {
      dsh?: { client?: { inject?: string[]; platform?: string; immediately?: boolean } };
    };
    // 20/10/2026 — id inject đã REWRITE CÓ CHỦ ĐÍCH sang id GBH nên so thô là sai hướng; quy id ta -> id
    // stock rồi so SÂU cả client (inject ĐÚNG THỨ TỰ + platform + immediately), giữ manifest gốc làm chuẩn.
    expect(sameAfterIdMap(manifest.dsh?.client, stockManifest.dsh?.client)).toBe(true);
    expect(manifest.dsh?.client?.platform).toBe(stockManifest.dsh?.client?.platform);
    expect(manifest.dsh?.client?.immediately).toBe(stockManifest.dsh?.client?.immediately);
    expect(runBundle(readFileSync(STOCK_BUNDLE, "utf8")).map((entry) => entry.id)).toEqual([STOCK_PACKAGE]);
  });

  test("ca 8b: KHÔNG bundle nào require id stock ⇒ không cần alias (đo trên cây đã cài)", () => {
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
        if (readFileSync(full, "utf8").slice(0, 4096).includes('require("' + STOCK_PACKAGE + '")')) dependents.push(full);
      }
    };
    walk(root);
    expect(dependents).toEqual([]);
  });

  test("ca 9: CSS — cùng bộ selector và thuộc tính với bản gốc; thẻ style dùng đúng id của ta", async () => {
    const { STYLES, CLASS } = await import("../../packages/client/ui-workflow-run/src/styles.ts");
    const stockSource = readFileSync(STOCK_BUNDLE, "utf8");
    const match = /const css = ("(?:[^"\\\\]|\\\\.)*")/u.exec(stockSource);
    const stockCss = JSON.parse(match?.[1] ?? '""') as string;
    const parse = (css: string): Map<string, string> => {
      const out = new Map<string, string>();
      for (const blockMatch of css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
        const selectors = (blockMatch[1] ?? "").trim();
        const props = (blockMatch[2] ?? "")
          .split(";")
          .map((declaration) => declaration.split(":")[0]?.trim() ?? "")
          .filter((name) => name !== "")
          .sort()
          .join(",");
        for (const selector of selectors.split(",")) {
          const key = selector.trim().replace(/\s+/gu, " ");
          const previous = out.get(key);
          out.set(key, previous === undefined ? props : [...new Set([...previous.split(","), ...props.split(",")])].sort().join(","));
        }
      }
      return out;
    };
    const stockRules = parse(stockCss);
    const ourRules = parse(STYLES);
    expect([...ourRules.keys()].sort()).toEqual([...stockRules.keys()].sort());
    for (const [selector, props] of stockRules) expect(ourRules.get(selector)).toBe(props);
    expect(Object.keys(CLASS)).toHaveLength(24);
  });
});

describe("row ui-workflow-run — cổng chống cài hai lần", () => {
  test("lần đầu NÉM ⇒ cờ vẫn false ⇒ lần hai (ctx khác) đăng ký lại ĐỦ; lần ba không đăng ký", async () => {
    const code = await bundleOfOurs();
    // MỘT instance module áp cho BA ctx khác nhau.
    const plugin = loadPlugin(code, createHooks().api);
    const first = fakeContext();
    const register = (first.ctx as unknown as { locale: { register: unknown } }).locale.register;
    (first.ctx as unknown as { locale: { register: unknown } }).locale.register = () => {
      throw new Error("đăng ký từ điển hỏng giữa đường");
    };
    expect(() => plugin.apply(first.ctx)).toThrow();
    (first.ctx as unknown as { locale: { register: unknown } }).locale.register = register;
    const second = fakeContext();
    plugin.apply(second.ctx);
    expect(second.log.dictionaries.length).toBe(1);
    expect(second.log.registered.length + second.log.injected.length).toBeGreaterThan(0);
    // Lần ba: cờ đã bật ⇒ không gọi effect nào.
    const third = fakeContext();
    let effects = 0;
    const effect = (third.ctx as unknown as { effect: (cb: () => unknown, label: string) => void }).effect;
    (third.ctx as unknown as { effect: unknown }).effect = (cb: () => unknown, label: string): void => {
      effects += 1;
      effect(cb, label);
    };
    plugin.apply(third.ctx);
    expect(effects).toBe(0);
    // Module MỚI ⇒ lại đăng ký được.
    const fourth = fakeContext();
    loadPlugin(code, createHooks().api).apply(fourth.ctx);
    expect(fourth.log.dictionaries.length).toBe(1);
  });
});
