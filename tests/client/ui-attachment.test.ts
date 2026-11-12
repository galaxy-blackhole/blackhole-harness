/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test nửa browser của row ui-attachment: một-id · 5 slot đúng tên bản gốc · cổng boolean phạm vi module ·
 *      và CA CANH lỗi pixel đã tốn một vòng A/B (DropOverlay render thường trực trong ô soạn tin).
 */
import { describe, expect, test } from "bun:test";

/** Id mà bundle ĐƯỢC PHÉP đăng ký (đúng một) — luật §8 của docs/recipes/HOST-ROW-REWRITE.md. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-attachment";

/** 5 slot bản gốc có (cổng check:rows so đúng tập này). */
const SLOTS = [
  "conversation.input.attachments",
  "conversation.chat.message.images",
  "conversation.chat.user.images",
  "conversation.trajectory.images",
  "tool.call.images",
];

/** Đăng ký bắt được từ bundle. */
type Registration = { id: string; factory: (require: (spec: string) => unknown) => unknown };

/**
 * Nạp module client TƯƠI (cờ bundleInstalled ở phạm vi module sẽ dính giữa các ca nếu import tĩnh).
 * @param tag - hậu tố query để mỗi ca có một instance module riêng.
 * @returns các đăng ký mà bundle đã gọi.
 */
async function loadBundle(tag: string): Promise<Registration[]> {
  const calls: Registration[] = [];
  (globalThis as { window?: unknown }).window = { __ModuleLoader__: { load: (registration: Registration) => calls.push(registration) } };
  const spec: string = "../../packages/client/ui-attachment/src/client.ts?" + tag;
  await import(spec);
  return calls;
}

/**
 * Context giả: ghi lại tên slot được inject và spec được register.
 * @returns context giả và bộ ghi.
 */
function stubContext(): { ctx: never; injected: string[]; registered: Record<string, unknown>[] } {
  const injected: string[] = [];
  const registered: Record<string, unknown>[] = [];
  const ctx = {
    locale: { bind: () => (key: string) => key, register: () => undefined },
    slots: {
      inject: (name: string, body: () => Generator<unknown, void, unknown>) => {
        injected.push(name);
        for (const step of body()) void step;
      },
      /* Khuôn thật của vỏ: `register(spec, component)` — component là tham số THỨ HAI, phải ghi cả hai. */
      register: (spec: Record<string, unknown>, component?: unknown) => {
        registered.push({ ...spec, render: component });
        return undefined;
      },
    },
  };
  return { ctx: ctx as never, injected, registered };
}

describe("gbh-client-ui-attachment — nửa browser", () => {
  test("bundle đăng ký ĐÚNG MỘT id: id CỦA TA (không đăng ký id gói gốc)", async () => {
    const calls = await loadBundle("one-id");
    expect(calls.length).toBe(1);
    expect(calls[0]?.id).toBe(PACKAGE_NAME);
  });

  test("apply gắn ĐÚNG 5 slot của bản gốc (không bịa tên mới)", async () => {
    const calls = await loadBundle("slots");
    const plugin = calls[0]?.factory(() => ({ createElement: () => null })) as { apply(ctx: unknown): void };
    const harness = stubContext();
    plugin.apply(harness.ctx);
    expect([...harness.injected].sort()).toEqual([...SLOTS].sort());
    for (const spec of harness.registered) expect(SLOTS).toContain(spec.name as string);
  });

  test("CA CANH LỖI PIXEL: occupant 'drop' KHÔNG render gì khi chưa kéo tệp", async () => {
    /* Lỗi thật 17/10/2026: DropOverlay render thường trực ⇒ hai dòng chữ nằm trong ô soạn tin ⇒ A/B 1024x768
       FAIL 0,406% (ngưỡng 0,1%). Ca này khoá hành vi đúng: mặc định null, chỉ hiện khi active/dragging. */
    const calls = await loadBundle("drop");
    const plugin = calls[0]?.factory(() => ({ createElement: () => ({}) })) as { apply(ctx: unknown): void };
    const harness = stubContext();
    plugin.apply(harness.ctx);
    const drop = harness.registered.find((spec) => spec.key === "drop") as { render?: (props: Record<string, unknown>) => unknown } | undefined;
    expect(drop).toBeDefined();
    expect(drop?.render?.({}) ?? null).toBeNull();
    expect(drop?.render?.({ disabled: true }) ?? null).toBeNull();
    expect(drop?.render?.({ active: true }) ?? null).not.toBeNull();
  });

  test("cổng boolean PHẠM VI MODULE: gọi apply hai lần ⇒ lần hai là NO-OP", async () => {
    const calls = await loadBundle("idempotent");
    const plugin = calls[0]?.factory(() => ({ createElement: () => null })) as { apply(ctx: unknown): void };
    const harness = stubContext();
    plugin.apply(harness.ctx);
    const afterFirst = harness.injected.length;
    expect(afterFirst).toBe(SLOTS.length);
    plugin.apply(harness.ctx);
    expect(harness.injected.length).toBe(afterFirst);
  });

  test("apply ném lỗi ⇒ ĐÚNG 1 dòng console.error VÀ lỗi vẫn được ném tiếp", async () => {
    const calls = await loadBundle("throwing");
    const plugin = calls[0]?.factory(() => ({ createElement: () => null })) as { apply(ctx: unknown): void };
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };
    try {
      const ctx = { locale: { bind: () => (k: string) => k, register: () => undefined }, slots: { inject: () => { throw new Error("inject no"); }, register: () => undefined } };
      expect(() => plugin.apply(ctx as never)).toThrow("inject no");
      expect(logged.length).toBe(1);
      expect(String(logged[0]?.[0] ?? "")).toContain("gbh-client-ui-attachment: apply nem loi");
    } finally {
      console.error = original;
    }
  });
});
