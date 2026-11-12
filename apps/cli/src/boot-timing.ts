/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Đo thời gian từng pha của `bh host` (bật bằng GBH_BOOT_TIMING=1): in một dòng mỗi mốc
 *      kèm số ms của pha và tổng ms từ lúc tiến trình bắt đầu, để so trước/sau khi tối ưu khởi động
 */

/**
 * Mốc thời gian của một pha trong lượt boot.
 */
export interface PhaseTiming {
  /** Tên pha, ví dụ `mount goi viet lai`. */
  name: string;
  /** Số ms của pha này (từ mốc trước tới mốc này). */
  ms: number;
  /** Số ms từ lúc tiến trình bắt đầu tới mốc này. */
  totalMs: number;
}

/** Mốc bắt đầu của cả lượt đo. */
const started = performance.now();

/** Mốc của lần gọi `phase()` gần nhất. */
let previous = started;

/** Các pha đã đo, theo thứ tự gọi. */
const phases: PhaseTiming[] = [];

/**
 * Cờ bật đo pha: `GBH_BOOT_TIMING=1` (hoặc `debug`) thì in ra stdout.
 * Nhận: không. Trả: true khi bật đo.
 */
export function bootTimingOn(): boolean {
  const value = (process.env.GBH_BOOT_TIMING ?? "").trim();
  return value === "1" || value === "debug";
}

/**
 * Ghi một mốc pha: đo ms từ mốc trước, lưu lại và in ra khi bật `GBH_BOOT_TIMING`.
 * Nhận: `name` — tên pha cần đánh dấu. Trả: đối tượng {@link PhaseTiming} của pha vừa đóng.
 * @param name - tên pha (ngắn, không dấu phẩy) để đọc trong bảng thời gian.
 * @returns pha vừa đo, gồm ms của pha và tổng ms từ lúc tiến trình bắt đầu.
 */
export function phase(name: string): PhaseTiming {
  const now = performance.now();
  const mark: PhaseTiming = { name, ms: now - previous, totalMs: now - started };
  previous = now;
  phases.push(mark);
  if (bootTimingOn()) {
    console.log("[bh] boot +" + mark.ms.toFixed(0) + "ms " + name + " (tong " + mark.totalMs.toFixed(0) + "ms)");
  }
  return mark;
}

/**
 * Chạy một hàm đồng bộ rồi đánh dấu pha của nó — dùng cho các bước nằm rải trong đường boot.
 * Nhận: `name` — tên pha; `run` — hàm cần chạy. Trả: giá trị hàm trả về (nguyên vẹn).
 * @param name - tên pha để in trong bảng thời gian.
 * @param run - hàm đồng bộ cần đo.
 * @returns giá trị mà `run` trả về.
 */
export function timePhase<T>(name: string, run: () => T): T {
  const value = run();
  phase(name);
  return value;
}

/**
 * Toàn bộ pha đã đo trong tiến trình này (dùng cho báo cáo/nghiệm thu).
 * Nhận: không. Trả: bản sao danh sách pha theo thứ tự đã đo.
 */
export function measuredPhases(): PhaseTiming[] {
  return phases.map((mark) => ({ ...mark }));
}

/**
 * Đặt lại mốc đo (dùng cho test; không dùng trong đường boot).
 * Nhận: không. Trả: không.
 */
export function resetTiming(): void {
  previous = performance.now();
  phases.length = 0;
}
