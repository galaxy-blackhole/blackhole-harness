/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng timestamp của @deepseek-ai/dsh-time-context (stock lib/index.js dòng 61–93, region
 *      lib/types/timestamp.js): formatter ISO-shaped dùng chung cho bản chạy thật và cho phép kiểm lúc
 *      phát lại. Chép 1:1 từ bản gốc — không đổi hành vi.
 */

/**
 * Tạo đúng formatter mà các lần đọc time-context bền dùng.
 * Nhận: timeZone — múi giờ hiển thị chỉ định, hoặc `undefined` để dùng múi giờ mặc định của tiến trình.
 * Trả: formatter có trường cục bộ dạng số ổn định và độ lệch dạng số dài (`GMT+07:00`).
 */
export function createTimestampFormatter(timeZone?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    ...(timeZone === undefined ? {} : { timeZone }),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  });
}

/**
 * Định dạng một mốc epoch mili giây thành timestamp ISO-shaped kèm độ lệch và tên múi giờ IANA.
 * Nhận: now — epoch mili giây cần hiển thị; formatter — formatter đã tạo cho `timeZone`; timeZone — nhãn
 *       vùng chuẩn đặt trong ngoặc vuông.
 * Trả: văn bản timestamp bền, ví dụ `2026-10-19T09:09:13+07:00[Asia/Saigon]`.
 */
export function formatTimestamp(now: number, formatter: Intl.DateTimeFormat, timeZone: string): string {
  const parts: Record<string, string> = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  const offset = parts.timeZoneName!.replace(/^GMT$/, "GMT+00:00").slice(3);
  return `${parts.year!}-${parts.month!}-${parts.day!}T${parts.hour!}:${parts.minute!}:${parts.second!}${offset}[${timeZone}]`;
}
