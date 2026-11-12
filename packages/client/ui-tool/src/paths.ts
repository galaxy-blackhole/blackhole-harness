/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phep tinh duong dan cua ban goc (util/workspace-path + ghi nho duong dan luc chay tool)
 */

/**
 * Duong dan co phai kieu Windows (o dia hoac UNC) khong.
 * Nhan: value — duong dan can phan loai.
 * Tra: true khi la kieu Windows.
 */
export function isWindowsStylePath(value: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
}

/**
 * Duong dan co tuyet doi theo mot trong hai cach viet ma Host chap nhan khong.
 * Nhan: path — duong dan can phan loai.
 * Tra: true khi la duong dan tuyet doi; false khi la duong dan tuong doi theo Workspace.
 */
export function isAbsoluteWorkspacePath(path: string): boolean {
  return path.startsWith("/") || isWindowsStylePath(path);
}

/**
 * Giai mot duong dan tuong doi theo Workspace thanh cach viet ma Host dung cho phep toan duong dan.
 * Nhan: cwd — goc Workspace cua phien (neu biet); path — duong dan tuyet doi hoac tuong doi.
 * Tra: duong dan tuyet doi khi biet goc Workspace, nguoc lai tra nguyen duong dan goc.
 */
export function resolveWorkspacePath(cwd: string | undefined, path: string): string {
  if (isAbsoluteWorkspacePath(path)) return path;
  if (cwd === undefined || cwd === "") return path;
  const separator = isWindowsStylePath(cwd) && cwd.includes("\\") ? "\\" : "/";
  return `${cwd.replace(/[/\\]+$/, "")}${separator}${path.replace(/^[/\\]+/, "")}`;
}

/**
 * Rut gon thu muc home kieu POSIX de hien thi.
 * Nhan: path — duong dan tuyet doi hoac duong dan da rut gon; home — home cua tai khoan Host (thieu thi bo qua).
 * Tra: "~" hoac "~/…" cho home POSIX va con cua no, nguoc lai tra nguyen path.
 */
export function abbreviateHomePath(path: string, home: string | undefined): string {
  if (home === undefined || home === "") return path;
  if (isWindowsStylePath(path) || isWindowsStylePath(home)) return path;
  const root = home.replace(/\/+$/, "");
  if (root === "" || root === "/") return path;
  if (path.replace(/\/+$/, "") === root) return "~";
  if (path.startsWith(`${root}/`)) return `~${path.slice(root.length)}`;
  return path;
}

/**
 * Cat goc Workspace khoi mot duong dan tuyet doi nam trong no (chi de hien thi).
 * Nhan: text — duong dan can rut ngan; cwd — goc Workspace cua phien (thieu hoac rong thi giu nguyen).
 * Tra: duong dan tuong doi theo goc Workspace, hoac nguyen ven khi khong nam trong goc.
 */
export function relativizeToCwd(text: string, cwd: string | undefined): string {
  if (cwd === undefined || cwd === "") return text;
  const root = cwd.replace(/[/\\]+$/, "");
  if (text.startsWith(`${root}/`) || text.startsWith(`${root}\\`)) return text.slice(root.length + 1);
  return text;
}

/**
 * Doc mot duong dan tuyet doi tu metadata ket qua tool da luu (khong tin du lieu la).
 * Nhan: meta — metadata cua ket qua tool trong Session log; field — ten truong (duong dan file hoac cwd).
 * Tra: duong dan da ghi, hoac undefined voi metadata cu/sai khuon.
 */
export function recordedAbsolutePath(meta: unknown, field: string): string | undefined {
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const value = (meta as Record<string, unknown>)[field];
  return typeof value === "string" && isAbsoluteWorkspacePath(value) ? value : undefined;
}
