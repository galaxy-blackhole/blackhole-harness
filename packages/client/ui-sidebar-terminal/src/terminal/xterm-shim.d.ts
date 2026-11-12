/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Khai báo tối thiểu cho @xterm/* — repo KHÔNG cài hai gói này (nhánh terminal đang port), nên chỉ
 *      khai báo đúng thành viên body.ts dùng để tsc đi qua. Thay bằng typings thật khi thêm dependency.
 */

declare module "@xterm/xterm" {
  /** Terminal tối thiểu. */
  export class Terminal {
    /** Tạo terminal. */
    constructor(options?: Record<string, unknown>);
    /** Mở trong phần tử. */
    open(el: HTMLElement): void;
    /** Giải phóng. */
    dispose(): void;
    /** Nạp addon. */
    loadAddon(addon: unknown): void;
    /** Ghi dữ liệu. */
    write(data: string, cb?: () => void): void;
    /** Xoá nội dung. */
    reset(): void;
    /** Đổi kích thước. */
    resize(cols: number, rows: number): void;
    /** Lấy focus. */
    focus(): void;
    /** Sự kiện nhập. */
    onData(cb: (data: string) => void): { dispose(): void };
    /** Phần tử nhập ẩn. */
    textarea?: HTMLTextAreaElement;
    /** Tuỳ chọn. */
    options: Record<string, unknown>;
  }
}

declare module "@xterm/addon-fit" {
  /** Addon căn kích thước. */
  export class FitAddon {
    /** Tính lại kích thước. */
    fit(): void;
    /** Kích thước đề xuất. */
    proposeDimensions(): { cols: number; rows: number } | undefined;
  }
}
