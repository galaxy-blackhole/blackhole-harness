/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bo chuyen tuy chon: localStorage cua trinh duyet va cau preload cua Desktop (khong lan nhau)
 */

import { STORAGE_KEY } from "../ids.ts";
import { migrateKeybindingsKey } from "../persist-migration.ts";
import { ShortcutPersistence, type DesktopShortcutsApi, type ShortcutConfigSnapshot, type ShortcutPlatform } from "../protocol.ts";

/** Cửa sổ sản phẩm có thể mang cầu Desktop do preload cài. */
interface ProductWindow extends Window {
  /** Cầu Desktop (chỉ có trong vỏ Electron/Tauri). */
  dshDesktop?: { shortcuts?: DesktopShortcutsApi; keyboard?: unknown };
}

/**
 * Nối localStorage và các cập nhật cùng origin vào bộ điều phối giao dịch chung.
 * Nhận: `window` — cửa sổ sở hữu, `platform` — thiết bị đang truy cập, `publish` — nhận bản chụp đầy đủ.
 * Trả: adapter + hàm dọn vòng đời.
 */
export function webShortcutStorage(
  window: ProductWindow,
  platform: ShortcutPlatform,
  publish: (snapshot: ShortcutConfigSnapshot) => void,
): DesktopShortcutsApi & { dispose(): void } {
  // 18/10/2026 (task-38): MIGRATION MỘT LẦN dsh.keybindings.v1 → gbh.keybindings.v1 TRƯỚC lần đọc đầu.
  migrateKeybindingsKey();
  const persistence = new ShortcutPersistence(
    {
      read: () => window.localStorage.getItem(STORAGE_KEY),
      write: (raw) => {
        window.localStorage.setItem(STORAGE_KEY, raw);
      },
    },
    "web",
    platform,
    true,
    publish,
  );
  const changed = (event: StorageEvent): void => {
    if (event.key === null || event.key === STORAGE_KEY) void persistence.readCurrent();
  };
  window.addEventListener("storage", changed);
  return {
    get: (definitions) => {
      persistence.setDefinitions(definitions);
      return persistence.readCurrent();
    },
    edit: (edit, revision) => persistence.edit(edit, revision),
    subscribe: () => () => undefined,
    recording: async () => undefined,
    dispose: () => {
      window.removeEventListener("storage", changed);
      persistence.dispose();
    },
  };
}

/**
 * Đọc năng lực preload theo origin; thiếu cầu là lỗi cấu hình tường minh (KHÔNG rơi về localStorage).
 * Nhận: `window` — cửa sổ sản phẩm.
 * Trả: API Desktop hạn chế, hoặc undefined khi preload chưa sẵn sàng.
 */
export function desktopShortcutStorage(window: ProductWindow): DesktopShortcutsApi | undefined {
  return window.dshDesktop?.shortcuts;
}
