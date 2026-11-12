/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hai rule nhan dang tham chieu \`@file\` / \`@folder\` trong van ban goc cua nguoi dung
 */

/** Dữ liệu mà một tham chiếu đường dẫn mang theo. */
export interface PathReferenceData {
  /** Đường dẫn đã bóc dấu ngoặc. */
  path: string;
  /** Tên hiển thị (đoạn cuối của đường dẫn). */
  label: string;
}

/** Một tham chiếu tìm thấy trong văn bản. */
export interface PathReferenceMatch {
  /** Id loại tham chiếu (`file` hoặc `folder`). */
  id: string;
  /** Vị trí bắt đầu (tính cả dấu `@`). */
  start: number;
  /** Vị trí kết thúc (không tính dấu câu đã bỏ). */
  end: number;
  /** Dữ liệu để render chip. */
  data: PathReferenceData;
}

/** Rule mà seam `uiConversation.userText` nhận. */
export interface UserTextRule {
  /** Loại tham chiếu do rule này sinh ra. */
  id: "file" | "folder";
  /** Thứ tự ưu tiên giữa các rule. */
  order: number;
  /**
   * Tìm tham chiếu gần nhất kể từ vị trí `from`.
   * Nhận: `text` — văn bản gốc, `from` — vị trí bắt đầu quét.
   * Trả: tham chiếu tìm được, hoặc `undefined`.
   */
  match(text: string, from: number): PathReferenceMatch | undefined;
}

/**
 * Quét token `@…` kế tiếp trong văn bản và bóc nó thành đường dẫn.
 * Nhận: `text` — văn bản gốc, `from` — vị trí bắt đầu quét, `folder` — true khi chỉ nhận đường dẫn kết thúc bằng `/`.
 * Trả: `{ start, end, data }` của tham chiếu đầu tiên hợp lệ, hoặc `undefined`.
 */
function nextPath(text: string, from: number, folder: boolean): { start: number; end: number; data: PathReferenceData } | undefined {
  const tokens = /(?<!\S)(@"[^"\n]+"|@[^\s]+)/gu;
  tokens.lastIndex = from;
  for (let match = tokens.exec(text); match !== null; match = tokens.exec(text)) {
    const token = match[0];
    const raw = token.startsWith('@"') ? token : token.replace(/[.,;:!?，。；：！？]+$/u, "");
    if (raw.length <= 1) continue;
    const path = raw.slice(1).replace(/^"|"$/gu, "");
    if (path.endsWith("/") !== folder) continue;
    const label = path.split(/[\\/]/u).filter(Boolean).at(-1) ?? raw.slice(1);
    return { start: match.index, end: match.index + raw.length, data: { path, label } };
  }
  return undefined;
}

/** Tham chiếu tệp: token không kết thúc bằng `/` (ranh giới khoảng trắng nguyên bản). */
export const fileReferenceRule: UserTextRule = {
  id: "file",
  order: 30,
  match(text: string, from: number): PathReferenceMatch | undefined {
    const candidate = nextPath(text, from, false);
    return candidate === undefined ? undefined : { id: "file", ...candidate };
  },
};

/** Tham chiếu thư mục: cùng ngữ pháp nhưng đòi dấu `/` ở cuối. */
export const folderReferenceRule: UserTextRule = {
  id: "folder",
  order: 30,
  match(text: string, from: number): PathReferenceMatch | undefined {
    const candidate = nextPath(text, from, true);
    return candidate === undefined ? undefined : { id: "folder", ...candidate };
  },
};
