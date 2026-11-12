/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Dia chi \`gbh-resource://file/...\` (nhan ca scheme cu) + tien ich duong dan workspace (ban browser) — viet lai theo hanh vi
 */

/** Sơ đồ và tiền tố của mọi địa chỉ tệp. */
// 18/10/2026 (task-29, Wave D): PHAT scheme moi gbh-resource:// (ban goc: dsh-resource://); noi nhan
//   chap nhan ca hai scheme.
const FILE_ADDRESS_PREFIX = "gbh-resource://file/";

/**
 * Kiểu đường dẫn mà người dùng chọn trong hộp thoại `@`.
 */
export interface MentionCandidate {
  /** Đường dẫn tuyệt đối hoặc tương đối workspace. */
  path: string;
  /** `file` hoặc `directory`. */
  kind: "file" | "directory";
}

/**
 * Encode một đoạn id/đường dẫn, giữ dấu `:` cho ký tự ổ đĩa Windows.
 * Nhận: `segment` — một đoạn giữa hai dấu `/`.
 * Trả: đoạn đã encode.
 */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%3A/giu, ":");
}

/**
 * Encode đường dẫn theo từng đoạn `/`.
 * Nhận: `path` — đường dẫn dùng dấu `/`.
 * Trả: đường dẫn đã encode.
 */
function encodePath(path: string): string {
  return path.split("/").map(encodeSegment).join("/");
}

/**
 * Địa chỉ đọc một tệp qua MỘT phiên: Host dùng workspace của phiên đó để phân giải.
 * Nhận: `sessionId` — phiên, `path` — đường dẫn tuyệt đối hoặc tương đối workspace.
 * Trả: địa chỉ `gbh-resource://file/session/<sessionId>/<path>` (đã chuẩn hoá `\` → `/`, bỏ tiền tố `./`).
 */
export function sessionFileAddress(sessionId: string, path: string): string {
  const normalized = path.replace(/\\/gu, "/").replace(/^(?:\.\/)+/u, "");
  return FILE_ADDRESS_PREFIX + "session/" + encodeSegment(sessionId) + "/" + encodePath(normalized);
}

/**
 * Đường dẫn có phải kiểu Windows (ổ đĩa hoặc UNC) không.
 * Nhận: `value` — đường dẫn.
 * Trả: true khi là kiểu Windows.
 */
export function isWindowsStylePath(value: string): boolean {
  return /^[A-Za-z]:[/\\]/u.test(value) || value.startsWith("\\\\");
}

/**
 * Đường dẫn có phải tuyệt đối theo cách Host chấp nhận (POSIX hoặc Windows) không.
 * Nhận: `path` — đường dẫn.
 * Trả: true nếu tuyệt đối, false nếu tương đối workspace.
 */
export function isAbsoluteWorkspacePath(path: string): boolean {
  return path.startsWith("/") || isWindowsStylePath(path);
}

/**
 * Rút gọn thư mục home POSIX để hiển thị.
 * Nhận: `path` — đường dẫn tuyệt đối (hoặc đường dẫn đã rút gọn), `home` — home của tài khoản Host.
 * Trả: `~` hoặc `~/…` cho home và con cháu; ngược lại trả nguyên `path`.
 */
export function abbreviateHomePath(path: string, home: string | undefined): string {
  if (home === undefined || home === "") return path;
  if (isWindowsStylePath(path) || isWindowsStylePath(home)) return path;
  const root = home.replace(/\/+$/u, "");
  if (root === "" || root === "/") return path;
  if (path.replace(/\/+$/u, "") === root) return "~";
  if (path.startsWith(root + "/")) return "~" + path.slice(root.length);
  return path;
}

/**
 * Địa chỉ của một đường dẫn theo cách người gọi đang giữ: tương đối, hoặc tuyệt đối NẰM TRONG workspace
 * của phiên ⇒ địa chỉ theo phiên; tuyệt đối ngoài workspace (hoặc chưa biết gốc) ⇒ giữ nguyên đường dẫn
 * tuyệt đối trong địa chỉ của phiên đó.
 * Nhận: `sessionId` — phiên đọc tệp, `cwd` — gốc workspace của phiên (nếu biết), `path` — đường dẫn.
 * Trả: địa chỉ `gbh-resource://file/…`.
 */
export function fileAddressFor(sessionId: string, cwd: string | undefined, path: string): string {
  const normalized = path.replace(/\\/gu, "/");
  if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized);
  const root = cwd === undefined ? "" : cwd.replace(/\\/gu, "/").replace(/\/+$/u, "");
  if (root !== "" && normalized === root) return sessionFileAddress(sessionId, "");
  if (root !== "" && normalized.startsWith(root + "/")) {
    return sessionFileAddress(sessionId, normalized.slice(root.length + 1));
  }
  return sessionFileAddress(sessionId, normalized);
}

/**
 * Định dạng một đường dẫn đã chọn thành văn bản nhắc. Đường dẫn có khoảng trắng dùng cú pháp
 * `@"path"`; thư mục đang mở dấu ngoặc thì GIỮ dấu ngoặc để bước hoàn thành đi sâu thêm một cấp.
 * Nhận: `candidate` — tệp hoặc thư mục đã chọn, `preserveQuote` — giữ dấu ngoặc dù không cần.
 * Trả: chuỗi chèn, hoặc `undefined` khi ngữ pháp editor không biểu diễn được an toàn.
 */
export function formatFileMention(candidate: MentionCandidate, preserveQuote: boolean): string | undefined {
  const path = candidate.kind === "directory" ? candidate.path + "/" : candidate.path;
  if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return undefined;
  if (!(preserveQuote || /\s/u.test(path))) return "@" + path;
  if (candidate.kind === "directory") return '@"' + path;
  return '@"' + path + '"';
}
