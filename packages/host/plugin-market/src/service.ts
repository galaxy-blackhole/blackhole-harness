/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/index.js' của @deepseek-ai/dsh-plugin-market (vùng lib/index.js dòng 257–661):
 *      service Remote 'pluginMarket' — đọc, validate và nhớ các chỉ mục thị trường đã cấu hình, rồi chú thích
 *      từng plugin bằng dữ kiện cài đặt của hồ sơ. 38 dòng emit helper __runInitializers/__esDecorate KHÔNG port
 *      (decorator TS biên dịch native).
 */

import { createRequire } from "node:module";

import type { Context, Volatile } from "@deepseek-ai/cordis";
import { evaluatePluginCompatibility, getDshRuntimeVersion } from "@deepseek-ai/dsh-app-boot";
import { marketInstallTarget } from "@deepseek-ai/dsh-plugin-market-index";
import type { MarketIndex, MarketPlugin, MarketVersion } from "@deepseek-ai/dsh-plugin-market-index";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";

import { normalizeIndexUrl } from "./index-url.ts";
import { parseIndexInWorker } from "./parse-thread.ts";
import { MarketSearch } from "./search.ts";
import type {
  MarketCompatibility,
  MarketIndexSummary,
  MarketInstallation,
  MarketListingEntry,
  MarketListingVersion,
  MarketQuery,
  MarketSearchResult,
  PluginMarketErrorCode,
} from "./types.ts";

export type * from "./types.ts";

/** Cấu hình của row: nguồn chỉ mục và các trần tải. */
export interface Config {
  /** URL chỉ mục theo thứ tự hiển thị; Settings và `setIndexes` ghi trường này mà không mount lại service. */
  indexes: Volatile<string[]>;
  /** Hạn chót của MỘT lần tải chỉ mục, gồm cả phần thân. */
  fetchTimeoutMs: number;
  /** Trần byte của thân chỉ mục được nhận. */
  maxBytes: number;
  /** Thời gian sống của một tài liệu chỉ mục đã đọc thành công. */
  cacheTtlMs: number;
}

/** Bề mặt semver mà service dùng — đúng BA hàm bản gốc gọi. */
interface SemverSurface {
  /** Trả phiên bản đã chuẩn hoá, hoặc `null` khi chuỗi không phải semver hợp lệ. */
  valid(version: string): string | null;
  /** `true` khi `left` > `right` theo thứ tự semver. */
  gt(left: string, right: string): boolean;
  /** Mảng định danh prerelease, hoặc `null` khi phiên bản không có nhãn prerelease. */
  prerelease(version: string): readonly (string | number)[] | null;
}

/**
 * semver nạp qua đường CJS: kernel KHÔNG ship `@types/semver`, và một `.d.ts` ambient
 * `declare module "semver"` bị luật 000d cấm (nó đè kiểu của mọi gói khác trong chương trình).
 * Mặt nạ dưới đây khai ĐÚNG ba hàm được dùng, không rộng hơn.
 */
const semver = createRequire(import.meta.url)("semver") as SemverSurface;

/** Một bundle của hồ sơ mà phép chú thích đọc tới (phần dùng của `BundleInfo` bên plugin-manager). */
interface MarketBundle {
  /** Tên package npm. */
  readonly name: string;
  /** Nơi bundle có mặt: bản cài, hồ sơ, hay thiếu. */
  readonly availability: "installation" | "profile" | "missing";
  /** Phiên bản đang có, khi đọc được. */
  readonly version?: string;
  /** Hồ sơ có khai phụ thuộc này không. */
  readonly installed: boolean;
}

/** Nửa `pluginManager` mà service gọi (peer khai bằng `static inject`, kiểu theo CẤU TRÚC — luật 000d). */
interface PluginManagerSeam {
  /** Đọc bundle đã cài, do bản cài cấp, và mục danh mục offline. */
  listBundles(): Promise<readonly MarketBundle[]>;
  /** Đọc miễn trừ phiên bản đã lưu trong hồ sơ này. */
  listVersionExemptions(): { readonly exemptions: Readonly<Record<string, readonly string[]>> };
}

/** Nửa `settings` mà `setIndexes` gọi. */
interface SettingsSeam {
  /** Ghi một bản vá vào mục profile theo id. */
  update(entryId: string, patch: { readonly indexes: string[] }): Promise<void>;
}

/** Context cordis nhìn qua chân trời CẤU TRÚC mà service thật sự gọi tới (luật 000d: không augment). */
interface PluginMarketContext {
  /** Fiber của chính plugin này — nơi lấy id mục profile. */
  readonly fiber: { readonly entry?: { readonly options: { readonly id?: string } } };
  /** Service quản lý plugin của hồ sơ (đã bảo đảm bởi `static inject`). */
  readonly pluginManager: PluginManagerSeam;
  /** Tra MỘT service theo khoá (có thể vắng). */
  get(name: string): unknown;
  /** Nghe một sự kiện cordis; trả hàm huỷ đăng ký. */
  on(event: string, listener: (...args: unknown[]) => void): () => void;
  /** Phát một sự kiện cordis. */
  emit(event: string): void;
  /** Đăng ký hiệu ứng vòng đời; callback dựng hàm dọn. */
  effect(callback: () => () => Promise<void>, label?: string): unknown;
}

/** Một nguồn chỉ mục đã cấu hình, kèm lời từ chối khiến nó không dùng được. */
interface MarketIndexSource {
  /** URL đúng như đã cấu hình. */
  readonly url: string;
  /** Lời từ chối khi nguồn không dùng được. */
  readonly error?: string;
}

/** Một tài liệu chỉ mục đã đọc: chỉ mục, thời điểm đọc, và bộ tìm kiếm dựng trên nó. */
interface MarketDocument {
  /** Chỉ mục đã validate. */
  readonly index: MarketIndex;
  /** Thời điểm đọc, Unix mili giây. */
  readonly fetchedAt: number;
  /** Bộ tìm kiếm của tài liệu này. */
  readonly search: MarketSearch;
}

/** Một tài liệu đã nhớ kèm hạn dùng. */
interface CachedDocument {
  /** Tài liệu đã đọc. */
  readonly document: MarketDocument;
  /** Hạn dùng, Unix mili giây. */
  readonly expiresAt: number;
}

/** Chẩn đoán CHÍNH XÁC của một lần hỏng, kể cả khi bị từ chối bằng giá trị không phải `Error`. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Số cause lần theo bên dưới một lần từ chối; chuỗi sâu hơn hoặc có vòng thì cắt tại đó. */
const MAX_CAUSES = 4;

/** Một lần từ chối kèm chuỗi cause: lỗi `fetch` của Node là `fetch failed` trần, lý do thật nằm ở cause. */
function causeChainOf(error: unknown, depth = 0): string {
  return error instanceof Error && error.cause !== undefined && depth < MAX_CAUSES
    ? `${error.message}: ${causeChainOf(error.cause, depth + 1)}`
    : messageOf(error);
}

/** Trang LỚN NHẤT mà `search` trả về. */
const MAX_LIMIT = 100;

/**
 * Dựng MỘT `RemoteError` với mã của namespace này. Bản gốc khai sáu mã đó bằng `declare module` trên
 * `RemoteErrorDetailsMap`; repo này CẤM `declare module` (luật 000d) ⇒ ép kiểu tại ĐÚNG MỘT chỗ này,
 * giữ nguyên lớp lỗi, mã, thông điệp, chi tiết và `cause` như bản gốc.
 * Nhận: mã lỗi, thông điệp, chi tiết, và (tuỳ chọn) nguyên nhân.
 * Trả: đối tượng `RemoteError` đã dựng.
 */
function pluginMarketFailure(
  code: PluginMarketErrorCode,
  message: string,
  details: Record<string, unknown>,
  options?: { readonly cause?: unknown },
): RemoteError {
  return new RemoteError(code as never, message, details as never, options as never);
}

/**
 * Chú thích MỘT plugin bằng dữ kiện cài đặt và tương thích của hồ sơ.
 * Nhận: plugin của chỉ mục, các bundle của hồ sơ, bảng miễn trừ, và phiên bản DSH đang chạy.
 * Trả: mục niêm yết kèm `install`/`compatibility` từng phiên bản, `defaultVersion`, và `installation`.
 */
function listingOf(
  plugin: MarketPlugin,
  bundles: readonly MarketBundle[],
  exemptions: Readonly<Record<string, readonly string[]>>,
  runtimeVersion: string,
): MarketListingEntry {
  const versions: MarketListingVersion[] = plugin.versions.map((version) => ({
    ...version,
    install: marketInstallTarget(plugin.name, version),
    compatibility: compatibilityOf(plugin.name, version, exemptions, runtimeVersion),
  }));
  const compatible = versions.filter((version) => version.compatibility.compatible);
  const stable = plugin.versions.some((version) => semver.prerelease(version.version) === null);
  const defaultVersion = compatible.find((version) => !stable || semver.prerelease(version.version) === null)?.version;
  /* v8 ignore next -- parseMarketIndex bảo đảm danh sách phiên bản KHÔNG rỗng */
  const measured = defaultVersion ?? versions[0]?.version ?? "";
  return {
    ...plugin,
    versions,
    ...(defaultVersion === undefined ? {} : { defaultVersion }),
    installation: installationOf(plugin.name, measured, bundles),
  };
}

/**
 * Đo MỘT plugin với các bundle của hồ sơ theo tên package và phiên bản đã đo.
 * Nhận: tên package, phiên bản đã đo, và các bundle của hồ sơ.
 * Trả: trạng thái cài đặt kèm phiên bản đang cài khi hồ sơ báo được.
 */
function installationOf(name: string, version: string, bundles: readonly MarketBundle[]): MarketInstallation {
  const bundle = bundles.find((candidate) => candidate.name === name);
  if (bundle === undefined || (!bundle.installed && bundle.availability !== "installation")) return { status: "not-installed" };
  if (!bundle.installed) {
    return { status: "provided", ...(bundle.version === undefined ? {} : { installedVersion: bundle.version }) };
  }
  if (bundle.version === undefined) return { status: "different-version" };
  const installedVersion = bundle.version;
  if (installedVersion === version) return { status: "installed", installedVersion };
  return {
    status: semver.valid(installedVersion) !== null && semver.gt(version, installedVersion) ? "update-available" : "different-version",
    installedVersion,
  };
}

/**
 * Đánh giá tương thích của MỘT phiên bản với DSH đang chạy, đúng như phép kiểm cài đặt của DSH.
 * Nhận: tên package, phiên bản niêm yết, bảng miễn trừ, và phiên bản DSH đang chạy.
 * Trả: `{ compatible: true }`, hoặc yêu cầu chưa đạt kèm cờ miễn trừ.
 */
function compatibilityOf(
  name: string,
  version: MarketVersion,
  exemptions: Readonly<Record<string, readonly string[]>>,
  runtimeVersion: string,
): MarketCompatibility {
  const issue = evaluatePluginCompatibility(
    {
      name,
      version: version.version,
      ...(version.engines.dsh === undefined ? {} : { engines: { dsh: version.engines.dsh } }),
    },
    exemptions,
    runtimeVersion,
  );
  if (issue === undefined) return { compatible: true };
  return {
    compatible: false,
    runtimeVersion: issue.runtimeVersion,
    requirements: issue.requirements,
    exempted: issue.exempted,
  };
}

/**
 * Service `pluginMarket`: tải, validate và nhớ các chỉ mục thị trường đã cấu hình; chú thích từng mục bằng
 * dữ kiện cài đặt của hồ sơ. Ba phương thức `@Remote` là mặt RPC của nó.
 */
export default class PluginMarket extends TypertRemoteService {
  /** Phải có trước khi service thức dậy: tra bundle và miễn trừ của hồ sơ. */
  static inject = ["pluginManager"];

  /** Cấu hình plugin — nguyên văn schema của bản gốc, gồm trường volatile `indexes`. */
  static Config = z.object({
    indexes: z.array(z.string().pattern(/^https?:\/\/\S+$/u)).default([]).volatile(),
    fetchTimeoutMs: z.natural().min(1).max(MAX_TIMER_DELAY_MS).default(15e3),
    maxBytes: z.natural().min(1).default(128 * 1024 * 1024),
    cacheTtlMs: z.natural().default(6e5),
  });

  /** Cấu hình đã phân giải của row. */
  private readonly config: Config;

  /** Context của CHÍNH service này, nhìn qua seam cấu trúc (luật 000d). */
  private readonly owner: PluginMarketContext;

  /** Vòng đời của service: huỷ khi disposed, và làm hạn chót của mọi lần tải. */
  private readonly lifetime = new AbortController();

  /** Tài liệu đã nhớ theo URL. */
  private readonly cache = new Map<string, CachedDocument>();

  /** Lần tải đang chạy theo URL — đọc đồng thời của một URL dùng CHUNG một lần tải. */
  private readonly pending = new Map<string, Promise<MarketDocument>>();

  /** Lỗi của lần đọc cuối theo URL. */
  private readonly errors = new Map<string, string>();

  /** Id mục profile của row này, khi có. */
  private readonly entryId: string | undefined;

  /**
   * Đăng ký service `pluginMarket` và hai lượt nghe của bản gốc.
   * Nhận: `ctx` — Context sở hữu plugin; `config` — cấu hình row đã kiểm bởi `static Config`.
   * Trả: thể hiện service đã cài (cordis dùng ngay sau khi dựng).
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "pluginMarket");
    const owner = ctx as unknown as PluginMarketContext;
    this.config = config;
    this.owner = owner;
    this.entryId = owner.fiber.entry?.options.id;
    owner.on("loader/volatile-update", () => {
      const configured = new Set(this.sources().flatMap((source) => (source.error === undefined ? [source.url] : [])));
      for (const url of [...this.cache.keys(), ...this.errors.keys()]) {
        if (!configured.has(url)) {
          this.cache.delete(url);
          this.errors.delete(url);
        }
      }
      owner.emit("plugin-market/changed");
    });
    owner.effect(() => async () => {
      this.lifetime.abort(new Error("Plugin market disposed"));
      await Promise.allSettled(this.pending.values());
    });
  }

  /**
   * Liệt kê các nguồn chỉ mục đã cấu hình mà KHÔNG tải chúng.
   * Nhận: không.
   * Trả: mọi nguồn theo thứ tự, kèm tiêu đề của lần đọc thành công cuối và lỗi của lần đọc cuối khi nó hỏng.
   */
  @Remote
  listIndexes(): MarketIndexSummary[] {
    return this.sources().map(({ url, error: invalid }): MarketIndexSummary => {
      const index = this.cache.get(url)?.document.index;
      const error = invalid ?? this.errors.get(url);
      return {
        url,
        ...(index === undefined
          ? {}
          : { title: index.title, ...(index.description === undefined ? {} : { description: index.description }) }),
        ...(error === undefined ? {} : { error }),
      };
    });
  }

  /**
   * Thay các nguồn chỉ mục đã cấu hình qua Settings, KHÔNG mount lại service.
   * `plugin-market/changed` loan báo danh sách đã cam kết. URL đã cấu hình được giữ nguyên như đã viết, để
   * client thêm/bớt nguồn bên cạnh một nguồn mà `listIndexes` báo là không dùng được.
   * Nhận: `urls` — URL chỉ mục theo thứ tự hiển thị.
   * Trả: không trả gì; ném `RemoteError` `plugin-market/invalid-index-url` cho URL mới không hợp lệ hoặc URL lặp,
   * `plugin-market/settings-unavailable` khi thiếu Settings hoặc thiếu mục profile.
   */
  @Remote
  async setIndexes(urls: string[]): Promise<void> {
    const configured = new Set(this.config.indexes.get());
    const normalized = urls.map((url) => (configured.has(url) ? url : normalizeIndexUrl(url)));
    const keys = normalized.map((url) => (URL.canParse(url) ? new URL(url).href : url));
    const repeated = normalized.find((_url, position) => keys.indexOf(keys[position] ?? "") !== position);
    if (repeated !== undefined) {
      throw pluginMarketFailure("plugin-market/invalid-index-url", `Index source listed twice: ${repeated}`, {
        url: repeated,
        reason: "duplicate",
      });
    }
    const settings = this.owner.get("settings") as SettingsSeam | undefined;
    if (settings === undefined || this.entryId === undefined) {
      throw pluginMarketFailure(
        "plugin-market/settings-unavailable",
        "Index sources require the settings service and a profile entry",
        {},
      );
    }
    await settings.update(this.entryId, { indexes: normalized });
  }

  /**
   * Trả MỘT trang plugin của một chỉ mục đã cấu hình khớp truy vấn. Đọc đồng thời cùng một URL dùng chung một
   * lần tải; tài liệu đọc thành công được dùng lại `cacheTtlMs` trừ khi bật `refresh`. Phép khớp và xếp thứ tự
   * chỉ đọc tài liệu; trạng thái cài đặt và tương thích được tính cho trang trả về ở MỌI lần gọi.
   * Nhận: `url` — một URL chỉ mục đã cấu hình; `query` — văn bản, bộ lọc, thứ tự, trang, và cờ bỏ qua tài liệu nhớ.
   * Trả: tiêu đề chỉ mục, các plugin của trang kèm phiên bản mặc định + trạng thái cài đặt của từng plugin và
   * tương thích + tham số cài của từng phiên bản, số plugin khớp, và offset của trang sau.
   */
  @Remote
  async search(url: string, query: MarketQuery): Promise<MarketSearchResult> {
    if (!Number.isSafeInteger(query.offset) || query.offset < 0) {
      throw pluginMarketFailure("plugin-market/invalid-query", "offset must be a non-negative integer", {
        field: "offset",
        reason: "range",
      });
    }
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > MAX_LIMIT) {
      throw pluginMarketFailure("plugin-market/invalid-query", `limit must be an integer from 1 to ${String(MAX_LIMIT)}`, {
        field: "limit",
        reason: "range",
      });
    }
    const document = await this.document(url, query.refresh === true, query.fetchedAt);
    const matching = await document.search.select(query);
    const page = matching.slice(query.offset, query.offset + query.limit);
    const listing = await this.annotator();
    const next = query.offset + page.length;
    const { index } = document;
    return {
      url,
      title: index.title,
      ...(index.description === undefined ? {} : { description: index.description }),
      metadata: index.metadata,
      fetchedAt: document.fetchedAt,
      entries: page.map(listing),
      total: matching.length,
      nextOffset: next < matching.length ? next : null,
    };
  }

  /**
   * Đọc MỘT plugin của một chỉ mục đã cấu hình, dùng tài liệu đã nhớ như `search`.
   * Nhận: `url` — một URL chỉ mục đã cấu hình; `name` — tên package của plugin.
   * Trả: plugin kèm phiên bản mặc định, trạng thái cài đặt và các phiên bản đã chú thích; `undefined` khi chỉ mục
   * không niêm yết nó.
   */
  async entry(url: string, name: string): Promise<MarketListingEntry | undefined> {
    const plugin = (await this.document(url, false)).index.plugins.find((candidate) => candidate.name === name);
    return plugin === undefined ? undefined : (await this.annotator())(plugin);
  }

  /**
   * Chọn tài liệu trả lời một URL: bản đã nhớ còn dùng được, hoặc lần tải dùng chung.
   * Nhận: URL, cờ bỏ qua bản nhớ, và `fetchedAt` của trang trước (nối tiếp đúng tài liệu).
   * Trả: tài liệu của chỉ mục đã cấu hình.
   */
  private async document(url: string, refresh: boolean, fetchedAt?: number): Promise<MarketDocument> {
    const source = this.sources().find((candidate) => candidate.url === url);
    if (source === undefined) {
      throw pluginMarketFailure("plugin-market/unknown-index", `Not a configured index source: ${url}`, { url });
    }
    if (source.error !== undefined) {
      throw pluginMarketFailure("plugin-market/invalid-index-url", source.error, { url, reason: "configured" });
    }
    const cached = this.cache.get(url);
    const usable =
      cached !== undefined && (cached.expiresAt > Date.now() || cached.document.fetchedAt === fetchedAt);
    return !refresh && usable && cached !== undefined ? cached.document : await this.fetchShared(url);
  }

  /**
   * Dựng hàm chú thích plugin bằng bundle và miễn trừ của hồ sơ NHƯ HIỆN TẠI.
   * Nhận: không.
   * Trả: hàm nhận một plugin và trả mục niêm yết đã chú thích.
   */
  private async annotator(): Promise<(plugin: MarketPlugin) => MarketListingEntry> {
    const bundles = await this.owner.pluginManager.listBundles();
    const { exemptions } = this.owner.pluginManager.listVersionExemptions();
    const runtimeVersion = getDshRuntimeVersion();
    return (plugin) => listingOf(plugin, bundles, exemptions, runtimeVersion);
  }

  /**
   * Các nguồn đã cấu hình ĐÚNG NHƯ ĐÃ VIẾT, mỗi nguồn kèm lời từ chối khiến nó không dùng được. Settings và tệp
   * profile có thể ghi bất kỳ chuỗi http(s) nào, nên MỌI lần dùng đều validate thay vì dựa vào schema; nguồn không
   * dùng được vẫn được liệt kê kèm lỗi và KHÔNG BAO GIỜ được tải, còn URL lặp chỉ tính một lần.
   * Nhận: không.
   * Trả: các nguồn theo thứ tự cấu hình, đã khử trùng.
   */
  private sources(): MarketIndexSource[] {
    const seen = new Set<string>();
    return this.config.indexes.get().flatMap((url: string): MarketIndexSource[] => {
      if (seen.has(url)) return [];
      seen.add(url);
      try {
        return normalizeIndexUrl(url) === url
          ? [{ url }]
          : [{ url, error: `Index URL is not in canonical form; use ${normalizeIndexUrl(url)}` }];
      } catch (error) {
        return [{ url, error: messageOf(error) }];
      }
    });
  }

  /**
   * Cho biết một URL có phải nguồn đã cấu hình VÀ dùng được không.
   * Nhận: URL cần kiểm.
   * Trả: `true` khi URL nằm trong danh sách cấu hình và không có lời từ chối.
   */
  private configured(url: string): boolean {
    return this.sources().some((source) => source.url === url && source.error === undefined);
  }

  /**
   * Dùng lại lần tải đang chạy của một URL, hoặc bắt đầu MỘT lần tải dùng chung.
   * Nhận: URL cần đọc.
   * Trả: promise của tài liệu; lần tải được gỡ khỏi bảng khi kết thúc.
   */
  private fetchShared(url: string): Promise<MarketDocument> {
    let pending = this.pending.get(url);
    if (pending === undefined) {
      pending = this.fetchIndex(url)
        .then(
          (index) => {
            const document: MarketDocument = {
              index,
              fetchedAt: Math.max(Date.now(), (this.cache.get(url)?.document.fetchedAt ?? 0) + 1),
              search: new MarketSearch(index),
            };
            if (this.configured(url)) {
              this.cache.set(url, { document, expiresAt: Date.now() + this.config.cacheTtlMs });
              this.errors.delete(url);
            }
            return document;
          },
          (error: unknown) => {
            if (this.configured(url)) this.errors.set(url, messageOf(error));
            throw error;
          },
        )
        .finally(() => {
          this.pending.delete(url);
        });
      this.pending.set(url, pending);
    }
    return pending;
  }

  /**
   * Tải và validate MỘT chỉ mục: `fetch` có hạn chót chung của service, đọc thân có trần byte, rồi parse trong
   * Worker Thread.
   * Nhận: URL cần tải.
   * Trả: chỉ mục đã validate.
   * Ném: `plugin-market/fetch-failed` cho lỗi mạng/hạn chót/chuyển hướng/trạng thái không 2xx/thân quá lớn, và
   * `plugin-market/invalid-index` cho tài liệu không phải JSON format 1 hợp lệ.
   */
  private async fetchIndex(url: string): Promise<MarketIndex> {
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(this.config.fetchTimeoutMs)]);
    const failed = (reason: string, cause?: unknown): RemoteError =>
      pluginMarketFailure("plugin-market/fetch-failed", `Could not fetch ${url}: ${reason}`, { url, reason }, { cause });
    let response: Response;
    try {
      response = await fetch(url, {
        signal,
        redirect: "error",
        headers: { accept: "application/json" },
      });
    } catch (error) {
      throw failed(causeChainOf(error), error);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw failed(`HTTP ${String(response.status)}`);
    }
    const result = await parseIndexInWorker(await this.readBody(response, failed), url, this.lifetime.signal).catch(
      (error: unknown) => {
        throw failed(messageOf(error), error);
      },
    );
    if (result.ok) return result.index;
    throw pluginMarketFailure("plugin-market/invalid-index", `${url}: ${result.message}`, {
      url,
      path: result.path,
      reason: result.reason,
    });
  }

  /**
   * Đọc TOÀN BỘ thân phản hồi, từ chối ngay khi vượt `maxBytes`.
   * Nhận: `response` — phản hồi đang mở; `failed` — hàm dựng lỗi `fetch-failed` của lần tải này.
   * Trả: toàn bộ thân đã đọc thành MỘT mảng byte.
   */
  private async readBody(
    response: Response,
    failed: (reason: string, cause?: unknown) => RemoteError,
  ): Promise<Uint8Array> {
    const limit = this.config.maxBytes;
    const tooLarge = `body exceeds ${String(limit)} bytes`;
    if (Number(response.headers.get("content-length") ?? 0) > limit) {
      await response.body?.cancel();
      throw failed(tooLarge);
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    const stream = response.body;
    try {
      if (stream !== null) {
        // tsconfig của gói KHÔNG bật lib 'DOM.AsyncIterable' (repo không gói nào bật) ⇒ ép kiểu tại ĐÚNG chỗ này;
        // ReadableStream CÓ Symbol.asyncIterator lúc chạy (Bun/Node/browser), và bản gốc cũng lặp bằng for-await.
        for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
          size += chunk.byteLength;
          if (size > limit) throw failed(tooLarge);
          chunks.push(chunk);
        }
      }
    } catch (error) {
      if (error instanceof RemoteError) throw error;
      throw failed(messageOf(error), error);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return body;
  }
}
