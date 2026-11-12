/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Thang chất lượng dùng chung và cách chạy ứng viên LƯỜI cho cả bộ mã hoá chuẩn hoá lẫn bộ mã hoá ảnh yêu cầu model: `IMAGE_ENCODING_QUALITIES`, `encode`, `encodingLadder`, `encodeFirstWithinLimit`, `isExhaustedEncoding` — bản viết lại 1:1 vùng `lib/types/encoding.js` của @deepseek-ai/dsh-attachment-local.
 */

import type { SharpPipeline } from "./sharp.ts";

/**
 * Thang chất lượng DÙNG CHUNG cho cả hai bộ mã hoá: các bậc giãn cách để mỗi bước mua được một mức
 * giảm kích thước thật (85 → 75 → 60), thay vì những bậc sát nhau gần như không đổi số byte.
 */
export const IMAGE_ENCODING_QUALITIES = [85, 75, 60] as const;

/**
 * Mức effort cố định cho lossy WebP: 0, vì tìm kiếm sâu hơn tốn 3–4 lần thời gian mã hoá để đổi
 * lấy khoảng 5% kích thước. Giá trị này nằm cùng vùng mã hoá trong bản gốc (bị bundler nội suy
 * trực tiếp thành `effort: 0`), nên giữ ở đây dưới dạng hằng nội bộ chứ không xuất khẩu.
 */
const WEBP_ENCODING_EFFORT = 0;

/** Đầu ra của MỘT bậc thang chất lượng: bytes trọn vẹn kèm thông số chính xác của ảnh đã mã hoá. */
export interface EncodedImage {
  /** Toàn bộ bytes của ảnh đã mã hoá. */
  data: Uint8Array;
  /** Codec đã dùng — WebP khi nguồn có alpha, JPEG khi không. */
  mediaType: "image/jpeg" | "image/webp";
  /** Chiều rộng thật của ảnh đã mã hoá (đơn vị pixel). */
  width: number;
  /** Chiều cao thật của ảnh đã mã hoá (đơn vị pixel). */
  height: number;
}

/** Một ứng viên đã mã hoá, chỉ cần bytes để so với trần byte. */
export interface EncodedCandidate {
  /** Toàn bộ bytes của ứng viên. */
  data: Uint8Array;
}

/** Kết quả khi đã chạy HẾT ứng viên ở một cỡ raster mà không có đầu ra nào lọt trần byte. */
export interface ExhaustedEncoding<T extends EncodedCandidate> {
  /** Ứng viên NHỎ NHẤT trong số đã chạy xong — bên gọi vẫn dùng nó thay vì bỏ ảnh. */
  smallest: T;
}

/**
 * Mã hoá MỘT pipeline đã chuẩn bị sang WebP (giữ alpha) hoặc JPEG, rồi trả bytes kèm thông số.
 * Nhận: `pipeline` — pipeline sRGB đã định cỡ (bị tiêu thụ bởi lần mã hoá này);
 *       `mediaType` — codec đích, `image/webp` hoặc `image/jpeg`;
 *       `quality` — bậc chất lượng trong thang.
 * Trả: promise của {@link EncodedImage} với bytes đã sao thành `Uint8Array` và width/height do Sharp báo.
 */
export async function encode(
  pipeline: SharpPipeline,
  mediaType: "image/webp" | "image/jpeg",
  quality: number,
): Promise<EncodedImage> {
  const { data, info } = await (mediaType === "image/webp" ? pipeline.webp({ quality, effort: WEBP_ENCODING_EFFORT }) : pipeline.jpeg({ quality })).toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8Array(data),
    mediaType,
    width: info.width,
    height: info.height,
  };
}

/**
 * Dựng thang chất lượng LƯỜI cho một pipeline đã chuẩn bị: WebP giữ kênh alpha của nguồn, mọi trường
 * hợp khác là JPEG. Mỗi bậc `clone()` pipeline tại thời điểm chạy nên chỉ bậc thật sự được dùng mới
 * tốn công mã hoá.
 * Nhận: `prepared` — pipeline sRGB đã định cỡ, được nhân bản cho từng ứng viên;
 *       `hasAlpha` — sự thật alpha đã giải mã của nguồn, dùng để chọn codec.
 * Trả: mảng bộ mã hoá xếp từ chất lượng CAO NHẤT xuống THẤP NHẤT theo thang.
 */
export function encodingLadder(prepared: SharpPipeline, hasAlpha: boolean): Array<() => Promise<EncodedImage>> {
  const mediaType = hasAlpha ? "image/webp" : "image/jpeg";
  return IMAGE_ENCODING_QUALITIES.map((quality) => () => encode(prepared.clone(), mediaType, quality));
}

/**
 * Chạy các ứng viên mã hoá theo thứ tự ưu tiên và DỪNG ngay sau ứng viên đầu tiên lọt trần byte.
 * Nhận: `attempts` — các bộ mã hoá lười, xếp từ biểu diễn ưu tiên tới dự phòng;
 *       `maxBytes` — trần byte đầu ra (số dương).
 * Trả: ứng viên ĐẦU TIÊN lọt trần; nếu không ứng viên nào lọt thì ứng viên NHỎ NHẤT đã chạy xong,
 *       bọc trong {@link ExhaustedEncoding}. Ném lỗi khi danh sách ứng viên rỗng.
 */
export async function encodeFirstWithinLimit<T extends EncodedCandidate>(
  attempts: readonly (() => Promise<T>)[],
  maxBytes: number,
): Promise<T | ExhaustedEncoding<T>> {
  const [first, ...remaining] = attempts;
  if (first === void 0) throw new Error("image encoding requires at least one candidate");
  let smallest = await first();
  if (smallest.data.byteLength <= maxBytes) return smallest;
  for (const attempt of remaining) {
    const candidate = await attempt();
    if (candidate.data.byteLength <= maxBytes) return candidate;
    if (candidate.data.byteLength < smallest.data.byteLength) smallest = candidate;
  }
  return { smallest };
}

/**
 * Cho biết một kết quả mã hoá lười đã VÉT SẠCH mọi ứng viên ở một cỡ mà không có đầu ra lọt trần hay chưa.
 * Nhận: `result` — ứng viên đầu tiên lọt trần, hoặc kết quả đã vét sạch.
 * Trả: true khi mọi ứng viên đều vượt trần byte (kết quả là {@link ExhaustedEncoding}).
 */
export function isExhaustedEncoding<T extends EncodedCandidate>(result: T | ExhaustedEncoding<T>): result is ExhaustedEncoding<T> {
  return "smallest" in result;
}
