/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Vùng mask khi so ảnh: brand/logo (D9) và vùng trạng thái sống — kèm lý do cho từng vùng
 */

/** Một vùng mask định nghĩa theo tỉ lệ khung (0..1) để dùng được cho mọi viewport. */
export interface MaskRegion {
  /** Tên ngắn của vùng. */
  name: string;
  /** Vì sao vùng này được bỏ qua khi so pixel. */
  reason: string;
  /** Toạ độ trái theo tỉ lệ chiều rộng. */
  x: number;
  /** Toạ độ trên theo tỉ lệ chiều cao. */
  y: number;
  /** Chiều rộng theo tỉ lệ. */
  w: number;
  /** Chiều cao theo tỉ lệ. */
  h: number;
  /**
   * Nhóm vùng:
   * - `brand`: khác biệt có chủ ý về thương hiệu (D9 cho phép).
   * - `state`: trạng thái sống của từng instance (danh sách phiên, băng kết nối).
   * - `locale-text`: **chuỗi do SẢN PHẨM quyết định** (i18n tiếng Việt, tên model đã chọn) — gọi ĐÚNG TÊN
   *   lớp dị biệt, không che dưới tên `state`; đo được 17/10/2026.
   */
  kind: "brand" | "state" | "locale-text";
}

/** Vùng mask đã quy đổi sang pixel cho một viewport cụ thể. */
export interface ResolvedMask {
  /** Tên vùng. */
  name: string;
  /** Nhóm vùng: brand · state · locale-text. */
  kind: "brand" | "state" | "locale-text";
  /** Lý do. */
  reason: string;
  /** Pixel trái. */
  x: number;
  /** Pixel trên. */
  y: number;
  /** Số pixel rộng. */
  w: number;
  /** Số pixel cao. */
  h: number;
}

/**
 * Vùng bỏ qua mặc định khi so ảnh A/B.
 * - `brand-*`: wordmark/logo — D9 chốt "pixel ≤0.1% (bỏ vùng brand)".
 * - `state-*`: danh sách workspace/session do TRẠNG THÁI của từng instance quyết định (app mới
 *   tinh so với 4001 đang dùng hằng ngày) — không phải lệch giao diện, nhưng phải khai báo rõ.
 */
export const DEFAULT_MASKS: readonly MaskRegion[] = Object.freeze([
  {
    name: "brand-sidebar",
    kind: "brand",
    reason: "Wordmark thương hiệu ở sidebar (DeepSeek Harness vs Galaxy Blackhole) — D9 cho phép khác có chủ ý",
    x: 0,
    y: 0,
    w: 0.2,
    h: 0.085,
  },
  {
    name: "brand-hero",
    kind: "brand",
    reason: "Logo + wordmark lớn ở màn hình chào — cùng lý do brand-hero",
    x: 0.43,
    y: 0.345,
    w: 0.24,
    h: 0.075,
  },
  {
    name: "state-sidebar-list",
    kind: "state",
    reason:
      "Danh sách workspace/session là trạng thái sống của từng instance (app mới vs 4001 đang dùng) — " +
      "phải bỏ khi so; sẽ gỡ được khi M2 chuẩn hoá trạng thái trước khi chụp. " +
      "Bề rộng nới 0.20 → 0.29 ngày 17/10/2026: tem thời gian cuối hàng phiên ('8h') nằm ở x≈228..285 " +
      "@1024x768 (mép sidebar thật ≈285 px = 27,8%), tức NGOÀI mask cũ và là phần lớn số pixel lệch còn lại",
    x: 0.0,
    y: 0.13,
    w: 0.29,
    h: 0.62,
  },
  {
    name: "state-composer-chips",
    kind: "state",
    reason:
      "Hàng chip trong ô soạn tin (chế độ truy cập \"Ghi trong workspace\" / model) khác nhau theo trạng thái phiên " +
      "của từng instance — đo được ở y≈469 @1024x768 và y≈536 @1440x900",
    x: 0.25,
    y: 0.575,
    w: 0.3,
    h: 0.07,
  },
  {
    name: "state-conn-banner",
    kind: "state",
    reason:
      "Băng trạng thái kết nối realtime ở góc dưới-trái (một bên hiện \"Reconnecting…\" tuỳ thời điểm chụp) — " +
      "trạng thái tạm thời, không phải lỗi giao diện",
    x: 0.1,
    y: 0.94,
    w: 0.2,
    h: 0.06,
  },
  {
    name: "locale-composer-chips",
    kind: "locale-text",
    reason:
      "Chuỗi do SẢN PHẨM quyết định trong ô soạn tin: chip chế độ truy cập (ta: \"Ghi trong workspace\" · " +
      "oracle: \"Workspace Write\") và chip model (ta: \"Auto Default\" · oracle: \"Select model\") — " +
      "khác biệt i18n có chủ đích, KHÔNG phải lệch bố cục. Đo 17/10/2026 bằng pixelmatch hiệu chuẩn đúng rig " +
      "(898 px ngoài mask cũ): dải y=396..412 @1024x768 và y≈517..580 @1440x900, x tới ≈981 @1024x768",
    x: 0.24,
    y: 0.51,
    w: 0.72,
    h: 0.14,
  },
  {
    name: "state-hero-chips",
    kind: "state",
    reason:
      "Hàng chip chọn workspace/mode ở màn hình chào bị dịch ngang vì workspace đang chọn khác nhau giữa hai " +
      "instance (đo được: toàn bộ pixel lệch còn lại chỉ nằm trong dải y=415..429 @1440x900 và y=328..363 @1024x768) — " +
      "mask TRẠNG THÁI, không phải mask thẩm mỹ; gỡ được khi M2 chuẩn hoá state",
    x: 0.22,
    y: 0.415,
    w: 0.4,
    h: 0.07,
  },
]);

/**
 * Quy đổi vùng mask theo tỉ lệ sang pixel của một khung ảnh.
 * @param regions vùng mask theo tỉ lệ.
 * @param width chiều rộng khung.
 * @param height chiều cao khung.
 * @returns vùng đã quy đổi, đã cắt theo biên khung.
 */
export function resolveMasks(regions: readonly MaskRegion[], width: number, height: number): ResolvedMask[] {
  return regions.map((region) => {
    const x = Math.max(0, Math.min(width - 1, Math.round(region.x * width)));
    const y = Math.max(0, Math.min(height - 1, Math.round(region.y * height)));
    const w = Math.max(1, Math.min(width - x, Math.round(region.w * width)));
    const h = Math.max(1, Math.min(height - y, Math.round(region.h * height)));
    return { name: region.name, kind: region.kind, reason: region.reason, x, y, w, h };
  });
}

/**
 * Dựng bảng `ignoreMask` cho pixelmatch: byte khác 0 nghĩa là bỏ qua pixel đó.
 * @param width chiều rộng khung.
 * @param height chiều cao khung.
 * @param masks các vùng đã quy đổi.
 * @returns mảng `width * height` byte.
 */
export function buildIgnoreMask(width: number, height: number, masks: readonly ResolvedMask[]): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const region of masks) {
    for (let y = region.y; y < region.y + region.h; y += 1) {
      const rowStart = y * width;
      for (let x = region.x; x < region.x + region.w; x += 1) mask[rowStart + x] = 1;
    }
  }
  return mask;
}

/**
 * Đếm số pixel KHÔNG bị mask — mẫu số của tỉ lệ lệch.
 * @param width chiều rộng khung.
 * @param height chiều cao khung.
 * @param masks các vùng đã quy đổi.
 * @returns số pixel còn so sánh.
 */
export function unmaskedPixelCount(width: number, height: number, masks: readonly ResolvedMask[]): number {
  let masked = 0;
  for (const region of masks) masked += region.w * region.h;
  return Math.max(0, width * height - masked);
}

/**
 * Mô tả ngắn các vùng mask để in vào report.
 * @param masks các vùng đã quy đổi.
 * @param width chiều rộng khung.
 * @param height chiều cao khung.
 * @returns chuỗi Markdown dạng bảng gọn.
 */
export function describeMasks(masks: readonly ResolvedMask[], width: number, height: number): string {
  if (masks.length === 0) return "(không mask vùng nào)";
  const total = width * height;
  return masks
    .map((region) => {
      const share = total === 0 ? 0 : ((region.w * region.h) / total) * 100;
      return (
        "\`" + region.name + "\` (" + region.kind + ") " +
        String(region.x) + "," + String(region.y) + " " + String(region.w) + "×" + String(region.h) +
        " = " + share.toFixed(1) + "% khung — " + region.reason
      );
    })
    .join("  \n");
}

/**
 * Đọc danh sách mask từ một file JSON (để tinh chỉnh mà không cần sửa code).
 * @param value giá trị JSON đã parse.
 * @returns danh sách mask hợp lệ (rỗng nếu dữ liệu sai).
 */
export function parseMaskFile(value: unknown): MaskRegion[] {
  if (!Array.isArray(value)) return [];
  const regions: MaskRegion[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const numbers = ["x", "y", "w", "h"].map((key) => Number(record[key]));
    if (numbers.some((number) => !Number.isFinite(number))) continue;
    regions.push({
      name: typeof record.name === "string" ? record.name : "mask-" + String(regions.length),
      reason: typeof record.reason === "string" ? record.reason : "(không ghi lý do)",
      kind: record.kind === "state" ? "state" : record.kind === "locale-text" ? "locale-text" : "brand",
      x: numbers[0] as number,
      y: numbers[1] as number,
      w: numbers[2] as number,
      h: numbers[3] as number,
    });
  }
  return regions;
}
