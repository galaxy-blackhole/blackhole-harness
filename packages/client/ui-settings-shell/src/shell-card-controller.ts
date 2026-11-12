/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cầu nối form của một entry shell executor (bash-sandbox/pwsh-sandbox) lên form đang soạn của trang
 */

/** Id entry profile của shell executor POSIX (bundle nền ghép nó khi KHÔNG phải Windows). */
export const BASH_NS = "bash-sandbox";

/** Id entry profile của shell executor PowerShell (bundle nền ghép nó trên Windows). */
export const PWSH_NS = "pwsh-sandbox";

/** Hai trường của shell executor mà trang này sửa — cố ý chỉ là một TẬP CON của schema Host phục vụ. */
export interface ShellSettings {
  /** Thời gian chạy tối đa của một lệnh, mili giây. */
  timeoutMs?: number;
  /** Trần dung lượng ghi ra mỗi luồng, byte. */
  maxOutputBytes?: number;
}

/** Store ảnh chụp tối thiểu mà ui-primitives cấp (chỉ khai phần row này dùng). */
export interface SnapshotStoreLike<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot(): T;
}

/** Mô hình form cài đặt của ui-primitives (chỉ khai phần row này dùng). */
export interface FormModelLike {
  /** Phần khung form dùng chung (writable, readOnly, dirty...). */
  shell(): Record<string, unknown>;
  /** Trạng thái một trường đã khai báo. */
  field(name: string): unknown;
  /** Buộc store phát lại theo hàm chiếu. */
  bind(projection: () => Record<string, unknown>): SnapshotStoreLike<Record<string, unknown>>;
  /** Hành động của form (save, discard...). */
  actions(): Record<string, unknown>;
  /** Huỷ đăng ký của form. */
  dispose(): void;
}

/** Module ui-primitives do bảng module cấp trong browser (chỉ khai phần row này dùng). */
export interface PrimitivesModule {
  /** Tạo mô hình form trên một scope cấu hình. */
  SettingsFormModel: new (scope: unknown, fields: unknown[]) => FormModelLike;
  /** Khai một trường số của schema. */
  settingsNumberField: (name: string) => unknown;
}

/** Mặt mà mục slot của trang này bơm cho renderer. */
export interface ShellCardFaceLike {
  /** Store ảnh chụp mà renderer gắn thành useShellCard. */
  hooks: { shellCard: SnapshotStoreLike<Record<string, unknown>> };
}

/** Cầu nối một entry shell executor lên form đang soạn của trang. */
export interface ShellCardControllerLike {
  /** Dựng mặt mà đăng ký slot bơm cho renderer. */
  inject(): ShellCardFaceLike;
  /** Huỷ đăng ký của form. */
  dispose(): void;
}

/**
 * Bọc một scope cấu hình của shell executor thành cầu nối form của trang.
 * Nhận: module ui-primitives do bảng module cấp và scope cấu hình của entry (bash hoặc pwsh).
 * Trả: đối tượng có inject() (mặt cho renderer) và dispose() (huỷ đăng ký).
 */
export function createShellCardController(primitives: PrimitivesModule, scope: unknown): ShellCardControllerLike {
  const form = new primitives.SettingsFormModel(scope, [
    primitives.settingsNumberField("timeoutMs"),
    primitives.settingsNumberField("maxOutputBytes"),
  ]);
  const store = form.bind(() => ({
    ...form.shell(),
    timeoutMs: form.field("timeoutMs"),
    maxOutputBytes: form.field("maxOutputBytes"),
  }));
  return {
    inject: () => ({ hooks: { shellCard: store }, ...form.actions() }),
    dispose: () => {
      form.dispose();
    },
  };
}
