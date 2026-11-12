/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Route nhận byte thô cho tải tệp: 405/415/400 cho yêu cầu sai, 200 JSON cho mọi kết quả
 *      nghiệp vụ (thành công lẫn lỗi), kèm no-store — port 1:1 lib/types/http-route.js của bản gốc.
 */

import { remoteErrorOf } from "@deepseek-ai/dsh-typert-protocol";

import type { FileUploadValue, StreamUploadRequest } from "./types.ts";

/** Đường dẫn route do service tải tệp sở hữu (nguyên văn bản gốc). */
export const FILE_UPLOAD_PATH = "/api/session/uploadFileBinary";

/** Phần service mà route cần (để test được route mà không cần typert). */
export interface UploadStreamService {
  /**
   * Lưu luồng byte cho một phiên.
   * @param request - phiên sở hữu, luồng byte, huỷ, và tên hiển thị tuỳ chọn.
   * @returns biên nhận staged kèm tham chiếu tệp bền vững.
   */
  uploadStream(request: StreamUploadRequest): Promise<FileUploadValue>;
}

/**
 * Đọc thân yêu cầu thành các khối byte theo thứ tự, không gộp thành chuỗi.
 * @param body - thân ReadableStream (hoặc null).
 * @returns async generator các khối byte; nhả lock khi kết thúc.
 */
export async function* requestBodyChunks(body: ReadableStream<Uint8Array> | null): AsyncGenerator<Uint8Array> {
  if (body === null) return;
  const reader = body.getReader();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return;
      yield chunk.value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Xử lý một lượt tải byte thô đã xác thực.
 * Nhận: service nhận byte và yêu cầu HTTP đã xác thực từ Connection.
 * Trả: 405/415/400 khi yêu cầu sai; 200 JSON cho MỌI kết quả nghiệp vụ (thành công lẫn lỗi), kèm no-store.
 */
export async function handleFileUploadHttp(service: UploadStreamService, request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/octet-stream") {
    return new Response("content type must be application/octet-stream", { status: 415 });
  }
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  if (sessionId === null || sessionId === "") return new Response("sessionId is required", { status: 400 });
  const name = url.searchParams.get("name") ?? undefined;
  let body: unknown;
  try {
    body = {
      ok: true,
      value: await service.uploadStream({
        sessionId,
        data: requestBodyChunks(request.body as ReadableStream<Uint8Array> | null),
        signal: request.signal,
        ...(name === undefined ? {} : { name }),
      }),
    };
  } catch (error) {
    const failure = remoteErrorOf(error);
    body = {
      ok: false,
      error: failure !== undefined
        ? { code: failure.code, message: failure.message, details: failure.details }
        : { code: "gateway/internal", message: error instanceof Error ? error.message : String(error), details: {} },
    };
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
