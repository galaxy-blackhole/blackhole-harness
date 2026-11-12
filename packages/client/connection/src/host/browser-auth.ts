/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Xác thực phiên trình duyệt cho giao vận Connection: token khởi động, cookie ký HMAC, 401 tối giản
 *      11/11/2026: lớp phản hồi nhận thân BYTE (phản hồi multipart của readBytes) chứ không chỉ chuỗi.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { COOKIE_PREFIX, TOKEN_QUERY } from "../ids.ts";
import { headerOf, type RequestFacts } from "./trust.ts";

/** Số byte của bí mật ký phiên. */
const SECRET_BYTES = 32;

/** Phiên bản của phần thân cookie. */
const COOKIE_PAYLOAD_VERSION = 1;

/** Phiên bản bản ghi bí mật trong sổ credentials. */
const STORED_SECRET_VERSION = 1;

/** Số giây của một ngày. */
const DAY_SECONDS = 86400;

/** Token khởi động của từng tiến trình chủ: một trang mở lại không đổi token trong cùng lượt chạy. */
const PROCESS_LAUNCH_TOKENS = new Map<unknown, string>();

/** Sổ credentials tối thiểu mà row này dùng (tra theo khoá, sửa nguyên tử). */
export interface CredentialsLike {
  /** Sửa một bản ghi theo khoá; hàm nhận bản ghi hiện tại và trả bản ghi kế tiếp. */
  modifyRecord(key: string, change: (current: unknown) => unknown): Promise<unknown>;
}

/** Yêu cầu HTTP tối thiểu mà hàng rào cần (node:http hoặc fetch). */
export interface AuthRequest extends RequestFacts {
  /** Phương thức HTTP. */
  method?: string;
  /** Đường dẫn kèm truy vấn. */
  url?: string;
}

/** Phản hồi HTTP tối thiểu mà hàng rào ghi vào. */
export interface AuthResponse {
  /** Ghi trạng thái và header. */
  writeHead(status: number, headers?: Record<string, string>): unknown;
  /** Kết thúc phản hồi, kèm thân tuỳ chọn (văn bản hoặc BYTE — phản hồi multipart mang ảnh/tệp). */
  end(body?: string | Uint8Array): unknown;
}

/** Băm base64url không đệm. */
function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/** Giải base64url, trả undefined khi chuỗi hỏng. */
function decodeBase64Url(text: string): Uint8Array | undefined {
  try {
    return new Uint8Array(Buffer.from(text, "base64url"));
  } catch {
    return undefined;
  }
}

/** So hai chuỗi bí mật bằng phép so sánh thời gian hằng. */
function tokenMatches(actual: string, expected: string): boolean {
  const actualBytes = new TextEncoder().encode(actual);
  const expectedBytes = new TextEncoder().encode(expected);
  return actualBytes.byteLength === expectedBytes.byteLength && timingSafeEqual(actualBytes, expectedBytes);
}

/**
 * Authority mà một yêu cầu đang phục vụ, dùng làm "khán giả" của cookie.
 * @param headers - bảng header của yêu cầu.
 * @param secure - listener này có phục vụ TLS hay không.
 * @returns host[:port] chuẩn hoá, hoặc undefined khi thiếu header Host.
 */
export function requestAudience(headers: RequestFacts["headers"], secure: boolean): string | undefined {
  const host = headerOf(headers, "host");
  if (host === undefined || host === "") return undefined;
  try {
    return new URL((secure ? "https://" : "http://") + host).host;
  } catch {
    return undefined;
  }
}

/**
 * Tên cookie của một authority: tiền tố cố định cộng vân tay ngắn, nên hai authority khác nhau không
 * ghi đè cookie của nhau.
 * @param authority - host[:port] của listener.
 * @returns tên cookie.
 */
export function cookieName(authority: string): string {
  const digest = createHash("sha256").update(authority).digest("hex").slice(0, 16);
  return COOKIE_PREFIX + digest;
}

/** Thuộc tính cookie phiên: HttpOnly, SameSite=Lax, Path=/, có Secure khi listener phục vụ TLS. */
function sessionCookie(name: string, value: string, expiresAt: number, maxAgeSeconds: number, secure: boolean): string {
  const parts = [name + "=" + value, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=" + String(maxAgeSeconds), "Expires=" + new Date(expiresAt).toUTCString()];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Chữ ký HMAC-SHA256 của phần thân cookie. */
function signature(secret: Uint8Array, body: string): Uint8Array {
  return new Uint8Array(createHmac("sha256", secret).update(body).digest());
}

/** Mã hoá một payload cookie thành v<version>.<body>.<signature>. */
export function encodeCookie(payload: Record<string, unknown>, secret: Uint8Array): string {
  const body = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return "v" + String(payload.version ?? COOKIE_PAYLOAD_VERSION) + "." + body + "." + encodeBase64Url(signature(secret, body));
}

/** Giải một cookie đã ký; trả undefined khi hỏng, sai phiên bản, hoặc sai chữ ký. */
export function decodeCookie(value: string, secret: Uint8Array): Record<string, unknown> | undefined {
  const parts = value.split(".");
  if (parts.length !== 3) return undefined;
  const [version, body, actual] = parts;
  if (version === undefined || body === undefined || actual === undefined) return undefined;
  const actualSignature = decodeBase64Url(actual);
  const expectedSignature = signature(secret, body);
  if (actualSignature === undefined || actualSignature.byteLength !== expectedSignature.byteLength) return undefined;
  if (!timingSafeEqual(actualSignature, expectedSignature)) return undefined;
  const decoded = decodeBase64Url(body);
  if (decoded === undefined) return undefined;
  try {
    const payload: unknown = JSON.parse(new TextDecoder().decode(decoded));
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
    return payload as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Khoá ghi bí mật phiên trong sổ credentials dùng chung. */
const AUTH_RECORD_KEY = "client-connection/browser-session";

/**
 * Đọc bí mật từ một bản ghi credentials đã lưu.
 *
 * Hình dạng bản ghi là hợp đồng của SỔ, không phải của riêng row này: `{ kind: "grant", payload: { version, secret } }`.
 * Thiếu `kind` thì sổ từ chối và row không bao giờ activate (đã đo ở lab 5468: "record ... has no kind",
 * rồi 14 row khác `pending (waiting for service: connection)`).
 * @param record - bản ghi hiện tại, hoặc undefined khi chưa có.
 * @returns bí mật đã kiểm, hoặc undefined khi bản ghi chưa đúng định dạng.
 */
function storedSecret(record: unknown): Uint8Array | undefined {
  if (typeof record !== "object" || record === null) return undefined;
  const current = record as { kind?: unknown; payload?: unknown };
  if (current.kind !== "grant" || typeof current.payload !== "object" || current.payload === null) return undefined;
  const payload = current.payload as { version?: unknown; secret?: unknown };
  if (payload.version !== STORED_SECRET_VERSION || typeof payload.secret !== "string") return undefined;
  if (!/^[A-Za-z0-9_-]*$/u.test(payload.secret) || payload.secret.length % 4 === 1) return undefined;
  const bytes = decodeBase64Url(payload.secret);
  return bytes !== undefined && bytes.byteLength === SECRET_BYTES ? bytes : undefined;
}

/**
 * Bí mật ký phiên của lượt chạy này: đọc từ sổ credentials, tạo khi chưa có.
 * @param credentials - sổ credentials dùng chung.
 * @returns bí mật 32 byte.
 * @throws Error khi bản ghi có sẵn sai định dạng (không im lặng tạo bí mật mới: cookie cũ sẽ chết âm thầm).
 */
async function initializeSecret(credentials: CredentialsLike): Promise<Uint8Array> {
  const record = await credentials.modifyRecord(AUTH_RECORD_KEY, (current) => {
    if (current !== undefined && current !== null) return current;
    return { kind: "grant", payload: { version: STORED_SECRET_VERSION, secret: encodeBase64Url(randomBytes(SECRET_BYTES)) } };
  });
  const secret = storedSecret(record);
  if (secret === undefined) throw new Error("client-connection: browser-session credential record has an unsupported format");
  return secret;
}

/**
 * Xác thực phiên trình duyệt của Host Connection.
 *
 * Cookie mang {version, authority, issuedAt, expiresAt} đã ký; cookie của authority khác KHÔNG dùng được.
 * Token khởi động là bí mật riêng của tiến trình, đổi mỗi lần chạy host, và được trao đổi lấy cookie qua
 * `/?token=…` (chuyển hướng 303) hoặc qua `/connect?token=…` (chuyển hướng 302 tới API mux).
 */
export class BrowserAuth {
  /** Bí mật ký cookie của deployment. */
  private readonly secret: Uint8Array;

  /** Token khởi động của lượt chạy này. */
  private readonly launchToken: string;

  /** Tuổi thọ cookie tính bằng mili giây. */
  private readonly maxAgeMilliseconds: number;

  /**
   * @param secret - bí mật ký cookie.
   * @param launchToken - token khởi động của lượt chạy.
   * @param cookieMaxAgeDays - tuổi thọ cookie tính bằng ngày.
   */
  constructor(secret: Uint8Array, launchToken: string, cookieMaxAgeDays: number) {
    this.secret = secret;
    this.launchToken = launchToken;
    this.maxAgeMilliseconds = cookieMaxAgeDays * DAY_SECONDS * 1000;
  }

  /**
   * Nạp bí mật ký từ sổ credentials và mint token khởi động của lượt chạy này.
   * @param owner - khoá nhận diện tiến trình chủ (giữ một token cho mỗi lượt chạy).
   * @param credentials - sổ credentials dùng chung.
   * @param cookieMaxAgeDays - tuổi thọ cookie tính bằng ngày.
   * @returns hàng rào xác thực đã sẵn sàng.
   */
  static async create(owner: unknown, credentials: CredentialsLike, cookieMaxAgeDays: number): Promise<BrowserAuth> {
    const secret = await initializeSecret(credentials);
    const existing = PROCESS_LAUNCH_TOKENS.get(owner);
    const token = existing ?? encodeBase64Url(randomBytes(SECRET_BYTES));
    PROCESS_LAUNCH_TOKENS.set(owner, token);
    return new BrowserAuth(secret, token, cookieMaxAgeDays);
  }

  /**
   * URL có token khởi động để mở lần đầu.
   * @param baseUrl - URL gốc của web surface.
   * @returns URL đã gắn tham số token.
   */
  authenticatedUrl(baseUrl: string): string {
    const url = new URL(baseUrl);
    url.searchParams.set(TOKEN_QUERY, this.launchToken);
    return url.href;
  }

  /**
   * Xác thực một yêu cầu index: token hợp lệ thì mint cookie rồi chuyển hướng về "./"; cookie hợp lệ thì
   * cho phục vụ index; mọi trường hợp khác nhận CÙNG một phản hồi 401 tối giản.
   * @param req - yêu cầu index.
   * @param res - phản hồi do hàm này sở hữu khi trả về false.
   * @param secure - listener nhận yêu cầu này có phục vụ TLS hay không.
   * @returns true chỉ khi bên gọi được phép phục vụ index.html.
   */
  authorizeIndex(req: AuthRequest, res: AuthResponse, secure = false): boolean {
    const url = new URL(req.url ?? "/", "http://dsh.invalid");
    const tokens = url.searchParams.getAll(TOKEN_QUERY);
    const authority = requestAudience(req.headers, secure);
    if (tokens.length > 0) {
      if (req.method === "GET" && url.pathname === "/" && tokens.length === 1 && authority !== undefined && tokenMatches(tokens.join(""), this.launchToken)) {
        const issuedAt = Date.now();
        const expiresAt = issuedAt + this.maxAgeMilliseconds;
        const value = encodeCookie({ version: COOKIE_PAYLOAD_VERSION, authority, issuedAt, expiresAt }, this.secret);
        res.writeHead(303, {
          "cache-control": "no-store",
          location: "./",
          "referrer-policy": "no-referrer",
          "set-cookie": sessionCookie(cookieName(authority), value, expiresAt, Math.floor(this.maxAgeMilliseconds / 1000), secure),
        });
        res.end();
        return false;
      }
      if (req.method === "GET" && url.pathname === "/" && this.isAuthenticated(req, secure)) {
        res.writeHead(303, { "cache-control": "no-store", location: "./", "referrer-policy": "no-referrer" });
        res.end();
        return false;
      }
      this.writeUnauthorized(req, res);
      return false;
    }
    if (this.isAuthenticated(req, secure)) return true;
    this.writeUnauthorized(req, res);
    return false;
  }

  /**
   * Trao token khởi động lấy một toán tử API độc lập; thiếu khai báo interactions thì mặc định "none".
   * @param req - yêu cầu GET đã tin cậy trên /connect, có tối đa một khai báo interactions.
   * @param res - phản hồi do hàm này sở hữu tới khi xong; chuyển hướng tới API mux khi thành công.
   * @param secure - listener nhận yêu cầu này có phục vụ TLS hay không.
   * @param publish - tạo toán tử một cách đồng bộ trước khi phơi credential đã ký của nó.
   * @returns true khi đã cấp credential và chuyển hướng.
   */
  authorizeConnect(req: AuthRequest, res: AuthResponse, secure: boolean, publish: (interactions: "answer" | "none") => string): boolean {
    const url = new URL(req.url ?? "/", "http://dsh.invalid");
    const declarations = url.searchParams.getAll("interactions");
    const interactions = declarations[0] ?? "none";
    if (declarations.length > 1 || (interactions !== "answer" && interactions !== "none")) {
      res.writeHead(400, { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" });
      res.end("interactions must be declared once as answer or none\n");
      return false;
    }
    const tokens = url.searchParams.getAll(TOKEN_QUERY);
    const authority = requestAudience(req.headers, secure);
    if (req.method !== "GET" || url.pathname !== "/connect" || tokens.length !== 1 || authority === undefined || !tokenMatches(tokens.join(""), this.launchToken)) {
      this.writeUnauthorized(req, res);
      return false;
    }
    const issuedAt = Date.now();
    const expiresAt = issuedAt + this.maxAgeMilliseconds;
    const value = encodeCookie({ version: 2, authority, id: publish(interactions), issuedAt, expiresAt }, this.secret);
    res.writeHead(302, {
      "cache-control": "no-store",
      location: "/api",
      "referrer-policy": "no-referrer",
      "set-cookie": sessionCookie(cookieName(authority), value, expiresAt, Math.floor(this.maxAgeMilliseconds / 1000), secure),
    });
    res.end();
    return true;
  }

  /**
   * Yêu cầu này có cookie phiên hợp lệ cho authority của chính nó hay không.
   * @param request - yêu cầu cần kiểm.
   * @param secure - listener có phục vụ TLS hay không.
   * @returns true khi cookie hợp lệ, chưa hết hạn và đúng authority.
   */
  isAuthenticated(request: AuthRequest, secure = false): boolean {
    return this.authenticateApi(request, secure) !== undefined;
  }

  /**
   * Đọc danh tính phiên từ cookie của yêu cầu /api.
   * @param request - yêu cầu cần kiểm.
   * @param secure - listener có phục vụ TLS hay không.
   * @returns danh tính phiên (authority + id toán tử tuỳ chọn), hoặc undefined.
   */
  authenticateApi(request: AuthRequest, secure = false): { authority: string; id?: string } | undefined {
    const authority = requestAudience(request.headers, secure);
    if (authority === undefined) return undefined;
    const cookies = headerOf(request.headers, "cookie");
    if (cookies === undefined) return undefined;
    const name = cookieName(authority);
    for (const part of cookies.split(";")) {
      const trimmed = part.trim();
      if (!trimmed.startsWith(name + "=")) continue;
      const payload = decodeCookie(trimmed.slice(name.length + 1), this.secret);
      if (payload === undefined) return undefined;
      if (payload.authority !== authority) return undefined;
      const expiresAt = payload.expiresAt;
      if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return undefined;
      const id = payload.id;
      return { authority, ...(typeof id === "string" ? { id } : {}) };
    }
    return undefined;
  }

  /**
   * Ghi phản hồi 401 tối giản: không tiết lộ vì sao, không đệm thêm thông tin.
   * @param _request - yêu cầu bị từ chối (không dùng; giữ chữ ký cho tương thích bản gốc).
   * @param res - phản hồi cần ghi.
   */
  writeUnauthorized(_request: AuthRequest, res: AuthResponse): void {
    res.writeHead(401, { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" });
    res.end("unauthorized\n");
  }
}
