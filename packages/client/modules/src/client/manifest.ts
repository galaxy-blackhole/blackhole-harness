/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Mat hop dong phia browser cua bo nap module: kieu du lieu wire __GBH_BOOT__ va bo phan tich manifest
 */

/** Một dòng entry trong đồ thị boot `__GBH_BOOT__` (alias __GBH_BOOT__) (dữ liệu JSON thuần). */
export interface BootEntryWire {
  /** Tên package — cũng là id của module trong bảng module. */
  id: string;
  /** URL tài nguyên một-plugin (đường dẫn tương đối tài liệu). */
  url: string;
  /** Revision bất biến của bundle. */
  rev: string;
  /** Các package phải nạp trước (thứ tự plugin của Loader). */
  inject?: string[];
  /** Tier nạp ngay khi boot. */
  immediately?: boolean;
  /** Các yêu cầu module động (subpath `<pkg>/client`). */
  external?: string[];
  /** Các id module PHỤ mà bundle của row này còn đăng ký (khai ở `gbh.row.aliases`). */
  aliases?: string[];
}

/** Một batch tài nguyên khởi động: nhiều plugin gộp trong MỘT script. */
export interface BootBatchWire {
  /** Pha khởi động: `bootstrap` chạy chặn parser, `application` chỉ preload. */
  phase: "bootstrap" | "application";
  /** URL combo (đường dẫn tương đối tài liệu). */
  url: string;
  /** Revision của combo. */
  rev: string;
  /** Id các entry trong combo, đúng thứ tự trong script. */
  entries: string[];
}

/** Danh tính release của Host mà trang đang nói chuyện. */
export interface BootReleaseWire {
  /** Phiên bản của Host phát đồ thị. */
  version: string;
  /** Commit nguồn mà artifact client đã đóng vào (có thể thiếu). */
  commit?: string;
}

/** Đồ thị boot đầy đủ — nguồn duy nhất cho mọi thứ trang nạp. */
export interface BootGraphWire {
  /** Revision của cả đồ thị. */
  rev: string;
  /** Danh tính release (có thể thiếu ở đồ thị cũ). */
  release?: BootReleaseWire;
  /** Các dòng plugin. */
  entries: BootEntryWire[];
  /** Các batch khởi động. */
  batches: BootBatchWire[];
}

/** Một dòng module đã chuẩn hoá, kèm URL của batch mà nó thuộc về. */
export interface ClientModuleRow {
  /** Tên package. */
  id: string;
  /** URL tài nguyên một-plugin. */
  url: string;
  /** Revision của bundle. */
  rev: string;
  /** Package phải nạp trước. */
  inject: string[];
  /** Yêu cầu module động của bundle này. */
  external: string[];
  /** Id module phụ mà bundle này còn đăng ký (mặc định rỗng). */
  aliases: string[];
  /** URL batch mà dòng này được nạp lần đầu. */
  initialUrl: string;
}

/** Một entry plugin (góc nhìn của Loader) sau khi chuẩn hoá. */
export interface ClientPluginRow {
  /** Tên package, dùng làm name của entry Loader. */
  id: string;
  /** Package phải nạp trước. */
  inject: string[];
  /** Thuộc tier nạp ngay. */
  immediately: boolean;
}

/** Manifest đã chuẩn hoá mà hệ module làm việc trên đó. */
export interface BootManifest {
  /** Revision của đồ thị. */
  rev: string;
  /** Danh tính release, nếu wire có. */
  release?: BootReleaseWire;
  /** Các dòng module (đã biết batch đầu tiên của từng dòng). */
  modules: ClientModuleRow[];
  /** Các entry plugin. */
  plugins: ClientPluginRow[];
}

/** Khai báo `dsh.client` của một package, đã validate. */
export interface DshClientDeclaration {
  /** Nền tảng bundle: chỉ `web` mới vào đồ thị. */
  platform: string;
  /** Package phải nạp trước. */
  inject?: string[];
  /** Yêu cầu module động ngoài bảng nền tảng. */
  external?: string[];
  /** Tier nạp ngay khi boot. */
  immediately?: boolean;
}

/** `require` đồng bộ cấp cho factory, kèm nhánh `require.async` cho chunk của chính package. */
export interface ClientRequire {
  /**
   * Lấy export của một specifier đã có mặt trong bảng module.
   * Nhận: specifier là tên package hoặc seed word của bảng nền tảng.
   * Trả: export của module tương ứng.
   */
  (specifier: string): unknown;
  /**
   * Nạp bất đồng bộ một specifier: chunk cục bộ `./client.<ten>.js` hoặc một package trong đồ thị.
   * Nhận: specifier cần nạp.
   * Trả: export của module sau khi nạp xong.
   */
  async(specifier: string): Promise<unknown>;
}

/** Một đăng ký bundle do script nạp vào bảng module. */
export interface ClientModuleRegistration {
  /** URL của thẻ script gọi `load` (nguồn), để phân biệt chạy lại cùng bundle với trùng thật. */
  sourceUrl?: string;
  /** Tên package sở hữu script. */
  id: string;
  /** Hàm dựng export, chạy lười ở lần vạt chất hoá đầu tiên. */
  factory: (require: ClientRequire) => unknown;
  /** Tên file chunk cục bộ của package, khi script là một chunk chứ không phải bundle chính. */
  chunk?: string;
}

/** Bản ghi module đã vạt chất hoá (được memoize theo id). */
export interface ClientModuleRecord {
  /** Id trong bảng module. */
  id: string;
  /** Export đã dựng. */
  exports: unknown;
  /** Các thẻ style mà factory này sở hữu (để HMR dọn). */
  styles: string[];
  /** Các specifier mà factory đã require (để tính tập module còn cần). */
  edges: Set<string>;
}

/**
 * Validate một trường mảng chuỗi tuỳ chọn đọc từ khai báo `dsh.client` hoặc từ wire boot.
 * Nhận: subject là tiền tố chẩn đoán, field là tên trường, value là giá trị thô.
 * Trả: mảng đã validate, hoặc undefined khi trường vắng mặt.
 * @throws khi trường có mặt nhưng không phải mảng chuỗi.
 */
export function optionalStringArray(subject: string, field: string, value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("client-modules: " + subject + " " + field + " must be a string array");
  }
  return value as string[];
}

/**
 * Thu hẹp một giá trị JSON chưa biết thành khai báo `dsh.client`.
 * Nhận: pkgName làm tiền tố chẩn đoán và value là trường `dsh.client` thô của manifest package.
 * Trả: khai báo đã validate, hoặc undefined khi trường vắng mặt.
 * @throws khi trường có mặt nhưng thành viên nào đó sai hình dạng.
 */
export function parseDshClient(pkgName: string, value: unknown): DshClientDeclaration | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null) {
    throw new Error("client-modules: " + pkgName + " has a non-object dsh.client declaration");
  }
  const decl = value as Record<string, unknown>;
  if (typeof decl.platform !== "string") {
    throw new Error("client-modules: " + pkgName + " dsh.client.platform must be a string");
  }
  const inject = optionalStringArray(pkgName, "dsh.client.inject", decl.inject);
  const external = optionalStringArray(pkgName, "dsh.client.external", decl.external);
  if (decl.immediately !== undefined && typeof decl.immediately !== "boolean") {
    throw new Error("client-modules: " + pkgName + " dsh.client.immediately must be a boolean");
  }
  return {
    platform: decl.platform,
    ...(inject === undefined ? {} : { inject }),
    ...(external === undefined ? {} : { external }),
    ...(decl.immediately === undefined ? {} : { immediately: decl.immediately }),
  };
}

/**
 * Bỏ hậu tố `/client` của một specifier.
 * Bundle của plugin CHÍNH LÀ nửa client của package đó, nên `<id>/client` và tên package trần phải
 * trỏ về cùng một module.
 * Nhận: specifier như bundle require hoặc như khai báo viết.
 * Trả: specifier đã bỏ hậu tố `/client`.
 */
export function stripClientSuffix(spec: string): string {
  return spec.endsWith("/client") ? spec.slice(0, -7) : spec;
}

/**
 * Tên package trần mà một specifier của Loader trỏ tới.
 * Nhận: specifier là tên row của Loader.
 * Trả: tên package, hoặc undefined với subpath, đường dẫn, hay specifier có scheme (`cordis:`, `node:`).
 */
export function exactPackageSpecifier(specifier: string): string | undefined {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length === 2 && parts.every(Boolean) ? specifier : undefined;
  }
  return specifier.length > 0 && !specifier.includes("/") && !specifier.includes(":") ? specifier : undefined;
}

/**
 * Đọc danh tính release từ wire, bỏ mọi thành viên nằm ngoài hợp đồng.
 * Nhận: giá trị release của đồ thị.
 * Trả: release đã chuẩn hoá; undefined khi vắng mặt; null khi có mặt nhưng sai hình dạng.
 */
export function decodeRelease(value: unknown): BootReleaseWire | undefined | null {
  if (value === undefined) return undefined;
  const release = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
  const commit = release?.commit;
  if (release === undefined || typeof release.version !== "string" || (commit !== undefined && typeof commit !== "string")) {
    return null;
  }
  return { version: release.version, ...(commit === undefined ? {} : { commit }) };
}

/**
 * Đọc release của một đồ thị Host mà KHÔNG validate phần còn lại, để so sánh được cả khi định dạng
 * đồ thị của một release khác đã đổi.
 * Nhận: đồ thị đã giải mã JSON từ Host.
 * Trả: release, hoặc undefined khi không đọc được.
 */
export function readRelease(wire: unknown): BootReleaseWire | undefined {
  if (typeof wire !== "object" || wire === null) return undefined;
  return decodeRelease((wire as Record<string, unknown>).release) ?? undefined;
}

/**
 * Hai release có phải cùng một danh tính: cùng vắng, hoặc bằng nhau ở mọi trường.
 * Nhận: hai release cần so.
 * Trả: true khi chúng giống nhau.
 */
export function sameRelease(left: BootReleaseWire | undefined, right: BootReleaseWire | undefined): boolean {
  return left?.version === right?.version && left?.commit === right?.commit;
}

/**
 * Danh tính release dưới dạng văn bản chẩn đoán.
 * Nhận: release, có thể undefined.
 * Trả: chuỗi mô tả.
 */
export function describeRelease(release: BootReleaseWire | undefined): string {
  return release === undefined ? "none" : JSON.stringify(release);
}

/**
 * Phân tích `window.__GBH_BOOT__` thành hai góc nhìn cho consumer.
 * Biên wire: đồ thị thiếu hoặc sai hình dạng thì ném lỗi to (trang không có manifest hợp lệ thì
 * không boot được gì cả), chứ không đoán.
 * Nhận: giá trị thô `window.__GBH_BOOT__`.
 * Trả: manifest đã chuẩn hoá, mỗi dòng module biết batch đầu tiên của nó.
 * @throws khi wire thiếu, sai kiểu, trùng id, hoặc có dòng không thuộc batch nào.
 */
export function parseBootManifest(wire: unknown): BootManifest {
  // 09/11/2026 (Lead): shell dist cũ gọi create() KHÔNG kèm `boot` ⇒ wire undefined dù global đã có payload
  // (đo được: HTML đặt globalThis["__GBH_BOOT__"] TRƯỚC mọi <script src>, nhưng parseBootManifest nhận undefined)
  // ⇒ đọc lại global CHÍNH trước khi ném lỗi, để hai thế hệ shell/module cùng chạy được. Không đổi hợp đồng.
  const doc = wire === undefined || wire === null ? (globalThis as Record<string, unknown>).__GBH_BOOT__ : wire;
  if (typeof doc !== "object" || doc === null) {
    // 19/10/2026 (task-137): alias __GBH_BOOT__ đã bỏ ⇒ thông điệp chỉ nhắc global CHÍNH (mục tiêu 0 chuỗi DSH).
    throw new Error("client-modules: window.__GBH_BOOT__ is missing or not an object");
  }
  const graph = doc as Record<string, unknown>;
  if (typeof graph.rev !== "string") throw new Error("client-modules: boot manifest rev must be a string");
  const release = decodeRelease(graph.release);
  if (release === null) {
    throw new Error("client-modules: boot manifest release must carry a string version and an optional string commit");
  }
  if (!Array.isArray(graph.entries)) throw new Error("client-modules: boot manifest entries must be an array");
  if (!Array.isArray(graph.batches)) throw new Error("client-modules: boot manifest batches must be an array");
  const moduleFields: Omit<ClientModuleRow, "initialUrl">[] = [];
  const plugins: ClientPluginRow[] = [];
  const seen = new Set<string>();
  for (const raw of graph.entries as unknown[]) {
    if (typeof raw !== "object" || raw === null) throw new Error("client-modules: boot manifest entry is not an object");
    const row = raw as Record<string, unknown>;
    const where = typeof row.id === "string" ? '"' + row.id + '"' : JSON.stringify(row);
    if (typeof row.id !== "string" || typeof row.url !== "string" || typeof row.rev !== "string") {
      throw new Error("client-modules: boot manifest entry " + where + " must carry string id/url/rev");
    }
    if (seen.has(row.id)) throw new Error('client-modules: duplicate graph entry "' + row.id + '"');
    seen.add(row.id);
    const subject = "boot manifest entry " + where;
    const inject = optionalStringArray(subject, "inject", row.inject);
    const external = optionalStringArray(subject, "external", row.external);
    const aliases = optionalStringArray(subject, "aliases", row.aliases);
    if (row.immediately !== undefined && typeof row.immediately !== "boolean") {
      throw new Error("client-modules: boot manifest entry " + where + " immediately must be a boolean");
    }
    moduleFields.push({
      id: row.id,
      url: row.url,
      rev: row.rev,
      inject: inject === undefined ? [] : [...inject],
      external: external === undefined ? [] : [...external],
      aliases: aliases === undefined ? [] : [...aliases],
    });
    plugins.push({ id: row.id, inject: inject === undefined ? [] : [...inject], immediately: row.immediately === true });
  }
  const entryIds = new Set(moduleFields.map((row) => row.id));
  const initialUrls = new Map<string, string>();
  const batchUrls = new Set<string>();
  for (const raw of graph.batches as unknown[]) {
    if (typeof raw !== "object" || raw === null) throw new Error("client-modules: boot manifest batch is not an object");
    const batch = raw as Record<string, unknown>;
    const phase = batch.phase;
    if (phase !== "bootstrap" && phase !== "application") {
      throw new Error('client-modules: boot manifest batch phase must be "bootstrap" or "application", received ' + JSON.stringify(phase));
    }
    if (typeof batch.url !== "string" || typeof batch.rev !== "string") {
      throw new Error("client-modules: boot manifest " + phase + " batch must carry string url/rev");
    }
    if (batchUrls.has(batch.url)) {
      throw new Error("client-modules: boot manifest carries duplicate batch URL " + JSON.stringify(batch.url));
    }
    batchUrls.add(batch.url);
    const entries = optionalStringArray("boot manifest " + phase + " batch", "entries", batch.entries);
    if (entries === undefined || entries.length === 0) {
      throw new Error("client-modules: boot manifest " + phase + " batch entries must be a non-empty string array");
    }
    for (const id of entries) {
      if (!entryIds.has(id)) throw new Error('client-modules: boot manifest ' + phase + ' batch names unknown entry "' + id + '"');
      if (initialUrls.has(id)) throw new Error('client-modules: boot manifest entry "' + id + '" belongs to more than one batch');
      initialUrls.set(id, batch.url);
    }
  }
  const modules = moduleFields.map((row) => {
    // KHOAN DUNG: một entry không nằm trong batch nào KHÔNG được làm sập cả manifest (đã từng làm trắng UI).
    // Nó vẫn có URL của chính nó ⇒ bộ nạp tải theo yêu cầu khi có ai đó cần id đó.
    const initialUrl = initialUrls.get(row.id) ?? row.url;
    return { ...row, initialUrl };
  });
  return { rev: graph.rev, ...(release === undefined ? {} : { release }), modules, plugins };
}
