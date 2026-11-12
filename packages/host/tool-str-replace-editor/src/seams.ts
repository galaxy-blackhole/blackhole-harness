/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Seam CẤU TRÚC cho @galaxy-blackhole/gbh-tool-str-replace-editor: đúng phần ctx.fs/ctx.tools/ctx.get/ctx.waterfall/ctx.emit và ngữ cảnh thực thi mà công cụ chạm tới.
 */

import type { SandboxMode } from "@deepseek-ai/dsh-sandbox";

/** Một đích đường dẫn đã chuẩn hoá bởi `ctx.fs.resolve` — chỉ `displayPath` được đọc để dựng kết quả. */
export interface EditorTarget {
  /** Đường dẫn hiển thị cho mô hình (bản gốc dùng nó trong mọi chuỗi kết quả/lỗi). */
  readonly displayPath: string;
}

/** Thông tin một mục fs mà `ctx.fs.stat`/`ctx.fs.writeText` trả — `type` quyết định nhánh, `version` đi vào intent ghi. */
export interface EditorInfo {
  /** Loại mục: `file` · `directory` · `symlink` … (bản gốc so với `file`/`directory`). */
  readonly type: string;
  /** Phiên bản nội dung tại thời điểm đọc/ghi (đi vào `replaceIfVersion`). */
  readonly version?: unknown;
}

/** Một mục trong thư mục mà `ctx.fs.listDir` trả. */
export interface EditorDirEntry {
  /** Tên mục (bản gốc lọc `.`-đầu, `node_modules`, `__pycache__`). */
  readonly name: string;
  /** Loại mục; bản gốc chiếu thành `d`/`f`/`?`. */
  readonly type: string;
  /** Đích của mục, dùng để đệ quy và in đường dẫn. */
  readonly target: EditorTarget;
}

/** Intent ghi đã qua waterfall — chỉ `version` được đọc khi dựng `replaceIfVersion`. */
export interface EditIntent {
  /** Phiên bản mà waterfall chốt cho lần ghi. */
  readonly version?: unknown;
}

/** Chính sách sandbox ĐÃ phân giải — chỉ `mode` được đọc khi dịch lỗi từ chối. */
export interface ResolvedSandboxPolicy {
  /** Chế độ sandbox hiệu lực của lần thực thi. */
  readonly mode: SandboxMode;
}

/** Service `sandboxPolicy` — chỉ `resolve` được gọi (bản gốc truyền `{ session }` khi có agent). */
export interface SandboxPolicyService {
  /**
   * Phân giải chính sách cho một lần thực thi.
   * Nhận: input — `{}` khi lời gọi không thuộc agent nào, ngược lại `{ session }`.
   * Trả: chính sách đã phân giải.
   */
  resolve(input: { readonly session?: unknown }): ResolvedSandboxPolicy;
}

/** Seam `ctx.fs` — chỉ năm phương thức mà công cụ này gọi. */
export interface EditorFs {
  /** Chế độ sandbox của filesystem đang mount; `undefined` nghĩa là fs không giam giữ. */
  readonly sandboxMode?: SandboxMode;
  /**
   * Chuẩn hoá đường dẫn mô hình thành đích fs.
   * Nhận: path — đường dẫn tuyệt đối đã kiểm; options — `{ signal }`.
   * Trả: đích fs mang `displayPath`.
   */
  resolve(path: string, options: { readonly signal?: AbortSignal }): Promise<EditorTarget>;
  /**
   * Thống kê một đích.
   * Nhận: target — đích fs; signal — tín hiệu huỷ.
   * Trả: thông tin mục, hoặc `undefined` khi không tồn tại.
   */
  stat(target: EditorTarget, signal?: AbortSignal): Promise<EditorInfo | undefined>;
  /**
   * Đọc toàn văn một tệp.
   * Nhận: target — đích fs; signal — tín hiệu huỷ.
   * Trả: nội dung văn bản.
   */
  readText(target: EditorTarget, signal?: AbortSignal): Promise<string>;
  /**
   * Ghi toàn văn một tệp theo intent đã chốt.
   * Nhận: target — đích fs; content — nội dung mới; intent — intent ghi; signal — tín hiệu huỷ; sandboxPolicy — chính sách đã phân giải.
   * Trả: thông tin mục sau khi ghi (mang `version` mới).
   */
  writeText(target: EditorTarget, content: string, intent: unknown, signal?: AbortSignal, sandboxPolicy?: ResolvedSandboxPolicy): Promise<EditorInfo>;
  /**
   * Liệt kê một thư mục (một mức).
   * Nhận: target — đích thư mục; signal — tín hiệu huỷ.
   * Trả: các mục con theo thứ tự fs trả về.
   */
  listDir(target: EditorTarget, signal?: AbortSignal): Promise<readonly EditorDirEntry[]>;
}

/** Seam `ctx.tools` — chỉ `register` được gọi. */
export interface ToolsSeam {
  /**
   * Đăng ký một định nghĩa công cụ đã qua `defineTool`.
   * Nhận: definition — định nghĩa công cụ.
   * Trả: giá trị bản gốc bỏ qua.
   */
  register(definition: unknown): unknown;
}

/** Ngữ cảnh thực thi công cụ — chỉ `signal` và `agent.session` mà bản gốc đọc. */
export interface EditorExec {
  /** Tín hiệu huỷ của lời gọi, chuyển thẳng xuống mọi thao tác fs. */
  readonly signal: AbortSignal;
  /** Agent gọi công cụ; vắng khi lời gọi không thuộc agent nào. */
  readonly agent?: {
    /** Phiên sở hữu lời gọi (bản gốc chỉ chuyển `session` xuống `sandboxPolicy.resolve`). */
    readonly session: unknown;
  };
}

/** Ngữ cảnh plugin — đúng phần công cụ `str_replace_editor` chạm tới. */
export interface EditorContext {
  /** Filesystem service mà mọi thao tác đi qua. */
  readonly fs: EditorFs;
  /** Sổ đăng ký công cụ. */
  readonly tools: ToolsSeam;
  /**
   * Tra một service theo tên; bản gốc chỉ tra `sandboxPolicy`.
   * Nhận: name — `'sandboxPolicy'`.
   * Trả: service chính sách sandbox, hoặc `undefined` khi vắng.
   */
  get(name: "sandboxPolicy"): SandboxPolicyService | undefined;
  /**
   * Tra một service bất kỳ theo tên.
   * Nhận: name — tên service.
   * Trả: giá trị service (không dùng cho tên khác trong gói này).
   */
  get(name: string): unknown;
  /**
   * Chạy waterfall sự kiện để chốt intent ghi.
   * Nhận: name — `'fs/write-intent'`/`'fs/edit-intent'`; target — đích fs; exec — ngữ cảnh thực thi; fallback — intent mặc định.
   * Trả: intent do tầng nghe chốt, hoặc kết quả `fallback`.
   */
  waterfall(name: string, target: EditorTarget, exec: EditorExec, fallback: () => unknown): Promise<EditIntent | undefined>;
  /**
   * Phát một sự kiện quan sát fs.
   * Nhận: event — `'fs/observed'`; target — đích fs; info — `{ kind, version? }`; exec — ngữ cảnh thực thi.
   * Trả: không.
   */
  emit(event: string, target: EditorTarget, info: unknown, exec: EditorExec): void;
}
