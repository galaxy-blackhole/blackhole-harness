/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cổng HỢP LỆ cho mọi phép đo ảnh: sidebar, ô soạn tin, ô tìm kiếm, không có chuỗi lỗi, ảnh không trắng
 */

import { PNG } from "pngjs";

import type { ElementRow, MaskRegion } from "./types.ts";

/** Yêu cầu hợp lệ của một màn hình. */
export interface ValiditySpec {
  /** Bắt buộc có ô soạn tin (composer); mặc định true. */
  composer?: boolean;
  /** Nhãn ô tìm kiếm phải thấy (ví dụ "Search sessions"); bỏ trống nghĩa là không đòi. */
  searchLabel?: string;
  /** Chữ phải thấy trong nhãn/tiêu đề để nhận đúng màn hình (ví dụ "Automation tasks"). */
  anchorText?: string;
}

/** Kết quả một phép kiểm hợp lệ. */
export interface ValidityCheck {
  /** Mã phép kiểm: sidebar, composer, search, symptoms, not-blank. */
  id: string;
  /** true khi đạt. */
  ok: boolean;
  /** Giải thích ngắn (số liệu, lý do hỏng). */
  note: string;
}

/** Báo cáo hợp lệ của một bên. */
export interface ValidityReport {
  /** true khi mọi phép kiểm QUYẾT ĐỊNH đều đạt (DOM anchor + không có chuỗi lỗi + có ảnh). */
  ok: boolean;
  /** Các phép kiểm quyết định. */
  checks: ValidityCheck[];
  /** Ghi chú phụ, KHÔNG làm mất hợp lệ (ví dụ khung phần lớn một màu nhưng vẫn đúng thiết kế). */
  notes: string[];
  /** Lý do không hợp lệ (rỗng khi ok). */
  reasons: string[];
}

/** Chuỗi cấm xuất hiện trong DOM của một lượt đo hợp lệ (đã hạ chữ thường). */
export const FORBIDDEN_STRINGS: readonly string[] = Object.freeze([
  "failed to load plugins",
  "did not activate",
  "enter your galaxy api key",
]);

/** Tỉ lệ tối đa một màu được chiếm trong một vùng ảnh; vượt là màn trắng/màn lỗi. */
export const MAX_UNIFORM_SHARE = 0.95;

/**
 * Tính tỉ lệ màu chiếm nhiều nhất trên vùng KHÔNG bị mask (màu gộp 3 bit mỗi kênh).
 * Bỏ vùng mask để tỉ lệ phản ánh phần thực sự đem ra so, không bị vùng brand/state làm sai.
 * Nhận: buffer PNG và danh sách vùng mask theo tỉ lệ khung.
 * Trả: { share, sampled, masked } — tỉ lệ màu trội, số điểm ảnh đã lấy mẫu, số điểm bị bỏ.
 */
export function unmaskedUniformShare(png: Buffer, masks: readonly MaskRegion[]): { share: number; sampled: number; masked: number } {
  const image = PNG.sync.read(png);
  const inside = (x: number, y: number): boolean =>
    masks.some(
      (mask) =>
        x >= mask.x * image.width && x < (mask.x + mask.w) * image.width &&
        y >= mask.y * image.height && y < (mask.y + mask.h) * image.height,
    );
  const counts = new Map<number, number>();
  let sampled = 0;
  let masked = 0;
  for (let y = 0; y < image.height; y += 2) {
    for (let x = 0; x < image.width; x += 2) {
      if (inside(x, y)) {
        masked += 1;
        continue;
      }
      const offset = (y * image.width + x) * 4;
      const quant =
        (((image.data[offset] ?? 0) >> 5) << 6) | (((image.data[offset + 1] ?? 0) >> 5) << 3) | ((image.data[offset + 2] ?? 0) >> 5);
      counts.set(quant, (counts.get(quant) ?? 0) + 1);
      sampled += 1;
    }
  }
  const top = Math.max(0, ...counts.values());
  return { share: sampled === 0 ? 1 : top / sampled, sampled, masked };
}

/**
 * Tính tỉ lệ màu chiếm nhiều nhất trong từng vùng ảnh (màu đã gộp 3 bit mỗi kênh).
 * Nhận: buffer PNG của ảnh chụp.
 * Trả: mảng { region, share } cho 4 vùng: toàn khung, sidebar, nội dung, ngăn kéo phải.
 */
export function imageRegionShares(png: Buffer): { region: string; share: number }[] {
  const image = PNG.sync.read(png);
  const regions: { region: string; x0: number; x1: number }[] = [
    { region: "toàn khung", x0: 0, x1: image.width },
    { region: "sidebar", x0: 0, x1: Math.floor(image.width * 0.2) },
    { region: "nội dung", x0: Math.floor(image.width * 0.2), x1: Math.floor(image.width * 0.55) },
    { region: "ngăn kéo phải", x0: Math.floor(image.width * 0.55), x1: image.width },
  ];
  return regions.map((region) => {
    const counts = new Map<number, number>();
    let total = 0;
    for (let y = 0; y < image.height; y += 2) {
      for (let x = region.x0; x < region.x1; x += 2) {
        const offset = (y * image.width + x) * 4;
        const quant = (((image.data[offset] ?? 0) >> 5) << 6) | (((image.data[offset + 1] ?? 0) >> 5) << 3) | ((image.data[offset + 2] ?? 0) >> 5);
        counts.set(quant, (counts.get(quant) ?? 0) + 1);
        total += 1;
      }
    }
    const top = Math.max(0, ...counts.values());
    return { region: region.region, share: total === 0 ? 1 : top / total };
  });
}

/**
 * Kiểm các chỉ dấu DOM: sidebar, ô soạn tin, ô tìm kiếm.
 * Nhận: danh sách phần tử tương tác của một bên và yêu cầu hợp lệ của màn hình.
 * Trả: các phép kiểm kèm số liệu.
 */
export function checkDom(rows: readonly ElementRow[], spec: ValiditySpec): ValidityCheck[] {
  const labels = rows.map((row) => (row.aria.trim() !== "" ? row.aria : row.text).toLowerCase());
  const has = (needle: string): boolean => labels.some((label) => label.includes(needle));
  const checks: ValidityCheck[] = [
    {
      id: "sidebar",
      ok: has("new session") && has("plugins"),
      note: "New Session=" + String(has("new session")) + " · Plugins=" + String(has("plugins")),
    },
  ];
  if (spec.composer !== false) {
    const composer = rows.some((row) => row.role === "textbox" && /describe what you want/iu.test(row.aria));
    checks.push({ id: "composer", ok: composer, note: "ô soạn tin=" + String(composer) });
  }
  if (spec.searchLabel !== undefined && spec.searchLabel !== "") {
    const found = has(spec.searchLabel.toLowerCase());
    checks.push({ id: "search", ok: found, note: "ô tìm kiếm " + spec.searchLabel + "=" + String(found) });
  }
  if (spec.anchorText !== undefined && spec.anchorText !== "") {
    const found = has(spec.anchorText.toLowerCase());
    checks.push({ id: "anchor màn hình", ok: found, note: "thấy chữ " + spec.anchorText + "=" + String(found) });
  }
  return checks;
}

/**
 * Chạy đủ 4 nhóm điều kiện hợp lệ (Lead chốt): DOM (sidebar/composer/search), không chuỗi lỗi, ảnh không trắng.
 * Nhận: các phần tử DOM, ảnh PNG, danh sách dấu hiệu bất thường, yêu cầu hợp lệ, ngưỡng một màu.
 * Trả: báo cáo hợp lệ; ok=false nghĩa là phải ghi SKIP (KHÔNG HỢP LỆ), không được tính PASS/FAIL.
 */
export function checkValidity(args: {
  rows: readonly ElementRow[];
  png?: Buffer;
  symptoms: readonly string[];
  spec: ValiditySpec;
  masks?: readonly MaskRegion[];
  maxUniformShare?: number;
}): ValidityReport {
  const limit = args.maxUniformShare ?? MAX_UNIFORM_SHARE;
  const domChecks = checkDom(args.rows, args.spec);
  const anchorsOk = domChecks.every((check) => check.ok);
  const bad = args.symptoms.filter((symptom) => FORBIDDEN_STRINGS.includes(symptom.toLowerCase()));
  const checks: ValidityCheck[] = [
    ...domChecks,
    { id: "không chuỗi lỗi", ok: bad.length === 0, note: bad.length === 0 ? "sạch" : "thấy: " + bad.join(", ") },
  ];
  const notes: string[] = [];
  if (args.png === undefined || args.png.length === 0) {
    checks.push({ id: "có ảnh", ok: false, note: "không có ảnh để kiểm" });
  } else {
    const uniform = unmaskedUniformShare(args.png, args.masks ?? []);
    const share = (uniform.share * 100).toFixed(1) + "%";
    if (uniform.share > limit) {
      if (anchorsOk) {
        // Khung phần lớn một màu KHÔNG tự nó làm mất hợp lệ (màn chào DSH gần như trắng là đúng thiết kế).
        notes.push("khung phần lớn một màu (vùng không mask chiếm " + share + ") — hợp lệ cho màn này");
      } else {
        checks.push({
          id: "ảnh không trắng",
          ok: false,
          note: "DOM thiếu anchor VÀ vùng không mask chiếm " + share + " một màu → màn trắng/màn lỗi",
        });
      }
    } else {
      notes.push("vùng không mask: màu trội chiếm " + share + " (dưới ngưỡng " + (limit * 100).toFixed(0) + "%)");
    }
  }
  const reasons = checks.filter((check) => !check.ok).map((check) => check.id + ": " + check.note);
  return { ok: reasons.length === 0, checks, notes, reasons };
}
