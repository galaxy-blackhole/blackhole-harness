/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Vùng request-zone của @deepseek-ai/dsh-time-context (stock lib/index.js dòng 6–60, region
 *      lib/types/request-zone.js): suy ra múi giờ trình duyệt của một lượt đang mở và dựng dòng chỉ dẫn
 *      cho model. Chép 1:1 từ bản gốc — không đổi hành vi.
 */

import type { UserMessage } from "@galaxy-blackhole/gbh-llm";
import { assertNever } from "@galaxy-blackhole/gbh-util-values";

/** Mẫu tên múi giờ IANA dạng `Area/Location`: tối thiểu một dấu `/`, mỗi khúc là chữ/số/`_`/`+`/`.`/`-`. */
const IANA_TIME_ZONE = /^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+)+$/;

/** Sự thật múi giờ trình duyệt suy ra từ các tin nhắn user-rpc thuộc một lượt đang mở. */
export type BrowserTimeZoneContext =
  | { readonly kind: "resolved"; readonly timeZone: string }
  | { readonly kind: "mixed"; readonly timeZones: readonly string[] }
  | { readonly kind: "missing" };

/**
 * Đọc và kiểm một múi giờ trình duyệt đã được Host chuẩn hoá trong một tin nhắn user-rpc thường.
 * Nhận: message — tin nhắn người dùng, có thể mang nguồn `user` kèm `rpcId` + `clientTimeZone`.
 * Trả: múi giờ đã kiểm (UTC hoặc IANA chuẩn), hoặc `undefined` khi tin nhắn không mang múi giờ.
 * Ném: TypeError khi múi giờ sai định dạng, không hỗ trợ, hoặc không ở dạng chuẩn.
 */
function browserTimeZone(message: UserMessage): string | undefined {
  const source = message.source;
  const value =
    source.kind === "user" && "rpcId" in source && typeof source.rpcId === "string" && "clientTimeZone" in source && typeof source.clientTimeZone === "string"
      ? source.clientTimeZone
      : undefined;
  if (value === undefined) return undefined;
  if (value !== "UTC" && !IANA_TIME_ZONE.test(value)) throw new TypeError(`browser time zone must be canonical UTC or IANA Area/Location: ${JSON.stringify(value)}`);
  let canonical: string;
  try {
    canonical = new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch (error) {
    throw new TypeError(`browser time zone is unsupported: ${JSON.stringify(value)}`, { cause: error });
  }
  if (canonical !== value) throw new TypeError(`browser time zone must be canonical: ${JSON.stringify(value)}`);
  return value;
}

/**
 * Suy ra múi giờ duy nhất, hỗn hợp, hoặc thiếu của một lượt đang mở.
 * Nhận: messages — tin nhắn người dùng đã vào và đang đề nghị của lượt đó.
 * Trả: sự thật múi giờ đã sắp xếp, không trùng lặp.
 * Ném: TypeError khi một nguồn user-rpc mang múi giờ sai hoặc không chuẩn.
 */
export function deriveBrowserTimeZoneContext(messages: readonly UserMessage[]): BrowserTimeZoneContext {
  const timeZones = [
    ...new Set(
      messages.flatMap((message) => {
        const timeZone = browserTimeZone(message);
        return timeZone === undefined ? [] : [timeZone];
      }),
    ),
  ].sort();
  const [timeZone, ...remaining] = timeZones;
  if (timeZone === undefined) return { kind: "missing" };
  if (remaining.length === 0)
    return {
      kind: "resolved",
      timeZone,
    };
  return {
    kind: "mixed",
    timeZones,
  };
}

/**
 * Dựng câu chỉ dẫn cho model ứng với một ngữ cảnh múi giờ trình duyệt.
 * Nhận: context — sự thật múi giờ của lượt đang mở.
 * Trả: đúng một dòng chỉ dẫn bền, nguyên văn như bản gốc.
 */
export function renderBrowserTimeZoneContext(context: BrowserTimeZoneContext): string {
  switch (context.kind) {
    case "resolved":
      return `Browser time zone for this request: ${context.timeZone}. Interpret otherwise-unqualified dates and times in this zone.`;
    case "mixed":
      return `Browser time zone for this request: mixed ${JSON.stringify(context.timeZones)}. Ask the user to clarify otherwise-unqualified dates and times.`;
    case "missing":
      return "Browser time zone for this request: unavailable. Ask the user to clarify otherwise-unqualified dates and times.";
    // Nhánh dưới chỉ chạy khi union đóng ở trên bị mở rộng — y bản gốc (assertNever của stock).
    default:
      return assertNever(context, "BrowserTimeZoneContext");
  }
}
