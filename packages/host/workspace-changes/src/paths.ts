/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Phân loại và tạo dạng hiển thị cho đường dẫn tệp thay đổi: quy về slash, kiểm tra nằm trong gốc,
 *      chuẩn hoá qua symlink, nhận diện vùng tạm, sinh dạng hiển thị/bền vững và thứ tự so sánh.
 */
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";

/**
 * Dạng dùng dấu slash của một đường dẫn tương đối kiểu hệ điều hành.
 * Nhận: path — đường dẫn kiểu hệ điều hành.
 * Trả: chính đường dẫn đó với dấu phân cách "/".
 */
export function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/**
 * Cho biết `path` chính là `root` hay nằm bên trong nó.
 * Nhận: root — thư mục tuyệt đối; path — đường dẫn tuyệt đối cần kiểm.
 * Trả: true cho chính gốc và mọi đường dẫn con.
 */
export function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Các cách viết chuẩn tắc của những thư mục tạm mà sandbox workspace-write cấp: `/tmp` của máy chủ
 * và vùng tạm của nền tảng, mỗi thứ kèm dạng đã giải symlink để `/tmp` và `/private/tmp` khớp như nhau.
 * Nhận: candidates — các thư mục cần chuẩn hoá (mặc định: `/tmp` và os.tmpdir()).
 * Trả: danh sách đường dẫn thư mục tuyệt đối (đã loại trùng).
 */
export async function temporaryRoots(candidates: readonly string[] = ["/tmp", tmpdir()]): Promise<string[]> {
  const roots = new Set<string>();
  for (const root of candidates) {
    roots.add(root);
    roots.add(await canonicalPath(root));
  }
  return [...roots];
}

/**
 * Đường dẫn đã giải symlink. Đường dẫn chưa tồn tại được giải qua tổ tiên gần nhất còn tồn tại,
 * nên một tệp tạo ra xuyên qua symlink thư mục có cùng cách viết chuẩn trước và sau khi nó tồn tại.
 * Nhận: path — đường dẫn tuyệt đối.
 * Trả: cách viết chuẩn tắc mà git báo cho đường dẫn đó.
 */
export async function canonicalPath(path: string): Promise<string> {
  const missing: string[] = [];
  let head = path;
  while (true) {
    try {
      return join(await realpath(head), ...missing);
    } catch {
      // Thành phần thiếu hoặc không đọc được được giữ nguyên theo từ vựng dưới tổ tiên gần nhất
      // giải được; đường dẫn không còn tổ tiên nào ngoài gốc thì giữ nguyên cách viết ban đầu.
      const parent = dirname(head);
      if (parent === head || dirname(parent) === parent) return path;
      missing.unshift(basename(head));
      head = parent;
    }
  }
}

/**
 * Cho biết một tệp có nằm dưới một gốc tạm hay không — nơi mô hình giữ việc nháp.
 * Nhận: path — đường dẫn tệp tuyệt đối; roots — kết quả của {@link temporaryRoots}.
 * Trả: true cho đường dẫn nháp, loại không bao giờ vào bản tóm tắt thay đổi.
 */
export function isTemporaryPath(path: string, roots: readonly string[]): boolean {
  return roots.some((root) => isInside(root, path));
}

/**
 * Khoá sắp xếp và nhãn hiển thị của một tệp thay đổi; xem `WorkspaceChangedFile.display`.
 * Nhận: absolute — đường dẫn tệp tuyệt đối đã chuẩn hoá; cwd — thư mục làm việc của Session đã chuẩn hoá;
 * root — thư mục gốc repo; home — thư mục home đã chuẩn hoá, hoặc chuỗi rỗng để bỏ dạng `~`.
 * Trả: đường dẫn hiển thị dạng slash.
 */
export function displayPathOf(absolute: string, cwd: string, root: string, home: string): string {
  if (isInside(cwd, absolute) || isInside(root, absolute)) return toPosix(relative(cwd, absolute));
  if (home !== "" && isInside(home, absolute)) return `~/${toPosix(relative(home, absolute))}`;
  return toPosix(absolute);
}

/**
 * Trường `path` bền vững: tương đối khi nằm trong thư mục làm việc, tuyệt đối khi ở nơi khác.
 * Nhận: absolute — đường dẫn tệp tuyệt đối đã chuẩn hoá; cwd — thư mục làm việc của Session đã chuẩn hoá.
 * Trả: đường dẫn mà client Web dùng để mở tệp.
 */
export function durablePathOf(absolute: string, cwd: string): string {
  return isInside(cwd, absolute) ? toPosix(relative(cwd, absolute)) : absolute;
}

/**
 * Thứ tự theo đơn vị mã của đường dẫn hiển thị, đặt `../` và đường dẫn tuyệt đối trước chữ cái
 * và khớp thứ tự liệt kê của git cho đường dẫn tương đối.
 * Nhận: a — tệp thứ nhất; b — tệp thứ hai (chỉ cần trường display).
 * Trả: số âm, không, hoặc dương đúng như `Array.prototype.sort` mong đợi.
 */
export function compareDisplay(a: { display: string }, b: { display: string }): number {
  return a.display < b.display ? -1 : a.display > b.display ? 1 : 0;
}
