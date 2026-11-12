/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-authorization (row authorization): tập export đo trên
 *      ARTIFACT, ma trận hành vi (mã lỗi · kết cục · commit · sự kiện settled) so với CHÍNH bundle gốc
 *      trên Context cordis THẬT, C6 danh tính, và gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/authorization/build.ts";
import Ours, { AuthorizationDeclinedError, AuthorizationError, AuthorizationService } from "../../packages/host/authorization/src/index.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "authorization");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-authorization", "lib", "index.js");
/** Thư mục gói gốc (để so `locale/` byte-for-byte). */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-authorization");
/** cordis mà CHÍNH package ta nạp (symlink tới bản của apps/host ⇒ cùng một thể hiện). */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** cordis mà chính bundle gốc nạp — phải dựng mỗi bản trên Context của chính nó. */
const STOCK_CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Khoá credential dùng trong mọi ca (grammar `<scope>/<id>` của seam credential). */
const KEY = "llm-pi-ai/openai-codex";

/** Context cordis ở đúng phần phòng test dùng. */
interface CordisContext {
  /** Cấp một service cho context. */
  provide(name: string, value: unknown): unknown;
  /** Nạp một plugin. */
  plugin(plugin: unknown, config?: unknown): unknown;
  /** Đọc một service. */
  get(name: string): unknown;
  /** Đăng ký người nghe sự kiện. */
  on(name: string, listener: (...args: never[]) => unknown): unknown;
  /** Phát một sự kiện (giả lập kho credential của kernel). */
  emit(name: string, ...args: unknown[]): void;
}

/** Phiên một lượt, ở mức test cần chạm tới. */
interface Session {
  /** Cách thức bên gọi đã chọn. */
  readonly method: string;
  /** Tín hiệu huỷ của CHÍNH lượt. */
  readonly signal: AbortSignal;
  /** Commit một bản ghi. */
  commit(record: unknown): Promise<void>;
  /** Báo một thông báo cho bề mặt. */
  notify(notice: unknown): void;
  /** Hỏi người dùng. */
  prompt(prompt: unknown): Promise<string>;
}

/** Kho credential GIẢ, đúng hình dạng mà seam chạm tới (`modifyRecord` + `describeRecord`). */
interface FakeCredentials {
  /** Bản ghi đang có, theo khoá. */
  readonly records: Map<string, unknown>;
  /** Mọi lần ghi đã xảy ra, theo thứ tự (giữ NGUYÊN tham chiếu bản ghi). */
  readonly writes: { key: string; record: unknown }[];
  /** Bề mặt mà `ctx.credentials` phơi ra. */
  readonly provider: {
    /** Ghi một bản ghi qua hàm biến đổi, rồi phát `credentials/record-updated`. */
    modifyRecord(key: string, mutate: (current: unknown) => Promise<unknown>): Promise<unknown>;
    /** Cho biết khoá đã có bản ghi chưa. */
    describeRecord(key: string): Promise<{ configured: boolean }>;
  };
  /** Xoá một bản ghi như một lần ghi thật (phát `credentials/record-updated`). */
  remove(key: string): void;
}

/** Thể hiện service uỷ quyền, ở mức phòng test cần (dùng chung cho CẢ HAI bản). */
interface ServiceInstance {
  /** Đăng ký một luồng. */
  registerFlow(flow: unknown): () => void;
  /** Liệt kê luồng đã đăng ký. */
  list(): readonly { key: string; label: string; inFlight: boolean }[];
  /** Một luồng theo khoá. */
  describe(key: string): { key: string; label: string; inFlight: boolean } | undefined;
  /** Rút lượt đang chạy của một khoá. */
  cancel(key: string): void;
  /** Chạy một lượt. */
  begin(request: unknown): Promise<{ status: string }>;
}

/** Mô-đun uỷ quyền đã build (của ta hoặc của gốc). */
interface AuthModule {
  /** Lớp lỗi ổn định. */
  AuthorizationError: new (message: string, code: string, options?: ErrorOptions) => Error & { code: string };
  /** Lớp lỗi "người dùng từ chối". */
  AuthorizationDeclinedError: new (message?: string) => Error & { code: string };
  /** Lớp service. */
  AuthorizationService: {
    new (ctx: unknown): ServiceInstance;
    inject: string[];
    name: string;
    prototype: object;
  };
  /** Bí danh mặc định của lớp service. */
  default: unknown;
}

/** Kết quả MỘT lượt, đã chuẩn hoá để so hai bản. */
interface Side {
  /** Kết cục: `{"status":"…"}` hoặc `THROW:<mã>:<thông điệp>`. */
  outcome: string;
  /** Các dòng `authorization/settled` đã bắt, kèm `inFlight` ĐỌC TRONG listener. */
  settled: string[];
  /** Số lần ghi vào kho credential + khoá của lần ghi đầu. */
  writes: string;
  /** Kho credential sau lượt: `<khoá>=<configured>`. */
  configured: string;
  /** Số phiên (session) đã cấp cho luồng. */
  sessions: number;
}

/**
 * Dựng một kho credential giả trên một Context.
 * Nhận: `ctx` — context dùng để phát `credentials/record-updated`.
 * Trả: kho giả có `records`/`writes` để test đọc, `provider` để cấp cho seam, và `remove`.
 */
function fakeCredentials(ctx: CordisContext): FakeCredentials {
  const records = new Map<string, unknown>();
  const writes: { key: string; record: unknown }[] = [];
  const fake: FakeCredentials = {
    records,
    writes,
    provider: {
      modifyRecord: async (key, mutate) => {
        const next = await mutate(records.get(key));
        if (next === undefined) records.delete(key);
        else {
          records.set(key, next);
          writes.push({ key, record: next });
        }
        ctx.emit("credentials/record-updated", key);
        return next;
      },
      describeRecord: async (key) => ({ configured: records.has(key) }),
    },
    remove: (key) => {
      records.delete(key);
      ctx.emit("credentials/record-updated", key);
    },
  };
  return fake;
}

/**
 * Dựng MỘT bản (ta hoặc gốc) trên Context cordis THẬT của chính bản đó.
 * Nhận: `plugin` — lớp service; `ContextCtor` — lớp Context đúng bản cài.
 * Trả: context, thể hiện service, và kho credential giả đã cấp.
 */
async function boot(
  plugin: unknown,
  ContextCtor: new () => unknown,
): Promise<{ ctx: CordisContext; svc: ServiceInstance; fake: FakeCredentials }> {
  const ctx = new ContextCtor() as unknown as CordisContext;
  const fake = fakeCredentials(ctx);
  ctx.provide("credentials", fake.provider);
  ctx.plugin(plugin, {});
  await new Promise((resolve) => setTimeout(resolve, 5));
  const svc = ctx.get("authorization") as ServiceInstance | undefined;
  if (svc === undefined) throw new Error("service authorization khong dang ky duoc");
  return { ctx, svc, fake };
}

/**
 * Bóc mã lỗi của một lần ném ra thành chuỗi để so hai bản.
 * Nhận: `error` — giá trị đã bắt.
 * Trả: `THROW:<mã>:<thông điệp>`, hoặc `THROW:(khong ma):…`.
 */
function thrown(error: unknown): string {
  const typed = error as { code?: unknown; message?: unknown };
  const code = typeof typed.code === "string" ? typed.code : "(khong ma)";
  return "THROW:" + code + ":" + String(typed.message);
}

/** Một kịch bản lượt uỷ quyền, chạy y hệt trên cả hai bản. */
interface Scenario {
  /** Tên ca (dùng trong thông điệp lỗi). */
  name: string;
  /** Thân của luồng; `undefined` ⇒ luồng chỉ phân giải mà không làm gì. */
  body?: (session: Session, fake: FakeCredentials, mod: AuthModule) => Promise<void>;
  /** Có đăng ký luồng không (mặc định: có). */
  flow?: boolean;
  /** Cách bên gọi nêu (bỏ trống ⇒ cách đầu tiên của luồng). */
  method?: string;
  /** Bề mặt hội thoại của bên gọi. */
  interaction?: { notify?: (notice: unknown) => void; prompt?: (prompt: unknown) => Promise<string> };
  /** Rút lượt: trước khi bắt đầu, giữa lượt, hay bằng `cancel()`. */
  abort?: "before" | "during" | "cancel-call";
  /** Bề mặt TỪ CHỐI câu hỏi bằng lớp lỗi của CHÍNH bản đang chạy (mỗi bản có lớp riêng). */
  decline?: boolean;
}

/**
 * Chạy MỘT kịch bản trên một bản và ghi lại kết quả + dấu vết.
 * Nhận: `plugin`/`ContextCtor` như {@link boot}; `scenario` — kịch bản lượt.
 * Trả: kết cục, các dòng `authorization/settled`, dấu vết kho credential, số phiên đã cấp.
 */
async function runSide(plugin: unknown, ContextCtor: new () => unknown, scenario: Scenario, mod: AuthModule): Promise<Side> {
  const { ctx, svc, fake } = await boot(plugin, ContextCtor);
  const settled: string[] = [];
  ctx.on("authorization/settled", (...args: unknown[]) => {
    const key = String(args[0]);
    const settlement = String(args[1]);
    // ĐỌC inFlight NGAY TRONG listener: khoá phải ĐÃ được nhả trước khi phát.
    settled.push(key + ":" + settlement + ":inFlight=" + String(svc.describe(key)?.inFlight));
  });
  let sessions = 0;
  if (scenario.flow !== false) {
    svc.registerFlow({
      key: KEY,
      label: "ChatGPT (Codex)",
      methods: [
        { id: "oauth", label: "Sign in with ChatGPT" },
        { id: "device", label: "Enter a code" },
      ],
      run: async (session: Session) => {
        sessions += 1;
        if (scenario.body !== undefined) await scenario.body(session, fake, mod);
      },
    });
  }
  const controller = scenario.abort === "before" || scenario.abort === "during" ? new AbortController() : undefined;
  if (scenario.abort === "before") controller?.abort();
  if (scenario.abort === "during") setTimeout(() => controller?.abort(), 5);
  if (scenario.abort === "cancel-call") setTimeout(() => svc.cancel(KEY), 5);
  const request = {
    key: KEY,
    ...(scenario.method === undefined ? {} : { method: scenario.method }),
    interaction: {
      notify: scenario.interaction?.notify ?? (() => undefined),
      prompt:
        scenario.decline === true
          ? () => Promise.reject(new mod.AuthorizationDeclinedError("nguoi dung dong cau hoi"))
          : (scenario.interaction?.prompt ?? (() => Promise.resolve("typed-code"))),
    },
    ...(controller === undefined ? {} : { signal: controller.signal }),
  };
  let outcome: string;
  try {
    outcome = JSON.stringify(await svc.begin(request));
  } catch (error) {
    outcome = thrown(error);
  }
  return {
    outcome,
    settled,
    writes: fake.writes.length + ":" + String(fake.writes[0]?.key),
    configured: [...fake.records.keys()].map((key) => key + "=" + String(fake.records.get(key) !== undefined)).join(","),
    sessions,
  };
}

/**
 * Chạy CÙNG một kịch bản trên cả hai bản (mỗi bản trên Context của chính nó).
 * Nhận: `scenario` — kịch bản lượt.
 * Trả: hai bên để so từng trường.
 */
async function runBoth(scenario: Scenario): Promise<{ ours: Side; theirs: Side }> {
  const ourCordis = (await import(OUR_CORDIS)) as { Context: new () => unknown };
  const stockCordis = (await import(STOCK_CORDIS)) as { Context: new () => unknown };
  const stock = (await import(STOCK)) as AuthModule;
  return {
    ours: await runSide(Ours, ourCordis.Context, scenario, OUR_MODULE),
    theirs: await runSide(stock.default, stockCordis.Context, scenario, stock),
  };
}

/**
 * So TẬP PHẦN TỬ `gbh.peers` với `peerDependencies` — KHÔNG so số lượng.
 * Nhận: `manifest` — nội dung `package.json` (chỉ hai trường liên quan).
 * Trả: các tên peer khai trong `gbh.peers` mà KHÔNG có trong `peerDependencies`.
 */
function missingPeers(manifest: { gbh?: { peers?: string[] }; peerDependencies?: Record<string, string> }): string[] {
  const declared = manifest.peerDependencies ?? {};
  return (manifest.gbh?.peers ?? []).filter((peer) => declared[peer] === undefined);
}

/** Bề mặt mô-đun của TA, đúng hình dạng {@link AuthModule} — để so với gốc như hai mô-đun thật. */
const OUR_MODULE = {
  AuthorizationError,
  AuthorizationDeclinedError,
  AuthorizationService,
  default: Ours,
} as unknown as AuthModule;

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row authorization — ARTIFACT và bề mặt", () => {
  test("ARTIFACT: 4 export = gốc · 0 id module · prototype = gốc · build.ts nhận argv[2] · locale byte-for-byte", async () => {
    const file = await buildPackage(OUT);
    const code = await readFile(file, "utf8");
    // Row MỘT MẶT: không bundle client, nên không id module nào — không của gốc, không của ta.
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as AuthModule;
    const stock = (await import(STOCK)) as AuthModule;
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual([
      "AuthorizationDeclinedError",
      "AuthorizationError",
      "AuthorizationService",
      "default",
    ]);
    // Artifact là MỘT bản cài khác nên lớp khác đối tượng; điều phải khớp là HÌNH DẠNG và quan hệ default.
    expect(artifact.default).toBe(artifact.AuthorizationService);
    expect(stock.default).toBe(stock.AuthorizationService);
    expect(artifact.AuthorizationService.name).toBe(stock.AuthorizationService.name);
    expect(artifact.AuthorizationService.inject).toEqual(stock.AuthorizationService.inject);
    expect(artifact.AuthorizationService.inject).toEqual(["credentials"]);
    expect(Object.getOwnPropertyNames(artifact.AuthorizationService.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.AuthorizationService.prototype).sort(),
    );
    // Điểm vào `src/index.ts` xuất ĐÚNG lớp đã build (không phải một bản sao thứ hai).
    expect(Ours).toBe(AuthorizationService);
    expect(OUR_MODULE.default).toBe(Ours);
    // Đường dẫn build phải nhận `process.argv[2]`: thiếu nó thì profile KHÔNG có lib/ ⇒ không sinh entry.
    const buildSource = await readFile(join(PKG, "build.ts"), "utf8");
    expect(buildSource.includes("process.argv[2]")).toBe(true);
    for (const name of ["en.json", "zh.json"]) {
      const ours = await readFile(join(PKG, "locale", name), "utf8");
      const theirs = await readFile(join(STOCK_DIR, "locale", name), "utf8");
      expect(ours).toBe(theirs);
    }
  });

  test("hai lớp lỗi: quan hệ kế thừa + mã ổn định + `instanceof` cùng lớp HarnessError của kernel", async () => {
    const stock = (await import(STOCK)) as AuthModule;
    const declined = new AuthorizationDeclinedError();
    expect(declined.code).toBe("DECLINED");
    expect(declined.name).toBe("AuthorizationDeclinedError");
    expect(declined instanceof AuthorizationError).toBe(true);
    expect(String(declined.message)).toBe(new stock.AuthorizationDeclinedError().message);
    const custom = new AuthorizationDeclinedError("nguoi dung dong cau hoi");
    expect(custom.message).toBe("nguoi dung dong cau hoi");
    const failing = new AuthorizationError("x", "NO_FLOW");
    expect(failing.code).toBe("NO_FLOW");
    expect(failing.name).toBe("AuthorizationError");
    // `instanceof` so DANH TÍNH LỚP, mà repo có HAI cây cài (workspace cho ta, kernel cho bản gốc): mỗi bên phải
    // so với `HarnessError` của CHÍNH cây nó nạp. Hai lớp là CÙNG một hiện thực (cùng tên lớp, cùng lớp cha).
    const kernelLlm = (await import(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-llm", "lib", "index.js"))) as {
      HarnessError: new (message: string, code: string) => Error;
    };
    const ourLlm = (await import(join(PKG, "node_modules", "@deepseek-ai", "dsh-llm", "lib", "index.js"))) as {
      HarnessError: new (message: string, code: string) => Error;
    };
    expect(ourLlm.HarnessError.name).toBe(kernelLlm.HarnessError.name);
    expect(Object.getPrototypeOf(ourLlm.HarnessError)).toBe(Object.getPrototypeOf(kernelLlm.HarnessError));
    expect(failing instanceof ourLlm.HarnessError).toBe(true);
    const stockFailing = new stock.AuthorizationError("x", "NO_FLOW");
    expect(stockFailing instanceof kernelLlm.HarnessError).toBe(true);
  });
});

describe("row authorization — hành vi đối chứng với chính bundle gốc", () => {
  test("ma trận 10 kịch bản: CÙNG kết cục · CÙNG mã lỗi · CÙNG dấu vết commit · CÙNG sự kiện settled", async () => {
    const commit = async (session: Session): Promise<void> => {
      await session.commit({ kind: "grant", payload: { token: "abc" } });
    };
    const cases: Scenario[] = [
      { name: "commit trọn", body: commit },
      { name: "phân giải mà không commit", body: async () => undefined },
      { name: "commit rồi xoá bản ghi", body: async (session, fake) => {
        await commit(session);
        fake.remove(KEY);
      } },
      { name: "luồng ném lỗi", body: async () => { throw new Error("provider said no"); } },
      // NGƯỜI DÙNG TỪ CHỐI: bề mặt từ chối câu hỏi bằng CHÍNH lớp lỗi của bản đang chạy ⇒ cancelled.
      { name: "người dùng từ chối", body: async (session) => {
        await session.prompt({ kind: "text", message: "ma?" });
      }, decline: true },
      // Luồng tự ném AuthorizationDeclinedError mà KHÔNG qua `prompt` ⇒ lỗi vẫn NÉM RA (không thành cancelled).
      { name: "luồng tự ném declined", body: async (_session, _fake, mod) => {
        throw new mod.AuthorizationDeclinedError("nguoi dung dong cau hoi");
      } },
      { name: "cách thức không có", body: commit, method: "khong-co" },
      { name: "không có luồng", body: commit, flow: false },
      { name: "huỷ TRƯỚC khi bắt đầu", body: commit, abort: "before" },
      { name: "huỷ GIỮA lượt", body: async (session) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        await session.commit({ kind: "grant", payload: { token: "late" } });
      }, abort: "during" },
    ];
    for (const scenario of cases) {
      const { ours, theirs } = await runBoth(scenario);
      expect(ours.outcome, scenario.name).toBe(theirs.outcome);
      expect(ours.settled, scenario.name).toEqual(theirs.settled);
      expect(ours.writes, scenario.name).toBe(theirs.writes);
      expect(ours.configured, scenario.name).toBe(theirs.configured);
      expect(ours.sessions, scenario.name).toBe(theirs.sessions);
    }
    // Neo giá trị cụ thể — để test không xanh chỉ vì HAI BÊN CÙNG SAI.
    const ok = await runBoth(cases[0] as Scenario);
    expect(ok.ours.outcome).toBe('{"status":"authorized"}');
    expect(ok.ours.settled).toEqual([KEY + ":authorized:inFlight=false"]);
    expect(ok.ours.writes).toBe("1:" + KEY);
    const noCommit = await runBoth(cases[1] as Scenario);
    expect(noCommit.ours.outcome).toContain("THROW:NOT_COMMITTED:");
    expect(noCommit.ours.outcome).toContain("resolved without committing");
    expect(noCommit.ours.settled).toEqual([KEY + ":failed:inFlight=false"]);
    const deleted = await runBoth(cases[2] as Scenario);
    expect(deleted.ours.outcome).toContain("deleted its credential record");
    const threw = await runBoth(cases[3] as Scenario);
    expect(threw.ours.outcome).toBe("THROW:(khong ma):provider said no");
    expect(threw.ours.settled).toEqual([KEY + ":failed:inFlight=false"]);
    const declined = await runBoth(cases[4] as Scenario);
    expect(declined.ours.outcome).toBe('{"status":"cancelled"}');
    expect(declined.ours.settled).toEqual([KEY + ":cancelled:inFlight=false"]);
    // Tự ném declined KHÔNG qua `prompt` ⇒ KHÔNG thành cancelled: chỉ chữ "không" của người mới đổi kết cục.
    const selfDeclined = await runBoth(cases[5] as Scenario);
    expect(selfDeclined.ours.outcome).toBe("THROW:DECLINED:nguoi dung dong cau hoi");
    expect(selfDeclined.ours.settled).toEqual([KEY + ":failed:inFlight=false"]);
    const noMethod = await runBoth(cases[6] as Scenario);
    expect(noMethod.ours.outcome).toContain("THROW:UNKNOWN_METHOD:");
    expect(noMethod.ours.sessions).toBe(0);
    const noFlow = await runBoth(cases[7] as Scenario);
    expect(noFlow.ours.outcome).toContain("THROW:NO_FLOW:");
    // Huỷ TRƯỚC: luồng KHÔNG hề chạy và KHÔNG có sự kiện settled — `begin` trả `cancelled` NGAY,
    // trước khi dựng lượt (đúng bản gốc: chỉ lượt ĐÃ dựng mới phát `authorization/settled`).
    expect((await runBoth(cases[8] as Scenario)).ours.sessions).toBe(0);
    const before = await runBoth(cases[8] as Scenario);
    expect(before.ours.outcome).toBe('{"status":"cancelled"}');
    expect(before.ours.settled).toEqual([]);
    // Huỷ GIỮA: luồng đã chạy, commit muộn bị `throwIfAborted` chặn ⇒ không ghi gì.
    const during = await runBoth(cases[9] as Scenario);
    expect(during.ours.outcome).toBe('{"status":"cancelled"}');
    expect(during.ours.writes).toBe("0:undefined");
  });

  test("MỘT lượt mỗi khoá: bên gọi thứ hai bị TỪ CHỐI (ALREADY_IN_FLIGHT), không được nhập chung", async () => {
    for (const [plugin, Ctor] of await sides()) {
      const { svc } = await boot(plugin, Ctor);
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      svc.registerFlow({
        key: KEY,
        label: "Demo",
        methods: [{ id: "oauth", label: "Sign in" }],
        run: async (session: Session) => {
          await gate;
          await session.commit({ kind: "grant", payload: { token: "abc" } });
        },
      });
      const interaction = { notify: () => undefined, prompt: () => Promise.resolve("x") };
      const first = svc.begin({ key: KEY, interaction });
      // `begin` là async nhưng đặt `running` NGAY khi tới lượt chạy ⇒ lượt thứ hai thấy khoá đang bận.
      const second = await svc.begin({ key: KEY, interaction }).then(
        () => "(khong nem)",
        (error: unknown) => thrown(error),
      );
      expect(second).toContain("ALREADY_IN_FLIGHT");
      expect(second).toContain("is already running");
      release();
      expect(await first).toEqual({ status: "authorized" });
    }
  });

  test("cancel() giữa lượt ⇒ cancelled · cancel() khi ĐANG commit thì KHÔNG cắt ngang lần ghi", async () => {
    for (const [plugin, Ctor] of await sides()) {
      const { svc, fake } = await boot(plugin, Ctor);
      svc.registerFlow({
        key: KEY,
        label: "Demo",
        methods: [{ id: "oauth", label: "Sign in" }],
        run: async (session: Session) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          await session.commit({ kind: "grant", payload: { token: "abc" } });
        },
      });
      const pending = svc.begin({ key: KEY, interaction: { notify: () => undefined, prompt: () => Promise.resolve("x") } });
      setTimeout(() => svc.cancel(KEY), 5);
      expect(await pending).toEqual({ status: "cancelled" });
      expect(fake.writes.length).toBe(0);
      // Sau khi lượt xong, khoá đã được nhả ⇒ cancel() là no-op, không ném.
      expect(() => svc.cancel(KEY)).not.toThrow();
    }
  });

  test("commit gọi SAU khi lượt đã xong ⇒ CANCELLED (khoá theo DANH TÍNH tín hiệu), không ghi gì", async () => {
    for (const [plugin, Ctor] of await sides()) {
      const { svc, fake } = await boot(plugin, Ctor);
      let captured: Session | undefined;
      svc.registerFlow({
        key: KEY,
        label: "Demo",
        methods: [{ id: "oauth", label: "Sign in" }],
        run: async (session: Session) => {
          captured = session;
        },
      });
      // Luồng phân giải mà KHÔNG commit ⇒ NOT_COMMITTED, và khoá đã được nhả khỏi sổ `running`.
      const outcome = await svc
        .begin({ key: KEY, interaction: { notify: () => undefined, prompt: () => Promise.resolve("x") } })
        .then((result) => result.status, (error: unknown) => thrown(error));
      expect(String(outcome)).toContain("NOT_COMMITTED");
      // Gọi `commit` của phiên CŨ: lượt không còn trong sổ ⇒ CANCELLED, kho credential KHÔNG bị ghi.
      const session = captured as Session;
      const late = await session.commit({ kind: "grant", payload: { token: "late" } }).then(
        () => "(khong nem)",
        (error: unknown) => thrown(error),
      );
      expect(late).toContain("CANCELLED");
      expect(late).toContain("no longer active");
      expect(fake.writes.length).toBe(0);
      expect(fake.records.size).toBe(0);
    }
  });

  test("DUPLICATE_FLOW + huỷ đăng ký: hai luồng cùng khoá bị từ chối, disposer chỉ rút ĐÚNG luồng của nó", async () => {
    for (const [plugin, Ctor] of await sides()) {
      const { svc } = await boot(plugin, Ctor);
      const flow = { key: KEY, label: "Mot", methods: [{ id: "oauth", label: "Sign in" }], run: async () => undefined };
      const dispose = svc.registerFlow(flow);
      expect(svc.describe(KEY)?.label).toBe("Mot");
      const message = (() => {
        try {
          svc.registerFlow({ ...flow, label: "Hai" });
          return "(khong nem)";
        } catch (error) {
          return thrown(error);
        }
      })();
      expect(message).toContain("DUPLICATE_FLOW");
      // Luồng ĐẦU vẫn còn nguyên sau lần ném.
      expect(svc.describe(KEY)?.label).toBe("Mot");
      dispose();
      expect(svc.describe(KEY)).toBeUndefined();
      expect(svc.list()).toEqual([]);
    }
  });

  test("authorization/settled: lỗi của người nghe được BAO LẠI — mọi người nghe vẫn chạy, kết cục KHÔNG đổi", async () => {
    for (const [plugin, Ctor] of await sides()) {
      const { svc } = await boot(plugin, Ctor);
      const seen: string[] = [];
      const warnings: string[] = [];
      const ctx = (svc as unknown as { ctx: CordisContext & { logger: { warn: (format: unknown, ...rest: unknown[]) => void } } }).ctx;
      const originalWarn = ctx.logger.warn;
      ctx.logger.warn = (format: unknown, ...rest: unknown[]) => {
        warnings.push(String(format) + (rest.length === 0 ? "" : " | " + rest.map(String).join(" ")));
      };
      // Ba người nghe: một ném ĐỒNG BỘ, một TỪ CHỐI BẤT ĐỒNG BỘ, một bình thường.
      ctx.on("authorization/settled", () => {
        seen.push("sync-throw");
        throw new Error("listener hong");
      });
      ctx.on("authorization/settled", () => {
        seen.push("async-reject");
        return Promise.reject(new Error("listener hong bat dong bo"));
      });
      ctx.on("authorization/settled", () => {
        seen.push("ok");
      });
      svc.registerFlow({
        key: KEY,
        label: "Demo",
        methods: [{ id: "oauth", label: "Sign in" }],
        run: async (session: Session) => {
          session.notify({ message: "mo trang nay", url: "https://example.test" });
          await session.commit({ kind: "grant", payload: { token: "abc" } });
        },
      });
      // notify của bề mặt NÉM ⇒ luồng vẫn chạy tiếp (bắn-rồi-quên).
      const session = await svc.begin({
        key: KEY,
        interaction: {
          notify: () => {
            throw new Error("be mat hong");
          },
          prompt: () => Promise.resolve("x"),
        },
      });
      expect(session).toEqual({ status: "authorized" });
      expect(seen).toEqual(["sync-throw", "async-reject", "ok"]);
      await new Promise((resolve) => setTimeout(resolve, 5));
      ctx.logger.warn = originalWarn;
      // Chẩn đoán phải nêu ĐÚNG khoá và in CẢ HAI lỗi (đồng bộ + bất đồng bộ), không được im lặng.
      const joined = warnings.join("\n");
      expect(joined).toContain("authorization/settled listener");
      expect(joined).toContain(KEY);
      expect(joined).toContain("listener hong");
      expect(joined).toContain("listener hong bat dong bo");
      // Cảnh báo của notify hỏng cũng phải có mặt.
      expect(joined).toContain("failed to render a notice");
    }
  });

  test("ca BYTE: bản ghi đi qua seam NGUYÊN VẸN — cùng tham chiếu, không `String(view)`, không round-trip JSON", async () => {
    for (const [plugin, Ctor] of await sides()) {
      const { svc, fake } = await boot(plugin, Ctor);
      const bytes = new Uint8Array([1, 2, 3]);
      const view = new DataView(bytes.buffer);
      const record = { kind: "grant", payload: { bytes, view } };
      svc.registerFlow({
        key: KEY,
        label: "Demo",
        methods: [{ id: "oauth", label: "Sign in" }],
        run: async (session: Session) => {
          await session.commit(record);
        },
      });
      expect(await svc.begin({ key: KEY, interaction: { notify: () => undefined, prompt: () => Promise.resolve("x") } })).toEqual({
        status: "authorized",
      });
      // CÙNG tham chiếu ⇒ seam không copy, không serialize lại bản ghi.
      expect(fake.writes[0]?.record).toBe(record);
      const stored = fake.records.get(KEY) as { payload: { bytes: Uint8Array; view: DataView } };
      expect(stored.payload.bytes).toBe(bytes);
      expect(stored.payload.view).toBe(view);
      // Bài học ADR 0004 §8: `String(view)` KHÁC byte thật ⇒ nếu seam từng stringify thì ca này đỏ.
      expect(String(stored.payload.bytes)).toBe("1,2,3");
      expect([...stored.payload.bytes]).toEqual([1, 2, 3]);
      expect(stored.payload.view.getUint8(0)).toBe(1);
      expect(ArrayBuffer.isView(stored.payload.view)).toBe(true);
    }
  });
});

describe("row authorization — C6 danh tính · manifest", () => {
  test("C6: hai thực thể ĐỘC LẬP · mục `describe`/`list` là vật thể MỚI mỗi lần · phiên của mỗi lượt RIÊNG", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as { Context: new () => unknown };
    const stockCordis = (await import(STOCK_CORDIS)) as { Context: new () => unknown };
    const a = await boot(Ours, ourCordis.Context);
    const b = await boot(Ours, ourCordis.Context);
    const theirs = await boot((await import(STOCK)).default, stockCordis.Context);
    // Hai thực thể: sổ luồng/sổ lượt KHÔNG dùng chung — đăng ký ở A không thấy ở B.
    a.svc.registerFlow({ key: KEY, label: "A", methods: [{ id: "oauth", label: "Sign in" }], run: async () => undefined });
    expect(a.svc.describe(KEY)?.label).toBe("A");
    expect(b.svc.describe(KEY)).toBeUndefined();
    expect(b.svc.list()).toEqual([]);
    // Mục công khai là vật thể MỚI: sửa nó không lan sang sổ của service (y bản gốc).
    const first = a.svc.describe(KEY) as { label: string; inFlight: boolean };
    const second = a.svc.describe(KEY) as { label: string; inFlight: boolean };
    expect(first).not.toBe(second);
    expect(theirs.svc.describe(KEY)).toBeUndefined();
    first.label = "sua-tay";
    expect(a.svc.describe(KEY)?.label).toBe("A");
    expect([...a.svc.list()][0]).not.toBe([...a.svc.list()][0]);
    // Phiên của mỗi lượt là vật thể RIÊNG: hai lượt liên tiếp ⇒ hai session, sửa một không lan sang kia.
    const sessions: Session[] = [];
    a.svc.registerFlow({
      key: "demo/lan",
      label: "Lan",
      methods: [{ id: "oauth", label: "Sign in" }],
      run: async (session: Session) => {
        sessions.push(session);
        await session.commit({ kind: "grant", payload: { token: "abc" } });
      },
    });
    const interaction = { notify: () => undefined, prompt: () => Promise.resolve("x") };
    await a.svc.begin({ key: "demo/lan", interaction });
    await a.svc.begin({ key: "demo/lan", interaction });
    expect(sessions.length).toBe(2);
    expect(sessions[0]).not.toBe(sessions[1]);
    expect(sessions[0]?.signal).not.toBe(sessions[1]?.signal);
    (sessions[0] as unknown as { method: string }).method = "sua-tay";
    expect(sessions[1]?.method).toBe("oauth");
  });

  test("manifest: gbh.peers ⊆ peerDependencies (so PHẦN TỬ) + ĐỐI CHỨNG ÂM · không dependencies · gbh.row khai ĐÚNG", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8")) as {
      name?: string;
      gbh?: { peers?: string[]; row?: unknown; row_unmounted_ly_do?: unknown; tests?: string[] };
      peerDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
      exports?: Record<string, string>;
    };
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-authorization");
    expect(missingPeers(manifest)).toEqual([]);
    expect(manifest.peerDependencies?.["@deepseek-ai/cordis"]).toBeDefined();
    expect(manifest.peerDependencies?.["@deepseek-ai/dsh-credentials"]).toBeDefined();
    expect(manifest.peerDependencies?.["@deepseek-ai/dsh-llm"]).toBeDefined();
    // Peer LUÔN là peerDependencies: kernel cấp MỘT thể hiện, không được tạo thể hiện thứ hai.
    expect(manifest.dependencies ?? {}).toEqual({});
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    // TEST CANH (mục 7 của HOST-ROW-REWRITE, dạng ĐÃ LẬT): row ĐÃ được Lead khai (commit 83164c5)
    // sau khi đối chiếu artifact 4=4 ⇒ khai báo phải ĐÚNG id row stock + ĐÚNG file test này.
    // Sai id ⇒ patch tắt nhầm row khác; thiếu test ⇒ vi phạm G4 (cổng `hygiene`).
    expect(manifest.gbh?.row).toEqual({ id: "authorization", tests: ["tests/host/authorization.test.ts"] });
    expect(manifest.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(manifest.gbh?.tests).toEqual(["tests/host/authorization.test.ts"]);
    // ĐỐI CHỨNG ÂM: cùng bộ so với manifest THIẾU phần tử ⇒ phải báo đúng tên thiếu (không rỗng).
    expect(missingPeers({ gbh: { peers: ["a", "b"] }, peerDependencies: { a: "1" } })).toEqual(["b"]);
    expect(missingPeers({ gbh: { peers: ["a"] }, peerDependencies: {} })).toEqual(["a"]);
    expect(missingPeers({ gbh: { peers: [] }, peerDependencies: {} })).toEqual([]);
  });
});

/**
 * Hai bên của mọi phép so "chạy trên cả hai bản": lớp service + lớp Context của chính bản đó.
 * Nhận: không.
 * Trả: mảng `[plugin, ContextCtor]` cho bản của ta và bản gốc.
 */
async function sides(): Promise<[unknown, new () => unknown][]> {
  const ourCordis = (await import(OUR_CORDIS)) as { Context: new () => unknown };
  const stockCordis = (await import(STOCK_CORDIS)) as { Context: new () => unknown };
  const stock = (await import(STOCK)) as AuthModule;
  return [
    [Ours, ourCordis.Context],
    [stock.default, stockCordis.Context],
  ];
}

// Neo rằng lớp ta xuất ở `src/index.ts` đúng là lớp đã build (không phải một bản sao thứ hai).
expect(Ours).toBe(AuthorizationService);
