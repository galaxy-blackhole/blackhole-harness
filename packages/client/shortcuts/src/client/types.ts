/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Be mat ma tinh nang khac dung: lenh · ngu canh · danh muc · service \`shortcuts\`
 */

import type {
  BindingIssue,
  NormalizedBinding,
  ShortcutBinding,
  ShortcutCommandId,
  ShortcutConfigSnapshot,
  ShortcutEdit,
  ShortcutPlatform,
  ShortcutProfile,
  ShortcutRevision,
  ShortcutRuntime,
  ShortcutSaveResult,
} from "../protocol.ts";

/** Chủ sở hữu nhập liệu cục bộ, được xác định TRƯỚC khi chạy lệnh của ứng dụng. */
export type ShortcutRegion = "page" | "editable" | "terminal";

/** Ngữ cảnh DOM đồng bộ; chủ lệnh tự bắt mục tiêu nghiệp vụ trong `resolve()`. */
export interface ShortcutContext {
  /** Nguồn phát sinh. */
  readonly source?: "keyboard" | "menu" | "iframe" | "webview";
  /** Vùng nhập liệu đang giữ phím. */
  readonly region: ShortcutRegion;
  /** Id modal đang mở, hoặc null. */
  readonly modal: string | null;
  /** Phần tử nhập liệu gốc, hoặc null khi không có mục tiêu tài liệu. */
  readonly target: Element | null;
}

/** Hành động đã giải xong thì giữ luôn mục tiêu; thất bại vẫn là trách nhiệm của chủ lệnh. */
export type ShortcutResolution =
  | { readonly status: "handled"; run(): void }
  | { readonly status: "blocked"; reason: string }
  | { readonly status: "pass" };

/** Nhãn, mặc định, vùng sở hữu nhập liệu và hàm giải mục tiêu của MỘT lệnh. */
export interface ShortcutCommand {
  /** Id lệnh. */
  readonly id: ShortcutCommandId;
  /** Nhãn đã bản địa hoá (gọi lại mỗi lần đổi ngôn ngữ). */
  readonly label: () => string;
  /** Tên gọi khác để tìm kiếm. */
  readonly aliases: readonly string[];
  /** Mặc định theo hồ sơ. */
  readonly defaults: Readonly<Partial<Record<ShortcutProfile, ShortcutBinding>>>;
  /** Vùng nào được nhận lệnh này. */
  readonly regions: readonly ShortcutRegion[];
  /** Các id modal được phép (bàn phím Web/Linux và menu tường minh). */
  readonly modals: readonly string[];
  /**
   * Giải một lần gõ phím thành hành động.
   * Nhận: `context` — ngữ cảnh đồng bộ.
   * Trả: đã xử lý / bị chặn kèm lý do / bỏ qua.
   */
  resolve(context: ShortcutContext): ShortcutResolution;
}

/** Một dòng danh mục dạng JSON, dùng chung cho tham chiếu, tooltip và điều khiển. */
export interface ShortcutCatalogEntry {
  /** Id lệnh. */
  readonly id: ShortcutCommandId;
  /** Nhãn đã bản địa hoá. */
  readonly label: string;
  /** Tên gọi khác. */
  readonly aliases: readonly string[];
  /** Keycap hiển thị. */
  readonly keys: readonly string[];
  /** Chuỗi ARIA, hoặc undefined khi không có/hợp âm. */
  readonly aria: string | undefined;
  /** Binding hiệu lực. */
  readonly binding: NormalizedBinding | null;
  /** Người dùng đã ghi đè hay chưa. */
  readonly modified: boolean;
  /** Các lệnh đang xung đột. */
  readonly conflicts: readonly ShortcutCommandId[];
  /** Lý do từ chối. */
  readonly issue: BindingIssue | null;
}

/** Dữ liệu một lần gõ phím đã qua bộ chuyển, khi tổ hợp và mức tiêu thụ cục bộ đã giải xong. */
export interface ShortcutGesture {
  /** Mã phím vật lý. */
  readonly code: string;
  /** Phím thứ hai đang được giữ cùng `code`. */
  readonly secondCode?: string;
  /** Trạng thái các phím bổ trợ. */
  readonly control: boolean;
  /** Alt. */
  readonly alt: boolean;
  /** Shift. */
  readonly shift: boolean;
  /** Meta. */
  readonly meta: boolean;
  /** Phím tự động lặp. */
  readonly repeat: boolean;
  /** Đang gõ bộ gõ tiếng (IME). */
  readonly composing: boolean;
  /** Sự kiện đã bị chặn trước đó. */
  readonly defaultPrevented: boolean;
}

/** Nhập liệu CỐ ĐỊNH cục bộ, giao sau khi bộ điều khiển cục bộ xử lý, hoặc một tương tác làm mất hiệu lực chuỗi. */
export type ShortcutFixedInput =
  | {
      readonly type: "keydown";
      /** Dữ liệu lần gõ. */
      readonly gesture: ShortcutGesture;
      /** Ngữ cảnh đồng bộ. */
      readonly context: ShortcutContext;
      /** Đánh dấu đã tiêu thụ lần gõ này. */
      consume(): void;
    }
  | { readonly type: "reset" };

/** Hành động chỉ-đọc được tính năng đóng góp khi nó đang được mount. */
export interface ShortcutFixedCommand {
  /** Id lệnh. */
  readonly id: ShortcutCommandId;
  /** Nhãn đã bản địa hoá. */
  readonly label: () => string;
  /** Keycap hiển thị. */
  readonly keys: readonly string[];
  /** Một hay nhiều tổ hợp vật lý mà hành động này giữ chỗ (kể cả từng bước của chuỗi). */
  readonly bindings: readonly [ShortcutBinding, ...ShortcutBinding[]];
  /** Nhóm hiển thị. */
  readonly group: "application" | "input" | "menus" | "approval";
}

/** Dòng danh mục cố định đã bản địa hoá; chuỗi phím của nó KHÔNG sửa được. */
export interface ShortcutFixedCatalogEntry {
  /** Id lệnh. */
  readonly id: ShortcutCommandId;
  /** Nhãn đã bản địa hoá. */
  readonly label: string;
  /** Keycap hiển thị. */
  readonly keys: readonly string[];
  /** Các tổ hợp đã chuẩn hoá. */
  readonly bindings: readonly NormalizedBinding[];
  /** Nhóm hiển thị. */
  readonly group: ShortcutFixedCommand["group"];
}

/** Bản chụp chỉ-đọc mà renderer theo dõi. */
export interface ObservableSnapshot<T> {
  /**
   * Đọc giá trị hiện tại.
   * Nhận: không.
   * Trả: giá trị.
   */
  getSnapshot(): T;
  /**
   * Theo dõi thay đổi.
   * Nhận: `listener` — hàm nghe.
   * Trả: hàm gỡ.
   */
  subscribe(listener: () => void): () => void;
}

/** Kho có thể đặt giá trị (seam `client-store`). */
export interface SnapshotStore<T> extends ObservableSnapshot<T> {
  /**
   * Đặt giá trị mới.
   * Nhận: `value` — giá trị mới.
   * Trả: không.
   */
  set(value: T): void;
}

/** Sổ đăng ký bàn phím mà tính năng dùng. */
export interface Shortcuts {
  /** Vỏ ứng dụng. */
  readonly runtime: ShortcutRuntime;
  /** Thiết bị nhận phím. */
  readonly platform: ShortcutPlatform;
  /** Danh mục lệnh sửa được. */
  readonly catalog: ObservableSnapshot<readonly ShortcutCatalogEntry[]>;
  /** Tuy chọn đã nhận + chẩn đoán đọc. */
  readonly config: ObservableSnapshot<ShortcutConfigSnapshot>;
  /** Danh mục hành động cố định đang được mount. */
  readonly fixedCatalog: ObservableSnapshot<readonly ShortcutFixedCatalogEntry[]>;
  /** Thời gian giữa hai lần Escape liên tiếp (ms). */
  readonly stopSequenceMs: number;
  /**
   * Đóng góp một hành động cố định và giữ chỗ phím của nó trước binding sửa được.
   * Nhận: `command` — tên đã bản địa hoá, nhóm, keycap và các tổ hợp giữ chỗ.
   * Trả: hàm gỡ (gọi lại vô hại).
   */
  registerFixed(command: ShortcutFixedCommand): () => void;
  /**
   * Theo dõi nhập liệu đã phân xử cục bộ và các lần reset chuỗi cố định.
   * Nhận: `listener` — hàm của chủ sở hữu.
   * Trả: hàm gỡ.
   */
  observeFixedInput(listener: (input: ShortcutFixedInput) => void): () => void;
  /**
   * Mô tả một ứng viên theo quy tắc phím vật lý và giữ chỗ của thiết bị; mã sai thì ném lỗi.
   * Nhận: `binding` — tổ hợp ứng viên, hoặc null khi chưa gán.
   * Trả: binding chuẩn hoá, keycap, lý do từ chối và các lệnh đang chồng.
   */
  describeBinding(binding: ShortcutBinding | null): {
    binding: NormalizedBinding | null;
    keys: readonly string[];
    issue: BindingIssue | null;
    conflicts: readonly ShortcutCommandId[];
  };
  /**
   * Lưu một lần sửa đã được người dùng xem; hỏng thì giữ nguyên cả tuy chọn đã nhận lẫn bản nháp.
   * Nhận: `edit` — thao tác, `revision` — revision đã xem.
   * Trả: kết quả lưu và tuy chọn hiện tại.
   */
  edit(edit: ShortcutEdit, revision: ShortcutRevision): Promise<ShortcutSaveResult>;
  /**
   * Chặn accelerator của menu native khi lớp ghi phím đang giữ nhập liệu.
   * Nhận: `active` — lớp ghi có đang bật.
   * Trả: xong khi tầng native xác nhận.
   */
  recording(active: boolean): Promise<void>;
  /**
   * Yêu cầu đóng cửa sổ Desktop theo revision hiện tại.
   * Nhận: không.
   * Trả: xong khi IPC hoàn tất.
   */
  closeWindow(): Promise<void>;
  /**
   * Đăng ký một lệnh; id trùng hoặc mặc định chồng nhau thì ném lỗi.
   * Nhận: `command` — nhãn, mặc định và hàm giải mục tiêu của tính năng.
   * Trả: hàm gỡ (gọi lại vô hại).
   */
  register(command: ShortcutCommand): () => void;
}
