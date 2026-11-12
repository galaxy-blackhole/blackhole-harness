/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Phân loại GỐC của một bundle cho trang Plugins: plugin do NGƯỜI DÙNG cài/chọn hay thành phần LÕI
 *      đi kèm bản cài DSH. 11/11/2026 (Lead đo: "Plugin đã cài" liệt kê gói lõi stock kèm badge đỏ): tách
 *      phép phân loại ra hàm THUẦN để host trả cờ `origin` và test gọi thẳng, không phải dựng Context.
 */

/** Nguồn gốc một bundle mà Host trả cho client. */
export type BundleOrigin = "user" | "core";

/** Ba dấu hiệu mà phép phân loại đọc. */
export interface OriginSignals {
  /** Bản cài DSH khai gói này là phụ thuộc của CHÍNH NÓ (gói đi kèm bản cài, không do người dùng cài). */
  shipped: boolean;
  /** Profile khai gói này trong `dependencies` — người dùng đã cài nó vào hồ sơ. */
  installed: boolean;
  /** Profile đang CHỌN lớp bundle này (`dsh.profile.bundles`). */
  enabled: boolean;
}

/**
 * Phân loại gốc của một bundle.
 *
 * "core" = gói đến từ BẢN CÀI (kernel/stock) mà profile không cài cũng không chọn: nó là thành phần lõi, không
 * phải plugin người dùng. Mọi trường hợp còn lại là "user".
 *
 * Vì sao cần cờ này (đo 11/11/2026): `listBundles` liệt kê cả phụ thuộc của bản cài, nên trang Plugins đẩy
 * `@deepseek-ai/dsh-terminal` (gói lõi, KHÔNG phải bundle) vào nhóm "Plugin đã cài" kèm badge đỏ "Trục trặc".
 * @param signals - ba dấu hiệu `shipped`/`installed`/`enabled` của gói.
 * @returns "core" khi gói chỉ đến từ bản cài; ngược lại "user".
 */
export function bundleOrigin(signals: OriginSignals): BundleOrigin {
  return signals.shipped && !signals.installed && !signals.enabled ? "core" : "user";
}

/**
 * Gói này có đang được profile CHỌN như một lớp bundle không.
 *
 * Chỉ gói thật sự khai `dsh.bundle` mới trả lời được câu đó: gói không khai bundle (ví dụ
 * `@deepseek-ai/dsh-terminal`) không bao giờ là một lớp bundle, nên phép so danh tính lớp
 * (`laCungBundle`, khớp theo KHOÁ TÍNH NĂNG) KHÔNG được áp cho nó. Trước 11/11/2026 phép so vẫn áp, và
 * `gbh-terminal-bundle` (khoá "terminal") khớp với `@deepseek-ai/dsh-terminal` (cũng khoá "terminal")
 * ⇒ host tưởng gói lõi ấy "đang bật" ⇒ trả về một dòng lỗi `not-bundle` mà nó không mount được row nào.
 * @param declaresBundle - gói có khai `dsh.bundle` không.
 * @param matches - phép so danh tính lớp bundle với các tên trong `dsh.profile.bundles`.
 * @returns true khi gói là bundle VÀ profile đang chọn nó.
 */
export function isBundleEnabled(declaresBundle: boolean, matches: boolean): boolean {
  return declaresBundle && matches;
}
