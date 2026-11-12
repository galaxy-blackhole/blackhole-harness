/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Vùng adapter của @deepseek-ai/dsh-llm-pi-ai — port 1:1 lib/index.js dòng 1655–2022 (nguồn
 *      per-file: lib/types/adapter.js): PiAiAdapter, implementation tổng quát của seam LLM Harness
 *      trên pi-ai. Mỗi lượt phân giải dựng MỘT snapshot BẤT BIẾN (profiles + collection Models chứa
 *      Provider mà từng route đã dựng); thao tác chụp trọn snapshot trước await đầu tiên nên đổi cấu
 *      hình chỉ tới được request kế tiếp, không bao giờ xen vào lượt đang bay.
 */

import type { AttachmentStore, ImageAttachmentRef, ImageRequestTarget } from "@deepseek-ai/dsh-attachment";
import { attributionHeaders, contentHasImage, LlmAdapter, LlmError, ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import type {
  GenerateOptions,
  ImageAttachmentAccess,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  PreparedAdapterCall,
  ResolvedRetryPolicy,
  StreamChunk,
  ToolSchema,
} from "@deepseek-ai/dsh-llm";
import { idleWatchdog, timeoutOf } from "@deepseek-ai/dsh-timeout";
import type { IdleWatchdog } from "@deepseek-ai/dsh-timeout";
import type {
  Api,
  AuthContext,
  CredentialStore,
  Model,
  ModelThinkingLevel,
  MutableModels,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";

import type { ResolvedPiAiProviderProfile } from "./config.ts";
import { requestImageTarget, toPiContext } from "./context.ts";
import { conversationUpdates, createModels, getSupportedThinkingLevels } from "./models.ts";
import { toStreamChunks } from "./stream.ts";
/**
 * Nhận diện lớp lỗi theo TÊN, bền với MỌI bản sao mô-đun của cùng một lớp.
 * Vì sao (01/11/2026): `LlmError` được import qua peer `@deepseek-ai/dsh-llm`; trong giàn đo specifier đó
 * phân giải về MỘT BẢN SAO khác kernel nên `instanceof` trượt, và `listModels` ném lại `MISSING_CREDENTIAL`
 * thay vì trả `[]` (đo được: 1 ca đỏ). Lớp gốc đặt `name` theo tên lớp CON, nên phải dò tên lớp trên chuỗi
 * prototype — đúng ngữ nghĩa `instanceof` xuyên bản sao (cùng công thức ở packages/host/tools/src/error-identity.ts).
 * Nhận: error — giá trị bắt được; name — tên lớp cần khớp.
 * Trả: true khi chuỗi prototype của lỗi chứa một lớp mang đúng tên đó.
 */
function isNamedError(error: unknown, name: string): boolean {
  try {
    if (!(error instanceof Error)) return false;
    for (let proto: object | null = Object.getPrototypeOf(error); proto !== null; proto = Object.getPrototypeOf(proto)) {
      const ctor = (proto as { constructor?: { name?: string } }).constructor;
      if (typeof ctor === "function" && ctor.name === name) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Generic pi-ai-backed implementation of the Harness LLM seam.
 *
 * Each resolution produces one **immutable** snapshot — the profiles plus a
 * `Models` collection holding the `Provider` each route built — and an
 * operation captures a whole snapshot before its first `await`. A
 * configuration change builds a *new* collection rather than mutating the one
 * in use, because `Models.streamSimple()` is lazy: it resolves the provider
 * when the stream is first consumed, which is after the credential await, so a
 * mutated collection would let a request that started under one configuration
 * finish under another — or fail with a provider that no longer exists. This is
 * what makes the seam's per-step call freeze (`llm.prepareCall()`) hold all the
 * way down: switching models mid-reply takes effect on the next step, never
 * inside the one in flight.
 *
 * A route naming a credential reference still resolves it through the harness
 * seam and passes it as the request's `apiKey` option, which pi-ai treats as
 * the highest-priority auth override — that is what keeps the fail-loud
 * reference semantics. Everything that override does not cover reaches pi-ai
 * through the collection's own auth: the credential store holds the records a
 * login wrote and a refresh rotates, and the auth context answers the ambient
 * questions a provider asks while resolving. Both are stable across snapshots,
 * so a configuration change rebuilds the collection without forgetting who is
 * signed in.
 *
 * @module dsh-llm-pi-ai/adapter
 */

/**
 * Constructor options for {@link PiAiAdapter}: the two resolution hooks the plugin owns.
 * Nhận: hình dạng đầu vào của constructor — profiles (đọc một lần mỗi thao tác), resolveApiKey
 *   (phân giải credential cho MỘT profile đã phân giải), auth (hai injectable auth của collection
 *   pi-ai), cùng các hook tuỳ chọn cho attachment, image access và chẩn đoán replay.
 * Trả: kiểu options để dựng một PiAiAdapter, không mang trạng thái.
 */
export interface PiAiAdapterOptions {
  /** Current validated profiles by provider route; called once per operation. */
  profiles: () => ReadonlyMap<string, ResolvedPiAiProviderProfile>;
  /**
   * Resolve the credential for one already-resolved profile; called once per
   * stream call and frozen for that call, and by `listModels`, which offers no
   * models while it throws `MISSING_CREDENTIAL`. `undefined` defers to the route's own
   * pi-ai auth, which for an installed catalog route is its provider-native
   * ambient discovery; the plugin allows that only for a profile naming no
   * credential at all, because a named reference that misses throws `LlmError`
   * `MISSING_CREDENTIAL` rather than falling back.
   */
  resolveApiKey: (provider: string, profile: ResolvedPiAiProviderProfile) => Promise<string | undefined>;
  /**
   * How every collection this adapter builds resolves auth the request-level
   * `apiKey` override does not cover. Required rather than optional: a
   * collection built without them gets pi-ai's in-memory default store, which
   * is empty at every boot and discarded on every configuration change, so a
   * route whose only method is a login would report itself unconfigured on
   * every request no matter how often the human signed in.
   */
  auth: PiAiAuthInjection;
  /** Resolve the optional durable attachment service at request time. */
  resolveAttachments?: () => AttachmentStore | undefined;
  /** Bridge one attachment reference into the current model-tool execution world. */
  resolveImageAccess?: (attachments: AttachmentStore, ref: ImageAttachmentRef) => ImageAttachmentAccess | undefined;
  /**
   * Observe one assistant history message degrading to provider-neutral
   * conversion because its stored replay state is unusable by this build.
   */
  onReplayDegrade?: (detail: {
    provider: string;
    model: string;
    reason: string;
  }) => void;
}

/**
 * The two auth injectables a pi-ai collection is built with.
 * Nhận: hai seam auth mà plugin sở hữu — credential store bền vững và auth context ambient.
 * Trả: hình dạng để truyền thẳng vào `createModels()` của pi-ai.
 */
export interface PiAiAuthInjection {
  /** Durable storage for credentials pi-ai itself writes: logins, and the refreshes it runs under its own lock. */
  credentials: CredentialStore;
  /** Ambient lookups a provider performs while resolving its own auth. */
  authContext: AuthContext;
}

/**
 * Một snapshot bất biến của cấu hình hiện tại: profiles đã phân giải và collection Models tương ứng.
 * Nhận: hai giá trị được chụp CÙNG NHAU trước await đầu tiên của mỗi thao tác.
 * Trả: cặp profiles + models để mọi bước sau đọc mà không phải đọc lại cấu hình.
 */
interface PiAiSnapshot {
  /** Profiles đã kiểm của lượt phân giải này, theo route provider. */
  profiles: ReadonlyMap<string, ResolvedPiAiProviderProfile>;
  /** Collection pi-ai chứa Provider mà từng route đã dựng trong lượt phân giải này. */
  models: MutableModels;
}

/**
 * Initially active declaration added to an Anthropic request whose projected
 * tools are all deferred, because Anthropic rejects a tool list without one.
 * Nhận: không — hằng khai báo tool giữ chỗ cho request Anthropic.
 * Trả: ToolSchema hợp lệ để đứng đầu danh sách tools khi mọi tool đều deferred.
 */
const ANTHROPIC_TOOL_UPDATE_PLACEHOLDER: ToolSchema = {
  name: "DeferredToolPlaceholder",
  description: "Reserved placeholder that keeps deferred tool loading active; never call this tool.",
  parameters: {
    type: "object",
    properties: {},
  },
};

/**
 * Copy profile stream knobs into pi-ai's common option vocabulary.
 * Nhận: profile — profile route đã phân giải; reasoning — mức đã kiểm (undefined khi "off");
 *   apiKey — khoá đã phân giải, undefined để pi-ai tự phân giải auth của route.
 * Trả: SimpleStreamOptions dùng chung; luôn tắt retry nội bộ của pi-ai bằng maxRetries: 0.
 */
function profileOptions(
  profile: ResolvedPiAiProviderProfile,
  reasoning: ModelThinkingLevel | undefined,
  apiKey: string | undefined,
): SimpleStreamOptions {
  const enabledReasoning = reasoning === "off" ? void 0 : reasoning;
  return {
    ...apiKey === void 0 ? {} : { apiKey },
    ...enabledReasoning === void 0 ? {} : { reasoning: enabledReasoning },
    ...profile.thinkingBudgets === void 0 ? {} : { thinkingBudgets: profile.thinkingBudgets },
    ...profile.cacheRetention === void 0 ? {} : { cacheRetention: profile.cacheRetention },
    ...profile.transport === void 0 ? {} : { transport: profile.transport },
    ...profile.timeoutMs === void 0 ? {} : { timeoutMs: profile.timeoutMs },
    ...profile.websocketConnectTimeoutMs === void 0 ? {} : { websocketConnectTimeoutMs: profile.websocketConnectTimeoutMs },
    maxRetries: 0,
  };
}

/**
 * The profile default this exact model can actually take, for DESCRIBING it.
 * A configured level the model does not support yields none rather than
 * throwing: `resolveModel` builds the model catalog, and a catalog that fails
 * takes its whole provider out of every picker — so one mis-set profile field
 * would hide every model on the route, including the ones that support the
 * level. The request path still refuses, which is where a bad configuration
 * belongs: describing what a model can do must not fail because a deployment
 * asked it for something it cannot.
 * Nhận: model — descriptor model đã phân giải; effort — mức mà profile cấu hình, nếu có.
 * Trả: mức đó khi model này hỗ trợ, ngược lại undefined.
 */
function describableReasoningLevel(model: Model<Api>, effort: ModelThinkingLevel | undefined): ModelThinkingLevel | undefined {
  if (effort === void 0) return void 0;
  return getSupportedThinkingLevels(model).some((level) => level === effort) ? effort : void 0;
}

/**
 * Validate an explicit Harness/profile effort without invoking pi-ai's clamp.
 * Nhận: model — descriptor model đã phân giải; effort — mức do request hoặc profile chọn.
 * Trả: mức đó khi model hỗ trợ.
 * @throws {LlmError} mã "UNSUPPORTED_REASONING_EFFORT" khi model không hỗ trợ mức đã đặt.
 */
function resolveReasoningLevel(
  model: Model<Api>,
  effort: ReasoningEffortId | ModelThinkingLevel | undefined,
): ModelThinkingLevel | undefined {
  if (effort === void 0) return void 0;
  if (getSupportedThinkingLevels(model).some((level) => level === effort)) return effort as ModelThinkingLevel;
  throw new LlmError(`pi-ai provider "${model.provider}" model "${model.id}" does not support reasoning effort "${effort}"`, "UNSUPPORTED_REASONING_EFFORT");
}

/**
 * Selectable reasoning efforts for one model, or nothing at all.
 *
 * A model that carries no reasoning metadata — every hand-declared one, and
 * every catalog model pi-ai marks as non-reasoning — is reported by pi-ai as
 * supporting the single level `off`. Passing that through would offer a control
 * that cannot do what it says: `off` is translated to *omitting* the reasoning
 * option, which for such a model is byte-for-byte the same request as naming no
 * effort — so a provider whose own default is to think would keep thinking with
 * `off` selected. Omitting `reasoning` entirely is the seam's way of saying the
 * capability is unavailable, which leaves the surface offering only the
 * provider's default.
 * Nhận: model — descriptor model đã phân giải; defaultLevel — effort mà profile cấu hình, đã kiểm.
 * Trả: field `reasoning`, hoặc object rỗng khi không mức nào có thể mời chọn.
 */
function reasoningInfo(
  model: Model<Api>,
  defaultLevel: ModelThinkingLevel | undefined,
): Partial<Pick<LlmResolvedModelInfo, "reasoning">> {
  if (!model.reasoning) return {};
  return { reasoning: {
    efforts: getSupportedThinkingLevels(model).map((level) => ({
      id: ReasoningEffortId(level),
      name: `${level.charAt(0).toUpperCase()}${level.slice(1)}`,
    })),
    ...defaultLevel === void 0 ? {} : { defaultEffort: ReasoningEffortId(defaultLevel) },
  } };
}

/**
 * Merge deployment headers while removing case-insensitive attribution collisions.
 * Nhận: headers — header do deployment khai (có thể undefined).
 * Trả: header đã gộp, trong đó attribution của Harness thắng mọi tên trùng không phân biệt hoa thường.
 */
function requestHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const attribution = attributionHeaders();
  const reserved = new Set(Object.keys(attribution).map((name) => name.toLowerCase()));
  return {
    ...Object.fromEntries(Object.entries(headers ?? {}).filter(([name]) => !reserved.has(name.toLowerCase()))),
    ...attribution,
  };
}

/**
 * Giải phóng một IdleWatchdog đúng ngữ nghĩa `using` của bản gốc (gọi `[Symbol.dispose]`) mà
 * KHÔNG phụ thuộc việc lib chuẩn của chương trình có khai báo `Symbol.dispose` hay không.
 * Nhận: watchdog — watchdog đã cấp cho một lượt stream.
 * Trả: không.
 * @throws {TypeError} khi runtime không có `Symbol.dispose` hoặc watchdog không có hàm dispose.
 */
function disposeWatchdog(watchdog: IdleWatchdog): void {
  const key = (Symbol as unknown as { dispose?: symbol }).dispose;
  if (key === undefined) throw new TypeError("Symbol.dispose is not defined.");
  const dispose = (watchdog as unknown as Record<symbol, unknown>)[key];
  if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
  dispose.call(watchdog);
}

/**
 * pi-ai-backed multi-provider adapter. Each operation reads the current
 * profiles, so a configuration change reaches the next request without a
 * restart; model descriptors come from the collection those profiles built.
 * Nhận: config — hai hook phân giải của plugin cùng các hook tuỳ chọn (attachment, image access,
 *   chẩn đoán replay); mọi thao tác đọc lại `config.profiles()` nên cấu hình mới tới được request kế.
 * Trả: một LlmAdapter dùng được cho mọi route mà profiles khai.
 */
export class PiAiAdapter extends LlmAdapter {
  /** Hai hook phân giải của plugin, giữ nguyên tham chiếu suốt vòng đời adapter. */
  private readonly config: PiAiAdapterOptions;
  /** Snapshot của lượt phân giải gần nhất; đổi cấu hình làm nó được dựng lại. */
  private snapshot: PiAiSnapshot | undefined;

  /**
   * Dựng adapter quanh các hook phân giải của plugin.
   * Nhận: config — options của adapter (profiles, resolveApiKey, auth và các hook tuỳ chọn).
   * Trả: không — chỉ gán cấu hình; snapshot được dựng lười ở thao tác đầu tiên.
   */
  constructor(config: PiAiAdapterOptions) {
    super();
    this.config = config;
  }

  /**
   * Resolve provider-side image dimensions and byte target for one exact route/model pair.
   * Nhận: provider — route đã đăng ký; model — id model chính xác; image — ảnh chuẩn hoá cần đích request.
   * Trả: đích request dùng chung cho serialization và mapping toạ độ screenshot.
   * @throws {LlmError} mã "NO_ADAPTER"/"INVALID_CONFIG"/"UNKNOWN_MODEL" khi route hoặc model không thuộc
   *   snapshot hiện tại, đúng các kiểm của `modelOf`.
   */
  override imageRequestTarget(provider: string, model: string, image: ImageAttachmentRef): ImageRequestTarget {
    const snapshot = this.current();
    this.modelOf(snapshot, provider, model);
    const profile = this.profileOf(snapshot, provider);
    return requestImageTarget(image, {
      maxPixels: profile.requestImagePixelBudget,
      maxBytes: profile.requestImageMaxBytes,
    });
  }

  /**
   * The snapshot for the current profiles. Resolution memoizes its result, so
   * an unchanged configuration is recognized by identity; a changed one gets a
   * brand-new collection, leaving any snapshot an operation already captured
   * untouched for as long as that operation holds it.
   * Nhận: không — đọc `config.profiles()` của lượt gọi.
   * Trả: snapshot bất biến của cấu hình hiện tại (dựng mới khi identity profiles đổi).
   */
  private current(): PiAiSnapshot {
    const profiles = this.config.profiles();
    if (this.snapshot?.profiles === profiles) return this.snapshot;
    const models = createModels(this.config.auth);
    for (const profile of profiles.values()) if (profile.piProvider !== void 0) models.setProvider(profile.piProvider);
    this.snapshot = {
      profiles,
      models,
    };
    return this.snapshot;
  }

  /**
   * The profile for one route within one snapshot, or the not-owned failure.
   * Nhận: snapshot — snapshot đã chụp; provider — route cần đọc.
   * Trả: profile đã phân giải của route.
   * @throws {LlmError} mã "NO_ADAPTER" khi adapter không sở hữu route này.
   */
  private profileOf(snapshot: PiAiSnapshot, provider: string): ResolvedPiAiProviderProfile {
    const profile = snapshot.profiles.get(provider);
    if (profile === void 0) throw new LlmError(`pi-ai adapter does not own provider "${provider}"`, "NO_ADAPTER");
    return profile;
  }

  /**
   * The configured descriptor for one exact route/model pair within one snapshot.
   * Nhận: snapshot — snapshot đã chụp; provider — route sở hữu; model — id model chính xác.
   * Trả: descriptor model đã materialize trong collection của snapshot.
   * @throws {LlmError} mã "INVALID_CONFIG" khi profile/model có chẩn đoán catalog, "UNKNOWN_MODEL"
   *   khi model không được cấu hình cho route.
   */
  private modelOf(snapshot: PiAiSnapshot, provider: string, model: string): Model<Api> {
    const profile = this.profileOf(snapshot, provider);
    const failure = profile.modelErrors.get(model) ?? (profile.piProvider === void 0 ? profile.catalogError : void 0);
    if (failure !== void 0) throw new LlmError(failure, "INVALID_CONFIG");
    const resolved = snapshot.models.getModel(provider, model);
    if (resolved === void 0) throw new LlmError(`pi-ai provider "${provider}" has no configured model "${model}"`, "UNKNOWN_MODEL");
    return resolved;
  }

  /**
   * Describe one provider route owned by this adapter.
   * Nhận: provider — route đã đăng ký cho adapter này.
   * Trả: metadata hiển thị tách rời, với id bằng đúng `provider`.
   */
  override providerInfo(provider: string): LlmProviderInfo {
    return {
      id: provider,
      name: this.current().profiles.get(provider)?.displayName ?? provider,
    };
  }

  /**
   * Return the provider-owned retry policy captured with this route.
   * Nhận: provider — route đã đăng ký.
   * Trả: policy đã phân giải của route, hoặc undefined để dùng mặc định thường.
   */
  override providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined {
    return this.current().profiles.get(provider)?.retryPolicy;
  }

  /**
   * List models this adapter can currently advertise for one owned provider.
   * Nhận: provider — một route thuộc adapter này.
   * Trả: model khám phá được theo thứ tự collection; rỗng khi credential bắt buộc còn thiếu
   *   (`MISSING_CREDENTIAL`); lỗi khác được ném lại.
   */
  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve().then(async () => {
      const snapshot = this.current();
      const profile = this.profileOf(snapshot, provider);
      try {
        await this.config.resolveApiKey(provider, profile);
      } catch (error) {
        // Lỗi có thể đến từ MỘT BẢN SAO khác của peer ⇒ nhận diện theo tên lớp, KHÔNG theo `instanceof`.
        if (isNamedError(error, "LlmError") && (error as LlmError).code === "MISSING_CREDENTIAL") return [];
        throw error;
      }
      return snapshot.models.getModels(provider).map((model) => ({
        provider,
        id: model.id,
        name: model.name,
        inputModalities: [...model.input],
      }));
    });
  }

  /**
   * Resolve all metadata available for one exact model.
   * Nhận: provider — route thuộc adapter; model — id model chính xác; _signal — không dùng (tra cứu đồng bộ).
   * Trả: metadata provider/model, kèm context, call-default và reasoning khi có.
   */
  override resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    return Promise.resolve().then(() => {
      const snapshot = this.current();
      return this.modelInfo(snapshot, provider, model);
    });
  }

  /**
   * Build exact-route model metadata from one snapshot.
   * Nhận: snapshot — snapshot đã chụp; provider — route sở hữu; model — id model chính xác.
   * Trả: descriptor `LlmResolvedModelInfo` đầy đủ của route/model.
   * @throws {LlmError} các mã của `profileOf`/`modelOf` khi route hoặc model không dùng được.
   */
  private modelInfo(snapshot: PiAiSnapshot, provider: string, model: string): LlmResolvedModelInfo {
    const profile = this.profileOf(snapshot, provider);
    const resolvedModel = this.modelOf(snapshot, provider, model);
    const defaultLevel = describableReasoningLevel(resolvedModel, profile.reasoning);
    const configuredMaxTokens = profile.configuredMaxTokens.get(model);
    return {
      provider,
      id: model,
      name: resolvedModel.name,
      inputModalities: [...resolvedModel.input],
      context: { contextWindow: resolvedModel.contextWindow },
      ...configuredMaxTokens === void 0 ? {} : { defaultMaxTokens: configuredMaxTokens },
      ...reasoningInfo(resolvedModel, defaultLevel),
      ...conversationUpdates(resolvedModel),
    };
  }

  /**
   * Bind exact model metadata and the eventual request dispatch to one adapter generation.
   * Nhận: provider — route đã đăng ký; model — id model chính xác; _signal — không dùng.
   * Trả: metadata model và entry stream của CHÍNH snapshot này.
   * @throws {LlmError} các mã của `modelInfo` khi route hoặc model không dùng được.
   */
  override prepareCall(provider: string, model: string, _signal?: AbortSignal): Promise<PreparedAdapterCall> {
    const snapshot = this.current();
    return Promise.resolve({
      model: this.modelInfo(snapshot, provider, model),
      stream: (options) => this.streamWithSnapshot(options, snapshot),
    });
  }

  /**
   * Stream one model call as raw chunks.
   * Nhận: options — request đã lắp đầy đủ của Harness.
   * Trả: stream chunk của lượt gọi, chụp snapshot ngay tại thời điểm gọi.
   */
  override stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    return this.streamWithSnapshot(options, this.current());
  }

  /**
   * Stream one call through an already captured snapshot.
   *
   * Thứ tự kiểm giữ nguyên bản gốc: stop option bị từ chối TRƯỚC khi phân giải route/model và
   * credential; profile/model lấy từ snapshot rồi mới tới reasoning, apiKey, consumer, watchdog.
   * Nhận: options — request Harness; snapshot — snapshot đã chụp cho lượt gọi này.
   * Trả: async generator các StreamChunk, kết thúc bằng usage rồi finish.
   * @throws {LlmError} "UNSUPPORTED_OPTION" cho `stop`; các mã của profileOf/modelOf;
   *   "UNSUPPORTED_CONTENT" khi ảnh không được model/route nhận; "TIMEOUT" khi watchdog hết hạn;
   *   "ABORTED" khi caller huỷ; lỗi khác được ném lại nguyên vẹn.
   */
  private async *streamWithSnapshot(options: GenerateOptions, snapshot: PiAiSnapshot): AsyncGenerator<StreamChunk> {
    if (options.stop !== void 0) throw new LlmError("llm-pi-ai does not support GenerateOptions.stop", "UNSUPPORTED_OPTION");
    const profile = this.profileOf(snapshot, options.provider);
    const model = this.modelOf(snapshot, options.provider, options.model);
    const updates = conversationUpdates(model);
    const tools = options.tools ?? [];
    const request = model.api === "anthropic-messages" && updates.toolUpdate === "in-history" && tools.every((tool) => tool.deferLoading === true) && options.messages.some((message) => message.role === "developer" && message.content.some((block) => block.type === "tool-addition" || block.type === "tool-removal")) ? {
      ...options,
      tools: [ANTHROPIC_TOOL_UPDATE_PLACEHOLDER, ...tools],
    } : options;
    const reasoning = resolveReasoningLevel(model, options.reasoningEffort ?? profile.reasoning);
    const apiKey = await this.config.resolveApiKey(options.provider, profile);
    const consumer = new AbortController();
    const upstream = options.signal === void 0 ? consumer.signal : AbortSignal.any([options.signal, consumer.signal]);
    const streamIdleTimeoutMs = profile.streamIdleTimeoutMs;
    const watchdog = idleWatchdog(upstream, streamIdleTimeoutMs, "LLM_STREAM_IDLE_TIMEOUT");
    try {
      const containsImage = options.messages.some((message) => contentHasImage(message.content));
      if (containsImage && !model.input.includes("image")) throw new LlmError(`pi-ai model "${model.id}" does not support image input`, "UNSUPPORTED_CONTENT");
      const attachments = containsImage ? this.config.resolveAttachments?.() : void 0;
      if (containsImage && attachments === void 0) throw new LlmError("pi-ai image input requires the durable attachment service", "UNSUPPORTED_CONTENT");
      const onReplayDegrade = (reason: string): void => {
        this.config.onReplayDegrade?.({
          provider: options.provider,
          model: options.model,
          reason,
        });
      };
      const context = attachments === void 0 ? toPiContext(request, void 0, onReplayDegrade) : await toPiContext({
        ...request,
        signal: watchdog.signal,
      }, {
        attachments,
        resolveImageAccess: (ref: ImageAttachmentRef) => this.config.resolveImageAccess?.(attachments, ref),
        maxRequestImageBytes: profile.maxRequestImageBytes,
        requestImagePolicy: {
          maxPixels: profile.requestImagePixelBudget,
          maxBytes: profile.requestImageMaxBytes,
        },
      }, onReplayDegrade);
      const iterator = toStreamChunks(snapshot.models.streamSimple(model, context, {
        ...profileOptions(profile, reasoning, apiKey),
        ...options.temperature === void 0 ? {} : { temperature: options.temperature },
        ...options.maxTokens === void 0 ? {} : { maxTokens: options.maxTokens },
        ...options.sessionId === void 0 ? {} : { sessionId: String(options.sessionId) },
        signal: watchdog.signal,
        headers: requestHeaders(profile.headers),
      }), model.contextWindow, options.signal, model.id)[Symbol.asyncIterator]();
      let exhausted = false;
      try {
        while (true) {
          const result = await watchdog.next(iterator);
          if (result.done) {
            exhausted = true;
            return;
          }
          yield result.value;
        }
      } finally {
        if (!exhausted) {
          consumer.abort("pi-ai stream consumer stopped");
          /* v8 ignore next -- the detached drain only rejects while unwinding an abandoned stream. */
          iterator.return(void 0).catch(() => {});
        }
      }
    } catch (error) {
      if (timeoutOf(watchdog.signal, "LLM_STREAM_IDLE_TIMEOUT") !== void 0) throw new LlmError(`pi-ai stream idle timeout after ${streamIdleTimeoutMs}ms`, "TIMEOUT", { cause: error });
      if (options.signal?.aborted) throw new LlmError("pi-ai request aborted by caller", "ABORTED", { cause: error });
      throw error;
    } finally {
      consumer.abort("pi-ai stream consumer stopped");
      disposeWatchdog(watchdog);
    }
  }
}
