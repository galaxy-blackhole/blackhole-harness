/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua host cua row ui-settings: khai Config (enabled) va bao kernel settings chay che do auto=false
 */

import z from "@deepseek-ai/schemastery";

/** Truong cau hinh ma row nay so huu (Host giu gia tri, browser doc qua configForms). */
const DeveloperToolsSettingsFields = { enabled: z.boolean().default(true) };

/** Schema cau hinh cua row: settings cua kernel doc de render/validate. */
export const Config = z.object({ enabled: DeveloperToolsSettingsFields.enabled.volatile() });

/** Context toi thieu cua nua host (seam settings cua kernel). */
interface HostContext {
  /** Fiber cua plugin (dung khi bao kernel cau hinh). */
  readonly fiber: unknown;
  /**
   * Inject seam settings.
   * @param names - ten seam.
   * @param run - ham chay khi seam co.
   */
  inject(names: readonly string[], run: (child: SettingsChild) => void): void;
}

/** Context con sau khi inject seam settings. */
interface SettingsChild {
  /**
   * Dang ky hieu ung song theo plugin.
   * @param effect - ham tra ve disposer.
   */
  effect(effect: () => void | (() => void)): void;
  /** Seam settings cua kernel. */
  readonly settings: {
    /**
     * Bao kernel rang cau hinh cua plugin nay duoc quan ly tu dong hay khong.
     * @param options - tuy chon (auto).
     * @param fiber - fiber cua plugin.
     */
    configure(options: { auto: boolean }, fiber: unknown): void;
  };
}

/**
 * Than plugin phia Host: chi bao kernel rang cau hinh cua row nay khong tu dong.
 * @param ctx - context phia Host.
 */
export function apply(ctx: HostContext): void {
  ctx.inject(["settings"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}
