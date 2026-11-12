/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Truy cập LƯỜI ở phạm vi tiến trình tới entry CommonJS-compatible của Sharp: `requireSharp` chỉ nạp thư viện native ở thao tác raster ĐẦU TIÊN và giữ lại export callable — bản viết lại 1:1 vùng `lib/types/sharp.js` của @deepseek-ai/dsh-attachment-local. Kèm các interface TỐI THIỂU thay cho kiểu của gói `sharp` (repo không có dependency này).
 */

import { createLazyRequire } from "@deepseek-ai/dsh-lazy-require";

/** Tuỳ chọn mở một pipeline Sharp từ bytes đã mã hoá (chỉ khai phần gói này dùng). */
export interface SharpInputOptions {
  /** Mức chịu lỗi khi giải mã; gói này luôn truyền `"error"` để bytes hỏng bị từ chối. */
  failOn?: "none" | "truncated" | "error" | "warning";
  /** Cho phép ảnh vượt trần pixel mặc định của Sharp; gói này luôn truyền `false` vì tự áp trần của mình. */
  limitInputPixels?: boolean;
}

/**
 * Metadata ĐỌC TỪ HEADER mà gói này dùng, khai tối thiểu theo kiểu của Sharp.
 * Các trường `format`, `width`, `height`, `depth`, `space`, `hasAlpha`, `hasProfile` là bắt buộc vì
 * Sharp luôn báo chúng cho ảnh đã mở được; các trường còn lại chỉ được kiểm tra CÓ MẶT.
 */
export interface SharpMetadata {
  /** Định dạng container do Sharp nhận ra (`png`, `jpeg`, `webp`, `gif`...). */
  format: string;
  /** Chiều rộng gốc trong header (chưa áp EXIF orientation). */
  width: number;
  /** Chiều cao gốc trong header (chưa áp EXIF orientation). */
  height: number;
  /** Số khung của container; vắng mặt nghĩa là một khung. */
  pages?: number;
  /** Giá trị EXIF orientation 1–8; vắng mặt nghĩa là không khai. */
  orientation?: number;
  /** Độ sâu mẫu của kênh đã giải mã (`uchar`, `ushort`...). */
  depth: string;
  /** Không gian màu của pixel đã giải mã (`srgb`, `rgb16`...). */
  space: string;
  /** Pixel đã giải mã có kênh alpha hay không. */
  hasAlpha: boolean;
  /** Bytes EXIF giữ lại trong ảnh, nếu có. */
  exif?: unknown;
  /** Bytes XMP giữ lại trong ảnh, nếu có. */
  xmp?: unknown;
  /** Bytes IPTC giữ lại trong ảnh, nếu có. */
  iptc?: unknown;
  /** Bytes ICC giữ lại trong ảnh, nếu có. */
  icc?: unknown;
  /** Ảnh có profile màu nhúng hay không. */
  hasProfile: boolean;
  /** Bytes TIFF tag Photoshop giữ lại trong ảnh, nếu có. */
  tifftagPhotoshop?: unknown;
  /** Chú thích nhúng trong ảnh, nếu có. */
  comments?: unknown;
}

/** Thông số của ảnh ĐẦU RA do Sharp báo sau khi mã hoá xong. */
export interface SharpOutputInfo {
  /** Chiều rộng thật của ảnh đã mã hoá. */
  width: number;
  /** Chiều cao thật của ảnh đã mã hoá. */
  height: number;
}

/** Kết quả `toBuffer({ resolveWithObject: true })`: bytes kèm thông số đầu ra. */
export interface SharpBufferResult {
  /** Bytes đã mã hoá (Buffer của Node, đọc được như `Uint8Array`). */
  data: Uint8Array;
  /** Thông số của ảnh vừa mã hoá. */
  info: SharpOutputInfo;
}

/**
 * Chuỗi thao tác BẤT BIẾN của Sharp: mỗi lời gọi trả về một pipeline mới, pipeline cũ không bị sửa,
 * nên `clone()` ở đây chỉ là cách bản gốc tách nhánh cho từng ứng viên chất lượng.
 */
export interface SharpPipeline {
  /**
   * Đọc metadata từ header (không giải mã toàn bộ pixel).
   * Nhận: không.
   * Trả: promise metadata tối thiểu của ảnh đã mở.
   */
  metadata(): Promise<SharpMetadata>;
  /** Yêu cầu giải mã pixel thô. Nhận: không. Trả: pipeline đã chuyển sang chế độ raw. */
  raw(): SharpPipeline;
  /** Nhân bản pipeline để tách nhánh mã hoá. Nhận: không. Trả: một pipeline độc lập cùng cấu hình. */
  clone(): SharpPipeline;
  /**
   * Chọn codec lossy WebP.
   * Nhận: `options` — chất lượng và effort.
   * Trả: pipeline đã đặt đầu ra WebP.
   */
  webp(options: { quality: number; effort: number }): SharpPipeline;
  /**
   * Chọn codec JPEG.
   * Nhận: `options` — chất lượng nén.
   * Trả: pipeline đã đặt đầu ra JPEG.
   */
  jpeg(options: { quality: number }): SharpPipeline;
  /** Xoay ảnh theo EXIF rồi bỏ orientation. Nhận: không. Trả: pipeline đã áp orientation. */
  rotate(): SharpPipeline;
  /**
   * Ép không gian màu đầu ra.
   * Nhận: `space` — tên không gian màu của Sharp (`"srgb"`).
   * Trả: pipeline đã đặt không gian màu đích.
   */
  toColourspace(space: string): SharpPipeline;
  /**
   * Đổi cỡ ảnh.
   * Nhận: `options` — kích thước đích, kiểu vừa `"inside"`, và cờ không phóng to.
   * Trả: pipeline đã đặt phép đổi cỡ.
   */
  resize(options: { width: number; height: number; fit: "inside"; withoutEnlargement: boolean }): SharpPipeline;
  /**
   * Chạy pipeline và lấy bytes đầu ra (không kèm thông số).
   * Nhận: không.
   * Trả: promise bytes đã mã hoá.
   */
  toBuffer(): Promise<Uint8Array>;
  /**
   * Chạy pipeline và lấy bytes đầu ra kèm thông số.
   * Nhận: `options` — luôn `{ resolveWithObject: true }` trong gói này.
   * Trả: promise bytes + thông số đầu ra.
   */
  toBuffer(options: { resolveWithObject: true }): Promise<SharpBufferResult>;
}

/** Hàm khởi tạo Sharp: nhận bytes đã mã hoá (và tuỳ chọn mở) rồi trả một pipeline. */
export interface SharpConstructor {
  /**
   * Mở một ảnh từ bytes đã mã hoá.
   * Nhận: `input` — toàn bộ bytes đã mã hoá; `options` — mức chịu lỗi và trần pixel của Sharp.
   * Trả: pipeline Sharp sẵn sàng cho các thao tác tiếp theo.
   */
  (input: Uint8Array, options?: SharpInputOptions): SharpPipeline;
}

/**
 * Nạp Sharp ở lần thao tác raster ĐẦU TIÊN và giữ export callable của nó; lần nạp HỎNG không được ghi nhớ
 * nên một cài đặt được sửa vẫn thử lại được (hành vi của `createLazyRequire`).
 * Nhận: không — bộ nạp zero-arg do `createLazyRequire` dựng sẵn, neo theo `import.meta.url` của tệp này.
 * Trả: hàm khởi tạo Sharp (mở ảnh từ bytes); lần gọi đầu tiên mới thật sự `require("sharp")`.
 */
export const requireSharp: () => SharpConstructor = createLazyRequire<SharpConstructor>("sharp", import.meta.url);
