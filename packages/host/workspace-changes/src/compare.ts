/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc So sánh từng dòng hai văn bản toàn tệp bằng `structuredPatch` của gói diff, có hạn thời gian;
 *      quá hạn thì thoái hoá thành thay thế toàn tệp (một hunk xoá hết dòng cũ và thêm hết dòng mới).
 */

import { structuredPatch } from "diff";

/** Số dòng ngữ cảnh quanh mỗi thay đổi — mặc định của unified diff. */
const CONTEXT_LINES = 3;

/**
 * Một hunk unified-diff đã cắt về đúng năm trường phục vụ UI; cùng hình dạng với `WorkspaceDiffHunk`
 * của mặt ./types của gói.
 */
interface DiffHunk {
  /** Dòng đầu của hunk trong nội dung đầu lượt, tính từ 1; phía không có dòng nào bắt đầu ở 1 với 0 dòng. */
  oldStart: number;
  /** Số dòng của hunk lấy từ nội dung đầu lượt. */
  oldLines: number;
  /** Dòng đầu của hunk trong nội dung cuối lượt, tính từ 1; phía không có dòng nào bắt đầu ở 1 với 0 dòng. */
  newStart: number;
  /** Số dòng của hunk lấy từ nội dung cuối lượt. */
  newLines: number;
  /** Thân hunk theo thứ tự, mỗi dòng mang tiền tố `+`, `-` hoặc dấu cách. */
  lines: string[];
}

/** Hunks, cờ cho biết hạn thời gian đã làm chúng thô đi, và tổng số dòng thêm/xoá mà chúng mang. */
export interface Comparison {
  /** Các hunk theo thứ tự trong tệp; rỗng khi hai phía cùng dòng. */
  hunks: DiffHunk[];
  /** True khi phép so sánh vượt `timeoutMs` và mọi dòng hiện ra như bị thay thế. */
  coarse: boolean;
  /** Số dòng được thêm (mọi dòng mang tiền tố `+`). */
  added: number;
  /** Số dòng bị xoá (mọi dòng mang tiền tố `-`). */
  deleted: number;
}

/**
 * Văn bản của một phía với MỌI dòng đã được kết thúc, nhờ đó dòng cuối được so sánh chỉ theo nội dung
 * và văn bản rỗng đọc ra là không có dòng nào thay vì một dòng rỗng.
 * Nhận: `text` — văn bản của một phía (đã thay null bằng chuỗi rỗng).
 * Trả: văn bản đã bảo đảm kết thúc bằng "\n" (trừ khi rỗng).
 */
function terminated(text: string): string {
  return text === "" || text.endsWith("\n") ? text : `${text}\n`;
}

/**
 * Các dòng NỘI DUNG của một văn bản đã kết thúc dòng; văn bản rỗng là không dòng nào.
 * Nhận: `text` — văn bản đã qua `terminated`.
 * Trả: mảng dòng không còn ký tự xuống dòng cuối.
 */
function lines(text: string): string[] {
  return text === "" ? [] : text.slice(0, -1).split("\n");
}

/**
 * So sánh hai văn bản theo từng dòng. Một phía null nghĩa là tệp không tồn tại. Phép so sánh vượt
 * `timeoutMs` cho ra đúng một hunk xoá mọi dòng cũ và thêm mọi dòng mới.
 * Nhận: `before` — văn bản đầu lượt, hoặc null; `after` — văn bản cuối lượt, hoặc null;
 * `timeoutMs` — số mili giây phép so sánh dòng được chạy.
 * Trả: hunks và các tổng; không hunk nào khi hai phía cùng dòng.
 */
export function compareText(
  before: string | null,
  after: string | null,
  timeoutMs: number,
): Comparison {
  const oldText = terminated(before ?? "");
  const newText = terminated(after ?? "");
  const patch = structuredPatch("", "", oldText, newText, undefined, undefined, {
    context: CONTEXT_LINES,
    timeout: timeoutMs,
  });
  let hunks: DiffHunk[];
  let coarse = false;
  if (patch === undefined) {
    // Quá hạn: không còn hunk nào dùng được, dựng một hunk thô thay thế toàn tệp.
    coarse = true;
    const oldLines = lines(oldText);
    const newLines = lines(newText);
    hunks = [
      {
        oldStart: 1,
        oldLines: oldLines.length,
        newStart: 1,
        newLines: newLines.length,
        lines: [...oldLines.map((line) => `-${line}`), ...newLines.map((line) => `+${line}`)],
      },
    ];
  } else {
    hunks = patch.hunks.map(({ oldStart, oldLines, newStart, newLines, lines: body }) => ({
      oldStart,
      oldLines,
      newStart,
      newLines,
      lines: body,
    }));
  }
  let added = 0;
  let deleted = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith("+")) added += 1;
      else if (line.startsWith("-")) deleted += 1;
    }
  }
  return { hunks, coarse, added, deleted };
}
