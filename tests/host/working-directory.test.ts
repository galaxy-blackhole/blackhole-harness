/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-working-directory: mỗi ca hành vi dựng HAI giàn giống hệt
 *      nhau rồi chạy CẢ HAI bản cài (lớp của ta và lớp của chính bundle gốc), so vết gọi seam + kết quả;
 *      cộng ca tập export trên ARTIFACT, ca gbh.peers ⊆ peerDependencies (có ĐỐI CHỨNG ÂM), ca MỘT MẶT
 *      (bản gốc không có lib/client.js), ca 000e (bản gốc không có locale/) và ca C6 (danh tính).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import { isAbsolute, join, normalize, resolve as resolvePath } from "node:path";

import Ours from "../../packages/host/working-directory/src/index.ts";
import { buildPackage } from "../../packages/host/working-directory/build.ts";
import { renderNoticeText } from "../../packages/host/working-directory/src/directory.ts";
import type {
  AssemblyStep,
  DirectoryState,
  ProjectionDefinition,
  PromptContextLike,
} from "../../packages/host/working-directory/src/seams.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "working-directory");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-working-directory");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — package ta symlink ĐÚNG bản này nên hai lớp dùng CHUNG một lớp cơ sở. */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Dump parity dùng làm bằng chứng cặp row. */
const DUMP = join(ROOT, ".parity", "dumps", "2026-10-17T23-54-01");
/** Thư mục ARTIFACT dựng tạm: nằm TRONG lib/ để `packages: "external"` phân giải được peer. */
const ARTIFACT_DIR = join(PKG, "lib", "test-artifact");
/** Cây cài THẬT của kernel — nguồn peer mà artifact phải phân giải lúc chạy (pattern tests/host/shell.test.ts). */
const KERNEL_AI = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai");

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as { WorkingDirectoryService: unknown; default: unknown };
/** Lớp Context của kernel — MỘT thể hiện cho cả hai bản cài. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };

/** Bản sao lỏng của một lớp plugin Service, đủ để dựng thể hiện trong giàn. */
type PluginClass = new (ctx: unknown, config: Record<string, unknown>) => any;

afterAll(async () => {
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
});

/** Cổng chặn một seam cho tới khi được mở — đo chuỗi hoá và tính song song. */
interface Gate {
  /** Promise mà seam chờ; chỉ xong khi {@link Gate.release} được gọi. */
  readonly promise: Promise<void>;
  /** Mở cổng. Nhận: không. Trả: không. */
  release(): void;
}

/**
 * Dựng một cổng.
 * Nhận: không.
 * Trả: cổng còn đóng, kèm hàm mở.
 */
function makeGate(): Gate {
  let open: () => void = () => {};
  const promise = new Promise<void>((settle) => {
    open = () => settle();
  });
  return { promise, release: () => open() };
}

/** Phiên giả: nhật ký bền + siêu dữ liệu bất biến; append tự đẩy sự kiện qua chiếu như kernel. */
interface FakeSession {
  /** Định danh phiên. */
  readonly id: string;
  /** Siêu dữ liệu bất biến (giữ dự án gốc). */
  readonly header: { cwd?: string };
  /** Nhật ký các lời gọi append. */
  readonly events: [string, unknown][];
  /** Ghi một sự kiện. Nhận: loại + dữ liệu. Trả: không. */
  append(type: string, data: unknown): void;
}

/** Tuỳ chọn dựng agent. */
interface AgentOptions {
  /** assertActive ném lỗi (fiber đã ngừng sống). */
  readonly dead?: boolean;
  /** inject ném lỗi (đo cảnh báo SAU commit). */
  readonly inboxError?: Error;
}

/** Hình dạng tối thiểu của một thông báo đã xếp — đúng phần test đọc. */
interface Notice {
  /** Định danh bền do kernel sinh. */
  readonly id: string;
  /** Vai trò của tin. */
  readonly role: string;
  /** Các khối nội dung. */
  readonly content: readonly { readonly type: string; readonly text?: string }[];
  /** Nguồn sinh tin. */
  readonly source: { readonly kind: string };
}

/** Agent giả: hộp thư + vòng đời fiber. */
interface FakeAgent {
  /** Phiên mà agent sở hữu. */
  readonly session: FakeSession;
  /** Context của agent: chỉ phần vòng đời fiber. */
  readonly ctx: { readonly fiber: { assertActive(): void } };
  /** Thông báo đã xếp vào hộp thư, theo thứ tự. */
  readonly inbox: Notice[];
  /** Xếp một thông báo. Nhận: tin người dùng. Trả: không. */
  inject(message: unknown): void;
}

/** Giàn giả dùng CHUNG cho bản của ta và bản gốc: ba seam ghi vết + hộp thư + cây hệ tệp. */
interface Harness {
  /** Vết gọi seam, theo đúng thứ tự xảy ra. */
  readonly trace: string[];
  /** Cảnh báo đã ghi qua logger.warn. */
  readonly warnings: string[];
  /** Mục ngữ cảnh đã đăng ký trên seam system prompt. */
  readonly contexts: PromptContextLike[];
  /** Tên mục đã hỏi thứ tự (getContextOrder). */
  readonly orders: string[];
  /** Hàm dựng hàm dọn đã đăng ký qua ctx.effect. */
  readonly disposers: (() => () => Promise<void>)[];
  /** Cây hệ tệp: đường dẫn tuyệt đối → loại đích (undefined = không tồn tại). */
  readonly tree: Map<string, "directory" | "file" | undefined>;
  /** Cổng chặn resolve (gán sau khi dựng giàn). */
  gate?: Gate;
  /** Sự kiện waterfall đã đăng ký (ném khi chưa đăng ký). */
  waterfall(): { step: AssemblyStep; options?: { prepend?: boolean } };
  /** Định nghĩa chiếu đã đăng ký (ném khi chưa đăng ký). */
  definition(): ProjectionDefinition;
  /** Trạng thái chiếu hiện tại của một phiên. Nhận: phiên. Trả: trạng thái, hoặc undefined. */
  stateOf(session: FakeSession): DirectoryState | undefined;
  /** Đặt sẵn trạng thái chiếu (mô phỏng dòng chiếu đã có trong cache). Nhận: phiên + trạng thái. Trả: không. */
  seed(session: FakeSession, state: DirectoryState): void;
  /** Tạo một phiên giả. Nhận: định danh + header. Trả: phiên có nhật ký rỗng. */
  session(id: string, header?: { cwd?: string }): FakeSession;
  /** Tạo agent cho một phiên. Nhận: phiên + tuỳ chọn. Trả: agent giả. */
  agent(session: FakeSession, options?: AgentOptions): FakeAgent;
  /** Dựng service từ một lớp plugin trên context thật của giàn. Nhận: lớp + cấu hình. Trả: thực thể service. */
  boot(plugin: PluginClass, config?: Record<string, unknown>): any;
}

/**
 * Dựng một giàn giả.
 * Nhận: không.
 * Trả: giàn dùng chung được cho CẢ bản của ta lẫn bản gốc (mỗi lượt một giàn mới).
 */
function makeHarness(): Harness {
  const trace: string[] = [];
  const warnings: string[] = [];
  const contexts: PromptContextLike[] = [];
  const orders: string[] = [];
  const disposers: (() => () => Promise<void>)[] = [];
  const tree = new Map<string, "directory" | "file" | undefined>();
  const states = new Map<FakeSession, DirectoryState>();
  let registered: ProjectionDefinition | undefined;
  let waterfall: { step: AssemblyStep; options?: { prepend?: boolean } } | undefined;
  const harness: Harness = {
    trace,
    warnings,
    contexts,
    orders,
    disposers,
    tree,
    waterfall() {
      if (waterfall === undefined) throw new Error("chưa đăng ký listener system-prompt/assemble");
      return waterfall;
    },
    definition() {
      if (registered === undefined) throw new Error("chưa đăng ký chiếu workingDirectory");
      return registered;
    },
    stateOf: (session) => states.get(session),
    seed: (session, state) => {
      states.set(session, state);
    },
    session(id, header = {}) {
      const events: [string, unknown][] = [];
      const session: FakeSession = {
        id,
        header,
        events,
        append(type, data) {
          events.push([type, data]);
          const unit = harness.definition();
          const current = states.has(this) ? (states.get(this) as DirectoryState) : unit.init(this.header, 0);
          states.set(this, unit.apply(current, { type, data: data as { readonly cwd?: unknown } }));
        },
      };
      return session;
    },
    agent(session, options = {}) {
      const inbox: Notice[] = [];
      return {
        session,
        ctx: {
          fiber: {
            assertActive() {
              if (options.dead === true) throw new Error("agent fiber đã ngừng sống");
            },
          },
        },
        inbox,
        inject(message) {
          if (options.inboxError !== undefined) throw options.inboxError;
          inbox.push(message as Notice);
        },
      };
    },
    boot(plugin, config = {}) {
      return new plugin(context, config);
    },
  };

  /** Hệ tệp giả: giải đường dẫn như seam thật (tương đối ⇒ so với cwd), rồi tra cây. */
  const fakeFs = {
    async resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }) {
      trace.push("resolve:" + path + "|cwd=" + String(opts?.cwd) + "|signal=" + String(opts?.signal instanceof AbortSignal));
      if (harness.gate !== undefined) await harness.gate.promise;
      return { targetKey: isAbsolute(path) ? normalize(path) : resolvePath(opts?.cwd ?? "/", path) };
    },
    async stat(target: { targetKey: string }, signal?: AbortSignal) {
      trace.push("stat:" + target.targetKey + "|signal=" + String(signal instanceof AbortSignal));
      const kind = tree.get(target.targetKey);
      return kind === undefined ? undefined : { type: kind };
    },
    processPath(target: { targetKey: string }): string {
      trace.push("processPath:" + target.targetKey);
      return target.targetKey;
    },
  };

  /** Sổ chiếu giả: ghi vết đăng ký + đọc trạng thái của giàn. */
  const fakeProjections = {
    register(definition: ProjectionDefinition) {
      trace.push("register:" + definition.key);
      registered = definition;
      return () => {};
    },
    stateOf(session: FakeSession, key: string) {
      trace.push("stateOf:" + key);
      return states.get(session);
    },
  };

  /** Sổ system prompt giả: ghi vết mục đăng ký + tên đã hỏi thứ tự. */
  const fakePrompt = {
    getContextOrder(name: string) {
      orders.push(name);
      return 700;
    },
    context(context: PromptContextLike) {
      contexts.push(context);
      return () => {};
    },
  };

  /** Log giả. */
  const fakeLogger = {
    warn(message: string) {
      warnings.push(message);
    },
  };

  // Context THẬT (Service cần ctx.reflect.provide), bọc thêm bốn seam + hai hook ghi vết.
  const real = new ContextCtor();
  const context = new Proxy(real, {
    get(target, prop) {
      if (prop === "fs") return fakeFs;
      if (prop === "sessionProjections") return fakeProjections;
      if (prop === "systemPrompt") return fakePrompt;
      if (prop === "logger") return fakeLogger;
      if (prop === "on") {
        return (event: string, step: AssemblyStep, options?: { prepend?: boolean }) => {
          trace.push("on:" + event);
          waterfall = { step, options };
          return () => {};
        };
      }
      if (prop === "effect") {
        return (callback: () => () => Promise<void>) => {
          trace.push("effect");
          disposers.push(callback);
          return () => {};
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
  return harness;
}

/** Một lượt quan sát: mọi thứ ĐO ĐƯỢC sau một kịch bản, để so ta với gốc bằng toEqual. */
interface Observation {
  /** Giá trị trả về (khi thành công). */
  result?: string;
  /** Thông điệp lỗi (khi ném). */
  error?: string;
  /** Vết gọi seam. */
  trace: string[];
  /** Sự kiện đã ghi vào nhật ký phiên. */
  events: [string, unknown][];
  /** Chữ của từng thông báo đã xếp vào hộp thư. */
  notices: string[];
  /** Nguồn của từng thông báo. */
  sources: string[];
  /** Cảnh báo đã ghi. */
  warnings: string[];
  /** Trạng thái chiếu sau lượt chạy. */
  state: DirectoryState | undefined;
  /** Thư mục hiệu lực mà service đọc được sau lượt chạy. */
  directory: string;
  /** Các trường RIÊNG của từng kịch bản — mỗi ca đo thêm thứ của chính nó. */
  readonly [extra: string]: unknown;
}

/**
 * Chạy MỘT kịch bản trên MỘT lớp plugin và gói kết quả lại để so.
 * Nhận: lớp plugin, cấu hình, kịch bản (nhận giàn + service, trả phần bổ sung của lượt quan sát).
 * Trả: lượt quan sát đầy đủ.
 */
async function runOne(
  plugin: PluginClass,
  config: Record<string, unknown>,
  scenario: (harness: Harness, service: any) => Promise<Partial<Observation>>,
): Promise<Observation> {
  const harness = makeHarness();
  const service = harness.boot(plugin, config);
  const extra = await scenario(harness, service);
  return {
    trace: harness.trace,
    warnings: harness.warnings,
    notices: [],
    sources: [],
    events: [],
    state: undefined,
    directory: "/",
    ...extra,
  };
}

/**
 * Chạy CÙNG một kịch bản trên CẢ HAI bản cài.
 * Nhận: kịch bản + cấu hình chung.
 * Trả: hai lượt quan sát (ta và gốc) để so bằng toEqual.
 */
async function runBoth(
  scenario: (harness: Harness, service: any) => Promise<Partial<Observation>>,
  config: Record<string, unknown> = { defaultDirectory: "/repo" },
): Promise<{ ours: Observation; theirs: Observation }> {
  const ours = await runOne(Ours as unknown as PluginClass, config, scenario);
  const theirs = await runOne(stock.default as unknown as PluginClass, config, scenario);
  return { ours, theirs };
}

/**
 * Gói phần quan sát của một phiên: sự kiện, hộp thư, trạng thái chiếu, thư mục hiệu lực.
 * Nhận: giàn, service, phiên, agent.
 * Trả: phần bổ sung cho Observation.
 */
function observe(harness: Harness, service: any, session: FakeSession, agent: FakeAgent): Partial<Observation> {
  return {
    events: [...session.events],
    notices: agent.inbox.map((notice) => notice.content.map((block) => block.text ?? "").join("")),
    sources: agent.inbox.map((notice) => notice.source.kind),
    state: harness.stateOf(session),
    directory: service.get(session),
  };
}

/**
 * Chạy một lượt gọi và bắt lỗi thành chuỗi (đường lỗi phải so được từng chữ với bản gốc).
 * Nhận: hàm gọi. Trả: kết quả, hoặc thông điệp lỗi.
 */
async function settle(call: () => Promise<string>): Promise<Partial<Observation>> {
  try {
    return { result: await call() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}


describe("row working-directory · hành vi đối chứng với chính bundle gốc", () => {
  test("set(): đường dẫn TƯƠNG ĐỐI giải theo thư mục hiện tại, ghi sự kiện bền + xếp thông báo", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1");
      harness.seed(session, "/repo");
      const agent = harness.agent(session);
      harness.tree.set("/repo/sub", "directory");
      const extra = await settle(() => service.set(agent, "sub"));
      return { ...extra, ...observe(harness, service, session, agent) };
    });
    expect(ours).toEqual(theirs);
    expect(ours.result).toBe("/repo/sub");
    // Ba lời gọi hệ tệp, đúng thứ tự: giải bằng cwd CỦA PHIÊN, đọc siêu dữ liệu, rồi lấy đường dẫn tiến trình.
    expect(ours.trace.filter((step) => /^(resolve|stat|processPath):/.test(step))).toEqual([
      "resolve:sub|cwd=/repo|signal=true",
      "stat:/repo/sub|signal=true",
      "processPath:/repo/sub",
    ]);
    expect(ours.events).toEqual([["working-directory/change", { cwd: "/repo/sub" }]]);
    expect(ours.notices).toEqual([renderNoticeText("/repo", "/repo/sub", false)]);
    expect(ours.sources).toEqual(["working-directory"]);
    expect(ours.state).toBe("/repo/sub");
    expect(ours.directory).toBe("/repo/sub");
    expect(ours.warnings).toEqual([]);
  });

  test("set(): đường dẫn TUYỆT ĐỐI trùng thư mục hiện tại ⇒ KHÔNG ghi sự kiện, KHÔNG xếp thông báo", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1");
      harness.seed(session, "/repo/sub");
      const agent = harness.agent(session);
      harness.tree.set("/repo/sub", "directory");
      const extra = await settle(() => service.set(agent, "/repo/sub"));
      return { ...extra, ...observe(harness, service, session, agent) };
    });
    expect(ours).toEqual(theirs);
    expect(ours.result).toBe("/repo/sub");
    expect(ours.events).toEqual([]);
    expect(ours.notices).toEqual([]);
    expect(ours.state).toBe("/repo/sub");
  });

  test("đường lỗi: cd rỗng · thư mục không tồn tại · đường dẫn là TỆP — đúng từng chữ của bản gốc, không treo", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1");
      harness.seed(session, "/repo");
      const agent = harness.agent(session);
      harness.tree.set("/repo/tep", "file");
      const empty = await settle(() => service.set(agent, ""));
      const missing = await settle(() => service.set(agent, "khong-co"));
      const file = await settle(() => service.set(agent, "tep"));
      return {
        empty: empty.error,
        missing: missing.error,
        file: file.error,
        ...observe(harness, service, session, agent),
      };
    });
    expect(ours).toEqual(theirs);
    expect(ours.empty).toBe("working-directory: cd must not be empty");
    expect(ours.missing).toBe('working-directory: directory does not exist: "khong-co"');
    expect(ours.file).toBe('working-directory: directory does not exist: "tep"');
    // Cả ba lượt hỏng đều KHÔNG ghi sự kiện, KHÔNG xếp thông báo.
    expect(ours.events).toEqual([]);
    expect(ours.notices).toEqual([]);
  });

  test("ensure(): thư mục còn nhưng chiếu ghi null ⇒ ghi bền thư mục hiện tại, KHÔNG thông báo", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1", { cwd: "/repo" });
      harness.seed(session, null);
      const agent = harness.agent(session);
      harness.tree.set("/repo", "directory");
      const extra = await settle(() => service.ensure(agent));
      return { ...extra, ...observe(harness, service, session, agent) };
    });
    expect(ours).toEqual(theirs);
    expect(ours.result).toBe("/repo");
    expect(ours.events).toEqual([["working-directory/change", { cwd: "/repo" }]]);
    expect(ours.notices).toEqual([]);
    expect(ours.state).toBe("/repo");
  });

  test("ensure(): chiếu đã có thư mục ⇒ lượt kiểm KHÔNG ghi thêm sự kiện nào", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1", { cwd: "/goc" });
      harness.seed(session, "/repo");
      const agent = harness.agent(session);
      harness.tree.set("/repo", "directory");
      const extra = await settle(() => service.ensure(agent));
      return { ...extra, ...observe(harness, service, session, agent) };
    });
    expect(ours).toEqual(theirs);
    expect(ours.events).toEqual([]);
    expect(ours.result).toBe("/repo");
  });

  test("ensure(): thư mục BIẾN MẤT ⇒ khôi phục dự án gốc trong header và báo bằng câu 'unavailable'", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1", { cwd: "/goc" });
      harness.seed(session, "/da-mat");
      const agent = harness.agent(session);
      harness.tree.set("/goc", "directory");
      const extra = await settle(() => service.ensure(agent));
      return { ...extra, ...observe(harness, service, session, agent) };
    });
    expect(ours).toEqual(theirs);
    expect(ours.result).toBe("/goc");
    expect(ours.events).toEqual([["working-directory/change", { cwd: "/goc" }]]);
    expect(ours.notices).toEqual([renderNoticeText("/da-mat", "/goc", true)]);
    expect(ours.notices[0]).toContain("is unavailable");
    expect(ours.state).toBe("/goc");
  });

  test("ensure(): phiên KHÔNG có header.cwd ⇒ khôi phục về thư mục dự phòng của deployment", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1");
      harness.seed(session, "/da-mat");
      const agent = harness.agent(session);
      harness.tree.set("/repo", "directory");
      const extra = await settle(() => service.ensure(agent));
      return { ...extra, ...observe(harness, service, session, agent) };
    });
    expect(ours).toEqual(theirs);
    expect(ours.result).toBe("/repo");
    expect(ours.notices).toEqual([renderNoticeText("/da-mat", "/repo", true)]);
  });

  test("ensure(): CẢ thư mục hiện tại LẪN dự án gốc đều mất ⇒ ném đúng lỗi của bản gốc", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1", { cwd: "/goc-da-mat" });
      harness.seed(session, "/da-mat");
      const agent = harness.agent(session);
      const extra = await settle(() => service.ensure(agent));
      return { ...extra, ...observe(harness, service, session, agent) };
    });
    expect(ours).toEqual(theirs);
    expect(ours.error).toBe('working-directory: directory does not exist: "/goc-da-mat"');
    expect(ours.events).toEqual([]);
    expect(ours.state).toBe("/da-mat");
  });

  test("hộp thư hỏng: commit VẪN xảy ra, lượt gọi VẪN trả thư mục, chỉ ghi cảnh báo — y bản gốc", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1");
      harness.seed(session, "/repo");
      const agent = harness.agent(session, { inboxError: new Error("hộp thư hỏng") });
      harness.tree.set("/repo/sub", "directory");
      const extra = await settle(() => service.set(agent, "sub"));
      return { ...extra, ...observe(harness, service, session, agent) };
    });
    expect(ours).toEqual(theirs);
    expect(ours.result).toBe("/repo/sub");
    expect(ours.events).toEqual([["working-directory/change", { cwd: "/repo/sub" }]]);
    expect(ours.warnings).toEqual([
      'working-directory: committed "/repo/sub", but could not queue its notice: Error: hộp thư hỏng',
    ]);
  });

  test("vòng đời: fiber đã ngừng sống ⇒ ném TRƯỚC khi ghi bền (không sự kiện, không thông báo)", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1");
      harness.seed(session, "/repo");
      const agent = harness.agent(session, { dead: true });
      harness.tree.set("/repo/sub", "directory");
      const extra = await settle(() => service.set(agent, "sub"));
      return { ...extra, ...observe(harness, service, session, agent) };
    });
    expect(ours).toEqual(theirs);
    expect(ours.error).toBe("agent fiber đã ngừng sống");
    expect(ours.events).toEqual([]);
    expect(ours.notices).toEqual([]);
  });

  test("chuỗi hoá: hai lượt ĐỒNG THỜI trên CÙNG phiên chạy TUẦN TỰ, lượt sau thấy thư mục của lượt trước", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1");
      harness.seed(session, "/repo");
      const agent = harness.agent(session);
      harness.tree.set("/p1", "directory");
      harness.tree.set("/p2", "directory");
      harness.gate = makeGate();
      const first = service.set(agent, "/p1");
      const second = service.set(agent, "/p2");
      await new Promise((settle) => setTimeout(settle, 0));
      // Trước khi mở cổng chỉ ĐÚNG MỘT lượt được vào seam ⇒ lượt hai đang chờ lượt một.
      const started = harness.trace.filter((step) => step.startsWith("resolve:")).length;
      harness.gate.release();
      const results = await Promise.all([first, second]);
      return { results, started, ...observe(harness, service, session, agent) };
    });
    expect(ours.started).toBe(1);
    expect(ours.results).toEqual(["/p1", "/p2"]);
    expect(ours.events).toEqual([
      ["working-directory/change", { cwd: "/p1" }],
      ["working-directory/change", { cwd: "/p2" }],
    ]);
    expect(ours.notices).toEqual([
      renderNoticeText("/repo", "/p1", false),
      renderNoticeText("/p1", "/p2", false),
    ]);
    expect({ ...ours, results: undefined, started: undefined }).toEqual({ ...theirs, results: undefined, started: undefined });
    expect(theirs.results).toEqual(["/p1", "/p2"]);
  });

  test("chuỗi hoá: lượt HỎNG không chặn lượt sau của cùng phiên", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1");
      harness.seed(session, "/repo");
      const agent = harness.agent(session);
      harness.tree.set("/p2", "directory");
      const failed = await settle(() => service.set(agent, "/khong-co"));
      const ok = await settle(() => service.set(agent, "/p2"));
      return { failed: failed.error, ok: ok.result, ...observe(harness, service, session, agent) };
    });
    expect(ours).toEqual(theirs);
    expect(ours.failed).toBe('working-directory: directory does not exist: "/khong-co"');
    expect(ours.ok).toBe("/p2");
    expect(ours.state).toBe("/p2");
  });

  test("chuỗi hoá: hai PHIÊN khác nhau KHÔNG chờ nhau (đuôi chuỗi khoá theo phiên)", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const one = harness.session("s1");
      const two = harness.session("s2");
      harness.seed(one, "/repo");
      harness.seed(two, "/repo");
      harness.tree.set("/p1", "directory");
      harness.tree.set("/p2", "directory");
      harness.gate = makeGate();
      const first = service.set(harness.agent(one), "/p1");
      const second = service.set(harness.agent(two), "/p2");
      await new Promise((settle) => setTimeout(settle, 0));
      const started = harness.trace.filter((step) => step.startsWith("resolve:")).length;
      harness.gate.release();
      const results = await Promise.all([first, second]);
      return { results, started };
    });
    expect(ours).toEqual(theirs);
    // CẢ HAI vào seam trước khi cổng mở ⇒ không có khoá chéo giữa hai phiên.
    expect(ours.started).toBe(2);
    expect(ours.results).toEqual(["/p1", "/p2"]);
  });

  test("mục system prompt: tên/thứ tự/bắt buộc/không nội suy y bản gốc; chữ là '' khi lượt lắp KHÔNG có agent", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      void service;
      const spec = harness.contexts[0];
      const text = typeof spec?.text === "function" ? spec.text({}) : String(spec?.text);
      return {
        specs: harness.contexts.map((entry) => ({
          name: entry.name,
          order: entry.order,
          required: entry.required,
          interpolate: entry.interpolate,
        })),
        orders: [...harness.orders],
        textWithoutAgent: text,
      };
    });
    expect(ours).toEqual(theirs);
    expect(ours.specs).toEqual([
      { name: "working-directory:current", order: 700, required: true, interpolate: false },
    ]);
    expect(ours.orders).toEqual(["WORKING_DIRECTORY"]);
    expect(ours.textWithoutAgent).toBe("");
  });

  test("waterfall assemble: KHÔNG có agent ⇒ gọi tiếp ngay, 0 lượt chạm hệ tệp, bản lắp nguyên vẹn", async () => {
    const { ours, theirs } = await runBoth(async (harness) => {
      const assembly = { contexts: [] as { name: string; text: string; interpolate?: boolean }[] };
      let nextCalls = 0;
      const result = await harness.waterfall().step(assembly, {}, async () => {
        nextCalls += 1;
        return assembly;
      });
      return {
        sameAssembly: result === assembly,
        contexts: [...assembly.contexts],
        nextCalls,
        fsCalls: harness.trace.filter((step) => /^(resolve|stat|processPath):/.test(step)).length,
      };
    });
    expect(ours).toEqual(theirs);
    expect(ours.sameAssembly).toBe(true);
    expect(ours.nextCalls).toBe(1);
    expect(ours.fsCalls).toBe(0);
    expect(ours.contexts).toEqual([]);
  });

  test("waterfall assemble: CÓ agent ⇒ kiểm thư mục TRƯỚC, rồi CHÈN mục ngữ cảnh với chữ đã cập nhật", async () => {
    const { ours, theirs } = await runBoth(async (harness, service) => {
      const session = harness.session("s1");
      harness.seed(session, "/repo");
      const agent = harness.agent(session);
      harness.tree.set("/repo", "directory");
      const assembly = { contexts: [] as { name: string; text: string; interpolate?: boolean }[] };
      const result = await harness.waterfall().step(assembly, { agent }, async () => assembly);
      return {
        fsCalls: harness.trace.filter((step) => /^(resolve|stat|processPath):/.test(step)),
        contexts: result.contexts,
        directory: service.get(session),
      };
    });
    expect(ours).toEqual(theirs);
    expect(ours.contexts).toEqual([
      { name: "working-directory:current", text: 'Current working directory: "/repo".', interpolate: false },
    ]);
    // Lượt lắp prompt chỉ KIỂM (resolve + stat) — KHÔNG lấy đường dẫn tiến trình, y bản gốc.
    // ensure() KHÔNG truyền cwd (thư mục đã tuyệt đối) và KHÔNG gọi processPath — khác set().
    expect(ours.fsCalls).toEqual(["resolve:/repo|cwd=undefined|signal=true", "stat:/repo|signal=true"]);
  });

  test("waterfall assemble: mục ĐÃ CÓ ⇒ GHI ĐÈ tại chỗ, không nhân đôi, và ép interpolate=false", async () => {
    const { ours, theirs } = await runBoth(async (harness) => {
      const session = harness.session("s1");
      harness.seed(session, "/repo/moi");
      const agent = harness.agent(session);
      harness.tree.set("/repo/moi", "directory");
      const existing = { name: "working-directory:current", text: "cu", interpolate: true };
      const other = { name: "khac", text: "giu-nguyen", interpolate: true };
      const assembly = { contexts: [existing, other] };
      const result = await harness.waterfall().step(assembly, { agent }, async () => assembly);
      return { contexts: result.contexts, count: result.contexts.filter((entry) => entry.name === "working-directory:current").length };
    });
    expect(ours).toEqual(theirs);
    expect(ours.count).toBe(1);
    expect(ours.contexts).toEqual([
      { name: "working-directory:current", text: 'Current working directory: "/repo/moi".', interpolate: false },
      { name: "khac", text: "giu-nguyen", interpolate: true },
    ]);
  });

  test("listener assemble đăng ký với prepend=true (đo trên vết gọi seam)", async () => {
    const ours = await runOne(Ours as unknown as PluginClass, { defaultDirectory: "/repo" }, async (harness) => ({
      prepend: harness.waterfall().options?.prepend,
      bootTrace: [...harness.trace],
    }));
    const theirs = await runOne(stock.default as unknown as PluginClass, { defaultDirectory: "/repo" }, async (harness) => ({
      prepend: harness.waterfall().options?.prepend,
      bootTrace: [...harness.trace],
    }));
    expect(ours).toEqual(theirs);
    expect(ours.prepend).toBe(true);
    expect(ours.bootTrace).toEqual(["register:workingDirectory", "on:system-prompt/assemble", "effect"]);
  });
});

describe("row working-directory · bề mặt plugin đo trên ARTIFACT", () => {
  test("ARTIFACT: tập export ta = gốc, default = lớp, prototype y hệt, 0 id module", async () => {
    const file = await buildPackage(ARTIFACT_DIR);
    // Artifact import bare specifier ⇒ phân giải peer TỪ THƯ MỤC CỦA NÓ. Trỏ `@deepseek-ai` sang cây kernel
    // để artifact nạp ĐÚNG cordis/schemastery của kernel như lúc chạy thật: hai cây cài để hai tệp riêng
    // (nội dung y hệt) nên thiếu bước này hai lớp cùng mã vẫn có hai lớp cha KHÁC NHAU về danh tính.
    mkdirSync(join(ARTIFACT_DIR, "node_modules"), { recursive: true });
    symlinkSync(KERNEL_AI, join(ARTIFACT_DIR, "node_modules", "@deepseek-ai"), "dir");
    // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
    // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
    symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(ARTIFACT_DIR, "node_modules", "@galaxy-blackhole"), "dir");
    const code = readFileSync(file, "utf8");
    // Host-only: KHÔNG đăng ký id module nào (bản gốc cũng vậy) — cả hai phép đếm đều 0.
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as { WorkingDirectoryService: any; default: any };
    const original = stock as unknown as { WorkingDirectoryService: any; default: any };
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(original).sort());
    expect(Object.keys(artifact).sort()).toEqual(["WorkingDirectoryService", "default"]);
    expect(artifact.default).toBe(artifact.WorkingDirectoryService);
    expect(original.default).toBe(original.WorkingDirectoryService);
    expect(Object.getOwnPropertyNames(artifact.WorkingDirectoryService.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(original.default.prototype).sort(),
    );
    expect(artifact.WorkingDirectoryService.inject).toEqual(original.default.inject);
    expect(String(artifact.WorkingDirectoryService.Config)).toBe(String(original.default.Config));
    // §2b: hai lớp phải có CÙNG lớp cha (Service của kernel), không phải bản sao.
    expect(Object.getPrototypeOf(artifact.WorkingDirectoryService)).toBe(Object.getPrototypeOf(original.default));
  });

  test("000e: bản gốc KHÔNG có locale/ ⇒ gói ta cũng không, manifest không export locale", () => {
    expect(existsSync(join(STOCK_DIR, "locale"))).toBe(false);
    expect(existsSync(join(PKG, "locale"))).toBe(false);
    const manifest = readManifest();
    expect(manifest.exports?.["./locale/*.json"]).toBeUndefined();
    // 05/11/2026 — P1b: khai báo kiểu (.d.ts) đã có ⇒ exports["."] theo ĐÚNG hình dạng của bản gốc (object types+default).
    expect(manifest.exports?.["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
  });
});


/** Manifest của gói — nguồn DUY NHẤT của cả gbh.peers lẫn peerDependencies (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Peer THẬT SỰ dùng lúc chạy: cordis (lớp Service) · dsh-llm (createUserMessage) · schemastery (Config). */
const RUNTIME_PEERS = ["@deepseek-ai/cordis", "@deepseek-ai/dsh-llm", "@deepseek-ai/schemastery"];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Khoá xuất: có thể là CHUỖI hoặc OBJECT { types, default } tuỳ gói (P1b 05/11/2026). */
  exports?: Record<string, unknown>;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  gbh?: { peers?: string[]; row?: unknown; tests?: string[]; draft?: string };
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không import — test không resolve @deepseek-ai/*).
 * Nhận: không.
 * Trả: manifest đã ép kiểu.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của gbh.peers không có mặt trong peerDependencies.
 * So PHẦN TỬ, KHÔNG so số lượng — peerDependencies thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
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

describe("row working-directory · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...RUNTIME_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
  });

  test("peer khai ra phải có THẬT trong kernel và KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const peer of manifest.gbh?.peers ?? []) {
      expect(existsSync(join(ROOT, "apps", "host", "node_modules", peer))).toBe(true);
      expect(deps.has(peer)).toBe(false);
      expect(manifest.peerDependencies?.[peer]).toBeString();
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

  test("ĐỐI CHỨNG ÂM thứ hai: THỪA tên trong peerDependencies vẫn ĐẠT (⊆ chứ không phải =)", () => {
    const mutated = cloneManifest(readManifest());
    mutated.peerDependencies = { ...(mutated.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(mutated)).toEqual([]);
  });

  test("package KHÔNG được kéo bất kỳ gói @galaxy-stack nào (luật bất biến)", () => {
    expect(readFileSync(MANIFEST, "utf8").includes("@galaxy-stack/")).toBe(false);
    for (const source of ["index.ts", "service.ts", "seams.ts", "directory.ts"]) {
      expect(readFileSync(join(PKG, "src", source), "utf8").includes("@galaxy-stack/")).toBe(false);
    }
  });
});

describe("row working-directory · C6: vật thể cấu hình/vòng đời ĐỘC LẬP theo DANH TÍNH", () => {
  test("hai thực thể service KHÔNG chia sẻ vòng đời, đuôi chuỗi, hay tập lượt đang chạy", async () => {
    const left = makeHarness();
    const right = makeHarness();
    const ours = Ours as unknown as PluginClass;
    const a = left.boot(ours, { defaultDirectory: "/repo" });
    const b = right.boot(ours, { defaultDirectory: "/repo" });
    // Giá trị BẰNG nhau (phép so sâu ĐẠT) nhưng DANH TÍNH phải khác — đúng lớp lỗi C6.
    expect(a.defaultDirectory).toBe(b.defaultDirectory);
    expect(a.lifecycle).not.toBe(b.lifecycle);
    expect(a.pending).not.toBe(b.pending);
    expect(a.operations).not.toBe(b.operations);
    b.operations.add(Promise.resolve("x"));
    expect(a.operations.size).toBe(0);
    // Gỡ plugin bên TRÁI không được làm chết bên PHẢI.
    const dispose = left.disposers[0];
    expect(dispose).toBeFunction();
    await (dispose as () => () => Promise<void>)()();
    const one = left.session("s1");
    left.tree.set("/repo", "directory");
    await expect(a.set(left.agent(one), "/repo")).rejects.toThrow("working-directory service disposed");
    const two = right.session("s1");
    right.tree.set("/repo", "directory");
    expect(await b.set(right.agent(two), "/repo")).toBe("/repo");
  });

  test("hai lượt commit khác nhau ⇒ hai thông báo khác DANH TÍNH (id), nội dung có thể trùng", async () => {
    const harness = makeHarness();
    const ours = Ours as unknown as PluginClass;
    const service = harness.boot(ours, { defaultDirectory: "/repo" });
    harness.tree.set("/repo/sub", "directory");
    const one = harness.session("s1");
    const two = harness.session("s2");
    harness.seed(one, "/repo");
    harness.seed(two, "/repo");
    const agentOne = harness.agent(one);
    const agentTwo = harness.agent(two);
    await service.set(agentOne, "sub");
    await service.set(agentTwo, "sub");
    const first = agentOne.inbox[0];
    const second = agentTwo.inbox[0];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.content).toEqual(second?.content);
    expect(first?.id).not.toBe(second?.id);
    expect(first?.role).toBe("user");
    expect(first?.source.kind).toBe("working-directory");
    // Thông báo là ẢNH CHỤP đông cứng — sửa nó không lan sang lượt sau (kernel tạo bản mới mỗi lần).
    expect(Object.isFrozen(first)).toBe(true);
  });
});

