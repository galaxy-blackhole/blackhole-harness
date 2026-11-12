/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng lõi plugin của @deepseek-ai/dsh-llm-pi-ai — port 1:1 lib/index.js dòng 2814–2966 (nguồn
 *      per-file: lib/types/index.js): `name`, `inject`, `registrationFacts`, `directoryEntries` và
 *      `apply` — MỘT adapter pi-ai tổng quát cho mọi route provider đã cấu hình, cộng thư mục provider
 *      cấu hình được và khám phá model do Host sở hữu. Export: name · inject · apply.
 */

import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/cordis-plugin-loader";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { LlmError, assertUsableApiKey, resolveImageAttachmentAccess } from "@deepseek-ai/dsh-llm";
import type {
  AdapterRegistrationHandle,
  DirectoryRegistrationHandle,
  LlmConfigurableProvider,
} from "@deepseek-ai/dsh-llm";
import { deepEqualJson } from "@deepseek-ai/dsh-util-values";

import { PiAiAdapter } from "./adapter.ts";
import type { PiAiAuthInjection } from "./adapter.ts";
import { authContextFrom, credentialStoreFrom } from "./auth.ts";
import { catalogProvider, catalogProviderIds } from "./catalog.ts";
import { Config, assertServiceable, resolveProfiles } from "./config.ts";
import type { PiAiProviderProfile, ResolvedPiAiProviderProfile } from "./config.ts";
import { discoverModels } from "./discovery.ts";
import type { StoredModelDiscoveryProfile } from "./discovery.ts";
import { registerPiAiFlows } from "./login.ts";
import { providerDefaultsOf } from "./provider-data.ts";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "llm-pi-ai";

/** Service bắt buộc: sổ provider của LLM (`llm`). Nhận: không. Trả: mảng chỉ gồm "llm". */
export const inject: string[] = ["llm"];

/** Không gian tên cấu hình mặc định khi plugin không được nạp từ một entry của loader. */
const NS = "llm-pi-ai";

/** Dict profile provider thô, khoá theo route; hình dạng mà bộ phân giải đọc. */
type ProviderProfiles = Record<string, PiAiProviderProfile>;

/** Hình dạng tối thiểu của seam `settings` mà plugin chạm tới (một lời gọi `configure`). */
interface SettingsSeam {
  /** Sổ mẫu cấu hình của kernel: chính sách trang tự động của MỘT thể hiện plugin. */
  settings: {
    /** Đăng ký chính sách trang cho thể hiện `owner`; trả disposer. */
    configure(presentation: { auto?: boolean }, owner?: unknown): () => void;
  };
}

/**
 * Ảnh chụp dict providers ĐÃ TÁCH khỏi tham chiếu sống, đúng như `structuredClone` của bản gốc.
 * Ảnh chụp volatile có kiểu chỉ-đọc SÂU, còn bộ phân giải nhận record thường; phép ép kiểu chỉ
 * thuần kiểu (giá trị lúc chạy là bản sao `structuredClone` y hệt).
 * Nhận: raw — giá trị `get()` của tham chiếu volatile, hoặc config vừa kiểm bởi {@link Config}.
 * Trả: bản sao sâu của dict providers, nhìn như record profile thường.
 */
function plainProviders(raw: unknown): ProviderProfiles {
  return structuredClone(raw) as ProviderProfiles;
}

/**
 * The registry captures these per route; a change here must re-register.
 * Sorted by provider so a settings document that merely reorders its keys is
 * not mistaken for a route change.
 * Nhận: profiles — các profile provider đã phân giải của lượt này.
 * Trả: mảng fact đã sắp theo `provider` (provider · displayName · retryPolicy).
 */
function registrationFacts(profiles: ReadonlyMap<string, ResolvedPiAiProviderProfile>): {
  provider: string;
  displayName: string;
  retryPolicy: ResolvedPiAiProviderProfile["retryPolicy"];
}[] {
  return [...profiles.entries()]
    .map(([provider, profile]) => ({
      provider,
      displayName: profile.displayName,
      retryPolicy: profile.retryPolicy,
    }))
    .sort((left, right) => left.provider.localeCompare(right.provider));
}

/**
 * The configurable-provider directory: every installed catalog route, plus
 * every route the current profiles declare. A hand-declared route has no
 * catalog entry, so without this union it would have no settings address and
 * configuration surfaces could neither show nor edit it. A catalog route also
 * carries its catalog endpoint and native authentication, which a settings
 * editor shows while the profile leaves the endpoint or the credential
 * reference unset.
 * @param profiles - the currently resolved provider profiles.
 * @returns the directory entries in catalog order, declared routes last.
 * Nhận: profiles — các profile provider đã phân giải; settingsNs — không gian tên của mục settings.
 * Trả: entry thư mục theo thứ tự catalog trước, route tự khai sau (Map giữ vị trí lần chèn đầu).
 */
function directoryEntries(
  profiles: ReadonlyMap<string, ResolvedPiAiProviderProfile>,
  settingsNs: string,
): LlmConfigurableProvider[] {
  const entries = new Map<string, LlmConfigurableProvider>();
  const declareProvider = (provider: string, displayName: string, error?: string): void => {
    const installed = catalogProvider(provider);
    entries.set(provider, {
      provider,
      displayName,
      settingsNs,
      settingsPath: ["providers", provider],
      declared: installed === void 0,
      ...(installed === void 0 ? {} : providerDefaultsOf(installed)),
      ...(error === void 0 ? {} : { error }),
    });
  };
  for (const provider of catalogProviderIds()) declareProvider(provider, provider);
  for (const [provider, profile] of profiles) declareProvider(provider, profile.displayName, profile.catalogError);
  return [...entries.values()];
}

/**
 * Register one generic pi-ai adapter for all configured provider routes.
 * Nhận: ctx — context cordis mang seam `llm` (kèm tuỳ chọn `settings`, `authorization`,
 *   `credentials`, `attachments`, `fs`); config — cấu hình đã kiểm bởi {@link Config}, với
 *   `providers` là tham chiếu volatile sống.
 * Trả: không; đăng ký thư mục provider cấu hình được, trình khám phá model và adapter cho MỌI route
 *   đã cấu hình, rồi cập nhật lại chúng khi cấu hình volatile đổi.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.inject(["settings"], (child) => {
    child.effect(() => (child as unknown as SettingsSeam).settings.configure({ auto: false }, ctx.fiber));
  });
  const settingsNs = ctx.fiber.entry?.options.id ?? NS;
  let lastRaw: unknown;
  let memoized: Map<string, ResolvedPiAiProviderProfile> | undefined;
  /**
   * The resolved profiles for the current configuration, memoized by the raw
   * snapshot's identity — which is also what makes the adapter's own snapshot
   * stable across operations that observe no change.
   *
   * Catalog diagnostics stay in the snapshot beside serviceable models, so
   * stored configuration remains visible after an installed catalog changes.
   * Scalar configuration errors still reject resolution.
   * Nhận: không — đọc lại `config.providers.get()` mỗi lượt.
   * Trả: Map route → profile đã phân giải; giữ nguyên VẬT cũ khi ảnh chụp thô không đổi danh tính.
   */
  const profiles = (): Map<string, ResolvedPiAiProviderProfile> => {
    const raw = config.providers.get();
    if (raw === lastRaw && memoized !== void 0) return memoized;
    const next = resolveProfiles(plainProviders(raw), "deferred");
    lastRaw = raw;
    memoized = next;
    return next;
  };
  profiles();
  ctx.on("internal/config", function (_raw, next) {
    const raw = next();
    if (this !== ctx.fiber) return raw;
    const candidate = Config(raw);
    assertServiceable(
      { providers: plainProviders(candidate.providers.get()) },
      { providers: plainProviders(config.providers.get()) },
    );
    return raw;
  });
  /**
   * Phân giải credential cho MỘT profile đã phân giải, đọc lại mỗi lượt.
   * Nhận: provider — khoá route (chỉ dùng trong thông điệp lỗi); profile — profile đã phân giải.
   * Trả: khoá đã kiểm, `undefined` khi profile không đặt `apiKeyEnv`; ném `LlmError`
   *   `MISSING_CREDENTIAL` khi tham chiếu có tên mà không có giá trị dùng được.
   */
  const resolveApiKey = async (
    provider: string,
    profile: ResolvedPiAiProviderProfile,
  ): Promise<string | undefined> => {
    const ref = profile.apiKeyEnv;
    if (ref === void 0) return void 0;
    const credentials = ctx.get("credentials");
    const hit = credentials !== void 0
      ? (await credentials.resolve(ref))?.value
      : launchEnvironmentOf(ctx).get(ref)?.value;
    if (hit !== void 0 && hit.length > 0) return assertUsableApiKey(hit, "llm-pi-ai", ref);
    throw new LlmError(
      `llm-pi-ai: no credential for provider route "${provider}"; its profile resolves ${ref}, which is not set — store ${ref} through the credentials service (the web Models page writes it) or export it, and remove apiKeyEnv only if this provider should authenticate from pi-ai's own environment discovery`,
      "MISSING_CREDENTIAL",
    );
  };
  const auth: PiAiAuthInjection = {
    credentials: credentialStoreFrom(ctx),
    authContext: authContextFrom(ctx),
  };
  const adapter = new PiAiAdapter({
    profiles,
    resolveApiKey,
    auth,
    resolveAttachments: () => ctx.get("attachments"),
    resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(
      attachments,
      (hostPath) => ctx.get("fs")?.processPathFromHostPath(hostPath),
      ref,
    ),
    onReplayDegrade: ({ provider, model, reason }) => {
      ctx.logger.warn(
        `llm-pi-ai: unusable replay state on assistant history for route "${provider}/${model}"; sending that message as provider-neutral content (${reason})`,
      );
    },
  });
  ctx.inject(["authorization"], (authorized) => {
    registerPiAiFlows(authorized, auth);
  });
  let directory: DirectoryRegistrationHandle | undefined;
  let directoryFacts: LlmConfigurableProvider[] | undefined;
  /**
   * Đăng ký hoặc thay thế thư mục provider cấu hình được khi fact của nó đổi.
   * Nhận: không — đọc profile đã phân giải của lượt này.
   * Trả: không; tạo đăng ký ở lượt đầu, thay thế nguyên tử ở các lượt sau.
   */
  const ensureDirectory = (): void => {
    const entries = directoryEntries(profiles(), settingsNs);
    if (deepEqualJson(entries, directoryFacts)) return;
    if (directory === void 0) directory = ctx.llm.registerConfigurableProviders(entries);
    else directory.replace(entries);
    directoryFacts = entries;
  };
  ensureDirectory();
  /**
   * Host-owned request inputs for discovery of one configured route.
   * Nhận: provider — route đang được khám phá, hoặc `undefined` khi draft chưa đặt tên route.
   * Trả: header của Host + hàm phân giải credential lười, hoặc `undefined` khi route không có profile.
   */
  const storedDiscoveryProfile = (provider: string | undefined): StoredModelDiscoveryProfile | undefined => {
    if (provider === void 0) return void 0;
    const profile = profiles().get(provider);
    if (profile === void 0) return void 0;
    return {
      headers: profile.headers,
      resolveApiKey: () => resolveApiKey(provider, profile),
    };
  };
  ctx.llm.registerModelDiscovery(settingsNs, (request, signal) => discoverModels({
    ...request,
    ...(signal === void 0 ? {} : { signal }),
  }, () => storedDiscoveryProfile(request.provider)));
  let registration: AdapterRegistrationHandle | undefined;
  let registeredFacts: ReturnType<typeof registrationFacts> | undefined;
  /**
   * Đăng ký hoặc thay thế tập route của adapter khi fact đăng ký đổi.
   * Nhận: không — đọc profile đã phân giải của lượt này.
   * Trả: không; route rỗng ở lượt đầu thì hoãn đăng ký và chỉ ghi nhận fact.
   */
  const ensureRegistrationFacts = (): void => {
    const facts = registrationFacts(profiles());
    if (deepEqualJson(facts, registeredFacts)) return;
    const routes = [...profiles().keys()];
    if (registration === void 0) {
      if (routes.length === 0) {
        registeredFacts = facts;
        return;
      }
      registration = ctx.llm.registerAdapter(routes, adapter);
    } else registration.replace(routes);
    registeredFacts = facts;
  };
  ensureRegistrationFacts();
  ctx.on("loader/volatile-update", () => {
    try {
      ensureRegistrationFacts();
      ensureDirectory();
    } catch (error) {
      ctx.logger.error("llm-pi-ai: configuration conflicts with an existing provider route");
      ctx.logger.error(error);
    }
  });
}
