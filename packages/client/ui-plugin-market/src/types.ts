/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu dùng chung của row ui-plugin-market: bề mặt runtime (Like) và kiểu dữ liệu thị trường
 */

import type { PluginMarketTranslate } from "./locales.ts";

/** Hàm dựng phần tử của jsx runtime (react/jsx-runtime). */
export interface JsxRuntimeLike {
  /** Dựng một phần tử. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Dựng phần tử có mảng con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Mảnh rời không có node bọc. */
  Fragment: unknown;
}

/** Module react mà tab này dùng. KHÔNG có jsx/jsxs: hai hàm đó nằm ở react/jsx-runtime. */
export interface ReactLike {
  /** Trạng thái cục bộ của một component. */
  useState<T>(initial: T): [T, (next: T) => void];
  /** Hiệu ứng sau khi vẽ. */
  useEffect(effect: () => void | (() => void), deps: readonly unknown[]): void;
  /** Giá trị nhớ theo phụ thuộc. */
  useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
}

/** Bề mặt bộ nguyên thuỷ (ui-primitives) mà tab này đọc — tên lấy nguyên văn từ bản gốc. */
export interface MarketPrimitivesLike {
  /** Nút bấm. */
  Button: unknown;
  /** Nhãn nhỏ. */
  Tag: unknown;
  /** Menu có neo. */
  Menu: unknown;
  /** Ô nhập. */
  Input: unknown;
  /** Hộp thoại. */
  Modal: unknown;
  /** Viên chọn. */
  Pill: unknown;
  /** Chú thích khi rê chuột. */
  Tooltip: unknown;
  /** Chấm trạng thái. */
  StateDot: unknown;
  /** Ảnh mặc định của plugin. */
  PluginArtworkDefault: unknown;
  /** Icon mũi xuống. */
  IconChevronDownOutlineRegular: unknown;
  /** Icon cảnh báo. */
  IconWarningOutlineRegular: unknown;
  /** Icon thanh trượt (bộ lọc). */
  IconSlidersTwoOutlineRegular: unknown;
  /** Icon dấu cộng. */
  IconPlusOutlineRegular: unknown;
  /** Icon thùng rác. */
  IconTrashOutlineRegular: unknown;
  /** Icon kính lúp. */
  IconSearchOutlineRegular: unknown;
  /** Icon làm mới. */
  IconRefreshOutlineRegular: unknown;
}

/** Văn bản đa ngôn ngữ do chỉ mục cấp (khoá là mã ngôn ngữ). */
export type LocalizedTextLike = Record<string, string>;

/** Khai báo có tiêu đề trong metadata của chỉ mục. */
export interface MarketDeclarationLike {
  /** Tiêu đề đa ngôn ngữ. */
  readonly title: LocalizedTextLike;
}

/** Khai báo khoá sắp xếp kèm hướng mặc định. */
export interface MarketSortKeyLike extends MarketDeclarationLike {
  /** Hướng sắp xếp mặc định của khoá. */
  readonly order: "asc" | "desc";
}

/** Metadata mà một chỉ mục khai: danh mục, nhãn, khoá sắp xếp. */
export interface MarketMetadataLike {
  /** Danh mục theo id. */
  readonly categories: Readonly<Record<string, MarketDeclarationLike>>;
  /** Nhãn theo id. */
  readonly labels: Readonly<Record<string, MarketDeclarationLike>>;
  /** Khoá sắp xếp theo id. */
  readonly sortKeys: Readonly<Record<string, MarketSortKeyLike>>;
}

/** Thứ tự kết quả tìm kiếm (nguyên văn kiểu của bản gốc). */
export type MarketSortLike =
  | { readonly kind: "index" }
  | { readonly kind: "relevance" }
  | { readonly kind: "published"; readonly direction: "asc" | "desc" }
  | { readonly kind: "key"; readonly id: string; readonly direction: "asc" | "desc" };

/** Truy vấn một trang kết quả của một chỉ mục. */
export interface MarketQueryLike {
  /** Văn bản tìm kiếm mờ. */
  readonly text?: string;
  /** Id danh mục bắt buộc. */
  readonly category?: string;
  /** Các id nhãn bắt buộc. */
  readonly labels?: readonly string[];
  /** Thứ tự kết quả. */
  readonly sort: MarketSortLike;
  /** Số plugin bỏ qua. */
  readonly offset: number;
  /** Số plugin tối đa trả về (1..100). */
  readonly limit: number;
  /** Đọc lại thay vì dùng bản đã nhớ. */
  readonly refresh?: boolean;
  /** Thời điểm đọc của trang trước, để nối tiếp đúng cùng một tài liệu. */
  readonly fetchedAt?: number;
}

/** Truy vấn Discover mà mặt inject nhận: văn bản, bộ lọc và thứ tự (khớp DiscoverQuery của presentation). */
export interface DiscoverQueryLike {
  /** Văn bản tìm kiếm. */
  readonly text: string;
  /** Danh mục đang chọn, null là tất cả. */
  readonly category: string | null;
  /** Các nhãn đang chọn. */
  readonly labels: readonly string[];
  /** Thứ tự kết quả. */
  readonly sort: MarketSortLike;
}

/** Nguồn cài của một phiên bản: npm hoặc git. */
export type MarketSourceLike =
  | { readonly type: "npm"; readonly registry?: string }
  | { readonly type: "git"; readonly url: string; readonly commit: string; readonly path?: string };

/** Điều kiện tương thích với DSH đang chạy. */
export interface MarketCompatibilityLike {
  /** Có tương thích không. */
  readonly compatible: boolean;
  /** Phiên bản DSH đang chạy khi không tương thích. */
  readonly runtimeVersion?: string;
  /** Yêu cầu chưa đạt, khoá engines.dsh. */
  readonly requirements?: Readonly<Record<string, string>>;
  /** Hồ sơ có miễn trừ tương thích cho đúng cặp gói + phiên bản này không. */
  readonly exempted?: boolean;
}

/** Tham số cài một phiên bản chính xác (spec của pnpm add). */
export interface MarketInstallTargetLike {
  /** Spec cài đặt. */
  readonly spec: string;
  /** Registry hỏi trước, nếu có. */
  readonly registry?: string;
}

/** Một phiên bản được niêm yết kèm tương thích và tham số cài. */
export interface MarketVersionLike {
  /** Phiên bản SemVer chính xác. */
  readonly version: string;
  /** Thời điểm phát hành, Unix GIÂY. */
  readonly publishTimestamp: number;
  /** Nguồn cài của phiên bản. */
  readonly source: MarketSourceLike;
  /** Tham số cài phiên bản này. */
  readonly install: MarketInstallTargetLike;
  /** Tương thích với DSH đang chạy. */
  readonly compatibility: MarketCompatibilityLike;
}

/** Trạng thái cài đặt của một plugin so với các bundle của hồ sơ. */
export interface MarketInstallationLike {
  /** Trạng thái quan hệ với hồ sơ. */
  readonly status: "not-installed" | "installed" | "update-available" | "different-version" | "provided";
  /** Phiên bản đang cài, khi hồ sơ báo được. */
  readonly installedVersion?: string;
}

/** Một plugin trong chỉ mục kèm dữ kiện riêng của hồ sơ. */
export interface MarketEntryLike {
  /** Tên package npm. */
  readonly name: string;
  /** Tiêu đề đa ngôn ngữ. */
  readonly title?: LocalizedTextLike;
  /** Mô tả đa ngôn ngữ. */
  readonly description?: LocalizedTextLike;
  /** Ảnh biểu tượng (data: hoặc URL tuyệt đối). */
  readonly icon?: string;
  /** Tác giả. */
  readonly author?: string;
  /** Trang chủ. */
  readonly homepage?: string;
  /** Kho mã nguồn. */
  readonly repository?: { readonly url: string; readonly directory?: string };
  /** Danh mục, nhãn của plugin trong chỉ mục. */
  readonly metadata: { readonly category?: string; readonly labels: readonly string[] };
  /** Phiên bản cài mặc định; vắng khi không có phiên bản tương thích. */
  readonly defaultVersion?: string;
  /** Các phiên bản, giảm dần theo SemVer. */
  readonly versions: readonly MarketVersionLike[];
  /** Trạng thái cài đặt trong hồ sơ này. */
  readonly installation: MarketInstallationLike;
}

/** Một trang kết quả tìm kiếm kèm dữ kiện của chỉ mục. */
export interface MarketSearchResultLike {
  /** URL chỉ mục trả lời. */
  readonly url: string;
  /** Tiêu đề chỉ mục. */
  readonly title: LocalizedTextLike;
  /** Mô tả chỉ mục. */
  readonly description?: LocalizedTextLike;
  /** Metadata của chỉ mục. */
  readonly metadata: MarketMetadataLike;
  /** Thời điểm đọc tài liệu, Unix MILI giây. */
  readonly fetchedAt: number;
  /** Các plugin của trang này. */
  readonly entries: readonly MarketEntryLike[];
  /** Tổng số plugin khớp. */
  readonly total: number;
  /** offset của trang sau, hoặc null khi hết. */
  readonly nextOffset: number | null;
}

/** Một nguồn chỉ mục đã cấu hình và điều lần đọc cuối biết được. */
export interface MarketIndexSummaryLike {
  /** URL chỉ mục. */
  readonly url: string;
  /** Tiêu đề thị trường từ lần đọc thành công cuối. */
  readonly title?: LocalizedTextLike;
  /** Mô tả thị trường. */
  readonly description?: LocalizedTextLike;
  /** Thông báo lỗi của lần đọc cuối khi thất bại. */
  readonly error?: string;
}

/** Kết quả một lời gọi remote: ok kèm value, hoặc lỗi kèm mã. */
export interface RemoteAnswerLike<T> {
  /** Lời gọi thành công không. */
  readonly ok: boolean;
  /** Giá trị khi thành công. */
  readonly value?: T;
  /** Lỗi khi thất bại. */
  readonly error?: { readonly code: string; readonly message: string; readonly details?: { readonly reason?: string } };
}

/** Namespace remote của thị trường plugin. */
export interface MarketRemoteLike {
  /** Đọc danh sách nguồn chỉ mục đã cấu hình. */
  listIndexes(): Promise<RemoteAnswerLike<readonly MarketIndexSummaryLike[]>>;
  /** Đọc một trang kết quả của một chỉ mục. */
  search(url: string, query: MarketQueryLike): Promise<RemoteAnswerLike<MarketSearchResultLike>>;
  /** Ghi danh sách nguồn chỉ mục. */
  setIndexes(urls: readonly string[]): Promise<RemoteAnswerLike<unknown>>;
}

/** Seam remote phía trang. */
export interface RemoteSeamLike {
  /** Nghe một sự kiện remote; trả hàm huỷ. */
  $on(event: string, listener: () => void): () => void;
  /** Namespace thị trường plugin. */
  pluginMarket: MarketRemoteLike;
}

/** Ảnh chụp từ điển phía trang (hook useLocale đọc trường active). */
export interface LocaleSnapshotLike {
  /** Ngôn ngữ đang dùng. */
  readonly active: string;
}

/** Seam từ điển. */
export interface LocaleSeamLike {
  /** Đăng ký từ điển của một namespace. */
  register(namespace: string, copy: Record<string, Record<string, string>>): unknown;
  /** Bind một namespace thành hàm dịch. */
  bind(namespace: string): PluginMarketTranslate;
  /** Dịch một văn bản cục bộ của gói theo ngôn ngữ đang dùng. */
  resolveText(text: unknown): string;
}

/** Đặc tả một occupant của slot (giữ nguyên hình dạng bản gốc dùng). */
export interface SlotSpecLike {
  /** Tên slot — PHẢI là literal tại chỗ gọi để check:rows đọc được. */
  name: string;
  /** Id occupant; BẮT BUỘC với slot kiểu list. */
  id?: string;
  /** Thứ tự trong slot. */
  order?: number;
  /** Nhãn của tab. */
  label?: () => string;
  /** Namespace từ điển của occupant. */
  locale?: string;
  /** Mặt inject (face) mà occupant nhận qua props. */
  inject?: () => unknown;
}

/** Seam khe cắm của trang. */
export interface SlotsSeamLike {
  /** Đăng ký occupant vào slot, có thể hoãn bằng hàm trả về. */
  inject(slot: string, register: () => unknown): unknown;
  /** Đăng ký một occupant; component là THAM SỐ THỨ HAI. */
  register(spec: SlotSpecLike, component: unknown): unknown;
}

/** Store quan sát được do @galaxy-blackhole/gbh-client-store cấp. */
export interface SnapshotStoreLike<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot(): T;
  /** Thay cả trạng thái. */
  set(next: T): void;
}

/** Context phía browser (chỉ khai phần row này dùng). */
export interface ClientContextLike {
  /** Đăng ký một hiệu ứng có thể huỷ; tham số hai là nhãn debug. */
  effect(callback: () => unknown, label?: string): unknown;
  /** Nghe một sự kiện của cordis; trả hàm huỷ. */
  on(event: string, listener: () => void): () => void;
  /** Seam khe cắm. */
  slots: SlotsSeamLike;
  /** Seam từ điển. */
  locale: LocaleSeamLike;
  /** Seam remote. */
  remote: RemoteSeamLike;
}

/** Lý do lần đọc niêm yết cuối thất bại. */
export type ListingFailure = "fetch" | "invalid" | "changed";

/** Lý do lần đổi nguồn cuối bị từ chối. */
export type SourceFailure =
  | { readonly kind: "invalid" | "duplicate" | "unavailable" }
  | { readonly kind: "other"; readonly reason: string };

/** Mặt mà tab nhận qua inject (đúng hình dạng bản gốc). */
export interface DiscoverFaceLike {
  /** Nguồn trạng thái cho hook của renderer. */
  readonly hooks: { readonly discover: unknown; readonly locale: unknown };
  /** Dịch văn bản của chỉ mục theo ngôn ngữ đang dùng. */
  readonly resolveText: (text: unknown) => string;
  /** Đọc danh sách nguồn ở lần vẽ đầu. */
  readonly ensure: () => void;
  /** Đọc lại danh sách nguồn sau khi thất bại. */
  readonly reload: () => void;
  /** Chọn một chỉ mục. */
  readonly select: (url: string) => void;
  /** Thay truy vấn của chỉ mục đang chọn và đọc trang đầu. */
  readonly search: (query: DiscoverQueryLike) => void;
  /** Đọc trang kế tiếp của kết quả hiện có. */
  readonly more: () => void;
  /** Đọc lại chỉ mục đang chọn. */
  readonly refresh: () => void;
  /** Chạy lại lần đọc niêm yết thất bại cuối. */
  readonly retry: () => void;
  /** Mở/đóng hộp thoại nguồn. */
  readonly toggleSources: () => void;
  /** Sửa ô nháp URL nguồn. */
  readonly editDraft: (text: string) => void;
  /** Thêm nguồn từ ô nháp. */
  readonly addSource: () => void;
  /** Bỏ một nguồn. */
  readonly removeSource: (url: string) => void;
}

/** Đích cài mà trang Plugins nhận từ tab (owner props install). */
export interface PluginTabInstallLike {
  /** Spec cài đặt. */
  readonly spec: string;
  /** Registry hỏi trước, nếu có. */
  readonly registry?: string;
  /** Tên hiển thị của plugin, đã bản địa hoá. */
  readonly title: string;
  /** Phiên bản đang cài. */
  readonly version: string;
}

/** Props mà tab Discover nhận từ trang Plugins và từ mặt inject của chính nó. */
export type DiscoverSectionPropsLike = DiscoverFaceLike & {
  /** Hàm dịch của namespace pluginMarket. */
  readonly t: PluginMarketTranslate;
  /** Mở hộp thoại cài của trang với một phiên bản đã xác nhận. */
  readonly install: (target: PluginTabInstallLike) => void;
  /** Chuyển sang tab Đã cài và mở trang của một bundle. */
  readonly openPackage: (packageName: string) => void;
  /** Hook đọc trạng thái Discover. */
  readonly useDiscover: <S>(selector: (snapshot: MarketDiscoverStateLike) => S) => S;
  /** Hook đọc ngôn ngữ đang dùng. */
  readonly useLocale: <S>(selector: (snapshot: LocaleSnapshotLike) => S) => S;
};

/** Trạng thái niêm yết của chỉ mục đang chọn. */
export interface MarketListingStateLike {
  /** URL chỉ mục. */
  readonly url: string;
  /** Truy vấn đang chọn. */
  readonly query: DiscoverQueryLike;
  /** loading khi trang đầu đang chạy; more khi trang sau đang chạy. */
  readonly status: "loading" | "more" | "ready" | "error";
  /** Kết quả của URL này; giữ kết quả cũ khi truy vấn mới đang chạy hoặc đã hỏng. */
  readonly value: MarketSearchResultLike | null;
  /** Truy vấn mà value trả lời. */
  readonly answered: DiscoverQueryLike | null;
  /** Lý do lần đọc cuối thất bại. */
  readonly failure: ListingFailure | null;
}

/** Trạng thái Discover dùng chung. */
export interface MarketDiscoverStateLike {
  /** idle cho tới lần vẽ đầu của tab. */
  readonly status: "idle" | "loading" | "ready" | "error";
  /** Các nguồn chỉ mục đã cấu hình. */
  readonly indexes: readonly MarketIndexSummaryLike[];
  /** URL chỉ mục đang chọn. */
  readonly selected: string | null;
  /** Niêm yết của chỉ mục đang chọn. */
  readonly listing: MarketListingStateLike | null;
  /** Hộp thoại nguồn có đang mở không. */
  readonly editing: boolean;
  /** Ô nháp URL nguồn. */
  readonly draft: string;
  /** Đang ghi danh sách nguồn. */
  readonly saving: boolean;
  /** Lý do lần ghi nguồn cuối bị từ chối. */
  readonly sourceFailure: SourceFailure | null;
}

/** Plugin phía browser do factory dựng ra. */
export interface MarketPlugin {
  /** Tên plugin (id của ta). */
  readonly name: string;
  /** Dịch vụ bắt buộc (cordis fiber inject). */
  readonly inject: string[];
  /** Cài row: từ điển, bộ điều khiển và tab Discover. */
  apply(ctx: ClientContextLike): void;
}
