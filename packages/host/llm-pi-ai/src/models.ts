/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng models của @deepseek-ai/dsh-llm-pi-ai — port 1:1 lib/index.js dòng 738–793 (nguồn
 *      per-file: lib/types/models.js): helper model pi-ai ghép từ các entry point HẸP công khai —
 *      tạo collection Models rỗng, tạo provider tĩnh một-giao-thức cho route tuỳ biến, suy ra
 *      mức reasoning khả dụng và chế độ cập nhật transcript từ metadata của chính model.
 */

import type { LlmResolvedModelInfo } from "@deepseek-ai/dsh-llm";
import type {
  Api,
  CreateModelsOptions,
  Model,
  ModelThinkingLevel,
  MutableModels,
  Provider,
  ProviderAuth,
  ProviderStreams,
} from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { THINKING_LEVELS } from "./catalog.ts";

/** pi-ai model helpers assembled from public narrow entry points. */

/**
 * Input accepted by the static, single-protocol providers this package builds.
 * Nhận: id/tên provider, baseUrl tuỳ chọn, auth, danh sách model tĩnh, và giao thức stream.
 * Trả: hình dạng đầu vào mà `createProvider` đóng gói thành một pi-ai Provider.
 */
interface StaticProviderOptions {
  id: string;
  name: string;
  baseUrl?: string;
  auth: ProviderAuth;
  models: readonly Model<Api>[];
  api: ProviderStreams;
}

/**
 * Create an empty pi-ai collection without importing its aggregate entry point.
 * Nhận: options — nơi lưu credential và tích hợp auth ambient (tuỳ chọn).
 * Trả: collection MutableModels đã xoá hết provider đăng ký sẵn.
 */
export function createModels(options?: CreateModelsOptions): MutableModels {
  const models = builtinModels(options);
  models.clearProviders();
  return models;
}

/**
 * Create the static, single-protocol provider used by configured custom routes.
 * Nhận: input — danh tính provider, model, auth, và giao thức thực thi.
 * Trả: provider uỷ thác từng thao tác cho giao thức được truyền vào.
 */
export function createProvider(input: StaticProviderOptions): Provider {
  return {
    id: input.id,
    name: input.name,
    ...input.baseUrl === void 0 ? {} : { baseUrl: input.baseUrl },
    auth: input.auth,
    getModels: () => input.models,
    stream: (model, context, options) => input.api.stream(model, context, options),
    streamSimple: (model, context, options) => input.api.streamSimple(model, context, options),
  };
}

/**
 * Resolve selectable reasoning levels from pi-ai's public model metadata.
 * Nhận: model — descriptor model mang cờ hỗ trợ reasoning và ánh xạ mức lên wire.
 * Trả: các mức được hỗ trợ, theo đúng thứ tự leo thang của pi-ai.
 */
export function getSupportedThinkingLevels(model: Model<Api>): ModelThinkingLevel[] {
  if (!model.reasoning) return ["off"];
  return THINKING_LEVELS.filter((level) => {
    const mapped = model.thinkingLevelMap?.[level];
    if (mapped === null) return false;
    if (level === "xhigh" || level === "max") return mapped !== void 0;
    return true;
  });
}

/**
 * Resolve transcript update modes from the exact model's protocol capabilities.
 * Nhận: model — model pi-ai đã materialize, kèm cờ tương thích của catalog.
 * Trả: chế độ cập nhật mà prompt admission và tool-history projection tiêu thụ.
 */
export function conversationUpdates(model: Model<Api>): Pick<LlmResolvedModelInfo, "systemPromptUpdate" | "toolUpdate"> {
  const compat = model.compat;
  if (compat === void 0 || !("supportsMidConvoSystemMessages" in compat) || !compat.supportsMidConvoSystemMessages) return {};
  const updates: Pick<LlmResolvedModelInfo, "systemPromptUpdate" | "toolUpdate"> = { systemPromptUpdate: "in-history" };
  if (model.api === "anthropic-messages" && "supportsMidConvoToolChanges" in compat && compat.supportsMidConvoToolChanges) updates.toolUpdate = "in-history";
  else if (model.api === "openai-completions" && "supportsMidConvoToolAdditions" in compat && compat.supportsMidConvoToolAdditions) updates.toolUpdate = "addition-only";
  else if ((model.api === "openai-responses" || model.api === "azure-openai-responses" || model.api === "openai-codex-responses") && ("supportsAdditionalTools" in compat && compat.supportsAdditionalTools || "supportsToolSearch" in compat && compat.supportsToolSearch)) updates.toolUpdate = "addition-only";
  return updates;
}
