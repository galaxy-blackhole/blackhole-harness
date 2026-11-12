/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tuỳ chọn onboarding công khai dùng chung cho hai nửa host và client
 */

import { ONBOARDING_CONFIG_GLOBAL } from "./ids.ts";

export { ONBOARDING_CONFIG_GLOBAL };

/** Tuỳ chọn onboarding đã chuẩn hoá mà nửa client tin dùng. */
export interface OnboardingConfig {
  /** Nửa host có bật bước nhập khoá DeepSeek chính thức không. */
  readonly credentialOnboarding: boolean;
}

/**
 * Chuẩn hoá payload do nửa host phát vào trang.
 *
 * Bản gốc dùng schema schemastery §z.object({ credentialOnboarding: z.boolean().default(true) })§; ở đây
 * luật đó được viết thẳng thành hàm thuần để nửa client KHÔNG phải nhúng schemastery vào bundle
 * (bundle gốc nhúng cả cây cosmokit + schemastery, ~890 dòng, chỉ để chạy đúng một phép kiểm boolean).
 * Hành vi giữ nguyên: thiếu payload ⇒ true; giá trị không phải boolean ⇒ về mặc định true.
 * @param payload - giá trị toàn cục §__GBH_MODELS_ONBOARDING__§, có thể undefined.
 * @returns tuỳ chọn đã chuẩn hoá.
 */
export function resolveOnboardingConfig(payload: unknown): OnboardingConfig {
  const value = (payload as { credentialOnboarding?: unknown } | undefined)?.credentialOnboarding;
  return { credentialOnboarding: typeof value === "boolean" ? value : true };
}

/**
 * Vỏ đang chạy có phải bản desktop (Electron/Tauri) không.
 * @returns true khi trang được phục vụ trong vỏ desktop.
 */
export function isDesktopShell(): boolean {
  return "dshDesktop" in globalThis;
}
