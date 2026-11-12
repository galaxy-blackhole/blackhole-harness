/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Mô hình dữ liệu của tab kiểm kê plugin: nhãn pha, rút gọn tên module, lọc theo ô tìm kiếm
 */

import type { InventoryTranslate } from "./locales.ts";
import type { PluginRowLike, PresetRowLike } from "./preset-display.ts";

/** Khoá từ điển của từng pha root fiber. */
export const PHASE_KEYS: Record<string, "pending" | "loadingPhase" | "active" | "failed" | "unloading"> = {
  pending: "pending",
  loading: "loadingPhase",
  active: "active",
  failed: "failed",
  unloading: "unloading",
};

/** Trạng thái của StateDot theo pha. */
export const PHASE_DOT_STATES: Record<string, "idle" | "ongoing"> = {
  pending: "idle",
  loading: "ongoing",
  unloading: "ongoing",
};

/** Tông màu của thẻ trạng thái theo loại. */
export const TAG_TONES: Record<string, "neutral" | "warning" | "info" | "danger"> = {
  disabled: "neutral",
  conditional: "warning",
  preset: "info",
  failed: "danger",
};

/**
 * Nhãn dễ đọc cho một pha root fiber.
 * Nhận: pha (null khi chưa quan sát) và hàm đọc từ điển.
 * Trả: chuỗi đã dịch.
 */
export function phaseLabel(phase: string | null, t: InventoryTranslate): string {
  return phase === null ? t("unobserved") : t(PHASE_KEYS[phase] ?? "unobserved");
}

/**
 * Có nên vẽ chấm trạng thái cho pha này không.
 * Nhận: pha root fiber.
 * Trả: true cho pending/loading/unloading.
 */
export function showsPhaseDot(phase: string | null): boolean {
  return phase === "pending" || phase === "loading" || phase === "unloading";
}

/**
 * Tên kỹ thuật gọn cho màn Settings mà không đổi danh tính module.
 * Nhận: tên module đầy đủ.
 * Trả: tên đã bỏ scope, tiền tố cordis:/cordis-plugin-/dsh-host-|dsh-client-.
 */
export function moduleShortName(moduleName: string): string {
  const base = moduleName.startsWith("@") ? moduleName.slice(moduleName.indexOf("/") + 1) : moduleName;
  return base.replace(/^cordis:/u, "").replace(/^cordis-plugin-/u, "").replace(/^dsh-(?:host-|client-)?/u, "");
}

/**
 * Hiển thị danh tính entry mà bỏ dấu include: chỉ dùng lúc ghép cấu hình.
 * Nhận: id entry.
 * Trả: id đã bỏ tiền tố.
 */
export function entrySubtitle(entryId: string): string {
  return entryId.replace(/^include:/u, "");
}

/**
 * Thẻ có hiện thêm id entry không: id tồn tại và, sau khi bỏ include:, khác tiêu đề.
 * Nhận: id entry (có thể null) và tiêu đề.
 * Trả: true nếu cần hiện thêm id.
 */
export function idAddsToTitle(entryId: string | null, title: string): boolean {
  return entryId !== null && entrySubtitle(entryId) !== title;
}

/**
 * Tên dễ đọc cho thẻ: tiêu đề, id entry đầy đủ khi thẻ có hiện, rồi trạng thái bật/tắt.
 * Nhận: tiêu đề, id entry và chuỗi trạng thái.
 * Trả: chuỗi cho aria-label.
 */
export function cardLabel(title: string, entryId: string | null, state: string): string {
  return idAddsToTitle(entryId, title) ? title + ", " + entryId + ", " + state : title + ", " + state;
}

/** Tiêu đề và mô tả đã dịch của một dòng plugin. */
export interface PluginText {
  /** Tiêu đề hiển thị. */
  title: string;
  /** Mô tả, nếu có. */
  description?: string;
}

/**
 * Giữ tiêu đề đã dịch và rút gọn tên gói/module chỉ khi phải dùng tên kỹ thuật.
 * Nhận: dòng plugin và hàm dịch văn bản cục bộ.
 * Trả: tiêu đề + mô tả để hiển thị.
 */
export function pluginText(
  row: PluginRowLike,
  resolveText: (text: unknown) => string,
): PluginText {
  const title = row.meta?.title;
  return {
    title: typeof title === "object" && title !== null ? resolveText(title) : moduleShortName(typeof title === "string" ? title : row.moduleName),
    description: row.meta?.description === undefined ? undefined : resolveText(row.meta.description) || undefined,
  };
}

/**
 * Dòng này có khớp ô tìm kiếm không: so cả văn bản đã dịch lẫn danh tính kỹ thuật.
 * Nhận: dòng, truy vấn đã chuẩn hoá và hàm dịch.
 * Trả: true nếu khớp (truy vấn rỗng thì luôn khớp).
 */
export function matches(
  row: PluginRowLike,
  normalizedQuery: string,
  resolveText: (text: unknown) => string,
): boolean {
  if (normalizedQuery.length === 0) return true;
  const { title, description } = pluginText(row, resolveText);
  return [row.moduleName, row.entryId, title, description].some(
    (value) => value?.toLocaleLowerCase().includes(normalizedQuery) === true,
  );
}

/**
 * Dòng được hiện khi bộ chọn preset chưa có lựa chọn nào.
 * Nhận: danh sách preset.
 * Trả: preset mặc định, hoặc preset đầu tiên.
 */
export function fallbackPreset(presets: PresetRowLike[]): PresetRowLike | undefined {
  return presets.find((preset) => preset.isDefault === true) ?? presets[0];
}

/**
 * Nhãn của một lựa chọn trong bộ chọn preset.
 * Nhận: preset, hàm đọc từ điển và hàm lấy tên preset.
 * Trả: tên kèm chú thích (mặc định) hoặc (lỗi).
 */
export function presetLabel(
  preset: PresetRowLike,
  t: InventoryTranslate,
  presetName: (preset: PresetRowLike) => string,
): string {
  const name = presetName(preset);
  if (preset.broken !== undefined) return t("presetOptionBroken", { name });
  if (preset.isDefault === true) return t("presetOptionDefault", { name });
  return name;
}
