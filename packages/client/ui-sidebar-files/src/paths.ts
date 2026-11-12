/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đường dẫn và địa chỉ tệp: nối đường dẫn con, và dựng địa chỉ gbh-resource://file/… cho một đường dẫn.
 */

// 18/10/2026 (task-29, Wave D): PHÁT scheme mới gbh-resource:// (bản gốc: dsh-resource://); nơi nhận
//   chấp nhận cả hai scheme nên địa chỉ cũ trong lịch sử phiên vẫn mở được.
/** Sơ đồ và tiền tố mà mọi địa chỉ tệp MỚI mở đầu. */
const FILE_ADDRESS_PREFIX = "gbh-resource://file/";

/** Mã hoá một đoạn id/đường dẫn, giữ §:§ literal cho ký tự ổn định của ổ đĩa Windows. */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%3A/gi, ":");
}

/** Mã hoá đường dẫn phân tách bằng §/§ theo từng đoạn. */
function encodePath(path: string): string {
  return path.split("/").map(encodeSegment).join("/");
}

/**
 * Đường dẫn tuyệt đối của một mục con.
 * Nhận: parent — đường dẫn tuyệt đối của thư mục đang đọc; name — tên (basename) của mục.
 * Trả: đường dẫn con, luôn nối bằng §/§ và bỏ mọi dấu phân tách thừa ở cuối parent.
 */
export function childPath(parent: string, name: string): string {
  return `${parent.replace(/[/\\]+$/, "")}/${name}`;
}

/** Đường dẫn có dùng tiền tố ổ đĩa Windows hoặc UNC không. */
function isWindowsStylePath(value: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
}

/**
 * Đường dẫn có phải tuyệt đối theo cả hai cách viết mà Host chấp nhận không.
 * Nhận: path — đường dẫn cần phân loại.
 * Trả: true khi là đường dẫn tuyệt đối (POSIX hoặc Windows); false khi là đường dẫn tương đối workspace.
 */
export function isAbsoluteWorkspacePath(path: string): boolean {
  return path.startsWith("/") || isWindowsStylePath(path);
}

/**
 * Địa chỉ của một tệp đọc qua một phiên.
 * Nhận: sessionId — phiên phân giải đường dẫn; path — đường dẫn tuyệt đối hoặc tương đối workspace.
 * Trả: địa chỉ §gbh-resource://file/session/<sessionId>/<path>§.
 */
export function sessionFileAddress(sessionId: string, path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
  return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`;
}

/**
 * Địa chỉ của một đường dẫn theo cách người gọi đang giữ nó.
 *
 * Đường dẫn tương đối, hoặc tuyệt đối NẰM TRONG workspace của phiên, trở thành địa chỉ scope §session§;
 * đường dẫn tuyệt đối ở ngoài (hoặc chưa biết gốc workspace) giữ nguyên đường dẫn tuyệt đối trong địa chỉ.
 * Nhận: sessionId — phiên đọc tệp; cwd — gốc workspace của phiên (nếu biết); path — đường dẫn cần dựng.
 * Trả: địa chỉ §gbh-resource://file/…§.
 */
export function fileAddressFor(sessionId: string, cwd: string | undefined, path: string): string {
  const normalized = path.replace(/\\/g, "/");
  if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized);
  const root = cwd === undefined ? "" : cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  if (root !== "" && normalized === root) return sessionFileAddress(sessionId, "");
  if (root !== "" && normalized.startsWith(`${root}/`)) return sessionFileAddress(sessionId, normalized.slice(root.length + 1));
  return sessionFileAddress(sessionId, normalized);
}
