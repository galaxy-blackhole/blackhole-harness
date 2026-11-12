/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tên hiển thị của một Agent preset: preset có sẵn lấy từ từ điển, preset tự viết giữ nguyên metadata
 */

/** Khoá từ điển của bốn preset có sẵn. */
const BUILT_IN_PRESET_KEYS: Record<string, { name: string; description: string }> = {
  standard: { name: "presetStandardName", description: "presetStandardDescription" },
  ptc: { name: "presetPtcName", description: "presetPtcDescription" },
  minimal: { name: "presetMinimalName", description: "presetMinimalDescription" },
  cordis: { name: "presetCordisName", description: "presetCordisDescription" },
};

/** Một dòng trong bảng preset mà tab này hiển thị. */
export interface PresetRowLike {
  /** Id preset. */
  id: string;
  /** Tên do khai báo tự đặt; preset có sẵn không công bố tên. */
  name?: string;
  /** Mô tả do khai báo tự đặt. */
  description?: string;
  /** Preset đang lỗi thì mang thông báo lỗi ở đây. */
  broken?: string;
  /** Preset mặc định của hệ. */
  isDefault?: boolean;
  /** Các dòng module của preset. */
  rows: PluginRowLike[];
}

/** Một dòng module (trong preset hoặc ở mặt phẳng global). */
export interface PluginRowLike {
  /** Tên module đầy đủ. */
  moduleName: string;
  /** Id entry trong Loader, null nếu không có. */
  entryId: string | null;
  /** Module có được bật không; undefined là bật có điều kiện. */
  enabled?: boolean;
  /** Pha của root fiber, null khi chưa quan sát. */
  fiberPhase: string | null;
  /** Điều kiện tắt module, nếu có. */
  condition?: string;
  /** Metadata của gói. */
  meta?: { error?: string; title?: unknown; description?: unknown };
}

/**
 * Có phải preset có sẵn mà từ điển đã có bản dịch.
 * Nhận: một dòng preset.
 * Trả: true nếu là preset có sẵn và không tự công bố tên.
 */
export function isBuiltInPreset(preset: PresetRowLike): boolean {
  return preset.name === undefined && BUILT_IN_PRESET_KEYS[preset.id] !== undefined;
}

/**
 * Lấy tên và mô tả hiển thị của preset mà không làm metadata tự viết bị dịch.
 * Nhận: dòng preset và hàm đọc từ điển của namespace settings.agentPreset.
 * Trả: bản dịch cho preset có sẵn, ngược lại là metadata của chính khai báo.
 */
export function presetDisplayText(
  preset: PresetRowLike,
  t: (key: string) => string,
): { name: string; description?: string } {
  const keys = isBuiltInPreset(preset) ? BUILT_IN_PRESET_KEYS[preset.id] : undefined;
  if (keys !== undefined) return { name: t(keys.name), description: t(keys.description) };
  return {
    name: preset.name ?? preset.id,
    ...(preset.description === undefined ? {} : { description: preset.description }),
  };
}
