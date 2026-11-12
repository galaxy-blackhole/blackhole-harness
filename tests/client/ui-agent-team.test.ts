/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test row agent-team: nửa host (apply rỗng) + nửa browser (locale 27 khoá · mount/occupant slot ·
 *      TeamAction) đối chứng TRỰC TIẾP bundle gốc — CSS/class/INJECT/slot lấy từ chính lib/client.js của
 *      DSH, và CÂY ELEMENT của ta so với cây của component GỐC trên cùng runtime giả.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/client/ui-agent-team/build.ts";
import { TEAM_ACTION_CLASS } from "../../packages/client/ui-agent-team/src/class-names.ts";
import { apply } from "../../packages/client/ui-agent-team/src/index.ts";
import { INJECT, PACKAGE_NAME, SLOT_CONVERSATION_HEADER_ACTIONS, STOCK_PACKAGE_NAME, STYLE_TAG, TEAM_ACTION_ID, TEAM_ACTION_ORDER } from "../../packages/client/ui-agent-team/src/ids.ts";
import { NS, en, zh } from "../../packages/client/ui-agent-team/src/locales.ts";
import { registerAgentTeamUi } from "../../packages/client/ui-agent-team/src/mount.ts";
import type { AgentTeamClientCtx } from "../../packages/client/ui-agent-team/src/mount.ts";
import { createSetTeamLimitsRow, readTeamLimits } from "../../packages/client/ui-agent-team/src/set-team-limits-row.ts";
import { createTeamAction } from "../../packages/client/ui-agent-team/src/team-action.ts";
import type { TeamActionProps, TeamComponentRuntime } from "../../packages/client/ui-agent-team/src/team-types.ts";

/** Gốc package của ta. */
const BASE = join(import.meta.dir, "..", "..", "packages", "client", "ui-agent-team");
/** Bundle GỐC (CHỈ ĐỌC) — oracle cho CSS, bảng lớp, INJECT và cây element. */
const STOCK_BUNDLE = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-client-ui-agent-team", "lib", "client.js");

/** Nội dung bundle gốc. */
const stockCode = readFileSync(STOCK_BUNDLE, "utf8");

/** Artifact của ta (gán trong beforeAll). */
let artifact = { host: "", client: "" };
/** Thư mục tạm (gán trong beforeAll). */
let outDir = "";

/** Document giả tối thiểu cho createPortal + listener bàn phím (môi trường bun không có DOM). */
interface FakeDocument {
  /** Phần tử gốc của portal. */
  body: Record<string, unknown>;
  /** Phần tử đang có focus. */
  activeElement: unknown;
  /** Đăng ký người nghe. */
  addEventListener(type: string, listener: unknown): void;
  /** Gỡ người nghe. */
  removeEventListener(type: string, listener: unknown): void;
  /** Tìm thẻ style đã chèn. */
  querySelector(selector: string): unknown;
  /** Tạo thẻ (chưa dùng trong test). */
  createElement(tag: string): Record<string, unknown>;
  /** Đầu document (chứa thẻ style). */
  head: { appendChild(node: unknown): void };
}

/** Document giả đã cài (gán trong beforeAll). */
let fakeDocument: FakeDocument | undefined;

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-agent-team-"));
  artifact = await buildPackage(outDir);
  const listeners = new Map<string, Set<unknown>>();
  fakeDocument = {
    body: {},
    activeElement: null,
    addEventListener: (type, listener) => { const set = listeners.get(type) ?? new Set(); set.add(listener); listeners.set(type, set); },
    removeEventListener: (type, listener) => { listeners.get(type)?.delete(listener); },
    querySelector: () => null,
    createElement: (tag) => ({ tag, dataset: {}, textContent: "" }),
    head: { appendChild: () => undefined },
  };
  (globalThis as unknown as { document?: FakeDocument }).document = fakeDocument;
});

afterAll(async () => {
  delete (globalThis as unknown as { document?: FakeDocument }).document;
  if (outDir !== "") await rm(outDir, { recursive: true, force: true });
});

/**
 * Bỏ mọi khoảng trắng để so CSS theo nội dung khai báo.
 * Nhận: văn bản CSS.
 * Trả: chuỗi đã bỏ hết khoảng trắng và comment.
 */
function normalizeCss(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");
}

/**
 * Lấy chuỗi CSS của bản gốc từ bundle.
 * Nhận: không.
 * Trả: chuỗi CSS (đã giải escape JSON).
 */
function stockCss(): string {
  const match = stockCode.match(/const css = "((?:[^"\\]|\\.)*)";/);
  if (match === null) throw new Error("khong thay khoi css trong bundle goc");
  return JSON.parse('"' + match[1] + '"') as string;
}

/**
 * Lấy bảng tên lớp của bản gốc từ bundle.
 * Nhận: không.
 * Trả: bảng class -> tên lớp.
 */
function stockClassMap(): Record<string, string> {
  const start = stockCode.indexOf("var TeamAction_module_css_default = {");
  const end = stockCode.indexOf("};", start) + 2;
  const map: Record<string, string> = {};
  for (const m of stockCode.slice(start, end).matchAll(/"([^"]+)":\s*"([^"]+)"/g)) map[m[1] as string] = m[2] as string;
  return map;
}

/**
 * Lấy danh sách service inject của bản gốc từ bundle.
 * Nhận: không.
 * Trả: mảng id theo đúng thứ tự.
 */
function stockInject(): string[] {
  const start = stockCode.indexOf("const inject = [");
  const end = stockCode.indexOf("];", start) + 2;
  return [...stockCode.slice(start, end).matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);
}

/** Element giả: chỉ ghi type/props/key để soi cây. */
interface Element {
  /** Loại element (component hoặc thẻ). */
  type: unknown;
  /** Props. */
  props: Record<string, unknown>;
  /** Khoá. */
  key?: unknown;
}

/**
 * Dựng runtime giả (react hooks + jsx/jsxs + portal + primitive) đủ để render một lượt có state.
 * Nhận: không.
 * Trả: runtime + hàng đợi effect + bộ đếm setState.
 */
function makeRuntime(log: string[]): { runtime: TeamComponentRuntime; flush: () => void; reset: () => void } {
  let states: unknown[] = [];
  let cursor = 0;
  const cleanups: (() => void)[] = [];
  const effects: (() => void | (() => void))[] = [];
  const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown): Element => ({ type, props: props ?? {}, ...(key === undefined ? {} : { key }) });
  const runtime = {
    react: {
      useState<S>(initial: S): [S, (next: S | ((current: S) => S)) => void] {
        const index = cursor++;
        if (states.length <= index) states.push(initial);
        return [states[index] as S, (next: S | ((current: S) => S)) => {
          const value = typeof next === "function" ? (next as (current: S) => S)(states[index] as S) : next;
          states[index] = value;
          log.push("setState:" + index + "=" + String(value));
        }];
      },
      useRef<T>(initial: T): { current: T } { return { current: initial }; },
      useEffect(effect: () => void | (() => void)): void { effects.push(effect); },
      useLayoutEffect(effect: () => void | (() => void)): void { effects.push(effect); },
    },
    jsx,
    jsxs: jsx,
    Fragment: Symbol.for("react.fragment"),
    createPortal: (children: unknown, container: unknown): Element => ({ type: "#portal", props: { children, container } }),
    primitives: {
      Tooltip: "Tooltip",
      IconUserOutlineRegular: "IconUser",
      IconUsersOutlineRegular: "IconUsers",
      IconChevronDownOutlineRegular: "IconChevron",
      StateDot: "StateDot",
      Tag: "Tag",
      useAnchoredPosition: () => null,
      useDismissOnOutsidePointer: () => undefined,
    },
  } as unknown as TeamComponentRuntime;
  return {
    runtime,
    /** Đặt lại con trỏ hook + chạy effect đang chờ (gọi TRƯỚC mỗi lượt render). */
    flush: (): void => {
      cursor = 0;
      for (const effect of effects.splice(0)) {
        const cleanup = effect();
        if (typeof cleanup === "function") cleanups.push(cleanup);
      }
    },
    /** Đặt lại con trỏ hook cho lượt render kế tiếp (state GIỮ NGUYÊN như React thật). */
    reset: (): void => {
      cursor = 0;
    },
  };
}

/**
 * Chuẩn hoá cây element để so hai bên: type hàm → tên hàm, symbol → tên mô tả, primitive/thẻ → chuỗi.
 * Nhận: giá trị bất kỳ (element, mảng, primitive).
 * Trả: cây JSON so được.
 */
function normalizeTree(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeTree(item));
  if (typeof value === "function") return { "#component": (value as { name: string }).name };
  if (typeof value === "symbol") return { "#symbol": String(value) };
  if (value !== null && typeof value === "object") {
    const element = value as Partial<Element>;
    if ("type" in element && "props" in element) {
      const type = element.type;
      const label = typeof type === "function" ? { "#component": (type as { name: string }).name } : type;
      return { type: normalizeTree(label), props: normalizeTree(element.props), ...(element.key === undefined ? {} : { key: normalizeTree(element.key) }) };
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (typeof item === "function") continue; // callback (onClick…) — so riêng bên dưới nếu cần
      out[key] = normalizeTree(item);
    }
    return out;
  }
  // 24/10/2026 — SAI LỆCH CÓ CHỦ Ý (ADR 0017): gói ta KHÔNG hiện " · Model: …" cạnh trạng thái thành viên.
  // Chuẩn hoá bỏ hậu tố đó ở CẢ HAI phía để phép so cây element vẫn bắt được mọi khác biệt khác.
  if (typeof value === "string") return value.replace(/ · Model: [^·]*/gu, "");
  return value;
}

/**
 * Lấy component TeamAction của bundle GỐC qua factory giả (stub window.__ModuleLoader__).
 * Nhận: runtime — runtime giả cấp cho component.
 * Trả: component TeamAction của bản gốc.
 */
function stockTeamAction(runtime: TeamComponentRuntime): (props: TeamActionProps) => unknown {
  const captured: { factory?: (require: (specifier: string) => unknown) => { apply(ctx: unknown): void } } = {};
  const globalWindow = globalThis as unknown as { window?: { __ModuleLoader__?: { load(entry: { id: string; factory: unknown }): void } } };
  const previousWindow = globalWindow.window;
  globalWindow.window = globalWindow.window ?? {};
  globalWindow.window.__ModuleLoader__ = { load: (entry) => { captured.factory = entry.factory as typeof captured.factory; } };
  try {
    const module = (0, eval)(stockCode) as unknown;
    void module;
  } finally {
    if (previousWindow === undefined) delete globalWindow.window;
    else globalWindow.window = previousWindow;
  }
  if (captured.factory === undefined) throw new Error("khong bat duoc factory cua bundle goc");
  const exports = captured.factory((specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    if (specifier === "react") return runtime.react;
    if (specifier === "react/jsx-runtime") return { jsx: runtime.jsx, jsxs: runtime.jsxs, Fragment: runtime.Fragment };
    if (specifier === "react-dom") return { createPortal: runtime.createPortal };
    if (specifier .endsWith("-client-ui-primitives")) return runtime.primitives;
    throw new Error("require khong ho tro: " + specifier);
  });
  const seen: { component?: (props: TeamActionProps) => unknown } = {};
  exports.apply({
    effect: (): void => undefined,
    locale: { register: () => () => undefined },
    sessions: { binding: () => undefined, retainInfo: () => ({ getSnapshot: () => ({ retainedBy: { mainView: 1 } }) }) },
    uiWorkspace: { openSession: () => undefined },
    slots: { inject: (_name: string, run: () => () => void) => { run(); }, register: (_occupant: unknown, component: unknown) => { seen.component = component as (props: TeamActionProps) => unknown; return () => undefined; } },
  });
  if (seen.component === undefined) throw new Error("bundle goc khong dang ky component");
  return seen.component;
}

describe("row agent-team — nửa host 1:1 + KHÔNG khai gbh.row", () => {
  test("apply rỗng đúng nghĩa (không bịa hành vi), không tham số, trả undefined", () => {
    expect(apply.length).toBe(0);
    expect(apply()).toBeUndefined();
  });

  test("artifact nửa host export ĐÚNG apply (như bản gốc)", () => {
    const text = readFileSync(artifact.host, "utf8");
    const names = [...text.matchAll(/export\s*\{([^}]*)\}/g)].flatMap((match) => ((match[1] ?? "").split(",").map((part) => part.trim().split(/\s+as\s+/).pop())));
    expect(names).toEqual(["apply"]);
  });

  test("KHAI gbh.row sau nghiệm thu (lab 22.204 ký tự · boot-smoke 6/6 ĐẠT): id/aliases/tests đúng", () => {
    // Nghiệm thu 19/10/2026: lab:row ui-agent-team → #root 22.204 = baseline · 0 console · 0 pageerror ·
    // 0 did-not-activate · artifact MỘT id; boot-smoke 6/6 ĐẠT ⇒ mới khai row (không mount sớm).
    const json = JSON.parse(readFileSync(join(BASE, "package.json"), "utf8")) as {
      gbh?: { row?: { id?: string; moduleIds?: string[]; aliases?: string[]; tests?: string[] }; row_unmounted_ly_do?: string };
    };
    expect(json.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(json.gbh?.row?.id).toBe("ui-agent-team");
    expect(json.gbh?.row?.moduleIds).toEqual([PACKAGE_NAME]);
    expect(json.gbh?.row?.aliases).toEqual([STOCK_PACKAGE_NAME]);
    expect(json.gbh?.row?.tests).toEqual(["tests/client/ui-agent-team.test.ts"]);
  });

  test("nửa client: inject 4 service đúng thứ tự + slot/id/order nguyên văn bản gốc", () => {
    expect(INJECT).toEqual(["sessions", "uiWorkspace", "slots", "locale"]);
    expect(INJECT).toEqual(stockInject());
    expect(SLOT_CONVERSATION_HEADER_ACTIONS).toBe("conversation.session.header.actions");
    expect(TEAM_ACTION_ID).toBe("agent-team");
    // 24/10/2026 — ĐỔI có chủ ý: -20 → 9 để "Nhóm agent" nằm CẠNH danh mục subagent (order 10). ADR 0014.
    expect(TEAM_ACTION_ORDER).toBe(9);
    // mount.ts dùng LITERAL (cổng check:rows đọc tên slot từ literal trong lời gọi) ⇒ khẳng định không lệch.
    const mountSource = readFileSync(join(BASE, "src", "mount.ts"), "utf8");
    expect(mountSource).toContain('"conversation.session.header.actions"');
    expect(mountSource).toContain('id: "agent-team"');
    expect(mountSource).toContain("order: 9");
  });

  test("từ điển: zh và en CÙNG tập khoá (27), giá trị không rỗng, NS nguyên văn", () => {
    expect(NS).toBe("agent-team");
    const zhKeys = Object.keys(zh).sort();
    const enKeys = Object.keys(en).sort();
    // 23/10/2026 — 25 khoá gốc + 2 khoá của hàng toolview `set_team_limits` (ADR 0013).
    expect(zhKeys.length).toBe(27);
    expect(enKeys).toEqual(zhKeys);
    for (const key of zhKeys) {
      expect((zh as Record<string, string>)[key]?.length ?? 0).toBeGreaterThan(0);
      expect((en as Record<string, string>)[key]?.length ?? 0).toBeGreaterThan(0);
    }
    expect(zh["trigger"]).toBe("智能体团队");
    expect(en["trigger"]).toBe("Agent Team");
  });

  test("hằng định danh khớp nguồn đối chiếu", () => {
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-client-ui-agent-team");
    expect(STOCK_PACKAGE_NAME).toBe("@deepseek-ai/dsh-experimental-client-ui-agent-team");
    expect(STYLE_TAG).toBe(PACKAGE_NAME + "/TeamAction.module.css");
  });
});

describe("nửa browser — CSS + bảng lớp CHÉP NGUYÊN VĂN", () => {
  test("CSS của ta BẰNG chuỗi css của bundle gốc sau khi bỏ mọi khoảng trắng", () => {
    const ours = readFileSync(join(BASE, "src", "TeamAction.module.css"), "utf8");
    expect(normalizeCss(ours)).toBe(normalizeCss(stockCss()));
    expect(stockCss().length).toBe(4666);
    expect((stockCss().match(/\}/g) ?? []).length).toBe(43);
  });

  test("bảng 30 lớp BẰNG TỪNG CẶP khoá→tên lớp của bản gốc (hash VoX2oq_)", () => {
    const stock = stockClassMap();
    expect(Object.keys(stock).length).toBe(30);
    expect(TEAM_ACTION_CLASS as Record<string, string>).toEqual(stock);
  });
});

describe("nửa browser — artifact MỘT id + CSS nhúng", () => {
  test("client.js đăng ký ĐÚNG MỘT id (của ta), KHÔNG đăng ký id gói gốc", () => {
    const code = readFileSync(artifact.client, "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(code.includes('" id: ' + JSON.stringify(STOCK_PACKAGE_NAME))).toBe(false);
    expect(code).toContain("TeamAction.module.css");
    expect(code).toContain("VoX2oq_root");
    expect(code).toContain("createPlugin(require)");
  });
});

describe("nửa browser — mount: locale + occupant slot + openTeammate", () => {
  /** Dựng ctx giả bắt mọi lời gọi. */
  function makeCtx(options: { retainedMainView?: number; bindingParent?: string } = {}): {
    ctx: AgentTeamClientCtx;
    effects: { label: string }[];
    dictionaries: { ns: string; keys: number }[];
    /** Tên slot đã được `slots.inject` (thứ tự gọi). */
    injected: string[];
    occupants: { name: string; id: string; order: number; locale: string; inject: () => unknown }[];
    /** Occident KEYED (slot con theo khoá) — bổ sung của ta cho `set_team_limits`. */
    keyed: { name: string; key: string; locale: string }[];
    opened: unknown[];
  } {
    const effects: { label: string }[] = [];
    const dictionaries: { ns: string; keys: number }[] = [];
    const injected: string[] = [];
    const occupants: { name: string; id: string; order: number; locale: string; inject: () => unknown }[] = [];
    const keyed: { name: string; key: string; locale: string }[] = [];
    const opened: unknown[] = [];
    const ctx: AgentTeamClientCtx = {
      effect: (run, label) => { effects.push({ label }); run(); },
      locale: { register: (namespace, dicts) => { dictionaries.push({ ns: namespace, keys: Object.keys(dicts.en as object).length }); return () => undefined; } },
      sessions: {
        binding: (id) => (options.bindingParent === undefined ? undefined : { session: { getSnapshot: () => ({ subagent: { address: { parentSessionId: options.bindingParent } } }) } }),
        retainInfo: () => ({ getSnapshot: () => ({ retainedBy: { mainView: options.retainedMainView ?? 1 } }) }),
      },
      uiWorkspace: { openSession: (target) => { opened.push(target); } },
      slots: {
        inject: (name, run) => { injected.push(name); run(); },
        register: (occupant, component) => {
          expect(component).toBeDefined();
          const entry = occupant as { name: string; id?: string; order?: number; key?: string; locale: string; inject?: () => unknown };
          if (entry.key !== undefined) keyed.push({ name: entry.name, key: entry.key, locale: entry.locale });
          else occupants.push(entry as never);
          return () => undefined;
        },
      },
    };
    return { ctx, effects, dictionaries, injected, occupants, keyed, opened };
  }

  test("đăng ký 1 hiệu ứng từ điển (nhãn gốc) + 1 occupant đúng tên/id/order/locale", () => {
    const harness = makeCtx();
    registerAgentTeamUi(harness.ctx, "COMPONENT", "LIMITS_ROW");
    expect(harness.effects.map((item) => item.label)).toEqual(["client-ui-agent-team: dictionaries"]);
    // 23/10/2026 — slot BỔ SUNG `tool.call.toolview` được tiêm qua `slots.inject`, cùng cơ chế header.
    expect([...new Set(harness.injected)].sort()).toEqual(["conversation.session.header.actions", "tool.call.toolview"]);
    expect(harness.dictionaries).toEqual([{ ns: "agent-team", keys: 27 }]);
    expect(harness.occupants.length).toBe(1);
    const occupant = harness.occupants[0] as { name: string; id: string; order: number; locale: string };
    expect(occupant.name).toBe(SLOT_CONVERSATION_HEADER_ACTIONS);
    expect(occupant.id).toBe("agent-team");
    expect(occupant.order).toBe(9);
    expect(occupant.locale).toBe("agent-team");
    // Hàng keyed của tool BỔ SUNG: ĐÚNG slot + khoá + nguồn từ điển, và KHÔNG chiếm occupant thường.
    expect(harness.keyed.length).toBe(1);
    const keyed = harness.keyed[0] as { name: string; key: string; locale: string };
    expect(keyed.name).toBe("tool.call.toolview");
    expect(keyed.key).toBe("set_team_limits");
    expect(keyed.locale).toBe("agent-team");
  });

  test("openTeammate: chưa giữ ở mainView ⇒ KHÔNG mở; thành viên là lead ⇒ mở id thẳng; còn lại ⇒ continuable", () => {
    const notRetained = makeCtx({ retainedMainView: 0, bindingParent: "lead-1" });
    registerAgentTeamUi(notRetained.ctx, "C");
    (notRetained.occupants[0]?.inject() as { openTeammate(a: string, b: string): void }).openTeammate("child-1", "lead-1");
    expect(notRetained.opened).toEqual([]);

    const retained = makeCtx({ retainedMainView: 2, bindingParent: "lead-1" });
    registerAgentTeamUi(retained.ctx, "C");
    const actions = retained.occupants[0]?.inject() as { openTeammate(a: string, b: string): void };
    actions.openTeammate("child-1", "lead-1");
    expect(retained.opened).toEqual(["lead-1"]);
    actions.openTeammate("child-1", "child-2");
    expect(retained.opened).toEqual(["lead-1", { parentSessionId: "lead-1", childSessionId: "child-2", mode: "continuable" }]);
  });

  test("phiên KHÔNG có binding ⇒ lead = chính nó", () => {
    const harness = makeCtx({ retainedMainView: 1 });
    registerAgentTeamUi(harness.ctx, "C");
    (harness.occupants[0]?.inject() as { openTeammate(a: string, b: string): void }).openTeammate("solo", "solo");
    expect(harness.opened).toEqual(["solo"]);
  });
});

describe("nửa browser — CÂY ELEMENT của ta BẰNG cây của component GỐC", () => {
  /**
   * Render một lượt với con trỏ hook đã đặt lại (state giữ nguyên như React thật).
   * Nhận: harness — runtime giả; render — hàm render component; props — props.
   * Trả: cây element.
   */
  function renderOnce(harness: { reset: () => void; flush: () => void }, render: (props: never) => unknown, props: TeamActionProps): unknown {
    harness.reset();
    const tree = render(props as never);
    harness.flush();
    return tree;
  }
  /** Bộ props giả dùng chung cho cả hai bên. */
  function propsFor(store: unknown, snapshot: unknown): TeamActionProps {
    return {
      sessionId: "sess-current",
      useSession: (selector: (state: unknown) => unknown) => selector(snapshot),
      useSessions: (selector: (state: unknown) => unknown) => selector(store),
      useSessionStatus: (selector: (state: unknown) => unknown) => selector(store),
      openTeammate: () => undefined,
      t: (key: string, vars?: Readonly<Record<string, string>>) => (vars === undefined ? "T(" + key + ")" : "T(" + key + ":" + String(vars["message"]) + ")"),
    } as unknown as TeamActionProps;
  }

  /** Dựng hai bên trên runtime giả RIÊNG và trả ba hàm render. */
  function bothSides(): { renderOurs: (props: TeamActionProps) => unknown; renderStock: (props: TeamActionProps) => unknown } {
    const ours = makeRuntime([]);
    const stockRuntime = makeRuntime([]);
    const oursComponent = createTeamAction(ours.runtime).TeamAction as unknown as (props: never) => unknown;
    const stockComponent = stockTeamAction(stockRuntime.runtime) as unknown as (props: never) => unknown;
    return {
      // Trả cây THÔ (còn callback để bấm được); chuẩn hoá ở chỗ so sánh.
      renderOurs: (props) => renderOnce(ours, oursComponent, props),
      renderStock: (props) => renderOnce(stockRuntime, stockComponent, props),
    };
  }

  test("cây khi CHƯA có projection (nhãn + notice) và khi ĐANG TẢI BẰNG bản gốc", () => {
    const store = { byId: {}, projectionsBySession: {}, phase: "ready", get: () => undefined };
    const snapshot = { openState: "open" };
    const sides = bothSides();
    expect(normalizeTree(sides.renderOurs(propsFor(store, snapshot)))).toEqual(normalizeTree(sides.renderStock(propsFor(store, snapshot))));
    const loadingStore = { ...store, phase: "pending" };
    expect(normalizeTree(sides.renderOurs(propsFor(loadingStore, snapshot)))).toEqual(normalizeTree(sides.renderStock(propsFor(loadingStore, snapshot))));
  });

  test("cây khi CÓ team (2 thành viên + 2 việc + failure) BẰNG bản gốc — kể cả sau khi bấm mở bảng", () => {
    const team = {
      failure: "hỏng nhẹ",
      members: [
        { id: "sess-current", name: "Lead", phase: "active" },
        { id: "m-2", name: "Worker", phase: "active", error: "lỗi riêng" },
      ],
      tasks: [
        { id: "task-1", subject: "Việc A", description: "mô tả A", status: "pending", ready: false, ownerName: "Lead", blockedBy: ["task-0"], writeScopes: ["a/**"], writeScopeWarnings: ["cảnh báo"] },
        { id: "task-2", subject: "Việc B", description: "mô tả B", status: "in_progress", ready: true, blockedBy: [], writeScopes: [], writeScopeWarnings: [] },
      ],
    };
    const byId = { "sess-current": { running: true }, "m-2": { running: false } };
    const store = { byId, projectionsBySession: { "sess-current": { values: { agentTeam: team, modelSelection: { next: { model: "m" } } } } }, phase: "ready", get: (id: string) => byId[id as keyof typeof byId] };
    const snapshot = { openState: "open" };
    const sides = bothSides();
    const oursClosed = sides.renderOurs(propsFor(store, snapshot));
    const stockClosed = sides.renderStock(propsFor(store, snapshot));
    expect(normalizeTree(oursClosed)).toEqual(normalizeTree(stockClosed));
    // Bấm trigger để MỞ bảng — cả hai bên cùng bấm rồi so cây mở.
    /** Gọi onClick của trigger trong cây element. */
    function clickTrigger(tree: unknown): void {
      const element = tree as { props: { children: { props: { onClick?: () => void } }[] } };
      const onClick = element.props.children[0]?.props.onClick;
      if (onClick === undefined) throw new Error("khong thay onClick cua trigger");
      onClick();
    }
    clickTrigger(sides.renderOurs(propsFor(store, snapshot)));
    clickTrigger(sides.renderStock(propsFor(store, snapshot)));
    const oursOpen = normalizeTree(sides.renderOurs(propsFor(store, snapshot)));
    const stockOpen = normalizeTree(sides.renderStock(propsFor(store, snapshot)));
    expect(oursOpen).toEqual(stockOpen);
    const json = JSON.stringify(oursOpen);
    expect(json).toContain("#portal");
    expect(json).toContain("data-team-panel");
    expect(json).toContain("Việc A");
    expect(json).toContain("hỏng nhẹ");
  });

  test("bảng COMPACT khi team 1 thành viên + 0 việc (đúng điều kiện bản gốc)", () => {
    const team = { members: [{ id: "sess-current", name: "Lead", phase: "active" }], tasks: [] };
    const store = { byId: {}, projectionsBySession: { "sess-current": { values: { agentTeam: team } } }, phase: "ready", get: () => undefined };
    const snapshot = { openState: "open" };
    const sides = bothSides();
    const oursClosed = sides.renderOurs(propsFor(store, snapshot));
    const stockClosed = sides.renderStock(propsFor(store, snapshot));
    expect(normalizeTree(oursClosed)).toEqual(normalizeTree(stockClosed));
    /** Gọi onClick của trigger trong cây element. */
    function clickTrigger(tree: unknown): void {
      const element = tree as { props: { children: { props: { onClick?: () => void } }[] } };
      const onClick = element.props.children[0]?.props.onClick;
      if (onClick === undefined) throw new Error("khong thay onClick cua trigger");
      onClick();
    }
    clickTrigger(sides.renderOurs(propsFor(store, snapshot)));
    clickTrigger(sides.renderStock(propsFor(store, snapshot)));
    const oursOpen = normalizeTree(sides.renderOurs(propsFor(store, snapshot)));
    const stockOpen = normalizeTree(sides.renderStock(propsFor(store, snapshot)));
    expect(oursOpen).toEqual(stockOpen);
    expect(JSON.stringify(oursOpen)).toContain("VoX2oq_panelCompact");
  });
});

describe("hàng toolview set_team_limits (ADR 0013 — tool BỔ SUNG của ta)", () => {
  test("readTeamLimits: đọc từ VĂN BẢN KẾT QUẢ đã ghi nhận (content text JSON)", () => {
    const block = { kind: "tool-result", content: [{ type: "text", text: JSON.stringify({ maxMembers: 16, maxTasks: 256 }) }] };
    expect(readTeamLimits(block)).toEqual({ maxMembers: 16, maxTasks: 256 });
  });

  test("readTeamLimits: đọc từ tham số đang chạy (args / argsRaw), bỏ qua snake_case của bề mặt model", () => {
    expect(readTeamLimits({ phase: "start", args: { max_members: 12 } })).toEqual({});
    expect(readTeamLimits({ phase: "start", argsRaw: JSON.stringify({ maxMembers: 12 }) })).toEqual({ maxMembers: 12 });
  });

  test("readTeamLimits: khối rỗng/hỏng ⇒ không trường nào và KHÔNG ném", () => {
    expect(readTeamLimits(undefined)).toEqual({});
    expect(readTeamLimits({ kind: "tool-result", content: [{ type: "text", text: "not json" }] })).toEqual({});
  });

  test("component: vẽ tiêu đề + tóm tắt qua hàm dịch của namespace agent-team", () => {
    const called: string[] = [];
    const t = (key: string, vars?: Readonly<Record<string, string>>): string => {
      called.push(key);
      if (key === "limits.title") return "Set team limits";
      return String(vars?.members) + " members · " + String(vars?.tasks) + " tasks";
    };
    const runtime = {
      react: {},
      jsx: (type: unknown, props: Record<string, unknown> | null) => ({ type, props }),
      jsxs: (type: unknown, props: Record<string, unknown> | null) => ({ type, props }),
      Fragment: "Fragment",
      createPortal: () => null,
      primitives: { IconUsersOutlineRegular: "IconUsers" },
    };
    const Row = createSetTeamLimitsRow(runtime as unknown as TeamComponentRuntime);
    const tree = Row({
      toolName: "set_team_limits",
      block: { kind: "tool-result", content: [{ type: "text", text: JSON.stringify({ maxMembers: 16, maxTasks: 256 }) }] },
      t: t as never,
    });
    const text = JSON.stringify(tree);
    expect(text).toContain("Set team limits");
    expect(text).toContain("16 members · 256 tasks");
    expect(called).toEqual(["limits.title", "limits.summary"]);
  });
});
