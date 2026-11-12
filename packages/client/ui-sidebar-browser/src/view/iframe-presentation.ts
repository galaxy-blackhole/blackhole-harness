/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc DOM cua iframe va quan sat lan tai theo the he, khong doc noi dung khac nguon
 */

import { CLASS } from "./css.ts";
import type { BrowserPresentation } from "./presentation.ts";
import type { BrowserTarget } from "../url.ts";

/** Chinh sach iframe co dinh; dieu huong top va tai xuong khong duoc cap truc tiep. */
export const WEB_BROWSER_SANDBOX =
  "allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox";

/** Mot tai lieu iframe da chuan bi. */
interface IframeDocument {
  /** Dich can tai. */
  readonly target: BrowserTarget;
  /** The he tai lieu. */
  readonly revision: number;
  /** Co ap dung sandbox khong. */
  readonly sandboxed: boolean;
}

/** Chi bao nhung gi iframe quan sat duoc ma khong doc noi dung khac nguon. */
export interface IframePresentationEvents {
  /** Mot tai lieu da tai xong. */
  loaded(revision: number): void;
  /** Mot tai lieu tai that bai. */
  failed(revision: number): void;
  /** Vung noi dung duoc gan lai (lan tai phai lam lai). */
  remounted(): void;
}

/** So huu phan tu iframe; dieu huong va lich su van o IframeImpl. */
export class IframePresentation implements BrowserPresentation {
  /** Callback do nha cung cap so huu. */
  private readonly events: IframePresentationEvents;
  /** Vung noi dung dang gan. */
  private host: HTMLElement | undefined;
  /** Phan tu iframe dang gan. */
  private element: HTMLIFrameElement | undefined;
  /** Tai lieu da chuan bi nhung chua (hoac da) ve. */
  private document: IframeDocument | undefined;
  /** Da ve lan nao chua (de biet lan gan sau la "gan lai"). */
  private rendered = false;

  /**
  * Dung lop trinh bay iframe.
  * Nhan: events — callback tai xong, tai loi va gan lai do nha cung cap so huu.
  */
  constructor(events: IframePresentationEvents) {
    this.events = events;
  }

  /**
  * Gan vao mot vung noi dung da cam ket.
  * Nhan: viewportId — id vung noi dung.
  * Tra: ham chi go phan trinh bay iframe.
  */
  mount(viewportId: string): () => void {
    const host = document.getElementById(viewportId);
    if (host === null) throw new Error("iframe presentation: viewport is not mounted");
    this.element?.remove();
    this.element = undefined;
    this.host = host;
    if (this.rendered) this.events.remounted();
    else this.render();
    return () => {
      if (this.host !== host) return;
      this.element?.remove();
      this.element = undefined;
      this.host = undefined;
    };
  }

  /**
  * Giu tai lieu da chuan bi va ve no khi da co vung noi dung.
  * Nhan: value — tai lieu da chuan bi kem the he su kien.
  * Tra: khong co.
  */
  show(value: IframeDocument): void {
    this.document = value;
    this.render();
  }

  /** Go DOM do lop nay so huu va du lieu trinh bay da giu. */
  dispose(): void {
    this.element?.remove();
    this.element = undefined;
    this.host = undefined;
    this.document = undefined;
  }

  /** Ve lai iframe tu tai lieu dang giu (khong lam gi khi thieu ve mot trong hai). */
  private render(): void {
    const current = this.document;
    const host = this.host;
    if (current === undefined || host === undefined) return;
    this.element?.remove();
    const element = document.createElement("iframe");
    element.className = CLASS.frame;
    element.src = current.target.url;
    element.title = current.target.title;
    element.referrerPolicy = "no-referrer";
    element.dataset.sidebarBrowserFrame = "iframe";
    if (current.sandboxed) element.setAttribute("sandbox", WEB_BROWSER_SANDBOX);
    element.addEventListener("load", () => {
      if (this.element === element) this.events.loaded(current.revision);
    });
    element.addEventListener("error", () => {
      if (this.element === element) this.events.failed(current.revision);
    });
    this.element = element;
    this.rendered = true;
    host.append(element);
  }
}
