/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Tên HIỂN THỊ của route model cho biến prompt `{{model_label}}`: route quản lý `auto` đọc là
 *      "Galaxy Blackhole" (router tự chọn, không phải một model có tên), mọi route khác giữ id model thật
 *      người dùng đã chọn. Tách khỏi `{{model}}` (id trên dây) để persona không bao giờ in id kỹ thuật.
 */

/** Provider id của route do Galaxy quản lý (router tự chọn model). */
export const MANAGED_PROVIDER_ID = "auto";

/** Nhãn thương hiệu của route quản lý — persona đọc "powered by the Galaxy Blackhole model". */
export const MANAGED_ROUTE_LABEL = "Galaxy Blackhole";

/**
 * Nhãn hiển thị của một route cho prompt.
 * Nhận: provider — id provider của agent; model — id model trên dây.
 * Trả: "Galaxy Blackhole" cho route quản lý; id model thật cho route khác; undefined khi chưa có model.
 */
export function modelLabel(provider: string | undefined, model: string | undefined): string | undefined {
  if (model === undefined || model === "") return undefined;
  if (provider === MANAGED_PROVIDER_ID) return MANAGED_ROUTE_LABEL;
  return model;
}
