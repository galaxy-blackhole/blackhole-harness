/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hai store cua hai cho ngoi Settings (Appearance + co font): ban sao anh chup theme — chuyen 1:1 tu
 *   settings-store.js cua bundle goc (lib/client.js dong 1359-1405)
 */

import { DEFAULT_FONT_SIZES } from "./theme-settings.ts";
import type { FontFamilies, FontSizes } from "./theme-settings.ts";

/** Ham defineStore do bang module cap (@galaxy-blackhole/gbh-client-store). */
export type DefineStore = (spec: Record<string, unknown>) => { create(): unknown };

/** Handle store ma defineStore tra ve. */
export interface StoreHandle {
  /** Tao mot the hien (khong tham so = scope goc). */
  create(): unknown;
}

/** Trang thai cua hang Appearance. */
export interface AppearanceState {
  /** Tuy chon dang luu. */
  preference: string;
  /** Revision cua snapshot da dong bo. */
  revision: number;
}

/** Trang thai cua nhom co font. */
export interface FontState {
  /** Co chu theo vai tro. */
  fontSizes: FontSizes;
  /** Danh sach font theo vai tro. */
  fontFamilies: FontFamilies;
  /** Revision cua snapshot da dong bo. */
  revision: number;
}

/**
 * Khai bang trang thai + be mat ghi cua hang Appearance.
 * @param defineStore - ham defineStore cua bang module.
 * @returns handle store (create()).
 */
export function createAppearanceRowStore(defineStore: DefineStore): StoreHandle {
  return defineStore({
    init: (): AppearanceState => ({ preference: "system", revision: -1 }),
    actions: {
      /** Dong bo tu snapshot theme; bo qua snapshot cu hon (revision <= hien tai). */
      sync: (d: AppearanceState, preference: string, revision: number): void => {
        if (revision <= d.revision) return;
        d.preference = preference;
        d.revision = revision;
      },
    },
  });
}

/**
 * Khai bang trang thai + be mat ghi cua nhom co font.
 * @param defineStore - ham defineStore cua bang module.
 * @returns handle store (create()).
 */
export function createFontRowStore(defineStore: DefineStore): StoreHandle {
  return defineStore({
    init: (): FontState => ({
      fontSizes: DEFAULT_FONT_SIZES,
      fontFamilies: { text: "", code: "", terminal: "" },
      revision: -1,
    }),
    actions: {
      /** Dong bo tu snapshot theme; bo qua snapshot cu hon. */
      sync: (d: FontState, fontSizes: FontSizes, fontFamilies: FontFamilies, revision: number): void => {
        if (revision <= d.revision) return;
        d.fontSizes = fontSizes;
        d.fontFamilies = fontFamilies;
        d.revision = revision;
      },
    },
  });
}
