/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Bề mặt hiển thị của registry preset (subpath "./display" của stock): nhận biết preset dựng sẵn và
 *      soạn nhãn hiển thị. Bản gốc là @deepseek-ai/dsh-agent-preset-registry/lib/types/display.d.ts:33,40.
 */

/** Preset tối thiểu để soạn nhãn hiển thị (khớp hình dạng stock). */
export interface PresetDisplaySource {
  id: string;
  name?: string;
  description?: string;
}

/** Kết quả soạn nhãn hiển thị cho một preset. */
export interface PresetDisplayText {
  title: string;
  detail?: string;
}

/** Tập id preset dựng sẵn của gói (giữ nguyên danh sách của stock). */
const PRESET_DUNG_SAN: readonly string[] = ["standard", "minimal", "ptc", "cordis"];

/**
 * Cho biết một preset có phải preset DỰNG SẴN hay không.
 * Nhận: preset — nguồn hiển thị có id. Trả: true khi id thuộc tập dựng sẵn.
 * @param preset - preset cần kiểm.
 * @returns true nếu là preset dựng sẵn của gói.
 */
export function isBuiltInPreset(preset: PresetDisplaySource): boolean {
  return PRESET_DUNG_SAN.includes(preset.id);
}

/**
 * Soạn nhãn hiển thị (tiêu đề + mô tả) cho một preset, ưu tiên bản dịch của người dùng.
 * Nhận: preset — nguồn hiển thị; t — hàm dịch khoá của bộ từ điển. Trả: cặp tiêu đề/mô tả.
 * @param preset - preset cần soạn nhãn.
 * @param t - hàm dịch theo khoá từ điển của client.
 * @returns tiêu đề và mô tả đã soạn cho preset.
 */
export function presetDisplayText(
  preset: PresetDisplaySource,
  t: (key: string) => string,
): PresetDisplayText {
  const tieuDe = preset.name ?? t("preset." + preset.id + ".title");
  const moTa = preset.description ?? t("preset." + preset.id + ".description");
  return moTa ? { title: tieuDe, detail: moTa } : { title: tieuDe };
}
