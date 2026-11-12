/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Đường truyền HTTP của Platform: lỗi giao thức an toàn, kiểm origin/đích trình duyệt, header deployment,
 *      schema envelope–initialization–exchange, bốn lời gọi tài khoản, logout, và origin đăng nhập loopback.
 *      Export: PlatformAuthError · AccountUnauthorizedError · platformOrigin · browserUrl · platformHeaders ·
 *      initialization · exchange · requestPlatform · requestAccount · requestUnnotifiedBonuses ·
 *      requestBonusNotified · logoutAccount · loginOrigin.
 */

import type { AccountBonusOrderId, SignInErrorCode } from "@deepseek-ai/dsh-deepseek-account/types";
import { z } from "zod/v4";
import type { AccountDetailPath, AccountToken, PlatformHeaders } from "./types.ts";

/** Lỗi giao thức Platform phơi một mã ổn định, KHÔNG bao giờ kèm thân phản hồi hay URL uỷ quyền. */
export class PlatformAuthError extends Error {
  readonly code: SignInErrorCode;

  /**
   * Tạo lỗi giao thức với mã an toàn.
   * Nhận: `code` là phân loại hỏng an toàn (thuộc `SignInErrorCode`).
   * Trả: thực thể lỗi có thông điệp `account: <code>`.
   */
  constructor(code: SignInErrorCode) {
    super(`account: ${code}`);
    this.code = code;
  }
}

/** Một request Platform ĐÃ xác thực bị từ chối bằng HTTP 401 hoặc mã 40003. */
export class AccountUnauthorizedError extends PlatformAuthError {
  /**
   * Tạo lỗi hết hạn cho grant đang lưu.
   * Nhận: không tham số.
   * Trả: thực thể lỗi với mã `expired`.
   */
  constructor() {
    super("expired");
  }
}

/**
 * Chuẩn hoá origin Platform: nhận HTTPS, hoặc HTTP loopback khi deployment bật rõ ràng.
 * Nhận: `value` là origin đã cấu hình; `allowLoopbackHttp` là cờ opt-in chỉ dành cho phát triển.
 * Trả: origin đã chuẩn hoá, không còn user/path/query/fragment.
 * @throws Error khi origin không phải HTTPS (hoặc loopback HTTP được bật) hay còn phần thừa.
 */
export function platformOrigin(value: string, allowLoopbackHttp: boolean): string {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(url.protocol === "https:" || (allowLoopbackHttp && loopback && url.protocol === "http:"))
  ) {
    throw new Error("account: platformOrigin must be an HTTPS origin or explicitly enabled loopback HTTP origin");
  }
  return url.origin;
}

/**
 * Kiểm đích trình duyệt do Platform trả về, không chuyển tiếp URL tuỳ ý.
 * Nhận: `value` là URL trình duyệt; `origin` là origin Platform đã cấu hình; `path` là đường dẫn cố định
 * (uỷ quyền hoặc hoàn tất); `rewriteOrigin` ánh xạ trang đã kiểm về origin phát triển đã cấu hình.
 * Trả: URL đã chuẩn hoá trên origin đã cấu hình.
 * @throws PlatformAuthError("protocol") khi URL hỏng, sai origin, sai đường dẫn, có user hoặc fragment.
 */
export function browserUrl(value: string, origin: string, path: string, rewriteOrigin = false): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    console.error("[deepseek-account] browser URL rejected", { path, reason: "invalid-url" });
    throw new PlatformAuthError("protocol");
  }
  const allowedOrigin = url.origin === origin || (rewriteOrigin && url.protocol === "https:");
  if (!allowedOrigin || url.pathname !== path || url.username || url.password || url.hash) {
    console.error("[deepseek-account] browser URL rejected", {
      path,
      originMismatch: !allowedOrigin,
      pathMismatch: url.pathname !== path,
      hasCredentials: Boolean(url.username || url.password),
      hasFragment: Boolean(url.hash),
    });
    throw new PlatformAuthError("protocol");
  }
  return rewriteOrigin ? `${origin}${url.pathname}${url.search}` : url.href;
}

/**
 * Kiểm bộ header deployment chỉ dành cho Host mà không phơi giá trị trong chẩn đoán.
 * Nhận: `values` là header đã cấu hình cho origin Platform.
 * Trả: header đã chuẩn hoá; uỷ quyền, định tuyến và đóng khung vẫn thuộc provider.
 * @throws Error khi gặp tên dành riêng, tên trùng, hoặc giá trị header không hợp lệ.
 */
export function platformHeaders(values: PlatformHeaders): PlatformHeaders {
  const headers = new Headers();
  const names = new Set<string>();
  for (const [name, value] of Object.entries(values)) {
    const key = name.toLowerCase();
    if (
      [
        "authorization",
        "x-dsh-auth-token",
        "host",
        "content-length",
        "transfer-encoding",
        "connection",
        "content-type",
      ].includes(key) ||
      names.has(key)
    ) {
      throw new Error("account: requestHeaders contains a reserved or duplicate header");
    }
    names.add(key);
    try {
      headers.set(name, value);
    } catch {
      throw new Error("account: requestHeaders contains an invalid header");
    }
  }
  return Object.fromEntries(headers);
}

const envelope = z.object({
  code: z.literal(0),
  data: z.object({ biz_code: z.number().int(), biz_data: z.unknown() }),
});

/** Phản hồi khởi tạo thành công. */
export const initialization = z.object({
  authorize_url: z.url(),
  authorize_id: z.string().min(1),
  expires_in: z.number().positive(),
});

/** Phản hồi đổi mã uỷ quyền thành công. */
export const exchange = z.object({
  token: z.string().regex(/^[\x21-\x7e]+$/),
  authorized_url: z.url(),
  user: z.unknown().optional(),
});

/**
 * Đọc MỘT phản hồi Platform có chặn kích thước; hỏng ngoài trường hợp huỷ của bên gọi thì ghi chẩn đoán
 * không bí mật ra stderr.
 * Nhận: `origin` là origin Platform đã kiểm; `method` là hậu tố endpoint; `body` là thân giao thức
 * (không bao giờ ghi log); `signal` là huỷ/hết hạn của lần thử; `headers` là header deployment của origin.
 * Trả: `biz_data` thành công, chưa kiểm schema (bên gọi kiểm).
 */
export async function requestPlatform(
  origin: string,
  method: string,
  body: unknown,
  signal: AbortSignal,
  headers: PlatformHeaders,
): Promise<unknown> {
  return platformRequest(`${origin}/auth-api/v0/dsh/${method}`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  }, signal);
}

/**
 * Gọi một endpoint tài khoản Platform cố định, grant nằm trong header request của Host.
 * Nhận: `origin` đã cấu hình và khớp issuer của grant; `path` là endpoint tài khoản; `token` là grant;
 * `signal` là đời sống credential và hạn request; `headers` là header deployment của origin.
 * Trả: `biz_data` thành công.
 */
export function requestAccount(
  origin: string,
  path: AccountDetailPath,
  token: AccountToken,
  signal: AbortSignal,
  headers: PlatformHeaders,
): Promise<unknown> {
  return platformRequest(`${origin}${path}`, { method: "GET", headers: accountHeaders(headers, token) }, signal);
}

/**
 * Đọc danh sách bonus đã cấp mà Platform CHƯA ghi nhận là đã hiển thị.
 * Nhận: `origin` khớp issuer của grant; `token` là grant đang lưu; `signal` là đời sống credential và hạn
 * request; `headers` là header deployment + danh tính client của origin.
 * Trả: `biz_data` thành công mang danh sách bonus chưa báo.
 */
export function requestUnnotifiedBonuses(
  origin: string,
  token: AccountToken,
  signal: AbortSignal,
  headers: PlatformHeaders,
): Promise<unknown> {
  return platformRequest(`${origin}/api/v0/users/get_unnotified_bonuses`, {
    method: "GET",
    headers: accountHeaders(headers, token),
  }, signal);
}

/**
 * Báo một bonus ĐÃ thực sự hiển thị cho Platform.
 * Nhận: `origin` khớp issuer của grant; `token` là grant đang lưu; `orderId` là đơn bonus người dùng đã thấy;
 * `signal` là đời sống credential và hạn request; `headers` là header deployment + danh tính client.
 * Trả: `biz_data` thành công (không mang dữ liệu).
 */
export function requestBonusNotified(
  origin: string,
  token: AccountToken,
  orderId: AccountBonusOrderId,
  signal: AbortSignal,
  headers: PlatformHeaders,
): Promise<unknown> {
  return platformRequest(`${origin}/api/v0/users/ack_bonus_notified`, {
    method: "POST",
    headers: { ...accountHeaders(headers, token), "content-type": "application/json" },
    body: JSON.stringify({ order_id: orderId }),
  }, signal);
}

/** Grant thuộc provider; header deployment KHÔNG thể ghi đè nó hay danh tính client. */
function accountHeaders(headers: PlatformHeaders, token: AccountToken): PlatformHeaders {
  return { ...headers, "x-dsh-auth-token": token };
}

/**
 * Kết thúc phiên Platform bằng chính endpoint logout của nó.
 * Nhận: `origin` khớp issuer của grant; `token` là token tài khoản đang lưu; `signal` là hạn của request
 * logout; `headers` là header deployment của origin.
 * Trả: xong khi Platform xác nhận logout (mọi hỏng hóc đều ném lỗi).
 */
export async function logoutAccount(
  origin: string,
  token: AccountToken,
  signal: AbortSignal,
  headers: PlatformHeaders,
): Promise<void> {
  await platformRequest(`${origin}/auth-api/v0/users/logout`, {
    method: "POST",
    headers: { ...headers, "x-dsh-auth-token": token },
  }, signal);
}

/** Huỷ của bên gọi thì im lặng; huỷ do hết hạn chuẩn (TimeoutError) vẫn tính là hỏng. */
function callerCancelled(signal: AbortSignal): boolean {
  const reason: unknown = signal.reason;
  return signal.aborted && !(reason instanceof Error && reason.name === "TimeoutError");
}

/**
 * Gửi một request Platform và đọc phản hồi có chặn 64 KiB, dịch mọi hỏng hóc thành `PlatformAuthError`
 * (401/40003 thành `AccountUnauthorizedError`).
 * Nhận: `url` là đích tuyệt đối; `init` là RequestInit của lời gọi; `signal` là huỷ/hết hạn.
 * Trả: `biz_data` đã qua envelope; ném lỗi giao thức nếu sai.
 */
async function platformRequest(url: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  const path = new URL(url).pathname;
  let response: Response;
  try {
    response = await fetch(url, { ...init, redirect: "error", signal });
  } catch {
    if (!callerCancelled(signal)) {
      console.error("[deepseek-account] request failed", { path, errorCode: "no-response", aborted: signal.aborted });
    }
    throw new PlatformAuthError("no-response");
  }
  if (response.status === 401 && new Headers(init.headers).has("x-dsh-auth-token")) {
    if (!callerCancelled(signal)) {
      console.error("[deepseek-account] request failed", { path, status: response.status, errorCode: "expired" });
    }
    await response.body?.cancel();
    throw new AccountUnauthorizedError();
  }
  if (!response.ok || response.body === null) {
    if (!callerCancelled(signal)) {
      console.error("[deepseek-account] request failed", { path, status: response.status, errorCode: "network" });
    }
    await response.body?.cancel();
    throw new PlatformAuthError("network");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let stage = "read-body";
  let codes: { code: number; data?: { biz_code: number } } | undefined;
  let validationError: z.ZodError | undefined;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 65_536) {
        stage = "body-limit";
        throw new PlatformAuthError("protocol");
      }
      chunks.push(next.value);
    }
    stage = "parse-json";
    const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const responseCodes = z
      .object({ code: z.number().int(), data: z.object({ biz_code: z.number().int() }).optional() })
      .safeParse(payload);
    if (responseCodes.success) codes = responseCodes.data;
    const authorization = z.object({ code: z.literal(40003) }).safeParse(payload);
    if (authorization.success && new Headers(init.headers).has("x-dsh-auth-token")) {
      throw new AccountUnauthorizedError();
    }
    stage = "envelope";
    const parsed = envelope.safeParse(payload);
    if (!parsed.success) {
      validationError = parsed.error;
      throw new PlatformAuthError("protocol");
    }
    stage = "business-code";
    if (parsed.data.data.biz_code !== 0) {
      // TODO(product-error-ui): áp bản chữ và hành vi UI do sản phẩm định nghĩa cho các giá trị biz_code.
      // Hỏng nghiệp vụ dùng UI hỏng chung hiện có; thông điệp backend chỉ ở lại trong Host.
      throw new PlatformAuthError("protocol");
    }
    return parsed.data.data.biz_data;
  } catch (error) {
    if (!callerCancelled(signal)) {
      console.error("[deepseek-account] response rejected", {
        path,
        status: response.status,
        stage,
        code: codes?.code,
        bizCode: codes?.data?.biz_code,
        issues: validationError?.issues.map((issue) => ({ path: issue.path, code: issue.code })),
        errorCode: error instanceof PlatformAuthError ? error.code : "protocol",
      });
    }
    if (error instanceof PlatformAuthError) throw error;
    throw new PlatformAuthError("protocol");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/**
 * Nhận origin HTTP loopback mà trình duyệt với tới được, cho đăng nhập cục bộ hoặc qua SSH forward.
 * Nhận: `value` là origin HTTP loopback có cổng tường minh do client đã xác thực gửi lên.
 * Trả: origin đã chuẩn hoá; tên miền từ xa và proxy theo path đều không được hỗ trợ.
 * @throws PlatformAuthError("protocol") khi URL hỏng, thiếu cổng, cổng 0, sai host, hoặc còn user/path/query/fragment.
 */
export function loginOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PlatformAuthError("protocol");
  }
  const explicitPort = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):([0-9]+)\/?$/i.exec(value)?.[1];
  if (
    explicitPort === undefined ||
    Number(explicitPort) === 0 ||
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new PlatformAuthError("protocol");
  }
  return `${url.protocol}//${url.hostname}:${Number(explicitPort)}`;
}