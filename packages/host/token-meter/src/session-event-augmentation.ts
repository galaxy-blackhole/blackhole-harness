/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Khai bổ sung các SỰ KIỆN PHIÊN do plugin khác sinh cho SessionEventMap của GÓI TA. Bản gốc khai
 *      augmentation này trên module KERNEL ('@deepseek-ai/dsh-session/types') nên KHÔNG áp cho kiểu GBH;
 *      ta khai tương đương trên module của ta, giữ ĐÚNG hình dạng payload của bản gốc:
 *        · 'image/offload'      — dsh-compaction-image-offload/lib/types/projection.d.ts:11-26
 *        · 'compaction/summary' — dsh-compaction/lib/types/types.d.ts:35
 *        · 'compaction/prune'   — dsh-compaction/lib/types/types.d.ts:88
 */

declare module "@galaxy-blackhole/gbh-session" {
  interface SessionEventMap {
    /** Ảnh đã được tách khỏi ngữ cảnh ở lượt này để giải phóng ngữ cảnh (hình dạng ĐÚNG của bản gốc). */
    "image/offload": {
      /** Các đích bị bỏ ảnh: nêu node và chỉ số ảnh theo thứ tự duyệt sâu. */
      targets: readonly {
        /** Vị trí sự kiện của node bị ảnh hưởng. */
        readonly seq: number;
        /** Chỉ số các ảnh trong node đó (tăng ngặt). */
        readonly imageIndexes: readonly number[];
      }[];
    };

    /** Một lần nén ngữ cảnh đã ghi xong bản tóm tắt thay cho khoảng bị che. */
    "compaction/summary": {
      /** Định danh lần nén (dùng để ghép cặp với 'compaction/prune'). */
      compactionId: string;
      /** Lệnh đã kích hoạt lần nén, nếu có. */
      sourceCommandId?: string;
      /** Nội dung bản tóm tắt thay cho khoảng bị che. */
      summary: readonly unknown[];
      /** Khoảng bị che (đầu/cuối). */
      shadowedRange: {
        start: number;
        end: number;
      };
      /** Vị trí các nút bề mặt bị che, theo thứ tự bề mặt. */
      shadowedSeqs: number[];
      /** Giá ước tính của nội dung bị che. */
      shadowedTokenCount: number;
      /** Tuyến nhà cung cấp đã viết bản tóm tắt. */
      provider: string;
      /** Model đã viết bản tóm tắt. */
      model: string;
    };

    /** Sự kiện đo đạc đi kèm ngay sau 'compaction/summary' — nêu khoảng đã bị thay thế. */
    "compaction/prune": {
      /** Khoảng bị thay thế (đầu/cuối). */
      shadowedRange: {
        start: number;
        end: number;
      };
      /** Vị trí các nút bề mặt bị thay thế, theo thứ tự bề mặt. */
      shadowedSeqs: number[];
      /** Giá ước tính theo bộ ước lượng cố định của token-meter. */
      shadowedTokenCount: number;
    };

    /** Một lần chờ thử lại nhà cung cấp đã bắt đầu (plugin llm-retry khai ở bản gốc). */
    "llm/retry-started": {
      /** Định danh lần thử lại. */
      retryId: string;
      /** Lượt chứa lần thử lại. */
      turn: number;
      /** Bước trong lượt. */
      step: number;
      /** Tuyến nhà cung cấp. */
      provider: string;
      /** Chế độ thử lại. */
      mode: string;
      /** Khoá chính sách áp dụng. */
      policyKey: string;
      /** Số thứ tự lần thử. */
      retry: number;
      /** Số lần thử tối đa. */
      maxRetries: number;
      /** Thời gian chờ trước khi thử (ms). */
      delayMs: number;
      /** Lỗi đã kích hoạt lần thử lại. */
      failure: unknown;
    };
    /** Một lần thử lại nhà cung cấp đã kết thúc (thành công hoặc bỏ). */
    "llm/retry": {
      /** Định danh lần thử lại. */
      retryId: string;
      /** Lượt chứa lần thử lại. */
      turn: number;
      /** Bước trong lượt. */
      step: number;
      /** Kết quả của lần thử lại. */
      outcome: string;
    };
  }
}

export {};