/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hằng số + schema cấu hình + bộ kiểm giá trị của tool-workspace-dependencies, chép nguyên văn vùng
 *      lib/types/index.js của bundle gốc: name · inject · Config (schemastery) · VERSION · PLATFORMS · isVersion · isRecord · isDistributionMap.
 */

import z from "@deepseek-ai/schemastery";

/**
 * Tên plugin cordis — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: chuỗi "tool-workspace-dependencies".
 */
export const name = "tool-workspace-dependencies";

/**
 * Sổ mà tool đăng ký vào — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: mảng một phần tử ["tools"].
 */
export const inject: string[] = ["tools"];

/**
 * Cấu hình của row — NGUYÊN VĂN interface `Config` trong lib/types/index.d.ts của bản gốc:
 * `source` bắt buộc, `root` tuỳ chọn. Cùng tên với const `Config` bên dưới (hai không gian khai báo),
 * đúng như bản gốc khai `interface Config` + `declare const Config: z<Config>`.
 * Nhận: không (đây là kiểu).
 * Trả: hình dạng cấu hình mà `apply` nhận.
 */
export interface Config {
  /** Thư mục payload chứa `runtime.json` và `dependencies/`. */
  readonly source: string;
  /**
   * Thư mục cài dưới Harness home. Khi có, payload được chép tới đó ở lần gọi đầu (hành vi Desktop);
   * khi vắng, payload được dùng tại chỗ, không chép — hợp với carrier chỉ đọc như lớp ảnh container.
   */
  readonly root?: string;
}

/**
 * Schema cấu hình của row — NGUYÊN VĂN `const Config = z.object({...})` của bundle gốc:
 * `source` bắt buộc và không rỗng, `root` tuỳ chọn và không rỗng; giữ nguyên thứ tự trường.
 * Loader điền mặc định bằng chính schema này trước khi gọi `apply`.
 * Nhận: value — cấu hình thô (có thể thiếu, null hoặc sai kiểu).
 * Trả: cấu hình đã kiểm; thiếu `source` hoặc chuỗi rỗng thì ném ValidationError.
 * @throws {Error} ValidationError khi `source` vắng/rỗng hoặc `root` rỗng.
 */
export const Config = z.object({
  source: z.string().min(1).required(),
  root: z.string().min(1),
});

/**
 * Dạng giá trị cấu hình sau khi schema điền — suy TỪ chính `Config`, không chép tay.
 * Nhận: không (đây là kiểu).
 * Trả: kiểu mà `Config` sinh ra, dùng làm tham số `config` của `apply`.
 */
export type ConfigValues = ReturnType<typeof Config>;

/**
 * Mẫu phiên bản đầy đủ — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: RegExp neo hai đầu, nhận `x.y.z` kèm hậu tố `-…` hoặc `+…`.
 */
export const VERSION = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/u;

/**
 * Ba nền tảng payload hợp lệ — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: mảng ["win32", "darwin", "linux"] đúng thứ tự.
 */
export const PLATFORMS = [
  "win32",
  "darwin",
  "linux",
];

/**
 * Kiểm một giá trị có phải chuỗi phiên bản hợp lệ.
 * Nhận: value — giá trị chưa tin.
 * Trả: true khi là chuỗi khớp `VERSION`; ngược lại false.
 */
export function isVersion(value: unknown): value is string {
  return typeof value === "string" && VERSION.test(value);
}

/**
 * Kiểm một giá trị có phải bản ghi thuần (không mảng, không null).
 * Nhận: value — giá trị chưa tin.
 * Trả: true khi là object không null và không phải mảng.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Kiểm bản đồ distribution Python: tên và phiên bản đều đúng mẫu của bản gốc.
 * Nhận: value — giá trị chưa tin (thường là `pythonPackages` trong runtime.json).
 * Trả: true khi mọi cặp tên→phiên bản khớp mẫu; ngược lại false.
 */
export function isDistributionMap(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.entries(value).every(([name, version]) =>
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(name) &&
    typeof version === "string" &&
    /^\d[\w.!+-]*$/u.test(version),
  );
}
