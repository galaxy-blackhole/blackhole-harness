/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Danh mục của TÀI KHOẢN: cổng phiên bản client, kiến thức model của bản build này, và ghi đè của
 *      triển khai — xếp lớp lên nhau thành danh mục dùng được cho route. Bản viết lại của Galaxy
 *      Blackhole cho row llm-deepseek-account (@deepseek-ai/dsh-llm-deepseek-account) —
 *      nguồn đối chiếu: README.md của package (G4).
 */

import { createRequire } from "node:module";

import { resolveAdapterOptions } from "@deepseek-ai/dsh-llm-deepseek";
import type { DeepSeekCatalogModel } from "@deepseek-ai/dsh-llm-deepseek";

import type { ModelOverride } from "./config.ts";
import type { ListingEntry } from "./listing.ts";

/** Vì sao bản build này TỪ CHỐI một model đã niêm yết, trước mọi I/O mạng. */
export type CatalogRefusal =
  | { readonly kind: "upgrade-required"; readonly requiredVersion: string }
  | { readonly kind: "unsupported" };

/** Đầu vào của MỘT lượt phân giải danh mục. */
export interface AccountCatalogInput {
  /** Các mục của danh sách thành công cuối cùng, hoặc `undefined` trước lượt thành công đầu tiên. */
  readonly listing: readonly ListingEntry[] | undefined;
  /** Model ĐÃ KIỂM mà bản build này hỗ trợ, mang kiến thức phía client của nó. */
  readonly supported: readonly DeepSeekCatalogModel[];
  /** Ghi đè theo id model, chỉ giữ trường mà mục đó KHAI. */
  readonly overrides: Readonly<Record<string, ModelOverride>>;
  /** Trần đầu ra của route mà một năng lực đầu ra đã niêm yết sẽ chặn. */
  readonly routeMaxTokens: number;
  /** Phiên bản semantic của bản build này. */
  readonly clientVersion: string;
}

/** Một danh mục tài khoản đã phân giải. */
export interface AccountCatalog {
  /** Model chọn được, theo thứ tự danh sách — hoặc model của bản build này khi chưa có danh sách. */
  readonly offered: readonly DeepSeekCatalogModel[];
  /** Các mục mà bước phân giải request tra: model đã chào, rồi model hỗ trợ mà danh sách không chào. */
  readonly resolution: readonly DeepSeekCatalogModel[];
  /** Model đã niêm yết bị từ chối trước I/O, theo id. */
  readonly refusals: ReadonlyMap<string, CatalogRefusal>;
  /** Mục danh sách bị che vì khai không đọc được hoặc không dùng được. */
  readonly problems: readonly string[];
  /** Chẩn đoán cấu hình cho `modelOverrides`. */
  readonly overrideErrors: readonly string[];
}

/** Bề mặt semver mà row này dùng — đúng HAI hàm bản gốc gọi. */
interface SemverSurface {
  /** Trả phiên bản đã chuẩn hoá, hoặc `null` khi chuỗi không phải semver hợp lệ. */
  valid(version: string): string | null;
  /** `true` khi `left` >= `right` theo thứ tự semver (kể cả prerelease). */
  gte(left: string, right: string): boolean;
}

/**
 * semver nạp qua đường CJS: kernel KHÔNG ship `@types/semver`, và một `.d.ts` ambient
 * `declare module "semver"` bị luật 000d cấm (nó đè kiểu của mọi gói khác trong chương trình).
 * Mặt nạ dưới đây khai ĐÚNG hai hàm được dùng, không rộng hơn.
 */
const semver = createRequire(import.meta.url)("semver") as SemverSurface;

/**
 * Chốt một nhánh union đã đóng mà kiểu không cho phép tới.
 * Nhận: giá trị không thể tới được (kiểu `never`) và nhãn điểm `switch`.
 * Trả: không trả — luôn ném, với thông điệp nguyên văn của `assertNever` trong kernel.
 */
function assertNever(value: never, context?: string): never {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context === undefined ? "" : ` in ${context}`}: ${rendered}`);
}

/**
 * Thay các trường của MỘT mục; kết quả chỉ-có-text thì BỎ các trần ảnh nó thừa hưởng.
 * Nhận: mục nền và lớp cần phủ lên.
 * Trả: mục đã gộp (vật MỚI, không sửa mục nền).
 */
function layered(model: DeepSeekCatalogModel, layer: ModelOverride): DeepSeekCatalogModel {
  const merged: DeepSeekCatalogModel = { ...model, ...layer };
  if (merged.inputModalities?.includes("image") !== true) {
    if (layer.imagePixelBudget === undefined) delete merged.imagePixelBudget;
    if (layer.imageMaxBytes === undefined) delete merged.imageMaxBytes;
  }
  return merged;
}

/**
 * Phủ MỘT mục danh sách dùng được lên mục của bản build này cho cùng id.
 * Nhận: mục nền của bản build, mục danh sách, sự thật năng lực của nó, và trần đầu ra của route.
 * Trả: mục đã xếp lớp — tên/ngữ cảnh/modalities từ danh sách, trần đầu ra bị `max_output_tokens` chặn.
 */
function listed(
  base: DeepSeekCatalogModel,
  entry: ListingEntry,
  facts: Extract<ListingEntry["capabilities"], { usable: true }>["facts"],
  routeMaxTokens: number,
): DeepSeekCatalogModel {
  const { systemPromptUpdate: _replaced, ...leadingOnly } = base;
  return layered(facts.systemPromptUpdate === "leading-only" ? leadingOnly : base, {
    ...(entry.name === undefined ? {} : { name: entry.name }),
    ...(facts.contextWindow === undefined ? {} : { contextWindow: facts.contextWindow }),
    ...(facts.maxOutputTokens === undefined ? {} : { maxTokens: Math.min(routeMaxTokens, facts.maxOutputTokens) }),
    ...(facts.systemPromptUpdate === "in-history" ? { systemPromptUpdate: "in-history" } : {}),
    inputModalities: [...facts.inputModalities],
  });
}

/**
 * Quyết định MỘT mục danh sách có được chào hay không.
 * Nhận: mục danh sách, việc bản build này có biết id đó không, phiên bản client, và sổ chẩn đoán.
 * Trả: lý do từ chối, hoặc `undefined` khi được chào; ghi chẩn đoán vào `problems`.
 */
function gateOf(
  entry: ListingEntry,
  known: boolean,
  clientVersion: string,
  problems: string[],
): CatalogRefusal | undefined {
  const requirement = entry.requirement;
  switch (requirement.kind) {
    case "none":
      return known ? undefined : { kind: "unsupported" };
    case "min-version":
      if (semver.valid(requirement.version) === null) break;
      return semver.gte(clientVersion, requirement.version)
        ? undefined
        : { kind: "upgrade-required", requiredVersion: requirement.version };
    case "invalid":
      break;
    default:
      return assertNever(requirement, "model listing client requirement");
  }
  problems.push(`model "${entry.id}" declares an unreadable client requirement`);
  return { kind: "unsupported" };
}

/**
 * Phân giải danh mục của tài khoản. Một phiên bản client tối thiểu đã khai quyết định model được
 * niêm yết có dùng được không; không khai thì chỉ model bản build này hỗ trợ được chào, các model
 * khác trong danh sách bị CHE.
 * Nhận: danh sách, model hỗ trợ, ghi đè, trần của route và phiên bản của bản build này.
 * Trả: model đã chào, các mục cho bước phân giải request, lý do từ chối, và chẩn đoán.
 */
export function resolveAccountCatalog(input: AccountCatalogInput): AccountCatalog {
  const supported = new Map(input.supported.map((model) => [model.id, model]));
  const problems: string[] = [];
  const overrideErrors: string[] = [];
  const withOverride = (model: DeepSeekCatalogModel): DeepSeekCatalogModel => {
    const override = input.overrides[model.id];
    if (override === undefined) return model;
    const candidate = layered(model, override);
    try {
      resolveAdapterOptions({ models: [candidate] });
    } catch (error) {
      overrideErrors.push(`modelOverrides.${model.id} does not apply (${String(error)})`);
      return model;
    }
    return candidate;
  };
  if (input.listing === undefined) {
    const resolution = resolveAdapterOptions({ models: input.supported.map(withOverride) }).models;
    return {
      offered: resolution,
      resolution,
      refusals: new Map(),
      problems,
      overrideErrors,
    };
  }
  const offered: DeepSeekCatalogModel[] = [];
  const refusals = new Map<string, CatalogRefusal>();
  for (const entry of input.listing) {
    const refusal = gateOf(entry, supported.has(entry.id), input.clientVersion, problems);
    if (refusal !== undefined) {
      refusals.set(entry.id, refusal);
      continue;
    }
    if (!entry.capabilities.usable) {
      problems.push(`model "${entry.id}" ${entry.capabilities.reason}`);
      refusals.set(entry.id, { kind: "unsupported" });
      continue;
    }
    offered.push(
      withOverride(
        listed(
          supported.get(entry.id) ?? { id: entry.id },
          entry,
          entry.capabilities.facts,
          input.routeMaxTokens,
        ),
      ),
    );
  }
  const offeredIds = new Set(offered.map((model) => model.id));
  const listedIds = new Set(input.listing.map((entry) => entry.id));
  for (const id of Object.keys(input.overrides)) {
    if (!listedIds.has(id) && !supported.has(id)) {
      overrideErrors.push(`modelOverrides names "${id}", which neither the account listing nor the built-in catalog describes`);
    }
  }
  const resolution = resolveAdapterOptions({
    models: [
      ...offered,
      ...input.supported.filter((model) => !offeredIds.has(model.id)).map(withOverride),
    ],
  }).models;
  return {
    offered: resolution.slice(0, offered.length),
    resolution,
    refusals,
    problems,
    overrideErrors,
  };
}
