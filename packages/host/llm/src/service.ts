/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Dịch vụ `ctx.llm`: sổ adapter, waterfall `llm/stream`, thư mục provider cấu hình được, khám phá model và biên adapter — port 1:1 lib/types/index.js dòng 1565–2428 của @deepseek-ai/dsh-llm.
 */

import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-llm";
import type { LlmStreamDispatch, LlmStreamOptions, LlmStreamResult, LlmStreamThisArg } from "./stream-seam.ts";
import type { FileAttachmentRef, ImageAttachmentRef, ImageRequestTarget } from "@deepseek-ai/dsh-attachment";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { deepFreeze } from "@deepseek-ai/dsh-util-values";

import { normalizeLlmFailure } from "./adapter-failure.ts";
import { normalizeApiKey } from "./api-key.ts";
import type { ProviderRequestId } from "./brand.ts";
import {
  callConfigEquals,
  type ConfigureCall,
  type LlmCallConfig,
  type LlmCallConfigAdapterDefaults,
} from "./call-config.ts";
import { contentHasFile, contentHasImage, fileHandleText, projectFilesToText, projectImagesForTextModel, projectToolUpdates } from "./content.ts";
import { HarnessError, INVALID_CREDENTIAL_CODE } from "./error.ts";
import { freezeMessage } from "./message.ts";
import { resolveRetryPolicy, type ResolvedRetryPolicy } from "./retry-policy.ts";
import type {
  GenerateOptions,
  LlmConfigurableProvider,
  LlmDiscoveredModel,
  LlmFailure,
  LlmImageRequestPricing,
  LlmModelContext,
  LlmModelDiscoveryRequest,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  ModelModality,
  RequestMessage,
  StreamChunk,
  SystemPromptUpdate,
  ToolUpdate,
} from "./types.ts";

/** Structured provider facts and cause accepted by {@link LlmError}. */
export interface LlmErrorOptions extends ErrorOptions {
  /** Valid HTTP status observed at the provider boundary. */
  status?: number;
  /** Positive finite provider-requested delay in milliseconds. */
  providerRetryAfterMs?: number;
  /** Non-empty opaque provider request id. */
  requestId?: ProviderRequestId;
  /** Positive count of additional oldest retained image occurrences to offload; only with `IMAGE_OFFLOAD_REQUIRED`. */
  offloadImages?: number;
}

/**
 * Lỗi có kiểu cho mọi thất bại liên quan tới LLM; mở rộng {@link HarnessError}.
 * Nhận: message — mô tả người đọc khác rỗng; code — mã máy ổn định; options — cause và dữ kiện provider.
 * Trả: Error mang thêm `failure` bất biến (message, code, status, providerRetryAfterMs, requestId, offloadImages).
 */
export class LlmError extends HarnessError {
  /** Serializable facts retained beside this live Error. */
  readonly failure: LlmFailure;

  /**
   * Dựng LlmError đã kiểm dữ kiện đầu vào.
   * Nhận: message — mô tả khác rỗng; code — mã máy khác rỗng; options — cause và dữ kiện provider.
   * Trả: thể hiện LlmError với `name` = "LlmError" và `failure` đã đóng băng.
   */
  constructor(message: string, code: string, options?: LlmErrorOptions) {
    if (typeof message !== "string" || message.length === 0) throw new Error("LlmError message must be a non-empty string");
    if (typeof code !== "string" || code.length === 0) throw new Error("LlmError code must be a non-empty string");
    if (options?.status !== undefined && (!Number.isInteger(options.status) || options.status < 100 || options.status > 599)) {
      throw new Error("LlmError status must be an integer from 100 through 599");
    }
    if (options?.providerRetryAfterMs !== undefined && (!Number.isFinite(options.providerRetryAfterMs) || options.providerRetryAfterMs <= 0)) {
      throw new Error("LlmError providerRetryAfterMs must be a positive finite number");
    }
    if (options?.requestId !== undefined && (typeof options.requestId !== "string" || options.requestId.length === 0)) {
      throw new Error("LlmError requestId must be a non-empty string");
    }
    super(message, code, options);
    this.name = "LlmError";
    this.failure = Object.freeze({
      message,
      code,
      ...options?.status === undefined ? {} : { status: options.status },
      ...options?.providerRetryAfterMs === undefined ? {} : { providerRetryAfterMs: options.providerRetryAfterMs },
      ...options?.requestId === undefined ? {} : { requestId: options.requestId },
      ...options?.offloadImages === undefined ? {} : { offloadImages: options.offloadImages },
    });
  }
}

/**
 * Chấp nhận một credential đã cấp, hoặc từ chối nó là không dùng được.
 * Nhận: raw — credential đúng như được cấp; pkg — tên package từ chối; ref — tham chiếu credential đã giải.
 * Trả: khoá đã trim, dùng được; ném LlmError mã INVALID_CREDENTIAL khi khoá rỗng hoặc chứa ký tự header
 * không mang được. Khoá KHÔNG bao giờ xuất hiện trong message.
 */
export function assertUsableApiKey(raw: string, pkg: string, ref: string): string {
  const checked = normalizeApiKey(raw);
  if (checked.ok) return checked.value;
  throw new LlmError(
    checked.reason === "empty"
      ? `${pkg}: the API key resolved from ${ref} is blank; set ${ref} to the raw key (the web Models page writes it) or export it in the launching environment`
      : `${pkg}: the API key resolved from ${ref} contains characters no HTTP header can carry; set ${ref} to the raw key alone (the web Models page writes it)`,
    INVALID_CREDENTIAL_CODE,
  );
}

/** One model call whose config and adapter registration were resolved together. */
export interface PreparedLlmCall {
  /** Detached, deep-frozen config with any adapter-owned default materialized. */
  readonly config: LlmCallConfig;
  /** Immutable retry policy captured with the adapter registration. */
  readonly retryPolicy: ResolvedRetryPolicy;
  /** Detached context metadata resolved with the registration-bound call. */
  readonly context?: LlmModelContext;
  /** Exact model modalities captured with the adapter dispatch generation. */
  readonly inputModalities?: readonly ModelModality[];
  /** Exact model system prompt update mode captured with the adapter dispatch generation. */
  readonly systemPromptUpdate?: SystemPromptUpdate;
  /** Exact model tool update mode captured with the adapter dispatch generation. */
  readonly toolUpdate?: ToolUpdate;
  /** Config fields materialized by the captured adapter rather than proposed by the caller. */
  readonly adapterDefaults: LlmCallConfigAdapterDefaults;
  /**
   * Dispatch this call once through the registration captured during preparation.
   * Nhận: options — request đã lắp mang đúng call-config đã chuẩn bị.
   * Trả: luồng chunk gồm waterfall `llm/stream`; dùng lại hoặc lệch config ném INVALID_PREPARED_CALL.
   */
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}

/** One adapter-owned model-resolution generation bound to its eventual stream call. */
export interface PreparedAdapterCall {
  /** Exact model metadata from the same adapter generation as {@link stream}. */
  readonly model: LlmResolvedModelInfo;
  /**
   * Dispatch qua đúng thế hệ adapter, không đọc lại dữ kiện kết nối động.
   * Nhận: options — request đã lắp đầy.
   * Trả: luồng chunk thô của adapter.
   */
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}

/** Disposer của {@link LlmRuntime.registerAdapter}, kèm thay thế route nguyên tử cho cùng adapter. */
export interface AdapterRegistrationHandle {
  /** Release every route this registration currently holds. */
  (): void;
  /**
   * Replace this registration's routes with `providers`, keeping the same adapter instance.
   * Nhận: providers — toàn bộ tập route kế tiếp.
   * Trả: không; tập ứng viên được kiểm đầy đủ trước, swap là MỘT đoạn đồng bộ.
   */
  replace(providers: string[]): void;
}

/** Đăng ký provider cấu hình được đang sống — bản đối chiếu thư mục của {@link AdapterRegistrationHandle}. */
export interface DirectoryRegistrationHandle {
  /** Withdraw every entry this registration currently holds. */
  (): void;
  /**
   * Replace this registration's entries with `entries`.
   * Nhận: entries — toàn bộ tập entry kế tiếp.
   * Trả: không; tập ứng viên được kiểm đầy đủ trước, swap là MỘT đoạn đồng bộ.
   */
  replace(entries: readonly LlmConfigurableProvider[]): void;
}

/**
 * Adapter provider-wire cho từ vựng message/stream của harness. Đăng ký bằng
 * `ctx.llm.registerAdapter(providers, adapter)`. Mọi request HTTP phải kèm `attributionHeaders()`.
 */
export abstract class LlmAdapter {
  /**
   * Describe one provider route owned by this adapter.
   * Nhận: provider — route đã truyền cho `registerAdapter()`.
   * Trả: metadata hiển thị đã tách, `id` bằng đúng `provider`.
   */
  providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: provider };
  }

  /**
   * Return the provider-owned retry policy captured with this route.
   * Nhận: _provider — route đã truyền cho `registerAdapter()`.
   * Trả: chính sách đã giải, hoặc undefined để dùng mặc định thường.
   */
  providerRetryPolicy(_provider: string): ResolvedRetryPolicy | undefined {
    return undefined;
  }

  /**
   * Resolve provider-side request-image pricing for one exact model route.
   * Nhận: _provider — route đã đăng ký; _model — đúng id model.
   * Trả: giá ảnh do route sở hữu, hoặc undefined khi route không khai (mặc định).
   */
  imageRequestPricing(_provider: string, _model: string): LlmImageRequestPricing | undefined {
    return undefined;
  }

  /**
   * Resolve the image dimensions and byte target this adapter sends to the model.
   * Nhận: _provider — route đã đăng ký; _model — đúng id model; image — ảnh đã chuẩn hoá.
   * Trả: đúng mục tiêu bộ tuần tự hoá request dùng, trước xử lý nội bộ provider.
   */
  imageRequestTarget(_provider: string, _model: string, image: ImageAttachmentRef): ImageRequestTarget {
    return { width: image.width, height: image.height, maxBytes: image.bytes };
  }

  /**
   * List models this adapter can currently advertise for one owned provider.
   * Nhận: _provider — một route do adapter này sở hữu.
   * Trả: model khám phá được theo thứ tự adapter ưu tiên; mặc định rỗng.
   */
  listModels(_provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve([]);
  }

  /**
   * Resolve all metadata available for one exact model.
   * Nhận: provider — route do adapter này sở hữu; model — đúng id model; _signal — huỷ cho tra cứu.
   * Trả: định danh provider/model kèm metadata ngữ cảnh, default và reasoning khi có.
   */
  resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model });
  }

  /**
   * Bind exact model metadata and the eventual request dispatch to one adapter generation.
   * Nhận: provider — route đã đăng ký; model — đúng id model; signal — huỷ cho việc giải model.
   * Trả: metadata model và điểm vào stream thuộc đúng thế hệ đó.
   */
  async prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall> {
    return {
      model: await this.resolveModel(provider, model, signal),
      stream: (options) => this.stream(options),
    };
  }

  /**
   * Stream one model call as raw chunks. The only required method.
   * Nhận: options — request đã lắp đầy; cài đặt phải tôn trọng `options.signal`.
   * Trả: luồng chunk thô, tuân hợp đồng StreamChunk.
   */
  abstract stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}

/** Một đăng ký adapter đã chuẩn hoá. */
interface AdapterRegistration {
  /** Adapter sở hữu route này. */
  readonly adapter: LlmAdapter;
  /** Metadata hiển thị của route. */
  readonly provider: LlmProviderInfo;
  /** Chính sách thử lại đã giải, chụp lúc đăng ký. */
  readonly retryPolicy: ResolvedRetryPolicy;
}

/** Một lời gọi đã chuẩn bị, mang đăng ký adapter và điểm dispatch của đúng thế hệ đó. */
interface PreparedStream {
  /** Đăng ký adapter chụp lúc chuẩn bị. */
  readonly registration: AdapterRegistration;
  /** Config đã giải và đóng băng. */
  readonly config: LlmCallConfig;
  /** Metadata model đã chuẩn hoá. */
  readonly modelInfo: LlmResolvedModelInfo;
  /** Dispatch qua thế hệ adapter đã chụp. */
  readonly dispatch: (options: GenerateOptions) => AsyncIterable<StreamChunk>;
}

/** Một offer khám phá model theo namespace cấu hình. */
type ModelDiscovery = (request: LlmModelDiscoveryRequest, signal?: AbortSignal) => Promise<readonly LlmDiscoveredModel[]>;

/** Dịch vụ `llm` trừu tượng: sổ adapter cộng API gọi model dạng stream, chặn được qua waterfall `llm/stream`. */
export class LlmRuntime extends TypertRemoteService {
  /** Route provider → đăng ký adapter đang sống. */
  private adapters = new Map<string, AdapterRegistration>();

  /** Provider cấu hình được → entry thư mục đã tách. */
  private directory = new Map<string, LlmConfigurableProvider>();

  /** Namespace cấu hình → offer khám phá model. */
  private discoveries = new Map<string, ModelDiscovery>();

  /**
   * Đăng ký dịch vụ dưới khoá `llm` trong context sở hữu.
   * Nhận: ctx — context cordis sở hữu dịch vụ.
   * Trả: thể hiện LlmRuntime đã đăng ký, tự gỡ theo vòng đời fiber.
   */
  constructor(ctx: Context) {
    super(ctx, "llm");
  }

  /** Notify topology observers without letting one broken listener veto the commit. */
  private emitAdaptersUpdated(): void {
    for (const listener of this.ctx.events.dispatch("emit", ["llm/adapters-updated"])) {
      try {
        const returned = listener();
        if (returned != null && typeof returned.then === "function") {
          Promise.resolve(returned).then(void 0, (error) => {
            this.warnAdaptersListenerFailure(error);
          });
        }
      } catch (error) {
        this.warnAdaptersListenerFailure(error);
      }
    }
  }

  /** Contained-listener diagnostic shared by the sync and async failure paths. */
  private warnAdaptersListenerFailure(error: unknown): void {
    this.ctx.logger.warn("llm: an llm/adapters-updated listener failed");
    this.ctx.logger.warn(error);
  }

  /**
   * Register an adapter for the given provider routes.
   * Nhận: providers — mọi route adapter này phục vụ; adapter — adapter stream các lời gọi đó.
   * Trả: disposer mang `replace`; ném LlmError mã DUPLICATE_ADAPTER nếu provider nào đã có adapter
   * (toàn bộ hoặc không gì cả). Tự gỡ theo fiber.
   */
  registerAdapter(providers: string[], adapter: LlmAdapter): AdapterRegistrationHandle {
    const owned = new Set<string>();
    let released = false;
    const dispose = this.ctx.effect(
      function* (this: LlmRuntime) {
        if (providers.length === 0) throw new LlmError("an adapter must register at least one provider", "INVALID_ADAPTER");
        this.commitRoutes(owned, this.prepareRoutes(providers, adapter, owned));
        yield () => {
          released = true;
          for (const provider of owned) this.adapters.delete(provider);
          owned.clear();
          this.emitAdaptersUpdated();
        };
      }.bind(this),
      "llm.registerAdapter()",
    );
    const handle = (() => void dispose()) as AdapterRegistrationHandle;
    handle.replace = (next) => {
      if (released) throw new LlmError("a disposed adapter registration cannot replace its routes", "REGISTRATION_DISPOSED");
      this.commitRoutes(owned, this.prepareRoutes(next, adapter, owned));
    };
    return handle;
  }

  /** Kiểm một tập route ứng viên (coi route đăng ký này đang giữ là sẵn có). Nhận: providers · adapter · owned. Trả: đăng ký đã chuẩn hoá, không sửa sổ. */
  private prepareRoutes(providers: string[], adapter: LlmAdapter, owned: Set<string>): AdapterRegistration[] {
    const unique = new Set<string>();
    const registrations: AdapterRegistration[] = [];
    for (const provider of providers) {
      if (provider.length === 0) throw new LlmError("adapter provider names must be non-empty", "INVALID_ADAPTER");
      if (unique.has(provider) || (this.adapters.has(provider) && !owned.has(provider))) {
        throw new LlmError(`an adapter for provider "${provider}" is already registered`, "DUPLICATE_ADAPTER");
      }
      const info = adapter.providerInfo(provider);
      if (typeof info.id !== "string" || info.id !== provider || typeof info.name !== "string" || info.name.length === 0) {
        throw new LlmError(`adapter metadata for provider "${provider}" must preserve its id and have a non-empty name`, "INVALID_ADAPTER");
      }
      unique.add(provider);
      const retryPolicy = adapter.providerRetryPolicy(provider) ?? resolveRetryPolicy(undefined, `llm: provider "${provider}" retryPolicy`);
      registrations.push({
        adapter,
        provider: { id: info.id, name: info.name },
        retryPolicy,
      });
    }
    return registrations;
  }

  /** Hoán đổi route của đăng ký này trong MỘT đoạn đồng bộ. Nhận: owned · registrations. Trả: không; điểm DUY NHẤT phát `llm/adapters-updated`. */
  private commitRoutes(owned: Set<string>, registrations: AdapterRegistration[]): void {
    for (const provider of owned) this.adapters.delete(provider);
    owned.clear();
    for (const registration of registrations) {
      this.adapters.set(registration.provider.id, registration);
      owned.add(registration.provider.id);
    }
    this.emitAdaptersUpdated();
  }

  /**
   * Describe provider routes with a registered adapter.
   * Nhận: không.
   * Trả: metadata provider đã tách, theo thứ tự đăng ký.
   */
  @Remote
  listProviders(): LlmProviderInfo[] {
    return [...this.adapters.values()].map(({ provider }) => ({ ...provider }));
  }

  /**
   * Declare provider routes an adapter plugin can activate through configuration.
   * Nhận: entries — mọi provider cấu hình được mà plugin này sở hữu.
   * Trả: handle gỡ tất cả và thay thế nguyên tử; đăng ký toàn bộ hoặc không gì cả.
   */
  registerConfigurableProviders(entries: readonly LlmConfigurableProvider[]): DirectoryRegistrationHandle {
    let held: LlmConfigurableProvider[] = [];
    let disposed = false;
    /** Validate a candidate set in full, then publish it. Nhận: candidates — tập ứng viên. Trả: không. */
    const commit = (candidates: readonly LlmConfigurableProvider[]): void => {
      const detached: LlmConfigurableProvider[] = [];
      const own = new Set(held.map((entry) => entry.provider));
      for (const entry of candidates) {
        if (entry.provider.length === 0 || entry.displayName.length === 0 || entry.settingsNs.length === 0) {
          throw new LlmError("configurable providers need a non-empty provider, displayName, and settingsNs", "INVALID_DIRECTORY");
        }
        if (entry.settingsPath.some((segment) => segment.length === 0)) {
          throw new LlmError(`configurable provider "${entry.provider}" has an empty settingsPath segment`, "INVALID_DIRECTORY");
        }
        if ((this.directory.has(entry.provider) && !own.has(entry.provider)) || detached.some((seen) => seen.provider === entry.provider)) {
          throw new LlmError(`configurable provider "${entry.provider}" is already declared`, "DUPLICATE_DIRECTORY");
        }
        detached.push(detachDirectoryEntry(entry));
      }
      for (const entry of held) this.directory.delete(entry.provider);
      for (const entry of detached) this.directory.set(entry.provider, entry);
      held = detached;
      this.emitAdaptersUpdated();
    };
    const dispose = this.ctx.effect(
      function* (this: LlmRuntime) {
        if (entries.length === 0) {
          throw new LlmError("a configurable-provider registration must declare at least one provider", "INVALID_DIRECTORY");
        }
        commit(entries);
        yield () => {
          disposed = true;
          for (const entry of held) this.directory.delete(entry.provider);
          held = [];
          this.emitAdaptersUpdated();
        };
      }.bind(this),
      "llm.registerConfigurableProviders()",
    );
    const handle = (() => void dispose()) as DirectoryRegistrationHandle;
    handle.replace = (next) => {
      if (disposed) throw new LlmError("this configurable-provider registration was disposed", "REGISTRATION_DISPOSED");
      commit(next);
    };
    return handle;
  }

  /**
   * List every declared configurable provider, registered or dormant.
   * Nhận: không.
   * Trả: entry thư mục đã tách, theo thứ tự khai báo.
   */
  @Remote
  listConfigurableProviders(): LlmConfigurableProvider[] {
    return [...this.directory.values()].map(detachDirectoryEntry);
  }

  /**
   * Offer to interrogate provider endpoints on behalf of the settings namespace this plugin owns.
   * Nhận: settingsNs — namespace được khám phá phục vụ; discover — hỏi một endpoint, tôn trọng signal.
   * Trả: disposer gỡ offer; tự gỡ theo fiber.
   */
  registerModelDiscovery(settingsNs: string, discover: ModelDiscovery): () => void {
    const dispose = this.ctx.effect(
      function* (this: LlmRuntime) {
        if (settingsNs.length === 0) throw new LlmError("model discovery needs a non-empty settings namespace", "INVALID_DISCOVERY");
        if (this.discoveries.has(settingsNs)) {
          throw new LlmError(`model discovery for "${settingsNs}" is already registered`, "DUPLICATE_DISCOVERY");
        }
        this.discoveries.set(settingsNs, discover);
        yield () => {
          this.discoveries.delete(settingsNs);
        };
      }.bind(this),
      "llm.registerModelDiscovery()",
    );
    return () => void dispose();
  }

  /**
   * Interrogate one provider endpoint for the models it advertises.
   * Nhận: settingsNs — namespace có offer khám phá; request — endpoint, giao thức, credential một lần;
   * signal — huỷ của bên gọi.
   * Trả: model được quảng cáo, đã khử trùng theo thứ tự endpoint.
   */
  async discoverModels(
    settingsNs: string,
    request: LlmModelDiscoveryRequest,
    signal?: AbortSignal,
  ): Promise<LlmDiscoveredModel[]> {
    const discover = this.discoveries.get(settingsNs);
    if (discover === undefined) throw new LlmError(`no model discovery is registered for "${settingsNs}"`, "NO_DISCOVERY");
    if ((request.provider ?? "").length === 0 && (request.baseURL ?? "").length === 0) {
      throw new LlmError("model discovery needs a provider route or a baseURL", "INVALID_DISCOVERY");
    }
    const discovered = signal === undefined ? await discover(request) : await discover(request, signal);
    const seen = new Set<string>();
    const models: LlmDiscoveredModel[] = [];
    for (const model of discovered) {
      if (typeof model.id !== "string" || model.id.length === 0 || seen.has(model.id)) continue;
      seen.add(model.id);
      models.push({
        id: model.id,
        ...model.name === undefined ? {} : { name: model.name },
        ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
        ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
        ...model.inputModalities === undefined ? {} : { inputModalities: [...model.inputModalities] },
      });
    }
    return models;
  }

  /**
   * Remote adapter for one draft provider interrogation.
   * Nhận: settingsNs — namespace có offer khám phá; request — endpoint, giao thức, credential một lần;
   * signal — huỷ do bộ vận chuyển Remote cấp.
   * Trả: model quảng cáo theo thứ tự endpoint; ném RemoteError `llm/model-discovery-rejected` khi hỏng.
   */
  @Remote("discoverModels")
  async remoteDiscoverModels(
    settingsNs: string,
    request: LlmModelDiscoveryRequest,
    signal: AbortSignal,
  ): Promise<LlmDiscoveredModel[]> {
    try {
      return await this.discoverModels(settingsNs, request, signal);
    } catch (error) {
      throw new RemoteError(
        "llm/model-discovery-rejected",
        error instanceof Error ? error.message : String(error),
        {
          settingsNs,
          ...request.baseURL === undefined ? {} : { baseURL: request.baseURL },
        },
        { cause: error },
      );
    }
  }

  /**
   * Resolve the retry policy captured when one provider route was registered.
   * Nhận: provider — route đã đăng ký cần xem.
   * Trả: chính sách do provider sở hữu, mặc định thường đã giải.
   */
  providerRetryPolicy(provider: string): ResolvedRetryPolicy {
    return this.registration(provider).retryPolicy;
  }

  /**
   * Resolve provider-side request-image pricing for one exact route.
   * Nhận: provider — route provider do header request nêu; model — đúng id model do header nêu.
   * Trả: giá ảnh của adapter sở hữu route khi có khai; undefined khi provider chưa đăng ký hoặc không khai.
   */
  imageRequestPricing(provider: string, model: string): LlmImageRequestPricing | undefined {
    return this.adapters.get(provider)?.adapter.imageRequestPricing(provider, model);
  }

  /**
   * Resolve the image projection for an exact registered model route.
   * Nhận: provider — route đã đăng ký; model — đúng id model; image — tham chiếu ảnh đã chuẩn hoá.
   * Trả: kích thước và mục tiêu byte mà bộ tuần tự hoá request của adapter dùng.
   */
  imageRequestTarget(provider: string, model: string, image: ImageAttachmentRef): ImageRequestTarget {
    return this.registration(provider).adapter.imageRequestTarget(provider, model, image);
  }

  /**
   * Resolve the exact text one durable file occurrence contributes to every provider request.
   * Nhận: ref — tham chiếu tệp nguyên văn bền từ lịch sử model.
   * Trả: đúng văn bản tay nắm tất định dùng lúc adapter dispatch.
   */
  fileRequestText(ref: FileAttachmentRef): string {
    return fileHandleText(ref, this.fileReadPath(ref));
  }

  /**
   * Detach typed adapter-owned modality metadata.
   * Nhận: modalities — modality do adapter sở hữu, có thể undefined.
   * Trả: mảng đã tách, hoặc undefined khi đầu vào undefined.
   */
  private detachedModalities(modalities: readonly ModelModality[] | undefined): ModelModality[] | undefined {
    return modalities === undefined ? undefined : [...modalities];
  }

  /**
   * Discover models advertised by one registered provider.
   * Nhận: provider — route provider đã đăng ký cần xem.
   * Trả: metadata model đã tách theo thứ tự adapter ưu tiên; catalog chỉ tư vấn, không ràng buộc routing lõi.
   */
  async listModels(provider: string): Promise<LlmModelInfo[]> {
    const models = await this.registration(provider).adapter.listModels(provider);
    const seen = new Set<string>();
    return models.map((model): LlmModelInfo => {
      if (
        typeof model.provider !== "string" || model.provider !== provider
        || typeof model.id !== "string" || model.id.length === 0
        || typeof model.name !== "string" || model.name.length === 0
        || (model.description !== undefined && typeof model.description !== "string")
        || seen.has(model.id)
      ) {
        throw new LlmError(`adapter returned invalid or duplicate model metadata for provider "${provider}"`, "INVALID_CATALOG");
      }
      seen.add(model.id);
      const inputModalities = this.detachedModalities(model.inputModalities);
      return {
        provider: model.provider,
        id: model.id,
        name: model.name,
        ...model.description === undefined ? {} : { description: model.description },
        ...inputModalities === undefined ? {} : { inputModalities },
      };
    });
  }

  /**
   * Resolve and validate all metadata from the adapter that owns one exact route.
   * Nhận: provider — route đã đăng ký; model — đúng id model; signal — huỷ tuỳ chọn.
   * Trả: định danh model chính xác kèm metadata ngữ cảnh và reasoning khi có.
   */
  async resolveModelInfo(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    return this.resolveModelInfoFor(this.registration(provider), model, signal);
  }

  /** Giải metadata model qua một đăng ký đã chụp. Nhận: registration · model · signal. Trả: metadata đã chuẩn hoá, đã tách. */
  private async resolveModelInfoFor(
    registration: AdapterRegistration,
    model: string,
    signal?: AbortSignal,
  ): Promise<LlmResolvedModelInfo> {
    const resolved = await registration.adapter.resolveModel(registration.provider.id, model, signal);
    return this.normalizeModelInfo(registration, model, resolved);
  }

  /** Kiểm và tách một kết quả model chính xác do adapter trả. Nhận: registration · model · resolved. Trả: metadata đã kiểm; ném LlmError khi sai/trùng. */
  private normalizeModelInfo(
    registration: AdapterRegistration,
    model: string,
    resolved: LlmResolvedModelInfo,
  ): LlmResolvedModelInfo {
    const provider = registration.provider.id;
    if (
      typeof resolved.provider !== "string" || resolved.provider !== provider
      || typeof resolved.id !== "string" || resolved.id !== model
      || typeof resolved.name !== "string" || resolved.name.length === 0
      || (resolved.description !== undefined && typeof resolved.description !== "string")
    ) {
      throw new LlmError(`adapter returned invalid exact model metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
    }
    const context = resolved.context;
    if (context !== undefined && (!Number.isInteger(context.contextWindow) || context.contextWindow <= 0)) {
      throw new LlmError(`adapter returned invalid context metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_CONTEXT");
    }
    const inputModalities = this.detachedModalities(resolved.inputModalities);
    const systemPromptUpdate = resolved.systemPromptUpdate;
    if (systemPromptUpdate !== undefined && systemPromptUpdate !== "in-history") {
      throw new LlmError(`adapter returned invalid system prompt update mode for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
    }
    const toolUpdate = resolved.toolUpdate;
    if (toolUpdate !== undefined && toolUpdate !== "in-history" && toolUpdate !== "addition-only") {
      throw new LlmError(`adapter returned invalid tool update mode for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
    }
    const defaultMaxTokens = resolved.defaultMaxTokens;
    if (defaultMaxTokens !== undefined && (!Number.isSafeInteger(defaultMaxTokens) || defaultMaxTokens <= 0)) {
      throw new LlmError(`adapter returned invalid default maxTokens for provider "${provider}" model "${model}"`, "INVALID_MODEL_MAX_TOKENS");
    }
    const info: LlmResolvedModelInfo = {
      provider,
      id: model,
      name: resolved.name,
      ...resolved.description === undefined ? {} : { description: resolved.description },
      ...inputModalities === undefined ? {} : { inputModalities },
      ...context === undefined ? {} : { context: { contextWindow: context.contextWindow } },
      ...defaultMaxTokens === undefined ? {} : { defaultMaxTokens },
      ...resolved.systemPromptUpdate === undefined ? {} : { systemPromptUpdate: resolved.systemPromptUpdate },
      ...resolved.toolUpdate === undefined ? {} : { toolUpdate: resolved.toolUpdate },
    };
    const reasoning = resolved.reasoning;
    if (reasoning === undefined) return info;
    if (reasoning.efforts.length === 0) {
      throw new LlmError(`adapter returned invalid reasoning metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
    }
    const seen = new Set<string>();
    const efforts = reasoning.efforts.map((effort) => {
      if (
        typeof effort.id !== "string" || effort.id.length === 0
        || typeof effort.name !== "string" || effort.name.length === 0
        || (effort.description !== undefined && typeof effort.description !== "string")
        || seen.has(effort.id)
      ) {
        throw new LlmError(`adapter returned invalid or duplicate reasoning effort metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
      }
      seen.add(effort.id);
      return {
        id: effort.id,
        name: effort.name,
        ...effort.description === undefined ? {} : { description: effort.description },
      };
    });
    if (reasoning.defaultEffort !== undefined && !seen.has(reasoning.defaultEffort)) {
      throw new LlmError(`adapter returned an unknown default reasoning effort for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
    }
    return {
      ...info,
      reasoning: {
        efforts,
        ...reasoning.defaultEffort === undefined ? {} : { defaultEffort: reasoning.defaultEffort },
      },
    };
  }

  /**
   * Validate a conversation call config against its exact model capability and materialize defaults.
   * Nhận: config — route provider/model và điều khiển request tuỳ chọn; signal — huỷ tuỳ chọn.
   * Trả: config đã tách, chỉ khi phải hiện thực hoá một default.
   */
  async resolveCallConfig(config: LlmCallConfig, signal?: AbortSignal): Promise<LlmCallConfig> {
    return (await this.resolveCallFor(this.registration(config.provider), config, signal)).config;
  }

  /** Giải cấu hình lời gọi qua một đăng ký đã chụp. Nhận: registration · config · signal. Trả: config đã giải kèm metadata/ngữ cảnh. */
  private async resolveCallFor(
    registration: AdapterRegistration,
    config: LlmCallConfig,
    signal?: AbortSignal,
  ): Promise<{ config: LlmCallConfig; context?: LlmModelContext; modelInfo: LlmResolvedModelInfo }> {
    const info = await this.resolveModelInfoFor(registration, config.model, signal);
    return this.resolveCallWithInfo(config, info);
  }

  /** Kiểm điều khiển request với metadata model đã chụp. Nhận: config · info. Trả: config đã giải (default hiện thực hoá), ngữ cảnh, metadata. */
  private resolveCallWithInfo<Config extends LlmCallConfig>(
    config: Config,
    info: LlmResolvedModelInfo,
  ): { config: Config; context?: LlmModelContext; modelInfo: LlmResolvedModelInfo } {
    const defaulted = config.maxTokens === undefined && info.defaultMaxTokens !== undefined
      ? { ...config, maxTokens: info.defaultMaxTokens }
      : config;
    const reasoning = info.reasoning;
    const requested = defaulted.reasoningEffort;
    let resolvedConfig: Config = defaulted;
    if (reasoning === undefined) {
      if (requested !== undefined) {
        throw new LlmError(`provider "${config.provider}" model "${config.model}" does not support reasoning effort "${requested}"`, "UNSUPPORTED_REASONING_EFFORT");
      }
    } else {
      const effective = requested ?? reasoning.defaultEffort;
      if (effective !== undefined) {
        if (!reasoning.efforts.some((effort) => effort.id === effective)) {
          throw new LlmError(`provider "${config.provider}" model "${config.model}" does not support reasoning effort "${effective}"`, "UNSUPPORTED_REASONING_EFFORT");
        }
        if (requested !== effective) {
          resolvedConfig = { ...defaulted, reasoningEffort: effective };
        }
      }
    }
    return {
      config: resolvedConfig,
      ...info.context === undefined ? {} : { context: info.context },
      modelInfo: info,
    };
  }

  /**
   * Resolve one call under its current adapter registration.
   * Nhận: config — route provider/model và điều khiển request cụ thể tuỳ chọn; signal — huỷ tuỳ chọn;
   * configure — chọn điều khiển thuần, gọi MỘT lần trước default và kiểm.
   * Trả: config đã chuẩn bị và điểm vào stream gắn đúng đăng ký.
   */
  async prepareCall(config: LlmCallConfig, signal?: AbortSignal, configure?: ConfigureCall): Promise<PreparedLlmCall> {
    signal?.throwIfAborted();
    const { provider, model, ...controls } = config;
    const registration = this.registration(provider);
    const adapterCall = await registration.adapter.prepareCall(provider, model, signal);
    signal?.throwIfAborted();
    const modelInfo = this.normalizeModelInfo(registration, model, adapterCall.model);
    const proposed: LlmCallConfig = configure === undefined ? config : {
      ...configure(deepFreeze(structuredClone(controls)), deepFreeze(modelInfo)),
      provider,
      model,
    };
    signal?.throwIfAborted();
    const resolved = this.resolveCallWithInfo(proposed, modelInfo);
    const resolvedConfig = deepFreeze(structuredClone(resolved.config));
    const context = resolved.context === undefined ? undefined : deepFreeze(structuredClone(resolved.context));
    const adapterDefaults: LlmCallConfigAdapterDefaults = deepFreeze({
      ...proposed.reasoningEffort === undefined && resolvedConfig.reasoningEffort !== undefined ? { reasoningEffort: true } : {},
      ...proposed.maxTokens === undefined && resolvedConfig.maxTokens !== undefined ? { maxTokens: true } : {},
    });
    let dispatched = false;
    return Object.freeze({
      config: resolvedConfig,
      retryPolicy: registration.retryPolicy,
      adapterDefaults,
      ...context === undefined ? {} : { context },
      ...modelInfo.inputModalities === undefined ? {} : { inputModalities: Object.freeze([...modelInfo.inputModalities]) },
      ...modelInfo.systemPromptUpdate === undefined ? {} : { systemPromptUpdate: modelInfo.systemPromptUpdate },
      ...modelInfo.toolUpdate === undefined ? {} : { toolUpdate: modelInfo.toolUpdate },
      stream: (options: GenerateOptions) => {
        if (dispatched) throw new LlmError("a prepared LLM call can only be dispatched once", "INVALID_PREPARED_CALL");
        if (!callConfigEquals(options, resolvedConfig)) {
          throw new LlmError("prepared LLM call config changed before adapter dispatch", "INVALID_PREPARED_CALL");
        }
        dispatched = true;
        return this.streamWithRegistration(options, {
          registration,
          config: resolvedConfig,
          modelInfo,
          dispatch: (options) => adapterCall.stream(options),
        });
      },
    });
  }

  /** Tra đăng ký adapter của một provider. Nhận: provider. Trả: đăng ký đang sống; ném LlmError NO_ADAPTER khi chưa đăng ký. */
  private registration(provider: string): AdapterRegistration {
    const registration = this.adapters.get(provider);
    if (!registration) throw new LlmError(`no adapter registered for provider "${provider}"`, "NO_ADAPTER");
    return registration;
  }

  /** Gỡ replay state có route lịch sử do adapter khác sở hữu. Nhận: options · adapter. Trả: chính options, hoặc bản sao đã lọc. */
  private forAdapter(options: GenerateOptions, adapter: LlmAdapter): GenerateOptions {
    const messages = options.messages.map((message): RequestMessage => {
      if (message.role !== "assistant") return message;
      const source = message.source;
      if (source.replayState === undefined) return message;
      if (this.adapters.get(source.provider)?.adapter === adapter) return message;
      return freezeMessage({
        ...message,
        source: { kind: "model", provider: source.provider, model: source.model },
      });
    });
    if (messages.every((message, index) => message === options.messages[index])) return options;
    const filtered: GenerateOptions = { ...options, messages };
    return Object.isFrozen(options) ? deepFreeze(filtered) : filtered;
  }

  /** Giải đường dẫn đọc hiện tại của một tham chiếu tệp bền. Nhận: ref. Trả: đường dẫn thực thi, hoặc undefined. */
  private fileReadPath(ref: FileAttachmentRef): string | undefined {
    let hostPath: string | undefined;
    try {
      hostPath = this.ctx.get("attachments")?.fileHostPath(ref);
    } catch {
      return;
    }
    if (hostPath === undefined) return undefined;
    return this.ctx.get("fs")?.processPathFromHostPath(hostPath);
  }

  /** Biên adapter cuối; thất bại chọn/dispatch/iterator thành MỘT chunk `finish`. Nhận: options · prepared. Trả: luồng chunk. */
  private async *adapterStream(
    options: GenerateOptions,
    prepared?: PreparedStream,
  ): AsyncGenerator<StreamChunk, void, undefined> {
    let iterator: AsyncIterator<StreamChunk>;
    try {
      const registration = prepared?.registration ?? this.registration(options.provider);
      const adapter = registration.adapter;
      let modelInfo: LlmResolvedModelInfo;
      let resolvedConfig: LlmCallConfig;
      let dispatch: (options: GenerateOptions) => AsyncIterable<StreamChunk>;
      if (prepared === undefined) {
        const adapterCall = await adapter.prepareCall(options.provider, options.model, options.signal);
        modelInfo = this.normalizeModelInfo(registration, options.model, adapterCall.model);
        resolvedConfig = this.resolveCallWithInfo(options, modelInfo).config;
        dispatch = (options) => adapterCall.stream(options);
      } else {
        modelInfo = prepared.modelInfo;
        resolvedConfig = prepared.config;
        dispatch = prepared.dispatch;
      }
      if (prepared !== undefined && !callConfigEquals(options, resolvedConfig)) {
        throw new LlmError("prepared LLM call config changed before adapter dispatch", "INVALID_PREPARED_CALL");
      }
      const resolvedOptions: GenerateOptions = callConfigEquals(options, resolvedConfig)
        ? options
        : Object.isFrozen(options)
          ? deepFreeze({ ...options, ...resolvedConfig })
          : { ...options, ...resolvedConfig };
      let projectedMessages: readonly RequestMessage[] = resolvedOptions.messages;
      if (projectedMessages.some((message) => contentHasFile(message.content))) {
        projectedMessages = projectFilesToText(projectedMessages, (ref) => this.fileReadPath(ref));
      }
      if (
        modelInfo.inputModalities !== undefined
        && !modelInfo.inputModalities.includes("image")
        && projectedMessages.some((message) => contentHasImage(message.content))
      ) {
        projectedMessages = projectImagesForTextModel(projectedMessages);
      }
      const projectedTools = projectToolUpdates(projectedMessages, resolvedOptions.tools, modelInfo.toolUpdate, resolvedOptions.toolHistory);
      projectedMessages = projectedTools.messages;
      let projectedOptions: GenerateOptions = resolvedOptions;
      if (projectedMessages !== resolvedOptions.messages || projectedTools.tools !== resolvedOptions.tools) {
        projectedOptions = {
          ...resolvedOptions,
          messages: projectedMessages,
          ...projectedTools.tools === undefined ? {} : { tools: projectedTools.tools },
        } as GenerateOptions;
        if (Object.isFrozen(resolvedOptions)) deepFreeze(projectedOptions);
      }
      iterator = dispatch(this.forAdapter(projectedOptions, adapter))[Symbol.asyncIterator]();
    } catch (error) {
      yield adapterFailureChunk(error, options.signal);
      return;
    }
    let completed = false;
    try {
      while (true) {
        let item: IteratorResult<StreamChunk>;
        try {
          const next = await iterator.next();
          item = next.done ? { done: true, value: undefined } : { done: false, value: next.value };
        } catch (error) {
          completed = true;
          yield adapterFailureChunk(error, options.signal);
          return;
        }
        if (item.done) {
          completed = true;
          return;
        }
        yield item.value;
      }
    } finally {
      if (!completed) {
        const close = iterator.return?.bind(iterator);
        if (close) await close();
      }
    }
  }

  /**
   * Stream one model call as raw chunks (token-level deltas).
   * Nhận: options — request đầy đủ; `options.provider` chọn adapter.
   * Trả: luồng chunk, có thể được các listener `llm/stream` bọc lại.
   */
  stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    return this.streamWithRegistration(options);
  }

  /** Chạy lời gọi qua waterfall `llm/stream`. Nhận: options · prepared. Trả: luồng chunk của waterfall. */
  private streamWithRegistration(options: GenerateOptions, prepared?: PreparedStream): AsyncIterable<StreamChunk> {
    // Seam khai `this: LlmRuntime` của PEER còn `this` ở đây là lớp PORT cùng tên nhưng KHÁC khai báo (private
    // `adapters` ⇒ so kiểu NOMINAL) — cầu nối KIỂU thuần tuý, xem ./stream-seam.ts.
    const seam = (this.ctx as unknown as { waterfall: LlmStreamDispatch }).waterfall;
    return seam.call(this.ctx, this as unknown as LlmStreamThisArg, "llm/stream", options as unknown as LlmStreamOptions,
      () => this.adapterStream(options, prepared) as unknown as LlmStreamResult) as unknown as AsyncIterable<StreamChunk>;
  }
}

/**
 * Convert one adapter throw into the stream protocol's terminal outcome.
 * Nhận: error — giá trị bị ném ở biên adapter; signal — tín hiệu huỷ của request.
 * Trả: chunk `finish` reason `aborted` khi tín hiệu đã huỷ hoặc failure mã ABORTED, ngược lại `error`.
 */
function adapterFailureChunk(error: unknown, signal: AbortSignal | undefined): StreamChunk {
  const failure = normalizeLlmFailure(error);
  return {
    type: "finish",
    reason: signal?.aborted || failure.code === "ABORTED"
      ? { kind: "aborted", failure }
      : { kind: "error", failure },
  };
}

/**
 * Copy a directory entry, including its arrays, so neither side can mutate the other's copy.
 * Nhận: entry — entry thư mục provider cấu hình được.
 * Trả: bản sao nông đã tách mọi mảng (settingsPath, baseURLEnv, nativeAuth.env).
 */
function detachDirectoryEntry(entry: LlmConfigurableProvider): LlmConfigurableProvider {
  const { nativeAuth } = entry;
  return {
    ...entry,
    settingsPath: [...entry.settingsPath],
    ...entry.baseURLEnv === undefined ? {} : { baseURLEnv: [...entry.baseURLEnv] },
    ...nativeAuth === undefined ? {} : {
      nativeAuth: { ...nativeAuth, env: [...nativeAuth.env] },
    },
  };
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    // KHÔNG khai lại `llm`: bản gốc `@deepseek-ai/dsh-llm` ĐÃ khai property này với lớp của nó; khai
    // lại bằng lớp của ta sinh TS2717 (hai lớp khác nhau về cấu trúc). Luật: ADR 0009 — một chủ sở hữu cho seam kiểu.
  }

  interface Events {
    /**
     * Waterfall bọc MỌI lời gọi model dạng stream (thử lại, replay, định tuyến).
     * Nhận: options — request đầy đủ; next — điểm vào stream của adapter đã giải.
     * Trả: luồng chunk; listener có thể gọi `next()` hoặc tự phát chunk để chặn ngắn.
     * @mode waterfall
     */
    "llm/stream"(this: LlmRuntime, options: GenerateOptions, next: () => AsyncIterable<StreamChunk>): AsyncIterable<StreamChunk>;
  }
}
