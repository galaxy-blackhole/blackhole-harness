/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cắt MỘT trang dòng từ luồng văn bản đã giải mã, cùng các helper thuần của dịch vụ tệp workspace —
 *      bản viết lại 1:1 `cutPage`/`integerAtLeast`/`workspacePathOf`/`directoryEntry`/`isNotTextRefusal`
 *      của `@deepseek-ai/dsh-api-workspace-files`.
 */

import { RemoteError } from "@deepseek-ai/dsh-typert-protocol";

import type { WorkspaceDirectoryEntry } from "./types.ts";

/** Ký tự mà văn bản KHÔNG BAO GIỜ mang: có nó nghĩa là trang là nhị phân. */
export const NUL = String.fromCharCode(0);

/** Bảy mã lỗi của chính namespace này cộng mã lỗi dùng chung của Gateway. */
export type WorkspaceFileErrorCode =
  | "workspace-file/watch-unsupported"
  | "workspace-file/not-found"
  | "workspace-file/outside-workspace"
  | "workspace-file/too-large"
  | "workspace-file/not-text"
  | "workspace-file/not-regular-file"
  | "workspace-file/not-directory"
  | "gateway/bad-request";

/**
 * Dựng MỘT `RemoteError` với mã của namespace này. Bản gốc khai bảy mã đó bằng `declare module` trên
 * `RemoteErrorDetailsMap`; repo này CẤM `declare module` (luật 000d) ⇒ ép kiểu tại ĐÚNG MỘT chỗ này,
 * giữ nguyên lớp lỗi, mã, thông điệp, chi tiết và `cause` như bản gốc.
 * Nhận: mã lỗi, thông điệp, chi tiết, và (tuỳ chọn) nguyên nhân.
 * Trả: đối tượng `RemoteError` đã dựng.
 */
export function remoteFailure(
  code: WorkspaceFileErrorCode,
  message: string,
  details: Record<string, unknown>,
  options?: { readonly cause?: unknown },
): RemoteError {
  // Dựng TRỰC TIẾP lớp lỗi của kernel — KHÔNG được gọi lại chính hàm này (sẽ đệ quy vô hạn).
  return new RemoteError(code as never, message, details as never, options as never);
}

/** Một trang dòng đã cắt. */
export interface CutPage {
  /** Các dòng của trang nối bằng `\n`. */
  readonly text: string;
  /** Số dòng trang giữ. */
  readonly lines: number;
  /** Trang có chứa dòng cuối của tệp hay không. */
  readonly eof: boolean;
}

/**
 * Từ chối mọi thứ mà schema dây nhận như số nhưng cửa sổ không dùng được: chỉ số nguyên AN TOÀN mới
 * đánh chỉ số được tệp.
 * Nhận: giá trị, ngưỡng dưới, và tên trường (cho thông điệp).
 * Trả: chính giá trị khi hợp lệ; ném `RemoteError` mã `gateway/bad-request` khi không.
 */
export function integerAtLeast(value: number, min: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < min) {
    throw remoteFailure(
      "gateway/bad-request",
      name + " must be a safe integer of at least " + String(min),
      {},
    );
  }
  return value;
}

/**
 * Cắt các dòng `offset`..`offset + limit - 1` từ các mẩu đã giải mã, DỪNG ở ký tự đầu tiên vượt trang nên
 * phần còn lại của tệp không bao giờ bị đọc. Các dòng TRƯỚC trang được ĐẾM chứ không giữ, và trang bị từ
 * chối NGAY khi byte của nó vượt `maxBytes` ⇒ một dòng khổng lồ cũng không làm bộ nhớ vượt trần.
 * Nhận: luồng mẩu văn bản, dòng đầu, số dòng, trần byte, và đường dẫn (cho thông điệp).
 * Trả: trang đã cắt.
 */
export async function cutPage(
  chunks: AsyncIterable<string>,
  offset: number,
  limit: number,
  maxBytes: number,
  path: string,
): Promise<CutPage> {
  const last = offset + limit - 1;
  const lines: string[] = [];
  let current = "";
  let bytes = 0;
  let lineNumber = 1;
  const admit = (size: number): void => {
    bytes += size;
    if (bytes > maxBytes) {
      throw remoteFailure(
        "workspace-file/too-large",
        "lines " + String(offset) + "-" + String(last) + ' of "' + path + '" exceed the ' + String(maxBytes) + " byte cap",
        { path, limit: maxBytes },
      );
    }
  };
  const complete = (): void => {
    if (lines.length > 0) admit(1);
    lines.push(current);
    current = "";
  };
  for await (const chunk of chunks) {
    let position = 0;
    while (position < chunk.length) {
      if (lineNumber > last) return { text: lines.join("\n"), lines: lines.length, eof: false };
      const newline = chunk.indexOf("\n", position);
      const segment = newline === -1 ? chunk.slice(position) : chunk.slice(position, newline);
      if (lineNumber >= offset) {
        admit(Buffer.byteLength(segment, "utf8"));
        current += segment;
      }
      if (newline === -1) break;
      if (lineNumber >= offset) complete();
      lineNumber += 1;
      position = newline + 1;
    }
  }
  if (current.length > 0) complete();
  return { text: lines.join("\n"), lines: lines.length, eof: true };
}

/**
 * Đường dẫn WORKSPACE của `target` tương đối theo `root`, suy từ HAI URI `file:` chuẩn nên kết quả nối
 * bằng `/` trên mọi nền tảng. Rỗng với chính gốc.
 * Nhận: URL gốc và URL đích.
 * Trả: đường dẫn tương đối kiểu POSIX.
 */
export function workspacePathOf(rootUrl: string, targetUrl: string): string {
  const root = new URL(rootUrl).pathname.replace(/\/+$/, "");
  const target = new URL(targetUrl).pathname;
  if (target === root) return "";
  return target
    .slice(root.length + 1)
    .split("/")
    .map(decodeURIComponent)
    .join("/");
}

/**
 * Bỏ đích đã giải của một con: dây chỉ mang TÊN và siêu dữ liệu.
 * Nhận: một mục thư mục của backend.
 * Trả: mục thư mục của dây (kèm `size` chỉ khi backend báo).
 */
export function directoryEntry(child: WorkspaceDirectoryEntry): WorkspaceDirectoryEntry {
  return {
    name: child.name,
    type: child.type,
    ...(child.size === undefined ? {} : { size: child.size }),
  };
}

/**
 * Nhận diện lời từ chối "không phải văn bản" của backend CHỈ qua mã lỗi: lớp lỗi thuộc về bất kỳ thể hiện
 * `dsh-fs` nào mà provider đã nạp, nên không có danh tính lớp nào dùng chung qua biên package.
 * Nhận: lỗi bất kỳ.
 * Trả: true khi lỗi mang `code === "FS_NOT_TEXT"`.
 */
export function isNotTextRefusal(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "FS_NOT_TEXT";
}
