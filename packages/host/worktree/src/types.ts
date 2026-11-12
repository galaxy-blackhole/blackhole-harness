/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng công khai của row worktree: yêu cầu + kết quả tạo worktree, cấu hình plugin, và
 *      hạn tài nguyên tiến trình — nguyên văn lib/types/{types,index,process}.d.ts của bản gốc.
 */

/** Yêu cầu tạo một checkout mới từ một commit/branch/tag Git có sẵn cục bộ. */
export interface CreateWorktreeRequest {
  /** Tên nhánh mới, đồng thời là thư mục checkout tương đối; bỏ trống thì sinh tên tự động. */
  name?: string;
  /** Revision cục bộ cần phân giải trước khi tạo; bỏ trống thì chọn HEAD. */
  from?: string;
}

/** Mốc Git đã commit và thư mục làm việc mà phiên gọi nhận được sau khi tạo. */
export interface CreatedWorktree {
  /** Thư mục checkout tuyệt đối, đã chuẩn hoá, trong thế giới thi hành của nhà cung cấp hệ tệp. */
  path: string;
  /** Tên nhánh vừa được tạo. */
  branch: string;
  /** Tên đối tượng commit đã phân giải; replacement ref cục bộ của repo có thể đổi nội dung checkout. */
  baseCommit: string;
  /** Gốc đã chuẩn hoá của checkout nguồn. */
  repositoryRoot: string;
}

/** Vị trí worktree, tên sinh tự động, tệp thi hành, và hạn tài nguyên của tiến trình con. */
export interface Config {
  /** Bể checkout TƯƠNG ĐỐI nằm trong repo nguồn (mặc định ".agents/worktrees"). */
  directory?: string;
  /** Tiền tố của tên nhánh + tên thư mục sinh tự động (mặc định "worktree-"). */
  namePrefix?: string;
  /** Tên tệp thi hành hoặc đường dẫn tuyệt đối của một bản Git có hỗ trợ GIT_NO_LAZY_FETCH. */
  gitCommand?: string;
  /** Tệp thi hành Node dùng cho phần cấp phát thư mục trong sandbox. */
  nodeCommand?: string;
  /** Hạn chót (ms) cho MỘT lệnh. */
  timeoutMs?: number;
  /** Thời gian ân hạn (ms) trước khi tiến trình con bị kết thúc. */
  graceMs?: number;
  /** Số byte tối đa thu lại cho MỖI luồng đầu ra của tiến trình con. */
  maxOutputBytes?: number;
}

/** Hạn tài nguyên tiến trình đã phân giải — thuộc sở hữu của service worktree. */
export interface ProcessConfig {
  /** Hạn chót cho một lệnh, tính cả lượt tra tệp thi hành và lượt bọc sandbox. */
  timeoutMs: number;
  /** Thời gian ân hạn kết thúc cho mỗi tiến trình được quản lý. */
  graceMs: number;
  /** Số byte tối đa thu lại cho mỗi luồng đầu ra. */
  maxOutputBytes: number;
}

/** Một biến môi trường của tiến trình con: chuỗi là giá trị, undefined là bia mộ xoá biến kế thừa. */
export type Environment = Record<string, string | undefined>;
