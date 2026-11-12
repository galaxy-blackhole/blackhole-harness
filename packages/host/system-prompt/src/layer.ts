/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Một LỚP đăng ký prompt (global hoặc theo scope): mục, ngữ cảnh, bộ tắt ngữ cảnh runtime,
 *      provider tool và biến nội suy — dùng NGUYÊN các bảng có thứ tự chèn của @deepseek-ai/dsh-scope.
 */

import { AnonymousEntries, NamedEntries } from "@deepseek-ai/dsh-scope";
import type { ScopeKey } from "@deepseek-ai/dsh-scope";
import type { AssembleContext, PromptContext, PromptSection, ToolProviderResult } from "./types.ts";

/** Provider sinh schema tool cho MỘT lượt lắp. */
export type ToolProvider = (context: AssembleContext) => ToolProviderResult;

/** Provider sinh giá trị của một biến nội suy cho MỘT lượt lắp. */
export type VariableProvider = (context: AssembleContext) => string | undefined;

/** Toàn bộ đăng ký prompt thuộc MỘT lớp global hoặc một phạm vi. */
export class PromptLayer {
  /** Các mục prompt có tên, theo thứ tự chèn. */
  readonly sections: NamedEntries<PromptSection>;
  /** Các dòng ngữ cảnh động có tên, theo thứ tự chèn. */
  readonly contexts: NamedEntries<PromptContext>;
  /** Các bộ tắt ngữ cảnh runtime tuỳ chọn — mỗi lần đăng ký một vật độc lập. */
  readonly runtimeContextSuppressors = new AnonymousEntries<true>();
  /** Các provider schema tool, theo thứ tự chèn. */
  readonly toolProviders = new AnonymousEntries<ToolProvider>();
  /** Các biến nội suy có tên, theo thứ tự chèn. */
  readonly variables: NamedEntries<VariableProvider>;

  /**
   * Dựng một lớp prompt với chẩn đoán riêng theo phạm vi sở hữu.
   * Nhận: scope sở hữu, hoặc `undefined` cho đăng ký global.
   * Trả: lớp rỗng, sẵn sàng nhận đăng ký.
   */
  constructor(scope: ScopeKey | undefined) {
    this.sections = new NamedEntries((name) => new Error(scope === undefined ? `prompt section "${name}" is already registered (for a per-agent override, register through that agent's \`agent.ctx\` instead)` : `prompt section "${name}" is already registered in this scope`));
    this.contexts = new NamedEntries((name) => new Error(scope === undefined ? `prompt context "${name}" is already registered (for a per-agent override, register through that agent's \`agent.ctx\` instead)` : `prompt context "${name}" is already registered in this scope`));
    this.variables = new NamedEntries((name) => new Error(scope === undefined ? `prompt variable "${name}" is already registered (for a per-agent value, register through that agent's \`agent.ctx\` instead)` : `prompt variable "${name}" is already registered in this scope`));
  }

  /**
   * Cho biết lớp này có sở hữu đăng ký prompt nào không.
   * Nhận: không.
   * Trả: `true` khi cả năm bảng đều rỗng.
   */
  isEmpty(): boolean {
    return this.sections.isEmpty() && this.contexts.isEmpty() && this.runtimeContextSuppressors.isEmpty() && this.toolProviders.isEmpty() && this.variables.isEmpty();
  }
}
