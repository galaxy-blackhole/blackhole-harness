/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nội suy `{{variable}}` NGHIÊM NGẶT và dựng chữ cho model: prompt từ các mục,
 *      ảnh chụp ngữ cảnh runtime dạng chuỗi, và ảnh chụp dạng các mục có tên nguồn.
 */

import type { AssembledContext, AssembledSection, ContextSnapshotSection, PromptAssembly } from "./types.ts";

/** Tên biến hợp lệ: cách viết giữa hai cặp ngoặc nhọn. */
export const VARIABLE_NAME = /^[a-z][a-z0-9_]*$/;

/** Một nhóm tham chiếu `{{...}}` HOÀN CHỈNH ngay tại vị trí quét (kiểm tên sau). */
const GROUP_AT = /^\{\{([^{}]*)\}\}/;

/**
 * Nội suy MỘT mục hoặc ngữ cảnh và quy chẩn đoán về đúng đầu vào sở hữu nó.
 * Nhận: mục đã giải chữ, bảng giá trị biến, và loại đầu vào ("section" | "context").
 * Trả: chữ sau nội suy; ném lỗi khi tham chiếu hỏng/không đăng ký/không có giá trị.
 */
function interpolate(input: AssembledSection | AssembledContext, variables: Record<string, string | undefined>, kind: string): string {
  const text = input.text;
  let result = "";
  let last = 0;
  for (let open = text.indexOf("{{"); open >= 0; open = text.indexOf("{{", last)) {
    const group = GROUP_AT.exec(text.slice(open));
    if (group === null) {
      if (text.indexOf("}}", open + 2) >= 0) throw new Error(`malformed prompt variable reference at "${text.slice(open, open + 16)}…" in ${kind} "${input.name}" (references are complete simple {{name}} groups)`);
      result += text.slice(last, open + 2);
      last = open + 2;
      continue;
    }
    const name = group[0].slice(2, -2);
    if (!VARIABLE_NAME.test(name)) throw new Error(`malformed prompt variable reference "{{${name}}}" in ${kind} "${input.name}" (variable names match ${String(VARIABLE_NAME)})`);
    if (!Object.hasOwn(variables, name)) {
      const known = Object.keys(variables);
      throw new Error(`unknown prompt variable "{{${name}}}" in ${kind} "${input.name}"; registered variables: ${known.length > 0 ? known.join(", ") : "(none)"}`);
    }
    const value = variables[name];
    if (value === undefined) throw new Error(`prompt variable "{{${name}}}" has no value for this assembly (${kind} "${input.name}")`);
    result += text.slice(last, open) + value;
    last = open + group[0].length;
  }
  return result + text.slice(last);
}

/**
 * Nội suy `{{variable}}` nghiêm ngặt, bỏ mục rỗng, rồi nối phần còn lại bằng dòng trống.
 * Nhận: bản lắp có mục và bảng biến.
 * Trả: prompt đã dựng, hoặc `''` khi mọi mục đều rỗng.
 */
export function renderPrompt(assembly: PromptAssembly): string {
  return assembly.sections
    .map((section) => (section.interpolate === false ? section.text : interpolate(section, assembly.variables, "section")))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

/**
 * Dựng TOÀN BỘ ảnh chụp ngữ cảnh động, giữ nguyên các đóng góp `interpolate: false`.
 * Nhận: bản lắp có ngữ cảnh và bảng biến.
 * Trả: ảnh chụp hiện tại, hoặc `''` khi không có ngữ cảnh nào.
 */
export function renderContextSnapshot(assembly: PromptAssembly): string {
  return joinContextSections(renderContextSections(assembly));
}

/**
 * Chữ ảnh chụp hướng tới model cho một danh sách mục ĐÃ dựng sẵn.
 * Nhận: các mục từ {@link renderContextSections}.
 * Trả: ảnh chụp hiện tại, hoặc `''` khi không có ngữ cảnh nào.
 */
export function joinContextSections(sections: readonly ContextSnapshotSection[]): string {
  const body = sections.map((section) => section.text).join("\n\n");
  if (body.length === 0) return "";
  return `Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\n\n${body}`;
}

/**
 * Ảnh chụp GIỮ NGUYÊN tên các đóng góp đã hợp thành nó.
 * Nhận: bản lắp có ngữ cảnh và bảng biến.
 * Trả: mỗi ngữ cảnh đóng góp dựng ra chữ khác rỗng, kèm tên của nó.
 */
export function renderContextSections(assembly: PromptAssembly): ContextSnapshotSection[] {
  return assembly.contexts
    .map((context) => ({
      name: context.name,
      text: context.interpolate === false ? context.text : interpolate(context, assembly.variables, "context"),
    }))
    .filter((section) => section.text.length > 0);
}
