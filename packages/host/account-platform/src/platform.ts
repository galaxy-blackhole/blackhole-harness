/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Provider tài khoản Platform (uỷ quyền qua trình duyệt bằng PKCE) — port 1:1 region index của
 *      @deepseek-ai/dsh-deepseek-account-platform: KEY/DEVICE, grant/device schema, Config (schemastery),
 *      và class PlatformAccount đầy đủ field/method.
 *      Export: Config · PlatformAccount.
 */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { arch, platform, release } from "node:os";
import { promises } from "node:stream";
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import { z } from "zod/v4";
import type { AuthorizationSession } from "@galaxy-blackhole/gbh-authorization";
import { credentialKey } from "@deepseek-ai/dsh-credentials";
import {
  DeepSeekAccount,
  installAccountTaskCancellation,
  mergePlatformCookies,
  platformClientHeaders,
  platformWireLocale,
} from "@deepseek-ai/dsh-deepseek-account";
import type {
  AccountBonusBatch,
  AccountBonusOrderId,
  AccountClientMetadata,
  AccountDetails,
  AccountUserId,
  AccountView,
  PlatformSession,
  SignInAttemptId,
  SignInAttemptView,
  SignInErrorCode,
} from "@deepseek-ai/dsh-deepseek-account";
import type { WebServer } from "@galaxy-blackhole/gbh-host-webserver";
import { deviceOsVersion, type AttemptViewState, type CachedProfile } from "./attempt.ts";
import type { LoginAttempt, PayloadRejection } from "./attempt.ts";
import { profile, readAccountDetail, readUnnotifiedBonuses, sendBonusNotified } from "./details.ts";
import { revokeAccount } from "./logout.ts";
import {
  AccountUnauthorizedError,
  PlatformAuthError,
  browserUrl,
  exchange,
  initialization,
  loginOrigin,
  platformHeaders,
  platformOrigin,
  requestPlatform,
} from "./protocol.ts";
import type { AccountToken, Config as ConfigShape, LogoutRetryPolicy, PlatformHeaders } from "./types.ts";
// 08/11/2026 (dev-1): tách phần khai báo dùng chung sang platform-support.ts để giữ luật ≤1000 dòng/tệp.
import { DEVICE, KEY, device, grant, seamOf, type AuthorizationLike, type Grant } from "./platform-support.ts";

/** Kiểu cấu hình deployment của provider (y bản gốc index.d.ts; khai gốc ở ./types.ts). */
export type Config = ConfigShape;

/** Lựa chọn deployment đã kiểm và đã điền mặc định (y bản gốc index.d.ts). */
export const Config = Schema.object({
  platformOrigin: Schema.string().default("https://platform.deepseek.com"),
  desktopPlatform: Schema.union([Schema.const("darwin"), Schema.const("win32"), Schema.const(null)]).default(null),
  embeddedPageDist: Schema.string().default(""),
  inferenceOrigin: Schema.string().default("https://api.deepseek.com"),
  allowLoopbackHttp: Schema.boolean().default(false),
  rewriteBrowserOrigin: Schema.boolean().default(false),
  requestHeaders: Schema.dict(Schema.string().role("secret")).default({}),
  accountRequestHeaders: Schema.dict(Schema.string().role("secret")).default({}),
  requestTimeoutMs: Schema.number().min(1).max(12e4).default(3e4),
  balanceTimeoutMs: Schema.number().min(1).max(12e4).default(3e4),
  logoutMaxRetries: Schema.number().min(0).max(5).step(1).default(5),
  logoutRetryDelayMs: Schema.number().min(1).max(6e4).default(1e3),
  attemptTimeoutMs: Schema.number().min(1).max(36e5).default(6e5),
});

/**
 * Provider tài khoản Platform dùng PKCE; trình duyệt phê duyệt KHÔNG bao giờ bỏ qua huỷ cục bộ.
 * Sở hữu trạng thái đăng nhập, grant opaque đã lưu, và vòng đời một lần thử.
 */
export class PlatformAccount extends DeepSeekAccount {
  /** Hai seam kernel mà provider này cần có trước khi chạy. */
  static inject = ["credentials", "authorization"];

  /** Schema cấu hình mà loader dùng để kiểm và điền mặc định. */
  static Config = Config;

  /** Origin Platform đã chuẩn hoá (auth-api + trang trình duyệt). */
  private readonly origin: string;

  /** Bộ chọn frontend deployment cho trang Usage/Top-up nhúng; rỗng là không nhúng. */
  private readonly embeddedPageDist: string;

  /** Origin HTTP(S) đúng được phép nhận token tài khoản cho suy luận và tệp. */
  private readonly inferenceOrigin: string;

  /** Ánh xạ trang uỷ quyền/hoàn tất về {@link origin} cho proxy phát triển nội bộ. */
  private readonly rewriteBrowserOrigin: boolean;

  /** Danh tính desktop gốc; null nhận client là web. */
  private readonly platform: "darwin" | "win32" | null;

  /** Header chỉ gửi tới {@link origin}. */
  private readonly requestHeaders: PlatformHeaders;

  /** Header cho hồ sơ, số dư và Platform nhúng (Cookie đã gộp theo tên). */
  private readonly accountRequestHeaders: PlatformHeaders;

  /** Hạn (mili giây) của mỗi request Platform. */
  private readonly requestTimeout: number;

  /** Hạn (mili giây) của truy vấn ví nạp. */
  private readonly balanceTimeout: number;

  /** Chặn trên (mili giây) cho trọn một lần thử cục bộ. */
  private readonly attemptTimeout: number;

  /** Chính sách thu hồi grant khi đăng xuất. */
  private readonly logoutPolicy: LogoutRetryPolicy;

  /** Đời sống của các request thu hồi nền; tắt provider là huỷ. */
  private readonly logoutLifetime = new AbortController();

  /** Các tác vụ nền (thu hồi grant, huỷ uỷ quyền) còn đang chạy. */
  private readonly revocations = new Set<Promise<void>>();

  /** Lần đăng nhập hiện tại (kể cả kết cục cuối) cho tới lần kế tiếp. */
  private attempt?: LoginAttempt;

  /** Listener của {@link watch}; nhận cờ "chỉ danh tính". */
  private readonly listeners = new Set<(identityOnly?: boolean) => void>();

  /** Hồ sơ ready gần nhất và token grant đã đọc nó, để danh tính cache không sống qua lần đổi credential. */
  private lastProfile?: CachedProfile;

  /** Đời sống của các truy vấn chi tiết; đổi credential là huỷ và thay mới. */
  private detailsLifetime = new AbortController();

  /** Đã tắt provider (đã chạy disposer của effect vòng đời). */
  private closed = false;

  /** Tác vụ gỡ credential đang chạy (chỉ một tại một thời điểm). */
  private removing?: Promise<AccountView>;

  /**
   * Dựng provider trên một Host có seam authorization và credentials.
   * Nhận: `ctx` là context sở hữu provider; `config` là lựa chọn deployment (mặc định rỗng). Trả: thực thể đã đăng ký flow, nghe credentials và đăng ký effect vòng đời.
   */
  /**
   * Seam authorization đọc qua CẤU TRÚC tại thời điểm dùng (ADR 000d); thiếu seam là lỗi cấu hình ⇒ nổ NGAY.
   * Nhận: không. Trả: seam authorization của kernel.
   */
  private get authorization(): AuthorizationLike {
    const seam = seamOf<AuthorizationLike>(this.ctx, "authorization");
    if (seam === undefined) throw new TypeError('account-platform requires the authorization seam (ctx.get("authorization"))');
    return seam;
  }

  constructor(ctx: Context, config: Config = {}) {
    super(ctx);
    installAccountTaskCancellation(ctx);
    const resolved = Config(config);
    this.embeddedPageDist = resolved.embeddedPageDist;
    this.origin = platformOrigin(resolved.platformOrigin, resolved.allowLoopbackHttp);
    const inference = new URL(resolved.inferenceOrigin);
    if (
      !["http:", "https:"].includes(inference.protocol) ||
      inference.username ||
      inference.password ||
      inference.pathname !== "/" ||
      inference.search ||
      inference.hash
    ) {
      throw new Error(
        "account: inferenceOrigin must be an HTTP(S) origin without credentials, path, query or fragment",
      );
    }
    this.inferenceOrigin = inference.origin;
    this.rewriteBrowserOrigin = resolved.rewriteBrowserOrigin;
    this.platform = resolved.desktopPlatform;
    this.requestHeaders = platformHeaders(resolved.requestHeaders);
    const accountHeaders = platformHeaders(resolved.accountRequestHeaders);
    this.accountRequestHeaders = { ...this.requestHeaders, ...accountHeaders };
    if (accountHeaders.cookie !== void 0) {
      this.accountRequestHeaders.cookie = mergePlatformCookies(this.requestHeaders.cookie ?? "", accountHeaders.cookie);
    }
    this.requestTimeout = resolved.requestTimeoutMs;
    this.balanceTimeout = resolved.balanceTimeoutMs;
    this.attemptTimeout = resolved.attemptTimeoutMs;
    this.logoutPolicy = {
      maxRetries: resolved.logoutMaxRetries,
      delayMs: resolved.logoutRetryDelayMs,
      requestTimeoutMs: this.requestTimeout,
    };
    this.authorization.registerFlow({
      key: KEY,
      label: "DeepSeek",
      methods: [{ id: "browser", label: "DeepSeek" }],
      run: (session) => {
        const attempt = this.attempt;
        if (attempt === void 0) return Promise.reject(new PlatformAuthError("protocol"));
        attempt.running = this.run(session, attempt);
        return attempt.running;
      },
    });
    ctx.on("credentials/record-updated", (key) => {
      if (key !== KEY) return;
      this.invalidateDetails();
      this.changed();
    });
    ctx.effect(() => async () => {
      this.closed = true;
      this.logoutLifetime.abort();
      this.invalidateDetails();
      const active = this.attempt;
      if (active !== void 0) {
        if (active.view.phase !== "committing") active.controller.abort();
        await active.done;
      }
      await this.removing;
      await Promise.all(this.revocations);
      this.changed();
    }, "account: active attempt lifetime");
  }

  /**
   * Khởi tạo service: bỏ grant đã lưu nếu issuer của nó không còn khớp origin hiện tại.
   * Nhận: không tham số (cordis gọi qua ký hiệu Service.init). Trả: xong khi credential lạ đã bị xoá; grant hỏng là lỗi storage.
   */
  async [Service.init](): Promise<void> {
    const record = await this.ctx.credentials.readRecord(KEY);
    if (record === void 0) return;
    if (record.kind !== "grant") throw new PlatformAuthError("storage");
    const parsed = grant.safeParse(record.payload);
    if (!parsed.success) throw new PlatformAuthError("storage");
    if (parsed.data.issuer === this.origin) return;
    await this.ctx.credentials.deleteRecord(KEY);
  }

  /**
   * Đọc sự hiện diện tài khoản đã lưu và lần đăng nhập gần nhất.
   * Nhận: không tham số. Trả: ảnh chụp KHÔNG kèm credential hay bí mật PKCE; record hỏng thì ném PlatformAuthError(storage).
   */
  override async getState(): Promise<AccountView> {
    const record = await this.ctx.credentials.readRecord(KEY);
    if (record !== void 0 && (record.kind !== "grant" || !grant.safeParse(record.payload).success)) {
      throw new PlatformAuthError("storage");
    }
    const attempt: SignInAttemptView | null = this.attempt?.view ?? null;
    return {
      status: record === void 0 ? "signed-out" : "credential-stored",
      attempt: record === void 0 && attempt?.phase === "succeeded" ? null : attempt,
      links: {
        usageUrl: new URL("/usage", this.origin).href,
        topUpUrl: new URL("/top_up", this.origin).href,
      },
    };
  }

  /**
   * Truy vấn hồ sơ Platform độc lập với số dư ví; danh tính đổi thì báo cho watch có bật danh tính.
   * Nhận: `client` là danh tính UI đang gọi. Trả: kết quả hồ sơ, hoặc null khi đã đăng xuất hay grant đổi giữa lúc truy vấn.
   */
  override async getProfile(client: AccountClientMetadata): Promise<AccountDetails["profile"] | null> {
    const lifetime = this.detailsLifetime;
    const stored = await this.readCurrentGrant(lifetime);
    if (stored === null || lifetime.signal.aborted) return null;
    const result = await this.getDetail("profile", this.detailHeaders(client), { lifetime, stored });
    if (this.detailsLifetime !== lifetime) return null;
    if (result !== null) this.cacheProfile(stored.token, result);
    if (result?.status !== "failed") return result;
    return (this.lastProfile?.token === stored.token ? this.lastProfile.profile : void 0) ?? result;
  }

  /**
   * Truy vấn số dư ví nạp thêm và ví bonus, độc lập với hồ sơ.
   * Nhận: `client` là danh tính UI đang gọi. Trả: kết quả số dư, hoặc null khi đã đăng xuất hay grant đổi giữa lúc truy vấn.
   */
  override getBalance(client: AccountClientMetadata): Promise<AccountDetails["balance"] | null> {
    return this.getDetail("balance", this.detailHeaders(client));
  }

  /**
   * Truy vấn các bonus đã cấp mà Platform chưa ghi nhận là đã hiển thị.
   * Nhận: `client` là danh tính UI đang gọi (ngôn ngữ chọn câu chữ do server viết). Trả: bonus kèm tài khoản, hoặc null khi đã đăng xuất hay grant đổi.
   */
  override async getUnnotifiedBonuses(client: AccountClientMetadata): Promise<AccountBonusBatch | null> {
    const lifetime = this.detailsLifetime;
    const headers = this.detailHeaders(client);
    const stored = await this.readCurrentGrant(lifetime);
    if (stored === null) return null;
    const accountId = await this.currentAccountId(lifetime, stored, headers);
    if (accountId === null) return null;
    try {
      return {
        accountId,
        bonuses: await readUnnotifiedBonuses(
          this.origin,
          stored.token,
          AbortSignal.any([lifetime.signal, AbortSignal.timeout(this.requestTimeout)]),
          headers,
        ),
      };
    } catch (error) {
      if (error instanceof AccountUnauthorizedError) {
        if (this.detailsLifetime === lifetime) await this.expireCredential(stored.token, lifetime);
        return null;
      }
      throw error;
    }
  }

  /**
   * Ghi nhận MỘT bonus đã hiển thị là đã báo, cho đúng tài khoản sở hữu nó.
   * Nhận: `accountId` là tài khoản mà thông báo được đọc cho; `orderId` là đơn bonus người dùng đã thấy; `client` là danh tính UI. Trả: true khi Platform đã ghi nhận; false khi đã đăng xuất hoặc tài khoản đã đổi.
   */
  override async ackBonusNotified(
    accountId: AccountUserId,
    orderId: AccountBonusOrderId,
    client: AccountClientMetadata,
  ): Promise<boolean> {
    const lifetime = this.detailsLifetime;
    const headers = this.detailHeaders(client);
    const stored = await this.readCurrentGrant(lifetime);
    if (stored === null) return false;
    const current = await this.currentAccountId(lifetime, stored, headers);
    if (current === null || current !== accountId) return false;
    try {
      await sendBonusNotified(
        this.origin,
        stored.token,
        orderId,
        AbortSignal.any([lifetime.signal, AbortSignal.timeout(this.requestTimeout)]),
        headers,
      );
      return true;
    } catch (error) {
      if (error instanceof AccountUnauthorizedError) {
        if (this.detailsLifetime === lifetime) await this.expireCredential(stored.token, lifetime);
        return false;
      }
      throw error;
    }
  }

  /**
   * Quy danh tính hồ sơ về đúng grant đã bắt, trong đời sống credential của grant đó.
   * Nhận: `lifetime` là đời sống credential lúc bắt grant; `stored` là grant đã bắt (KHÔNG đọc lại credential mới hơn); `headers` là header danh tính client. Trả: danh tính tài khoản, hoặc null khi đã đăng xuất hay credential đã đổi.
   */
  private async currentAccountId(
    lifetime: AbortController,
    stored: Grant,
    headers: PlatformHeaders,
  ): Promise<AccountUserId | null> {
    if (this.lastProfile?.token === stored.token) return this.identityOf(this.lastProfile.profile);
    const details = await this.getDetail("profile", headers, { lifetime, stored });
    if (details === null) return null;
    if (details.status === "failed") throw new PlatformAuthError("network");
    this.cacheProfile(stored.token, details);
    return this.identityOf(details);
  }

  /**
   * Cache một hồ sơ ready theo đúng token grant đã đọc nó; ID ổn định lần đầu xuất hiện hay đổi thì báo watch có bật danh tính, ID lặp lại thì im lặng.
   * Nhận: `token` là grant mà hồ sơ được đọc bằng; `profile` là kết cục cần ghi khi nó mang dữ liệu. Trả: không.
   */
  private cacheProfile(token: string, profile: AccountDetails["profile"]): void {
    if (profile.status !== "ready") return;
    const previous = this.lastProfile?.profile.value.id || null;
    this.lastProfile = { token, profile };
    if (previous !== (profile.value.id || null)) this.changed(true);
  }

  /**
   * Lấy danh tính tài khoản mà một hồ sơ ready nêu ra.
   * Nhận: `profile` là hồ sơ đã chiếu cho UI. Trả: danh tính tài khoản; hồ sơ không có id ổn định thì ném PlatformAuthError(protocol).
   */
  private identityOf(profile: Extract<AccountDetails["profile"], { status: "ready" }>): AccountUserId {
    if (profile.value.id === null) throw new PlatformAuthError("protocol");
    return profile.value.id;
  }

  /**
   * Đọc MỘT trường chi tiết trong đời sống credential đã chọn; bị từ chối thì xoá credential.
   * Nhận: `field` là profile hoặc balance; `headers` là header danh tính client; `captured` là grant/đời sống đã bắt (bỏ trống thì đọc credential hiện tại). Trả: kết quả đã làm sạch, hoặc null khi đã đăng xuất, credential đổi, hay bị từ chối.
   */
  private async getDetail<K extends keyof AccountDetails>(
    field: K,
    headers: PlatformHeaders,
    captured?: { lifetime: AbortController; stored: Grant },
  ): Promise<AccountDetails[K] | null> {
    const lifetime = captured?.lifetime ?? this.detailsLifetime;
    const stored = captured?.stored ?? (await this.readCurrentGrant(lifetime));
    if (stored === null || lifetime.signal.aborted) return null;
    const pending = this.attempt?.initialProfile;
    if (field === "profile" && pending?.token === stored.token) {
      if (this.attempt !== void 0) delete this.attempt.initialProfile;
      return pending.value as AccountDetails[K];
    }
    try {
      const details = await readAccountDetail(
        field,
        this.origin,
        stored.token,
        AbortSignal.any([
          lifetime.signal,
          AbortSignal.timeout(field === "balance" ? this.balanceTimeout : this.requestTimeout),
        ]),
        headers,
      );
      return this.detailsLifetime !== lifetime ? null : details;
    } catch {
      if (this.detailsLifetime === lifetime) await this.expireCredential(stored.token, lifetime);
      return null;
    }
  }

  /**
   * Bộ header tài khoản của deployment cộng header danh tính client suy từ metadata một lần gọi.
   * Nhận: `client` là danh tính UI đang gọi. Trả: header đã gộp (không chứa token grant).
   */
  private detailHeaders(client: AccountClientMetadata): PlatformHeaders {
    return {
      ...this.accountRequestHeaders,
      ...platformClientHeaders(this.platform, client),
    };
  }

  /**
   * Gỡ credential nếu token bị suy luận từ chối vẫn còn là grant đang lưu.
   * Nhận: `token` là token mà request suy luận đã mang. Trả: xong sau khi credential khớp bị gỡ (không khớp thì không làm gì).
   */
  override async rejectToken(token: string): Promise<void> {
    const lifetime = this.detailsLifetime;
    if ((await this.readCurrentGrant(lifetime))?.token !== token || this.detailsLifetime !== lifetime) return;
    await this.expireCredential(token, lifetime);
  }

  /**
   * Gỡ credential đã hết hạn/đổi, phát hai sự kiện tài khoản rồi báo watch (chỉ một tác vụ gỡ tại một thời điểm).
   * Nhận: `token` là token cần khớp trước khi gỡ; `lifetime` là đời sống đã bắt grant. Trả: xong khi trạng thái đã đọc lại.
   */
  private async expireCredential(token: AccountToken, lifetime: AbortController): Promise<void> {
    this.removing ??= (async (): Promise<AccountView> => {
      if (this.attempt !== void 0) await this.cancelSignIn(this.attempt.view.id);
      const record = await this.ctx.credentials.readRecord(KEY);
      if (this.closed || this.detailsLifetime !== lifetime || record?.kind !== "grant") return this.getState();
      const current = grant.parse(record.payload);
      if (current.token !== token || current.issuer !== this.origin) return this.getState();
      await this.ctx.credentials.deleteRecord(KEY);
      this.ctx.emit("deepseek-account/session-expired");
      this.attempt = void 0;
      this.ctx.emit("deepseek-account/signed-out");
      this.changed();
      return this.getState();
    })().finally(() => {
      this.removing = void 0;
    });
    await this.removing;
  }

  /**
   * Đọc danh tính thiết bị đã lưu mà KHÔNG tạo thiết bị mới và KHÔNG trả credential.
   * Nhận: không tham số. Trả: deviceId (nếu có), userId của phiên (nếu có) và chuỗi phiên bản hệ điều hành.
   */
  override async getDeviceIdentity(): Promise<{
    deviceId?: string;
    userId?: AccountUserId;
    osVersion: string;
  }> {
    const [record, session] = await Promise.all([
      this.ctx.credentials.readRecord(DEVICE),
      this.getPlatformSession(),
    ]);
    const parsed = record?.kind === "grant" ? device.safeParse(record.payload) : void 0;
    return {
      ...(parsed?.success ? { deviceId: parsed.data.id } : {}),
      ...(session?.userId == null ? {} : { userId: session.userId }),
      osVersion: deviceOsVersion(),
    };
  }

  /**
   * Đọc credential cho origin Platform đã cấu hình, kèm danh tính đã cache; KHÔNG gọi request hồ sơ.
   * Nhận: không tham số. Trả: ảnh chụp Host-only, hoặc null khi đã đăng xuất hay credential đổi giữa lúc đọc.
   */
  override async getPlatformSession(): Promise<PlatformSession | null> {
    const lifetime = this.detailsLifetime;
    const stored = await this.readCurrentGrant(lifetime);
    if (stored === null || lifetime.signal.aborted) return null;
    const requestHeaders: PlatformHeaders = { ...this.accountRequestHeaders };
    return {
      origin: this.origin,
      token: stored.token,
      userId: this.lastProfile?.token === stored.token ? this.lastProfile.profile.value.id || null : null,
      ...(this.embeddedPageDist ? { embeddedPageDist: this.embeddedPageDist } : {}),
      requestHeaders,
    };
  }

  /**
   * Đọc grant đang lưu và kiểm nó thuộc đúng origin này.
   * Nhận: `lifetime` là đời sống credential mà lần đọc phải còn hiệu lực. Trả: grant đã kiểm, hoặc null khi đã tắt provider/đăng xuất/credential đổi; record hỏng ném storage, issuer lạ ném protocol.
   */
  private async readCurrentGrant(lifetime: AbortController): Promise<Grant | null> {
    if (this.closed) return null;
    const record = await this.ctx.credentials.readRecord(KEY);
    if (record === void 0 || lifetime.signal.aborted) return null;
    if (record.kind !== "grant") throw new PlatformAuthError("storage");
    const parsed = grant.safeParse(record.payload);
    if (!parsed.success) throw new PlatformAuthError("storage");
    if (parsed.data.issuer !== this.origin) throw new PlatformAuthError("protocol");
    return parsed.data;
  }

  /**
   * Cấp token grant cho đúng origin suy luận mà provider cho phép.
   * Nhận: `url` là đích request thật hoặc base URL của API. Trả: token đã lưu, hoặc undefined cho origin khác hay tài khoản đã đăng xuất.
   */
  override async resolveToken(url: string): Promise<string | undefined> {
    if (this.closed || this.removing !== void 0) return void 0;
    const destination = new URL(url);
    if (destination.origin !== this.inferenceOrigin || destination.username || destination.password) return void 0;
    const record = await this.ctx.credentials.readRecord(KEY);
    if (record === void 0) return void 0;
    if (record.kind !== "grant") throw new PlatformAuthError("storage");
    const result = grant.safeParse(record.payload);
    if (!result.success) throw new PlatformAuthError("storage");
    const issuer = new URL(result.data.issuer);
    if (result.data.token.startsWith("dsh_mock_")) return void 0;
    if (this.inferenceOrigin === "https://api.deepseek.com") {
      if (["localhost", "127.0.0.1", "[::1]"].includes(issuer.hostname)) return void 0;
    } else if (issuer.origin !== this.origin) return void 0;
    return result.data.token;
  }

  /**
   * Tham gia một lần thử đang chạy hoặc bắt đầu uỷ quyền qua trình duyệt bằng PKCE.
   * Nhận: `client` là danh tính UI khởi xướng; `callbackOrigin` là origin loopback trình duyệt truy cập được (kể cả cổng SSH); `loginSource` là UI khởi xướng. Trả: ảnh chụp ban đầu, KHÔNG chờ người dùng phê duyệt.
   */
  override async startSignIn(
    client: AccountClientMetadata,
    callbackOrigin: string,
    loginSource: "web" | "desktop",
  ): Promise<AccountView> {
    if (this.removing !== void 0) await this.removing;
    const origin = loginOrigin(callbackOrigin);
    if (this.closed) throw new PlatformAuthError("protocol");
    if (
      this.attempt !== void 0 &&
      ["initializing", "waiting-browser", "exchanging", "committing"].includes(this.attempt.view.phase)
    ) {
      return this.getState();
    }
    const previous = this.attempt;
    if (previous !== void 0) {
      await previous.done;
      if (this.closed) throw new PlatformAuthError("protocol");
      if (this.attempt !== previous) return this.getState();
    }
    const attempt: LoginAttempt = {
      origin,
      loginSource,
      locale: platformWireLocale(client.locale),
      clientHeaders: platformClientHeaders(this.platform, client),
      view: {
        id: randomUUID() as SignInAttemptId,
        phase: "initializing",
      },
      controller: new AbortController(),
      done: Promise.resolve(),
      running: Promise.resolve(),
    };
    this.attempt = attempt;
    attempt.done = this.authorization
      .begin({
        key: KEY,
        signal: attempt.controller.signal,
        interaction: {
          notify: () => void 0,
          prompt: () => Promise.reject(new PlatformAuthError("protocol")),
        },
      })
      .then((outcome) => {
        this.update(attempt, { phase: outcome.status === "authorized" ? "succeeded" : "cancelled" });
        if (outcome.status === "authorized" && attempt.completionUrl !== void 0) {
          attempt.callback?.writeHead(302, {
            location: attempt.completionUrl,
            "cache-control": "no-store",
          }).end();
        } else attempt.callback?.writeHead(204, { "cache-control": "no-store" }).end();
      })
      .catch((error: unknown) => {
        const code: SignInErrorCode = error instanceof PlatformAuthError ? error.code : "protocol";
        console.error("[deepseek-account] sign-in failed", { errorCode: code });
        this.update(attempt, {
          phase: code === "expired" ? "expired" : "failed",
          errorCode: code,
        });
        this.finishFailedCallback(attempt);
      })
      .then(async () => {
        await attempt.running.catch(() => void 0);
        if (attempt.callback !== void 0) await promises.finished(attempt.callback, { cleanup: true }).catch(() => void 0);
        await attempt.disposeCallback?.();
      });
    this.changed();
    return this.getState();
  }

  /**
   * Huỷ ĐÚNG lần thử được nêu tên; lần thử đang committing thì chờ nó kết thúc.
   * Nhận: `id` là danh tính lần thử do Host này sinh. Trả: trạng thái sau khi huỷ (hoặc sau khi commit đã bắt đầu).
   */
  override async cancelSignIn(id: SignInAttemptId): Promise<AccountView> {
    const attempt = this.attempt;
    if (attempt?.view.id === id) {
      if (attempt.view.phase !== "committing") {
        attempt.controller.abort();
        this.authorization.cancel(KEY);
      }
      await attempt.done;
    }
    return this.getState();
  }

  /**
   * Gỡ grant cục bộ nhưng GIỮ API key; provider thu hồi grant ở nền.
   * Nhận: `client` là danh tính UI đang gọi, được chốt cho các lần thu hồi nền. Trả: trạng thái đã đăng xuất sau khi gỡ cục bộ; hỏng phía xa không khôi phục grant.
   */
  override signOut(client: AccountClientMetadata): Promise<AccountView> {
    this.removing ??= (async (): Promise<AccountView> => {
      if (this.closed) throw new PlatformAuthError("protocol");
      if (this.attempt !== void 0) await this.cancelSignIn(this.attempt.view.id);
      const record = await this.ctx.credentials.readRecord(KEY);
      if (record !== void 0) {
        if (record.kind !== "grant") throw new PlatformAuthError("storage");
        const parsed = grant.safeParse(record.payload);
        if (!parsed.success) throw new PlatformAuthError("storage");
        if (parsed.data.issuer !== this.origin) throw new PlatformAuthError("protocol");
        await this.ctx.credentials.deleteRecord(KEY);
        this.revoke(parsed.data.token, platformClientHeaders(this.platform, client));
      }
      this.attempt = void 0;
      this.ctx.emit("deepseek-account/signed-out");
      this.changed();
      return this.getState();
    })().finally(() => {
      this.removing = void 0;
    });
    return this.removing;
  }

  /**
   * Đăng ký nhận ảnh chụp trạng thái, kể cả ảnh chụp đầu tiên đầy đủ.
   * Nhận: `signal` là đời sống đăng ký (kết thúc KHÔNG huỷ đăng nhập); `includeIdentityChanges` là có báo khi danh tính cache đổi hay không. Trả: các ảnh chụp đầy đủ mỗi khi trạng thái tài khoản đổi.
   */
  override async *watch(signal: AbortSignal, includeIdentityChanges = false): AsyncIterable<AccountView> {
    let dirty = true;
    let wake: (() => void) | undefined;
    const wakeUp = () => {
      dirty = true;
      wake?.();
    };
    const changed = (identityOnly?: boolean) => {
      if (!identityOnly || includeIdentityChanges) wakeUp();
    };
    this.listeners.add(changed);
    signal.addEventListener("abort", wakeUp, { once: true });
    try {
      while (!this.closed && !signal.aborted) {
        if (dirty) {
          dirty = false;
          yield await this.getState();
          continue;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    } finally {
      this.listeners.delete(changed);
      signal.removeEventListener("abort", wakeUp);
    }
  }

  /**
   * Thu hồi một token đã gỡ trong NỀN, có chặn số lần và hạn chờ.
   * Nhận: `token` là grant đã gỡ; `headers` là header danh tính client của lần đăng xuất. Trả: không (tác vụ nền giữ trong revocations tới khi xong).
   */
  private revoke(token: AccountToken, headers: PlatformHeaders): void {
    if (this.closed) return;
    const revocation = revokeAccount(this.origin, token, this.logoutPolicy, this.logoutLifetime.signal, {
      ...this.requestHeaders,
      ...headers,
    }).finally(() => {
      this.revocations.delete(revocation);
    });
    this.revocations.add(revocation);
  }

  /**
   * Bỏ toàn bộ chi tiết đã cache và mở đời sống credential mới.
   * Nhận: không tham số. Trả: không.
   */
  private invalidateDetails(): void {
    this.lastProfile = void 0;
    this.detailsLifetime.abort();
    this.detailsLifetime = new AbortController();
  }

  /**
   * Báo cho mọi listener của watch.
   * Nhận: `identityOnly` là chỉ báo khi listener có bật thay đổi danh tính. Trả: không.
   */
  private changed(identityOnly = false): void {
    for (const listener of this.listeners) listener(identityOnly);
  }

  /**
   * Cập nhật ảnh chụp một lần thử (bỏ URL uỷ quyền cũ trước khi gộp giá trị mới) rồi báo watch.
   * Nhận: `attempt` là lần thử cần sửa; `value` là các trường thay đổi. Trả: không.
   */
  private update(attempt: LoginAttempt, value: Partial<AttemptViewState>): void {
    const { authorizeUrl: _url, ...rest } = attempt.view;
    attempt.view = { ...rest, ...value };
    this.changed();
  }

  /**
   * Thân flow uỷ quyền: đăng ký route callback, xin authorization URL, chờ mã, exchange, rồi commit grant.
   * Nhận: `session` là phiên uỷ quyền (method, signal, commit); `attempt` là lần thử đang chạy. Trả: xong khi grant đã commit vào credentials; hết hạn ném PlatformAuthError(expired), hỏng khác ném protocol/storage.
   */
  private async run(session: AuthorizationSession, attempt: LoginAttempt): Promise<void> {
    const webServer: WebServer | undefined = this.ctx.get("webServer");
    if (webServer === void 0) throw new PlatformAuthError("protocol");
    const verifier = randomBytes(32).toString("base64url");
    const state = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    let authorizeId: string | undefined;
    const code = Promise.withResolvers<string>();
    code.promise.catch(() => void 0);
    const deadline = new AbortController();
    let expiresAt = Date.now() + this.attemptTimeout;
    const signal = AbortSignal.any([session.signal, deadline.signal]);
    let timer = setTimeout(() => {
      deadline.abort();
    }, this.attemptTimeout);
    const abort = () => {
      code.reject(new PlatformAuthError("expired"));
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      attempt.disposeCallback = this.ctx.effect(
        () =>
          webServer.register({
            kind: "exact",
            path: "/oauth/callback",
            handler: (req, res) => {
              let url: URL;
              try {
                url = new URL(req.url ?? "/", "http://127.0.0.1");
              } catch {
                res.writeHead(400, { "cache-control": "no-store" }).end();
                return;
              }
              const receivedCode = url.searchParams.get("code");
              const receivedState = url.searchParams.get("state") ?? "";
              const validState =
                Buffer.byteLength(receivedState) === Buffer.byteLength(state) &&
                timingSafeEqual(Buffer.from(receivedState), Buffer.from(state));
              if (
                req.method !== "GET" ||
                url.pathname !== "/oauth/callback" ||
                !validState ||
                !receivedCode ||
                url.searchParams.getAll("state").length !== 1 ||
                url.searchParams.getAll("code").length !== 1
              ) {
                res.writeHead(400, { "cache-control": "no-store" }).end();
                return;
              }
              if (signal.aborted || attempt.callback !== void 0 || attempt.view.phase !== "waiting-browser") {
                res.writeHead(410, { "cache-control": "no-store" }).end();
                return;
              }
              attempt.callback = res;
              code.resolve(receivedCode);
            },
          }),
        "account: browser callback",
      );
      signal.throwIfAborted();
      const redirectUri = `${attempt.origin}/oauth/callback`;
      const init = initialization.safeParse(
        await this.request(
          "auth_init",
          {
            code_challenge: challenge,
            code_challenge_method: "S256",
            state,
            redirect_uri: redirectUri,
            locale: attempt.locale,
            login_source: attempt.loginSource,
          },
          signal,
          attempt.clientHeaders,
        ),
        { reportInput: true },
      );
      if (!init.success) this.rejectPayload("auth_init", init.error);
      const authorizeUrl = browserUrl(init.data.authorize_url, this.origin, "/dsh/authorize", this.rewriteBrowserOrigin);
      authorizeId = init.data.authorize_id;
      signal.throwIfAborted();
      const now = Date.now();
      expiresAt = Math.min(expiresAt, now + init.data.expires_in * 1e3);
      const remaining = expiresAt - now;
      if (remaining <= 0) {
        deadline.abort();
        signal.throwIfAborted();
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        deadline.abort();
      }, remaining);
      this.update(attempt, {
        phase: "waiting-browser",
        authorizeUrl,
        expiresAt,
      });
      const receivedCode = await code.promise;
      signal.throwIfAborted();
      this.update(attempt, { phase: "exchanging" });
      const deviceRecord = await this.ctx.credentials.modifyRecord(DEVICE, (current) =>
        Promise.resolve(
          current === void 0 ? ({ kind: "grant", payload: { id: randomUUID() } } as const) : void 0,
        ),
      );
      if (deviceRecord?.kind !== "grant") throw new PlatformAuthError("storage");
      const identity = device.parse(deviceRecord.payload);
      const result = exchange.safeParse(
        await this.request(
          "auth_exchange",
          {
            code: receivedCode,
            code_verifier: verifier,
            redirect_uri: redirectUri,
            device_id: identity.id,
            device_model: `${platform()}-${arch()}`,
            os_version: deviceOsVersion(),
          },
          signal,
          attempt.clientHeaders,
        ),
        { reportInput: true },
      );
      if (!result.success) this.rejectPayload("auth_exchange", result.error);
      const completionUrl = new URL(
        browserUrl(result.data.authorized_url, this.origin, "/dsh/authorized", this.rewriteBrowserOrigin),
      );
      completionUrl.searchParams.set("login_source", attempt.loginSource);
      attempt.completionUrl = completionUrl.href;
      if (Date.now() >= expiresAt) deadline.abort();
      signal.throwIfAborted();
      if (result.data.user != null) {
        try {
          attempt.initialProfile = {
            token: result.data.token,
            value: {
              status: "ready",
              value: profile(result.data.user),
            },
          };
        } catch {
          // Hồ sơ trong phản hồi exchange chỉ là tối ưu hoá; payload lạ thì bỏ qua và đọc sau.
        }
      }
      this.update(attempt, { phase: "committing" });
      clearTimeout(timer);
      try {
        await session.commit({
          kind: "grant",
          payload: {
            version: 1,
            token: result.data.token,
            issuer: this.origin,
          },
        });
      } catch {
        throw new PlatformAuthError("storage");
      }
    } catch (error) {
      if (deadline.signal.aborted) throw new PlatformAuthError("expired");
      throw error;
    } finally {
      if (signal.aborted && authorizeId !== void 0) this.cancelRequest(authorizeId, verifier, attempt.clientHeaders);
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  }

  /**
   * Ghi chẩn đoán không bí mật cho một payload bị schema từ chối rồi ném lỗi giao thức.
   * Nhận: `stage` là tên bước giao thức; `error` là lỗi kiểm schema (chỉ cần issues). Trả: không trả (luôn ném PlatformAuthError(protocol)).
   */
  private rejectPayload(stage: string, error: PayloadRejection): never {
    console.error("[deepseek-account] payload rejected", {
      stage,
      issues: error.issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        receivedType: issue.input === null ? "null" : Array.isArray(issue.input) ? "array" : typeof issue.input,
      })),
    });
    throw new PlatformAuthError("protocol");
  }

  /**
   * Huỷ một uỷ quyền phía Platform trong nền (không chặn kết quả của lần thử).
   * Nhận: `authorizeId` là id uỷ quyền đã cấp; `verifier` là PKCE verifier của lần thử; `headers` là header danh tính client đã chốt. Trả: không (tác vụ nền giữ trong revocations).
   */
  private cancelRequest(authorizeId: string, verifier: string, headers: PlatformHeaders): void {
    if (this.closed) return;
    const cancellation = this.request(
      "auth_cancel",
      {
        authorize_id: authorizeId,
        code_verifier: verifier,
      },
      this.logoutLifetime.signal,
      headers,
    )
      .then(
        () => void 0,
        () => {},
      )
      .finally(() => {
        this.revocations.delete(cancellation);
      });
    this.revocations.add(cancellation);
  }

  /**
   * Gọi một endpoint giao thức Platform với hạn request và header deployment đã cấu hình.
   * Nhận: `method` là hậu tố endpoint; `body` là thân giao thức (không ghi log); `signal` là huỷ của lần thử; `headers` là header danh tính client. Trả: biz_data thành công, chưa kiểm schema.
   */
  private request(
    method: string,
    body: unknown,
    signal: AbortSignal,
    headers: PlatformHeaders,
  ): Promise<unknown> {
    return requestPlatform(
      this.origin,
      method,
      body,
      AbortSignal.any([signal, AbortSignal.timeout(this.requestTimeout)]),
      {
        ...this.requestHeaders,
        ...headers,
      },
    );
  }

  /**
   * Trả trang lỗi thân thiện cho tab đăng nhập web; nguồn khác thì đóng bằng 204.
   * Nhận: `attempt` là lần thử đã hỏng (locale và loginSource quyết định nội dung). Trả: không.
   */
  private finishFailedCallback(attempt: LoginAttempt): void {
    if (attempt.loginSource === "web") {
      const nonce = randomBytes(16).toString("base64url");
      const message =
        attempt.locale === "zh_CN"
          ? "登录失败，请关闭此标签页并在原页面重试。"
          : "Sign-in failed. Close this tab and try again in the original tab.";
      attempt.callback
        ?.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
          "referrer-policy": "no-referrer",
        })
        .end(
          `<!doctype html><html lang="${attempt.locale === "zh_CN" ? "zh-CN" : "en"}"><meta charset="utf-8"><title>${message}</title><body><p>${message}</p><script nonce="${nonce}">window.close()<\/script></body></html>`,
        );
    } else attempt.callback?.writeHead(204, { "cache-control": "no-store" }).end();
  }
}