/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 23/11/2026
 * desc Nhật ký lỗi của harness con: mọi dòng lỗi được relay qua CLI cũng được GHI XUỐNG ĐĨA, kể cả khi
 *      host vẫn sống. Trước 23/11/2026 kernel chỉ ghi `startup-*.log` lúc CHẾT lúc khởi động, nên sự
 *      cố "plugin không activate nhưng host vẫn chạy" không để lại dấu vết nào (log mới nhất người
 *      dùng tìm được là của nhiều ngày trước), và mọi chẩn đoán đều mò.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** Dòng bị coi là LỖI (được ghi xuống đĩa): lỗi cứng, plugin không kích hoạt, RPC bị từ chối, module thiếu. */
const DONG_LOI = /\b(?:error|failed|failure|did not activate|cannot find module|withdrawn|ERR_[A-Z]+|AggregateError|EACCES|ENOENT)\b/iu;

/** Ngày dạng `YYYYMMDD` theo giờ máy, để xoay tệp theo ngày. */
function ngayHomNay(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${String(now.getFullYear())}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

/**
 * Ghi một dòng log của harness con xuống `<home>/logs/host-loi-<YYYYMMDD>.log`.
 * @param home - thư mục dữ liệu (`GBH_HOME`); tệp nằm trong `logs/` của nó.
 * @param line - dòng đã qua `brandLogLine`, không kèm newline.
 * @returns `true` khi dòng khớp mẫu lỗi và đã ghi; `false` khi bỏ qua (dòng thông tin thường).
 * @remarks Không bao giờ ném: ghi log hỏng không được phép làm sập boot.
 */
export function ghiLoiHost(home: string, line: string): boolean {
  if (!DONG_LOI.test(line)) return false;
  try {
    const dir = join(home, "logs");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, `host-loi-${ngayHomNay()}.log`), `${new Date().toISOString()} ${line}\n`, "utf8");
  } catch {
    return false;
  }
  return true;
}
