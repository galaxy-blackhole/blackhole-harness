/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Dựng pi-ai Provider cho một route cấu hình: bảng giao thức dây, auth api-key của harness, tái dùng provider catalog và buildProvider; export supportedProtocols · ProviderSpec · buildProvider.
 */

import type { Api, ApiKeyAuth, Model, Provider, ProviderAuth, ProviderStreams } from "@earendil-works/pi-ai";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import { PiAiCatalogError, catalogProvider } from "./catalog.ts";
import { createProvider } from "./models.ts";

/**
 * Dựng `Provider` của pi-ai mà một route cấu hình đăng ký vào collection `Models`
 * của adapter.
 *
 * Hai cách dựng, một quyết định: route có trong catalog đã cài, mà profile không
 * ghi đè giao thức dây, thì **tái dùng provider catalog** với models được thay —
 * provider catalog sở hữu những cài đặt API mà gói này không thể dựng lại (Bedrock
 * nạp module Smithy qua một entry point riêng), nên dựng lại từ mảnh sẽ âm thầm
 * thu hẹp tập provider chạy được. Mọi route khác — route pi-ai chưa từng biết, hoặc
 * route catalog bị trỏ sang giao thức khác — do `createProvider` dựng trên bảng
 * giao thức bên dưới.
 *
 * Thông tin xác thực không bao giờ vào kho của module này: harness phân giải khoá
 * của route qua `ctx.credentials` trước khi request vào pi-ai và trao nó như một
 * stream option, mà `Models` trình cho `resolve()` như credential key.
 */

/**
 * Các giao thức dây mà một route cấu hình có thể đặt tên, ánh xạ tới cài đặt pi-ai
 * nạp lười. Mỗi mục là factory mà factory provider tương ứng của pi-ai dùng, nên
 * một route tự khai báo chạm đúng cài đặt mà một route catalog sẽ chạm.
 *
 * Bảng cố ý hẹp: các giao thức mà route tự khai báo thực sự đọc, mỗi cái mô tả
 * trọn vẹn bằng một khoá, một endpoint và header. Bedrock ký SigV4 trên thông tin
 * AWS và một region, Vertex cần project, location và application-default
 * credentials, Azure cần môi trường provider cùng api-version, Codex xác thực qua
 * OAuth — không cái nào hình dạng cấu hình này biểu đạt được, nên cho chúng sẽ trả
 * về provider không xác thực được. Phần còn lại vắng vì chưa có người dùng chứ
 * không phải chặn: mỗi cái là một dòng ở đây khi deployment cần. Route catalog vẫn
 * chạm mọi giao thức qua provider riêng; chỉ ghi đè tường minh mới bị từ chối.
 */
const PROTOCOLS: Record<string, () => ProviderStreams> = {
  "openai-completions": openAICompletionsApi,
  "openai-responses": openAIResponsesApi,
  "anthropic-messages": anthropicMessagesApi,
};

/**
 * Mọi giao thức dây mà một route cấu hình có thể đặt tên, giao thức hay gặp nhất
 * đứng đầu. Thứ tự là thứ tự của bảng nên ổn định; một bề mặt cấu hình cho chọn
 * sẽ trình cái đầu làm mặc định, vì thế giao thức mà gateway tự khai báo thường
 * nói — và cái mà thăm dò endpoint đọc được — dẫn đầu.
 * Nhận: không tham số.
 * Trả: các định danh giao thức được hỗ trợ.
 */
export function supportedProtocols(): readonly string[] {
  return Object.keys(PROTOCOLS);
}

/** Các sự thật route đã phân giải mà việc dựng provider đọc. */
export interface ProviderSpec {
  /** Khoá route provider; cũng là khoá collection `Models` và `provider` của từng model. */
  provider: string;
  /** Tên hiển thị cho selector và nhãn trạng thái. */
  displayName: string;
  /** Ghi đè giao thức dây; vắng mặt nghĩa là mỗi model giữ giao thức catalog của nó. */
  api?: string;
  /** Ghi đè endpoint đã áp lên {@link models}; giữ lại cho hiển thị cấp provider. */
  baseURL?: string;
  /** Models đã materialize của route, theo thứ tự cấu hình. */
  models: readonly Model<Api>[];
  /**
   * Profile có đặt tên credential hay không, và chỉ đặt qua `apiKeyEnv`: cấu hình
   * mang tham chiếu, không bao giờ mang bí mật. Chỉ điều này quyết định việc
   * {@link routeAuth} có thêm phương thức api-key của harness vào một provider
   * catalog vốn không có hay không; bản thân khoá vẫn đến từng request, không bao
   * giờ đến lúc dựng.
   */
  namesCredential: boolean;
}

/**
 * Auth api-key cho một route mà harness tự xác thực. `Models` gọi nó sau khi
 * adapter đã phân giải credential của route, nên khoá thiếu ở đây không phải lỗi
 * của tầng này: một tham chiếu có tên nhưng không phân giải được đã làm request
 * hỏng với `MISSING_CREDENTIAL`, còn route không đặt tên credential nào thì cố ý
 * không xác thực. Báo nó là đã cấu hình thì trao quyết định cho giao thức, nơi
 * yêu cầu thực sự sống — cài đặt OpenAI-compatible của pi-ai, chẳng hạn, vẫn đòi
 * một khoá hoặc header `Authorization` của riêng nó.
 * Nhận: `name` — tên hiển thị dùng làm nhãn trạng thái của lần phân giải.
 * Trả: auth api-key cho một route do harness xác thực.
 */
function harnessApiKeyAuth(name: string): ApiKeyAuth {
  return {
    name,
    resolve: ({ credential }) => Promise.resolve({
      auth: credential?.key === void 0 ? {} : { apiKey: credential.key },
      source: name,
    }),
  };
}

/**
 * Auth mà một route phân giải credential qua đó.
 *
 * Một route catalog giữ auth của provider đã cài, và chính điều đó bảo toàn việc
 * dò nguồn xung quanh gốc của provider cho một profile không đặt tên credential.
 * Điều này vẫn đúng cả khi profile trỏ lại giao thức: provider đọc môi trường nào
 * là thuộc tính của provider, không phải của định dạng dây mà models của nó nói.
 *
 * Phần thêm duy nhất phủ một provider catalog không có phương thức api-key nào.
 * pi-ai chỉ phân giải `apiKey` ghi đè của request khi provider khai một cái
 * (`resolveProviderAuth` kiểm `provider.auth.apiKey` trước khi tôn trọng ghi đè),
 * nên một provider chỉ OAuth — `openai-codex` là cái catalog đã cài có — sẽ từ
 * chối khoá tường minh của profile với `Provider is not configured` trước khi bất
 * kỳ request nào đi ra. Thêm phương thức của harness bên cạnh phương thức của
 * provider khôi phục route đó. Một profile không khoá không thêm gì và vẫn báo
 * lời từ chối trung thực, vì adapter này phân giải credential qua seam riêng và
 * không giữ kho OAuth nào để dựa vào.
 * Nhận: `spec` — các sự thật route đã phân giải; `catalog` — provider catalog đã
 *   cài, khi pi-ai có một cái.
 * Trả: auth để dựng provider của route này.
 */
function routeAuth(spec: ProviderSpec, catalog: Provider | undefined): ProviderAuth {
  if (catalog === void 0) return { apiKey: harnessApiKeyAuth(spec.displayName) };
  if (catalog.auth.apiKey !== void 0 || !spec.namesCredential) return catalog.auth;
  return {
    ...catalog.auth,
    apiKey: harnessApiKeyAuth(spec.displayName),
  };
}

/**
 * Tái dùng một provider catalog đã cài với models và danh tính của route này.
 * Việc điều phối model ở lại với provider catalog, nên các cài đặt API, quirk
 * tương thích và việc dò credential xung quanh của nó được giữ nguyên chính xác.
 * Việc làm mới động do catalog sở hữu bị bỏ: catalog của route này là tài liệu
 * settings, và một lần làm mới nền sẽ mâu thuẫn với nó.
 * Nhận: `base` — provider catalog đã cài; `spec` — các sự thật route đã phân giải.
 * Trả: provider mang models của route và uỷ thác stream cho `base`.
 */
function reuseCatalogProvider(base: Provider, spec: ProviderSpec): Provider {
  const baseUrl = spec.baseURL ?? base.baseUrl;
  return {
    id: spec.provider,
    name: spec.displayName,
    ...baseUrl === void 0 ? {} : { baseUrl },
    auth: routeAuth(spec, base),
    getModels: () => spec.models,
    stream: (model, context, options) => base.stream(model, context, options),
    streamSimple: (model, context, options) => base.streamSimple(model, context, options),
  };
}

/**
 * Dựng provider pi-ai cho một route đã phân giải.
 * Nhận: `spec` — các sự thật route đã phân giải.
 * Trả: provider để đăng ký vào collection `Models` của adapter.
 * @throws {PiAiCatalogError} khi route đặt tên một giao thức dây mà bản dựng này
 *   không phục vụ được.
 */
export function buildProvider(spec: ProviderSpec): Provider {
  const catalog = catalogProvider(spec.provider);
  if (catalog !== void 0 && spec.api === void 0) return reuseCatalogProvider(catalog, spec);
  const factory = spec.api === void 0 ? void 0 : PROTOCOLS[spec.api];
  if (factory === void 0) throw new PiAiCatalogError(`llm-pi-ai: provider "${spec.provider}" names api "${spec.api}", which this build cannot serve; supported protocols are ${supportedProtocols().join(", ")}`);
  return createProvider({
    id: spec.provider,
    name: spec.displayName,
    ...spec.baseURL === void 0 ? {} : { baseUrl: spec.baseURL },
    auth: routeAuth(spec, catalog),
    models: spec.models,
    api: factory(),
  });
}
