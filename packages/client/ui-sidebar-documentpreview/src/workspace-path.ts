/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Ngu phap dia chi gbh-resource://file/... va tro giup duong dan cua workspace — nguyen van tu util/workspace-path cua ban goc
 */

/** Scheme va type ma moi dia chi tep mo dau — nguyen van ban goc. */
// 18/10/2026 (task-29, Wave D): PHÁT scheme mới gbh-resource://; nơi nhận chấp nhận cả scheme cũ.
export const FILE_ADDRESS_PREFIX = "gbh-resource://file/";
/**
 * Scheme CU (`dsh-resource://file/`) ma NOI NHAN van phai hieu: dia chi cu con nam trong
 * lich su phien va trong chip tep da luu, nen chi doi scheme phat hanh la khong du.
 */
export const LEGACY_FILE_ADDRESS_PREFIX = "dsh-resource://file/";

/** Moi tien to dia chi tep ma bo doc chap nhan (moi + cu). */
const FILE_ADDRESS_PREFIXES: readonly string[] = [FILE_ADDRESS_PREFIX, LEGACY_FILE_ADDRESS_PREFIX];

/**
 * Ma hoa mot doan id hoac duong dan, giu ':' nguyen van cho ky tu o dia.
 * Nhan: segment — doan can ma hoa.
 * Tra: doan da ma hoa.
 */
export function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%3A/gi, ":");
}

/**
 * Ma hoa duong dan theo tung doan phan cach bang '/'.
 * Nhan: path — duong dan.
 * Tra: duong dan da ma hoa.
 */
export function encodePath(path: string): string {
  return path.split("/").map(encodeSegment).join("/");
}

/**
 * Doan dau tien sau khi giai ma co phai ky tu o dia Windows (C:) khong.
 * Nhan: segment — doan dau.
 * Tra: true khi la ky tu o dia.
 */
export function isDriveSegment(segment: string | undefined): boolean {
  return segment !== undefined && /^[A-Za-z]:$/.test(segment);
}

/**
 * Dung dia chi doc mot tep qua mot Phien.
 * Nhan: sessionId — Phien ma workspace Host giai duong dan; path — duong dan tuyet doi hoac tuong doi.
 * Tra: dia chi gbh-resource://file/session/<sessionId>/<path>.
 */
export function sessionFileAddress(sessionId: string, path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
  return FILE_ADDRESS_PREFIX + "session/" + encodeSegment(sessionId) + "/" + encodePath(normalized);
}

/** Cac phan cua mot dia chi tep da doc lai. */
export interface FileAddressParts {
  /** Pham vi: 'session' hoac 'absolute'. */
  scope: "session" | "absolute";
  /** Phien so huu (chi voi scope 'session'). */
  sessionId?: string;
  /** Duong dan da giai ma. */
  path: string;
}

/**
 * Doc lai mot dia chi tep thanh cac phan, khong giai '.' hay '..'.
 * Nhan: address — chuoi ung vien.
 * Tra: cac phan, hoac undefined khi khong phai URI hop le.
 */
export function parseFileAddress(address: string): FileAddressParts | undefined {
  try {
    const prefix = FILE_ADDRESS_PREFIXES.find((candidate) => address.startsWith(candidate));
    if (prefix === undefined) return undefined;
    const end = address.search(/[?#]/);
    const [scope, ...rest] = address.slice(prefix.length, end === -1 ? undefined : end).split("/");
    if (scope === "session") {
      const [id, ...segments] = rest;
      if (id === undefined || id === "" || segments.length === 0) return undefined;
      return { scope, sessionId: decodeURIComponent(id), path: segments.map(decodeURIComponent).join("/") };
    }
    if (scope === "absolute") {
      const unc = rest[0] === "" && rest.length > 1;
      const segments = (unc ? rest.slice(1) : rest).map(decodeURIComponent);
      if (segments.length === 0 || segments[0] === "") return undefined;
      if (unc) return { scope, path: "//" + segments.join("/") };
      return { scope, path: isDriveSegment(segments[0]) ? segments.join("/") : "/" + segments.join("/") };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Duong dan co dung tien to o dia Windows hay UNC khong.
 * Nhan: value — duong dan.
 * Tra: true khi la kieu Windows.
 */
export function isWindowsStylePath(value: string): boolean {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
}

/**
 * Duong dan co tuyet doi theo mot trong hai cach viet ma Host chap nhan khong.
 * Nhan: path — duong dan can phan loai.
 * Tra: true khi tuyet doi; false khi tuong doi voi workspace.
 */
export function isAbsoluteWorkspacePath(path: string): boolean {
  return path.startsWith("/") || isWindowsStylePath(path);
}

/**
 * Tach duong dan de hien thi: phan thu muc (tinh ca dau phan cach cuoi) va doan cuoi.
 * Nhan: path — duong dan dung '/' hoac '\\'.
 * Tra: { directory, name }.
 */
export function pathPartsOf(path: string): { directory: string; name: string } {
  const trimmed = path.replace(/[/\\]+$/, "");
  if (trimmed === "") return { directory: "", name: path };
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\")) + 1;
  return { directory: trimmed.slice(0, cut), name: trimmed.slice(cut) };
}

/**
 * Danh dia chi mot duong dan tuyet doi da giai ma qua tuyen tep da xac thuc.
 * Nhan: base — goc ung dung HTTP(S) kem tien to trien khai, hoac 'dsh-app://app/'; path — duong dan.
 * Tra: URL tep, hoac undefined voi giao thuc khong ho tro / duong dan khong tuyet doi.
 */
export function fileMediaUrl(base: string, path: string): string | undefined {
  if ((!/^https?:/u.test(base) && !base.startsWith("dsh-app://app/")) || !isAbsoluteWorkspacePath(path) || /^[/\\]{2}/u.test(path) || /[\u0000-\u001f\u007f]/u.test(path)) return undefined;
  return new URL("api/file?path=" + encodeURIComponent(path), base).href;
}
