/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Phiên bản ảnh TẤT ĐỊNH đã cache cho yêu cầu model: danh tính biến đổi, đổi cỡ một cạnh, thang
 *      chất lượng, đọc/ghi cache có xác minh 8-bit sRGB và alpha — bản viết lại 1:1 vùng
 *      `lib/types/request-image.js` của @deepseek-ai/dsh-attachment-local.
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AttachmentError, ImageVariantId } from "@deepseek-ai/dsh-attachment";
import type { ImageAttachmentRef, ImageMediaType, ImageRequestTarget, RequestImageAttachment, StoredImageAttachment } from "@deepseek-ai/dsh-attachment";
import { IMAGE_ENCODING_QUALITIES, encodeFirstWithinLimit, encodingLadder, isExhaustedEncoding } from "./encoding.ts";
import type { EncodedImage } from "./encoding.ts";
import { detectImage, encodedAlphaIsCompatible, probeImage } from "./image.ts";
import { requireSharp } from "./sharp.ts";
import type { SharpPipeline } from "./sharp.ts";

/**
 * Phiên bản biến đổi có mặt trong MỌI danh tính cache và chỉ mục tải lên; tăng số này là vô hiệu hoá
 * toàn bộ cache ảnh yêu cầu cũ.
 * Nhận: không có — hằng số phiên bản.
 * Trả: chuỗi `"request-image-v6"`, đúng giá trị của bản gốc.
 */
export const REQUEST_IMAGE_TRANSFORM_VERSION = "request-image-v6";

/** Một ứng viên ảnh yêu cầu model: bytes kèm thông số đã xác minh (hoặc nguồn giữ nguyên). */
interface RequestImageCandidate {
  /** Toàn bộ bytes của ứng viên. */
  data: Uint8Array;
  /** Media type của bytes. */
  mediaType: ImageMediaType;
  /** Chiều rộng thật của bytes. */
  width: number;
  /** Chiều cao thật của bytes. */
  height: number;
}

/** Ảnh yêu cầu model đọc được từ cache, kèm sự thật alpha đã giải mã. */
interface CachedRequestImage extends RequestImageCandidate {
  /** Bytes đã cache có kênh alpha hay không. */
  hasAlpha: boolean;
}

/**
 * Hình dạng `resize` MỘT CẠNH mà Sharp chấp nhận cho ảnh yêu cầu model. Interface của `./sharp.ts` khai
 * `resize` với CẢ HAI cạnh (đủ cho chuẩn hoá); bản gốc `request-image.js` chỉ đặt cạnh DÀI và để Sharp
 * tự suy ra cạnh ngắn theo đúng dự đoán của route, nên ở đây khai đúng hình dạng đó thay vì ép cả hai cạnh.
 */
interface ResizeOneEdge {
  /**
   * Đổi cỡ theo MỘT cạnh.
   * Nhận: `options` — một trong hai cạnh đích (cạnh còn lại suy ra theo tỉ lệ) và cờ không phóng to.
   * Trả: pipeline đã đặt phép đổi cỡ.
   */
  resize(options: { width?: number; height?: number; withoutEnlargement: boolean }): SharpPipeline;
}

/**
 * Băm SHA-256 một chuỗi mô tả và trả digest hex thường.
 * Nhận: `value` — chuỗi mô tả biến đổi cần băm.
 * Trả: chuỗi 64 ký tự hex là digest SHA-256 của chuỗi đó.
 */
function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Kiểm một số phải là số nguyên dương an toàn.
 * Nhận: `value` — số cần kiểm; `name` — tên trường dùng trong thông điệp lỗi.
 * Trả: chính `value` khi hợp lệ.
 *       Ném AttachmentError "${name} must be a positive integer." / "INVALID_ATTACHMENT_REF" khi không hợp lệ.
 */
function checkedInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new AttachmentError(`${name} must be a positive integer.`, "INVALID_ATTACHMENT_REF");
  return value;
}

/**
 * Kiểm đích yêu cầu ảnh: cả hai cạnh và trần byte đều phải là số nguyên dương.
 * Nhận: `target` — kích thước và trần byte do route chọn.
 * Trả: không (void) khi hợp lệ; ném AttachmentError của {@link checkedInteger} khi có trường sai.
 */
function validateTarget(target: ImageRequestTarget): void {
  checkedInteger(target.width, "Image request width");
  checkedInteger(target.height, "Image request height");
  checkedInteger(target.maxBytes, "Image request maxBytes");
}

/**
 * Dựng chuỗi mô tả TẤT ĐỊNH cho một cặp (tham chiếu ảnh, đích yêu cầu): mọi đầu vào biến đổi đều nằm
 * trong chuỗi này, nên hai lần gọi giống nhau cho ra cùng một danh tính cache.
 * Nhận: `attachment` — tham chiếu ảnh chuẩn hoá độc lập nhà cung cấp;
 *       `target` — kích thước và trần byte do route chọn.
 * Trả: chuỗi JSON đã chuẩn hoá, dùng làm đầu vào của {@link requestImageVariantId}.
 */
function descriptor(attachment: ImageAttachmentRef, target: ImageRequestTarget): string {
  return JSON.stringify({
    transformVersion: REQUEST_IMAGE_TRANSFORM_VERSION,
    attachmentId: attachment.attachmentId,
    targetWidth: target.width,
    targetHeight: target.height,
    encodedByteBudget: target.maxBytes,
    encoding: {
      webpQualities: IMAGE_ENCODING_QUALITIES,
      webpEffort: 0,
      jpegQualities: IMAGE_ENCODING_QUALITIES,
      order: ["alpha:webp", "opaque:jpeg"],
      colourspace: "srgb",
    },
  });
}

/**
 * Danh tính TẤT ĐỊNH đầy đủ cho một ảnh đính kèm và một đích yêu cầu do route chọn.
 * Nhận: `attachment` — tham chiếu ảnh chuẩn hoá bền, độc lập nhà cung cấp;
 *       `target` — kích thước và trần byte do route chọn.
 * Trả: {@link ImageVariantId} — digest có nhãn hiệu trên MỌI đầu vào biến đổi của yêu cầu.
 */
export function requestImageVariantId(attachment: ImageAttachmentRef, target: ImageRequestTarget): ImageVariantId {
  return ImageVariantId(`sha256:${digest(descriptor(attachment, target))}`);
}

/**
 * Đổi cỡ CHỈ theo cạnh dài của nguồn, để bộ mã hoá suy ra cạnh ngắn đúng như route dự đoán.
 * Nhận: `attachment` — bytes đã chuẩn hoá và tham chiếu của chúng;
 *       `target` — kích thước đích do route chọn.
 * Trả: pipeline Sharp sRGB đã đặt phép đổi cỡ (không phóng to ảnh nhỏ hơn đích).
 */
function pipeline(attachment: StoredImageAttachment, target: ImageRequestTarget): SharpPipeline {
  const byWidth = attachment.ref.width >= attachment.ref.height;
  const resizable = sourcePipeline(attachment) as SharpPipeline & ResizeOneEdge;
  return resizable.resize({
    ...(byWidth ? { width: target.width } : { height: target.height }),
    withoutEnlargement: true,
  });
}

/**
 * Mở pipeline Sharp từ bytes đã chuẩn hoá, từ chối bytes hỏng và ép không gian màu sRGB.
 * Nhận: `attachment` — bytes đã chuẩn hoá và tham chiếu của chúng.
 * Trả: pipeline Sharp ở không gian màu sRGB, chưa đổi cỡ.
 */
function sourcePipeline(attachment: StoredImageAttachment): SharpPipeline {
  return requireSharp()(attachment.data, {
    failOn: "error",
    limitInputPixels: false,
  }).toColourspace("srgb");
}

/**
 * Sinh một phiên bản ảnh yêu cầu model: giữ nguyên bytes nguồn khi đích không nhỏ hơn nguồn và nguồn đã
 * lọt trần byte; ngược lại chạy thang chất lượng. Khi không bậc nào lọt trần, giữ đầu ra NHỎ NHẤT.
 * Nhận: `attachment` — bytes đã chuẩn hoá và tham chiếu của chúng;
 *       `target` — kích thước đích và trần byte của route;
 *       `hasAlpha` — nguồn có kênh alpha hay không (chọn WebP thay vì JPEG).
 * Trả: promise của {@link RequestImageCandidate} — bytes nguồn giữ nguyên hoặc bytes đã mã hoá.
 */
async function createRequestImage(attachment: StoredImageAttachment, target: ImageRequestTarget, hasAlpha: boolean): Promise<RequestImageCandidate> {
  if (target.width >= attachment.ref.width && target.height >= attachment.ref.height && attachment.data.byteLength <= target.maxBytes) {
    return {
      data: attachment.data,
      mediaType: attachment.ref.mediaType,
      width: attachment.ref.width,
      height: attachment.ref.height,
    };
  }
  const encodedVersion = await encodeFirstWithinLimit(encodingLadder(pipeline(attachment, target), hasAlpha), target.maxBytes);
  return isExhaustedEncoding(encodedVersion) ? encodedVersion.smallest : encodedVersion;
}

/**
 * Dựng đường dẫn cache cho một danh tính biến đổi dưới gốc cache tệp đính kèm.
 * Nhận: `root` — gốc cache tệp đính kèm (tuyệt đối); `hash` — digest hex của biến đổi.
 * Trả: đường dẫn tuyệt đối `request-images/<2 ký tự đầu>/<digest>`.
 */
function cachePath(root: string, hash: string): string {
  return join(root, "request-images", hash.slice(0, 2), hash);
}

/**
 * Đọc một phiên bản đã cache và chỉ chấp nhận khi nó đúng 8-bit sRGB, không vượt đích, và alpha tương
 * thích với nguồn.
 * Nhận: `path` — đường dẫn tệp cache; `target` — kích thước đích của route;
 *       `expectedAlpha` — sự thật alpha của nguồn (hoặc undefined khi chưa xác định);
 *       `signal` — (tuỳ chọn) tín hiệu huỷ cho việc đọc tệp.
 * Trả: promise của {@link CachedRequestImage} khi dùng được, hoặc `undefined` khi thiếu tệp, đọc lỗi,
 *       hoặc metadata không đạt — bên gọi sẽ sinh lại.
 */
async function readCached(path: string, target: ImageRequestTarget, expectedAlpha: boolean | undefined, signal?: AbortSignal): Promise<CachedRequestImage | undefined> {
  try {
    const data = new Uint8Array(await readFile(path, { signal }));
    const detected = await probeImage(data);
    if (
      detected.depth !== "uchar" ||
      detected.space !== "srgb" ||
      detected.width > target.width ||
      detected.height > target.height ||
      !encodedAlphaIsCompatible(expectedAlpha, detected)
    ) {
      return undefined;
    }
    return {
      data,
      mediaType: detected.mediaType,
      width: detected.width,
      height: detected.height,
      hasAlpha: detected.hasAlpha,
    };
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === "ENOENT") return undefined;
    signal?.throwIfAborted();
    return undefined;
  }
}

/**
 * Xác minh một ảnh yêu cầu model vừa mã hoá bằng cách GIẢI MÃ ĐẦY ĐỦ nó và đối chiếu mọi sự thật.
 * Nhận: `image` — bytes vừa mã hoá kèm thông số kỳ vọng;
 *       `expectedAlpha` — sự thật alpha của nguồn (hoặc undefined khi chưa xác định).
 * Trả: promise của {@link CachedRequestImage} — chính ảnh đó kèm `hasAlpha` đã giải mã.
 *       Ném AttachmentError "Encoded model-request image does not match its verified 8-bit sRGB metadata."
 *       / "ATTACHMENT_WRITE_FAILED" khi lệch độ sâu, không gian màu, kích thước, media type hoặc alpha.
 */
async function verifyRequestImage(image: RequestImageCandidate, expectedAlpha: boolean | undefined): Promise<CachedRequestImage> {
  const detected = await detectImage(image.data);
  if (
    detected.depth !== "uchar" ||
    detected.space !== "srgb" ||
    detected.width !== image.width ||
    detected.height !== image.height ||
    detected.mediaType !== image.mediaType ||
    !encodedAlphaIsCompatible(expectedAlpha, detected)
  ) {
    throw new AttachmentError("Encoded model-request image does not match its verified 8-bit sRGB metadata.", "ATTACHMENT_WRITE_FAILED");
  }
  return {
    ...image,
    hasAlpha: detected.hasAlpha,
  };
}

/**
 * Ghi một phiên bản ảnh yêu cầu model vào cache NGUYÊN TỬ: ghi tệp tạm độc quyền rồi `rename` đè lên đích.
 * Nhận: `path` — đường dẫn tệp cache đích; `data` — bytes cần ghi.
 * Trả: promise hoàn tất (void) khi đích đã mang bytes mới; tệp tạm luôn được dọn trong `finally`.
 */
async function writeCached(path: string, data: Uint8Array): Promise<void> {
  await mkdir(dirname(path), {
    recursive: true,
    mode: 0o700, // 448 = 0o700.
  });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, data, {
      mode: 0o600, // 384 = 0o600.
      flag: "wx",
    });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

/**
 * Sinh hoặc dùng lại MỘT ảnh yêu cầu model dưới gốc cache tệp đính kèm cục bộ.
 * Nhận: `root` — gốc cache tệp đính kèm (tuyệt đối; biến thể nằm trong thư mục con `request-images`);
 *       `attachment` — bytes ảnh chuẩn hoá đã xác minh và tham chiếu của chúng;
 *       `target` — đúng kích thước và trần byte do route chọn; đích lớn hơn nguồn thì giữ cỡ nguồn;
 *       `signal` — (tuỳ chọn) tín hiệu huỷ cho I/O cache và phép biến đổi ảnh.
 * Trả: promise của {@link RequestImageAttachment} — bytes đã xác minh kèm danh tính biến thể tất định.
 *       Ném lý do huỷ khi bị huỷ; AttachmentError của {@link validateTarget} / {@link verifyRequestImage}.
 */
export async function readRequestImageFile(root: string, attachment: StoredImageAttachment, target: ImageRequestTarget, signal?: AbortSignal): Promise<RequestImageAttachment> {
  signal?.throwIfAborted();
  validateTarget(target);
  const source = await probeImage(attachment.data);
  const variantId = requestImageVariantId(attachment.ref, target);
  const path = cachePath(root, String(variantId).slice(7));
  const cached = await readCached(path, target, source.hasAlpha, signal);
  const created = cached ?? (await createRequestImage(attachment, target, source.hasAlpha));
  const version =
    cached ??
    (created.data === attachment.data
      ? {
          ...created,
          hasAlpha: source.hasAlpha,
        }
      : await verifyRequestImage(created, source.hasAlpha));
  signal?.throwIfAborted();
  if (cached === undefined && version.data !== attachment.data) await writeCached(path, version.data);
  return {
    variantId,
    attachment: attachment.ref,
    data: version.data,
    mediaType: version.mediaType,
    bytes: version.data.byteLength,
    width: version.width,
    height: version.height,
    depth: "uchar",
    space: "srgb",
    hasAlpha: version.hasAlpha,
  };
}
