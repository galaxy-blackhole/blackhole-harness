/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Đọc PDF đầu ra CÓ TRẦN từ thư mục tạm riêng của tác vụ, từ chối tệp thiếu/là symlink/quá lớn/bị cắt/không
 *      phải PDF — bản viết lại 1:1 `readPdf` của `@deepseek-ai/dsh-office-to-pdf`.
 */

import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";

import { OfficeToPdfError } from "./errors.ts";

/**
 * Từ chối đầu ra thiếu, dạng symlink, quá lớn, bị cắt, hoặc không phải PDF.
 * Nhận: đường dẫn đầu ra của kit trong thư mục tạm do provider sở hữu, trần byte BAO GỒM, tín hiệu vòng đời.
 * Trả: byte đầy đủ, độc lập với tệp tạm.
 */
export async function readPdf(path: string, limit: number, signal: AbortSignal): Promise<Uint8Array> {
  signal.throwIfAborted();
  if (!(await lstat(path)).isFile()) {
    throw new OfficeToPdfError("invalid-output", "The converter output is not a regular file.");
  }
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile()) {
      throw new OfficeToPdfError("invalid-output", "The converter output is not a regular file.");
    }
    if (info.size > limit) throw new OfficeToPdfError("output-too-large", "The converted PDF exceeds maxOutputBytes.");
    const bytes = Buffer.alloc(info.size + 1);
    let length = 0;
    while (length < bytes.length) {
      signal.throwIfAborted();
      const read = await file.read(bytes, length, bytes.length - length, null);
      if (read.bytesRead === 0) break;
      length += read.bytesRead;
    }
    signal.throwIfAborted();
    if (length > limit) throw new OfficeToPdfError("output-too-large", "The converted PDF exceeds maxOutputBytes.");
    const pdf = bytes.subarray(0, length);
    if (
      length !== info.size ||
      !pdf.subarray(0, 8).toString("ascii").match(/^%PDF-\d\.\d/u) ||
      !pdf.subarray(-1024).toString("ascii").trimEnd().endsWith("%%EOF")
    ) {
      throw new OfficeToPdfError("invalid-output", "The converter did not produce a complete PDF.");
    }
    return pdf;
  } finally {
    await file.close();
  }
}
