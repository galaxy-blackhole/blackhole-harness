/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ham thuan cho nua node: bam revision, dung URL combo/chunk, xep thu tu do thi va row injection index
 */

import { createHash } from "node:crypto";
import { BOOT_GLOBAL, PACKAGE_NAME } from "./ids.ts";
import { stripClientSuffix } from "./client/manifest.ts";
import { buildComboScript, buildComboSourceMap } from "./sourcemap.ts";

export { stripClientSuffix };

/** Một row injection index mà nửa node đóng góp vào HTML boot (cấu trúc khớp hợp đồng webserver). */
export type InjectionRow =
  | { kind: "global"; name: string; value: unknown }
  | { kind: "script"; placement: "head" | "body"; text: string }
  | { kind: "script-src"; placement: "head" | "body"; src: string }
  | { kind: "script-preload"; src: string };

/** Dấu vết hệ thống tập tin của một bundle, chụp TRƯỚC khi đọc byte của nó. */
export interface ArtifactBaseline {
  /** Đường dẫn tuyệt đối của file bundle. */
  path: string;
  /** mtime (ms). */
  mtimeMs: number;
  /** ctime (ms). */
  ctimeMs: number;
  /** Kích thước byte. */
  size: number;
}

/** Một tài nguyên plugin bất biến (một bundle đã chụp byte) dùng để dựng combo. */
export interface BundleResource {
  /** Id package. */
  id: string;
  /** Revision của bundle. */
  rev: string;
  /** Đường dẫn tuyệt đối của bundle. */
  clientPath: string;
  /** Tên file hiển thị trong nguồn dẫn xuất (thường là `client.js`). */
  fileName: string;
  /** Byte của bundle. */
  bundle: Buffer;
}

/** Một combo đã dựng: URL, revision và hai thân phản hồi sinh lười độc lập với nhau. */
export interface ComboArtifact {
  /** URL tuyệt đối của script combo. */
  url: string;
  /** Revision của combo. */
  rev: string;
  /** Id các entry trong combo, đúng thứ tự. */
  entries: string[];
  /** URL tuyệt đối của source map tương ứng. */
  sourceMapUrl: string;
  /** Sinh thân script ở lần GET đầu tiên. */
  scriptBody: () => Promise<Buffer>;
  /** Sinh thân source map ở lần GET đầu tiên. */
  sourceMapBody: () => Promise<Buffer>;
}

/** Một row của đồ thị boot (dạng wire, JSON thuần). */
export interface GraphRow {
  /** Tên package. */
  id: string;
  /** URL một-plugin, tương đối tài liệu. */
  url: string;
  /** Revision của bundle. */
  rev: string;
  /** Package phải nạp trước. */
  inject?: string[];
  /** Tier nạp ngay. */
  immediately?: boolean;
  /** Yêu cầu module động. */
  external?: string[];
  /** Các id module PHỤ mà bundle của row còn đăng ký (khai ở gbh.row.aliases). */
  aliases?: readonly string[];
}

/** Một batch khởi động (dạng wire). */
export interface BatchRow {
  /** Pha: `bootstrap` chặn parser, `application` chỉ preload. */
  phase: "bootstrap" | "application";
  /** URL combo, tương đối tài liệu. */
  url: string;
  /** Revision của combo. */
  rev: string;
  /** Id các entry trong combo. */
  entries: string[];
}

/** Đồ thị boot đầy đủ phát cho trang. */
export interface WebBootGraph {
  /** Revision của cả đồ thị. */
  rev: string;
  /** Danh tính release của Host. */
  release: { version: string; commit?: string };
  /** Các row plugin. */
  entries: GraphRow[];
  /** Các batch khởi động. */
  batches: BatchRow[];
}

/** Tiền tố route phục vụ mọi tài nguyên plugin. */
export const PLUGIN_ROUTE = "/plugins";
/** Độ dài revision dạng hex. */
const HASH_REVISION_LENGTH = 12;
/** URL combo sinh ra phải nằm dưới giới hạn request-target của trình duyệt và proxy. */
export const MAX_COMBO_URL_BYTES = 3 * 1024;
/** Trần BYTE cho một response batch: gộp quá lớn từng bị cắt và làm kẹt hàng chục entry ở `loading`. */
export const MAX_BATCH_BYTES = 1536 * 1024;
/** Trần SỐ BUNDLE cho một response batch. */
export const MAX_BATCH_BUNDLES = 10;
/** Chỗ giữ revision khi đo độ dài URL combo dự kiến. */
const COMBO_REVISION_PLACEHOLDER = "0".repeat(HASH_REVISION_LENGTH);
/** Package bootstrap: bundle client thường của nó cung cấp chính hệ module. */
export const BOOTSTRAP_ID = PACKAGE_NAME;
/** Chỉ bundle bootstrap thuộc batch chặn parser trước vỏ Vite. */
const PARSER_PRELOAD_IDS: readonly string[] = [BOOTSTRAP_ID];

/**
 * Băm sha1 rút còn 12 ký tự hex.
 * Nhận: văn bản cần băm.
 * Trả: revision dạng hex.
 */
export function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, HASH_REVISION_LENGTH);
}

/**
 * Băm nhiều trường mà không cho byte dịch qua biên trường này sang trường khác.
 * Nhận: miền băm và danh sách trường.
 * Trả: revision dạng hex.
 */
export function framedHash(domain: string, parts: readonly string[]): string {
  const hash = createHash("sha1").update(domain).update("\0");
  for (const part of parts) hash.update(String(Buffer.byteLength(part)) + ":").update(part);
  return hash.digest("hex").slice(0, HASH_REVISION_LENGTH);
}

/**
 * Nhận dạng bản build của một entry từ metadata hệ thống tập tin, KHÔNG băm nội dung.
 * Nhận: dấu vết đã chụp của bundle.
 * Trả: revision dạng hex.
 */
export function artifactRevision(baseline: ArtifactBaseline): string {
  return framedHash("plugin-artifact", [String(baseline.mtimeMs), String(baseline.ctimeMs), String(baseline.size)]);
}

/**
 * Đọc đường dẫn bundle client từ trường `exports` của manifest package.
 * Nhận: tên package (để báo lỗi) và trường `exports` thô.
 * Trả: đường dẫn tương đối của bundle, hoặc undefined khi package không phơi `./client`.
 * @throws khi `exports["./client"]` có mặt nhưng không phải chuỗi hay object có `default` chuỗi.
 */
export function clientExportOf(pkgName: string, exportsField: unknown): string | undefined {
  if (typeof exportsField !== "object" || exportsField === null) return undefined;
  const client = (exportsField as Record<string, unknown>)["./client"];
  if (client === undefined) return undefined;
  if (typeof client === "string") return client;
  if (typeof client === "object" && client !== null) {
    const fallback = (client as Record<string, unknown>).default;
    if (typeof fallback === "string") return fallback;
  }
  throw new Error("client-modules: " + pkgName + ' exports["./client"] must be a string or an object with a string default');
}

/**
 * Query combo trỏ tới một danh sách file plugin có thứ tự.
 * Nhận: danh sách id theo thứ tự, revision, và cờ xin dạng §.map§.
 * Trả: query §??a/client.js,b/client.js&rev=…§.
 */
export function comboSearch(ids: readonly string[], rev: string, sourceMap = false): string {
  return "??" + ids.map((id) => id + "/client.js" + (sourceMap ? ".map" : "")).join(",") + "&rev=" + rev;
}

/**
 * URL tuyệt đối của một tài nguyên combo.
 * Nhận: danh sách id, revision và cờ source map.
 * Trả: URL tuyệt đối (có dấu / đầu) để đăng ký route.
 */
export function comboUrl(ids: readonly string[], rev: string, sourceMap = false): string {
  return PLUGIN_ROUTE + "/" + comboSearch(ids, rev, sourceMap);
}

/**
 * Tham chiếu combo phía browser: route do app sở hữu là tương đối tài liệu, nên bỏ dấu / đầu ở đúng
 * biên giữa hai nửa.
 * Nhận: danh sách id, revision, và cờ source map.
 * Trả: URL tương đối tài liệu.
 */
export function comboReference(ids: readonly string[], rev: string, sourceMap = false): string {
  return comboUrl(ids, rev, sourceMap).slice(1);
}

/**
 * URL tuyệt đối của một chunk cục bộ trong package.
 * Nhận: id package, tên file chunk, revision và cờ xin dạng §.map§.
 * Trả: URL tuyệt đối của chunk.
 */
export function chunkUrl(id: string, fileName: string, rev: string, sourceMap = false): string {
  return PLUGIN_ROUTE + "/" + id + "/" + fileName + (sourceMap ? ".map" : "") + "?rev=" + rev;
}

/**
 * Tham chiếu source map đóng vào thân một chunk: nó phân giải theo thư mục của chính script đó, nên
 * là tên file trần chứ không phải route tương đối tài liệu.
 */
export function chunkMapReference(fileName: string, rev: string): string {
  return fileName + ".map?rev=" + rev;
}

/** Đo URL combo dài nhất mà trình duyệt sẽ thấy khi chia một danh sách tài nguyên khởi động. */
export function projectedComboUrlBytes(ids: readonly string[]): number {
  return Buffer.byteLength(comboReference(ids, COMBO_REVISION_PLACEHOLDER, true));
}

/**
 * Chia một pha thành các combo mà không URL nào vượt giới hạn giao thức, giữ nguyên thứ tự đồ thị.
 * Nhận: danh sách id theo thứ tự đồ thị.
 * Trả: các nhóm id liên tiếp.
 * @throws khi một id đơn lẻ đã vượt giới hạn.
 */
export function partitionComboIds(ids: readonly string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const id of ids) {
    const candidate = [...current, id];
    if (projectedComboUrlBytes(candidate) <= MAX_COMBO_URL_BYTES) {
      current = candidate;
      continue;
    }
    if (current.length === 0) throw new Error("client-modules: " + id + " exceeds the " + String(MAX_COMBO_URL_BYTES) + "-byte combo URL limit");
    chunks.push(current);
    current = [id];
    if (projectedComboUrlBytes(current) > MAX_COMBO_URL_BYTES) {
      throw new Error("client-modules: " + id + " exceeds the " + String(MAX_COMBO_URL_BYTES) + "-byte combo URL limit");
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Suy MỘT revision combo từ các revision row có thứ tự.
 * Nhận: các tài nguyên (id + revision) của combo.
 * Trả: revision 12 hex đại diện cho cả combo.
 */
export function comboRevision(resources: readonly BundleResource[]): string {
  return framedHash(
    "combo",
    resources.flatMap((resource) => [resource.id, resource.rev]),
  );
}

/**
 * Row đồ thị cho một bundle: URL một-plugin mang revision làm query chống cache.
 * Nhận: id, revision và các trường tuỳ chọn của package.
 * Trả: row wire.
 */
export function graphRow(
  id: string,
  rev: string,
  fields: { inject?: readonly string[]; external: readonly string[]; immediately: boolean; aliases?: readonly string[] },
): GraphRow {
  return {
    id,
    url: comboReference([id], rev),
    rev,
    ...(fields.inject === undefined ? {} : { inject: [...fields.inject] }),
    ...(fields.immediately ? { immediately: true } : {}),
    ...(fields.external.length > 0 ? { external: [...fields.external] } : {}),
    ...(fields.aliases === undefined || fields.aliases.length === 0 ? {} : { aliases: [...fields.aliases] }),
  };
}

/**
 * Xếp lại các row sao cho mọi package được yêu cầu động đứng TRƯỚC consumer của nó.
 * Một specifier `external` hoặc là row của chính package đó (`<pkg>/client` là bí danh của tên trần),
 * hoặc là tên trong bảng nền tảng tĩnh (không thêm cạnh nào). Chu trình qua `inject` KHÔNG tính: đó là
 * quan hệ service của Loader, và đồ thị thật của DSH có đúng hai chu trình như vậy — bộ nạp phải chịu
 * được chúng. Chỉ chu trình qua `external` mới chặn được, vì CJS dạng factory không giao export dở dang.
 * Nhận: các row theo thứ tự quét.
 * Trả: chính các row đó đã xếp lại; thứ tự quét phá mọi thế hoà.
 * @throws khi một row tự yêu cầu chính nó, hoặc khi đồ thị module có chu trình.
 */
/**
 * Sinh entry wire PHỤ cho các id alias của một row.
 *
 * Khi ta thay một row, entry id STOCK biến mất khỏi đồ thị — nhưng các entry stock khác vẫn `inject` id đó
 * nên chúng chờ mãi (treo `loading`). Phát thêm MỘT entry cho mỗi id alias, dùng **đúng URL và rev của row
 * sở hữu**, giải được thế kẹt mà KHÔNG nạp bundle lần thứ hai: cùng một URL ⇒ cùng một file ⇒ bundle chạy
 * đúng một lần (bundle tự đăng ký cả id của nó lẫn id alias).
 * Nhận: entry của row sở hữu (đã có `aliases`).
 * Trả: các entry phụ, rỗng khi row không khai alias.
 */
export function aliasRows(entry: GraphRow): GraphRow[] {
  const aliases = entry.aliases ?? [];
  // ⚠️ 08/11/2026 — TẮT sinh entry alias (SỰ CỐ THẬT đo trên app): entry alias dùng CÙNG URL của row, nên
  // bundle chỉ được nạp một lần và ĐĂNG KÝ ĐÚNG id của nó; entry alias vì thế KHÔNG BAO GIỜ materialize ⇒
  // "web boot: N entries did not activate … import failed". Tệ hơn: cùng một plugin bị ÁP DỤNG HAI LẦN qua
  // hai entry ⇒ "locale namespace … already has locale vi" (register ném) ⇒ hỏng cả app.
  // Muốn bật lại alias cho đúng thì phải đổi CƠ CHẾ: hoặc bundle tự đăng ký thêm id alias (và tầng nạp phải
  // chịu được hai lời gọi load trong MỘT lần nạp), hoặc alias phải trỏ URL riêng. Chưa làm được trong phiên
  // này — xem docs/GBH-P4-DIEU-TRA-TERMINAL.md §9. Trong khi đó trả về RỖNG: hành vi bằng đúng bản đang chạy
  // tốt trước 08/11 (không có entry alias nào trong manifest).
  void aliases;
  return [];
}

/**
 * Xếp lại các row sao cho mọi package được yêu cầu động đứng TRƯỚC consumer của nó (chỉ tính cạnh `external`).
 * Nhận: các row wire theo thứ tự quét.
 * Trả: chính các row đó đã xếp lại.
 * @throws khi một row tự yêu cầu chính nó, hoặc khi đồ thị module có chu trình qua `external`.
 */
export function orderByModuleGraph(rows: readonly GraphRow[]): GraphRow[] {
  const rowsById = new Map<string, GraphRow>();
  for (const row of rows) rowsById.set(row.id, row);
  const ordered: GraphRow[] = [];
  const placed = new Set<string>();
  const open: string[] = [];
  const visit = (row: GraphRow): void => {
    if (placed.has(row.id)) return;
    const cycleStart = open.indexOf(row.id);
    if (cycleStart !== -1) {
      throw new Error(
        "client-modules: module graph cycle " +
          [...open.slice(cycleStart), row.id].join(" -> ") +
          " — a requested package row must precede its consumers, and factory-form CJS cannot deliver partial exports",
      );
    }
    open.push(row.id);
    for (const name of row.external ?? []) {
      const dependency = rowsById.get(name) ?? rowsById.get(stripClientSuffix(name));
      if (dependency === row) {
        throw new Error(
          'client-modules: "' + row.id + '" requests module "' + name + '" that it answers itself — a row must not declare its own package in dsh.client.external',
        );
      }
      if (dependency !== undefined) visit(dependency);
    }
    open.pop();
    placed.add(row.id);
    ordered.push(row);
  };
  for (const row of rows) visit(row);
  return ordered;
}

/**
 * Giao thức boot dưới dạng các row injection index, theo đúng thứ tự thực thi.
 * THỨ TỰ LÀ HỢP ĐỒNG: hai row INLINE (hàng đợi facade, global payload) đứng TRƯỚC mọi `<script src>` vì thẻ src
 * chặn parser và chạy bundle ngay — thiếu facade thì bundle không đăng ký được, thiếu global thì bundle ném
 * `__GBH_BOOT__ is missing or not an object`. Sau đó mới tới preload application và script bootstrap.
 * Nhận: đồ thị đã dựng.
 * Trả: các row head theo thứ tự: script hàng đợi → global payload → preload application → script bootstrap.
 */
export function bootInjections(graph: WebBootGraph): InjectionRow[] {
  const bootstrap = graph.batches.filter((batch) => batch.phase === "bootstrap");
  const application = graph.batches.filter((batch) => batch.phase === "application");
  // 19/10/2026 — SỰ CỐ THẬT (app còn 331 ký tự) + CÁCH SỬA ĐÚNG: MỌI row INLINE phải đứng TRƯỚC mọi `<script src>`,
  //   vì `<script src>` chặn parser và chạy bundle ngay:
  //   (1) hàng đợi facade cài `window.__ModuleLoader__` — thiếu nó thì bundle không đăng ký được;
  //   (2) global `__GBH_BOOT__` (payload đồ thị) — bundle đọc nó lúc parse; phát sau ⇒
  //       `window.__GBH_BOOT__ is missing or not an object` ⇒ trang trắng.
  //   Trước 19/10 thứ tự này SAI thật (global đứng CUỐI, sau `<script src>` của batch bootstrap) nhưng bị che bởi
  //   một dòng alias; khi bỏ alias (task-137) lỗi lộ ra ⇒ nay đưa cả hai row inline lên ĐẦU, giữ nguyên thứ tự nội bộ.
  const rows: InjectionRow[] = [
    { kind: "script", placement: "head", text: queueFacadeSource() },
    { kind: "global", name: BOOT_GLOBAL, value: graph },
    // 19/10/2026 — PHẢI GIỮ alias: vỏ SPA STOCK (`dsh-web-frontend/dist/assets/index-*.js`, gói dist-only 0 dòng code)
    // gọi `r.create({ boot: t.__GBH_BOOT__ , … })` ⇒ bỏ alias thì app đỏ ngay (`__GBH_BOOT__ is missing or not an object`).
    // Đo được: asset có ĐÚNG 1 lần `__GBH_BOOT__`, 0 lần `__GBH_BOOT__`. Việc đổi tên thuộc task-141 (brand rename ở
    // build-time cho CẢ producer + consumer, gồm cả dist-only package) — KHÔNG bỏ alias trước khi rename xong vỏ.
    // 20/10/2026: alias ĐÃ GỠ (vỏ SPA của ta đọc `__GBH_BOOT__`); dòng script rỗng còn lại đã xoá để
    // không làm lệch thứ tự batch (lỗi "factory threw: __GBH_..._CSS__ is not defined" khi CSS chunk bị bỏ).
  ];
  for (const batch of application) rows.push({ kind: "script-preload", src: batch.url });
  for (const batch of bootstrap) rows.push({ kind: "script-src", placement: "head", src: batch.url });
  return rows;
}

/**
 * Đoạn facade cài `window.__ModuleLoader__` trước mọi bundle plugin.
 * Bốn thông điệp lỗi ở đây là MỘT PHẦN của hợp đồng C2 (đóng băng ở tests/contract/fixtures/c2-module-loader.js):
 * plugin ngoài và log lỗi dựa vào chúng, nên chỉ được đổi khi cập nhật cả fixture.
 * Nhận: không.
 * Trả: mã nguồn JS của facade.
 */
export function queueFacadeSource(): string {
  const id = JSON.stringify(PACKAGE_NAME);
  return [
    "(()=>{",
    "const pendingQueue=[]",
    "window.__ModuleLoader__={",
    '  mode:"queue",',
    "  pendingQueue,",
    "  load(registration){pendingQueue.push(registration)},",
    "  create(options){",
    '    if(this.mode!=="queue")throw new Error("client-modules: window.__ModuleLoader__.create called after module-system boot")',
    "    const index=pendingQueue.findIndex(registration=>registration.id===" + id + ")",
    "    const registration=pendingQueue[index]",
    "    if(registration===undefined)throw new Error(" + JSON.stringify("client-modules: HTML did not preload " + PACKAGE_NAME + "/client.js") + ")",
    "    pendingQueue.splice(index,1)",
    "    const exports=registration.factory(specifier=>{",
    '      throw new Error("client-modules: " + ' + id + ' + "/client.js requested external " + JSON.stringify(specifier) + " before the module system existed")',
    "    })",
    '    if(typeof exports!=="object"||exports===null||typeof exports.createClientModuleSystem!=="function"||typeof exports.apply!=="function"){',
    "      throw new Error(" + JSON.stringify("client-modules: " + PACKAGE_NAME + "/client.js did not export the bootstrap module face") + ")",
    "    }",
    "    return exports.createClientModuleSystem(this,{id:registration.id,exports},options)",
    "  }",
    "}",
    "})()",
  ].join("\n");
}

/**
 * Dựng một combo từ các tài nguyên đã chụp byte.
 * Nhận: tài nguyên, hàm đọc source map (lười, chỉ đọc khi thân map được yêu cầu) và revision tuỳ chọn.
 * Trả: combo với hai thân phản hồi sinh lười độc lập.
 */
export function buildCombo(resources: readonly BundleResource[], revision?: string): ComboArtifact {
  const rev = revision ?? comboRevision(resources);
  const entries = resources.map((resource) => resource.id);
  return {
    url: comboUrl(entries, rev),
    rev,
    entries,
    sourceMapUrl: comboUrl(entries, rev, true),
    scriptBody: lazyBody(async () => buildComboScript(resources, comboSearch(entries, rev, true))),
    sourceMapBody: lazyBody(async () => buildComboSourceMap(resources)),
  };
}

/**
 * Thêm metadata lập lịch cho artifact khởi động.
 * Nhận: pha, tài nguyên của batch.
 * Trả: combo kèm descriptor mà đồ thị wire dùng.
 */
export function buildBatch(phase: "bootstrap" | "application", resources: readonly BundleResource[]): ComboArtifact & { descriptor: BatchRow } {
  const artifact = buildCombo(resources);
  return {
    ...artifact,
    descriptor: { phase, url: artifact.url.slice(1), rev: artifact.rev, entries: artifact.entries },
  };
}

/** Chia tài nguyên bootstrap và application rồi dựng batch cho từng nhóm, theo đúng thứ tự pha. */
export function buildBatches(records: readonly BundleResource[]): (ComboArtifact & { descriptor: BatchRow })[] {
  const bootstrapIds = new Set(PARSER_PRELOAD_IDS);
  const bootstrap = records.filter((record) => bootstrapIds.has(record.id));
  const rest = records.filter((record) => !bootstrapIds.has(record.id));
  const artifacts: (ComboArtifact & { descriptor: BatchRow })[] = [];
  // CẢ HAI nhánh đều phải đi qua ngân sách: `.flat()` ở đây từng gộp các chunk lại ⇒ trần bị vô hiệu.
  for (const chunk of chunkByBudget(bootstrap, records)) {
    for (const group of partitionComboIds(chunk)) {
      artifacts.push(buildBatch("bootstrap", group.map((id) => recordOf(records, id))));
    }
  }
  for (const group of chunkByBudget(rest, records)) {
    for (const part of partitionComboIds(group)) {
      artifacts.push(buildBatch("application", part.map((id) => recordOf(records, id))));
    }
  }
  return artifacts;
}

/**
 * Chia danh sách bundle thành các nhóm vừa NGÂN SÁCH tải: mỗi request không quá MAX_BATCH_BYTES byte
 * và không quá MAX_BATCH_BUNDLES bundle.
 * Vì sao: gộp 55 bundle vào một response ~9,7 MB đã bị cắt (`ERR_INCOMPLETE_CHUNKED_ENCODING`) ⇒ đuôi script
 * không bao giờ chạy ⇒ hàng chục entry kẹt `loading` vĩnh viễn. Một batch nhỏ hỏng chỉ kéo theo chính nó.
 * Nhận: các record cần chia và toàn bộ record (để tra kích thước).
 * Trả: các nhóm id, mỗi nhóm trong ngân sách.
 */
function chunkByBudget(group: readonly BundleResource[], records: readonly BundleResource[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let bytes = 0;
  for (const record of group) {
    const size = recordOf(records, record.id).bundle.length;
    if (current.length > 0 && (bytes + size > MAX_BATCH_BYTES || current.length >= MAX_BATCH_BUNDLES)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(record.id);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Lấy tài nguyên theo id trong danh sách đã có (đã kiểm sự tồn tại ở nơi gọi). */
function recordOf(records: readonly BundleResource[], id: string): BundleResource {
  const found = records.find((record) => record.id === id);
  if (found === undefined) throw new Error('client-modules: no bundle record for "' + id + '"');
  return found;
}

/**
 * Chia sẻ kết quả một producer: chạy ở microtask của người yêu cầu đầu tiên, và một lần chạy hỏng thì
 * bị bỏ sau khi settle để lần sau sản xuất lại.
 * Nhận: hàm sản xuất bất đồng bộ.
 * Trả: hàm trả cùng một promise cho mọi lời gọi.
 */
export function lazyBody(produce: () => Promise<Buffer>): () => Promise<Buffer> {
  let result: Promise<Buffer> | undefined;
  return () => {
    result ??= Promise.resolve()
      .then(produce)
      .catch((error: unknown) => {
        result = undefined;
        throw error;
      });
    return result;
  };
}