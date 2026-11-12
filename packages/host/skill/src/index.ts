/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc MẶT PLUGIN của gói: phơi ĐÚNG bề mặt của bản gốc — lớp dịch vụ `SkillRegistry` (mặc định),
 *      ngữ pháp tên, hai công tắc gọi, phép phơi `<skill_content>`, phép thoát chữ, và hằng hạng
 *      của nhà cung cấp đóng gói
 */

export { BUNDLED_SKILL_RANK, escapeText, isModelInvocable, isSkillName, isUserInvocable, renderSkillContent } from "./render.ts";
export { SkillRegistry } from "./registry.ts";
export { SkillRegistry as default } from "./registry.ts";
export type {
  Config,
  SkillCandidate,
  SkillCatalogSnapshot,
  SkillDefinition,
  SkillInvocationPolicy,
  SkillInvocationSource,
  SkillLookupOptions,
  SkillProvider,
  SkillProviderControl,
  SkillProviderObservation,
  SkillRegistration,
  SkillResourceBase,
  SkillSource,
  SkillSummary,
  SkillViewOptions,
} from "./types.ts";
