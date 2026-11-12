/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-token-meter (row token-meter): dựng dịch vụ THẬT trên Context
 *      cordis có thật (nạp từ symlink peer của package), so với bundle gốc @deepseek-ai/dsh-token-meter —
 *      bề mặt export · Config · inject · 3 đăng ký chiếu · tên dịch vụ · validateConfigKeys ·
 *      estimateMessage · measure() trên phiên rỗng · thông điệp lỗi replay.
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { TokenMeter as Ours } from "../../packages/host/token-meter/src/index.ts";

/** Thư mục package của ta — nơi có symlink peer trỏ tới kernel. */
const PKG = join(import.meta.dir, "..", "..", "packages", "host", "token-meter");

/** cordis mà CHÍNH package ta nạp (symlink tới kernel). */
const CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Bundle gốc trong cây cài của kernel (CHỈ ĐỌC). */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-token-meter", "lib", "index.js");

/** Bề mặt Context chỉ dùng trong test. */
interface TestContext {
  /** Cấp một dịch vụ giả cho seam. */
  provide(name: string, value: unknown): void;
}

/** Constructor Context lấy từ cordis thật. */
let ContextCtor: new () => TestContext;

/** Bề mặt module gốc. */
interface StockModule {
  /** Lớp dịch vụ đã build. */
  TokenMeter: new (ctx: TestContext, config?: Record<string, never>) => unknown;
}

/** Phiên GIẢ tối thiểu mà dịch vụ đọc: seq và eventAt. */
interface FakeSession {
  /** Số sự kiện bền hiện có. */
  seq: number;
  /** Đọc sự kiện theo chỉ số. */
  eventAt(index: number): unknown;
}

/**
 * Nạp cordis thật một lần cho cả file.
 * Nhận: không.
 * Trả: không.
 */
beforeAll(async (): Promise<void> => {
  const module = (await import(CORDIS)) as { Context: new () => TestContext };
  ContextCtor = module.Context;
});

/**
 * Nạp bundle gốc như ESM thật.
 * Nhận: không.
 * Trả: module bản gốc.
 */
async function stock(): Promise<StockModule> {
  return (await import(STOCK)) as StockModule;
}

/**
 * Dựng Context có thật + seam sessionProjections đếm số lần đăng ký.
 * Nhận: không.
 * Trả: context và danh sách định nghĩa đã đăng ký.
 */
function harness(): { ctx: TestContext; registrations: unknown[] } {
  const ctx = new ContextCtor();
  const registrations: unknown[] = [];
  ctx.provide("sessionProjections", {
    register: (definition: unknown): void => {
      registrations.push(definition);
    },
    stateOf: (): unknown => undefined,
  });
  return { ctx, registrations };
}

describe("token-meter — bề mặt export & manifest", () => {
  test("export lớp TokenMeter + default như bản gốc (2 = 2)", async () => {
    const theirs = await stock();
    expect(typeof Ours).toBe("function");
    expect(typeof theirs.TokenMeter).toBe("function");
    const ours = (await import("../../packages/host/token-meter/src/index.ts")) as { default?: unknown };
    expect(ours.default).toBe(Ours);
  });

  test("static inject = [sessionProjections] như bản gốc", async () => {
    const theirs = await stock();
    const oursInject = (Ours as unknown as { inject: string[] }).inject;
    const theirInject = (theirs.TokenMeter as unknown as { inject: string[] }).inject;
    expect(oursInject).toEqual(["sessionProjections"]);
    expect(oursInject).toEqual(theirInject);
  });

  test("Config rỗng và BẰNG bản gốc (chuỗi schema)", async () => {
    const theirs = await stock();
    const oursConfig = String((Ours as unknown as { Config: unknown }).Config);
    const theirConfig = String((theirs.TokenMeter as unknown as { Config: unknown }).Config);
    expect(oursConfig).toBe(theirConfig);
  });
});

describe("token-meter — dựng dịch vụ trên Context thật", () => {
  test("đăng ký ĐÚNG 3 chiếu phiên ở cả hai bản", async () => {
    const theirs = await stock();
    const ours = harness();
    const stockCtx = harness();
    new Ours(ours.ctx as unknown as ConstructorParameters<typeof Ours>[0]);
    new theirs.TokenMeter(stockCtx.ctx as unknown as ConstructorParameters<typeof theirs.TokenMeter>[0]);
    expect(ours.registrations.length).toBe(3);
    expect(ours.registrations.length).toBe(stockCtx.registrations.length);
  });

  test("tên dịch vụ là tokenMeter ở cả hai bản", async () => {
    const theirs = await stock();
    const ours = harness();
    const stockCtx = harness();
    new Ours(ours.ctx as unknown as ConstructorParameters<typeof Ours>[0]);
    new theirs.TokenMeter(stockCtx.ctx as unknown as ConstructorParameters<typeof theirs.TokenMeter>[0]);
    expect((ours.ctx as unknown as { tokenMeter?: unknown }).tokenMeter).toBeDefined();
    expect((stockCtx.ctx as unknown as { tokenMeter?: unknown }).tokenMeter).toBeDefined();
  });

  test("cấu hình LẠ: hai bản ném CÙNG thông điệp (validateConfigKeys)", async () => {
    const theirs = await stock();
    const ours = harness();
    const stockCtx = harness();
    let ourMessage = "";
    let theirMessage = "";
    try {
      new Ours(ours.ctx as unknown as ConstructorParameters<typeof Ours>[0], { unknownKey: true } as unknown as Record<string, never>);
    } catch (error) {
      ourMessage = (error as Error).message;
    }
    try {
      new theirs.TokenMeter(stockCtx.ctx as unknown as ConstructorParameters<typeof theirs.TokenMeter>[0], { unknownKey: true } as unknown as Record<string, never>);
    } catch (error) {
      theirMessage = (error as Error).message;
    }
    expect(ourMessage).toBe('TokenMeterConfig: unknown key "unknownKey" (no settings are supported)');
    expect(ourMessage).toBe(theirMessage);
  });
});

describe("token-meter — estimateMessage & measure A/B", () => {
  test("estimateMessage cho CÙNG số token trên 4 mẫu tin nhắn", async () => {
    const theirs = await stock();
    const ours = harness();
    const stockCtx = harness();
    const ourService = new Ours(ours.ctx as unknown as ConstructorParameters<typeof Ours>[0]) as unknown as { estimateMessage(message: unknown): number };
    const theirService = new theirs.TokenMeter(stockCtx.ctx as unknown as ConstructorParameters<typeof theirs.TokenMeter>[0]) as unknown as { estimateMessage(message: unknown): number };
    const samples = [
      { role: "user", content: "xin chào" },
      { role: "user", content: "" },
      { role: "assistant", content: "a".repeat(400) },
      { role: "system", content: [{ type: "text", text: "hệ thống" }] },
    ];
    for (const sample of samples) {
      expect(ourService.estimateMessage(sample)).toBe(theirService.estimateMessage(sample));
    }
  });

  test("measure() trên phiên RỖNG: hai bản cùng kind none, 0 token, 0 node", async () => {
    const theirs = await stock();
    const ours = harness();
    const stockCtx = harness();
    const ourService = new Ours(ours.ctx as unknown as ConstructorParameters<typeof Ours>[0]) as unknown as { measure(session: FakeSession): Record<string, unknown> };
    const theirService = new theirs.TokenMeter(stockCtx.ctx as unknown as ConstructorParameters<typeof theirs.TokenMeter>[0]) as unknown as { measure(session: FakeSession): Record<string, unknown> };
    const empty: FakeSession = { seq: 0, eventAt: (): unknown => undefined };
    const ourResult = ourService.measure(empty);
    const theirResult = theirService.measure(empty);
    expect(ourResult).toEqual(theirResult);
    expect(ourResult.baseline).toEqual({ kind: "none", tokens: 0 });
    expect(ourResult.totalTokens).toBe(0);
    expect(ourResult.surfaceTokens).toBe(0);
    expect(ourResult.nodes).toEqual([]);
  });

  test("replay HỎNG: step/end không có step/start ⇒ hai bản ném CÙNG thông điệp", async () => {
    const theirs = await stock();
    const ours = harness();
    const stockCtx = harness();
    const ourService = new Ours(ours.ctx as unknown as ConstructorParameters<typeof Ours>[0]) as unknown as { measure(session: FakeSession): unknown };
    const theirService = new theirs.TokenMeter(stockCtx.ctx as unknown as ConstructorParameters<typeof theirs.TokenMeter>[0]) as unknown as { measure(session: FakeSession): unknown };
    const broken: FakeSession = {
      seq: 1,
      eventAt: (index: number): unknown =>
        index === 0 ? { type: "step/end", seq: 0, data: { turn: 1, step: 1 } } : undefined,
    };
    let ourMessage = "";
    let theirMessage = "";
    try {
      ourService.measure(broken);
    } catch (error) {
      ourMessage = (error as Error).message;
    }
    try {
      theirService.measure(broken);
    } catch (error) {
      theirMessage = (error as Error).message;
    }
    expect(ourMessage).toBe("token meter: step/end at seq 0 has no matching step/start event");
    expect(ourMessage).toBe(theirMessage);
  });
});
