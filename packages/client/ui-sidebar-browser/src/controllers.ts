/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Giu cac controller theo lan xuat hien tab sau cac callback pham vi Phien cua trinh duyet
 */

import { BrowserController, type BrowserControllerState } from "./controller.ts";
import type { BrowserTabState } from "./persistence.ts";
import type { BrowserPageFactory } from "./page.ts";
import type { BrowserActionsLike, ObservableLike, SnapshotStoreLike } from "./types.ts";

/** Gia tri co duoc sau khi mot than Sidebar da cam ket vung noi dung cua no. */
export interface BrowserMountRequest {
  /** Tab dang gan. */
  readonly tabId: string;
  /** Vong doi cua tab. */
  readonly signal: AbortSignal;
  /** Vung noi dung da cam ket. */
  readonly viewportId: string;
  /** Goc tai lieu cua ung dung. */
  readonly applicationOrigin: string;
  /** Checkpoint da luu cua tab. */
  readonly initial: BrowserTabState | undefined;
  /** Dia chi mo bang lenh, hoac vang mat. */
  readonly initialUrl: string | undefined;
  /** Mo mot dia chi ra tab khac cung phien. */
  readonly openTab: (url: string) => void;
}

/** Callback thuan cua khe cam cong mot nguon trang thai da rang buoc framework, khong phai giao thuc desktop. */
export interface BrowserInjected {
  /** Nguon trang thai theo tab (renderer doi thanh prop `useBrowserState`). */
  readonly keyedHooks: {
    /** Controller cua mot tab, hoac undefined khi tab chua duoc gan. */
    readonly browserState: (key: string) => ObservableLike<BrowserControllerState> | undefined;
  };
  /** Gan tab vao vung noi dung da cam ket. */
  mount(request: BrowserMountRequest): () => void;
  /** Don moi trang da mo. */
  dispose(): Promise<void>;
  /** Doi nguon ghi checkpoint sang rang buoc Phien moi. */
  rebind(actions: BrowserActionsLike): void;
  /** Tai mot dia chi trong mot tab. */
  loadUrl(tabId: string, value: string): void;
  /** Khoi phuc dia chi da luu cua mot tab. */
  restore(tabId: string): void;
  /** Lui trong mot tab. */
  goBack(tabId: string): void;
  /** Tien trong mot tab. */
  goForward(tabId: string): void;
  /** Tai lai hoac khoi phuc trong mot tab. */
  reload(tabId: string): void;
  /** Bat/tat sandbox nhung cua mot tab. */
  setSandbox(tabId: string, enabled: boolean): void;
}

/** Mot controller dang duoc giu kem tin hieu vong doi cua no. */
interface HeldController {
  /** Tin hieu cua tab ma controller nay thuoc ve. */
  readonly signal: AbortSignal;
  /** Controller cua lan xuat hien. */
  readonly controller: BrowserController;
  /** Ham quen tab khi vong doi ket thuc. */
  readonly forget: () => void;
}

/**
 * Giu cac controller theo lan xuat hien tab sau cac callback pham vi Phien.
 * Nhan: actions — nguon ghi trang thai da luu; createPage — nha cung cap do composition chon;
 *        isTabOpen — tab co con trong bo cuc khong; createStore — ham store anh chup cua bang module.
 * Tra: cac callback theo tab.
 */
export function createBrowserControllers(
  actions: BrowserActionsLike,
  createPage: BrowserPageFactory,
  isTabOpen: (tabId: string) => boolean,
  createStore: <T>(initial: T) => SnapshotStoreLike<T>,
): BrowserInjected {
  let currentActions = actions;
  const controllers = new Map<string, HeldController>();
  /** Tra controller cua mot tab. */
  const controller = (id: string): BrowserController | undefined => controllers.get(id)?.controller;
  return {
    keyedHooks: { browserState: (key: string) => controller(key) },
    /** Gan tab vao vung noi dung, tao controller neu vong doi doi. */
    mount(request: BrowserMountRequest): () => void {
      const { tabId, signal } = request;
      if (signal.aborted) return () => undefined;
      let held = controllers.get(tabId);
      if (held?.signal !== signal) {
        if (held !== undefined) {
          held.signal.removeEventListener("abort", held.forget);
          void held.controller.dispose();
        }
        const created = new BrowserController({ ...request, actions: currentActions, createPage, createStore });
        const forget = (): void => {
          controllers.delete(tabId);
          if (!isTabOpen(tabId)) currentActions.forget(tabId);
        };
        held = { signal, controller: created, forget };
        controllers.set(tabId, held);
        signal.addEventListener("abort", forget, { once: true });
      }
      const hide = held.controller.mount(request.viewportId);
      held.controller.start(request.initialUrl);
      return hide;
    },
    /** Don moi controller dang giu. */
    async dispose(): Promise<void> {
      const pending = [...controllers.values()].map(({ signal, controller: held, forget }) => {
        signal.removeEventListener("abort", forget);
        return held.dispose();
      });
      controllers.clear();
      await Promise.all(pending);
    },
    /** Doi nguon ghi checkpoint cho moi controller dang giu. */
    rebind(next: BrowserActionsLike): void {
      currentActions = next;
      for (const { controller: held } of controllers.values()) held.rebind(next);
    },
    /** Tai mot dia chi trong mot tab. */
    loadUrl: (id: string, value: string): void => {
      controller(id)?.loadUrl(value);
    },
    /** Khoi phuc dia chi da luu cua mot tab. */
    restore: (id: string): void => {
      controller(id)?.restore();
    },
    /** Lui trong mot tab. */
    goBack: (id: string): void => {
      controller(id)?.goBack();
    },
    /** Tien trong mot tab. */
    goForward: (id: string): void => {
      controller(id)?.goForward();
    },
    /** Tai lai trong mot tab. */
    reload: (id: string): void => {
      controller(id)?.reload();
    },
    /** Bat/tat sandbox nhung cua mot tab. */
    setSandbox: (id: string, enabled: boolean): void => {
      controller(id)?.setSandbox(enabled);
    },
  };
}
