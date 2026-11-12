/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Suy ra GỐC GHI ĐƯỢC dùng chung cho mọi phương ngữ cưỡng chế diễn đạt chế độ bằng danh sách cho phép
 *      canonical: `workspace-write` = gốc workspace + vùng tạm nền tảng — port 1:1 lib/types/roots.js
 */

import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";

import type { SandboxExecutionPolicy } from "./types.ts";

/**
 * Giải một gốc ĐÃ CẤP về đường dẫn mà tầng cưỡng chế THẬT SỰ so: canonical (đã giải symlink), vì cả bộ lọc
 * Seatbelt lẫn phép kiểm containment của hàng rào fs đều so đường đã giải — `/tmp` LÀ `/private/tmp` trên
 * darwin, và một cấp phép như-đã-viết sẽ không khớp gì.
 * Nhận: path — gốc theo cấu hình hoặc theo nền tảng báo.
 * Trả: đường canonical, hoặc ĐÚNG như đã viết khi giải thất bại (gốc không tồn tại thì không khớp gì —
 *        kết cục bảo thủ; bịa một fallback sẽ cấp một đường bên gọi chưa từng nêu tên).
 */
export function canonicalPath(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}

/**
 * Các gốc mà MỘT lượt chạy bị cầm giữ được GHI dưới — nghĩa của chế độ dưới dạng danh sách cho phép canonical,
 * đã KHỬ TRÙNG. `read-only` không cho gì; `workspace-write` cho gốc workspace của chính sách, `/tmp` của
 * host, và thư mục tạm nền tảng theo NGƯỜI DÙNG (`os.tmpdir()` — vùng tạm thật của họ công cụ mkstemp;
 * bỏ nó sẽ từ chối đúng thứ chế độ này hứa).
 * Nhận: policy — chính sách file-effect cần suy danh sách cho phép.
 * Trả: các gốc ghi được đã canonical; RỖNG đúng khi `read-only`.
 */
export function writableRoots(policy: SandboxExecutionPolicy): string[] {
  if (policy.mode !== "workspace-write") return [];
  return [...new Set([policy.workspaceRoot, "/tmp", tmpdir()].map(canonicalPath))];
}
