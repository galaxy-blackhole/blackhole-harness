/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mặt vào của gói experimental-translator: export ĐÚNG hai tên như bản gốc (TranslationError · default Translator)
 *      và tái xuất các kiểu của mặt ./types
 */

export { TranslationError } from "./error.ts";
export { default } from "./plugin.ts";
export type {
  TranslationErrorCode,
} from "./error.ts";
export type {
  TranslationProvider,
  TranslationRequest,
  TranslationSpec,
  TranslationIdentity,
  TranslationRequestRecord,
} from "./types.ts";
