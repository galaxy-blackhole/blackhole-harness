/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Lenh tab doc lap carrier va trang thai phuc vu renderer cua trinh duyet sidebar phai
 */

import { currentBrowserTarget, type BrowserTabState } from "./persistence.ts";
import { parseBrowserAddress, type BrowserAddressFailure, type BrowserTarget } from "./url.ts";
import type { BrowserFrameState } from "./frame.ts";
import type { BrowserPage, BrowserPageFactory } from "./page.ts";
import type { BrowserActionsLike, ObservableLike, SnapshotStoreLike } from "./types.ts";

/** Trang thai tab dang song; dieu huong den tu nha cung cap, kiem tra ban nhap o lai cuc bo. */
export interface BrowserControllerState {
  /** Trang thai khung. */
  readonly frame: BrowserFrameState;
  /** Dia chi da luu duoc moi khoi phuc truoc khi co trang nao duoc yeu cau. */
  readonly restoreTarget: BrowserTarget | undefined;
  /** Ly do tu choi dia chi gan nhat. */
  readonly addressFailure: BrowserAddressFailure | undefined;
  /** The he ban nhap dia chi (doi moi khi lenh chay). */
  readonly addressRevision: number;
}

/** Dau vao dung mot lan xuat hien tab. */
export interface BrowserControllerOptions {
  /** Id tab trong phien. */
  readonly tabId: string;
  /** Vong doi cua tab. */
  readonly signal: AbortSignal;
  /** Goc tai lieu cua ung dung (chan mo chinh ung dung). */
  readonly applicationOrigin: string;
  /** Checkpoint da luu. */
  readonly initial: BrowserTabState | undefined;
  /** Ghi checkpoint theo pham vi phien. */
  readonly actions: BrowserActionsLike;
  /** Nha cung cap trang do composition chon. */
  readonly createPage: BrowserPageFactory;
  /** Mo mot dia chi ra tab khac cung phien. */
  readonly openTab: (url: string) => void;
  /** Ham `createSnapshotStore` cua @galaxy-blackhole/gbh-client-store. */
  readonly createStore: <T>(initial: T) => SnapshotStoreLike<T>;
}

/** So huu viec kiem tra dau vao va vong doi trang ma khong can biet loai carrier. */
export class BrowserController implements ObservableLike<BrowserControllerState> {
  /** Dau vao dung. */
  private readonly options: BrowserControllerOptions;
  /** Nha cung cap trang. */
  private readonly page: BrowserPage;
  /** Store anh chup phuc vu giao dien. */
  private readonly store: SnapshotStoreLike<BrowserControllerState>;
  /** Huy theo doi khung. */
  private readonly unsubscribe: () => void;
  /** Nguon ghi checkpoint hien tai. */
  private actions: BrowserActionsLike;
  /** Checkpoint dang giu trong bo nho. */
  private checkpoint: BrowserTabState | undefined;
  /** Da tieu thu dieu huong dau tien chua. */
  private started = false;
  /** Da dispose chua. */
  private disposed = false;
  /** Lan dispose dau tien (cac lan sau noi vao cung mot promise). */
  private disposal: Promise<void> | undefined;
  /** Ham huy gan vao tin hieu cua tab. */
  private readonly abort = (): void => {
    void this.dispose();
  };

  /**
  * Dung controller cho mot lan xuat hien tab.
  * Nhan: options — dinh danh, luu tru, nha cung cap trang va dieu huong nguon.
  */
  constructor(options: BrowserControllerOptions) {
    this.options = options;
    this.actions = options.actions;
    this.checkpoint = options.initial;
    this.page = options.createPage({
      initial: options.initial,
      persist: (state: BrowserTabState): void => {
        if (this.disposed) return;
        this.checkpoint = state;
        this.actions.replace(options.tabId, state);
      },
      openRequested: (value: string): void => {
        if (this.disposed) return;
        const result = parseBrowserAddress(value, options.applicationOrigin);
        if (!result.ok) {
          this.addressFailed(result.reason);
          return;
        }
        options.openTab(result.target.url);
      },
    });
    this.store = options.createStore<BrowserControllerState>({
      frame: this.page.frame.getSnapshot(),
      restoreTarget: currentBrowserTarget(this.checkpoint),
      addressFailure: undefined,
      addressRevision: 0,
    });
    this.unsubscribe = this.page.frame.subscribe(() => {
      if (this.disposed) return;
      const current = this.store.getSnapshot();
      const frame = this.page.frame.getSnapshot();
      const changed = frame.target?.url !== current.frame.target?.url;
      this.store.set({
        frame,
        restoreTarget: frame.target === undefined ? currentBrowserTarget(this.checkpoint) : undefined,
        addressFailure: changed ? undefined : current.addressFailure,
        addressRevision: current.addressRevision + Number(changed),
      });
    });
    options.signal.addEventListener("abort", this.abort, { once: true });
  }

  /** Lay anh chup bat bien cho thanh cong cu chung. */
  getSnapshot = (): BrowserControllerState => this.store.getSnapshot();

  /**
  * Theo doi thay doi trang thai.
  * Nhan: listener — ham duoc goi khi trang thai doi.
  * Tra: ham huy theo doi.
  */
  subscribe = (listener: () => void): (() => void) => this.store.subscribe(listener);

  /**
  * Gan trang ma khong chuyen quyen so huu lan xuat hien tab.
  * Nhan: viewportId — vung noi dung da gan.
  * Tra: ham don dep phan gan vat ly.
  */
  mount(viewportId: string): () => void {
    this.publishSaved();
    return this.page.presentation.mount(viewportId);
  }

  /**
  * Tieu thu dieu huong dau tien dung mot lan; checkpoint da luu khong tu khoi dong trang.
  * Nhan: initialUrl — dia chi mo bang lenh, hoac vang mat.
  * Tra: khong co.
  */
  start(initialUrl: string | undefined): void {
    if (this.started || this.disposed) return;
    this.started = true;
    if (initialUrl !== undefined) this.loadUrl(initialUrl);
  }

  /** Khoi phuc dia chi da luu chi sau mot thao tac khoi phuc tuong minh. */
  restore(): void {
    const target = this.store.getSnapshot().restoreTarget;
    if (target !== undefined) this.loadUrl(target.url);
  }

  /**
  * Kiem mot dia chi truoc khi dieu huong, cong bo dau vao sai de sua.
  * Nhan: value — gia tri o dia chi hoac dia chi mo bang lenh.
  * Tra: khong co.
  */
  loadUrl(value: string): void {
    if (this.disposed) return;
    const parsed = parseBrowserAddress(value, this.options.applicationOrigin);
    if (!parsed.ok) {
      this.addressFailed(parsed.reason);
      return;
    }
    this.command(() => {
      this.page.frame.loadUrl(parsed.target);
    });
  }

  /** Uy quyen nut lui cho nha cung cap dieu huong cua trang. */
  goBack(): void {
    this.command(() => {
      this.page.frame.goBack();
    });
  }

  /** Uy quyen nut tien cho nha cung cap dieu huong cua trang. */
  goForward(): void {
    this.command(() => {
      this.page.frame.goForward();
    });
  }

  /** Khoi phuc dia chi da luu, hoac tai lai trang da yeu cau. */
  reload(): void {
    if (this.store.getSnapshot().restoreTarget !== undefined) this.restore();
    else {
      this.command(() => {
        this.page.frame.reload();
      });
    }
  }

  /**
  * Ap dung dieu khien sandbox nhung tuy chon; nha cung cap khong ho tro giu nguyen.
  * Nhan: enabled — co bat sandbox nhung cua nha cung cap khong.
  * Tra: khong co.
  */
  setSandbox(enabled: boolean): void {
    const sandbox = this.page.frame.sandbox;
    if (sandbox !== undefined) {
      this.command(() => {
        sandbox.setEnabled(enabled);
      });
    }
  }

  /**
  * Chuyen cac lan ghi checkpoint sau nay sang mot rang buoc Phien thay the.
  * Nhan: actions — nguon ghi luu tru thay the.
  * Tra: khong co.
  */
  rebind(actions: BrowserActionsLike): void {
    this.actions = actions;
  }

  /**
  * Giai phong trang va go cac listener cua lan xuat hien va trang thai.
  * Nhan: khong co.
  * Tra: sau khi don trang xong; cac lan goi sau noi vao cung mot lan don.
  */
  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal;
    this.disposed = true;
    this.options.signal.removeEventListener("abort", this.abort);
    this.unsubscribe();
    this.disposal = this.page.frame.dispose();
    return this.disposal;
  }

  /** Cong bo checkpoint da luu khi trang vua duoc gan. */
  private publishSaved(): void {
    if (this.checkpoint !== undefined) this.actions.replace(this.options.tabId, this.checkpoint);
  }

  /**
  * Cong bo ly do tu choi dia chi de giao dien sua lai.
  * Nhan: reason — ly do tu choi.
  * Tra: khong co.
  */
  private addressFailed(reason: BrowserAddressFailure): void {
    this.store.set({ ...this.store.getSnapshot(), addressFailure: reason });
  }

  /**
  * Xoa loi dia chi, tang the he ban nhap roi chay lenh.
  * Nhan: run — lenh can chay.
  * Tra: khong co.
  */
  private command(run: () => void): void {
    if (this.disposed) return;
    const current = this.store.getSnapshot();
    this.store.set({ ...current, addressFailure: undefined, addressRevision: current.addressRevision + 1 });
    run();
  }
}
