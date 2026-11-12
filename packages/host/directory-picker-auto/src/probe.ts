/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Phép dò PATH cho binary chọn thư mục trên Linux (zenity/kdialog): một dữ kiện lấy MỘT LẦN lúc
 *      boot cho bộ giải, để host Linux không có binary vẫn giữ tương tác browse còn chạy được.
 */

import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

/** Các binary chọn thư mục mà backend native điều khiển được trên Linux (zenity, dự phòng KDialog). */
export const LINUX_CHOOSER_BINARIES: readonly string[] = Object.freeze(["zenity", "kdialog"]);

/**
 * Tiến trình hiện tại có được phép thực thi đường dẫn này không.
 * @param candidate - đường dẫn tuyệt đối hoặc đã ghép từ một mục PATH.
 * @returns true chỉ khi tệp tồn tại và có quyền thực thi.
 */
export function canExecute(candidate: string): boolean {
  try {
    accessSync(candidate, constants.X_OK);
  } catch {
    return false;
  }
  return true;
}

/**
 * Quét một giá trị PATH để tìm binary chọn thư mục của backend native trên Linux.
 * @param pathValue - giá trị biến môi trường PATH (vắng hoặc rỗng thì không quét gì).
 * @param isExecutable - vị từ kiểm quyền thực thi (mặc định {@link canExecute}; tiêm được để test tất định).
 * @returns true khi có thư mục PATH nào chứa binary chọn thư mục thực thi được.
 */
export function hasLinuxChooserBinary(pathValue: string | undefined, isExecutable: (candidate: string) => boolean): boolean {
  for (const dir of (pathValue ?? "").split(delimiter)) {
    if (dir === "") continue;
    for (const name of LINUX_CHOOSER_BINARIES) if (isExecutable(join(dir, name))) return true;
  }
  return false;
}
