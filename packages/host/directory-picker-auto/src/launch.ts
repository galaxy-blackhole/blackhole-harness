/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Dữ kiện SSH lúc khởi động: đọc ảnh chụp môi trường của launcher qua Context (khoá
 *      `launchEnvironment`), chỉ xét LỚP TIẾN TRÌNH — giá trị trong .env của dự án/người dùng
 *      không bao giờ tạo ra một phiên SSH.
 */

/**
 * Ảnh chụp môi trường lúc khởi động, chỉ phần mà row này cần (tra theo tên biến và lớp nguồn).
 * Định nghĩa theo hình dạng thật của launcher để không phải import gói ngoài bảng §3b.
 */
export interface LaunchEnvironmentLike {
  /** Tra một biến trong đúng các lớp nguồn đã nêu. */
  getFrom(name: string, sources: readonly string[]): { value?: string } | undefined;
}

/**
 * Lấy ảnh chụp môi trường của launcher, hoặc môi trường kế thừa làm lớp duy nhất khi host không cấp.
 * @param ctx - context của plugin.
 * @returns ảnh chụp để tra các giá trị hướng người dùng.
 */
export function launchEnvironmentOf(ctx: unknown): LaunchEnvironmentLike {
  const get = (ctx as { get?: (name: string) => unknown }).get;
  const snapshot = typeof get === "function" ? (get.call(ctx, "launchEnvironment") as LaunchEnvironmentLike | undefined) : undefined;
  if (snapshot !== undefined && snapshot !== null && typeof snapshot.getFrom === "function") return snapshot;
  // Không có ảnh chụp: môi trường kế thừa là lớp duy nhất, đúng như launcher làm.
  return {
    getFrom: (name: string) => (process.env[name] === undefined ? undefined : { value: process.env[name] }),
  };
}

/**
 * Phát hiện SSH từ SSH_CONNECTION hoặc SSH_TTY khác rỗng, kế thừa lúc khởi động.
 * @param environment - ảnh chụp môi trường của launcher.
 * @returns true khi lớp TIẾN TRÌNH mang một trong hai dấu hiệu SSH.
 */
export function launchedThroughSsh(environment: LaunchEnvironmentLike): boolean {
  return ["SSH_CONNECTION", "SSH_TTY"].some((name) => {
    const value = environment.getFrom(name, ["process"])?.value;
    return value !== undefined && value !== "";
  });
}
