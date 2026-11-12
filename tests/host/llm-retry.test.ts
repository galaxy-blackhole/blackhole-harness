/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-llm-retry: bộ đối chứng TRỰC TIẾP với chính bundle
 *      gốc (@deepseek-ai/dsh-llm-retry) trên cùng một giàn giả — mọi ca chạy CẢ HAI bên rồi so
 *      từng sự kiện đã ghi, từng giá trị trả về; cộng ca tập export đo trên ARTIFACT đã build.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/llm-retry/build.ts";
import { Config, RetryId, apply, inject, name } from "../../packages/host/llm-retry/src/index.ts";
import { cancellableDelay, localDelay, retryPolicyKey, retryStateKey } from "../../packages/host/llm-retry/src/policy.ts";
import type {
  LlmFailure,
  RequestErrorAction,
  RequestErrorNext,
  RequestErrorPayload,
  ResolvedRetryPolicy,
} from "../../packages/host/llm-retry/src/types.ts";

/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-llm-retry/lib/index.js";

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as {
  name: string;
  inject: string[];
  Config: unknown;
  RetryId: (id: string) => string;
  apply: (ctx: unknown, config?: unknown, internals?: unknown) => void;
};

/** Một sự kiện phiên đã cam kết, như giàn ghi lại. */
interface AppendedEvent {
  /** Loại sự kiện. */
  type: string;
  /** Dữ liệu mang theo. */
  data: Record<string, unknown>;
}

/** Một định nghĩa đơn vị chiếu mà giàn nhận. */
interface Definition {
  /** Khoá chiếu. */
  key: string;
  /** Trạng thái cho log rỗng. */
  init(header: unknown, inheritedEventCount: number): unknown;
  /** Phép gộp thuần. */
  apply(state: unknown, event: { type: string; data: unknown }): unknown;
}

/** Giàn giả tối thiểu nhưng ĐÚNG hình dạng seam thật: bộ chiếu được ĐIỀU KHIỂN trên mỗi sự kiện. */
interface Harness {
  /** Context đưa cho `apply`. */
  ctx: never;
  /** Mọi sự kiện đã ghi, theo thứ tự. */
  appended: AppendedEvent[];
  /** Mọi lượt gọi `logger.warn`. */
  warns: unknown[][];
  /** Listener waterfall đã đăng ký. */
  listeners: ((payload: RequestErrorPayload, next: RequestErrorNext) => Promise<RequestErrorAction>)[];
  /** Hàm dọn của các hiệu ứng đã đăng ký. */
  disposers: (() => Promise<void>)[];
  /** Cờ: hàm gỡ listener đã được gọi. */
  listenerDisposed: () => boolean;
  /** Tạo một payload waterfall gắn với phiên của giàn này. */
  payload(patch: Partial<RequestErrorPayload>): RequestErrorPayload;
  /** Đọc định nghĩa chiếu đã đăng ký theo khoá, hoặc undefined khi chưa đăng ký. */
  definition(key: string): Definition | undefined;
}

/**
 * Dựng một giàn giả: sổ chiếu có điều khiển thật, log cảnh báo, sổ listener waterfall, sổ hiệu ứng.
 * Nhận: không.
 * Trả: giàn dùng chung được cho CẢ bản của ta lẫn bản gốc.
 */
function harness(): Harness {
  const appended: AppendedEvent[] = [];
  const warns: unknown[][] = [];
  const listeners: Harness["listeners"] = [];
  const disposers: (() => Promise<void>)[] = [];
  const definitions = new Map<string, Definition>();
  const states = new Map<string, unknown>();
  let listenerDisposed = false;
  const session = {
    append(type: string, data: unknown): void {
      const event = { type, data: data as Record<string, unknown> };
      appended.push(event);
      // Seam THẬT điều K MỌI đơn vị chiếu trên MỖI sự kiện đã cam kết — không có bước này thì
      // trạng thái không tiến và bộ đếm ngân sách sẽ không bao giờ cạn.
      for (const [key, definition] of definitions) states.set(key, definition.apply(states.get(key), event));
    },
  };
  const ctx = {
    sessionProjections: {
      register(definition: Definition): () => void {
        definitions.set(definition.key, definition);
        states.set(definition.key, definition.init({}, 0));
        return () => {
          definitions.delete(definition.key);
          states.delete(definition.key);
        };
      },
      stateOf: (_session: unknown, key: string): unknown => states.get(key),
    },
    logger: {
      warn: (...args: unknown[]): void => {
        warns.push(args);
      },
    },
    on: (_event: string, listener: Harness["listeners"][number]): (() => void) => {
      listeners.push(listener);
      return () => {
        listenerDisposed = true;
      };
    },
    effect: (callback: () => () => Promise<void>): (() => void) => {
      disposers.push(callback());
      return () => undefined;
    },
  };
  return {
    ctx: ctx as never,
    appended,
    warns,
    listeners,
    disposers,
    listenerDisposed: () => listenerDisposed,
    definition: (key) => definitions.get(key),
    payload: (patch) => ({
      agent: { session } as never,
      turn: 1,
      step: 2,
      provider: "deepseek",
      failure: { message: "rate limited", code: "RATE_LIMIT" },
      retryPolicy: normalPolicy(),
      signal: new AbortController().signal,
      ...patch,
    }),
  };
}

/** Sự thật hỏng mẫu. */
function failure(patch: Partial<LlmFailure> = {}): LlmFailure {
  return { message: "rate limited", code: "RATE_LIMIT", ...patch };
}

/** Chính sách hữu hạn mẫu: jitter 0 để độ trễ TẤT ĐỊNH. */
function normalPolicy(patch: Partial<Extract<ResolvedRetryPolicy, { mode: "normal" }>> = {}): ResolvedRetryPolicy {
  return {
    mode: "normal",
    maxRetries: 3,
    retryableCodes: ["RATE_LIMIT", "SERVER"],
    initialDelayMs: 4,
    maxDelayMs: 64,
    jitterRatio: 0,
    ...patch,
  };
}

/** Chính sách vô hạn mẫu. */
function alwaysPolicy(patch: Partial<Extract<ResolvedRetryPolicy, { mode: "always" }>> = {}): ResolvedRetryPolicy {
  return { mode: "always", initialDelayMs: 4, maxDelayMs: 64, jitterRatio: 0, ...patch };
}

/** Thay danh tính chuỗi thử lại bằng một chỗ giữ chỗ để hai bên so được với nhau. */
function normalize(events: AppendedEvent[]): unknown[] {
  return events.map((event) => ({ ...event, data: { ...event.data, retryId: "<retryId>" } }));
}

/** Gọi tiếp mẫu: đếm số lượt và trả về kết quả đã định. */
function nextOf(action: RequestErrorAction = undefined): { next: RequestErrorNext; calls: () => number } {
  let calls = 0;
  return {
    next: async () => {
      calls += 1;
      return action;
    },
    calls: () => calls,
  };
}

/** Kết quả một lượt chạy kịch bản trên MỘT bản cài. */
interface RunResult {
  /** Giá trị listener trả về. */
  action: RequestErrorAction;
  /** Sự kiện phiên đã ghi, đã chuẩn hoá danh tính chuỗi. */
  events: unknown[];
  /** Số lượt gọi tầng dưới. */
  nextCalls: number;
  /** Số lượt gọi `logger.warn`. */
  warns: number;
}

/**
 * Chạy một kịch bản trên một bản cài: dựng giàn, gọi `apply`, rồi bắn waterfall đúng số lượt.
 * Nhận: hàm `apply` cần đo, và bộ mô tả kịch bản (payload + kết quả tầng dưới + số lượt bắn).
 * Trả: quyết định cuối, sự kiện đã ghi, số lượt gọi tầng dưới và số cảnh báo.
 */
async function runOn(
  applyFn: (ctx: never, config?: unknown, internals?: unknown) => void,
  scenario: {
    payload: (h: Harness) => RequestErrorPayload;
    downstream?: RequestErrorAction;
    fires?: number;
    internals?: { random?: () => number };
  },
): Promise<RunResult> {
  const h = harness();
  applyFn(h.ctx, {}, scenario.internals ?? {});
  const counter = nextOf(scenario.downstream);
  let action: RequestErrorAction = undefined;
  for (let i = 0; i < (scenario.fires ?? 1); i++) {
    const listener = h.listeners[0];
    if (listener === undefined) throw new Error("không có listener nào được đăng ký");
    action = await listener(scenario.payload(h), counter.next);
  }
  return {
    action,
    events: normalize(h.appended),
    nextCalls: counter.calls(),
    warns: h.warns.length,
  };
}

/**
 * Chạy CÙNG một kịch bản trên bản của ta và bản gốc rồi so từng con số.
 * Nhận: bộ mô tả kịch bản như {@link runOn}.
 * Trả: kết quả của bản GỐC, để ca test khẳng định thêm giá trị tuyệt đối.
 */
async function bothWays(scenario: Parameters<typeof runOn>[1]): Promise<RunResult> {
  const ours = await runOn(apply as never, scenario);
  const theirs = await runOn(stock.apply, scenario);
  expect(ours).toEqual(theirs);
  return theirs;
}

/** Tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng). */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-llm-retry-")));
    const ours = exportNames(readFileSync(artifact, "utf8"));
    const theirs = exportNames(readFileSync(new URL(STOCK, import.meta.url), "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual(["Config", "RetryId", "apply", "inject", "name"]);
    expect(ours).not.toContain("default");
  });

  test("name · inject · Config khớp bản gốc từng chữ", () => {
    expect(name).toBe(stock.name);
    expect(name).toBe("llm-retry");
    expect(inject).toEqual(stock.inject);
    expect(inject).toEqual(["agents", "sessionProjections"]);
    // Schema cấu hình: RỖNG (bộ thi hành không có tham số riêng) — nhưng vẫn là schema schemastery
    // gọi được, và in ra ĐÚNG cùng một chuỗi kiểu như bản gốc.
    expect(typeof Config).toBe("function");
    expect(typeof stock.Config).toBe("function");
    expect(String(Config)).toBe(String(stock.Config));
    expect(String(Config)).toBe("{}");
  });

  test("RetryId là hàm đồng nhất: đóng dấu mà KHÔNG đổi giá trị", () => {
    expect(String(RetryId("abc"))).toBe("abc");
    expect(String(stock.RetryId("abc"))).toBe("abc");
  });
});

describe("hàm thuần: đối chứng số học với bản gốc qua chính payload nó ghi", () => {
  test("localDelay: mũ có trần, jitter đối xứng, kẹp trần chính sách", () => {
    const config = { initialDelayMs: 100, maxDelayMs: 250, jitterRatio: 0 };
    expect([1, 2, 3, 4].map((retry) => localDelay(config, retry, () => 0))).toEqual([100, 200, 250, 250]);
    const jittered = { initialDelayMs: 100, maxDelayMs: 1000, jitterRatio: 0.1 };
    expect(localDelay(jittered, 1, () => 0)).toBeCloseTo(90, 10);
    expect(localDelay(jittered, 1, () => 0.5)).toBeCloseTo(100, 10);
    expect(localDelay(jittered, 1, () => 1)).toBeCloseTo(110, 10);
  });

  test("retryPolicyKey: cùng hành vi ⇒ cùng khoá; always bỏ qua ngân sách và tập mã", () => {
    const a = retryPolicyKey(normalPolicy());
    const b = retryPolicyKey(normalPolicy({ retryableCodes: ["SERVER", "RATE_LIMIT"] }));
    expect(a).toBe(b);
    expect(retryPolicyKey(normalPolicy({ maxRetries: 4 }))).not.toBe(a);
    const alwaysA = retryPolicyKey(alwaysPolicy());
    expect(retryPolicyKey(alwaysPolicy({ initialDelayMs: 4 }))).toBe(alwaysA);
  });

  test("retryStateKey: tách trạng thái theo cặp (provider, chính sách)", () => {
    expect(retryStateKey("deepseek", "p")).toBe(retryStateKey("deepseek", "p"));
    expect(retryStateKey("deepseek", "p")).not.toBe(retryStateKey("other", "p"));
  });

  test("cancellableDelay: tín hiệu đã huỷ ⇒ false NGAY, không treo", async () => {
    expect(await cancellableDelay(10_000, AbortSignal.abort())).toBe(false);
    expect(await cancellableDelay(0, new AbortController().signal)).toBe(true);
  });

  test("cancellableDelay: huỷ GIỮA lúc chờ ⇒ false, không treo", async () => {
    const controller = new AbortController();
    const pending = cancellableDelay(5_000, controller.signal);
    setTimeout(() => controller.abort(), 10);
    expect(await pending).toBe(false);
  });
});

describe("hành vi: mọi ca chạy CẢ HAI bản cài trên cùng một giàn", () => {
  test("normal · mã đủ điều kiện ⇒ ghi llm/retry rồi llm/retry-started, trả { kind: retry }", async () => {
    const theirs = await bothWays({ payload: (h) => h.payload({}) });
    expect(theirs.action).toEqual({ kind: "retry" });
    expect(theirs.nextCalls).toBe(0);
    expect(theirs.events).toEqual([
      {
        type: "llm/retry",
        data: {
          retryId: "<retryId>",
          turn: 1,
          step: 2,
          provider: "deepseek",
          mode: "normal",
          policyKey: retryPolicyKey(normalPolicy()),
          retry: 1,
          maxRetries: 3,
          delayMs: 4,
          failure: failure(),
        },
      },
      { type: "llm/retry-started", data: { retryId: "<retryId>", turn: 1, step: 2, retry: 1 } },
    ]);
  });

  test("normal · chuỗi nhiều lần thử: bộ đếm TĂNG và retryId GIỮ NGUYÊN", async () => {
    const theirs = await bothWays({ payload: (h) => h.payload({}), fires: 3 });
    const ids = theirs.events.filter((e) => (e as AppendedEvent).type === "llm/retry").map((e) => (e as AppendedEvent).data.retryId);
    expect(ids).toEqual(["<retryId>", "<retryId>", "<retryId>"]);
    expect(
      theirs.events
        .filter((e) => (e as AppendedEvent).type === "llm/retry-started")
        .map((e) => (e as AppendedEvent).data.retry),
    ).toEqual([1, 2, 3]);
    expect(theirs.action).toEqual({ kind: "retry" });
  });

  test("normal · cạn ngân sách ⇒ nhường tầng dưới, KHÔNG ghi gì", async () => {
    const theirs = await bothWays({
      payload: (h) => h.payload({ retryPolicy: normalPolicy({ maxRetries: 1 }) }),
      fires: 2,
    });
    expect(theirs.nextCalls).toBe(1);
    expect(theirs.action).toBeUndefined();
    expect(theirs.events.length).toBe(2);
  });

  test("normal · mã KHÔNG đủ điều kiện ⇒ nhường ngay, không ghi gì", async () => {
    const theirs = await bothWays({
      payload: (h) => h.payload({ failure: failure({ code: "AUTH" }) }),
    });
    expect(theirs.nextCalls).toBe(1);
    expect(theirs.events).toEqual([]);
  });

  test("không có chính sách ⇒ nhường tầng dưới nguyên trạng", async () => {
    const theirs = await bothWays({
      payload: (h) => h.payload({ retryPolicy: undefined }),
      downstream: { kind: "retry" },
    });
    expect(theirs.action).toEqual({ kind: "retry" });
    expect(theirs.events).toEqual([]);
  });

  test("Retry-After hợp lệ ⇒ DÙNG độ trễ của provider thay backoff cục bộ", async () => {
    const theirs = await bothWays({
      payload: (h) => h.payload({ failure: failure({ providerRetryAfterMs: 30 }) }),
    });
    expect((theirs.events[0] as AppendedEvent).data.delayMs).toBe(30);
  });

  test("Retry-After VƯỢT trần: normal nhường, always dùng backoff cục bộ", async () => {
    const over = 5_000;
    const normal = await bothWays({
      payload: (h) => h.payload({ failure: failure({ providerRetryAfterMs: over }) }),
    });
    expect(normal.nextCalls).toBe(1);
    expect(normal.events).toEqual([]);

    const always = await bothWays({
      payload: (h) => h.payload({ retryPolicy: alwaysPolicy(), failure: failure({ providerRetryAfterMs: over }) }),
    });
    expect((always.events[0] as AppendedEvent).data.delayMs).toBe(4);
    expect((always.events[0] as AppendedEvent).data.mode).toBe("always");
    expect((always.events[0] as AppendedEvent).data).not.toHaveProperty("maxRetries");
  });

  test("always · tầng dưới NHẬN phục hồi ⇒ nhường, không ghi gì", async () => {
    const theirs = await bothWays({
      payload: (h) => h.payload({ retryPolicy: alwaysPolicy() }),
      downstream: { kind: "retry" },
    });
    expect(theirs.action).toEqual({ kind: "retry" });
    expect(theirs.events).toEqual([]);
    expect(theirs.nextCalls).toBe(1);
  });

  test("always · tầng dưới NÉM ⇒ cảnh báo rồi vẫn thử lại (không nổi lỗi ra ngoài)", async () => {
    const h = harness();
    apply(h.ctx, {}, {});
    const listener = h.listeners[0]!;
    const action = await listener(h.payload({ retryPolicy: alwaysPolicy() }), async () => {
      throw new Error("downstream exploded");
    });
    expect(action).toEqual({ kind: "retry" });
    expect(h.warns.length).toBe(1);
    expect(String(h.warns[0]?.[0])).toBe(
      'llm-retry: provider "deepseek" always policy ignored a downstream recovery failure: %o',
    );
    expect(h.appended.length).toBe(2);
  });

  test("tín hiệu ĐÃ huỷ ⇒ không ghi gì, không treo (normal và always)", async () => {
    const aborted = AbortSignal.abort();
    const normal = await bothWays({ payload: (h) => h.payload({ signal: aborted }) });
    expect(normal.action).toBeUndefined();
    expect(normal.events).toEqual([]);

    const always = await bothWays({
      payload: (h) => h.payload({ signal: aborted, retryPolicy: alwaysPolicy() }),
      downstream: { kind: "retry" },
    });
    expect(always.action).toBeUndefined();
    expect(always.events).toEqual([]);
  });

  test("huỷ GIỮA lúc chờ ⇒ không ghi llm/retry-started, trả undefined", async () => {
    // Độ trễ phải DÀI HƠN nhịp huỷ, nếu không hẹn giờ thắng và lượt thử lại hoàn tất trước khi huỷ.
    const slow = () => normalPolicy({ initialDelayMs: 5_000, maxDelayMs: 5_000 });
    const h = harness();
    apply(h.ctx, {}, {});
    const controller = new AbortController();
    const pending = h.listeners[0]!(
      h.payload({ retryPolicy: slow(), signal: controller.signal }),
      async () => undefined,
    );
    setTimeout(() => controller.abort(), 10);
    expect(await pending).toBeUndefined();
    expect(h.appended.map((event) => event.type)).toEqual(["llm/retry"]);

    const stockHarness = harness();
    stock.apply(stockHarness.ctx, {}, {});
    const stockController = new AbortController();
    const stockPending = stockHarness.listeners[0]!(
      stockHarness.payload({ retryPolicy: slow(), signal: stockController.signal }),
      async () => undefined,
    );
    setTimeout(() => stockController.abort(), 10);
    expect(await stockPending).toBeUndefined();
    expect(normalize(stockHarness.appended)).toEqual(normalize(h.appended));
  });

  test("cấu hình sai ⇒ NÉM đúng thông điệp, không treo; cấu hình rỗng thì qua", async () => {
    const h = harness();
    expect(() => apply(h.ctx, { retryPolicy: {} } as never)).toThrow(
      "llm-retry: retryPolicy belongs under each provider configuration",
    );
    expect(() => apply(h.ctx, { unknown: 1 } as never)).toThrow('llm-retry: unknown key "unknown"');
    expect(() => stock.apply(harness().ctx, { retryPolicy: {} })).toThrow(
      "llm-retry: retryPolicy belongs under each provider configuration",
    );
    expect(() => stock.apply(harness().ctx, { unknown: 1 })).toThrow('llm-retry: unknown key "unknown"');
    expect(() => apply(h.ctx, {})).not.toThrow();
  });
});

describe("vòng đời: dọn dẹp đóng cổng phục hồi và rút lui lượt đang chờ", () => {
  test("hàm dọn: gỡ listener TRƯỚC, huỷ vòng đời, rồi chờ các lượt đang chạy lặng hẳn", async () => {
    const h = harness();
    apply(h.ctx, {}, {});
    expect(h.disposers.length).toBe(1);
    const pending = h.listeners[0]!(h.payload({}), async () => undefined);
    await h.disposers[0]!();
    expect(h.listenerDisposed()).toBe(true);
    // Lượt đang chờ bị huỷ theo vòng đời ⇒ thoát ra là undefined, và KHÔNG ghi chuyển tiếp.
    expect(await pending).toBeUndefined();
    expect(h.appended.map((event) => event.type)).toEqual(["llm/retry"]);
  });

  test("listener gọi SAU khi gỡ ⇒ trả undefined NGAY, không gọi tầng dưới", async () => {
    const h = harness();
    apply(h.ctx, {}, {});
    const listener = h.listeners[0]!;
    await h.disposers[0]!();
    let downstreamCalls = 0;
    const action = await listener(h.payload({}), async () => {
      downstreamCalls += 1;
      return undefined;
    });
    expect(action).toBeUndefined();
    expect(downstreamCalls).toBe(0);
    expect(h.appended).toEqual([]);
  });

  test("bộ chiếu llmRetry: reset ở ranh giới bước/lượt, giữ nguyên tham chiếu khi không liên quan", () => {
    const h = harness();
    apply(h.ctx, {}, {});
    const definition = h.definition("llmRetry");
    if (definition === undefined) throw new Error("bộ chiếu llmRetry chưa được đăng ký");
    expect(definition.key).toBe("llmRetry");
    expect((definition as unknown as { stateVersion: number }).stateVersion).toBe(1);
    expect(definition.init({}, 0)).toEqual({});

    const retryEvent = {
      type: "llm/retry",
      data: { provider: "deepseek", policyKey: "k", retry: 1, retryId: "id-1" },
    };
    const afterRetry = definition.apply(definition.init({}, 0), retryEvent) as Record<string, unknown>;
    expect(afterRetry).toEqual({ [retryStateKey("deepseek", "k")]: { retry: 1, retryId: "id-1" } });
    // Bản ghi TRÙNG (cùng retry + cùng retryId) phải trả CÙNG tham chiếu: hạ nguồn không tính lại.
    expect(definition.apply(afterRetry, retryEvent)).toBe(afterRetry);
    // Sự kiện không liên quan cũng phải giữ nguyên tham chiếu.
    expect(definition.apply(afterRetry, { type: "assistant/message", data: {} })).toBe(afterRetry);
    // Ranh giới bước/lượt mở chuỗi mới: trả object RỖNG MỚI.
    expect(definition.apply(afterRetry, { type: "step/start", data: {} })).toEqual({});
    expect(definition.apply(afterRetry, { type: "turn/end", data: {} })).toEqual({});
  });

  test("bộ chiếu llmRetry: schema zod TỪ CHỐI trạng thái lưu sai hình dạng", () => {
    const h = harness();
    apply(h.ctx, {}, {});
    const schema = (h.definition("llmRetry") as unknown as { stateSchema: { parse(value: unknown): unknown } })
      .stateSchema;
    expect(schema.parse({ k: { retry: 2, retryId: "id" } })).toEqual({ k: { retry: 2, retryId: "id" } });
    expect(() => schema.parse({ k: { retry: -1, retryId: "id" } })).toThrow();
    expect(() => schema.parse({ k: { retry: 1 } })).toThrow();
    expect(() => schema.parse({ k: "khong-phai-object" })).toThrow();
  });
});
