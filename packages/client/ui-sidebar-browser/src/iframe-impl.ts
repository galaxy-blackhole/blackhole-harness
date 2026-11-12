/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nha cung cap dieu huong bang iframe voi lich su ung dung biet co gioi han
 */

import { emptyBrowserFrame, type BrowserFrame, type BrowserFrameState, type BrowserLoadError, type BrowserSandboxControl } from "./frame.ts";
import { BrowserNavigation } from "./navigation.ts";
import type { BrowserPageOptions } from "./page.ts";
import type { SnapshotStoreLike } from "./types.ts";
import type { BrowserTarget } from "./url.ts";
import type { IframePresentation } from "./view/iframe-presentation.ts";

/** So huu dieu huong iframe; view bao lan tai ma khong doc noi dung khac nguon. */
export class IframeImpl implements BrowserFrame {
  /** Checkpoint ban dau va nguon ghi luu tru. */
  private readonly options: BrowserPageOptions;
  /** Lop trinh bay DOM cua iframe. */
  private readonly presentation: IframePresentation;
  /** Dieu khien sandbox nhung (luon co voi carrier nay). */
  readonly sandbox: BrowserSandboxControl;
  /** Lich su ung dung biet. */
  private readonly navigation: BrowserNavigation;
  /** Store trang thai khung. */
  private readonly store: SnapshotStoreLike<BrowserFrameState>;
  /** Sandbox nhung dang bat hay khong. */
  private sandboxed = true;
  /** Loi tai gan nhat. */
  private error: BrowserLoadError | undefined;
  /** Da dispose chua. */
  private disposed = false;
  /** Lan dispose dau tien. */
  private disposal: Promise<void> | undefined;

  /**
  * Dung nha cung cap iframe.
  * Nhan: options — checkpoint ban dau va nguon ghi luu tru; presentation — lop trinh bay DOM;
  *        createStore — ham store anh chup cua bang module.
  */
  constructor(
    options: BrowserPageOptions,
    presentation: IframePresentation,
    createStore: <T>(initial: T) => SnapshotStoreLike<T>,
  ) {
    this.options = options;
    this.presentation = presentation;
    this.navigation = new BrowserNavigation(options.initial);
    this.store = createStore<BrowserFrameState>({ ...emptyBrowserFrame(), sandboxEnabled: this.sandboxed });
    this.sandbox = {
      /** Bat/tat sandbox nhung cua carrier nay. */
      setEnabled: (enabled: boolean): void => {
        this.setSandbox(enabled);
      },
    };
  }

  /**
  * Ghi nhan mot lan tai co kiem soat, hoac mot lan dieu huong sau do den dia chi khong doc duoc.
  * Nhan: revision — the he tai lieu da phat su kien load.
  * Tra: khong co.
  */
  handleLoaded(revision: number): void {
    if (this.disposed) return;
    this.navigation.frameLoaded(revision);
    this.publish();
  }

  /**
  * Cong bo that bai chi cho the he tai lieu hien tai.
  * Nhan: revision — the he tai lieu da bao loi.
  * Tra: khong co.
  */
  handleLoadFailed(revision: number): void {
    if (this.disposed || this.navigation.snapshot.request?.revision !== revision) return;
    this.error = { code: undefined, description: undefined };
    this.publish();
  }

  /** Lay anh chup trang thai dieu huong bat bien. */
  getSnapshot = (): BrowserFrameState => this.store.getSnapshot();

  /**
  * Theo doi thay doi trang thai khung.
  * Nhan: listener — ham duoc goi khi trang thai doi.
  * Tra: ham huy theo doi.
  */
  subscribe = (listener: () => void): (() => void) => this.store.subscribe(listener);

  /**
  * Tai mot dia chi da kiem; nop lai chinh dia chi hien tai la tai lai.
  * Nhan: target — dich da chuan hoa.
  * Tra: khong co.
  */
  loadUrl(target: BrowserTarget): void {
    if (this.disposed) return;
    const request = BrowserNavigation.current(this.navigation.snapshot)?.url === target.url
      ? this.navigation.reload()
      : this.navigation.navigate(target);
    this.load(request);
  }

  /** Lui trong lich su ung dung biet khi dia chi iframe con doc duoc. */
  goBack(): void {
    if (!this.disposed) this.load(this.navigation.back());
  }

  /** Tien trong lich su ung dung biet khi dia chi iframe con doc duoc. */
  goForward(): void {
    if (!this.disposed) this.load(this.navigation.forward());
  }

  /** Tai lai dia chi ung dung biet sau cung. */
  reload(): void {
    if (!this.disposed) this.load(this.navigation.reload());
  }

  /**
  * Don lop trinh bay; cac lan goi sau noi vao cung mot lan don.
  * Nhan: khong co.
  * Tra: sau khi lop trinh bay da duoc go.
  */
  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal;
    this.disposed = true;
    this.presentation.dispose();
    this.disposal = Promise.resolve();
    return this.disposal;
  }

  /**
  * Doi chinh sach sandbox nhung; chua co trang thi chi cong bo co, co trang thi tai lai.
  * Nhan: enabled — co bat sandbox khong.
  * Tra: khong co.
  */
  private setSandbox(enabled: boolean): void {
    if (this.disposed || enabled === this.sandboxed) return;
    this.sandboxed = enabled;
    if (this.store.getSnapshot().target === undefined) {
      this.store.set({ ...this.store.getSnapshot(), sandboxEnabled: enabled });
      return;
    }
    this.load(this.navigation.reload());
  }

  /**
  * Phat mot yeu cau tai ra lop trinh bay va cong bo trang thai.
  * Nhan: request — yeu cau tai, hoac undefined khi khong co gi de tai.
  * Tra: khong co.
  */
  private load(request: { revision: number; target: BrowserTarget } | undefined): void {
    if (request === undefined) return;
    this.error = undefined;
    this.publish();
    this.presentation.show({ target: request.target, revision: request.revision, sandboxed: this.sandboxed });
  }

  /** Dung anh chup khung tu trang thai dieu huong hien tai. */
  private snapshot(): BrowserFrameState {
    const state = this.navigation.snapshot;
    const target = BrowserNavigation.current(state);
    return {
      target,
      address: target === undefined ? "empty" : state.navigation.status === "unknown" ? "unknown" : "requested",
      loading: state.navigation.status === "loading" && this.error === undefined,
      canGoBack: this.navigation.canGoBack,
      canGoForward: this.navigation.canGoForward,
      error: this.error,
      sandboxEnabled: this.sandboxed,
    };
  }

  /** Cong bo anh chup khung va checkpoint cho nguon ghi luu tru. */
  private publish(): void {
    this.store.set(this.snapshot());
    this.options.persist(this.navigation.snapshot);
  }
}
