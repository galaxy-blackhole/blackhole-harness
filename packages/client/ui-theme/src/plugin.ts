/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Nua client cua row ui-theme: cap service theme + 2 cho ngoi Settings (appearance · font-size) + tu dien
 *   + tam sheet token — chuyen 1:1 tu client/index.js cua bundle goc (lib/client.js dong 2004-2079)
 */

import { clsx } from "./clsx.ts";
import { SETTINGS_NS, THEME_CHANGE_EVENT, THEME_SETTINGS_NAMESPACE, STOCK_CLIENT_INJECT } from "./ids.ts";
import { en, vi, zh } from "./locales.ts";
import { createRows } from "./rows.ts";
import { createAppearanceRowStore, createFontRowStore } from "./settings-store.ts";
import { installRowStyles, installThemeStyles } from "./styles.ts";
import { ThemeRuntime } from "./theme-runtime.ts";
import type { DefineStore } from "./settings-store.ts";
import type { RowsPrimitives, RowsReact, RowsRuntime } from "./rows.ts";
import type { FontFamilies, FontRole, FontSizes } from "./theme-settings.ts";
import type { ThemeHostScope, ThemeRuntimeContext, ThemeSnapshot } from "./theme-runtime.ts";

/** require do bảng module cấp cho factory (hợp đồng C2). */
export type RequireFn = (specifier: string) => unknown;

/** Bốn dịch vụ mà bản gốc khai ở nửa client (export inject của bundle gốc). */
export const INJECT: readonly string[] = ["slots", "locale", "remote", "configForms"];

/** Seam slot (hai hàm bản gốc dùng). */
export interface SlotsSeam {
  /** Đăng ký vào một slot ngay khi slot đó sống. */
  inject(name: string, register: () => unknown): unknown;
  /** Chiếm một chỗ trong slot; trả hàm gỡ. */
  register(definition: Record<string, unknown>, component: unknown): () => void;
}

/** Seam từ điển. */
export interface LocaleSeam {
  /** Đăng ký bảng chữ của namespace; trả hàm gỡ (dùng trực tiếp làm callback của ctx.effect như bản gốc). */
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void;
  /** Bind namespace thành hàm dịch. */
  bind(namespace: string): (key: string) => string;
}

/** Hành vi mà renderer cấp cho chỗ ngồi (actions) — hai hình dạng theo hai chỗ ngồi. */
export interface AppearanceActions {
  /** Đồng bộ preference + revision vào store của chỗ ngồi. */
  sync(preference: string, revision: number): void;
}

/** Hành vi mà renderer cấp cho chỗ ngồi font. */
export interface FontActions {
  /** Đồng bộ cỡ chữ + danh sách font + revision vào store. */
  sync(fontSizes: FontSizes, fontFamilies: FontFamilies, revision: number): void;
}

/** Context phía browser (chỉ seam mà row này dùng). */
export interface ClientContext extends ThemeRuntimeContext {
  /** Nghe sự kiện. */
  on(event: string, listener: (...args: never[]) => void): () => void;
  /** Cấp một service cho context. */
  provide(name: string, value: unknown): void;
  /** Seam slot. */
  slots: SlotsSeam;
  /** Seam từ điển. */
  locale: LocaleSeam;
  /** Scope settings của Host theo namespace (bản gốc: ctx.configForms.get("ui-theme")). */
  configForms: { get(namespace: string): ThemeHostScope };
}

/** Plugin phía browser do factory dựng ra — đúng mặt module bundle gốc export. */
export interface ThemePlugin {
  /** Cài wiring của row. */
  apply(ctx: ClientContext): void;
  /** Dịch vụ bắt buộc (cordis fiber inject). */
  inject: string[];
  /** Namespace từ điển của row. */
  SETTINGS_NS: string;
  /** Lớp runtime theme (bản gốc export ra ngoài module). */
  ThemeRuntime: typeof ThemeRuntime;
}

/**
 * Cờ chặn cài hai lần ở PHẠM VI MODULE (hai entry ⇒ hai ctx nên khoá theo ctx không chặn được).
 * Bật SAU khi applyInner chạy xong.
 */
let installed = false;

/**
 * Dựng nửa client của row từ require do bảng module cấp.
 * Nhận: requireFn — require của bảng module (react, react/jsx-runtime, ui-primitives, dsh-client-store).
 * Trả: plugin { apply, inject, SETTINGS_NS, ThemeRuntime }.
 */
export function createPlugin(requireFn: RequireFn): ThemePlugin {
  /**
   * Cài wiring: 8 tấm stylesheet token, từ điển, service theme, hai chỗ ngồi Settings.
   * Nhận: ctx — context phía browser.
   * Trả: không.
   */
  const apply = (ctx: ClientContext): void => {
    if (installed) return;
    try {
      applyInner(ctx);
      installed = true;
    } catch (error) {
      console.error("gbh-client-ui-theme: apply ném lỗi", error);
      throw error;
    }
  };

  /**
   * Thân của apply — tách ra để cờ chỉ bật sau khi TOÀN BỘ phần đăng ký chạy xong.
   * Nhận: ctx — context phía browser.
   * Trả: không.
   */
  const applyInner = (ctx: ClientContext): void => {
    const jsxRuntime = requireFn("react/jsx-runtime") as RowsRuntime;
    const react = requireFn("react") as RowsReact;
    const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as RowsPrimitives;
    const defineStore = (requireFn("@galaxy-blackhole/gbh-client-store") as { defineStore: DefineStore }).defineStore;
    // Hai tấm CSS của chính goi: 8 sheet token (vòng đời plugin) + 4 module của row (idempotent theo data-plugin-css).
    installRowStyles();
    installThemeStyles(ctx);
    // Phase 2 (task-2) + task-231 (22/10): gói này SỞ HỮU cả ba ngữ của namespace settings.theme, và từ điển `vi`
    // đã được CHÈN vào artifact (tools/inject-vi-dictionary.ts) nên lượt đăng ký DUY NHẤT mang đủ zh+en+vi.
    // Khối từ điển viết tay cũ (đăng ký `vi` riêng ở lượt thứ hai, kèm try/catch chuyển tiếp) đã dọn ⇒
    // mỗi namespace chỉ được đăng ký ĐÚNG MỘT lần (xem tests/client/ui-theme.test.ts:529,534,537).
    ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en, vi }), "ui-theme: settings row dictionaries");
    const theme = new ThemeRuntime(ctx, ctx.configForms.get(THEME_SETTINGS_NAMESPACE));
    ctx.provide("theme", theme);
    const store = createAppearanceRowStore(defineStore);
    let bound: AppearanceActions | undefined;
    const fontStore = createFontRowStore(defineStore);
    let fontBound: FontActions | undefined;
    /** Đồng bộ snapshot theme vào hai store của hai chỗ ngồi. */
    const sync = (snapshot: ThemeSnapshot): void => {
      bound?.sync(snapshot.preference, snapshot.revision);
      fontBound?.sync(snapshot.fontSizes, snapshot.fontFamilies, snapshot.revision);
    };
    ctx.on(THEME_CHANGE_EVENT, sync);
    const { AppearanceRow, FontSettingsGroup } = createRows({ runtime: jsxRuntime, react, primitives, clsx });
    /** inject của chỗ ngồi Appearance (bản gốc: bound = actions; sync(theme.getTheme()); return { setTheme }). */
    const appearanceInjected = (actions: AppearanceActions): Record<string, unknown> => {
      bound = actions;
      sync(theme.getTheme());
      return {
        setTheme: (id: string): void => {
          theme.setTheme(id);
        },
      };
    };
    ctx.slots.inject("settings.general.item", () =>
      ctx.slots.register(
        { name: "settings.general.item", id: "appearance", order: 10, store, locale: SETTINGS_NS, inject: appearanceInjected },
        AppearanceRow,
      ),
    );
    ctx.slots.inject("settings.general.item", () =>
      ctx.slots.register(
        {
          name: "settings.general.item",
          id: "font-size",
          order: 11,
          store: fontStore,
          locale: SETTINGS_NS,
          inject: (actions: FontActions) => {
            fontBound = actions;
            sync(theme.getTheme());
            return {
              setFontFamily: (role: FontRole, value: string): void => {
                theme.setFontFamily(role, value);
              },
              setFontSize: (role: FontRole, px: number): void => {
                theme.setFontSize(role, px);
              },
            };
          },
        },
        FontSettingsGroup,
      ),
    );
  };

  return { apply, inject: [...INJECT], SETTINGS_NS, ThemeRuntime };
}

/** Sáu gói mà manifest của row khai ở dsh.client.inject — giữ nguyên văn (tầng nạp đổi qua aliases). */
export const CLIENT_INJECT: readonly string[] = STOCK_CLIENT_INJECT;
