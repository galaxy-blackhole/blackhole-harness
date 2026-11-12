/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cau noi dang nhap Desktop so huu viec do credential cua model cho ca man chao va buoc gioi thieu
 */

/** Cau noi dang nhap Desktop do vo tiem vao. */
export interface OnboardingBridge {
  /** Bat/tat co "buoc gioi thieu dang chiem man hinh". */
  setActive(active: boolean): void;
  /** Co API key nao da duoc cau hinh khong. */
  hasApiKey(): Promise<boolean>;
}

/**
 * Doc dung su that credential an toan ma man dang nhap native dung.
 * @returns co API key da cau hinh hay khong; nem loi khi cau noi Desktop khong co.
 */
export async function readOnboardingApiKeyPresence(): Promise<boolean> {
  const bridge = (globalThis as Record<string, unknown>)["dshOnboarding"] as OnboardingBridge | undefined;
  if (bridge === undefined) throw new Error("desktop login bridge unavailable");
  return bridge.hasApiKey();
}
