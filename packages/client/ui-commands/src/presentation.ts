/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat chu cua thuc don lenh: hai muc theo thu tu dung nhieu, va mat ban dia hoa cua lenh Host built-in
 */

import { builtinCommandName } from "./resolution.ts";
import type { CommandDescriptorLike, MenuRowLike, PrimitivesLike, Translate } from "./types.ts";

/** Ten dong cua tung muc, dung nhieu nhat truoc; dong ngoai hai danh sach nay dong muc Commands theo thu tu danh muc. */
export const SECTION_ROWS = {
  add: ["file", "goal", "plan", "feedback"],
  commands: ["compact", "permission", "model", "export"],
} as const;

/** Mat chu cua mot lenh built-in Host, khoa theo khoa tu dien cua no. */
export interface HostFace {
  /** Khoa nhan trong tu dien. */
  readonly label: string;
  /** Khoa mo ta trong tu dien. */
  readonly description: string;
  /** Bieu tuong. */
  readonly icon: unknown;
}

/**
 * Dung mot cap [ten, mat chu] cho bang mat chu.
 * Nhan: name — ten built-in; icon — bieu tuong cua no.
 * Tra: cap [ten, mat chu] de dua vao Map.
 */
export function hostFace(name: string, icon: unknown): readonly [string, HostFace] {
  return [name, { label: "label." + name, description: "description." + name, icon }];
}

/**
 * Bang mat chu cua sau lenh Host built-in ma package nay so huu — nguyen van thu tu cua ban goc.
 * Nhan: primitives — seam ui-primitives (lay sau bieu tuong).
 * Tra: anh xa ten built-in -> mat chu.
 */
export function createHostFaces(primitives: PrimitivesLike): ReadonlyMap<string, HostFace> {
  return new Map([
    hostFace("goal", primitives.IconGoalOutlineRegular),
    hostFace("plan", primitives.IconPlanOutlineRegular),
    hostFace("feedback", primitives.IconPaperPlaneOutlineRegular),
    hostFace("compact", primitives.IconCompactOutlineRegular),
    hostFace("permission", primitives.PermissionIconFullAccessRegular),
    hostFace("export", primitives.IconDownloadOutlineRegular),
  ]);
}

/**
 * Mat chu da ban dia hoa cua mot dong danh muc.
 * Nhan: descriptor — descriptor lenh Host dang hieu luc; t — ham dich namespace 'command'; faces — bang mat chu.
 * Tra: nhan, mo ta va bieu tuong cho lenh built-in; undefined voi moi dong khac (giu mo ta cua danh muc).
 */
export function builtinRowFace(
  descriptor: CommandDescriptorLike,
  t: Translate,
  faces: ReadonlyMap<string, HostFace>,
): Pick<MenuRowLike, "label" | "description" | "icon"> | undefined {
  const name = builtinCommandName(descriptor);
  const face = name === undefined ? undefined : faces.get(name);
  return face === undefined ? undefined : { label: t(face.label), description: t(face.description), icon: face.icon };
}

/**
 * Sap xep thuc don khi o tim kiem rong: muc Add, roi muc Commands, moi muc theo thu tu dung nhieu, va
 * cac dong khong nam trong danh sach se dong muc Commands theo thu tu nhap; moi dong mang tieu de muc.
 * Nhan: rows — cac ung vien nhin thay duoc theo thu tu danh muc-roi-dong-gop; t — ham dich namespace 'command'.
 * Tra: cac dong da chia muc.
 */
export function sectionRows(rows: readonly MenuRowLike[], t: Translate): readonly MenuRowLike[] {
  const listed = new Set<string>([...SECTION_ROWS.add, ...SECTION_ROWS.commands]);
  const byName = new Map(rows.map((row) => [row.name, row]));
  const pick = (names: readonly string[]): MenuRowLike[] =>
    names.flatMap((name) => {
      const row = byName.get(name);
      return row === undefined ? [] : [row];
    });
  const add = pick(SECTION_ROWS.add).map((row) => ({ ...row, section: t("section.add") }));
  const commands = [...pick(SECTION_ROWS.commands), ...rows.filter((row) => !listed.has(row.name))].map((row) => ({
    ...row,
    section: t("section.commands"),
  }));
  return [...add, ...commands];
}
