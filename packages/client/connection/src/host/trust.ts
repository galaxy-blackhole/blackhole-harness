/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hàng rào tin cậy cho /api: Host/Origin/authority, loopback, trustedHosts và địa chỉ bind của chính ta
 */

import { isLoopbackHostname } from "./loopback.ts";

/** Một URL authority đã tách, chỉ gồm host (và port nếu có). */
export interface ParsedAuthority {
  /** Hostname đã chuẩn hoá (literal IPv6 giữ dấu ngoặc). */
  hostname: string;
  /** Port tường minh, hoặc chuỗi rỗng khi authority không nêu port. */
  port: string;
  /** Dạng host[:port] đã chuẩn hoá. */
  host: string;
}

/** Sự thật header của một yêu cầu HTTP (node:http hoặc fetch). */
export interface RequestFacts {
  /** Bảng header, tên header không phân biệt hoa thường. */
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Đọc một header theo tên, không phân biệt hoa thường.
 * @param headers - bảng header.
 * @param name - tên header cần đọc.
 * @returns giá trị đầu tiên, hoặc undefined.
 */
export function headerOf(headers: RequestFacts["headers"], name: string): string | undefined {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== name) continue;
    const value = headers[key];
    if (value === undefined) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

/**
 * Tách một authority trần (host hoặc host:port) thành các phần đã chuẩn hoá.
 *
 * Chỉ nhận authority TRẦN: có scheme, đường dẫn, thông tin đăng nhập, truy vấn hay mảnh neo đều bị từ chối.
 * @param value - authority như cấu hình hoặc như header Host gửi lên.
 * @param protocol - scheme dùng để suy port mặc định.
 * @returns authority đã tách, hoặc undefined khi không phải authority trần hợp lệ.
 */
export function parseAuthority(value: string, protocol = "http:"): ParsedAuthority | undefined {
  if (value === "" || value.includes("/") || value.includes("?") || value.includes("#") || value.includes("@")) return undefined;
  let url: URL;
  try {
    url = new URL(protocol + "//" + value);
  } catch {
    return undefined;
  }
  if (url.username !== "" || url.password !== "" || url.pathname !== "/" || url.search !== "" || url.hash !== "") return undefined;
  return { hostname: url.hostname, port: url.port, host: url.host };
}

/**
 * Dạng chuẩn của một authority đã cấu hình, dùng để phát hiện entry không chuẩn tắc.
 * @param entry - authority như người vận hành viết.
 * @param parsed - kết quả {@link parseAuthority}.
 * @returns chuỗi chuẩn tắc: hostname khi entry không nêu port, host khi có.
 */
export function canonicalAuthority(entry: string, parsed: ParsedAuthority): string {
  const portless = !hasExplicitPort(entry);
  return portless ? parsed.hostname : parsed.host;
}

/**
 * Entry cấu hình có nêu port tường minh hay không (literal IPv6 trong ngoặc tính là host, phần sau dấu
 * hai chấm cuối cùng mới là port).
 * @param entry - authority như người vận hành viết.
 * @returns true khi có port tường minh.
 */
function hasExplicitPort(entry: string): boolean {
  const close = entry.lastIndexOf("]");
  const tail = close === -1 ? entry : entry.slice(close + 1);
  return tail.includes(":");
}

/**
 * Kiểm một entry trustedHosts có hợp lệ và chuẩn tắc hay không.
 * @param entry - authority như người vận hành viết.
 * @throws TypeError khi entry không phải authority trần chuẩn tắc (nạp plugin phải hỏng, không im lặng).
 */
export function assertTrustedAuthority(entry: string): void {
  const parsed = parseAuthority(entry);
  if (parsed === undefined) throw new TypeError("client-connection: trustedHosts entry " + JSON.stringify(entry) + " is not a bare host authority");
  if (canonicalAuthority(entry, parsed) !== entry) throw new TypeError("client-connection: trustedHosts entry " + JSON.stringify(entry) + " must be canonical " + JSON.stringify(canonicalAuthority(entry, parsed)));
}

/**
 * Authority của header Host có nằm trong trustedHosts hay không (entry không port khớp mọi port).
 * @param hostUrl - authority của yêu cầu.
 * @param trustedHosts - danh sách authority được cấu hình.
 * @param protocol - scheme dùng để suy port mặc định.
 * @returns true khi có entry khớp.
 */
export function isTrustedAuthority(hostUrl: ParsedAuthority, trustedHosts: readonly string[], protocol = "http:"): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry, protocol);
    if (entryUrl === undefined) return false;
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host;
  });
}

/**
 * Entry đã cấu hình có phải authority TỪ XA (không phải loopback) hay không.
 * @param entry - authority đã qua {@link assertTrustedAuthority}.
 * @returns true trừ khi entry phân loại là loopback.
 */
export function isRemoteAuthority(entry: string): boolean {
  const url = parseAuthority(entry);
  return url === undefined || !isLoopbackHostname(url.hostname);
}

/**
 * Authority của yêu cầu có đúng là địa chỉ bind của chính deployment hay không.
 *
 * Trình duyệt gọi thẳng literal đó gửi nó làm Host, và chấp nhận nó không mở thêm quyền gì: literal
 * không phải mục tiêu rebinding, các phép kiểm Origin và cross-site vẫn áp, và nó vẫn NGOÀI trustedHosts.
 * Khớp bỏ qua port (như entry không port) và bỏ qua id vùng %iface.
 * @param hostUrl - authority của yêu cầu.
 * @param bindHost - literal IP mà listener đang bind.
 * @returns true khi cùng hostname.
 */
export function isBindAddressAuthority(hostUrl: ParsedAuthority, bindHost: string | undefined): boolean {
  if (bindHost === undefined) return false;
  const zoneAt = bindHost.indexOf("%");
  const address = zoneAt === -1 ? bindHost : bindHost.slice(0, zoneAt);
  const bindUrl = parseAuthority(address.includes(":") ? "[" + address + "]" : address);
  return bindUrl !== undefined && bindUrl.hostname === hostUrl.hostname;
}

/**
 * So Origin với Host theo scheme http(s) của Origin để port mặc định chuẩn hoá nhất quán.
 * @param origin - giá trị header Origin nguyên văn.
 * @param host - giá trị header Host đã qua hàng rào.
 * @returns true chỉ khi Origin đúng là authority của chính listener này.
 */
export function isSameAuthorityOrigin(origin: string, host: string): boolean {
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  const scheme = originUrl.protocol === "https:" ? "https:" : originUrl.protocol === "http:" ? "http:" : undefined;
  if (scheme === undefined) return false;
  const hostUrl = parseAuthority(host, scheme);
  return hostUrl !== undefined && originUrl.host === hostUrl.host;
}

/**
 * Quyết định một yêu cầu /api có được tới cầu RPC hay không.
 * @param request - sự thật header của yêu cầu.
 * @param trustedHosts - authority KHÔNG loopback mà deployment phục vụ.
 * @param bindHost - literal IP mà listener bind, được chấp nhận trên mọi port.
 * @param protocol - scheme của listener.
 * @returns true khi Host là của ta (loopback, địa chỉ bind, hoặc trusted) và mọi dấu hiệu trình duyệt
 *          gắn kèm đều cùng origin.
 */
export function isTrustedApiRequest(request: RequestFacts, trustedHosts: readonly string[], bindHost: string | undefined, protocol = "http:"): boolean {
  const host = headerOf(request.headers, "host");
  if (host === undefined) return false;
  const hostUrl = parseAuthority(host, protocol);
  if (hostUrl === undefined) return false;
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts, protocol) && !isBindAddressAuthority(hostUrl, bindHost)) return false;
  if (headerOf(request.headers, "sec-fetch-site") === "cross-site") return false;
  const origin = headerOf(request.headers, "origin");
  if (origin === undefined) return true;
  return isSameAuthorityOrigin(origin, host);
}
