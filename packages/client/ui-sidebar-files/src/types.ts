/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng module và seam mà row ui-sidebar-files dùng (jsx runtime · react · primitive · Remote · slot).
 */

/** Hàm dựng phần tử của jsx runtime — hai hàm này nằm ở §react/jsx-runtime§, KHÔNG có trên namespace react. */
export interface JsxRuntimeLike {
  /** Một phần tử. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Phần tử có nhiều con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Mảnh rời. */
  Fragment: unknown;
}

/** Module react ở mức row này dùng — chỉ hook THẬT có trên namespace react. */
export interface ReactLike {
  /** Tham chiếu bền qua các lần vẽ. */
  useRef<T>(initial: T): { current: T };
  /** Hiệu ứng sau khi vẽ; trả hàm dọn dẹp hoặc undefined. */
  useEffect(effect: () => unknown, deps: unknown[]): void;
  /** Hiệu ứng trước khi trình duyệt vẽ. */
  useLayoutEffect(effect: () => unknown, deps: unknown[]): void;
}

/** Primitive của DSH mà thân tab và tiêu đề tab dùng (nguyên văn tên từ primitive của bản gốc). */
export interface FilesPrimitivesLike {
  /** Hình minh hoạ của thẻ hướng dẫn mở tab. */
  GuideArtworkFiles: unknown;
  /** Biểu tượng thư mục đang mở. */
  IconFolderOpenRegular: unknown;
  /** Biểu tượng thư mục đang đóng. */
  IconFolderCloseRegular: unknown;
  /** Biểu tượng tạm dừng tự làm mới. */
  IconPauseOutlineRegular: unknown;
  /** Biểu tượng bật tự làm mới. */
  IconPlayOutlineRegular: unknown;
  /** Biểu tượng đọc lại. */
  IconRefreshOutlineRegular: unknown;
  /** Biểu tượng theo loại tệp. */
  FileTypeIcon: unknown;
  /** Nhãn đường dẫn (dùng cho gốc workspace). */
  PathLabel: unknown;
  /** Chú thích nổi. */
  Tooltip: unknown;
  /** Phân loại loại tệp theo tên. */
  classifyFileType(name: string): string;
}

/** Một mục trong một mức thư mục. */
export interface FileEntryLike {
  /** Tên (basename) của mục. */
  name: string;
  /** Loại mục: §directory§ · §file§ · loại khác. */
  type: string;
}

/** Một mức thư mục đã đọc xong. */
export interface FileLevelLike {
  /** Các mục của thư mục. */
  entries: FileEntryLike[];
  /** Endpoint có cắt bớt danh sách không. */
  truncated: boolean;
}

/** Lỗi Remote đã settled: mã ổn định + thông điệp. */
export interface RemoteFailureLike {
  /** Mã lỗi ổn định (§workspace-file/not-found§…). */
  code: string;
  /** Thông điệp cho người đọc. */
  message: string;
}

/** Kết quả một lời gọi Remote. */
export type RemoteResultLike<T> = { ok: true; value: T } | { ok: false; error: RemoteFailureLike };

/** Một mục của luồng thay đổi thư mục. */
export interface RemoteStreamItemLike<T> {
  /** Giá trị của mục. */
  value: T;
  /** Nhận mục này (bản gốc gọi cho trạng thái §ready§). */
  accept(): void;
}

/** Luồng của Remote: duyệt được và ngắt được. */
export interface RemoteStreamLike<T> extends AsyncIterable<RemoteStreamItemLike<T>> {
  /** Ngắt luồng. */
  dispose(): void;
}

/** Seam Remote của trang (chỉ phần row này dùng). */
export interface RemoteSeamLike {
  /** Mở một luồng có giám sát theo vòng đời. */
  $stream<T>(spec: {
    /** Tên luồng, dùng trong chẩn đoán. */
    name: string;
    /** Mở luồng theo vòng đời được cấp. */
    open: (lifetime: unknown) => AsyncIterable<RemoteStreamItemLike<T>>;
    /** Lỗi khi luồng kết thúc ngoài ý muốn. */
    ended: () => Error;
  }): RemoteStreamLike<T>;
  /** Namespace tệp của workspace. */
  workspaceFiles: {
    /** Đọc một mức thư mục. */
    list(sessionId: string, path: string, signal: AbortSignal): Promise<RemoteResultLike<FileLevelLike>>;
    /** Theo dõi thay đổi của một thư mục. */
    changes(sessionId: string, path: string, lifetime: unknown): AsyncIterable<RemoteStreamItemLike<{ kind: string }>>;
  };
}

/** Seam khe cắm: §register(spec, Component)§ — component là THAM SỐ THỨ HAI. */
export interface SlotsSeamLike {
  /** Đăng ký một chỗ ngồi vào slot (có thể hoãn). */
  inject(slot: string, register: () => unknown): unknown;
  /** Đăng ký chỗ ngồi với spec và component. */
  register(definition: Record<string, unknown>, component: unknown): unknown;
}

/** Seam từ điển. */
export interface LocaleSeamLike {
  /** Bind một namespace thành hàm t(key, params). */
  bind(namespace: string): (key: string, params?: Record<string, string>) => string;
  /** Đăng ký từ điển của namespace. */
  register(namespace: string, copy: Record<string, Record<string, string>>): unknown;
}

/** Seam bảng phím tắt. */
export interface ShortcutsSeamLike {
  /** Đăng ký một phím tắt. */
  register(definition: Record<string, unknown>): unknown;
}

/** Seam sidebar phải: đích lệnh và mở tab từ đích. */
export interface SidebarRightSeamLike {
  /** Đích lệnh của phần tử đang có focus. */
  commandTarget(element: unknown): { sessionId: string } | undefined;
  /** Mở tab từ một đích. */
  openTabFromTarget(kind: string, target: unknown): void;
}

/** Seam sổ kiểu tab của sidebar phải. */
export interface SidebarRightTabsSeamLike {
  /** Đăng ký một kiểu tab. */
  register(definition: Record<string, unknown>): unknown;
}

/** Context phía browser (chỉ khai phần row này dùng). */
export interface ClientContextLike {
  /** Đăng ký hiệu ứng có thể huỷ. */
  effect(callback: () => unknown, label?: string): unknown;
  /** Chờ một tập service rồi chạy callback trong scope hẹp hơn. */
  inject(dependencies: string[], callback: (ctx: ClientContextLike) => void): void;
  /** Khe cắm. */
  slots: SlotsSeamLike;
  /** Từ điển. */
  locale: LocaleSeamLike;
  /** Bảng phím tắt. */
  shortcuts: ShortcutsSeamLike;
  /** Sidebar phải. */
  sidebarRight: SidebarRightSeamLike;
  /** Sổ kiểu tab của sidebar phải. */
  sidebarRightTabs: SidebarRightTabsSeamLike;
  /** Remote của trang. */
  remote: RemoteSeamLike;
}

/** Hàm require do bảng module của trang cấp cho factory. */
export type RequireFn = (id: string) => unknown;
