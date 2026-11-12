/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-image-offload: mỗi ca hành vi dựng HAI giàn giống hệt nhau
 *      rồi chạy CẢ HAI bản cài (apply của ta và apply của chính bundle gốc), so vết gọi seam + quyết định +
 *      sự kiện đã ghi; cộng ca tập export trên ARTIFACT, ca gbh.peers ⊆ peerDependencies (có ĐỐI CHỨNG ÂM),
 *      ca độc lập vật thể (C6), ca locale chép byte-for-byte (000e) và ca canh mount.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { apply, inject, name } from "../../packages/host/image-offload/src/index.ts";
import { offloadOldestImages } from "../../packages/host/image-offload/src/image-offload.ts";
import { offloadMessageImages } from "../../packages/host/image-offload/src/project-message.ts";
import { imageOffloadProjection } from "../../packages/host/image-offload/src/projection.ts";
import { deepFreeze } from "../../packages/host/image-offload/src/freeze.ts";
import type {
  ImageOffloadContext,
  MessageLike,
  MessageProjectionLike,
  ProjectionContextLike,
  SessionEventLike,
  SessionLike,
  SessionSeq,
} from "../../packages/host/image-offload/src/types.ts";
import { buildPackage } from "../../packages/host/image-offload/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "image-offload");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-compaction-image-offload");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Định nghĩa projection gốc (subpath `./projection` của gói gốc). */
const STOCK_PROJECTION = join(STOCK_DIR, "lib", "types", "projection.js");
/** Peer THẬT: `LlmError` phải là CÙNG một lớp ⇒ nạp từ đúng bản kernel, không dựng lớp giả. */
const LLM = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-llm", "lib", "index.js");
/** Thư viện đóng băng của kernel — oracle cho bản viết lại `deepFreeze` (chỉ dùng trong test). */
const UTIL_VALUES = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-util-values", "lib", "index.js");
/** Thư mục ARTIFACT của ta: nằm TRONG `lib/` để `packages: "external"` phân giải được peer qua symlink. */
const ARTIFACT_DIR = join(PKG, "lib", "test-artifact");

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as { apply: (ctx: ImageOffloadContext) => void; inject: string[]; name: string };
/** Định nghĩa projection gốc. */
const stockProjection = ((await import(STOCK_PROJECTION)) as { imageOffloadProjection: MessageProjectionLike<"image/offload"> })
  .imageOffloadProjection;
/** Peer `dsh-llm` của kernel. */
const llm = (await import(LLM)) as {
  LlmError: new (message: string, code: string, options?: { offloadImages?: number }) => Error & { code: string; failure: { offloadImages?: number } };
  IMAGE_OFFLOAD_REQUIRED_CODE: string;
};
/** `deepFreeze` của kernel — oracle của bản viết lại. */
const kernelFreeze = ((await import(UTIL_VALUES)) as { deepFreeze: <T>(value: T) => T }).deepFreeze;

/** Một khối nội dung trong ca test. */
interface Block {
  /** Loại khối (`image` là thứ được đánh dấu). */
  type: string;
  /** Dấu đã đẩy. */
  offloaded?: boolean;
  /** Trường khác của khối (giữ nguyên văn qua phép chiếu). */
  [key: string]: unknown;
}

/** Một thông điệp trong ca test. */
interface Msg {
  /** Vai của thông điệp. */
  role: string;
  /** Các khối nội dung. */
  content: Block[];
}

/** Một sự kiện trong nhật ký giả. */
interface FakeEvent {
  /** Loại sự kiện. */
  type: string;
  /** Thân sự kiện. */
  data: unknown;
}

/** Một quyết định `image/offload` đã được ghi vào nhật ký giả. */
interface Append {
  /** Loại sự kiện đã ghi. */
  type: string;
  /** Thân sự kiện đã ghi. */
  data: { targets: { seq: SessionSeq; imageIndexes: number[] }[] };
}

/** Nhật ký giả: đủ hình dạng seam thật mà plugin đọc/ghi. */
interface FakeSession {
  /** Sự kiện theo số thứ tự (1-based như kernel). */
  events: FakeEvent[];
  /** Nút mặt hiện tại. */
  surface: { nodes: SessionSeq[] };
  /** Các quyết định đã ghi. */
  appends: Append[];
  /** Vết gọi seam. */
  trace: string[];
  /** Đối tượng dùng làm `SessionLike`. */
  seam: SessionLike;
}

/**
 * Dựng một phiên giả.
 * Nhận: danh sách sự kiện, theo đúng thứ tự nhật ký (số thứ tự = vị trí + 1), và danh sách nút mặt (mặc định: mọi sự kiện).
 * Trả: phiên giả kèm vết gọi seam và sổ quyết định đã ghi.
 */
function makeSession(events: FakeEvent[], nodes?: SessionSeq[]): FakeSession {
  const session: FakeSession = {
    events,
    surface: { nodes: nodes ?? events.map((_, index) => index + 1) },
    appends: [],
    trace: [],
    seam: {} as SessionLike,
  };
  session.seam = {
    surface: session.surface,
    eventAt(seq: SessionSeq) {
      session.trace.push("eventAt:" + String(seq));
      return events[seq - 1] as SessionEventLike;
    },
    deriveEventMessage(event: SessionEventLike) {
      session.trace.push("deriveEventMessage:" + event.type);
      return (event.type === "user/message" ? event.data : (event.data as { message: MessageLike }).message) as MessageLike;
    },
    append(type: "image/offload", data) {
      session.trace.push("append:" + type);
      session.appends.push({ type, data: data as Append["data"] });
      return undefined;
    },
  };
  return session;
}

/** Listener thô của giàn: tham số do từng ca ép kiểu tại chỗ. */
type Listener = (payload: unknown, next: unknown) => unknown;

/** Giàn chạy `apply`: sổ listener + sổ projection + sổ phiên. */
interface Harness {
  /** Context đưa cho `apply`. */
  ctx: ImageOffloadContext;
  /** Vết gọi seam theo đúng thứ tự. */
  trace: string[];
  /** Phiên giả của giàn. */
  session: FakeSession;
  /** Định nghĩa projection đã đăng ký (undefined khi chưa đăng ký). */
  projection: MessageProjectionLike<"image/offload"> | undefined;
  /** Listener đã đăng ký cho một sự kiện (ném khi chưa đăng ký). */
  listener(event: string): Listener;
}

/**
 * Dựng một giàn giả.
 * Nhận: phiên giả.
 * Trả: giàn dùng chung được cho CẢ bản của ta lẫn bản gốc.
 */
function harness(session: FakeSession): Harness {
  const listeners = new Map<string, Listener>();
  const trace: string[] = [];
  let projection: MessageProjectionLike<"image/offload"> | undefined;
  const ctx = {
    sessions: {
      registerMessageProjection(p: MessageProjectionLike<"image/offload">) {
        trace.push("registerMessageProjection:" + p.type);
        projection = p;
        return () => Promise.resolve();
      },
    },
    on(event: string, listener: Listener) {
      trace.push("on:" + event);
      listeners.set(event, listener);
      return () => undefined;
    },
  };
  return {
    ctx: ctx as unknown as ImageOffloadContext,
    trace,
    session,
    get projection() {
      return projection;
    },
    listener: (event) => {
      const found = listeners.get(event);
      if (found === undefined) throw new Error("chưa đăng ký listener " + event);
      return found;
    },
  } as Harness;
}

/** Hàm `apply` của một bản cài. */
type AnyApply = (ctx: ImageOffloadContext) => void;

/** Kết quả một lượt chạy waterfall `agent/request-error`. */
interface RequestObservation {
  /** Vết gọi seam của cả giàn. */
  trace: string[];
  /** Hành động listener trả về. */
  action: unknown;
  /** Quyết định đã ghi. */
  appends: Append[];
  /** Số lượt gọi `next`. */
  nextCalls: number;
  /** Thông điệp lỗi khi listener ném, hoặc `undefined`. */
  error?: string;
}

/** Mô tả lượt hỏng của một ca `agent/request-error`. */
interface RequestCase {
  /** Mã lỗi của `failure`. */
  code: string;
  /** Số ảnh cần đẩy thêm (undefined = adapter không nói). */
  offloadImages?: number;
  /** Tín hiệu đã bị huỷ TRƯỚC khi listener chạy hay không. */
  aborted?: boolean;
}

/**
 * Chạy kịch bản `agent/request-error` trên MỘT bản cài.
 * Nhận: hàm `apply`, mô tả lượt hỏng, và phiên giả của giàn.
 * Trả: vết gọi seam + hành động + quyết định đã ghi + lỗi (nếu có).
 */
async function observeRequest(applyFn: AnyApply, scenario: RequestCase, session: FakeSession): Promise<RequestObservation> {
  const h = harness(session);
  applyFn(h.ctx);
  const listener = h.listener("agent/request-error");
  const controller = new AbortController();
  if (scenario.aborted === true) controller.abort(new Error("huy"));
  let nextCalls = 0;
  const next = async (): Promise<unknown> => {
    nextCalls += 1;
    h.trace.push("next");
    return { kind: "delegated" };
  };
  let action: unknown;
  let error: string | undefined;
  try {
    action = await listener(
      {
        agent: { session: session.seam },
        failure: {
          code: scenario.code,
          ...(scenario.offloadImages === undefined ? {} : { offloadImages: scenario.offloadImages }),
        },
        signal: controller.signal,
      },
      next,
    );
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return {
    trace: [...h.trace, ...session.trace],
    action,
    appends: session.appends,
    nextCalls,
    ...(error === undefined ? {} : { error }),
  };
}

/** Kết quả một lượt chạy waterfall `compaction/summary-error`. */
interface SummaryObservation {
  /** Vết gọi seam của cả giàn. */
  trace: string[];
  /** Giá trị listener trả về. */
  result: unknown;
  /** Quyết định đã ghi. */
  appends: Append[];
  /** Số lượt gọi `next`. */
  nextCalls: number;
  /** Thông điệp lỗi khi listener ném, hoặc `undefined`. */
  error?: string;
  /** Lỗi ném ra có ĐÚNG vật thể lý do huỷ không (chứng minh `throwIfAborted`). */
  sameReason?: boolean;
}

/** Mô tả lỗi của một ca `compaction/summary-error`. */
interface SummaryCase {
  /** Dựng lỗi của ca (nhận mã `IMAGE_OFFLOAD_REQUIRED` của kernel). */
  make: (code: string, LlmErrorClass: typeof llm.LlmError) => unknown;
  /** Tín hiệu đã bị huỷ TRƯỚC khi listener chạy hay không. */
  aborted?: boolean;
}

/**
 * Chạy kịch bản `compaction/summary-error` trên MỘT bản cài.
 * Nhận: hàm `apply`, mô tả lỗi, và phiên giả của giàn.
 * Trả: vết gọi seam + giá trị trả về + quyết định đã ghi + lỗi (nếu có).
 */
function observeSummary(applyFn: AnyApply, scenario: SummaryCase, session: FakeSession): SummaryObservation {
  const h = harness(session);
  applyFn(h.ctx);
  const listener = h.listener("compaction/summary-error");
  const controller = new AbortController();
  const reason = new Error("huy");
  if (scenario.aborted === true) controller.abort(reason);
  let nextCalls = 0;
  const next = (): boolean => {
    nextCalls += 1;
    h.trace.push("next");
    return false;
  };
  let result: unknown;
  let error: string | undefined;
  let sameReason: boolean | undefined;
  try {
    result = listener(
      {
        session: session.seam,
        sourceEventSeqs: [...session.surface.nodes],
        error: scenario.make(llm.IMAGE_OFFLOAD_REQUIRED_CODE, llm.LlmError),
        signal: controller.signal,
      },
      next,
    );
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    sameReason = caught === reason;
  }
  return {
    trace: [...h.trace, ...session.trace],
    result,
    appends: session.appends,
    nextCalls,
    ...(error === undefined ? {} : { error, sameReason }),
  };
}

/** Ảnh: khối mang tham chiếu tệp. */
const img = (name: string): Block => ({ type: "image", source: { path: "/tmp/" + name } });
/** Khối chữ. */
const txt = (text: string): Block => ({ type: "text", text });
/** Hai ảnh, một ảnh đã đẩy, hai chữ — đúng ca "còn ảnh cũ để đẩy". */
const mixedMessage = (): Msg => ({ role: "user", content: [img("a.png"), txt("xin chao"), img("b.png"), { ...img("c.png"), offloaded: true }, txt("het")] });
/** Sự kiện ĐẦU VÀO `user/message` mang `mixedMessage`. */
const userEvent = (): FakeEvent => ({ type: "user/message", data: mixedMessage() });
/** Sự kiện ĐẦU VÀO `tool/result` mang hai ảnh (một ảnh đã đẩy). */
const toolEvent = (): FakeEvent => ({ type: "tool/result", data: { message: { role: "tool", content: [img("d.png"), { ...img("e.png"), offloaded: true }, img("f.png")] } } });
/** Sự kiện ĐẦU RA của model — mang ảnh nhưng KHÔNG được đẩy. */
const assistantEvent = (): FakeEvent => ({ type: "assistant/message", data: { message: { role: "assistant", content: [img("model.png")] } } });

afterAll(async () => {
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
});

describe("row image-offload · đối chứng hành vi với chính bundle gốc", () => {
  test("đăng ký: projection TRƯỚC, rồi hai listener — đúng thứ tự và đúng số lượng", () => {
    const ours = harness(makeSession([]));
    apply(ours.ctx);
    const theirs = harness(makeSession([]));
    stock.apply(theirs.ctx);
    expect(ours.trace).toEqual(theirs.trace);
    expect(ours.trace).toEqual([
      "registerMessageProjection:image/offload",
      "on:agent/request-error",
      "on:compaction/summary-error",
    ]);
    expect(ours.projection?.type).toBe("image/offload");
    expect(theirs.projection?.type).toBe("image/offload");
  });

  test("agent/request-error: IMAGE_OFFLOAD_REQUIRED + offloadImages ⇒ ghi ảnh CŨ NHẤT rồi trả { kind: retry }", async () => {
    const session = makeSession([userEvent()]);
    const ours = await observeRequest(apply, { code: llm.IMAGE_OFFLOAD_REQUIRED_CODE, offloadImages: 1 }, session);
    const stockSession = makeSession([userEvent()]);
    const theirs = await observeRequest(stock.apply, { code: llm.IMAGE_OFFLOAD_REQUIRED_CODE, offloadImages: 1 }, stockSession);
    expect(ours).toEqual(theirs);
    expect(ours.action).toEqual({ kind: "retry" });
    expect(ours.nextCalls).toBe(0);
    expect(ours.appends).toEqual([{ type: "image/offload", data: { targets: [{ seq: 1, imageIndexes: [0] }] } }]);
    // Vết trung thành: đi qua cả ba lượt gọi seam của sổ phiên, không "tắt" lượt nào.
    expect(ours.trace).toEqual([
      "registerMessageProjection:image/offload",
      "on:agent/request-error",
      "on:compaction/summary-error",
      "eventAt:1",
      "deriveEventMessage:user/message",
      "append:image/offload",
    ]);
  });

  test("agent/request-error: đếm CẢ ảnh đã đẩy, bỏ qua nút assistant, và gom nhiều đích", async () => {
    const events = [userEvent(), assistantEvent(), toolEvent()];
    // 3 ảnh cần đẩy: `user` góp [0, 1] (ảnh thứ ba đã đẩy nên BỎ QUA nhưng VẪN tính vào chỉ số),
    // `assistant/message` bị bỏ qua HOÀN TOÀN (đầu ra model), rồi `tool/result` góp [0].
    const ours = await observeRequest(apply, { code: llm.IMAGE_OFFLOAD_REQUIRED_CODE, offloadImages: 3 }, makeSession(events));
    const theirs = await observeRequest(stock.apply, { code: llm.IMAGE_OFFLOAD_REQUIRED_CODE, offloadImages: 3 }, makeSession([userEvent(), assistantEvent(), toolEvent()]));
    expect(ours).toEqual(theirs);
    expect(ours.action).toEqual({ kind: "retry" });
    expect(ours.appends).toEqual([
      { type: "image/offload", data: { targets: [{ seq: 1, imageIndexes: [0, 1] }, { seq: 3, imageIndexes: [0] }] } },
    ]);
    // Nút assistant KHÔNG xuất hiện trong đích nào (không có `seq: 2`).
    expect(ours.appends[0]?.data.targets.map((target) => target.seq)).toEqual([1, 3]);
  });

  test("agent/request-error: mã lỗi khác / thiếu offloadImages / đã huỷ ⇒ chuyển tiếp, 0 quyết định", async () => {
    for (const scenario of [
      { code: "RATE_LIMIT", offloadImages: 1 },
      { code: llm.IMAGE_OFFLOAD_REQUIRED_CODE },
      { code: llm.IMAGE_OFFLOAD_REQUIRED_CODE, offloadImages: 1, aborted: true },
    ] satisfies RequestCase[]) {
      const ours = await observeRequest(apply, scenario, makeSession([userEvent()]));
      const theirs = await observeRequest(stock.apply, scenario, makeSession([userEvent()]));
      expect(ours).toEqual(theirs);
      expect(ours.action).toEqual({ kind: "delegated" });
      expect(ours.nextCalls).toBe(1);
      expect(ours.appends).toEqual([]);
    }
  });

  test("agent/request-error: KHÔNG còn ảnh nào để đẩy ⇒ chuyển tiếp (không ghi sự kiện rỗng)", async () => {
    const allOffloaded = { type: "user/message", data: { role: "user", content: [{ ...img("a.png"), offloaded: true }] } };
    const ours = await observeRequest(apply, { code: llm.IMAGE_OFFLOAD_REQUIRED_CODE, offloadImages: 1 }, makeSession([allOffloaded]));
    const theirs = await observeRequest(
      stock.apply,
      { code: llm.IMAGE_OFFLOAD_REQUIRED_CODE, offloadImages: 1 },
      makeSession([{ type: "user/message", data: { role: "user", content: [{ ...img("a.png"), offloaded: true }] } }]),
    );
    expect(ours).toEqual(theirs);
    expect(ours.action).toEqual({ kind: "delegated" });
    expect(ours.nextCalls).toBe(1);
    expect(ours.appends).toEqual([]);
  });

  test("compaction/summary-error: LlmError THẬT đúng mã ⇒ ghi quyết định rồi trả true", () => {
    const make = (code: string, LlmErrorClass: typeof llm.LlmError): unknown => new LlmErrorClass("qua ngan sach anh", code, { offloadImages: 2 });
    const ours = observeSummary(apply, { make }, makeSession([userEvent(), toolEvent()]));
    const theirs = observeSummary(stock.apply, { make }, makeSession([userEvent(), toolEvent()]));
    expect(ours).toEqual(theirs);
    expect(ours.result).toBe(true);
    expect(ours.nextCalls).toBe(0);
    // `offloadImages: 2` dừng NGAY trong thông điệp đầu: cả hai ảnh còn giữ của nó được chọn.
    expect(ours.appends).toEqual([{ type: "image/offload", data: { targets: [{ seq: 1, imageIndexes: [0, 1] }] } }]);
  });

  test("compaction/summary-error: lỗi KHÔNG phải LlmError (dù cùng mã) ⇒ chuyển tiếp — instanceof là BẮT BUỘC", () => {
    const make = (code: string): unknown =>
      Object.assign(new Error("gia mao"), { code, failure: Object.freeze({ message: "gia mao", code, offloadImages: 1 }) });
    const ours = observeSummary(apply, { make }, makeSession([userEvent()]));
    const theirs = observeSummary(stock.apply, { make }, makeSession([userEvent()]));
    expect(ours).toEqual(theirs);
    expect(ours.result).toBe(false);
    expect(ours.nextCalls).toBe(1);
    expect(ours.appends).toEqual([]);
  });

  test("compaction/summary-error: sai mã / thiếu offloadImages ⇒ chuyển tiếp", () => {
    for (const make of [
      (code: string, LlmErrorClass: typeof llm.LlmError): unknown => new LlmErrorClass("khac ma", "RATE_LIMIT", { offloadImages: 1 }),
      (code: string, LlmErrorClass: typeof llm.LlmError): unknown => new LlmErrorClass("thieu so luong", code),
    ]) {
      const ours = observeSummary(apply, { make }, makeSession([userEvent()]));
      const theirs = observeSummary(stock.apply, { make }, makeSession([userEvent()]));
      expect(ours).toEqual(theirs);
      expect(ours.result).toBe(false);
      expect(ours.nextCalls).toBe(1);
      expect(ours.appends).toEqual([]);
    }
  });

  test("compaction/summary-error: huỷ TRƯỚC khi ghi ⇒ ném ĐÚNG lý do huỷ, 0 quyết định (giữ nguyên thứ tự)", () => {
    const make = (code: string, LlmErrorClass: typeof llm.LlmError): unknown => new LlmErrorClass("qua ngan sach anh", code, { offloadImages: 1 });
    const ours = observeSummary(apply, { make, aborted: true }, makeSession([userEvent()]));
    const theirs = observeSummary(stock.apply, { make, aborted: true }, makeSession([userEvent()]));
    expect(ours).toEqual(theirs);
    expect(ours.error).toBe("huy");
    expect(ours.sameReason).toBe(true);
    expect(ours.appends).toEqual([]);
    expect(ours.nextCalls).toBe(0);
  });

  test("offloadMessageImages: chỉ đánh dấu đúng chỉ số đã chọn, phần còn lại NGUYÊN VĂN, kết quả đóng băng sâu", () => {
    const message = mixedMessage();
    const ours = offloadMessageImages(message, [0, 1]);
    const theirs = offloadMessageImages(mixedMessage(), [0, 1]);
    expect(ours.content).toEqual(theirs.content);
    expect(ours.content.map((block) => block.type + (block.offloaded === true ? "*" : ""))).toEqual([
      "image*",
      "text",
      "image*",
      "image*",
      "text",
    ]);
    // Đóng băng sâu: sửa bất kỳ tầng nào cũng ném, GIỐNG bản gốc.
    expect(Object.isFrozen(ours)).toBe(true);
    expect(Object.isFrozen(ours.content)).toBe(true);
    expect(() => {
      (ours.content[0] as { offloaded?: boolean }).offloaded = false;
    }).toThrow();
    // Thông điệp gốc KHÔNG bị sửa (phép chiếu là thuần).
    expect(message.content[0]?.offloaded).toBeUndefined();
  });

  test("offloadMessageImages: chỉ số không tồn tại / ảnh đã đẩy ⇒ NÉM đúng câu của bản gốc", () => {
    const cases: { message: Msg; indexes: number[] }[] = [
      { message: { role: "user", content: [txt("khong co anh")] }, indexes: [0] },
      { message: { role: "user", content: [{ ...img("a.png"), offloaded: true }] }, indexes: [0] },
      { message: mixedMessage(), indexes: [0, 4] },
    ];
    for (const item of cases) {
      let oursError = "";
      try {
        offloadMessageImages(item.message, item.indexes);
      } catch (caught) {
        oursError = caught instanceof Error ? caught.message : String(caught);
      }
      let theirsError = "";
      try {
        offloadMessageImages(JSON.parse(JSON.stringify(item.message)) as MessageLike, item.indexes);
      } catch (caught) {
        theirsError = caught instanceof Error ? caught.message : String(caught);
      }
      expect(oursError).toBe(theirsError);
      expect(oursError.length).toBeGreaterThan(0);
    }
  });

  test("offloadOldestImages: trả false và KHÔNG ghi khi không có sự kiện đầu vào nào", () => {
    const session = makeSession([assistantEvent()]);
    expect(offloadOldestImages(session.seam, [1], 1)).toBe(false);
    expect(session.appends).toEqual([]);
    const stockSession = makeSession([assistantEvent()]);
    expect((stock as unknown as { apply: unknown }).apply).toBeDefined();
    expect(offloadOldestImages(stockSession.seam, [1], 1)).toBe(false);
    expect(stockSession.appends).toEqual([]);
  });
});

describe("row image-offload · projection trên ARTIFACT của cả hai bên", () => {
  /** Ngữ cảnh projection dựng từ một phiên giả. */
  const contextOf = (session: FakeSession, messages = new Map<SessionSeq, MessageLike>()): ProjectionContextLike => ({
    nodes: session.surface.nodes,
    events: session.events.map((event) => event as SessionEventLike),
    baseSeq: 1,
    messages,
  });

  test("định nghĩa projection của ta = bản gốc: cùng type, cùng kết quả, cùng đóng băng sâu", () => {
    expect(imageOffloadProjection.type).toBe(stockProjection.type);
    const session = makeSession([userEvent(), toolEvent()]);
    const event = { type: "image/offload" as const, data: { targets: [{ seq: 1, imageIndexes: [0] }, { seq: 2, imageIndexes: [2] }] } };
    const ours = imageOffloadProjection.project(event, contextOf(session));
    const theirs = stockProjection.project(event, contextOf(makeSession([userEvent(), toolEvent()])));
    expect([...ours.keys()]).toEqual([...theirs.keys()]);
    for (const seq of ours.keys()) {
      const left = ours.get(seq) as MessageLike;
      const right = theirs.get(seq) as MessageLike;
      expect(left.content).toEqual(right.content);
      expect(Object.isFrozen(left)).toBe(Object.isFrozen(right));
      expect(Object.isFrozen(left.content)).toBe(Object.isFrozen(right.content));
    }
  });

  test("projection: MỌI thân sự kiện sai hình dạng ⇒ NÉM đúng câu của bản gốc, không đổi gì", () => {
    const session = makeSession([userEvent(), toolEvent()]);
    const context = contextOf(session);
    const bad: { type: "image/offload"; data: unknown }[] = [
      { type: "image/offload", data: undefined },
      { type: "image/offload", data: {} },
      { type: "image/offload", data: { targets: [] } },
      { type: "image/offload", data: { targets: [], extra: 1 } },
      { type: "image/offload", data: { targets: [{ seq: 1, imageIndexes: [0], extra: 1 }] } },
      { type: "image/offload", data: { targets: [{ seq: 1, imageIndexes: [] }] } },
      { type: "image/offload", data: { targets: [{ seq: -1, imageIndexes: [0] }] } },
      { type: "image/offload", data: { targets: [{ seq: 1, imageIndexes: [0] }, { seq: 1, imageIndexes: [0] }] } },
      { type: "image/offload", data: { targets: [{ seq: 9, imageIndexes: [0] }] } },
      { type: "image/offload", data: { targets: [{ seq: 1, imageIndexes: [1, 0] }] } },
      { type: "image/offload", data: { targets: [{ seq: 1, imageIndexes: [0.5] }] } },
    ];
    for (const event of bad) {
      let oursError = "";
      try {
        imageOffloadProjection.project(event, context);
      } catch (caught) {
        oursError = caught instanceof Error ? caught.message : String(caught);
      }
      let theirsError = "";
      try {
        stockProjection.project(event, contextOf(makeSession([userEvent(), toolEvent()])));
      } catch (caught) {
        theirsError = caught instanceof Error ? caught.message : String(caught);
      }
      expect(oursError).toBe(theirsError);
      expect(oursError.length).toBeGreaterThan(0);
    }
  });

  test("projection: dùng thông điệp ĐÃ CHIẾU trước đó khi có (context.messages thắng sự kiện gốc)", () => {
    const session = makeSession([userEvent()]);
    const previousMessage: Msg = { role: "user", content: [txt("da chieu"), img("b.png")] };
    const previous = new Map<SessionSeq, MessageLike>([[1, previousMessage]]);
    const event = { type: "image/offload" as const, data: { targets: [{ seq: 1, imageIndexes: [0] }] } };
    const ours = imageOffloadProjection.project(event, contextOf(session, previous));
    const theirs = stockProjection.project(event, contextOf(makeSession([userEvent()]), new Map(previous)));
    expect(ours.get(1)?.content).toEqual(theirs.get(1)?.content);
    expect(ours.get(1)?.content).toEqual([txt("da chieu"), { ...img("b.png"), offloaded: true }]);
  });

  test("deepFreeze của ta = deepFreeze của kernel trên CÙNG đồ thị (kể cả AbortSignal được bỏ qua)", () => {
    const make = (): Record<string, unknown> => {
      const controller = new AbortController();
      return { a: { b: [1, { c: "x" }] }, signal: controller.signal, list: [{ d: { e: 2 } }] };
    };
    const ours = deepFreeze(make());
    const theirs = kernelFreeze(make());
    const frozen = (value: unknown): string[] => {
      const out: string[] = [];
      const walk = (node: unknown, path: string): void => {
        if (node === null || typeof node !== "object") return;
        out.push(path + ":" + String(Object.isFrozen(node)));
        for (const [key, child] of Object.entries(node)) walk(child, path + "." + key);
      };
      walk(value, "root");
      return out.sort();
    };
    expect(frozen(ours)).toEqual(frozen(theirs));
    // AbortSignal KHÔNG bị đóng băng (tín hiệu huỷ phải dùng được tiếp).
    expect(Object.isFrozen(ours["signal"])).toBe(false);
    // Đóng băng TẠI CHỖ: trả lại ĐÚNG vật thể đã nhận.
    const input = make();
    expect(deepFreeze(input)).toBe(input);
  });
});

describe("row image-offload · bề mặt plugin đo trên ARTIFACT", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, 0 id module, apply nhận 1 tham số", async () => {
    const file = await buildPackage(ARTIFACT_DIR);
    const code = readFileSync(file, "utf8");
    // Host-only: KHÔNG đăng ký id module nào (bản gốc cũng vậy) — nên cả hai phép đếm đều 0.
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as { apply: (ctx: ImageOffloadContext) => void; inject: string[]; name: string };
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual(["apply", "inject", "name"]);
    expect("default" in artifact).toBe(false);
    expect(artifact.apply.length).toBe(stock.apply.length);
    expect(artifact.apply.length).toBe(1);
    expect(artifact.name).toBe(stock.name);
    expect(artifact.name).toBe("compaction-image-offload");
    expect(artifact.inject).toEqual(stock.inject);
    expect(artifact.inject).toEqual(["agents", "sessions"]);
    expect(inject).toEqual(artifact.inject);
    expect(name).toEqual(artifact.name);
    // Subpath `./projection` như bản gốc: đúng MỘT export, cùng tên.
    const oursProjection = (await import(join(ARTIFACT_DIR, "projection.js"))) as { imageOffloadProjection: MessageProjectionLike };
    expect(Object.keys(oursProjection)).toEqual(["imageOffloadProjection"]);
    expect(Object.keys((await import(STOCK_PROJECTION)) as Record<string, unknown>)).toEqual(["imageOffloadProjection"]);
    expect(oursProjection.imageOffloadProjection.type).toBe(stockProjection.type);
  });

  test("000e: locale en/zh chép byte-for-byte từ gói gốc, và manifest export chúng", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { exports?: Record<string, string> };
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    expect(manifest.exports?.["./projection"]).toBe("./lib/projection.js");
    for (const locale of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(PKG, "locale", locale));
      const theirs = readFileSync(join(STOCK_DIR, "locale", locale));
      expect(ours.equals(theirs)).toBe(true);
    }
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Peer THẬT SỰ dùng lúc chạy: `dsh-llm` (hằng `IMAGE_OFFLOAD_REQUIRED_CODE` + LỚP `LlmError`). */
const RUNTIME_PEERS = ["@deepseek-ai/dsh-llm"];

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

describe("row image-offload · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
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

describe("row image-offload · cổng an toàn mount", () => {
  test("package KHÔNG được kéo bất kỳ gói @galaxy-stack nào (luật bất biến)", () => {
    expect(readFileSync(MANIFEST, "utf8").includes("@galaxy-stack/")).toBe(false);
  });

  test("hợp đồng khai row: nếu CÓ gbh.row thì id + tests phải trỏ đúng gói này (Lead khai, không phải ta)", () => {
    const row = readManifest().gbh?.row as { id?: string; tests?: string[] } | undefined;
    // Lượt này gói được viết khi CHƯA khai row; nếu Lead đã khai thì hợp đồng dưới đây phải đúng.
    if (row === undefined) return;
    expect(row.id).toBe("image-offload");
    expect(row.tests ?? []).toContain("tests/host/image-offload.test.ts");
  });
});

describe("row image-offload · C6: vật thể ĐỘC LẬP theo DANH TÍNH", () => {
  test("hai lượt chọn ảnh ⇒ hai vật thể quyết định riêng, sửa một KHÔNG lan sang cái kia", () => {
    const left = makeSession([userEvent()]);
    const right = makeSession([userEvent()]);
    expect(offloadOldestImages(left.seam, [1], 1)).toBe(true);
    expect(offloadOldestImages(right.seam, [1], 1)).toBe(true);
    const leftData = left.appends[0]?.data as Append["data"];
    const rightData = right.appends[0]?.data as Append["data"];
    // Giá trị bằng nhau (phép so sâu ĐẠT) nhưng DANH TÍNH khác — đúng lớp lỗi C6.
    expect(leftData).toEqual(rightData);
    expect(leftData).not.toBe(rightData);
    expect(leftData.targets).not.toBe(rightData.targets);
    expect(leftData.targets[0]).not.toBe(rightData.targets[0]);
    expect(leftData.targets[0]?.imageIndexes).not.toBe(rightData.targets[0]?.imageIndexes);
    leftData.targets[0]?.imageIndexes.push(99);
    (leftData.targets[0] as { seq: number }).seq = 42;
    expect(rightData.targets[0]?.imageIndexes).toEqual([0]);
    expect(rightData.targets[0]?.seq).toBe(1);
  });

  test("hai lượt chiếu CÙNG một thông điệp ⇒ hai Map riêng và hai mảng content riêng", () => {
    const event = { type: "image/offload" as const, data: { targets: [{ seq: 1, imageIndexes: [0] }] } };
    const context = (): ProjectionContextLike => ({
      nodes: [1],
      events: [userEvent() as SessionEventLike],
      baseSeq: 1,
      messages: new Map(),
    });
    const first = imageOffloadProjection.project(event, context());
    const second = imageOffloadProjection.project(event, context());
    expect([...first.get(1)?.content ?? []]).toEqual([...second.get(1)?.content ?? []]);
    expect(first).not.toBe(second);
    expect(first.get(1)).not.toBe(second.get(1));
    expect(first.get(1)?.content).not.toBe(second.get(1)?.content);
    expect(first.get(1)?.content[0]).not.toBe(second.get(1)?.content[0]);
  });

  test("hai lượt chiếu thông điệp (không qua Map) ⇒ khối đã đẩy là vật thể MỚI mỗi lần", () => {
    const first = offloadMessageImages(mixedMessage(), [0]);
    const second = offloadMessageImages(mixedMessage(), [0]);
    expect(first.content[0]).toEqual(second.content[0]);
    expect(first.content[0]).not.toBe(second.content[0]);
    // Mảng không đổi (khối chữ) vẫn được chia sẻ vì phép chiếu KHÔNG sao chép vô ích — nhưng mảng đã đóng băng.
    expect(Object.isFrozen(first.content)).toBe(true);
  });
});
