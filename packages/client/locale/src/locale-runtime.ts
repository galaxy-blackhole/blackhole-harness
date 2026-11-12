/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Dich vu \`locale\`: so tu dien + lua chon ngon ngu + chuoi du phong (48 row khac phu thuoc)
 */

import type { LocaleBootstrap } from "./bootstrap.ts";
import {
  COMMON_NS,
  FALLBACK_LOCALE,
  LOCALE_ID_PATTERN,
  LOCALE_IDS,
} from "./ids.ts";

/** Hàm dịch mà mọi row nhận từ `bind(ns)`. */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

/** Một gói ngôn ngữ đã chuẩn hoá và đóng băng. */
export interface LanguageDefinition {
  /** Id kiểu BCP 47. */
  id: string;
  /** Nhãn hiển thị trong mục cài đặt. */
  label: string;
  /** Ngôn ngữ kế tiếp trong chuỗi dự phòng. */
  fallback?: string;
}

/** Bản chụp trạng thái mà renderer dùng làm khoá render lại. */
export interface LocaleSnapshot {
  /** Ngôn ngữ đang hiện. */
  active: string;
  /** Các gói ngôn ngữ có mặt. */
  locales: readonly LanguageDefinition[];
  /** Số phiên bản, tăng mỗi lần đổi. */
  revision: number;
}

/** Phạm vi lưu lựa chọn ở tầng host (mục cài đặt `locale`). */
export interface LocaleHostScope {
  /** Đọc bản chụp giá trị của mục cài đặt. */
  getSnapshot(): { value?: Record<string, unknown> };
  /** Theo dõi thay đổi của mục cài đặt. */
  subscribe(listener: () => void): () => void;
  /** Ghi một trường xuống host. */
  set(field: string, value: unknown): void;
}

/** Context phía browser (chỉ seam mà dịch vụ này dùng). */
export interface LocaleContext {
  /** Gắn hiệu ứng vào vòng đời plugin; trả hàm gỡ. */
  effect(callback: () => unknown, label: string): void;
  /** Phát một sự kiện trên context. */
  emit(event: string, payload: unknown): void;
  /** Phơi một dịch vụ cho các plugin khác. */
  provide(name: string, value: unknown): void;
}

/** Metadata của hai ngôn ngữ dựng sẵn. */
const BUILT_IN_LOCALE_METADATA: Record<string, { label: string; fallback?: string }> = {
  vi: { label: "Tiếng Việt", fallback: "en" },
  zh: { label: "中文", fallback: "en" },
  en: { label: "English" },
};

/** Hai gói ngôn ngữ dựng sẵn, đã đóng băng. */
export const BUILT_IN_LOCALES: readonly LanguageDefinition[] = Object.freeze(
  LOCALE_IDS.map((id) =>
    Object.freeze({
      id,
      ...(BUILT_IN_LOCALE_METADATA[id] ?? { label: id }),
    }),
  ),
);

/**
 * Khoá tra cứu không phân biệt hoa thường cho id kiểu BCP 47.
 * Nhận: `value` — id ngôn ngữ.
 * Trả: khoá đã hạ chữ thường.
 */
function localeKey(value: string): string {
  return value.toLowerCase();
}

/**
 * Kiểm và tách một gói ngôn ngữ khỏi đầu vào còn thay đổi được.
 * Nhận: `input` — gói ngôn ngữ chưa kiểm.
 * Trả: gói đã đóng băng.
 * @throws khi id/label/fallback không hợp lệ.
 */
export function normalizeLanguage(input: { id: string; label: string; fallback?: string }): LanguageDefinition {
  if (!LOCALE_ID_PATTERN.test(input.id)) throw new Error('locale id "' + input.id + '" is not a BCP 47-style tag');
  if (input.label.trim() === "") throw new Error("locale label must not be empty");
  if (input.fallback !== undefined && !LOCALE_ID_PATTERN.test(input.fallback)) {
    throw new Error('locale fallback "' + input.fallback + '" is not a BCP 47-style tag');
  }
  return Object.freeze({
    id: input.id,
    label: input.label,
    ...(input.fallback === undefined ? {} : { fallback: input.fallback }),
  });
}

/**
 * Ghim `<html lang>` theo ngôn ngữ đang hiện, giữ trang đã phục vụ đồng bộ với bản chụp.
 * Nhận: `snapshot` — trạng thái ngôn ngữ.
 * Trả: không.
 */
export function syncDocumentLanguage(snapshot: LocaleSnapshot): void {
  if (typeof document === "undefined") return;
  const language = snapshot.active === "zh" ? "zh-CN" : snapshot.active;
  if (document.documentElement.lang !== language) document.documentElement.lang = language;
}

/**
 * Ngôn ngữ trình duyệt đầu tiên mà ta có gói: khớp id CHÍNH XÁC trước, rồi mới tới subtag gốc.
 * `window` là phép thử "có phải browser", không dùng `navigator`: Node cũng phơi một `navigator`
 * báo ngôn ngữ của máy, không được để nó quyết định ngôn ngữ cho lượt chạy ngoài browser.
 * Nhận: `locales` — gói hiện có, `languages` — thứ tự ngôn ngữ hệ điều hành (nếu vỏ native cấp).
 * Trả: id ngôn ngữ khớp đầu tiên, hoặc `undefined`.
 */
export function detectBrowserLocale(locales: readonly LanguageDefinition[], languages?: readonly string[]): string | undefined {
  let tags = languages;
  if (tags === undefined) {
    if (typeof window === "undefined") return undefined;
    tags = [...(navigator.languages ?? []), navigator.language];
  }
  for (const tag of tags) {
    const requested = localeKey(tag);
    const exact = locales.find((locale) => localeKey(locale.id) === requested);
    if (exact !== undefined) return exact.id;
    const primary = requested.split("-")[0];
    const match = locales.find((locale) => localeKey(locale.id).split("-")[0] === primary);
    if (match !== undefined) return match.id;
  }
  return undefined;
}

/**
 * Ngôn ngữ lúc khởi động: ngôn ngữ trình duyệt thắng, không có thì rơi về {@link FALLBACK_LOCALE}.
 * Nhận: `locales` — gói hiện có, `languages` — thứ tự ngôn ngữ hệ điều hành (nếu có).
 * Trả: id ngôn ngữ.
 */
export function resolveInitialLocale(locales: readonly LanguageDefinition[], languages?: readonly string[]): string {
  return detectBrowserLocale(locales, languages) ?? FALLBACK_LOCALE;
}

/** Sổ từ điển + lựa chọn ngôn ngữ. */
export class LocaleRuntime {
  /** Dữ liệu khởi tạo của vỏ native (nếu có). */
  readonly bootstrap: LocaleBootstrap | undefined;
  /** Từ điển theo namespace → (khoá ngôn ngữ → bảng chữ). */
  private readonly dicts = new Map<string, Map<string, Record<string, string>>>();
  /** Cache hàm dịch theo namespace. */
  private readonly bound = new Map<string, Translator>();
  /** Danh mục gói ngôn ngữ theo khoá chữ thường. */
  private readonly catalog = new Map<string, LanguageDefinition>();
  /** Cache chuỗi dự phòng theo ngôn ngữ bắt đầu. */
  private readonly fallbackChains = new Map<string, readonly string[]>();
  /** Người nghe thay đổi bản chụp. */
  private readonly listeners = new Set<() => void>();
  /** Context sở hữu (dùng để phát sự kiện). */
  private readonly ctx: LocaleContext;
  /** Phạm vi lưu lựa chọn ở host (vắng mặt khi chạy không có host). */
  private readonly host: LocaleHostScope | undefined;
  /** Ngôn ngữ suy từ trình duyệt, dùng khi chưa có lựa chọn tường minh. */
  private provisional: string;
  /** Lựa chọn tường minh gần nhất. */
  private preference: string | undefined;
  /** Bản chụp hiện tại. */
  private snapshot: LocaleSnapshot;

  /**
   * Dựng sổ từ điển quanh ctx/host/bootstrap cho trước.
   * Nhận: `ctx` — context sở hữu, `host` — phạm vi lưu lựa chọn (có thể vắng), `bootstrap` — dữ liệu khởi tạo native.
   * Trả: đối tượng dịch vụ.
   */
  constructor(ctx: LocaleContext, host?: LocaleHostScope, bootstrap?: LocaleBootstrap) {
    this.ctx = ctx;
    this.host = host;
    this.bootstrap = bootstrap;
    for (const locale of BUILT_IN_LOCALES) this.catalog.set(localeKey(locale.id), locale);
    const locales = this.localeList();
    this.provisional = resolveInitialLocale(locales, bootstrap?.languages);
    this.preference = bootstrap?.preference ?? undefined;
    this.snapshot = Object.freeze({ active: this.resolveActive(), locales, revision: 0 });
    if (host !== undefined) {
      ctx.effect(
        () => host.subscribe(() => this.adopt(host)),
        "locale: settings scope adoption",
      );
      this.adopt(host);
    }
  }

  /**
   * Bản chụp ngôn ngữ đang hiện.
   * ĐO ĐƯỢC ở bản gốc: `getLocale()` trả về CHÍNH bản chụp (giống `getSnapshot()`), không phải id —
   * ngôn ngữ đang hiện nằm ở `getLocale().active`. Đây là bề mặt 48 row khác đọc, nên phải khớp.
   * Nhận: không.
   * Trả: bản chụp trạng thái.
   */
  getLocale(): LocaleSnapshot {
    return this.snapshot;
  }

  /**
   * Chọn chữ của một giá trị đa ngôn ngữ theo chuỗi dự phòng của ngôn ngữ đang hiện.
   * Nhận: `text` — chuỗi (trả nguyên) hoặc bản ghi theo ngôn ngữ.
   * Trả: chuỗi đã chọn.
   */
  resolveText(text: string | Record<string, string>): string {
    if (typeof text === "string") return text;
    return this.fallbackChain(this.snapshot.active).reduceRight<string>(
      (resolved, locale) => text[localeKey(locale)] ?? resolved,
      text.en ?? "",
    );
  }

  /**
   * Bản chụp trạng thái hiện tại (renderer dùng `revision` làm khoá render lại).
   * Nhận: không.
   * Trả: bản chụp đã đóng băng.
   */
  getSnapshot(): LocaleSnapshot {
    return this.snapshot;
  }

  /**
   * Theo dõi thay đổi bản chụp.
   * Nhận: `fn` — hàm nghe.
   * Trả: hàm gỡ.
   */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /**
   * Đặt ngôn ngữ đang hiện và ghi lựa chọn xuống host.
   * Nhận: `id` — id gói ngôn ngữ.
   * Trả: không.
   * @throws khi gói ngôn ngữ chưa có trong danh mục.
   */
  setLocale(id: string): void {
    if (!this.catalog.has(localeKey(id))) throw new Error('locale "' + id + '" is not registered');
    this.preference = id;
    const active = this.resolveActive();
    if (active !== this.snapshot.active) this.publish(active, true);
    this.host?.set("preference", id);
  }

  /**
   * Thêm một gói ngôn ngữ; nếu chuỗi dự phòng của nó không tới được tiếng Anh thì hoàn tác.
   * Nhận: `input` — gói ngôn ngữ chưa kiểm.
   * Trả: hàm gỡ gói đó.
   * @throws khi id trùng, fallback lạ, hoặc chuỗi dự phòng có chu trình.
   */
  addLanguage(input: { id: string; label: string; fallback?: string }): () => void {
    const language = normalizeLanguage(input);
    const key = localeKey(language.id);
    if (this.catalog.has(key)) throw new Error('locale "' + language.id + '" is already registered');
    if (language.fallback !== undefined && !this.catalog.has(localeKey(language.fallback))) {
      throw new Error('locale fallback "' + language.fallback + '" is not registered');
    }
    this.catalog.set(key, language);
    try {
      this.assertFallbackChain(language.id);
    } catch (error) {
      this.catalog.delete(key);
      throw error;
    }
    this.publishCatalog();
    return () => {
      if (this.catalog.get(key) === language) {
        this.catalog.delete(key);
        this.publishCatalog();
      }
    };
  }

  /**
   * Nhận lựa chọn ngôn ngữ từ phạm vi cài đặt của host.
   * Nhận: `host` — phạm vi cài đặt.
   * Trả: không.
   */
  private adopt(host: LocaleHostScope): void {
    const section = host.getSnapshot().value;
    if (section === undefined) return;
    const preference = section.preference;
    this.preference = typeof preference === "string" ? preference : undefined;
    const active = this.resolveActive();
    if (active !== this.snapshot.active) this.publish(active, true);
  }

  /** Công bố lại danh mục (sau khi thêm/gỡ gói ngôn ngữ). */
  private publishCatalog(): void {
    const locales = this.localeList();
    this.publish(this.snapshot.active, false, locales);
  }

  /** Ngôn ngữ hiệu lực: lựa chọn tường minh nếu còn trong danh mục, ngược lại là suy từ trình duyệt. */
  private resolveActive(): string {
    const preference = this.preference;
    if (preference !== undefined) {
      const chosen = this.catalog.get(localeKey(preference));
      if (chosen !== undefined) return chosen.id;
    }
    return this.provisional;
  }

  /** Danh mục gói ngôn ngữ đã đóng băng. */
  private localeList(): readonly LanguageDefinition[] {
    return Object.freeze([...this.catalog.values()]);
  }

  /**
   * Kiểm chuỗi dự phòng của một gói mới có tới được tiếng Anh không.
   * Nhận: `start` — id gói mới.
   * Trả: không.
   * @throws khi chu trình, khi thiếu mắt, hoặc khi chuỗi không tới `en`.
   */
  private assertFallbackChain(start: string): void {
    const seen = new Set<string>();
    let current: LanguageDefinition | undefined = this.catalog.get(localeKey(start));
    while (current !== undefined) {
      const key = localeKey(current.id);
      if (seen.has(key)) throw new Error('locale fallback cycle includes "' + current.id + '"');
      seen.add(key);
      if (key === localeKey(FALLBACK_LOCALE)) return;
      if (current.fallback === undefined) {
        throw new Error('locale "' + current.id + '" fallback chain does not reach "' + FALLBACK_LOCALE + '"');
      }
      current = this.catalog.get(localeKey(current.fallback));
      if (current === undefined) throw new Error('locale fallback "' + current + '" is not registered');
    }
  }

  /**
   * Chuỗi tra cứu của một ngôn ngữ, luôn kết thúc ở tiếng Anh (kể cả khi danh mục vừa đổi).
   * Nhận: `start` — id ngôn ngữ bắt đầu.
   * Trả: chuỗi id ngôn ngữ, đã đóng băng và cache.
   */
  private fallbackChain(start: string): readonly string[] {
    const startKey = localeKey(start);
    const cached = this.fallbackChains.get(startKey);
    if (cached !== undefined) return cached;
    const chain: string[] = [];
    const seen = new Set<string>();
    let current = this.catalog.get(startKey);
    while (current !== undefined && !seen.has(localeKey(current.id))) {
      const key = localeKey(current.id);
      seen.add(key);
      chain.push(current.id);
      current = current.fallback === undefined ? undefined : this.catalog.get(localeKey(current.fallback));
    }
    if (!seen.has(localeKey(FALLBACK_LOCALE))) chain.push(FALLBACK_LOCALE);
    const resolved = Object.freeze(chain);
    this.fallbackChains.set(startKey, resolved);
    return resolved;
  }

  /**
   * Đăng ký từ điển cho một namespace (một ngôn ngữ hoặc cả bảng).
   * Nhận: `ns` — namespace, `localeOrDicts` — id ngôn ngữ (kèm `dict`) hoặc bảng theo ngôn ngữ, `dict` — bảng chữ khi truyền id.
   * Trả: hàm gỡ đăng ký.
   * @throws khi id không phải BCP 47, hoặc namespace đã có ngôn ngữ đó.
   */
  register(
    ns: string,
    localeOrDicts: string | Record<string, Record<string, string>>,
    dict?: Record<string, string>,
  ): () => void {
    const pairs: [string, Record<string, string>][] =
      typeof localeOrDicts === "string" ? [[localeOrDicts, dict ?? {}]] : Object.entries(localeOrDicts);
    for (const [locale] of pairs) {
      if (!LOCALE_ID_PATTERN.test(locale)) throw new Error('locale id "' + locale + '" is not a BCP 47-style tag');
    }
    let locales = this.dicts.get(ns);
    if (locales === undefined) {
      locales = new Map<string, Record<string, string>>();
      this.dicts.set(ns, locales);
    }
    for (const [locale] of pairs) {
      if (locales.has(localeKey(locale))) {
        throw new Error('locale namespace "' + ns + '" already has locale "' + locale + '"');
      }
    }
    for (const [locale, entries] of pairs) locales.set(localeKey(locale), entries);
    this.publish(this.snapshot.active, false);
    return () => {
      const owner = this.dicts.get(ns);
      if (owner === undefined) return;
      let removed = false;
      for (const [locale, entries] of pairs) {
        const key = localeKey(locale);
        if (owner.get(key) === entries) {
          owner.delete(key);
          removed = true;
        }
      }
      if (removed) this.publish(this.snapshot.active, false);
    };
  }

  /**
   * Buộc một namespace thành hàm dịch (cache theo namespace).
   * Nhận: `ns` — namespace.
   * Trả: hàm dịch.
   */
  bind(ns: string): Translator {
    const existing = this.bound.get(ns);
    if (existing !== undefined) return existing;
    const t: Translator = (key, params) => this.translate(ns, key, params);
    this.bound.set(ns, t);
    return t;
  }

  /**
   * Dịch một khoá: tra theo chuỗi dự phòng trong namespace, rồi tới `common`, cuối cùng hiện chính khoá.
   * Nhận: `ns` — namespace, `key` — khoá, `params` — tham số điền `{tên}`.
   * Trả: chuỗi đã dịch.
   */
  private translate(ns: string, key: string, params?: Record<string, string | number>): string {
    const chain = this.fallbackChain(this.snapshot.active);
    const template =
      this.lookup(ns, key, chain) ??
      (ns !== COMMON_NS ? this.lookup(COMMON_NS, key, chain) : undefined) ??
      key;
    if (params === undefined) return template;
    return template.replace(/\{(\w+)\}/gu, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }

  /**
   * Tra một khoá trong namespace theo chuỗi ngôn ngữ.
   * Nhận: `ns`, `key`, `chain`.
   * Trả: chuỗi tìm được, hoặc `undefined`.
   */
  private lookup(ns: string, key: string, chain: readonly string[]): string | undefined {
    const locales = this.dicts.get(ns);
    for (const locale of chain) {
      const value = locales?.get(localeKey(locale))?.[key];
      if (value !== undefined) return value;
    }
    return undefined;
  }

  /**
   * Tăng revision và báo cho người nghe. Chỉ lần ĐỔI ngôn ngữ đang hiện mới phát `locale/change`;
   * đăng ký từ điển chỉ tăng revision, tránh bão sự kiện lúc boot.
   * Nhận: `active`, `localeChanged`, `locales` (mặc định giữ danh mục cũ).
   * Trả: không.
   */
  private publish(active: string, localeChanged: boolean, locales: readonly LanguageDefinition[] = this.snapshot.locales): void {
    this.snapshot = Object.freeze({ active, locales, revision: this.snapshot.revision + 1 });
    if (localeChanged) this.ctx.emit("locale/change", this.snapshot);
    for (const fn of [...this.listeners]) {
      try {
        fn();
      } catch (error) {
        console.error("locale subscriber crashed:", error);
      }
    }
  }
}
