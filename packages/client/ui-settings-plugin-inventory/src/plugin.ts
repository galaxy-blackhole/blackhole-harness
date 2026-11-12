/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Ruột nửa client của row ui-settings-plugin-inventory: đăng ký từ điển và tab kiểm kê vào Settings
 */

/**
 * Tập ctx ĐÃ cài — phạm vi MODULE, khoá theo `ctx`. Row đăng ký HAI id ⇒ factory gọi hai lần
 * nhưng CÙNG một ctx; khoá theo ctx chặn lần cài thứ hai mà KHÔNG dính giữa các ca test trong cùng file.
 */
/** Cong NGOAI: boolean PHAM VI MODULE — chan chac chan lan cai thu hai, khong phu thuoc identity cua ctx. */

/** Da cai qua cong NGOAI chua. */


import {
  type InventorySnapshot,
  type JsxRuntimeLike,
  type ReactLike,
  type TabPrimitivesLike,
  createInventoryTab,
  ensureInventoryTabCss,
} from "./inventory-tab.ts";
import { NS, en, zh } from "./locales.ts";
import { type PresetRowLike, presetDisplayText } from "./preset-display.ts";
import { vi } from "./locales-vi.ts";

/** require do bảng module cấp cho factory. */
export type RequireFn = (id: string) => unknown;

/** Khe cắm của trang (seam slots). */
export interface SlotsSeamLike {
  /** Đăng ký một occupant vào slot; trả giá trị do seam quyết định. */
  register(definition: Record<string, unknown>, component: unknown): unknown;
  /** Đăng ký occupant vào slot, có thể hoãn bằng cách trả hàm đăng ký. */
  inject(slot: string, register: () => unknown): void;
}

/** Seam từ điển. */
export interface LocaleSeamLike {
  /** Bind một namespace thành hàm t(key, params). */
  bind(namespace: string): (key: string, params?: Record<string, string>) => string;
  /** Đăng ký từ điển của một namespace. */
  register(namespace: string, copy: Record<string, Record<string, string>>): unknown;
  /** Dịch một văn bản cục bộ của gói theo ngôn ngữ đang dùng. */
  resolveText(text: unknown): string;
}

/** Seam remote của Host. */
export interface RemoteSeamLike {
  /** Mặt remote do Host sinh cho kiểm kê plugin. */
  pluginInventory: {
    list(): Promise<{ ok: boolean; value?: InventorySnapshot; error?: { code: string; message: string } }>;
  };
}

/** Seam đồ thị module phía trang. */
export interface ModulesSeamLike {
  /** Registry entry của client. */
  entries: {
    /** Ảnh chụp trạng thái đồng bộ để renderer theo dõi. */
    state: unknown;
    /** Thử lại đồ thị module phía trang. */
    retry(): Promise<unknown>;
  };
}

/** Context phía browser (chỉ khai phần row này dùng). */
export interface ClientContextLike {
  /** Đăng ký một hiệu ứng có thể huỷ; tham số hai là nhãn để debug. */
  effect(callback: () => unknown, label?: string): unknown;
  /** Seam từ điển. */
  locale: LocaleSeamLike;
  /** Seam khe cắm. */
  slots: SlotsSeamLike;
  /** Seam remote. */
  remote: RemoteSeamLike;
  /** Seam đồ thị module. */
  modules: ModulesSeamLike;
  /** Ghi log. */
  logger: { error(error: unknown): void };
}

/** Plugin phía browser do factory dựng ra. */
export interface PluginInventoryPlugin {
  /** Gắn tab kiểm kê plugin vào mục Plugins của Settings. */
  apply(ctx: ClientContextLike): void;
  /** Dịch vụ bắt buộc (cordis fiber inject). */
  inject: string[];
}

/** Slot mà tab này chiếm. */
export const SLOT_NAME = "settings.plugins.tab";

/** Dịch vụ mà plugin này yêu cầu. */
export const INJECT = ["slots", "locale", "remote", "remote.pluginInventory", "modules"];

/** Cổng NGOÀI (phạm vi MODULE): true khi bundle đã cài một lần — chặn CHẮC lần nạp thứ hai, kể cả khi
 * Loader truyền một object ctx KHÁC cho plugin thứ hai.
 */
let installed = false;

/** Cong TRONG: khoa theo ctx — khong pha cac ca test dung lai cung module.
 * Tap ctx DA cai — pham vi MODULE, khoa theo `ctx`. Row dang ky HAI id => factory goi
 * nhieu lan nhung CUNG mot ctx; khoa theo ctx chan lan cai thu hai ma KHONG dinh giua cac ca test.
 */

/**
 * Dung nua client cua row tu require do bang module cap.
 * @param requireFn - require cua bang module (react, react/jsx-runtime, ui-primitives).
 * @returns plugin { apply, inject } — mot tu dien va mot tab chi doc.
 */
export function createPlugin(requireFn: RequireFn): PluginInventoryPlugin {
  /**
   * Boc idempotent + ghi log loi bi cordis NUOT, roi VAN nem tiep.
   * @param ctx - context phia browser.
   */
  const apply = (ctx: ClientContextLike): void => {
    // Cổng NGOÀI: so IDENTITY với ctx lần cài trước — chặn chắc, không phụ thuộc WeakSet.
    if (installed) return;
    installed = true;
    try {
      applyInner(ctx);
    } catch (error) {
      console.error("gbh-client-ui-settings-plugin-inventory: apply nem loi", error);
      throw error;
    }
  };

  /**
   * Than cua apply (giu nguyen hanh vi ban dau).
   * @param ctx - context phia browser.
   */
  const applyInner = (ctx: ClientContextLike): void => {
    ensureInventoryTabCss();
    const Tab = createInventoryTab(
      requireFn("react/jsx-runtime") as JsxRuntimeLike,
      requireFn("react") as ReactLike,
      requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as TabPrimitivesLike,
    );
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-settings-plugin-inventory: dictionaries");
    const t = ctx.locale.bind(NS);
    const list = async (): Promise<InventorySnapshot> => {
      const result = await ctx.remote.pluginInventory.list();
      if (!result.ok) {
        const code = result.error?.code ?? "unknown";
        const message = result.error?.message ?? "unknown error";
        throw new Error("pluginInventory.list failed: " + code + ": " + message);
      }
      return result.value as InventorySnapshot;
    };
    const agentPresetCopy = ctx.locale.bind("settings.agentPreset");
    const presetName = (preset: PresetRowLike): string => presetDisplayText(preset, agentPresetCopy).name;
    const injected = (): Record<string, unknown> => ({
      list,
      presetName,
      resolveText: (text: unknown): string => ctx.locale.resolveText(text),
      hooks: { clientSync: ctx.modules.entries.state },
      retryClient: (): void => {
        ctx.modules.entries.retry().catch((error: unknown) => {
          ctx.logger.error(error);
        });
      },
    });
    ctx.slots.inject(SLOT_NAME, () =>
      ctx.slots.register(
        {
          // Tên slot phải là LITERAL: bun run check:rows đọc literal để đối chiếu danh sách slot với gốc.
          name: "settings.plugins.tab",
          id: "all",
          order: 10,
          label: () => t("tab"),
          locale: NS,
          inject: injected,
        },
        Tab,
      ),
    );
  };
  return { apply, inject: [...INJECT] };
}
