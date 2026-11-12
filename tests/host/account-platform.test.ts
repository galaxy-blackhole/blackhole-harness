/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-account-platform: đo trên ARTIFACT (build vào
 *      packages/host/account-platform/lib/.test-build) đối chứng với CHÍNH bundle gốc trong kernel —
 *      export · Config · lỗi cấu hình NGUYÊN VĂN · PKCE · details/balance · logout · C6 danh tính —
 *      tất cả trên Context cordis THẬT với seam credentials/authorization/webServer giả CẤU TRÚC.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/account-platform/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "account-platform");
/** Thư mục build tạm nằm TRONG package để "packages: external" phân giải peer lúc nạp. */
const OUT = join(PKG, "lib", ".test-build");
/** Bundle GỐC đã build trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-deepseek-account-platform", "lib", "index.js");
/** cordis mà CHÍNH package ta nạp (symlink tới kernel) — cùng một tệp thật với bản của bundle gốc. */
const CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Origin mặc định của Config (dùng trong URL giả của Platform). */
const ORIGIN = "https://platform.deepseek.com";
/** Khoá credential của grant (nguyên văn bản gốc). */
const KEY = "deepseek-account-platform/default";
/** Token grant mẫu. */
const GRANT_TOKEN = "tok-1";
/** Danh tính UI mẫu của một lần gọi. */
const CLIENT: Client = { version: "0.1.0", locale: "vi-VN", timezoneOffsetSeconds: 25200 };
/** Người dùng Platform mẫu — payload "user" hợp lệ. */
const USER = { id: "u1", email: "a@b.c", id_profile: { name: "Hiếu", picture: null } };
/** Ví mẫu — payload "summary" hợp lệ. */
const SUMMARY = { normal_wallets: [{ currency: "CNY", balance: "12.50" }], bonus_wallets: [] };
/** Đơn bonus mẫu (UUID hợp lệ mà schema đòi). */
const ORDER_ID = "0190f6a0-1111-7000-8000-000000000001";
/** Bonus chưa báo mẫu — payload hợp lệ. */
const BONUS = [
  { order_id: ORDER_ID, campaign: "welcome", amount: "5.00", currency: "CNY", granted_at: "2026-10-01T00:00:00Z", expires_at: "2026-11-01T00:00:00Z", msg: "Chào mừng" },
];
/** fetch THẬT, khôi phục sau MỖI ca để không rò rỉ bộ giả sang ca sau. */
const REAL_FETCH: unknown = globalThis.fetch;

/** cordis của kernel — nạp theo đường dẫn tính lúc chạy. */
const cordis = (await import(CORDIS)) as unknown as CordisModule;
/** Bundle gốc nạp động — oracle của mọi phép so. */
const stockMod = (await import(STOCK)) as unknown as AccountModule;
/** Artifact của TA (điền trong beforeAll). */
let ourMod: AccountModule;

/** Danh tính UI của một lần gọi. */
interface Client {
  readonly version: string;
  readonly locale: string;
  readonly timezoneOffsetSeconds: number;
}

/** Ảnh chụp trạng thái tài khoản mà cả hai bản cùng trả. */
interface View {
  status: string;
  attempt: { id: string; phase: string; authorizeUrl?: string; expiresAt?: number; errorCode?: string } | null;
  links: { usageUrl: string; topUpUrl: string };
}

/** Một bản ghi credential giả trong sổ của rig. */
interface CredentialRecord {
  kind: string;
  payload: unknown;
}

/** Phiên uỷ quyền giả mà flow nhận từ seam. */
interface Session {
  readonly method: string;
  readonly signal: AbortSignal;
  commit(record: CredentialRecord): Promise<void>;
  notify(notice: unknown): void;
  prompt(prompt: unknown): Promise<string>;
}

/** Luồng uỷ quyền đã đăng ký qua seam giả. */
interface Flow {
  readonly key: unknown;
  readonly label: string;
  readonly methods: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  run(session: Session): Promise<void>;
}

/** Yêu cầu uỷ quyền mà provider gửi cho seam. */
interface BeginRequest {
  readonly key: unknown;
  readonly method?: string;
  readonly signal?: AbortSignal;
}

/** Phản hồi HTTP giả của tab callback. */
interface FakeResponse {
  code?: number;
  headers?: Record<string, string>;
  body?: unknown;
  writeHead(code: number, headers?: Record<string, string>): FakeResponse;
  end(body?: unknown): FakeResponse;
}

/** Hàm xử lý callback mà webServer giả giữ lại. */
type CallbackHandler = (request: { method?: string; url?: string }, response: FakeResponse) => void;

/** Context cordis THẬT nhìn qua đúng bốn thao tác mà rig dùng. */
interface CordisContext {
  provide(name: string, value: unknown): unknown;
  get(name: string): unknown;
  on(name: string, listener: () => void): unknown;
  effect(callback: () => () => unknown, label?: string): unknown;
  fiber: { dispose(): Promise<void> };
}

/** Phần cordis mà test chạm: constructor Context và ký hiệu vòng đời Service.init. */
interface CordisModule {
  readonly Context: new () => CordisContext;
  readonly Service: { readonly init: symbol };
}

/** Schema schemastery công khai: gọi được để kiểm/điền mặc định, in ra được để so từng ký tự. */
interface ConfigSchema {
  (input?: Readonly<Record<string, unknown>>): Record<string, unknown>;
  toString(): string;
}

/** Mười ba thao tác công khai của provider (y lib/types/index.d.ts của bản gốc). */
interface AccountLike {
  getState(): Promise<View>;
  getProfile(client: Client): Promise<unknown>;
  getBalance(client: Client): Promise<unknown>;
  getUnnotifiedBonuses(client: Client): Promise<unknown>;
  ackBonusNotified(accountId: string, orderId: string, client: Client): Promise<boolean>;
  startSignIn(client: Client, callbackOrigin: string, loginSource: "web" | "desktop"): Promise<View>;
  cancelSignIn(id: string): Promise<View>;
  signOut(client: Client): Promise<View>;
  watch(signal: AbortSignal, includeIdentityChanges?: boolean): AsyncIterable<View>;
  resolveToken(url: string): Promise<string | undefined>;
  rejectToken(token: string): Promise<void>;
  getPlatformSession(): Promise<Record<string, unknown> | null>;
  getDeviceIdentity(): Promise<{ deviceId?: string; userId?: string; osVersion: string }>;
}

/** Lớp provider công khai của một bản dựng. */
interface AccountClass {
  new (ctx: CordisContext, config?: Readonly<Record<string, unknown>>): AccountLike;
  readonly inject: readonly string[];
  readonly Config: ConfigSchema;
}

/** Module account-platform đã nạp: ĐÚNG ba tên công khai. */
interface AccountModule {
  readonly Config: ConfigSchema;
  readonly PlatformAccount: AccountClass;
  readonly default: unknown;
}

/** Một lượt dựng: Context thật + provider + sổ credential + vết event + flow đã đăng ký. */
interface Rig {
  readonly ctx: CordisContext;
  readonly account: AccountLike;
  readonly records: Map<string, CredentialRecord>;
  readonly events: string[];
  readonly flows: Map<string, Flow>;
  handler(): CallbackHandler | undefined;
}

/** Tuyến fetch giả: nhận thân JSON đã đọc và huỷ của request. */
type RouteHandler = (body: Record<string, unknown>, signal: AbortSignal) => Response | Promise<Response>;

/** Kịch bản đăng nhập: thành công trọn vẹn, một lỗi ở auth_init, hoặc bị huỷ. */
type LoginMode = "success" | "status-401" | "business" | "envelope" | "no-response" | "request-timeout" | "attempt-timeout" | "cancel";

/** Quan sát một kịch bản đăng nhập, đã bỏ giá trị ngẫu nhiên (state/challenge/verifier/id). */
interface LoginObservation {
  first: string | null;
  phase: string | null;
  errorCode: string | null;
  status: string;
  records: string[];
  events: string[];
  redirect: { code: number; location: string | null } | null;
  init: Record<string, unknown> | null;
  exchange: Record<string, unknown> | null;
}

/** Kết quả một phép đọc chi tiết: giá trị, lỗi ném (nếu có), sổ credential và event. */
interface DetailObservation {
  result: unknown;
  thrown: string | null;
  records: string[];
  events: string[];
}

/** Kết quả một lượt đăng xuất: số lượt gọi logout, trạng thái, sổ credential, event. */
interface LogoutObservation {
  attempts: number;
  status: string;
  records: string[];
  events: string[];
}

/** Ngủ một khoảng ngắn để nhường lượt cho các promise nền. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Chờ tới khi điều kiện đúng; hết hạn thì NÉM để test đỏ thay vì treo. */
async function waitFor(predicate: () => Promise<boolean>, label: string, timeoutMs = 4000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await sleep(2);
  }
  throw new Error("hết hạn chờ: " + label);
}

/** Khoá của sổ credential, đã sắp xếp — dạng so sánh được. */
function keys(records: Map<string, CredentialRecord>): string[] {
  return [...records.keys()].sort();
}

/** Mô tả NGUYÊN VĂN một lỗi: tên lớp + thông điệp + mã ổn định (nếu có). */
function errorText(error: unknown): string {
  const known = error as { message?: string; code?: unknown; constructor?: { name?: string } };
  const name = known.constructor?.name ?? "?";
  const code = known.code === undefined ? "" : " [" + String(known.code) + "]";
  return name + ": " + String(known.message ?? "") + code;
}

/** Chạy một phép ĐỒNG BỘ và trả câu lỗi NGUYÊN VĂN (hoặc "(khong nem)"). */
function thrownBy(run: () => unknown): string {
  try {
    run();
    return "(khong nem)";
  } catch (error) {
    return errorText(error);
  }
}

/** Ảnh chụp trạng thái đã bỏ id/timestamp ngẫu nhiên — dạng so A/B được. */
function shape(view: View | null | undefined): unknown {
  if (view === null || view === undefined) return null;
  const attempt = view.attempt;
  return {
    status: view.status,
    attempt:
      attempt === null || attempt === undefined
        ? null
        : {
            phase: attempt.phase,
            errorCode: attempt.errorCode ?? null,
            hasAuthorizeUrl: typeof attempt.authorizeUrl === "string",
            hasExpiresAt: typeof attempt.expiresAt === "number",
          },
    links: view.links,
  };
}

/** Phản hồi JSON giả của Platform. */
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

/** Phong bì thành công của Platform (code 0 + biz_code 0). */
function envelope(bizData: unknown): unknown {
  return { code: 0, data: { biz_code: 0, biz_data: bizData } };
}

/** Thay fetch toàn cục bằng bộ định tuyến theo ĐƯỜNG DẪN; trả vết các URL đã gọi. */
function stubFetch(routes: Record<string, RouteHandler>): { readonly calls: string[] } {
  const calls: string[] = [];
  const fake = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const path = new URL(url).pathname;
    const handler = routes[path];
    if (handler === undefined) throw new Error("stubFetch: không có tuyến cho " + path);
    const raw = typeof init?.body === "string" ? init.body : "{}";
    const signal = init?.signal ?? new AbortController().signal;
    if (signal.aborted) throw signal.reason;
    return handler(JSON.parse(raw) as Record<string, unknown>, signal);
  };
  (globalThis as unknown as { fetch: unknown }).fetch = fake;
  return { calls };
}

/** Phản hồi giả của tab callback, ghi lại mã trạng thái + header + thân. */
function fakeResponse(): FakeResponse {
  const response: FakeResponse = {
    writeHead(code, headers) {
      response.code = code;
      if (headers !== undefined) response.headers = headers;
      return response;
    },
    end(body) {
      response.body = body;
      return response;
    },
  };
  return response;
}

/** Dựng MỘT provider trên Context cordis THẬT với seam giả CẤU TRÚC và sổ credential cho trước. */
function rig(
  module: AccountModule,
  config: Readonly<Record<string, unknown>> = {},
  seed: ReadonlyArray<readonly [string, CredentialRecord]> = [],
): Rig {
  const ctx = new cordis.Context();
  const records = new Map<string, CredentialRecord>(seed);
  const events: string[] = [];
  const flows = new Map<string, Flow>();
  let handler: CallbackHandler | undefined;
  ctx.provide("credentials", {
    async readRecord(key: unknown) {
      return records.get(String(key));
    },
    async modifyRecord(key: unknown, mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>) {
      const next = await mutate(records.get(String(key)));
      if (next !== undefined) records.set(String(key), next);
      return next ?? records.get(String(key));
    },
    async deleteRecord(key: unknown) {
      records.delete(String(key));
    },
    async describeRecord(key: unknown) {
      return { configured: records.has(String(key)), writable: true };
    },
  });
  ctx.provide("authorization", {
    registerFlow(flow: Flow) {
      flows.set(String(flow.key), flow);
      return () => {
        flows.delete(String(flow.key));
      };
    },
    list() {
      return [...flows.values()];
    },
    describe(key: unknown) {
      return flows.get(String(key));
    },
    cancel() {},
    async begin(request: BeginRequest) {
      const flow = flows.get(String(request.key));
      if (flow === undefined) throw new Error("authorization: NO_FLOW");
      const controller = new AbortController();
      request.signal?.addEventListener("abort", () => controller.abort(), { once: true });
      let committed = false;
      if (controller.signal.aborted) return { status: "cancelled" };
      try {
        await flow.run({
          method: request.method ?? flow.methods[0]?.id ?? "browser",
          signal: controller.signal,
          commit: async (record: CredentialRecord) => {
            controller.signal.throwIfAborted();
            committed = true;
            records.set(String(flow.key), record);
          },
          notify: () => {},
          prompt: async () => {
            throw new Error("authorization: khước từ");
          },
        });
      } catch (error) {
        if (controller.signal.aborted) return { status: "cancelled" };
        throw error;
      }
      if (!committed) throw new Error("authorization: NOT_COMMITTED");
      return { status: "authorized" };
    },
  });
  ctx.provide("webServer", {
    register(entry: { handler: CallbackHandler }) {
      handler = entry.handler;
      return () => {
        handler = undefined;
      };
    },
  });
  ctx.on("deepseek-account/signed-out", () => {
    events.push("signed-out");
  });
  ctx.on("deepseek-account/session-expired", () => {
    events.push("expired");
  });
  const account = new module.PlatformAccount(ctx, config);
  return { ctx, account, records, events, flows, handler: () => handler };
}

/** Bản ghi grant hợp lệ cho một issuer (mặc định: origin đã cấu hình). */
function grantRecord(issuer = ORIGIN): CredentialRecord {
  return { kind: "grant", payload: { version: 1, token: GRANT_TOKEN, issuer } };
}

/** Rig đã đăng nhập sẵn (grant đang lưu). */
function signedIn(module: AccountModule, config: Readonly<Record<string, unknown>> = {}): Rig {
  return rig(module, config, [[KEY, grantRecord()]]);
}

/** Dựng provider với cấu hình cho trước trên Context MỚI; trả câu lỗi NGUYÊN VĂN (hoặc "(khong nem)"). */
function constructError(module: AccountModule, config: Readonly<Record<string, unknown>>): string {
  return thrownBy(() => rig(module, config));
}

/** Chạy vòng đời Service.init mà cordis gọi sau khi cài provider (giữ ĐÚNG receiver). */
function runInit(account: AccountLike): Promise<void> {
  const holder = account as unknown as { [key: symbol]: ((this: AccountLike) => Promise<void>) | undefined };
  const lifecycle = holder[cordis.Service.init];
  if (lifecycle === undefined) throw new Error("thiếu Service.init");
  return lifecycle.call(account);
}

/** Hình dạng thân giao thức (bỏ giá trị ngẫu nhiên, giữ ĐỘ DÀI để so PKCE). */
function shapeBody(body: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (body === undefined) return null;
  const length = (key: string): number => String(body[key] ?? "").length;
  return {
    challengeMethod: body["code_challenge_method"] ?? null,
    challengeLength: length("code_challenge"),
    stateLength: length("state"),
    verifierLength: length("code_verifier"),
    redirectUri: body["redirect_uri"] ?? null,
    locale: body["locale"] ?? null,
    loginSource: body["login_source"] ?? null,
    hasDeviceId: typeof body["device_id"] === "string",
    deviceModel: body["device_model"] ?? null,
  };
}

/** Cấu hình riêng của chế độ quá hạn (hạn 1ms để test không phải chờ). */
function loginConfig(mode: LoginMode): Record<string, unknown> {
  if (mode === "request-timeout") return { requestTimeoutMs: 1 };
  if (mode === "attempt-timeout") return { attemptTimeoutMs: 1 };
  return {};
}

/** Chờ phản hồi treo tới khi bị huỷ — mô phỏng mạng không trả lời. */
function hang(signal: AbortSignal): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

/** Kết cục cuối của một lần thử đăng nhập. */
function terminal(view: View): boolean {
  return ["succeeded", "failed", "expired", "cancelled"].includes(view.attempt?.phase ?? "");
}

/** Chạy MỘT kịch bản đăng nhập trên một bản dựng và trả quan sát đã chuẩn hoá. */
async function login(module: AccountModule, mode: LoginMode): Promise<LoginObservation> {
  const world = rig(module, loginConfig(mode));
  const bodies: Record<string, Record<string, unknown>> = {};
  const response = fakeResponse();
  stubFetch({
    "/auth-api/v0/dsh/auth_init": (body, signal) => {
      bodies["init"] = body;
      if (mode === "status-401") return json({ code: 401 }, 401);
      if (mode === "business") return json({ code: 40003 });
      if (mode === "envelope") return json({ code: 0, data: {} });
      if (mode === "no-response") throw new TypeError("mạng hỏng");
      if (mode === "request-timeout" || mode === "attempt-timeout") return hang(signal);
      const state = String(body["state"]);
      return json(envelope({ authorize_url: ORIGIN + "/dsh/authorize?state=" + state, authorize_id: "auth-1", expires_in: 600 }));
    },
    "/auth-api/v0/dsh/auth_exchange": (body) => {
      bodies["exchange"] = body;
      return json(envelope({ token: GRANT_TOKEN, authorized_url: ORIGIN + "/dsh/authorized", user: USER }));
    },
    "/auth-api/v0/dsh/auth_cancel": () => json(envelope(null)),
  });
  const first = await world.account.startSignIn(CLIENT, "http://127.0.0.1:1234", "web");
  if (mode === "cancel") {
    const final = await world.account.cancelSignIn(first.attempt?.id ?? "");
    return {
      first: first.attempt?.phase ?? null,
      phase: final.attempt?.phase ?? null,
      errorCode: final.attempt?.errorCode ?? null,
      status: final.status,
      records: keys(world.records),
      events: world.events,
      redirect: null,
      init: null,
      exchange: null,
    };
  }
  await waitFor(async () => {
    const view = await world.account.getState();
    return view.attempt?.phase === "waiting-browser" || terminal(view);
  }, "auth_init trả lời");
  if (mode === "success") {
    const state = String(bodies["init"]?.["state"]);
    world.handler()?.({ method: "GET", url: "/oauth/callback?code=CODE&state=" + state }, response);
  }
  await waitFor(async () => terminal(await world.account.getState()), "kết cục lần thử");
  const final = await world.account.getState();
  return {
    first: first.attempt?.phase ?? null,
    phase: final.attempt?.phase ?? null,
    errorCode: final.attempt?.errorCode ?? null,
    status: final.status,
    records: keys(world.records),
    events: world.events,
    redirect: response.code === undefined ? null : { code: response.code, location: response.headers?.["location"] ?? null },
    init: shapeBody(bodies["init"]),
    exchange: shapeBody(bodies["exchange"]),
  };
}

/** Chạy MỘT phép đọc chi tiết trên rig đã đăng nhập với bộ tuyến fetch cho trước. */
async function detail(
  module: AccountModule,
  call: (account: AccountLike) => Promise<unknown>,
  routes: Record<string, RouteHandler>,
): Promise<DetailObservation> {
  const world = signedIn(module);
  stubFetch(routes);
  let result: unknown = null;
  let thrown: string | null = null;
  try {
    result = await call(world.account);
  } catch (error) {
    thrown = errorText(error);
  }
  return { result, thrown, records: keys(world.records), events: world.events };
}

/** Đăng xuất với phản hồi lỗi cho tới lượt succeedAt; chờ đủ expected lượt rồi trả quan sát. */
async function logout(module: AccountModule, succeedAt: number, expected: number): Promise<LogoutObservation> {
  const world = signedIn(module, { logoutMaxRetries: 2, logoutRetryDelayMs: 1 });
  let attempts = 0;
  stubFetch({
    "/auth-api/v0/users/logout": () => {
      attempts += 1;
      return attempts >= succeedAt ? json(envelope(null)) : json({ code: 500 }, 500);
    },
  });
  const view = await world.account.signOut(CLIENT);
  await waitFor(async () => attempts >= expected, "các lượt logout");
  await sleep(20);
  return { attempts, status: view.status, records: keys(world.records), events: world.events };
}

/** Nạp artifact của TA một lần cho cả tệp; dọn thư mục build tạm sau khi xong. */
beforeAll(async () => {
  const built = await buildPackage(OUT);
  ourMod = (await import(built)) as unknown as AccountModule;
});

/** Dọn thư mục build tạm — không để lại file nguồn giả trong package. */
afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

/** Khôi phục fetch thật sau mỗi ca để bộ giả không rò rỉ. */
afterEach(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = REAL_FETCH;
});


describe("bề mặt export — artifact của ta với CHÍNH bundle gốc", () => {
  test("đúng ba tên [Config, PlatformAccount, default]; default === PlatformAccount; kiểu từng tên", () => {
    expect(Object.keys(ourMod).sort()).toEqual(Object.keys(stockMod).sort());
    expect(Object.keys(ourMod).sort()).toEqual(["Config", "PlatformAccount", "default"]);
    expect(ourMod.default).toBe(ourMod.PlatformAccount);
    expect(stockMod.default).toBe(stockMod.PlatformAccount);
    const oursTypes = [typeof ourMod.Config, typeof ourMod.PlatformAccount, typeof ourMod.default];
    const theirsTypes = [typeof stockMod.Config, typeof stockMod.PlatformAccount, typeof stockMod.default];
    expect(oursTypes).toEqual(theirsTypes);
    expect(oursTypes).toEqual(["function", "function", "function"]);
  });

  test("static inject = ['credentials','authorization'] và static Config === Config ở CẢ HAI", () => {
    expect(ourMod.PlatformAccount.inject).toEqual(stockMod.PlatformAccount.inject);
    expect(ourMod.PlatformAccount.inject).toEqual(["credentials", "authorization"]);
    expect(ourMod.PlatformAccount.Config).toBe(ourMod.Config);
    expect(stockMod.PlatformAccount.Config).toBe(stockMod.Config);
  });

  test("String(Config) BẰNG NHAU từng ký tự", () => {
    const ours = String(ourMod.Config);
    const theirs = String(stockMod.Config);
    expect(ours.length).toBe(theirs.length);
    for (let index = 0; index < theirs.length; index++) expect(ours.at(index)).toBe(theirs.at(index));
    expect(ours).toBe(theirs);
  });
});

describe("Config schema — mặc định và từ chối NGUYÊN VĂN", () => {
  test("Config({}) sâu bằng và đúng hợp đồng deployment (origin, hạn, retry, header)", () => {
    const ours = ourMod.Config({});
    const theirs = stockMod.Config({});
    expect(ours).toEqual(theirs);
    expect(ours).toMatchObject({
      platformOrigin: "https://platform.deepseek.com",
      embeddedPageDist: "",
      inferenceOrigin: "https://api.deepseek.com",
      allowLoopbackHttp: false,
      rewriteBrowserOrigin: false,
      requestHeaders: {},
      accountRequestHeaders: {},
      requestTimeoutMs: 30000,
      balanceTimeoutMs: 30000,
      logoutMaxRetries: 5,
      logoutRetryDelayMs: 1000,
      attemptTimeoutMs: 600000,
    });
    // schemastery BỎ khoá desktopPlatform khi vắng mặt ở CẢ HAI; "null = client web" đọc qua giá trị tường minh.
    expect(Object.hasOwn(ours, "desktopPlatform")).toBe(Object.hasOwn(theirs, "desktopPlatform"));
    expect(ourMod.Config({ desktopPlatform: null }).desktopPlatform).toBeNull();
    expect(stockMod.Config({ desktopPlatform: null }).desktopPlatform).toBeNull();
  });

  test("desktopPlatform: 'darwin'/'win32' nhận, giá trị lạ bị từ chối NGUYÊN VĂN", () => {
    for (const value of ["darwin", "win32"]) {
      expect(ourMod.Config({ desktopPlatform: value }).desktopPlatform).toBe(value);
      expect(stockMod.Config({ desktopPlatform: value }).desktopPlatform).toBe(value);
    }
    const ours = thrownBy(() => ourMod.Config({ desktopPlatform: "linux" }));
    const theirs = thrownBy(() => stockMod.Config({ desktopPlatform: "linux" }));
    expect(ours).toBe(theirs);
    expect(ours).toContain("linux");
  });

  test("requestTimeoutMs 0 và 120001 bị từ chối NGUYÊN VĂN", () => {
    for (const value of [0, 120001]) {
      const ours = thrownBy(() => ourMod.Config({ requestTimeoutMs: value }));
      const theirs = thrownBy(() => stockMod.Config({ requestTimeoutMs: value }));
      expect(ours).toBe(theirs);
      expect(ours).toContain("requestTimeoutMs");
      expect(ours).toContain(String(value));
    }
  });
});

describe("dựng trên Context cordis THẬT — lỗi cấu hình NGUYÊN VĂN", () => {
  test("dựng được với seam CẤU TRÚC: đăng ký flow 'DeepSeek', getState signed-out", async () => {
    const ours = rig(ourMod);
    const theirs = rig(stockMod);
    expect(shape(await ours.account.getState())).toEqual(shape(await theirs.account.getState()));
    expect([...ours.flows.keys()]).toEqual([...theirs.flows.keys()]);
    expect([...ours.flows.keys()]).toEqual([KEY]);
    const ourFlow = ours.flows.get(KEY);
    const theirFlow = theirs.flows.get(KEY);
    expect({ label: ourFlow?.label, methods: ourFlow?.methods }).toEqual({ label: theirFlow?.label, methods: theirFlow?.methods });
    expect({ label: ourFlow?.label, methods: ourFlow?.methods }).toEqual({ label: "DeepSeek", methods: [{ id: "browser", label: "DeepSeek" }] });
  });

  test("inferenceOrigin sai (user/path/query/hash/ftp) ném CÙNG câu", () => {
    const cases = [
      { inferenceOrigin: "https://user:pw@api.deepseek.com" },
      { inferenceOrigin: "https://api.deepseek.com/v1" },
      { inferenceOrigin: "https://api.deepseek.com?x=1" },
      { inferenceOrigin: "https://api.deepseek.com#x" },
      { inferenceOrigin: "ftp://api.deepseek.com" },
    ];
    for (const config of cases) {
      const ours = constructError(ourMod, config);
      const theirs = constructError(stockMod, config);
      expect(ours).toBe(theirs);
      expect(ours).toBe("Error: account: inferenceOrigin must be an HTTP(S) origin without credentials, path, query or fragment");
    }
  });

  test("platformOrigin http thường / có path / loopback thiếu cờ bị từ chối; bật cờ thì nhận", () => {
    const cases = [
      { platformOrigin: "http://platform.deepseek.com" },
      { platformOrigin: "https://platform.deepseek.com/x" },
      { platformOrigin: "http://localhost:3000" },
    ];
    for (const config of cases) {
      const ours = constructError(ourMod, config);
      const theirs = constructError(stockMod, config);
      expect(ours).toBe(theirs);
      expect(ours).toBe("Error: account: platformOrigin must be an HTTPS origin or explicitly enabled loopback HTTP origin");
    }
    const loopback = { platformOrigin: "http://localhost:3000", allowLoopbackHttp: true };
    expect(constructError(ourMod, loopback)).toBe(constructError(stockMod, loopback));
    expect(constructError(ourMod, loopback)).toBe("(khong nem)");
  });

  test("requestHeaders reserved / trùng tên / giá trị sai ném CÙNG câu", () => {
    const cases = [{ requestHeaders: { Authorization: "x" } }, { requestHeaders: { "x-a": "1", "X-A": "2" } }, { requestHeaders: { "x-a": "bad\nvalue" } }];
    const expected = [
      "Error: account: requestHeaders contains a reserved or duplicate header",
      "Error: account: requestHeaders contains a reserved or duplicate header",
      "Error: account: requestHeaders contains an invalid header",
    ];
    for (const [index, config] of cases.entries()) {
      const ours = constructError(ourMod, config);
      const theirs = constructError(stockMod, config);
      expect(ours).toBe(theirs);
      expect(ours).toBe(expected[index] ?? "");
    }
  });
});

describe("PKCE — chạy TRỌN flow với fetch giả và webServer giả", () => {
  test("thành công: auth_init → callback → exchange → commit grant + 302 về trang hoàn tất", async () => {
    const ours = await login(ourMod, "success");
    const theirs = await login(stockMod, "success");
    expect(ours).toEqual(theirs);
    expect(ours.phase).toBe("succeeded");
    expect(ours.status).toBe("credential-stored");
    expect(ours.records).toEqual([KEY, "deepseek-account-platform/device"]);
    expect(ours.redirect).toEqual({ code: 302, location: ORIGIN + "/dsh/authorized?login_source=web" });
    expect(ours.init).toMatchObject({
      challengeMethod: "S256",
      challengeLength: 43,
      stateLength: 43,
      redirectUri: "http://127.0.0.1:1234/oauth/callback",
      locale: "en_US",
      loginSource: "web",
    });
    expect(ours.exchange).toMatchObject({ verifierLength: 43, redirectUri: "http://127.0.0.1:1234/oauth/callback", hasDeviceId: true });
  });

  test("auth_init 401 (không có token) → failed/network", async () => {
    const ours = await login(ourMod, "status-401");
    const theirs = await login(stockMod, "status-401");
    expect(ours).toEqual(theirs);
    expect(ours.phase).toBe("failed");
    expect(ours.errorCode).toBe("network");
    expect(ours.records).toEqual([]);
  });

  test("auth_init trả code 40003 (envelope sai) → failed/protocol", async () => {
    const ours = await login(ourMod, "business");
    const theirs = await login(stockMod, "business");
    expect(ours).toEqual(theirs);
    expect(ours.phase).toBe("failed");
    expect(ours.errorCode).toBe("protocol");
  });

  test("envelope thiếu data → failed/protocol", async () => {
    const ours = await login(ourMod, "envelope");
    const theirs = await login(stockMod, "envelope");
    expect(ours).toEqual(theirs);
    expect(ours.phase).toBe("failed");
    expect(ours.errorCode).toBe("protocol");
  });

  test("fetch ném (không có phản hồi) → failed/no-response", async () => {
    const ours = await login(ourMod, "no-response");
    const theirs = await login(stockMod, "no-response");
    expect(ours).toEqual(theirs);
    expect(ours.phase).toBe("failed");
    expect(ours.errorCode).toBe("no-response");
  });

  test("quá hạn MỘT request (requestTimeoutMs=1) → failed/no-response", async () => {
    const ours = await login(ourMod, "request-timeout");
    const theirs = await login(stockMod, "request-timeout");
    expect(ours).toEqual(theirs);
    expect(ours.phase).toBe("failed");
    expect(ours.errorCode).toBe("no-response");
  });

  test("quá hạn CẢ lần thử (attemptTimeoutMs=1) → expired", async () => {
    const ours = await login(ourMod, "attempt-timeout");
    const theirs = await login(stockMod, "attempt-timeout");
    expect(ours).toEqual(theirs);
    expect(ours.phase).toBe("expired");
    expect(ours.errorCode).toBe("expired");
  });

  test("huỷ lần thử qua cancelSignIn → cancelled, không commit gì", async () => {
    const ours = await login(ourMod, "cancel");
    const theirs = await login(stockMod, "cancel");
    expect(ours).toEqual(theirs);
    expect(ours.phase).toBe("cancelled");
    expect(ours.status).toBe("signed-out");
    expect(ours.records).toEqual([]);
  });
});


describe("details/balance — schema và kết cục, đối chứng từng bản", () => {
  test("getBalance: payload hợp lệ → ready; payload sai → failed (KHÔNG xoá grant)", async () => {
    const valid = await detail(ourMod, (a) => a.getBalance(CLIENT), { "/api/v0/users/get_user_summary": () => json(envelope(SUMMARY)) });
    const validTheirs = await detail(stockMod, (a) => a.getBalance(CLIENT), { "/api/v0/users/get_user_summary": () => json(envelope(SUMMARY)) });
    expect(valid).toEqual(validTheirs);
    expect(valid.result).toEqual({ status: "ready", value: [{ currency: "CNY", balance: "12.50" }], bonusWallets: [] });
    expect(valid.records).toEqual([KEY]);
    const broken = await detail(ourMod, (a) => a.getBalance(CLIENT), { "/api/v0/users/get_user_summary": () => json(envelope({ normal_wallets: "x" })) });
    const brokenTheirs = await detail(stockMod, (a) => a.getBalance(CLIENT), { "/api/v0/users/get_user_summary": () => json(envelope({ normal_wallets: "x" })) });
    expect(broken).toEqual(brokenTheirs);
    expect(broken.result).toEqual({ status: "failed" });
    expect(broken.records).toEqual([KEY]);
  });

  test("getProfile: payload hợp lệ → ready (chiếu hồ sơ); payload sai → failed", async () => {
    const valid = await detail(ourMod, (a) => a.getProfile(CLIENT), { "/auth-api/v0/users/current": () => json(envelope(USER)) });
    const validTheirs = await detail(stockMod, (a) => a.getProfile(CLIENT), { "/auth-api/v0/users/current": () => json(envelope(USER)) });
    expect(valid).toEqual(validTheirs);
    expect(valid.result).toEqual({ status: "ready", value: { id: "u1", avatarUrl: null, name: "Hiếu", contact: "a@b.c" } });
    const broken = await detail(ourMod, (a) => a.getProfile(CLIENT), { "/auth-api/v0/users/current": () => json(envelope({ email: 1 })) });
    const brokenTheirs = await detail(stockMod, (a) => a.getProfile(CLIENT), { "/auth-api/v0/users/current": () => json(envelope({ email: 1 })) });
    expect(broken).toEqual(brokenTheirs);
    expect(broken.result).toEqual({ status: "failed" });
  });

  test("401 và 40003 trên request ĐÃ xác thực → expired: gỡ grant + hai event", async () => {
    for (const [payload, status] of [[{ code: 401 }, 401], [{ code: 40003 }, 200]] as const) {
      const route = { "/api/v0/users/get_user_summary": () => json(payload, status) };
      const ours = await detail(ourMod, (a) => a.getBalance(CLIENT), route);
      const theirs = await detail(stockMod, (a) => a.getBalance(CLIENT), route);
      expect(ours).toEqual(theirs);
      expect(ours.result).toBeNull();
      expect(ours.records).toEqual([]);
      expect(ours.events).toEqual(["expired", "signed-out"]);
    }
  });

  test("getUnnotifiedBonuses: hợp lệ → batch; payload sai → ném protocol; 40003 → null + expired", async () => {
    const profile = { "/auth-api/v0/users/current": () => json(envelope(USER)) };
    const valid = await detail(ourMod, (a) => a.getUnnotifiedBonuses(CLIENT), {
      ...profile,
      "/api/v0/users/get_unnotified_bonuses": () => json(envelope(BONUS)),
    });
    const validTheirs = await detail(stockMod, (a) => a.getUnnotifiedBonuses(CLIENT), {
      ...profile,
      "/api/v0/users/get_unnotified_bonuses": () => json(envelope(BONUS)),
    });
    expect(valid).toEqual(validTheirs);
    expect(valid.result).toEqual({
      accountId: "u1",
      bonuses: [
        {
          orderId: "0190f6a0-1111-7000-8000-000000000001",
          campaign: "welcome",
          amount: "5.00",
          currency: "CNY",
          grantedAt: "2026-10-01T00:00:00Z",
          expiresAt: "2026-11-01T00:00:00Z",
          message: "Chào mừng",
        },
      ],
    });
    const broken = await detail(ourMod, (a) => a.getUnnotifiedBonuses(CLIENT), { ...profile, "/api/v0/users/get_unnotified_bonuses": () => json(envelope({ nope: true })) });
    const brokenTheirs = await detail(stockMod, (a) => a.getUnnotifiedBonuses(CLIENT), { ...profile, "/api/v0/users/get_unnotified_bonuses": () => json(envelope({ nope: true })) });
    expect(broken).toEqual(brokenTheirs);
    expect(broken.thrown).toBe("PlatformAuthError: account: protocol [protocol]");
    expect(broken.records).toEqual([KEY]);
    const expired = await detail(ourMod, (a) => a.getUnnotifiedBonuses(CLIENT), { ...profile, "/api/v0/users/get_unnotified_bonuses": () => json({ code: 40003 }) });
    const expiredTheirs = await detail(stockMod, (a) => a.getUnnotifiedBonuses(CLIENT), { ...profile, "/api/v0/users/get_unnotified_bonuses": () => json({ code: 40003 }) });
    expect(expired).toEqual(expiredTheirs);
    expect(expired.result).toBeNull();
    expect(expired.records).toEqual([]);
    expect(expired.events).toEqual(["expired", "signed-out"]);
  });

  test("ackBonusNotified: đúng tài khoản → true; lệch tài khoản → false", async () => {
    const routes = { "/auth-api/v0/users/current": () => json(envelope(USER)), "/api/v0/users/ack_bonus_notified": () => json(envelope(null)) };
    const call = async (a: AccountLike): Promise<unknown> => [await a.ackBonusNotified("u1", ORDER_ID, CLIENT), await a.ackBonusNotified("u2", ORDER_ID, CLIENT)];
    const ours = await detail(ourMod, call, routes);
    const theirs = await detail(stockMod, call, routes);
    expect(ours).toEqual(theirs);
    expect(ours.result).toEqual([true, false]);
    expect(ours.records).toEqual([KEY]);
  });
});

describe("logout policy — retry / cạn lượt / bị huỷ, qua phương thức công khai", () => {
  test("signOut thử lại ĐÚNG maxRetries+1 lượt rồi cạn (grant đã gỡ cục bộ)", async () => {
    const ours = await logout(ourMod, Number.POSITIVE_INFINITY, 3);
    const theirs = await logout(stockMod, Number.POSITIVE_INFINITY, 3);
    expect(ours).toEqual(theirs);
    expect(ours.attempts).toBe(3);
    expect(ours.status).toBe("signed-out");
    expect(ours.records).toEqual([]);
    expect(ours.events).toEqual(["signed-out"]);
  });

  test("signOut dừng NGAY khi một lượt thành công (không thử lại thừa)", async () => {
    const ours = await logout(ourMod, 2, 2);
    const theirs = await logout(stockMod, 2, 2);
    expect(ours).toEqual(theirs);
    expect(ours.attempts).toBe(2);
  });

  test("tắt provider GIỮA hạn chờ → revoke dừng, dispose xong nhanh", async () => {
    const run = async (module: AccountModule): Promise<unknown> => {
      const world = signedIn(module, { logoutMaxRetries: 5, logoutRetryDelayMs: 5000 });
      let attempts = 0;
      stubFetch({ "/auth-api/v0/users/logout": () => {
        attempts += 1;
        return json({ code: 500 }, 500);
      } });
      const view = await world.account.signOut(CLIENT);
      const started = Date.now();
      await world.ctx.fiber.dispose();
      return { attempts, status: view.status, records: keys(world.records), quick: Date.now() - started < 1000 };
    };
    const ours = await run(ourMod);
    const theirs = await run(stockMod);
    expect(ours).toEqual(theirs);
    expect(ours).toEqual({ attempts: 1, status: "signed-out", records: [], quick: true });
  });
});

describe("C6 danh tính — vật thể trả về phải RIÊNG nhưng sâu bằng", () => {
  test("hai lượt getState: khác tham chiếu (kể cả links) nhưng toEqual; hai bản giống nhau", async () => {
    for (const module of [ourMod, stockMod]) {
      const world = signedIn(module);
      const first = await world.account.getState();
      const second = await world.account.getState();
      expect(second).not.toBe(first);
      expect(second).toEqual(first);
      expect(second.links).not.toBe(first.links);
      expect(second.links).toEqual(first.links);
    }
    const ourWorld = signedIn(ourMod);
    const theirWorld = signedIn(stockMod);
    expect(await ourWorld.account.getState()).toEqual(await theirWorld.account.getState());
    expect(await ourWorld.account.getState()).not.toBe(await theirWorld.account.getState());
  });
});

describe("vòng đời và token — Service.init · resolveToken · watch/rejectToken", () => {
  test("Service.init: grant cùng issuer được GIỮ; issuer lạ bị XOÁ; record hỏng → storage", async () => {
    const run = async (module: AccountModule, record: CredentialRecord): Promise<string> => {
      const world = rig(module, {}, [[KEY, record]]);
      stubFetch({});
      try {
        await runInit(world.account);
        return "ok:" + keys(world.records).join(",");
      } catch (error) {
        return errorText(error);
      }
    };
    const cases: CredentialRecord[] = [grantRecord(), grantRecord("https://evil.example"), { kind: "grant", payload: { version: 2 } }, { kind: "apikey", payload: {} }];
    for (const record of cases) {
      const ours = await run(ourMod, record);
      const theirs = await run(stockMod, record);
      expect(ours).toBe(theirs);
    }
    expect(await run(ourMod, grantRecord())).toBe("ok:" + KEY);
    expect(await run(ourMod, grantRecord("https://evil.example"))).toBe("ok:");
    expect(await run(ourMod, { kind: "grant", payload: { version: 2 } })).toBe("PlatformAuthError: account: storage [storage]");
  });

  test("resolveToken: chỉ cấp cho ĐÚNG inferenceOrigin; bỏ credential/mock; đăng xuất → undefined", async () => {
    const run = async (module: AccountModule): Promise<unknown> => {
      const world = signedIn(module);
      stubFetch({});
      return [
        await world.account.resolveToken("https://api.deepseek.com/v1/chat"),
        await world.account.resolveToken("https://evil.example/x"),
        await world.account.resolveToken("https://api.deepseek.com:8443/x"),
        await world.account.resolveToken("https://user:pw@api.deepseek.com/x"),
      ];
    };
    const ours = await run(ourMod);
    const theirs = await run(stockMod);
    expect(ours).toEqual(theirs);
    expect(ours).toEqual([GRANT_TOKEN, undefined, undefined, undefined]);
    const mockGrant: CredentialRecord = { kind: "grant", payload: { version: 1, token: "dsh_mock_abc", issuer: ORIGIN } };
    const mockOurs = await rig(ourMod, {}, [[KEY, mockGrant]]).account.resolveToken("https://api.deepseek.com/v1");
    const mockTheirs = await rig(stockMod, {}, [[KEY, mockGrant]]).account.resolveToken("https://api.deepseek.com/v1");
    expect(mockOurs).toBe(mockTheirs);
    expect(mockOurs).toBeUndefined();
  });

  test("watch trả ảnh chụp đầu tiên rồi kết thúc khi huỷ; rejectToken chỉ gỡ grant KHỚP token", async () => {
    const run = async (module: AccountModule): Promise<unknown> => {
      const world = signedIn(module);
      stubFetch({});
      const controller = new AbortController();
      const iterator = world.account.watch(controller.signal)[Symbol.asyncIterator]();
      const first = await iterator.next();
      controller.abort();
      const after = await iterator.next();
      await world.account.rejectToken("tok-khac");
      const kept = keys(world.records);
      await world.account.rejectToken(GRANT_TOKEN);
      return { first: shape(first.value), done: after.done === true, kept, after: keys(world.records), events: world.events };
    };
    const ours = await run(ourMod);
    const theirs = await run(stockMod);
    expect(ours).toEqual(theirs);
    expect(ours).toEqual({ first: shape(await signedIn(ourMod).account.getState()), done: true, kept: [KEY], after: [], events: ["expired", "signed-out"] });
  });
});

