/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-message-feedback: tập export đo trên ARTIFACT đối chứng
 *      với chính bundle gốc, kịch bản 13 bước chạy trên CÙNG một giàn giả cho CẢ HAI bản (list · put ·
 *      delete · lượt không-đổi · xung đột phiên bản · ghi chú rỗng/quá trần · phiên vắng), đường LIVE
 *      (hàng rào bền vững + tiền tố không bền vững), event feedback/committed, cổng dọn, C6 danh tính,
 *      quy ước gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM, 000e locale byte-for-byte, và HỢP ĐỒNG
 *      metadata cho \`gbh.row\` do LEAD khai.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, existsSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/message-feedback/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục package của ta. */
const PKG = join(REPO, "packages", "host", "message-feedback");
/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");
/** Thư mục bản gốc trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-message-feedback");
/** Artifact bản gốc (CHỈ ĐỌC). */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis mà CHÍNH package ta nạp (phải cùng thể hiện thì `Service.init` mới là một khoá). */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Khoá `Service.init` của đúng thể hiện cordis mà artifact của ta nạp. */
const { Service } = (await import(CORDIS)) as { Service: { init: symbol } };

/** Thư mục build tạm (nằm dưới node_modules của gói — gitignore + cổng lint miễn trừ) cho artefact của ta. */
const OUT = join(PKG, "node_modules", ".test-lib");
// LƯỢT ĐO 01/11/2026: nạp artefact trong "profile giả" — `node_modules/@deepseek-ai` trỏ KERNEL, đúng cách
// mount thật symlink peer. Nạp thẳng `src/index.ts` thì `@deepseek-ai/dsh-typert-protocol` phân giải về bản
// sao workspace (cùng nội dung, KHÁC mô-đun): lớp nền của ta khác lớp nền của gốc nên `getPrototypeOf` lệch.
const OUR_ENTRY = await buildPackage(OUT);
mkdirSync(join(OUT, "node_modules"), { recursive: true });
symlinkSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), join(OUT, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");

/** Bề mặt module của bản TA (nạp từ artefact). */
interface OurModule {
  /** Lớp service. */
  MessageFeedbackService: PluginClass;
  /** Export mặc định — phải CHÍNH LÀ lớp service. */
  default: PluginClass;
}

/** Module đã build của ta. */
const oursModule = (await import(OUR_ENTRY)) as OurModule;
/** Lớp service của ta — LẤY TỪ ARTEFACT (peer trong artefact trỏ kernel). */
const MessageFeedbackService = oursModule.MessageFeedbackService;
/** Export default của ta. */
const MessageFeedbackDefault = oursModule.default;

/** Dọn thư mục build tạm sau khi xong. */
afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as { default: PluginClass };

/** Hình dạng tối thiểu của lớp plugin (dùng chung cho bản của ta lẫn bản gốc). */
interface PluginClass {
  /** Seam bắt buộc khai trên lớp. */
  inject: string[];
  /** Schema cấu hình (schemastery). */
  Config: (value: unknown) => Record<string, unknown>;
  /** Dựng thực thể plugin trên một context. */
  new (ctx: unknown, config: unknown): Record<symbol, unknown>;
}

/** Bề mặt service mà kịch bản chạm tới. */
interface ServiceApi {
  /** Đọc phản hồi hiện tại của một phiên. */
  list(request: { sessionId: string }): Promise<unknown>;
  /** Tạo/thay phản hồi cho một tin nhắn. */
  put(request: {
    sessionId: string;
    messageId: string;
    rating: "positive" | "negative";
    note?: string;
    category?: string;
    ifVersion: string | null;
  }): Promise<unknown>;
  /** Xoá phản hồi sau khi kiểm phiên bản. */
  delete(request: { sessionId: string; messageId: string; ifVersion: string }): Promise<unknown>;
}

/** Một event giả trong log — đúng hình dạng mà row này ĐỌC (type · seq · time · surfaceOp · data). */
type FixtureEvent = Record<string, unknown>;

/** Giàn giả dùng chung được cho CẢ bản của ta lẫn bản gốc. */
interface Harness {
  /** Context đưa cho lớp plugin. */
  ctx: unknown;
  /** Log lạnh của từng phiên (handle đọc/ghi trên CHÍNH mảng này). */
  logs: Map<string, FixtureEvent[]>;
  /** Phiên đang sống: event do `live.append` ghi vào log lạnh cùng phiên. */
  liveLogs: Map<string, FixtureEvent[]>;
  /** Payload của mọi lượt `feedback/committed`. */
  committed: unknown[];
  /** Nhãn hiệu ứng đã đăng ký + hàm dọn của nó. */
  effects: { label: string; dispose: () => Promise<void> }[];
  /** Cảnh báo đã ghi qua `ctx.logger.warn`. */
  warnings: unknown[][];
  /** Bật: `sessions.flush` trả `false` (không listener bền vững nào tham gia). */
  flushParticipates: boolean;
  /** Bật: handle đọc trả TIỀN TỐ KHÁC log lạnh (mô phỏng phản hồi chưa bền vững). */
  prefixMismatch: boolean;
  /** Bật: người quan sát `feedback/committed` NÉM. */
  observerThrows: boolean;
  /** Chạy mọi hàm dọn hiệu ứng (mô phỏng unloading của cordis). */
  disposeEffects: () => Promise<void>;
}

/**
 * Dựng giàn giả tối thiểu nhưng ĐÚNG hình dạng seam mà row này chạm.
 * Nhận: log ban đầu của phiên lạnh + tập id phiên đang sống.
 * Trả: giàn với log, sổ event đã quan sát và các cờ điều khiển đường lỗi.
 */
function harness(seed: Record<string, FixtureEvent[]> = {}, liveSessions: string[] = []): Harness {
  const logs = new Map<string, FixtureEvent[]>();
  for (const [id, events] of Object.entries(seed)) logs.set(id, [...events]);
  const liveLogs = new Map<string, FixtureEvent[]>();
  for (const id of liveSessions) {
    const events = logs.get(id) ?? [];
    logs.set(id, events);
    liveLogs.set(id, events);
  }
  const harnessState: Harness = {
    ctx: undefined,
    logs,
    liveLogs,
    committed: [],
    effects: [],
    warnings: [],
    flushParticipates: true,
    prefixMismatch: false,
    observerThrows: false,
    disposeEffects: async () => {
      for (const effect of [...harnessState.effects].reverse()) await effect.dispose();
    },
  };
  /** Header mà handle trả về — KHỚP header của phiên sống khi phiên đang sống. */
  const headerOf = (id: string): Record<string, unknown> => ({ id, createdAt: 1, cwd: "/tmp" });
  /** Handle giả trên CHÍNH mảng event của phiên. */
  const handleOf = (id: string): Record<string, unknown> => ({
    header: headerOf(id),
    inheritedEventCount: 0,
    read: async (offset = 0, length?: number) => {
      const events = logs.get(id) ?? [];
      const slice = length === undefined ? events.slice(offset) : events.slice(offset, offset + length);
      // Tiền tố KHÔNG bền vững: trả bản sao đã bị cắt event cuối.
      return { events: harnessState.prefixMismatch ? slice.slice(0, Math.max(0, slice.length - 1)) : slice };
    },
    append: async (batch: FixtureEvent[]) => {
      const events = logs.get(id) ?? [];
      events.push(...batch);
      logs.set(id, events);
    },
    flush: async () => undefined,
    close: async () => undefined,
  });
  const ctx = {
    reflect: { provide: () => () => undefined },
    effect: (execute: () => () => Promise<void>, label?: string) => {
      const dispose = execute();
      harnessState.effects.push({ label: label ?? "", dispose });
      return dispose;
    },
    sessions: {
      get: (id: string) => {
        const events = liveLogs.get(id);
        if (events === undefined) return undefined;
        return {
          header: headerOf(id),
          snapshotEvents: () => events,
          append: (type: string, data: unknown) => {
            events.push({ type, seq: events.length, time: 9_000 + events.length, data });
          },
        };
      },
      flush: async () => harnessState.flushParticipates,
    },
    sessionPersistence: {
      stat: async (id: string) => (logs.has(id) ? { header: headerOf(id), revision: 1 } : undefined),
      open: async (id: string) => handleOf(id),
    },
    parallel: async (name: string, payload: unknown) => {
      if (name === "feedback/committed") harnessState.committed.push(payload);
      if (harnessState.observerThrows) throw new Error("người quan sát hỏng");
    },
    logger: {
      warn: (...args: unknown[]) => {
        harnessState.warnings.push(args);
      },
    },
  };
  harnessState.ctx = ctx;
  return harnessState;
}

/**
 * Dựng một thực thể service từ lớp bất kỳ (của ta hoặc bản gốc) trên một giàn giả.
 * Nhận: lớp plugin, context giả, cấu hình.
 * Trả: bề mặt service để kịch bản gọi.
 */
function boot(plugin: PluginClass, ctx: unknown, config: Record<string, unknown> = { maxNoteBytes: 16 }): ServiceApi {
  const instance = new plugin(ctx, config);
  // Chạy `[Service.init]` đúng như cordis làm sau khi dựng lớp plugin.
  const init = instance[Service.init] as (() => void) | undefined;
  if (typeof init !== "function") throw new Error("thiếu [Service.init] trên lớp");
  init.call(instance);
  return instance as unknown as ServiceApi;
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

/**
 * Thay mọi giá trị BIẾN THIÊN bằng nhãn cố định để hai bản so được với nhau.
 * Nhận: giá trị bất kỳ (kết quả service, payload event, log).
 * Trả: bản sao đã chuẩn hoá `version`/`createdAt`/`updatedAt`/`time`.
 */
function normalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalise);
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (key === "version") out[key] = "<version>";
    else if (key === "createdAt" || key === "updatedAt" || key === "time") out[key] = "<ts>";
    else out[key] = normalise(inner);
  }
  return out;
}

/**
 * Log đã chuẩn hoá của các event PHẢN HỒI trong một phiên (bỏ seq/time biến thiên).
 * Nhận: giàn giả và id phiên.
 * Trả: mảng mô tả event phản hồi theo thứ tự ghi — event khác của phiên không tính.
 */
function logOf(state: Harness, sessionId: string): unknown[] {
  return (state.logs.get(sessionId) ?? [])
    .filter((event) => String(event["type"]).startsWith("feedback/"))
    .map((event) => normalise({ type: event["type"], data: event["data"] }));
}

/** Thân của MỘT event assistant gốc-append: đích hợp lệ cho phản hồi. */
function assistantEvent(seq: number, id: string, text = "xin chào"): FixtureEvent {
  return {
    type: "assistant/message",
    seq,
    time: 1_000 + seq,
    surfaceOp: "append",
    data: { message: { id, role: "assistant", content: [{ type: "text", text }] } },
  };
}

/** Thân của một event thay thế (KHÔNG phải gốc-append): đích KHÔNG hợp lệ. */
function replacementEvent(seq: number, id: string): FixtureEvent {
  return {
    type: "assistant/message",
    seq,
    time: 1_000 + seq,
    surfaceOp: "replace",
    data: { message: { id, role: "assistant", content: [{ type: "text", text: "bản thay thế" }] } },
  };
}

describe("row message-feedback · tập export đo trên ARTIFACT", () => {
  test("ta = gốc (0 thiếu · 0 thừa), build nhận argv[2], artifact KHÔNG đăng ký id module nào", async () => {
    const out = OUT;
    const built = OUR_ENTRY;
    expect(existsSync(built)).toBe(true);
    const ours = exportNames(readFileSync(built, "utf8"));
    const theirs = exportNames(readFileSync(STOCK, "utf8"));
    expect(theirs.length).toBeGreaterThan(0);
    expect(ours.filter((name) => !theirs.includes(name))).toEqual([]);
    expect(theirs.filter((name) => !ours.includes(name))).toEqual([]);
    expect(ours).toEqual(["MessageFeedbackService", "default"]);
    // Row HOST: bản build KHÔNG được đăng ký id module nào (bảng module là chuyện của nửa client).
    expect(readFileSync(built, "utf8").match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    // Đầu ra phụ `./types` như bản gốc (`lib/types/types.js` rỗng lúc chạy).
    expect(existsSync(join(out, "types.js"))).toBe(true);
    expect(readFileSync(join(out, "types.js"), "utf8").trim()).toBe("");
    // Hợp đồng build: tầng mount truyền thư mục đích qua argv[2].
    expect(readFileSync(join(PKG, "build.ts"), "utf8").includes("process.argv[2]")).toBe(true);
  });

  test("bề mặt export của module đã build: đúng hai tên, `default` CHÍNH LÀ lớp service", () => {
    expect(MessageFeedbackDefault).toBe(MessageFeedbackService);
    expect(Object.keys({ MessageFeedbackDefault, MessageFeedbackService }).sort()).toEqual([
      "MessageFeedbackDefault",
      "MessageFeedbackService",
    ]);
  });

  test("kế thừa ĐÚNG lớp nền của kernel + seam inject y hệt bản gốc", () => {
    // Hai bản sao lớp nền ⇒ Gateway không discovery được ⇒ hành vi lệch mà cổng không thấy.
    expect(Object.getPrototypeOf(MessageFeedbackService)).toBe(Object.getPrototypeOf(stock.default));
    expect(Object.getPrototypeOf(MessageFeedbackService).name).toBe("TypertRemoteService");
    expect(MessageFeedbackService.inject).toEqual(stock.default.inject);
    expect(MessageFeedbackService.inject).toEqual(["sessionPersistence", "sessions"]);
  });

  test("Config: cùng chuỗi schema và cùng ma trận chấp nhận/từ chối với bản gốc", () => {
    expect(String(MessageFeedbackService.Config)).toBe(String(stock.default.Config));
    const ours = MessageFeedbackService.Config as unknown as PluginClass["Config"];
    const theirs = stock.default.Config;
    for (const raw of [{ maxNoteBytes: 8192 }, { maxNoteBytes: 1 }, { maxNoteBytes: 0 }, {}, { maxNoteBytes: 1.5 }]) {
      const run = (schema: PluginClass["Config"]): string => {
        try {
          return JSON.stringify(schema(raw));
        } catch (error) {
          return "NÉM: " + String((error as Error).message).split("\n")[0];
        }
      };
      expect(run(ours)).toBe(run(theirs));
    }
    expect(() => new MessageFeedbackService(harness().ctx as never, { maxNoteBytes: 0 })).toThrow(
      "message-feedback: maxNoteBytes must be a positive safe integer",
    );
  });
});

describe("row message-feedback · kịch bản 13 bước, ĐỐI CHỨNG với CHÍNH bundle gốc", () => {
  /** Một bước của kịch bản: nhãn + phép gọi + kỳ vọng dạng chuỗi đã chuẩn hoá. */
  interface Step {
    /** Nhãn hiện trong thông báo lỗi. */
    label: string;
    /** Phép gọi service. */
    run: (service: ServiceApi) => Promise<unknown>;
  }

  const steps: Step[] = [
    { label: "list phiên rỗng", run: async (s) => s.list({ sessionId: "s1" }) },
    { label: "list phiên vắng", run: async (s) => s.list({ sessionId: "khong-co" }) },
    {
      label: "put vào tin nhắn không tồn tại",
      run: async (s) => s.put({ sessionId: "s1", messageId: "m-la", rating: "positive", ifVersion: null }),
    },
    {
      label: "put ghi chú rỗng",
      run: async (s) => s.put({ sessionId: "s1", messageId: "m1", rating: "positive", note: "   ", ifVersion: null }),
    },
    {
      label: "put ghi chú quá trần byte",
      run: async (s) => s.put({ sessionId: "s1", messageId: "m1", rating: "positive", note: "ế".repeat(9), ifVersion: null }),
    },
    {
      label: "put tạo mới",
      run: async (s) =>
        s.put({ sessionId: "s1", messageId: "m1", rating: "positive", note: "ổn", category: "task-result", ifVersion: null }),
    },
    {
      label: "put lặp y hệt (không đổi ⇒ không ghi event)",
      run: async (s) => {
        const first = (await s.list({ sessionId: "s1" })) as { value?: { items?: { version?: string }[] } };
        const version = first.value?.items?.[0]?.version ?? "";
        return s.put({ sessionId: "s1", messageId: "m1", rating: "positive", note: "ổn", category: "task-result", ifVersion: version });
      },
    },
    {
      label: "put phiên bản cũ (xung đột)",
      run: async (s) => s.put({ sessionId: "s1", messageId: "m1", rating: "negative", ifVersion: null }),
    },
    {
      label: "put đổi đánh giá với phiên bản đúng",
      run: async (s) => {
        const first = (await s.list({ sessionId: "s1" })) as { value?: { items?: { version?: string }[] } };
        const version = first.value?.items?.[0]?.version ?? "";
        return s.put({ sessionId: "s1", messageId: "m1", rating: "negative", note: "hụt", ifVersion: version });
      },
    },
    {
      label: "put đích là event THAY THẾ (không phải gốc-append)",
      run: async (s) => s.put({ sessionId: "s1", messageId: "m2", rating: "positive", ifVersion: null }),
    },
    {
      label: "delete phiên bản cũ (xung đột)",
      run: async (s) => s.delete({ sessionId: "s1", messageId: "m1", ifVersion: "00000000-0000-4000-8000-000000000000" }),
    },
    {
      label: "delete phiên bản đúng",
      run: async (s) => {
        const first = (await s.list({ sessionId: "s1" })) as { value?: { items?: { version?: string }[] } };
        const version = first.value?.items?.[0]?.version ?? "";
        return s.delete({ sessionId: "s1", messageId: "m1", ifVersion: version });
      },
    },
    { label: "delete lần hai (mục đã vắng ⇒ vẫn thành công)", run: async (s) => s.delete({ sessionId: "s1", messageId: "m1", ifVersion: "x" }) },
    { label: "list sau khi xoá", run: async (s) => s.list({ sessionId: "s1" }) },
  ];

  test("14 bước trên CÙNG một giàn giả: kết quả + LOG khớp từng bước giữa ta và gốc", async () => {
    /** Chạy cả kịch bản trên một giàn MỚI và trả vết đã chuẩn hoá. */
    const trace = async (plugin: PluginClass): Promise<{ results: unknown[]; logs: unknown[]; committed: number }> => {
      const state = harness({ s1: [assistantEvent(0, "m1"), replacementEvent(1, "m2")] });
      const service = boot(plugin, state.ctx);
      const results: unknown[] = [];
      for (const step of steps) {
        let result: unknown;
        try {
          result = { ok: await step.run(service) };
        } catch (error) {
          result = { threw: String((error as Error).message) };
        }
        results.push({ label: step.label, result: normalise(result) });
      }
      return { results, logs: logOf(state, "s1"), committed: state.committed.length };
    };
    const ours = await trace(MessageFeedbackService as unknown as PluginClass);
    const theirs = await trace(stock.default);
    expect(ours.logs).toEqual(theirs.logs);
    expect(ours.committed).toBe(theirs.committed);
    expect(ours.committed).toBe(3);
    for (const [index, step] of ours.results.entries()) {
      expect({ step: (step as { label: string }).label, value: step }).toEqual({
        step: (theirs.results[index] as { label: string }).label,
        value: theirs.results[index],
      });
    }
    // Nội dung kỳ vọng — không chỉ "hai bản giống nhau": ba event đã ghi và hai lượt không-đổi.
    expect(ours.logs).toEqual([
      { type: "feedback/message-put", data: { sessionId: "s1", item: { messageId: "m1", rating: "positive", note: "ổn", category: "task-result", version: "<version>", createdAt: "<ts>", updatedAt: "<ts>" } } },
      { type: "feedback/message-put", data: { sessionId: "s1", item: { messageId: "m1", rating: "negative", note: "hụt", version: "<version>", createdAt: "<ts>", updatedAt: "<ts>" } } },
      { type: "feedback/message-delete", data: { sessionId: "s1", messageId: "m1" } },
    ]);
  });

  test("mã lỗi + thông điệp cụ thể của từng đường sai (đọc TRỰC TIẾP, không chỉ so hai bản)", async () => {
    const state = harness({ s1: [assistantEvent(0, "m1")] });
    const service = boot(MessageFeedbackService as unknown as PluginClass, state.ctx);
    const put = (request: Parameters<ServiceApi["put"]>[0]): Promise<unknown> => service.put(request);
    expect(await service.list({ sessionId: "khong-co" })).toEqual({
      ok: false,
      error: { code: "session-not-found", sessionId: "khong-co" },
    });
    expect(await put({ sessionId: "s1", messageId: "m-la", rating: "positive", ifVersion: null })).toEqual({
      ok: false,
      error: { code: "target-not-found", sessionId: "s1", messageId: "m-la" },
    });
    expect(await put({ sessionId: "s1", messageId: "m1", rating: "positive", note: " ", ifVersion: null })).toEqual({
      ok: false,
      error: { code: "note-blank" },
    });
    // "ế" là 3 byte UTF-8 ⇒ 6 ký tự = 18 byte > trần 16.
    expect(await put({ sessionId: "s1", messageId: "m1", rating: "positive", note: "ếếếếếế", ifVersion: null })).toEqual({
      ok: false,
      error: { code: "note-too-large", maxBytes: 16, actualBytes: 18 },
    });
    // KHÔNG lượt nào ở trên được ghi event phản hồi (kiểm trước khi vào hàng đợi hoặc từ chối sớm).
    expect(logOf(state, "s1")).toEqual([]);
  });

  test("event feedback/committed: payload đúng tiền tố + event cuối; người quan sát NÉM chỉ ghi cảnh báo", async () => {
    for (const plugin of [MessageFeedbackService as unknown as PluginClass, stock.default]) {
      const state = harness({ s1: [assistantEvent(0, "m1")] });
      const service = boot(plugin, state.ctx);
      const result = await service.put({ sessionId: "s1", messageId: "m1", rating: "positive", ifVersion: null });
      expect((result as { ok: boolean }).ok).toBe(true);
      expect(state.committed).toHaveLength(1);
      const payload = state.committed[0] as { meta: { id: string }; inheritedEventCount: number; events: FixtureEvent[] };
      expect(payload.meta.id).toBe("s1");
      expect(payload.inheritedEventCount).toBe(0);
      expect(payload.events).toHaveLength(2);
      expect(payload.events[1]?.["type"]).toBe("feedback/message-put");
      // Người quan sát NÉM ⇒ thao tác VẪN thành công, chỉ một cảnh báo đúng thông điệp của bản gốc.
      state.observerThrows = true;
      const second = await service.put({ sessionId: "s1", messageId: "m1", rating: "negative", ifVersion: ((result as { value: { version: string } }).value.version) });
      expect((second as { ok: boolean }).ok).toBe(true);
      expect(state.warnings).toHaveLength(1);
      expect(state.warnings[0]?.[0]).toBe("message-feedback: committed feedback observer failed");
    }
  });
});

describe("row message-feedback · đường LIVE (phiên đang sống) — đối chứng hai bản", () => {
  test("ghi qua chủ sở hữu SỐNG: event đi thẳng vào phiên sống, KHÔNG qua handle lạnh", async () => {
    for (const plugin of [MessageFeedbackService as unknown as PluginClass, stock.default]) {
      const state = harness({ s2: [assistantEvent(0, "m1")] }, ["s2"]);
      const service = boot(plugin, state.ctx);
      const ok = (await service.put({ sessionId: "s2", messageId: "m1", rating: "positive", ifVersion: null })) as {
        ok: boolean;
        value: { version: string };
      };
      expect(ok.ok).toBe(true);
      const events = state.liveLogs.get("s2") ?? [];
      expect(events).toHaveLength(2);
      expect(events[1]?.["type"]).toBe("feedback/message-put");
      // Phiên SỐNG: chủ sở hữu sống đã ghi ⇒ KHÔNG phát \`feedback/committed\` (event đó chỉ cho lượt LẠNH).
      expect(state.committed).toHaveLength(0);
    }
  });

  test("hai lỗi bền vững của đường LIVE trùng thông điệp TỪNG CHỮ với bản gốc", async () => {
    for (const plugin of [MessageFeedbackService as unknown as PluginClass, stock.default]) {
      // (a) không listener bền vững nào tham gia ⇒ hàng rào flush trả \`false\`.
      const noListener = harness({ s2: [assistantEvent(0, "m1")] }, ["s2"]);
      const firstService = boot(plugin, noListener.ctx);
      const created = (await firstService.put({ sessionId: "s2", messageId: "m1", rating: "positive", ifVersion: null })) as {
        value: { version: string };
      };
      noListener.flushParticipates = false;
      await expect(
        firstService.put({ sessionId: "s2", messageId: "m1", rating: "negative", ifVersion: created.value.version }),
      ).rejects.toThrow("message-feedback: no durability listener participated for live session 's2'");

      // (b) tiền tố đọc lại KHÔNG khớp event cuối ⇒ phản hồi chưa bền vững.
      const stalePrefix = harness({ s2: [assistantEvent(0, "m1")] }, ["s2"]);
      const secondService = boot(plugin, stalePrefix.ctx);
      const createdAgain = (await secondService.put({ sessionId: "s2", messageId: "m1", rating: "positive", ifVersion: null })) as {
        value: { version: string };
      };
      stalePrefix.prefixMismatch = true;
      await expect(
        secondService.delete({ sessionId: "s2", messageId: "m1", ifVersion: createdAgain.value.version }),
      ).rejects.toThrow("message-feedback: feedback prefix is not durable for live session 's2'");
    }
  });
});

describe("row message-feedback · cổng DỌN + C6 — DANH TÍNH", () => {
  test("sau khi chạy hàm dọn, service TỪ CHỐI nhận đột biến mới (cả hai bản, cùng thông điệp)", async () => {
    for (const plugin of [MessageFeedbackService as unknown as PluginClass, stock.default]) {
      const state = harness({ s1: [assistantEvent(0, "m1")] });
      const service = boot(plugin, state.ctx);
      expect(state.effects).toHaveLength(1);
      expect(state.effects[0]?.label).toBe("message-feedback.drain");
      await state.disposeEffects();
      await expect(service.put({ sessionId: "s1", messageId: "m1", rating: "positive", ifVersion: null })).rejects.toThrow(
        "message-feedback: service is disposing",
      );
    }
  });

  test("mỗi lượt đọc trả vật thể RIÊNG rẽ và BẤT BIẾN; sửa bản này KHÔNG lan sang bản kia", async () => {
    const state = harness({ s1: [assistantEvent(0, "m1")] });
    const service = boot(MessageFeedbackService as unknown as PluginClass, state.ctx) as unknown as TypedApi;
    const created = await service.put({ sessionId: "s1", messageId: "m1", rating: "positive", note: "a", ifVersion: null });
    const first = await service.list({ sessionId: "s1" });
    const second = await service.list({ sessionId: "s1" });
    const a = first.value.items[0];
    const b = second.value.items[0];
    const stored = (state.logs.get("s1") ?? [])[1];
    const storedItem = (stored?.["data"] as { item: Record<string, unknown> }).item;
    if (a === undefined || b === undefined) throw new Error("thiếu mục phản hồi");
    // DANH TÍNH, không phải giá trị: `toEqual` sẽ ĐẠT dù ba vật chia sẻ một tham chiếu.
    expect(a).not.toBe(b);
    expect(a).not.toBe(storedItem);
    expect(created.value).not.toBe(storedItem);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(created.value)).toBe(true);
    // Sửa vật trong LOG không lan sang ảnh chụp đã trả (và ngược lại: ảnh chụp là ĐÔNG BĂNG).
    storedItem["note"] = "đã sửa";
    expect(a["note"]).toBe("a");
    expect(b["note"]).toBe("a");
    expect(() => {
      (a as { note?: string }).note = "không được";
    }).toThrow();
  });
});

/** Bề mặt service có KIỂU cho ca C6 — để đọc thẳng \`value.items\` thay vì \`unknown\`. */
interface TypedApi {
  /** Ghi một mục phản hồi và trả mục đã bền vững. */
  put(request: Parameters<ServiceApi["put"]>[0]): Promise<{ ok: true; value: Record<string, unknown> }>;
  /** Đọc các mục phản hồi hiện tại của một phiên. */
  list(request: { sessionId: string }): Promise<{ ok: true; value: { items: Record<string, unknown>[] } }>;
}

describe("row message-feedback · gbh.peers ⊆ peerDependencies (so PHẦN TỬ) + ĐỐI CHỨNG ÂM", () => {
  /** Manifest đã đọc — hình dạng tối thiểu mà phép kiểm cần. */
  interface Manifest {
    /** Tên gói. */
    name: string;
    /** Khối phụ thuộc thật (peer phải VẮNG ở đây). */
    dependencies?: Record<string, string>;
    /** Khối phụ thuộc phát triển. */
    devDependencies?: Record<string, string>;
    /** Hợp đồng với trình quản lý gói. */
    peerDependencies?: Record<string, string>;
    /** Bảng export của gói. */
    exports?: Record<string, unknown>;
    /** Metadata của ta. */
    gbh?: { peers?: string[]; row?: unknown; draft?: string; tests?: string[] };
  }

  /**
   * Đọc một manifest từ đĩa.
   * Nhận: đường dẫn tuyệt đối tới package.json.
   * Trả: manifest đã parse.
   */
  const readManifest = (path: string): Manifest => JSON.parse(readFileSync(path, "utf8")) as Manifest;

  /**
   * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
   * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆).
   * Nhận: manifest cần kiểm.
   * Trả: danh sách tên thiếu, đã sắp xếp.
   */
  const missingPeers = (manifest: Manifest): string[] => {
    const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
    return [...(manifest.gbh?.peers ?? [])].filter((peer) => !declared.has(peer)).sort();
  };

  /**
   * Nhân bản manifest để phá mà không chạm bản gốc.
   * Nhận: manifest nguồn.
   * Trả: bản sao sâu.
   */
  const cloneManifest = (manifest: Manifest): Manifest => JSON.parse(JSON.stringify(manifest)) as Manifest;

  test("mọi tên trong gbh.peers có mặt trong peerDependencies, có thật trong kernel, KHÔNG nằm ở dependencies", () => {
    const manifest = readManifest(MANIFEST);
    // Chống verdict RỖNG: xoá sạch gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...(manifest.gbh?.peers ?? [])].sort()).toEqual([
      "@deepseek-ai/dsh-command-feedback",
      "@deepseek-ai/dsh-session",
      "@deepseek-ai/dsh-typert-protocol",
    ]);
    expect(missingPeers(manifest)).toEqual([]);
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const peer of manifest.gbh?.peers ?? []) {
      const kernel = JSON.parse(readFileSync(join(REPO, "apps", "host", "node_modules", peer, "package.json"), "utf8")) as { version: string };
      const declared = manifest.peerDependencies?.[peer] ?? "";
      expect(declared.length).toBeGreaterThan(0);
      const floor = declared.replace(/^[~^]/, "").split(".").slice(0, 2).join(".");
      expect(kernel.version.startsWith(floor)).toBe(true);
      // Peer LUÔN là peerDependencies — khai vào dependencies là dựng thể hiện THỨ HAI.
      expect(deps.has(peer)).toBe(false);
      expect(manifest.devDependencies?.[peer]).toBe(declared);
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT tên / xoá sạch / peers ⊄ peerDeps mà SỐ LƯỢNG bằng nhau đều PHẢI bị bắt", () => {
    const manifest = readManifest(MANIFEST);
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
    const sameCount = cloneManifest(manifest);
    sameCount.gbh = { peers: ["@deepseek-ai/cordis", "@deepseek-ai/khong-ton-tai"] };
    sameCount.peerDependencies = { "@deepseek-ai/cordis": "~4.0.5", "@deepseek-ai/dsh-session": "0.2.1-alpha.4" };
    expect(sameCount.gbh.peers?.length).toBe(Object.keys(sameCount.peerDependencies).length);
    expect(missingPeers(sameCount)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    // THỪA tên trong peerDependencies thì vẫn ĐẠT — quy ước là ⊆, không phải =.
    const extra = cloneManifest(manifest);
    extra.peerDependencies = { ...(extra.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(extra)).toEqual([]);
  });

  test("ĐỐI CHỨNG ÂM THẬT trong repo: settings-controller lệch 1 tên; jobs-local nay ĐÃ KHỚP", () => {
    // Đo LẠI ngay lúc chạy (18/10/2026): M6-MOUNT-PLAN §1d ghi jobs-local lệch 3 tên, nhưng tới nay
    // gói đó đã khớp ⇒ dùng nó làm đối chứng âm sẽ là verdict RỖNG nếu đọc tài liệu thay vì đo.
    // 08/11/2026: bản cũ ENCỐ ĐỊNH trạng thái gói khác (`settings-controller` đã được trả peer về id stock
    // ⇒ hết lệch) nên đối chứng âm đỏ mỗi khi repo tiến hoá. Thay bằng manifest GIẢ dựng tại chỗ:
    // verdict vẫn KHÔNG RỖNG (thiếu ĐÚNG một tên) mà không phụ thuộc gói nào khác.
    const fake = { name: "fake-settings-controller", peerDependencies: { zod: "4.4.3" }, gbh: { peers: ["@deepseek-ai/dsh-typert-protocol", "zod"] } } as unknown as ReturnType<typeof readManifest>;
    expect(missingPeers(fake)).toEqual(["@deepseek-ai/dsh-typert-protocol"]);
    const jobs = readManifest(join(REPO, "packages", "host", "jobs-local", "package.json"));
    expect((jobs.gbh?.peers ?? []).length).toBeGreaterThan(0);
    expect(missingPeers(jobs)).toEqual([]);
  });
});

describe("row message-feedback · 000e locale + hợp đồng metadata gbh.row", () => {
  test("locale en/zh chép BYTE-FOR-BYTE từ gói gốc và manifest export chúng", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { exports?: Record<string, unknown> };
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    expect(manifest.exports?.["./types"]).toBe("./lib/types.js");
    for (const locale of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(PKG, "locale", locale));
      const theirs = readFileSync(join(STOCK_DIR, "locale", locale));
      expect(ours.equals(theirs)).toBe(true);
    }
    const oursZh = JSON.parse(readFileSync(join(PKG, "locale", "zh.json"), "utf8")) as { meta?: { title?: string } };
    const theirsZh = JSON.parse(readFileSync(join(STOCK_DIR, "locale", "zh.json"), "utf8")) as { meta?: { title?: string } };
    expect(oursZh.meta?.title).toBe(theirsZh.meta?.title);
  });

  // Trước 08:55 ngày 18/10 ca này là **TEST CANH** (khẳng định gói KHÔNG khai \`gbh.row\` — tác giả gói
  // KHÔNG tự nhận rủi ro mount). LEAD đã khai \`gbh.row\` lúc 08:55 ⇒ ca này đổi chiều thành **hợp đồng
  // metadata**, đúng mẫu recipe §7: canh id ĐÚNG row stock, config ĐÚNG cấu hình đang chạy (đo từ
  // \`ours.yml\` L512–515), test trỏ ĐÚNG file này, và row MỘT MẶT KHÔNG được kéo theo \`moduleIds\`/\`aliases\`.
  test("\`gbh.row\` (do LEAD khai, KHÔNG phải tác giả gói) trỏ ĐÚNG row, ĐÚNG config đang chạy, ĐÚNG test này", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
      gbh?: { row?: { id?: string; config?: Record<string, unknown>; tests?: string[]; moduleIds?: unknown; aliases?: unknown }; peers?: string[] };
    };
    const row = manifest.gbh?.row;
    expect(row?.id).toBe("message-feedback");
    // \`ours.yml\` (dump 2026-10-18T01-31-57) đang chạy đúng một trường này: \`config: { maxNoteBytes: 8192 }\`.
    expect(row?.config).toEqual({ maxNoteBytes: 8192 });
    expect(row?.tests).toEqual(["tests/host/message-feedback.test.ts"]);
    // Row MỘT MẶT: không có nửa client ⇒ khai id module/alias là vô nghĩa và che lỗi cấu hình.
    expect(row?.moduleIds).toBeUndefined();
    expect(row?.aliases).toBeUndefined();
    expect((manifest.gbh?.peers ?? []).length).toBeGreaterThan(0);
  });
});
