/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tang 3 cua gateway: ghi server-response — LUON la BYTE (bai hoc ADR 0004 §8).
 */

/** Ket qua cua mot lan goi remote. */
export type WireResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** Envelope server-response tra ve client. */
export interface ServerResponseEnvelope {
  /** Loai ban tin (co dinh). */
  readonly type: "server-response";
  /** Id request do client dat (duoc echo nguyen, ke ca chuoi rong). */
  readonly rpcId: string;
  /** Ket qua hoac loi cua lan goi. */
  readonly result: WireResult;
}

/**
 * Dong goi ket qua thanh than response dang BYTE.
 *
 * Luon tra Buffer: tang van chuyen phai coi than phan hoi la byte — `String(uint8Array)` cho ra day so thap phan va
 * tung pha moi RPC cua app (ADR 0004 §8).
 * @param rpcId - id request, echo nguyen.
 * @param result - ket qua hoac loi.
 * @returns than response dang Buffer (UTF-8, JSON).
 */
export function encodeServerResponse(rpcId: string, result: WireResult): Buffer {
  const envelope: ServerResponseEnvelope = { type: "server-response", rpcId, result };
  return Buffer.from(JSON.stringify(envelope), "utf8");
}

/**
 * Tai su dung nguyen byte khi tang tren dua vao mot view (Uint8Array/DataView) — khong bao gio ep qua String.
 * Kieu tham so co y rong (ArrayBufferView/ArrayBufferLike) de nhan moi view that su: Buffer.isBuffer hep hon
 * ArrayBuffer.isView, va DataView la mot view hop le.
 * @param chunk - du lieu bat ky.
 * @returns Buffer dung byte.
 */
export function asBytes(chunk: Buffer | ArrayBufferView | ArrayBufferLike | string): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (ArrayBuffer.isView(chunk)) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  if (chunk instanceof ArrayBuffer) return Buffer.from(chunk);
  if (chunk instanceof SharedArrayBuffer) return Buffer.from(chunk as unknown as ArrayBuffer);
  return Buffer.from(chunk, "utf8");
}
