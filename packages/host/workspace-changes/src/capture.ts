/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ảnh chụp toàn tệp quanh các lượt sửa của công cụ tệp: nội dung của một đường dẫn trước lần sửa
 *      đầu tiên trong lượt và ở cuối lượt, lưu theo địa chỉ nội dung dưới thư mục tạm của Session nên
 *      hai phía của phép so sánh sống sót qua các lần sửa sau đó mà không phụ thuộc git.
 */

import { createHash } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import { mkdir, open, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Số byte git dò tìm byte NUL trước khi coi nội dung là nhị phân. */
const BINARY_PROBE_BYTES = 8000;

/**
 * Lỗi hệ thống tệp có phải là "đường dẫn không tồn tại" hay không.
 * Nhận: giá trị bắt được trong catch (kiểu chưa biết).
 * Trả: true khi đối tượng lỗi mang mã `ENOENT`.
 */
function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT"
  );
}

/** Một phía đã chụp của một đường dẫn: vắng mặt, quá hạn mức (không lưu nội dung), hoặc bản sao đã lưu. */
export type Capture =
  /** Không có tệp tại đường dẫn. */
  | { kind: "absent" }
  /** Tệp thường lớn hơn hạn mức đã cấu hình; nội dung của nó không được lưu. */
  | { kind: "oversized" }
  /** Một bản sao đã lưu, được đặt tên theo SHA-1 của các byte của nó. */
  | { kind: "file"; file: string; binary: boolean };

/**
 * Lưu nội dung HIỆN TẠI của một đường dẫn. Chỉ đọc tối đa `maxBytes + 1` byte, nên tệp phình vượt hạn
 * mức trong lúc đang đọc không tốn bộ nhớ quá hạn mức.
 * Nhận: `absolute` — đường dẫn tuyệt đối chuẩn hoá của tệp; `directory` — thư mục chứa các bản sao
 * theo địa chỉ nội dung (được tạo khi chưa có); `maxBytes` — hạn mức byte (tính cả biên) của một bản sao.
 * Trả: ảnh chụp, hoặc undefined với đường dẫn vừa không vắng mặt vừa không phải tệp thường.
 * @throws khi không mở hoặc không đọc được đường dẫn vì lý do khác ngoài vắng mặt, hoặc không ghi được bản sao.
 */
export async function captureFile(
  absolute: string,
  directory: string,
  maxBytes: number,
): Promise<Capture | undefined> {
  let handle: FileHandle;
  try {
    handle = await open(absolute, "r");
  } catch (error) {
    if (!isMissing(error)) throw error;
    return { kind: "absent" };
  }
  let bytes: Buffer;
  try {
    if (!(await handle.stat()).isFile()) return undefined;
    const probe = Buffer.allocUnsafe(maxBytes + 1);
    let length = 0;
    // Đọc đúng tối đa maxBytes + 1 byte: dư một byte là đủ biết tệp vượt hạn mức.
    while (length < probe.length) {
      const { bytesRead } = await handle.read(probe, length, probe.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > maxBytes) return { kind: "oversized" };
    bytes = probe.subarray(0, length);
  } finally {
    await handle.close();
  }
  const file = join(directory, createHash("sha1").update(bytes).digest("hex"));
  await mkdir(directory, { recursive: true });
  // Nội dung giống nhau giữa các đường dẫn và các lượt dùng chung một bản sao; `wx` giữ nguyên bản đã có.
  await writeFile(file, bytes, { flag: "wx" }).catch((error: { code?: unknown }): void => {
    if (error.code !== "EEXIST") throw error;
  });
  return { kind: "file", file, binary: bytes.subarray(0, BINARY_PROBE_BYTES).includes(0) };
}

/**
 * Hai ảnh chụp có được BIẾT là cùng nội dung hay không. Hai phía vắng mặt là giống nhau; hai bản sao đã
 * lưu là giống nhau khi các byte của chúng băm ra như nhau; một phía quá hạn mức không bao giờ được biết
 * là khớp với bất cứ thứ gì, vì nội dung của nó chưa từng được đọc.
 * Nhận: `a` — một phía; `b` — phía còn lại.
 * Trả: true chỉ khi cả hai phía được biết là khớp nhau.
 */
export function sameCapture(a: Capture, b: Capture): boolean {
  if (a.kind === "absent" || b.kind === "absent") return a.kind === b.kind;
  return a.kind === "file" && b.kind === "file" && a.file === b.file;
}
