/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Từ vựng của gói config-editor: lượt ghi cấu hình, row patch, và seam HMR nhìn qua góc hẹp.
 *   11/11/2026 — thêm `HmrSeam.applyPatches`: đường áp patch SỐNG của hồ sơ (gói hmr cài đặt) để lượt ghi
 *   cấu hình không chết ở WeakMap `bootstrapIncludes` của kernel — xem service.ts.
 */

/**
 * Một lượt ghi cấu hình THÔ: nhận config hiện tại của entry và config THỪA KẾ từ các lớp dưới,
 * trả về config THÔ kế tiếp mà tệp patch của profile phải chứa.
 */
export type ConfigChange = (
  current: Record<string, unknown>,
  inherited: Record<string, unknown>,
) => Record<string, unknown>;

/** Khoá nhận dạng một row trong tệp patch — đúng hai trường mà `entry.options` cấp. */
export interface PatchRowIdentity {
  /** Id row trong cây Loader (= id trong tệp patch của profile). */
  id: string;
  /** Specifier của plugin mà row trỏ tới. */
  name: string;
}

/**
 * Seam HMR (`ctx.get("hmr")`) nhìn qua góc hẹp: gói này chỉ cần chạy độc quyền MỘT lượt ghi,
 * nên không nạp gói hmr và không phụ thuộc bề mặt đầy đủ của nó.
 */
export interface HmrSeam {
  /**
   * Chạy `run` sao cho không lượt HMR nào khác chen vào giữa.
   * @param run - thân lượt ghi cần chạy độc quyền.
   * @returns kết quả của `run`.
   */
  runExclusive<T>(run: () => Promise<T>): Promise<T>;
  /**
   * Áp một danh sách patch của profile vào entry Include ĐANG CHẠY (3 bước cuối của kernel recompose).
   * Vắng ở bản hmr cũ ⇒ người gọi rơi về đường kernel `reconcileProfilePatches` (giữ nguyên hành vi cũ).
   * @param patches - danh sách patch đầy đủ của lượt này.
   * @param requiredIds - id entry mà trạng thái inactive sau lượt áp là lỗi.
   * @returns `{ warnings }`, hoặc undefined khi không tìm thấy entry Include.
   */
  applyPatches?(patches: readonly unknown[], requiredIds?: readonly string[]): Promise<{ warnings: readonly string[] } | undefined>;
}
