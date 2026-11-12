/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu công khai của seam năng lực KỸ NĂNG (`ctx.skills`): mô tả nguồn — nhà cung cấp —
 *      ứng viên — định nghĩa — chính sách gọi, kèm hai phép nối kiểu với kernel (Context/Events)
 *      và với tầng tin nhắn (MessageSourceMap)
 */

import type { SkillRegistry } from "./registry.ts";
// Mượn KIỂU của tầng tin nhắn: phép nối kiểu `MessageSourceMap` bên dưới chỉ hợp lệ khi tệp này
// thật sự nạp mô-đun đó (không cần giá trị lúc chạy — nên chỉ nằm ở devDependencies).
import type { MessageSourceMap } from "@deepseek-ai/dsh-llm";
import type { ScopeKey } from "@deepseek-ai/dsh-scope";

/** Nhóm xuất xứ của một đóng góp kỹ năng — là SIÊU DỮ LIỆU hiện cho model thấy, tự nó không quyết định thứ tự thắng. */
export type SkillSource =
  | "project-dsh"
  | "project-agents"
  | "runtime"
  | "user-dsh"
  | "user-agents"
  | "custom"
  | "bundled"
  | (string & {});

/** Gốc tài nguyên tuỳ nhà cung cấp, dùng để phân giải đường dẫn tương đối nêu trong thân kỹ năng. */
export type SkillResourceBase =
  | { readonly kind: "directory"; readonly path: string }
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "opaque"; readonly description: string };

/** Công tắc gọi dùng chung cho mọi bên tiêu thụ phép dò kỹ năng. */
export interface SkillInvocationPolicy {
  /** Có đưa kỹ năng vào catalog/loader phía MODEL hay không. */
  readonly modelInvocable: boolean;
  /** Có đưa kỹ năng vào catalog/loader phía NGƯỜI (lệnh) hay không. */
  readonly userInvocable: boolean;
}

/** Siêu dữ liệu TRUNG TÍNH với cách gọi, do `ctx.skills.list()` trả về. */
export interface SkillSummary {
  /** Đường dẫn tuyệt đối tới tệp chỉ dẫn khi nhà cung cấp có cấp; vắng với kỹ năng ảo. */
  readonly path?: string;
  /** Định danh kebab-case dùng để gọi kỹ năng. */
  readonly name: string;
  /** Mô tả ngắn để định tuyến, hiện cho bên tiêu thụ phép dò. */
  readonly description: string;
  /** Hướng dẫn định tuyến bổ sung, tuỳ chọn. */
  readonly whenToUse?: string;
  /** Công tắc gọi đã phân giải cho cả model lẫn người. */
  readonly invocation: SkillInvocationPolicy;
  /** Nguồn dò đã sinh ra kỹ năng thắng này. */
  readonly source: SkillSource;
  /** Nhà cung cấp sở hữu thân kỹ năng. */
  readonly provider: string;
  /** Gốc tài nguyên tuỳ nhà cung cấp, dùng để phân giải tài nguyên tương đối. */
  readonly resourceBase?: SkillResourceBase;
}

/** Mục trong catalog của nhà cung cấp — đủ để sổ đăng ký gộp và sau đó nạp thân kỹ năng. */
export interface SkillCandidate extends SkillSummary {
  /** Hạng càng NHỎ càng thắng khi trùng tên, trước khi xét thứ tự đăng ký nhà cung cấp. */
  readonly rank: number;
  /** Tay nắm mờ do nhà cung cấp sở hữu, được trả lại nguyên vẹn cho `provider.get()`. */
  readonly locator: unknown;
  /** Vật thể siêu dữ liệu tuỳ chọn đã phân tích từ frontmatter riêng của nhà cung cấp. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Định nghĩa kỹ năng ĐẦY ĐỦ, gồm cả thân do `ctx.skills.get()` nạp. */
export interface SkillDefinition extends SkillSummary {
  /** Thân chỉ dẫn Markdown sau khi đã bỏ siêu dữ liệu riêng của nhà cung cấp. */
  readonly content: string;
  /** Vật thể siêu dữ liệu tuỳ chọn đã phân tích từ frontmatter. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Đóng góp kỹ năng RUNTIME mà `ctx.skills.register()` nhận. */
export type SkillRegistration = Omit<SkillDefinition, "invocation" | "provider"> & {
  /** Công tắc gọi; bỏ trống nghĩa là mở cả mặt model lẫn mặt người. */
  readonly invocation?: SkillInvocationPolicy;
  /** Nhãn nhà cung cấp; bỏ trống thì dùng nhà cung cấp `runtime` của sổ đăng ký. */
  readonly provider?: string;
};

/** Ngữ cảnh của bên gọi, dùng cho lượt dò phụ thuộc cwd và lượt nạp có thể huỷ. */
export interface SkillLookupOptions {
  /** Bộ chọn workspace cho lượt tra hiện tại. */
  readonly cwd?: string | undefined;
  /** Huỷ lượt dò hoặc lượt nạp của bên gọi hiện tại. */
  readonly signal?: AbortSignal | undefined;
}

/**
 * Tuỳ chọn ĐỌC của sổ đăng ký: ngữ cảnh tra của nhà cung cấp cộng phạm vi đang nhìn.
 * Sổ đăng ký dùng `scope` để chọn lớp; nhà cung cấp nhận CHÍNH vật thể tuỳ chọn này và chỉ đọc
 * phần thuộc hợp đồng {@link SkillLookupOptions}.
 */
export interface SkillViewOptions extends SkillLookupOptions {
  /** Phạm vi đang nhìn (agent gọi); bỏ trống thì chỉ đọc lớp toàn cục. */
  readonly scope?: ScopeKey | undefined;
}

/**
 * Nguồn BỀN của tin ngữ cảnh mà một lượt gọi kỹ năng do NGƯỜI chỉ định chèn vào: lời của người
 * dùng đi bằng tin người bình thường, còn thân kỹ năng đã phơi đi sau đó như ngữ cảnh dạng
 * `instructions` mang nguồn này, để bên đọc bản ghi hiện phần chèn từ siêu dữ liệu thay vì
 * phân tích lại văn bản phía model.
 */
export interface SkillInvocationSource {
  /** Loại nguồn — luôn là `skill-invocation`. */
  readonly kind: "skill-invocation";
  /** Tên kỹ năng được gọi, đã kiểm là gọi-được-bởi-người tại ranh giới chèn. */
  readonly name: string;
  /** Thân kỹ năng được chèn là CHỈ DẪN cho model làm theo. */
  readonly form: "instructions";
}

/** Một lần quan sát catalog kèm cờ cho biết phép dò đã hoàn tất trong MỘT bản sửa đổi ổn định hay chưa. */
export interface SkillCatalogSnapshot {
  /** Bản tóm tắt trung tính với cách gọi, đã sắp xếp, thu được trong lần quan sát này. */
  readonly skills: SkillSummary[];
  /** Mọi nhà cung cấp đã đăng ký có hoàn tất mà không gặp bản sửa đổi catalog đồng thời hay không. */
  readonly complete: boolean;
}

/** Ứng viên của nhà cung cấp kèm cờ cho biết phép dò hiện tại đã là chính thức hay chưa. */
export interface SkillProviderObservation {
  /** Ứng viên sẵn có từ lượt dò hiện tại của nhà cung cấp. */
  readonly candidates: readonly SkillCandidate[];
  /** Phép dò đã hoàn tất và các ứng viên này đã được phép ghi nhớ hay chưa. */
  readonly complete: boolean;
}

/** Giao diện nhà cung cấp cho MỘT nguồn kỹ năng, ví dụ thư mục cục bộ hay sổ đăng ký từ xa. */
export interface SkillProvider {
  /** Tên nhà cung cấp DUY NHẤT trong sổ `ctx.skills`. */
  readonly name: string;
  /**
   * Liệt kê ứng viên sẵn có cho ngữ cảnh tra hiện tại. Plugin nhà cung cấp đăng ký ĐỒNG BỘ trong
   * `apply()`; khởi tạo từ xa, xác thực và phép dò được chờ ngay trong phương thức này. Bản cài
   * phải kết thúc sớm khi `options.signal` bị huỷ.
   * @param options - tuỳ chọn tra; `cwd` chọn kỹ năng phụ thuộc workspace và `signal` huỷ công việc.
   * @returns ứng viên dạng mảng-đầy-đủ (lối viết tắt), hoặc một quan sát tường minh khi ứng viên
   *   dùng được lại đến từ một phép dò CHƯA hoàn tất.
   */
  readonly list: (options: SkillLookupOptions) => Promise<readonly SkillCandidate[] | SkillProviderObservation>;
  /**
   * Nạp thân kỹ năng đầy đủ cho một ứng viên đã liệt kê trước đó.
   * @param candidate - ứng viên thắng do CHÍNH nhà cung cấp này trả về.
   * @param options - tuỳ chọn tra; `cwd` chọn kỹ năng phụ thuộc workspace và `signal` huỷ công việc.
   * @returns thân kỹ năng đầy đủ, hoặc `undefined` khi nó không còn nạp được nữa.
   */
  readonly get: (candidate: SkillCandidate, options: SkillLookupOptions) => Promise<SkillDefinition | undefined>;
}

/** Năng lực vòng đời và làm-mới, chỉ mượn trong phạm vi MỘT lượt đăng ký nhà cung cấp. */
export interface SkillProviderControl {
  /** Huỷ khi lượt đăng ký hỏng, hoặc khi ĐÚNG lượt đăng ký nhà cung cấp này bị dọn. */
  readonly signal: AbortSignal;
  /** Làm mới catalog đã xong và báo bên tiêu thụ, chỉ khi lượt đăng ký này còn sống. */
  readonly invalidate: () => void;
}

/** Cấu hình của sổ đăng ký kỹ năng. */
export interface Config {
  /** Số catalog (theo cwd/nhà cung cấp) đã xong được giữ trong bộ nhớ (mặc định 128). */
  readonly collectCacheMaxEntries?: number;
}

/**
 * Mặt cắt CẤU TRÚC cho nơi tiêu thụ cần `ctx.skills` (ADR 000d — KHÔNG augment module của gói stock).
 * Lý do bỏ augmentation `Context.skills`: gói stock `@deepseek-ai/dsh-skill` cũng khai `skills` với lớp
 * `SkillRegistry` CỦA NÓ ⇒ hai khai báo trùng tên property nhưng khác identity ⇒ TS2717 khi typecheck chung.
 * Nơi tiêu thụ dùng: `const skills = (ctx as unknown as SkillsContext).skills;`
 */
export interface SkillsContext {
  /** Sổ đăng ký kỹ năng do gói này cấp. */
  readonly skills: SkillRegistry;
}

declare module "@deepseek-ai/cordis" {
  interface Events {
    /**
     * Một nhà cung cấp, một đóng góp runtime hoặc một catalog có thể đã đổi. Đây là thông báo
     * làm-mới KHÔNG lọc; bên tiêu thụ tự đọc lại catalog theo tuỳ chọn tra của mình. Hỏng hóc của
     * người nghe được cô định, không bao giờ phủ quyết được thao tác đã làm đổi sổ.
     * @mode emit
     */
    "skills/change"(): void;
  }
}

declare module "@deepseek-ai/dsh-llm" {
  /** Phép nối kiểu CÓ THÂN: khai nguồn tin `skill-invocation` cho tầng tin nhắn. */
  interface MessageSourceMap {
    /** Một lượt gọi kỹ năng do NGƯỜI chỉ định, do host chèn vào. */
    "skill-invocation": SkillInvocationSource;
  }
}
