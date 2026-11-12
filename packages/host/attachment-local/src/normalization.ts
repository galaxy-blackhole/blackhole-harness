/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chuẩn hoá ảnh TẤT ĐỊNH, độc lập nhà cung cấp: `canPassThroughNormalization`, `verifyNormalizedImage`, `preparedPipeline`, `initialDimensions`, `normalizeImage` — nguồn đã sạch, một khung, 8-bit sRGB/sRGBA thì đi thẳng nguyên byte; còn lại được xoay theo EXIF, ép sRGB, thu về trong trần pixel rồi chạy thang chất lượng — bản viết lại 1:1 vùng `lib/types/normalization.js` của @deepseek-ai/dsh-attachment-local.
 */

import { AttachmentError, requestImageDimensions } from "@deepseek-ai/dsh-attachment";
import type { ImageMediaType } from "@deepseek-ai/dsh-attachment";
import { encodeFirstWithinLimit, encodingLadder, isExhaustedEncoding } from "./encoding.ts";
import { detectImage, encodedAlphaIsCompatible } from "./image.ts";
import type { DetectedImage } from "./image.ts";
import { requireSharp } from "./sharp.ts";
import type { SharpConstructor, SharpPipeline } from "./sharp.ts";

/** Chính sách chuẩn hoá do nơi triển khai quyết định cho ảnh đính kèm đã lưu. */
export interface NormalizationPolicy {
  /** Ngân sách tổng pixel; nguồn lớn hơn bị thu nhỏ theo đúng tỉ lệ. */
  maxPixels: number;
  /** Trần cạnh dài tính bằng pixel, áp SAU ngân sách tổng pixel, chặn các tỉ lệ khung cực đoan. */
  maxDimension: number;
  /** Trần byte đã mã hoá cho thang chất lượng; không bậc nào lọt thì giữ đầu ra nhỏ nhất. */
  maxBytes: number;
}

/** Bytes đã chuẩn hoá bên cạnh các sự thật mà một tham chiếu bền vững ghi lại. */
export interface NormalizedImage {
  /** Toàn bộ bytes của ảnh đã chuẩn hoá. */
  data: Uint8Array;
  /** Media type của bytes đã chuẩn hoá. */
  mediaType: ImageMediaType;
  /** Chiều rộng đã chuẩn hoá. */
  width: number;
  /** Chiều cao đã chuẩn hoá. */
  height: number;
}

/**
 * Cho biết bytes đã thoả mọi yêu cầu chuẩn hoá hay chưa.
 * Nhận: `detected` — sự thật nguồn đã giải mã toàn bộ; `bytes` — độ dài nguồn đã mã hoá;
 *       `policy` — các trần chuẩn hoá đã giải.
 * Trả: true khi nguồn có thể đi thẳng NGUYÊN BYTE (không GIF, không nhiều khung, không metadata,
 *       8-bit sRGB/sRGBA, và nằm trong mọi trần byte/pixel/cạnh dài).
 */
export function canPassThroughNormalization(detected: DetectedImage, bytes: number, policy: NormalizationPolicy): boolean {
  return (
    detected.mediaType !== "image/gif" &&
    !detected.animated &&
    !detected.carriesMetadata &&
    detected.depth === "uchar" &&
    detected.space === "srgb" &&
    bytes <= policy.maxBytes &&
    detected.width * detected.height <= policy.maxPixels &&
    Math.max(detected.width, detected.height) <= policy.maxDimension
  );
}

/**
 * Khẳng định đầu ra đã chuẩn hoá là ảnh MỘT KHUNG, 8-bit sRGB/sRGBA với các sự thật khớp đầu vào.
 * Nhận: `image` — bytes đã chuẩn hoá cùng các sự thật mà tham chiếu sẽ ghi;
 *       `expectedAlpha` — sự thật alpha mong đợi của nguồn, hoặc `undefined` khi khung nguồn không xác định.
 * Trả: chính `image` khi đã xác minh (giải mã lại toàn bộ bytes); lệch bất kỳ trường nào ném
 *       `AttachmentError("Image normalization did not produce a single-frame 8-bit sRGB image with matching metadata.", "ATTACHMENT_WRITE_FAILED")`.
 */
export async function verifyNormalizedImage(image: NormalizedImage, expectedAlpha: boolean | undefined): Promise<NormalizedImage> {
  const detected = await detectImage(image.data);
  if (
    detected.mediaType !== image.mediaType ||
    detected.width !== image.width ||
    detected.height !== image.height ||
    detected.animated ||
    detected.carriesMetadata ||
    detected.depth !== "uchar" ||
    detected.space !== "srgb" ||
    !encodedAlphaIsCompatible(expectedAlpha, detected)
  ) {
    throw new AttachmentError(
      "Image normalization did not produce a single-frame 8-bit sRGB image with matching metadata.",
      "ATTACHMENT_WRITE_FAILED",
    );
  }
  return image;
}

/**
 * Dựng MỘT pipeline sRGB cỡ cố định, đã xoay theo orientation và không mang metadata, từ bytes đã nộp.
 * Nhận: `sharp` — hàm khởi tạo Sharp; `data` — toàn bộ bytes nguồn đã biên nhận;
 *       `width`/`height` — kích thước đích của phép đổi cỡ.
 * Trả: pipeline Sharp đã `rotate()` → `toColourspace("srgb")` → `resize({ fit: "inside", withoutEnlargement: true })`.
 */
export function preparedPipeline(sharp: SharpConstructor, data: Uint8Array, width: number, height: number): SharpPipeline {
  return sharp(data, {
    failOn: "error",
    limitInputPixels: false,
  }).rotate().toColourspace("srgb").resize({
    width,
    height,
    fit: "inside",
    withoutEnlargement: true,
  });
}

/**
 * Kích thước đích: trong ngân sách TỔNG PIXEL trước, rồi tới trần CẠNH DÀI, không đổi tỉ lệ khung.
 * Nhận: `detected` — sự thật kích thước nguồn; `policy` — ngân sách pixel và trần cạnh dài.
 * Trả: `{ width, height }` đã làm tròn xuống (mỗi cạnh tối thiểu 1 pixel).
 */
export function initialDimensions(detected: DetectedImage, policy: NormalizationPolicy): { width: number; height: number } {
  const budgeted = requestImageDimensions(detected.width, detected.height, policy.maxPixels);
  const longEdge = Math.max(budgeted.width, budgeted.height);
  if (longEdge <= policy.maxDimension) return budgeted;
  const scale = policy.maxDimension / longEdge;
  return {
    width: Math.max(1, Math.floor(budgeted.width * scale)),
    height: Math.max(1, Math.floor(budgeted.height * scale)),
  };
}

/**
 * Sinh bản chuẩn hoá độc lập nhà cung cấp sẽ được LƯU cho một nguồn đã giải mã toàn bộ.
 * Nguồn chỉ đi thẳng khi đã sạch, một khung, 8-bit sRGB/sRGBA và nằm trong mọi trần chuẩn hoá.
 * Mã hoá lại KHÔNG BAO GIỜ làm mất độ trong suốt. Khi mọi bậc chất lượng đều vượt trần byte thì giữ
 * đầu ra NHỎ NHẤT của thang; trần byte của nhà cung cấp vẫn do route truyền bytes áp.
 * Nhận: `data` — toàn bộ bytes nguồn đã biên nhận; `detected` — sự thật nguồn đã giải mã toàn bộ;
 *       `policy` — các trần chuẩn hoá độc lập đã giải.
 * Trả: promise bytes đã chuẩn hoá độc lập nhà cung cấp ĐÃ XÁC MINH kèm metadata.
 *       Lỗi chuyển đổi được bọc thành `ATTACHMENT_WRITE_FAILED` với mô tả nêu độ sâu + định dạng nguồn
 *       (PNG 16-bit được gọi đích danh); lỗi `AttachmentError` sẵn có được ném lại nguyên vẹn.
 */
export async function normalizeImage(data: Uint8Array, detected: DetectedImage, policy: NormalizationPolicy): Promise<NormalizedImage> {
  if (canPassThroughNormalization(detected, data.byteLength, policy)) {
    return {
      data,
      mediaType: detected.mediaType,
      width: detected.width,
      height: detected.height,
    };
  }
  const sharp = requireSharp();
  try {
    const { width, height } = initialDimensions(detected, policy);
    const encoded = await encodeFirstWithinLimit(encodingLadder(preparedPipeline(sharp, data, width, height), detected.hasAlpha), policy.maxBytes);
    return await verifyNormalizedImage(
      isExhaustedEncoding(encoded) ? encoded.smallest : encoded,
      detected.mediaType === "image/gif" ? void 0 : detected.hasAlpha,
    );
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError(
      `The ${detected.mediaType === "image/png" && detected.depth !== "uchar" ? `${detected.depth === "ushort" ? "16-bit" : detected.depth} PNG` : `${detected.depth} ${detected.mediaType.slice(6).toUpperCase()}`} could not be converted to the normalized 8-bit sRGB form.`,
      "ATTACHMENT_WRITE_FAILED",
      { cause: error },
    );
  }
}
