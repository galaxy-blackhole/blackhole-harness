/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phân giải mạng CÔNG CỘNG + vận chuyển HTTP ghim địa chỉ cho ctx.web (1:1 từ bundle gốc DSH)
 */

import { WebError } from "@deepseek-ai/dsh-web";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

/** Một địa chỉ đã phân giải. */
export interface ResolvedAddress {
  /** Địa chỉ IPv4/IPv6 dạng văn bản. */
  address: string;
  /** 4 hoặc 6. */
  family: number;
}

/** Hàm phân giải DNS (tham số hoá để test thay được phần phân giải). */
export type AddressResolver = (hostname: string, options: { all: true; order: "verbatim" }) => Promise<ResolvedAddress[]>;

/** Kết quả một lượt gọi vận chuyển: response + hàm đóng tài nguyên. */
export interface TransportResult {
  /** Response HTTP (redirect: "manual") — kiểu undici fetch (khác DOM Response, dùng any cho gọn). */
  response: any;
  /** Giải phóng dispatcher/agent của lượt này. */
  close: () => Promise<void>;
}

/** Bộ thao tác mạng THẬT — tách object để test chỉ thay phần phân giải. */
export interface NetworkOperations {
  /** Phân giải + kiểm tra mọi địa chỉ là công cộng. */
  resolve: (hostname: string, signal: AbortSignal, resolver?: AddressResolver) => Promise<ResolvedAddress[]>;
  /** GET ghim địa chỉ qua Agent riêng. */
  request: (url: URL, addresses: ResolvedAddress[], headers: Record<string, string>, signal: AbortSignal) => Promise<TransportResult>;
  /** GET qua dispatcher mà chính sách proxy đã cài (để proxy phân giải origin). */
  requestVia: (dispatcher: unknown, url: URL, headers: Record<string, string>, signal: AbortSignal) => Promise<TransportResult>;
}

/** Độ dài tiền tố RFC 6052 có thể mang địa chỉ IPv4 qua NAT64. */
const RFC6052_PREFIX_LENGTHS = [32, 40, 48, 56, 64, 96];
const IPV4ONLY_DISCOVERY_HOST = "ipv4only.arpa";
const IPV4ONLY_SENTINELS = new Set(["192.0.0.170", "192.0.0.171"]);

/**
 * Địa chỉ có phải unicast công cộng không. IPv4-mapped IPv6 phân loại theo IPv4 nhúng; tiền tố chuyển đổi
 * vẫn bị chặn vì đích IPv4 cuối cùng không ghim được ở đây.
 * @param input địa chỉ IPv4/IPv6 dạng văn bản.
 * @returns true chỉ khi đích là unicast công cộng.
 */
export function isPublicIpAddress(input: string): boolean {
  let parsed: any;
  try {
    parsed = ipaddr.parse(stripIpv6Brackets(input));
  } catch {
    return false;
  }
  if (parsed instanceof ipaddr.IPv4) return parsed.range() === "unicast";
  if (parsed.isIPv4MappedAddress()) return parsed.toIPv4Address().range() === "unicast";
  return parsed.range() === "unicast";
}

/**
 * Phân giải hostname MỘT lần và từ chối TOÀN BỘ tập đáp án nếu có đích không công cộng.
 * @param hostname hostname của URL (kể cả ngoặc khi là IPv6 literal).
 * @param signal huỷ chờ phân giải hệ điều hành.
 * @param resolver hàm lookup (chỉ test thay).
 * @returns tập địa chỉ đã kiểm, không rỗng.
 */
export async function resolvePublicAddresses(hostname: string, signal: AbortSignal, resolver: AddressResolver = lookup as unknown as AddressResolver): Promise<ResolvedAddress[]> {
  const unbracketed = stripIpv6Brackets(hostname);
  const literalFamily = isIP(unbracketed);
  const resolved: ResolvedAddress[] = literalFamily === 0
    ? await raceWithSignal(resolver(unbracketed, { all: true, order: "verbatim" }), signal)
    : [{ address: unbracketed, family: literalFamily }];
  if (resolved.length === 0) throw new WebError(`hostname "${hostname}" resolved to no addresses`, "WEB_PROVIDER_ERROR");
  const nat64Prefixes = resolved.some((entry) => entry.family === 6 && isIP(entry.address) === 6) ? await discoverNat64Prefixes(signal, resolver) : [];
  const addresses: ResolvedAddress[] = [];
  for (const entry of resolved) {
    if ((entry.family !== 4 && entry.family !== 6) || isIP(entry.address) !== entry.family) {
      throw new WebError(`hostname "${hostname}" resolved to an invalid IP address`, "WEB_PROVIDER_ERROR");
    }
    if (!isPublicIpAddress(entry.address)) throw new WebError(`URL hostname "${hostname}" resolves to a non-public IP address`, "WEB_BLOCKED_URL");
    const translatedIpv4 = translatedIpv4Address(entry.address, nat64Prefixes);
    if (translatedIpv4 !== undefined && !isPublicIpAddress(translatedIpv4)) {
      throw new WebError(`URL hostname "${hostname}" resolves through NAT64 to a non-public IPv4 address`, "WEB_BLOCKED_URL");
    }
    addresses.push({ address: entry.address, family: entry.family });
  }
  return addresses;
}

/** Dò tập tiền tố DNS64 đang hoạt động bằng hostname dành riêng của RFC 7050. */
async function discoverNat64Prefixes(signal: AbortSignal, resolver: AddressResolver): Promise<{ bytes: number[]; length: number }[]> {
  const discovered = await raceWithSignal(resolver(IPV4ONLY_DISCOVERY_HOST, { all: true, order: "verbatim" }), signal);
  const prefixes: { bytes: number[]; length: number }[] = [];
  const seen = new Set<string>();
  for (const entry of discovered) {
    if (entry.family !== 6 || isIP(entry.address) !== 6) continue;
    const bytes = (ipaddr.parse(entry.address) as any).toByteArray() as number[];
    for (const length of RFC6052_PREFIX_LENGTHS) {
      const embedded = embeddedIpv4Address(bytes, length);
      if (embedded === undefined || !IPV4ONLY_SENTINELS.has(embedded)) continue;
      const prefixBytes = bytes.slice(0, length / 8);
      const key = String(length) + ":" + prefixBytes.join(".");
      if (seen.has(key)) continue;
      seen.add(key);
      prefixes.push({ bytes: prefixBytes, length });
    }
  }
  return prefixes;
}

/** Trả địa chỉ IPv4 nhúng theo RFC 6052 khi IPv6 khớp một tiền tố đã dò. */
function translatedIpv4Address(input: string, prefixes: { bytes: number[]; length: number }[]): string | undefined {
  if (!prefixes.length || isIP(input) !== 6) return undefined;
  const bytes = (ipaddr.parse(input) as any).toByteArray() as number[];
  for (const prefix of prefixes) {
    if (!prefix.bytes.every((byte, index) => bytes[index] === byte)) continue;
    const embedded = embeddedIpv4Address(bytes, prefix.length);
    if (embedded !== undefined) return embedded;
  }
  return undefined;
}

/** Trích một địa chỉ IPv4 từ bố cục IPv6 theo RFC 6052. */
function embeddedIpv4Address(bytes: number[], prefixLength: number): string | undefined {
  if (prefixLength === 96) return bytes.slice(12, 16).join(".");
  if (bytes[8] !== 0) return undefined;
  const prefixBytes = prefixLength / 8;
  const beforeReservedOctet = 8 - prefixBytes;
  return [...bytes.slice(prefixBytes, prefixBytes + beforeReservedOctet), ...bytes.slice(9, 13 - beforeReservedOctet)].join(".");
}

/**
 * Hostname có phải IP literal mà resolvePublicAddresses sẽ từ chối không (để không đẩy qua proxy nội bộ).
 * @param hostname hostname của URL, có/không ngoặc.
 * @returns true khi là literal không công cộng.
 */
export function isNonPublicIpLiteral(hostname: string): boolean {
  const unbracketed = stripIpv6Brackets(hostname);
  return isIP(unbracketed) !== 0 && !isPublicIpAddress(unbracketed);
}

/**
 * GET qua Agent có lookup chỉ trả tập địa chỉ đã kiểm (ghim DNS, chống đổi đáp án giữa kiểm và nối).
 * @param url URL HTTP(S) đã kiểm, không đi qua proxy.
 * @param addresses địa chỉ công cộng từ resolvePublicAddresses.
 * @param headers header yêu cầu.
 * @param signal huỷ yêu cầu + đọc thân.
 * @returns response + disposer.
 */
async function requestPinned(url: URL, addresses: ResolvedAddress[], headers: Record<string, string>, signal: AbortSignal): Promise<TransportResult> {
  const { Agent, fetch } = await import("undici");
  const dispatcher = new Agent({ autoSelectFamily: true, connect: { lookup: createPinnedLookup(addresses) } });
  try {
    return {
      response: await fetch(url, { method: "GET", redirect: "manual", headers, signal, dispatcher } as any),
      close: async () => {
        await dispatcher.close();
      },
    };
  } catch (error) {
    await dispatcher.close();
    throw error;
  }
}

/**
 * GET qua dispatcher mà chính sách proxy đã cài (proxy phân giải origin; KHÔNG ghim địa chỉ).
 * @param dispatcher dispatcher của tuyến, từ proxyRouteFor.
 * @param url URL đã kiểm, đi qua proxy.
 * @param headers header yêu cầu.
 * @param signal huỷ yêu cầu + đọc thân.
 * @returns response + disposer rỗng (giống nhánh kia để đóng như nhau).
 */
async function requestVia(dispatcher: unknown, url: URL, headers: Record<string, string>, signal: AbortSignal): Promise<TransportResult> {
  const { fetch } = await import("undici");
  return {
    response: await fetch(url, { method: "GET", redirect: "manual", headers, signal, dispatcher } as any),
    close: () => Promise.resolve(),
  };
}

/** Thao tác mạng của môi trường chạy thật. */
export const publicHttpNetwork: NetworkOperations = { resolve: resolvePublicAddresses, request: requestPinned, requestVia };

/**
 * Dựng lookup của connector chỉ phục vụ tập đáp án đã kiểm (không phân giải lại).
 * @param addresses địa chỉ công cộng giữ từ lượt phân giải trước.
 * @returns lookup tương thích Node.
 */
export function createPinnedLookup(addresses: ResolvedAddress[]): any {
  return (hostname: string, options: any, callback: any): void => {
    const family = typeof options.family === "number" ? options.family : options.family === "IPv4" ? 4 : options.family === "IPv6" ? 6 : 0;
    const eligible = family === 0 ? addresses : addresses.filter((address) => address.family === family);
    const selected = eligible[0];
    if (selected === undefined) {
      const error = Object.assign(new Error(`no validated address for ${hostname} in family ${family}`), { code: "ENOTFOUND", hostname });
      callback(error, options.all === true ? [] : "", family);
      return;
    }
    if (options.all === true) {
      callback(null, eligible.map((address) => ({ ...address })));
      return;
    }
    callback(null, selected.address, selected.family);
  };
}

/** Đua một lượt lookup KHÔNG huỷ được của hệ điều hành với tín hiệu huỷ của tool. */
function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  const abortError = (): Error => new Error("web fetch aborted during hostname resolution", { cause: signal.reason });
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => {
      reject(abortError());
    };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

/** WHATWG URL giữ ngoặc quanh hostname IPv6; bộ phân tích IP thì không. */
function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}
