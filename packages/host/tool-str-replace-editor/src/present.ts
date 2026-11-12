/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Trình bày lời gọi đang chờ NGUYÊN VĂN của @deepseek-ai/dsh-tool-str-replace-editor: bốn nhánh `view`/`create`/`str_replace`/`insert` ra thẻ generic/diff.
 */

import type { ToolCallView } from "@galaxy-blackhole/gbh-host-tools";

/** Tham số mô hình mà `presentCall` đọc — đúng bề mặt schema của công cụ `str_replace_editor`. */
export interface EditorArgs {
  /** Lệnh đã chọn. */
  readonly command: "view" | "create" | "str_replace" | "insert";
  /** Đường dẫn tuyệt đối mà lời gọi nhắm tới. */
  readonly path: string;
  /** Nội dung tệp của lệnh `create` (có thể là null-placeholder). */
  readonly file_text?: string | null;
  /** Dòng chèn của lệnh `insert` (có thể là null-placeholder). */
  readonly insert_line?: number | null;
  /** Chuỗi thay thế/chèn (có thể là null-placeholder). */
  readonly new_str?: string | null;
  /** Chuỗi cần thay của lệnh `str_replace`. */
  readonly old_str?: string | null;
  /** Khoảng dòng của lệnh `view`. */
  readonly view_range?: readonly number[] | null;
}

/**
 * Chiếu một lời gọi `str_replace_editor` thành thẻ trình bày — NGUYÊN VĂN bản gốc.
 * Nhận: args — tham số lời gọi đã kiểm.
 * Trả: `ToolCallView` (generic cho `view`/`insert`, diff cho `create`/`str_replace`).
 */
export function presentEditorCall(args: EditorArgs): ToolCallView {
  switch (args.command) {
    case "view": return {
      card: "generic",
      title: `view ${args.path}`,
      kind: "read",
      locations: [{ path: args.path }]
    };
    case "create": return {
      card: "diff",
      title: `create ${args.path}`,
      diffs: [{
        path: args.path,
        oldText: null,
        newText: args.file_text ?? ""
      }],
      locations: [{ path: args.path }]
    };
    case "str_replace": return {
      card: "diff",
      title: `str_replace ${args.path}`,
      diffs: [{
        path: args.path,
        oldText: args.old_str ?? null,
        newText: args.new_str ?? ""
      }],
      locations: [{ path: args.path }]
    };
    case "insert": return {
      card: "generic",
      title: `insert ${args.path}`,
      kind: "edit",
      locations: [{
        path: args.path,
        ...args.insert_line === void 0 || args.insert_line === null ? {} : { line: Math.max(1, args.insert_line + 1) }
      }]
    };
  }
}
