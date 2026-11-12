/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Migration MỘT LẦN khoá persist bố cục thanh bên phải: tiền tố dsh.sidebar-right.v1. → gbh.sidebar-right.v1. (mỗi phiên một khoá)
 */

// VI SAO: bản gốc ghi MỘT khoá cho MỖI phiên dưới tiền tố `dsh.sidebar-right.v1.`; đổi thương hiệu sang
// `gbh.sidebar-right.v1.`. Migration quét MỌI khoá khớp tiền tố cũ: đọc → ghi mới → xoá cũ (idempotent).

/** Tiền tố persist MỚI. */
export const SIDEBAR_RIGHT_PREFIX = "gbh.sidebar-right.v1.";

/** Tiền tố persist CŨ của bản gốc — chỉ dùng trong migration. */
export const SIDEBAR_RIGHT_LEGACY_PREFIX = "dsh.sidebar-right.v1.";

/** Bề mặt Storage cần cho migration theo tiền tố (có duyệt khoá). */
export interface PrefixPersistStorage {
  /** Số khoá hiện có. */
  readonly length: number;
  /** Khoá thứ i (0-based). */
  key(index: number): string | null;
  /** Đọc một khoá. */
  getItem(key: string): string | null;
  /** Ghi một khoá. */
  setItem(key: string, value: string): void;
  /** Xoá một khoá. */
  removeItem(key: string): void;
}

/** Kết quả một lượt migration theo tiền tố. */
export interface PrefixPersistMigrationResult {
  /** Khoá đã chuyển. */
  migrated: string[];
  /** Khoá cũ đã xoá. */
  removedLegacy: string[];
  /** true khi không có Storage. */
  skippedNoStorage: boolean;
}

/**
 * Lấy localStorage nếu dùng được; không có (SSR/test/private-mode) thì undefined.
 * @returns Storage hợp lệ, hoặc undefined.
 */
export function defaultPrefixStorage(): PrefixPersistStorage | undefined {
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
 * Migration MỘT LẦN mọi khoá `dsh.sidebar-right.v1.<sessionId>` → `gbh.sidebar-right.v1.<sessionId>`.
 * Khoá MỚI đã có ⇒ không đọc/không dùng giá trị cũ, chỉ dọn khoá cũ. Chạy TRƯỚC lần đọc đầu tiên.
 * Nhận: storage — nơi đọc/ghi (mặc định localStorage).
 * Trả: danh sách khoá đã chuyển và đã xoá.
 */
export function migrateSidebarRightPersistence(
  storage: PrefixPersistStorage | undefined = defaultPrefixStorage(),
): PrefixPersistMigrationResult {
  const result: PrefixPersistMigrationResult = { migrated: [], removedLegacy: [], skippedNoStorage: false };
  if (storage === undefined) {
    result.skippedNoStorage = true;
    return result;
  }
  const legacyKeys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null && key.startsWith(SIDEBAR_RIGHT_LEGACY_PREFIX)) legacyKeys.push(key);
    }
  } catch {
    return result;
  }
  for (const legacyKey of legacyKeys) {
    const freshKey = SIDEBAR_RIGHT_PREFIX + legacyKey.slice(SIDEBAR_RIGHT_LEGACY_PREFIX.length);
    let legacy: string | null = null;
    let current: string | null = null;
    try {
      legacy = storage.getItem(legacyKey);
      current = storage.getItem(freshKey);
    } catch {
      continue;
    }
    if (legacy === null) continue;
    if (current === null) {
      try {
        storage.setItem(freshKey, legacy);
        result.migrated.push(freshKey);
      } catch {
        continue;
      }
    }
    try {
      storage.removeItem(legacyKey);
      result.removedLegacy.push(legacyKey);
    } catch {
      // Lần chạy sau dọn tiếp.
    }
  }
  return result;
}
