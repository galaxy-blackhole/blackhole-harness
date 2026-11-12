/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 gói THƯ VIỆN @galaxy-blackhole/gbh-util-time (31 dòng, zero-dep): từ vựng THỜI GIAN
 *      cho các biên wire nhận múi giờ của người gọi — chỉ kiểm và chuẩn hoá, KHÔNG định dạng, KHÔNG tự ném lỗi.
 */

/** Khuôn múi giờ nghiêm: "UTC" hoặc IANA dạng Area/Location. */
const IANA_TIME_ZONE = /^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+)+$/;

/**
 * Kiểm và chuẩn hoá MỘT múi giờ IANA do người gọi khai ở biên wire.
 * Vì sao phải trả TÊN CHUẨN: danh tính múi giờ được ghi trên bản ghi bền và một tiến trình khác sẽ
 * phân giải lại, nên nếu chấp nhận alias thì giá trị so sánh sẽ KHÔNG bằng múi giờ mà bên đọc suy ra.
 * @param value - tên múi giờ người gọi khai.
 * @returns múi giờ chuẩn, hoặc `undefined` khi tên không dùng được.
 */
export function canonicalClientTimeZone(value: string): string | undefined {
  if (value.length === 0 || value.trim() !== value || (value !== "UTC" && !IANA_TIME_ZONE.test(value))) return undefined;
  try {
    const canonical = new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
    if (canonical !== "UTC" && !IANA_TIME_ZONE.test(canonical)) return undefined;
    return canonical;
  } catch {
    return undefined;
  }
}
