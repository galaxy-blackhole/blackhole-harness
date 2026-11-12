/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cấu hình route TÀI KHOẢN DeepSeek: schema `Config` (trường giao thức của
 *      @deepseek-ai/dsh-llm-deepseek TRỪ `models`, cộng ba trường danh mục) và HAI bước phân giải
 *      (plainAccountOptions · resolveAccountOptions) mà plugin dùng cho mỗi thao tác. Bản viết lại của
 *      Galaxy Blackhole cho row llm-deepseek-account (@deepseek-ai/dsh-llm-deepseek-account) —
 *      nguồn đối chiếu: README.md của package (G4).
 */

import { isVolatile } from "@deepseek-ai/cosmokit";
import type { Volatile } from "@deepseek-ai/cordis";
import type { LaunchEnvironmentSnapshot } from "@deepseek-ai/dsh-launch-environment";
import {
  catalogModelFields,
  deepSeekConfigFields,
  resolveAdapterOptions as protocolResolveAdapterOptions,
} from "@deepseek-ai/dsh-llm-deepseek";
import type {
  Config as ProtocolConfig,
  DeepSeekCatalogModel,
  Options as ProtocolOptions,
  ResolvedDeepSeekOptions,
} from "@deepseek-ai/dsh-llm-deepseek";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import z from "@deepseek-ai/schemastery";

/** Hạn chót mặc định của MỘT lượt xin danh sách model, và của lượt chờ lần đầu (5 giây). */
export const DEFAULT_MODELS_TIMEOUT_MS = 5_000;

/** Tuổi mặc định của danh sách, quá tuổi thì lượt truy cập sau làm mới NỀN (10 phút). */
export const DEFAULT_MODELS_MAX_AGE_MS = 600_000;

/** Ghi đè trường của MỘT model; trường bỏ trống và mảng rỗng thì thừa hưởng mục bên dưới. */
export type ModelOverride = Omit<DeepSeekCatalogModel, "id">;

/** Cấu hình route tài khoản; xác thực CHỈ đến từ service tài khoản, không có trường khoá API. */
export interface Config extends Omit<ProtocolConfig, "models"> {
  /** Hạn chót của một lượt xin danh sách, đồng thời chặn lượt chờ lần đầu (mặc định 5 giây). */
  modelsTimeoutMs: Volatile<number>;
  /** Tuổi danh sách mà lượt truy cập sau làm mới nền; lượt nạp hỏng cũng thử lại sau đúng tuổi đó. */
  modelsMaxAgeMs: Volatile<number>;
  /** Ghi đè trường theo id model, phủ LÊN danh sách của tài khoản và danh mục dựng sẵn. */
  modelOverrides: Volatile<Record<string, ModelOverride>>;
}

/** Trường của một mục ghi đè: các trường catalog (`catalogModelFields`) + modalities ĐẦU VÀO. */
const modelOverride = z.object({
  ...catalogModelFields,
  inputModalities: z.array(z.union(["text", "image"])),
});

// `models` không còn cấu hình được: danh mục do GET /models của tài khoản cung cấp (y bản gốc).
const { models: _protocolCatalog, ...protocolFields } = deepSeekConfigFields;

/**
 * Schema cấu hình lúc chạy: đúng bộ trường giao thức của gói adapter (TRỪ `models`) cộng ba trường
 * danh mục, tất cả đều volatile — Settings/config-editor đọc được, và mỗi thao tác lấy giá trị SỐNG.
 */
export const Config = z.object({
  ...protocolFields,
  modelsTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_MODELS_TIMEOUT_MS).volatile(),
  modelsMaxAgeMs: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MODELS_MAX_AGE_MS).volatile(),
  modelOverrides: z.dict(modelOverride).default({}).volatile(),
});

/** Đầu vào triển khai dạng phẳng cho route tài khoản (chưa có tham chiếu volatile). */
export type AccountOptions = Omit<ProtocolOptions, "models"> & {
  /** Hạn chót một lượt xin danh sách; bỏ trống dùng mặc định. */
  modelsTimeoutMs?: number;
  /** Tuổi danh sách trước khi làm mới nền; bỏ trống dùng mặc định. */
  modelsMaxAgeMs?: number;
  /** Ghi đè theo id model; bỏ trống là không ghi đè. */
  modelOverrides?: Record<string, ModelOverride>;
};

/** Endpoint danh sách và nhịp đệm của MỘT thế hệ cấu hình. */
export interface CatalogSettings {
  /** Endpoint danh sách; luôn cùng origin với Messages. */
  readonly url: string;
  /** Hạn chót của một lượt xin danh sách. */
  readonly timeoutMs: number;
  /** Tuổi danh sách mà lượt truy cập sau làm mới. */
  readonly maxAgeMs: number;
}

/** Một thế hệ cấu hình ĐÃ KIỂM của route tài khoản. */
export interface ResolvedAccountOptions {
  /** Cấu hình Messages; bước phân giải request thay `models` bằng danh mục của tài khoản. */
  readonly protocol: ResolvedDeepSeekOptions;
  /** Endpoint danh sách và nhịp đệm. */
  readonly catalog: CatalogSettings;
  /** Ghi đè theo id model, chỉ giữ trường mà mục đó KHAI. */
  readonly modelOverrides: Readonly<Record<string, ModelOverride>>;
}

/**
 * Đọc giá trị hiện tại phía sau mọi tham chiếu của một Config đã kiểm.
 * Nhận: cấu hình sống của plugin (các trường volatile có `.get()`).
 * Trả: đầu vào phẳng cho {@link resolveAccountOptions}.
 */
export function plainAccountOptions(config: Config): AccountOptions {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, isVolatile(value) ? value.get() : value]),
  ) as AccountOptions;
}

/**
 * Endpoint danh sách: `/models` tại origin của Messages — origin DUY NHẤT nhận token tài khoản.
 * Nhận: baseURL đã phân giải của Messages.
 * Trả: URL tuyệt đối của endpoint danh sách.
 */
function listingEndpoint(baseURL: string): string {
  return new URL("/models", new URL(baseURL).origin).href;
}

/**
 * Giữ lại đúng những trường một mục ghi đè KHAI: cấu hình đã parse mang trường chưa đặt là
 * `undefined` và mảng chưa đặt là `[]`.
 * Nhận: id model (khoá của mục ghi đè) và mục ghi đè thô.
 * Trả: mục ghi đè đã lọc, đã kiểm bằng chính bộ phân giải của adapter.
 * Ném: `Error` với thông điệp nguyên văn của bản gốc khi khoá rỗng, khi mục tự đặt `id`, hoặc khi
 * adapter từ chối trường đã khai.
 */
function resolveOverride(id: string, override: ModelOverride): ModelOverride {
  if (id.length === 0) throw new Error("llm-deepseek-account: modelOverrides keys must be non-empty model ids");
  if (Object.hasOwn(override, "id")) throw new Error(`llm-deepseek-account: modelOverrides.${id} sets "id", which is its key`);
  const declared: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) continue;
    Reflect.set(declared, key, value);
  }
  try {
    protocolResolveAdapterOptions({
      models: [{ inputModalities: ["text", "image"], ...declared, id } as DeepSeekCatalogModel],
    });
  } catch (error) {
    throw new Error(`llm-deepseek-account: modelOverrides.${id} is invalid: ${String(error)}`, { cause: error });
  }
  return declared as ModelOverride;
}

/**
 * Bước phân giải TƯỜNG MINH duy nhất từ cấu hình tài khoản thô sang sự thật đã kiểm.
 * Cập nhật settings có thể tới đây mà KHÔNG qua schema, nên mọi biên đều được xét lại tại chỗ.
 * Nhận: đầu vào tài khoản dạng phẳng và các lớp môi trường của lượt chạy (hoặc `undefined` ngoài
 * sản phẩm CLI).
 * Trả: cấu hình Messages, cấu hình danh sách, và ghi đè đã kiểm.
 * Ném: `Error` với thông điệp nguyên văn của bản gốc khi còn trường `models`, khi
 * `modelsTimeoutMs`/`modelsMaxAgeMs` ra ngoài biên, hoặc khi một mục ghi đè không hợp lệ.
 */
export function resolveAccountOptions(
  options: AccountOptions,
  environment?: LaunchEnvironmentSnapshot,
): ResolvedAccountOptions {
  if (Object.hasOwn(options, "models")) {
    throw new Error(
      "llm-deepseek-account: models is no longer configurable; the account /models listing supplies the catalog. Remove models from this entry and adjust single models with modelOverrides.<model id>",
    );
  }
  const {
    modelsTimeoutMs = DEFAULT_MODELS_TIMEOUT_MS,
    modelsMaxAgeMs = DEFAULT_MODELS_MAX_AGE_MS,
    modelOverrides = {},
    ...protocolOptions
  } = options;
  if (!Number.isFinite(modelsTimeoutMs) || modelsTimeoutMs <= 0 || modelsTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `llm-deepseek-account: modelsTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
    );
  }
  if (!Number.isSafeInteger(modelsMaxAgeMs) || modelsMaxAgeMs < 0) {
    throw new Error("llm-deepseek-account: modelsMaxAgeMs must be a non-negative safe integer");
  }
  const protocol = protocolResolveAdapterOptions(protocolOptions, environment);
  return {
    protocol,
    catalog: {
      url: listingEndpoint(protocol.baseURL),
      timeoutMs: modelsTimeoutMs,
      maxAgeMs: modelsMaxAgeMs,
    },
    modelOverrides: Object.fromEntries(
      Object.entries(modelOverrides).map(([id, override]) => [id, resolveOverride(id, override)]),
    ),
  };
}
