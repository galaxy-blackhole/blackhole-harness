/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho gói repeat-tool-reminder: guard lặp lời gọi tool — so TRỰC TIẾP với bundle gốc
 *      trên Context cordis THẬT (người nghe được ghi lại rồi kích hoạt thủ công), 18+ ca
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Import từ NGUỒN (`src/index.ts`) thay vì `lib/index.js`: `lib/` không có `.d.ts` ⇒ TS7016.
import * as ours from "../../packages/host/repeat-tool-reminder/src/index.ts";

/** Thư mục gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const OURS = join(REPO, "packages", "host", "repeat-tool-reminder");
/** Bản gốc trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-repeat-tool-reminder");
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Cordis THẬT của kernel. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Hình dạng plugin (ta hoặc gốc) mà test dùng. */
interface PluginLike {
  /** Tên plugin. */
  readonly name: string;
  /** Schema cấu hình. */
  readonly Config: unknown;
  /** Cài người nghe. */
  readonly apply: (ctx: ContextLike, config: Record<string, unknown>) => void;
}

/** Context cordis thật + sổ người nghe đã ghi lại. */
interface ContextLike {
  /** Đăng ký người nghe (thật). */
  on: (event: string, listener: (...args: unknown[]) => unknown) => () => void;
}

/** Một người nghe đã ghi. */
interface Listener {
  /** Tên event. */
  event: string;
  /** Hàm nghe — `unknown[]` cho khớp chữ ký của `ctx.on` (xem chú thích ở chỗ gán `ctx.on`). */
  fn: (...args: unknown[]) => unknown;
}

/** Nạp bản gốc (đường dẫn chuỗi động để tsc không kéo kiểu vào chương trình). */
async function stockPlugin(): Promise<PluginLike> {
  return (await import(STOCK)) as PluginLike;
}

/** Cấu hình mẫu (đã qua schema của bản gốc để cùng giá trị). */
function configOf(plugin: PluginLike, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const resolved = (plugin.Config as unknown as (value: unknown) => Record<string, unknown>)(overrides);
  return resolved;
}

/**
 * Áp plugin lên MỘT Context cordis thật rồi thu lại người nghe.
 * Nhận: plugin — bản cần áp; overrides — cấu hình thô.
 * Trả: danh sách người nghe + lỗi apply (nếu có).
 */
async function install(plugin: PluginLike, overrides: Record<string, unknown> = {}): Promise<{ listeners: Listener[]; config: Record<string, unknown>; error?: string }> {
  const cordis = (await import(CORDIS)) as { Context: new () => ContextLike };
  const ctx = new cordis.Context();
  const listeners: Listener[] = [];
  const originalOn = ctx.on.bind(ctx);
  // Tham số phải là `unknown[]` (không phải `never[]`): `ctx.on` khai `(...args: unknown[]) => unknown`, mà
  // `never[]` KHÔNG gán được cho `unknown[]` (TS2345) — `never` chỉ nhận chính nó.
  ctx.on = (event: string, fn: (...args: unknown[]) => unknown) => {
    listeners.push({ event, fn });
    return originalOn(event, fn);
  };
  const config = configOf(plugin, overrides);
  try {
    plugin.apply(ctx, config);
    return { listeners, config };
  } catch (error) {
    return { listeners, config, error: (error as Error).message };
  }
}

/** Payload một lần gọi tool. */
interface Exec {
  /** Agent gọi. */
  agent?: object;
  /** Tên tool. */
  name: string;
  /** Tham số. */
  arguments: unknown;
}

/**
 * Kích hoạt người nghe post-execute với downstream cho trước.
 * Nhận: listeners — sổ người nghe; exec — lời gọi; downstream — kết quả phía sau.
 * Trả: kết quả waterfall sau khi guard chèn context.
 */
async function postExecute(listeners: Listener[], exec: Exec, downstream: Record<string, unknown> = { kind: "allow" }): Promise<unknown> {
  const listener = listeners.find((entry) => entry.event === "tools/post-execute");
  if (listener === undefined) return undefined;
  return (listener.fn as (...args: unknown[]) => Promise<unknown>)(exec, { ok: true }, async () => downstream);
}

/**
 * Kích hoạt người nghe pre-step.
 * Nhận: listeners — sổ người nghe; agent — agent; messages — tin nhắn trong lượt.
 * Trả: giá trị next() trả về.
 */
function preStep(listeners: Listener[], agent: object, messages: { source: { kind: string } }[]): unknown {
  const listener = listeners.find((entry) => entry.event === "agent/pre-step");
  if (listener === undefined) return "no-listener";
  return (listener.fn as (...args: unknown[]) => unknown)({ agent, messages }, () => "next");
}

/** Bỏ id ngẫu nhiên khỏi message để so cấu trúc. */
function normalize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, item) => (key === "id" ? undefined : item)),
  ) as unknown;
}

/** Chạy cùng một kịch bản trên cả hai bản rồi trả kết quả đã chuẩn hoá. */
async function both(scenario: (plugin: PluginLike) => Promise<unknown>): Promise<{ ours: unknown; theirs: unknown }> {
  return { ours: normalize(await scenario(ours as unknown as PluginLike)), theirs: normalize(await scenario(await stockPlugin())) };
}

describe("repeat-tool-reminder — export + Config", () => {
  test("artifact export ĐÚNG ba tên như bản gốc", () => {
    const names = (text: string): string[] => {
      const out = new Set<string>();
      for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
        for (const part of (match[1] ?? "").split(",")) {
          const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
          if (name !== undefined && name !== "") out.add(name);
        }
      }
      return [...out].sort();
    };
    const mine = names(readFileSync(join(OURS, "lib", "index.js"), "utf8"));
    expect(mine).toEqual(names(readFileSync(STOCK, "utf8")));
    expect(mine).toEqual(["Config", "apply", "name"]);
  });

  test("String(Config) TRÙNG từng ký tự; mặc định thresholds [3,5,8] · previewChars 500", async () => {
    const stock = await stockPlugin();
    expect(String((ours as unknown as PluginLike).Config)).toBe(String(stock.Config));
    expect(configOf(ours as unknown as PluginLike)).toEqual(configOf(stock));
    expect(configOf(stock)).toEqual({ thresholds: [3, 5, 8], include: [], exclude: [], argumentsPreviewChars: 500 });
  });

  test("locale en/zh CHÉP NGUYÊN VĂN bản gốc", () => {
    for (const file of ["en.json", "zh.json"]) {
      expect(readFileSync(join(OURS, "locale", file)).equals(readFileSync(join(STOCK_DIR, "locale", file)))).toBe(true);
    }
  });
});

describe("repeat-tool-reminder — A/B ngưỡng + chuỗi (Context cordis thật)", () => {
  test("lặp y hệt args: chỉ nhắc ở ngưỡng 3 (câu nhẹ), hai bản cùng message", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin);
      const agent = {};
      const outputs: unknown[] = [];
      for (let index = 1; index <= 3; index += 1) outputs.push(await postExecute(listeners, { agent, name: "read", arguments: { path: "a" } }));
      return outputs;
    });
    expect(result.ours).toEqual(result.theirs);
    const outputs = result.ours as { additionalContexts?: { source: { kind: string; summary?: string } }[] }[];
    expect(outputs[0]?.additionalContexts).toBeUndefined();
    expect(outputs[1]?.additionalContexts).toBeUndefined();
    expect(outputs[2]?.additionalContexts?.length).toBe(1);
    expect(outputs[2]?.additionalContexts?.[0]?.source.kind).toBe("repeat-tool-reminder");
    expect(outputs[2]?.additionalContexts?.[0]?.source.summary).toBe("read × 3");
  });

  test("ngưỡng 5 và 8: câu chi tiết (kèm tên tool + số lần + args), hai bản như nhau", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin, { thresholds: [3, 5, 8] });
      const agent = {};
      const outputs: unknown[] = [];
      for (let index = 1; index <= 8; index += 1) outputs.push(await postExecute(listeners, { agent, name: "grep", arguments: { pattern: "x" } }));
      return outputs;
    });
    expect(result.ours).toEqual(result.theirs);
    const outputs = result.ours as { additionalContexts?: { content: { text: string }[] }[] }[];
    const detail5 = outputs[4]?.additionalContexts?.[0]?.content[0]?.text ?? "";
    const detail8 = outputs[7]?.additionalContexts?.[0]?.content[0]?.text ?? "";
    expect(detail5).toContain("Repeated tool call detected:");
    expect(detail5).toContain("consecutive_calls: 5");
    expect(detail8).toContain("consecutive_calls: 8");
  });

  test("thứ tự khoá args khác nhau ⇒ VẪN cùng chuỗi (canonicalize)", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin);
      const agent = {};
      const outputs: unknown[] = [];
      outputs.push(await postExecute(listeners, { agent, name: "t", arguments: { a: 1, b: 2 } }));
      outputs.push(await postExecute(listeners, { agent, name: "t", arguments: { b: 2, a: 1 } }));
      outputs.push(await postExecute(listeners, { agent, name: "t", arguments: { a: 1, b: 2 } }));
      return outputs;
    });
    expect(result.ours).toEqual(result.theirs);
    const outputs = result.ours as { additionalContexts?: unknown[] }[];
    expect(outputs[2]?.additionalContexts?.length).toBe(1);
  });

  test("args khác ⇒ chuỗi reset (không nhắc ở lần 3)", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin);
      const agent = {};
      await postExecute(listeners, { agent, name: "t", arguments: { a: 1 } });
      await postExecute(listeners, { agent, name: "t", arguments: { a: 2 } });
      return postExecute(listeners, { agent, name: "t", arguments: { a: 3 } });
    });
    expect(result.ours).toEqual(result.theirs);
    expect((result.ours as { additionalContexts?: unknown[] }).additionalContexts).toBeUndefined();
  });

  test("hai agent KHÁC nhau ⇒ chuỗi riêng", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin);
      const first = {};
      const second = {};
      await postExecute(listeners, { agent: first, name: "t", arguments: {} });
      await postExecute(listeners, { agent: first, name: "t", arguments: {} });
      await postExecute(listeners, { agent: second, name: "t", arguments: {} });
      return postExecute(listeners, { agent: first, name: "t", arguments: {} });
    });
    expect(result.ours).toEqual(result.theirs);
    expect((result.ours as { additionalContexts?: unknown[] }).additionalContexts?.length).toBe(1);
  });

  test("include: chỉ tool khớp mẫu wildcard được theo dõi", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin, { include: ["read_*"] });
      const agent = {};
      for (let index = 0; index < 3; index += 1) await postExecute(listeners, { agent, name: "write", arguments: {} });
      const untracked = await postExecute(listeners, { agent, name: "write", arguments: {} });
      const trackedOutputs: unknown[] = [];
      for (let index = 0; index < 4; index += 1) trackedOutputs.push(await postExecute(listeners, { agent, name: "read_file", arguments: {} }));
      // Ngưỡng 3: nhắc đúng ở lần thứ BA của tool KHỚP mẫu; lần thứ tư (count 4) không nhắc.
      return { untracked, tracked: trackedOutputs, atThreshold: trackedOutputs[2], pastThreshold: trackedOutputs[3] };
    });
    expect(result.ours).toEqual(result.theirs);
    expect((result.ours as { untracked: { additionalContexts?: unknown[] } }).untracked.additionalContexts).toBeUndefined();
    expect((result.ours as { atThreshold: { additionalContexts?: unknown[] } }).atThreshold.additionalContexts?.length).toBe(1);
    expect((result.ours as { pastThreshold: { additionalContexts?: unknown[] } }).pastThreshold.additionalContexts).toBeUndefined();
  });

  test("exclude: tool bị loại là TRONG SUỐT (không đếm, không reset chuỗi)", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin, { exclude: ["noise"] });
      const agent = {};
      await postExecute(listeners, { agent, name: "read", arguments: {} });
      await postExecute(listeners, { agent, name: "noise", arguments: {} });
      await postExecute(listeners, { agent, name: "read", arguments: {} });
      return postExecute(listeners, { agent, name: "read", arguments: {} });
    });
    expect(result.ours).toEqual(result.theirs);
    expect((result.ours as { additionalContexts?: unknown[] }).additionalContexts?.length).toBe(1);
  });

  test("tin nhắn NGƯỜI DÙNG ở pre-step cắt chuỗi (cùng hành vi)", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin);
      const agent = {};
      await postExecute(listeners, { agent, name: "t", arguments: {} });
      await postExecute(listeners, { agent, name: "t", arguments: {} });
      const nextValue = preStep(listeners, agent, [{ source: { kind: "user" } }]);
      const afterReset = await postExecute(listeners, { agent, name: "t", arguments: {} });
      return { nextValue, afterReset };
    });
    expect(result.ours).toEqual(result.theirs);
    expect((result.ours as { nextValue: string }).nextValue).toBe("next");
    expect((result.ours as { afterReset: { additionalContexts?: unknown[] } }).afterReset.additionalContexts).toBeUndefined();
  });

  test("pre-step không có tin nhắn user ⇒ KHÔNG reset (vẫn nhắc ở ngưỡng)", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin);
      const agent = {};
      await postExecute(listeners, { agent, name: "t", arguments: {} });
      await postExecute(listeners, { agent, name: "t", arguments: {} });
      preStep(listeners, agent, [{ source: { kind: "tool" } }]);
      return postExecute(listeners, { agent, name: "t", arguments: {} });
    });
    expect(result.ours).toEqual(result.theirs);
    expect((result.ours as { additionalContexts?: unknown[] }).additionalContexts?.length).toBe(1);
  });

  test("downstream block: giữ feedback + chèn nhắc TRƯỚC context của phía sau", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin);
      const agent = {};
      await postExecute(listeners, { agent, name: "t", arguments: {} });
      await postExecute(listeners, { agent, name: "t", arguments: {} });
      return postExecute(listeners, { agent, name: "t", arguments: {} }, {
        kind: "block",
        feedback: "bị chặn",
        additionalContexts: [{ source: { kind: "other-guard" } }],
      });
    });
    expect(result.ours).toEqual(result.theirs);
    const output = result.ours as { kind: string; feedback: string; additionalContexts: { source: { kind: string } }[] };
    expect(output.kind).toBe("block");
    expect(output.feedback).toBe("bị chặn");
    expect(output.additionalContexts.map((entry) => entry.source.kind)).toEqual(["repeat-tool-reminder", "other-guard"]);
  });

  test("không có agent ⇒ không theo dõi, không nhắc (hai bản như nhau)", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin);
      const outputs: unknown[] = [];
      for (let index = 0; index < 4; index += 1) outputs.push(await postExecute(listeners, { name: "t", arguments: {} }));
      return outputs;
    });
    expect(result.ours).toEqual(result.theirs);
    for (const output of result.ours as { additionalContexts?: unknown[] }[]) expect(output.additionalContexts).toBeUndefined();
  });
});

describe("repeat-tool-reminder — validate + cắt args", () => {
  test("argumentsPreviewChars: cắt đầu + hậu tố '… (+N more chars)' đúng cả hai bản", async () => {
    const result = await both(async (plugin) => {
      // thresholds [2,3]: count 2 = câu NHẸ, count 3 = câu CHI TIẾT (mới chứa phần cắt args).
      const { listeners } = await install(plugin, { thresholds: [2, 3], argumentsPreviewChars: 10 });
      const agent = {};
      await postExecute(listeners, { agent, name: "t", arguments: { long: "x".repeat(40) } });
      await postExecute(listeners, { agent, name: "t", arguments: { long: "x".repeat(40) } });
      return postExecute(listeners, { agent, name: "t", arguments: { long: "x".repeat(40) } });
    });
    expect(result.ours).toEqual(result.theirs);
    const text = (result.ours as { additionalContexts: { content: { text: string }[] }[] }).additionalContexts[0]?.content[0]?.text ?? "";
    expect(text).toContain("more chars)");
  });

  test("thresholds rỗng / không nguyên / nhỏ hơn 2 / trùng / previewChars sai: cùng thông điệp lỗi", async () => {
    const stock = await stockPlugin();
    const cases: Record<string, unknown>[] = [
      { thresholds: [] },
      { thresholds: [2.5] },
      { thresholds: [1] },
      { thresholds: [3, 3] },
      { argumentsPreviewChars: 0 },
    ];
    for (const overrides of cases) {
      const mine = await install(ours as unknown as PluginLike, overrides);
      const theirs = await install(stock, overrides);
      expect(mine.error).toBe(theirs.error);
      expect(mine.error).toBeDefined();
    }
  });

  test("thresholds không sắp xếp vẫn được chuẩn hoá tăng dần (ngưỡng nhẹ là MIN)", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin, { thresholds: [5, 2, 3] });
      const agent = {};
      const outputs: unknown[] = [];
      for (let index = 1; index <= 2; index += 1) outputs.push(await postExecute(listeners, { agent, name: "t", arguments: {} }));
      return outputs;
    });
    expect(result.ours).toEqual(result.theirs);
    const outputs = result.ours as { additionalContexts?: { content: { text: string }[] }[] }[];
    expect(outputs[0]?.additionalContexts).toBeUndefined();
    expect(outputs[1]?.additionalContexts?.[0]?.content[0]?.text).toContain("You are repeating the exact same tool call");
  });

  test("apply không ném với cấu hình mặc định và đăng ký ĐÚNG hai event", async () => {
    const result = await both(async (plugin) => {
      const { listeners } = await install(plugin);
      return listeners.map((entry) => entry.event).sort();
    });
    expect(result.ours).toEqual(result.theirs);
    expect(result.ours).toEqual(["agent/pre-step", "tools/post-execute"]);
  });

  test("Config mặc định đọc trực tiếp từ schema (không qua apply)", async () => {
    const stock = await stockPlugin();
    const mine = (ours as unknown as PluginLike).Config as unknown as (value: unknown) => Record<string, unknown>;
    const theirs = stock.Config as unknown as (value: unknown) => Record<string, unknown>;
    expect(mine({})).toEqual(theirs({}));
    expect(mine({ thresholds: [7] })).toEqual(theirs({ thresholds: [7] }));
  });
});
