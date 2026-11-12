/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hợp đồng DÂY của row workspace-changes: tệp đã đổi trong một lượt, bản tóm tắt lượt, hunk và
 *      phép so sánh một tệp, service `workspaceChanges`; hai phép khai kiểu toàn cục của bản gốc
 *      (sự kiện `workspace/changes` · `ctx.workspaceChanges`) được GHI CHÚ thay vì khai (luật 000d).
 *      Tệp KHÔNG có mã chạy.
 */

/**
 * Định danh phiên.
 * Bản gốc dùng `SessionId` có thương hiệu của `@deepseek-ai/dsh-session/types`; ở đây khai theo
 * CẤU TRÚC (luật 000d) nên cả chuỗi thô lẫn id đã có thương hiệu đều gán được — thương hiệu để
 * TUỲ CHỌN đúng như `Branded` của các row khác trong repo.
 */
type SessionId = string & { readonly __sessionId?: "SessionId" };

/** Một tệp đã đổi trong một lượt, kèm số dòng đếm từ git hoặc từ bản capture toàn tệp quanh các lần tool sửa nó. */
export interface WorkspaceChangedFile {
  /** Đường dẫn tương đối so với thư mục làm việc của phiên, hoặc đường dẫn tuyệt đối trên Host khi nằm ngoài thư mục đó. */
  path: string;
  /**
   * Khoá sắp xếp và nhãn hiển thị: đường dẫn tương đối trong thư mục làm việc, đường `../` cho
   * tệp thuộc kho chứa nằm trên nó, đường `~` dưới thư mục home, ngược lại là đường dẫn tuyệt đối.
   * Luôn phân tách bằng dấu `/`.
   */
  display: string;
  /** Số dòng thêm; bằng 0 với tệp nhị phân hoặc tệp quá lớn. */
  added: number;
  /** Số dòng xoá; bằng 0 với tệp nhị phân hoặc tệp quá lớn. */
  deleted: number;
  /** Có mặt khi git báo tệp là nhị phân, hoặc khi một phía đã capture chứa byte NUL. */
  binary?: true;
  /** Có mặt khi một phía đã capture vượt `maxFileBytes` của plugin; tệp vẫn được liệt kê nhưng không có số đếm và không có so sánh. */
  oversized?: true;
}

/** Các tệp đã đổi trong MỘT lượt cấp cao nhất, được giữ trên Host tới khi phiên của nó bị dispose. */
export interface WorkspaceChangesSummary {
  /** Lượt mà bản tóm tắt này mô tả thay đổi tệp. */
  turn: number;
  /** Thư mục làm việc của phiên mà các giá trị `path` là tương đối so với. */
  cwd: string;
  /** Các tệp đã đổi theo thứ tự `display`, bị chặn ở `maxFiles` của plugin. */
  files: WorkspaceChangedFile[];
  /** Tổng số tệp đã đổi, kể cả các tệp bị bỏ do chặn trần. */
  total: number;
  /** Tổng số dòng thêm trên mọi tệp đã đổi, kể cả các tệp bị bỏ do chặn trần. */
  added: number;
  /** Tổng số dòng xoá trên mọi tệp đã đổi, kể cả các tệp bị bỏ do chặn trần. */
  deleted: number;
  /** Id cây git của snapshot đầu lượt và cuối lượt; vắng khi không chụp snapshot nào. */
  snapshot?: {
    before: string;
    after: string;
  };
}

/** Một hunk unified-diff kèm ba dòng ngữ cảnh; mỗi dòng giữ nguyên tiền tố `+`, `-` hoặc dấu cách. */
export interface WorkspaceDiffHunk {
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

/** Phép so sánh nội dung đầu lượt và cuối lượt của MỘT tệp đã liệt kê, chỉ tính khi được hỏi. */
export type WorkspaceFileDiff =
  | {
      kind: "text";
      /** `path` của tệp đã liệt kê. */
      path: string;
      /** `display` của tệp đã liệt kê. */
      display: string;
      /** Tệp có tồn tại ở đầu lượt hay không. */
      before: boolean;
      /** Tệp có tồn tại ở cuối lượt hay không. */
      after: boolean;
      /** Các hunk theo thứ tự tệp; rỗng khi hai phía có cùng các dòng. */
      hunks: WorkspaceDiffHunk[];
      /** True khi phép so sánh dòng vượt `diffTimeoutMs` của plugin và mọi dòng hiện ra như bị thay thế. */
      coarse: boolean;
    }
  | {
      /** Một phía git báo là nhị phân hoặc chứa byte NUL; không phục vụ dòng nào. */
      kind: "binary";
      /** `path` của tệp đã liệt kê. */
      path: string;
      /** `display` của tệp đã liệt kê. */
      display: string;
    }
  | {
      /** Một phía lớn hơn `maxFileBytes` của plugin; không phục vụ dòng nào. */
      kind: "oversized";
      /** `path` của tệp đã liệt kê. */
      path: string;
      /** `display` của tệp đã liệt kê. */
      display: string;
    };

/** Phục vụ các bản tóm tắt và phép so sánh tệp mà recorder giữ cho các phiên đang sống. */
export interface WorkspaceChanges {
  /**
   * Bản tóm tắt mà một sự kiện `workspace/changes` đã công bố.
   * Nhận: `sessionId` — phiên đã nối sự kiện; `seq` — số thứ tự của sự kiện.
   * Trả: bản tóm tắt, hoặc undefined khi phiên của nó đã bị dispose hoặc Host này chưa từng ghi nó.
   */
  summary(sessionId: SessionId, seq: number): WorkspaceChangesSummary | undefined;
  /**
   * So sánh nội dung một tệp đã liệt kê ở đầu lượt và cuối lượt.
   * Nhận: `sessionId` — phiên đã nối sự kiện; `seq` — số thứ tự của sự kiện; `index` — chỉ số
   * của tệp trong `files` của bản tóm tắt; `signal` — huỷ các lần đọc.
   * Trả: phép so sánh, hoặc undefined khi phiên của nó đã bị dispose, khi Host này chưa từng ghi nó,
   * hoặc khi không tệp nào có chỉ số đó.
   * @throws khi một lần đọc snapshot lỗi với một phiên còn sống.
   */
  diff(sessionId: SessionId, seq: number, index: number, signal: AbortSignal): Promise<WorkspaceFileDiff | undefined>;
}

// ADR 000d — KHÔNG khai báo cộng gộp `@deepseek-ai/dsh-session/types` (SessionEventMap) hay
// `@deepseek-ai/cordis` (Context.workspaceChanges) ở đây: bản gốc khai trong .d.ts của CHÍNH nó, còn
// gói viết lại chỉ cần seam theo CẤU TRÚC (plugin.ts tự khai phần ctx mà nó dùng). Khai lại kiểu của
// stock sẽ sinh TS2664/TS2717 khi biên dịch chung chương trình — bài học packages/host/web (18/10/2026).
