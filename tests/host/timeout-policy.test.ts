/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-timeout-policy: mỗi ca hành vi dựng HAI giàn giống hệt
 *      nhau rồi chạy CẢ HAI bản cài (apply của ta và apply của chính bundle gốc), so vết đo (kết quả,
 *      số lượt gọi tầng dưới, tín hiệu đã hoàn, đồng hồ đã dọn); cộng ca tập export trên ARTIFACT, ca
 *      gbh.peers ⊆ peerDependencies (có ĐỐI CHỨNG ÂM), ca C6 — danh tính vật thể, và ca locale 000e.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { stockNameOf } from "../lib/peer-kernel.ts";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/timeout-policy/build.ts";
import { apply, inject, name, TOOL_TIMEOUT } from "../../packages/host/timeout-policy/src/index.ts";
import type {
  TimeoutContext,
  TimeoutToolDefinition,
  ToolDispatchExecution,
  ToolExecuteListener,
  ToolExecutionFailure,
  ToolExecutionResult,
} from "../../packages/host/timeout-policy/src/types.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "timeout-policy");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-call-timeout-policy");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Thư viện timeout của kernel — nguồn của `TimeoutReason` để dựng ca "hạn chót LỒNG NHAU". */
const TIMEOUT_LIB = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-timeout", "lib", "index.js");
/** Thư mục ARTIFACT của ta: nằm TRONG `lib/` để `packages: "external"` phân giải được peer. */
const ARTIFACT_DIR = join(PKG, "lib", "test-artifact");

/** Chữ ký chung của hai bản cài: cùng nhận một context như nhau. */
type ApplyFn = (ctx: TimeoutContext) => void;

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as { apply: ApplyFn; inject: string[]; name: string; TOOL_TIMEOUT: string };

/** Lớp reason của kernel, để dựng một hạn chót LỒNG NHAU mang mã KHÁC mã của ta. */
const timeoutLib = (await import(TIMEOUT_LIB)) as { TimeoutReason: new (code: string, timeoutMs: number) => Error };

/** Sổ tool giả: tên tool → định nghĩa mà chính sách chỉ đọc trường `timeoutMs`. */
type ToolBook = Map<string, TimeoutToolDefinition>;

/** Giàn giả tối thiểu nhưng ĐÚNG hình dạng seam thật: sổ tool + sổ listener. */
interface Harness {
  /** Context đưa cho `apply`. */
  ctx: TimeoutContext;
  /** Vết tra sổ tool, theo thứ tự gọi. */
  getCalls: Array<{ name: string; agent: unknown }>;
  /** Thứ tự tên sự kiện đã đăng ký. */
  events: string[];
  /** Listener `tools/execute` đã đăng ký (ném khi chưa đăng ký). */
  listener: ToolExecuteListener;
}

/**
 * Dựng giàn và cài MỘT bản `apply` lên đó.
 * Nhận: hàm apply (của ta hoặc của bundle gốc) + sổ tool của giàn.
 * Trả: context, vết tra sổ, thứ tự sự kiện, và listener `tools/execute` đã đăng ký.
 */
function mount(applyFn: ApplyFn, tools: ToolBook): Harness {
  const getCalls: Array<{ name: string; agent: unknown }> = [];
  const events: string[] = [];
  const listeners: ToolExecuteListener[] = [];
  const ctx: TimeoutContext = {
    tools: {
      get(toolName, scope) {
        getCalls.push({ name: toolName, agent: scope });
        return tools.get(toolName);
      },
    },
    on(event, listener) {
      events.push(event);
      listeners.push(listener);
      return () => listeners.length > 0;
    },
  };
  applyFn(ctx);
  return {
    ctx,
    getCalls,
    events,
    listener(exec, next) {
      const registered = listeners[0];
      if (registered === undefined) throw new Error("chưa đăng ký listener tools/execute");
      return registered(exec, next);
    },
  };
}

/** Vết đo của MỘT lượt chạy — mọi trường đều so được bằng `toEqual` (không chứa tín hiệu sống). */
interface Observation {
  /** Số lượt gọi xuống tầng dưới (`next`). */
  nextCalls: number;
  /** Vết tra sổ tool, kèm việc phạm vi truyền vào có ĐÚNG tham chiếu agent hay không. */
  getCalls: Array<{ name: string; agentSame: boolean }>;
  /** `exec.signal` sau khi waterfall kết thúc có TRỞ LẠI đúng tín hiệu của caller không. */
  signalRestored: boolean;
  /** Tín hiệu thấy trong lúc dispatch có phải CHÍNH tín hiệu caller (tức không đổi) không. */
  dispatchSignalIsCaller: boolean;
  /** Sau khi settle + chờ thêm, tín hiệu dispatch có bị cháy không (đồng hồ bị bỏ quên ⇒ `true`). */
  dispatchSignalAbortedAfterSettle: boolean;
  /** Kết quả waterfall trả về. */
  result: unknown;
  /** Kết quả có phải ĐÚNG vật thể mà thân tool trả về (không bị thay) không. */
  resultIsSentinel: boolean;
  /** Lỗi đi ra khỏi waterfall (nếu có). */
  threw?: { name: string; message: string };
}

/** Thân tool giả: nhận lượt gọi (tín hiệu ĐÃ ĐỔI) + controller của caller + vật thể mốc. */
type ToolBody = (exec: ToolDispatchExecution, caller: AbortController, sentinel: ToolExecutionResult) => Promise<ToolExecutionResult>;

/** Tuỳ chọn một lượt chạy. */
interface DriveOptions {
  /** Ngân sách tool khai trong sổ; vắng mặt = tool KHÔNG khai ngân sách. */
  budget?: number;
  /** Thân tool giả. */
  body: ToolBody;
  /** Chờ thêm ngần này ms SAU settle để kiểm đồng hồ đã được dọn. */
  settleWaitMs?: number;
}

/**
 * Chạy MỘT lượt `tools/execute` trên một giàn mới.
 * Nhận: hàm apply của bản cần đo + tuỳ chọn lượt chạy.
 * Trả: vết đo `Observation` — tham chiếu kết quả, số lượt gọi tầng dưới, tín hiệu đã hoàn, và việc
 *      đồng hồ có bị bỏ quên sau khi settle hay không.
 */
async function drive(applyFn: ApplyFn, options: DriveOptions): Promise<Observation> {
  const tools: ToolBook = new Map();
  if (options.budget !== undefined) tools.set("web_fetch", { timeoutMs: options.budget });
  const harness = mount(applyFn, tools);
  const agent = { id: "agent-1" };
  const caller = new AbortController();
  const exec: ToolDispatchExecution = { name: "web_fetch", agent, signal: caller.signal };
  const sentinel: ToolExecutionResult = { isError: false, content: [{ type: "text", text: "tool đã xong" }] };
  let nextCalls = 0;
  let dispatchSignal: AbortSignal | undefined;
  const observation: Observation = {
    nextCalls: 0,
    getCalls: [],
    signalRestored: false,
    dispatchSignalIsCaller: false,
    dispatchSignalAbortedAfterSettle: false,
    result: undefined,
    resultIsSentinel: false,
  };
  try {
    observation.result = await harness.listener(exec, async () => {
      nextCalls += 1;
      dispatchSignal = exec.signal;
      return options.body(exec, caller, sentinel);
    });
  } catch (error) {
    observation.threw = { name: (error as Error).name, message: (error as Error).message };
  }
  if (options.settleWaitMs !== undefined) await Bun.sleep(options.settleWaitMs);
  observation.nextCalls = nextCalls;
  observation.getCalls = harness.getCalls.map((call) => ({ name: call.name, agentSame: call.agent === agent }));
  observation.signalRestored = exec.signal === caller.signal;
  observation.dispatchSignalIsCaller = dispatchSignal === caller.signal;
  observation.dispatchSignalAbortedAfterSettle = dispatchSignal?.aborted === true;
  observation.resultIsSentinel = observation.result === sentinel;
  return observation;
}

/**
 * Chạy CÙNG một kịch bản trên HAI bản cài (của ta + bundle gốc), mỗi bên một giàn riêng.
 * Nhận: tuỳ chọn lượt chạy.
 * Trả: cặp `{ ours, theirs }` để so bằng `toEqual` — hai vết đo độc lập, không chia sẻ trạng thái.
 */
async function bothSides(options: DriveOptions): Promise<{ ours: Observation; theirs: Observation }> {
  const ours = await drive(apply, options);
  const theirs = await drive(stock.apply, options);
  return { ours, theirs };
}

/**
 * Chạy một lượt gọi đã CHẮC CHẮN vượt hạn chót trên giàn có sổ tool cho trước.
 * Nhận: hàm apply + sổ tool (phải có `web_fetch` với `timeoutMs` hữu hạn).
 * Trả: kết quả HỎNG mà chính sách thay vào, đã hẹp kiểu về `ToolExecutionFailure`.
 */
async function timeoutOnce(applyFn: ApplyFn, tools: ToolBook): Promise<ToolExecutionFailure> {
  const harness = mount(applyFn, tools);
  const caller = new AbortController();
  const exec: ToolDispatchExecution = { name: "web_fetch", signal: caller.signal };
  const result = await harness.listener(
    exec,
    (): Promise<ToolExecutionResult> =>
      new Promise<ToolExecutionResult>((resolve) => {
        exec.signal.addEventListener("abort", () => resolve({ isError: false, content: [{ type: "text", text: "đã dừng" }] }), {
          once: true,
        });
      }),
  );
  if (result.isError !== true) throw new Error("kỳ vọng kết quả HỎNG");
  return result;
}

/** Kết quả TOOL_TIMEOUT kỳ vọng cho một ngân sách — nguyên văn chuỗi của bản gốc. */
function expectedTimeoutResult(timeoutMs: number): ToolExecutionFailure {
  const message = "tool call timed out after " + timeoutMs + "ms";
  return {
    content: [{ type: "text", text: "Error: " + message }],
    isError: true,
    error: { message, info: { name: "ToolTimeoutError", code: "TOOL_TIMEOUT" } },
  };
}

/** Các mục mà `package.json` phải khớp (manifest là nguồn DUY NHẤT của cả hai danh sách peer). */
interface Manifest {
  /** Tên package của ta. */
  name?: string;
  /** Bảng export phải phủ `./locale/*.json`. */
  exports?: Record<string, string>;
  /** Hợp đồng cấp-MỘT-thể-hiện với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Bản sao để tsc/test của repo phân giải được peer. */
  devDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Metadata của gói: `peers` (inject) và `row` (mount). */
  gbh?: { peers?: string[]; row?: unknown };
}

/** Peer thật sự được nạp lúc chạy — chống verdict RỖNG cho phép ⊆. */
const RUNTIME_PEERS = ["@deepseek-ai/dsh-timeout"];

/** Đọc manifest của package.
 *  Nhận: không. Trả: nội dung `package.json` đã ép kiểu `Manifest`. */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Manifest;
}

/** Sao chép sâu manifest để đối chứng âm.
 *  Nhận: manifest gốc. Trả: bản sao độc lập (sửa bản sao không chạm bản gốc). */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * Nhận: manifest. Trả: danh sách tên thiếu, đã sắp xếp.
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return [...new Set(manifest.gbh?.peers ?? [])].filter((peer) => !declared.has(peer)).sort();
}

describe("row timeout-policy · đối chứng hành vi với chính bundle gốc", () => {
  test("tool KHÔNG khai timeoutMs ⇒ chuyển tiếp nguyên vẹn, không đồng hồ, không đổi tín hiệu", async () => {
    const { ours, theirs } = await bothSides({ body: async (_exec, _caller, sentinel) => sentinel });
    expect(ours).toEqual(theirs);
    expect(ours.getCalls).toEqual([{ name: "web_fetch", agentSame: true }]);
    expect(ours.nextCalls).toBe(1);
    expect(ours.dispatchSignalIsCaller).toBe(true);
    expect(ours.signalRestored).toBe(true);
    expect(ours.resultIsSentinel).toBe(true);
    expect(ours.threw).toBeUndefined();
  });

  test("có timeoutMs mà tool xong trong hạn ⇒ kết quả nguyên vẹn + tín hiệu hoàn + ĐỒNG HỒ ĐƯỢC DỌN", async () => {
    const { ours, theirs } = await bothSides({
      budget: 20,
      settleWaitMs: 60,
      body: async (_exec, _caller, sentinel) => sentinel,
    });
    expect(ours).toEqual(theirs);
    expect(ours.resultIsSentinel).toBe(true);
    // Đã ĐỔI tín hiệu trong lúc dispatch (tín hiệu hợp nhất), rồi HOÀN LẠI tín hiệu caller.
    expect(ours.dispatchSignalIsCaller).toBe(false);
    expect(ours.signalRestored).toBe(true);
    // Quá hạn 20ms mà tín hiệu dispatch KHÔNG cháy ⇒ `[Symbol.dispose]` đã xoá đồng hồ.
    expect(ours.dispatchSignalAbortedAfterSettle).toBe(false);
  });

  test("hạn chót của TA thắng ⇒ cả hai bản trả CÙNG kết quả TOOL_TIMEOUT nguyên văn", async () => {
    const { ours, theirs } = await bothSides({
      budget: 10,
      body: (exec) =>
        new Promise<ToolExecutionResult>((resolve) => {
          exec.signal.addEventListener("abort", () => resolve({ isError: false, content: [{ type: "text", text: "đã dừng" }] }), {
            once: true,
          });
        }),
    });
    expect(ours).toEqual(theirs);
    expect(ours.result).toEqual(expectedTimeoutResult(10));
    expect(ours.resultIsSentinel).toBe(false);
    expect(ours.signalRestored).toBe(true);
    expect(ours.dispatchSignalAbortedAfterSettle).toBe(true);
    expect(ours.nextCalls).toBe(1);
  });

  test("tool KHÔNG quan sát tín hiệu vẫn bị thay kết quả sau khi settle (không hard-stop được)", async () => {
    const { ours, theirs } = await bothSides({
      budget: 10,
      body: async (_exec, _caller, sentinel) => {
        await Bun.sleep(40);
        return sentinel;
      },
    });
    expect(ours).toEqual(theirs);
    expect(ours.resultIsSentinel).toBe(false);
    expect(ours.result).toEqual(expectedTimeoutResult(10));
    // README của bản gốc nói rõ: plugin chỉ XIN dừng, không hard-stop — kết quả vẫn bị thay sau settle.
    expect(ours.nextCalls).toBe(1);
  });

  test("hạn chót LỒNG NHAU (mã khác) KHÔNG bị nhận nhầm thành timeout của ta", async () => {
    const { ours, theirs } = await bothSides({
      budget: 5,
      body: async (_exec, caller, sentinel) => {
        // Bộ bọc NGOÀI cháy trước với mã của chính nó — phạm vi `timeoutOf` theo TOOL_TIMEOUT phải bỏ qua.
        caller.abort(new timeoutLib.TimeoutReason("OUTER_TIMEOUT", 5));
        return sentinel;
      },
    });
    expect(ours).toEqual(theirs);
    expect(ours.resultIsSentinel).toBe(true);
    expect(ours.result).toEqual({ isError: false, content: [{ type: "text", text: "tool đã xong" }] });
  });

  test("tầng dưới NÉM ⇒ lỗi đi qua nguyên vẹn, tín hiệu vẫn hoàn, đồng hồ vẫn được dọn", async () => {
    const { ours, theirs } = await bothSides({
      budget: 20,
      settleWaitMs: 50,
      body: async () => {
        throw new Error("tool nổ");
      },
    });
    expect(ours).toEqual(theirs);
    expect(ours.threw).toEqual({ name: "Error", message: "tool nổ" });
    expect(ours.signalRestored).toBe(true);
    expect(ours.dispatchSignalAbortedAfterSettle).toBe(false);
  });

  test("timeoutMs không hợp lệ ⇒ NÉM đúng thông điệp của kernel, tầng dưới 0 lượt", async () => {
    const { ours, theirs } = await bothSides({
      budget: Number.POSITIVE_INFINITY,
      body: async (_exec, _caller, sentinel) => sentinel,
    });
    expect(ours).toEqual(theirs);
    expect(ours.nextCalls).toBe(0);
    expect(ours.threw?.message).toBe("deadline timeoutMs must be a positive finite number no greater than 2147483647");
  });

  test("timeoutMs <= 0 (sentinel nội bộ của kernel) ⇒ KHÔNG đồng hồ, tín hiệu caller giữ nguyên", async () => {
    const { ours, theirs } = await bothSides({
      budget: 0,
      settleWaitMs: 30,
      body: async (_exec, _caller, sentinel) => sentinel,
    });
    expect(ours).toEqual(theirs);
    expect(ours.dispatchSignalIsCaller).toBe(true);
    expect(ours.resultIsSentinel).toBe(true);
    expect(ours.dispatchSignalAbortedAfterSettle).toBe(false);
  });
});

describe("row timeout-policy · C6: vật thể KHÔNG chia sẻ giữa các lượt / các thực thể", () => {
  test("kết quả timeout dựng MỚI mỗi lượt — so sâu ĐẠT nhưng DANH TÍNH khác, sửa một không lan", async () => {
    const tools: ToolBook = new Map([["web_fetch", { timeoutMs: 5 }]]);
    const first = await timeoutOnce(apply, tools);
    const second = await timeoutOnce(apply, tools);
    // Phép so SÂU trả lời "trông giống nhau" — nó KHÔNG trả lời "có độc lập không".
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.content).not.toBe(second.content);
    expect(first.content[0]).not.toBe(second.content[0]);
    expect(first.error).not.toBe(second.error);
    expect(first.error.info).not.toBe(second.error.info);
    const firstBlock = first.content[0];
    if (firstBlock === undefined) throw new Error("thiếu khối nội dung");
    (firstBlock as { text: string }).text = "đã sửa";
    expect((second.content[0] as { text: string }).text).toBe("Error: tool call timed out after 5ms");
  });

  test("hai lượt cài tra sổ tool của CHÍNH context mình — không có trạng thái cấp module", async () => {
    const budgeted: ToolBook = new Map([["web_fetch", { timeoutMs: 5 }]]);
    const unbudgeted: ToolBook = new Map([["web_fetch", {}]]);
    for (const applyFn of [apply, stock.apply]) {
      const timedOut = await timeoutOnce(applyFn, budgeted);
      expect(timedOut.error.info.code).toBe("TOOL_TIMEOUT");
      // CÙNG tên tool nhưng sổ của giàn này KHÔNG khai ngân sách ⇒ đi qua nguyên vẹn.
      const harness = mount(applyFn, unbudgeted);
      const caller = new AbortController();
      const exec: ToolDispatchExecution = { name: "web_fetch", signal: caller.signal };
      const sentinel: ToolExecutionResult = { isError: false, content: [{ type: "text", text: "xong" }] };
      const passed = await harness.listener(exec, async () => sentinel);
      expect(passed).toBe(sentinel);
      expect(exec.signal).toBe(caller.signal);
    }
  });
});

describe("row timeout-policy · bề mặt plugin đo trên ARTIFACT", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, 0 id module, apply nhận 1 tham số", async () => {
    const file = await buildPackage(ARTIFACT_DIR);
    const code = readFileSync(file, "utf8");
    // Host-only: KHÔNG đăng ký id module nào (bản gốc cũng vậy) — nên cả hai phép đếm đều 0.
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as Record<string, unknown> & {
      apply: ApplyFn;
      inject: string[];
      name: string;
      TOOL_TIMEOUT: string;
    };
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual(["TOOL_TIMEOUT", "apply", "inject", "name"]);
    expect("default" in artifact).toBe(false);
    expect(artifact.apply.length).toBe(stock.apply.length);
    expect(artifact.apply.length).toBe(1);
    expect(artifact.name).toBe(stock.name);
    expect(artifact.name).toBe("timeout-policy");
    expect(artifact.inject).toEqual(stock.inject);
    expect(artifact.inject).toEqual(["tools"]);
    expect(artifact.TOOL_TIMEOUT).toBe(stock.TOOL_TIMEOUT);
    expect(artifact.TOOL_TIMEOUT).toBe("TOOL_TIMEOUT");
    expect(name).toBe(artifact.name);
    expect(inject).toEqual(artifact.inject);
    expect(TOOL_TIMEOUT).toBe(artifact.TOOL_TIMEOUT);
    // `toolTimeoutResult` là helper NỘI BỘ — bản gốc không export, ta cũng không.
    expect("toolTimeoutResult" in artifact).toBe(false);
  });

  test("000e: locale en/zh chép byte-for-byte từ gói gốc, và manifest export chúng", () => {
    const manifest = readManifest();
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    for (const locale of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(PKG, "locale", locale));
      const theirs = readFileSync(join(STOCK_DIR, "locale", locale));
      expect(ours.equals(theirs)).toBe(true);
    }
    const oursEn = JSON.parse(readFileSync(join(PKG, "locale", "en.json"), "utf8")) as { meta?: { title?: string } };
    const theirsEn = JSON.parse(readFileSync(join(STOCK_DIR, "locale", "en.json"), "utf8")) as { meta?: { title?: string } };
    expect(oursEn.meta?.title).toBe(theirsEn.meta?.title);
    expect(oursEn.meta?.title).toBe("tool-call-timeout-policy");
  });
});

describe("row timeout-policy · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    // Chống verdict RỖNG: xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...(manifest.gbh?.peers ?? [])].sort()).toEqual([...RUNTIME_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
  });

  test("peer khai ra phải có THẬT trong kernel, khớp phiên bản, và KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const peer of manifest.gbh?.peers ?? []) {
      const kernel = JSON.parse(readFileSync(join(ROOT, "apps", "host", "node_modules", stockNameOf(peer), "package.json"), "utf8")) as {
        version: string;
      };
      const declared = manifest.peerDependencies?.[peer] ?? "";
      expect(declared.length).toBeGreaterThan(0);
      // Khoảng khai phải phủ phiên bản kernel: "0.2.1-alpha.4" khớp chính xác.
      const floor = declared.replace(/^[~^]/, "").split(".").slice(0, 2).join(".");
      expect(kernel.version.startsWith(floor)).toBe(true);
      expect(deps.has(peer)).toBe(false);
      expect(manifest.devDependencies?.[peer]).toBe(declared);
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      // Đỏ ở ĐÚNG tên vừa xoá ⇒ ca dương ở trên KHÔNG rỗng: ai xoá một peer thì test sẽ ĐỎ.
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  test("đối chứng âm thứ hai: peers ⊄ peerDeps mà SỐ LƯỢNG bằng nhau vẫn PHẢI bị bắt", () => {
    const manifest = readManifest();
    const mutated = cloneManifest(manifest);
    // Hai danh sách cùng ĐỘ DÀI nhưng lệch phần tử — phép so số lượng sẽ nói OK, phép so phần tử phải ĐỎ.
    mutated.gbh = { peers: ["@deepseek-ai/cordis", "@deepseek-ai/khong-ton-tai"] };
    mutated.peerDependencies = { "@deepseek-ai/cordis": "~4.0.5", "@deepseek-ai/dsh-timeout": "0.2.1-alpha.4" };
    expect(mutated.gbh.peers?.length).toBe(Object.keys(mutated.peerDependencies).length);
    expect(missingPeers(mutated)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    // Và THỪA tên trong peerDependencies vẫn ĐẠT (⊆ chứ không phải =).
    const extra = cloneManifest(manifest);
    extra.peerDependencies = { ...(extra.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("row timeout-policy · hợp đồng khai `gbh.row`", () => {
  test("`gbh.row` (do LEAD khai, KHÔNG phải tác giả gói) trỏ ĐÚNG row và ĐÚNG test này", () => {
    const manifest = readManifest();
    const row = manifest.gbh?.row as { id?: string; tests?: string[]; moduleIds?: unknown; aliases?: unknown } | undefined;
    // Trước 07:50 ngày 18/10 test này là TEST CANH (`gbh.row` phải VẮNG). Lead khai row xong thì nó
    // đổi chiều — đúng mẫu ở recipe §7. Nay nó canh ba thứ: id ĐÚNG row stock, test ĐÚNG file này,
    // và row MỘT MẶT KHÔNG được kéo theo `moduleIds`/`aliases` (không có nửa client để nạp).
    expect(row?.id).toBe("timeout-policy");
    expect(row?.tests).toEqual(["tests/host/timeout-policy.test.ts"]);
    expect(row?.moduleIds).toBeUndefined();
    expect(row?.aliases).toBeUndefined();
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-timeout-policy");
  });
});

afterAll(async () => {
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
});


