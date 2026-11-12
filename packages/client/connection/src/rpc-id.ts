/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Id tương quan và lỗi vận chuyển của giao vận Connection — dùng chung cho cả hai nửa
 */

/** Id tương quan của một lời gọi RPC; chuỗi đã được đánh dấu để không lẫn với chuỗi thường. */
export type RpcId = string & { readonly __rpcId?: unique symbol };

/**
 * Đánh dấu một chuỗi thành {@link RpcId}.
 * @param value - chuỗi id thô.
 * @returns chính chuỗi đó, mang kiểu RpcId.
 */
export function RpcId(value: string): RpcId {
  return value as RpcId;
}

/** Lỗi vận chuyển theo đúng hợp đồng dây: mã, thông điệp và chi tiết. */
export interface TransportError {
  /** Mã lỗi trên dây (ví dụ gateway/bad-request). */
  code: string;
  /** Thông điệp cho người đọc. */
  message: string;
  /** Chi tiết bổ sung, luôn là một bản ghi. */
  details: Record<string, unknown>;
}

/**
 * Chuẩn hoá một giá trị bất kỳ thành một {@link TransportError}.
 *
 * Bản gốc nhận mọi thứ ném ra và trả về cùng một hình dạng, nên bên gọi không bao giờ phải kiểm kiểu.
 * @param error - giá trị đã bị ném.
 * @returns lỗi vận chuyển đã chuẩn hoá.
 */
export function transportError(error: unknown): TransportError {
  if (typeof error === "object" && error !== null && !Array.isArray(error)) {
    const record = error as { code?: unknown; message?: unknown; details?: unknown };
    const details = typeof record.details === "object" && record.details !== null && !Array.isArray(record.details) ? (record.details as Record<string, unknown>) : {};
    if (typeof record.code === "string" && typeof record.message === "string") return { code: record.code, message: record.message, details };
  }
  return {
    code: "gateway/internal",
    message: error instanceof Error ? error.message : String(error),
    details: {},
  };
}
