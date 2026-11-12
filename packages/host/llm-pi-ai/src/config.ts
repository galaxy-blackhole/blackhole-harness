/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Schema cấu hình và kiểm tra profile provider cho adapter pi-ai: hằng mặc định, schema models/compat, Config, assertServiceable và resolveProfiles; export 7 hằng · 6 kiểu · PiAiProviderProfile · ResolvedPiAiProviderProfile · Config · Options · assertServiceable · resolveProfiles.
 */

import type { Volatile } from "@deepseek-ai/cordis";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import type { CredentialRef } from "@deepseek-ai/dsh-credentials";
import { RetryPolicySchema, resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import type { ResolvedRetryPolicy, RetryPolicyConfig } from "@deepseek-ai/dsh-llm";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { deepEqualJson } from "@deepseek-ai/dsh-util-values";
import type { CacheRetention, ModelThinkingLevel, Provider, ThinkingBudgets, Transport } from "@earendil-works/pi-ai";
import z from "@deepseek-ai/schemastery";
import {
  CACHE_CONTROL_FORMATS,
  CHAT_TEMPLATE_VARS,
  MAX_TOKENS_FIELDS,
  MODALITIES,
  PiAiCatalogError,
  SUPPORTED_THINKING_FORMATS,
  THINKING_LEVELS,
  THINKING_TOKEN_BUDGET_FIELDS,
  resolveRouteModels,
} from "./catalog.ts";
import type {
  PiAiCompatProfile,
  PiAiModality,
  PiAiModelOverride,
  PiAiModelProfile,
  PiAiReasoningEfforts,
  RouteCatalog,
} from "./catalog.ts";
import { buildProvider, supportedProtocols } from "./provider.ts";

/**
 * Cấu hình và kiểm tra profile provider cho adapter pi-ai. Profile là một dict
 * khoá theo route provider, nên tầng composition và lớp user-settings hợp nhất
 * theo từng provider và tập route mang tính cấu trúc.
 *
 * Một khoá route không bắt buộc phải đặt tên provider pi-ai đã cài. Khi có, endpoint,
 * giao thức, tên hiển thị và catalog model của provider đó là mặc định của profile
 * và profile ghi đè từng trường; khi không, profile chính là toàn bộ khai báo
 * provider. Lượt đọc đã lưu giữ chẩn đoán catalog bên cạnh các model phục vụ được;
 * lượt ghi kiểm mọi provider đã đổi trước khi lưu. Ràng buộc tự thân của profile
 * áp cho cả hai.
 */

/**
 * Khoảng nghỉ tối đa mặc định khi một lượt đọc stream của adapter còn treo.
 * Nhận: không tham số.
 * Trả: 300000 mili giây.
 */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
/**
 * Giới hạn mặc định của request trên payload ảnh mã hoá base64. Mọi ảnh trong
 * lịch sử được mã hoá lại vào mọi thân request, nên một hội thoại không giới hạn
 * rốt cuộc vượt hạn mức kích thước request của provider hay gateway và phiên
 * không thể hoàn tất request nào nữa. Mặc định 20MiB chứa mười lăm phiên bản
 * request 1MiB sau khi nở base64 và dành dung lượng cho system prompt, lịch sử,
 * tool và JSON. Deployment sau gateway chặt hơn thì hạ nó theo route.
 * Nhận: không tham số.
 * Trả: 20971520 byte (20 MiB).
 */
export const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
/**
 * Ngân sách pixel mặc định cho mỗi phiên bản request giữ trọn tệp đính kèm đã
 * chuẩn hoá 2048px.
 * Nhận: không tham số.
 * Trả: 4194304 pixel.
 */
export const DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;
/**
 * Mục tiêu byte thô mặc định của mỗi phiên bản request trước khi nở base64 nội
 * tuyến; đầu ra nhỏ nhất của thang chất lượng được dùng khi không mức nào vừa.
 * Nhận: không tham số.
 * Trả: 1048576 byte (1 MiB).
 */
export const DEFAULT_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;
/**
 * Dung lượng ngữ cảnh giả định cho một model mà cả cấu hình lẫn catalog đều
 * không định cỡ.
 * Nhận: không tham số.
 * Trả: 262144 token.
 */
export const DEFAULT_CONTEXT_WINDOW = 262144;
/**
 * Khả năng đầu ra giả định cho một model mà cả cấu hình lẫn catalog đều không
 * định cỡ.
 * Nhận: không tham số.
 * Trả: 32768 token.
 */
export const DEFAULT_MAX_TOKENS = 32768;
/**
 * Các modality giả định cho một model mà cả cấu hình lẫn catalog đều không khai.
 * Text là mức sàn mà mọi giao thức được hỗ trợ chắc chắn mang, nên đây là việc
 * thiếu khai báo chứ không phải phỏng đoán endpoint: không gì có thể hỏi một
 * gateway về modality của nó, và hai câu trả lời sai không cùng giá. Khai thiếu
 * từ chối ảnh trước khi nó được đính kèm và nêu tên model. Khai thừa nhận một
 * ảnh mà provider từ chối giữa lượt, sau khi thông điệp đã bền, khiến phiên lặp
 * lại request không thể thành công.
 * Nhận: không tham số.
 * Trả: mảng chỉ gồm "text".
 */
export const DEFAULT_INPUT: readonly PiAiModality[] = ["text"];

/** Các kiểu catalog của gói được tái xuất để nơi cấu hình dùng chung một nguồn. */
export type {
  PiAiCompatProfile,
  PiAiModality,
  PiAiModelOverride,
  PiAiModelProfile,
  PiAiReasoningEfforts,
  PiAiThinkingFormat,
} from "./catalog.ts";

/** Cấu hình cho một route provider pi-ai; khoá của dict providers CHÍNH LÀ route. */
export interface PiAiProviderProfile {
  /** Tham chiếu credential (tên biến môi trường) được phân giải từng request qua ctx.credentials. */
  apiKeyEnv?: string;
  /** Tên hiển thị ở bề mặt cấu hình; mặc định là khoá route. */
  displayName?: string;
  /**
   * Giao thức dây mà mọi model trên route này nói. Bỏ trống thì giữ giao thức
   * riêng của từng model catalog đã cài, vì thế route catalog không cần giao
   * thức nào; route mà catalog không có phải đặt tên một cái.
   */
  api?: string;
  /** Endpoint cho models của route; mặc định là endpoint của catalog đã cài. */
  baseURL?: string;
  /**
   * Catalog model của route này. Bỏ trống thì phục vụ nguyên catalog đã cài cho
   * route; một danh sách tường minh thay thế nó, mỗi mục tự điền các trường chưa
   * đặt từ model đã cài cùng id.
   */
  models?: PiAiModelProfile[];
  /**
   * Cá nhân hoá catalog đã cài theo id model: mỗi mục định hình lại đúng model
   * đó với cùng các trường mà một mục models nhận, trong khi phần còn lại của
   * catalog vẫn phục vụ nguyên vẹn. Chỉ có nghĩa trên route catalog không có
   * danh sách models — models đã thay cả catalog, nên một override bên cạnh nó,
   * trên route catalog không có, hay đặt tên model catalog không mô tả sẽ bị từ
   * chối thay vì bỏ qua.
   */
  modelOverrides?: Record<string, PiAiModelOverride>;
  /**
   * Các công tắc tương thích dây của pi-ai, làm mặc định cho mọi model trên
   * route mà giao thức của chúng khai chúng; compat của từng model ghi đè theo
   * từng trường. Cái nào cả hai đều không đặt thì giữ giá trị của mục catalog đã
   * cài, rồi tới việc tự dò của pi-ai. Một công tắc mà không model nào trên route
   * đọc được sẽ bị từ chối thay vì để trông như đã áp dụng.
   */
  compat?: PiAiCompatProfile;
  /**
   * Dung lượng ngữ cảnh cho một model route này liệt kê mà cả mục lẫn catalog đã
   * cài đều không định cỡ (mặc định 262144). Đây là phỏng đoán do cách dựng, nên
   * deployment có gateway phục vụ model nhỏ hơn thì sửa ở đây.
   */
  defaultContextWindow?: number;
  /**
   * Khả năng đầu ra cho một model route này liệt kê mà cả mục lẫn catalog đã cài
   * đều không định cỡ (mặc định 32768). Giá trị này định cỡ model; tự nó không
   * bao giờ thành hạn mức từng request.
   */
  defaultMaxTokens?: number;
  /**
   * Modality của request cho một model route này liệt kê mà cả input của mục lẫn
   * catalog đã cài đều không khai (mặc định ["text"]). Một giá trị dự phòng như
   * hai dung lượng trên, không phải ghi đè: model catalog giữ modality mà catalog
   * ghi cho nó, và giá trị này không bao giờ thu hẹp một model như vậy. Gateway
   * phục vụ model thị giác mà catalog không mô tả thì khai ["text", "image"] một
   * lần ở đây thay vì trên từng mục. Khác danh sách của một mục, danh sách này
   * không được rỗng — không có gì bên dưới để trả lời thay.
   */
  defaultInput?: PiAiModality[];
  /** Header request của provider, được kiểm bằng Fetch khi profile phân giải; tên dành riêng của Harness thắng. */
  headers?: Record<string, string>;
  /** Bậc suy luận trung tính provider của pi-ai. */
  reasoning?: ModelThinkingLevel;
  /** Ngân sách token dùng bởi provider suy luận có hỗ trợ. */
  thinkingBudgets?: ThinkingBudgets;
  /** Uỷ thích giữ prompt-cache. */
  cacheRetention?: CacheRetention;
  /** Uỷ thích transport stream. */
  transport?: Transport;
  /** Hạn thời gian HTTP/SDK của provider, mili giây. */
  timeoutMs?: number;
  /** Hạn kết nối WebSocket, mili giây. */
  websocketConnectTimeoutMs?: number;
  /** Thời gian provider rảnh tối đa khi một lượt đọc stream còn treo. */
  streamIdleTimeoutMs?: number;
  /**
   * Payload ảnh mã hoá base64 tối đa mỗi request. Khi ảnh tích luỹ của một
   * request vượt nó, các ảnh cũ nhất bị thay bằng chỗ giữ chỗ văn bản cho tới
   * khi request vừa, để một phiên dài vẫn hoàn tất request thay vì bị hạn mức
   * kích thước request từ chối.
   */
  maxRequestImageBytes?: number;
  /** Ngân sách pixel cho mỗi phiên bản request nội tuyến tất định. */
  requestImagePixelBudget?: number;
  /**
   * Mục tiêu byte thô cho mỗi phiên bản request nội tuyến tất định; đầu ra nhỏ
   * nhất của thang chất lượng được dùng khi không mức nào vừa.
   */
  requestImageMaxBytes?: number;
  /** Chính sách thử lại do provider sở hữu; bỏ trống dùng chế độ normal với năm lần thử. */
  retryPolicy?: RetryPolicyConfig;
}

/** Profile đã kiểm với route được đóng dấu và mọi mặc định do adapter sở hữu đã phân giải. */
export interface ResolvedPiAiProviderProfile extends Omit<PiAiProviderProfile, "apiKeyEnv" | "retryPolicy" | "models" | "displayName"> {
  /** Khoá route của Harness và khoá collection Models (khoá của dict cấu hình). */
  provider: string;
  /** Tên hiển thị đã phân giải cho selector và bề mặt cấu hình. */
  displayName: string;
  /** Tham chiếu credential đã kiểm, khi có cấu hình. */
  apiKeyEnv?: CredentialRef;
  /** Khoảng nghỉ provider hữu hạn dương sau khi áp mặc định. */
  streamIdleTimeoutMs: number;
  /** Giới hạn payload ảnh base64 cấp request sau khi áp mặc định. */
  maxRequestImageBytes: number;
  /** Ngân sách tổng pixel của phiên bản request sau khi áp mặc định. */
  requestImagePixelBudget: number;
  /** Mục tiêu byte thô của phiên bản request sau khi áp mặc định; đầu ra nhỏ nhất của thang chất lượng được dùng khi không mức nào vừa. */
  requestImageMaxBytes: number;
  /** Chính sách thử lại bất biến đã chụp cùng route provider này. */
  retryPolicy: ResolvedRetryPolicy;
  /**
   * Provider pi-ai chứa các model phục vụ được của route này. Vắng mặt khi một
   * route đã lưu không dựng được; cấu hình của nó vẫn sửa được.
   */
  piProvider?: Provider;
  /** Chẩn đoán model đầu tiên, hoặc lỗi route khi không có chẩn đoán model nào. */
  catalogError?: string;
  /** Lỗi từng model được báo trước khi thử một request. */
  modelErrors: ReadonlyMap<string, string>;
  /**
   * Hạn mức đầu ra từng request mà profile này đã cấu hình tường minh, theo id
   * model. Seam chỉ materialize một cái vào request không đặt hạn mức riêng, nên
   * khả năng của catalog không được xuất hiện ở đây.
   */
  configuredMaxTokens: ReadonlyMap<string, number>;
}

/** Cấu hình plugin: các route provider mà thực thể này sở hữu. */
export interface Config {
  /**
   * Các route provider pi-ai, khoá theo provider. Dict rỗng (hoặc bỏ trống) là
   * thế đứng dormant do settings điều khiển: adapter mount không route nào và
   * đăng ký chúng ngay khi một mục settings cấp profile.
   */
  providers: Volatile<Record<string, PiAiProviderProfile>>;
}

/** Tuỳ chọn thuần mà bộ phân giải provider nhận. */
export type Options = {
  [K in keyof Config]?: Config[K] extends Volatile<infer T> ? T : never;
};

/** Ngân sách token theo từng bậc suy luận mà provider hỗ trợ đọc. */
const thinkingBudgets = z.object({
  minimal: z.number(),
  low: z.number(),
  medium: z.number(),
  high: z.number(),
});
/**
 * Một giá trị chat_template_kwargs hay chat_template_args. Thành viên $var là
 * chỗ giữ chỗ của pi-ai cho một giá trị mà dispatch điền từ trạng thái suy luận
 * của request, khiến một gateway điều khiển bằng template cấu hình được mà
 * không phải nhắc lại template của nó.
 */
const chatTemplateKwarg = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.const(null),
  z.object({
    $var: z.union(CHAT_TEMPLATE_VARS).required(),
    omitWhenOff: z.boolean(),
  }),
]);
/**
 * Các công tắc tương thích dây của pi-ai mà profile có thể đặt. Mỗi trường thuộc
 * một giao thức nếu kiểu compat upstream tương ứng khai nó; tên trường và kiểu
 * của nó do catalog.ts gác bằng cổng trôi kiểu.
 */
const compatProfile: z<PiAiCompatProfile> = z.object({
  supportsStore: z.boolean(),
  supportsDeveloperRole: z.boolean(),
  supportsReasoningEffort: z.boolean(),
  supportsUsageInStreaming: z.boolean(),
  supportsFinishReason: z.boolean(),
  maxTokensField: z.union(MAX_TOKENS_FIELDS),
  requiresToolResultName: z.boolean(),
  requiresAssistantAfterToolResult: z.boolean(),
  requiresThinkingAsText: z.boolean(),
  requiresReasoningContentOnAssistantMessages: z.boolean(),
  thinkingFormat: z.union(SUPPORTED_THINKING_FORMATS),
  chatTemplateKwargs: z.dict(chatTemplateKwarg),
  chatTemplateArgs: z.dict(chatTemplateKwarg),
  supportsThinkingTokenBudget: z.boolean(),
  thinkingTokenBudgetField: z.union(THINKING_TOKEN_BUDGET_FIELDS),
  vllmPriority: z.number().step(1),
  supportsMaxOutputTokens: z.boolean(),
  supportsStrictMode: z.boolean(),
  cacheControlFormat: z.union(CACHE_CONTROL_FORMATS),
  supportsLongCacheRetention: z.boolean(),
  supportsEagerToolInputStreaming: z.boolean(),
  supportsCacheControlOnTools: z.boolean(),
  supportsTemperature: z.boolean(),
  forceAdaptiveThinking: z.boolean(),
  allowEmptySignature: z.boolean(),
  supportsStrictTools: z.boolean(),
});
/**
 * Khoá là các bậc được chào, giá trị là cách viết trên dây của chúng. Một khoá
 * không giá trị (off:) sống sót qua kiểm vì schemastery cho dữ liệu nullable đi
 * qua trước khi mọi schema thành viên chạy — z.const(null) chỉ điều khiển lỗi
 * cho giá trị sai khác null và thứ mà một UI cấu hình hiển thị. Chỉ bước phân
 * giải quyết định bậc nào được để giá trị rỗng, nên chẩn đoán nêu được route và
 * model. Phép ép kiểu thu hẹp Dict của schemastery, vốn kiểu hoá mọi khoá literal
 * là bắt buộc; kiểm dict chỉ xét khoá có mặt, nên giá trị lúc chạy là một record
 * từng phần.
 */
const reasoningEfforts = z.dict(z.union([z.string(), z.const(null)]), z.union(THINKING_LEVELS)) as z<PiAiReasoningEfforts>;
/** Các trường mà một mục models và một giá trị modelOverrides chia sẻ; chỉ nhà của id khác nhau. */
const modelFields = {
  name: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
  input: z.array(z.union(MODALITIES)),
  reasoningEfforts: z.union([z.const(false), reasoningEfforts]),
  compat: compatProfile,
};
/** Một mục cấu hình model: id cộng các trường catalog mà nó ghi đè. */
const modelProfile: z<PiAiModelProfile> = z.object({
  id: z.string().required(),
  ...modelFields,
});
/** Một modelProfile mà id nằm ở khoá của dict modelOverrides. */
const modelOverride: z<PiAiModelOverride> = z.object(modelFields);
/** Profile đầy đủ của một route; giá trị bất kỳ dùng schema con đã khai ở trên. */
const profile = z.object({
  apiKeyEnv: z.string().role("credential-ref"),
  displayName: z.string(),
  api: z.union(supportedProtocols()),
  baseURL: z.string(),
  models: z.array(modelProfile),
  modelOverrides: z.dict(modelOverride),
  compat: compatProfile,
  defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW),
  defaultMaxTokens: z.number().step(1).min(1).default(DEFAULT_MAX_TOKENS),
  defaultInput: z.array(z.union(MODALITIES)).default([...DEFAULT_INPUT]),
  headers: z.dict(z.string()),
  reasoning: z.union(THINKING_LEVELS),
  thinkingBudgets,
  cacheRetention: z.union([
    "none",
    "short",
    "long",
  ]),
  transport: z.union([
    "sse",
    "websocket",
    "websocket-cached",
    "auto",
  ]),
  timeoutMs: z.natural(),
  websocketConnectTimeoutMs: z.natural(),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
  requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
  retryPolicy: RetryPolicySchema,
});
/**
 * Schema runtime cho {@link Config}.
 * Nhận: không tham số.
 * Trả: schema dict providers, rỗng và dormant khi bỏ trống.
 */
export const Config = z.object({ providers: z.dict(profile).default({}).volatile() });
/**
 * Từ chối các profile provider mới hoặc đã đổi mà không thể phục vụ. Profile đã
 * lưu không đổi có thể cần sửa sau một lần nâng catalog và không chặn việc sửa
 * một provider khác. Profile bị xoá không cần kiểm catalog.
 * Nhận: config — mục đã phân giải cần kiểm; previous — mục đang có, bỏ trống thì
 *   kiểm mọi provider.
 * Trả: không trả gì; ném lỗi khi có profile không phục vụ được.
 * @throws {Error} nêu route và mục cấu hình không thể phục vụ.
 */
export function assertServiceable(config: Options, previous?: Options): void {
  resolveProfiles(Object.fromEntries(Object.entries(config.providers ?? {}).filter(([provider, profile]) => !deepEqualJson(profile, previous?.providers?.[provider]))));
}
/**
 * Từ chối các trường profile tiền phát hành đã bị xoá và nêu tên thay thế.
 * Nhận: provider — khoá route; source — profile thô cần kiểm.
 * Trả: không trả gì; ném lỗi khi profile còn trường đã xoá.
 * @throws {Error} nêu tên trường đã xoá và nơi chuyển tới.
 */
function rejectRemovedFields(provider: string, source: PiAiProviderProfile): void {
  const legacy = source;
  if ("provider" in legacy) throw new Error(`llm-pi-ai: provider "${provider}" sets "provider", which moved to the providers dict key`);
  if ("maxRetries" in legacy || "maxRetryDelayMs" in legacy) throw new Error(`llm-pi-ai: provider "${provider}" sets maxRetries or maxRetryDelayMs, which were removed; compose agent recovery with dsh-llm-retry`);
}
/**
 * Từ chối một header profile mà Fetch không thể đặt lên request provider.
 * Nhận: provider — khoá route; headers — dict header của profile, có thể vắng.
 * Trả: không trả gì; ném lỗi khi một header không hợp lệ với Fetch.
 * @throws {Error} nêu route và tên header không hợp lệ.
 */
function assertValidHeaders(provider: string, headers: Record<string, string> | undefined): void {
  for (const [name, value] of Object.entries(headers ?? {})) try {
    new Headers([[name, value]]);
  } catch {
    throw new Error(`llm-pi-ai: provider "${provider}" header "${name}" is not valid for Fetch; use a valid HTTP field name and a single-line value representable as bytes`);
  }
}
/**
 * Phân giải các mặc định vô hướng và materialize model phục vụ được của từng
 * route. Kiểm catalog hoãn lại giữ chẩn đoán mà không xoá route đã cấu hình. Một
 * dict bỏ trống phân giải thành tập route rỗng, dormant.
 * Nhận: providers — profile provider đã cấu hình khoá theo route; validation —
 *   lượt ghi cần catalog đầy đủ, lượt đọc đã lưu giữ chẩn đoán catalog.
 * Trả: các profile đã kiểm theo thứ tự cấu hình.
 * @throws {Error} khi providers là mảng, khi một tên route hay một profile không
 *   tự thân hợp lệ, hoặc khi kiểm catalog nghiêm ngặt thất bại.
 */
export function resolveProfiles(providers: Readonly<Record<string, PiAiProviderProfile>> | undefined, validation: "strict" | "deferred" = "strict"): Map<string, ResolvedPiAiProviderProfile> {
  if (Array.isArray(providers)) throw new Error("llm-pi-ai: providers is now a dict keyed by provider route, not an array of profiles");
  const entries = Object.entries(providers ?? {});
  const resolved = new Map<string, ResolvedPiAiProviderProfile>();
  for (const [provider, source] of entries) {
    rejectRemovedFields(provider, source);
    if (provider.length === 0) throw new Error("llm-pi-ai: provider names must be non-empty");
    if (source.baseURL !== void 0 && source.baseURL.length === 0) throw new Error(`llm-pi-ai: provider "${provider}" has an empty baseURL`);
    if (source.displayName !== void 0 && source.displayName.length === 0) throw new Error(`llm-pi-ai: provider "${provider}" has an empty displayName`);
    assertValidHeaders(provider, source.headers);
    const streamIdleTimeoutMs = source.streamIdleTimeoutMs ?? 3e5;
    if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0 || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) throw new Error(`llm-pi-ai: provider "${provider}" streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
    const maxRequestImageBytes = source.maxRequestImageBytes ?? 20971520;
    if (!Number.isInteger(maxRequestImageBytes) || maxRequestImageBytes <= 0) throw new Error(`llm-pi-ai: provider "${provider}" maxRequestImageBytes must be a positive integer`);
    const requestImagePixelBudget = source.requestImagePixelBudget ?? 4194304;
    if (!Number.isSafeInteger(requestImagePixelBudget) || requestImagePixelBudget <= 0) throw new Error(`llm-pi-ai: provider "${provider}" requestImagePixelBudget must be a positive safe integer`);
    const requestImageMaxBytes = source.requestImageMaxBytes ?? 1048576;
    if (!Number.isSafeInteger(requestImageMaxBytes) || requestImageMaxBytes <= 0) throw new Error(`llm-pi-ai: provider "${provider}" requestImageMaxBytes must be a positive safe integer`);
    const defaultInput = [...source.defaultInput ?? DEFAULT_INPUT];
    if (defaultInput.length === 0) throw new Error(`llm-pi-ai: provider "${provider}" defaultInput must name at least one modality`);
    const displayName = source.displayName ?? provider;
    let catalog: RouteCatalog | undefined;
    let piProvider: Provider | undefined;
    let catalogError: string | undefined;
    try {
      catalog = resolveRouteModels({
        provider,
        ...source.api === void 0 ? {} : { api: source.api },
        ...source.baseURL === void 0 ? {} : { baseURL: source.baseURL },
        ...source.models === void 0 ? {} : { models: source.models },
        ...source.modelOverrides === void 0 ? {} : { modelOverrides: source.modelOverrides },
        ...source.compat === void 0 ? {} : { compat: source.compat },
        defaultInput,
        defaultContextWindow: source.defaultContextWindow ?? 262144,
        defaultMaxTokens: source.defaultMaxTokens ?? 32768,
      }, validation);
      catalogError = catalog.modelErrors.values().next().value;
      piProvider = buildProvider({
        provider,
        displayName,
        ...source.api === void 0 ? {} : { api: source.api },
        ...source.baseURL === void 0 ? {} : { baseURL: source.baseURL },
        models: catalog.models,
        namesCredential: source.apiKeyEnv !== void 0,
      });
    } catch (error) {
      if (validation === "strict" || !(error instanceof PiAiCatalogError)) throw error;
      catalogError ??= error.message;
    }
    const { apiKeyEnv, retryPolicy, models: _models, displayName: _displayName, ...rest } = source;
    resolved.set(provider, {
      ...rest,
      provider,
      displayName,
      ...apiKeyEnv === void 0 ? {} : { apiKeyEnv: credentialRef(apiKeyEnv) },
      streamIdleTimeoutMs,
      maxRequestImageBytes,
      requestImagePixelBudget,
      requestImageMaxBytes,
      retryPolicy: resolveRetryPolicy(retryPolicy, `llm-pi-ai: provider "${provider}" retryPolicy`),
      ...rest.headers === void 0 ? {} : { headers: { ...rest.headers } },
      ...rest.thinkingBudgets === void 0 ? {} : { thinkingBudgets: { ...rest.thinkingBudgets } },
      configuredMaxTokens: catalog?.configuredMaxTokens ?? new Map(),
      modelErrors: catalog?.modelErrors ?? new Map(),
      ...piProvider === void 0 ? {} : { piProvider },
      ...catalogError === void 0 ? {} : { catalogError },
    });
  }
  return resolved;
}
