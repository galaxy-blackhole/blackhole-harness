/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Duong dan HTTP + bo kiem du lieu cua row ui-deliverables — nguyen van ban goc cua DSH
 */

import { CHANGES_REVIEW_ADDRESS, CHANGES_REVIEW_ADDRESS_LENGTH } from "./ids.ts";
import { isRecord } from "./util.ts";

/** Duong dan day du cua tuyen doc bang tom tat file da doi. */
export const CHANGED_FILES_PATH = "/api/changes.summary";
/** Duong dan day du cua tuyen doc so sanh mot file da doi. */
export const CHANGES_DIFF_PATH = "/api/changes.diff";
/** Duong dan day du cua tuyen mo mot file da doi tren desktop cua Host. */
export const CHANGES_OPEN_PATH = "/api/changes.open";
/** Dang tuong doi trinh duyet cua CHANGED_FILES_PATH (ban goc cat dau "/"). */
export const CHANGED_FILES_ROUTE = CHANGED_FILES_PATH.slice(1);
/** Dang tuong doi trinh duyet cua CHANGES_DIFF_PATH. */
export const CHANGES_DIFF_ROUTE = CHANGES_DIFF_PATH.slice(1);
/** Dang tuong doi trinh duyet cua CHANGES_OPEN_PATH. */
export const CHANGES_OPEN_ROUTE = CHANGES_OPEN_PATH.slice(1);

/** Mot file da doi trong bang tom tat cua mot luot. */
export interface ChangedFile {
  /** Duong dan tuyet doi trong khong gian lam viec. */
  path: string;
  /** Duong dan rut gon de hien thi. */
  display: string;
  /** So dong them vao. */
  added: number;
  /** So dong bo di. */
  deleted: number;
  /** true khi file la nhi phan (khong so sanh dong duoc). */
  binary?: boolean;
  /** true khi file qua lon de so sanh. */
  oversized?: boolean;
}

/** Bang tom tat file da doi cua mot luot. */
export interface ChangesSummary {
  /** So thu tu luot. */
  turn: number;
  /** Danh sach file da doi (co the bi cat bot). */
  files: readonly ChangedFile[];
  /** Tong so file da doi trong luot. */
  total: number;
  /** Tong so dong them vao. */
  added: number;
  /** Tong so dong bo di. */
  deleted: number;
}

/** Mot khoi dong lien tuc trong so sanh. */
export interface ChangeHunk {
  /** Dong bat dau ben truoc. */
  oldStart: number;
  /** So dong ben truoc. */
  oldLines: number;
  /** Dong bat dau ben sau. */
  newStart: number;
  /** So dong ben sau. */
  newLines: number;
  /** Cac dong, moi dong bat dau bang "+", "-" hoac " ". */
  lines: readonly string[];
}

/** Ket qua so sanh mot file: van ban (co the tho) hoac ly do tu choi. */
export interface ChangesDiff {
  /** Loai ket qua. */
  kind: "text" | "binary" | "oversized";
  /** Duong dan tuyet doi trong khong gian lam viec. */
  path: string;
  /** Duong dan rut gon de hien thi. */
  display: string;
  /** true khi file khong ton tai o dau luot. */
  before?: boolean;
  /** true khi file khong con o cuoi luot. */
  after?: boolean;
  /** true khi so sanh theo dong bi qua han va duoc thay bang thay the ca file. */
  coarse?: boolean;
  /** Cac khoi dong. */
  hunks?: readonly ChangeHunk[];
}

/** Toa do cua mot tab so sanh trong thanh ben phai. */
export interface ChangesReviewCoordinates {
  /** Phien dang xem. */
  sessionId: string;
  /** So thu tu su kien workspace/changes. */
  seq: number;
  /** So thu tu luot (dung cho tieu de tab). */
  turn: number;
}

/**
 * Mot file da doi doc tu bang tom tat co hop le khong.
 * Nhan: value — JSON da giai ma.
 * Tra: true khi ban ghi co duong dan, duong dan hien thi va so dong.
 */
export function isChangedFile(value: unknown): value is ChangedFile {
  if (!isRecord(value)) return false;
  const { path, display, added, deleted, binary, oversized } = value;
  return typeof path === "string" && path.length > 0 && typeof display === "string" && display.length > 0 &&
    Number.isSafeInteger(added) && Number.isSafeInteger(deleted) &&
    (binary === undefined || binary === true) && (oversized === undefined || oversized === true);
}

/**
 * Bang tom tat doc tu tuyen tom tat co hop le khong.
 * Nhan: value — JSON da giai ma.
 * Tra: true khi gia tri co luot, danh sach file day du, tong so va tong dong.
 */
export function isChangesSummary(value: unknown): value is ChangesSummary {
  if (!isRecord(value)) return false;
  const { turn, files, total, added, deleted } = value;
  return Number.isSafeInteger(turn) && (turn as number) >= 1 && Number.isSafeInteger(total) &&
    Number.isSafeInteger(added) && Number.isSafeInteger(deleted) &&
    Array.isArray(files) && files.every(isChangedFile);
}

/**
 * Mot khoi dong doc tu tuyen so sanh co hop le khong.
 * Nhan: value — JSON da giai ma.
 * Tra: true khi bon moc dong deu la so nguyen khong am va moi dong dung dinh dang.
 */
export function isHunk(value: unknown): value is ChangeHunk {
  if (!isRecord(value)) return false;
  const { oldStart, oldLines, newStart, newLines, lines } = value;
  return [oldStart, oldLines, newStart, newLines].every((field) => Number.isSafeInteger(field) && (field as number) >= 0) &&
    Array.isArray(lines) && lines.every((line) => typeof line === "string" && /^[+ -]/.test(line));
}

/**
 * Ket qua so sanh doc tu tuyen so sanh co hop le khong.
 * Nhan: value — JSON da giai ma.
 * Tra: true khi la so sanh van ban voi cac khoi dung dinh dang, hoac la tu choi nhi phan/qua lon.
 */
export function isChangesDiff(value: unknown): value is ChangesDiff {
  if (!isRecord(value)) return false;
  const { kind, path, display } = value;
  if (typeof path !== "string" || path.length === 0 || typeof display !== "string" || display.length === 0) return false;
  if (kind === "binary" || kind === "oversized") return true;
  if (kind !== "text") return false;
  const { before, after, hunks, coarse } = value;
  return typeof before === "boolean" && typeof after === "boolean" && typeof coarse === "boolean" &&
    Array.isArray(hunks) && hunks.every(isHunk);
}

/**
 * Du lieu su kien workspace/changes doc tu nhat ky phien co hop le khong.
 * Nhan: value — du lieu su kien ben vung da giai ma.
 * Tra: true khi su kien co nêu mot luot.
 */
export function isChangesEvent(value: unknown): value is { turn: number } {
  return isRecord(value) && Number.isSafeInteger(value["turn"]) && (value["turn"] as number) >= 1;
}

/**
 * Dung toa do co xac thuc cho bang tom tat ma su kien workspace/changes da thong bao.
 * Nhan: sessionId — phien so huu; seq — so thu tu su kien.
 * Tra: duong dan tom tat dang tuong doi trinh duyet.
 */
export function changesSummaryUrl(sessionId: string, seq: number): string {
  return `${CHANGED_FILES_ROUTE}?${new URLSearchParams({ sessionId, seq: String(seq) })}`;
}

/**
 * Dung toa do co xac thuc cho so sanh cua mot file da liet ke.
 * Nhan: sessionId — phien so huu; seq — so thu tu su kien; index — chi so goc trong mang files.
 * Tra: duong dan so sanh dang tuong doi trinh duyet.
 */
export function changesDiffUrl(sessionId: string, seq: number, index: number): string {
  return `${CHANGES_DIFF_ROUTE}?${new URLSearchParams({ sessionId, seq: String(seq), index: String(index) })}`;
}

/**
 * Dung toa do co xac thuc cho viec mo mot file da doi bang ung dung cua Host.
 * Nhan: sessionId — phien so huu; seq — so thu tu su kien; index — chi so goc trong mang files.
 * Tra: duong dan hanh dong dang tuong doi trinh duyet.
 */
export function changedFileUrl(sessionId: string, seq: number, index: number): string {
  return `${CHANGES_OPEN_ROUTE}?${new URLSearchParams({ sessionId, seq: String(seq), index: String(index) })}`;
}

/**
 * Dia chi tab so sanh cua mot luot trong thanh ben phai. Phien va so thu tu su kien
 * dinh danh noi dung; so luot di kem de dat tieu de tab.
 * Nhan: coordinates — phien dang xem, su kien thong bao va so luot.
 * Tra: dia chi dang gbh-resource://changes-review/session/... (nhan ca scheme cu khi doc)
 */
export function changesReviewAddress(coordinates: ChangesReviewCoordinates): string {
  const { sessionId, seq, turn } = coordinates;
  return `${CHANGES_REVIEW_ADDRESS}${encodeURIComponent(sessionId)}/${seq}/${turn}`;
}

/**
 * Doc lai toa do tu mot dia chi so sanh.
 * Nhan: address — mot dia chi tai nguyen.
 * Tra: toa do, hoac undefined voi moi dia chi khac.
 */
export function parseChangesReviewAddress(address: string): ChangesReviewCoordinates | undefined {
  // 18/10/2026 (task-29): NHẬN CẢ HAI scheme — địa chỉ đã lưu trong lịch sử phiên mang dsh-resource://.
  const legacyPrefix = "dsh-resource://changes-review/session/";
  const prefix = address.startsWith(CHANGES_REVIEW_ADDRESS)
    ? CHANGES_REVIEW_ADDRESS
    : address.startsWith(legacyPrefix) ? legacyPrefix : undefined;
  if (prefix === undefined) return undefined;
  const parts = address.slice(prefix.length).split("/");
  if (parts.length !== 3) return undefined;
  const [sessionId, seq, turn] = parts as [string, string, string];
  if (sessionId === "" || !/^\d+$/.test(seq) || !/^[1-9]\d*$/.test(turn)) return undefined;
  try {
    return { sessionId: decodeURIComponent(sessionId), seq: Number(seq), turn: Number(turn) };
  } catch {
    return undefined;
  }
}
