/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bo chieu theme: ghi anh chup ctx.theme len document.body (thuoc tinh nen toi, bien font, token)
 */

/** Thuộc tính trên body chọn bảng màu tối trong các stylesheet token. */
export const DARK_ATTRIBUTE = "data-ds-dark-theme";

/**
 * Thuộc tính ở gốc công bố NGUỒN theme (`light`, `dark`, `system`) cho các vỏ host soi lại thành theme
 * gốc: `system` chỉ khi tuỳ chọn là `system`; tuỳ chọn cố định (kể cả id theme đã đăng ký) công bố scheme
 * đã giải.
 */
export const THEME_SOURCE_ATTRIBUTE = "data-ds-theme-source";

/** Biến trên body mang cỡ chữ người dùng đặt, theo vai trò. */
export const FONT_SIZE_VARIABLES: Readonly<Record<string, string>> = {
  /** Chữ nội dung. */
  text: "--dsh-content-font-size",
  /** Chữ trong khối mã. */
  code: "--dsh-code-font-size",
  /** Chữ trong terminal. */
  terminal: "--dsh-terminal-font-size",
};

/** Biến trên body mang danh sách font đã chuẩn hoá; vắng mặt là dùng stack dựng sẵn. */
export const FONT_FAMILY_VARIABLES: Readonly<Record<string, string>> = {
  /** Font chữ nội dung. */
  text: "--dsh-font-family-text",
  /** Font khối mã. */
  code: "--dsh-font-family-code",
  /** Font terminal. */
  terminal: "--dsh-font-family-terminal",
};

/** Ảnh chụp theme đã giải mà `ctx.theme` phơi ra. */
export interface ThemeSnapshot {
  /** Tuỳ chọn người dùng: `light` · `dark` · `system` · hoặc id theme đã đăng ký. */
  readonly preference: string;
  /** Theme đang áp: scheme và bảng token. */
  readonly active: { readonly colorScheme: string; readonly tokens: Readonly<Record<string, string>> };
  /** Cỡ chữ theo vai trò (px). */
  readonly fontSizes: Readonly<Record<string, number>>;
  /** Danh sách font theo vai trò; chuỗi rỗng nghĩa là bỏ biến để dùng stack dựng sẵn. */
  readonly fontFamilies: Readonly<Record<string, string>>;
}

/**
 * Bộ chiếu theme lên document — mỗi fiber plugin một thực thể.
 *
 * Nó nhớ tập token mình đã ghi ở lần áp trước (để rút lại đúng những cái đó) và giữ MỘT thẻ metadata
 * `theme-color` do chính nó chèn và gỡ.
 */
export class ThemePresenter {
  /** Tên các token đã ghi ở lần áp gần nhất — tập cần rút lại. */
  private appliedTokens: string[] = [];

  /** Thẻ metadata duy nhất mà bộ chiếu này chèn và gỡ. */
  private readonly themeColorMeta: HTMLMetaElement;

  /** Tạo thẻ metadata thuộc sở hữu của bộ chiếu trước khi ảnh chụp đầu tiên tới. */
  constructor() {
    this.themeColorMeta = document.createElement("meta");
    this.themeColorMeta.name = "theme-color";
  }

  /**
   * Chiếu một ảnh chụp lên document: đặt `color-scheme` ở gốc và thuộc tính bảng màu trên body theo
   * `active.colorScheme` (KHÔNG bao giờ theo id — `system` đã được giải ở tầng trên), công bố cỡ chữ và
   * danh sách font, rồi thay các biến token đã ghi lần trước bằng `active.tokens`. Metadata `theme-color`
   * đi theo màu nền tính được của body SAU các ghi đó, nên bảng màu đang render vẫn là nguồn sự thật về màu.
   * Nhận: ảnh chụp theme đã giải từ `ctx.theme`.
   * Trả: không có.
   */
  apply(snapshot: ThemeSnapshot): void {
    const scheme = snapshot.active.colorScheme;
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.setAttribute(THEME_SOURCE_ATTRIBUTE, snapshot.preference === "system" ? "system" : scheme);
    const body = document.body;
    if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, "");
    else body.removeAttribute(DARK_ATTRIBUTE);
    for (const [role, name] of Object.entries(FONT_SIZE_VARIABLES)) {
      body.style.setProperty(name, String(snapshot.fontSizes[role]) + "px");
    }
    for (const [kind, name] of Object.entries(FONT_FAMILY_VARIABLES)) {
      const list = snapshot.fontFamilies[kind] ?? "";
      if (list === "") body.style.removeProperty(name);
      else body.style.setProperty(name, list);
    }
    for (const name of this.appliedTokens) body.style.removeProperty(name);
    this.appliedTokens = [];
    for (const [name, value] of Object.entries(snapshot.active.tokens)) {
      body.style.setProperty(name, value);
      this.appliedTokens.push(name);
    }
    this.themeColorMeta.content = getComputedStyle(body).backgroundColor;
    if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta);
  }

  /**
   * Rút lại mọi thứ bộ chiếu này đã ghi: `color-scheme` ở gốc, thuộc tính nguồn theme, thuộc tính bảng màu,
   * biến token, cỡ chữ, danh sách font, và thẻ metadata của nó.
   * Nhận: không có.
   * Trả: không có.
   */
  dispose(): void {
    document.documentElement.style.removeProperty("color-scheme");
    document.documentElement.removeAttribute(THEME_SOURCE_ATTRIBUTE);
    const body = document.body;
    body.removeAttribute(DARK_ATTRIBUTE);
    for (const name of Object.values(FONT_SIZE_VARIABLES)) body.style.removeProperty(name);
    for (const name of Object.values(FONT_FAMILY_VARIABLES)) body.style.removeProperty(name);
    for (const name of this.appliedTokens) body.style.removeProperty(name);
    this.appliedTokens = [];
    this.themeColorMeta.remove();
  }
}
