/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ham duong dan workspace — nguyen hanh vi ban goc (util/workspace-path)
 */

import type { Dyn } from "./runtime.ts";

/**
 * Duong dan co dung kieu Windows (o dia hoac UNC) khong?
 * Nhan: value — duong dan.
 * Tra: true khi bat dau bang `X:/` hoac `\\\\`.
 */
export function isWindowsStylePath(value: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
}

/**
 * Rut gon thu muc home POSIX de hien thi.
 * Nhan: path — duong dan tuyet doi hoac da rut gon; home — home cua tai khoan host (bo qua khi thieu).
 * Tra: `~` hoac `~/…` cho home POSIX va con cua no, nguoc lai tra nguyen `path`.
 */
export function abbreviateHomePath(path: string, home: string | undefined): string {
  if (home === undefined || home === "") return path;
  if (isWindowsStylePath(path) || isWindowsStylePath(home)) return path;
  const root = home.replace(/\/+$/, "");
  if (root === "" || root === "/") return path;
  if (path.replace(/\/+$/, "") === root) return "~";
  if (path.startsWith(root + "/")) return "~" + path.slice(root.length);
  return path;
}

/**
 * Doc doan cuoi cung khac rong cua duong dan workspace de hien thi.
 * Nhan: path — duong dan thu muc dung dau phan cach POSIX hoac Windows.
 * Tra: doan cuoi, hoac chuoi rong khi duong dan chi co dau phan cach.
 */
export function workspaceTitleOf(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const separator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return trimmed.slice(separator + 1);
}

/**
 * Nhan hien thi cua thu muc: ten cuoi cua duong dan (nhan ca hai loai dau phan cach).
 * Nhan: cwd — duong dan thu muc, hoac undefined cho nhom "chua xep".
 * Tra: ten cuoi, hoac chinh cwd khi no khong co ten, hoac chuoi rong.
 */
export function workspaceLabel(cwd: string | undefined): string {
  if (cwd === undefined || cwd === "") return "";
  const base = workspaceTitleOf(cwd);
  return base !== "" ? base : cwd;
}

/**
 * Chuan hoa dau phan cach de so sanh, khong dien giai dau \\ nguoc cua POSIX.
 * Nhan: path — duong dan.
 * Tra: duong dan da chuan hoa, bo het dau / o cuoi.
 */
export function folderPath(path: string): string {
  return (/^[A-Za-z]:[/\\]/.test(path) || path.startsWith("\\\\") ? path.replaceAll("\\", "/") : path).replace(/\/+$/, "");
}

/**
 * Tim thu muc cha da dang ky gan nhat, KHONG tinh chinh thu muc workspace do.
 * Nhan: path — thu muc workspace; parents — danh sach duong dan thu muc da dang ky.
 * Tra: duong dan cha so huu, hoac undefined khi khong cha nao chua no.
 */
export function owningParentFolder(path: string, parents: readonly string[]): string | undefined {
  const child = folderPath(path);
  let owner: string | undefined;
  let length = -1;
  for (const parent of parents) {
    const root = folderPath(parent);
    if (root.length > length && child !== root && child.startsWith(root + "/")) {
      owner = parent;
      length = root.length;
    }
  }
  return owner;
}

/**
 * Nhom workspace so huu mot phien.
 * Nhan: workspaces — danh sach workspace; sessionId — phien can tim nhom.
 * Tra: id workspace so huu, hoac chuoi rong khi khong workspace nao nhan.
 */
export function owningGroupKey(workspaces: readonly Dyn[], sessionId: string): string {
  return workspaces.find((workspace: Dyn) => workspace.sessionIds.includes(sessionId))?.workspaceId ?? "";
}

/**
 * Id cua phien dang giu khung nhin chinh (`retainedBy.mainView > 0`).
 * Nhan: list — anh chup danh sach phien.
 * Tra: id phien, hoac undefined khi khong co.
 */
export function mainSessionId(list: Dyn): string | undefined {
  return Object.values(list.byId as Record<string, Dyn>).find((session: Dyn) => (session.retainedBy.mainView ?? 0) > 0)?.id;
}
