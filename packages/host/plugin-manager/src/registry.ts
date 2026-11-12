/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/registry.js' của @deepseek-ai/dsh-plugin-manager (96 dòng): một thao tác package
 *      hỏi những registry nào, theo thứ tự nào, và một lần thử thất bại đã không chạm được cái gì. Registry
 *      được hỏi qua `--registry` của pnpm; `null` là cái mà chính cấu hình pnpm nêu tên. Module này chạy cả
 *      trong trình duyệt qua entry `./registry` của package, nên hộp thoại và Host theo CÙNG một luật.
 */

import type { ParsedInstallSpec } from "./install-spec.ts";
import type { PluginInstallFailureKind, PluginRegistries, Registry } from "./types.ts";

/** Registry của chính npm: cái pnpm nêu tên khi không có cấu hình nào, và là registry công khai DUY NHẤT mà một kế hoạch tin là công khai. */
export const OFFICIAL_NPM_REGISTRY = "https://registry.npmjs.org/";

/** URL công khai của npmmirror, dùng chung cho cấu hình dự phòng và phép so registry công khai. */
export const NPMMIRROR_REGISTRY = "https://registry.npmmirror.com/";

/** Một URL http(s), đúng dạng pnpm nhận ở `--registry`. */
export const REGISTRY_URL = /^https?:\/\/\S+$/;

/**
 * Phân một URL registry về dạng pnpm so registry: host chữ thường, có dấu chéo ở cuối.
 * Nhận: url — registry như đã cấu hình hoặc như bên gọi yêu cầu.
 * Trả: URL đã chuẩn hoá.
 * @throws {Error} với bất cứ thứ gì không phải URL http(s).
 */
export function normalizeRegistry(url: string): string {
  let parsed: URL | undefined;
  try {
    parsed = new URL(url);
  } catch {
    /* đặt tên ở dưới: chỉ URL http(s) mới là registry */
  }
  if (parsed === undefined || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    throw new Error(`a registry must be an http(s) URL: ${url}`);
  }
  if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
  return parsed.href;
}

/**
 * Các registry mà MỘT thao tác hỏi, từ đầu tới cuối.
 *
 * Tập đã cấu hình là registry đầu tiên của cấu hình cộng các dự phòng; một registry được yêu cầu sẽ được hỏi
 * trước khi nó nằm trong tập đó, và hỏi một mình khi không nằm trong, nên một registry riêng tư không bao giờ
 * rơi xuống một cái công khai. Registry của chính pnpm (`null`) chỉ thuộc tập khi cái nó nêu tên được biết là
 * công khai: registry của chính npm hoặc một trong các dự phòng đã cấu hình. Khi nó nêu tên thứ khác, hoặc
 * chưa biết, nó được hỏi một mình, và một registry công khai được hỏi thay vào đó không bao giờ rơi ngược
 * vào nó. Một registry mà chính cấu hình pnpm đã nêu tên thì chỉ được hỏi MỘT lần.
 * Nhận: requested — registry của bên gọi; undefined thì theo registry đầu tiên đã cấu hình.
 *       configured — registry đầu tiên đã cấu hình, các dự phòng sau nó, và cái mà chính cấu hình pnpm nêu tên.
 * Trả: các registry cần hỏi, theo thứ tự; KHÔNG BAO GIỜ rỗng.
 */
export function registryPlan(requested: Registry | undefined, configured: PluginRegistries): Registry[] {
  const own = configured.resolved === null ? null : normalizeRegistry(configured.resolved);
  const fallbacks = configured.fallbackRegistries.map(normalizeRegistry);
  const ownIsPublic = own !== null && (own === OFFICIAL_NPM_REGISTRY || fallbacks.includes(own));
  // Thứ mà một registry được so là: registry của chính pnpm đại diện URL nó nêu tên, một khi đã biết.
  const keyOf = (registry: Registry): Registry => (registry === null ? own : normalizeRegistry(registry));
  const known: Registry[] = [];
  const keys: Registry[] = [];
  for (const registry of [configured.registry, ...configured.fallbackRegistries]) {
    if (registry === null && !ownIsPublic) continue;
    const key = keyOf(registry);
    if (keys.includes(key)) continue;
    known.push(registry === null ? null : normalizeRegistry(registry));
    keys.push(key);
  }
  const first = requested === undefined ? configured.registry : requested;
  const firstKey = keyOf(first);
  const normalizedFirst = first === null ? null : normalizeRegistry(first);
  // Registry riêng tư hoặc chưa biết của chính pnpm, hỏi theo cách nào, cũng chỉ được hỏi MỘT mình.
  if ((first === null || firstKey === own) && !ownIsPublic) return [normalizedFirst];
  if (!keys.includes(firstKey)) return [normalizedFirst];
  return [normalizedFirst, ...known.filter((_registry, index) => keys[index] !== firstKey)];
}

/** Những thất bại mà sau đó một registry khác có thể trả lời khác: cái này không chạm được, hoặc bản sao của nó có thể đã cũ. */
const NEXT_REGISTRY_KINDS = new Set(["network", "timeout", "not-found", "no-matching-version"]);

/** Một dòng đầu ra của pnpm hoặc git BÁO thất bại, khác với dòng cảnh báo hay tiến trình. */
const ERROR_LINE = /ERR_|ERROR|\berror\b|fatal:|Could not resolve|unable to access|ssh:|\bE[A-Z]{4,}\b/;

/**
 * Một lần thử thất bại đã không chạm được hoặc không lấy được câu trả lời từ đâu.
 * Nhận: kind — cách lần thử thất bại; log — những gì lần thử đã in; spec — spec mà lần thử đã cài.
 * Trả: `registry` cho thất bại mà một registry khác có thể đổi được; `spec-host` khi một dòng lỗi nêu tên host
 *       mà spec git hoặc tarball được tải từ đó (không registry nào thay thế được); `other` cho thất bại mà cả
 *       hai đều không giải thích được.
 */
export function attributeFailure(kind: PluginInstallFailureKind, log: string, spec: ParsedInstallSpec): "registry" | "spec-host" | "other" {
  if (!NEXT_REGISTRY_KINDS.has(kind)) return "other";
  const host = spec.kind === "git" || spec.kind === "tarball" ? spec.host?.toLowerCase() : undefined;
  if (host === undefined) return "registry";
  const named = log.split("\n").some((line) => ERROR_LINE.test(line) && line.toLowerCase().includes(host));
  return named ? "spec-host" : "registry";
}
