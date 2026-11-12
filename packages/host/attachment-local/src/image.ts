/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểm tra raster: GIẢI MÃ TOÀN BỘ lúc biên nhận, chỉ ĐỌC HEADER ở lượt đọc đã xác minh digest — `encodedAlphaIsCompatible`, `MEDIA_TYPES`, `carriesRetainedMetadata`, `imageMetadata`, `probeImage`, `detectImage` — bản viết lại 1:1 vùng `lib/types/image.js` của @deepseek-ai/dsh-attachment-local.
 */

import { AttachmentError } from "@deepseek-ai/dsh-attachment";
import type { ImageMediaType } from "@deepseek-ai/dsh-attachment";
import { requireSharp } from "./sharp.ts";
import type { SharpMetadata, SharpPipeline } from "./sharp.ts";

/** Sự thật của một ảnh đã giải mã: định dạng, kích thước người xem thấy, và các cờ ảnh hưởng chuẩn hoá. */
export interface DetectedImage {
  /** Media type công khai của container đã nhận ra. */
  mediaType: ImageMediaType;
  /** Chiều rộng BẢN CHẤT đã áp EXIF orientation — chiều rộng người xem cảm nhận. */
  width: number;
  /** Chiều cao BẢN CHẤT đã áp EXIF orientation — chiều cao người xem cảm nhận. */
  height: number;
  /** Container có nhiều hơn một khung hay không. */
  animated: boolean;
  /** Bytes có mang metadata mô tả, profile màu, hoặc orientation hay không. */
  carriesMetadata: boolean;
  /** Độ sâu mẫu Sharp báo cho các kênh đã giải mã. */
  depth: string;
  /** Không gian màu Sharp báo cho pixel đã giải mã. */
  space: string;
  /** Pixel đã giải mã có kênh alpha hay không. */
  hasAlpha: boolean;
}

/**
 * Kiểm tra metadata alpha của bytes do CHÍNH các bộ mã hoá của gói này sinh ra.
 * Sharp/libvips có thể BỎ một mặt phẳng alpha hoàn toàn đục khỏi đầu ra WebP; mọi thêm/bớt khác đều
 * nghĩa là kết quả mã hoá không tương thích với sự thật của nguồn.
 * Nhận: `sourceHasAlpha` — bytes nguồn có khai mặt phẳng alpha hay không, hoặc `undefined` khi khung
 *       nguồn không xác định; `output` — media type và metadata alpha đã giải mã của kết quả.
 * Trả: true khi metadata alpha đầu ra tương thích với nguồn.
 */
export function encodedAlphaIsCompatible(
  sourceHasAlpha: boolean | undefined,
  output: Pick<DetectedImage, "mediaType" | "hasAlpha">,
): boolean {
  return (
    sourceHasAlpha === void 0 ||
    output.hasAlpha === sourceHasAlpha ||
    (sourceHasAlpha === true && !output.hasAlpha && output.mediaType === "image/webp")
  );
}

/** Bảng ánh xạ `format` do Sharp báo sang media type công khai mà biên nhận chấp nhận. */
export const MEDIA_TYPES: Readonly<Record<string, ImageMediaType>> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Cho biết bytes có mang metadata cần LOẠI BỎ khi chuẩn hoá hay không.
 * Nhận: `metadata` — metadata header của ảnh nguồn.
 * Trả: true khi có EXIF/XMP/IPTC/ICC, profile màu, tag Photoshop, chú thích, hoặc orientation.
 */
export function carriesRetainedMetadata(metadata: SharpMetadata): boolean {
  return (
    metadata.exif !== void 0 ||
    metadata.xmp !== void 0 ||
    metadata.iptc !== void 0 ||
    metadata.icc !== void 0 ||
    metadata.hasProfile ||
    metadata.tifftagPhotoshop !== void 0 ||
    metadata.comments !== void 0 ||
    metadata.orientation !== void 0
  );
}

/**
 * Đọc metadata của một pipeline đã mở và chuyển thành {@link DetectedImage}.
 * Nhận: `image` — pipeline Sharp đã mở từ bytes (chưa giải mã pixel).
 * Trả: promise sự thật của ảnh; định dạng lạ hoặc hỏng ném
 *       `AttachmentError("Unsupported or malformed image data.", "INVALID_IMAGE")`.
 *       Orientation 5–8 (ảnh bị xoay) hoán đổi width/height để khớp cái người xem thấy.
 */
export async function imageMetadata(image: SharpPipeline): Promise<DetectedImage> {
  const metadata = await image.metadata();
  const mediaType = MEDIA_TYPES[metadata.format];
  if (mediaType === void 0) throw new AttachmentError("Unsupported or malformed image data.", "INVALID_IMAGE");
  const transposed = metadata.orientation !== void 0 && metadata.orientation >= 5;
  return {
    mediaType,
    width: transposed ? metadata.height : metadata.width,
    height: transposed ? metadata.width : metadata.height,
    animated: (metadata.pages ?? 1) > 1,
    carriesMetadata: carriesRetainedMetadata(metadata),
    depth: metadata.depth,
    space: metadata.space,
    hasAlpha: metadata.hasAlpha,
  };
}

/**
 * Đọc HEADER của một raster được hỗ trợ và trả metadata bản chất mà KHÔNG giải mã pixel. Lượt đọc đã
 * xác minh digest dùng hàm này: biên nhận đã chứng minh đúng những bytes này giải mã trọn vẹn, nên
 * đường đọc chỉ cần suy lại các trường tham chiếu thay vì trả giá giải mã toàn bộ raster lần nữa.
 * Nhận: `data` — toàn bộ bytes ảnh đã mã hoá.
 * Trả: promise định dạng và kích thước đã xác minh; lỗi được bọc thành `INVALID_IMAGE` như bản gốc.
 */
export async function probeImage(data: Uint8Array): Promise<DetectedImage> {
  const sharp = requireSharp();
  try {
    return await imageMetadata(sharp(data, {
      failOn: "error",
      limitInputPixels: false,
    }));
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError("Unsupported or malformed image data.", "INVALID_IMAGE", { cause: error });
  }
}

/** Giới hạn biên nhận áp lên kích thước bản chất của một raster đã giải mã. */
export interface DecodedImageLimits {
  /** Trần pixel đã giải mã (width nhân height). */
  maxPixels?: number;
  /** Trần mỗi cạnh, áp riêng cho width và height. */
  maxDimension?: number;
}

/**
 * GIẢI MÃ TOÀN BỘ một raster được hỗ trợ rồi trả metadata bản chất của nó.
 * Nhận: `data` — toàn bộ bytes ảnh đã mã hoá; `limits` — trần biên nhận theo kích thước (bỏ trống thì không áp).
 * Trả: promise sự thật đã xác minh, CHỈ sau khi toàn bộ pixel được giải mã thành công
 *       (`image.raw().toBuffer()`). Vượt trần ném `IMAGE_TOO_MANY_PIXELS` / `IMAGE_DIMENSION_TOO_LARGE`;
 *       bytes hỏng ném `INVALID_IMAGE`.
 */
export async function detectImage(data: Uint8Array, limits?: DecodedImageLimits): Promise<DetectedImage> {
  const sharp = requireSharp();
  try {
    const image = sharp(data, {
      failOn: "error",
      limitInputPixels: false,
    });
    const detected = await imageMetadata(image);
    if (limits?.maxPixels !== void 0 && detected.width * detected.height > limits.maxPixels) throw new AttachmentError("Image exceeds the configured decoded-pixel limit.", "IMAGE_TOO_MANY_PIXELS");
    if (limits?.maxDimension !== void 0 && Math.max(detected.width, detected.height) > limits.maxDimension) throw new AttachmentError("Image exceeds the configured per-side pixel limit.", "IMAGE_DIMENSION_TOO_LARGE");
    await image.raw().toBuffer();
    return detected;
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError("Unsupported or malformed image data.", "INVALID_IMAGE", { cause: error });
  }
}
