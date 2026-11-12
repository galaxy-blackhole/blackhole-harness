/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của @galaxy-blackhole/gbh-deepseek-account: phơi ĐÚNG bảy tên như bản gốc — định nghĩa
 *      Service `deepseekAccount` (kèm default), bốn helper header/Cookie/locale, và chính sách huỷ việc.
 */

export { installAccountTaskCancellation, isRunningAccountTask } from "./account-tasks.ts";
export type { AccountTaskAgent, AccountTaskContext, AccountTaskScope } from "./account-tasks.ts";
export { desktopClientHeaders, mergePlatformCookies, platformClientHeaders, platformWireLocale } from "./headers.ts";
export type { DesktopPlatform } from "./headers.ts";
export { DeepSeekAccount } from "./service.ts";
export { DeepSeekAccount as default } from "./service.ts";
export type { PlatformSession } from "./service.ts";
export type {
  AccountBonusBatch,
  AccountBonusNotification,
  AccountBonusOrderId,
  AccountClientMetadata,
  AccountDetails,
  AccountLinks,
  AccountProfile,
  AccountUserId,
  AccountView,
  AccountWallet,
  SignInAttemptId,
  SignInAttemptView,
  SignInErrorCode,
} from "./types.ts";
