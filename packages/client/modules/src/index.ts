/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Nua node cua he module client: quet cay plugin de dung do thi __GBH_BOOT__, phuc vu bundle
 *      /plugins va giu seam clientModules cho nua HMR
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Service } from "@deepseek-ai/cordis";
import { exactPackageSpecifier, parseDshClient, stripClientSuffix } from "./client/manifest.ts";
import { dshRemapEnabled, readDshAliasMap, remapSpecifiers, type DshAliasMap } from "./remap.ts";
import {
  BOOTSTRAP_ID,
  PLUGIN_ROUTE,
  artifactRevision,
  bootInjections,
  buildBatches,
  buildCombo,
  chunkMapReference,
  chunkUrl,
  clientExportOf,
  aliasRows,
  graphRow,
  lazyBody,
  orderByModuleGraph,
  shortHash,
  type ArtifactBaseline,
  type BundleResource,
  type GraphRow,
  type InjectionRow,
  type WebBootGraph,
} from "./combos.ts";
import { buildComboScript, buildComboSourceMap } from "./sourcemap.ts";

declare const __GBH_BUILD_COMMIT__: string;

/** Commit nguồn đóng vào artifact lúc build; bản chạy từ nguồn (test) dùng `dev`. */
const BUILD_COMMIT: string = typeof __GBH_BUILD_COMMIT__ === "string" ? __GBH_BUILD_COMMIT__ : "dev";
/** Chỉ dẫn khắc phục chung cho mọi chẩn đoán bundle khởi động (nguyên văn hợp đồng của DSH). */
const CLIENT_BUNDLE_BUILD_INSTRUCTION = "run `pnpm run build` before launch";
/** Code có revision là bất biến; revision lệch bị từ chối chứ không phục vụ byte mới hơn. */
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
/** Chỉ nhận chunk cục bộ của package do bản build sinh ra. */
const CLIENT_CHUNK = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/;
/** Content-type của script plugin. */
const SCRIPT_CONTENT_TYPE = "text/javascript; charset=utf-8";
/** Content-type của source map. */
const MAP_CONTENT_TYPE = "application/json; charset=utf-8";

/** Một dòng của Loader mà nửa node phải đọc (khai báo theo cấu trúc để không kéo kiểu của cả cây). */
interface LoaderEntryRow {
  /** Tuỳ chọn row; `name` là specifier của module. */
  options: { name: string };
  /** Fiber đang sống; vắng khi row chưa nạp được. */
  fiber?: unknown;
  /** Row bị tắt thì không bao giờ vào đồ thị. */
  disabled?: boolean;
  /** Cây sở hữu row, nơi có base URL để phân giải specifier. */
  parent: { tree: { ctx: { baseUrl?: string } } };
}

/** Dịch vụ Loader: nguồn sự thật về cây entry đang sống và cách phân giải specifier. */
interface LoaderService {
  /** Mọi entry hiện có. */
  entries(): LoaderEntryRow[];
  /** Seam phân giải của Loader (hình dạng khác nhau theo phiên bản). */
  internal?: { version?: string; resolveSync: (...args: unknown[]) => { url: string } };
}

/** Fiber của một plugin vừa dựng hoặc gỡ (sự kiện `internal/plugin`). */
interface PluginFiberRow {
  /** Entry mà fiber này thuộc về. */
  entry?: { options: { name: string } };
}

/** Seam web của kernel: một carrier đăng ký route và một effect để gỡ. */
interface WebCarrier {
  /** Carrier HTTP đang chạy; `register` trả hàm gỡ route. */
  webServer: {
    register(route: {
      kind: "prefix";
      path: string;
      handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
  };
  /** Đăng ký một hiệu ứng vào vòng đời của carrier. */
  effect(callback: () => () => unknown, label?: string): void;
}

/** Mặt ngoài context kernel mà package này chạm tới. */
interface KernelContext {
  /** Loader của cây plugin. */
  loader: LoaderService;
  /** Logger của kernel. */
  logger: { warn(...args: unknown[]): void; error(...args: unknown[]): void };
  /** Nghe sự kiện `internal/plugin` (dựng/gỡ fiber). */
  on(event: "internal/plugin", listener: (fiber: PluginFiberRow) => void): void;
  /** Nghe sự kiện thu bảng injection index của webserver. */
  on(event: "webserver/index-inject", listener: (table: InjectionRow[]) => void): void;
  /** Chờ một service rồi chạy callback trong context của nó. */
  inject(deps: ["webServer"], callback: (ctx: WebCarrier) => void): void;
}

/** Bundle client chưa build, giữ dạng dữ liệu để gom lỗi khởi động theo nhóm hành động được. */
class MissingClientBundleError extends Error {
  /** Package thiếu bundle. */
  readonly packageName: string;
  /** Đường dẫn đã tìm. */
  readonly clientPath: string;

  /**
   * Dựng lỗi thiếu bundle kèm chỉ dẫn build.
   * Nhận: tên package, đường dẫn bundle, và nguyên nhân gốc.
   * Trả: thực thể lỗi.
   */
  constructor(packageName: string, clientPath: string, cause?: unknown) {
    super(
      ["client-modules: client bundle not found; " + CLIENT_BUNDLE_BUILD_INSTRUCTION + ":", "  package: " + packageName, "  path: " + clientPath].join("\n"),
      { cause },
    );
    this.packageName = packageName;
    this.clientPath = clientPath;
  }
}

/** Lỗi hợp thành khi khởi động: nhóm lỗi build của package và các lỗi khác. */
class ClientPackageCompositionError extends AggregateError {
  /**
   * Gom lỗi khởi động thành một thông điệp đọc được.
   * Nhận: danh sách lỗi.
   * Trả: thực thể lỗi tổng hợp.
   */
  constructor(failures: readonly Error[]) {
    const missing = failures.filter((error) => error instanceof MissingClientBundleError);
    const other = failures.filter((error) => !(error instanceof MissingClientBundleError));
    const lines = [
      "client-modules: " + String(failures.length) + " client " + (failures.length === 1 ? "package" : "packages") + " failed to compose:",
    ];
    if (missing.length > 0) {
      lines.push("  client bundles not found; " + CLIENT_BUNDLE_BUILD_INSTRUCTION + ":");
      for (const error of missing) lines.push("    - package: " + error.packageName, "      path: " + error.clientPath);
    }
    if (other.length > 0) lines.push("  other failures:", ...other.map((error) => "    - " + error.message));
    super(failures, lines.join("\n"));
  }
}

/**
 * Đọc các id module PHỤ của một row từ HAI nguồn khai báo: §gbh.row.aliases§ và §gbh.row.moduleIds§.
 * Trả về **HỢP** của hai nguồn (đã lọc id của chính package và khử trùng) — nếu chỉ lấy một nguồn thì
 * gói khai cả hai sẽ mất entry cho id stock (đúng ca §ui-sidebar§), hoặc ngược lại.
 * Nhận: tên package làm tiền tố chẩn đoán, giá trị thô của §aliases§, và giá trị thô của §moduleIds§.
 * Trả: mảng id phụ, hoặc mảng rỗng khi row không khai gì.
 * @throws khi §aliases§ có mặt nhưng không phải mảng chuỗi khác rỗng.
 */
function readAliases(pkgName: string, value: unknown, moduleIds?: unknown): string[] {
  const fromModuleIds = Array.isArray(moduleIds) ? moduleIds.filter((id): id is string => typeof id === "string" && id !== pkgName) : [];
  if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item === ""))) {
    throw new Error("client-modules: " + pkgName + " gbh.row.aliases must be a string array");
  }
  const fromAliases = Array.isArray(value) ? (value as string[]).filter((id) => id !== pkgName) : [];
  return [...new Set([...fromAliases, ...fromModuleIds])];
}

/** Đích phân giải của một row: package nào, bundle ở đâu, và các trường vào đồ thị. */
interface ResolvedPackage {
  /** Tên package đọc từ manifest. */
  packageName: string;
  /** Vị trí bundle client và các trường khai báo. */
  meta: { clientPath: string; inject?: readonly string[]; external: readonly string[]; immediately: boolean; aliases: readonly string[] };
}

/** Một nguồn Loader đang sống trỏ tới một package khai `dsh.client`. */
interface PackageSource extends ResolvedPackage {
  /** Specifier của row. */
  loaderName: string;
  /** Base URL của cây sở hữu row. */
  baseUrl: string;
  /** Khoá nhận dạng nguồn. */
  sourceKey: string;
}

/** Một dòng đã chụp byte: row đồ thị + bundle + dấu vết để HMR so sánh. */
interface BundleRecord {
  /** Row wire của đồ thị. */
  entry: GraphRow;
  /** Specifier của row Loader. */
  loaderName: string;
  /** Khoá nguồn. */
  sourceKey: string;
  /** Vị trí bundle và các trường khai báo. */
  meta: ResolvedPackage["meta"];
  /** Byte bundle tại thời điểm khởi động. */
  bundle: Buffer;
  /** Dấu vết hệ thống tập tin đã chụp trước khi đọc byte. */
  baseline: ArtifactBaseline;
}

/** Một phản hồi tài nguyên plugin đã lên kế hoạch, thân sinh lười. */
interface BundleResponse {
  /** Sinh thân phản hồi ở lần GET đầu tiên. */
  body: () => Promise<Buffer>;
  /** Content-type của phản hồi. */
  contentType: string;
}

/** Kết quả phân giải một request `/plugins`. */
type BundleResult =
  | { status: 200; headers: Record<string, string>; body?: Buffer }
  | { status: 404; headers?: undefined; body?: undefined }
  | { status: 405; headers?: undefined; body?: undefined };

/** Chunk cục bộ đã khớp URL hiện hành. */
interface ChunkRequest {
  /** Dòng sở hữu chunk. */
  record: BundleRecord;
  /** Tên file chunk. */
  fileName: string;
  /** Request là map chứ không phải script. */
  sourceMap: boolean;
  /** URL tài nguyên đã khớp. */
  resourceUrl: string;
}

/**
 * Dịch vụ bảng plugin web: quét tăng dần `dsh.client`, dựng wire, phục vụ bundle và đóng góp row
 * injection index. Khởi tạo chạy luôn lượt quét kích hoạt — một khai báo sai hoặc một bundle thiếu
 * trong số row đã nạp sẽ gộp thành MỘT lỗi to (fiber FAILED, bản kiểm toán boot kể lại).
 */
export class ClientModuleRegistry extends Service {
  /** Package này cần Loader của kernel. */
  static inject = ["loader"];
  /** Danh tính release phát trong mọi đồ thị. */
  readonly release: { version: string; commit?: string };
  private readonly table = new Map<string, BundleRecord>();
  private readonly sources = new Map<string, PackageSource>();
  private readonly pkgMeta = new Map<string, ResolvedPackage | null>();
  private readonly rebuildListeners = new Set<(id: string, rev: string) => void>();
  private readonly graphListeners = new Set<() => void>();
  private readonly dirty = new Set<string>();
  private responses = new Map<string, BundleResponse>();
  private batchResponses = new Map<string, BundleResponse>();
  /** Một thế hệ đồ thị trước đó, đủ để một request đua với lần dựng lại vẫn phân giải được. */
  private previousBatchResponses = new Map<string, BundleResponse>();
  private flushQueued = false;
  private composed: WebBootGraph;

  /** Bản đồ alias id stock → id của ta, dùng khi dựng bảng module web (task-137). Rỗng ⇒ tắt remap. */
  private readonly dshAliasMap: DshAliasMap;

  /**
   * Dựng dịch vụ: đăng ký nghe, gieo tập dirty và chạy lượt quét kích hoạt.
   * Route bundle đi theo vòng đời của carrier web (đăng ký lại khi carrier bị thay).
   * Nhận: context của kernel.
   * Trả: thực thể dịch vụ.
   * @throws {ClientPackageCompositionError} khi có package không hợp thành được.
   */
  constructor(ctx: KernelContext) {
    super(ctx as never, "clientModules");
    // task-137: bản đồ alias đọc MỘT LẦN khi dựng dịch vụ (đủ mọi gói đã mount), dùng để khử id DSH khỏi bảng module.
    // `GBH_DSH_REMAP=off` ⇒ map rỗng ⇒ hành vi y như trước (A/B tức thời, không cần build lại).
    this.dshAliasMap = dshRemapEnabled() ? readDshAliasMap() : new Map<string, string>();
    const manifest = createRequire(import.meta.url)("../package.json") as { version: string };
    this.release = { version: manifest.version, commit: BUILD_COMMIT };
    ctx.on("internal/plugin", (fiber) => {
      const entryName = fiber.entry?.options.name;
      if (entryName === undefined) return;
      this.dirty.add(entryName);
      if (this.flushQueued) return;
      this.flushQueued = true;
      queueMicrotask(() => {
        this.flushQueued = false;
        this.flush((error) => {
          ctx.logger.warn(error);
        });
      });
    });
    for (const entry of ctx.loader.entries()) this.dirty.add(entry.options.name);
    this.composed = this.compose();
    const failures: Error[] = [];
    this.flush((error) => failures.push(error));
    if (failures.length > 0) throw new ClientPackageCompositionError(failures);
    ctx.inject(["webServer"], (webCtx) => {
      webCtx.effect(
        () =>
          webCtx.webServer.register({
            kind: "prefix",
            path: PLUGIN_ROUTE,
            handler: this.serveBundle,
          }),
        "client-modules: bundle route",
      );
    });
    ctx.on("webserver/index-inject", (table) => {
      table.push(...bootInjections(this.composed));
    });
  }

  /**
   * Đồ thị entry hiện hành (đối tượng ổn định giữa các lần đổi).
   * Nhận: không.
   * Trả: đồ thị sẽ được phục vụ dưới khoá `__GBH_BOOT__`.
   */
  graph(): WebBootGraph {
    return this.composed;
  }

  /**
   * Đường dẫn tuyệt đối của bundle client của một entry.
   * Nhận: id entry (tên package).
   * Trả: đường dẫn, hoặc undefined khi id lạ.
   */
  clientPath(id: string): string | undefined {
    return this.table.get(id)?.meta.clientPath;
  }

  /**
   * Dấu vết hệ thống tập tin đã chụp trước khi đọc byte hiện hành — nửa HMR so nó với file đang sống.
   * Nhận: id entry.
   * Trả: bản sao dấu vết, hoặc undefined khi id lạ.
   */
  artifactBaseline(id: string): ArtifactBaseline | undefined {
    const baseline = this.table.get(id)?.baseline;
    return baseline === undefined ? undefined : { ...baseline };
  }

  /**
   * Công bố một thế hệ bundle vừa build xong — cửa DUY NHẤT để thay đổi bản build đi vào đồ thị.
   * mtime/ctime/size không đổi thì giữ nguyên đồ thị mà không đọc lại bundle.
   * Nhận: id entry.
   * Trả: revision hiện tại của artifact, hoặc undefined khi id lạ.
   */
  rebuilt(id: string): string | undefined {
    const record = this.table.get(id);
    if (record === undefined) return undefined;
    const baseline = this.captureArtifactBaseline(record.meta.clientPath);
    const rev = artifactRevision(baseline);
    if (rev === record.entry.rev) return rev;
    record.baseline = baseline;
    record.entry = graphRow(id, rev, record.meta);
    record.bundle = readFileSync(record.meta.clientPath);
    this.composed = this.compose();
    for (const notify of [...this.rebuildListeners]) {
      try {
        notify(id, rev);
      } catch (error) {
        this.logError(error);
      }
    }
    this.notifyGraphChanged();
    return rev;
  }

  /**
   * Nghe sự kiện bundle được build lại; chỉ phát khi metadata artifact đổi revision.
   * Nhận: listener nhận id entry và revision mới.
   * Trả: hàm huỷ đăng ký.
   */
  onRebuilt(listener: (id: string, rev: string) => void): () => void {
    this.rebuildListeners.add(listener);
    return () => {
      this.rebuildListeners.delete(listener);
    };
  }

  /**
   * Phát sau mọi lượt flush có dựng lại đồ thị (thêm/bớt row, hoặc revision đổi do build lại).
   * Mô hình kéo: listener tự đọc lại `graph()`.
   * Nhận: listener không tham số.
   * Trả: hàm huỷ đăng ký.
   */
  onGraphChanged(listener: () => void): () => void {
    this.graphListeners.add(listener);
    return () => {
      this.graphListeners.delete(listener);
    };
  }

  /**
   * Phục vụ một tài nguyên bundle hoặc source map đã quảng cáo mà KHÔNG cần web server.
   * URL lạ trả 404, method không hỗ trợ trả 405, và `HEAD` trả cùng header bất biến mà không dựng thân.
   * Nhận: request `{ method, url }` của carrier.
   * Trả: phản hồi y hệt route web (dùng chung một đường phân giải).
   */
  async fetchBundle(request: { method: string; url: string }): Promise<Response> {
    const resource = await this.bundleResource(request.method, request.url);
    const body = resource.body === undefined ? undefined : Uint8Array.from(resource.body);
    return new Response(body ?? null, { status: resource.status, ...(resource.headers === undefined ? {} : { headers: resource.headers }) });
  }

  /** Ghi log qua seam logger của kernel (không ném lỗi ra ngoài khi logger đổi hình dạng). */
  private logError(error: unknown): void {
    (this.ctx as unknown as KernelContext).logger.error(error);
  }

  /** Lấy tài nguyên của một dòng đã chụp byte. */
  private resourceOf(record: BundleRecord): BundleResource {
    return { id: record.entry.id, rev: record.entry.rev, clientPath: record.meta.clientPath, fileName: "client.js", bundle: record.bundle };
  }

  /**
   * Công tắc A/B: `GBH_ALIAS_TRIM=off|0|false` ⇒ TẮT trim (hành vi cũ: sinh alias cho MỌI id khai).
   * Nhận: không. Trả: true khi trim được bật.
   */
  private aliasTrimEnabled(): boolean {
    const raw = (process.env.GBH_ALIAS_TRIM ?? "").trim().toLowerCase();
    return raw !== "off" && raw !== "0" && raw !== "false";
  }

  /**
   * Tập id stock ĐANG ĐƯỢC THAM CHIẾU THẬT: inject/external còn id stock + literal require trong bundle phục vụ.
   * Vì sao: alias entry chỉ cần cho id mà một consumer THẬT SỰ require; id không ai dùng chỉ làm phình payload.
   * Nhận: records — các bản ghi trong bảng. Trả: tập id (đã bỏ hậu tố `#Type`).
   */
  private referencedStockIds(records: readonly { entry: GraphRow; meta: { inject?: readonly string[]; external: readonly string[] }; bundle: Buffer | string }[]): Set<string> {
    const set = new Set<string>();
    const boHauTo = (s: string): string => (s.includes("#") ? s.slice(0, s.indexOf("#")) : s);
    for (const record of records) {
      for (const spec of [...(record.meta.inject ?? []), ...record.meta.external]) {
        if (spec.startsWith("@deepseek-ai/")) set.add(boHauTo(spec));
      }
      const bundle = record.bundle === undefined ? "" : record.bundle.toString();
      for (const match of bundle.matchAll(/(?:require|requireFn)\(\s*["'](@deepseek-ai\/[^"']+)["']\s*\)/g)) {
        const spec = match[1];
        if (spec !== undefined) set.add(boHauTo(spec));
      }
    }
    return set;
  }

  /**
   * Lọc alias row theo tập tham chiếu thật (task-151 bước cuối).
   * Nhận: entry — row sở hữu; refs — tập id tham chiếu (undefined ⇒ giữ TẤT CẢ, hành vi cũ).
   * Trả: danh sách alias row cần sinh.
   */
  private trimmedAliases(entry: GraphRow, refs: Set<string> | undefined): GraphRow[] {
    const rows = aliasRows(entry);
    if (refs === undefined) return rows;
    const boHauTo = (s: string): string => (s.includes("#") ? s.slice(0, s.indexOf("#")) : s);
    return rows.filter((row) => refs.has(row.id) || refs.has(boHauTo(row.id)));
  }

  /** Dựng đồ thị wire từ bảng hiện hành và lên kế hoạch phản hồi cho mọi tài nguyên đã quảng cáo. */
  private compose(): WebBootGraph {
    const records = [...this.table.values()];
    const owners = records.map((record) => record.entry);
    // Entry PHỤ cho id alias: cùng URL ⇒ cùng file ⇒ bundle chạy MỘT lần, nhưng đồ thị có id stock
    // nên mọi entry stock đang chờ id đó vẫn activate được (xem aliasRows).
    // 19/10/2026 (task-151 bước cuối): TRIM alias — chỉ sinh entry cho id ĐANG ĐƯỢC THAM CHIẾU THẬT.
    // Đo trước khi sửa: 76 alias entry trong payload nhưng chỉ 6 id thật sự được require.
    const refs = this.aliasTrimEnabled() ? this.referencedStockIds(records) : undefined;
    const entries = orderByModuleGraph([...owners, ...owners.flatMap((entry) => this.trimmedAliases(entry, refs))]);
    const resources = entries.filter((entry) => this.table.has(entry.id)).map((entry) => this.resourceOf(this.recordOf(entry.id)));
    const artifacts = buildBatches(resources);
    // Mọi entry PHẢI thuộc một batch nạp (parseBootManifest từ chối entry mồ côi). Entry alias dùng chung
    // URL với row sở hữu nên nó thuộc CHÍNH batch của row đó — thêm id alias vào danh sách entry của batch ấy.
    const aliasesByOwner = new Map<string, string[]>();
    for (const entry of owners) {
      for (const alias of this.trimmedAliases(entry, refs)) {
        const list = aliasesByOwner.get(entry.id) ?? [];
        list.push(alias.id);
        aliasesByOwner.set(entry.id, list);
      }
    }
    // MỘT BUNDLE ⇒ MỘT URL. Entry phải trỏ ĐÚNG URL của batch chứa nó, không phải URL riêng của bundle:
    // ca thật 17/10/2026 — entry rev `869ebebbc94a` còn batch bootstrap rev `3a9ff2454d9e` ⇒ HAI script cho
    // CÙNG một bundle ⇒ bundle chạy hai lần ⇒ `duplicate factory registration` ⇒ #root sập. `rev` chỉ là CÁCH
    // PHỤC VỤ, nên mọi entry trong một batch phải dùng chung URL của batch đó.
    const urlByEntryId = new Map<string, string>();
    for (const artifact of artifacts) {
      for (const id of artifact.descriptor.entries) urlByEntryId.set(id, artifact.descriptor.url);
    }
    for (const entry of entries) {
      const batchUrl = urlByEntryId.get(entry.id);
      if (batchUrl !== undefined) entry.url = batchUrl;
    }
    for (const artifact of artifacts) {
      for (const id of artifact.descriptor.entries) {
        const extra = aliasesByOwner.get(id);
        if (extra === undefined) continue;
        // ⚠️ 18/10/2026 — ENTRY ALIAS PHẢI DÙNG CHUNG URL CỦA BATCH, không phải URL combo-một-bundle của nó.
        //   Ca thật (4 lượt lab 22:12–22:24): alias id của gói brand-official trỏ combo MỘT bundle trong khi
        //   row sở hữu trỏ combo CỦA BATCH ⇒ cùng một file được tải ở HAI URL khác nhau ⇒ dedupe theo URL
        //   của loader KHÔNG bắt ⇒ bundle chạy HAI lần ⇒ "single slot sidebar.brand.mark already has a
        //   registration" ⇒ sidebar sập, #root 22.204. Sửa: gán url batch cho MỌI id alias TRƯỚC khi khai
        //   vào descriptor (đúng luật đã áp cho entry chính ở vòng lặp phía trên).
        for (const aliasId of extra) {
          const aliasEntry = entries.find((candidate) => candidate.id === aliasId);
          if (aliasEntry !== undefined) aliasEntry.url = artifact.descriptor.url;
        }
        artifact.descriptor.entries.push(...extra);
      }
    }
    // ĐIỀU KIỆN CỨNG: MỌI entry phải thuộc một batch nạp. Entry mồ côi KHÔNG BAO GIỜ được nạp ⇒ treo `loading`
    // vĩnh viễn và cascade. Không im lặng: gắn vào batch theo URL của chính nó (hoặc batch application đầu tiên)
    // và ghi cảnh báo để không phải mất thêm vòng nào để tìm ra.
    const batched = new Set(artifacts.flatMap((artifact) => artifact.descriptor.entries));
    for (const entry of entries) {
      if (batched.has(entry.id)) continue;
      const byUrl = artifacts.find((artifact) => artifact.descriptor.url === entry.url);
      const target = byUrl ?? artifacts.find((artifact) => artifact.descriptor.phase === "application") ?? artifacts[0];
      if (target === undefined) throw new Error("client-modules: no batch to attach entry \"" + entry.id + "\"");
      target.descriptor.entries.push(entry.id);
      console.warn("client-modules: entry \"" + entry.id + "\" belonged to no batch; attached to \"" + target.descriptor.url + "\"");
    }
    const batchResponses = new Map<string, BundleResponse>();
    for (const artifact of artifacts) {
      batchResponses.set(artifact.url, this.responses.get(artifact.url) ?? { body: artifact.scriptBody, contentType: SCRIPT_CONTENT_TYPE });
      batchResponses.set(
        artifact.sourceMapUrl,
        this.responses.get(artifact.sourceMapUrl) ?? { body: artifact.sourceMapBody, contentType: MAP_CONTENT_TYPE },
      );
    }
    const responses = new Map(batchResponses);
    for (const record of records) {
      const artifact = buildCombo([this.resourceOf(record)], record.entry.rev);
      responses.set(
        artifact.url,
        responses.get(artifact.url) ?? this.responses.get(artifact.url) ?? { body: artifact.scriptBody, contentType: SCRIPT_CONTENT_TYPE },
      );
      responses.set(
        artifact.sourceMapUrl,
        responses.get(artifact.sourceMapUrl) ?? this.responses.get(artifact.sourceMapUrl) ?? { body: artifact.sourceMapBody, contentType: MAP_CONTENT_TYPE },
      );
    }
    for (const [resourceUrl, response] of [...this.responses]) {
      if (this.chunkRequest(new URL(resourceUrl, "http://x")) !== undefined) responses.set(resourceUrl, response);
    }
    this.previousBatchResponses = this.batchResponses;
    this.batchResponses = batchResponses;
    this.responses = responses;
    const batches = artifacts.map((artifact) => artifact.descriptor);
    return { rev: shortHash(JSON.stringify({ entries, batches })), release: this.release, entries, batches };
  }

  /** Tra bản ghi đã chụp theo id (đã kiểm sự tồn tại ở nơi gọi). */
  private recordOf(id: string): BundleRecord {
    const record = this.table.get(id);
    if (record === undefined) throw new Error('client-modules: no bundle record for "' + id + '"');
    return record;
  }

  /** Phát đồ thị đã đổi cho người nghe, không để một listener hỏng chặn những người còn lại. */
  private notifyGraphChanged(): void {
    for (const listener of [...this.graphListeners]) {
      try {
        listener();
      } catch (error) {
        this.logError(error);
      }
    }
  }

  // ---- quét cây plugin, dựng bảng và phục vụ route ----

  /** Đọc Loader seam của kernel (đi qua một lần ép kiểu có kiểm soát ở biên). */
  private loaderEntries(): LoaderEntryRow[] {
    return (this.ctx as unknown as KernelContext).loader.entries();
  }

  /** Seam phân giải của Loader, hoặc undefined khi kernel không phơi nó. */
  private loaderInternal(): LoaderService["internal"] {
    return (this.ctx as unknown as KernelContext).loader.internal;
  }

  /**
   * Đọc manifest của package mà một row Loader trỏ tới, có cache theo (specifier, baseUrl) tới khi restart.
   * Nhận: specifier của row và base URL của cây sở hữu.
   * Trả: đích phân giải khi package khai `dsh.client` nền web; null khi không phải package client.
   * @throws khi khai báo `dsh.client` sai hình dạng, hoặc thiếu export `./client`.
   */
  private resolveMeta(loaderName: string, baseUrl: string): ResolvedPackage | null {
    const key = this.sourceKey(loaderName, baseUrl);
    const cached = this.pkgMeta.get(key);
    if (cached !== undefined) return cached;
    const located = this.locatePkgJson(loaderName, baseUrl);
    if (located === undefined) {
      this.pkgMeta.set(key, null);
      return null;
    }
    const pkg = JSON.parse(readFileSync(located.path, "utf8")) as { dsh?: { client?: unknown }; exports?: unknown };
    const decl = parseDshClient(located.packageName, pkg.dsh?.client);
    if (decl === undefined || decl.platform !== "web") {
      this.pkgMeta.set(key, null);
      return null;
    }
    const clientRel = clientExportOf(located.packageName, pkg.exports);
    if (clientRel === undefined) {
      throw new Error("client-modules: " + located.packageName + ' declares dsh.client but exports no "./client" bundle');
    }
    const resolved: ResolvedPackage = {
      packageName: located.packageName,
      meta: {
        clientPath: join(dirname(located.path), clientRel),
        // KHỬ DSH (task-137): chỉ remap LÚC DỰNG BẢNG, manifest giữ nguyên văn để parity; specifier lạ KHÔNG đổi;
        // danh sách giữ NGUYÊN độ dài + thứ tự (số entry bảng inject không được đổi).
        ...(remapSpecifiers(decl.inject, this.dshAliasMap) === undefined ? {} : { inject: remapSpecifiers(decl.inject, this.dshAliasMap) }),
        external: remapSpecifiers(decl.external ?? [], this.dshAliasMap) ?? [],
        immediately: decl.immediately === true,
        aliases: readAliases(located.packageName, (pkg as { gbh?: { row?: { aliases?: unknown; moduleIds?: unknown } } }).gbh?.row?.aliases,
          (pkg as { gbh?: { row?: { moduleIds?: unknown } } }).gbh?.row?.moduleIds),
      },
    };
    this.pkgMeta.set(key, resolved);
    return resolved;
  }

  /**
   * Tìm manifest của package mà Loader mount cho một row. Vị trí module của row là nguồn sự thật:
   * specifier được phân giải qua đúng cơ chế mà nửa node của row đã được import, kể cả hook ESM đang bật.
   * Nhận: specifier của row và base URL của cây sở hữu.
   * Trả: đường dẫn manifest kèm tên package, hoặc undefined khi tên không trỏ tới package root nào.
   */
  private locatePkgJson(loaderName: string, baseUrl: string): { path: string; packageName: string } | undefined {
    if (loaderName.startsWith("cordis:")) return undefined;
    const pathLike = loaderName.startsWith(".") || loaderName.startsWith("file:") || isAbsolute(loaderName);
    const expected = pathLike ? undefined : exactPackageSpecifier(loaderName);
    if (!pathLike && expected === undefined) return undefined;
    const internal = this.loaderInternal();
    if (internal === undefined) {
      if (expected === undefined) {
        const moduleUrl = loaderName.startsWith("file:")
          ? loaderName
          : isAbsolute(loaderName)
            ? pathToFileURL(loaderName).href
            : new URL(loaderName, baseUrl).href;
        return this.nearestPackage(moduleUrl);
      }
      try {
        return { path: createRequire(baseUrl).resolve(expected + "/package.json"), packageName: expected };
      } catch {
        return undefined;
      }
    }
    let moduleUrl: string;
    try {
      moduleUrl =
        internal.version === "v2"
          ? internal.resolveSync(baseUrl, { specifier: loaderName, attributes: {} }).url
          : internal.resolveSync(loaderName, baseUrl, {}).url;
    } catch {
      return undefined;
    }
    return this.nearestPackage(moduleUrl, expected);
  }

  /**
   * Đi lên từ thư mục của module tới manifest gần nhất khai đúng tên package mong đợi.
   * Nhận: URL module và tên package mong đợi (bỏ trống khi row là đường dẫn).
   * Trả: đường dẫn manifest kèm tên, hoặc undefined.
   */
  private nearestPackage(moduleUrl: string, expectedPackageName?: string): { path: string; packageName: string } | undefined {
    if (!moduleUrl.startsWith("file:")) return undefined;
    let dir = dirname(fileURLToPath(moduleUrl));
    for (;;) {
      const candidate = join(dir, "package.json");
      if (existsSync(candidate)) {
        try {
          const name = (JSON.parse(readFileSync(candidate, "utf8")) as { name?: unknown }).name;
          if (typeof name === "string" && (expectedPackageName === undefined || name === expectedPackageName)) {
            return { path: candidate, packageName: name };
          }
        } catch {
          // Manifest hỏng: coi như không có và đi tiếp lên trên.
        }
      }
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }

  /** Khoá nhận dạng một nguồn Loader: cùng một specifier ở hai cây khác nhau là hai nguồn khác nhau. */
  private sourceKey(loaderName: string, baseUrl: string): string {
    return baseUrl + "\0" + loaderName;
  }

  /** Chụp dấu vết bundle TRƯỚC khi đọc byte của nó. */
  private captureArtifactBaseline(clientPath: string): ArtifactBaseline {
    const stat = statSync(clientPath);
    return { path: clientPath, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, size: stat.size };
  }

  /**
   * Đọc ảnh chụp bundle lúc kích hoạt: byte bất biến cộng dấu vết đã chụp trước khi đọc.
   * Nhận: tên package và đường dẫn tuyệt đối của artifact đã build.
   * Trả: byte bundle kèm dấu vết.
   * @throws {MissingClientBundleError} khi đọc gặp ENOENT; mọi lỗi hệ thống tập tin khác được ném nguyên.
   */
  private initialBundleSnapshot(pkgName: string, clientPath: string): { bundle: Buffer; baseline: ArtifactBaseline } {
    try {
      const baseline = this.captureArtifactBaseline(clientPath);
      return { bundle: readFileSync(clientPath), baseline };
    } catch (error) {
      if ((error as { code?: string }).code !== "ENOENT") throw error;
      throw new MissingClientBundleError(pkgName, clientPath, error);
    }
  }

  /**
   * Đối chiếu MỘT tên entry với các nguồn Loader đang sống.
   * Nhận: tên entry và hàm nhận lỗi.
   * Trả: true khi bảng đã đổi (cần dựng lại wire).
   */
  private processOne(entryName: string, onError: (error: Error) => void): boolean {
    const nextSources = new Map<string, PackageSource>();
    for (const entry of this.loaderEntries()) {
      if (entry.options.name !== entryName || entry.fiber === undefined || entry.disabled) continue;
      const source = this.resolveSource(entry);
      if (source !== undefined) nextSources.set(source.sourceKey, source);
    }
    const affected = new Set<string>();
    for (const [sourceKey, source] of [...this.sources]) {
      if (source.loaderName !== entryName) continue;
      affected.add(source.packageName);
      if (!nextSources.has(sourceKey)) this.sources.delete(sourceKey);
    }
    for (const [sourceKey, source] of nextSources) {
      affected.add(source.packageName);
      this.sources.set(sourceKey, source);
    }
    let changed = false;
    for (const packageName of affected) {
      try {
        if (this.reconcilePackage(packageName)) changed = true;
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
    return changed;
  }

  /** Phân giải một row Loader thành nguồn package, hoặc undefined khi row không phải plugin client. */
  private resolveSource(entry: LoaderEntryRow): PackageSource | undefined {
    const loaderName = entry.options.name;
    const baseUrl = entry.parent.tree.ctx.baseUrl;
    if (baseUrl === undefined) throw new Error("client-modules: loader entry " + loaderName + " has no resolution base URL");
    const resolved = this.resolveMeta(loaderName, baseUrl);
    if (resolved === null) return undefined;
    return { ...resolved, loaderName, baseUrl, sourceKey: this.sourceKey(loaderName, baseUrl) };
  }

  /**
   * Đối chiếu một package với bảng: gỡ khi không còn nguồn, chụp byte khi mới hoặc khi nguồn đổi.
   * Hai nguồn đang sống cùng trỏ về một package là lỗi hợp thành (không biết lấy bundle nào).
   * Nhận: tên package.
   * Trả: true khi bảng đã đổi.
   */
  private reconcilePackage(packageName: string): boolean {
    const sources: PackageSource[] = [];
    for (const source of this.sources.values()) if (source.packageName === packageName) sources.push(source);
    if (sources.length > 1) {
      const locations = sources.map((source) => JSON.stringify(source.loaderName) + " from " + source.baseUrl).join(", ");
      throw new Error(
        "client-modules: package " + packageName + " resolves from multiple active Loader sources: " + locations + "; remove one entry",
      );
    }
    const source = sources[0];
    if (source === undefined) return this.table.delete(packageName);
    if (this.table.get(packageName)?.sourceKey === source.sourceKey) return false;
    const snapshot = this.initialBundleSnapshot(packageName, source.meta.clientPath);
    const rev = artifactRevision(snapshot.baseline);
    this.table.set(packageName, {
      entry: graphRow(packageName, rev, source.meta),
      loaderName: source.loaderName,
      sourceKey: source.sourceKey,
      meta: source.meta,
      bundle: snapshot.bundle,
      baseline: snapshot.baseline,
    });
    return true;
  }

  /**
   * Xử lý mọi tên entry đang dirty rồi dựng lại wire nếu bảng đổi.
   * Nhận: hàm nhận lỗi (flush không bao giờ ném ra ngoài).
   * Trả: không.
   */
  private flush(onError: (error: Error) => void): void {
    let changed = false;
    for (const entryName of [...this.dirty]) {
      this.dirty.delete(entryName);
      try {
        if (this.processOne(entryName, onError)) changed = true;
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
    if (!changed) return;
    let composed: WebBootGraph;
    try {
      composed = this.compose();
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    this.composed = composed;
    this.notifyGraphChanged();
  }

  /**
   * Khớp một URL chunk cục bộ ở đúng revision hiện hành mà KHÔNG đọc file.
   * Nhận: URL request đã phân tích.
   * Trả: mô tả chunk khớp, hoặc undefined.
   */
  private chunkRequest(requestUrl: URL): ChunkRequest | undefined {
    const resourceUrl = requestUrl.pathname + requestUrl.search;
    for (const record of this.table.values()) {
      const prefix = PLUGIN_ROUTE + "/" + record.entry.id + "/";
      if (!requestUrl.pathname.startsWith(prefix)) continue;
      const requested = requestUrl.pathname.slice(prefix.length);
      const sourceMap = requested.endsWith(".map");
      const fileName = sourceMap ? requested.slice(0, -4) : requested;
      if (!CLIENT_CHUNK.test(fileName) || fileName === "client.node.js" || fileName.startsWith("client.node.")) return undefined;
      if (resourceUrl !== chunkUrl(record.entry.id, fileName, record.entry.rev, sourceMap)) return undefined;
      return { record, fileName, sourceMap, resourceUrl };
    }
    return undefined;
  }

  /**
   * Dựng phản hồi cho một chunk cục bộ CHỈ khi URL của nó được yêu cầu.
   * Nhận: URL request đã phân tích.
   * Trả: phản hồi đã lên kế hoạch, hoặc undefined khi URL không khớp hoặc file không tồn tại.
   */
  private chunkResponse(requestUrl: URL): BundleResponse | undefined {
    const request = this.chunkRequest(requestUrl);
    if (request === undefined) return undefined;
    const { record, fileName, sourceMap, resourceUrl } = request;
    const clientPath = join(dirname(record.meta.clientPath), fileName);
    if (!existsSync(clientPath)) return undefined;
    const sourceMapUrl = chunkMapReference(fileName, record.entry.rev);
    const resource = async (): Promise<BundleResource> => ({
      id: record.entry.id,
      rev: record.entry.rev,
      clientPath,
      fileName,
      bundle: await readFile(clientPath),
    });
    const response: BundleResponse = sourceMap
      ? { body: lazyBody(async () => buildComboSourceMap([await resource()], fileName)), contentType: MAP_CONTENT_TYPE }
      : { body: lazyBody(async () => buildComboScript([await resource()], sourceMapUrl)), contentType: SCRIPT_CONTENT_TYPE };
    this.responses.set(resourceUrl, response);
    return response;
  }

  /**
   * Phân giải một request `/plugins` thành phản hồi: combo hiện hành, một thế hệ trước đó, hoặc chunk.
   * Nhận: method và URL thô của request.
   * Trả: kết quả kèm trạng thái; `HEAD` không dựng thân.
   */
  private async bundleResource(method: string, url: string): Promise<BundleResult> {
    if (method !== "GET" && method !== "HEAD") return { status: 405 };
    const requestUrl = new URL(url, "http://x");
    const resourceUrl = requestUrl.pathname + requestUrl.search;
    const response = this.responses.get(resourceUrl) ?? this.previousBatchResponses.get(resourceUrl) ?? this.chunkResponse(requestUrl);
    if (response !== undefined) {
      return {
        status: 200,
        headers: { "content-type": response.contentType, "cache-control": IMMUTABLE_CACHE },
        ...(method === "HEAD" ? {} : { body: await response.body() }),
      };
    }
    return { status: 404 };
  }

  /** Handler route `/plugins` của carrier web: chuyển kết quả phân giải thành phản hồi HTTP. */
  private readonly serveBundle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const response = await this.bundleResource(req.method ?? "GET", req.url ?? "/");
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  };
}

/** Export mặc định: row §modules§ mount đúng lớp dịch vụ này (cordis coi class là plugin). */
export default ClientModuleRegistry;

// 08/11/2026 (review R5): mặt công khai của BẢN GỐC có 3 hàm này ở `lib/index.js` +
// `lib/types/index.d.ts` nhưng trước đây ta quên tái xuất ⇒ consumer không thấy. Chỉ TÁI XUẤT,
// không đổi hành vi (3 hàm đã tồn tại trong combos.ts / client/manifest.ts).
export { bootInjections, orderByModuleGraph } from "./combos.ts";
export { stripClientSuffix } from "./client/manifest.ts";