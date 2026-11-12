/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chuẩn tắc hoá đường dẫn cho DANH TÍNH workspace (bản gốc: lib/types/paths.js): MỘT chuẩn duy
 *      nhất — `fs.realpath` của một đường dẫn tuyệt đối — cộng hai hàm phụ trợ dùng lại trong gói.
 */
import { realpath } from "node:fs/promises";
import { posix, win32 } from "node:path";

/**
 * Đường dẫn có đặt tên MỘT VỊ TRÍ CỐ ĐỊNH của máy chủ (không phụ thuộc cwd tiến trình hay ổ hiện tại)?
 * Nhận: đường dẫn ứng viên và nền tảng — mặc định nền tảng đang chạy, tham số cho phép test tất định.
 * Trả: `true` khi đường dẫn tuyệt đối trên nền tảng đó; trên win32 còn đòi gốc là ổ CỤ THỂ (một
 * đường dẫn bắt đầu bằng "" hoặc "/" vẫn phụ thuộc ổ hiện tại nên bị từ chối).
 */
export function fullyQualifiedWorkspacePath(path: string, platform: NodeJS.Platform = process.platform): boolean {
  if (platform !== "win32") return posix.isAbsolute(path);
  const root = win32.parse(path).root;
  return win32.isAbsolute(path) && root !== "\\" && root !== "/";
}

/**
 * Suy tiêu đề mặc định KHÔNG RỖNG từ một đường dẫn workspace đã chuẩn tắc.
 * Nhận: đường dẫn đã chuẩn tắc và nền tảng (mặc định nền tảng đang chạy).
 * Trả: đoạn cuối của đường dẫn khi có; đường dẫn chỉ là gốc thì trả CHÍNH cách viết gốc đó (nhờ vậy
 * tiêu đề không bao giờ rỗng).
 */
export function defaultWorkspaceTitle(path: string, platform: NodeJS.Platform = process.platform): string {
  const pathApi = platform === "win32" ? win32 : posix;
  return pathApi.basename(path) || pathApi.parse(path).root;
}

/**
 * Chuẩn tắc hoá một đường dẫn thư mục tuyệt đối qua `fs.realpath`: dấu gạch chéo cuối, đoạn `..`, và
 * mọi symlink đều được giải. Đây là CHUẨN DUY NHẤT về tính duy nhất của gói — đường dẫn workspace
 * được lưu ở dạng đã chuẩn tắc, hai đường dẫn là "cùng một chỗ" khi và chỉ khi chuỗi đã chuẩn tắc bằng
 * nhau (một symlink trỏ vào thư mục của workspace đã có sẽ ĐỤNG), và phép kiểm `cwd` lúc gắn phiên đi
 * qua đúng chuẩn này.
 *
 * Đường dẫn TƯƠNG ĐỐI bị từ chối TRƯỚC khi `realpath` kịp giải nó theo cwd của Host hay ổ hiện tại
 * của Windows. Đường dẫn KHÔNG TỒN TẠI bị từ chối bằng chính `ENOENT` gốc — đó là đường từ chối của
 * `create` (một workspace phải trỏ vào thư mục CÓ THẬT).
 * Nhận: đường dẫn cần chuẩn tắc.
 * Trả: promise của đường dẫn tuyệt đối đã chuẩn tắc; NÉM `TypeError` khi đường dẫn không tuyệt đối.
 */
export async function realpathNormalize(path: string): Promise<string> {
  if (!fullyQualifiedWorkspacePath(path)) throw new TypeError(`Workspace path is not fully qualified: '${path}'`);
  return await realpath(path);
}
