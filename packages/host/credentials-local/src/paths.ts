/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hai helper đường dẫn TỰ VIẾT (thay peer `dsh-home-paths` — gói ngoài bảng §3b của recipe):
 *      home của harness theo `$DSH_HOME` và đường dẫn chuẩn hoá cho watcher
 */

import { opendir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

/** Biến môi trường ghi đè home của harness. */
const DSH_HOME_ENV = "DSH_HOME";

/** Tên thư mục home mặc định dưới home của hệ điều hành. */
const DSH_HOME_DIR_NAME = ".dsh";

/**
 * Mở rộng tiền tố `~` theo home của hệ điều hành.
 * Nhận: đường dẫn cấu hình, có thể bắt đầu bằng `~`, `~/` hoặc `~` + dấu chéo ngược (kiểu Windows).
 * Trả: đường dẫn đã mở rộng, hoặc nguyên giá trị khi không có tiền tố được hỗ trợ.
 */
function expandHomePath(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
  return path;
}

/**
 * Home mặc định của harness dưới home của hệ điều hành.
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối `~/.dsh`.
 */
export function defaultDshHome(): string {
  return join(homedir(), DSH_HOME_DIR_NAME);
}

/**
 * Home của harness theo thứ tự ưu tiên: đường dẫn cấu hình → `$DSH_HOME` → `~/.dsh`.
 * Một `$DSH_HOME` rỗng hoặc chỉ có khoảng trắng được coi như không đặt, nên giá trị trống
 * không bao giờ kéo home về thư mục làm việc hiện tại.
 * Nhận: đường dẫn cấu hình (ưu tiên cao nhất) và bảng biến môi trường cần đọc.
 * Trả: đường dẫn tuyệt đối đã chuẩn hoá.
 */
export function resolveDshHome(configured?: string, env: Record<string, string | undefined> = process.env): string {
  const fromEnv = env[DSH_HOME_ENV];
  const fallback = fromEnv !== undefined && fromEnv.trim().length > 0 ? fromEnv : defaultDshHome();
  return resolve(expandHomePath(configured ?? fallback));
}

/**
 * Cho watcher của hệ điều hành MỘT cách viết chuẩn của đường dẫn, kể cả khi các thành phần
 * cuối chưa tồn tại: tổ tiên sâu nhất còn tồn tại được giải qua `realpath`, và khi có phần
 * đuôi còn thiếu thì tổ tiên đó còn phải chứng minh được nó là thư mục liệt kê được.
 * Nhận: đường dẫn đích (tương đối thì tính theo thư mục làm việc hiện tại).
 * Trả: đường dẫn đích với tổ tiên tồn tại đã được chuẩn hoá.
 * @throws khi gặp lỗi khác ngoài "không tồn tại", hoặc tổ tiên của phần đuôi thiếu không phải thư mục.
 */
export async function canonicalizeWatchPath(path: string): Promise<string> {
  let current = resolve(path);
  const missing: string[] = [];
  for (;;) {
    try {
      const canonical = await realpath(current);
      if (missing.length > 0) await (await opendir(canonical)).close();
      return join(canonical, ...missing.reverse());
    } catch (error) {
      if ((error as { code?: string }).code !== "ENOENT") throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      missing.push(basename(current));
      current = parent;
    }
  }
}
