/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hằng số URI scheme cho địa chỉ resource: client PHÁT gbh-resource://, NHẬN cả dsh-resource:// (tương thích plugin ngoài/DSH)
 */

// VI SAO CO FILE NAY (Wave D, task-29)
//   Bản gốc DSH dùng MỘT scheme `dsh-resource://` ở 48 chỗ khắp 20 file client. Galaxy Blackhole đổi
//   thương hiệu nên client PHẢI phát `gbh-resource://`. Nhưng luật G1 (tương thích plugin ngoài) cấm
//   làm gãy bên thứ ba: plugin ngoài hoặc entry DSH còn sót có thể gửi/đọc scheme CŨ. Vì vậy:
//     · MỌI nơi PHÁT địa chỉ dùng {@link RESOURCE_SCHEME_PREFIX} (scheme mới);
//     · MỌI nơi NHẬN (parse, validate, pattern tab) chấp nhận CẢ HAI qua {@link isResourceScheme} /
//       {@link isResourceAddress} / {@link resourcePatterns};
//     · scheme KHÁC (http:, file:, gbh-lạ:) bị TỪ CHỐI — đây là phép đo "scheme lạ bị từ chối".
//   Không có "migration" nào cho địa chỉ đã ghi trong lịch sử phiên: chúng mang scheme cũ và vẫn phải
//   mở được ⇒ đây chính là lý do kép scheme tồn tại lâu dài, không phải nợ tạm.

/** Scheme resource MỚI mà client phát ra. */
export const RESOURCE_SCHEME = "gbh-resource";

/** Scheme resource CŨ của DSH — vẫn ĐƯỢC CHẤP NHẬN khi nhận (plugin ngoài, địa chỉ trong lịch sử phiên). */
export const LEGACY_RESOURCE_SCHEME = "dsh-resource";

/** Tiền tố đầy đủ của địa chỉ resource MỚI ("gbh-resource://"). */
export const RESOURCE_SCHEME_PREFIX = RESOURCE_SCHEME + "://";

/** Tiền tố đầy đủ của địa chỉ resource CŨ ("dsh-resource://"). */
export const LEGACY_RESOURCE_SCHEME_PREFIX = LEGACY_RESOURCE_SCHEME + "://";

/**
 * Các scheme ĐƯỢC CHẤP NHẬN khi nhận địa chỉ, theo thứ tự ưu tiên (mới trước).
 * Dùng cho test "chấp nhận cả hai" và cho tài liệu/README.
 */
export const ACCEPTED_RESOURCE_SCHEMES: readonly string[] = Object.freeze([
  RESOURCE_SCHEME,
  LEGACY_RESOURCE_SCHEME,
]);

/**
 * Một protocol của URL (ví dụ "gbh-resource:" hoặc "dsh-resource:") có phải scheme resource không.
 * Nhận: protocol từ URL, có hoặc không có dấu ':' ở cuối; không phân biệt hoa/thường.
 * Trả: true khi là scheme MỚI hoặc scheme CŨ của DSH; false với mọi scheme khác.
 */
export function isResourceScheme(protocol: string): boolean {
  const bare = protocol.replace(/:$/u, "").toLowerCase();
  return bare === RESOURCE_SCHEME || bare === LEGACY_RESOURCE_SCHEME;
}

/**
 * Chuỗi địa chỉ có mở đầu bằng scheme resource (mới hoặc cũ) không.
 * Dùng cho nơi validate nhanh bằng tiền tố (ví dụ sidebarRight.placeResource).
 * Nhận: địa chỉ đầy đủ.
 * Trả: true khi bắt đầu bằng "gbh-resource://" hoặc "dsh-resource://" (không phân biệt hoa/thường).
 */
export function isResourceAddress(address: string): boolean {
  const lower = address.toLowerCase();
  return lower.startsWith(RESOURCE_SCHEME_PREFIX) || lower.startsWith(LEGACY_RESOURCE_SCHEME_PREFIX);
}

/**
 * Dựng địa chỉ resource bằng scheme MỚI — nơi PHÁT luôn dùng hàm này để không rải literal khắp nơi.
 * Nhận: protocol (host của URL, ví dụ "file") và phần còn lại của đường dẫn (có/không có "/" đầu).
 * Trả: địa chỉ "gbh-resource://<protocol>/<rest>" (rest rỗng thì bỏ dấu "/" cuối).
 */
export function resourceAddress(protocol: string, rest: string): string {
  const tail = rest.replace(/^\/+/, "");
  return RESOURCE_SCHEME_PREFIX + protocol + (tail === "" ? "" : "/" + tail);
}

/**
 * Hai khuôn glob cho tab registry: MỘT cho scheme mới (client phát), MỘT cho scheme cũ (địa chỉ lịch sử
 * hoặc plugin ngoài gửi tới). Thứ tự: mới trước — nơi khớp pattern không phụ thuộc thứ tự.
 * Nhận: protocol (ví dụ "file") và hậu tố khuôn (mặc định "**").
 * Trả: mảng hai chuỗi pattern.
 */
export function resourcePatterns(protocol: string, suffix = "**"): string[] {
  return [
    RESOURCE_SCHEME_PREFIX + protocol + "/" + suffix,
    LEGACY_RESOURCE_SCHEME_PREFIX + protocol + "/" + suffix,
  ];
}

/**
 * Regex nhận địa chỉ của MỘT protocol với CẢ HAI scheme, phần đuôi do người gọi quyết định.
 * Nhận: protocol và phần regex của đuôi (sau "<scheme>://<protocol>/").
 * Trả: RegExp neo đầu/cuối, chấp nhận cả "gbh-resource" và "dsh-resource".
 */
export function resourceAddressPattern(protocol: string, tail: string): RegExp {
  return new RegExp("^(?:" + RESOURCE_SCHEME + "|" + LEGACY_RESOURCE_SCHEME + "):\\/\\/" + protocol + "\\/" + tail + "$", "u");
}
