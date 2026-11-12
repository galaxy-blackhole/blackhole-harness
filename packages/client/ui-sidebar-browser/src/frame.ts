/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dieu huong trang va trang thai quan sat duoc, khong phu thuoc carrier
 */

import type { ObservableLike } from "./types.ts";
import type { BrowserTarget } from "./url.ts";

/** Mot loi tai trang, co the mang chan doan cua trinh duyet ben duoi. */
export interface BrowserLoadError {
  /** Ma loi. */
  readonly code: number | undefined;
  /** Mo ta loi. */
  readonly description: string | undefined;
}

/** Trang thai ma phan khung trinh duyet dung, khong co DOM hay dinh danh carrier. */
export interface BrowserFrameState {
  /** Dich dang mo. */
  readonly target: BrowserTarget | undefined;
  /** Muc do biet ve dia chi hien tai. */
  readonly address: "empty" | "requested" | "observed" | "unknown";
  /** Trang dang tai. */
  readonly loading: boolean;
  /** Co the lui. */
  readonly canGoBack: boolean;
  /** Co the tien. */
  readonly canGoForward: boolean;
  /** Loi tai gan nhat. */
  readonly error: BrowserLoadError | undefined;
  /** Undefined khi nha cung cap nay khong phoi dieu khien sandbox. */
  readonly sandboxEnabled: boolean | undefined;
}

/** Dieu khien chinh sach iframe tuy chon, khong phai cong tac sandbox tien trinh Electron. */
export interface BrowserSandboxControl {
  /** Bat/tat sandbox nhung cua nha cung cap. */
  setEnabled(enabled: boolean): void;
}

/** Dieu huong so huu vong doi trang; gan va an thuoc ve BrowserPresentation. */
export interface BrowserFrame extends ObservableLike<BrowserFrameState> {
  /** Dieu khien sandbox neu nha cung cap co. */
  readonly sandbox?: BrowserSandboxControl;
  /** Tai mot dia chi da kiem. */
  loadUrl(target: BrowserTarget): void;
  /** Lui khi nha cung cap bao co muc truoc. */
  goBack(): void;
  /** Tien khi nha cung cap bao co muc sau. */
  goForward(): void;
  /** Tai lai dia chi hien tai ma khong them muc lich su. */
  reload(): void;
  /** Giai phong trang, listener va khoi tao dang cho. */
  dispose(): Promise<void>;
}

/**
 * Tao trang thai dieu huong nghi, chua co dich.
 * Nhan: khong co.
 * Tra: trang thai truoc khi co yeu cau tai nao.
 */
export function emptyBrowserFrame(): BrowserFrameState {
  return {
    target: undefined,
    address: "empty",
    loading: false,
    canGoBack: false,
    canGoForward: false,
    error: undefined,
    sandboxEnabled: undefined,
  };
}
