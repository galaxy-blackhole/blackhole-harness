/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dinh nghia kieu tab trinh duyet voi ban sao song theo tu dien
 */

import { BROWSER_KIND, GUIDE_ENTRY_ID, PACKAGE_NAME, SHORTCUT_ID } from "./ids.ts";

/** Phan cua ui-primitives ma muc huong dan can. */
export interface BrowserGuidePrimitivesLike {
  /** Anh nghe thuat cua muc huong dan trinh duyet. */
  GuideArtworkBrowser: unknown;
}

/** Mot muc trong bang huong dan mo tab. */
export interface BrowserGuideEntry {
  /** Id muc huong dan. */
  readonly id: string;
  /** Id lenh ma muc nay chay. */
  readonly commandId: string;
  /** Thu tu hien thi. */
  readonly order: number;
  /** Tieu de (doc tu dien moi lan goi). */
  title: () => string;
  /** Mo ta (doc tu dien moi lan goi). */
  description: () => string;
  /** Anh cua muc huong dan. */
  readonly icon: unknown;
}

/** Dinh nghia kieu tab cua sidebar phai ma row nay dang ky. */
export interface BrowserTabDefinitionLike {
  /** Id kieu tab — cung la khoa dispatch cua hai cho ngoi theo tab. */
  readonly id: string;
  /** Kieu tab. */
  readonly kind: string;
  /** Cho phep nhieu tab cung kieu trong mot khung. */
  readonly multiple: boolean;
  /** Uu tien khi trung kieu. */
  readonly priority: string;
  /** Tieu de kieu tab. */
  title: () => string;
  /** Bang huong dan mo tab. */
  readonly guide: BrowserGuideEntry[];
}

/**
 * Dung dinh nghia kieu tab trinh duyet voi ban sao song theo tu dien.
 * Nhan: t — ham doc tu dien da bind namespace; primitives — phan ui-primitives can dung.
 * Tra: dinh nghia kieu tab de dang ky voi sidebar phai.
 */
export function browserDefinition(
  t: (key: string, params?: Record<string, string>) => string,
  primitives: BrowserGuidePrimitivesLike,
): BrowserTabDefinitionLike {
  return {
    id: PACKAGE_NAME,
    kind: BROWSER_KIND,
    multiple: true,
    priority: "builtin",
    title: (): string => t("type.label"),
    guide: [{
      id: GUIDE_ENTRY_ID,
      commandId: SHORTCUT_ID,
      order: 30,
      title: (): string => t("guide.title"),
      description: (): string => t("guide.description"),
      icon: primitives.GuideArtworkBrowser,
    }],
  };
}
