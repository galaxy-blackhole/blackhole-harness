/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Diem vao nua browser: xuat factory de build.ts boc thanh script classic dang ky MOT id module (id cua ta)
 */

// Bundle browser KHÔNG được là ESM: loader nạp nó bằng thẻ `<script>` classic, nên build.ts bundle phần này ở
// dạng CJS rồi bọc trong `window.__ModuleLoader__.load({ id, factory })`. Vì vậy file này chỉ xuất factory,
// không tự gọi `load` (việc của tầng script), và không import gói ngoài.
export { createPlugin } from "./plugin.ts";
export type { ClientPlugin, QuestionRecord } from "./plugin.ts";
export type { PendingQuestion, PlanReview, QuestionAnswer, QuestionComposerProps, QuestionWait } from "./contract.ts";
export type { QuestionKey } from "./locales.ts";
