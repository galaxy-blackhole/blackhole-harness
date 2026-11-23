/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 23/11/2026
 * desc Cổng log CHẨN ĐOÁN của agent-preset (probe · inject · fiber · task-204): mặc định IM LẶNG để log
 *      khởi động chỉ còn dòng `[bh] ready`; bật lại bằng GBH_LOG=debug hoặc cờ --verbose của `bh host`.
 */

/** Các giá trị GBH_LOG được coi là bật chẩn đoán (so sau khi trim + hạ chữ thường). */
const GIA_TRI_BAT: readonly string[] = ["debug", "verbose", "trace", "1", "true", "yes"];

/**
 * Chẩn đoán khởi động có bật không.
 * Nhận: không (đọc GBH_LOG của tiến trình đang chạy).
 * Trả: true khi GBH_LOG là debug/verbose/trace/1/true/yes; mặc định false (im lặng).
 */
export function bootLogOn(): boolean {
  return GIA_TRI_BAT.includes((process.env.GBH_LOG ?? "").trim().toLowerCase());
}

/**
 * In MỘT dòng chẩn đoán của preset.
 * Nhận: dong — dòng cần in (không kèm newline).
 * Trả: không; bỏ qua hoàn toàn ở mức log mặc định.
 */
export function bootLog(dong: string): void {
  if (bootLogOn()) console.log(dong);
}
