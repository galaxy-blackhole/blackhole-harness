/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu DÂY của namespace Remote `workspaceFiles` — bản viết lại 1:1 lib/types/types.d.ts của
 *      `@deepseek-ai/dsh-api-workspace-files`. Hai từ vựng đường dẫn rời khỏi đây: `read`/`readBytes`/
 *      `stat`/`changes` nêu tệp bằng đường dẫn TUYỆT ĐỐI trong thế giới thi hành của filesystem;
 *      `list` nói đường dẫn WORKSPACE (cùng cú pháp mà tham số `path` của nó nhận).
 */

/**
 * Phạm vi giải tệp suy từ ĐẦU MỤC phiên (một `sessionId` đã thương hiệu trên dây + gốc workspace của nó).
 * Bản gốc công bố kiểu này ở `lib/types/index.d.ts`; ở đây giữ đúng hai trường và để `sessionId` là chuỗi
 * (thương hiệu `SessionId` thuộc package `dsh-session/types` — chỉ mượn KIỂU nên không cần peer).
 */
export interface WorkspaceFileScopeLike {
  /** Danh tính phiên nhận trên dây. */
  readonly sessionId: string;
  /** Gốc workspace của phiên, hoặc thư mục dự phòng của triển khai khi đầu mục không có cwd. */
  readonly workspaceRoot: string;
}

/** Danh tính và độ tươi của MỘT tệp workspace, KHÔNG kèm nội dung. */
export interface WorkspaceFileStat {
  /** Đường dẫn tuyệt đối trong thế giới thi hành của filesystem, đã giải symlink. */
  readonly absolutePath: string;
  /** Dấu độ tươi KHÔNG trong suốt tại thời điểm stat; không bao giờ được phân tích. */
  readonly version: string;
  /** Cỡ byte của tệp đầy đủ, khi backend báo. */
  readonly bytes?: number;
}

/**
 * Cửa sổ DÒNG mà một `read` trả về. Dòng tính từ 1 và kết thúc ở `\n`; dấu `\n` cuối cùng KẾT THÚC
 * dòng cuối chứ không mở thêm một dòng rỗng.
 */
export interface WorkspaceFileRange {
  /** Dòng đầu của trang. Mặc định 1. */
  readonly offset?: number;
  /** Số dòng nhiều nhất của trang. Mặc định — và không được vượt — `maxLines` đã cấu hình. */
  readonly limit?: number;
}

/** MỘT trang của tệp văn bản workspace, đúng như Client đọc. */
export interface WorkspaceFileText extends WorkspaceFileStat {
  /** Dòng đầu của trang, đúng như yêu cầu. */
  readonly offset: number;
  /** Các dòng của trang nối bằng `\n`, KHÔNG có dấu kết thúc sau dòng cuối. */
  readonly text: string;
  /** Số dòng trang giữ; `0` khi `offset` nằm sau dòng cuối của tệp. */
  readonly lines: number;
  /** Trang có chứa dòng CUỐI của tệp hay không. */
  readonly eof: boolean;
}

/** Cửa sổ BYTE mà một `readBytes` trả về. Offset tính từ 0. */
export interface WorkspaceByteRange {
  /** Byte đầu của cửa sổ. Mặc định 0. */
  readonly offset?: number;
  /** Số byte nhiều nhất của cửa sổ. Mặc định — và không được vượt — `maxBytes` đã cấu hình. */
  readonly length?: number;
}

/** Cách giải đích và cửa sổ byte tuỳ chọn cho MỘT lần đọc tệp nhị phân. */
export interface WorkspaceByteReadOptions {
  /** Cửa sổ byte; bỏ trống để đọc cả tệp dưới trần `maxFileBytes`. */
  readonly range?: WorkspaceByteRange;
  /** Tệp GỐC, tuyệt đối hoặc tương đối theo workspace; giải đích tương đối từ thư mục của nó. */
  readonly baseFile?: string;
}

/** MỘT cửa sổ byte của tệp workspace đúng như Client đọc: byte thô, không giải mã, không từ chối nhị phân. */
export interface WorkspaceFileBytes<Data extends Uint8Array = Uint8Array> extends WorkspaceFileStat {
  /** Byte đầu của cửa sổ, đúng như yêu cầu. */
  readonly offset: number;
  /** Byte gốc của tệp; rỗng tại hoặc sau EOF. */
  readonly data: Data;
  /** Cửa sổ có chứa byte CUỐI của tệp hay không. */
  readonly eof: boolean;
}

/** MỘT con trực tiếp của thư mục workspace đã liệt kê. */
export interface WorkspaceDirectoryEntry {
  /** Tên (basename) bên trong thư mục đã liệt kê. */
  readonly name: string;
  /**
   * Con này giải ra cái gì. Symlink báo loại của ĐÍCH, và `other` gồm mọi thứ không phải tệp thường
   * hay thư mục; `read` vẫn từ chối symlink, nên `file` ở đây là SỰ THẬT của việc liệt kê, không phải
   * lời hứa nội dung đọc được.
   */
  readonly type: "file" | "directory" | "other";
  /** Cỡ byte, chỉ có với tệp thường mà backend báo. */
  readonly size?: number;
}

/** Các con trực tiếp của MỘT thư mục workspace. */
export interface WorkspaceDirectoryListing {
  /** Thư mục đã liệt kê dưới dạng đường dẫn WORKSPACE, tương đối theo gốc và RỖNG với chính gốc. */
  readonly path: string;
  /** Các con trực tiếp theo thứ tự tên ỔN ĐỊNH của backend, đã cắt theo trần số mục. */
  readonly entries: readonly WorkspaceDirectoryEntry[];
  /** Trần số mục có bỏ bớt con nào khỏi `entries` hay không. */
  readonly truncated: boolean;
}

/**
 * Siêu dữ liệu HIỆN TẠI của đích sau MỘT lần mất hiệu lực của filesystem. Bên tiêu thụ tệp có thể bỏ qua
 * version đã biết; bên tiêu thụ thư mục liệt kê lại MỌI khung vì siêu dữ liệu của một con có thể đổi mà
 * version của thư mục không đổi.
 */
export type WorkspaceFileChange =
  | {
      /** Đường dẫn đích tuyệt đối, cùng dạng với `WorkspaceFileStat.absolutePath`. */
      readonly absolutePath: string;
      /** Dấu độ tươi KHÔNG trong suốt từ lần stat hiện tại; không bao giờ được phân tích. */
      readonly version: string;
    }
  | {
      /** Đường dẫn đích tuyệt đối, cùng dạng với `WorkspaceFileStat.absolutePath`. */
      readonly absolutePath: string;
      /** Đích được QUAN SÁT là đã mất. */
      readonly absent: true;
    };

/**
 * MỘT khung của một thế hệ theo dõi tệp workspace. `ready` xác nhận Host đã khởi tạo watcher cho đích;
 * các lần mất hiệu lực đã xếp hàng và đang sống theo sau bằng khung `change` với siêu dữ liệu hiện tại.
 */
export type WorkspaceFileWatchFrame =
  | { readonly kind: "ready" }
  | { readonly kind: "change"; readonly change: WorkspaceFileChange };
