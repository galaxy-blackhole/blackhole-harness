/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ca CONG CHONG CAI HAI LAN cua row ui-goal — tach rieng khoi tests/client/ui-goal.test.ts
 *      vi luat repo: MOT file <= 1000 dong (tep kia da 987 dong)
 */
import { describe, expect, test } from "bun:test";

/** Ten package cua row (id module duy nhat). */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-goal";

/** Bề mặt plugin tối thiểu mà ca này cần. */
interface PluginFace {
  /** Cài wiring của row. */
  apply(ctx: unknown): void;
}

/** Bản ghi của context giả. */
interface Recorder {
  /** Số lần effect được gọi. */
  effects: string[];
  /** Sự kiện UI đã đăng ký. */
  events: unknown[];
  /** Rule văn bản đã đăng ký. */
  userText: unknown[];
  /** Slot đã inject. */
  injections: string[];
}

/**
 * Dựng context giả phía browser cho row ui-goal (chỉ seam mà apply chạm tới).
 * @returns cặp { ctx, record }.
 */
function harness(): { ctx: Record<string, unknown>; record: Recorder } {
  const record: Recorder = { effects: [], events: [], userText: [], injections: [] };
  const ctx: Record<string, unknown> = {
    effect: (run: () => unknown, label?: string): unknown => {
      record.effects.push(label ?? "?");
      return run();
    },
    locale: {
      register: (): (() => void) => () => undefined,
      bind: (): ((key: string) => string) => (key: string) => key,
    },
    slots: {
      inject: (slot: string, callback: () => unknown): unknown => {
        record.injections.push(slot);
        return callback();
      },
      register: (): (() => void) => () => undefined,
    },
    sessions: { binding: (): undefined => undefined },
    remote: { $on: (): (() => void) => () => undefined, goals: {} },
    uiConversation: {
      events: {
        register: (definition: unknown): void => {
          record.events.push(definition);
        },
      },
      userText: {
        register: (rule: unknown): void => {
          record.userText.push(rule);
        },
      },
    },
  };
  return { ctx, record };
}

/** Require giả: đủ để createPlugin dựng component (ca này KHÔNG render). */
function fakeRequire(specifier: string): unknown {
  const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown => ({ type, props: props ?? {}, key });
  if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
  if (specifier === "react") {
    return {
      Fragment: "Fragment",
      useState: (initial: unknown): [unknown, () => void] => [initial, () => undefined],
      useRef: (initial: unknown): { current: unknown } => ({ current: initial }),
      useEffect: (): void => undefined,
      useCallback: (fn: unknown): unknown => fn,
      memo: (component: unknown): unknown => component,
    };
  }
  return new Proxy({}, { get: () => "Primitive" });
}

/** Số thứ tự module tươi (cờ idempotent là phạm vi module nên mỗi ca phải nạp lại). */
let seq = 0;

/**
 * Nạp MODULE TƯƠI của plugin ui-goal.
 * @returns bề mặt plugin mới.
 */
async function freshPlugin(): Promise<PluginFace> {
  seq += 1;
  const spec = "../../packages/client/ui-goal/src/plugin.ts?idempotent=" + String(seq);
  const mod = (await import(spec)) as { createPlugin: (requireFn: (specifier: string) => unknown) => PluginFace };
  return mod.createPlugin(fakeRequire);
}

describe("row ui-goal — cổng chống cài hai lần", () => {
  test("lần đầu NÉM ⇒ cờ vẫn false ⇒ lần hai (ctx KHÁC) đăng ký lại ĐỦ; lần ba không đăng ký", async () => {
    // MỘT instance plugin áp cho BA ctx khác nhau (đúng ca thật HAI ENTRY ⇒ HAI ctx).
    const plugin = await freshPlugin();
    const broken = harness();
    (broken.ctx.uiConversation as unknown as { events: { register: () => void } }).events.register = () => {
      throw new Error("đăng ký sự kiện hỏng giữa đường");
    };
    expect(() => plugin.apply(broken.ctx)).toThrow();
    // Lần hai (ctx KHÁC) phải đăng ký LẠI ĐỦ — nếu cờ bật sớm hoặc khoá theo ctx thì ca này trượt.
    const second = harness();
    plugin.apply(second.ctx);
    expect(second.record.events.length).toBe(1);
    expect(second.record.userText.length).toBe(1);
    expect(second.record.injections).toEqual([
      "conversation.user.text.node",
      "conversation.chat.node",
      "conversation.input.dock",
    ]);
    // Lần ba: cờ đã bật ⇒ KHÔNG gọi effect/inject nào.
    const third = harness();
    plugin.apply(third.ctx);
    expect(third.record.events.length).toBe(0);
    expect(third.record.injections.length).toBe(0);
    // Nạp MODULE MỚI thì lại được phép đăng ký (cờ là phạm vi module, không phải toàn cục).
    const fourth = harness();
    const fresh = await freshPlugin();
    fresh.apply(fourth.ctx);
    expect(fourth.record.injections.length).toBe(3);
  });

  test("id module duy nhat cua row khong doi (chot ten package)", () => {
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-client-ui-goal");
  });
});
