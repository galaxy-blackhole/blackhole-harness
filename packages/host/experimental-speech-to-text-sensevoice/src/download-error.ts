/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Phân loại lỗi tải mô hình + lỗi chuẩn bị KHÔNG lộ nguyên nhân thô/credential/URL ký/local path —
 *      port 1:1 region lib/types/download-error.js (stock lib/index.js:25–69).
 */
import type { SpeechDownloadFailure } from "@galaxy-blackhole/gbh-experimental-speech-to-text";
import { TimeoutReason } from "@deepseek-ai/dsh-timeout";

/** Bảng nhận diện mã lỗi hệ điều hành/mạng theo từng nhóm công khai (stock lib/index.js:26–32). */
const codes: readonly (readonly [SpeechDownloadFailure["reason"], RegExp])[] = [
  ["dns", /^(ENOTFOUND|EAI_AGAIN)$/],
  ["timeout", /^(ETIMEDOUT|ERR_SOCKET_CONNECTION_TIMEOUT|UND_ERR_(CONNECT|HEADERS|BODY)_TIMEOUT)$/],
  ["certificate", /^(CERT_[A-Z_]+|ERR_TLS_CERT_ALTNAME_INVALID|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY)$/],
  ["storage", /^(ENOSPC|EDQUOT|EACCES|EPERM|EROFS)$/],
  ["network", /^(ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|EPIPE|UND_ERR_SOCKET)$/],
];

/** Kết quả phân loại công khai: nhóm lý do + mã chẩn đoán đã nhận diện (nếu có). */
export interface DownloadClassification {
  /** Nhóm công khai dùng cho UI đa ngữ. */
  readonly reason: SpeechDownloadFailure["reason"];
  /** Mã chẩn đoán đã nhận diện; vắng khi không khớp bảng nào. */
  readonly code?: string;
}

/**
 * Soi nguyên nhân lỗi của fetch native, kể cả các lần thử kết nối gộp, mà KHÔNG công bố thông điệp của chúng
 * (stock lib/index.js:38–60).
 * Nhận: `failure` — lỗi nhận từ mạng hoặc hệ thống tệp.
 * Trả: nhóm hành động được + mã chẩn đoán đã nhận diện, hoặc lý do `unknown`.
 */
export function classifyDownloadFailure(failure: unknown): DownloadClassification {
  const pending: unknown[] = [failure];
  const visited = new Set<Error>();
  let reason: SpeechDownloadFailure["reason"] = "unknown";
  while (pending.length > 0) {
    const error = pending.shift();
    if (!(error instanceof Error) || visited.has(error)) continue;
    visited.add(error);
    if (error instanceof TimeoutReason || error.name === "TimeoutError") return { reason: "timeout" };
    if ("code" in error && typeof error.code === "string") {
      for (const [kind, pattern] of codes) {
        if (pattern.test(error.code)) return { reason: kind, code: error.code };
      }
    }
    if (error instanceof TypeError && error.message === "fetch failed") reason = "network";
    pending.push(error.cause);
    if (error instanceof AggregateError) {
      const causes = error.errors;
      pending.push(...causes);
    }
  }
  return { reason };
}

/** Lỗi chuẩn bị mà chi tiết công khai loại bỏ nguyên nhân thô, credential, URL ký và đường dẫn cục bộ (stock lib/index.js:62–68). */
export class SpeechDownloadError extends Error {
  /** Chi tiết công khai của lần tải hỏng. */
  readonly download: SpeechDownloadFailure;

  /**
   * Dựng lỗi từ chi tiết công khai.
   * Nhận: `download` — asset/nguồn/lý do/HTTP status; `options` — nguyên nhân gốc giữ riêng cho chẩn đoán.
   * Trả: thực thể lỗi với thông điệp tiếng Anh nguyên văn của bản gốc.
   */
  constructor(download: SpeechDownloadFailure, options?: ErrorOptions) {
    super(`Unable to prepare ${download.resource} from ${download.source}: ${download.reason}${download.code ? ` (${download.code})` : ""}${download.status === void 0 ? "" : ` (HTTP ${download.status})`}`, options);
    this.download = download;
  }
}
