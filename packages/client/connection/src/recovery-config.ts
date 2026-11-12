/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cấu hình phục hồi kết nối: kiểm đầu vào và cấp đủ mọi mặc định thời gian trước khi chạy
 */

/** Giá trị lớn nhất hợp lệ cho một bộ đếm thời gian (giới hạn của setTimeout). */
const MAX_TIMER_MS = 2147483647;

/** Nhịp phục hồi kết nối mà Host và bản client trong trang dùng chung. */
export interface ConnectionRecoveryConfig {
  /** Thời gian chờ cơ sở trước lần thử lại đầu tiên (ms). */
  backoffBaseMs?: number;
  /** Hệ số nhân của mỗi lần thử lại. */
  backoffFactor?: number;
  /** Trần thời gian chờ giữa hai lần thử lại (ms). */
  backoffMaxMs?: number;
  /** Ngưỡng cảnh báo khi một thế hệ chưa sẵn sàng (ms). */
  generationReadyWarnMs?: number;
  /** Ngưỡng bỏ cuộc khi một thế hệ chưa sẵn sàng (ms). */
  generationReadyTimeoutMs?: number;
}

/** Nhịp phục hồi đã đầy đủ, sau khi áp mặc định. */
export type ResolvedConnectionRecoveryConfig = Required<ConnectionRecoveryConfig>;

/** Mặc định của từng trường, đúng bằng mặc định bản gốc. */
const DEFAULTS: ResolvedConnectionRecoveryConfig = {
  backoffBaseMs: 500,
  backoffFactor: 2,
  backoffMaxMs: 10000,
  generationReadyWarnMs: 3000,
  generationReadyTimeoutMs: 15000,
};

/**
 * Kiểm một số nguyên dương trong khoảng cho phép.
 * @param value - giá trị cần kiểm.
 * @param name - tên trường (dùng trong thông điệp lỗi).
 * @param max - trần cho phép.
 * @returns số đã kiểm.
 * @throws RangeError khi giá trị không phải số nguyên dương trong khoảng.
 */
function natural(value: unknown, name: string, max = MAX_TIMER_MS): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError("connection recovery " + name + " must be a positive integer no greater than " + String(max));
  }
  return value;
}

/**
 * Kiểm đầu vào cấu hình phục hồi và cấp đủ mọi mặc định thời gian trước khi bắt đầu việc.
 * @param config - cấu hình của Host, dữ liệu khởi động trong trang, hoặc tham số trực tiếp.
 * @returns nhịp phục hồi đã kiểm và đầy đủ.
 * @throws RangeError khi một trường sai kiểu hoặc ngoài khoảng.
 */
export function resolveConnectionConfig(config: unknown = {}): ResolvedConnectionRecoveryConfig {
  const source = typeof config === "object" && config !== null && !Array.isArray(config) ? (config as ConnectionRecoveryConfig) : {};
  const resolved: ResolvedConnectionRecoveryConfig = {
    backoffBaseMs: source.backoffBaseMs === undefined ? DEFAULTS.backoffBaseMs : natural(source.backoffBaseMs, "backoffBaseMs"),
    backoffFactor: source.backoffFactor === undefined ? DEFAULTS.backoffFactor : (() => {
      if (typeof source.backoffFactor !== "number" || !Number.isFinite(source.backoffFactor)) {
        throw new RangeError("connection recovery backoffFactor must be a finite number");
      }
      if (source.backoffFactor < 1) throw new RangeError("connection recovery backoffFactor must be at least 1");
      return source.backoffFactor;
    })(),
    backoffMaxMs: source.backoffMaxMs === undefined ? DEFAULTS.backoffMaxMs : natural(source.backoffMaxMs, "backoffMaxMs"),
    generationReadyWarnMs: source.generationReadyWarnMs === undefined ? DEFAULTS.generationReadyWarnMs : natural(source.generationReadyWarnMs, "generationReadyWarnMs"),
    generationReadyTimeoutMs: source.generationReadyTimeoutMs === undefined ? DEFAULTS.generationReadyTimeoutMs : natural(source.generationReadyTimeoutMs, "generationReadyTimeoutMs"),
  };
  if (!Number.isFinite(resolved.backoffFactor)) throw new RangeError("connection recovery backoffFactor must be finite");
  return resolved;
}
