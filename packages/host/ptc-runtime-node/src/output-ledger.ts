/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Sổ cái đầu ra NGOÀI của một lần chạy PTC: cộng dồn byte của log + giá trị hoàn tất + chẩn đoán
 *      theo MỘT trần chung, và dựng lỗi `output-limit` kèm tiền tố log vừa chỗ — port 1:1 vùng
 *      output-ledger của @deepseek-ai/dsh-ptc-runtime-node (index.js 807–879)
 */

import { jsonStringBytesUpTo, jsonValueBytesUpTo, truncateJsonStringBytes } from "./output-json.ts";

/* Combined byte accounting for retained program output. */

/** Giá trị JSON không mất mát — bản khai TỐI THIỂU CỤC BỘ của peer `PtcJsonValue` (@deepseek-ai/dsh-ptc-runtime). */
type PtcJsonValue = null | boolean | number | string | PtcJsonValue[] | { [key: string]: PtcJsonValue };

/** Vì sao một lần chạy hỏng — bản khai TỐI THIỂU CỤC BỘ của peer `PtcRunFailure`. */
interface PtcRunFailure {
  /** Nhóm lỗi (xem bản gốc: exception · timeout · abort · worker-exit · invalid-output · output-limit · protocol · sandbox-unavailable). */
  readonly kind: "exception" | "timeout" | "abort" | "worker-exit" | "invalid-output" | "output-limit" | "protocol" | "sandbox-unavailable";
  /** Chi tiết dạng người đọc, đủ để model tự sửa. */
  readonly message: string;
}

/** Kết quả một lần chạy — bản khai TỐI THIỂU CỤC BỘ của peer `PtcRunResult` (chỉ phần module này chạm). */
interface PtcRunResult {
  /** Chính sách tệp đã áp + dấu hiệu bị từ chối (nguyên văn `PtcRunSandbox`, để tối thiểu hai trường). */
  sandbox?: { readonly mode: "read-only" | "workspace-write" | "danger-full-access"; readonly denied: boolean };
  /** Văn bản đã thu, giữ nguyên thứ tự phát. */
  logs: string[];
  /** Giá trị hoàn tất khi chương trình chạy xong và qua được biên JSON. */
  value?: PtcJsonValue;
  /** Có mặt KHI VÀ CHỈ KHI lần chạy hỏng. */
  error?: PtcRunFailure;
}

/**
 * One run's combined outer-output ledger; binding values never enter it.
 * Nhận: maxBytes — trần tổng byte đã tuần tự hoá; overflowMessage — câu lỗi thay thế khi vượt trần.
 * Trả: không (lớp).
 */
export class OutputLedger {
  private readonly maxBytes: number;
  private readonly overflowMessage?: string;
  private bytes = 2;
  private entries = 0;

  /**
   * Mở sổ với trần byte và câu lỗi vượt trần (khởi điểm 2 byte của cặp ngoặc JSON).
   * Nhận: maxBytes — trần tổng; overflowMessage — câu lỗi tùy chọn.
   * Trả: không.
   */
  constructor(maxBytes: number, overflowMessage?: string) {
    this.maxBytes = maxBytes;
    this.overflowMessage = overflowMessage;
  }

  /**
   * Admit one exact log entry, or report that the hard cap was crossed.
   * Nhận: text — một dòng log NGUYÊN VẸN; sink — mảng đích để đẩy dòng vào khi vừa trần.
   * Trả: boolean — true khi đã nhận (đã đẩy vào sink); false khi vượt trần (không đụng sink).
   */
  admit(text: string, sink: string[]): boolean {
    const separatorBytes = this.entries > 0 ? 1 : 0;
    const stringBytes = jsonStringBytesUpTo(text, this.maxBytes - this.bytes - separatorBytes);
    if (stringBytes === undefined) return false;
    this.bytes += stringBytes + separatorBytes;
    this.entries += 1;
    sink.push(text);
    return true;
  }

  /**
   * Finalize a successful absent-or-JSON completion against the combined cap.
   * Nhận: logs — các dòng log đã nhận; value — giá trị hoàn tất (bỏ trống khi chương trình không trả gì).
   * Trả: PtcRunResult — { logs, value? } khi vừa trần, hoặc lỗi `output-limit` khi giá trị làm vượt trần.
   */
  success(logs: string[], value?: PtcJsonValue): PtcRunResult {
    if (value !== undefined && jsonValueBytesUpTo(value, this.maxBytes - this.bytes) === undefined) return this.limit(logs);
    return {
      logs,
      ...value !== undefined ? { value } : {}
    };
  }

  /**
   * Finalize a failure diagnostic, with output-limit taking precedence when combined bytes exceed the cap.
   * Nhận: logs — các dòng log đã nhận; error — chẩn đoán thất bại.
   * Trả: PtcRunResult — { logs, error } khi vừa trần, hoặc lỗi `output-limit` khi chính chẩn đoán vượt trần.
   */
  failure(logs: string[], error: PtcRunFailure): PtcRunResult {
    if (jsonStringBytesUpTo(error.message, this.maxBytes - this.bytes) === undefined) return this.limit(logs);
    return {
      logs,
      error
    };
  }

  /**
   * Build the explicit output-limit failure while retaining a fitting prefix of the final log.
   * Nhận: logs — các dòng log đã nhận (dòng cuối có thể bị cắt thành tiền tố vừa chỗ).
   * Trả: PtcRunResult — { logs giữ được, error: { kind: 'output-limit', message } }.
   */
  limit(logs: string[]): PtcRunResult {
    const fullMessage = this.overflowMessage ?? `outer output exceeded ${this.maxBytes} bytes`;
    const messageBytes = fullMessage.length + 2;
    const retained: string[] = [];
    let retainedBytes = 2;
    const logBudget = this.maxBytes - messageBytes;
    for (const text of logs) {
      const separatorBytes = retained.length > 0 ? 1 : 0;
      const availableBytes = logBudget - retainedBytes - separatorBytes;
      const stringBytes = jsonStringBytesUpTo(text, availableBytes);
      if (stringBytes !== undefined) {
        retained.push(text);
        retainedBytes += stringBytes + separatorBytes;
        continue;
      }
      const prefix = truncateJsonStringBytes(text, availableBytes);
      if (prefix.length > 0) {
        const prefixBytes = jsonStringBytesUpTo(prefix, availableBytes);
        if (prefixBytes === undefined) throw new Error("output ledger produced an oversized log prefix");
        retained.push(prefix);
        retainedBytes += prefixBytes + separatorBytes;
      }
      break;
    }
    return {
      logs: retained,
      error: {
        kind: "output-limit",
        message: truncateJsonStringBytes(fullMessage, this.maxBytes - retainedBytes)
      }
    };
  }
}
