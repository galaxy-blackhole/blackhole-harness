/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tham số chạy của provider credentials cục bộ: tên tệp, cấu hình plugin và phép kiểm quyền
 *      chủ sở hữu duy nhất — tách khỏi lớp provider để mỗi tệp giữ dưới 1000 dòng
 */

import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalizeWatchPath, resolveDshHome } from "./paths.ts";

/** Tên tệp của tài liệu credentials bên trong home của harness. */
export const CREDENTIALS_FILENAME = ".credentials.yaml";

/** Cấu hình của plugin: vị trí tệp và cách nạp lại khi tệp đổi. */
export interface Config {
  /** Đường dẫn tài liệu credentials; mặc định là `CREDENTIALS_FILENAME` dưới home của harness. */
  path?: string;
  /** Home của harness dùng khi thiếu `path`; mặc định `$DSH_HOME` hoặc `~/.dsh`. */
  dshHome?: string;
  /** Theo dõi tệp và phát thay đổi do bên ngoài sửa; mặc định true. */
  watch?: boolean;
  /** Cửa sổ chờ tệp ghi xong của watcher, tính bằng mili giây; mặc định 100. */
  debounceMs?: number;
}

/** Tham số đã giải đầy đủ của provider; việc lấy mặc định xảy ra ở đây, không bao giờ rải trong thân. */
export interface ResolvedSpec {
  /** Đường dẫn tuyệt đối của tài liệu. */
  filename: string;
  /** Có theo dõi tệp hay không. */
  watch: boolean;
  /** Cửa sổ chờ ghi xong, tính bằng mili giây. */
  debounceMs: number;
}

/**
 * Giải tham số chạy từ cấu hình plugin: `path` nêu tường minh thì thắng, nếu không tài liệu nằm
 * tại `<home của harness>/.credentials.yaml`.
 * Nhận: cấu hình thô của plugin.
 * Trả: vị trí tệp và hành vi theo dõi đã giải.
 */
export function resolveSpec(config: Config): ResolvedSpec {
  return {
    filename: resolve(config.path ?? join(resolveDshHome(config.dshHome), CREDENTIALS_FILENAME)),
    watch: config.watch ?? true,
    debounceMs: config.debounceMs ?? 100,
  };
}

/** Bit quyền ngoài chủ sở hữu; một tài liệu credentials không được có bit nào trong số này. */
const GROUP_OTHER_BITS = 0o77;

/**
 * Từ chối một tài liệu credentials mà người dùng hệ điều hành khác đọc được, TRƯỚC khi nội dung
 * của nó được đọc. Provider tạo và thay tệp ở chế độ 0600, nhưng một tệp viết tay hoặc do công cụ
 * khác sinh ra mang whatever umask tạo ra nó, và việc âm thầm phục vụ bí mật từ một tệp ai cũng
 * đọc được sẽ làm chế độ quyền mà provider hứa trở nên vô nghĩa.
 *
 * Chỉ POSIX: Windows không có mode để soi — ACL của nó không diễn đạt được ở đây — nên phép kiểm
 * bị BỎ QUA thay vì làm giả, và sự bảo vệ tệp ở đó là những gì API tạo/thay tệp diễn đạt được.
 * Nhận: đường dẫn tuyệt đối của tài liệu.
 * Trả: không; ném lỗi khi cây thư mục không hợp lệ, hoặc tệp tồn tại với bit quyền nhóm/khác.
 */
export async function assertOwnerOnly(filename: string): Promise<void> {
  let mode: number;
  try {
    mode = (await stat(filename)).mode;
  } catch (error) {
    if (!isENOENT(error)) throw error;
    await canonicalizeWatchPath(filename);
    return;
  }
  if (process.platform === "win32") return;
  if ((mode & GROUP_OTHER_BITS) === 0) return;
  const octal = (mode & 0o777).toString(8);
  throw new Error(
    "credentials-local: " + filename + " is readable beyond its owner (mode " + octal + '); run "chmod 600 ' + filename + '" before starting again',
  );
}

/**
 * Một lỗi hệ thống tệp có nghĩa là VẮNG MẶT hay không; mọi lỗi khác ngoài ENOENT đều phải nổi lên.
 * Nhận: lỗi bắt được.
 * Trả: true khi lỗi mang mã ENOENT.
 */
export function isENOENT(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return code === "ENOENT";
}
