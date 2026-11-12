/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kho tệp đính kèm NGUYÊN BẢN theo nội dung: làm sạch tên lá an toàn trên mọi hệ tệp, dựng đường
 *      dẫn đối tượng, ghi bền từng file đúng từng byte (một lần hoặc theo luồng có giới hạn), và đọc lại
 *      theo luồng có xác minh digest — bản viết lại 1:1 vùng `lib/types/file-store.js` của
 *      @deepseek-ai/dsh-attachment-local.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { AttachmentError, AttachmentId } from "@deepseek-ai/dsh-attachment";
import type { FileAttachmentRef, SaveFileAttachment, SaveFileStreamAttachment } from "@deepseek-ai/dsh-attachment";
import { publishImmutableAlias, publishImmutableObject, publishImmutableObjectStream } from "./store.ts";

/** Biểu thức nhận dạng id tệp đính kèm nguyên bản: tiền tố `sha256:` + ĐÚNG 64 chữ số hex. */
const FILE_ID_PATTERN = /^sha256:([a-f0-9]{64})$/;

/** Tên thiết bị dành riêng của Windows (không phân biệt hoa thường) — không được dùng làm tên lá. */
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu;

/**
 * Cho biết một tên lá có phải tên thiết bị dành riêng của Windows hay không (xét phần thân trước dấu chấm
 * ĐẦU TIÊN, đã bỏ các dấu chấm/khoảng trắng ở cuối).
 * Nhận: `name` — tên lá cần kiểm.
 * Trả: true khi tên (hoặc thân của nó) trùng một tên thiết bị Windows như `con`, `nul`, `com1`, `lpt1`.
 */
function isWindowsDeviceName(name: string): boolean {
  const dot = name.indexOf(".");
  const stem = (dot < 0 ? name : name.slice(0, dot)).replace(/[. ]+$/u, "");
  return WINDOWS_DEVICE_NAME.test(stem);
}

/**
 * Cắt một chuỗi thành tiền tố dài nhất mà số byte UTF-8 không vượt trần cho trước.
 * Nhận: `value` — chuỗi nguồn; `maxBytes` — trần số byte của tiền tố.
 * Trả: tiền tố theo ĐƠN VỊ KÝ TỰ Unicode (không cắt giữa một ký tự) có số byte UTF-8 ≤ `maxBytes`.
 */
function utf8Prefix(value: string, maxBytes: number): string {
  let bytes = 0;
  let prefix = "";
  for (const character of Buffer.from(value).toString("utf8")) {
    const characterBytes = Buffer.byteLength(character);
    if (bytes + characterBytes > maxBytes) break;
    prefix += character;
    bytes += characterBytes;
  }
  return prefix;
}

/**
 * Làm sạch tên hiển thị do bên gọi khai thành một tên lá AN TOÀN để lưu. Cả hai kiểu dấu phân cách đều bị
 * gỡ BẰNG TAY: trên máy POSIX, `\\` là ký tự thường nên `path.basename` sẽ giữ nguyên cả đường dẫn cục bộ
 * của máy khách Windows và làm rò rỉ nó vào tham chiếu lẫn nhật ký phiên. Ký tự Windows từ chối trong tên
 * tệp được đổi thành `_` để một tham chiếu còn hợp lệ trên mọi máy được hỗ trợ.
 * Nhận: `value` — tên hiển thị bên gọi khai, có thể là đường dẫn đầy đủ của máy khách.
 * Trả: tên lá KHÔNG RỖNG an toàn để lưu trên mọi hệ tệp được hỗ trợ (`"file"` khi không có tên/rỗng).
 */
export function fileLeafName(value: string | undefined): string {
  if (value === undefined) return "file";
  let clean = value
    .slice(Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\")) + 1)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim()
    .replace(/[. ]+$/u, "");
  if (isWindowsDeviceName(clean)) clean = `_${clean}`;
  clean = utf8Prefix(clean, 255).replace(/[. ]+$/u, "");
  return clean === "" || clean === "." || clean === ".." ? "file" : clean;
}

/**
 * Kiểm tra một tham chiếu tệp nguyên bản và rút digest hex khỏi id.
 * Nhận: `ref` — tham chiếu tệp bền từ nhật ký phiên hoặc biên nhận tải lên.
 * Trả: digest SHA-256 hex (64 ký tự) khi id hợp lệ VÀ `ref.name` đã đúng là tên lá đã làm sạch.
 *       Ném AttachmentError "File attachment reference is invalid." / "INVALID_ATTACHMENT_REF" khi sai.
 */
function ensureFileReference(ref: FileAttachmentRef): string {
  const match = FILE_ID_PATTERN.exec(String(ref.attachmentId));
  if (match?.[1] === undefined || ref.name !== fileLeafName(ref.name)) throw new AttachmentError("File attachment reference is invalid.", "INVALID_ATTACHMENT_REF");
  return match[1];
}

/**
 * Dựng đường dẫn tuyệt đối tới đối tượng tệp đã lưu. Digest đặt tên THƯ MỤC để tên hiển thị đã làm sạch
 * vẫn là tên lá của tệp, nhờ đó model và người dùng thấy một đường dẫn kết thúc bằng đúng tên tệp thật.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `ref` — tham chiếu tệp bền từ nhật ký phiên hoặc biên nhận tải lên.
 * Trả: đường dẫn cục bộ của nhà cung cấp (`files/<2 ký tự đầu>/<digest>/<tên lá>`), KHÔNG đọc đối tượng.
 *       Ném AttachmentError khi digest hoặc tên trong tham chiếu không hợp lệ.
 */
export function storedFilePath(root: string, ref: FileAttachmentRef): string {
  const sha256 = ensureFileReference(ref);
  return join(root, "files", sha256.slice(0, 2), sha256, ref.name);
}

/**
 * Đường dẫn đối tượng CHUẨN dùng chung cho mọi tên hiển thị của cùng một digest.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối); `sha256` — digest hex của bytes.
 * Trả: đường dẫn tuyệt đối `file-objects/<2 ký tự đầu>/<digest>` (chưa kiểm tính hợp lệ của digest).
 */
function storedFileObjectPath(root: string, sha256: string): string {
  return join(root, "file-objects", sha256.slice(0, 2), sha256);
}

/**
 * Ghi bền MỘT tệp đúng từng byte xuống dưới gốc tệp đính kèm có phiên bản.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `input` — đúng bytes của tệp và tên hiển thị tuỳ chọn.
 * Trả: promise của tham chiếu tệp bền, theo nội dung (content-addressed).
 *       Ném AttachmentError của tầng kho ("Unable to persist attachment." / "ATTACHMENT_WRITE_FAILED",
 *       "Stored attachment failed integrity verification." / "ATTACHMENT_CORRUPT") khi ghi hoặc xác minh hỏng.
 */
export async function saveFileVerbatim(root: string, input: SaveFileAttachment): Promise<FileAttachmentRef> {
  const sha256 = createHash("sha256").update(input.data).digest("hex");
  const ref: FileAttachmentRef = {
    attachmentId: AttachmentId(`sha256:${sha256}`),
    name: fileLeafName(input.name),
    bytes: input.data.byteLength,
  };
  const objectPath = storedFileObjectPath(root, sha256);
  await publishImmutableObject(root, objectPath, input.data, sha256);
  await publishImmutableAlias(root, objectPath, storedFilePath(root, ref), sha256);
  return ref;
}

/**
 * Ghi bền MỘT tệp đúng từng byte từ các khối có giới hạn xuống dưới gốc tệp đính kèm có phiên bản.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `input` — đúng bytes theo thứ tự, tín hiệu huỷ tuỳ chọn, và tên hiển thị.
 * Trả: promise của tham chiếu tệp bền, theo nội dung.
 *       Ném lý do huỷ khi bị huỷ, hoặc AttachmentError của tầng kho khi ghi/xác minh hỏng.
 */
export async function saveFileStreamVerbatim(root: string, input: SaveFileStreamAttachment): Promise<FileAttachmentRef> {
  const name = fileLeafName(input.name);
  const stored = await publishImmutableObjectStream(root, input.data, (sha256) => storedFileObjectPath(root, sha256), input.signal);
  const ref: FileAttachmentRef = {
    attachmentId: AttachmentId(`sha256:${stored.sha256}`),
    name,
    bytes: stored.bytes,
  };
  input.signal?.throwIfAborted();
  await publishImmutableAlias(root, storedFileObjectPath(root, stored.sha256), storedFilePath(root, ref), stored.sha256);
  input.signal?.throwIfAborted();
  return ref;
}

/**
 * Đọc MỘT tệp đã lưu theo các khối có giới hạn (64 KiB) và xác minh số byte lẫn digest.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `ref` — tham chiếu tệp bền từ nhật ký phiên;
 *       `signal` — (tuỳ chọn) tín hiệu huỷ cho việc đọc hệ tệp.
 * Trả: async iterable của đúng các bytes đã lưu, theo đúng thứ tự; lỗi toàn vẹn chỉ ném SAU khối cuối.
 *       Ném AttachmentError "File attachment object is missing." / "ATTACHMENT_NOT_FOUND",
 *       "Unable to read file attachment." / "ATTACHMENT_READ_FAILED",
 *       "Stored file attachment failed integrity verification." / "ATTACHMENT_CORRUPT".
 */
export async function* readFileStreamVerbatim(root: string, ref: FileAttachmentRef, signal?: AbortSignal): AsyncIterable<Uint8Array> {
  signal?.throwIfAborted();
  const sha256 = ensureFileReference(ref);
  const stream = createReadStream(storedFilePath(root, ref), {
    highWaterMark: 65536,
    ...(signal === undefined ? {} : { signal }),
  });
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of stream) {
      signal?.throwIfAborted();
      const data: Uint8Array = chunk;
      hash.update(data);
      bytes += data.byteLength;
      yield data;
    }
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new AttachmentError("File attachment object is missing.", "ATTACHMENT_NOT_FOUND");
    throw new AttachmentError("Unable to read file attachment.", "ATTACHMENT_READ_FAILED", { cause: error });
  } finally {
    stream.destroy();
  }
  signal?.throwIfAborted();
  if (bytes !== ref.bytes || hash.digest("hex") !== sha256) throw new AttachmentError("Stored file attachment failed integrity verification.", "ATTACHMENT_CORRUPT");
}
