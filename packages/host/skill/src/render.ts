/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phần THUẦN của seam kỹ năng: ngữ pháp tên, hai công tắc gọi, và phép phơi `<skill_content>`
 *      cho model — chép trung thành từng ký tự của bản gốc để hai đường (tool `skill` và lượt
 *      gọi do người chỉ định) cho ra ĐÚNG một hình dạng
 */

import type { SkillDefinition, SkillSummary } from "./types.ts";

/** Ngữ pháp công khai của tên kỹ năng: kebab-case, không gạch đầu/cuối, không hai gạch liền. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Hạng chuẩn cho nhà cung cấp kỹ năng đóng gói và các gốc cục bộ đi kèm. */
export const BUNDLED_SKILL_RANK = 600;

/**
 * Cho biết một chuỗi có phải tên kỹ năng kebab-case hợp lệ hay không.
 * Nhận: chuỗi ứng viên cần kiểm.
 * Trả: `true` khi chuỗi khớp ngữ pháp công khai của tên kỹ năng.
 */
export function isSkillName(name: string): boolean {
  return SKILL_NAME.test(name);
}

/**
 * Cho biết một kỹ năng có được phép hiện cho model và được model nạp hay không.
 * Nhận: siêu dữ liệu kỹ năng đã mang công tắc gọi đã phân giải.
 * Trả: `true` khi chính sách cho phép model gọi.
 */
export function isModelInvocable(skill: Pick<SkillSummary, "invocation">): boolean {
  return skill.invocation.modelInvocable;
}

/**
 * Cho biết một kỹ năng có được phép hiện cho và nạp bởi lệnh dành cho NGƯỜI hay không.
 * Nhận: siêu dữ liệu kỹ năng đã mang công tắc gọi đã phân giải.
 * Trả: `true` khi chính sách cho phép người gọi.
 */
export function isUserInvocable(skill: Pick<SkillSummary, "invocation">): boolean {
  return skill.invocation.userInvocable;
}

/**
 * Phơi MỘT kỹ năng đã nạp cho model. Kết quả được dùng NGUYÊN VĂN bởi cả kết quả của tool `skill`
 * lẫn phần chèn của lượt gọi do người chỉ định, nên model thấy đúng một hình dạng
 * `<skill_content>` trên cả hai đường. Tên đi trong thuộc tính đã thoát; thân được nhúng nguyên văn
 * (kỹ năng là nội dung cục bộ đáng tin, còn chữ do người dùng gõ nằm NGOÀI vỏ này).
 * Nhận: tên, nhà cung cấp, gốc tài nguyên tuỳ chọn và thân cần phơi.
 * Trả: khối `<skill_content>` hoàn chỉnh hướng tới model.
 */
export function renderSkillContent(
  skill: Pick<SkillDefinition, "name" | "provider" | "resourceBase" | "content">,
): string {
  const resourceHint = renderResourceHint(skill);
  return [
    `<skill_content name="${escapeAttr(skill.name)}">`,
    "<skill_resources>",
    ...resourceHint,
    "</skill_resources>",
    "",
    "<skill_instructions>",
    skill.content,
    "</skill_instructions>",
    "</skill_content>",
  ].join("\n");
}

/**
 * Thoát chữ văn xuôi hướng tới model được nhúng trong khung kỹ năng, để chữ do nhà cung cấp cấp
 * không mở hay đóng được thẻ khung.
 * Nhận: văn xuôi thô cần nhúng.
 * Trả: chữ đã thoát (`&`, `<`, `>`).
 */
export function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * Dựng hai dòng gợi ý tài nguyên cho phần `<skill_resources>`.
 * Nhận: kỹ năng có thể mang gốc tài nguyên (`directory`/`url`/`opaque`).
 * Trả: mảng dòng gợi ý; ném khi gốc tài nguyên là một `kind` chưa biết (union đóng).
 */
function renderResourceHint(skill: Pick<SkillDefinition, "provider" | "resourceBase">): readonly string[] {
  const base = skill.resourceBase;
  if (base === undefined) {
    return [
      `Resources for this skill are managed by provider "${escapeText(skill.provider)}".`,
      "Load referenced resources only as needed.",
    ];
  }
  switch (base.kind) {
    case "directory":
      return [
        `Base directory for this skill: ${escapeText(base.path)}`,
        "Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.",
      ];
    case "url":
      return [
        `Base URL for this skill: ${escapeText(base.url)}`,
        "Resolve relative URLs mentioned by this skill against the base URL before using them. Load referenced resources only as needed.",
      ];
    case "opaque":
      return [
        `Resources for this skill: ${escapeText(base.description)}`,
        "Load referenced resources only as needed.",
      ];
    default:
      return assertNever(base, "SkillResourceBase.kind");
  }
}

/**
 * Thoát một giá trị đặt trong THUỘC TÍNH của khung kỹ năng.
 * Nhận: chuỗi thô (thường là tên kỹ năng).
 * Trả: chuỗi đã thoát `&`, `"`, `<` theo đúng thứ tự của bản gốc.
 */
function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/**
 * Chốt nhánh không bao giờ tới của một union ĐÓNG — chép hành vi của `assertNever` bên
 * `@deepseek-ai/dsh-util-values` (gói ngoài bảng peer §3b, nên cài lại cục bộ).
 * Nhận: giá trị đã bị kiểu thu về `never` và nhãn ngữ cảnh.
 * Trả: không trả — luôn ném `Error` với chuỗi giống bản gốc.
 */
function assertNever(value: never, context: string): never {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context === "" ? "" : ` in ${context}`}: ${rendered}`);
}
