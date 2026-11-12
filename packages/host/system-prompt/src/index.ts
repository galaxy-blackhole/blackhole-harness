/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sổ đăng ký cho các đầu vào prompt được lắp TRƯỚC MỖI bước model: mục prompt có thứ tự,
 *      ngữ cảnh động, schema tool và biến nội suy — hai lớp (global + scope) và waterfall
 *      `system-prompt/assemble`. Viết lại theo hành vi của @deepseek-ai/dsh-system-prompt.
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { ScopedLayers, scopeTarget } from "@deepseek-ai/dsh-scope";
import type { Scoped } from "@deepseek-ai/dsh-scope";
import { CONTEXT_ORDERS, SECTION_ORDERS } from "./types.ts";
import type {
  AssembleContext,
  AssembledContext,
  AssembledSection,
  ContextSnapshotSection,
  PromptAssembly,
  PromptContext,
  PromptContextOrderName,
  PromptSection,
  PromptSectionOrderName,
  ToolProviderResult,
  ToolSchema,
} from "./types.ts";
import { VARIABLE_NAME, joinContextSections, renderContextSections, renderContextSnapshot, renderPrompt } from "./render.ts";
import { TOOL_ORDER_REST, comparePromptSections, orderTools, validateToolOrder } from "./order.ts";
import { PromptLayer } from "./layer.ts";
import type { ToolProvider, VariableProvider } from "./layer.ts";

/**
 * Tên mục persona prefix của deployment. Export vì một composition có thể THAY chỗ này —
 * preset agent che persona của deployment bằng mục của nó — và cả hai bên gọi CÙNG tên mục
 * là thứ làm việc thay thế hoạt động, thay vì sinh thêm một mục trùng.
 */
export const PERSONA_PREFIX_SECTION = "deployment:persona-prefix";

/** Tên mục persona suffix của deployment, dùng chung cho đóng góp global và theo scope. */
export const PERSONA_SUFFIX_SECTION = "deployment:persona-suffix";

/**
 * Cấu hình plugin: phần system prompt do deployment soạn.
 */
export interface Config {
  /** Có chèn danh tính cố định của Galaxy Blackhole trước persona của deployment không (mặc định `true`). */
  includeHarnessIdentity?: boolean;
  /** Có chèn ảnh chụp ngữ cảnh runtime tuỳ chọn vào lịch sử model không (mặc định `true`); ngữ cảnh `required` vẫn còn. */
  includeRuntimeContext?: boolean;
  /**
   * Mẫu persona prefix của TOÀN deployment, đặt trước hướng dẫn first-party. Một mục theo scope tên
   * `deployment:persona-prefix` sẽ che nó; tham chiếu `{{variable}}` là NGHIÊM NGẶT.
   */
  personaPrefix?: string;
  /**
   * Mẫu persona suffix, đặt sau hướng dẫn first-party. Một mục theo scope
   * `deployment:persona-suffix` sẽ che nó; tham chiếu `{{variable}}` là NGHIÊM NGẶT. Mặc định rỗng.
   */
  personaSuffix?: string;
  /**
   * Tên tool hướng tới model, theo đúng thứ tự, chứa {@link TOOL_ORDER_REST} ĐÚNG MỘT lần.
   * Trường không hợp lệ làm hỏng lúc nạp và tên lạ làm hỏng lúc lắp; tên đã biết nhưng bị ẩn ở
   * một phạm vi có thể vắng ở đó. Vắng mặt = thứ tự từ điển.
   */
  toolOrder?: string[];
}

/**
 * Hai bề mặt của context mà sổ này THỰC SỰ dùng, khai theo CẤU TRÚC.
 *
 * ⚠️ KHÔNG augment `Context`/`Events` của cordis: gói gốc đã augment hai bề mặt đó, và
 * `@deepseek-ai/dsh-agent` (được nhiều gói trong repo mượn kiểu) kéo `.d.ts` gốc vào CÙNG
 * chương trình tsc ⇒ augment thêm sẽ đỏ `TS2717` (đo thật 18/10/2026: hai lớp `SystemPrompt`
 * khác nhau cho cùng một thuộc tính). Repo đã có tiền lệ: các gói chỉ mượn seam đều khai theo
 * hình dạng (`harness-dev-context`, `mcp-resources`, `approval`).
 */
interface PromptContextSurface {
  /** Phát một sự kiện không lọc phạm vi (ở đây: `system-prompt/change`). */
  emit(event: "system-prompt/change"): void;
  /**
   * Chạy waterfall có lọc phạm vi trên bản lắp.
   * Nhận: vật mang phạm vi, tên sự kiện, bản lắp, ngữ cảnh lượt lắp, và bước kế.
   * Trả: bản lắp sau waterfall (giá trị của người nghe cuối là chính thức).
   */
  waterfall(receiver: Scoped<SystemPrompt>, event: "system-prompt/assemble", assembly: PromptAssembly, context: AssembleContext, next: () => Promise<PromptAssembly>): Promise<PromptAssembly>;
}

/**
 * Giải MỘT đăng ký ngữ cảnh runtime mà không dựng mục hay tool nào.
 * Nhận: mục đăng ký và ngữ cảnh của lượt lắp.
 * Trả: mục đã giải chữ, kèm cờ `interpolate` khi bản gốc có khai.
 */
function resolveContext(entry: PromptContext, context: AssembleContext): AssembledContext {
  return {
    name: entry.name,
    text: typeof entry.text === "function" ? entry.text(context) : entry.text,
    ...(entry.interpolate !== undefined ? { interpolate: entry.interpolate } : {}),
  };
}

/** Sổ đăng ký cho các đầu vào prompt được lắp trước mỗi bước model. */
export class SystemPrompt extends Service {
  /** Schema cấu hình để Settings/config-editor của kernel render được từng trường. */
  static Config = z.object({
    includeHarnessIdentity: z.boolean().default(true),
    includeRuntimeContext: z.boolean().default(true),
    personaPrefix: z.string().default(""),
    personaSuffix: z.string().default(""),
    toolOrder: z.array(z.string()).default(undefined as unknown as string[]),
  }) as unknown as z<Config>;

  /** Hai lớp đăng ký: global dựng sẵn, lớp scope dựng khi có đăng ký đầu tiên. */
  private readonly layers = new ScopedLayers<PromptLayer>(
    (scope) => new PromptLayer(scope),
    () => {
      (this.ctx as unknown as PromptContextSurface).emit("system-prompt/change");
    },
  );

  /** `toolOrder` đã kiểm, hoặc `undefined` để xếp theo từ điển. */
  private readonly toolOrder: readonly string[] | undefined;

  /**
   * Đăng ký service `systemPrompt` và các mục nền của deployment.
   * Nhận: context host và cấu hình đã qua schema.
   * Trả: thực thể đã đăng ký (persona prefix/suffix và danh tính harness đã vào sổ).
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "systemPrompt");
    this.toolOrder = validateToolOrder(config.toolOrder);
    if (config.includeHarnessIdentity ?? true) {
      this.section({
        name: "harness:identity",
        order: this.getSectionOrder("HARNESS_IDENTITY"),
        text: "You are an AI agent powered by Galaxy Blackhole.",
      });
    }
    this.section({
      name: PERSONA_PREFIX_SECTION,
      order: this.getSectionOrder("DEPLOYMENT_PERSONA_PREFIX"),
      text: config.personaPrefix ?? "",
    });
    this.section({
      name: PERSONA_SUFFIX_SECTION,
      order: this.getSectionOrder("DEPLOYMENT_PERSONA_SUFFIX"),
      text: config.personaSuffix ?? "",
    });
    if (!(config.includeRuntimeContext ?? true)) this.suppressRuntimeContext();
  }

  /**
   * Đăng ký một mục prompt có thứ tự vào phạm vi của context đang gọi. Mục theo scope che mục
   * global cùng tên; trùng tên trong MỘT lớp và thứ tự không hữu hạn thì ném lỗi. Đăng ký và
   * dọn dẹp đều phát `system-prompt/change`.
   * Nhận: mục cần đăng ký.
   * Trả: đúng bộ huỷ effect của Cordis.
   */
  section(section: PromptSection): () => void {
    if (!Number.isFinite(section.order)) throw new TypeError(`prompt section "${section.name}" order must be a finite number`);
    return this.layers.effect(this.ctx, (layer) => layer.sections.insert(section.name, section), { label: "systemPrompt.section()" });
  }

  /**
   * Tra chỗ đặt do trung tâm sở hữu cho một mục prompt của repo.
   * Nhận: tên chỗ đặt ổn định.
   * Trả: thứ tự sắp xếp dạng số của mục.
   */
  getSectionOrder(name: PromptSectionOrderName): number {
    return SECTION_ORDERS[name];
  }

  /**
   * Tra chỗ đặt do trung tâm sở hữu cho một dòng ngữ cảnh runtime của repo.
   * Nhận: tên chỗ đặt ổn định.
   * Trả: thứ tự sắp xếp dạng số của ngữ cảnh.
   */
  getContextOrder(name: PromptContextOrderName): number {
    return CONTEXT_ORDERS[name];
  }

  /**
   * Đăng ký ngữ cảnh động có thứ tự vào phạm vi của context đang gọi. Mục theo scope che mục
   * global cùng tên.
   * Nhận: ngữ cảnh cần đăng ký.
   * Trả: đúng bộ huỷ effect của Cordis.
   */
  context(context: PromptContext): () => void {
    if (!Number.isFinite(context.order)) throw new TypeError(`prompt context "${context.name}" order must be a finite number`);
    return this.layers.effect(this.ctx, (layer) => layer.contexts.insert(context.name, context), { label: "systemPrompt.context()" });
  }

  /**
   * Tắt các đóng góp ngữ cảnh runtime TUỲ CHỌN trong phạm vi của context đang gọi, mà không đổi
   * service nào sở hữu hay cưỡng chế dữ kiện đó. Nhiều bộ tắt vẫn dọn được độc lập.
   * Nhận: không.
   * Trả: đúng bộ huỷ effect của Cordis.
   */
  suppressRuntimeContext(): () => void {
    return this.layers.effect(this.ctx, (layer) => layer.runtimeContextSuppressors.append(true), { label: "systemPrompt.suppressRuntimeContext()" });
  }

  /**
   * Đăng ký provider schema tool trong phạm vi của context đang gọi. Provider global và provider
   * theo scope khớp đều đóng góp; trả về tên dành riêng {@link TOOL_ORDER_REST} làm lắp thất bại.
   * Nhận: provider được gọi cho MỖI lượt lắp kèm ngữ cảnh của lượt đó.
   * Trả: đúng bộ huỷ effect của Cordis.
   */
  tools(provider: ToolProvider): () => void {
    return this.layers.effect(this.ctx, (layer) => layer.toolProviders.append(provider), { label: "systemPrompt.tools()" });
  }

  /**
   * Đăng ký một biến nội suy trong phạm vi của context đang gọi. Giá trị theo scope che giá trị
   * global; tên sai hoặc trùng thì ném lỗi. Provider có thể trả `undefined`, nhưng mục nào tham
   * chiếu giá trị đó thì lúc dựng chữ sẽ thất bại.
   * Nhận: tên tham chiếu `[a-z][a-z0-9_]*` và provider được gọi cho mỗi lượt lắp.
   * Trả: đúng bộ huỷ effect của Cordis.
   */
  variable(name: string, provider: VariableProvider): () => void {
    if (!VARIABLE_NAME.test(name)) throw new Error(`invalid prompt variable name "${name}" (must match ${String(VARIABLE_NAME)})`);
    return this.layers.effect(this.ctx, (layer) => layer.variables.insert(name, provider), { label: "systemPrompt.variable()" });
  }

  /**
   * Làm mới các dữ kiện runtime ĐÃ NHẬN cho bước vào cửa yêu cầu. Ngữ cảnh chỉ do waterfall thêm
   * vẫn giữ giá trị đã nhận; bộ tắt hiện hành bỏ ngữ cảnh tuỳ chọn, và đăng ký `required` còn
   * thiếu được phục hồi theo thứ tự sổ. Mục, tool và biến giữ bản lắp đã nhận.
   * Nhận: bản lắp đã nhận của scope/bước này và ngữ cảnh hiện hành cùng phạm vi.
   * Trả: bản lắp đã nhận với chữ ngữ cảnh runtime do provider HIỆN HÀNH cấp.
   */
  refreshContext(assembly: PromptAssembly, context: AssembleContext = {}): PromptAssembly {
    const providers = this.layers.merge(context.scope, (layer) => layer.contexts);
    const suppressed = !this.layers.global.runtimeContextSuppressors.isEmpty() || this.layers.chainLayers(context.scope).some((layer) => !layer.runtimeContextSuppressors.isEmpty());
    const required = new Map([...providers].filter(([, entry]) => entry.required === true));
    const contexts: AssembledContext[] = [];
    for (const accepted of assembly.contexts) {
      const provider = providers.get(accepted.name);
      required.delete(accepted.name);
      if (suppressed && provider?.required !== true) continue;
      contexts.push(provider === undefined ? accepted : resolveContext(provider, context));
    }
    for (const provider of required.values()) {
      const index = contexts.findIndex((entry) => {
        const next = providers.get(entry.name);
        return next !== undefined && next.order > provider.order;
      });
      contexts.splice(index < 0 ? contexts.length : index, 0, resolveContext(provider, context));
    }
    return { ...assembly, contexts };
  }

  /**
   * Lắp provider global và theo scope, tách tham số tool, áp thứ tự chuẩn, rồi chạy waterfall lắp.
   * Mục và biến theo scope che bản global. Giá trị waterfall trả về là chính thức, TRỪ việc một
   * mục "complete" đang hiệu lực được phục hồi sau đó thành mục prompt DUY NHẤT.
   * Nhận: ngữ cảnh tuỳ chọn (scope + các trường do plugin định nghĩa).
   * Trả: bản lắp sau waterfall, đã cưỡng chế prompt "complete" nếu có.
   */
  async assemble(context: AssembleContext = {}): Promise<PromptAssembly> {
    const scope = context.scope;
    const scopeLayers = this.layers.chainLayers(scope);
    const runtimeContextSuppressed = !this.layers.global.runtimeContextSuppressors.isEmpty() || scopeLayers.some((layer) => !layer.runtimeContextSuppressors.isEmpty());
    const variables: Record<string, string | undefined> = {};
    for (const [name, provider] of this.layers.global.variables.entries()) variables[name] = provider(context);
    for (const layer of scopeLayers) for (const [name, provider] of layer.variables.entries()) variables[name] = provider(context);
    const sectionByName = this.layers.merge(scope, (layer) => layer.sections);
    const contextByName = this.layers.merge(scope, (layer) => layer.contexts);
    const providers = [...this.layers.global.toolProviders.values(), ...scopeLayers.flatMap((layer) => [...layer.toolProviders.values()])];
    const collected: ToolSchema[] = [];
    const knownNames = new Set<string>();
    for (const provider of providers) {
      const result = provider(context);
      const schemas = result.schemas.map(({ name, description, parameters, deferLoading }) => ({
        name,
        description,
        parameters: structuredClone(parameters),
        ...(deferLoading === true ? { deferLoading } : {}),
      }));
      const acceptedKnownNames = result.knownNames ?? schemas.map((tool) => tool.name);
      collected.push(...schemas);
      for (const name of acceptedKnownNames) knownNames.add(name);
    }
    const sectionDefinitions = [...sectionByName.values()].sort(comparePromptSections);
    const completeSections = sectionDefinitions.filter((section) => section.complete === true);
    if (completeSections.length > 1) throw new Error(`multiple complete prompt sections are active: ${completeSections.map((section) => JSON.stringify(section.name)).join(", ")}`);
    const assembledSections: AssembledSection[] = [];
    let completeSection: AssembledSection | undefined;
    for (const section of sectionDefinitions) {
      const assembled: AssembledSection = {
        name: section.name,
        text: typeof section.text === "function" ? section.text(context) : section.text,
        ...(section.interpolate !== undefined ? { interpolate: section.interpolate } : {}),
      };
      if (section.complete === true) completeSection = { ...assembled };
      assembledSections.push(assembled);
    }
    const assembly: PromptAssembly = {
      sections: assembledSections,
      contexts: [...contextByName.values()].filter((entry) => !runtimeContextSuppressed || entry.required === true).sort((a, b) => a.order - b.order).map((entry) => resolveContext(entry, context)),
      tools: orderTools(collected, this.toolOrder, knownNames),
      variables,
    };
    const transformed = await (this.ctx as unknown as PromptContextSurface).waterfall(
      scopeTarget(this, scope),
      "system-prompt/assemble",
      assembly,
      context,
      () => Promise.resolve(assembly),
    );
    if (completeSection === undefined && !runtimeContextSuppressed) return transformed;
    const requiredContexts = new Set([...contextByName.values()].filter((entry) => entry.required === true).map((entry) => entry.name));
    return {
      ...transformed,
      sections: completeSection === undefined ? transformed.sections : [completeSection],
      contexts: runtimeContextSuppressed ? transformed.contexts.filter((entry) => requiredContexts.has(entry.name)) : transformed.contexts,
    };
  }
}

export default SystemPrompt;
export { joinContextSections, renderContextSections, renderContextSnapshot, renderPrompt, TOOL_ORDER_REST };
export type { AssembleContext, AssembledContext, AssembledSection, ContextSnapshotSection, PromptAssembly, PromptContext, PromptContextOrderName, PromptSection, PromptSectionOrderName, ToolProviderResult };
