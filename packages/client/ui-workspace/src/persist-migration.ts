/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Migration MỘT LẦN khoá persist localStorage: dsh.* (bản gốc) → gbh.* (Galaxy Blackhole) — đọc cũ, ghi mới, xoá cũ
 */

// VI SAO CO FILE NAY (Wave D, task-30)
//   Row ui-workspace ghi hai lựa chọn của người dùng vào localStorage dưới khoá `dsh.*` của bản gốc.
//   Galaxy Blackhole đổi thương hiệu nên khoá MỚI là `gbh.*`. Bản cũ đã ghi `dsh.*` trên máy người dùng
//   ⇒ nếu chỉ đổi tên, người dùng MẤT lựa chọn (nhóm/lọc/thứ tự workspace, phiên đang mở). Vì vậy có
//   MIGRATION MỘT LẦN: đọc giá trị ở khoá CŨ → ghi sang khoá MỚI → XOÁ khoá cũ. Sau đó chỉ còn khoá mới.
//
//   Quy ước:
//     · Khoá MỚI đã có ⇒ KHÔNG đọc giá trị cũ nữa; chỉ dọn khoá cũ nếu còn (idempotent, chạy lại vô hại).
//     · localStorage không có (SSR/test/private-mode chặn) ⇒ bỏ qua an toàn, không ném lỗi.
//     · Giá trị giữ NGUYÊN VĂN (cùng định dạng JSON mà store persist của bản gốc ghi).

/** Khoá persist MỚI của trạng thái xem workspace (thay `dsh.workspace.view`). */
export const WORKSPACE_VIEW_STORAGE_KEY = "gbh.workspace.view";

/** Khoá persist MỚI của lựa chọn phiên đang giữ khung nhìn chính (thay `dsh.sessions.current`). */
export const SESSIONS_CURRENT_STORAGE_KEY = "gbh.sessions.current";

/**
 * Bảng migration khoá: from = khoá bản gốc DSH, to = khoá mới.
 * Thứ tự cố định để kết quả migrate ổn định giữa các lần chạy.
 */
export const PERSIST_KEY_MIGRATIONS: readonly { from: string; to: string }[] = Object.freeze([
  { from: "dsh.workspace.view", to: WORKSPACE_VIEW_STORAGE_KEY },
  { from: "dsh.sessions.current", to: SESSIONS_CURRENT_STORAGE_KEY },
]);

/** Bề mặt tối thiểu của Storage mà migration cần (để test bằng kho giả). */
export interface PersistStorage {
  /** Đọc một khoá; null khi không có. */
  getItem(key: string): string | null;
  /** Ghi một khoá. */
  setItem(key: string, value: string): void;
  /** Xoá một khoá. */
  removeItem(key: string): void;
}

/** Kết quả một lượt migration — đếm được để test và để log. */
export interface PersistMigrationResult {
  /** Khoá đã được chuyển giá trị cũ sang khoá mới. */
  migrated: string[];
  /** Khoá cũ bị xoá (kể cả khi khoá mới đã có sẵn). */
  removedLegacy: string[];
  /** Khoá có cả cũ lẫn mới ⇒ giữ giá trị MỚI, không đọc giá trị cũ. */
  keptNew: string[];
  /** true khi không có Storage để migrate. */
  skippedNoStorage: boolean;
}

/**
 * Lấy localStorage của trình duyệt nếu dùng được; không có thì undefined (SSR, test không cài, private mode).
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
 * Chạy migration MỘT LẦN cho MỌI cặp khoá (mặc định là hai khoá của row ui-workspace).
 *
 * Nhận: storage — nơi đọc/ghi (mặc định localStorage của trình duyệt); pairs — bảng cặp khoá (mặc định PERSIST_KEY_MIGRATIONS).
 * Trả: số khoá đã migrate / đã xoá / giữ mới, để test và log.
 */
export function migratePersistKeys(
  storage: PersistStorage | undefined = defaultPersistStorage(),
  pairs: readonly { from: string; to: string }[] = PERSIST_KEY_MIGRATIONS,
): PersistMigrationResult {
  const result: PersistMigrationResult = { migrated: [], removedLegacy: [], keptNew: [], skippedNoStorage: false };
  if (storage === undefined) {
    result.skippedNoStorage = true;
    return result;
  }
  for (const pair of pairs) {
    let legacy: string | null = null;
    let current: string | null = null;
    try {
      legacy = storage.getItem(pair.from);
      current = storage.getItem(pair.to);
    } catch {
      continue;
    }
    if (legacy === null) continue;
    if (current !== null) {
      // Khoá MỚI đã có ⇒ KHÔNG đọc/không dùng giá trị cũ; chỉ dọn khoá cũ (idempotent).
      result.keptNew.push(pair.to);
    } else {
      try {
        storage.setItem(pair.to, legacy);
        result.migrated.push(pair.to);
      } catch {
        continue;
      }
    }
    try {
      storage.removeItem(pair.from);
      result.removedLegacy.push(pair.from);
    } catch {
      // Xoá hỏng không chặn: lần chạy sau sẽ dọn tiếp (khoá mới đã có ⇒ nhánh keptNew).
    }
  }
  return result;
}
