/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Giao diện giữa hai nửa của row ui-settings-general: thứ plugin.ts cấp cho 7 file UI.
 *   11/11/2026 — bổ sung `react` (useState cho busy/lỗi của công tắc) và `developerTools.setEnabled`
 *   — đường GHI mà công tắc "Công cụ lập trình" thiếu hẳn (nguyên nhân công tắc vô hiệu).
 */

import type { SettingsShellStore } from "./settings-store.ts";
/** Nửa runtime JSX tối thiểu mà row cần (bản gốc lấy từ react/jsx-runtime). */
export interface JsxRuntimeLike {
  /** Tạo một phần tử JSX. */
  jsx: (type: unknown, props: unknown) => unknown;
  /** Tạo phần tử JSX nhiều con. */
  jsxs: (type: unknown, props: unknown) => unknown;
  /** Mảnh rỗng. */
  Fragment: unknown;
}

/** Phần tài liệu settings mà nút "Mở tệp cấu hình" đọc (Host báo có tệp cục bộ hay không). */
export interface DocumentMirrorView {
  /** Host có tệp cấu hình cục bộ cho profile này. */
  hasDocument?: boolean;
}

/** Ảnh chụp mirror tài liệu settings — hình dạng gói ui-settings cấp qua `describe()`. */
export interface DocumentMirrorSnapshot {
  /** Trạng thái mirror: idle (chưa đọc) · loading · ready. */
  status?: "idle" | "loading" | "ready";
  /** Tài liệu Host trả về (vắng khi chưa có lần đọc thành công). */
  view?: DocumentMirrorView;
  /** Thông báo lỗi của lần đọc gần nhất. */
  error?: string | null;
}

/** Bề mặt `describe()` của mirror dùng chung mà gói ui-settings cấp. */
export interface DescribeFace {
  /** Ảnh chụp hiện tại (tham chiếu ổn định cho tới lần đổi kế tiếp). */
  getSnapshot(): DocumentMirrorSnapshot;
  /** Theo dõi mỗi lần ảnh chụp đổi; trả hàm huỷ đăng ký. */
  subscribe(listener: () => void): () => void;
  /** Bảo đảm đã có câu trả lời từ Host (đọc nếu còn idle). */
  ensure(): Promise<void>;
}

/** Kết quả lệnh mở tệp cấu hình của Host (`settings/openSettingsDocument`). */
export type DocumentOpenReply = { ok: true; value?: unknown } | { ok: false; error?: { message?: string } };

/**
 * Seam `remote` mà nút mở tệp cấu hình dùng — ĐÚNG hai mục bản gốc đọc:
 * `$host.isLoopback` (chỉ bản cài cục bộ mới có tệp) và `settings.openSettingsDocument`.
 */
export interface RemoteSeam {
  /** Sự kiện Host của trang (isLoopback cố định suốt vòng đời trang). */
  $host?: { isLoopback?: boolean };
  /** Namespace settings sinh ra từ api-remotes. */
  settings?: { openSettingsDocument?: () => Promise<DocumentOpenReply> };
}

/** Bề mặt `configForms` mà row đọc (service do gói ui-settings cấp). */
export interface ConfigFormsSurface {
  /** Mô tả tài liệu settings dùng chung (mirror + `hasDocument`). */
  describe(): DescribeFace;
  /**
   * Ưu tiên công cụ phát triển — consumer phải có để không ném khi Host chưa trả lời.
   * `setEnabled` là ĐƯỜNG GHI: thiếu nó thì công tắc trong Cài đặt → Chung bấm không có tác dụng
   * (sự cố 11/11/2026). Nguồn thật: DeveloperToolsPreference.setEnabled của gói ui-settings.
   */
  developerTools: {
    enabled: { getSnapshot(): boolean; subscribe(listener: () => void): () => void };
    setEnabled(enabled: boolean): void | Promise<void>;
  };
}

/** Store dựng ở store.ts, cấp cho mọi file UI qua deps. */
export interface GeneralStore {
  /** Nguồn trạng thái cập nhật Desktop. */
  desktopUpdate: unknown;
  /** Nguồn trạng thái kết nối realtime. */
  connectionState: unknown;
  /** Danh mục phím tắt (đã resolve từ ctx.shortcuts.catalog). */
  shortcuts: unknown;
  /** Nguồn bật/tắt công cụ phát triển. */
  developerTools: unknown;
}

/** Móc React tối thiểu mà row cần (chỉ ô trạng thái cục bộ cho busy/lỗi của công tắc). */
export interface ReactStateLike {
  /**
   * Tạo một ô trạng thái cục bộ.
   * Nhận: giá trị khởi tạo.
   * Trả: [giá trị hiện tại, hàm đặt giá trị].
   */
  useState<T>(initial: T): [T, (next: T) => void];
}

/**
 * Thứ mà plugin.ts cấp cho mỗi file UI.
 *
 * LUẬT: file UI KHÔNG được gọi `ctx.get(...)`, `requireFn`, `ctx.locale` hay tự đọc `configForms` —
 * mọi thứ đi qua deps này. Nhờ vậy nửa UI viết được mà không cần biết cordis/slots.
 */
export interface GeneralDeps {
  /** Runtime JSX. */
  runtime: JsxRuntimeLike;
  /**
   * Móc React (useState) — bản gốc dùng cho busy/failed của hàng công cụ lập trình.
   * plugin.ts cấp shim "không trạng thái" khi module react vắng (khuôn #5: hàng vẫn ghi được, chỉ mất busy).
   */
  react: ReactStateLike;
  /**
   * `createPortal` của react-dom (nếu môi trường có) — panel Settings phải gắn vào `document.body`.
   * Vắng thì panel vẫn vẽ tại chỗ (ghi rõ, KHÔNG im lặng bỏ panel).
   */
  portal?: (node: unknown, container: unknown) => unknown;
  /** Store của ghế `sidebar.settings` — CÙNG thể hiện với `store:` trong đăng ký slot (LUẬT 8). */
  settingsStore: SettingsShellStore;
  /** Bộ primitive dùng chung của DSH. */
  primitives: unknown;
  /** Store đã dựng. */
  store: GeneralStore;
  /** Hàm dịch đã bind namespace của row. */
  locale: (key: string) => string;
  /** Bề mặt configForms đã kiểm đủ thuộc tính. */
  configForms: ConfigFormsSurface;
  /** Danh mục phím tắt. */
  shortcuts: unknown;
}

/** Một file UI export đúng một hàm dựng theo chữ ký này. */
export type ComponentFactory = (deps: GeneralDeps) => unknown;
