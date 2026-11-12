/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-session-checkpoint-policy: mỗi ca hành vi dựng HAI giàn
 *      giống hệt nhau rồi chạy CẢ HAI bản cài (apply của ta và apply của chính bundle gốc), so vết gọi
 *      seam + kết quả; cộng ca tập export trên ARTIFACT, ca gbh.peers ⊆ peerDependencies (có ĐỐI CHỨNG ÂM),
 *      ca độc lập vật thể canonical (C6) và ca locale chép byte-for-byte (000e).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { apply, inject, name } from "../../packages/host/session-checkpoint-policy/src/index.ts";
import { abortedBeforeDispatchResult } from "../../packages/host/session-checkpoint-policy/src/result.ts";
import type { CheckpointContext } from "../../packages/host/session-checkpoint-policy/src/types.ts";
import { buildPackage } from "../../packages/host/session-checkpoint-policy/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "session-checkpoint-policy");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-checkpoint-policy");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Thư mục ARTIFACT của ta: nằm TRONG `lib/` để `packages: "external"` phân giải được peer. */
const ARTIFACT_DIR = join(PKG, "lib", "test-artifact");

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as {
  apply: (ctx: CheckpointContext) => void;
  inject: string[];
  name: string;
};

/** Chữ ký chung của hai bản cài: cùng nhận một context như nhau. */
type Apply = (ctx: CheckpointContext) => void;

/** Phiên giả: chính sách chỉ cần DANH TÍNH, đúng như bản gốc. */
interface FakeSession {
  /** Mã phiên. */
  id: string;
}

/** Tên ba điểm mở rộng mà chính sách đăng ký. */
type EventName = "llm/stream" | "tools/execute" | "agent/pre-step";

/** Listener thô của giàn: tham số do từng ca ép kiểu tại chỗ. */
type Listener = (payload: unknown, next: unknown) => unknown;

/** Tuỳ chọn dựng giàn. */
interface HarnessOptions {
  /** Phiên đang sống trong sổ (mặc định: một phiên `s1`). */
  sessions?: FakeSession[];
  /** Lỗi mà `flush` ném ra (ca fail-closed). */
  flushError?: Error;
  /** Giá trị boolean mà `flush` trả về (kernel: "có listener ghi bền nào tham gia không"). */
  flushValue?: boolean;
}

/** Giàn giả tối thiểu nhưng ĐÚNG hình dạng seam thật: sổ phiên có điều khiển + sổ listener. */
interface Harness {
  /** Context đưa cho `apply`. */
  ctx: CheckpointContext;
  /** Vết các lượt gọi seam, theo đúng thứ tự xảy ra. */
  trace: string[];
  /** Các phiên đã được ép ghi bền, theo thứ tự. */
  flushes: FakeSession[];
  /** Listener đã đăng ký cho một sự kiện (ném khi chưa đăng ký). */
  listener(event: EventName): Listener;
}

/**
 * Dựng một giàn giả.
 * Nhận: tuỳ chọn (phiên đang sống, lỗi/giá trị của `flush`).
 * Trả: giàn dùng chung được cho CẢ bản của ta lẫn bản gốc.
 */
function harness(options: HarnessOptions = {}): Harness {
  const trace: string[] = [];
  const flushes: FakeSession[] = [];
  const live = new Map<string, FakeSession>((options.sessions ?? [{ id: "s1" }]).map((session) => [session.id, session]));
  const listeners = new Map<EventName, Listener>();
  const ctx = {
    sessions: {
      get(id: string): FakeSession | undefined {
        trace.push("get:" + id);
        return live.get(id);
      },
      async flush(session: FakeSession): Promise<boolean> {
        trace.push("flush:" + session.id);
        flushes.push(session);
        if (options.flushError !== undefined) throw options.flushError;
        return options.flushValue ?? true;
      },
    },
    on(event: EventName, listener: Listener): () => void {
      listeners.set(event, listener);
      return () => undefined;
    },
  };
  return {
    ctx: ctx as unknown as CheckpointContext,
    trace,
    flushes,
    listener: (event) => {
      const found = listeners.get(event);
      if (found === undefined) throw new Error("chưa đăng ký listener " + event);
      return found;
    },
  };
}

/** Kết quả một lượt chạy kịch bản `llm/stream`. */
interface StreamObservation {
  /** Vết NGAY SAU khi listener trả về, trước khi kéo chunk đầu — đo tính LƯỜI của checkpoint. */
  beforePull: string[];
  /** Các chunk đã nhận. */
  chunks: string[];
  /** Vết đầy đủ sau khi đọc hết luồng. */
  trace: string[];
  /** Luồng trả về có ĐÚNG là luồng hạ nguồn không (nhánh bỏ qua checkpoint). */
  sameIterable: boolean;
  /** Thông điệp lỗi khi lần kéo ném, hoặc `undefined`. */
  error?: string;
}

/**
 * Chạy kịch bản `llm/stream` trên MỘT bản cài.
 * Nhận: hàm `apply` cần đo, payload request model, và tuỳ chọn giàn.
 * Trả: vết gọi seam + chunk nhận được + lỗi (nếu có).
 */
async function observeStream(applyFn: Apply, payload: { sessionId?: string }, options: HarnessOptions = {}): Promise<StreamObservation> {
  const h = harness(options);
  applyFn(h.ctx);
  const listener = h.listener("llm/stream");
  const downstream = (async function* () {
    yield "chunk-1";
    yield "chunk-2";
  })();
  const next = (): AsyncIterable<string> => {
    h.trace.push("next");
    return downstream;
  };
  const stream = listener(payload, next) as AsyncIterable<string>;
  const beforePull = [...h.trace];
  const chunks: string[] = [];
  let error: string | undefined;
  try {
    for await (const chunk of stream) chunks.push(chunk);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return { beforePull, chunks, trace: h.trace, sameIterable: stream === downstream, error };
}

/** Kết quả một lượt chạy kịch bản `tools/execute`. */
interface ToolObservation {
  /** Vết các lượt gọi seam. */
  trace: string[];
  /** Kết quả listener trả về (hoặc `undefined` khi ném). */
  result: unknown;
  /** Kết quả có ĐÚNG là vật thể của tầng dưới không (nhánh chuyển tiếp). */
  sameResult: boolean;
  /** Số lượt gọi thân tool. */
  nextCalls: number;
  /** Thông điệp lỗi khi listener ném, hoặc `undefined`. */
  error?: string;
}

/** Mô tả lượt gọi tool của một ca. */
interface ToolCase {
  /** Có agent hay không (mặc định: có). */
  agent?: boolean;
  /** Là lời gọi LỒNG NHAU (có `parent`) hay không. */
  nested?: boolean;
  /** Tín hiệu đã bị huỷ TRƯỚC khi listener chạy hay không. */
  aborted?: boolean;
}

/**
 * Chạy kịch bản `tools/execute` trên MỘT bản cài.
 * Nhận: hàm `apply` cần đo, mô tả lượt gọi, và tuỳ chọn giàn.
 * Trả: vết gọi seam + kết quả + số lượt gọi thân tool.
 */
async function observeTools(applyFn: Apply, scenario: ToolCase, options: HarnessOptions = {}): Promise<ToolObservation> {
  const h = harness(options);
  applyFn(h.ctx);
  const listener = h.listener("tools/execute");
  const controller = new AbortController();
  if (scenario.aborted === true) controller.abort();
  const execution = {
    ...(scenario.agent === false ? {} : { agent: { session: { id: "s1" } } }),
    ...(scenario.nested === true ? { parent: { token: "outer" } } : {}),
    signal: controller.signal,
  };
  const downstream = { content: [{ type: "text", text: "ok" }], isError: false };
  let nextCalls = 0;
  const next = async (): Promise<unknown> => {
    nextCalls += 1;
    h.trace.push("next");
    return downstream;
  };
  let result: unknown;
  let error: string | undefined;
  try {
    result = await listener(execution, next);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return { trace: h.trace, result, sameResult: result === downstream, nextCalls, ...(error === undefined ? {} : { error }) };
}

/**
 * Chạy kịch bản `agent/pre-step` trên MỘT bản cài.
 * Nhận: hàm `apply` cần đo và tuỳ chọn giàn.
 * Trả: vết gọi seam, quyết định có phải của tầng dưới không, và lỗi (nếu có).
 */
async function observePreStep(applyFn: Apply, options: HarnessOptions = {}): Promise<{ trace: string[]; sameDecision: boolean; error?: string }> {
  const h = harness(options);
  applyFn(h.ctx);
  const listener = h.listener("agent/pre-step");
  const decision = { kind: "proceed" };
  const next = async (): Promise<unknown> => {
    h.trace.push("next");
    return decision;
  };
  let returned: unknown;
  let error: string | undefined;
  try {
    returned = await listener({ agent: { session: { id: "s1" } }, messages: [], turn: 1, step: 2, signal: new AbortController().signal }, next);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return { trace: h.trace, sameDecision: returned === decision, ...(error === undefined ? {} : { error }) };
}

afterAll(async () => {
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
});

describe("row session-checkpoint-policy · đối chứng hành vi với chính bundle gốc", () => {
  test("llm/stream: checkpoint chạy ở lần KÉO ĐẦU, trước chunk đầu, và luồng vẫn đủ", async () => {
    const ours = await observeStream(apply, { sessionId: "s1" });
    const theirs = await observeStream(stock.apply, { sessionId: "s1" });
    // Y hệt nhau từng phần tử — ta không được "cải tiến" thứ tự.
    expect(ours).toEqual(theirs);
    // Listener trả luồng NGAY (checkpoint còn LƯỜI): lúc này mới chỉ tra phiên, CHƯA ghi bền.
    expect(ours.beforePull).toEqual(["get:s1"]);
    expect(ours.trace).toEqual(["get:s1", "flush:s1", "next"]);
    expect(ours.chunks).toEqual(["chunk-1", "chunk-2"]);
    expect(ours.sameIterable).toBe(false);
    expect(ours.error).toBeUndefined();
  });

  test("llm/stream: không sessionId hoặc phiên không tồn tại ⇒ trả NGUYÊN luồng hạ nguồn, 0 flush", async () => {
    const noSession = await observeStream(apply, {});
    const noSessionStock = await observeStream(stock.apply, {});
    expect(noSession).toEqual(noSessionStock);
    expect(noSession.trace).toEqual(["next"]);
    expect(noSession.sameIterable).toBe(true);
    expect(noSession.chunks).toEqual(["chunk-1", "chunk-2"]);

    const unknown = await observeStream(apply, { sessionId: "khong-ton-tai" });
    const unknownStock = await observeStream(stock.apply, { sessionId: "khong-ton-tai" });
    expect(unknown).toEqual(unknownStock);
    expect(unknown.trace).toEqual(["get:khong-ton-tai", "next"]);
    expect(unknown.sameIterable).toBe(true);
  });

  test("llm/stream: flush NÉM ⇒ lần kéo đầu ném, adapter KHÔNG được dựng (fail-closed)", async () => {
    const options: HarnessOptions = { flushError: new Error("dia chi ghi ben hong") };
    const ours = await observeStream(apply, { sessionId: "s1" }, options);
    const theirs = await observeStream(stock.apply, { sessionId: "s1" }, options);
    expect(ours).toEqual(theirs);
    expect(ours.error).toBe("dia chi ghi ben hong");
    expect(ours.trace).toEqual(["get:s1", "flush:s1"]);
    expect(ours.chunks).toEqual([]);
  });

  test("llm/stream: flush trả false KHÔNG chặn (chỉ lỗi NÉM mới chặn) — đúng hợp đồng kernel", async () => {
    const options: HarnessOptions = { flushValue: false };
    const ours = await observeStream(apply, { sessionId: "s1" }, options);
    const theirs = await observeStream(stock.apply, { sessionId: "s1" }, options);
    expect(ours).toEqual(theirs);
    expect(ours.error).toBeUndefined();
    expect(ours.chunks).toEqual(["chunk-1", "chunk-2"]);
    expect(ours.trace).toEqual(["get:s1", "flush:s1", "next"]);
  });

  test("tools/execute: top-level ghi bền TRƯỚC thân tool, rồi chuyển tiếp NGUYÊN kết quả", async () => {
    const ours = await observeTools(apply, {});
    const theirs = await observeTools(stock.apply, {});
    expect(ours).toEqual(theirs);
    expect(ours.trace).toEqual(["flush:s1", "next"]);
    expect(ours.nextCalls).toBe(1);
    expect(ours.sameResult).toBe(true);
    expect(ours.error).toBeUndefined();
  });

  test("tools/execute: lời gọi LỒNG NHAU hoặc không agent ⇒ 0 flush (dùng lại checkpoint ngoài)", async () => {
    const nested = await observeTools(apply, { nested: true });
    const nestedStock = await observeTools(stock.apply, { nested: true });
    expect(nested).toEqual(nestedStock);
    expect(nested.trace).toEqual(["next"]);
    expect(nested.nextCalls).toBe(1);

    const anonymous = await observeTools(apply, { agent: false });
    const anonymousStock = await observeTools(stock.apply, { agent: false });
    expect(anonymous).toEqual(anonymousStock);
    expect(anonymous.trace).toEqual(["next"]);
    expect(anonymous.nextCalls).toBe(1);
  });

  test("tools/execute: huỷ lúc chờ checkpoint ⇒ kết quả canonical, thân tool KHÔNG chạy", async () => {
    const ours = await observeTools(apply, { aborted: true });
    const theirs = await observeTools(stock.apply, { aborted: true });
    // Kết quả canonical phải TRÙNG TỪNG PHẦN TỬ với bản gốc (kể cả mã lỗi lấy từ kernel).
    expect(ours.result).toEqual(theirs.result);
    expect(ours.result).toEqual({
      content: [{ type: "text", text: "Error: tool call aborted before dispatch" }],
      isError: true,
      error: {
        message: "tool call aborted before dispatch",
        info: { name: "AbortError", code: "ABORTED_BEFORE_DISPATCH" },
      },
    });
    // Thứ tự trung thành: ghi bền VẪN chạy trước khi kiểm tín hiệu huỷ.
    expect(ours.trace).toEqual(["flush:s1"]);
    expect(ours.nextCalls).toBe(0);
    expect(ours.sameResult).toBe(false);
  });

  test("tools/execute: flush NÉM ⇒ listener ném, thân tool KHÔNG chạy (fail-closed)", async () => {
    const options: HarnessOptions = { flushError: new Error("khong ghi duoc") };
    const ours = await observeTools(apply, {}, options);
    const theirs = await observeTools(stock.apply, {}, options);
    expect(ours).toEqual(theirs);
    expect(ours.error).toBe("khong ghi duoc");
    expect(ours.trace).toEqual(["flush:s1"]);
    expect(ours.nextCalls).toBe(0);
    expect(ours.result).toBeUndefined();
  });

  test("agent/pre-step: ghi bền batch của bước TRƯỚC rồi mới chuyển tiếp quyết định", async () => {
    const ours = await observePreStep(apply);
    const theirs = await observePreStep(stock.apply);
    expect(ours).toEqual(theirs);
    expect(ours.trace).toEqual(["flush:s1", "next"]);
    expect(ours.sameDecision).toBe(true);
  });

  test("agent/pre-step: flush NÉM ⇒ lượt hỏng trước khi request kế tiếp được dựng", async () => {
    const options: HarnessOptions = { flushError: new Error("checkpoint hong") };
    const ours = await observePreStep(apply, options);
    const theirs = await observePreStep(stock.apply, options);
    expect(ours).toEqual(theirs);
    expect(ours.error).toBe("checkpoint hong");
    expect(ours.trace).toEqual(["flush:s1"]);
    expect(ours.sameDecision).toBe(false);
  });
});

describe("row session-checkpoint-policy · bề mặt plugin đo trên ARTIFACT", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, 0 id module, apply nhận 1 tham số", async () => {
    const file = await buildPackage(ARTIFACT_DIR);
    const code = readFileSync(file, "utf8");
    // Host-only: KHÔNG đăng ký id module nào (bản gốc cũng vậy) — nên cả hai phép đếm đều 0.
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as { apply: (ctx: CheckpointContext) => void; inject: string[]; name: string };
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual(["apply", "inject", "name"]);
    expect("default" in artifact).toBe(false);
    expect(artifact.apply.length).toBe(stock.apply.length);
    expect(artifact.apply.length).toBe(1);
    expect(artifact.name).toBe(stock.name);
    expect(artifact.name).toBe("session-checkpoint-policy");
    // `sessionPersistence` KHÔNG được dùng trực tiếp trong mã — vẫn giữ ĐÚNG như bản gốc (thứ tự + phần tử).
    expect(artifact.inject).toEqual(stock.inject);
    expect(artifact.inject).toEqual(["llm", "sessionPersistence", "sessions", "tools"]);
    expect(inject).toEqual(artifact.inject);
    expect(name).toEqual(artifact.name);
  });

  test("000e: locale en/zh chép byte-for-byte từ gói gốc, và manifest export chúng", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { exports?: Record<string, string> };
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    for (const locale of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(PKG, "locale", locale));
      const theirs = readFileSync(join(STOCK_DIR, "locale", locale));
      expect(ours.equals(theirs)).toBe(true);
    }
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Peer THẬT SỰ dùng lúc chạy: `dsh-tools` (hằng `TOOL_ABORTED_BEFORE_DISPATCH` của kernel). */
const RUNTIME_PEERS = ["@deepseek-ai/dsh-tools"];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  exports?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  gbh?: { peers?: string[]; row?: unknown };
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import` — test không resolve `@deepseek-ai/*`).
 * Nhận: không.
 * Trả: manifest đã ép kiểu.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * Nhận: manifest gốc.
 * Trả: bản sao độc lập.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("row session-checkpoint-policy · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...RUNTIME_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
  });

  test("peer khai ra phải có THẬT trong kernel, đúng phiên bản, và KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const peer of manifest.gbh?.peers ?? []) {
      const kernel = JSON.parse(readFileSync(join(ROOT, "apps", "host", "node_modules", peer, "package.json"), "utf8")) as {
        version: string;
      };
      expect(manifest.peerDependencies?.[peer]).toBe(kernel.version);
      expect(deps.has(peer)).toBe(false);
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

  test("đối chứng âm thứ hai: THỪA tên trong peerDependencies vẫn ĐẠT (⊆ chứ không phải =)", () => {
    const mutated = cloneManifest(readManifest());
    mutated.peerDependencies = { ...(mutated.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(mutated)).toEqual([]);
  });
});

describe("row session-checkpoint-policy · cổng an toàn mount", () => {
  
  test("package KHÔNG được kéo bất kỳ gói @galaxy-stack nào (luật bất biến)", () => {
    expect(readFileSync(MANIFEST, "utf8").includes("@galaxy-stack/")).toBe(false);
  });
});

describe("row session-checkpoint-policy · C6: vật thể canonical ĐỘC LẬP theo DANH TÍNH", () => {
  test("hai lần dựng kết quả huỷ ⇒ ba tầng vật thể khác danh tính, sửa một KHÔNG lan sang cái kia", () => {
    const left = abortedBeforeDispatchResult();
    const right = abortedBeforeDispatchResult();
    expect(left).not.toBe(right);
    expect(left.content).not.toBe(right.content);
    expect(left.error).not.toBe(right.error);
    expect(left.error.info).not.toBe(right.error.info);
    // Giá trị bằng nhau (phép so sâu ĐẠT) nhưng DANH TÍNH khác — đúng lớp lỗi C6.
    expect(left).toEqual(right);
    const mutable = left as unknown as {
      content: { type: "text"; text: string }[];
      error: { message: string; info: { name: string; code: string } };
    };
    mutable.content.push({ type: "text", text: "them" });
    mutable.error.info.code = "DOI_MA";
    expect(right.content.length).toBe(1);
    expect(right.error.info.code).toBe("ABORTED_BEFORE_DISPATCH");
  });

  test("hai lượt dispatch bị huỷ (hai giàn riêng) ⇒ hai vật thể kết quả riêng, không chia sẻ tham chiếu", async () => {
    const first = await observeTools(apply, { aborted: true });
    const second = await observeTools(apply, { aborted: true });
    expect(first.result).toEqual(second.result);
    expect(first.result).not.toBe(second.result);
    const firstContent = (first.result as { content: unknown[] }).content;
    const secondContent = (second.result as { content: unknown[] }).content;
    expect(firstContent).not.toBe(secondContent);
  });
});
