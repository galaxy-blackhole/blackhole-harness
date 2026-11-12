/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Bang lazy-CJS phia browser: nạp, vat chat hoa va vo hieu hoa module cua cac bundle plugin
 */

import {
  parseBootManifest,
  stripClientSuffix,
  type BootManifest,
  type ClientModuleRecord,
  type ClientModuleRegistration,
  type ClientModuleRow,
  type ClientRequire,
} from "./manifest.ts";
import { ClientEntries, removeOwnedStyles } from "./entries.ts";
// 09/11/2026 — Bảng alias seed nền tảng (id STOCK của vỏ SPA ↔ id GBH của bundle ta). Xem đầu tệp
// `platform-seeds.ts`: app 5439 đang được phục vụ bởi vỏ STOCK nên seed chỉ có khoá stock, còn bundle
// của ta require khoá GBH ⇒ tra seed trượt ⇒ factory ui-renderer chết.
import { seedAliasOf } from "./platform-seeds.ts";

/** Một bộ nạp script: trả về khi script đã chạy xong, ném lỗi khi tải hỏng. */
export type LoadBundle = (url: string) => Promise<void>;

/** Bề mặt đăng ký mà facade HTML để lại cho hệ module thật tiếp quản. */

/**
 * Bọc export cho một id ALIAS: giữ nguyên mọi trường, chỉ vô hiệu hoá `apply`.
 * Nhận: export thật của bundle sở hữu.
 * Trả: bản sao dùng được cho consumer, nhưng không cài plugin lần thứ hai.
 */
function aliasExports(exports: unknown): unknown {
  if (typeof exports !== "object" || exports === null) return exports;
  return { ...(exports as Record<string, unknown>), apply: () => undefined };
}


/**
 * URL của thẻ script đang thực thi (nguồn của một lời gọi `load`).
 * Nhận: không.
 * Trả: URL nguồn, hoặc undefined khi không đọc được (eval, worker, môi trường test).
 */
function currentScriptUrl(): string | undefined {
  const script = (globalThis as { document?: { currentScript?: { src?: string } | null } }).document?.currentScript;
  return typeof script?.src === "string" && script.src !== "" ? script.src : undefined;
}

/** Cache bọc `apply`: giữ NGUYÊN identity giữa các lời gọi để vỏ không thấy hai đối tượng khác nhau. */
const applyLogCache = new WeakMap<object, object>();

/**
 * Bọc `apply` của một plugin để lỗi KHÔNG bị cordis nuốt im lặng — kèm id module.
 * Lớp lỗi này đã làm nhóm mất mấy tiếng: `apply` ném ⇒ cordis nuốt ⇒ entry kẹt `loading` mà không ai biết vì sao.
 * Chỉ bọc khi export THẬT SỰ có `apply` (plugin); mọi trường khác giữ nguyên, và bản bọc được cache theo identity.
 * Nhận: id module và export mà vỏ sắp cài.
 * Trả: export nguyên bản, hoặc bản sao có `apply` log-and-rethrow.
 */
function logApply(id: string, exports: unknown): unknown {
  if (typeof exports !== "object" || exports === null) return exports;
  const plugin = exports as { apply?: unknown };
  if (typeof plugin.apply !== "function") return exports;
  const cached = applyLogCache.get(exports as object);
  if (cached !== undefined) return cached;
  const original = plugin.apply as (ctx: unknown) => unknown;
  const wrapped = {
    ...(exports as Record<string, unknown>),
    apply: (ctx: unknown) => {
      try {
        return original(ctx);
      } catch (error) {
        console.error('client-modules: apply for "' + id + '" threw: ' + describeError(error));
        throw error;
      }
    },
  };
  applyLogCache.set(exports as object, wrapped);
  return wrapped;
}

export interface RegistrationTarget {
  /** Chế độ hiện tại của facade: `queue` trước khi boot, `live` sau đó. */
  mode: string;
  /** Hàng đợi đăng ký; chính là mảng facade dùng chung, không phải bản sao. */
  pendingQueue: ClientModuleRegistration[];
  /** Nhận một đăng ký mới (sau boot thì chính là bảng module thật). */
  load(registration: ClientModuleRegistration): void;
}

/** Phần hệ module mà bộ điều phối entry cần: nạp, vạt chất hoá và làm mới theo đồ thị. */
export interface EntryModuleAccess {
  /** Manifest hiện hành. */
  readonly manifest: BootManifest;
  /** Nạp trước một dòng để lúc vạt chất hoá không phải chờ. */
  prefetch(id: string): Promise<void>;
  /** Nạp và trả export của một dòng (hoặc seed word) trong đồ thị. */
  import(specifier: string): Promise<unknown>;
  /** Xoá code đã nạp của một dòng để lần nạp sau lấy bản mới. */
  invalidate(id: string, rev?: string): void;
}

/** Chỉ số nội bộ mà bộ điều phối entry điều khiển qua callback. */
export interface ClientModuleIndex {
  /** Cập nhật descriptor của mọi dòng và revision của các factory chưa có entry. */
  update(manifest: BootManifest, managed: Iterable<string>): void;
  /** Vô hiệu hoá một dòng trước khi thay code của nó (chặn thay bootstrap). */
  invalidateForReplacement(id: string, rev: string): void;
  /** Giữ lại module còn được tham chiếu và dọn phần không còn ai dùng. */
  prune(roots: readonly string[]): void;
}

/** Tham số dựng hệ module từ bundle bootstrap đã vạt chất hoá. */
export interface ClientModuleSystemOptions {
  /** Đồ thị boot thô từ `window.__GBH_BOOT__ (alias __GBH_BOOT__)`. */
  manifest: unknown;
  /** Bảng module nền tảng (React…) do vỏ cấp. */
  staticModules: Record<string, unknown>;
  /** Facade đăng ký của HTML. */
  registrationTarget: RegistrationTarget;
  /** Bundle bootstrap (chính package này) đã vat chat hoa. */
  bootstrapModule: { id: string; exports: unknown };
  /** Bộ nạp script tuỳ chọn (mặc định: thẻ `<script>` cùng origin). */
  loadBundle?: LoadBundle;
}

/** Chỉ nhận file chunk cục bộ của package do bản build sinh ra. */
const CLIENT_CHUNK = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/;

/** Thay query `rev`, giữ nguyên dạng tuyệt đối, protocol-relative hay tương đối đường dẫn. */
function atRevision(url: string, rev: string): string {
  if (!/[?&]rev=[^&#]*/.test(url)) throw new Error("client-modules: bundle URL " + url + " has no revision");
  return url.replace(/([?&]rev=)[^&#]*/, "$1" + encodeURIComponent(rev));
}

/**
 * Khoá DANH TÍNH BUNDLE của một url: bỏ tham số `rev` để hai url chỉ khác revision được coi là
 * CÙNG một bundle. Vì sao cần (đo 18/10/2026): `loadShared` dedupe theo url ĐẦY ĐỦ; khi HMR báo rev cho
 * owner và alias ở hai thời điểm khác nhau, `atRevision()` sinh hai url khác nhau ⇒ bundle chạy HAI lần
 * ⇒ `single slot … already has a registration` (sidebar sập) / warning "bundle duoc nap lan hai (id alias)".
 * @param url - url bundle (có `?…rev=…`).
 * @returns url đã bỏ tham số rev (giữ nguyên hình dạng tương đối/tuyệt đối).
 */
function bundleKeyOf(url: string): string {
  return url.replace(/([?&])rev=[^&#]*(&?)/, (_match, lead: string, tail: string) => (tail === "&" ? lead : "")).replace(/[?&]$/, "");
}

/** Thông điệp của một giá trị bị ném: message nếu là Error, còn lại thì String. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Khoá bảng module cho một chunk cục bộ của package. */
function chunkId(ownerId: string, fileName: string): string {
  return ownerId + "/" + fileName;
}

/**
 * URL MỘT-BUNDLE của một dòng: `plugins/??<id>/client.js&rev=<rev>`.
 *
 * 10/11/2026 — VÌ SAO PHẢI CÓ: Host phát cho mỗi dòng URL của BATCH chứa nó
 * (`…/??@a/client.js,@b/client.js,…,@h/client.js&rev=<rev combo>`), và `invalidate()` từng thay
 * revision của MỘT dòng bằng cách nhét rev của dòng vào URL của batch đó. `loadShared()` lại dedupe
 * theo DANH TÍNH bundle (`bundleKeyOf` bỏ `rev`) ⇒ batch bị coi là "đã chạy" ⇒ KHÔNG chạy lại ⇒
 * factory vừa bị xoá không bao giờ được đăng ký lại ⇒ trang báo
 * `could not load "<id>": …: loaded without registering "<id>" via __ModuleLoader__.load`
 * (đúng khối đỏ "Một số plugin không đồng bộ được trên trang này" của Settings → Plugin).
 * Host đã lên lịch phản hồi cho ĐÚNG URL này ở `compose()` (`buildCombo([record], rev)`), nên đây là
 * URL vừa bảo đảm "chỉ có entry nằm trong đồ thị" (script chỉ đăng ký MỘT id của chính dòng đó) vừa
 * CHẠY LẠI ĐƯỢC mà không đăng ký trùng các module còn lại của batch.
 * Nhận: URL combo của dòng (`…/??a,b&rev=…`), id của dòng và revision mong muốn.
 * Trả: URL một-bundle cùng gốc tài liệu với `url`; URL không phải dạng combo thì chỉ thay revision.
 */
function ownBundleUrl(url: string, id: string, rev: string): string {
  const resourceStart = url.indexOf("/??");
  const revisionStart = resourceStart < 0 ? -1 : url.indexOf("&rev=", resourceStart + 3);
  if (resourceStart < 0 || revisionStart < 0) return atRevision(url, rev);
  return url.slice(0, resourceStart) + "/??" + id + "/client.js&rev=" + encodeURIComponent(rev);
}

/**
 * Suy ra URL chunk từ URL một-tài-nguyên của package và revision hiện hành.
 * Nhận: row của package sở hữu chunk, tên file chunk và revision đang dùng.
 * Trả: URL chunk trên cùng gốc tài liệu với bundle.
 * @throws khi URL của dòng không phải dạng combo một-plugin.
 */
function chunkUrl(row: ClientModuleRow, fileName: string, rev: string): string {
  const url = atRevision(row.url, rev);
  const resourceStart = url.indexOf("/??");
  const revisionStart = url.indexOf("&rev=", resourceStart + 3);
  const resource = resourceStart < 0 || revisionStart < 0 ? undefined : url.slice(resourceStart + 3, revisionStart);
  // 22/10/2026: host có thể gộp NHIỀU module vào một url dạng `/plugins/??a/client.js,b/client.js,…`.
  // Bản gốc chỉ chấp nhận dạng MỘT module nên chunk (vd `client.terminal.js`) không giải được ⇒ khung
  // terminal trắng. Nay chấp nhận cả dạng gộp, miễn là có mảnh của đúng package sở hữu chunk.
  const manh = resource === undefined ? [] : resource.split(",");
  if (!manh.includes(row.id + "/client.js")) {
    throw new Error("client-modules: cannot resolve chunk " + JSON.stringify(fileName) + " from bundle URL " + url);
  }
  return url.slice(0, resourceStart) + "/" + row.id + "/" + fileName + "?" + url.slice(revisionStart + 1);
}

/** Thẻ `<style>` chưa được gắn nhãn trước khi một factory chạy; factory không được nhận vơ chúng. */
function untaggedStyles(): Set<Element> {
  return typeof document === "undefined" ? new Set<Element>() : new Set(document.querySelectorAll("style:not([data-plugin])"));
}

/**
 * Nhận và kiểm kê các thẻ `<style>` mà một factory vừa chèn lúc vạt chất hoá.
 * Thẻ do preset phát ra đến với nhãn `data-plugin` sẵn; thẻ chưa nhãn mà trước đó chưa có thì được gán
 * cho plugin đang vạt chất hoá (để HMR dọn đúng).
 * Nhận: id package và tập thẻ đã có trước khi factory chạy.
 * Trả: danh sách id style mà plugin này sở hữu.
 */
function claimStyles(id: string, before: Set<Element>): string[] {
  if (typeof document === "undefined") return [];
  for (const el of untaggedStyles()) if (!before.has(el)) el.setAttribute("data-plugin", id);
  const owned: string[] = [];
  for (const el of document.querySelectorAll("style[data-plugin=" + JSON.stringify(id) + "]")) {
    owned.push(el.getAttribute("data-plugin-css") ?? id);
  }
  return owned;
}

/** Bộ nạp mặc định: một script classic cùng origin, có xoá thẻ khi xong. */
const defaultLoadBundle: LoadBundle = (url) =>
  new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.async = true;
    el.src = url;
    el.addEventListener(
      "load",
      () => {
        el.remove();
        resolve();
      },
      { once: true },
    );
    el.addEventListener(
      "error",
      () => {
        el.remove();
        reject(new Error("client-modules: bundle script " + url + " failed to load"));
      },
      { once: true },
    );
    document.head.append(el);
  });

/**
 * Hệ module phía browser: các bảng trạng thái cộng bộ máy nạp/vạt chất hoá.
 *
 * Bundle plugin chỉ ĐĂNG KÝ factory khi script chạy; mọi tác dụng phụ của thân module (kể cả chèn CSS)
 * nằm trong closure của factory và chỉ chạy ở lần vạt chất hoá đầu tiên, được memoize trong
 * `loadCache`. Thứ tự phân giải: seed word → bản ghi đã nhớ → dòng trong đồ thị → factory đã đăng ký →
 * ném lỗi to (không đoán). Vòng require là lỗi chết vì CJS dạng factory không giao được export dở dang.
 */
export class ClientModuleSystem implements EntryModuleAccess {
  /** Dấu nhận dạng mà Loader của vỏ kiểm tra trước khi nhận hệ module này. */
  readonly version = "client";
  /** Manifest hiện hành. */
  manifest: BootManifest;
  /** Bộ điều phối entry của trang. */
  readonly entries: ClientEntries;
  /** Bảng module đã vạt chất hoá, memoize theo id. */
  readonly loadCache = new Map<string, ClientModuleRecord>();
  private readonly seed: Map<string, unknown>;
  private readonly factories = new Map<string, { factory: (require: ClientRequire) => unknown; rev: string | undefined; sourceUrl?: string }>();
  private readonly bootstrapIds = new Set<string>();
  private readonly pendingArrival = new Map<string, Promise<void>>();
  private readonly generations = new Map<string, number>();
  private readonly reloadTargets = new Map<string, { url: string; rev: string }>();
  private readonly materializing = new Set<string>();
  private readonly graphRows = new Map<string, ClientModuleRow>();
  /** Alias id → row sở-hữu, nạp từ khai báo §gbh.row.aliases§ của manifest. */
  private readonly aliases = new Map<string, string>();
  private readonly loadBundle: LoadBundle;
  private readonly importErrors = new Map<string, Error>();
  private readonly failedBundleUrls = new Set<string>();
  private readonly executedBundleUrls = new Set<string>();
  /** Khoá DANH TÍNH bundle đã chạy (url bỏ `rev`) — chặn chạy lại khi owner/alias lệch rev. */
  private readonly executedBundleKeys = new Set<string>();

  /**
   * Dựng hệ module trên các dòng boot đã phân tích: ghi chỉ số dòng, giữ bundle bootstrap, và chuyển
   * facade từ hàng đợi sang chế độ đăng ký sống.
   * Nhận: tham số `ClientModuleSystemOptions`.
   * Trả: thực thể hệ module (không ném lỗi trừ khi facade đã boot rồi).
   */
  constructor(options: ClientModuleSystemOptions) {
    this.manifest = parseBootManifest(options.manifest);
    this.seed = new Map(Object.entries(options.staticModules ?? {}));
    this.loadBundle = options.loadBundle ?? defaultLoadBundle;
    this.entries = new ClientEntries(this, {
      update: (manifest, managed) => {
        this.updateManifest(manifest, managed);
      },
      invalidateForReplacement: (id, rev) => {
        if (this.bootstrapIds.has(id)) throw new Error("client-modules: replacing bootstrap module " + id + " requires a page reload");
        this.invalidate(id, rev);
      },
      prune: (roots) => {
        this.prune(roots);
      },
    });
    for (const row of this.manifest.modules) this.graphRows.set(row.id, row);
    this.learnAliases();
    const bootstrapId = stripClientSuffix(options.bootstrapModule.id);
    this.bootstrapIds.add(bootstrapId);
    this.loadCache.set(bootstrapId, {
      id: bootstrapId,
      exports: options.bootstrapModule.exports,
      styles: [],
      edges: new Set<string>(),
    });
    const target = options.registrationTarget;
    if (target.mode !== "queue") {
      throw new Error("client-modules: window.__ModuleLoader__.create called after module-system boot");
    }
    const pending = target.pendingQueue.splice(0);
    target.mode = "live";
    target.load = (registration) => {
      this.register(registration);
    };
    for (const registration of pending) target.load(registration);
  }

  /**
   * Đăng ký một factory bundle, từ chối script chạy hai lần mà không qua vô hiệu hoá.
   * Nhận: đăng ký `{ id, factory, chunk? }`.
   * Trả: không; ném lỗi khi tên chunk sai hoặc id đã có factory.
   */
  register(registration: ClientModuleRegistration): void {
    const ownerId = stripClientSuffix(registration.id);
    if (registration.chunk !== undefined && !CLIENT_CHUNK.test(registration.chunk)) {
      throw new Error("client-modules: invalid package-local chunk " + JSON.stringify(registration.chunk));
    }
    const id = registration.chunk === undefined ? ownerId : chunkId(ownerId, registration.chunk);
    const source = registration.sourceUrl ?? currentScriptUrl();
    const existing = this.factories.get(id);
    if (existing !== undefined) {
      const name = registration.chunk === undefined ? registration.id : id;
      // KHÁC nguồn ⇒ hai bundle khác nhau cùng cấp một id: đó mới là trùng THẬT ⇒ ném.
      if (source !== undefined && existing.sourceUrl !== undefined && source !== existing.sourceUrl) {
        throw new Error('client-modules: duplicate factory registration for "' + name + '" from a DIFFERENT bundle (' + existing.sourceUrl + ' vs ' + source + ')');
      }
      // CÙNG nguồn (hoặc không đọc được nguồn) ⇒ cùng một bundle bị thực thi lại (vỏ chèn nhiều thẻ
      // script cho cùng URL): NO-OP + cảnh báo, GIỮ factory đầu — không giết cả trang vì một lần thừa.
      console.warn('client-modules: duplicate registration for "' + name + '" ignored (same bundle source)');
      return;
    }
    this.factories.set(id, { factory: registration.factory, rev: this.revisionOf(ownerId), sourceUrl: source });
  }

  /** Nạp bảng §alias → row§ từ khai báo của từng dòng: khai báo là nguồn duy nhất, không suy đoán. */
  private learnAliases(): void {
    this.aliases.clear();
    for (const row of this.manifest.modules) {
      for (const alias of row.aliases) if (alias !== row.id) this.aliases.set(alias, row.id);
    }
  }

  /** Row sở hữu một id module: chính id đó, hoặc row đã KHAI nó làm alias. */
  /**
   * Row SỞ HỮU của một id: chính nó nếu không phải alias, ngược lại là id đã khai nó trong `gbh.row.aliases`/`moduleIds`.
   * CÔNG KHAI CÓ CHỦ ĐÍCH: đây là truy vấn của chính hợp đồng alias (một bundle ⇒ một plugin, N id),
   * và là thứ test canh dùng để khẳng định hai id quy về cùng một row thay vì so sánh bản ghi nội bộ.
   * Nhận: id module (đã bỏ hậu tố `/client`).
   * Trả: id của row sở hữu.
   */
  ownerOf(id: string): string {
    return this.aliases.get(id) ?? id;
  }

  /** Revision cho một id: lấy từ ROW sở hữu, nên khoá alias không bao giờ có rev rỗng (HMR vẫn nạp lại được). */
  private revisionOf(id: string): string | undefined {
    const owner = this.ownerOf(id);
    return this.reloadTargets.get(owner)?.rev ?? this.graphRows.get(owner)?.rev;
  }

  /** Chạy MỘT lần nạp cho mỗi URL; mọi dòng cùng URL chia sẻ yêu cầu đang bay. */

  /**
   * Chạy factory của một bundle và BÁO LỖI RA CONSOLE kèm id trước khi ném tiếp.
   * Vì sao: lỗi trong factory từng bị nuốt im lặng ⇒ cả nhóm phải suy luận 5 tầng mới tìm ra một dòng
   * `require("…") missed the module table`. Một dòng log ở đây trả lại hàng giờ cho mọi lỗi sau.
   * Nhận: id module, factory, và hàm require của nó.
   * Trả: export của module.
   */
  private runFactory(id: string, factory: (require: ClientRequire) => unknown, require: ClientRequire): unknown {
    try {
      return factory(require);
    } catch (error) {
      console.error("client-modules: factory for \"" + id + "\" threw: " + describeError(error));
      throw error;
    }
  }

  /**
   * Bundle tại url này đã được thực thi chưa — so cả url đầy đủ LẪN khoá danh tính (bỏ `rev`).
   * @param url - url bundle.
   * @returns true nếu đã chạy (không được chạy lại).
   */
  private hasExecuted(url: string): boolean {
    return this.executedBundleUrls.has(url) || this.executedBundleKeys.has(bundleKeyOf(url));
  }

  private loadShared(url: string): Promise<void> {
    // KHOÁ THEO (url, rev): một bundle chỉ được thực thi MỘT lần. Không có dòng này thì hai entry cùng URL
    // (id ta + id alias) làm `apply()` chạy hai lần ⇒ `service "…" has been registered` ⇒ row chết ⇒ cascade.
    const key = bundleKeyOf(url);
    if (this.executedBundleUrls.has(url) || this.executedBundleKeys.has(key)) return Promise.resolve();
    let transport = this.pendingArrival.get(url);
    if (transport === undefined) {
      transport = this.loadBundle(url)
        .then(() => {
          this.executedBundleUrls.add(url);
          this.executedBundleKeys.add(key);
        })
        .finally(() => {
          this.pendingArrival.delete(url);
        });
      this.pendingArrival.set(url, transport);
    }
    return transport;
  }

  /**
   * Nạp một dòng để factory của nó được đăng ký: thử batch trước, hỏng thì rơi về URL một-plugin.
   * Một batch hỏng KHÔNG bao giờ chạy lại (lần chạy thứ hai sẽ chết ở đăng ký trùng đầu tiên), nên tối
   * đa ba yêu cầu cho một dòng thiếu, và các dòng đã đăng ký trong batch đó vẫn nguyên vẹn.
   * Nhận: row của đồ thị.
   * Trả: không; ném lỗi nêu rõ mọi lần thử đã hỏng khi không đăng ký được.
   */
  private async arrive(row: ClientModuleRow): Promise<void> {
    const id = row.id;
    if (this.loadCache.has(id) || this.factories.has(id)) return;
    const reload = this.reloadTargets.get(id);
    const preferred = reload?.url ?? row.initialUrl;
    // 10/11/2026 — VÌ SAO ĐỔI: trước đây `fallback` chỉ là `row.url`, mà `compose()` của Host đã ghi
    // ĐÚNG URL của batch vào `row.url` ⇒ `row.url === row.initialUrl` ⇒ fallback LUÔN vắng ⇒ một batch
    // "đã chạy" nhưng thiếu factory (vì `invalidate()` vừa xoá) là ngõ cụt: không URL nào chạy lại
    // được, và trang báo "loaded without registering". Nay fallback là URL MỘT-BUNDLE của CHÍNH dòng
    // này — script đó chỉ đăng ký đúng một id, nên chạy lại nó không bao giờ là đăng ký trùng, và nó
    // vẫn là một entry CÓ TRONG đồ thị boot (`ownBundleUrl` suy từ chính row, không bịa id mới).
    const own = ownBundleUrl(row.url, id, reload?.rev ?? row.rev);
    const fallback = own === preferred ? undefined : own;
    const failures: string[] = [];
    const attempt = async (url: string): Promise<"transport-failed" | "not-registered" | "registered"> => {
      try {
        await this.loadShared(url);
      } catch (error) {
        failures.push(url + ": " + describeError(error));
        return "transport-failed";
      }
      // Id ALIAS không bao giờ do bundle tự đăng ký: nó thoả qua factory của ROW SỞ HỮU (một lần nạp, hai id).
      if (this.factories.has(id) || this.factories.has(this.ownerOf(id))) return "registered";
      failures.push(url + ": loaded without registering " + JSON.stringify(id) + " via __ModuleLoader__.load");
      return "not-registered";
    };
    let outcome: "transport-failed" | "not-registered" | "registered" = "transport-failed";
    if (this.failedBundleUrls.has(preferred)) {
      failures.push(preferred + ": skipped after an earlier failure of this bundle");
    } else if (this.factories.has(this.ownerOf(id))) {
      // ROW SỞ HỮU ĐÃ CÓ FACTORY ⇒ KHÔNG NẠP THÊM URL NÀO, dù URL nào. Ca thật (17/10/2026): gói loader có
      // entry alias cho id stock, mà bootstrap và combo là HAI URL khác nhau cho CÙNG một bundle ⇒ khoá theo
      // `(url, rev)` không khớp ⇒ script chạy lần hai ⇒ `duplicate factory registration` ⇒ #root sập.
      // Neo đúng phải là DANH TÍNH BUNDLE (row sở hữu), không phải URL phục vụ nó.
      outcome = "registered";
    } else if (this.hasExecuted(preferred) && this.factories.has(this.ownerOf(id))) {
      // Entry ALIAS dùng CHUNG URL với row sở hữu: bundle đã chạy đúng MỘT lần rồi.
      // Chạy lại sẽ là `duplicate factory registration` (đúng lỗi đã làm app trắng hôm nay).
      // Arrival của id alias được thoả qua bảng alias (ownerOf) chứ không cần thực thi lại.
      outcome = "registered";
    } else if (fallback !== undefined && this.hasExecuted(preferred)) {
      // Batch ĐÃ chạy mà không có factory cho id: chạy lại batch là đăng ký trùng cả loạt ⇒ ghi lý do
      // rồi đi thẳng URL một-bundle của chính dòng này. Không đánh dấu batch là "hỏng" nữa: lần sau
      // dòng khác cùng batch vẫn phải thử batch trước (10/11/2026).
      failures.push(preferred + ": already executed without registering " + JSON.stringify(id));
      outcome = "not-registered";
    } else {
      outcome = await attempt(preferred);
      if (outcome === "transport-failed") outcome = await attempt(preferred);
      if (outcome !== "registered" && fallback !== undefined) this.failedBundleUrls.add(preferred);
    }
    if (outcome !== "registered" && fallback !== undefined) {
      // URL một-bundle chỉ đăng ký ĐÚNG id của dòng này ⇒ khi factory của nó đang thiếu thì chạy lại là
      // AN TOÀN, nên xoá mọi dấu "đã chạy"/"đã hỏng" của chính URL đó trước khi thử (10/11/2026).
      this.executedBundleUrls.delete(fallback);
      this.executedBundleKeys.delete(bundleKeyOf(fallback));
      this.failedBundleUrls.delete(fallback);
      outcome = await attempt(fallback);
    }
    if (outcome !== "registered") {
      throw new Error("client-modules: could not load " + JSON.stringify(id) + ": " + failures.join("; "));
    }
    if (reload !== undefined && this.reloadTargets.get(id) === reload) this.reloadTargets.delete(id);
  }

  /**
   * Đăng ký mọi package được yêu cầu (và mọi dependency) trước khi nạp chính dòng này.
   * Chu trình qua `inject` được chấp nhận: Loader chờ service chứ không chờ module, nên chỉ cần tập
   * `visited` là đủ để không lặp vô hạn; chu trình qua `external` thật sự không nạp được.
   * Nhận: row, chuỗi đang mở và tập đã thăm.
   * Trả: không; ném lỗi có tên consumer khi một dependency hỏng.
   */
  private async arriveGraphRow(row: ClientModuleRow, open: string[] = [], visited: Set<string> = new Set<string>()): Promise<void> {
    const cycleStart = open.indexOf(row.id);
    if (cycleStart !== -1) {
      throw new Error(
        "client-modules: module arrival cycle " + [...open.slice(cycleStart), row.id].join(" -> ") + " (the host must reject this graph before serving it)",
      );
    }
    if (visited.has(row.id)) return;
    visited.add(row.id);
    const next = [...open, row.id];
    for (const request of row.external) {
      const id = stripClientSuffix(request);
      if (this.seed.has(request) || this.loadCache.has(id)) continue;
      const dependency = this.graphRows.get(id);
      if (dependency !== undefined) await this.arriveDependency(row.id, dependency, next, visited);
    }
    for (const packageName of row.inject) {
      const dependency = this.graphRows.get(packageName);
      if (dependency !== undefined) await this.arriveDependency(row.id, dependency, [], visited);
    }
    await this.arrive(row);
  }

  /** Nạp một dependency và ghi rõ consumer để lỗi dây chuyền đọc ra chuỗi, không phải 44 lỗi rời. */
  private async arriveDependency(consumerId: string, dependency: ClientModuleRow, open: string[], visited: Set<string>): Promise<void> {
    try {
      await this.arriveGraphRow(dependency, open, visited);
    } catch (error) {
      throw new Error(
        'client-modules: "' + consumerId + '" not loaded because dependency "' + dependency.id + '" failed: ' + describeError(error),
        { cause: error },
      );
    }
  }

  /**
   * Vạt chất hoá một factory đã đăng ký (đồng bộ, memoize trong `loadCache`).
   * Nhận: id trong bảng module và id package sở hữu style.
   * Trả: bản ghi module đã dựng.
   * @throws khi chưa có factory, hoặc khi require vòng qua chính nó.
   */
  private materialize(id: string, ownerId: string = id): ClientModuleRecord {
    const canonical = this.ownerOf(id);
    const existing = this.loadCache.get(id) ?? this.loadCache.get(canonical);
    if (existing !== undefined) {
      if (id !== canonical) this.loadCache.set(id, existing);
      return existing;
    }
    const registered = this.factories.get(id) ?? this.factories.get(canonical);
    if (registered === undefined) throw new Error('client-modules: no registered factory for "' + id + '"');
    if (this.materializing.has(id)) {
      throw new Error('client-modules: require cycle through "' + id + '" (factory-form CJS cannot deliver partial exports)');
    }
    this.materializing.add(id);
    const before = untaggedStyles();
    try {
      const edges = new Set<string>();
      const styleOwner = canonical === id ? ownerId : canonical;
      const record: ClientModuleRecord = {
        id: canonical,
        exports: this.runFactory(canonical, registered.factory as (require: ClientRequire) => unknown, this.makeRequire(styleOwner, edges)),
        styles: claimStyles(styleOwner, before),
        edges,
      };
      this.loadCache.set(canonical, record);
      if (id !== canonical) {
        // ALIAS chỉ là KHOÁ THỨ HAI của cùng một bundle. Nếu trả nguyên export cho entry alias thì vỏ sẽ
        // cài plugin LẦN THỨ HAI ⇒ `apply` chạy hai lần ⇒ đăng ký lại service/slot ⇒ ném ⇒ row kẹt `loading`.
        // Trả bản sao với `apply` no-op: mọi export khác giữ nguyên (consumer require vẫn dùng được), còn
        // việc CÀI chỉ xảy ra một lần ở id sở hữu.
        this.loadCache.set(id, { ...record, exports: aliasExports(record.exports) });
      }
      return record;
    } catch (error) {
      claimStyles(ownerId, before);
      removeOwnedStyles(ownerId);
      throw error;
    } finally {
      this.materializing.delete(id);
    }
  }

  /**
   * Khoá SONG SINH có mặt trong bảng seed nền tảng của vỏ SPA (id stock ↔ id GBH).
   *
   * 09/11/2026 — VÌ SAO: vỏ SPA đang phục vụ cấp seed dưới ID STOCK (`@deepseek-ai/dsh-client-ui-slots`),
   * trong khi mọi bundle client của ta require ID GBH sau bước chuẩn hoá id lúc build
   * (`@galaxy-blackhole/gbh-client-ui-slots`) và đồ thị boot KHÔNG có dòng/alias nào cho id đó ⇒ require
   * trượt cả ba nhánh ⇒ `factory for "…ui-renderer" threw: require(…) missed the module table`.
   * Đây là nhánh CUỐI (sau loadCache/factories) nên KHÔNG BAO GIỜ che một package có thật trong đồ thị.
   * Nhận: `spec` — specifier mà factory vừa require.
   * Trả: khoá thật trong bảng seed (khoá song sinh của module nền), hoặc undefined khi không có khoá nào.
   */
  private seedAliasKey(spec: string): string | undefined {
    const twin = seedAliasOf(spec);
    return twin !== undefined && this.seed.has(twin) ? twin : undefined;
  }

  /**
   * Dựng `require` đồng bộ và nhánh `require.async` mà factory nhận được.
   * Nhận: id package sở hữu factory và tập cạnh để ghi lại các specifier đã quan sát.
   * Trả: hàm require kèm thuộc tính `async`.
   */
  private makeRequire(ownerId: string, edges: Set<string>): ClientRequire {
    const require = ((spec: string): unknown => {
      edges.add(spec);
      if (this.seed.has(spec)) return this.seed.get(spec);
      const id = stripClientSuffix(spec);
      const record = this.loadCache.get(id);
      if (record !== undefined) return record.exports;
      if (this.factories.has(id)) return this.aliasView(id, this.materialize(id));
      // 09/11/2026 — nhánh CUỐI: module nền của vỏ SPA được cấp dưới khoá SONG SINH (id stock) trong khi
      // bundle của ta require khoá GBH (xem `platform-seeds.ts`). Đặt SAU factories để package có thật luôn thắng.
      const seedKey = this.seedAliasKey(spec);
      if (seedKey !== undefined) return this.seed.get(seedKey);
      throw new Error(
        'client-modules: require("' + spec + '") missed the module table — not a platform seed word, not a materialized module, ' +
          "and no registered package factory (a build-time externals drift, or a dynamic dependency that did not arrive)",
      );
    }) as ClientRequire;
    require.async = async (spec: string): Promise<unknown> => {
      edges.add(spec);
      if (!spec.startsWith("./")) return await this.import(spec);
      const fileName = spec.slice(2);
      if (!CLIENT_CHUNK.test(fileName)) throw new Error("client-modules: invalid relative chunk request " + JSON.stringify(spec));
      return await this.importChunk(ownerId, fileName);
    };
    return require;
  }

  /**
   * Nạp, đăng ký và vạt chất hoá một chunk động cục bộ của package.
   * Nhận: id package sở hữu và tên file chunk (đã kiểm dạng).
   * Trả: export của chunk.
   * @throws khi chủ sở hữu không phải dòng trong đồ thị, hoặc script không đăng ký chunk.
   */
  private async importChunk(ownerId: string, fileName: string): Promise<unknown> {
    const id = chunkId(ownerId, fileName);
    const existing = this.loadCache.get(id);
    if (existing !== undefined) return this.aliasView(id, existing);
    if (!this.factories.has(id)) {
      const generation = this.generations.get(ownerId) ?? 0;
      const row = this.graphRows.get(ownerId);
      if (row === undefined) throw new Error('client-modules: chunk owner "' + ownerId + '" is not a boot graph entry');
      const url = chunkUrl(row, fileName, this.factories.get(ownerId)?.rev ?? this.reloadTargets.get(ownerId)?.rev ?? row.rev);
      let transport = this.pendingArrival.get(url);
      if (transport === undefined) {
        transport = this.loadBundle(url).finally(() => {
          this.pendingArrival.delete(url);
        });
        this.pendingArrival.set(url, transport);
      }
      await transport;
      if ((this.generations.get(ownerId) ?? 0) !== generation) {
        this.factories.delete(id);
        this.loadCache.delete(id);
        return await this.importChunk(ownerId, fileName);
      }
      if (!this.factories.has(id)) {
        throw new Error("client-modules: bundle " + url + " loaded without registering " + JSON.stringify(id) + " via __ModuleLoader__.load");
      }
    }
    return this.materialize(id, ownerId).exports;
  }

  /**
   * Nạp một specifier và trả export của nó — cửa duy nhất mà Loader của vỏ gọi.
   * Nhận: tên package hoặc seed word (`baseUrl` và tham số thứ ba của Loader được bỏ qua).
   * Trả: export của module.
   * @throws khi specifier không có trong bảng nền tảng, không đã vạt chất hoá, và không phải dòng đồ thị.
   */
  async import(specifier: string): Promise<unknown> {
    if (this.seed.has(specifier)) return this.seed.get(specifier);
    const id = stripClientSuffix(specifier);
    const existing = this.loadCache.get(id);
    if (existing !== undefined) return existing.exports;
    const row = this.graphRows.get(id);
    if (row === undefined) {
      if (this.factories.has(id)) return this.aliasView(id, this.materialize(id));
      // 09/11/2026 — nhánh CUỐI, cùng lý do như `makeRequire`: seed của vỏ SPA chỉ có khoá STOCK.
      const seedKey = this.seedAliasKey(specifier);
      if (seedKey !== undefined) return this.seed.get(seedKey);
      throw new Error(
        'client-modules: cannot resolve "' + specifier + '" — not a seed word, not a materialized module, and not a row in the boot graph ' +
          "(the runtime mirror of the bundle purity gate)",
      );
    }
    return this.recordingImportError(id, async () => {
      await this.arriveGraphRow(row);
      return this.aliasView(id, this.materialize(id));
    });
  }


  /**
   * Chế độ xem export cho một id: id SỞ HỮU nhận export thật, id ALIAS nhận bản sao có `apply` no-op.
   * Nhờ vậy vỏ chỉ cài plugin MỘT lần cho một bundle (N id chỉ là N khoá bảng module).
   * Nhận: id đang được yêu cầu và bản ghi module của nó.
   * Trả: export để trả cho consumer (hoặc cho vỏ khi cài plugin).
   */
  private aliasView(id: string, record: { exports: unknown }): unknown {
    return this.ownerOf(id) === id ? logApply(id, record.exports) : aliasExports(record.exports);
  }

  /**
   * Nạp trước một dòng để lúc entry vạt chất hoá không phải chờ mạng.
   * Nhận: id package (chấp nhận cả dạng `<id>/client`).
   * Trả: không sau khi bundle đã đăng ký factory.
   */
  async prefetch(id: string): Promise<void> {
    const normalized = stripClientSuffix(id);
    if (this.loadCache.has(normalized)) return;
    const row = this.graphRows.get(normalized);
    if (row === undefined) throw new Error('client-modules: prefetch("' + id + '") — not a graph entry');
    await this.recordingImportError(normalized, () => this.arriveGraphRow(row));
  }

  /**
   * Lỗi nạp gần nhất của một dòng — văn bản mà bản kiểm toán boot hiển thị cho người dùng.
   * Nhận: id package (chấp nhận cả dạng `<id>/client`).
   * Trả: Error của lần hỏng gần nhất, hoặc undefined khi lần gần nhất thành công.
   */
  importError(id: string): Error | undefined {
    return this.importErrors.get(stripClientSuffix(id));
  }

  /** Chạy một thao tác trên dòng đồ thị, ghi lỗi lại cho bản kiểm toán boot và xoá khi thành công. */
  private async recordingImportError<T>(id: string, operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      this.importErrors.delete(id);
      return result;
    } catch (error) {
      this.importErrors.set(id, error instanceof Error ? error : new Error(describeError(error)));
      throw error;
    }
  }

  /**
   * Làm tươi descriptor và revision của factory chưa có entry trước khi entry nào kịp nạp dependency.
   * Nhận: manifest mới và danh sách id mà bộ điều phối entry đang quản.
   * Trả: không.
   * @throws khi đồ thị mới bỏ mất module bootstrap (phải nạp lại trang).
   */
  private updateManifest(manifest: BootManifest, managed: Iterable<string>): void {
    for (const id of this.bootstrapIds) {
      if (this.manifest.modules.some((row) => row.id === id) && !manifest.modules.some((row) => row.id === id)) {
        throw new Error("client-modules: removing bootstrap module " + id + " requires a page reload");
      }
    }
    const owned = new Set(managed);
    for (const row of manifest.modules) {
      this.graphRows.set(row.id, { ...row, initialUrl: row.url });
      const cachedRevision = this.factories.get(row.id)?.rev ?? this.reloadTargets.get(row.id)?.rev;
      if (!owned.has(row.id) && cachedRevision !== undefined && cachedRevision !== row.rev) {
        this.invalidate(row.id, row.rev);
        removeOwnedStyles(row.id);
      }
    }
    this.manifest = manifest;
    this.learnAliases();
  }

  /**
   * Giữ lại module đang sống và mọi yêu cầu bắc cầu của nó trước khi dọn bản ghi không còn ai tham chiếu.
   * Nhận: gốc bổ sung — tên các entry mà Loader đang giữ.
   * Trả: không.
   */
  private prune(roots: readonly string[]): void {
    const retained = new Set<string>(this.bootstrapIds);
    const visit = (specifier: string): void => {
      const id = stripClientSuffix(specifier);
      if (retained.has(id)) return;
      retained.add(id);
      const row = this.graphRows.get(id);
      const requests = [...(row?.external ?? []), ...(row?.inject ?? []), ...(this.loadCache.get(id)?.edges ?? [])];
      for (const request of requests) visit(request);
    };
    for (const row of this.manifest.modules) visit(row.id);
    for (const id of roots) visit(id);
    for (const id of [...this.graphRows.keys()]) {
      if (retained.has(id)) continue;
      this.graphRows.delete(id);
      this.invalidate(id);
      removeOwnedStyles(id);
    }
  }

  /**
   * Xoá code đã nạp của một dòng và chọn URL một-plugin cho lần nạp kế tiếp.
   * Nhận: id package và revision mong muốn (mặc định: revision hiện có của dòng).
   * Trả: không; bootstrap không bao giờ bị vô hiệu hoá.
   */
  invalidate(id: string, rev?: string): void {
    const normalized = stripClientSuffix(id);
    if (this.bootstrapIds.has(normalized)) return;
    this.importErrors.delete(normalized);
    this.generations.set(normalized, (this.generations.get(normalized) ?? 0) + 1);
    const row = this.graphRows.get(normalized);
    if (row !== undefined) {
      const revision = rev ?? row.rev;
      // ⚠️ 18/10/2026 — OWNER và ALIAS phải nhận CÙNG url sau khi HMR đổi rev.
      //   Trước đây chỉ set cho id được invalidate; alias giữ url cũ ⇒ cùng một bundle được phục vụ ở
      //   hai URL ⇒ loadShared() dedupe theo url đầy đủ không bắt ⇒ bundle chạy HAI lần ⇒
      //   'single slot … already has a registration' / warning 'bundle duoc nap lan hai (id alias)'.
      //   Đo được trên app thật: warning xuất hiện 8–12 s SAU boot (đúng nhịp HMR sync), không phải lúc boot.
      // 10/11/2026 — VÌ SAO ĐỔI (lỗi thật: khối đỏ "Một số plugin không đồng bộ được trên trang này"
      // của Settings → Plugin, ảnh người dùng 00:45): `row.url` KHÔNG phải URL của riêng dòng này mà là
      // URL của BATCH chứa nó, nên `atRevision(row.url, revision)` từng nhét rev CỦA DÒNG vào URL CỦA
      // BATCH. `loadShared()` dedupe theo DANH TÍNH bundle (`bundleKeyOf` bỏ `rev`) ⇒ batch đã chạy ⇒
      // không chạy lại ⇒ factory vừa xoá ở dưới không bao giờ được đăng ký lại ⇒ mọi lần
      // `prefetch`/`import` sau `invalidate` đều ném `… loaded without registering "<id>" via
      // __ModuleLoader__.load` (đo được: `invalidate(A, rev)` rồi `prefetch(A)` — lỗi 100%).
      // Nay URL của lần nạp kế tiếp là URL MỘT-BUNDLE của chính dòng (xem `ownBundleUrl`).
      const target = { url: ownBundleUrl(row.url, normalized, revision), rev: revision };
      this.reloadTargets.set(normalized, target);
      for (const [alias, owner] of this.aliases) if (owner === normalized) this.reloadTargets.set(alias, target);
      // Quên dấu "bundle này đã chạy/đã hỏng" của CHÍNH URL đó: factory vừa bị xoá nên lần nạp kế tiếp
      // phải THỰC THI LẠI script một-bundle (nó chỉ đăng ký đúng một id ⇒ không thể đăng ký trùng).
      this.executedBundleUrls.delete(target.url);
      this.executedBundleKeys.delete(bundleKeyOf(target.url));
      this.failedBundleUrls.delete(target.url);
    } else {
      this.reloadTargets.delete(normalized);
      for (const [alias, owner] of this.aliases) if (owner === normalized) this.reloadTargets.delete(alias);
    }
    for (const key of [...this.factories.keys()]) {
      if (key === normalized || key.startsWith(normalized + "/client.")) this.factories.delete(key);
    }
    for (const key of [...this.loadCache.keys()]) {
      if (key === normalized || key.startsWith(normalized + "/client.")) this.loadCache.delete(key);
    }
    for (const [alias, owner] of [...this.aliases]) {
      if (owner !== normalized) continue;
      this.factories.delete(alias);
      this.loadCache.delete(alias);
    }
  }
}
