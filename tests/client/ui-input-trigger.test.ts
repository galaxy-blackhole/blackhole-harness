/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B cho gói HAI NỬA ui-input-trigger: nửa host, BỘ BA manifest, CANON quy id CHỈ Ở DÒNG LOADER
 *   (id gói ở mọi chỗ khác là DỮ LIỆU, giữ id stock), mặt plugin, và nửa client đối chứng TRỰC TIẾP với
 *   bundle GỐC (menu/controller/CSS/từ điển/MenuView)
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { brandEqual, normalizeBrand, normalizeIdsInText, sameAfterIdMap } from "../lib/brand-parity.ts";
import { buildPackage } from "../../packages/client/ui-input-trigger/build.ts";
import { MENU_CSS, MENU_STYLES } from "../../packages/client/ui-input-trigger/src/menu-css.ts";
import { en as ourEn, zh as ourZh } from "../../packages/client/ui-input-trigger/src/locales.ts";
import { STOCK_PACKAGE_NAME } from "../../packages/client/ui-input-trigger/src/ids-stock.ts";
import type { SnapshotStore } from "../../packages/client/ui-input-trigger/src/types.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const PKG = join(REPO, "packages", "client", "ui-input-trigger");
/** Thư mục gói GỐC (chỉ đọc — nguồn đối chứng). */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-input-trigger");
/** Artifact client GỐC. */
const STOCK_CLIENT = join(STOCK_DIR, "lib", "client.js");
/** Manifest GỐC. */
const STOCK_MANIFEST = join(STOCK_DIR, "package.json");
/** Id package của ta (literal, để test không phụ thuộc src). */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-input-trigger";
// Id package GỐC nhập từ src/ids-stock.ts — hằng đó CHỈ dùng cho test/host, không nhánh client nào import.

/** Đăng ký module mà bundle client đẩy vào bảng module của trang. */
interface Registration {
  /** Id module bundle TỰ KHAI. */
  id: string;
  /** Factory nhận require của bảng module. */
  factory: (require: (specifier: string) => unknown) => unknown;
}

/** Bề mặt plugin mà Loader dùng (khớp bốn export của bản gốc). */
interface PluginShape {
  /** Thân plugin. */
  apply(ctx: unknown): void;
  /** Service bắt buộc. */
  inject: string[];
  /** Lớp controller theo phiên. */
  InputTriggerController: new (deps: unknown) => ControllerShape;
  /** Lớp service gốc. */
  InputTriggerService: new (ctx: unknown) => ServiceShape;
}

/** Bề mặt controller mà test chạm tới. */
interface ControllerShape {
  /** Kho trạng thái menu. */
  menu: SnapshotStore<unknown>;
  /** Kho breadcrumb. */
  headers: SnapshotStore<unknown>;
  /** Kho lexicon. */
  lexicon: SnapshotStore<unknown>;
  /** Nạp thay đổi bản nháp. */
  track(draft: string, caret: number, guard: unknown, draftRev: number): void;
  /** Phân xử phím. */
  arbitrate(key: string, composing: boolean): unknown;
  /** Phân xử dấu cách. */
  onSpace(): boolean;
  /** Mở xem trước tham chiếu. */
  openReference(source: string | undefined, reference: { ref: string; appearance?: string }): boolean;
  /** Tuần tự hoá tham chiếu. */
  serializeReference(source: string, ref: string, signal: AbortSignal): Promise<string>;
  /** Giải mã claim. */
  resolveClaim(token: string, signal: AbortSignal): Promise<unknown>;
  /** Phân xử Enter. */
  adjudicate(line: string, signal: AbortSignal, envelope: { attachments: number }): Promise<unknown>;
  /** Đóng menu. */
  dismiss(): void;
  /** Dọn controller. */
  dispose(): void;
}

/** Bề mặt service mà test chạm tới. */
interface ServiceShape {
  /** Đăng ký nguồn. */
  registerSource(source: unknown): () => void;
  /** Lấy controller theo scope phiên. */
  sessionOf(actx: unknown): ControllerShape;
}

/** Bản ghi một lượt apply (để A/B cấu trúc nối dây với bản gốc). */
interface ApplyRecord {
  /** Lớp plugin đã cài qua ctx.plugin. */
  plugins: unknown[];
  /** Hiệu ứng vòng đời. */
  effects: { label: string; callback: () => unknown }[];
  /** Từ điển đã đăng ký. */
  dictionaries: { namespace: string; copy: Record<string, unknown> }[];
  /** Các lời gọi ctx.inject. */
  injections: { names: readonly string[]; callback: (scope: unknown) => void }[];
  /** Các lời gọi slots.inject. */
  slotInjects: string[];
  /** Các lời gọi slots.register. */
  registrations: { definition: Record<string, unknown>; component: unknown }[];
  /** Sự kiện ctx.on đã nghe. */
  events: string[];
}

/**
 * Kho ảnh chụp tối thiểu — ĐÚNG hình dạng createSnapshotStore của dsh-client-store.
 * Nhận: initial — giá trị đầu.
 * Trả: { getSnapshot, set, subscribe }.
 */
function createSnapshotStore<T>(initial: T): SnapshotStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    set(next: T) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Lớp Service giả của cordis — chỉ đủ để lớp dịch vụ kế thừa và giữ ctx. */
class FakeService {
  /** Context sở hữu. */
  readonly ctx: unknown;
  /** Tên service. */
  readonly serviceName: string;

  /**
   * @param ctx - context sở hữu.
   * @param name - tên service.
   */
  constructor(ctx: unknown, name: string) {
    this.ctx = ctx;
    this.serviceName = name;
  }
}

/** Node element giả do jsx runtime dựng (chỉ ghi type/props/key để so cây). */
interface ElementNode {
  /** Loại element. */
  type: unknown;
  /** Props. */
  props: Record<string, unknown>;
  /** Khoá. */
  key?: unknown;
}

/**
 * Dựng một element giả.
 * Nhận: type — loại; props — props; key — khoá.
 * Trả: node đã ghi.
 */
function jsx(type: unknown, props: Record<string, unknown>, key?: unknown): ElementNode {
  return { type, props, key };
}

/** React giả: KHÔNG chạy hiệu ứng (test chỉ so cây), hook trả giá trị đầu. */
const fakeReact = {
  useSyncExternalStore: (subscribe: (onChange: () => void) => () => void, getSnapshot: () => unknown): unknown => getSnapshot(),
  useRef: <T,>(initial: T): { current: T } => ({ current: initial }),
  useState: <T,>(initial: T): [T, (next: T) => void] => [initial, () => undefined],
  useCallback: <T,>(callback: T): T => callback,
  useLayoutEffect: (): void => undefined,
  useEffect: (): void => undefined,
  Fragment: "Fragment",
};

/** ui-primitives giả: đánh dấu component + trần chiều cao cố định để so cây. */
const fakePrimitives = {
  MenuSurface: "MenuSurface",
  IconChevronRightOutlineRegular: "IconChevronRightOutlineRegular",
  ReferenceIconRegular: "ReferenceIconRegular",
  useAnchoredMaxHeight: (): number => 321,
};

/**
 * Bảng module giả — ĐÚNG năm specifier mà bundle gốc require, không thừa.
 * Nhận: specifier — tên module.
 * Trả: module giả tương ứng.
 */
function fakeRequire(specifier: string): unknown {
  if (specifier === "@deepseek-ai/cordis") return { Service: FakeService };
  if (specifier .endsWith("-client-store")) return { createSnapshotStore };
  if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
  if (specifier === "react") return fakeReact;
  if (specifier .endsWith("-client-ui-primitives")) return fakePrimitives;
  throw new Error("require ngoài hợp đồng: " + specifier);
}

/**
 * Nạp một bundle client bằng thẻ script giả rồi gọi factory.
 * Nhận: code — văn bản bundle.
 * Trả: { registrations, required, plugin }.
 */
function loadBundle(code: string): { registrations: Registration[]; required: string[]; plugin: PluginShape } {
  const registrations: Registration[] = [];
  const windowLike = { __ModuleLoader__: { load: (registration: Registration) => registrations.push(registration) } };
  new Function("window", code)(windowLike);
  const first = registrations[0];
  if (first === undefined) throw new Error("bundle không đăng ký module nào");
  const required: string[] = [];
  const plugin = first.factory((specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    required.push(specifier);
    return fakeRequire(specifier);
  }) as PluginShape;
  return { registrations, required, plugin };
}

/**
 * Chỉ số dòng `window.__ModuleLoader__.load({` — mốc của phần THÂN bundle (bỏ header sinh tự động).
 * @param code - văn bản bundle (của ta hoặc bản gốc).
 * @returns chỉ số dòng loader (0-based).
 * @throws khi bundle không có đúng khung loader.
 */
function loaderLineIndex(code: string): number {
  const at = code.split("\n").findIndex((line) => line.trim() === "window.__ModuleLoader__.load({");
  if (at < 0) throw new Error("bundle khong co khung loader");
  return at;
}

/**
 * Đếm số lần một chuỗi xuất hiện trong văn bản (không chồng lấn).
 * @param text - văn bản cần đếm.
 * @param needle - chuỗi cần đếm.
 * @returns số lần xuất hiện.
 */
function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Mọi dòng mang id stock của một bundle, BỎ dòng id của loader.
 *
 * CANON 20/10/2026: quy id CHỈ Ở DÒNG LOADER; mọi lần xuất hiện khác của id gói là DỮ LIỆU
 * (tagId CSS module · dataset.plugin · nhãn · khoá) nên GIỮ NGUYÊN id stock như bản gốc.
 * @param code - văn bản bundle.
 * @param stockName - id gói gốc.
 * @returns các dòng dữ liệu mang id stock, đã chuẩn hoá brand, đúng thứ tự.
 */
function stockDataLines(code: string, stockName: string): string[] {
  const idAt = loaderLineIndex(code) + 1;
  return code
    .split("\n")
    .filter((line, index) => index !== idAt && line.includes(stockName))
    .map((line) => normalizeBrand(line));
}

/**
 * Chạy một hàm và trả thông điệp lỗi (hoặc "no-error").
 * Nhận: run — hàm cần chạy.
 * Trả: chuỗi thông điệp.
 */
function messageOf(run: () => unknown): string {
  try {
    run();
    return "no-error";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Kết quả một lượt chạy pipeline A/B (mọi trường đều JSON-able). */
interface PipelineRun {
  /** Lời gọi vào nguồn (thứ tự). */
  calls: unknown[];
  /** Ảnh chụp menu sau mỗi bước. */
  states: unknown[];
  /** Ảnh chụp lexicon sau mỗi bước. */
  lexicon: unknown[];
  /** Ảnh chụp breadcrumb sau mỗi bước. */
  headers: unknown[];
  /** Kết quả các lời gọi phân xử. */
  outcomes: unknown[];
  /** Sự kiện bail đã gửi (tên + payload). */
  bails: unknown[];
  /** Thông điệp lỗi/giá trị tuần tự hoá. */
  errors: unknown[];
}

/**
 * Chạy CÙNG một kịch bản trên một plugin (của ta hoặc gốc) và ghi lại mọi thứ quan sát được.
 * Nhận: plugin — mặt plugin đã nạp từ bundle.
 * Trả: bản ghi PipelineRun.
 */
async function runPipeline(plugin: PluginShape): Promise<PipelineRun> {
  const calls: unknown[] = [];
  const states: unknown[] = [];
  const lexicon: unknown[] = [];
  const headers: unknown[] = [];
  const outcomes: unknown[] = [];
  const bails: unknown[] = [];
  const errors: unknown[] = [];
  const source = {
    trigger: "/",
    name: "command",
    order: 0,
    candidates: async (_session: unknown, req: { query: string; position: string; drilled: boolean }) => {
      calls.push(["candidates", req.query, req.position, req.drilled]);
      return [
        { name: "goal", label: "Goal", description: "đặt mục tiêu" },
        { name: "plan", label: "Plan", drill: true },
      ];
    },
    header: (_session: unknown, req: { query: string }) => {
      calls.push(["header", req.query]);
      return [
        { label: "root", value: "/" },
        { label: req.query === "" ? "trống" : req.query, value: "v", current: true },
      ];
    },
    matchSpace: (_session: unknown, token: string) => {
      calls.push(["matchSpace", token]);
      return { text: "space:" + token, continue: true };
    },
    matchEnter: async (_session: unknown, line: string) => {
      calls.push(["matchEnter", line]);
      return line.startsWith("/goal") ? { text: "enter:" + line } : undefined;
    },
    matchClaim: async (_session: unknown, token: string) => {
      calls.push(["matchClaim", token]);
      return { command: token };
    },
    openReference: () => true,
    lexicon: () => ["goal", "plan"],
    warm: () => {
      calls.push(["warm"]);
    },
    onPick: (pick: { candidate: { name: string }; action: string }) => {
      calls.push(["onPick", pick.candidate.name, pick.action]);
      return { claim: { kind: "action", target: pick.candidate.name } };
    },
    codec: {
      clipboardText: (ref: string) => "/" + ref,
      serialize: (ref: string) => Promise.resolve("<" + ref + ">"),
    },
  };
  const roster = {
    sources: (trigger: string) => (trigger === "/" ? [source] : []),
    all: () => [source],
  };
  const actx = {
    effect: () => () => undefined,
    bail: (_subject: unknown, event: string, payload: Record<string, unknown>) => {
      bails.push([event, payload]);
      return true;
    },
  };
  const controller = new plugin.InputTriggerController({ actx, sessionId: "s1", roster });
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
  const snap = (): void => {
    states.push(JSON.parse(JSON.stringify(controller.menu.getSnapshot())));
    lexicon.push(JSON.parse(JSON.stringify(Object.fromEntries(controller.lexicon.getSnapshot() as Map<string, unknown>))));
    headers.push(JSON.parse(JSON.stringify(Object.fromEntries(controller.headers.getSnapshot() as Map<string, unknown>))));
  };
  snap();
  controller.track("/", 1, { tier: "plain" }, 7);
  snap();
  await settle();
  snap();
  outcomes.push(controller.arbitrate("down", false));
  snap();
  outcomes.push(controller.arbitrate("enter", false));
  snap();
  controller.track("/", 1, { tier: "plain" }, 7);
  snap();
  controller.track("/go", 3, { tier: "plain" }, 8);
  await settle();
  snap();
  outcomes.push(controller.onSpace());
  snap();
  controller.dismiss();
  snap();
  controller.track("/goal", 5, { tier: "plain" }, 9);
  outcomes.push(controller.onSpace());
  snap();
  outcomes.push(controller.openReference(undefined, { ref: "/goal" }));
  snap();
  const aborted = new AbortController();
  errors.push(await controller.serializeReference("missing", "/x", aborted.signal).then(() => "no-error", (error: Error) => error.message));
  errors.push(await controller.serializeReference("command", "goal", aborted.signal));
  outcomes.push((await controller.resolveClaim("/goal", aborted.signal)) ?? null);
  outcomes.push((await controller.adjudicate("/goal x", aborted.signal, { attachments: 0 })) ?? null);
  snap();
  controller.dispose();
  snap();
  return { calls, states, lexicon, headers, outcomes, bails, errors };
}

/** Bản ghi apply + mặt slot thu được. */
interface ApplyRun {
  /** Bản ghi nối dây. */
  record: ApplyRecord;
  /** Mặt nghiệp vụ mà occupant trả về cho phiên "s1". */
  face: Record<string, unknown> | undefined;
  /** Thông điệp khi scope không tồn tại. */
  missingScope: string;
  /** Lớp service đã cài. */
  ServiceClass: { inject?: unknown };
}

/**
 * Chạy apply của một plugin trên context giả rồi mở slot overlay để lấy occupant + mặt nghiệp vụ.
 * Nhận: plugin — mặt plugin đã nạp từ bundle.
 * Trả: ApplyRun.
 */
function runApply(plugin: PluginShape): ApplyRun {
  const record: ApplyRecord = {
    plugins: [],
    effects: [],
    dictionaries: [],
    injections: [],
    slotInjects: [],
    registrations: [],
    events: [],
  };
  const ctx = {
    plugin: (target: unknown) => {
      record.plugins.push(target);
    },
    effect: (callback: () => unknown, label: string) => {
      record.effects.push({ label, callback });
      return callback();
    },
    on: (event: string) => {
      record.events.push(event);
      return () => undefined;
    },
    locale: {
      register: (namespace: string, copy: Record<string, unknown>) => {
        record.dictionaries.push({ namespace, copy });
        return () => undefined;
      },
    },
    inject: (names: readonly string[], callback: (scope: unknown) => void) => {
      record.injections.push({ names, callback });
    },
    get: () => undefined,
  };
  plugin.apply(ctx);
  const ServiceClass = record.plugins[0] as new (ctx: unknown) => ServiceShape;
  const session = { sessionId: "s1" };
  const actx = { effect: () => () => undefined, bail: () => true };
  const binding = { sessionId: "s1", session, ctx: actx };
  const sessions = {
    sessionOf: (candidate: unknown) => (candidate === actx ? session : undefined),
    binding: (id: string) => (id === "s1" ? binding : undefined),
    scope: (id: string) => (id === "s1" ? actx : undefined),
  };
  const rootCtx = {
    on: () => () => undefined,
    get: (name: string) => (name === "sessions" ? sessions : undefined),
  };
  const service = new ServiceClass(rootCtx);
  const slots = {
    inject: (slot: string, register: () => unknown) => {
      record.slotInjects.push(slot);
      return register();
    },
    register: (definition: Record<string, unknown>, component: unknown) => {
      record.registrations.push({ definition, component });
      return () => undefined;
    },
  };
  record.injections[0]?.callback({ slots, inputTriggers: service, sessions });
  const registration = record.registrations[0];
  const injectFace = registration?.definition.inject as ((id: string) => Record<string, unknown>) | undefined;
  const face = injectFace?.("s1");
  const missingScope = messageOf(() => injectFace?.("nope"));
  return { record, face, missingScope, ServiceClass: ServiceClass as unknown as { inject?: unknown } };
}

/**
 * Vẽ MenuView đã đăng ký vào slot với một trạng thái mở cố định.
 * Nhận: component — component occupant; state — trạng thái menu; crumbs — breadcrumb theo nguồn.
 * Trả: cây element (hoặc null).
 */
function renderMenu(component: unknown, state: unknown, crumbs: Map<string, unknown[]>): unknown {
  const menu = createSnapshotStore(state);
  const headerStore = createSnapshotStore(crumbs);
  const props = {
    menu,
    headers: headerStore,
    onPick: () => undefined,
    onCrumb: () => undefined,
    onHover: () => undefined,
    onDismiss: () => undefined,
    t: (key: string) => "t:" + key,
  };
  return (component as (input: unknown) => unknown)(props);
}

/** Trích chuỗi CSS mà bundle GỐC nhúng. */
function stockCss(): string {
  const source = readFileSync(STOCK_CLIENT, "utf8");
  const line = source.split("\n").find((entry) => entry.trimStart().startsWith("const css = "));
  if (line === undefined) throw new Error("bundle gốc không có chuỗi CSS");
  const literal = line.slice(line.indexOf("const css = ") + "const css = ".length).replace(/;\s*$/, "");
  return JSON.parse(literal) as string;
}

/**
 * Trích một bảng literal (từ điển hoặc bảng lớp) mà bundle GỐC nhúng.
 * Nhận: marker — chuỗi mở đầu khai báo (ví dụ "const zh = ").
 * Trả: object đã đánh giá.
 */
function stockLiteral(marker: string): Record<string, string> {
  const source = readFileSync(STOCK_CLIENT, "utf8");
  const at = source.indexOf(marker);
  if (at < 0) throw new Error("bundle gốc không có " + marker);
  const from = source.indexOf("{", at);
  const to = source.indexOf("};", from);
  const body = source.slice(from + 1, to);
  return new Function("return {" + body + "}")() as Record<string, string>;
}

/** Bề mặt nửa host. */
interface HostHalf {
  /** Thân plugin phía Host. */
  apply: (...args: unknown[]) => unknown;
}

/**
 * Đếm mọi truy cập vào context giả (apply rỗng thì phải bằng 0 ở CẢ HAI bên).
 * Nhận: không có.
 * Trả: cặp { ctx, touched } — touched đếm số thao tác.
 */
function spyContext(): { ctx: Record<string, unknown>; touched: number[] } {
  const touched: number[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        touched.push(1);
        return (): void => undefined;
      },
      has: () => {
        touched.push(1);
        return false;
      },
    },
  ) as Record<string, unknown>;
  return { ctx, touched };
}

/** Thư mục build tạm cho mỗi lần đo artifact. */
async function buildToTemp(): Promise<{ host: string; client: string }> {
  const out = await mkdtemp(join(tmpdir(), "gbh-uit-"));
  return buildPackage(out);
}

describe("nửa host ui-input-trigger — A/B với bản gốc", () => {
  test("bề mặt export TRÙNG: cùng { apply }, cùng arity 0", async () => {
    const built = await buildToTemp();
    const ours = (await import(built.host)) as HostHalf;
    const stock = (await import(join(STOCK_DIR, "lib", "index.js"))) as HostHalf;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual(["apply"]);
    expect(ours.apply.length).toBe(stock.apply.length);
    expect(ours.apply.length).toBe(0);
  });

  test("apply RỖNG ở CẢ HAI bên: không chạm context, không trả gì", async () => {
    const built = await buildToTemp();
    const ours = (await import(built.host)) as HostHalf;
    const stock = (await import(join(STOCK_DIR, "lib", "index.js"))) as HostHalf;
    for (const [label, half] of [["ours", ours], ["stock", stock]] as const) {
      const { ctx, touched } = spyContext();
      const returned = half.apply(ctx);
      expect(returned).toBeUndefined();
      expect(touched).toHaveLength(0);
      // Gọi thêm với tham số lạ cũng không được ném (bản gốc bỏ qua mọi tham số).
      expect(() => half.apply(label, 1, { x: 2 })).not.toThrow();
    }
  });

  test("artifact HOST: ESM thuần, KHÔNG import gói ngoài, KHÔNG đăng ký module id", async () => {
    const built = await buildToTemp();
    const text = readFileSync(built.host, "utf8");
    expect(text).toContain("export {");
    expect(text).toContain("function apply() {}");
    expect(/^import /m.test(text)).toBe(false);
    expect(text.includes("__ModuleLoader__")).toBe(false);
  });
});

describe("BỘ BA bắt buộc — manifest + build + artifact", () => {
  test("exports['./client'] + dsh.client DEEP-EQUAL bản gốc + locale nguyên văn", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      exports?: Record<string, string>;
      dsh?: unknown;
      gbh?: { row?: unknown; draft?: string };
    };
    const stockManifest = JSON.parse(readFileSync(STOCK_MANIFEST, "utf8")) as { dsh?: unknown; exports?: Record<string, unknown> };
    // (b) exports["./client"] trỏ đúng artifact.
    expect(manifest.exports?.["./client"]).toBe("./lib/client.js");
    expect(stockManifest.exports?.["./client"]).toBeDefined();
    // (a) 20/10/2026 — id gói đã REWRITE CÓ CHỦ ĐÍCH sang @galaxy-blackhole/gbh-*: quy id ta → id stock rồi so
    //   DEEP-EQUAL (sameAfterIdMap giữ THỨ TỰ inject). Literal STOCK bên dưới vẫn là chuẩn — KHÔNG nới contains.
    expect(sameAfterIdMap(manifest.dsh, stockManifest.dsh)).toBe(true);
    expect(sameAfterIdMap(manifest.dsh, {
      client: {
        inject: [
          "@deepseek-ai/dsh-api-session-controller",
          "@deepseek-ai/dsh-client-locale",
          "@deepseek-ai/dsh-client-ui-conversation",
          "@deepseek-ai/dsh-client-ui-renderer",
        ],
        platform: "web",
      },
    })).toBe(true);
    // Locale: copy nguyên văn (từng byte) — tiêu đề hàng trong màn Plugins đọc từ đây.
    for (const name of ["en.json", "zh.json"]) {
      expect(readFileSync(join(PKG, "locale", name), "utf8")).toBe(readFileSync(join(STOCK_DIR, "locale", name), "utf8"));
    }
    // 19/10/2026 (Lead FLIP sau boot-smoke): đọc TRẠNG THÁI TỪ MANIFEST — row có mặt với id đúng (hoặc còn park).
    const declared = (manifest.gbh as { row?: { id?: string }; row_unmounted_ly_do?: { row?: { id?: string } } });
    const row = declared?.row ?? declared?.row_unmounted_ly_do?.row;
    expect(row?.id).toBe("ui-input-trigger");
    expect(manifest.gbh?.draft).toBeTypeOf("string");
    expect(String(manifest.gbh?.draft ?? "")).toContain("PARKED");
  });

  test("build.ts có ≥ 2 lời gọi Bun.build (host + client) và sinh lib/client.js THẬT", async () => {
    const text = readFileSync(join(PKG, "build.ts"), "utf8");
    const calls = text.match(/Bun\.build\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    // Artifact đã ship trong gói phải tồn tại …
    expect(existsSync(join(PKG, "lib", "client.js"))).toBe(true);
    expect(existsSync(join(PKG, "lib", "index.js"))).toBe(true);
    // … và một lượt build mới phải sinh lại đủ hai nửa, nửa client có nội dung thật.
    const built = await buildToTemp();
    const client = readFileSync(built.client, "utf8");
    expect(client.length).toBeGreaterThan(20_000);
    expect(client.includes("InputTriggerController")).toBe(true);
  });

  test("artifact client — dòng loader ĐÚNG MỘT id của TA · id stock còn lại là DỮ LIỆU bằng bản gốc · KHÔNG cú pháp ESM", () => {
    const code = readFileSync(join(PKG, "lib", "client.js"), "utf8");
    // 20/10/2026 — DE-BUNDLE CÓ CHỦ ĐÍCH (tools/debundle-client.ts): artifact giờ là LÁT NGUYÊN VĂN của bundle
    //   gốc, nên khuôn loader là ba dòng liền nhau (id ở DÒNG RIÊNG, thụt TAB) thay cho một dòng
    //   `load({ id: …, factory: factory })` của build.ts viết tay cũ. Phép so vẫn NGUYÊN VĂN trên đúng khuôn
    //   mới — KHÔNG nới sang contains và KHÔNG bỏ luật MỘT-ID (nay hiểu đúng canon: MỘT id ở DÒNG LOADER).
    const LOADER = /window\.__ModuleLoader__\.load\(\{\n\tid: ("[^"]+"),\n\tfactory: \(require\) => \{/g;
    const ids = [...code.matchAll(LOADER)].map((match) => JSON.parse(match[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Khuôn loader đúng MỘT lần trong toàn artifact (một lời gọi, một id) — đếm cả lời gọi lệch khuôn.
    expect(code.split("__ModuleLoader__.load(").length - 1).toBe(1);
    // 20/10/2026 — CANON: quy id CHỈ Ở DÒNG LOADER. Dòng loader mang ĐÚNG id của ta; mọi lần xuất hiện
    // khác của id gói (tag CSS + dataset.plugin) là DỮ LIỆU ⇒ GIỮ id stock như bản gốc. Ca cũ đòi
    // "id stock = 0 lần trong TOÀN artifact" — SAI CANON, đã đổi (KHÔNG nới: vẫn so từng dòng nguyên văn).
    const ourLines = code.split("\n");
    const loaderAt = loaderLineIndex(code);
    expect(ourLines[loaderAt]).toBe("window.__ModuleLoader__.load({");
    expect(ourLines[loaderAt + 1]).toBe('\tid: "' + PACKAGE_NAME + '",');
    // (a) 0 id stock Ở DÒNG LOADER …
    expect(ourLines[loaderAt + 1]?.includes(STOCK_PACKAGE_NAME)).toBe(false);
    // (b) … còn N lần còn lại là DỮ LIỆU: đếm ĐÚNG số lần của bundle gốc (hơn ta đúng MỘT lần ở loader),
    //     và DANH SÁCH dòng dữ liệu NGUYÊN VĂN như bản gốc sau khi chỉ thay dòng loader.
    const stockLines = readFileSync(STOCK_CLIENT, "utf8");
    expect(occurrences(code, STOCK_PACKAGE_NAME)).toBe(0);
    expect(stockDataLines(code, STOCK_PACKAGE_NAME)).toEqual([]);
    // Loader nạp bằng thẻ script classic ⇒ cú pháp ESM là SyntaxError.
    expect(/^\s*(export|import)\s/m.test(code)).toBe(false);
    // CSS module: chuỗi nguyên văn + tagId (DỮ LIỆU ⇒ id stock, đã khoá ở khối canon phía trên).
    expect(code).toContain("_3e4SsG_menu");
    expect(code.includes("MenuView.module.css")).toBe(true);
  });

  test("nạp artifact trong window giả: chèn thẻ style với dataset.plugin / tagId GIỮ id stock (DỮ LIỆU) như bản gốc", () => {
    const code = readFileSync(join(PKG, "lib", "client.js"), "utf8");
    const appended: { dataset: Record<string, string>; textContent: string }[] = [];
    const previous = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      querySelector: () => null,
      createElement: () => {
        const tag = { dataset: {} as Record<string, string>, textContent: "" };
        appended.push(tag);
        return tag;
      },
      head: { appendChild: () => undefined },
    };
    try {
      loadBundle(code);
    } finally {
      (globalThis as { document?: unknown }).document = previous;
    }
    expect(appended).toHaveLength(1);
    // 20/10/2026 — CANON: `dataset.plugin` và `tagId` là DỮ LIỆU DOM ⇒ artefact de-bundle GIỮ id stock
    //   như bản gốc. So ĐỐI XỨNG sau khi quy id (id ta ↔ id stock) với CHÍNH id của gói gốc, thay vì đòi
    //   tuyệt đối một phía — phép so vẫn khép: giá trị SAI (gói khác, thiếu hậu tố) vẫn ĐỎ.
    expect(normalizeIdsInText(appended[0]?.dataset.plugin ?? "")).toBe(STOCK_PACKAGE_NAME);
    expect(normalizeIdsInText(appended[0]?.dataset.pluginCss ?? "")).toBe(STOCK_PACKAGE_NAME + "/MenuView.module.css");
    // 20/10/2026 — LÔ ĐỔI TÊN BRAND: CSS của ta mang `--gbh-*`, MENU_CSS (nguồn stock) mang `--dsh-*`
    // ⇒ so ĐỐI XỨNG sau chuẩn hoá brand, KHÔNG nới phép so (vẫn đòi trùng toàn văn từng byte).
    expect(brandEqual(appended[0]?.textContent ?? "", MENU_CSS)).toBe(true);
  });
});

describe("mặt plugin + nối dây — A/B với bundle GỐC", () => {
  test("bốn export TRÙNG bản gốc, năm require ĐÚNG thứ tự, service/slot khớp", () => {
    const ours = loadBundle(readFileSync(join(PKG, "lib", "client.js"), "utf8"));
    const stock = loadBundle(readFileSync(STOCK_CLIENT, "utf8"));
    expect(Object.keys(ours.plugin).sort()).toEqual(Object.keys(stock.plugin).sort());
    expect(ours.plugin.inject).toEqual(stock.plugin.inject);
    expect(ours.plugin.inject).toEqual(["sessions", "locale"]);
    // Năm specifier đúng thứ tự bản gốc tại thời điểm factory chạy.
    expect(ours.required).toEqual(stock.required);
    expect(ours.required).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-client-store",
      "react/jsx-runtime",
      "@deepseek-ai/dsh-client-ui-primitives",
      "react",
    ]);
    const ourApply = runApply(ours.plugin);
    const stockApply = runApply(stock.plugin);
    expect(ourApply.record.effects.map((effect) => effect.label)).toEqual(stockApply.record.effects.map((effect) => effect.label));
    // 22/10/2026: artefact của ta có THÊM khoá từ điển vi (dữ liệu) ⇒ bỏ khoá "vi" ở cả hai vế rồi so.
    const boVi = (ds: { namespace: string; copy: Record<string, unknown> }[]): unknown[] =>
      ds.map((d) => ({ namespace: d.namespace, copy: Object.fromEntries(Object.entries(d.copy).filter(([k]) => k !== "vi")) }));
    expect(boVi(ourApply.record.dictionaries)).toEqual(boVi(stockApply.record.dictionaries));
    expect(ourApply.record.dictionaries[0]?.namespace).toBe("slash.menu");
    expect(ourApply.record.injections.map((injection) => [...injection.names])).toEqual(
      stockApply.record.injections.map((injection) => [...injection.names]),
    );
    expect(ourApply.record.slotInjects).toEqual(stockApply.record.slotInjects);
    expect(ourApply.record.slotInjects).toEqual(["conversation.input.overlay"]);
    const definitionOf = (run: ApplyRun): Record<string, unknown> => {
      const definition = { ...(run.record.registrations[0]?.definition ?? {}) };
      delete definition.inject;
      return definition;
    };
    expect(definitionOf(ourApply)).toEqual(definitionOf(stockApply));
    expect(definitionOf(ourApply)).toEqual({
      name: "conversation.input.overlay",
      id: "slash-menu",
      order: 0,
      locale: "slash.menu",
    });
    // Service: cùng tên + cùng static inject.
    expect(ourApply.ServiceClass.inject).toEqual(stockApply.ServiceClass.inject);
    expect(ourApply.ServiceClass.inject).toEqual(["sessions"]);
    // Mặt nghiệp vụ occupant: cùng tập khoá; scope không tồn tại ⇒ cùng thông điệp.
    expect(Object.keys(ourApply.face ?? {}).sort()).toEqual(Object.keys(stockApply.face ?? {}).sort());
    expect(Object.keys(ourApply.face ?? {}).sort()).toEqual(["headers", "menu", "onCrumb", "onDismiss", "onHover", "onPick"]);
    expect(ourApply.missingScope).toBe(stockApply.missingScope);
    expect(ourApply.missingScope).toBe('ui-input-trigger: session "nope" resolved no scope');
  });

  test("MenuView đã đăng ký: cây element TRÙNG bản gốc (mở, có breadcrumb + drill + icon)", () => {
    const ours = runApply(loadBundle(readFileSync(join(PKG, "lib", "client.js"), "utf8")).plugin);
    const stock = runApply(loadBundle(readFileSync(STOCK_CLIENT, "utf8")).plugin);
    const state = {
      open: true,
      hit: { trigger: "/", query: "go", quoted: false, position: "leading", span: { start: 0, end: 3, draftRev: 7 } },
      generation: 1,
      groups: [
        {
          source: "command",
          status: "ready",
          items: [
            { name: "goal", label: "Goal", description: "đặt mục tiêu", icon: "file" },
            { name: "plan", label: "Plan", drill: true, section: "Nhóm" },
            { name: "help" },
          ],
        },
        { source: "empty", status: "ready", items: [] },
        { source: "pending", status: "pending", items: [] },
      ],
      highlight: { source: "command", index: 1 },
    };
    const crumbs = new Map<string, unknown[]>([
      [
        "command",
        [
          { label: "root", value: "/" },
          { label: "sâu", value: "v", current: true },
        ],
      ],
    ]);
    const ourTree = renderMenu(ours.record.registrations[0]?.component, state, crumbs);
    const stockTree = renderMenu(stock.record.registrations[0]?.component, state, crumbs);
    // CANH BẪY NEWLINE (Bun 1.3.14): in chuỗi chứa "\n" thành template NHIỀU DÒNG kèm thụt lề ⇒ cây element
    // có thể "trông giống" nhưng khác byte. So CHUỖI JSON: lệch 1 byte (kể cả \n vs template) là ĐỎ ngay.
    expect(JSON.stringify(ourTree)).toBe(JSON.stringify(stockTree));
    expect(JSON.parse(JSON.stringify(ourTree))).toEqual(JSON.parse(JSON.stringify(stockTree)));
    // Menu đóng vẽ null ở CẢ HAI bên.
    const closedState = { ...state, open: false, groups: [] };
    expect(renderMenu(ours.record.registrations[0]?.component, closedState, crumbs)).toBeNull();
    expect(renderMenu(stock.record.registrations[0]?.component, closedState, crumbs)).toBeNull();
  });

  test("controller — cùng kịch bản cho CÙNG ảnh chụp menu/lexicon/breadcrumb/bail", async () => {
    const ourRun = await runPipeline(loadBundle(readFileSync(join(PKG, "lib", "client.js"), "utf8")).plugin);
    const stockRun = await runPipeline(loadBundle(readFileSync(STOCK_CLIENT, "utf8")).plugin);
    expect(ourRun.calls).toEqual(stockRun.calls);
    expect(ourRun.states).toEqual(stockRun.states);
    expect(ourRun.lexicon).toEqual(stockRun.lexicon);
    expect(ourRun.headers).toEqual(stockRun.headers);
    expect(ourRun.outcomes).toEqual(stockRun.outcomes);
    expect(ourRun.bails).toEqual(stockRun.bails);
    expect(ourRun.errors).toEqual(stockRun.errors);
    // Neo nghĩa: các bước chính đã thực sự xảy ra (không phải hai bên cùng rỗng).
    const bails = ourRun.bails as [string, Record<string, unknown>][];
    expect(bails.map((entry) => entry[0])).toEqual([
      "slash/input-begin-command",
      "slash/input-insert-text",
      "slash/input-insert-text",
    ]);
    const lastState = ourRun.states[ourRun.states.length - 1] as { open: boolean };
    expect(lastState.open).toBe(false);
  });
});

describe("lõi thuần + CSS + từ điển — nguyên văn bản gốc", () => {
  test("CSS module TRÙNG TỪNG BYTE + bảng lớp trùng bản gốc", () => {
    expect(MENU_CSS).toBe(stockCss());
    expect(MENU_STYLES as Record<string, string>).toEqual(stockLiteral("var MenuView_module_css_default = "));
    expect(MENU_CSS.length).toBe(4052);
  });

  test("từ điển zh/en TRÙNG bản gốc (9 khoá, kể cả dấu … U+2026)", () => {
    expect(ourZh as Record<string, string>).toEqual(stockLiteral("const zh = "));
    expect(ourEn as Record<string, string>).toEqual(stockLiteral("const en = "));
    expect(Object.keys(ourZh).sort()).toEqual(Object.keys(ourEn).sort());
    expect(ourZh.loading).toBe("正在加载…");
    expect(ourEn["suggestions.aria"]).toBe("Trigger suggestions");
  });
});