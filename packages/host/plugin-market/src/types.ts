/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/types.d.ts' của @deepseek-ai/dsh-plugin-market (149 dòng): bản ghi JSON-safe và sự kiện
 *      của namespace Remote 'pluginMarket'. Hai khối 'declare module' của bản gốc KHÔNG port — repo CẤM
 *      'declare module' (luật 000d) ⇒ mã lỗi giữ NGUYÊN chuỗi, khai thành union nội bộ; sự kiện khai interface thường.
 */

import type {
  MarketIndexMetadata,
  MarketInstallTarget,
  MarketPlugin,
  MarketVersion,
} from "@deepseek-ai/dsh-plugin-market-index";

/**
 * Văn bản đa ngôn ngữ: chuỗi literal, hoặc bản dịch theo mã ngôn ngữ với khoá `en` bắt buộc.
 * Bản địa phương của `LocalizedText` bên `@deepseek-ai/dsh-package-manifest` (cùng hình dạng, KHÔNG thêm dep).
 */
export type LocalizedText = string | { readonly en: string; readonly [locale: string]: string };

/** Sáu mã lỗi của chính namespace `pluginMarket` (nguyên văn khoá của `RemoteErrorDetailsMap` bản gốc). */
export type PluginMarketErrorCode =
  | "plugin-market/invalid-index-url"
  | "plugin-market/unknown-index"
  | "plugin-market/fetch-failed"
  | "plugin-market/invalid-index"
  | "plugin-market/invalid-query"
  | "plugin-market/settings-unavailable";

/**
 * Sự kiện service phát ra (bản gốc khai bằng `declare module '@deepseek-ai/cordis'`; repo CẤM ⇒ interface thường).
 */
export interface PluginMarketEvents {
  /** Danh sách nguồn chỉ mục đã cam kết thay đổi. */
  "plugin-market/changed": () => void;
}

/** Một nguồn chỉ mục đã cấu hình và điều lần đọc cuối biết được. */
export interface MarketIndexSummary {
  /** URL của nguồn, đúng như đã cấu hình. */
  readonly url: string;
  /** Tiêu đề thị trường từ lần đọc THÀNH CÔNG cuối. */
  readonly title?: LocalizedText;
  /** Mô tả thị trường từ lần đọc thành công cuối. */
  readonly description?: LocalizedText;
  /** Thông báo lỗi của lần đọc cuối khi nó thất bại. */
  readonly error?: string;
}

/**
 * Quan hệ của một plugin với các bundle của hồ sơ, khớp theo tên package và đo theo phiên bản mặc định (hoặc
 * phiên bản cao nhất khi không có mặc định): `provided` khi bản cài DSH đã kèm package,
 * `update-available` khi phiên bản đó LỚN HƠN phiên bản đang cài, `different-version` khi phiên bản đang cài
 * không rõ, không phải SemVer hợp lệ, hoặc lớn hơn.
 */
export type MarketInstallationStatus =
  | "not-installed"
  | "installed"
  | "update-available"
  | "different-version"
  | "provided";

/** Trạng thái cài đặt của một plugin và phiên bản đang cài khi hồ sơ báo được. */
export interface MarketInstallation {
  /** Quan hệ với hồ sơ. */
  readonly status: MarketInstallationStatus;
  /** Phiên bản đang cài, khi hồ sơ báo được. */
  readonly installedVersion?: string;
}

/** DSH đang chạy có thoả `engines.dsh` của một phiên bản không, đúng như phép kiểm cài đặt của DSH. */
export type MarketCompatibility =
  | {
      /** Mọi yêu cầu đều đạt. */
      readonly compatible: true;
    }
  | {
      /** Có yêu cầu chưa đạt. */
      readonly compatible: false;
      /** Phiên bản DSH đang chạy. */
      readonly runtimeVersion: string;
      /** Yêu cầu CHƯA đạt, khoá `engines.dsh`. */
      readonly requirements: Readonly<Record<string, string>>;
      /** Hồ sơ có miễn trừ cho đúng cặp package + phiên bản runtime này không. */
      readonly exempted: boolean;
    };

/** Một phiên bản được niêm yết kèm tương thích và tham số cài nó. */
export interface MarketListingVersion extends MarketVersion {
  /** Tham số cài đúng phiên bản này. */
  readonly install: MarketInstallTarget;
  /** Tương thích với DSH đang chạy. */
  readonly compatibility: MarketCompatibility;
}

/** Một plugin trong chỉ mục kèm dữ kiện riêng của hồ sơ mà danh sách thị trường hiển thị. */
export interface MarketListingEntry extends Omit<MarketPlugin, "versions"> {
  /** KHÔNG rỗng, giảm dần theo thứ tự ưu tiên SemVer. */
  readonly versions: readonly MarketListingVersion[];
  /**
   * Phiên bản được cài mặc định: phiên bản TƯƠNG THÍCH cao nhất không có nhãn prerelease, hoặc prerelease tương
   * thích cao nhất khi plugin không niêm yết phiên bản nào không prerelease. Vắng khi không có phiên bản như vậy.
   */
  readonly defaultVersion?: string;
  /** Trạng thái cài đặt trong hồ sơ này. */
  readonly installation: MarketInstallation;
}

/**
 * Thứ tự kết quả tìm kiếm; đồng hạng giữ thứ tự chỉ mục. `relevance` xếp theo độ khớp văn bản, tốt nhất trước, và
 * là thứ tự chỉ mục khi không có `text`. `published` dùng thời điểm phát hành mới nhất của mỗi plugin. `key` dùng
 * một khoá sắp xếp đã khai; plugin không có giá trị đứng SAU mọi plugin khác ở cả hai hướng.
 */
export type MarketSort =
  | {
      /** Thứ tự của chính chỉ mục. */
      readonly kind: "index";
    }
  | {
      /** Xếp theo độ khớp văn bản. */
      readonly kind: "relevance";
    }
  | {
      /** Xếp theo thời điểm phát hành. */
      readonly kind: "published";
      /** Hướng sắp xếp. */
      readonly direction: "asc" | "desc";
    }
  | {
      /** Xếp theo một khoá đã khai trong chỉ mục. */
      readonly kind: "key";
      /** Id khoá sắp xếp. */
      readonly id: string;
      /** Hướng sắp xếp. */
      readonly direction: "asc" | "desc";
    };

/** Một yêu cầu một trang kết quả trên một chỉ mục; id mà chỉ mục không khai thì không khớp plugin nào. */
export interface MarketQuery {
  /**
   * Văn bản khớp MỜ với tên package, tác giả, keywords, và MỌI ngôn ngữ của tiêu đề, mô tả, danh mục cùng tiêu đề
   * nhãn. Mỗi từ phải khớp một từ trong một trường nào đó, theo tiền tố hoặc trong khoảng cách sửa tối đa 2.
   * Văn bản không có chữ cái hay chữ số khớp MỌI plugin.
   */
  readonly text?: string;
  /** Id danh mục mà plugin PHẢI có. */
  readonly category?: string;
  /** Các id nhãn mà plugin PHẢI có đủ. */
  readonly labels?: readonly string[];
  /** Thứ tự kết quả. */
  readonly sort: MarketSort;
  /** Số plugin khớp bị bỏ qua; số nguyên không âm. */
  readonly offset: number;
  /** Số plugin trả về tối đa; số nguyên từ 1 đến 100. */
  readonly limit: number;
  /** Đọc lại thay vì dùng tài liệu đã nhớ. */
  readonly refresh?: boolean;
  /**
   * `fetchedAt` của một trang trước: trả lời từ ĐÚNG tài liệu đó khi nó còn trong bộ nhớ, kể cả sau `cacheTtlMs`,
   * để các trang sau nối tiếp cùng một kết quả. Không có `refresh` thì tài liệu đã bị thay được trả lời như khi
   * không có trường này.
   */
  readonly fetchedAt?: number;
}

/** Một trang plugin khớp kèm dữ kiện chỉ mục mà khung nhìn thị trường hiển thị. */
export interface MarketSearchResult {
  /** URL chỉ mục trả lời. */
  readonly url: string;
  /** Tiêu đề chỉ mục. */
  readonly title: LocalizedText;
  /** Mô tả chỉ mục. */
  readonly description?: LocalizedText;
  /** Metadata chỉ mục khai. */
  readonly metadata: MarketIndexMetadata;
  /** Thời điểm đọc tài liệu trả lời trang này, Unix mili giây; khác giá trị nghĩa là khác tài liệu. */
  readonly fetchedAt: number;
  /** Các plugin khớp của trang này, theo thứ tự kết quả. */
  readonly entries: readonly MarketListingEntry[];
  /** Số plugin khớp trên TẤT CẢ các trang. */
  readonly total: number;
  /** `offset` của trang sau, hoặc null khi hết. */
  readonly nextOffset: number | null;
}
