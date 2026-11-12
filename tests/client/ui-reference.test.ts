/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-client-ui-reference (row ui-reference):
 *      A/B voi bundle GOC trong cung mot gia — dang ky seam · rule van ban · ung vien · onPick · render
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
const STOCK_BUNDLE = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-client-ui-reference/lib/client.js");

/** Manifest của bản gốc, để so `dsh.client.inject`. */
const STOCK_MANIFEST = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-client-ui-reference/package.json");

/** Manifest của ta. */
const OUR_MANIFEST = join(REPO, "packages/client/ui-reference/package.json");

/** Id module của package ta. */
const OUR_PACKAGE = "@galaxy-blackhole/gbh-client-ui-reference";

/** Id module của package gốc. */
const STOCK_PACKAGE = "@deepseek-ai/dsh-client-ui-reference";

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
  // Bundle có thể đọc facade qua `window` (bản gốc DSH) hoặc `globalThis` (bản của ta).
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

/** Trạng thái hook giả, sống qua các lần render của một "phiên component". */
const hooks = { cursor: 0, cells: [] as unknown[] };

/** Bảng hook React giả (chỉ `useState` là row này dùng). */
function fakeReact(): Record<string, unknown> {
  return {
    useState: <S>(initial: S): [S, (value: S | ((previous: S) => S)) => void] => {
      const cell = hooks.cursor;
      hooks.cursor += 1;
      if (!(cell in hooks.cells)) hooks.cells[cell] = initial;
      const setter = (value: S | ((previous: S) => S)): void => {
        const previous = hooks.cells[cell] as S;
        hooks.cells[cell] = typeof value === "function" ? (value as (from: S) => S)(previous) : value;
      };
      return [hooks.cells[cell] as S, setter];
    },
  };
}

/** Tuổi phiên giả — cùng một hàm cho CẢ HAI bên nên so sánh vẫn công bằng. */
function relativeTime(at: number, now: number): { unit: string; n: number } {
  const ms = Math.max(0, now - at);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return { unit: "now", n: 0 };
  if (minutes < 60) return { unit: "minutes", n: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hours", n: hours };
  return { unit: "days", n: Math.floor(hours / 24) };
}

/** Ghi lại mọi điểm chạm seam của một lần chạy `apply`. */
interface SeamLog {
  /** Nhãn hiệu ứng đã đăng ký. */
  effects: string[];
  /** Từ điển đã đăng ký. */
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
  /** Slot đã `inject` vào. */
  injected: string[];
  /** Occupant đã đăng ký. */
  registered: { slot: string; definition: Record<string, unknown>; component: unknown }[];
  /** Rule văn bản đã đăng ký vào `uiConversation.userText`. */
  textRules: unknown[];
  /** Nguồn `@` đã đăng ký vào `inputTriggers`. */
  sources: unknown[];
  /** Địa chỉ đã gửi cho `sidebarRight.openResource`. */
  opened: string[];
}

/** Ứng viên mà RPC giả trả về. */
const FILE_ROWS = [
  { path: "src/app.ts", kind: "file" },
  { path: "my docs/notes.md", kind: "file" },
  { path: "docs/", kind: "directory" },
];

/** Ứng viên phiên mà RPC giả trả về. */
const SESSION_ROWS = [
  { sessionId: "s1", label: "Alpha", mention: "@Alpha", createdAt: 1_000_000, cwd: "/Users/bob/proj", sameWorkspace: false },
  { sessionId: "s2", label: "Child", mention: "@Child", createdAt: 1_000_000, cwd: "/Users/bob/proj", sameWorkspace: true },
  { sessionId: "s3", label: "Beta", mention: "@Beta", createdAt: 1_200_000, sameWorkspace: false },
];

/** Bản ghi tóm tắt phiên (khoá theo id). */
const SUMMARIES: Record<string, { cwd?: string; origin?: string; parentId?: string; updatedAt?: number }> = {
  "sess-1": { cwd: "/Users/bob/proj", updatedAt: 1_300_000 },
  s1: { cwd: "/Users/bob/proj", updatedAt: 1_100_000 },
  s2: { cwd: "/Users/bob/proj", origin: "subagent", parentId: "sess-1", updatedAt: 1_400_000 },
  s3: {},
};

/** Context giả phía browser cho row này. */
interface FakeContext {
  /** Context truyền cho `apply`. */
  ctx: unknown;
  /** Bảng ghi seam. */
  log: SeamLog;
  /** Phiên đang soạn. */
  session: { sessionId: string };
  /** Tín hiệu huỷ của lần gọi `candidates` kế tiếp. */
  controller: AbortController;
  /** Đặt chế độ giả cho `sessions.binding` (false ⇒ không còn giữ phiên). */
  setRetained(value: boolean): void;
  /** Đặt trạng thái mở của phiên trong `sessions.using`. */
  setOpenState(value: { openState: string; openError?: Error }): void;
  /** Huỷ tín hiệu NGAY TRONG lúc tra RPC (mô phỏng người dùng gõ tiếp). */
  abortDuringLookup(controller: AbortController): void;
}

/**
 * Dựng context giả đủ cho row `ui-reference`.
 * Nhận: không.
 * Trả: context giả kèm bảng ghi.
 */
function fakeContext(): FakeContext {
  const log: SeamLog = { effects: [], dictionaries: [], injected: [], registered: [], textRules: [], sources: [], opened: [] };
  const state = {
    retained: true,
    open: { openState: "open" } as { openState: string; openError?: Error },
    abortDuringLookup: null as AbortController | null,
  };
  const controller = new AbortController();
  const t = (namespace: string) => (key: string, params?: Record<string, string | number>): string => {
    const dictionary = log.dictionaries.find((entry) => entry.namespace === namespace);
    const template = dictionary?.copy.en?.[key] ?? key;
    if (params === undefined) return template;
    return template.replace(/\{(\w+)\}/gu, (_match, name: string) => String(params[name] ?? ""));
  };
  const sessions = {
    binding: (): unknown => (state.retained ? { session: {} } : undefined),
    using: async <T>(_sessionId: string, _options: unknown, callback: (binding: unknown) => Promise<T>): Promise<T> =>
      callback({ binding: { session: { getSnapshot: () => state.open } } }),
    list: { getSnapshot: (): { byId: Record<string, unknown> } => ({ byId: SUMMARIES }) },
  };
  const remote = {
    $host: { home: "/Users/bob" },
    fileReferences: {
      list: async (): Promise<unknown> => {
        state.abortDuringLookup?.abort();
        return { ok: true, value: FILE_ROWS };
      },
    },
    sessionReferenceResolver: { candidates: async (): Promise<unknown> => ({ ok: true, value: SESSION_ROWS }) },
  };
  const ctx = {
    effect: (callback: () => unknown, label: string): void => {
      log.effects.push(label);
      callback();
    },
    get: (name: string): unknown => (name === "sessions" ? sessions : { registerSource: (source: unknown) => log.sources.push(source) }),
    locale: {
      register: (namespace: string, copy: Record<string, Record<string, string>>): (() => void) => {
        log.dictionaries.push({ namespace, copy });
        return () => undefined;
      },
      bind: (namespace: string): ((key: string, params?: Record<string, string | number>) => string) => t(namespace),
    },
    slots: {
      inject: (slot: string, register: () => unknown): void => {
        log.injected.push(slot);
        const produced = register();
        if (produced !== null && typeof produced === "object" && Symbol.iterator in produced) {
          for (const item of produced as Iterable<unknown>) void item;
        }
      },
      register: (definition: Record<string, unknown>, component: unknown): (() => void) => {
        log.registered.push({ slot: typeof definition.name === "string" ? definition.name : "", definition, component });
        return () => undefined;
      },
    },
    uiConversation: { userText: { register: (rule: unknown): unknown => log.textRules.push(rule) } },
    sidebarRight: {
      openResource: (address: string): void => {
        log.opened.push(address);
      },
    },
    remote,
  };
  return {
    ctx,
    log,
    session: { sessionId: "sess-1" },
    controller,
    setRetained: (value: boolean) => {
      state.retained = value;
    },
    setOpenState: (value: { openState: string; openError?: Error }) => {
      state.open = value;
    },
    abortDuringLookup: (value: AbortController) => {
      state.abortDuringLookup = value;
    },
  };
}

/**
 * `require` giả mà bảng module cấp cho factory.
 * Nhận: không.
 * Trả: hàm require chỉ phục vụ 3 module tĩnh của row này.
 */
function fakeRequire(): (specifier: string) => unknown {
  const modules: Record<string, unknown> = {
    react: fakeReact(),
    "react/jsx-runtime": {
      Fragment: "Fragment",
      jsx: (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key }),
      jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key }),
    },
    "@deepseek-ai/dsh-client-ui-primitives": {
      ReferenceChip: "ReferenceChip",
      Modal: "Modal",
      Button: "Button",
      relativeTime,
    },
  };
  return (specifier: string): unknown => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    if (!(specifier in modules)) throw new Error("test: khong duoc require " + specifier);
    return modules[specifier];
  };
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
  const { buildPackage } = await import("../../packages/client/ui-reference/build.ts");
  const out = await mkdtemp(join(tmpdir(), "gbh-ui-reference-"));
  await buildPackage(out);
  ourCode = readFileSync(join(out, "client.js"), "utf8");
  return ourCode;
}

/**
 * Nạp một bundle rồi gọi factory để lấy bề mặt plugin.
 * Nhận: `code` — nguồn bundle.
 * Trả: bề mặt plugin.
 */
function loadPlugin(code: string): PluginFace {
  const registration = runBundle(code)[0];
  if (registration === undefined) throw new Error("test: bundle khong dang ky module nao");
  return registration.factory(fakeRequire()) as PluginFace;
}

/** Nạp cả hai bên trong cùng một gia để so A/B. */
async function bothSides(): Promise<{ ours: PluginFace; stock: PluginFace }> {
  return { ours: loadPlugin(await bundleOfOurs()), stock: loadPlugin(readFileSync(STOCK_BUNDLE, "utf8")) };
}

/**
 * Chuẩn hoá giá trị thành dữ liệu so sánh được (hàm → nhãn, khoá sắp xếp).
 * Nhận: `value` — giá trị bất kỳ.
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

/** Giao diện nguồn `@` mà bài test gọi trực tiếp. */
interface SourceFace {
  /** Ký tự kích hoạt. */
  trigger: string;
  /** Tên nguồn. */
  name: string;
  /** Có tự hiện tiêu đề nhóm không. */
  showGroupTitle: boolean;
  /** Liệt kê ứng viên. */
  candidates(session: { sessionId: string }, request: Record<string, unknown>): Promise<unknown[]>;
  /** Breadcrumb của thư mục đang xem. */
  header(session: { sessionId: string }, request: Record<string, unknown>): unknown;
  /** Xử lý chọn một mục. */
  onPick(input: Record<string, unknown>): unknown;
  /** Mở lại một tham chiếu. */
  openReference(session: { sessionId: string }, input: Record<string, unknown>): unknown;
  /** Mã hoá tham chiếu. */
  codec: { clipboardText(ref: string): string; serialize(ref: string): Promise<string> };
}

/**
 * Chạy `apply` trên một bên rồi trả context giả và nguồn `@` đã đăng ký.
 * Nhận: `face` — bề mặt plugin.
 * Trả: context giả + nguồn `@` + hai rule văn bản.
 */
function mount(face: PluginFace): { fake: FakeContext; source: SourceFace; rules: { id: string; order: number; match(text: string, from: number): unknown }[] } {
  const fake = fakeContext();
  face.apply(fake.ctx);
  const source = fake.log.sources[0] as SourceFace;
  const rules = fake.log.textRules as { id: string; order: number; match(text: string, from: number): unknown }[];
  return { fake, source, rules };
}

describe("row ui-reference — nửa client", () => {
  test("ca 1: hành vi chính — inject, từ điển, hai rule, hai occupant và nguồn @ giống bản gốc", async () => {
    const { ours, stock } = await bothSides();
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual([
      "inputTriggers",
      "locale",
      "sessions",
      "remote",
      "remote.fileReferences",
      "remote.sessionReferenceResolver",
      "sidebarRight",
      "slots",
      "uiConversation",
    ]);
    const mine = mount(ours);
    const theirs = mount(stock);
    expect(mine.fake.log.effects).toEqual(theirs.fake.log.effects);
    expect(withoutVi(mine.fake.log.dictionaries)).toEqual(withoutVi(theirs.fake.log.dictionaries));
    expect(Object.keys(viDictionary(mine.fake.log.dictionaries) ?? {}).length).toBe(15);
    expect(mine.fake.log.dictionaries[0]?.namespace).toBe("reference");
    expect(mine.fake.log.dictionaries[0]?.copy.zh?.["fileOpen.failed"]).toBe("无法打开“{path}”，请重试或关闭此提示");
    expect(mine.fake.log.injected).toEqual(theirs.fake.log.injected);
    expect(mine.fake.log.injected).toEqual(["conversation.user.text.node"]);
    expect(snapshot(mine.fake.log.registered.map((r) => ({ ...r, component: undefined })))).toEqual(
      snapshot(theirs.fake.log.registered.map((r) => ({ ...r, component: undefined }))),
    );
    expect(mine.fake.log.registered.map((r) => r.definition)).toMatchObject([
      { name: "conversation.user.text.node", key: "file", priority: 100, locale: "reference" },
      { name: "conversation.user.text.node", key: "folder", priority: 100 },
    ]);
    expect(snapshot({ trigger: mine.source.trigger, name: mine.source.name, showGroupTitle: mine.source.showGroupTitle })).toEqual(
      snapshot({ trigger: theirs.source.trigger, name: theirs.source.name, showGroupTitle: theirs.source.showGroupTitle }),
    );
    expect(snapshot(mine.source.codec.clipboardText("@a"))).toEqual(snapshot(theirs.source.codec.clipboardText("@a")));
    expect(await mine.source.codec.serialize("@a")).toEqual(await theirs.source.codec.serialize("@a"));
  });

  test("ca 2: hai rule văn bản — A/B trên cùng văn bản, kể cả dấu ngoặc và dấu câu cuối", async () => {
    const { ours, stock } = await bothSides();
    const mine = mount(ours);
    const theirs = mount(stock);
    expect(mine.rules.map((rule) => rule.id)).toEqual(theirs.rules.map((rule) => rule.id));
    expect(mine.rules.map((rule) => rule.order)).toEqual(theirs.rules.map((rule) => rule.order));
    const texts = [
      "xem @src/app.ts nhé",
      'xem @"my docs/notes.md" nhé',
      "gõ @docs/ để xem thư mục",
      "câu cuối @README.md, và nữa",
      "không có tham chiếu nào",
      "@ file",
    ];
    for (const text of texts) {
      for (const [index, rule] of mine.rules.entries()) {
        const other = theirs.rules[index];
        expect(snapshot(rule.match(text, 0))).toEqual(snapshot(other?.match(text, 0)));
      }
    }
    expect(snapshot(mine.rules[0]?.match("xem @src/app.ts nhé", 0))).toEqual({
      id: "file",
      start: 4,
      end: 15,
      data: { path: "src/app.ts", label: "app.ts" },
    });
    expect(snapshot(mine.rules[1]?.match("gõ @docs/ để xem thư mục", 0))).toEqual({
      id: "folder",
      start: 3,
      end: 9,
      data: { path: "docs/", label: "docs" },
    });
    expect(mine.rules[0]?.match("không có tham chiếu nào", 0)).toBeUndefined();
  });

  test("ca 3: ứng viên — A/B danh sách mục (tệp có/không vị trí, phiên con trước, tuổi phiên)", async () => {
    const { ours, stock } = await bothSides();
    const mine = mount(ours);
    const theirs = mount(stock);
    const request = { query: "a", quoted: false, drilled: false, signal: new AbortController().signal };
    const mineItems = await mine.source.candidates(mine.fake.session, request);
    const theirItems = await theirs.source.candidates(theirs.fake.session, request);
    expect(snapshot(mineItems)).toEqual(snapshot(theirItems));
    expect(mineItems).toHaveLength(6);
    const first = mineItems[0] as Record<string, unknown>;
    expect(first).toMatchObject({ name: "app.ts", icon: "file", section: "Files & folders" });
    expect(JSON.parse(String(first.value))).toMatchObject({ kind: "file", fileKind: "file", mention: "@src/app.ts" });
    const quoted = await mine.source.candidates(mine.fake.session, { query: "my docs/", quoted: true, drilled: false, signal: new AbortController().signal });
    const quotedTheirs = await theirs.source.candidates(theirs.fake.session, { query: "my docs/", quoted: true, drilled: false, signal: new AbortController().signal });
    expect(snapshot(quoted)).toEqual(snapshot(quotedTheirs));
    // `quoted: true` thì seam phiên trả RỖNG (đúng như bản gốc) — chỉ còn ứng viên tệp.
    expect(quoted.every((item) => (item as Record<string, unknown>).section === "Files & folders")).toBe(true);
    const children = mineItems.filter((item) => (item as Record<string, unknown>).section === "Subagents");
    expect(children).toHaveLength(1);
    expect(mineItems.findIndex((item) => (item as Record<string, unknown>).section === "Subagents")).toBeLessThan(
      mineItems.findIndex((item) => (item as Record<string, unknown>).section === "Sessions"),
    );
  });

  test("ca 4: header (crumb) và onPick — A/B khi drill/không drill, chọn tệp, thư mục và phiên", async () => {
    const { ours, stock } = await bothSides();
    const mine = mount(ours);
    const theirs = mount(stock);
    for (const request of [
      { query: "src/app.ts", quoted: false, drilled: false },
      { query: "src/components/", quoted: false, drilled: true },
      { query: "my docs/sub/", quoted: true, drilled: true },
    ]) {
      expect(snapshot(mine.source.header(mine.fake.session, request))).toEqual(
        snapshot(theirs.source.header(theirs.fake.session, request)),
      );
    }
    const picks = [
      { candidate: { value: JSON.stringify({ kind: "file", fileKind: "directory", label: "docs", mention: "@docs/" }) }, action: "drill" },
      { candidate: { value: JSON.stringify({ kind: "file", fileKind: "file", label: "app.ts", mention: "@src/app.ts" }) }, action: "insert" },
      { candidate: { value: JSON.stringify({ kind: "session", label: "Alpha", mention: "@Alpha" }) }, action: "insert" },
      { candidate: {}, action: "insert" },
    ];
    for (const pick of picks) {
      expect(snapshot(mine.source.onPick(pick))).toEqual(snapshot(theirs.source.onPick(pick)));
    }
    expect(snapshot(mine.source.onPick(picks[0]!))).toEqual({ text: "@docs/", continue: true });
    expect(snapshot(mine.source.onPick(picks[2]!))).toEqual({
      insert: { source: "reference", ref: "@Alpha", label: "Alpha", appearance: "session", clipboardText: "@Alpha" },
    });
  });

  test("ca 5: điều hướng — địa chỉ gửi cho sidebarRight khớp bản gốc (trong/ngoài workspace, có dấu cách)", async () => {
    const { ours, stock } = await bothSides();
    const mine = mount(ours);
    const theirs = mount(stock);
    const cases: { ref: string; action: string }[] = [
      { ref: "@src/app.ts", action: "open" },
      { ref: '@"my docs/notes.md"', action: "open" },
      { ref: "@/etc/hosts", action: "open" },
      { ref: "@/Users/bob/proj/src/deep/x.ts", action: "open" },
      { ref: "@Alpha", action: "open" },
    ];
    for (const item of cases) {
      const mineHandled = mine.source.openReference(mine.fake.session, { ref: item.ref, appearance: "file" });
      const theirHandled = theirs.source.openReference(theirs.fake.session, { ref: item.ref, appearance: "file" });
      expect(mineHandled).toBe(theirHandled);
    }
    // 18/10/2026 (task-29): A/B phải CHUẨN HOÁ scheme — bản gốc vẫn phát dsh-resource://, ta phát
    //   gbh-resource:// (thay đổi thương hiệu CÓ CHỦ ĐÍCH); mọi phần còn lại của địa chỉ phải khớp từng ký tự.
    const normalizeScheme = (addresses: string[]): string[] =>
      addresses.map((address) => address.replace(/^dsh-resource:\/\//u, "gbh-resource://"));
    expect(mine.fake.log.opened).toEqual(normalizeScheme(theirs.fake.log.opened));
    expect(mine.fake.log.opened[0]).toBe("gbh-resource://file/session/sess-1/src/app.ts");
    expect(mine.fake.log.opened[1]).toBe("gbh-resource://file/session/sess-1/my%20docs/notes.md");
    // Đường dẫn tuyệt đối NGOÀI workspace: giữ nguyên dạng tuyệt đối trong địa chỉ (bản gốc cũng vậy
    // — hai dấu "/" là hành vi đo được của gốc, KHÔNG sửa cho đẹp vì A/B phải khớp).
    expect(mine.fake.log.opened[2]).toBe("gbh-resource://file/session/sess-1//etc/hosts");
    // Đường dẫn tuyệt đối TRONG workspace: rút về tương đối theo gốc workspace.
    expect(mine.fake.log.opened[3]).toBe("gbh-resource://file/session/sess-1/src/deep/x.ts");
    expect(mine.source.openReference(mine.fake.session, { ref: "@Alpha", appearance: "session" })).toBe(false);
  });

  test("ca 6: chip inline — cây element A/B, và lỗi điều hướng GIỮ tham chiếu + mở hộp thoại", async () => {
    const { ours, stock } = await bothSides();
    const mine = mount(ours);
    const theirs = mount(stock);
    const t = (key: string, params?: Record<string, string | number>): string => {
      const copy = mine.fake.log.dictionaries[0]?.copy.en?.[key] ?? key;
      return params === undefined ? copy : copy.replace(/\{(\w+)\}/gu, (_m, name: string) => String(params[name] ?? ""));
    };
    const props = {
      node: { data: { path: "src/app.ts", label: "app.ts" } },
      raw: "@src/app.ts",
      interactive: true,
      openFile: (): void => {
        throw new Error("khong mo duoc");
      },
      t,
    };
    const render = (component: unknown): unknown => {
      hooks.cursor = 0;
      return (component as (input: Record<string, unknown>) => unknown)(props);
    };
    const mineTree = render(mine.fake.log.registered[0]?.component);
    const theirTree = render(theirs.fake.log.registered[0]?.component);
    expect(snapshot(mineTree)).toEqual(snapshot(theirTree));
    const chip = JSON.parse(JSON.stringify(snapshot(mineTree))) as { props: { children: unknown[] } };
    expect(chip.props.children).toHaveLength(2);
    const firstChild = (mineTree as { props: { children: { props: { onActivate?: () => void } }[] } }).props.children[0];
    if (firstChild === undefined) throw new Error("test: thieu chip dau tien");
    const activate = firstChild.props.onActivate;
    expect(typeof activate).toBe("function");
    activate?.();
    const afterFailure = render(mine.fake.log.registered[0]?.component);
    const afterTheirs = render(theirs.fake.log.registered[0]?.component);
    expect(snapshot(afterFailure)).toEqual(snapshot(afterTheirs));
    const modal = (afterFailure as { props: { children: unknown[] } }).props.children[1] as {
      type: string;
      props: { title: string; description: string; closeLabel: string };
    };
    expect(modal.type).toBe("Modal");
    expect(modal.props.title).toBe("Couldn’t open file");
    expect(modal.props.description).toBe("Couldn’t open “src/app.ts”. Try again or close this message.");
    expect(modal.props.closeLabel).toBe("Close");
    const folder = render(mine.fake.log.registered[1]?.component);
    expect(snapshot(folder)).toEqual(snapshot(render(theirs.fake.log.registered[1]?.component)));
    expect(snapshot(folder)).toMatchObject({ props: { appearance: "folder", label: "app.ts", title: "@src/app.ts" } });
  });

  test("ca 7: đăng ký ĐÚNG id — 1 id module khớp TÊN PACKAGE (luật id = id bundle tự khai) và bundle là script classic", async () => {
    const code = await bundleOfOurs();
    const registrations = runBundle(code);
    expect(registrations.map((entry) => entry.id)).toEqual([OUR_PACKAGE]);
    const manifest = JSON.parse(readFileSync(OUR_MANIFEST, "utf8")) as { name: string; dsh?: { client?: unknown } };
    expect(registrations[0]?.id).toBe(manifest.name);
    const stockManifest = JSON.parse(readFileSync(STOCK_MANIFEST, "utf8")) as {
      dsh?: { client?: { inject?: string[]; platform?: string; immediately?: boolean } };
      name: string;
    };
    const ourClient = (manifest as { dsh?: { client?: { inject?: string[]; platform?: string; immediately?: boolean } } }).dsh?.client;
    // 20/10/2026 — id inject đã REWRITE CÓ CHỦ ĐÍCH sang id GBH; quy id ta -> id stock rồi so SÂU cả client
    // (inject ĐÚNG THỨ TỰ + platform + immediately), giữ manifest gốc làm chuẩn.
    expect(sameAfterIdMap(ourClient, stockManifest.dsh?.client)).toBe(true);
    expect(ourClient?.platform).toBe(stockManifest.dsh?.client?.platform);
    expect(ourClient?.immediately).toBe(stockManifest.dsh?.client?.immediately);
    const stock = runBundle(readFileSync(STOCK_BUNDLE, "utf8"));
    expect(stock.map((entry) => entry.id)).toEqual([STOCK_PACKAGE]);
  });

  test("ca 7b: KHÔNG bundle nào require id stock ⇒ không cần alias (đo trên cây đã cài)", () => {
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

  test("ca 8: đường lỗi — phiên không còn giữ / phiên chưa mở / đã huỷ đều rõ ràng, không treo", async () => {
    const { ours, stock } = await bothSides();
    const mine = mount(ours);
    const theirs = mount(stock);
    const request = { query: "a", quoted: false, drilled: false, signal: new AbortController().signal };
    mine.fake.setRetained(false);
    theirs.fake.setRetained(false);
    await expect(mine.source.candidates(mine.fake.session, request)).rejects.toThrow('retained session "sess-1"');
    await expect(theirs.source.candidates(theirs.fake.session, request)).rejects.toThrow('retained session "sess-1"');
    mine.fake.setRetained(true);
    const openError = new Error("phiên đang bận");
    mine.fake.setOpenState({ openState: "opening", openError });
    await expect(mine.source.candidates(mine.fake.session, request)).rejects.toThrow("phiên đang bận");
    mine.fake.setOpenState({ openState: "opening" });
    await expect(mine.source.candidates(mine.fake.session, request)).rejects.toThrow('session "sess-1" is not open');
    mine.fake.setOpenState({ openState: "open" });
    // Huỷ GIỮA lúc tra RPC: `using` vẫn xong, nhưng cổng `signal.aborted` sau đó phải trả danh sách RỖNG.
    const aborted = new AbortController();
    mine.fake.abortDuringLookup(aborted);
    expect(await mine.source.candidates(mine.fake.session, { ...request, signal: aborted.signal })).toEqual([]);
    // Huỷ TRƯỚC khi gọi: seam huỷ ngay ở `throwIfAborted` — ném AbortError, không treo.
    const preAborted = new AbortController();
    preAborted.abort();
    await expect(mine.source.candidates(mine.fake.session, { ...request, signal: preAborted.signal })).rejects.toThrow();
    expect(() => mine.source.onPick({ candidate: {} })).not.toThrow();
    expect(mine.source.onPick({ candidate: {} })).toBeUndefined();
  });
});

describe("(4b) idempotent apply — hai ca BẮT BUỘC", () => {
  /**
   * `require` giả tự sinh: `createPlugin` đọc react/jsx-runtime/primitives ngay lúc dựng mặt plugin, nên stub
   * phải trả về thứ "dùng được" cho mọi khoá mà không cần kéo cả ba thư viện vào test.
   */
  function fakeRequire(): unknown {
    const auto = (): unknown =>
      new Proxy(function () {}, {
        get: () => auto(),
        apply: () => auto(),
      });
    return () => auto();
  }

  /**
   * Context tối thiểu: đếm số lần vào `effect` (mỗi lần cài thật đều đi qua đây trước tiên).
   * @returns context giả và bộ đếm.
   */
  function stubContext(): { ctx: never; effects: () => number } {
    let effects = 0;
    const ctx = {
      effect: () => {
        effects += 1;
        return () => undefined;
      },
      locale: { register: () => () => undefined, bind: () => () => "" },
      get: () => undefined,
      uiConversation: { userText: { register: () => () => undefined } },
      slots: { inject: () => () => undefined },
    };
    return { ctx: ctx as never, effects: () => effects };
  }

  test("gọi apply HAI lần ⇒ lần hai là NO-OP (không cài lại)", async () => {
    /* Module TƯƠI mỗi ca: cờ 'installed' ở phạm vi module sẽ dính giữa các ca nếu import tĩnh. */
    const spec: string = "../../packages/client/ui-reference/src/plugin.ts?idempotent";
    const module_ = (await import(spec)) as { createPlugin(requireFn: unknown): { apply(ctx: unknown): void } };
    const plugin = module_.createPlugin(fakeRequire());
    const harness = stubContext();
    try {
      plugin.apply(harness.ctx);
    } catch {
      /* Context tối thiểu có thể làm applyInner dừng giữa đường — điều cần đo là SỐ LẦN VÀO, không phải chạy hết. */
    }
    const afterFirst = harness.effects();
    plugin.apply(harness.ctx);
    expect(harness.effects()).toBe(afterFirst);
  });

  test("apply ném lỗi ⇒ có ĐÚNG 1 dòng console.error VÀ lỗi vẫn được ném tiếp", async () => {
    const spec: string = "../../packages/client/ui-reference/src/plugin.ts?throwing";
    const module_ = (await import(spec)) as { createPlugin(requireFn: unknown): { apply(ctx: unknown): void } };
    const plugin = module_.createPlugin(fakeRequire());
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };
    try {
      const ctx = {
        effect: () => {
          throw new Error("effect no");
        },
      };
      expect(() => plugin.apply(ctx)).toThrow("effect no");
      expect(logged.length).toBe(1);
      expect(String(logged[0]?.[0] ?? "")).toContain("gbh-client-ui-reference: apply nem loi");
    } finally {
      console.error = original;
    }
  });
});
