/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hợp đồng dây phía trình duyệt: phân tích phong bì, gỡ đính kèm nhị phân thành byte
 */

import { RpcId, type RpcId as RpcIdType } from "../rpc-id.ts";

export { RpcId, transportError } from "../rpc-id.ts";
export type { TransportError } from "../rpc-id.ts";

/** Kết quả một lời gọi: hoặc giá trị, hoặc thất bại chung. */
export type RpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string; details: Record<string, unknown> } };

/** Phong bì phản hồi của server đã kiểm. */
export interface ServerResponse<T> {
  /** Loại phong bì. */
  type: "server-response";
  /** Id tương quan. */
  rpcId: RpcIdType;
  /** Kết quả. */
  result: RpcResult<T>;
}

/** Giá trị có phải một bản ghi thường hay không. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Kiểm một phong bì phản hồi đã giải JSON.
 * @param value - giá trị đã giải.
 * @returns phong bì đã kiểm.
 * @throws TypeError khi phong bì sai hình dạng (không bao giờ trả về dữ liệu nửa vời).
 */
export function parseConnectionResponse(value: unknown): ServerResponse<unknown> {
  if (!isRecord(value) || value.type !== "server-response" || typeof value.rpcId !== "string") throw new TypeError("connection: invalid server-response envelope");
  const result = value.result;
  if (!isRecord(result)) throw new TypeError("connection: invalid server-response result");
  if (result.ok === true) return { type: "server-response", rpcId: RpcId(value.rpcId), result: { ok: true, value: result.value } };
  if (result.ok !== false || !isRecord(result.error)) throw new TypeError("connection: invalid server-response result");
  const error = result.error;
  if (typeof error.code !== "string" || typeof error.message !== "string" || !isRecord(error.details)) throw new TypeError("connection: invalid server-response failure");
  return { type: "server-response", rpcId: RpcId(value.rpcId), result: { ok: false, error: { code: error.code, message: error.message, details: error.details } } };
}

/**
 * Gỡ kết quả khỏi một phong bì phản hồi.
 * @param response - phong bì phản hồi.
 * @returns kết quả bên trong.
 */
export function resultOf<T>(response: { result: RpcResult<T> }): RpcResult<T> {
  return response.result;
}

/**
 * Gỡ một phản hồi multipart thành byte thật.
 *
 * ĐÂY là ca BYTE của row này (ADR 0004 §8): trường `metadata` mang phong bì JSON, các part còn lại mang
 * byte; chỗ giữ chỗ trong JSON là `null` và được thay bằng `Uint8Array`. Byte được nhận qua
 * ``ArrayBuffer.isView``/`instanceof Blob` — KHÔNG dùng `Buffer.isBuffer`, vì hàm đó hẹp hơn và sẽ bỏ sót
 * mọi vùng nhị phân không phải Buffer của Node.
 * @param response - phản hồi fetch có content-type multipart/form-data.
 * @returns phong bì đã gắn byte vào đúng đường dẫn.
 * @throws TypeError khi hình dạng multipart sai.
 */
export async function parseBinaryResponse(response: Response): Promise<ServerResponse<unknown>> {
  const body = await response.formData();
  const fields = new Map<string, unknown>();
  for (const [name, value] of body) {
    if (fields.has(name)) throw new TypeError("connection: invalid binary response fields");
    fields.set(name, value);
  }
  const metadata = fields.get("metadata");
  fields.delete("metadata");
  if (typeof metadata !== "string") throw new TypeError("connection: invalid binary response fields");
  const envelope: unknown = JSON.parse(metadata);
  const full = parseConnectionResponse(envelope);
  if (!full.result.ok || !isRecord(envelope) || !Array.isArray(envelope.attachments) || envelope.attachments.length === 0) {
    throw new TypeError("connection: invalid binary response result");
  }
  const root: { value: unknown } = { value: full.result.value };
  for (const attachment of envelope.attachments) {
    if (!isRecord(attachment) || attachment.codec !== "bytes" || typeof attachment.part !== "string" || !Array.isArray(attachment.path)) {
      throw new TypeError("connection: invalid binary response attachment");
    }
    const data = fields.get(attachment.part);
    fields.delete(attachment.part);
    if (!(data instanceof Blob)) throw new TypeError("connection: invalid binary response fields");
    let parent: Record<string, unknown> | unknown[] = root as unknown as Record<string, unknown>;
    let key: string | number = "value";
    for (const segment of attachment.path) {
      const current = (parent as Record<string | number, unknown>)[key];
      if (typeof current !== "object" || current === null) throw new TypeError("connection: invalid binary response path");
      if (Array.isArray(current)) {
        if (typeof segment !== "number" || !Number.isSafeInteger(segment) || segment < 0 || segment >= current.length) throw new TypeError("connection: invalid binary response path");
      } else if (typeof segment !== "string") throw new TypeError("connection: invalid binary response path");
      if (!Object.hasOwn(current, segment)) throw new TypeError("connection: invalid binary response path");
      parent = current as Record<string, unknown>;
      key = segment;
    }
    if ((parent as Record<string | number, unknown>)[key] !== null) throw new TypeError("connection: invalid binary response placeholder");
    const bytes = new Uint8Array(await data.arrayBuffer());
    Object.defineProperty(parent, key, { value: bytes, enumerable: true, writable: true, configurable: true });
  }
  if (fields.size !== 0) throw new TypeError("connection: invalid binary response fields");
  return { type: "server-response", rpcId: full.rpcId, result: { ok: true, value: (root as { value: unknown }).value } };
}
