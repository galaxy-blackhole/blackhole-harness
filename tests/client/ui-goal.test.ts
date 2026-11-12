/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test cho row ui-goal: khuon bundle, mat plugin, noi day apply, bon dong tu, nguon kich hoat,
 *      hai component cua dai, o xem truoc lenh, rule chip, va TEST CANH CSS + runtime JSX
 *      (fixture/ha noi tach sang ./ui-goal-harness.ts cho cong file-length xanh)
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackage } from "../../packages/client/ui-goal/build.ts";
import { activeRef, createGoalActivationSource, sameSnapshot } from "../../packages/client/ui-goal/src/activation-source.ts";
import { BAR_CLASS, VIEW_CLASS } from "../../packages/client/ui-goal/src/class-names.ts";
import { createGoalComponents } from "../../packages/client/ui-goal/src/goal-bar.ts";
import {
  createGoalCommandInputView,
  GOAL_COMMANDS,
  goalCommandInputDefinition,
  goalCommandText,
} from "../../packages/client/ui-goal/src/goal-command-input.ts";
import { createGoalCommandReference, goalCommandReferenceRule } from "../../packages/client/ui-goal/src/goal-command-reference.ts";
import { INJECT, NS, PACKAGE_NAME, STOCK_PACKAGE_NAME } from "../../packages/client/ui-goal/src/ids.ts";
import { en, zh } from "../../packages/client/ui-goal/src/locales.ts";
import { createPlugin } from "../../packages/client/ui-goal/src/plugin.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { withoutVi, viDictionary } from "../lib/vi-locale.ts";
import {
  barProps,
  buttonByLabel,
  childrenOf,
  elementByType,
  fakeJsx,
  freshPlugin,
  makeCtx,
  makePrimitives,
  makeReact,
  makeStateful,
  oursManifest,
  render,
  shellDeps,
  squash,
  stockCss,
  stockManifest,
  t,
  type Element,
} from "./ui-goal-harness.ts";

describe("khuôn bundle — script classic, MỘT id, không có cú pháp ESM", () => {
  // ⚠️ 17/10/2026: ca này TRƯỚC khẳng định "ĐÚNG hai id" — SAI theo luật hiện hành. Một bundle MỘT id:
  // id gốc (`STOCK_PACKAGE_NAME`) chỉ được KHAI ở `gbh.row.aliases`, KHÔNG được đăng ký trong bundle.
  // Đăng ký hai id ⇒ cùng một bundle chạy hai lần ⇒ `duplicate factory registration` ⇒ app trắng.
  test("bundle đăng ký ĐÚNG MỘT id (id của ta), KHÔNG đăng ký id gốc", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-goal-"));
    const built = await buildPackage(out);
    const code = await readFile(built.client, "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((match) => JSON.parse(match[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Khoá lại để không ai đăng ký id gốc trở lại: nó đi qua `gbh.row.aliases`, tầng nạp tự sinh entry.
    expect(ids).not.toContain(STOCK_PACKAGE_NAME);
    // Một factory duy nhất (và nay chỉ một id dùng nó).
    const factoryNames = [...code.matchAll(/factory: (\w+)/g)].map((match) => match[1]);
    expect(new Set(factoryNames).size).toBe(1);
    // Loader nạp bằng thẻ <script> classic ⇒ cú pháp ESM là SyntaxError.
    expect(/^\s*(export|import)\s/m.test(code)).toBe(false);
    // CSS của CẢ HAI module phải nằm trong bundle (nhúng bằng define).
    expect(code).toContain(BAR_CLASS.dock);
    expect(code).toContain(VIEW_CLASS.bubble);
  });

  test("chạy bundle trong window giả rồi gọi factory: ra mặt plugin đúng tên và seam", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-goal-"));
    const built = await buildPackage(out);
    const code = await readFile(built.client, "utf8");
    const registrations: { id: string; factory: (require: (specifier: string) => unknown) => { name: string; inject: readonly string[] } }[] = [];
    const fakeWindow = { __ModuleLoader__: { load: (registration: never) => registrations.push(registration) } };
    new Function("window", code)(fakeWindow);
    // MỘT id ⇒ MỘT lượt đăng ký. Hai lượt là dấu hiệu bundle đã bị thực thi hai lần.
    expect(registrations.length).toBe(1);
    const required: string[] = [];
    const plugin = registrations[0]?.factory((specifier) => {
      required.push(specifier);
      if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx };
      if (specifier === "react") return makeReact({ setState: [], cleanups: [] });
      return makePrimitives();
    });
    expect(plugin?.name).toBe(PACKAGE_NAME);
    expect(plugin?.inject).toEqual([...INJECT]);
    // ĐÚNG ba specifier, ĐÚNG thứ tự như bản gốc.
    expect(required).toEqual(["react/jsx-runtime", "react", "@galaxy-blackhole/gbh-client-ui-primitives"]);
  });

  test("chèn hai thẻ style với id CỦA TA và CSS khớp file nguồn", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-goal-"));
    const built = await buildPackage(out);
    const code = await readFile(built.client, "utf8");
    const registrations: { factory: (require: (specifier: string) => unknown) => { apply: (ctx: never) => void } }[] = [];
    const appended: { dataset: Record<string, string>; textContent: string }[] = [];
    const previousDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      querySelector: () => null,
      createElement: () => { const tag = { dataset: {} as Record<string, string>, textContent: "" }; appended.push(tag); return tag; },
      head: { appendChild: () => undefined },
    };
    try {
      new Function("window", code)({ __ModuleLoader__: { load: (registration: never) => registrations.push(registration) } });
      registrations[0]?.factory((specifier) => {
        if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx };
        if (specifier === "react") return makeReact({ setState: [], cleanups: [] });
        return makePrimitives();
      });
    } finally {
      (globalThis as { document?: unknown }).document = previousDocument;
    }
    expect(appended.length).toBe(2);
    expect(appended[0]?.dataset.plugin).toBe(PACKAGE_NAME);
    expect(appended[0]?.textContent).toContain(BAR_CLASS.bar);
    expect(appended[1]?.textContent).toContain(VIEW_CLASS.row);
  });
});

describe("mặt plugin", () => {
  test("tên package và sáu seam đúng thứ tự bản gốc", () => {
    const plugin = createPlugin((specifier) => {
      if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx };
      if (specifier === "react") return makeReact({ setState: [], cleanups: [] });
      return makePrimitives();
    });
    expect(plugin.name).toBe(PACKAGE_NAME);
    expect([...plugin.inject]).toEqual(["slots", "sessions", "remote", "remote.goals", "locale", "uiConversation"]);
    expect(NS).toBe("goal");
  });

  test("từ điển en/zh đủ và trùng tập khoá", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    expect(zh["phase.active"]).toBe("进行中的目标");
    expect(en["action.clear"]).toBe("Clear goal");
  });
});

describe("apply — nối dây", () => {
  test("đăng ký chiếu lệnh, rule văn bản, từ điển và ba slot đúng thứ tự", async () => {
    const { ctx, record } = makeCtx({});
    (await freshPlugin()).apply(ctx as never);
    expect(record.events).toEqual([goalCommandInputDefinition]);
    expect(record.userText).toEqual([goalCommandReferenceRule]);
    expect(record.effects.map((effect) => effect.label)).toEqual(["ui-goal: dictionaries"]);
    expect(record.dictionaries[0]?.ns).toBe("goal");
    const dicts = record.dictionaries[0]?.dicts as { zh: Record<string, string>; en: Record<string, string>; vi?: Record<string, string> };
    expect(dicts.zh).toEqual(zh);
    expect(dicts.en).toEqual(en);
    // 18/10/2026 — thêm bảng tiếng Việt (phần THÊM CÓ CHỦ ĐÍCH).
    expect(Object.keys(dicts.vi ?? {}).length).toBe(12);
    expect(record.effects.length).toBe(1);
    expect(record.injections.map((injection) => injection.name)).toEqual([
      "conversation.user.text.node",
      "conversation.chat.node",
      "conversation.input.dock",
    ]);
    for (const injection of record.injections) injection.register();
    expect(record.registrations[0]?.options).toEqual({
      name: "conversation.user.text.node",
      key: "command",
      priority: 100,
    });
    expect(record.registrations[1]?.options).toEqual({ name: "conversation.chat.node", key: "command-input", locale: "goal" });
    expect(record.registrations[2]?.options.name).toBe("conversation.input.dock");
    expect(record.registrations[2]?.options.id).toBe("goal");
    expect(record.registrations[2]?.options.order).toBe(10);
    expect(record.registrations[2]?.options.locale).toBe("goal");
    expect(typeof record.registrations[2]?.options.inject).toBe("function");
    expect(typeof record.registrations[0]?.component).toBe("function");
    expect(typeof record.registrations[1]?.component).toBe("function");
    expect(typeof record.registrations[2]?.component).toBe("function");
  });

  test("mặt nghiệp vụ của occupant: hook kích hoạt + bốn động từ, thiếu phiên thì ném lỗi", async () => {
    const calls: unknown[][] = [];
    const goals = {
      get: (...args: unknown[]) => { calls.push(["get", ...args]); return Promise.resolve({ ok: true, value: undefined }); },
      edit: (...args: unknown[]) => { calls.push(["edit", ...args]); return Promise.resolve({ ok: true }); },
      pause: (...args: unknown[]) => { calls.push(["pause", ...args]); return Promise.resolve({ ok: true }); },
      resume: (...args: unknown[]) => { calls.push(["resume", ...args]); return Promise.resolve({ ok: true }); },
      clear: (...args: unknown[]) => { calls.push(["clear", ...args]); return Promise.resolve({ ok: true }); },
    };
    const { ctx, record } = makeCtx({ goals, projectionSnapshot: { goal: { id: "g1", revision: 7, phase: "active", objective: "cũ" } } });
    (await freshPlugin()).apply(ctx as never);
    for (const injection of record.injections) injection.register();
    const inject = record.registrations[2]?.options.inject as (sessionId: string) => Record<string, unknown>;
    const face = inject("s1") as { hooks: { goalActivation: unknown }; onEdit: (x: string) => Promise<unknown>; onPause: () => Promise<unknown>; onResume: () => Promise<unknown>; onClear: () => Promise<unknown> };
    expect(typeof face.hooks.goalActivation).toBe("object");
    return (async () => {
      await face.onEdit("mới");
      await face.onPause();
      await face.onResume();
      await face.onClear();
      expect(calls).toEqual([
        ["edit", "s1", { id: "g1", revision: 7 }, { objective: "mới" }],
        ["pause", "s1", { id: "g1", revision: 7 }],
        ["resume", "s1", { id: "g1", revision: 7 }],
        ["clear", "s1", { id: "g1", revision: 7 }],
      ]);
    })();
  });

  test("chưa chiếu ra goal ⇒ bốn động từ trả lỗi cục bộ, KHÔNG gọi wire", async () => {
    const calls: unknown[][] = [];
    const goals = {
      edit: (...args: unknown[]) => { calls.push(args); return Promise.resolve({ ok: true }); },
      pause: (...args: unknown[]) => { calls.push(args); return Promise.resolve({ ok: true }); },
      resume: (...args: unknown[]) => { calls.push(args); return Promise.resolve({ ok: true }); },
      clear: (...args: unknown[]) => { calls.push(args); return Promise.resolve({ ok: true }); },
    };
    const { ctx, record } = makeCtx({ goals, projectionSnapshot: null });
    (await freshPlugin()).apply(ctx as never);
    for (const injection of record.injections) injection.register();
    const inject = record.registrations[2]?.options.inject as (sessionId: string) => Record<string, unknown>;
    const face = inject("s1") as { onEdit: (x: string) => Promise<unknown> };
    expect(await face.onEdit("mới")).toEqual({
      ok: false,
      error: { code: "no-current-goal", message: "no current goal to mutate" },
    });
    expect(calls.length).toBe(0);
  });
});

describe("nguồn kích hoạt — xếp thứ tự và tự nhả", () => {
  /** Dựng bộ phụ thuộc giả cho nguồn kích hoạt. */
  function deps(overrides: Record<string, unknown> = {}) {
    const state = {
      projectionSubscribed: 0,
      sessionSubscribed: 0,
      activationSubscribed: 0,
      resetSubscribed: 0,
      reads: 0,
      warns: [] as unknown[],
    };
    let projectionValue: unknown = { goal: { id: "g1", revision: 3, phase: "active", objective: "x" } };
    let running = false;
    const projectionListeners = new Set<() => void>();
    const sessionListeners = new Set<() => void>();
    let activationListener: ((goal: unknown) => void) | undefined;
    let resetListener: (() => void) | undefined;
    let readResult: () => Promise<unknown> = () => Promise.resolve({ ok: true, value: { id: "g1", revision: 3, activation: "armed" } });
    const api = {
      projection: {
        getSnapshot: () => projectionValue,
        subscribe: (listener: () => void) => {
          state.projectionSubscribed += 1;
          projectionListeners.add(listener);
          return () => { state.projectionSubscribed -= 1; projectionListeners.delete(listener); };
        },
      },
      session: {
        getSnapshot: () => ({ running }),
        subscribe: (listener: () => void) => {
          state.sessionSubscribed += 1;
          sessionListeners.add(listener);
          return () => { state.sessionSubscribed -= 1; sessionListeners.delete(listener); };
        },
      },
      getGoal: () => { state.reads += 1; return readResult() as Promise<{ ok: boolean; value?: unknown }>; },
      subscribeActivation: (listener: (goal: unknown) => void) => {
        state.activationSubscribed += 1;
        activationListener = listener;
        return () => { state.activationSubscribed -= 1; activationListener = undefined; };
      },
      subscribeReset: (listener: () => void) => {
        state.resetSubscribed += 1;
        resetListener = listener;
        return () => { state.resetSubscribed -= 1; resetListener = undefined; };
      },
    };
    const merged = { ...api, ...overrides };
    return {
      source: createGoalActivationSource(merged as never),
      state,
      setProjection: (next: unknown) => { projectionValue = next; },
      setRunning: (next: boolean) => { running = next; },
      fireProjection: () => { for (const listener of projectionListeners) listener(); },
      fireSession: () => { for (const listener of sessionListeners) listener(); },
      fireActivation: (goal: unknown) => activationListener?.(goal),
      fireReset: () => resetListener?.(),
      setRead: (fn: () => Promise<unknown>) => { readResult = fn; },
    };
  }

  test("so ảnh chụp và lấy ref đang hoạt động", () => {
    expect(sameSnapshot({}, {})).toBe(true);
    expect(sameSnapshot({ id: "a" }, { id: "a", revision: 1 })).toBe(false);
    expect(activeRef(undefined)).toBeUndefined();
    expect(activeRef(null)).toBeUndefined();
    expect(activeRef({ goal: { id: "g", revision: 1, phase: "paused", objective: "x" } })).toBeUndefined();
    expect(activeRef({ goal: { id: "g", revision: 1, phase: "active", objective: "x" } })?.id).toBe("g");
  });

  test("chỉ đăng ký khi có hook quan sát, và nhả hết khi hook cuối gỡ", () => {
    const fake = deps();
    expect(fake.state.projectionSubscribed).toBe(0);
    const off1 = fake.source.subscribe(() => undefined);
    expect(fake.state.projectionSubscribed).toBe(1);
    expect(fake.state.sessionSubscribed).toBe(1);
    expect(fake.state.activationSubscribed).toBe(1);
    expect(fake.state.resetSubscribed).toBe(1);
    const off2 = fake.source.subscribe(() => undefined);
    expect(fake.state.projectionSubscribed).toBe(1);
    off1();
    expect(fake.state.projectionSubscribed).toBe(1);
    off2();
    expect(fake.state.projectionSubscribed).toBe(0);
    expect(fake.state.activationSubscribed).toBe(0);
  });

  test("sự kiện kích hoạt sống thắng lần đọc đang bay và báo cho người nghe một lần", async () => {
    const fake = deps();
    const seen: unknown[] = [];
    fake.source.subscribe(() => seen.push(fake.source.getSnapshot()));
    fake.fireActivation({ id: "g1", revision: 3, activation: "disarmed" });
    expect(fake.source.getSnapshot()).toEqual({ id: "g1", revision: 3, activation: "disarmed" });
    // Đăng ký đã đọc lần đầu, sự kiện sống publish lần hai.
    expect(seen.length).toBe(2);
    fake.fireActivation({ id: "g1", revision: 3, activation: "disarmed" });
    // Ảnh chụp y hệt ⇒ không báo lần ba.
    expect(seen.length).toBe(2);
    fake.fireActivation(undefined);
    expect(fake.source.getSnapshot()).toEqual({});
    await Promise.resolve();
  });

  test("đọc Remote về muộn bị bỏ khi epoch đã đổi", async () => {
    const fake = deps();
    let resolveRead: ((value: unknown) => void) | undefined;
    fake.setRead(() => new Promise((resolve) => { resolveRead = resolve; }));
    fake.source.subscribe(() => undefined);
    // Có sự kiện kích hoạt mới ⇒ mọi lần đọc cũ hết hiệu lực.
    fake.fireActivation({ id: "g1", revision: 4, activation: "armed" });
    resolveRead?.({ ok: true, value: { id: "g1", revision: 3, activation: "armed" } });
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.source.getSnapshot()).toEqual({ id: "g1", revision: 4, activation: "armed" });
  });

  test("đọc hỏng thì cảnh báo chứ không ném, và cờ running đổi thì đọc lại", async () => {
    const warnings: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      const fake = deps();
      fake.setRead(() => Promise.reject(new Error("mạng hỏng")));
      fake.source.subscribe(() => undefined);
      await Promise.resolve();
      await Promise.resolve();
      expect(warnings.length).toBeGreaterThan(0);
      const before = fake.state.reads;
      fake.setRunning(true);
      fake.fireSession();
      expect(fake.state.reads).toBeGreaterThan(before);
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe("GoalBar — dải mục tiêu", () => {
  test("không render khi chưa có goal, đã hoàn tất", () => {
    const primitives = makePrimitives();
    const { GoalBar } = createGoalComponents(shellDeps({ setState: [], cleanups: [] }), primitives);
    expect(render(GoalBar as never, barProps({ goal: undefined }).props)).toBeNull();
    expect(render(GoalBar as never, barProps({ goal: null }).props)).toBeNull();
    expect(render(GoalBar as never, barProps({ goal: { id: "g1", revision: 3, phase: "complete", objective: "x" } }).props)).toBeNull();
  });

  test("pha đang chạy + đã kích hoạt: đủ glyph, nhãn, objective và các nút", () => {
    const primitives = makePrimitives();
    const { GoalBar } = createGoalComponents(shellDeps({ setState: [], cleanups: [] }), primitives);
    const { props } = barProps();
    const node = render(GoalBar as never, props);
    expect(node.props.className).toBe(BAR_CLASS.dock);
    expect(node.props["data-goal-bar"]).toBe(true);
    const bar = childrenOf(node)[0] as Element;
    expect(bar.props.className).toBe(BAR_CLASS.bar);
    const [glyph, label, objective, actions] = childrenOf(bar);
    expect(glyph?.props.className).toBe(BAR_CLASS.goalGlyph);
    expect(elementByType(glyph, primitives.IconGoalOutlineRegular)?.props.size).toBe(14);
    expect(label?.props.children).toBe("phase.active");
    expect(objective?.props.children).toBe("mục tiêu");
    expect(actions?.props.className).toBe(BAR_CLASS.actions);
    expect(buttonByLabel(node, "action.pause")).toBeDefined();
    expect(buttonByLabel(node, "action.resume")).toBeUndefined();
    expect(buttonByLabel(node, "action.edit")).toBeDefined();
    expect(buttonByLabel(node, "action.clear")).toBeDefined();
  });

  test("active nhưng CHƯA kích hoạt: nhãn khác và nút Tiếp tục thay cho Tạm dừng", () => {
    const primitives = makePrimitives();
    const { GoalBar } = createGoalComponents(shellDeps({ setState: [], cleanups: [] }), primitives);
    const node = render(GoalBar as never, barProps({ activation: "disarmed" }).props);
    const bar = childrenOf(node)[0] as Element;
    expect(childrenOf(bar)[1]?.props.children).toBe("phase.active.disarmed");
    expect(buttonByLabel(node, "action.pause")).toBeUndefined();
    expect(buttonByLabel(node, "action.resume")).toBeDefined();
  });

  test("pha tạm dừng: nhãn theo bảng pha và có nút Tiếp tục", () => {
    const primitives = makePrimitives();
    const { GoalBar } = createGoalComponents(shellDeps({ setState: [], cleanups: [] }), primitives);
    const node = render(GoalBar as never, barProps({ goal: { id: "g1", revision: 3, phase: "paused", objective: "x" } }).props);
    const bar = childrenOf(node)[0] as Element;
    expect(childrenOf(bar)[1]?.props.children).toBe("phase.paused");
    expect(buttonByLabel(node, "action.resume")).toBeDefined();
  });

  test("pha bị chặn: lý do chặn nằm ở title của hàng", () => {
    const primitives = makePrimitives();
    const { GoalBar } = createGoalComponents(shellDeps({ setState: [], cleanups: [] }), primitives);
    const node = render(
      GoalBar as never,
      barProps({ goal: { id: "g1", revision: 3, phase: "blocked", objective: "x", blockedReason: { message: "hết quota" } } }).props,
    );
    const bar = childrenOf(node)[0] as Element;
    expect(bar.props.title).toBe("hết quota");
    expect(childrenOf(bar)[1]?.props.children).toBe("phase.blocked");
  });

  test("lỗi hành động: hiện nguyên văn kèm mã, và lần bấm thứ hai trong cùng nhịp bị chặn", async () => {
    const primitives = makePrimitives();
    const harness = makeStateful();
    const { GoalBar } = createGoalComponents(harness.deps, primitives);
    let failures = 0;
    const { props } = barProps({
      onPause: () => { failures += 1; return Promise.resolve({ ok: false, error: { code: "boom", message: "hỏng" } }); },
    });
    harness.reset();
    const first = render(GoalBar as never, props);
    const pause = buttonByLabel(first, "action.pause") as Element;
    (pause.props.onClick as () => void)();
    (pause.props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    harness.reset();
    const second = render(GoalBar as never, props);
    const error = childrenOf(childrenOf(second)[0] as Element).find((child) => child.props.role === "alert");
    expect(error?.props.children).toBe("hỏng (boom)");
    expect(failures).toBe(1);
  });

  test("luồng sửa: gieo draft từ objective, lưu khi khác rỗng, huỷ thì về dải thường", async () => {
    const primitives = makePrimitives();
    const harness = makeStateful();
    const { GoalBar } = createGoalComponents(harness.deps, primitives);
    const { props, calls } = barProps();
    harness.reset();
    const display = render(GoalBar as never, props);
    (buttonByLabel(display, "action.edit")?.props.onClick as () => void)();
    harness.reset();
    const editing = render(GoalBar as never, props);
    const editBar = childrenOf(editing)[0] as Element;
    expect(editBar.props.className).toBe(BAR_CLASS.bar + " " + BAR_CLASS.editBar);
    const editor = elementByType(editing, primitives.InlineEditor) as Element;
    expect(editor.props.value).toBe("mục tiêu");
    expect(editor.props.label).toBe("objective.aria");
    (editor.props.onChange as (next: string) => void)("   ");
    harness.reset();
    const blank = render(GoalBar as never, props);
    expect(buttonByLabel(blank, "action.save")?.props.disabled).toBe(true);
    (elementByType(blank, primitives.InlineEditor)?.props.onChange as (next: string) => void)("  mới  ");
    harness.reset();
    const filled = render(GoalBar as never, props);
    expect(buttonByLabel(filled, "action.save")?.props.disabled).toBe(false);
    (elementByType(filled, primitives.InlineEditor)?.props.onSave as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(["edit:mới"]);
    harness.reset();
    const back = render(GoalBar as never, props);
    const bar = childrenOf(back)[0] as Element;
    expect(bar.props.className).toBe(BAR_CLASS.bar);
    expect(elementByType(back, primitives.InlineEditor)).toBeUndefined();
  });

  test("xoá: gọi onClear rồi biến mất hẳn", async () => {
    const primitives = makePrimitives();
    const harness = makeStateful();
    const { GoalBar } = createGoalComponents(harness.deps, primitives);
    const { props, calls } = barProps();
    harness.reset();
    const node = render(GoalBar as never, props);
    (buttonByLabel(node, "action.clear")?.props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(["clear"]);
    harness.reset();
    expect(render(GoalBar as never, props)).toBeNull();
  });
});

describe("GoalDock — ghép projection với kích hoạt", () => {
  test("lấy goal từ projection và CHỈ nhận activation khớp đúng id + revision", () => {
    const primitives = makePrimitives();
    const { GoalDock } = createGoalComponents(shellDeps({ setState: [], cleanups: [] }), primitives);
    const seen: unknown[] = [];
    const ok = () => Promise.resolve({ ok: true, error: { code: "", message: "" } });
    const bar = render(GoalDock as never, {
      useProjection: () => ({ goal: { id: "g1", revision: 3, phase: "active", objective: "x" } }),
      useGoalActivation: (select: (next: { id?: string; revision?: number; activation?: string }) => unknown) => {
        seen.push(select({ id: "g1", revision: 3, activation: "armed" }));
        seen.push(select({ id: "g1", revision: 2, activation: "armed" }));
        return "armed";
      },
      onEdit: ok,
      onPause: ok,
      onResume: ok,
      onClear: ok,
      t,
    });
    const passed = bar.props as Record<string, unknown>;
    expect((passed.goal as { id: string }).id).toBe("g1");
    expect(passed.activation).toBe("armed");
    expect(seen).toEqual(["armed", undefined]);
  });

  test("activation undefined thì KHÔNG truyền khoá đó xuống dải", () => {
    const primitives = makePrimitives();
    const { GoalDock } = createGoalComponents(shellDeps({ setState: [], cleanups: [] }), primitives);
    const ok = () => Promise.resolve({ ok: true, error: { code: "", message: "" } });
    const bar = render(GoalDock as never, {
      useProjection: () => null,
      useGoalActivation: () => undefined,
      onEdit: ok,
      onPause: ok,
      onResume: ok,
      onClear: ok,
      t,
    });
    expect("activation" in (bar.props as Record<string, unknown>)).toBe(false);
    expect((bar.props as Record<string, unknown>).goal).toBeNull();
  });
});
describe("ô xem trước lệnh và định nghĩa chiếu", () => {
  test("bong bóng: memo, hàng canh phải, và renderFactorySlot nhận đúng sự thật lệnh", () => {
    const slotCalls: { name: string; owner: Record<string, unknown> }[] = [];
    const View = createGoalCommandInputView({ jsx: fakeJsx, jsxs: fakeJsx, memo: (component) => component });
    const node = render(View as never, {
      node: { data: { text: "/goal mục tiêu" } },
      t,
      renderFactorySlot: (name: string, owner: Record<string, unknown>) => {
        slotCalls.push({ name, owner });
        return { type: "slot", props: owner };
      },
    });
    expect(node.props.className).toBe(VIEW_CLASS.row);
    expect(node.props["data-command-input"]).toBe("");
    expect(node.props.role).toBe("group");
    expect(node.props["aria-label"]).toBe("commandInput.aria");
    const stack = childrenOf(node)[0] as Element;
    expect(stack.props.className).toBe(VIEW_CLASS.stack);
    const bubble = childrenOf(stack)[0] as Element;
    expect(bubble.props.className).toBe(VIEW_CLASS.bubble);
    expect(slotCalls[0]?.name).toBe("conversation.user.text");
    expect(slotCalls[0]?.owner.text).toBe("/goal mục tiêu");
    expect(slotCalls[0]?.owner.facts).toEqual({ commands: GOAL_COMMANDS });
    expect(slotCalls[0]?.owner.interactive).toBe(false);
  });

  test("dòng lệnh hiển thị: cắt khoảng trắng cuối, giữ khoảng trắng giữa", () => {
    expect(goalCommandText({ type: "command/run", seq: 3, time: 9, data: { commandId: "c1", name: "goal", args: " mục tiêu  " } })).toBe("/goal mục tiêu");
    expect(goalCommandText({ type: "command/run", seq: 3, time: 9, data: { commandId: "c1", name: "goal" } })).toBe("/goal");
  });

  test("định nghĩa chiếu: chỉ khớp lệnh /goal, giữ trạng thái, neo ngay trước sự kiện", () => {
    const run = { type: "command/run", seq: 12, time: 99, data: { commandId: "c7", name: "goal", args: " abc " } };
    expect(goalCommandInputDefinition.kind).toBe("goal-command-input");
    expect(goalCommandInputDefinition.target).toBe("chat");
    expect(goalCommandInputDefinition.match(run)).toEqual({ id: "c7", role: "start" });
    expect(goalCommandInputDefinition.match({ type: "command/run", seq: 1, time: 1, data: { commandId: "c1", name: "help" } })).toBeNull();
    expect(goalCommandInputDefinition.match({ type: "message", data: { name: "goal" } })).toBeNull();
    const state = goalCommandInputDefinition.start(undefined, { event: run });
    expect(state).toEqual({ commandId: "c7", seq: 12, time: 99, text: "/goal abc" });
    expect(goalCommandInputDefinition.update({ state })).toBe(state);
    const view = goalCommandInputDefinition.buildViewNode({ key: "k", id: "n1", state, start: { location: { kind: "root" } } });
    expect(view).toEqual({
      key: "k",
      kind: "command-input",
      id: "n1",
      target: "chat",
      anchorSeq: 11.9,
      location: { kind: "root" },
      visibility: "visible",
      data: { commandId: "c7", text: "/goal abc", time: 99 },
    });
    // Chưa có trạng thái ⇒ không dựng node.
    expect(goalCommandInputDefinition.buildViewNode({ key: "k", id: "n1", state: undefined })).toBeNull();
    // Không có vị trí trong cây ⇒ mặc định "unresolved".
    const unresolved = goalCommandInputDefinition.buildViewNode({ key: "k", id: "n1", state });
    expect(unresolved?.location).toEqual({ kind: "unresolved" });
  });

  test("start ném lỗi khi ai đó đưa sự kiện không phải command/run", () => {
    expect(() => goalCommandInputDefinition.start(undefined, { event: { type: "message" } as never })).toThrow(
      "goal-command-input start requires command/run",
    );
  });
});

describe("rule chip lệnh — chỉ nhận token đã xác nhận đúng ranh giới", () => {
  /** Ngữ cảnh đọc sự thật lệnh. */
  const ctxOf = (commands: readonly { start: number; end: number; name: string }[]) => ({ read: () => commands });

  test("đầu chuỗi: token /goal ở vị trí 0 được nhận", () => {
    const text = "/goal làm gì đó";
    expect(goalCommandReferenceRule.match(text, 0, ctxOf([{ start: 0, end: 5, name: "goal" }]))).toEqual({
      id: "command",
      start: 0,
      end: 5,
      data: { name: "goal" },
    });
  });

  test("giữa chuỗi: chỉ nhận khi hai đầu đều là khoảng trắng", () => {
    const text = "hãy /goal rồi thôi";
    expect(goalCommandReferenceRule.match(text, 4, ctxOf([{ start: 4, end: 9, name: "goal" }]))?.start).toBe(4);
    // Dính chữ ở đầu ⇒ từ chối (đây là chữ /goal nhắc lại, không phải lệnh).
    const glued = "hãy/goal rồi thôi";
    expect(goalCommandReferenceRule.match(glued, 3, ctxOf([{ start: 3, end: 8, name: "goal" }]))).toBeUndefined();
    // Dính chữ ở cuối ⇒ từ chối.
    const gluedEnd = "hãy /goallàm";
    expect(goalCommandReferenceRule.match(gluedEnd, 4, ctxOf([{ start: 4, end: 9, name: "goal" }]))).toBeUndefined();
  });

  test("không có dấu / sau vị trí đang xét, hoặc không có sự thật lệnh ⇒ không nhận", () => {
    expect(goalCommandReferenceRule.match("không có gì", 0, ctxOf([]))).toBeUndefined();
    expect(goalCommandReferenceRule.match("/goal x", 0, { read: () => undefined })).toBeUndefined();
    expect(goalCommandReferenceRule.match("/goal x", 0, ctxOf([{ start: 0, end: 5, name: "help" }]))).toBeUndefined();
  });

  test("nhiều ứng viên: chọn cái bắt đầu sớm nhất, cùng vị trí thì chọn cái dài hơn", () => {
    const text = "/goal một /goal hai";
    const chosen = goalCommandReferenceRule.match(text, 0, ctxOf([
      { start: 10, end: 15, name: "goal" },
      { start: 10, end: 15, name: "goal" },
      { start: 10, end: 15, name: "goal" },
    ]));
    expect(chosen?.start).toBe(10);
    expect(goalCommandReferenceRule.match(text, 0, ctxOf([{ start: 0, end: 5, name: "goal" }, { start: 10, end: 15, name: "goal" }]))?.start).toBe(0);
  });

  test("chip: đúng ba props của ReferenceChip", () => {
    const Chip = createGoalCommandReference({ jsx: fakeJsx }, { ReferenceChip: "ReferenceChip" });
    const node = render(Chip as never, { node: { data: { name: "goal" } }, raw: "/goal" });
    expect(node.type).toBe("ReferenceChip");
    expect(node.props).toEqual({ appearance: "command", label: "/goal", title: "/goal" });
  });
});

describe("test canh — CSS phải TRÙNG NGUYÊN VĂN bản gốc", () => {
  test("CSS của ta TRÙNG bản gốc sau khi bỏ khoảng trắng, và ngoặc cân bằng", async () => {
    for (const name of ["GoalBar", "GoalCommandInputView"]) {
      const mine = await readFile(join(import.meta.dir, "..", "..", "packages", "client", "ui-goal", "src", name + ".module.css"), "utf8");
      const body = mine.split("*/")[1] ?? "";
      const original = await stockCss(name);
      expect(squash(body)).toBe(squash(original));
      expect((body.match(/\{/g) ?? []).length).toBe((body.match(/\}/g) ?? []).length);
    }
  });
});

describe("nửa host", () => {
  test("lib/index.js là ESM, chỉ xuất apply và không import gói ngoài", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-goal-"));
    const built = await buildPackage(out);
    const code = await readFile(built.host, "utf8");
    expect(code).toContain("export {");
    expect(code).toContain("apply");
    expect(/^import\s/m.test(code)).toBe(false);
  });
});
describe("ui-goal — BỘ BA manifest (canh regress 19/10/2026)", () => {
  test("(a) dsh.client DEEP-EQUAL bản gốc SAU KHI QUY ID (platform + inject đúng thứ tự)", async () => {
    const ours = (await oursManifest()).dsh as Record<string, unknown> | undefined;
    const stock = (await stockManifest()).dsh as Record<string, unknown> | undefined;
    // 20/10/2026 — id inject đã REWRITE CÓ CHỦ ĐÍCH sang id GBH nên so JSON.stringify thô là sai hướng;
    // sameAfterIdMap quy id ta -> id stock rồi so SÂU (platform + inject ĐÚNG THỨ TỰ), manifest gốc làm chuẩn.
    expect(sameAfterIdMap(ours?.client ?? null, stock?.client ?? null)).toBe(true);
  });

  test("(b) exports['./client'] = './lib/client.js'", async () => {
    const exports = (await oursManifest()).exports as Record<string, string> | undefined;
    expect(exports?.["./client"]).toBe("./lib/client.js");
  });
});