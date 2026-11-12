/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Migration MỘT LẦN khoá persist checkpoint tab trình duyệt: dsh.sidebar-browser.v1 → gbh.sidebar-browser.v1
 */

// VI SAO: khoá persist của bản gốc DSH là `dsh.*`; Galaxy Blackhole đổi sang `gbh.*`. Máy người dùng đã có
// dữ liệu khoá CŨ ⇒ migration MỘT LẦN: đọc cũ → ghi mới → XOÁ cũ (idempotent; không có storage thì bỏ qua).

/** Khoá persist MỚI (Galaxy Blackhole). */
export const SIDEBAR_BROWSER_STORE_KEY = "gbh.sidebar-browser.v1";

/** Khoá persist CŨ của bản gốc — chỉ dùng trong bảng migration. */
export const SIDEBAR_BROWSER_LEGACY_KEY = "dsh.sidebar-browser.v1";

/** Bề mặt tối thiểu của Storage mà migration cần (test dùng kho giả). */
export interface PersistStorage {
  /** Đọc một khoá; null khi không có. */
  getItem(key: string): string | null;
  /** Ghi một khoá. */
  setItem(key: string, value: string): void;
  /** Xoá một khoá. */
  removeItem(key: string): void;
}

/** Kết quả một lượt migration. */
export interface PersistMigrationResult {
  /** Khoá đã chuyển giá trị cũ sang khoá mới. */
  migrated: string[];
  /** Khoá cũ đã xoá. */
  removedLegacy: string[];
  /** Khoá có cả cũ lẫn mới ⇒ giữ giá trị MỚI, không đọc giá trị cũ. */
  keptNew: string[];
  /** true khi không có Storage. */
  skippedNoStorage: boolean;
}

/**
 * Lấy localStorage nếu dùng được; không có (SSR/test/private-mode) thì undefined.
 * @returns Storage hợp lệ, hoặc undefined.
 */
export function defaultPersistStorage(): PersistStorage | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const probe = "__gbh_persist_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Migration MỘT LẦN khoá dsh.sidebar-browser.v1 → gbh.sidebar-browser.v1.
 * Nhận: storage — nơi đọc/ghi (mặc định localStorage); pair — cặp khoá (mặc định khoá của gói này).
 * Trả: số khoá đã migrate / đã xoá / giữ mới.
 */
export function migrateSidebarBrowserKey(
  storage: PersistStorage | undefined = defaultPersistStorage(),
  pair: { from: string; to: string } = { from: SIDEBAR_BROWSER_LEGACY_KEY, to: SIDEBAR_BROWSER_STORE_KEY },
): PersistMigrationResult {
  const result: PersistMigrationResult = { migrated: [], removedLegacy: [], keptNew: [], skippedNoStorage: false };
  if (storage === undefined) {
    result.skippedNoStorage = true;
    return result;
  }
  let legacy: string | null = null;
  let current: string | null = null;
  try {
    legacy = storage.getItem(pair.from);
    current = storage.getItem(pair.to);
  } catch {
    return result;
  }
  if (legacy === null) return result;
  if (current !== null) result.keptNew.push(pair.to);
  else {
    try {
      storage.setItem(pair.to, legacy);
      result.migrated.push(pair.to);
    } catch {
      return result;
    }
  }
  try {
    storage.removeItem(pair.from);
    result.removedLegacy.push(pair.from);
  } catch {
    // Xoá hỏng không chặn — lần chạy sau sẽ dọn tiếp (khoá mới đã có ⇒ nhánh keptNew).
  }
  return result;
}
