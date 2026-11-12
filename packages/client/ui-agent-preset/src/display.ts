/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ban dich hien thi cua mot dong so preset — nguyen van bang khoa cua ban goc (display.ts)
 */

import { CODING_TOOLS_PRESET_IDS } from "./ids.ts";
import type { Translator } from "./runtime.ts";

/** Mot dong trong so preset ma Host tra ve (Remote agentPresets.list). */
export interface PresetRow {
  /** Id preset (khoa on dinh). */
  readonly id: string;
  /** Ten do nguoi dung khai; preset ship san KHONG khai ten (dich tu dien giu ban quyen). */
  readonly name?: string;
  /** Mo ta do nguoi dung khai. */
  readonly description?: string;
  /** Preset mac dinh cho phien tao sau. */
  readonly isDefault?: boolean;
  /** Ly do preset khong dung duoc (chi co o khung cai dat). */
  readonly broken?: string;
}

/** Cap khoa tu dien cua mot preset ship san. */
export interface BuiltInPresetCopyKey {
  /** Khoa ten. */
  readonly name: string;
  /** Khoa mo ta. */
  readonly description: string;
}

/** Ban dich hien thi cua mot dong: ten + mo ta (co the thieu mo ta). */
export interface PresetDisplayText {
  /** Ten hien thi. */
  readonly name: string;
  /** Mo ta hien thi, hoac undefined. */
  readonly description?: string;
}

/** Khoa tu dien cua bon preset ship san — nguyen van bang goc. */
export const BUILT_IN_PRESET_KEYS: Readonly<Record<string, BuiltInPresetCopyKey>> = {
  standard: { name: "presetStandardName", description: "presetStandardDescription" },
  ptc: { name: "presetPtcName", description: "presetPtcDescription" },
  minimal: { name: "presetMinimalName", description: "presetMinimalDescription" },
  cordis: { name: "presetCordisName", description: "presetCordisDescription" },
};

/**
 * Dong nay co phai preset ship san ma tu dien giu ban quyen khong.
 * Preset ship san khong cong bo "name"; khai bao co ten thi tu so huu ban quyen cua no.
 * Nhan: preset — dong trong so.
 * Tra: true voi preset ship san khong cong bo ten.
 */
export function isBuiltInPreset(preset: PresetRow): boolean {
  return preset.name === undefined && BUILT_IN_PRESET_KEYS[preset.id] !== undefined;
}

/**
 * Giai ban quyen hien thi cua mot dong ma khong lam metadata do nguoi dung khai tro thanh dich duoc.
 * Nhan: preset — dong dang ve; t — ham dich cua namespace.
 * Tra: ban quyen da dich cho preset ship san, nguoc lai la metadata cua khai bao.
 */
export function presetDisplayText(preset: PresetRow, t: Translator): PresetDisplayText {
  const keys = isBuiltInPreset(preset) ? BUILT_IN_PRESET_KEYS[preset.id] : undefined;
  if (keys !== undefined) return { name: t(keys.name), description: t(keys.description) };
  return {
    name: preset.name ?? preset.id,
    ...(preset.description === undefined ? {} : { description: preset.description }),
  };
}

/**
 * Preset ship san nay co can tuy chon Cong cu phat trien khong.
 * Nhan: preset — dong trong so (co the undefined khi so rong).
 * Tra: true chi voi hai preset ship san PTC va Minimal.
 */
export function requiresCodingTools(preset: PresetRow | undefined): boolean {
  return preset !== undefined && isBuiltInPreset(preset) && CODING_TOOLS_PRESET_IDS.includes(preset.id);
}
