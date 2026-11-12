/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc So ảnh PNG bằng pixelmatch + pngjs, trả số liệu pixel và ảnh diff
 */

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/** Kết quả so hai ảnh PNG. */
export interface ImageDiffResult {
  /** true khi so được (hai ảnh cùng kích thước). */
  ok: boolean;
  /** Lý do khi `ok = false`. */
  reason?: string;
  /** Chiều rộng khung. */
  width: number;
  /** Chiều cao khung. */
  height: number;
  /** Tổng số pixel của khung. */
  totalPixels: number;
  /** Số pixel khác nhau theo pixelmatch. */
  diffPixels: number;
  /** Tỉ lệ pixel khác nhau (0..1). */
  ratio: number;
  /** Ngưỡng tỉ lệ được phép. */
  thresholdRatio: number;
  /** true khi `ratio <= thresholdRatio`. */
  pass: boolean;
  /** Ảnh diff PNG (đã tô đỏ pixel khác, viền xanh quanh vùng mask). */
  diffPng?: Buffer;
  /** Số pixel bị bỏ qua vì nằm trong vùng mask. */
  maskedPixels: number;
  /** Số pixel khác nhau khi KHÔNG mask (số thô để đối chiếu). */
  rawDiffPixels: number;
  /** Tỉ lệ thô khi không mask. */
  rawRatio: number;
}

/** Thông tin kích thước ảnh PNG. */
export interface PngInfo {
  /** Chiều rộng. */
  width: number;
  /** Chiều cao. */
  height: number;
}

/**
 * Đọc kích thước của một buffer PNG.
 * @param buffer nội dung file PNG.
 * @returns kích thước, hoặc null nếu buffer không phải PNG hợp lệ.
 */
export function pngSize(buffer: Buffer): PngInfo | null {
  if (buffer.length < 24) return null;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let index = 0; index < signature.length; index += 1) {
    if (buffer[index] !== signature[index]) return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * So hai ảnh PNG cùng kích thước bằng pixelmatch.
 * @param refPng ảnh tham chiếu.
 * @param oursPng ảnh của ta.
 * @param thresholdRatio ngưỡng tỉ lệ pixel khác nhau được phép (mặc định 0.001 = 0.1%).
 * @param options `ignoreMask` (byte khác 0 = bỏ qua pixel) và `maskedPixels` để trừ khỏi mẫu số.
 * @returns số liệu pixel và ảnh diff; `ok=false` khi ảnh lệch kích thước.
 */
export function pixelDiff(
  refPng: Buffer,
  oursPng: Buffer,
  thresholdRatio = 0.001,
  options: { ignoreMask?: Uint8Array; maskedPixels?: number } = {},
): ImageDiffResult {
  const ref = PNG.sync.read(refPng);
  const ours = PNG.sync.read(oursPng);
  if (ref.width !== ours.width || ref.height !== ours.height) {
    return {
      ok: false,
      reason:
        "kích thước khác nhau: " +
        String(ref.width) + "x" + String(ref.height) +
        " vs " + String(ours.width) + "x" + String(ours.height),
      width: ref.width,
      height: ref.height,
      totalPixels: ref.width * ref.height,
      diffPixels: -1,
      ratio: 1,
      thresholdRatio,
      pass: false,
      maskedPixels: 0,
      rawDiffPixels: -1,
      rawRatio: 1,
    };
  }
  const framePixels = ref.width * ref.height;
  const maskedPixels = Math.min(framePixels, options.maskedPixels ?? 0);
  const output = new PNG({ width: ref.width, height: ref.height });
  const rawDiffPixels = pixelmatch(ref.data, ours.data, output.data, ref.width, ref.height, {
    threshold: 0.1,
    includeAA: false,
    diffMask: false,
  });
  let diffPixels = rawDiffPixels;
  if (options.ignoreMask !== undefined) {
    const masked = new PNG({ width: ref.width, height: ref.height });
    diffPixels = pixelmatch(ref.data, ours.data, masked.data, ref.width, ref.height, {
      threshold: 0.1,
      includeAA: false,
      diffMask: false,
      ignoreMask: options.ignoreMask,
    });
    paintMaskBorders(masked, options.ignoreMask);
    output.data.set(masked.data);
  }
  const totalPixels = Math.max(1, framePixels - maskedPixels);
  const ratio = diffPixels / totalPixels;
  return {
    ok: true,
    width: ref.width,
    height: ref.height,
    totalPixels,
    diffPixels,
    ratio,
    thresholdRatio,
    pass: ratio <= thresholdRatio,
    diffPng: PNG.sync.write(output),
    maskedPixels,
    rawDiffPixels,
    rawRatio: framePixels === 0 ? 0 : rawDiffPixels / framePixels,
  };
}

/**
 * Vẽ viền xanh quanh các vùng mask để người xem biết phần nào đã bị bỏ qua.
 * @param png ảnh diff đích (sửa trực tiếp).
 * @param ignoreMask bảng mask (byte khác 0 = bỏ qua).
 * @returns không trả gì.
 */
export function paintMaskBorders(png: PNG, ignoreMask: Uint8Array): void {
  const width = png.width;
  const height = png.height;
  const put = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    png.data[offset] = 0;
    png.data[offset + 1] = 120;
    png.data[offset + 2] = 255;
    png.data[offset + 3] = 255;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (ignoreMask[y * width + x] === 0) continue;
      const left = x === 0 || ignoreMask[y * width + x - 1] === 0;
      const right = x === width - 1 || ignoreMask[y * width + x + 1] === 0;
      const top = y === 0 || ignoreMask[(y - 1) * width + x] === 0;
      const bottom = y === height - 1 || ignoreMask[(y + 1) * width + x] === 0;
      if (left || right || top || bottom) put(x, y);
    }
  }
}

/**
 * Đổi tỉ lệ thành phần trăm dễ đọc.
 * @param ratio tỉ lệ 0..1.
 * @param digits số chữ số thập phân.
 * @returns chuỗi ví dụ `0.023%`.
 */
export function ratioPercent(ratio: number, digits = 3): string {
  return (ratio * 100).toFixed(digits) + "%";
}

/**
 * Tạo ảnh PNG đơn sắc để test đường ống so ảnh mà không cần server.
 * @param width chiều rộng.
 * @param height chiều cao.
 * @param rgba màu RGBA (0..255 mỗi thành phần).
 * @returns buffer PNG.
 */
export function solidPng(width: number, height: number, rgba: readonly [number, number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      png.data[offset] = rgba[0];
      png.data[offset + 1] = rgba[1];
      png.data[offset + 2] = rgba[2];
      png.data[offset + 3] = rgba[3];
    }
  }
  return PNG.sync.write(png);
}

/**
 * Tô một khối chữ nhật lên ảnh đơn sắc (dùng cho test ngưỡng pixel).
 * @param width chiều rộng.
 * @param height chiều cao.
 * @param rgba màu nền RGBA.
 * @param rect vùng cần tô, toạ độ pixel.
 * @param rectRgba màu tô.
 * @returns buffer PNG.
 */
export function pngWithRect(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number],
  rect: { x: number; y: number; w: number; h: number },
  rectRgba: readonly [number, number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside =
        x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const color = inside ? rectRgba : rgba;
      const offset = (y * width + x) * 4;
      png.data[offset] = color[0];
      png.data[offset + 1] = color[1];
      png.data[offset + 2] = color[2];
      png.data[offset + 3] = color[3];
    }
  }
  return PNG.sync.write(png);
}
