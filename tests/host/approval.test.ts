/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-approval (row approval): tập export đo trên
 *      ARTIFACT, cặp kiểm toán + ma trận kết quả + chính sách + ngữ cảnh prompt so với CHÍNH bundle
 *      gốc trên Context cordis THẬT, C6 danh tính, và gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { NEVER_SENTENCE } from "../../packages/host/approval/src/prompt.ts";
import type { ApprovalPolicy } from "../../packages/host/approval/src/types.ts";
import { buildPackage } from "../../packages/host/approval/build.ts";
import Ours, {
  APPROVAL_POLICIES,
  ApprovalService,
  setApprovalPolicy,
} from "../../packages/host/approval/src/index.ts";
import { policyOverrideOf } from "../../packages/host/approval/src/policy.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "approval");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-user-approval", "lib", "index.js");
/** Thư mục gói gốc (để so `locale/` byte-for-byte). */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-user-approval");
/** cordis mà CHÍNH package ta nạp (symlink tới bản của apps/host ⇒ cùng một thể hiện). */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** cordis mà chính bundle gốc nạp — phải dựng mỗi bản trên Context của chính nó. */
const STOCK_CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Một sự kiện đã ghi trong phiên giả. */
interface LoggedEvent {
  /** Loại sự kiện. */
  readonly type: string;
  /** Thân sự kiện (giữ NGUYÊN tham chiếu để kiểm danh tính). */
  data: Record<string, unknown>;
}

/** Phiên giả tối thiểu: đúng hình dạng mà `hasOpenTurn`/`append`/`eventAt` cần. */
interface FakeSession {
  /** Nhật ký sự kiện, theo thứ tự ghi. */
  readonly events: LoggedEvent[];
  /** Vị trí kế tiếp (= số sự kiện đã ghi). */
  readonly seq: number;
  /** Đọc một sự kiện theo vị trí. */
  eventAt(seq: number): LoggedEvent | undefined;
  /** Ghi một sự kiện (giữ nguyên tham chiếu `data`). */
  append(type: string, data: unknown): void;
}

/** Agent giả: chỉ hai thứ seam duyệt chạm tới. */
interface FakeAgent {
  /** Phiên của agent. */
  readonly session: FakeSession;
  /** Tin nhắn đã đẩy vào agent (giữ nguyên tham chiếu). */
  readonly injected: { readonly id?: string }[];
  /** Đẩy một tin nhắn vào agent. */
  inject(message: { readonly id?: string }): void;
}

/** Vết những gì service đăng ký lên seam `systemPrompt` trong lượt dựng. */
interface SeamLog {
  /** Tên mục đã hỏi thứ tự. */
  orderQueries: string[];
  /** Mục ngữ cảnh đã đăng ký. */
  contexts: { name: string; order: number; text: (context: { agent?: unknown }) => string }[];
}

/** Context cordis ở đúng phần phòng test dùng. */
interface CordisContext {
  /** Cấp một service cho context. */
  provide(name: string, value: unknown): unknown;
  /** Nạp một plugin. */
  plugin(plugin: unknown, config?: unknown): unknown;
  /** Đọc một service. */
  get(name: string): unknown;
  /** Đăng ký người nghe sự kiện. */
  on(name: string, listener: (request: unknown, next: () => Promise<unknown>) => unknown): unknown;
}

/** Thể hiện service duyệt, ở mức phòng test cần (dùng chung cho CẢ HAI bản). */
interface ApprovalServiceInstance {
  /** Cấu hình đã qua schema (giữ nguyên tham chiếu bản gốc). */
  readonly config: { readonly policy?: string };
  /** Chuyển chính sách của một agent. */
  setPolicy(agent: unknown, policy: string): void;
  /** Hỏi một quyết định. */
  request(request: unknown): Promise<string>;
  /** Đọc ghi đè chính sách của phiên. */
  overrideOf(session: unknown): string | undefined;
}

/** Mô-đun duyệt đã build (của ta hoặc của gốc). */
interface ApprovalModule {
  /** Từ vựng chính sách. */
  APPROVAL_POLICIES: readonly string[];
  /** Đóng thương hiệu id yêu cầu. */
  ApprovalRequestId: (id: string) => string;
  /** Lớp service. */
  ApprovalService: { new (ctx: unknown, config: { policy?: string }): ApprovalServiceInstance; Config: (input: unknown) => unknown; prototype: object };
  /** Bí danh mặc định của lớp service. */
  default: unknown;
  /** Đường ghi ghi đè chính sách. */
  setApprovalPolicy: (session: unknown, policy: string) => void;
}

/** Một bên của phép so (ta hoặc gốc). */
interface Side {
  /** Kết quả đóng, hoặc chuỗi `THROW: …` khi ném. */
  outcome: string;
  /** Nhật ký phiên đã chuẩn hoá (id yêu cầu thay bằng `<id>`). */
  log: string;
  /** Số lần người trả lời được gọi. */
  called: number;
}

/** Kịch bản một lượt hỏi, chạy y hệt trên cả hai bản. */
interface Scenario {
  /** Người trả lời (vắng ⇒ không đăng ký ai). */
  answerer?: (request: unknown, next: () => Promise<unknown>) => unknown;
  /** Chính sách mặc định của deployment. */
  policy?: string;
  /** Lời gọi tool đi kèm. */
  callId?: string;
  /** Lý do đi kèm. */
  reason?: string;
  /** Huỷ trước khi hỏi, hoặc huỷ GIỮA lượt hỏi. */
  abort?: "before" | "during";
  /** Có mở lượt trước khi hỏi không (mặc định: có). */
  openTurn?: boolean;
  /** Các sự kiện gieo vào nhật ký trước khi hỏi (mặc định: `turn/start`). */
  seed?: string[];
}

/**
 * Dựng một phiên giả rỗng.
 * Nhận: không.
 * Trả: phiên có nhật ký rỗng và các phương thức đúng hình dạng thật.
 */
function fakeSession(): FakeSession {
  const events: LoggedEvent[] = [];
  return {
    events,
    get seq() {
      return events.length;
    },
    eventAt: (seq: number) => events[seq],
    append: (type: string, data: unknown) => {
      events.push({ type, data: data as Record<string, unknown> });
    },
  };
}

/**
 * Dựng một agent giả trên một phiên.
 * Nhận: `session` — phiên của agent.
 * Trả: agent có hộp thư `injected` ghi lại tin nhắn đã đẩy.
 */
function fakeAgent(session: FakeSession): FakeAgent {
  const injected: { readonly id?: string }[] = [];
  return { session, injected, inject: (message) => injected.push(message) };
}

/** Kiểu phiên của kernel mà các hàm CÔNG KHAI của gói nhận (chỉ dùng ở tầng KIỂU). */
type KernelSession = Parameters<typeof setApprovalPolicy>[0];

/**
 * Ép một phiên giả về kiểu phiên của kernel — CHỈ ở tầng KIỂU; hình dạng lúc chạy mới là thứ test đo.
 * Nhận: `session` — phiên giả của phòng test.
 * Trả: cùng thể hiện đó, mang kiểu phiên của kernel.
 */
function asSession(session: FakeSession): KernelSession {
  return session as unknown as KernelSession;
}

/** Giá trị chính sách KHÔNG hợp lệ, ép kiểu để đo ĐƯỜNG LỖI lúc chạy (đúng ca bản gốc ném). */
const BOGUS_POLICY = "sometimes" as unknown as ApprovalPolicy;

/**
 * Chuẩn hoá nhật ký phiên để so hai bản: id yêu cầu là UUID ngẫu nhiên nên thay bằng `<id>`.
 * Nhận: `log` — danh sách [loại, thân] đã ghi.
 * Trả: chuỗi JSON đã chuẩn hoá.
 */
function normalize(log: readonly { type: string; data: unknown }[]): string {
  return JSON.stringify(log, (key, value: unknown) => (key === "id" ? "<id>" : value));
}

/**
 * Dựng MỘT bản (ta hoặc gốc) trên Context cordis THẬT của chính bản đó.
 * Nhận: `plugin` — lớp service; `ContextCtor` — lớp Context đúng bản cài; `config` — cấu hình.
 * Trả: context, thể hiện service, và vết đăng ký seam `systemPrompt`.
 */
async function boot(
  plugin: unknown,
  ContextCtor: new () => unknown,
  config: { policy?: string },
): Promise<{ ctx: CordisContext; svc: ApprovalServiceInstance; log: SeamLog }> {
  const ctx = new ContextCtor() as unknown as CordisContext;
  const log: SeamLog = { orderQueries: [], contexts: [] };
  ctx.provide("systemPrompt", {
    getContextOrder: (name: string) => {
      log.orderQueries.push(name);
      return 115;
    },
    context: (context: unknown) => {
      log.contexts.push(context as SeamLog["contexts"][number]);
      return () => undefined;
    },
  });
  ctx.plugin(plugin, config);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const svc = ctx.get("approval") as ApprovalServiceInstance | undefined;
  if (svc === undefined) throw new Error("service approval khong dang ky duoc");
  return { ctx, svc, log };
}

/**
 * Chạy MỘT kịch bản trên một bản và ghi lại kết quả + nhật ký.
 * Nhận: `plugin`, `ContextCtor` như {@link boot}; `scenario` — kịch bản lượt hỏi.
 * Trả: kết quả đóng (hoặc chuỗi THROW), nhật ký đã chuẩn hoá, số lần người trả lời được gọi.
 */
async function runSide(plugin: unknown, ContextCtor: new () => unknown, scenario: Scenario): Promise<Side> {
  const { ctx, svc } = await boot(plugin, ContextCtor, { policy: scenario.policy ?? "ask" });
  const session = fakeSession();
  if (scenario.openTurn !== false) {
    for (const type of scenario.seed ?? ["turn/start"]) session.append(type, { turn: 1 });
  }
  const agent = fakeAgent(session);
  let called = 0;
  if (scenario.answerer !== undefined) {
    const answerer = scenario.answerer;
    ctx.on("approval/request", (request, next) => {
      called += 1;
      return answerer(request, next);
    });
  }
  const controller = scenario.abort === undefined ? undefined : new AbortController();
  if (scenario.abort === "before") controller?.abort();
  if (scenario.abort === "during") setTimeout(() => controller?.abort(), 5);
  const request = {
    agent,
    toolName: "bash",
    ...(scenario.callId !== undefined ? { callId: scenario.callId } : {}),
    ...(scenario.reason !== undefined ? { reason: scenario.reason } : {}),
    ...(controller === undefined ? {} : { signal: controller.signal }),
  };
  let outcome: string;
  try {
    outcome = await svc.request(request);
  } catch (error) {
    outcome = "THROW: " + (error as Error).message;
  }
  return { outcome, log: normalize(session.events), called };
}

/**
 * Chạy CÙNG một kịch bản trên cả hai bản (mỗi bản trên Context của chính nó).
 * Nhận: `scenario` — kịch bản lượt hỏi.
 * Trả: hai bên để so từng trường.
 */
async function runBoth(scenario: Scenario): Promise<{ ours: Side; theirs: Side }> {
  const ourCordis = (await import(OUR_CORDIS)) as { Context: new () => unknown };
  const stockCordis = (await import(STOCK_CORDIS)) as { Context: new () => unknown };
  const stock = (await import(STOCK)) as ApprovalModule;
  return {
    ours: await runSide(Ours, ourCordis.Context, scenario),
    theirs: await runSide(stock.default, stockCordis.Context, scenario),
  };
}

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row approval — ARTIFACT và bề mặt", () => {
  test("ARTIFACT: tập export = gốc, prototype = gốc, 0 id @deepseek-ai, locale byte-for-byte", async () => {
    const file = await buildPackage(OUT);
    const code = await readFile(file, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as ApprovalModule;
    const stock = (await import(STOCK)) as ApprovalModule;
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual([
      "APPROVAL_POLICIES",
      "ApprovalRequestId",
      "ApprovalService",
      "default",
      "setApprovalPolicy",
    ]);
    // Artifact là MỘT bản cài khác nên lớp khác đối tượng; điều phải khớp là HÌNH DẠNG và quan hệ default.
    expect(artifact.default).toBe(artifact.ApprovalService);
    expect(stock.default).toBe(stock.ApprovalService);
    expect(artifact.ApprovalService.name).toBe(stock.ApprovalService.name);
    expect(Object.getOwnPropertyNames(ApprovalService.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.ApprovalService.prototype).sort(),
    );
    expect([...artifact.APPROVAL_POLICIES]).toEqual([...stock.APPROVAL_POLICIES]);
    expect<string[]>([...APPROVAL_POLICIES]).toEqual([...stock.APPROVAL_POLICIES]);
    expect(artifact.ApprovalRequestId("abc")).toBe("abc");
    for (const name of ["en.json", "zh.json"]) {
      const ours = await readFile(join(PKG, "locale", name), "utf8");
      const theirs = await readFile(join(STOCK_DIR, "locale", name), "utf8");
      expect(ours).toBe(theirs);
    }
  });
});

describe("row approval — hành vi đối chứng với chính bundle gốc", () => {
  test("cặp kiểm toán + kết quả: 6 kịch bản cho CÙNG outcome, CÙNG nhật ký, CÙNG số lần hỏi người trả lời", async () => {
    const allowed = () => Promise.resolve("allowed-once");
    const cases: Scenario[] = [
      { answerer: allowed, callId: "call-1", reason: "hook xin quyen" },
      { answerer: allowed },
      { answerer: allowed, policy: "never" },
      { callId: "call-2" },
      { answerer: () => Promise.resolve("bogus-outcome") },
      { answerer: () => Promise.reject(new Error("answerer no")) },
    ];
    for (const scenario of cases) {
      const { ours, theirs } = await runBoth(scenario);
      expect(ours.outcome).toBe(theirs.outcome);
      expect(ours.log).toBe(theirs.log);
      expect(ours.called).toBe(theirs.called);
    }
    // Neo giá trị cụ thể: chính sách 'never' KHÔNG hỏi ai, và không người trả lời ⇒ đóng.
    const never = await runBoth(cases[2] as Scenario);
    expect(never.ours.outcome).toBe("rejected");
    expect(never.ours.called).toBe(0);
    expect(never.ours.log).not.toContain("call-1");
    const none = await runBoth(cases[3] as Scenario);
    expect(none.ours.outcome).toBe("unavailable");
    const rogue = await runBoth(cases[4] as Scenario);
    expect(rogue.ours.outcome).toBe("unavailable");
    const threw = await runBoth(cases[5] as Scenario);
    expect(threw.ours.outcome).toBe("unavailable");
    // Cặp kiểm toán: đúng 2 sự kiện, cùng một id, thứ tự khoá y bản gốc.
    const one = await runBoth({ answerer: allowed, callId: "c", reason: "r" });
    expect(one.ours.log).toBe(
      JSON.stringify([
        { type: "turn/start", data: { turn: 1 } },
        { type: "approval/asked", data: { id: "<id>", toolName: "bash", callId: "c", reason: "r" } },
        { type: "approval/decided", data: { id: "<id>", outcome: "allowed-once" } },
      ]),
    );
  });

  test("huỷ: tín hiệu đã huỷ TRƯỚC ⇒ cancelled (0 lần hỏi); huỷ GIỮA lượt ⇒ cancelled, câu trả lời muộn bị bỏ", async () => {
    const before = await runBoth({ answerer: () => Promise.resolve("allowed-once"), abort: "before" });
    expect(before.ours.outcome).toBe("cancelled");
    expect(before.theirs.outcome).toBe("cancelled");
    expect(before.ours.log).toBe(before.theirs.log);
    expect(before.ours.called).toBe(0);
    const during = await runBoth({
      answerer: () => new Promise((resolve) => setTimeout(() => resolve("allowed-once"), 30)),
      abort: "during",
    });
    expect(during.ours.outcome).toBe("cancelled");
    expect(during.theirs.outcome).toBe("cancelled");
    expect(during.ours.log).toBe(during.theirs.log);
    expect(during.ours.called).toBe(1);
  });

  test("tiền đề LƯỢT MỞ: 5 hình dạng nhật ký ⇒ cùng quyết định ném/không ném, và không ghi gì khi ném", async () => {
    const seeds: string[][] = [[], ["turn/start"], ["turn/start", "turn/end"], ["turn/end", "turn/start"], ["turn/start", "user/message"]];
    for (const seed of seeds) {
      const { ours, theirs } = await runBoth({ answerer: () => Promise.resolve("allowed-once"), seed });
      expect(ours.outcome).toBe(theirs.outcome);
      expect(ours.log).toBe(theirs.log);
    }
    const closed = await runBoth({ answerer: () => Promise.resolve("allowed-once"), seed: ["turn/start", "turn/end"] });
    expect(closed.ours.outcome).toContain("approval.request() outside an open turn");
    expect(closed.ours.called).toBe(0);
    expect(closed.ours.log).toBe(JSON.stringify([{ type: "turn/start", data: { turn: 1 } }, { type: "turn/end", data: { turn: 1 } }]));
    const open = await runBoth({ answerer: () => Promise.resolve("allowed-once"), seed: ["turn/start", "user/message"] });
    expect(open.ours.outcome).toBe("allowed-once");
  });

  test("chính sách: schema Config y hệt, đường ghi 1 sự kiện y hệt, ghi đè cuối cùng thắng", async () => {
    const stock = (await import(STOCK)) as ApprovalModule;
    expect(String(ApprovalService.Config)).toBe(String(stock.ApprovalService.Config));
    expect(String(ApprovalService.Config)).toContain('policy');
    const ourCordis = (await import(OUR_CORDIS)) as { Context: new () => unknown };
    const stockCordis = (await import(STOCK_CORDIS)) as { Context: new () => unknown };
    // Mặc định 'ask' do schema cấp, kể cả khi config rỗng.
    const oursBooted = await boot(Ours, ourCordis.Context, {});
    const theirsBooted = await boot(stock.default, stockCordis.Context, {});
    expect(oursBooted.svc.config.policy).toBe(theirsBooted.svc.config.policy);
    expect(oursBooted.svc.config.policy).toBe("ask");
    // Đường ghi: 1 sự kiện approval/policy; giá trị không hợp lệ ném CÙNG thông điệp.
    const ourSession = fakeSession();
    const theirSession = fakeSession();
    setApprovalPolicy(asSession(ourSession), "never");
    stock.setApprovalPolicy(asSession(theirSession), "never");
    expect(normalize(ourSession.events)).toBe(normalize(theirSession.events));
    expect(ourSession.events.length).toBe(1);
    expect(ourSession.events[0]?.type).toBe("approval/policy");
    const messageOf = (run: () => void): string => {
      try {
        run();
        return "(khong nem)";
      } catch (error) {
        return (error as Error).message;
      }
    };
    expect(messageOf(() => setApprovalPolicy(asSession(fakeSession()), BOGUS_POLICY))).toBe(
      messageOf(() => stock.setApprovalPolicy(asSession(fakeSession()), BOGUS_POLICY)),
    );
    // Ghi đè: sự kiện CUỐI thắng, cả hai bản đọc giống nhau qua overrideOf.
    const folded = fakeSession();
    setApprovalPolicy(asSession(folded), "never");
    setApprovalPolicy(asSession(folded), "ask");
    expect(policyOverrideOf(asSession(folded))).toBe("ask");
    expect(oursBooted.svc.overrideOf(folded)).toBe(theirsBooted.svc.overrideOf(folded));
    expect(policyOverrideOf(asSession(fakeSession()))).toBeUndefined();
  });
});

describe("row approval — chính sách · ngữ cảnh prompt · danh tính (C6)", () => {
  test("ngữ cảnh prompt: đúng MỘT mục approval:policy, order hỏi bằng APPROVAL_POLICY, chữ KHỚP gốc", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as { Context: new () => unknown };
    const stockCordis = (await import(STOCK_CORDIS)) as { Context: new () => unknown };
    const stock = (await import(STOCK)) as ApprovalModule;
    const ours = await boot(Ours, ourCordis.Context, { policy: "ask" });
    const theirs = await boot(stock.default, stockCordis.Context, { policy: "ask" });
    expect(ours.log.contexts.length).toBe(1);
    expect(theirs.log.contexts.length).toBe(1);
    expect(ours.log.orderQueries).toEqual(["APPROVAL_POLICY"]);
    expect(ours.log.contexts[0]?.name).toBe(theirs.log.contexts[0]?.name);
    expect(ours.log.contexts[0]?.name).toBe("approval:policy");
    expect(ours.log.contexts[0]?.order).toBe(theirs.log.contexts[0]?.order);
    const askSession = fakeSession();
    const neverSession = fakeSession();
    setApprovalPolicy(asSession(neverSession), "never");
    const textOf = (side: SeamLog, session: FakeSession): string =>
      side.contexts[0]?.text({ agent: { session } }) ?? "(khong co muc)";
    expect(textOf(ours.log, askSession)).toBe(textOf(theirs.log, askSession));
    expect(textOf(ours.log, neverSession)).toBe(textOf(theirs.log, neverSession));
    expect(textOf(ours.log, neverSession)).toBe(NEVER_SENTENCE);
    expect(textOf(ours.log, askSession)).toContain("Approval policy: ask.");
    expect(textOf(ours.log, askSession)).not.toBe(NEVER_SENTENCE);
    // Không có agent trong ngữ cảnh lắp ⇒ chuỗi rỗng, y bản gốc.
    expect(ours.log.contexts[0]?.text({})).toBe("");
    expect(theirs.log.contexts[0]?.text({})).toBe("");
  });

  test("C6 danh tính: hai thực thể độc lập · vật thể kiểm toán/message RIÊNG mỗi lượt · ghi đè theo phiên", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as { Context: new () => unknown };
    const stockCordis = (await import(STOCK_CORDIS)) as { Context: new () => unknown };
    const stock = (await import(STOCK)) as ApprovalModule;
    // CÙNG một vật thể cấu hình cho MỌI lần dựng: quy ước tham chiếu của ta phải GIỐNG bản gốc.
    const shared = { policy: "never" };
    const a = await boot(Ours, ourCordis.Context, shared);
    const b = await boot(Ours, ourCordis.Context, shared);
    const theirs = await boot(stock.default, stockCordis.Context, shared);
    expect(a.svc).not.toBe(b.svc);
    expect(a.svc.config === (shared as { policy?: string })).toBe(theirs.svc.config === (shared as { policy?: string }));
    // Hai thực thể KHÔNG dùng chung vật thể cấu hình: sửa bản này không lan sang bản kia.
    expect(a.svc.config).not.toBe(b.svc.config);
    expect(a.svc.overrideOf(fakeSession())).toBe(theirs.svc.overrideOf(fakeSession()));
    (a.svc.config as unknown as Record<string, unknown>).policy = "ask";
    expect(b.svc.config.policy).toBe("never");
    // Hai lượt hỏi ⇒ hai vật thể kiểm toán RIÊNG: sửa bản này không lan sang bản kia.
    const ctx = a.ctx;
    ctx.on("approval/request", () => Promise.resolve("allowed-once"));
    const session = fakeSession();
    session.append("turn/start", { turn: 1 });
    const agent = fakeAgent(session);
    await a.svc.request({ agent, toolName: "bash" });
    await a.svc.request({ agent, toolName: "bash" });
    const asked = session.events.filter((event) => event.type === "approval/asked");
    expect(asked.length).toBe(2);
    expect(asked[0]?.data).not.toBe(asked[1]?.data);
    (asked[0]?.data as Record<string, unknown>).toolName = "sua-tay";
    expect(asked[1]?.data.toolName).toBe("bash");
    // setPolicy trên hai agent ⇒ hai message RIÊNG (id riêng), đóng băng như bản gốc.
    const agentA = fakeAgent(fakeSession());
    const agentB = fakeAgent(fakeSession());
    a.svc.setPolicy(agentA, "never");
    a.svc.setPolicy(agentB, "never");
    expect(agentA.injected.length).toBe(1);
    expect(agentB.injected.length).toBe(1);
    expect(agentA.injected[0]).not.toBe(agentB.injected[0]);
    expect(agentA.injected[0]?.id).not.toBe(agentB.injected[0]?.id);
    expect(Object.isFrozen(agentA.injected[0])).toBe(true);
    // Ghi đè theo PHIÊN: phiên này không lan sang phiên kia.
    const sa = fakeSession();
    const sb = fakeSession();
    setApprovalPolicy(asSession(sa), "never");
    expect(a.svc.overrideOf(sa)).toBe("never");
    expect(a.svc.overrideOf(sb)).toBeUndefined();
  });

  test("gbh.peers ⊆ peerDependencies (so PHẦN TỬ) + ĐỐI CHỨNG ÂM · không khai dependencies", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8")) as {
      gbh?: { peers?: string[]; row?: unknown };
      peerDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    expect(missingPeers(manifest)).toEqual([]);
    expect(manifest.peerDependencies?.["@deepseek-ai/dsh-scope"]).toBeDefined();
    expect(manifest.dependencies ?? {}).toEqual({});
    // ĐỐI CHỨNG ÂM: cùng bộ so với một manifest THIẾU phần tử ⇒ phải báo đúng tên thiếu (không rỗng).
    expect(missingPeers({ gbh: { peers: ["a", "b"] }, peerDependencies: { a: "1" } })).toEqual(["b"]);
    expect(missingPeers({ gbh: { peers: ["a"] }, peerDependencies: {} })).toEqual(["a"]);
    expect(missingPeers({ gbh: { peers: [] }, peerDependencies: {} })).toEqual([]);
  });
});

/**
 * So TẬP PHẦN TỬ `gbh.peers` với `peerDependencies` — KHÔNG so số lượng.
 * Nhận: `manifest` — nội dung `package.json` (chỉ hai trường liên quan).
 * Trả: các tên peer khai trong `gbh.peers` mà KHÔNG có trong `peerDependencies`.
 */
function missingPeers(manifest: {
  gbh?: { peers?: string[] };
  peerDependencies?: Record<string, string>;
}): string[] {
  const declared = manifest.peerDependencies ?? {};
  return (manifest.gbh?.peers ?? []).filter((peer) => declared[peer] === undefined);
}
