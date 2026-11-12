/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-client-ui-approval (row ui-approval): contract, waterfall, panel, ban phim
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeBrand } from "../lib/brand-parity.ts";
import { buildPackage } from "../../packages/client/ui-approval/build.ts";
import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "../../packages/client/ui-approval/src/ids.ts";
import { NS, en, zh } from "../../packages/client/ui-approval/src/locales.ts";
import {
  PendingApproval,
  settlePendingComposer,
  type ApprovalPresentationRequest,
} from "../../packages/client/ui-approval/src/pending-approval.ts";
import { CLASS, createApprovalPanel, injectPanelStyles, type ApprovalComposerProps } from "../../packages/client/ui-approval/src/panel.ts";
import type { ClientPlugin, RequireFn, ShortcutScope } from "../../packages/client/ui-approval/src/plugin.ts";

/** Tên slot composer mà row phải đăng ký — chép từ bản gốc, KHÔNG lấy từ hằng của gói. */
const COMPOSER_SLOT = "conversation.composer";
/** Slot con chứa chi tiết do Tool sở hữu. */
const DETAIL_SLOT = "conversation.approval.detail";
/** Tập khoá copy của namespace `approval` — chép từ từ điển gốc. */
const LOCALE_KEYS = ["waiting", "detail.aria", "escalation", "reject", "allowOnce"];

/** Một element do jsx giả dựng. */
interface Element {
  /** Loại element: chuỗi thẻ HTML hoặc component. */
  type: unknown;
  /** Props đã truyền. */
  props: Record<string, unknown>;
  /** Khoá React, nếu có. */
  key?: unknown;
}

/** Một đăng ký `__ModuleLoader__.load` mà script thật phát ra. */
interface Registration {
  /** Id module bundle tự khai. */
  id: string;
  /** Factory lười. */
  factory: (require: RequireFn) => unknown;
}

/** Bản build thật, dùng chung cho cả file. */
let built: Promise<{ host: string; client: string }> | undefined;

/**
 * Build package vào thư mục tạm (một lần cho cả file).
 * Nhận: không.
 * Trả: đường dẫn hai nửa đã build.
 */
function buildOnce(): Promise<{ host: string; client: string }> {
  built ??= mkdtemp(join(tmpdir(), "gbh-ui-approval-")).then((out) => buildPackage(out));
  return built;
}

/**
 * Nạp bundle client thật trong `window` giả.
 * Nhận: mã nguồn `lib/client.js`.
 * Trả: các đăng ký theo đúng thứ tự script phát ra.
 */
function loadBundle(code: string): Registration[] {
  const calls: Registration[] = [];
  new Function("window", code)({ __ModuleLoader__: { load: (registration: Registration) => calls.push(registration) } });
  return calls;
}

/** jsx giả: ghi lại cây element thay vì render. */
function fakeJsx(type: unknown, props: Record<string, unknown>, key?: unknown): Element {
  return { type, props, key };
}

/** React giả: đủ `useState`/`useRef`/`useEffect` cho MỘT lượt render. */
function makeReact(record: { answered?: boolean; cleanups: (() => void)[] }) {
  return {
    useState: (initial: boolean): [boolean, (next: boolean) => void] => [
      record.answered ?? initial,
      (next: boolean) => {
        record.answered = next;
      },
    ],
    useRef: <T,>(initial: T): { current: T } => ({ current: initial }),
    useEffect: (callback: () => void | (() => void)): void => {
      const cleanup = callback();
      if (typeof cleanup === "function") record.cleanups.push(cleanup);
    },
  };
}

/** ui-primitives giả: hai component đánh dấu. */
function makePrimitives(): { StateDot: unknown; Button: unknown } {
  return {
    StateDot: (props: Record<string, unknown>) => ({ type: "StateDot", props }),
    Button: (props: Record<string, unknown>) => ({ type: "Button", props }),
  };
}

/** Document giả tối thiểu cho việc chèn style. */
function makeDocument() {
  const created: { dataset: Record<string, string>; textContent: string }[] = [];
  const appended: typeof created = [];
  const doc = {
    activeElement: { tag: "panel" } as unknown,
    head: {
      appendChild: (el: (typeof created)[number]): void => {
        appended.push(el);
      },
    },
    createElement: (): (typeof created)[number] => {
      const el = { dataset: {} as Record<string, string>, textContent: "" };
      created.push(el);
      return el;
    },
    querySelector: (selector: string): unknown =>
      appended.find((el) => selector.includes(el.dataset.pluginCss ?? "\u0000")) ?? null,
    querySelectorAll: (): typeof created => appended,
  };
  return { doc, created, appended };
}

/** Dấu vết của một lần `apply` trên context giả. */
interface CtxRecord {
  /** Hiệu ứng vòng đời ở context gốc: nhãn + hàm dọn dẹp. */
  effects: { label: string | undefined; dispose: unknown }[];
  /** Các seam đã xin qua `ctx.inject`. */
  injectDeps: string[][];
  /** Phím tắt cố định đã đăng ký. */
  shortcuts: Record<string, unknown>[];
  /** Giá trị mà hàm ưu tiên của "pending interaction" trả về. */
  priorityValues: number[];
  /** Các chỗ tương tác đang chờ đã đăng ký, kèm hook chuyển tiếp. */
  pendings: { pending: PendingApproval; onDelegate: () => Promise<void> | void }[];
  /** Slot đã xin chỗ. */
  injectedSlots: string[];
  /** Occupant đã đăng ký. */
  occupants: { definition: Record<string, unknown>; component: unknown }[];
  /** Listener Remote Event đã đăng ký. */
  events: {
    event: string;
    handler: (this: unknown, request: ApprovalPresentationRequest, next: () => unknown) => unknown;
  }[];
  /** Từ điển đã đăng ký. */
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
}

/**
 * Dấu vết rỗng cho một lần `apply`.
 * Nhận: không.
 * Trả: bản ghi chưa có gì.
 */
function emptyRecord(): CtxRecord {
  return {
    effects: [],
    injectDeps: [],
    shortcuts: [],
    priorityValues: [],
    pendings: [],
    injectedSlots: [],
    occupants: [],
    events: [],
    dictionaries: [],
  };
}

/**
 * Dựng context phía browser tối thiểu.
 * Nhận: bản ghi và phiên mà `sessions.scopeOf` trả về (undefined = listener không thuộc phiên nào).
 * Trả: context giả truyền cho `apply`.
 */
function makeContext(record: CtxRecord, sessionId: string | undefined) {
  return {
    effect(callback: () => void | (() => void), label?: string): void {
      record.effects.push({ label, dispose: callback() });
    },
    inject(deps: readonly string[], callback: (scope: ShortcutScope) => void): void {
      record.injectDeps.push([...deps]);
      callback({
        effect: (inner: () => void | (() => void), label?: string): void => {
          record.effects.push({ label, dispose: inner() });
        },
        shortcuts: {
          registerFixed: (definition: Record<string, unknown>): (() => void) => {
            record.shortcuts.push(definition);
            return () => undefined;
          },
        },
      });
    },
    sessions: {
      scopeOf: (): string | undefined => sessionId,
    },
    remote: {
      $on: (
        event: string,
        handler: (this: unknown, request: ApprovalPresentationRequest, next: () => unknown) => unknown,
      ): void => {
        record.events.push({ event, handler });
      },
    },
    uiSession: {
      registerPendingInteraction: (priority: () => number) => {
        record.priorityValues.push(priority());
        return (pending: PendingApproval, onDelegate: () => Promise<void> | void) => {
          record.pendings.push({ pending, onDelegate });
          return () => undefined;
        };
      },
    },
    slots: {
      register: (definition: Record<string, unknown>, component: unknown): (() => void) => {
        record.occupants.push({ definition, component });
        return () => undefined;
      },
      inject: (slot: string, register: () => unknown): void => {
        record.injectedSlots.push(slot);
        register();
      },
    },
    locale: {
      bind: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
        const text = (namespace === NS ? en[key as keyof typeof en] : undefined) ?? key;
        return params === undefined
          ? text
          : Object.entries(params).reduce((acc, [name, value]) => acc.split("{" + name + "}").join(String(value)), text);
      },
      register: (namespace: string, copy: Record<string, Record<string, string>>): (() => void) => {
        record.dictionaries.push({ namespace, copy });
        return () => undefined;
      },
      resolveText: (reason: { readonly en: string; readonly [locale: string]: string }): string =>
        reason.en + " (dich)",
    },
  };
}

/**
 * Vạt chất hoá bundle thật thành plugin, ghi lại các specifier đã require.
 * Nhận: không.
 * Trả: plugin cùng danh sách specifier.
 */
async function materialize(): Promise<{ plugin: ClientPlugin; required: string[] }> {
  const out = await buildOnce();
  const registration = loadBundle(await readFile(out.client, "utf8"))[0];
  expect(registration).toBeDefined();
  const required: string[] = [];
  const requireFn: RequireFn = (specifier) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    required.push(specifier);
    if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx };
    if (specifier === "react") return makeReact({ cleanups: [] });
    if (specifier .endsWith("-client-ui-primitives")) return makePrimitives();
    throw new Error("khong duoc require " + specifier);
  };
  return { plugin: registration?.factory(requireFn) as ClientPlugin, required };
}

describe("khuôn bundle — script classic, MOT id module, CSS nhúng", () => {
  test("lib/client.js không có cú pháp ESM và đăng ký đúng MOT id (id gốc ở gbh.row.aliases)", async () => {
    const out = await buildOnce();
    const code = await readFile(out.client, "utf8");
    expect(/^\s*(?:import|export)\s/m.test(code)).toBe(false);
    const calls = loadBundle(code);
    expect(calls.map((call) => call.id)).toEqual([PACKAGE_NAME]);   // LUAT 17/10/2026: MOT id
    expect(calls.length).toBe(1);
    const meta = (await Bun.file(join(import.meta.dir, "../../packages/client/ui-approval/package.json")).json()) as { gbh: { row: { aliases: string[] } } };
    expect(meta.gbh.row.aliases).toContain(STOCK_PACKAGE_NAME);
  });

  test("CSS của panel được nhúng từ chính file .module.css (không chép tay)", async () => {
    const out = await buildOnce();
    const code = await readFile(out.client, "utf8");
    const cssPath = join(import.meta.dir, "..", "..", "packages", "client", "ui-approval", "src", "ApprovalPanel.module.css");
    const css = await readFile(cssPath, "utf8");
    const rule =
      ".mna1RW_root{padding:8px calc(var(--dsh-composer-side-clearance) + 16px) 12px;flex-direction:column;align-items:center;display:flex}";
    expect(css).toContain(rule);
    // 20/10/2026 — brand token trong artefact đã đổi `--dsh-*` → `--gbh-*` (rename CÓ CHỦ ĐÍCH);
    // nguồn CSS vẫn là bản gốc ⇒ chuẩn hoá ĐỐI XỨNG hai vế rồi mới so khớp nguyên văn.
    expect(normalizeBrand(code)).toContain(normalizeBrand(rule));
    expect(code).toContain("--dsw-alias-state-warn-secondary");
  });

  test("script chỉ ĐĂNG KÝ: chưa require module nào cho tới lúc vạt chất hoá", async () => {
    const out = await buildOnce();
    const calls = loadBundle(await readFile(out.client, "utf8"));
    expect(calls.length).toBe(1);   // LUAT 17/10/2026: bundle chi tu khai MOT id
    for (const call of calls) expect(typeof call.factory).toBe("function");
  });
});

describe("mặt plugin — hình dạng mà Loader nhận", () => {
  test("require đúng ba specifier như bản gốc và khai đủ 5 seam theo đúng thứ tự", async () => {
    const { plugin, required } = await materialize();
    expect(required).toEqual(["react/jsx-runtime", "react", "@deepseek-ai/dsh-client-ui-primitives"]);
    expect(plugin.inject.join(" ")).toBe("sessions remote uiSession slots locale");
    expect(typeof plugin.apply).toBe("function");
  });
});

describe("apply — nối dây vào seam", () => {
  test("đăng ký từ điển, hai phím tắt cố định, chỗ tương tác đang chờ, panel và listener waterfall", async () => {
    const { plugin } = await materialize();
    const record = emptyRecord();
    plugin.apply(makeContext(record, "session-1"));

    // (1) từ điển: namespace `approval`, đủ 5 khoá ở cả hai thứ tiếng.
    expect(record.dictionaries.length).toBe(1);
    expect(record.dictionaries[0]?.namespace).toBe(NS);
    expect(Object.keys(record.dictionaries[0]?.copy.zh ?? {}).sort()).toEqual([...LOCALE_KEYS].sort());
    expect(record.dictionaries[0]?.copy.en?.waiting).toBe(en.waiting);
    expect(record.dictionaries[0]?.copy.zh?.allowOnce).toBe(zh.allowOnce);

    // (2) phím tắt: xin seam `shortcuts`, hai phím cố định đúng id/khoá/nhóm.
    expect(record.injectDeps).toEqual([["shortcuts"]]);
    expect(record.shortcuts.map((shortcut) => shortcut.id)).toEqual(["approval.allow", "approval.reject"]);
    const allow = record.shortcuts[0] ?? {};
    const reject = record.shortcuts[1] ?? {};
    expect(allow.keys).toEqual(["Enter"]);
    expect(allow.bindings).toEqual([{ code: "Enter", modifiers: [] }]);
    expect((allow.label as () => string)()).toBe(en.allowOnce);
    expect(reject.keys).toEqual(["Esc"]);
    expect(reject.bindings).toEqual([{ code: "Escape", modifiers: [] }]);
    expect((reject.label as () => string)()).toBe(en.reject);
    expect(allow.group).toBe("approval");

    // (3) chỗ tương tác đang chờ: ưu tiên 0.
    expect(record.priorityValues).toEqual([0]);

    // (4) slot composer: priority 1, locale `approval`, có slot con chi tiết.
    expect(record.injectedSlots).toEqual([COMPOSER_SLOT]);
    const definition = record.occupants[0]?.definition ?? {};
    expect(definition.name).toBe(COMPOSER_SLOT);
    expect(definition.priority).toBe(1);
    expect(definition.locale).toBe(NS);
    expect(definition.children).toEqual({ [DETAIL_SLOT]: { kind: "single", scope: "session" } });
    // Lấy thực thể pending TỪ CHÍNH plugin (cùng một bản sao lớp trong bundle) rồi thử selector:
    // tạo thực thể từ nguồn sẽ khác danh tính lớp và `instanceof` sẽ trượt một cách giả tạo.
    const running = record.events[0]?.handler.call({}, { toolName: "bash" }, () => "ke tiep");
    const pending = record.pendings[0]?.pending;
    const select = definition.select as (props: { pendingInteraction: unknown }) => unknown;
    expect(select({ pendingInteraction: pending })).toBe(pending);
    expect(select({ pendingInteraction: { kind: "question" } })).toBe(null);
    pending?.abort(new Error("ket thuc test"));
    await Promise.resolve(running).catch(() => undefined);

    // (5) listener waterfall đúng tên sự kiện; occupant là một component.
    expect(record.events.map((entry) => entry.event)).toEqual(["approval/request"]);
    expect(typeof record.occupants[0]?.component).toBe("function");

    // (6) nhãn hiệu ứng giữ nguyên như bản gốc.
    expect(record.effects.map((effect) => effect.label)).toEqual([
      "ui-approval: dictionaries",
      "ui-approval: fixed allow reference",
      "ui-approval: fixed reject reference",
    ]);
  });
});

describe("PendingApproval — contract của một yêu cầu đang chờ", () => {
  test("trả lời một lần: resolve kết quả, hết answerable, lần thứ hai ném lỗi rõ ràng", async () => {
    const pending = new PendingApproval("s1", { toolName: "bash", callId: "call-1", reason: "vi sao" });
    expect(pending.kind).toBe("approval");
    expect(pending.sessionId).toBe("s1");
    expect(pending.toolName).toBe("bash");
    expect(pending.callId).toBe("call-1");
    expect(pending.reason).toBe("vi sao");
    expect(pending.displayReason).toBeUndefined();
    expect(pending.answerable).toBe(true);
    await pending.answer("allowed-once");
    expect(await pending.result).toBe("allowed-once");
    expect(pending.answerable).toBe(false);
    // `answer()` gói bước kết thúc vào promise: lần thứ hai bị TỪ CHỐI, không ném đồng bộ.
    await expect(pending.answer("rejected")).rejects.toThrow(/is already settled/);
  });

  test("key tăng dần và khác nhau giữa các yêu cầu", () => {
    const first = new PendingApproval("s1", { toolName: "a" });
    const second = new PendingApproval("s1", { toolName: "b" });
    expect(first.key).toMatch(/^approval:\d+$/);
    expect(second.key).not.toBe(first.key);
  });

  test("chuyển tiếp: result từ chối bằng dấu hiệu nội bộ mà isDelegation nhận ra", async () => {
    const pending = new PendingApproval("s1", { toolName: "bash" });
    pending.delegate();
    const error = await pending.result.then(
      () => "khong nem",
      (reason: unknown) => reason,
    );
    expect(pending.isDelegation(error)).toBe(true);
    expect(pending.isDelegation(new Error("khac"))).toBe(false);
    expect(pending.answerable).toBe(false);
    expect(() => pending.delegate()).not.toThrow();
  });

  test("huỷ: result từ chối bằng đúng lý do và không nhận là chuyển tiếp", async () => {
    const pending = new PendingApproval("s1", { toolName: "bash" });
    const reason = new Error("transport chet");
    pending.abort(reason);
    const caught = await pending.result.then(
      () => "khong nem",
      (error: unknown) => error,
    );
    expect(caught).toBe(reason);
    expect(pending.isDelegation(caught)).toBe(false);
    expect(() => pending.abort(new Error("lan hai"))).not.toThrow();
  });

  test("tín hiệu đã huỷ TRƯỚC khi gắn listener thì kết thúc ngay", async () => {
    const controller = new AbortController();
    controller.abort(new Error("huy tu dau"));
    const pending = new PendingApproval("s1", { toolName: "bash", signal: controller.signal });
    const caught = await pending.result.then(
      () => "khong nem",
      (error: unknown) => error,
    );
    expect(String(caught)).toContain("huy tu dau");
    expect(pending.answerable).toBe(false);
  });

  test("tín hiệu huỷ SAU đó kết thúc yêu cầu; đã trả lời xong thì tín hiệu không còn tác dụng", async () => {
    const controller = new AbortController();
    const pending = new PendingApproval("s1", { toolName: "bash", signal: controller.signal });
    controller.abort(new Error("nguoi dung bo di"));
    const caught = await pending.result.then(
      () => "khong nem",
      (error: unknown) => error,
    );
    expect(String(caught)).toContain("nguoi dung bo di");

    const other = new AbortController();
    const settled = new PendingApproval("s1", { toolName: "bash", signal: other.signal });
    await settled.answer("rejected");
    other.abort(new Error("muon roi"));
    expect(await settled.result).toBe("rejected");
  });

  test("settlePendingComposer bọc lỗi không phải Error bằng câu mô tả", async () => {
    await expect(settlePendingComposer(() => undefined, "khong dung")).resolves.toBeUndefined();
    const failure = await settlePendingComposer(() => {
      throw "chuoi loi";
    }, "pending approval settlement failed").then(
      () => "khong nem",
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("pending approval settlement failed");
    await expect(
      settlePendingComposer(() => {
        throw new Error("giu nguyen");
      }, "khong dung"),
    ).rejects.toThrow("giu nguyen");
  });
});

describe("waterfall approval/request — nghe, trình bày, trả kết quả", () => {
  test("listener không thuộc phiên nào thì chuyển tiếp ngay, không đăng ký chỗ chờ", async () => {
    const { plugin } = await materialize();
    const record = emptyRecord();
    plugin.apply(makeContext(record, undefined));
    const listener = record.events[0]?.handler;
    const result = await listener?.call({}, { toolName: "bash" }, () => "ket qua ke tiep");
    expect(result).toBe("ket qua ke tiep");
    expect(record.pendings.length).toBe(0);
  });

  test("người dùng cho phép: kết quả về waterfall và hook chuyển tiếp được mở sau khi gỡ", async () => {
    const { plugin } = await materialize();
    const record = emptyRecord();
    plugin.apply(makeContext(record, "session-7"));
    const listener = record.events[0]?.handler;
    const running = listener?.call({}, { toolName: "bash", callId: "c1", reason: "vi sao" }, () => "ke tiep");
    expect(record.pendings.length).toBe(1);
    const hook = record.pendings[0];
    expect(hook?.pending.sessionId).toBe("session-7");
    expect(hook?.pending.toolName).toBe("bash");
    expect(hook?.pending.callId).toBe("c1");
    expect(typeof hook?.onDelegate).toBe("function");
    await hook?.pending.answer("allowed-once");
    await expect(Promise.resolve(running)).resolves.toBe("allowed-once");
    // Gỡ xong thì hook chuyển tiếp (đang chờ trong finally) phải được mở, không treo.
    await expect(Promise.resolve(hook?.onDelegate())).resolves.toBeUndefined();
  });

  test("yêu cầu bị chuyển tiếp: listener trả kết quả của listener kế tiếp", async () => {
    const { plugin } = await materialize();
    const record = emptyRecord();
    plugin.apply(makeContext(record, "session-7"));
    const listener = record.events[0]?.handler;
    const running = listener?.call({}, { toolName: "bash" }, () => "ke tiep");
    await record.pendings[0]?.onDelegate();
    await expect(Promise.resolve(running)).resolves.toBe("ke tiep");
  });

  test("yêu cầu bị huỷ: promise ném lại, không coi là chuyển tiếp", async () => {
    const { plugin } = await materialize();
    const record = emptyRecord();
    plugin.apply(makeContext(record, "session-7"));
    const listener = record.events[0]?.handler;
    const running = listener?.call({}, { toolName: "bash" }, () => "ke tiep");
    record.pendings[0]?.pending.abort(new Error("het vong doi"));
    const caught = await Promise.resolve(running).then(
      () => "khong nem",
      (error: unknown) => error,
    );
    expect(String(caught)).toContain("het vong doi");
  });

  test("yêu cầu đi qua nguyên vẹn: chỉ chuyển các trường có mặt", async () => {
    const { plugin } = await materialize();
    const record = emptyRecord();
    plugin.apply(makeContext(record, "session-7"));
    const running = record.events[0]?.handler.call({}, { toolName: "bash" }, () => "ke tiep");
    const pending = record.pendings[0]?.pending;
    expect(pending?.callId).toBeUndefined();
    expect(pending?.reason).toBeUndefined();
    expect(pending?.displayReason).toBeUndefined();
    expect(pending?.sessionId).toBe("session-7");
    pending?.abort(new Error("ket thuc test"));
    await Promise.resolve(running).catch(() => undefined);
  });
});

describe("panel — cây element, lý do và nút", () => {
  /** Panel đã dựng, kèm bản ghi React. */
  function panelFixture() {
    const reactRecord: { answered?: boolean; cleanups: (() => void)[] } = { cleanups: [] };
    const panel = createApprovalPanel(
      { jsx: fakeJsx, jsxs: fakeJsx, ...makeReact(reactRecord) },
      makePrimitives(),
    );
    return { panel, reactRecord };
  }

  /**
   * Gọi trọn hai tầng của panel: `ApprovalPanel` trả element của `ApprovalFlow`, tầng trong mới là thẻ div.
   * Nhận: component panel và props của renderer.
   * Trả: element thẻ ngoài (có `onKeyDown`) và element ngoài cùng (có khoá React).
   */
  function renderPanel(panel: (props: ApprovalComposerProps) => unknown, base: ApprovalComposerProps) {
    const outer = panel(base) as Element;
    const flow = outer.type as (props: Record<string, unknown>) => unknown;
    return { outer, node: flow(outer.props) as Element };
  }

  /** Props renderer bind cho panel, có ghi lại các lời gọi. */
  function props(pending: PendingApproval, overrides: Partial<ApprovalComposerProps> = {}) {
    const calls: { slot: string; owner: Record<string, unknown> }[] = [];
    const resolved: unknown[] = [];
    const base: ApprovalComposerProps = {
      matched: pending,
      renderSlot: (slot: string, owner: Record<string, unknown>) => {
        calls.push({ slot, owner });
        return { type: "Detail" };
      },
      resolveReason: (reason) => {
        resolved.push(reason);
        return reason.en + " (dich)";
      },
      t: (key: string, params?: Record<string, unknown>) => {
        const text = en[key as keyof typeof en];
        return params === undefined ? text : text.split("{toolName}").join(String(params.toolName));
      },
      ...overrides,
    };
    return { base, calls, resolved };
  }

  test("có callId: render slot chi tiết theo đúng owner và khoá React là key của yêu cầu", () => {
    const { panel } = panelFixture();
    const pending = new PendingApproval("s1", { toolName: "bash", callId: "call-9", reason: "ly do goc" });
    const { base, calls } = props(pending);
    const { outer, node: root } = renderPanel(panel, base);
    expect(outer.key).toBe(pending.key);
    expect(typeof outer.type).toBe("function");
    expect(root.type).toBe("div");
    expect(root.props.className).toBe(CLASS.root);
    expect(root.props["data-approval-key"]).toBe(pending.key);
    expect(root.props["aria-busy"]).toBe(false);
    expect(calls).toEqual([{ slot: DETAIL_SLOT, owner: { callId: "call-9" } }]);
  });

  test("không có callId: KHÔNG render slot chi tiết và lý do lấy từ trường reason", () => {
    const { panel } = panelFixture();
    const pending = new PendingApproval("s1", { toolName: "bash", reason: "ly do goc" });
    const { base, calls, resolved } = props(pending);
    const { node: root } = renderPanel(panel, base);
    const card = root.props.children as Element;
    const body = (card.props.children as Element[])[1] as Element;
    const headline = (body.props.children as Element[])[0] as Element;
    expect(calls).toEqual([]);
    expect(resolved).toEqual([]);
    expect(headline.props.children).toBe("ly do goc");
  });

  test("có displayReason: dịch qua resolveReason; không có lý do nào: dùng câu escalation kèm tên tool", () => {
    const { panel } = panelFixture();
    const withDisplay = new PendingApproval("s1", { toolName: "bash", displayReason: { en: "Can quyen" } });
    const first = props(withDisplay);
    const { node: root } = renderPanel(panel, first.base);
    const body = ((root.props.children as Element).props.children as Element[])[1] as Element;
    expect(((body.props.children as Element[])[0] as Element).props.children).toBe("Can quyen (dich)");
    expect(first.resolved).toEqual([{ en: "Can quyen" }]);

    const bare = new PendingApproval("s1", { toolName: "rm -rf" });
    const second = props(bare);
    const { node: bareRoot } = renderPanel(panel, second.base);
    const bareBody = ((bareRoot.props.children as Element).props.children as Element[])[1] as Element;
    expect(((bareBody.props.children as Element[])[0] as Element).props.children).toBe("Tool rm -rf requests privileged execution");
  });

  test("cấu trúc DOM: dải trạng thái, vùng cuộn có aria, hai nút đúng nhãn và biến thể", () => {
    const { panel } = panelFixture();
    const pending = new PendingApproval("s1", { toolName: "bash", callId: "c1" });
    const { base } = props(pending);
    const { node: root } = renderPanel(panel, base);
    const card = root.props.children as Element;
    expect(card.props.className).toBe(CLASS.card);
    const [strip, body, actions] = card.props.children as Element[];
    expect(strip?.props.className).toBe(CLASS.strip);
    // Con thứ hai của dải trạng thái là CHUỖI (phần tử thứ nhất là chấm trạng thái).
    const stripChildren = strip?.props.children as unknown[];
    expect(stripChildren[1]).toBe(en.waiting);
    expect(body?.props.className).toBe(CLASS.body);
    expect(body?.props["data-approval-scroll"]).toBe("");
    expect(body?.props.tabIndex).toBe(0);
    expect(body?.props.role).toBe("group");
    expect(body?.props["aria-label"]).toBe(en["detail.aria"]);
    const buttons = actions?.props.children as Element[];
    expect(buttons[0]?.props.variant).toBe("outline");
    expect(buttons[0]?.props.className).toBe(CLASS.reject);
    expect(buttons[0]?.props.children).toBe(en.reject);
    expect(buttons[1]?.props.variant).toBe("primary");
    expect(buttons[1]?.props.children).toBe(en.allowOnce);
    expect(buttons[0]?.props.disabled).toBe(false);
    const detail = (body?.props.children as Element[])[1];
    expect(detail?.props.className).toBe(CLASS.command);
  });

  test("bấm nút trả đúng quyết định và chuyển panel sang trạng thái đã trả lời", async () => {
    const { panel, reactRecord } = panelFixture();
    const pending = new PendingApproval("s1", { toolName: "bash", callId: "c1" });
    const { node: root } = renderPanel(panel, props(pending).base);
    const card = root.props.children as Element;
    const actions = (card.props.children as Element[])[2] as Element;
    (actions.props.children as Element[])[1]?.props.onClick;
    ((actions.props.children as Element[])[1]?.props.onClick as () => void)();
    expect(reactRecord.answered).toBe(true);
    expect(await pending.result).toBe("allowed-once");

    const other = new PendingApproval("s1", { toolName: "bash" });
    const { node: secondRoot } = renderPanel(panel, props(other).base);
    const secondCard = secondRoot.props.children as Element;
    const secondActions = (secondCard.props.children as Element[])[2] as Element;
    ((secondActions.props.children as Element[])[0]?.props.onClick as () => void)();
    expect(await other.result).toBe("rejected");
  });
});

describe("panel — bàn phím Enter/Escape và các cờ IME", () => {
  // Bộ xử lý phím đọc `document.activeElement` để biết tiêu điểm còn trong panel không.
  const previousDocument = (globalThis as { document?: unknown }).document;
  beforeEach(() => {
    (globalThis as { document?: unknown }).document = makeDocument().doc;
  });
  afterEach(() => {
    (globalThis as { document?: unknown }).document = previousDocument;
  });

  /** Sự kiện bàn phím giả, đủ trường mà panel đọc. */
  function makeEvent(overrides: Record<string, unknown> = {}) {
    const calls = { preventDefault: 0, stopPropagation: 0 };
    const event = {
      target: { closest: (): unknown => null },
      currentTarget: { contains: (): boolean => true },
      nativeEvent: { isComposing: false },
      key: "Enter",
      keyCode: 13,
      repeat: false,
      defaultPrevented: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: () => {
        calls.preventDefault += 1;
      },
      stopPropagation: () => {
        calls.stopPropagation += 1;
      },
      ...overrides,
    };
    return { event, calls };
  }

  /** Panel cùng hàm onKeyDown của thẻ ngoài (đi qua CẢ hai tầng: panel rồi flow). */
  function keyboardFixture() {
    const panel = createApprovalPanel({ jsx: fakeJsx, jsxs: fakeJsx, ...makeReact({ cleanups: [] }) }, makePrimitives());
    const pending = new PendingApproval("s1", { toolName: "bash" });
    const outer = panel({
      matched: pending,
      renderSlot: () => null,
      resolveReason: (reason) => reason.en,
      t: (key: string) => en[key as keyof typeof en],
    }) as Element;
    const root = (outer.type as (props: Record<string, unknown>) => unknown)(outer.props) as Element;
    return { pending, onKeyDown: root.props.onKeyDown as (event: unknown) => void, root };
  }

  test("Enter cho phép một lần, Escape từ chối, và sự kiện bị chặn", async () => {
    const first = keyboardFixture();
    const enter = makeEvent();
    first.onKeyDown(enter.event);
    expect(enter.calls.preventDefault).toBe(1);
    expect(enter.calls.stopPropagation).toBe(1);
    expect(await first.pending.result).toBe("allowed-once");

    const second = keyboardFixture();
    second.onKeyDown(makeEvent({ key: "Escape", keyCode: 27 }).event);
    expect(await second.pending.result).toBe("rejected");
  });

  test("các trường hợp KHÔNG được coi là quyết định", async () => {
    const cases: { name: string; patch: Record<string, unknown> }[] = [
      {
        name: "tiêu điểm nằm trong ô nhập",
        patch: { target: { closest: (selector: string) => (selector.startsWith("input") ? {} : null) } },
      },
      { name: "tiêu điểm ngoài panel", patch: { currentTarget: { contains: () => false } } },
      { name: "phím khác", patch: { key: "a" } },
      {
        name: "Enter khi tiêu điểm ở nút",
        patch: { target: { closest: (selector: string) => (selector.startsWith("input") ? null : {}) } },
      },
      { name: "có phím điều hợp", patch: { ctrlKey: true } },
      { name: "sự kiện đã bị chặn", patch: { defaultPrevented: true } },
      { name: "giữ phím", patch: { repeat: true } },
      { name: "đang gõ IME", patch: { nativeEvent: { isComposing: true } } },
      { name: "mã 229 của IME", patch: { keyCode: 229 } },
    ];
    for (const item of cases) {
      const fixture = keyboardFixture();
      fixture.onKeyDown(makeEvent(item.patch).event);
      expect(fixture.pending.answerable).toBe(true);
      fixture.pending.abort(new Error("ket thuc test: " + item.name));
      await fixture.pending.result.catch(() => undefined);
    }
  });

  test("composition vừa kết thúc thì chưa tính là quyết định, tới khi có keyup", async () => {
    const fixture = keyboardFixture();
    (fixture.root.props.onCompositionStartCapture as () => void)();
    fixture.onKeyDown(makeEvent().event);
    expect(fixture.pending.answerable).toBe(true);
    (fixture.root.props.onCompositionEndCapture as () => void)();
    fixture.onKeyDown(makeEvent().event);
    expect(fixture.pending.answerable).toBe(true);
    (fixture.root.props.onKeyUpCapture as () => void)();
    fixture.onKeyDown(makeEvent().event);
    expect(await fixture.pending.result).toBe("allowed-once");
  });
});

describe("CSS và nửa host", () => {
  test("chèn style đúng một lần, có nhãn để HMR gỡ được", () => {
    const { doc, created } = makeDocument();
    const previous = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = doc;
    try {
      injectPanelStyles();
      injectPanelStyles();
      expect(created.length).toBe(1);
      const tag = created[0];
      expect(tag?.dataset.plugin).toBe(PACKAGE_NAME);
      expect(tag?.dataset.pluginCss).toBe(PACKAGE_NAME + "/ApprovalPanel.module.css");
      // Chạy từ nguồn (không qua build) thì CSS do biến toàn cục cấp; rỗng cũng không được ném.
      expect(typeof tag?.textContent).toBe("string");
    } finally {
      (globalThis as { document?: unknown }).document = previous;
    }
  });

  test("lib/index.js là ESM, chỉ xuất apply và không import gói ngoài", async () => {
    const out = await buildOnce();
    const code = await readFile(out.host, "utf8");
    const specifiers = [...code.matchAll(/from\s+"([^"\s]+)"/g)].map((match) => match[1] ?? "");
    for (const specifier of specifiers) {
      expect(specifier.startsWith("node:") || specifier === "@deepseek-ai/cordis" || specifier.startsWith("./")).toBe(true);
    }
    const module = (await import(out.host)) as { apply: () => void };
    expect(module.apply()).toBeUndefined();
  });
});

// === Ca canh su co 17/10 (bundle hai id => factory/apply chay hai lan) — them boi tm-parity ===
// Co chan nam o PHAM VI MODULE nen moi ca phai nap MODULE TUOI (query rieng), neu khong ca sau se
// "pass gia" hoac fail vi dinh co cua ca truoc.

test("CANH 17/10 (1): goi apply hai lan => lan hai la NO-OP (so hieu ung khong tang)", async () => {
  const spec: string = "../../packages/client/ui-approval/src/plugin.ts?guard1";
  const fresh = (await import(spec)) as typeof import("../../packages/client/ui-approval/src/plugin.ts");
  const effects: (() => void)[] = [];
  const ctx = {
    effect: (callback: () => () => void) => {
      effects.push(callback());
    },
    locale: { register: () => undefined, bind: () => () => "", resolveText: () => "" },
    inject: (_names: string[], callback: (scope: unknown) => void) => callback({ effect: () => undefined, shortcuts: { registerFixed: () => undefined } }),
    uiSession: { registerPendingInteraction: () => () => undefined },
    slots: { inject: () => undefined, register: () => undefined },
    remote: { $on: () => undefined },
  } as never;
  const plugin = fresh.createPlugin(((id: string) => {
    if (id === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
    if (id === "react") return { useMemo: (fn: () => unknown) => fn(), useSyncExternalStore: () => null };
    return {};
  }) as never);
  plugin.apply(ctx);
  const afterFirst = effects.length;
  expect(afterFirst).toBeGreaterThan(0);
  plugin.apply(ctx);
  expect(effects.length).toBe(afterFirst);
  // Stub: mot so hieu ung tra ve undefined (callback khong tra ham go) nen phai kiem kieu truoc khi go.
  for (const dispose of effects) if (typeof dispose === "function") dispose();
});

test("CANH 17/10 (2): apply nem loi => CO dung 1 dong console.error VA loi van duoc nem tiep", async () => {
  const spec: string = "../../packages/client/ui-approval/src/plugin.ts?guard2";
  const fresh = (await import(spec)) as typeof import("../../packages/client/ui-approval/src/plugin.ts");
  const logged: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args[0]);
  };
  const boom = new Error("service da duoc dang ky");
  const ctx = {
    effect: () => {
      throw boom;
    },
    locale: { register: () => undefined, bind: () => () => "", resolveText: () => "" },
    inject: () => undefined,
    uiSession: { registerPendingInteraction: () => () => undefined },
    slots: { inject: () => undefined, register: () => undefined },
    remote: { $on: () => undefined },
  } as never;
  const plugin = fresh.createPlugin(((id: string) => {
    if (id === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
    if (id === "react") return { useMemo: (fn: () => unknown) => fn(), useSyncExternalStore: () => null };
    return {};
  }) as never);
  let thrown: unknown = null;
  try {
    plugin.apply(ctx);
  } catch (error) {
    thrown = error;
  } finally {
    console.error = originalError;
  }
  expect(thrown).toBe(boom);
  expect(logged.length).toBe(1);
  expect(String(logged[0] ?? "")).toContain("apply nem loi");
});

test("CANH 17/10 (3): factory goi lan hai => VAN tra plugin THAT (hai entry la hai ctx)", async () => {
  const spec: string = "../../packages/client/ui-approval/src/plugin.ts?guard3";
  const fresh = (await import(spec)) as typeof import("../../packages/client/ui-approval/src/plugin.ts");
  const requireFn = ((id: string) => {
    if (id === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
    if (id === "react") return { useMemo: (fn: () => unknown) => fn(), useSyncExternalStore: () => null };
    return {};
  }) as never;
  const first = fresh.createPlugin(requireFn);
  const second = fresh.createPlugin(requireFn);
  // Hai entry (id ta + id alias) là hai FIBER ⇒ hai ctx KHÁC nhau, cả hai đều hợp lệ ⇒ factory KHÔNG được
  // trả plugin rỗng, nếu không entry thứ hai không bao giờ activate (đúng triệu chứng nhiều entry treo).
  expect(first.inject.length).toBeGreaterThan(0);
  expect(second.inject.length).toBe(first.inject.length);
  // Chặn thật nằm ở apply (cùng ctx ⇒ NO-OP) — hành vi đó đã có ca (1) khẳng định.
});
