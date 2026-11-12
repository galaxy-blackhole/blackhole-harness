/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tab dang nhap trinh duyet: mo truoc tab trong cu click cua nguoi dung roi gan no vao lan dang nhap cua Host
 */


/**
 * Them bang mau dang hoat dong vao dia chi uy quyen Platform ma khong bo mat tham so nao cua Host.
 * Nhan: authorizeUrl — dia chi uy quyen cua lan dang nhap hien tai; colorScheme — bang mau da phan giai.
 * Tra: dia chi uy quyen kem theme=light hoac theme=dark.
 */
export function authorizeUrlWithTheme(authorizeUrl: string, colorScheme: string): string {
  const url = new URL(authorizeUrl);
  url.searchParams.set("theme", colorScheme);
  return url.href;
}

/** Trang thai toi thieu cua mot lan dang nhap ma tab trinh duyet can doc. */
export interface BrowserLoginAttempt {
  /** Id cua lan dang nhap. */
  readonly id?: string;
  /** Pha cua lan dang nhap. */
  readonly phase?: string;
  /** Dia chi uy quyen cua lan dang nhap. */
  readonly authorizeUrl?: string;
}

/** Anh chup toi thieu ma tab trinh duyet doc: chi can nhanh attempt. */
export interface BrowserLoginView {
  /** Lan dang nhap hien tai, null khi Host khong co. */
  readonly attempt?: BrowserLoginAttempt | null;
}

/**
 * Giu mot tab trinh duyet mo truoc tach khoi trang thai uy quyen cua Host.
 * Tab duoc mo ngay trong cu click (nen khong bi chan popup), roi chi duoc dieu huong
 * khi Host tra ve dung lan dang nhap ma tab nay dang theo.
 */
export class BrowserLogin {
  /** Anh xa dia chi uy quyen cua Host sang trang ma tab mo, doc luc tab dieu huong. */
  private readonly destination: (url: string) => string;
  /** Tab dang cho, null khi khong con. */
  private popup: Window | null = null;
  /** Da dieu huong lan nao chua (chi dieu huong mot lan cho moi lan dang nhap). */
  private navigated = false;
  /** Id cua lan dang nhap ma tab nay dang theo. */
  private attempt: string | undefined;

  /**
   * @param destination - anh xa dia chi uy quyen cua Host sang trang ma tab mo.
   */
  constructor(destination: (url: string) => string) {
    this.destination = destination;
  }

  /**
   * Mo truoc mot tab va gan no vao lan dang nhap ma Host tra ve.
   * @param request - yeu cau bat dau dang nhap da xac thuc.
   * @param latest - trang thai stream moi nhat, ke ca khung den truoc phan hoi.
   * @returns sau khi giao dien nay dang theo lan dang nhap moi.
   */
  async start(request: () => Promise<BrowserLoginView>, latest: () => BrowserLoginView | undefined): Promise<void> {
    this.begin();
    try {
      this.follow(await request());
      this.update(latest());
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  /** Mo truoc mot tab trong cu click cua nguoi dung; popup bi chan thi con duong sao chep lien ket. */
  begin(): void {
    this.dispose();
    this.popup = window.open("about:blank", "_blank");
    if (this.popup) this.popup.opener = null;
  }

  /**
   * Gan tab da mo truoc vao dung lan dang nhap cua Host.
   * @param view - phan hoi RPC dau tien dinh danh lan dang nhap cua giao dien nay.
   */
  follow(view: BrowserLoginView): void {
    this.attempt = view.attempt?.id ?? undefined;
    this.update(view);
  }

  /**
   * Dieu huong hoac dong tab dang cho khi lan dang nhap cua no doi trang thai.
   * @param view - trang thai moi nhat cua Host.
   */
  update(view: BrowserLoginView | undefined): void {
    const attempt = view?.attempt;
    if (attempt?.id !== this.attempt) return;
    if (attempt && ["failed", "expired", "cancelled"].includes(attempt.phase ?? "")) {
      this.dispose();
      return;
    }
    if (attempt?.phase === "succeeded") {
      if (!this.navigated) this.popup?.close();
      this.popup = null;
      this.attempt = undefined;
      return;
    }
    if (!attempt?.authorizeUrl || this.navigated) return;
    this.navigated = true;
    if (this.popup && !this.popup.closed) this.popup.location.replace(this.destination(attempt.authorizeUrl));
  }

  /** Dong tab uy quyen ma no so huu va thoi theo doi lan dang nhap do. */
  dispose(): void {
    this.popup?.close();
    this.popup = null;
    this.attempt = undefined;
    this.navigated = false;
  }
}
