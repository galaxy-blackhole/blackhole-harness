/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Ruột nửa client của row ui-settings-shell: hằng số id, seam, và factory dựng plugin
 */

/**
 * Tập ctx ĐÃ cài — phạm vi MODULE, khoá theo `ctx`. Row đăng ký HAI id ⇒ factory gọi hai lần
 * nhưng CÙNG một ctx; khoá theo ctx chặn lần cài thứ hai mà KHÔNG dính giữa các ca test trong cùng file.
 */
/** Cong NGOAI: boolean PHAM VI MODULE — chan chac chan lan cai thu hai, khong phu thuoc identity cua ctx. */

/** Da cai qua cong NGOAI chua. */


import { type CardPrimitivesLike, type JsxRuntimeLike, createShellCard } from "./shell-card.ts";
import {
  BASH_NS,
  type PrimitivesModule,
  PWSH_NS,
  createShellCardController,
} from "./shell-card-controller.ts";
import { type ShellSettingsLocaleKey, en, zh } from "./locales.ts";
import { vi } from "./locales-vi.ts";

/** Id package của TA — id CHÍNH của module (để rev của HMR tra đúng dòng trong manifest). */
export const PLUGIN_ID = "@galaxy-blackhole/gbh-client-ui-settings-shell";

/** Id package GỐC — id PHỤ, để mọi bundle phụ thuộc vẫn tìm thấy module này. */
export const STOCK_ID = "@deepseek-ai/dsh-client-ui-settings-shell";

/** Namespace từ điển do plugin này sở hữu. */
export const NS = "settings.shell";

/** require do bảng module cấp cho factory. */
export type RequireFn = (id: string) => unknown;

/** Khe cắm của trang (seam slots). */
export interface SlotsSeamLike {
  /** Đăng ký một occupant vào slot; trả giá trị do seam quyết định. */
  register(definition: Record<string, unknown>, component: unknown): unknown;
  /** Đăng ký occupant vào slot, có thể hoãn bằng cách trả hàm đăng ký. */
  inject(slot: string, register: () => unknown): void;
}

/** Form cấu hình một entry do Host phục vụ (seam configForms). */
export interface ConfigFormsSeamLike {
  /** Lấy scope cấu hình của một entry đã ghép trong profile. */
  get(namespace: string): unknown;
  /** Chạy đăng ký khi Host phục vụ các namespace này, chạy lại mỗi lần tập phục vụ đổi. */
  whileServed(namespaces: readonly string[], register: (served: Set<string>) => unknown): void;
}

/** Seam từ điển (seam locale). */
export interface LocaleSeamLike {
  /** Bind một namespace từ điển thành hàm t(key). */
  bind(namespace: string): (key: ShellSettingsLocaleKey) => string;
  /** Đăng ký từ điển của một namespace. */
  register(namespace: string, copy: Record<string, Record<string, string>>): unknown;
}

/** Context phía browser (chỉ khai phần row này dùng). */
export interface ClientContextLike {
  /** Đăng ký một hiệu ứng có thể huỷ; callback trả hàm huỷ (hoặc giá trị bất kỳ, như seam thật). */
  effect(callback: () => unknown, label?: string): unknown;
  /** Seam từ điển. */
  locale: LocaleSeamLike;
  /** Seam khe cắm. */
  slots: SlotsSeamLike;
  /** Seam form cấu hình. */
  configForms: ConfigFormsSeamLike;
}

/** Plugin phía browser do factory dựng ra. */
export interface ShellSettingsPlugin {
  /** Gắn trang cài đặt shell executor vào app. */
  apply(ctx: ClientContextLike): void;
  /** Dịch vụ bắt buộc (cordis fiber inject). */
  inject: string[];
}

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
 * @param requireFn - require cua bang module (react/jsx-runtime + ui-primitives).
 * @returns plugin { apply, inject } — tu dien + hai cau noi form + mot the Settings.
 */
export function createPlugin(requireFn: RequireFn): ShellSettingsPlugin {
  const inject = ["slots", "locale", "configForms"];
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
      console.error("gbh-client-ui-settings-shell: apply nem loi", error);
      throw error;
    }
  };

  /**
   * Than cua apply (giu nguyen hanh vi ban dau).
   * @param ctx - context phia browser.
   */
  const applyInner = (ctx: ClientContextLike): void => {
    const runtime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
    const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule & CardPrimitivesLike;
    const ShellCard = createShellCard(runtime, primitives);
    const t = ctx.locale.bind(NS);
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-settings-shell: dictionaries");
    // Hai shell executor đều được ghép trong profile (POSIX ngoài Windows, PowerShell trên Windows);
    // trang này giữ form cho CẢ HAI và chỉ hiện cái mà Host đang phục vụ.
    const bash = createShellCardController(primitives, ctx.configForms.get(BASH_NS));
    const pwsh = createShellCardController(primitives, ctx.configForms.get(PWSH_NS));
    ctx.effect(
      () => () => {
        bash.dispose();
        pwsh.dispose();
      },
      "ui-settings-shell: form subscriptions",
    );
    ctx.effect(
      () =>
        ctx.configForms.whileServed([BASH_NS, PWSH_NS], (served) =>
          ctx.slots.inject("plugins.item", () =>
            ctx.slots.register(
              {
                name: "plugins.item",
                id: "shell",
                order: 40,
                label: () => t("title"),
                locale: NS,
                inject: () => (served.has(PWSH_NS) ? pwsh : bash).inject(),
              },
              ShellCard,
            ),
          ),
        ),
      "ui-settings-shell: page",
    );
  };
  return { apply, inject };
}
