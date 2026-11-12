/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nua client cua row ui-shortcuts: 2 slot (settings.general.item · shell.overlay) + lenh shortcuts.open
 *   + 3 lenh menu co dinh — chuyen 1:1 tu index.js cua bundle goc (lib/client.js dong 1047-1159)
 */

import { CLASS } from "./class-names.ts";
import { clsx } from "./clsx.ts";
import { injectStyles } from "./css.ts";
import { createShortcutEditor } from "./editor.ts";
import { shortcutFailure, shortcutReadFailure } from "./feedback.ts";
import { fixedCommands } from "./fixed.ts";
import { createIcons } from "./icons.ts";
import { EFFECT, NS, STOCK_CLIENT_INJECT } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { createReference } from "./reference.ts";
import { createShortcutsStore } from "./store.ts";
import type { ReferenceActions, ReferencePrimitives, ReferenceReact, ReferenceRuntime } from "./reference.ts";
import type { ShortcutDictionary } from "./feedback.ts";

/** require do bảng module cấp cho factory (hợp đồng C2). */
export type RequireFn = (specifier: string) => unknown;

/** Ba dịch vụ mà bản gốc khai ở nửa client (export inject của bundle gốc). */
export const INJECT: readonly string[] = ["shortcuts", "locale", "slots"];

/** Định nghĩa lệnh mà seam shortcuts.register nhận (chỉ phần row này khai). */
export interface CommandDefinition {
  /** Id lệnh. */
  readonly id: string;
  /** Nhãn hiển thị (từ điển). */
  readonly label: () => string;
  /** Tên gọi khác để tìm. */
  readonly aliases: readonly string[];
  /** Tổ hợp mặc định theo nền tảng (khoá dạng <runtime>:<platform>). */
  readonly defaults: Readonly<Record<string, { readonly code: string; readonly modifiers: readonly string[] }>>;
  /** Vùng nhận phím. */
  readonly regions: readonly string[];
  /** Modal mà lệnh còn chạy được. */
  readonly modals: readonly string[];
  /** Quyết định chạy/không chạy theo modal đang mở. */
  readonly resolve: (context: { readonly modal: string | null }) => { readonly status: string; readonly reason?: string; readonly run?: () => void };
}

/** Phần seam shortcuts của dịch vụ mà row này tiêu thụ. */
export interface ShortcutsSeam {
  /** Nền tảng hiện tại. */
  readonly platform: string;
  /** Nơi lưu hiện tại. */
  readonly runtime: string;
  /** Danh mục lệnh (nguồn hook). */
  readonly catalog: unknown;
  /** Cấu hình phím tắt (nguồn hook). */
  readonly config: unknown;
  /** Danh mục cố định (nguồn hook). */
  readonly fixedCatalog: unknown;
  /** Ghi cấu hình. */
  edit(operation: Record<string, unknown>, revision: number): Promise<unknown>;
  /** Bật/tắt chế độ ghi tổ hợp. */
  recording(active: boolean): Promise<void>;
  /** Mô tả tổ hợp vật lý. */
  describeBinding(binding: unknown): unknown;
  /** Đăng ký lệnh; trả hàm gỡ. */
  register(definition: CommandDefinition): () => void;
  /** Đăng ký lệnh menu cố định; trả hàm gỡ. */
  registerFixed(command: unknown): () => void;
}

/** Seam slot (chỉ hai hàm bản gốc dùng). */
export interface SlotsSeam {
  /** Đăng ký vào một slot ngay khi slot đó sống. */
  inject(name: string, register: () => unknown): unknown;
  /** Chiếm một chỗ trong slot; trả hàm gỡ. */
  register(definition: Record<string, unknown>, component: unknown): () => void;
}

/** Seam từ điển (hai hàm bản gốc dùng). */
export interface LocaleSeam {
  /** Đăng ký bảng chữ của namespace; trả hàm gỡ. */
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): unknown;
  /** Bind namespace thành hàm dịch. */
  bind(namespace: string): ShortcutDictionary;
}

/** Context phía browser (chỉ seam mà row này dùng). */
export interface ClientContextLike {
  /** Vòng đời cordis. */
  effect(callback: () => unknown, label?: string): unknown;
  /** Seam từ điển. */
  locale: LocaleSeam;
  /** Seam slot. */
  slots: SlotsSeam;
  /** Seam dịch vụ phím tắt. */
  shortcuts: ShortcutsSeam;
}

/** Plugin phía browser do factory dựng ra — đúng mặt module mà bundle gốc export. */
export interface ShortcutsPlugin {
  /** Cài wiring của row. */
  apply(ctx: ClientContextLike): void;
  /** Dịch vụ bắt buộc (cordis fiber inject). */
  inject: string[];
}

/**
 * Cờ chặn cài hai lần ở PHẠM VI MODULE — LUẬT CHUNG của repo (HAI ENTRY ⇒ HAI CTX nên khoá theo ctx KHÔNG chặn được).
 * Bật SAU khi phần đăng ký chạy xong; bật sớm mà đăng ký ném giữa đường ⇒ slot không bao giờ được đăng ký lại.
 */
let installed = false;

/**
 * Dựng nửa client của row từ require do bảng module cấp.
 * Nhận: requireFn — require của bảng module (react, react/jsx-runtime, ui-primitives, dsh-client-store).
 * Trả: plugin { apply, inject } (đúng mặt module bundle gốc export: apply + inject).
 */
export function createPlugin(requireFn: RequireFn): ShortcutsPlugin {
  /**
   * Cài wiring: từ điển, store, 3 lệnh menu cố định, 2 slot, 1 lệnh shortcuts.open.
   * Nhận: ctx — context phía browser.
   * Trả: không.
   */
  const apply = (ctx: ClientContextLike): void => {
    if (installed) return;
    try {
      applyInner(ctx);
      installed = true;
    } catch (error) {
      console.error("gbh-client-ui-shortcuts: apply ném lỗi", error);
      throw error;
    }
  };

  /**
   * Thân của apply — tách ra để cờ chỉ bật sau khi TOÀN BỘ phần đăng ký chạy xong.
   * Nhận: ctx — context phía browser.
   * Trả: không.
   */
  const applyInner = (ctx: ClientContextLike): void => {
    const jsxRuntime = requireFn("react/jsx-runtime") as ReferenceRuntime;
    const react = requireFn("react") as ReferenceReact;
    const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as ReferencePrimitives;
    const storeModule = requireFn("@galaxy-blackhole/gbh-client-store") as {
      defineStore: (spec: Record<string, unknown>) => { create(): unknown };
    };
    // Bundle gốc chèn <style data-plugin-css=…> ngay khi module được vá; ta chèn trong apply với cùng idempotent
    // (idempotent theo data-plugin-css nên gọi lại không sinh thẻ thứ hai).
    injectStyles();
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), EFFECT.dictionaries);
    const t = ctx.locale.bind(NS);
    const handle = createShortcutsStore(storeModule.defineStore);
    // MỘT thể hiện cho CẢ HAI chỗ ngồi: bản gốc tạo instance một lần rồi create: () => instance.
    const instance = handle.create() as { actions: ReferenceActions };
    const store = { ...handle, create: () => instance };
    const edit = (operation: Record<string, unknown>, revision: number): Promise<unknown> => ctx.shortcuts.edit(operation, revision);
    const recording = (active: boolean): Promise<void> => ctx.shortcuts.recording(active);
    const describeBinding = (binding: unknown): unknown => ctx.shortcuts.describeBinding(binding);
    for (const command of fixedCommands(t)) {
      ctx.effect(() => ctx.shortcuts.registerFixed(command), NS + ": " + command.id);
    }
    /** Props mà renderer cấp cho cả hai chỗ ngồi (đúng hình dạng injected của bản gốc). */
    const injected = () => ({
      platform: ctx.shortcuts.platform,
      runtime: ctx.shortcuts.runtime,
      edit,
      recording,
      describeBinding,
      hooks: {
        catalog: ctx.shortcuts.catalog,
        config: ctx.shortcuts.config,
        fixedCatalog: ctx.shortcuts.fixedCatalog,
      },
    });
    const icons = createIcons(jsxRuntime);
    const { ShortcutsRow, ShortcutReference } = createReference({
      runtime: jsxRuntime,
      react,
      primitives,
      classes: CLASS,
      ShortcutIcon: icons.ShortcutIcon,
      createShortcutEditor: createShortcutEditor as unknown as Parameters<typeof createReference>[0]["createShortcutEditor"],
      shortcutFailure,
      shortcutReadFailure,
      clsx,
    });
    ctx.slots.inject("settings.general.item", () =>
      ctx.slots.register(
        { name: "settings.general.item", id: "shortcuts", order: 16, locale: NS, store, inject: injected },
        ShortcutsRow,
      ),
    );
    ctx.slots.inject("shell.overlay", () => {
      const disposeCommand = ctx.shortcuts.register({
        id: "shortcuts.open",
        label: () => t("open"),
        aliases: ["shortcuts", "keyboard shortcuts"],
        defaults: {
          "desktop:macos": { code: "Slash", modifiers: ["primary"] },
          "desktop:windows": { code: "Slash", modifiers: ["primary"] },
          "desktop:linux": { code: "Slash", modifiers: ["primary"] },
          "web:macos": { code: "Slash", modifiers: ["primary"] },
          "web:windows": { code: "Slash", modifiers: ["primary"] },
          "web:linux": { code: "Slash", modifiers: ["primary"] },
        },
        regions: ["page", "editable", "terminal"],
        modals: ["settings", "shortcuts"],
        resolve: ({ modal }) => {
          if (modal !== null && modal !== "settings" && modal !== "shortcuts") return { status: "blocked", reason: "modal" };
          return {
            status: "handled",
            run: () => {
              if (modal === "shortcuts") primitives.closeTopModal(document);
              else instance.actions.open();
            },
          };
        },
      });
      const disposeSlot = ctx.slots.register({ name: "shell.overlay", id: "shortcuts", locale: NS, store, inject: injected }, ShortcutReference);
      return () => {
        disposeCommand();
        disposeSlot();
      };
    });
  };

  return { apply, inject: [...INJECT] };
}

/** Bốn gói mà manifest của row khai ở dsh.client.inject — giữ nguyên văn (tầng nạp đổi qua aliases). */
export const CLIENT_INJECT: readonly string[] = STOCK_CLIENT_INJECT;
