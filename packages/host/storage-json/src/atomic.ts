/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ghi-đè NGUYÊN TỬ cho backend JSON: tệp tạm cùng thư mục ⇒ fsync ⇒ rename() đè lên đích
 *      (bản gốc: lib/types/atomic.d.ts)
 */
import { randomUUID } from "node:crypto";
import { open, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Ghi-đè BỀN `path` bằng `data`.
 *
 * Giao thức công bố: ghi một tệp tạm CÙNG THƯ MỤC, fsync nó, rồi `rename()` đè lên đích. Rename là
 * thay-thế nguyên tử trên POSIX và trên Windows (libuv ánh xạ thành
 * `MoveFileExW(..., MOVEFILE_REPLACE_EXISTING)`), và thay-thế đúng là ngữ nghĩa cần ở đây — khác giao
 * thức link()+unlink() không-đè của backend session-log, một tệp đơn vị chỉ có ĐÚNG MỘT người ghi mỗi
 * tiến trình nên "lượt ghi sau thắng" là đúng. Sau rename, thư mục cha được fsync trên POSIX để mục
 * mới bền qua sự cố.
 * Nhận: đường dẫn tuyệt đối của tệp đích và toàn bộ nội dung mới.
 * Trả: promise phân giải sau khi lượt thay-thế đã bền qua sự cố.
 */
export async function writeAtomic(path: string, data: string): Promise<void> {
  const tmp = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    const handle = await open(tmp, "wx", 0o600);
    try {
      await handle.writeFile(data, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tmp, path);
    await fsyncDirectory(dirname(path));
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

/**
 * fsync một THƯ MỤC POSIX để mục vừa rename là bền qua sự cố.
 * Nhận: đường dẫn thư mục cần fsync.
 * Trả: promise phân giải khi thư mục đã bền; trên Windows trả ngay (mở thư mục O_RDONLY bị từ chối).
 */
async function fsyncDirectory(path: string): Promise<void> {
  if (process.platform === "win32") return;
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
