/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vật chất hoá catalog model của MỘT route provider pi-ai: trộn catalog đã cài (theo id) dưới
 *      các entry cấu hình, chuẩn hoá reasoning/compat, và giữ chẩn đoán cho model không phục vụ
 *      được — bản viết lại 1:1 vùng `lib/types/catalog.js` (dòng 256–736) của gói gốc
 *      @deepseek-ai/dsh-llm-pi-ai.
 */

/**
 * Materialization of one provider route's model catalog. The installed pi-ai
 * catalog supplies defaults keyed by model id, and a profile's own model
 * entries override them field by field, so a route naming a catalog provider
 * stays configuration-free while a route pi-ai has never heard of is fully
 * describable from `cordis.patch.yml`.
 *
 * Strict resolution rejects unserviceable models before settings writes.
 * Deferred resolution retains their diagnostics so stored catalog drift does
 * not prevent inspection, repair, or requests to independently valid models.
 *
 * @module dsh-llm-pi-ai/catalog
 */

import type {
  AnthropicMessagesCompat,
  Api,
  BedrockCompat,
  ChatTemplateKwargValue,
  MistralConversationsCompat,
  Model,
  ModelThinkingLevel,
  OpenAICompletionsCompat,
  OpenAIResponsesCompat,
  Provider,
  ThinkingLevelMap,
} from "@earendil-works/pi-ai";
import type { BuiltinProvider } from "@earendil-works/pi-ai/providers/all";
import { builtinProviders, getAllBuiltinModels, getBuiltinModels } from "@earendil-works/pi-ai/providers/all";

/**
 * Pricing for a model the installed catalog does not describe. The harness
 * never reads pi-ai's cost metadata — `replay.ts` zeroes it and no consumer
 * reports spend — so this is the absence of a fact, not a configurable rate.
 */
const NO_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0
};

/**
 * One request modality a pi-ai model may accept.
 * Nhận: không (chỉ là kiểu).
 * Trả: kiểu một phần tử của `Model<Api>['input']`.
 */
export type PiAiModality = Model<Api>["input"][number];

/**
 * Every request modality a profile may declare.
 * Nhận: không.
 * Trả: mọi modality một profile được khai, theo thứ tự khai báo.
 */
export const MODALITIES: readonly PiAiModality[] = Object.keys({
  text: true,
  image: true,
} satisfies Record<PiAiModality, true>) as PiAiModality[];

/**
 * One entry's modality list, or `undefined` when it states no answer. Absent
 * and empty mean the same thing — `[]` describes a model that accepts nothing
 * and could serve no request — which is what makes an entry naming a catalog
 * model without declaring modalities keep the catalog's, since the config
 * schema materializes `[]` for an absent array.
 * @param configured - the list a `models` or `modelOverrides` entry supplied.
 * @returns the declared modalities, or `undefined` to ask the next level.
 */
function declaredInput(configured: readonly PiAiModality[] | undefined): PiAiModality[] | undefined {
  return configured === void 0 || configured.length === 0 ? void 0 : [...configured];
}

/**
 * Every pi-ai thinking level a profile may declare, in escalation order.
 * Nhận: không.
 * Trả: bảy mức thinking pi-ai, theo thứ tự leo thang.
 */
export const THINKING_LEVELS: readonly ModelThinkingLevel[] = Object.keys({
  off: true,
  minimal: true,
  low: true,
  medium: true,
  high: true,
  xhigh: true,
  max: true,
} satisfies Record<ModelThinkingLevel, true>) as ModelThinkingLevel[];

/**
 * One reasoning-dispatch wire format a profile may name.
 * Nhận: không (chỉ là kiểu).
 * Trả: kiểu `thinkingFormat` của `OpenAICompletionsCompat`.
 */
export type PiAiThinkingFormat = NonNullable<OpenAICompletionsCompat["thinkingFormat"]>;

/**
 * Reasoning-dispatch wire formats a profile may name, most-reached first.
 * Nhận: không.
 * Trả: các wire format một profile được đặt tên, thứ tự phổ biến giảm dần.
 */
export const SUPPORTED_THINKING_FORMATS: readonly PiAiThinkingFormat[] = Object.keys({
  "openai": true,
  "deepseek": true,
  "openrouter": true,
  "together": true,
  "baseten": true,
  "zai": true,
  "qwen": true,
  "chat-template": true,
  "qwen-chat-template": true,
  "string-thinking": true,
  "ant-ling": true,
} satisfies Record<PiAiThinkingFormat, true>) as PiAiThinkingFormat[];

/**
 * The output-cap field spellings pi-ai accepts.
 * Nhận: không (chỉ là kiểu).
 * Trả: kiểu `maxTokensField` của `OpenAICompletionsCompat`.
 */
export type PiAiMaxTokensField = NonNullable<OpenAICompletionsCompat["maxTokensField"]>;

/**
 * The output-cap field spellings a profile may name.
 * Nhận: không.
 * Trả: các spelling trường chặn output, theo thứ tự khai báo.
 */
export const MAX_TOKENS_FIELDS: readonly PiAiMaxTokensField[] = Object.keys({
  max_completion_tokens: true,
  max_tokens: true,
} satisfies Record<PiAiMaxTokensField, true>) as PiAiMaxTokensField[];

/**
 * The reasoning-budget field spellings pi-ai accepts.
 * Nhận: không (chỉ là kiểu).
 * Trả: kiểu `thinkingTokenBudgetField` của `OpenAICompletionsCompat`.
 */
export type PiAiThinkingTokenBudgetField = NonNullable<OpenAICompletionsCompat["thinkingTokenBudgetField"]>;

/**
 * The reasoning-budget field spellings a profile may name.
 * Nhận: không.
 * Trả: các spelling trường ngân sách reasoning, theo thứ tự khai báo.
 */
export const THINKING_TOKEN_BUDGET_FIELDS: readonly PiAiThinkingTokenBudgetField[] = Object.keys({
  thinking_token_budget: true,
  thinking_budget: true,
  thinking_budget_tokens: true,
} satisfies Record<PiAiThinkingTokenBudgetField, true>) as PiAiThinkingTokenBudgetField[];

/**
 * The prompt-cache marker conventions pi-ai accepts.
 * Nhận: không (chỉ là kiểu).
 * Trả: kiểu `cacheControlFormat` của `OpenAICompletionsCompat`.
 */
export type PiAiCacheControlFormat = NonNullable<OpenAICompletionsCompat["cacheControlFormat"]>;

/**
 * The prompt-cache marker conventions a profile may name.
 * Nhận: không.
 * Trả: các quy ước marker prompt-cache, theo thứ tự khai báo.
 */
export const CACHE_CONTROL_FORMATS: readonly PiAiCacheControlFormat[] = Object.keys({
  anthropic: true,
} satisfies Record<PiAiCacheControlFormat, true>) as PiAiCacheControlFormat[];

/**
 * The request-state placeholders a `chat_template_kwargs` value may name.
 * Nhận: không (chỉ là kiểu).
 * Trả: kiểu `$var` của `ChatTemplateKwargValue`.
 */
export type PiAiChatTemplateVar = Extract<ChatTemplateKwargValue, {
  $var: string;
}>["$var"];

/**
 * The request-state placeholders a profile may name.
 * Nhận: không.
 * Trả: các placeholder trạng thái request, theo thứ tự khai báo.
 */
export const CHAT_TEMPLATE_VARS: readonly PiAiChatTemplateVar[] = Object.keys({
  "thinking.enabled": true,
  "thinking.effort": true,
  "thinking.budget": true,
} satisfies Record<PiAiChatTemplateVar, true>) as PiAiChatTemplateVar[];

/** Cache chỉ mục provider đã cài; dựng một lần ở lần đọc đầu tiên. */
let providerIndex: Map<string, Provider> | undefined;

/**
 * Whether this adapter serves one installed catalog provider. It dispatches
 * chat requests only, so a provider whose catalog lists models but no chat
 * model (image-generation or classifier models alone) is not a catalog route;
 * a provider whose catalog lists no models at all stays one.
 * @param provider - the installed provider.
 * @returns whether the provider ships a chat model or lists no models.
 */
function servesChat(provider: Provider): boolean {
  const id = provider.id;
  return getBuiltinModels(id as BuiltinProvider).length > 0 || getAllBuiltinModels(id as BuiltinProvider).length === 0;
}

/**
 * Installed catalog providers this adapter serves, by id, constructed once.
 * Each entry owns the API implementations for its own models, which is why a
 * catalog route reuses this provider instead of being rebuilt from parts.
 * @returns the catalog provider index, in catalog order.
 */
function catalogProviders(): Map<string, Provider> {
  providerIndex ??= new Map(builtinProviders().filter(servesChat).map((provider) => [provider.id, provider] as const));
  return providerIndex;
}

/**
 * The installed catalog provider for one route, when pi-ai ships one this
 * adapter serves.
 * Nhận: khoá route `provider`.
 * Trả: catalog provider, hoặc `undefined` với route pi-ai không ship hoặc ship mà không có model chat.
 * @param provider - provider route key.
 * @returns the catalog provider, or `undefined` for a route pi-ai does not ship
 *   or ships without a chat model.
 */
export function catalogProvider(provider: string): Provider | undefined {
  return catalogProviders().get(provider);
}

/**
 * Every provider route the installed pi-ai catalog ships and this adapter
 * serves: a provider whose catalog lists models but no chat model is left out.
 * Nhận: không.
 * Trả: id các catalog provider theo đúng thứ tự catalog.
 * @returns the catalog provider ids, in catalog order.
 */
export function catalogProviderIds(): readonly string[] {
  return [...catalogProviders().keys()];
}

/**
 * The installed catalog models for one route, indexed by model id.
 * Nhận: khoá route `provider`.
 * Trả: model catalog theo id; rỗng khi `catalogProvider` không trả route đó.
 * @param provider - provider route key.
 * @returns catalog models by id; empty for a route {@link catalogProvider} does not return.
 */
export function catalogModels(provider: string): Map<string, Model<Api>> {
  if (!catalogProviders().has(provider)) return new Map();
  const models = getBuiltinModels(provider as BuiltinProvider);
  return new Map(models.map((model) => [model.id, model] as const));
}

/**
 * Selectable reasoning efforts for one model: each key is a level the model
 * offers (and selectors show), and its value is the wire spelling dispatch
 * sends for it. `off` alone may leave its value empty — "supported, send
 * nothing" — because for most providers not thinking is the parameter's
 * absence; every other declared level must name a wire value. A level absent
 * from the dict is not offered.
 * Nhận: không (chỉ là kiểu).
 * Trả: dict mức thinking -> spelling wire (hoặc `null` = "không gửi gì").
 */
export type PiAiReasoningEfforts = Partial<Record<ModelThinkingLevel, string | null>>;

/** Disposition của một field compat trong gate: được cấu hình ("offer") hay bị giữ kín ("withhold"). */
type CompatDisposition = "offer" | "withhold";

/** Gate compat: tên field upstream -> disposition. */
type CompatGate = Readonly<Record<string, CompatDisposition>>;

/**
 * Disposition of every `OpenAICompletionsCompat` field. The `Record` key type
 * is a drift gate: a pi-ai upgrade that adds a field fails compilation here
 * until it is classified, so the offer never silently lags the upstream set.
 */
const COMPLETIONS_COMPAT_GATE = {
  supportsStore: "offer",
  supportsDeveloperRole: "offer",
  supportsReasoningEffort: "offer",
  supportsUsageInStreaming: "offer",
  supportsFinishReason: "offer",
  maxTokensField: "offer",
  requiresToolResultName: "offer",
  requiresAssistantAfterToolResult: "offer",
  requiresThinkingAsText: "offer",
  requiresReasoningContentOnAssistantMessages: "offer",
  thinkingFormat: "offer",
  chatTemplateKwargs: "offer",
  chatTemplateArgs: "offer",
  supportsThinkingTokenBudget: "offer",
  thinkingTokenBudgetField: "offer",
  vllmPriority: "offer",
  supportsStrictMode: "offer",
  cacheControlFormat: "offer",
  supportsLongCacheRetention: "offer",
  openRouterRouting: "withhold",
  vercelGatewayRouting: "withhold",
  zaiToolStream: "withhold",
  supportsOpenAIGrammarTools: "withhold",
  sendSessionAffinityHeaders: "withhold",
  supportsMidConvoSystemMessages: "withhold",
  supportsMidConvoToolAdditions: "withhold",
  sessionAffinityFormat: "withhold",
} as const satisfies Record<keyof OpenAICompletionsCompat, CompatDisposition>;

/**
 * Disposition of every `OpenAIResponsesCompat` field; a drift gate like the one above.
 * Ghi chú port: pi-ai đã cài là 1.3.0, thêm `supportsMidConvoEffort` mà gate gốc (viết cho 0.7.0)
 * không phân loại. Dùng `Partial` để giữ NGUYÊN VĂN hằng số nguồn (không tự phân loại field mới);
 * gate vẫn bắt field bị đổi tên/gỡ bỏ và mọi field được offer vẫn phải có mặt.
 */
const RESPONSES_COMPAT_GATE = {
  supportsDeveloperRole: "offer",
  supportsMaxOutputTokens: "offer",
  supportsStrictMode: "offer",
  supportsLongCacheRetention: "offer",
  sessionAffinityFormat: "withhold",
  supportsOpenAIGrammarTools: "withhold",
  supportsAdditionalTools: "withhold",
  supportsToolSearch: "withhold",
  supportsExplicitPromptCacheMode: "withhold",
  supportsMidConvoSystemMessages: "withhold",
} as const satisfies Partial<Record<keyof OpenAIResponsesCompat, CompatDisposition>>;

/** Disposition of every `AnthropicMessagesCompat` field; a drift gate like the one above. */
const ANTHROPIC_COMPAT_GATE = {
  supportsEagerToolInputStreaming: "offer",
  supportsLongCacheRetention: "offer",
  supportsCacheControlOnTools: "offer",
  supportsTemperature: "offer",
  forceAdaptiveThinking: "offer",
  allowEmptySignature: "offer",
  supportsStrictTools: "offer",
  sendSessionAffinityHeaders: "withhold",
  sessionAffinityFormat: "withhold",
  supportsMidConvoSystemMessages: "withhold",
  supportsMidConvoToolChanges: "withhold",
  supportsMidConvoEffort: "withhold",
  allowedFallbackModels: "withhold",
} as const satisfies Record<keyof AnthropicMessagesCompat, CompatDisposition>;

/** Disposition of every `BedrockCompat` field; a drift gate like the one above. */
const BEDROCK_COMPAT_GATE = {
  supportsStrictMode: "offer",
} as const satisfies Record<keyof BedrockCompat, CompatDisposition>;

/** Disposition of every `MistralConversationsCompat` field. */
const MISTRAL_COMPAT_GATE = {
  supportsMidConvoSystemMessages: "withhold",
} as const satisfies Record<keyof MistralConversationsCompat, CompatDisposition>;

/**
 * The compat gate of every wire protocol a profile may configure.
 *
 * Keyed by protocol, but grouped by pi-ai's compat *type*: the three Responses
 * protocols share `OpenAIResponsesCompat`, so a switch settable on one is
 * settable on all three. Keying by protocol alone would refuse
 * `azure-openai-responses` and `openai-codex-responses` the fields their own
 * models declare.
 */
const COMPAT_GATES: Readonly<Record<string, CompatGate>> = {
  "mistral-conversations": MISTRAL_COMPAT_GATE,
  "openai-completions": COMPLETIONS_COMPAT_GATE,
  "openai-responses": RESPONSES_COMPAT_GATE,
  "azure-openai-responses": RESPONSES_COMPAT_GATE,
  "openai-codex-responses": RESPONSES_COMPAT_GATE,
  "anthropic-messages": ANTHROPIC_COMPAT_GATE,
  "bedrock-converse-stream": BEDROCK_COMPAT_GATE,
};

/** The field names one gate offers. */
type OfferedIn<G> = { [K in keyof G]: G[K] extends "offer" ? K : never }[keyof G];

/** Every compat field name a profile may set, on whichever protocol takes it. */
type OfferedCompatField = OfferedIn<typeof COMPLETIONS_COMPAT_GATE> | OfferedIn<typeof RESPONSES_COMPAT_GATE> | OfferedIn<typeof ANTHROPIC_COMPAT_GATE> | OfferedIn<typeof BEDROCK_COMPAT_GATE> | OfferedIn<typeof MISTRAL_COMPAT_GATE>;

/**
 * pi-ai wire-compatibility switches, set on the route (its models' default) or
 * per model (winning over the route, field by field).
 *
 * pi-ai decides each of these from the provider id and baseURL when no layer
 * sets it, and a private gateway's URL says nothing: for an endpoint it does
 * not recognize the detection answers as though it were OpenAI itself, which
 * is wrong for most OpenAI-compatible gateways. So every field here is one a
 * deployment must be able to state because nothing can infer it, while the
 * fields pi-ai's catalog sets for a named vendor stay withheld.
 *
 * A field belongs to the protocols whose upstream compat type declares it: a
 * model-level switch its protocol does not take fails resolution, and a
 * route-level one skips past models it cannot fit. "The three Responses
 * protocols" below means `openai-responses`, `azure-openai-responses`, and
 * `openai-codex-responses`, which pi-ai gives one shared compat type, so a
 * switch settable on one is settable on all three.
 *
 * Nhận: không (chỉ là kiểu cấu hình).
 * Trả: bề mặt switch compat mà một route/model được khai.
 */
export interface PiAiCompatProfile {
  /** Endpoint có nhận `store` không; `openai-completions`. */
  supportsStore?: boolean;
  /**
   * Endpoint có nhận role `developer` cho system prompt không (pi-ai chỉ gửi cho model
   * reasoning); `false` giữ `system`. `openai-completions` và ba giao thức Responses.
   */
  supportsDeveloperRole?: boolean;
  /** Endpoint có nhận `reasoning_effort` không; `openai-completions`. */
  supportsReasoningEffort?: boolean;
  /** Endpoint có nhận `stream_options: {include_usage: true}` không; `openai-completions`. */
  supportsUsageInStreaming?: boolean;
  /** Stream có kèm `finish_reason` không; `false` để pi-ai tự suy lý do kết thúc; `openai-completions`. */
  supportsFinishReason?: boolean;
  /** Trường chặn output mà endpoint đọc; `openai-completions`. */
  maxTokensField?: NonNullable<OpenAICompletionsCompat["maxTokensField"]>;
  /** Tool result có bắt buộc kèm `name` không; `openai-completions`. */
  requiresToolResultName?: boolean;
  /** Sau tool result, user message có cần một assistant message ở giữa không; `openai-completions`. */
  requiresAssistantAfterToolResult?: boolean;
  /** Thinking block có phải đi dạng text trong dấu `<thinking>` không; `openai-completions`. */
  requiresThinkingAsText?: boolean;
  /** Assistant message replay có cần `reasoning_content` rỗng khi reasoning bật không; `openai-completions`. */
  requiresReasoningContentOnAssistantMessages?: boolean;
  /** Định dạng tham số reasoning endpoint mong đợi; `openai-completions`. */
  thinkingFormat?: PiAiThinkingFormat;
  /**
   * Kwargs gửi dạng `chat_template_kwargs`, pi-ai chỉ đọc dưới hai format `chat-template`;
   * `openai-completions`. Không có kiểm tra cặp đôi: format đang dùng có thể đến từ catalog
   * đã cài hoặc từ detection baseURL của pi-ai, nên kwargs đặt cạnh format khác sẽ không được gửi.
   */
  chatTemplateKwargs?: NonNullable<OpenAICompletionsCompat["chatTemplateKwargs"]>;
  /** Tham số gửi dạng `chat_template_args` dưới format `baseten`; `openai-completions`. */
  chatTemplateArgs?: NonNullable<OpenAICompletionsCompat["chatTemplateArgs"]>;
  /** Alias của `thinkingTokenBudgetField: "thinking_token_budget"`; field tường minh thắng. `openai-completions`. */
  supportsThinkingTokenBudget?: boolean;
  /** Trường request mang ngân sách reasoning từ `thinkingBudgets`; bỏ trống trừ khi được cấu hình. `openai-completions`. */
  thinkingTokenBudgetField?: PiAiThinkingTokenBudgetField;
  /** Ưu tiên scheduler vLLM `priority`; số nhỏ chạy trước, server phải bật priority scheduling. Bỏ trống trừ khi cấu hình. */
  vllmPriority?: number;
  /** `openai-responses` có nhận `max_output_tokens` không; `false` thì bỏ. Azure và Codex bỏ qua field compat dùng chung này. */
  supportsMaxOutputTokens?: boolean;
  /**
   * Endpoint có nhận `strict` trong định nghĩa tool không; `openai-completions`, ba giao thức
   * Responses, `bedrock-converse-stream`.
   */
  supportsStrictMode?: boolean;
  /** Quy ước marker prompt-cache; `openai-completions`. */
  cacheControlFormat?: NonNullable<OpenAICompletionsCompat["cacheControlFormat"]>;
  /**
   * Endpoint có nhận prompt-cache giữ lâu không; `openai-completions`, ba giao thức Responses,
   * `anthropic-messages`.
   */
  supportsLongCacheRetention?: boolean;
  /** Endpoint có nhận `eager_input_streaming` theo từng tool không; `anthropic-messages`. */
  supportsEagerToolInputStreaming?: boolean;
  /** Endpoint có nhận `cache_control` trên định nghĩa tool không; `anthropic-messages`. */
  supportsCacheControlOnTools?: boolean;
  /** Endpoint có nhận trường request `temperature` không; `anthropic-messages`. */
  supportsTemperature?: boolean;
  /** Có ép adaptive thinking bất kể model id không; `anthropic-messages`. */
  forceAdaptiveThinking?: boolean;
  /** Có replay thinking signature rỗng thay vì chuyển thinking thành text không; `anthropic-messages`. */
  allowEmptySignature?: boolean;
  /** Endpoint có nhận schema tool strict của Anthropic không; `anthropic-messages`. */
  supportsStrictTools?: boolean;
}

/** Compile-time constraint that `T` is `never`. */
type AssertNever<T extends never> = T;

/**
 * Proof that every documented field is one a gate offers. A field the profile
 * declares past the gates fails compilation with its own name in the error.
 * Nhận: không (chỉ là chứng minh lúc biên dịch).
 * Trả: `never` khi mọi field của profile đều nằm trong tập gate offer.
 */
export type EveryProfileFieldIsOffered = AssertNever<Exclude<keyof PiAiCompatProfile, OfferedCompatField>>;

/**
 * Proof that every offered field is documented. A gate entry flipped to
 * `offer` without a profile field fails compilation with its own name in the
 * error, which is the half a schema alone cannot catch.
 * Nhận: không (chỉ là chứng minh lúc biên dịch).
 * Trả: `never` khi mọi field được offer đều có mặt trong profile.
 */
export type EveryOfferedFieldIsDocumented = AssertNever<Exclude<OfferedCompatField, keyof PiAiCompatProfile>>;

/** Compile-time constraint that `T` is `true`. */
type AssertTrue<T extends true> = T;

/** Every compat type a gate classifies, merged so one `Pick` reaches all offered fields. */
type UpstreamCompat = OpenAICompletionsCompat & OpenAIResponsesCompat & AnthropicMessagesCompat & BedrockCompat & MistralConversationsCompat;

/**
 * Proof that each documented field carries its upstream type, not a hand-copied
 * restatement of it. The name gates above pin *which* fields exist; this pins
 * their types, in both directions because each catches a different drift.
 * Nhận: không (chỉ là chứng minh lúc biên dịch).
 * Trả: `true` khi mọi field của profile khớp đúng kiểu upstream theo cả hai chiều.
 */
export type EveryProfileFieldMatchesUpstream = AssertTrue<
  PiAiCompatProfile extends Partial<Pick<UpstreamCompat, OfferedCompatField>>
    ? Partial<Pick<UpstreamCompat, OfferedCompatField>> extends PiAiCompatProfile
      ? true
      : false
    : false
>;

/**
 * The compat gate of one resolved protocol. A `string` lookup rather than a
 * keyed read: a route's `api` is configuration, so it may name a protocol
 * pi-ai gives no compat type — or none at all.
 * @param api - resolved wire protocol.
 * @returns that protocol's field gate, or `undefined` when it takes no compat.
 */
function compatGate(api: string): CompatGate | undefined {
  return COMPAT_GATES[api];
}

/**
 * The compat entries a profile actually set.
 *
 * schemastery materializes an absent dict as `{}` — the behavior
 * `reasoningEfforts` works around with a union — so every parsed profile
 * carries both template-argument keys whether or not anyone wrote them. An
 * empty one states nothing here: it would send no arguments, which is exactly
 * what leaving the field out does, so absent and empty are the same request
 * and neither may make a route look like it configured a switch. A valueless
 * scalar is the other thing schemastery lets through, and it is refused by
 * {@link assertOfferedCompatFields} before this runs rather than filtered.
 * @param compat - the configured switches, when any.
 * @returns the entries carrying a value, in declaration order.
 */
function configuredCompatEntries(compat?: PiAiCompatProfile): Array<[string, unknown]> {
  return Object.entries(compat ?? {}).flatMap(([field, value]) => {
    return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0 ? [] : [[field, value]];
  });
}

/**
 * The protocols offering one compat field, in {@link COMPAT_GATES} order.
 * @param field - configured compat field name.
 * @returns the protocols whose compat takes it; empty when none does, which
 *   is either a withheld field or a name no upstream compat type declares.
 */
function compatProtocols(field: string): string[] {
  return Object.entries(COMPAT_GATES).flatMap(([api, gate]) => gate[field] === "offer" ? [api] : []);
}

/**
 * The compat fields one protocol offers, for a diagnostic that has to show
 * what was available instead of the name that missed.
 * @param api - wire protocol.
 * @returns the offered field names, or an empty list for a protocol taking no compat.
 */
function offeredCompatFields(api: string): string[] {
  return Object.entries(compatGate(api) ?? {}).flatMap(([field, disposition]) => disposition === "offer" ? [field] : []);
}

/**
 * Every offered field name, deduplicated, for the one diagnostic that cannot
 * narrow by protocol: the vocabulary check runs before any protocol resolves,
 * which is what lets it refuse a misspelling on a route whose models would
 * never have reached the protocol that declares the intended field.
 * @returns the offered field names across every protocol, in gate order.
 */
function allOfferedCompatFields(): string[] {
  const fields = new Set<string>();
  for (const api of Object.keys(COMPAT_GATES)) for (const field of offeredCompatFields(api)) fields.add(field);
  return [...fields];
}

/**
 * Reject a compat key no protocol offers. Runs before any protocol is
 * resolved, so a withheld field or a misspelling fails even on a route whose
 * models never reach the protocol that would have taken it — the alternative
 * being the silent drop that let an unreadable switch look applied.
 * @param provider - provider route key, for diagnostics.
 * @param site - the configuration site, for diagnostics.
 * @param compat - the configured switches, when any.
 * @throws Error naming the offending key.
 */
function assertOfferedCompatFields(provider: string, site: string, compat?: PiAiCompatProfile): void {
  for (const [field, value] of Object.entries(compat ?? {})) {
    if (compatProtocols(field).length === 0) {
      if (Object.values(COMPAT_GATES).some((gate) => gate[field] !== void 0)) invalid(provider, `${site} sets compat "${field}", which is not configurable here: pi-ai's installed catalog sets it for the vendors that need it, so name that provider as the route instead`);
      invalid(provider, `${site} sets compat "${field}", which no wire protocol declares; the configurable switches are ${allOfferedCompatFields().join(", ")}`);
    }
    if (value == null) invalid(provider, `${site} sets compat "${field}" with no value; give it one, or remove the key to leave the field to the next layer — the installed catalog entry, then pi-ai's own detection`);
  }
}

/**
 * An expected configuration failure that stored-catalog reads may retain for repair.
 * Nhận: thông điệp lỗi (tuỳ chọn) như mọi `Error`.
 * Trả: một `Error` mà `resolveRouteModels` dùng để giữ chẩn đoán ở chế độ `deferred`.
 */
export class PiAiCatalogError extends Error {}

/** Report a route the deployment cannot serve, naming the settings key at fault. */
function invalid(provider: string, detail: string): never {
  throw new PiAiCatalogError(`llm-pi-ai: provider "${provider}" ${detail}`);
}

/**
 * The one wire protocol a catalog route's shipped models agree on. This is what
 * lets a deployment add a model the installed catalog has not caught up with —
 * a provider's newest release — without restating the protocol its siblings
 * already use. A route whose shipped models disagree (an OpenAI-style catalog
 * spanning Responses and Chat Completions) has no such answer, so a model it
 * does not describe must name its protocol at the route.
 */
function sharedCatalogApi(defaults: Map<string, Model<Api>>): Api | undefined {
  const apis = new Set<Api>();
  for (const model of defaults.values()) apis.add(model.api);
  return apis.size === 1 ? [...apis][0] : void 0;
}

/**
 * Resolve one model's reasoning capability from its declared efforts.
 *
 * A declared dict translates to pi-ai's `thinkingLevelMap` with every level
 * decided explicitly: declared levels carry their wire spelling, undeclared
 * levels are pinned to `null` (unsupported). Pinning matters because pi-ai's
 * own defaulting is asymmetric — an absent key means "supported" for the five
 * base levels but "unsupported" for `xhigh`/`max` — and a profile author
 * should not need to know that. A declared `off` with no value is the one
 * exception: it stays absent from the map, which pi-ai reads as "supported,
 * send nothing" — the correct dispatch where not thinking is the parameter's
 * absence — while `off` with a value sends that value.
 * @param provider - provider route key, for diagnostics.
 * @param entry - the configured model entry.
 * @param base - the installed catalog entry of the same id, when one exists.
 * @returns the reasoning fields the materialized model carries.
 */
function resolveModelReasoning(provider: string, entry: PiAiModelProfile, base?: Model<Api>): { reasoning: boolean; thinkingLevelMap?: ThinkingLevelMap } {
  const efforts = entry.reasoningEfforts as false | PiAiReasoningEfforts | null | undefined;
  if (efforts === void 0) return { reasoning: base?.reasoning ?? false };
  if (efforts === false) return { reasoning: false };
  if (efforts === null || Object.keys(efforts).length === 0) invalid(provider, `model "${entry.id}" has an empty reasoningEfforts; declare the offered levels, set false for a non-reasoning model, or omit the field to keep the installed catalog's capability`);
  const declared: Array<[ModelThinkingLevel, string | null]> = THINKING_LEVELS.flatMap((level) => {
    const wire = efforts[level];
    return wire === void 0 ? [] : [[level, wire]];
  });
  for (const [level, wire] of declared) if (wire === null) {
    if (level !== "off") invalid(provider, `model "${entry.id}" reasoningEfforts.${level} needs the wire value dispatch should send; only "off" may leave it empty`);
  } else if (wire.length === 0) invalid(provider, `model "${entry.id}" reasoningEfforts.${level} must not be an empty string`);
  if (!declared.some(([level]) => level !== "off")) invalid(provider, `model "${entry.id}" reasoningEfforts offers no level beyond "off"; declare a thinking level, or set reasoningEfforts to false for a non-reasoning model`);
  const map: ThinkingLevelMap = {};
  for (const level of THINKING_LEVELS) {
    const wire = efforts[level];
    if (wire === void 0) map[level] = null;
    else if (wire !== null) map[level] = wire;
  }
  return {
    reasoning: true,
    thinkingLevelMap: map
  };
}

/**
 * Resolve one model's compat block from the profile's switches.
 *
 * A model switch wins over the route switch field by field; whatever neither
 * sets keeps the installed entry's value, and a field no layer decides falls
 * through to pi-ai's own detection. A model-level switch its protocol does not
 * take fails resolution — about one named model it can only be a mistake —
 * while a route-level one skips past such models, since a route default must
 * stay settable on a route whose models do not all speak one protocol. Every
 * field reaching here is offered by some protocol; {@link
 * assertOfferedCompatFields} has already refused the rest.
 * @param provider - provider route key, for diagnostics.
 * @param entry - the configured model entry.
 * @param route - the route-level switches, when any.
 * @param base - the installed catalog entry of the same id, when one exists.
 * @param api - the model's resolved wire protocol.
 * @returns a `compat` field to spread into the model, or nothing.
 */
function resolveModelCompat(provider: string, entry: PiAiModelProfile, route: PiAiCompatProfile | undefined, base: Model<Api> | undefined, api: Api): { compat?: Model<Api>["compat"] } {
  const gate = compatGate(api);
  const configured: Record<string, unknown> = {};
  for (const [field, value] of configuredCompatEntries(route)) {
    if (gate?.[field] !== "offer") continue;
    configured[field] = value;
  }
  for (const [field, value] of configuredCompatEntries(entry.compat)) {
    if (gate?.[field] !== "offer") {
      const offered = offeredCompatFields(api);
      invalid(provider, `model "${entry.id}" sets compat "${field}", but its api is "${api}", which does not take it; that switch exists on ${compatProtocols(field).join(", ")}, and "${api}" offers ${offered.length === 0 ? "no configurable compat" : offered.join(", ")}`);
    }
    configured[field] = value;
  }
  if (Object.keys(configured).length === 0) return {};
  return { compat: {
    ...base?.api === api ? base.compat : void 0,
    ...configured
  } as Model<Api>["compat"] };
}

/**
 * One configured model entry: an id plus the catalog fields it overrides.
 * Nhận: không (chỉ là kiểu cấu hình).
 * Trả: hình dạng một entry trong `models` của route.
 */
export interface PiAiModelProfile {
  /** Model id sent to the provider and accepted by `GenerateOptions.model`. */
  id: string;
  /** Display name for selectors; defaults to the catalog name, then the id. */
  name?: string;
  /** Maximum combined request and response context in tokens. */
  contextWindow?: number;
  /**
   * Maximum output tokens. Configuring one also makes it this model's
   * per-request default; a value inherited from the installed catalog, or the
   * route's fallback, is the model's capability and never becomes a request
   * default on its own.
   */
  maxTokens?: number;
  /**
   * Request modalities this model accepts. Absent — or empty, which describes
   * a model that accepts nothing and so states no answer either — keeps the
   * installed catalog entry's modalities, then the route's `defaultInput`.
   */
  input?: PiAiModality[];
  /**
   * Selectable reasoning efforts. Absent inherits the installed catalog
   * entry's capability (a hand-declared model has none and does not reason);
   * `false` declares a non-reasoning model; a non-empty dict declares the
   * offered levels and their wire spellings.
   */
  reasoningEfforts?: false | PiAiReasoningEfforts;
  /** pi-ai wire-compatibility switches for this model, winning over the route's per field; one its protocol does not declare is refused. */
  compat?: PiAiCompatProfile;
}

/**
 * Customization of one installed catalog model, keyed by its id in the
 * route's `modelOverrides` dict — the same fields a `models` entry may set,
 * with the id living in the key.
 * Nhận: không (chỉ là kiểu cấu hình).
 * Trả: hình dạng một entry `modelOverrides` (profile bỏ `id`).
 */
export type PiAiModelOverride = Omit<PiAiModelProfile, "id">;

/**
 * The route-level facts model materialization reads.
 * Nhận: không (chỉ là kiểu cấu hình).
 * Trả: bộ dữ kiện route mà `resolveRouteModels` đọc.
 */
export interface RouteCatalogRequest {
  /** Provider route key, stamped onto every materialized model. */
  provider: string;
  /** Wire protocol override; absent defers to each catalog model's own API. */
  api?: string;
  /** Endpoint override; absent defers to the catalog model, then the catalog provider. */
  baseURL?: string;
  /** Configured catalog; absent means the whole installed catalog for this route. */
  models?: readonly PiAiModelProfile[];
  /** Installed-catalog customizations by model id; only meaningful while `models` is absent. */
  modelOverrides?: Readonly<Record<string, PiAiModelOverride>>;
  /** Route-level wire-compatibility switches, landing on each model whose protocol declares them; entries override per field. */
  compat?: PiAiCompatProfile;
  /** Context capacity for a model neither the entry nor the catalog sizes. */
  defaultContextWindow: number;
  /** Output capability for a model neither the entry nor the catalog sizes. */
  defaultMaxTokens: number;
  /** Modalities for a model neither the entry nor the catalog declares. */
  defaultInput: Model<Api>["input"];
}

/**
 * One route's materialized catalog, plus the request caps its profile chose.
 * Nhận: không (chỉ là kiểu kết quả).
 * Trả: hình dạng kết quả của `resolveRouteModels`.
 */
export interface RouteCatalog {
  /** The materialized models in configuration order. */
  models: readonly Model<Api>[];
  /** Models that cannot be resolved, retained as diagnostics during stored-config reads. */
  modelErrors: ReadonlyMap<string, string>;
  /**
   * Per-request output caps this profile explicitly configured, by model id.
   *
   * Separate from `Model.maxTokens` because the two answer different
   * questions: pi-ai requires `maxTokens` as the model's output *capability*,
   * while the harness seam's `defaultMaxTokens` is a cap the deployment chose
   * to send on requests that name none. Materializing a catalog capability as
   * a request default would start capping every request at a number nobody
   * picked, so only an explicit configuration lands here.
   */
  configuredMaxTokens: ReadonlyMap<string, number>;
}

/**
 * Materialize one route's catalog by merging the installed catalog defaults
 * under the configured entries. A route with no configured `models` serves the
 * installed catalog unchanged, which is what keeps an existing
 * `providers: { deepseek: { apiKeyEnv: … } }` profile working untouched.
 * Nhận: `request` (dữ kiện catalog cấp route) và `validation` — `strict` từ chối mọi lỗi,
 *   `deferred` giữ chẩn đoán của model để đọc/ sửa cấu hình đã lưu.
 * Trả: model đã vật chất hoá (theo thứ tự cấu hình), bản đồ lỗi theo model id, và các
 *   trần request được cấu hình tường minh.
 * @param request - the route-level catalog facts.
 * @param validation - strict writes reject every error; deferred reads retain model diagnostics.
 * @returns the materialized models and the explicitly configured request caps.
 * @throws {PiAiCatalogError} khi route/model không phục vụ được ở chế độ `strict`, hoặc khi
 *   cấu hình compat/reasoning trái với giao thức đã phân giải.
 */
export function resolveRouteModels(request: RouteCatalogRequest, validation: "strict" | "deferred" = "strict"): RouteCatalog {
  const { provider } = request;
  const defaults = catalogModels(provider);
  const providerBaseUrl = catalogProvider(provider)?.baseUrl;
  const configured = request.models ?? [];
  const overrides = request.modelOverrides ?? {};
  const modelErrors = new Map<string, string>();
  for (const [id, override] of Object.entries(overrides)) {
    if (id.length === 0) invalid(provider, "has a modelOverrides entry with an empty model id");
    if (defaults.size === 0) invalid(provider, `sets modelOverrides for "${id}", but the installed catalog does not describe this route; a declared route spells every model out in its models list`);
    if (configured.length > 0) invalid(provider, `sets modelOverrides for "${id}" beside a models list; models already replaces the served catalog, so declare the fields on its entries`);
    if (!defaults.has(id)) {
      const message = `modelOverrides names "${id}", which the installed catalog does not describe`;
      if (validation === "strict") invalid(provider, message);
      modelErrors.set(id, `llm-pi-ai: provider "${provider}" ${message}`);
    }
    if ("id" in override) invalid(provider, `modelOverrides entry "${id}" sets "id", which is the dict key`);
  }
  const entries = configured.length > 0 ? configured : [...defaults.values()].map((model) => ({
    id: model.id,
    ...overrides[model.id]
  }));
  if (entries.length === 0) invalid(provider, "resolves no models; the installed catalog does not describe this route, so its models must be listed in configuration");
  const routeApi = sharedCatalogApi(defaults);
  assertOfferedCompatFields(provider, "route", request.compat);
  const seen = new Set<string>();
  const configuredMaxTokens = new Map<string, number>();
  const resolveEntry = (entry: PiAiModelProfile): Model<Api> => {
    assertOfferedCompatFields(provider, `model "${entry.id}"`, entry.compat);
    if (entry.id.length === 0) invalid(provider, "has a model with an empty id");
    if (seen.has(entry.id)) invalid(provider, `lists model "${entry.id}" more than once`);
    seen.add(entry.id);
    const base = defaults.get(entry.id);
    const api = request.api ?? base?.api ?? routeApi;
    if (api === void 0) invalid(provider, `model "${entry.id}" needs an api; the installed catalog does not describe it, so set the route's api to the wire protocol its endpoint speaks`);
    const baseUrl = request.baseURL ?? base?.baseUrl ?? providerBaseUrl;
    if (baseUrl === void 0) invalid(provider, `model "${entry.id}" needs a baseURL; the installed catalog does not describe this route`);
    const contextWindow = entry.contextWindow ?? base?.contextWindow ?? request.defaultContextWindow;
    if (!Number.isInteger(contextWindow) || contextWindow <= 0) invalid(provider, `model "${entry.id}" contextWindow must be a positive integer`);
    const maxTokens = entry.maxTokens ?? base?.maxTokens ?? request.defaultMaxTokens;
    if (!Number.isInteger(maxTokens) || maxTokens <= 0) invalid(provider, `model "${entry.id}" maxTokens must be a positive integer`);
    if (entry.maxTokens !== void 0) configuredMaxTokens.set(entry.id, entry.maxTokens);
    return {
      ...base,
      id: entry.id,
      name: entry.name ?? base?.name ?? entry.id,
      api,
      provider,
      baseUrl,
      input: declaredInput(entry.input) ?? base?.input ?? [...request.defaultInput],
      cost: base?.cost ?? NO_COST,
      contextWindow,
      maxTokens,
      ...resolveModelReasoning(provider, entry, base),
      ...resolveModelCompat(provider, entry, request.compat, base, api)
    };
  };
  const models: Model<Api>[] = [];
  for (const entry of entries) {
    let model: Model<Api>;
    try {
      model = resolveEntry(entry);
    } catch (error) {
      if (validation === "strict" || !(error instanceof PiAiCatalogError)) throw error;
      modelErrors.set(entry.id, error.message);
      continue;
    }
    models.push(model);
  }
  const serviceableModels = models.filter((model) => !modelErrors.has(model.id));
  for (const [field] of configuredCompatEntries(request.compat)) {
    const takers = compatProtocols(field);
    if (serviceableModels.some((model) => takers.includes(model.api))) continue;
    invalid(provider, `sets compat "${field}", but no model on the route speaks a protocol that takes it; it exists on ${takers.join(", ")}`);
  }
  return {
    models: serviceableModels,
    configuredMaxTokens,
    modelErrors
  };
}
