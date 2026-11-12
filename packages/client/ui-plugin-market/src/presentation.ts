/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hàm thuần của tab Discover: truy vấn, thứ tự khai báo, phiên bản trình bày, dữ kiện nguồn
 */

import type {
  DiscoverQueryLike,
  LocalizedTextLike,
  MarketCompatibilityLike,
  MarketEntryLike,
  MarketIndexSummaryLike,
  MarketMetadataLike,
  MarketSortLike,
  MarketVersionLike,
} from "./types.ts";

/** Truy vấn Discover: văn bản, bộ lọc và thứ tự, chưa có phân trang (khớp DiscoverQueryLike của types). */
export type DiscoverQuery = DiscoverQueryLike;

/** Truy vấn mà một chỉ mục mới chọn bắt đầu bằng. */
export const INITIAL_QUERY: DiscoverQuery = { text: "", category: null, labels: [], sort: { kind: "index" } };

/**
 * Thay văn bản truy vấn. Thứ tự chỉ mục thành thứ tự liên quan khi văn bản rỗng được gõ thêm chữ, và trở lại
 * khi văn bản thành rỗng; thứ tự do người dùng chọn trong lúc có chữ thì giữ nguyên.
 * Nhận: query — truy vấn hiện tại; text — văn bản mới.
 * Trả: truy vấn với văn bản và thứ tự đã cập nhật.
 */
export function withText(query: DiscoverQuery, text: string): DiscoverQuery {
  const was = query.text.trim() === "";
  const blank = text.trim() === "";
  const sort: MarketSortLike =
    was && !blank && query.sort.kind === "index"
      ? { kind: "relevance" }
      : blank && query.sort.kind === "relevance"
        ? { kind: "index" }
        : query.sort;
  return { ...query, text, sort };
}

/**
 * Bỏ bộ lọc và khoá sắp xếp mà chỉ mục không còn khai, để mọi lựa chọn đang bật vẫn thấy được trên thanh công cụ.
 * Nhận: query — truy vấn hiện tại; metadata — khai báo của chỉ mục đã trả lời nó.
 * Trả: chính truy vấn khi mọi id đều được khai, ngược lại là bản đã thu gọn.
 */
export function declaredQuery(query: DiscoverQuery, metadata: MarketMetadataLike): DiscoverQuery {
  const category = query.category !== null && !Object.hasOwn(metadata.categories, query.category) ? null : query.category;
  const labels = query.labels.filter((label) => Object.hasOwn(metadata.labels, label));
  const sort: MarketSortLike =
    query.sort.kind === "key" && !Object.hasOwn(metadata.sortKeys, query.sort.id) ? { kind: "index" } : query.sort;
  return category === query.category && labels.length === query.labels.length && sort === query.sort
    ? query
    : { ...query, category, labels, sort };
}

/** Một khai báo kèm id và tiêu đề theo ngôn ngữ đang dùng. */
export interface DisplayDeclaration<T> {
  /** Id khai báo. */
  readonly id: string;
  /** Tiêu đề đã bản địa hoá. */
  readonly title: string;
  /** Khai báo gốc. */
  readonly declaration: T;
}

/**
 * Sắp khai báo theo tiêu đề đã bản địa hoá, rồi theo điểm mã của id.
 * Nhận: declarations — ánh xạ id → khai báo có title; resolveText — hàm dịch; language — ngôn ngữ đang dùng.
 * Trả: danh sách khai báo theo thứ tự hiển thị.
 */
export function displayDeclarations<T extends { readonly title: LocalizedTextLike }>(
  declarations: Readonly<Record<string, T>>,
  resolveText: (text: LocalizedTextLike) => string,
  language: string,
): DisplayDeclaration<T>[] {
  const collator = new Intl.Collator(language);
  return Object.entries(declarations)
    .map(([id, declaration]) => ({ id, title: resolveText(declaration.title), declaration }))
    .sort((a, b) => collator.compare(a.title, b.title) || (a.id < b.id ? -1 : 1));
}

/**
 * Phiên bản mà một plugin trình bày và cài mặc định: bản mặc định, hoặc bản cao nhất khi không bản nào tương thích.
 * Nhận: entry — plugin trong chỉ mục.
 * Trả: phiên bản được trình bày.
 */
export function presentedVersion(entry: MarketEntryLike): MarketVersionLike {
  return entry.versions.find((version) => version.version === entry.defaultVersion) ?? (entry.versions[0] as MarketVersionLike);
}

/** Một dữ kiện về nguồn cài của một phiên bản, khoá theo nhãn đã bản địa hoá. */
export interface SourceFact {
  /** Loại dữ kiện. */
  readonly kind: "package" | "registry" | "repository" | "commit" | "directory";
  /** Giá trị hiển thị. */
  readonly value: string;
}

/**
 * Liệt kê nơi một phiên bản được cài từ đó, để người dùng kiểm tra nguồn gốc trước khi cài.
 * Nhận: name — tên package; version — phiên bản định cài.
 * Trả: package npm và registry, hoặc kho, commit đầy đủ và thư mục package.
 */
export function sourceFacts(name: string, version: MarketVersionLike): SourceFact[] {
  const { source } = version;
  if (source.type === "npm") {
    return [
      { kind: "package", value: name + "@" + version.version },
      ...(source.registry === undefined ? [] : [{ kind: "registry", value: source.registry } as SourceFact]),
    ];
  }
  return [
    { kind: "repository", value: source.url },
    { kind: "commit", value: source.commit },
    ...(source.path === undefined ? [] : [{ kind: "directory", value: source.path } as SourceFact]),
  ];
}

/**
 * Đặt tên một nguồn chỉ mục: tiêu đề thị trường sau khi đọc được, ngược lại là host.
 * Nhận: index — nguồn đã cấu hình; resolveText — hàm dịch.
 * Trả: tên hiển thị; URL không phân tích được thì in nguyên văn.
 */
export function indexLabel(index: MarketIndexSummaryLike, resolveText: (text: LocalizedTextLike) => string): string {
  if (index.title !== undefined) return resolveText(index.title);
  return URL.canParse(index.url) ? new URL(index.url).host : index.url;
}

/**
 * Phiên bản này có được phép cài không: tương thích, hoặc được miễn trừ.
 * Nhận: compatibility — điều kiện tương thích của phiên bản.
 * Trả: true khi cài được.
 */
export function installable(compatibility: MarketCompatibilityLike): boolean {
  return compatibility.compatible || compatibility.exempted === true;
}

/**
 * Ngày phát hành theo ngôn ngữ đang dùng.
 * Nhận: timestamp — Unix GIÂY; language — ngôn ngữ; style — độ dài hiển thị.
 * Trả: chuỗi ngày đã bản địa hoá.
 */
export function formatDate(timestamp: number, language: string, style: "medium" | "long"): string {
  return new Intl.DateTimeFormat(language, { dateStyle: style }).format(new Date(timestamp * 1000));
}

/**
 * Id trên menu sắp xếp của một thứ tự.
 * Nhận: sort — thứ tự hiện tại.
 * Trả: id dùng cho menu.
 */
export function sortMenuId(sort: MarketSortLike): string {
  return sort.kind === "key" ? "key:" + sort.id : sort.kind;
}

/**
 * Truy vấn có đang chọn mọi plugin của chỉ mục không (không chữ, không danh mục, không nhãn).
 * Nhận: query — truy vấn cần xét (có thể null khi chưa có lần đọc nào).
 * Trả: true khi không có bộ lọc nào.
 */
export function unfiltered(query: DiscoverQuery | null): boolean {
  return query === null ? true : query.text.trim() === "" && query.category === null && query.labels.length === 0;
}
