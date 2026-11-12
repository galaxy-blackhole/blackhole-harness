/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B cho NỬA HOST của row api-remotes: đo trên ARTIFACT, đối chứng TRỰC TIẾP với chính bundle
 *      gốc trên Context cordis THẬT — bề mặt export, allowlist, đăng ký Gateway, khung emit/waterfall,
 *      kiểm lossless JSON, vòng đời abort/bị huỷ, và hai nhánh lỗi của waterfall có carrier. Mỗi bản được
 *      cấp VẬT MANG phạm vi bằng ĐÚNG bản `dsh-scope` mà chính nó nạp (hai tệp khác nhau trên đĩa).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { homedir, tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/api-remotes/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "api-remotes");
/** Gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-remotes", "lib", "index.js");
/**
 * cordis mà CHÍNH package ta nạp — TỆP khác với bản của apps/host (nội dung y hệt), nhưng dùng được cho CẢ
 * hai rig vì `Context.filter` là ký hiệu TOÀN CỤC (`Symbol.for("cordis.filter")`) chứ không phải mỗi
 * thể hiện một ký hiệu: vật mang dựng bằng bất kỳ bản `dsh-scope` nào cũng được bộ lọc của bản này nhận ra.
 */
const CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** dsh-scope mà ARTIFACT CỦA TA nạp — nguồn dựng CARRIER thật cho nhánh waterfall có định danh phía ta. */
const OUR_SCOPE = join(PKG, "node_modules", "@deepseek-ai", "dsh-scope", "lib", "index.js");
/** dsh-scope mà BUNDLE GỐC nạp (bản kernel cài riêng dưới apps/host) — TỆP khác trên đĩa, nội dung y hệt. */
const STOCK_SCOPE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-scope", "lib", "index.js");
/** Thư mục build tạm: nằm dưới lib/ (thư mục đã được cổng lint miễn trừ) để không bị quét như nguồn. */
const OUT = join(PKG, "lib", ".test-build");
/** Artifact của ta (dựng trong beforeAll). */
const ARTIFACT = join(OUT, "index.js");

/** Một khung emit/waterfall nhìn qua góc hẹp — chỉ các trường mà phép so chạm tới. */
interface FrameView {
  /** Tên sự kiện. */
  readonly event: string;
  /** Tham số emit (vắng ở khung waterfall). */
  readonly args?: readonly unknown[];
  /** Bộ đọc tài nguyên (vắng khi sự kiện không mang tài nguyên riêng). */
  readonly resources?: Readonly<Record<string, (payload: never) => unknown>>;
  /** Ngữ cảnh dispatch (chỉ khung waterfall). */
  readonly context?: { readonly value: unknown; readonly subject: unknown; readonly agentId: string };
  /** Cửa kết thúc lượt chờ (chỉ khung waterfall). */
  readonly resolve?: (outcome: { readonly kind: string; readonly value?: unknown }) => void;
  /** Cửa từ chối lượt chờ (chỉ khung waterfall). */
  readonly reject?: (reason: unknown) => void;
}

/** Mặt module của một artifact: đúng ba export runtime của nửa host. */
interface RemotesModule {
  /** Allowlist sự kiện chuyển tiếp. */
  readonly API_REMOTE_FORWARDED_EVENTS: readonly {
    readonly event: string;
    readonly mode: string;
    readonly resources?: Readonly<Record<string, (payload: never) => unknown>>;
  }[];
  /** Danh sách service bắt buộc. */
  readonly inject: readonly string[];
  /** Thân plugin Host. */
  readonly apply: (ctx: unknown) => void;
}

/** Context cordis THẬT nhìn qua góc hẹp: đúng năm thao tác mà rig dùng. */
interface ContextLike {
  /** Cấp một dịch vụ cho context. */
  provide(name: string, value: unknown): void;
  /** Đăng ký effect (chạy callback ngay). */
  effect(callback: () => () => unknown, label: string): unknown;
  /** Nghe một sự kiện; trả hàm dọn. */
  on(event: string, listener: (this: unknown, ...args: never[]) => unknown): () => void;
  /** Phát một sự kiện (tham số đầu có thể là this). */
  emit(...args: never[]): void;
  /** Chạy waterfall (tham số đầu có thể là this). */
  waterfall(...args: never[]): unknown;
}

/** Gateway giả: ghi lại nguồn/host và đếm lượt dọn. */
interface FakeGateway {
  /** Số lượt registerRemoteEvents. */
  calls: number;
  /** Nguồn đã đăng ký. */
  source?: (signal: AbortSignal) => AsyncIterable<FrameView>;
  /** Thông tin máy chạy đã đăng ký. */
  host?: { readonly home: string };
  /** Số lượt dọn của lượt đăng ký. */
  disposed: number;
}

/** Một rig: context cordis THẬT + Gateway giả + nguồn đã đăng ký. */
interface Rig {
  /** Context cordis thật. */
  readonly ctx: ContextLike;
  /** Gateway giả. */
  readonly gateway: FakeGateway;
  /** Nguồn đã đăng ký với Gateway. */
  readonly source: (signal: AbortSignal) => AsyncIterable<FrameView>;
}

/**
 * Dựng rig cho MỘT module (ta hoặc gốc).
 * Nhận: mod — module đã nạp.
 * Trả: context cordis thật + Gateway giả + nguồn đã đăng ký.
 */
function rig(mod: RemotesModule): Rig {
  const ctx = new Context() as unknown as ContextLike;
  const gateway: FakeGateway = { calls: 0, disposed: 0 };
  ctx.provide("typertGateway", {
    registerRemoteEvents: (
      source: (signal: AbortSignal) => AsyncIterable<FrameView>,
      host: { readonly home: string },
    ): (() => Promise<void>) => {
      gateway.calls += 1;
      gateway.source = source;
      gateway.host = host;
      return async (): Promise<void> => {
        gateway.disposed += 1;
      };
    },
  });
  mod.apply(ctx as unknown as never);
  if (gateway.source === undefined) throw new Error("plugin KHONG dang ky nguon su kien");
  return { ctx, gateway, source: gateway.source };
}

/**
 * Mở một vòng kéo của nguồn.
 * Nhận: rigged — rig; signal — vòng đời nguồn.
 * Trả: iterator khung.
 */
function iteratorOf(rigged: Rig, signal: AbortSignal): AsyncIterator<FrameView> {
  return rigged.source(signal)[Symbol.asyncIterator]();
}

/**
 * Kéo ĐÚNG một khung.
 * Nhận: iterator khung.
 * Trả: khung kế tiếp; ném khi nguồn kết thúc trước.
 */
async function nextFrame(iterator: AsyncIterator<FrameView>): Promise<FrameView> {
  const step = await iterator.next();
  if (step.done === true || step.value === undefined) throw new Error("nguon ket thuc truoc khi co khung");
  return step.value;
}

/**
 * Bản rút gọn của một khung để so A/B.
 * Nhận: frame — khung cần rút gọn.
 * Trả: vật thể chỉ còn trường so được (bỏ hàm đọc tài nguyên + hai cửa resolve/reject).
 */
function viewOf(frame: FrameView): Record<string, unknown> {
  return {
    event: frame.event,
    args: frame.args,
    resources: frame.resources === undefined ? undefined : Object.keys(frame.resources),
    context: frame.context,
  };
}

/**
 * Thông điệp lỗi của một lượt gọi.
 * Nhận: run — hàm cần chạy.
 * Trả: nhãn name: message, hoặc (khong nem) khi không ném.
 */
async function errorOf(run: () => unknown): Promise<string> {
  try {
    await run();
    return "(khong nem)";
  } catch (thrown: unknown) {
    const error = thrown as { name?: string; message?: string };
    return String(error.name) + ": " + String(error.message);
  }
}

/** Bundle gốc nạp động. */
const stockMod = (await import(STOCK)) as unknown as RemotesModule;
/** Context cordis THẬT của kernel. */
const { Context } = (await import(CORDIS)) as unknown as { Context: new () => object };
/** Mặt module của `dsh-scope` mà phép thử cần: đúng một hàm dựng VẬT MANG phạm vi. */
interface ScopeModule {
  /** Dựng vật mang (carrier) khoá bằng `key`, giữ nguyên bộ lọc của `base`. */
  scopeTarget(base: object, key: object): object;
}
/**
 * dsh-scope của phía TA.
 * ⚠️ `carrierKeys` của `dsh-scope` là WeakMap CẤP MODULE: hai bản cài (workspace vs kernel dưới apps/host)
 * là hai tệp riêng trên đĩa nên là hai thể hiện riêng, KHÔNG nhìn thấy vật mang của nhau. Vì vậy mỗi bản
 * phải được cấp vật mang bằng đúng bản scope mà nó nạp — nếu không phía gốc thấy `carrierKeyOf(this)`
 * là undefined và rơi về `next()` (không đẩy khung nào ⇒ phép đo treo).
 */
const ourScope = (await import(OUR_SCOPE)) as unknown as ScopeModule;
/** dsh-scope của phía GỐC (bundle gốc phân giải bare specifier từ chính cây apps/host). */
const stockScope = (await import(STOCK_SCOPE)) as unknown as ScopeModule;
/** Module của TA đã build (điền trong beforeAll). */
let ourMod: RemotesModule;

/** Đường dẫn build tạm cần dọn. */
const tempDirs: string[] = [];

beforeAll(async () => {
  await buildPackage(OUT);
  ourMod = (await import(ARTIFACT)) as unknown as RemotesModule;
});

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
  for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
});

describe("nửa host api-remotes — bề mặt artifact", () => {
  test("tập export runtime bằng gốc: đúng ba tên, không có default", () => {
    for (const mod of [ourMod, stockMod]) {
      expect(Object.keys(mod).sort()).toEqual(["API_REMOTE_FORWARDED_EVENTS", "apply", "inject"]);
    }
  });

  test("inject bằng gốc: đúng một service typertGateway", () => {
    expect(ourMod.inject).toEqual(["typertGateway"]);
    expect(ourMod.inject).toEqual(stockMod.inject);
  });

  test("allowlist bằng gốc TỪNG PHẦN TỬ: 28 mục, cùng tên, cùng mode, cùng bộ khoá tài nguyên", () => {
    expect(ourMod.API_REMOTE_FORWARDED_EVENTS.length).toBe(28);
    expect(stockMod.API_REMOTE_FORWARDED_EVENTS.length).toBe(28);
    const shape = (mod: RemotesModule): unknown =>
      mod.API_REMOTE_FORWARDED_EVENTS.map((entry) => ({
        event: entry.event,
        mode: entry.mode,
        resources: entry.resources === undefined ? undefined : Object.keys(entry.resources),
      }));
    expect(shape(ourMod)).toEqual(shape(stockMod));
  });

  test("bộ ĐỌC tài nguyên bằng gốc: session đồng nhất, api-session/added đọc summary.sessionId", () => {
    for (const mod of [ourMod, stockMod]) {
      const activity = mod.API_REMOTE_FORWARDED_EVENTS.find((entry) => entry.event === "api-session/activity");
      const added = mod.API_REMOTE_FORWARDED_EVENTS.find((entry) => entry.event === "api-session/added");
      const sessionOfActivity = activity?.resources?.["session"];
      const sessionOfAdded = added?.resources?.["session"];
      expect(sessionOfActivity).toBeDefined();
      expect(sessionOfAdded).toBeDefined();
      expect(sessionOfActivity?.("s-1" as never)).toBe("s-1");
      expect(sessionOfAdded?.({ sessionId: "s-2" } as never)).toBe("s-2");
    }
  });
});

describe("nửa host api-remotes — đăng ký với Gateway", () => {
  test("apply đăng ký ĐÚNG MỘT nguồn, host.home = homedir()", () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    expect(mine.gateway.calls).toBe(1);
    expect(theirs.gateway.calls).toBe(1);
    expect(mine.gateway.host).toEqual(theirs.gateway.host);
    expect(mine.gateway.host?.home).toBe(homedir());
  });

  test("effect mang nhãn nguyên văn của gốc và chạy ĐÚNG một lần mỗi bản", () => {
    const labels: string[] = [];
    const ctx = new Context() as unknown as ContextLike;
    const original = ctx.effect.bind(ctx);
    ctx.effect = (callback, label) => {
      labels.push(label);
      return original(callback, label);
    };
    ctx.provide("typertGateway", { registerRemoteEvents: () => async (): Promise<void> => {} });
    ourMod.apply(ctx as unknown as never);
    stockMod.apply(ctx as unknown as never);
    const rowLabels = labels.filter((label) => label.startsWith("api-remotes:"));
    expect(rowLabels).toEqual([
      "api-remotes: forwarded Cordis event source",
      "api-remotes: forwarded Cordis event source",
    ]);
  });
});

describe("nửa host api-remotes — khung emit", () => {
  test("emit KHÔNG tài nguyên: khung {event, args} y hệt, KHÔNG có khoá resources", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const signal = new AbortController();
    const mineFrames = iteratorOf(mine, signal.signal);
    const theirsFrames = iteratorOf(theirs, signal.signal);
    mine.ctx.emit("agent-preset/selected" as never, "preset-1" as never, 2 as never);
    theirs.ctx.emit("agent-preset/selected" as never, "preset-1" as never, 2 as never);
    const mineFrame = await nextFrame(mineFrames);
    const theirsFrame = await nextFrame(theirsFrames);
    expect(viewOf(mineFrame)).toEqual(viewOf(theirsFrame));
    expect(mineFrame.resources).toBeUndefined();
    expect(mineFrame.event).toBe("agent-preset/selected");
    expect(mineFrame.args).toEqual(["preset-1", 2]);
    signal.abort();
  });

  test("emit CÓ tài nguyên: khung mang resources.session đọc được như gốc", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const signal = new AbortController();
    const mineFrames = iteratorOf(mine, signal.signal);
    const theirsFrames = iteratorOf(theirs, signal.signal);
    mine.ctx.emit("api-session/activity" as never, "session-7" as never);
    theirs.ctx.emit("api-session/activity" as never, "session-7" as never);
    const mineFrame = await nextFrame(mineFrames);
    const theirsFrame = await nextFrame(theirsFrames);
    expect(viewOf(mineFrame)).toEqual(viewOf(theirsFrame));
    const sessionReader = mineFrame.resources?.["session"];
    expect(sessionReader).toBeDefined();
    expect(sessionReader?.("session-9" as never)).toBe("session-9");
    signal.abort();
  });

  test("nhiều emit liên tiếp: thứ tự khung FIFO y hệt gốc", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const signal = new AbortController();
    const mineFrames = iteratorOf(mine, signal.signal);
    const theirsFrames = iteratorOf(theirs, signal.signal);
    mine.ctx.emit("commands/change" as never);
    mine.ctx.emit("goal/activation-changed" as never, true as never);
    theirs.ctx.emit("commands/change" as never);
    theirs.ctx.emit("goal/activation-changed" as never, true as never);
    const mineOrder: string[] = [];
    const theirsOrder: string[] = [];
    for (let index = 0; index < 2; index += 1) {
      mineOrder.push((await nextFrame(mineFrames)).event);
      theirsOrder.push((await nextFrame(theirsFrames)).event);
    }
    expect(mineOrder).toEqual(theirsOrder);
    expect(mineOrder).toEqual(["commands/change", "goal/activation-changed"]);
    signal.abort();
  });
});

describe("nửa host api-remotes — kiểm lossless JSON (đường LỖI)", () => {
  test("tham số là HÀM: ném lỗi nêu đúng chỉ số 0, y hệt gốc", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    // ⚠️ Listener đăng ký TRONG lần gọi source(signal) (không phải lúc apply) ⇒ phải MỞ NGUỒN trước.
    const signal = new AbortController();
    iteratorOf(mine, signal.signal);
    iteratorOf(theirs, signal.signal);
    const mineError = await errorOf(() => mine.ctx.emit(null as never, "commands/change" as never, (() => 1) as never));
    const theirsError = await errorOf(() => theirs.ctx.emit(null as never, "commands/change" as never, (() => 1) as never));
    signal.abort();
    expect(mineError).toBe(theirsError);
    expect(mineError).toContain("argument 0 is not lossless JSON data");
  });

  test("BigInt ở vị trí 1: ném lỗi nêu chỉ số 1, y hệt gốc", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const signal = new AbortController();
    iteratorOf(mine, signal.signal);
    iteratorOf(theirs, signal.signal);
    const mineError = await errorOf(() => mine.ctx.emit("goal/activation-changed" as never, "ok" as never, BigInt(1) as never));
    const theirsError = await errorOf(() => theirs.ctx.emit("goal/activation-changed" as never, "ok" as never, BigInt(1) as never));
    signal.abort();
    expect(mineError).toBe(theirsError);
    expect(mineError).toContain("argument 1 is not lossless JSON data");
  });

  test("undefined LỒNG trong object vẫn là dữ liệu không lossless (y hệt gốc)", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const signal = new AbortController();
    iteratorOf(mine, signal.signal);
    iteratorOf(theirs, signal.signal);
    // Tham số là OBJECT/ARRAY/FUNCTION ⇒ cordis coi nó là `this` của lượt phát, nên phải truyền `null`
    // tường minh để nó thành THAM SỐ đúng như hợp đồng.
    const mineError = await errorOf(() => mine.ctx.emit(null as never, "settings/document-updated" as never, { value: undefined } as never));
    const theirsError = await errorOf(() => theirs.ctx.emit(null as never, "settings/document-updated" as never, { value: undefined } as never));
    signal.abort();
    expect(mineError).toBe(theirsError);
    expect(mineError).toContain("argument 0 is not lossless JSON data");
  });
});

describe("nửa host api-remotes — waterfall: nhánh KHÔNG carrier", () => {
  test("không carrier: gọi next() và trả nguyên kết quả của next (y hệt gốc)", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    let mineNext = 0;
    let theirsNext = 0;
    const mineValue = mine.ctx.waterfall(
      "approval/request" as never,
      { kind: "x" } as never,
      (() => {
        mineNext += 1;
        return "inner";
      }) as never,
    );
    const theirsValue = theirs.ctx.waterfall(
      "approval/request" as never,
      { kind: "x" } as never,
      (() => {
        theirsNext += 1;
        return "inner";
      }) as never,
    );
    expect(await mineValue).toBe(await theirsValue);
    expect(mineNext).toBe(1);
    expect(theirsNext).toBe(1);
  });
});

describe("nửa host api-remotes — waterfall: nhánh CÓ carrier (dispatch qua Gateway)", () => {
  /**
   * Dựng một agent + carrier THẬT của scope.
   * Nhận: scope — bản dsh-scope MÀ BẢN ĐANG ĐO nạp; id — danh tính agent.
   * Trả: cặp agent/carrier dùng cho lượt waterfall có định danh.
   */
  function carrierFor(scope: ScopeModule, id: string): { agent: { id: string; ctx: unknown }; carrier: object } {
    const agent = { id, ctx: { scoped: "ctx-" + id } };
    // Scope key của DSH CHÍNH LÀ đối tượng agent (createScope(ctx, agent)) — carrier phải đánh khoá bằng nó,
    // nếu không `carrierKeyOf(this) !== request.agent` và listener ném TypeError đúng như bản gốc.
    // Vật mang PHẢI dựng bằng đúng bản scope của bản đang đo: hai bản cài đặt giữ hai WeakMap riêng, nên
    // vật mang của bản kia là "vật lạ" (`carrierKeyOf` trả undefined) với bản này.
    return { agent, carrier: scope.scopeTarget({}, agent) };
  }

  test("agent khớp carrier: khung dispatch mang context {value, subject, agentId} y hệt gốc", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const mineSignal = new AbortController();
    const theirsSignal = new AbortController();
    const mineFrames = iteratorOf(mine, mineSignal.signal);
    const theirsFrames = iteratorOf(theirs, theirsSignal.signal);
    const mineAgent = carrierFor(ourScope, "agent-1");
    const theirsAgent = carrierFor(stockScope, "agent-1");
    const minePending = mine.ctx.waterfall(
      mineAgent.carrier as never,
      "approval/request" as never,
      { agent: mineAgent.agent } as never,
      (() => "inner-mine") as never,
    );
    const theirsPending = theirs.ctx.waterfall(
      theirsAgent.carrier as never,
      "approval/request" as never,
      { agent: theirsAgent.agent } as never,
      (() => "inner-mine") as never,
    );
    const mineFrame = await nextFrame(mineFrames);
    const theirsFrame = await nextFrame(theirsFrames);
    expect(viewOf(mineFrame)).toEqual(viewOf(theirsFrame));
    expect(mineFrame.context).toEqual({ value: mineAgent.agent.ctx, subject: mineAgent.agent, agentId: "agent-1" });
    mineFrame.resolve?.({ kind: "result", value: "gateway-value" });
    theirsFrame.resolve?.({ kind: "result", value: "gateway-value" });
    expect(await minePending).toBe(await theirsPending);
    expect(await minePending).toBe("gateway-value");
    mineSignal.abort();
    theirsSignal.abort();
  });

  test("Gateway trả next: next() được gọi và promise nhận giá trị của next (y hệt gốc)", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const mineSignal = new AbortController();
    const theirsSignal = new AbortController();
    const mineFrames = iteratorOf(mine, mineSignal.signal);
    const theirsFrames = iteratorOf(theirs, theirsSignal.signal);
    const mineAgent = carrierFor(ourScope, "agent-2");
    const theirsAgent = carrierFor(stockScope, "agent-2");
    const minePending = mine.ctx.waterfall(
      mineAgent.carrier as never,
      "user-questions/request" as never,
      { agent: mineAgent.agent } as never,
      (() => "next-value") as never,
    );
    const theirsPending = theirs.ctx.waterfall(
      theirsAgent.carrier as never,
      "user-questions/request" as never,
      { agent: theirsAgent.agent } as never,
      (() => "next-value") as never,
    );
    (await nextFrame(mineFrames)).resolve?.({ kind: "next" });
    (await nextFrame(theirsFrames)).resolve?.({ kind: "next" });
    expect(await minePending).toBe("next-value");
    expect(await theirsPending).toBe("next-value");
    mineSignal.abort();
    theirsSignal.abort();
  });

  test("agent KHÔNG khớp carrier: TypeError nguyên văn, y hệt gốc", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const mineAgent = carrierFor(ourScope, "agent-3");
    const mineOther = { id: "agent-3-khac", ctx: {} };
    const theirsAgent = carrierFor(stockScope, "agent-3");
    const theirsOther = { id: "agent-3-khac", ctx: {} };
    const mineSignal = new AbortController();
    const theirsSignal = new AbortController();
    iteratorOf(mine, mineSignal.signal);
    iteratorOf(theirs, theirsSignal.signal);
    const mineError = await errorOf(() =>
      mine.ctx.waterfall(mineAgent.carrier as never, "approval/request" as never, { agent: mineOther } as never, (() => "x") as never),
    );
    const theirsError = await errorOf(() =>
      theirs.ctx.waterfall(theirsAgent.carrier as never, "approval/request" as never, { agent: theirsOther } as never, (() => "x") as never),
    );
    expect(mineError).toBe(theirsError);
    expect(mineError).toContain("must carry its Agent directly");
  });

  test("request THIẾU agent: TypeError nguyên văn, y hệt gốc", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const mineCarrier = carrierFor(ourScope, "agent-4").carrier;
    const theirsCarrier = carrierFor(stockScope, "agent-4").carrier;
    const mineSignal = new AbortController();
    const theirsSignal = new AbortController();
    iteratorOf(mine, mineSignal.signal);
    iteratorOf(theirs, theirsSignal.signal);
    const mineError = await errorOf(() =>
      mine.ctx.waterfall(mineCarrier as never, "approval/request" as never, {} as never, (() => "x") as never),
    );
    const theirsError = await errorOf(() =>
      theirs.ctx.waterfall(theirsCarrier as never, "approval/request" as never, {} as never, (() => "x") as never),
    );
    expect(mineError).toBe(theirsError);
    expect(mineError).toContain("must carry its Agent directly");
  });
});

describe("nửa host api-remotes — vòng đời nguồn", () => {
  test("abort: vòng kéo kết thúc; emit sau abort KHÔNG sinh khung", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const mineSignal = new AbortController();
    const theirsSignal = new AbortController();
    const mineFrames = iteratorOf(mine, mineSignal.signal);
    const theirsFrames = iteratorOf(theirs, theirsSignal.signal);
    mine.ctx.emit("commands/change" as never);
    theirs.ctx.emit("commands/change" as never);
    expect((await nextFrame(mineFrames)).event).toBe("commands/change");
    expect((await nextFrame(theirsFrames)).event).toBe("commands/change");
    // Gateway kéo LIÊN TỤC: gọi next() (đang chờ) RỒI mới abort — đúng nhịp thật; nếu abort lúc generator
    // đang treo ở `yield` thì lần kéo sau mới chờ (hành vi CÓ SẴN của bản gốc, không phải khác biệt của ta).
    const minePendingDone = mineFrames.next();
    const theirsPendingDone = theirsFrames.next();
    const reason = new Error("dong nguon theo yeu cau");
    mineSignal.abort(reason);
    theirsSignal.abort(reason);
    expect(await minePendingDone).toEqual({ done: true, value: undefined });
    expect(await theirsPendingDone).toEqual({ done: true, value: undefined });
    mine.ctx.emit("commands/change" as never);
    theirs.ctx.emit("commands/change" as never);
    expect(await mineFrames.next()).toEqual({ done: true, value: undefined });
    expect(await theirsFrames.next()).toEqual({ done: true, value: undefined });
  });

  test("dispatch ĐANG CHỜ bị abort: promise bị từ chối bằng ĐÚNG reason của signal, y hệt gốc", async () => {
    const mine = rig(ourMod);
    const theirs = rig(stockMod);
    const mineSignal = new AbortController();
    const theirsSignal = new AbortController();
    const mineFrames = iteratorOf(mine, mineSignal.signal);
    const theirsFrames = iteratorOf(theirs, theirsSignal.signal);
    const mineAgent = { id: "agent-5", ctx: {} };
    const theirsAgent = { id: "agent-5", ctx: {} };
    const minePending = mine.ctx.waterfall(
      ourScope.scopeTarget({}, mineAgent) as never,
      "approval/request" as never,
      { agent: mineAgent } as never,
      (() => "x") as never,
    );
    const theirsPending = theirs.ctx.waterfall(
      stockScope.scopeTarget({}, theirsAgent) as never,
      "approval/request" as never,
      { agent: theirsAgent } as never,
      (() => "x") as never,
    );
    // Khung #1 được KÉO RA (đồng thời khởi động generator + đăng ký listener abort), khung #2 để LẠI
    // trong đệm: abort phải từ chối ĐÚNG các dispatch CÒN TRONG ĐỆM.
    const mineFirst = await nextFrame(mineFrames);
    const theirsFirst = await nextFrame(theirsFrames);
    const minePending2 = mine.ctx.waterfall(
      ourScope.scopeTarget({}, mineAgent) as never,
      "user-questions/request" as never,
      { agent: mineAgent } as never,
      (() => "x") as never,
    );
    const theirsPending2 = theirs.ctx.waterfall(
      stockScope.scopeTarget({}, theirsAgent) as never,
      "user-questions/request" as never,
      { agent: theirsAgent } as never,
      (() => "x") as never,
    );
    const reason = new Error("huy luot cho");
    mineSignal.abort(reason);
    theirsSignal.abort(reason);
    const mineSecondError = await errorOf(() => minePending2);
    const theirsSecondError = await errorOf(() => theirsPending2);
    expect(mineSecondError).toBe(theirsSecondError);
    expect(mineSecondError).toContain("huy luot cho");
    // Khung #1 đã ra khỏi đệm nên abort không chạm tới: tự kết thúc nó để không treo promise.
    mineFirst.resolve?.({ kind: "next" });
    theirsFirst.resolve?.({ kind: "next" });
    expect(await minePending).toBe(await theirsPending);
  });
});
