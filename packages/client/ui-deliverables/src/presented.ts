/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tuyen mo file ban giao + bo kiem du lieu cua row ui-deliverables — nguyen van ban goc cua DSH
 */

import { isRecord } from "./util.ts";

/** Duong dan day du cua tuyen mo mot file ban giao tren desktop cua Host. */
export const PRESENT_OPEN_PATH = "/api/present.open";
/** Duong dan day du cua tuyen doc kha nang desktop va dich den cua Host. */
export const PRESENT_HOST_PATH = "/api/present.host";
/** Dang tuong doi trinh duyet cua PRESENT_OPEN_PATH. */
export const PRESENT_OPEN_ROUTE = PRESENT_OPEN_PATH.slice(1);
/** Dang tuong doi trinh duyet cua PRESENT_HOST_PATH. */
export const PRESENT_HOST_ROUTE = PRESENT_HOST_PATH.slice(1);

/** Ten trinh quan ly tep cua Host, hoac null khi khong co desktop. */
export type FileManager = "finder" | "explorer" | "directory";

/** Kha nang desktop va dich den ma Host bao ve. */
export interface PresentedHost {
  /** Ten desktop (vi du "macOS"). */
  name: string;
  /** true khi co desktop de mo bang ung dung ngoai. */
  available: boolean;
  /** Trinh quan ly tep se duoc dung, hoac null. */
  fileManager: FileManager | null;
}

/** Mot file duoc khai bao trong su kien ban giao. */
export interface PresentedFile {
  /** Duong dan file. */
  path: string;
  /** Mo ta ngan (tuy chon). */
  description?: string;
}

/**
 * Du lieu desktop doc qua HTTP co hop le khong.
 * Nhan: value — phan hoi da giai ma.
 * Tra: true khi moi truong hien thi va hanh dong deu duoc ho tro.
 */
export function isPresentedHost(value: unknown): value is PresentedHost {
  if (typeof value !== "object" || value === null) return false;
  const host = value as Record<string, unknown>;
  return typeof host["name"] === "string" && typeof host["available"] === "boolean" &&
    (host["fileManager"] === null || host["fileManager"] === "finder" || host["fileManager"] === "explorer" || host["fileManager"] === "directory");
}

/**
 * Mot khai bao file doc tu nhat ky phien co hop le khong.
 * Nhan: value — du lieu ben vung da giai ma.
 * Tra: true khi khai bao co duong dan va mo ta tuy chon.
 */
export function isPresentedFile(value: unknown): value is PresentedFile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { path, description } = value as Record<string, unknown>;
  return typeof path === "string" && path.trim().length > 0 && (description === undefined || typeof description === "string");
}

/**
 * Dung toa do co xac thuc cho mot file da khai bao.
 * Nhan: sessionId — phien so huu; seq — so thu tu su kien deliverables/presented; index — chi so goc trong mang files.
 * Tra: duong dan hanh dong dang tuong doi trinh duyet.
 */
export function presentedFileUrl(sessionId: string, seq: number, index: number): string {
  return `${PRESENT_OPEN_ROUTE}?${new URLSearchParams({ sessionId, seq: String(seq), index: String(index) })}`;
}

/**
 * Mot su kien ban giao co hop le khong, truoc khi doc luot hoac danh sach file cua no.
 * Nhan: value — du lieu ben vung da giai ma.
 * Tra: true khi su kien co luot, callId va danh sach file.
 */
export function isPresentedData(value: unknown): value is { turn: number; callId: string; files: readonly unknown[] } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { turn, callId, files } = value as Record<string, unknown>;
  return typeof turn === "number" && Number.isSafeInteger(turn) && turn >= 1 &&
    typeof callId === "string" && callId.length > 0 && Array.isArray(files);
}

/**
 * Doc mot truong bat ky trong du lieu dong — tien cho viec port nguyen van ban goc.
 * Nhan: value — ban ghi; key — ten truong.
 * Tra: gia tri truong, hoac undefined.
 */
export function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

/**
 * Doan cuoi cua duong dan — phan nhan ra file ngay tu cai nhin dau.
 * Nhan: path — duong dan ngan cach bang "/" hoac "\\".
 * Tra: doan cuoi, hoac ca chuoi khi khong co dau ngan cach.
 */
export function basename(path: string): string {
  const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return at === -1 ? path : path.slice(at + 1);
}
