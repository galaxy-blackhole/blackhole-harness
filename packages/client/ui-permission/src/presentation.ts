/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cach hien thi preset quyen: nhan san pham, ten kebab-case, glyph va badge — theo dung ban goc
 */

import { AUTO_REVIEW_PRESET, FULL_ACCESS_PRESET } from "./ids.ts";
import type { PermissionAccessKey } from "./locales.ts";

/** Khoa tu dien cua nhan san pham cho ba preset dung san. */
export type PresetLabelKey = "preset.readOnly" | "preset.workspaceWrite" | "preset.fullAccess";

/** Gia tri may -> khoa nhan san pham (ban goc dung dung ba muc nay). */
export const PRESET_LABEL_KEYS: ReadonlyMap<string, PresetLabelKey> = new Map<string, PresetLabelKey>([
  ["read-only", "preset.readOnly"],
  ["workspace-write", "preset.workspaceWrite"],
  [FULL_ACCESS_PRESET, "preset.fullAccess"],
]);

/** Nhan tieng Anh dung san, lam fallback khi khong co ham dich. */
export const DEFAULT_PRESET_LABELS: Record<PresetLabelKey, string> = {
  "preset.readOnly": "Read Only",
  "preset.workspaceWrite": "Workspace Write",
  "preset.fullAccess": "Full access",
};

/**
 * Doi ten kebab-case thanh dang tieu de cho nguoi doc (ban goc: chi doi khi dung khuon kebab).
 * Nhan: ten do Host cap hoac khoa preset.
 * Tra: ten da viet hoa tung tu, hoac nguyen van neu khong phai kebab-case.
 */
export function displayPresetName(name: string): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name;
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Hien thi mot preset duoi nhan san pham.
 * Nhan: gia tri may, ten do Host cap, va ham dich tuy chon.
 * Tra: nhan san pham (neu la preset dung san) hoac ten kebab-case da viet hoa.
 */
export function displayPermissionPreset(
  value: string,
  name: string,
  t?: (key: PresetLabelKey) => string,
): string {
  const key = PRESET_LABEL_KEYS.get(value);
  if (key !== undefined && (name === value || name === DEFAULT_PRESET_LABELS[key])) {
    return t?.(key) ?? DEFAULT_PRESET_LABELS[key];
  }
  return displayPresetName(name);
}

/** Element glyph cua mot preset (do runtime JSX dung ra, nen phai truyen jsx vao). */
export type GlyphElement = unknown;

/** Bam JSX ma runtime cap. */
export type JsxFn = (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;

/** Bon icon quyen ma ban goc require tu ui-primitives. */
export interface PermissionIconSet {
  /** Icon "chi doc". */
  PermissionIconReadOnlyRegular: unknown;
  /** Icon "ghi trong workspace". */
  PermissionIconWorkspaceWriteRegular: unknown;
  /** Icon "toan quyen". */
  PermissionIconFullAccessRegular: unknown;
  /** Icon "tu dong review". */
  PermissionIconAutoReviewRegular: unknown;
}

/**
 * Dung bang glyph cua bon preset dung san (ban goc dung mot Map dung chung).
 * Nhan: ham jsx cua runtime va bon icon tu ui-primitives.
 * Tra: Map gia tri may -> element glyph.
 */
export function makePermissionGlyphs(jsx: JsxFn, icons: PermissionIconSet): Map<string, GlyphElement> {
  return new Map<string, GlyphElement>([
    ["read-only", jsx(icons.PermissionIconReadOnlyRegular, {})],
    ["workspace-write", jsx(icons.PermissionIconWorkspaceWriteRegular, {})],
    [FULL_ACCESS_PRESET, jsx(icons.PermissionIconFullAccessRegular, {})],
    [AUTO_REVIEW_PRESET, jsx(icons.PermissionIconAutoReviewRegular, {})],
  ]);
}

/**
 * Nhan cua mot preset: "auto" lay copy cua tu dien, con lai theo nhan san pham.
 * Nhan: gia tri may, ten Host cap, ham dich.
 * Tra: chuoi hien thi.
 */
export function permissionLabel(
  value: string,
  name: string,
  t: (key: PermissionAccessKey) => string,
): string {
  if (value === AUTO_REVIEW_PRESET) return t("auto.label");
  return displayPermissionPreset(value, name, (key) => t(key));
}

/**
 * Badge hien canh nhan (chi preset thi nghiem "auto" co).
 * Nhan: gia tri may va ham dich.
 * Tra: chuoi badge, hoac undefined khi preset khong co badge.
 */
export function optionBadge(value: string, t: (key: PermissionAccessKey) => string): string | undefined {
  return value === AUTO_REVIEW_PRESET ? t("auto.badge") : undefined;
}

/**
 * Mo ta cua mot lua chon: copy cua tu dien cho "auto", con lai lay mo ta do Host cap.
 * Nhan: lua chon trong catalog (co value + description) va ham dich.
 * Tra: chuoi mo ta, hoac undefined khi ca hai nguon deu khong co.
 */
export function optionDescription(
  option: { value: string; description?: string },
  t: (key: PermissionAccessKey) => string,
): string | undefined {
  return option.value === AUTO_REVIEW_PRESET ? t("auto.description") : option.description;
}
