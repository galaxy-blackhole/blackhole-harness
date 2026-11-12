/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-spill-policy (row spill-policy): mọi ca chạy CẢ HAI
 *      bên (bản của ta và CHÍNH bundle gốc) trên cùng một giàn giả rồi so từng yêu cầu lưu · từng
 *      cảnh báo · từng quyết định; cộng tập export đo trên ARTIFACT, đối chứng âm `gbh.peers`, và C6.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/spill-policy/build.ts";
import { Config, apply, inject, name } from "../../packages/host/spill-policy/src/index.ts";
import { formatSpillNotice, hasSpillNotice } from "../../packages/host/spill-policy/src/notice.ts";
import { retainContent } from "../../packages/host/spill-policy/src/retention.ts";
import type {
  PostExecuteListener,
  PtcDispatchLogListener,
  SpillPolicyContext,
  SpillSaveRequest,
  SpillRef,
} from "../../packages/host/spill-policy/src/types.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "spill-policy");
/** Bundle GỐC của row (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-spill-policy", "lib", "index.js");
/** Module thông báo của bản gốc (subpath `./notice`) — oracle của phần định dạng/nhận dạng. */
const STOCK_NOTICE = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-spill-policy", "lib", "types", "notice.js");
/** Hàm giữ hai đầu của bản gốc (không nằm trong entry chính). */
const STOCK_RETENTION = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-spill-policy", "lib", "types", "retention.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Hình dạng module plugin (ta và gốc dùng chung) — đủ để gọi `apply` và đọc định danh. */
interface PluginModule {
  /** Tên plugin cordis. */
  readonly name: string;
  /** Service bắt buộc. */
  readonly inject: string[];
  /** Schema cấu hình. */
  readonly Config: unknown;
  /** Lắp plugin trên một context (bản của ta nhận context CẤU TRÚC). */
  apply(ctx: unknown, config: { maxInlineTokens?: number }): void;
}

/** Bundle gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as PluginModule;
/** Bản của ta, cùng hình dạng để hai bên chạy trên cùng một giàn. */
const ours = { name, inject, Config, apply } as unknown as PluginModule;
/** Hai hàm thông báo của bản gốc. */
const stockNotice = (await import(STOCK_NOTICE)) as {
  formatSpillNotice(omitted: OmittedArg, ref: NoticeRef, images?: number): string;
  hasSpillNotice(text: string): boolean;
};
/** Hàm giữ hai đầu của bản gốc. */
const stockRetention = (await import(STOCK_RETENTION)) as {
  retainContent(content: readonly Block[], budget: number, price: (block: Block) => number): RetainedShape;
};

/** Tham số kiểu rút từ chính chữ ký của ta — không import gói upstream nào. */
type OmittedArg = Parameters<typeof formatSpillNotice>[0];
/** Tham chiếu đọc lại. */
type NoticeRef = Parameters<typeof formatSpillNotice>[1];
/** Kết quả giữ hai đầu. */
type RetainedShape = ReturnType<typeof retainContent>;
/** Khối nội dung mà waterfall đưa vào. */
type Block = Parameters<PostExecuteListener>[1]["content"][number];
/** Lượt gọi tool của giàn. */
type Exec = Parameters<PostExecuteListener>[0];
/** Kết quả canonical của giàn. */
type Result = Parameters<PostExecuteListener>[1];
/** Quyết định mà tầng dưới trả về. */
type Decision = Awaited<ReturnType<PostExecuteListener>>;

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

/**
 * Khối chữ giả, đúng hình dạng `TextBlock`.
 * Nhận: chữ cần mang.
 * Trả: khối chữ dùng được trong nội dung của waterfall.
 */
function textBlock(text: string): Block {
  return { type: "text", text };
}

/**
 * Khối ảnh giả, đúng hình dạng `ImageBlock` (mã đính kèm là thương hiệu chỉ tồn tại lúc biên dịch).
 * Nhận: mã đính kèm và kích thước hiển thị.
 * Trả: khối ảnh dùng được trong nội dung của waterfall.
 */
function imageBlock(id: string, width = 64, height = 32): Block {
  return { type: "image", attachment: { attachmentId: id, mediaType: "image/png", bytes: 128, width, height } } as unknown as Block;
}

/** Tuỳ chọn dựng một lượt gọi tool giả. */
interface ExecOptions {
  /** Tên tool (mặc định `web_fetch`). */
  readonly name?: string;
  /** Mã lượt gọi (mặc định `call-1`). */
  readonly callId?: string;
  /** Token của lượt vận chuyển bao ngoài (PTC). */
  readonly parent?: unknown;
  /** Mã phiên sở hữu; `null` nghĩa là lượt gọi KHÔNG thuộc agent nào. */
  readonly owner?: string | null;
  /** Khoá provider của tuyến model. */
  readonly provider?: string;
  /** Id model của tuyến. */
  readonly model?: string;
}

/**
 * Dựng một lượt gọi tool giả có ĐÚNG mặt cắt mà chính sách đọc.
 * Nhận: tuỳ chọn (tên · mã lượt gọi · token cha · chủ sở hữu · tuyến model).
 * Trả: lượt gọi dùng được cho cả hai bên.
 */
function execFor(options: ExecOptions = {}): Exec {
  const provider = options.provider ?? "deepseek";
  const model = options.model ?? "deepseek-chat";
  const owner = options.owner === undefined ? "session-1" : options.owner;
  return {
    name: options.name ?? "web_fetch",
    callId: options.callId ?? "call-1",
    parent: options.parent,
    agent:
      owner === null
        ? undefined
        : {
            session: { header: { id: owner }, requestHeader: () => ({ config: { provider, model } }) },
            options: { provider, model },
          },
  };
}

/** Tuỳ chọn giàn giả. */
interface HarnessOptions {
  /** Ảnh → đường dẫn trên máy chủ (vắng = kho đính kèm không giữ ảnh đó). */
  readonly hostPaths?: ReadonlyMap<string, string>;
  /** Lắp kho tràn? (mặc định CÓ). */
  readonly spillStore?: boolean;
  /** Kernel có dịch vụ định giá ảnh? (mặc định CÓ). */
  readonly imagePricing?: boolean;
  /** Số token thị giác cho mỗi ảnh (mặc định 800). */
  readonly visualTokens?: number;
  /** Trần token truyền cho `apply` (vắng = KHÔNG truyền `maxInlineTokens`). */
  readonly cap?: number;
}

/** Giàn giả: context + vết ghi của mọi seam. */
interface Harness {
  /** Context đưa cho `apply`. */
  readonly ctx: SpillPolicyContext;
  /** Mọi cảnh báo đã ghi, theo thứ tự. */
  readonly warnings: string[];
  /** Mọi yêu cầu lưu đã ghi, theo thứ tự. */
  readonly saves: SpillSaveRequest[];
  /** Tên sự kiện đã đăng ký kèm cờ `prepend`. */
  readonly registrations: string[];
  /** Listener `tools/post-execute` đã đăng ký. */
  postExecute(): PostExecuteListener;
  /** Listener `tools/ptc-dispatch-log` đã đăng ký. */
  ptcLog(): PtcDispatchLogListener;
}

/**
 * Dựng giàn giả có ĐÚNG hình dạng seam thật (kho tràn · đính kèm · kho tệp · định giá ảnh · logger).
 * Nhận: tuỳ chọn giàn.
 * Trả: context + vết ghi + hai hàm lấy listener đã đăng ký.
 */
function makeHarness(options: HarnessOptions = {}): Harness {
  const warnings: string[] = [];
  const saves: SpillSaveRequest[] = [];
  const registrations: string[] = [];
  const handlers = new Map<string, unknown>();
  const hostPaths = options.hostPaths ?? new Map<string, string>();
  const visualTokens = options.visualTokens ?? 800;
  const ctx = {
    on(event: string, listener: unknown, flag?: { prepend?: boolean }): () => void {
      registrations.push(event + (flag?.prepend === true ? ":prepend" : ""));
      handlers.set(event, listener);
      return () => {
        handlers.delete(event);
      };
    },
    get(key: string): unknown {
      if (key === "spillStore") {
        if (options.spillStore === false) return undefined;
        return {
          async saveText(request: SpillSaveRequest): Promise<SpillRef> {
            saves.push(request);
            return {
              locator: "/tmp/spill/" + request.suggestedName,
              retrievalHint: "Use read with offset/limit, or grep this path to search within it.",
            };
          },
        };
      }
      if (key === "attachments") {
        return { imageHostPath: (ref: { attachmentId: unknown }) => hostPaths.get(String(ref.attachmentId)) };
      }
      if (key === "fs") return { processPathFromHostPath: (hostPath: string) => "world:" + hostPath };
      if (key === "llm") {
        if (options.imagePricing === false) return undefined;
        return {
          imageRequestPricing: () => ({
            priceImages: (images: readonly unknown[]) =>
              images.map(() => ({ visualTokens, text: "image descriptor text" })),
          }),
        };
      }
      return undefined;
    },
    logger: {
      warn: (message: string): void => {
        warnings.push(message);
      },
    },
  } as unknown as SpillPolicyContext;
  return {
    ctx,
    warnings,
    saves,
    registrations,
    postExecute(): PostExecuteListener {
      const handler = handlers.get("tools/post-execute");
      if (handler === undefined) throw new Error("khong dang ky listener tools/post-execute");
      return handler as PostExecuteListener;
    },
    ptcLog(): PtcDispatchLogListener {
      const handler = handlers.get("tools/ptc-dispatch-log");
      if (handler === undefined) throw new Error("khong dang ky listener tools/ptc-dispatch-log");
      return handler as PtcDispatchLogListener;
    },
  };
}

/**
 * Chuẩn hoá một quyết định để so giữa hai bên (bỏ `id` sinh ngẫu nhiên của thông điệp PTC).
 * Nhận: quyết định bất kỳ của waterfall.
 * Trả: bản sao JSON của quyết định, đã bỏ `id` trong `additionalContexts`.
 */
function normalizeDecision(decision: unknown): unknown {
  const clone = JSON.parse(JSON.stringify(decision)) as unknown;
  const contexts = (clone as { additionalContexts?: unknown }).additionalContexts;
  if (Array.isArray(contexts)) {
    for (const context of contexts) {
      if (context !== null && typeof context === "object") delete (context as { id?: unknown }).id;
    }
  }
  return clone;
}

/** Kết quả một lượt waterfall đã ghi vết. */
interface Outcome {
  /** Quyết định trả về, ĐÃ chuẩn hoá. */
  readonly decision: unknown;
  /** Quyết định NGUYÊN BẢN (để kiểm danh tính khi đi xuyên qua). */
  readonly raw: unknown;
  /** Yêu cầu lưu đã ghi. */
  readonly saves: readonly SpillSaveRequest[];
  /** Cảnh báo đã ghi. */
  readonly warnings: readonly string[];
  /** Số ảnh còn lại trong nội dung đã giữ. */
  readonly retainedImages: number;
}

/**
 * Chạy một lượt `tools/post-execute` trên giàn mới rồi gom vết.
 * Nhận: bản cài (ta hoặc gốc), tuỳ chọn giàn, và đầu vào (lượt gọi · kết quả · quyết định của tầng dưới).
 * Trả: quyết định đã chuẩn hoá + vết ghi của kho tràn/logger.
 */
async function runPostExecute(
  impl: PluginModule,
  options: HarnessOptions,
  input: { readonly exec: Exec; readonly result: Result; readonly decision: Decision },
): Promise<Outcome> {
  const harness = makeHarness(options);
  impl.apply(harness.ctx, options.cap === undefined ? {} : { maxInlineTokens: options.cap });
  const handler = harness.postExecute();
  const decision = await handler(input.exec, input.result, () => Promise.resolve(input.decision));
  const content = decision.content ?? [];
  return {
    decision: normalizeDecision(decision),
    raw: decision,
    saves: harness.saves,
    warnings: harness.warnings,
    retainedImages: content.filter((block) => block.type === "image").length,
  };
}

/**
 * Chạy CẢ HAI bên trên cùng đầu vào rồi khẳng định mọi vết ghi TRÙNG NHAU.
 * Nhận: tuỳ chọn giàn và đầu vào.
 * Trả: hai kết quả (của ta và của gốc) sau khi đã so.
 */
async function comparePostExecute(
  options: HarnessOptions,
  input: { readonly exec: Exec; readonly result: Result; readonly decision: Decision },
): Promise<{ readonly ours: Outcome; readonly theirs: Outcome }> {
  const mine = await runPostExecute(ours, options, input);
  const theirs = await runPostExecute(stock, options, input);
  expect(mine.decision).toEqual(theirs.decision);
  expect(mine.saves).toEqual(theirs.saves);
  expect(mine.warnings).toEqual(theirs.warnings);
  expect(mine.retainedImages).toBe(theirs.retainedImages);
  return { ours: mine, theirs };
}
/**
 * Hiệu PHẦN TỬ `gbh.peers` \\ `peerDependencies` — đúng phép kiểm của M6-MOUNT-PLAN §1d.
 * Nhận: danh sách peer để inject và khối peerDependencies của package.json.
 * Trả: các tên CÓ trong `gbh.peers` mà THIẾU trong `peerDependencies` (rỗng = đạt).
 */
function peerGap(peers: readonly string[], peerDependencies: Readonly<Record<string, string>>): string[] {
  const declared = new Set(Object.keys(peerDependencies));
  return peers.filter((peer) => !declared.has(peer));
}

/**
 * Ép một mảng khối về kiểu hai đầu mà `retainContent` nhận (khối lạ không đi vào hàm này).
 * Nhận: mảng khối nội dung.
 * Trả: cùng mảng, dưới kiểu `readonly RetainableBlock[]` của chữ ký.
 */
function asRetainable(content: readonly Block[]): Parameters<typeof retainContent>[0] {
  return content as unknown as Parameters<typeof retainContent>[0];
}

/**
 * Ghép mọi khối CHỮ của một nội dung (bỏ ảnh) để dò chuỗi.
 * Nhận: nội dung có thứ tự.
 * Trả: chữ đã ghép.
 */
function joinText(content: readonly Block[]): string {
  return content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

/** Kết quả một lượt `tools/ptc-dispatch-log`. */
interface PtcOutcome {
  /** Nội dung listener trả về. */
  readonly out: readonly Block[];
  /** Yêu cầu lưu đã ghi. */
  readonly saves: readonly SpillSaveRequest[];
  /** Cảnh báo đã ghi. */
  readonly warnings: readonly string[];
}

/**
 * Chạy một lượt `tools/ptc-dispatch-log` trên giàn mới.
 * Nhận: bản cài, tuỳ chọn giàn, bản ghi (lượt gọi con · tên · mã lời gọi con) và nội dung tầng dưới.
 * Trả: nội dung listener trả về + vết ghi của kho tràn và logger.
 */
async function runPtcLog(
  impl: PluginModule,
  options: HarnessOptions,
  dispatch: { readonly exec: Exec; readonly name: string; readonly subCallId: string },
  content: readonly Block[],
): Promise<PtcOutcome> {
  const harness = makeHarness(options);
  impl.apply(harness.ctx, options.cap === undefined ? {} : { maxInlineTokens: options.cap });
  const handler = harness.ptcLog();
  const out = await handler(dispatch as unknown as Parameters<PtcDispatchLogListener>[0], () => Promise.resolve(content));
  return { out, saves: harness.saves, warnings: harness.warnings };
}

describe("row spill-policy — ARTIFACT và bề mặt", () => {
  test("ARTIFACT: tập export = gốc (4 = 4) · subpath notice 2 = 2 · 0 id @deepseek-ai", async () => {
    const file = await buildPackage(OUT);
    const code = await readFile(file, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    const artifact = (await import(file)) as Record<string, unknown>;
    const stockModule = (await import(STOCK)) as Record<string, unknown>;
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stockModule).sort());
    expect(Object.keys(artifact).sort()).toEqual(["Config", "apply", "inject", "name"]);
    expect(artifact.name).toBe(stockModule.name);
    expect(artifact.inject).toEqual(stockModule.inject);
    const notice = (await import(join(OUT, "notice.js"))) as Record<string, unknown>;
    const stockNoticeModule = (await import(STOCK_NOTICE)) as Record<string, unknown>;
    expect(Object.keys(notice).sort()).toEqual(Object.keys(stockNoticeModule).sort());
    expect(Object.keys(notice).sort()).toEqual(["formatSpillNotice", "hasSpillNotice"]);
  });

  test("cấu hình: schema Config như gốc · trần sai NÉM cùng thông điệp · thiếu trần KHÔNG đăng ký gì", () => {
    const oursSchema = Config as unknown as (value: unknown) => unknown;
    const stockSchema = stock.Config as unknown as (value: unknown) => unknown;
    expect(oursSchema({ maxInlineTokens: 12500 })).toEqual(stockSchema({ maxInlineTokens: 12500 }));
    expect(oursSchema({})).toEqual(stockSchema({}));
    const messageOf = (impl: PluginModule, config: { maxInlineTokens?: number }): string => {
      const harness = makeHarness();
      try {
        impl.apply(harness.ctx, config);
        return "(khong nem)";
      } catch (error) {
        return String(error);
      }
    };
    for (const cap of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      const mine = messageOf(ours, { maxInlineTokens: cap });
      expect(mine).toBe(messageOf(stock, { maxInlineTokens: cap }));
      expect(mine).toContain("maxInlineTokens must be a non-negative integer");
    }
    const offOurs = makeHarness();
    ours.apply(offOurs.ctx, {});
    const offStock = makeHarness();
    stock.apply(offStock.ctx, {});
    expect(offOurs.registrations).toEqual([]);
    expect(offStock.registrations).toEqual([]);
    const onOurs = makeHarness();
    ours.apply(onOurs.ctx, { maxInlineTokens: 12500 });
    const onStock = makeHarness();
    stock.apply(onStock.ctx, { maxInlineTokens: 12500 });
    expect(onOurs.registrations).toEqual(onStock.registrations);
    expect(onOurs.registrations).toEqual(["tools/post-execute:prepend", "tools/ptc-dispatch-log:prepend"]);
  });

  test("gbh.peers ⊆ peerDependencies (so PHẦN TỬ, có ĐỐI CHỨNG ÂM) · CHƯA khai gbh.row", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      name?: string;
      gbh?: { peers?: string[]; tests?: string[]; row?: unknown; draft?: string };
      peerDependencies?: Record<string, string>;
    };
    const peers = json.gbh?.peers ?? [];
    const peerDependencies = json.peerDependencies ?? {};
    expect(peers.length).toBeGreaterThan(0);
    expect(peerGap(peers, peerDependencies)).toEqual([]);
    for (const peer of peers) expect(Object.hasOwn(peerDependencies, peer)).toBe(true);
    // ĐỐI CHỨNG ÂM: xoá từng tên ⇒ phép kiểm phải báo ĐÚNG tên vừa xoá.
    for (const peer of peers) {
      const damaged: Record<string, string> = { ...peerDependencies };
      delete damaged[peer];
      expect(peerGap(peers, damaged)).toEqual([peer]);
    }
    // Thừa tên trong peerDependencies vẫn ĐẠT: `gbh.peers` mới là danh sách inject.
    expect(peerGap(peers, { ...peerDependencies, "@deepseek-ai/mot-goi-khac": "1.0.0" })).toEqual([]);
    // Peer phải có THẬT trên đĩa (symlink theo luật 000d-2) để typecheck phân giải được.
    const onDisk = (peer: string): boolean => {
      try {
        readFileSync(join(PKG, "node_modules", peer, "package.json"), "utf8");
        return true;
      } catch {
        return false;
      }
    };
    for (const peer of peers) expect(onDisk(peer)).toBe(true);
    expect(json.name).toBe("@galaxy-blackhole/gbh-spill-policy");
    expect(json.gbh?.tests).toEqual(["tests/host/spill-policy.test.ts"]);
    // Lead ĐÃ khai `gbh.row` (commit sau khi đối chiếu artifact) ⇒ ca canh nay khẳng định khai báo ĐÚNG,
    // KHÔNG còn khẳng định "chưa khai" (chính điều đó từng làm 1 test đỏ sau khi Lead khai — bài học 18/10).
    expect(json.gbh?.row).toEqual({
      id: "spill-policy",
      config: { maxInlineTokens: 12500 },
      tests: ["tests/host/spill-policy.test.ts"],
    });
    // Config GỐC của row, chép nguyên văn từ ours.yml — không phải giá trị ta tự đặt.
    expect(json.gbh?.draft).toContain("maxInlineTokens: 12500");
  });
});
describe("row spill-policy — hành vi đối chứng với chính bundle gốc", () => {
  test("kết quả QUÁ ngân sách: chép bản đầy đủ + giữ hai đầu + thông báo đọc lại — Y HỆT gốc", async () => {
    const body = "x".repeat(4000);
    const content = [textBlock(body)];
    const input = { exec: execFor(), result: { content }, decision: { kind: "accept", content } as Decision };
    const { ours: mine, theirs } = await comparePostExecute({ cap: 200 }, input);
    expect(mine.saves.length).toBe(1);
    expect(mine.saves[0]?.source).toEqual({ kind: "tool", toolName: "web_fetch", callId: "call-1", label: "result" });
    expect(mine.saves[0]?.owner).toEqual({ sessionId: "session-1" });
    expect(mine.saves[0]?.suggestedName).toBe("web_fetch.txt");
    expect(mine.saves[0]?.content).toBe(body);
    const kept = mine.raw as Decision;
    const text = joinText(kept.content ?? []);
    expect(text).toContain("\n\n[...]\n\n");
    expect(text).toContain("(Omitted ");
    expect(text).toContain(" Full formatted result stored at: /tmp/spill/web_fetch.txt. ");
    expect(text).toContain("Use read with offset/limit, or grep this path to search within it.)");
    expect(text.length).toBeLessThan(body.length);
    expect(mine.decision).toEqual(theirs.decision);
  });

  test("đi xuyên NGUYÊN QUYẾT ĐỊNH: trong ngân sách · không accept · có value · tool read · PTC chỉ chữ · khối lạ", async () => {
    const body = "y".repeat(4000);
    const content = [textBlock(body)];
    const reasoning: Block = { type: "reasoning", text: "suy nghĩ nội bộ" };
    const cases: { readonly name: string; readonly options: HarnessOptions; readonly input: { exec: Exec; result: Result; decision: Decision } }[] = [
      { name: "trong ngân sách", options: { cap: 12500 }, input: { exec: execFor(), result: { content }, decision: { kind: "accept", content } } },
      { name: "quyết định không accept", options: { cap: 10 }, input: { exec: execFor(), result: { content }, decision: { kind: "block", content } } },
      { name: "quyết định có value", options: { cap: 10 }, input: { exec: execFor(), result: { content }, decision: { kind: "accept", content, value: { ok: true } } } },
      { name: "tool read", options: { cap: 10 }, input: { exec: execFor({ name: "read" }), result: { content }, decision: { kind: "accept", content } } },
      { name: "PTC chỉ chữ", options: { cap: 10 }, input: { exec: execFor({ parent: { token: "p1" } }), result: { content }, decision: { kind: "accept", content } } },
      { name: "khối lạ", options: { cap: 10 }, input: { exec: execFor(), result: { content: [reasoning] }, decision: { kind: "accept", content: [reasoning] } } },
    ];
    for (const item of cases) {
      const { ours: mine } = await comparePostExecute(item.options, item.input);
      expect(mine.raw).toBe(item.input.decision);
      expect(mine.saves).toEqual([]);
      expect(mine.warnings).toEqual([]);
    }
  });

  test("ảnh: bỏ NGUYÊN CHIẾC · mô tả ảnh vào bản tràn · PTC nhận thêm ngữ cảnh `ptc-mode`", async () => {
    const hostPaths = new Map([["att-1", "/host/attachments/att-1.png"]]);
    const content = [textBlock("a".repeat(2000)), imageBlock("att-1"), textBlock("b".repeat(2000))];
    const options: HarnessOptions = { cap: 120, hostPaths, visualTokens: 900 };
    const plain = await comparePostExecute(options, { exec: execFor(), result: { content }, decision: { kind: "accept", content } as Decision });
    expect(plain.ours.saves.length).toBe(1);
    expect(plain.ours.saves[0]?.content).toBe(
      'a'.repeat(2000) + '\n[Image: "world:/host/attachments/att-1.png"; image/png; 64x32. Use read_image to view it.]\n' + "b".repeat(2000),
    );
    expect(plain.ours.retainedImages).toBe(0);
    expect(joinText((plain.ours.raw as Decision).content ?? [])).toContain(" Omitted 1 images.");
    const ptc = await comparePostExecute(options, {
      exec: execFor({ parent: { token: "p1" }, name: "grep" }),
      result: { content, isError: false },
      decision: { kind: "accept", content } as Decision,
    });
    const decision = ptc.ours.raw as Decision;
    expect(decision.additionalContexts?.length).toBe(1);
    const message = decision.additionalContexts?.[0] as { role?: string; source?: unknown; content?: readonly Block[] };
    expect(message.role).toBe("user");
    expect(message.source).toEqual({ kind: "ptc-mode" });
    expect(message.content?.length ?? 0).toBeGreaterThan(0);
    expect(ptc.theirs.decision).toEqual(ptc.ours.decision);
    // Kết quả HỎNG thì KHÔNG đẩy thêm ngữ cảnh (kể cả khi mọi ảnh đã bị bỏ).
    const failed = await comparePostExecute(options, {
      exec: execFor({ parent: { token: "p1" }, name: "grep" }),
      result: { content, isError: true },
      decision: { kind: "accept", content } as Decision,
    });
    expect((failed.ours.raw as Decision).additionalContexts).toBeUndefined();
  });

  test("đường lỗi: thiếu kho tràn · thiếu chủ sở hữu · thiếu định giá ảnh · thông báo vượt trần", async () => {
    const body = "z".repeat(4000);
    const content = [textBlock(body)];
    const withImage = [textBlock(body), imageBlock("att-1")];
    const hostPaths = new Map([["att-1", "/host/attachments/att-1.png"]]);
    const cases: { readonly name: string; readonly options: HarnessOptions; readonly exec: Exec; readonly blocks: readonly Block[]; readonly expectWarning: string; readonly saves: number }[] = [
      { name: "thiếu kho tràn", options: { cap: 200, spillStore: false }, exec: execFor(), blocks: content, expectWarning: "no ctx.spillStore backend loaded", saves: 0 },
      { name: "thiếu chủ sở hữu", options: { cap: 200 }, exec: execFor({ owner: null }), blocks: content, expectWarning: "no session owner for web_fetch result", saves: 0 },
      { name: "thiếu định giá ảnh", options: { cap: 200, imagePricing: false, hostPaths }, exec: execFor(), blocks: withImage, expectWarning: "the current model has no image token calculator", saves: 0 },
      { name: "thông báo vượt trần", options: { cap: 5 }, exec: execFor(), blocks: content, expectWarning: "exceeds maxInlineTokens", saves: 1 },
    ];
    for (const item of cases) {
      const decision = { kind: "accept", content: item.blocks } as Decision;
      const { ours: mine, theirs } = await comparePostExecute(item.options, { exec: item.exec, result: { content: item.blocks }, decision });
      expect(mine.warnings.length).toBe(1);
      expect(mine.warnings[0]).toContain(item.expectWarning);
      expect(mine.warnings[0]).toContain("spill-policy: ");
      expect(mine.warnings[0]).toContain("; keeping the inline content");
      expect(mine.warnings[0]).toBe(theirs.warnings[0]);
      expect(mine.saves.length).toBe(item.saves);
      expect(mine.raw).toBe(decision);
    }
  });

  test("log PTC: bản ghi quá ngân sách bị giới hạn (nhãn `dispatch`) · bản ghi trong ngân sách đi xuyên NGUYÊN THAM CHIẾU", async () => {
    const big = "q".repeat(4000);
    const dispatch = { exec: execFor({ parent: { token: "p1" }, name: "grep", callId: "sub-1" }), name: "grep", subCallId: "sub-1" };
    const tight = await runPtcLog(ours, { cap: 200 }, dispatch, [textBlock(big)]);
    const stockTight = await runPtcLog(stock, { cap: 200 }, dispatch, [textBlock(big)]);
    expect(JSON.stringify(tight.out)).toBe(JSON.stringify(stockTight.out));
    expect(tight.saves).toEqual(stockTight.saves);
    expect(tight.saves.length).toBe(1);
    expect(tight.saves[0]?.source).toEqual({ kind: "tool", toolName: "grep", callId: "sub-1", label: "dispatch" });
    expect(tight.saves[0]?.suggestedName).toBe("grep.txt");
    expect(joinText(tight.out)).toContain(" Full formatted result stored at: /tmp/spill/grep.txt. ");
    const small = [textBlock("ngắn")];
    const loose = await runPtcLog(ours, { cap: 12500 }, dispatch, small);
    const stockLoose = await runPtcLog(stock, { cap: 12500 }, dispatch, small);
    expect(loose.out).toBe(small);
    expect(stockLoose.out).toBe(small);
    expect(loose.saves).toEqual([]);
    expect(loose.warnings).toEqual([]);
  });
});
describe("row spill-policy — notice + retention đo trực tiếp với bản gốc", () => {
  test("formatSpillNotice: khớp TỪNG BYTE trên ma trận (4 kiểu bỏ × 2 tham chiếu × 4 số ảnh)", () => {
    const omittedList: OmittedArg[] = [
      { kind: "none" },
      { kind: "exact", count: 0 },
      { kind: "exact", count: 1234 },
      { kind: "unknown" },
    ];
    const refs: NoticeRef[] = [
      { locator: "/tmp/spill/web_fetch.txt", retrievalHint: "Use read with offset/limit, or grep this path." },
      { locator: "/x", retrievalHint: "" },
    ];
    let measured = 0;
    for (const omitted of omittedList) {
      for (const ref of refs) {
        for (const images of [0, 1, 2, 99]) {
          expect(formatSpillNotice(omitted, ref, images)).toBe(stockNotice.formatSpillNotice(omitted, ref, images));
          measured += 1;
        }
      }
    }
    expect(measured).toBe(32);
    expect(formatSpillNotice({ kind: "exact", count: 1234 }, refs[0] as NoticeRef)).toContain("(Omitted 1234 bytes. Full formatted result stored at: /tmp/spill/web_fetch.txt. Use read with offset/limit, or grep this path.)");
    expect(formatSpillNotice({ kind: "exact", count: 1234 }, refs[0] as NoticeRef, 3)).toContain(" Omitted 3 images.");
    expect(formatSpillNotice({ kind: "none" }, refs[1] as NoticeRef)).toBe(stockNotice.formatSpillNotice({ kind: "none" }, refs[1] as NoticeRef));
  });

  test("hasSpillNotice: nhận dạng ĐÚNG trên ma trận chữ (có/không xem trước · thiếu dấu đóng · số sai)", () => {
    const ref: NoticeRef = { locator: "/tmp/spill/web_fetch.txt", retrievalHint: "Use read with offset/limit." };
    const omittedList: OmittedArg[] = [
      { kind: "none" },
      { kind: "exact", count: 0 },
      { kind: "exact", count: 7 },
      { kind: "unknown" },
    ];
    const texts: string[] = ["", "chữ thường", "()", "(Omitted 5 bytes.)", "preview\n\nkhông phải thông báo"];
    for (const omitted of omittedList) {
      for (const images of [0, 1, 3]) {
        const notice = stockNotice.formatSpillNotice(omitted, ref, images);
        texts.push(notice);
        texts.push("preview\n\n" + notice);
        texts.push("preview\n\n" + notice + "\n\nthêm chữ sau đó");
        texts.push(notice.slice(0, -1));
        texts.push("preview\n\n(Omitted x bytes." + notice.slice(notice.indexOf(" Full")));
      }
    }
    let hits = 0;
    for (const text of texts) {
      const mine = hasSpillNotice(text);
      expect(mine).toBe(stockNotice.hasSpillNotice(text));
      if (mine) hits += 1;
    }
    // Phép kiểm KHÔNG được luôn trả false (nếu không thì ma trận trên là vô nghĩa).
    expect(hits).toBeGreaterThan(0);
    expect(hasSpillNotice(stockNotice.formatSpillNotice({ kind: "exact", count: 12 }, ref))).toBe(true);
    expect(hasSpillNotice("preview\n\n" + stockNotice.formatSpillNotice({ kind: "exact", count: 12 }, ref))).toBe(true);
    expect(hasSpillNotice("(Omitted 12 bytes.)")).toBe(false);
  });

  test("retainContent: hai đầu + số byte UTF-8 + số ảnh bị bỏ khớp gốc trên lưới nội dung × ngân sách", () => {
    const price = (block: Block): number => (block.type === "text" ? Math.ceil(block.text.length / 4) + 1 : 900);
    const corpora: Block[][] = [
      [],
      [textBlock("ngắn")],
      [textBlock("a".repeat(400))],
      [textBlock("a".repeat(400)), imageBlock("att-1"), textBlock("b".repeat(400))],
      [imageBlock("att-1"), imageBlock("att-2")],
      [textBlock("😀".repeat(50))],
      [textBlock("đầu"), imageBlock("att-1"), textBlock("giữa"), imageBlock("att-2"), textBlock("cuối")],
    ];
    const budgets = [0, 1, 2, 7, 50, 101, 200, 1000, 4000];
    let measured = 0;
    for (const corpus of corpora) {
      for (const budget of budgets) {
        const mine = retainContent(asRetainable(corpus), budget, price as never);
        const theirs = stockRetention.retainContent(corpus, budget, price);
        expect(JSON.stringify(mine)).toBe(JSON.stringify(theirs));
        measured += 1;
      }
    }
    expect(measured).toBe(63);
    // Ca BYTE: cắt giữa cặp surrogate ⇒ KHÔNG sinh surrogate lẻ ở hai đầu (JSON hợp lệ).
    const emoji = [textBlock("😀😀")];
    const lengthPrice = (block: Block): number => (block.type === "text" ? block.text.length : 900);
    for (const budget of [1, 2, 3, 4, 5]) {
      const mine = retainContent(asRetainable(emoji), budget, lengthPrice as never);
      const theirs = stockRetention.retainContent(emoji, budget, lengthPrice);
      expect(JSON.stringify(mine)).toBe(JSON.stringify(theirs));
      for (const part of [...mine.head, ...mine.tail]) {
        if (part.type !== "text") continue;
        expect(/[\uD800-\uDBFF]$/.test(part.text)).toBe(false);
        expect(/^[\uDC00-\uDFFF]/.test(part.text)).toBe(false);
      }
    }
    // omittedBytes là BYTE UTF-8, không phải số ký tự (chữ Việt nhiều byte hơn số ký tự).
    const viet = retainContent(asRetainable([textBlock("ế".repeat(100))]), 0, (() => 1e9) as never);
    expect(viet.omittedBytes).toBe(Buffer.byteLength("ế".repeat(100), "utf8"));
    expect(viet.omittedBytes).toBeGreaterThan(100);
    expect(viet.head.length).toBe(0);
    expect(viet.tail.length).toBe(0);
  });
});

describe("row spill-policy — C6 DANH TÍNH: vật thể tạo nhiều lần phải ĐỘC LẬP", () => {
  test("retainContent trả MẢNG MỚI mỗi lượt; sửa kết quả này KHÔNG lan sang kết quả kia", () => {
    const price = (block: Block): number => (block.type === "text" ? Math.ceil(block.text.length / 4) + 1 : 900);
    const corpus = asRetainable([textBlock("a".repeat(300)), textBlock("b".repeat(300))]);
    const first = retainContent(corpus, 100, price as never);
    const second = retainContent(corpus, 100, price as never);
    expect(first.head).not.toBe(second.head);
    expect(first.tail).not.toBe(second.tail);
    const headBefore = second.head.length;
    const tailBefore = second.tail.length;
    first.head.push(corpus[0] as Parameters<typeof retainContent>[0][number]);
    first.tail.length = 0;
    expect(second.head.length).toBe(headBefore);
    expect(second.tail.length).toBe(tailBefore);
    // Bản GỐC cũng tạo mảng mới mỗi lượt ⇒ đây là hành vi phải tái hiện, không phải phát minh của ta.
    const stockFirst = stockRetention.retainContent(corpus, 100, price);
    const stockSecond = stockRetention.retainContent(corpus, 100, price);
    expect(stockFirst.head).not.toBe(stockSecond.head);
    expect(JSON.stringify(second)).toBe(JSON.stringify(stockSecond));
  });

  test("hai thực thể apply ĐỘC LẬP: trần của bản này KHÔNG rò sang bản kia (đảo thứ tự vẫn vậy)", async () => {
    const body = "m".repeat(4000);
    const content = [textBlock(body)];
    const input = { exec: execFor(), result: { content }, decision: { kind: "accept", content } as Decision };
    const loose = await runPostExecute(ours, { cap: 5000 }, input);
    const tight = await runPostExecute(ours, { cap: 60 }, input);
    expect(loose.saves.length).toBe(0);
    expect(tight.saves.length).toBe(1);
    const tightAgain = await runPostExecute(ours, { cap: 60 }, input);
    const looseAgain = await runPostExecute(ours, { cap: 5000 }, input);
    expect(tightAgain.decision).toEqual(tight.decision);
    expect(looseAgain.decision).toEqual(loose.decision);
    expect(tightAgain.saves).toEqual(tight.saves);
    expect(looseAgain.saves).toEqual([]);
    const stockLoose = await runPostExecute(stock, { cap: 5000 }, input);
    const stockTight = await runPostExecute(stock, { cap: 60 }, input);
    expect(loose.decision).toEqual(stockLoose.decision);
    expect(tight.decision).toEqual(stockTight.decision);
    expect(tight.decision).not.toEqual(loose.decision);
  });
});
