/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Gioi han cache dung chung giua cau hinh Host va ban xem tai lieu tren trinh duyet
 */

/** Gioi han trien khai ap truoc khi dang ky ban xem Office. */
export interface OfficeLimits {
  /** So ket qua hoan tat duoc giu lai. */
  maxCachedEntries: number;
  /** Tong byte PDF duoc giu lai. */
  maxCachedBytes: number;
  /** So yeu cau chuyen doi chua settled. */
  maxPending: number;
  /** So nguoi doc, ke ca lan tra metadata. */
  maxReaders: number;
}

/** Gioi han cua trinh phan tich bang tinh. */
export interface ExcelLimits {
  /** Tran byte cua mot workbook. */
  maxBytes: number;
  /** Tran so o. */
  maxCells: number;
  /** Tran thoi gian mo mot workbook (ms). */
  timeoutMs: number;
}

/** Cau hinh cua ban xem tai lieu. */
export interface DocumentPreviewConfig {
  /** Gioi han Office. */
  office: OfficeLimits;
  /** Gioi han bang tinh. */
  excel: ExcelLimits;
}

/** Gia tri mac dinh — NGUYEN VAN tu Schema cua ban goc (lib/types/config.js). */
export const DEFAULT_CONFIG: DocumentPreviewConfig = {
  office: { maxCachedEntries: 8, maxCachedBytes: 64 * 1024 * 1024, maxPending: 8, maxReaders: 32 },
  excel: { maxBytes: 16 * 1024 * 1024, maxCells: 25e4, timeoutMs: 15e3 },
};

/**
 * Doc cau hinh ma Host nhung vao trang, ap gia tri mac dinh cua ban goc cho phan thieu.
 *
 * Ban goc dung schemastery (Schema.natural().min(1).max(...).default(...)) de chuan hoa; o day gia tri
 * mac dinh va bien duoc ap bang tay vi schemastery la thu vien rieng cua bundle goc (khong co trong
 * bang module cua trang) — cung gia tri, cung bien, khong doi hanh vi.
 * Nhan: raw — gia tri globalThis.__GBH_DOCUMENT_PREVIEW_CONFIG__ (co the undefined).
 * Tra: cau hinh da chuan hoa.
 */
export function readConfig(raw: unknown): DocumentPreviewConfig {
  const source = (raw ?? {}) as { office?: Partial<OfficeLimits>; excel?: Partial<ExcelLimits> };
  const office = source.office ?? {};
  const excel = source.excel ?? {};
  return {
    office: {
      maxCachedEntries: natural(office.maxCachedEntries, DEFAULT_CONFIG.office.maxCachedEntries, 1),
      maxCachedBytes: natural(office.maxCachedBytes, DEFAULT_CONFIG.office.maxCachedBytes, 1),
      maxPending: natural(office.maxPending, DEFAULT_CONFIG.office.maxPending, 1),
      maxReaders: natural(office.maxReaders, DEFAULT_CONFIG.office.maxReaders, 1),
    },
    excel: {
      maxBytes: natural(excel.maxBytes, DEFAULT_CONFIG.excel.maxBytes, 1),
      maxCells: natural(excel.maxCells, DEFAULT_CONFIG.excel.maxCells, 1),
      timeoutMs: natural(excel.timeoutMs, DEFAULT_CONFIG.excel.timeoutMs, 1),
    },
  };
}

/**
 * Ep mot gia tri ve so tu nhien trong bien cho truoc, lui ve mac dinh khi khong hop le.
 * Nhan: value — gia tri tho; fallback — gia tri mac dinh; min — bien duoi.
 * Tra: so tu nhien da ep.
 */
function natural(value: unknown, fallback: number, min: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < min) return fallback;
  return value;
}
