/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng dữ liệu của row plugin-package-inventory-deepseek: hai kiểu DÂY (`dsh_plugin_packages`)
 *      và các seam mà plugin chạm tới (loader · agents · agentPresets · pluginPackages ·
 *      deepseekLlmApiExtensions) khai theo CẤU TRÚC — bản gốc mượn kiểu từ dsh-agent · dsh-session ·
 *      dsh-deepseek-llm-api-extensions, đều NGOÀI bảng seam §3b, nên ở đây chỉ khai đúng phần dùng.
 */

/** Một gói plugin ĐANG hoạt động, kèm phiên bản khi đọc được từ manifest. */
export interface DeepSeekPluginPackageIdentity {
  /** Tên package trong manifest (`name`), nguyên văn. */
  readonly name: string;
  /** Phiên bản trong manifest, chỉ có mặt khi là chuỗi không rỗng. */
  readonly version?: string;
}

/** Giá trị trường `dsh_plugin_packages` gửi kèm mỗi request tới API DeepSeek chính thức. */
export interface DeepSeekPluginPackageInventoryExtension {
  /** Phiên bản hình dạng dây; bản gốc luôn gửi 1. */
  readonly version: 1;
  /** Danh sách gói đã khử trùng và SẮP XẾP theo (tên, phiên bản). */
  readonly packages: readonly DeepSeekPluginPackageIdentity[];
}

/** Một entry của cây Loader — chỉ phần row này đọc. */
export interface LoaderEntry {
  /** Tuỳ chọn của entry: tên module để nạp và cờ nhóm. */
  readonly options: { readonly name: string; readonly group?: boolean };
  /** Entry bị tắt trong cấu hình thì không tính là đang hoạt động. */
  readonly disabled?: boolean;
  /** Fiber cordis; `state === 2` là ACTIVE. */
  readonly fiber?: { readonly state?: number };
  /** Cây cha — nơi entry thừa hưởng base URL. */
  readonly parent: { readonly tree: { readonly ctx: { readonly baseUrl?: string } } };
}

/** Cây Loader: chỉ cần phép liệt kê entry. */
export interface LoaderTree {
  /** Liệt kê mọi entry của cây, kể cả entry bị tắt và entry nhóm. */
  entries(): Iterable<LoaderEntry>;
}

/** Một entry ĐANG hoạt động, đã rút về đúng dữ liệu cần cho phép phân giải danh tính. */
export interface ActiveEntry {
  /** Tên module mà entry nạp (gói trần, đường dẫn tương đối/tuyệt đối, hoặc id `cordis:`). */
  readonly moduleName: string;
  /** Base URL của cây chứa entry, khi có. */
  readonly baseUrl?: string;
  /** Neo thay thế cho module trong bố cục preset (`useHostBase`). */
  readonly bareBaseUrl?: string;
}

/** Kết quả tra gói của seam `pluginPackages`. */
export interface PackageLocation {
  /** Đường dẫn tuyệt đối tới `package.json` của gói. */
  readonly manifestPath: string;
}

/** Seam `pluginPackages`: tra vị trí gói theo tên, neo ở một URL. */
export interface PackageRegistry {
  /**
   * Tra manifest của một gói theo tên.
   * @param packageName - tên gói trần (ví dụ `@scope/ten`).
   * @param anchor - URL neo để tính đường dò.
   * @returns vị trí manifest, hoặc undefined khi không tra được.
   */
  packageOf(packageName: string, anchor: string): PackageLocation | undefined;
}

/** Một module trong bố cục preset của agent đang gọi. */
export interface PresetModule {
  /** Tên module, cùng hình dạng với entry của Loader. */
  readonly moduleName: string;
  /** true ⇒ phép phân giải phải neo ở base URL của HOST, không phải của cây preset. */
  readonly useHostBase?: boolean;
  /** Các trường khác của entry được giữ nguyên khi chuyển sang phép phân giải. */
  readonly [key: string]: unknown;
}

/** Một bố cục preset mà sổ preset trả về cho một agent. */
export interface PresetComposition {
  /** Các module cấu thành bố cục. */
  readonly modules: readonly PresetModule[];
}

/** Seam `agentPresets`: đọc bố cục đang đứng của agent gọi request. */
export interface AgentPresets {
  /**
   * Liệt kê bố cục của một agent.
   * @param agentContext - context của agent cần đọc.
   * @returns danh sách bố cục, mỗi bố cục kèm danh sách module.
   */
  inspectCompositions(agentContext: unknown): readonly PresetComposition[];
}

/** Một agent đã sống, chỉ cần context của nó để đọc bố cục preset. */
export interface AgentHandle {
  /** Context riêng của agent. */
  readonly ctx: unknown;
}

/** Seam `agents`: tra agent theo id phiên. */
export interface AgentsRegistry {
  /**
   * Tra agent đang giữ một phiên.
   * @param sessionId - id phiên đã đóng dấu kiểu.
   * @returns agent, hoặc undefined khi phiên không có agent đang sống.
   */
  get(sessionId: string): AgentHandle | undefined;
}

/** Request của một lượt gọi API mà trường `dsh_plugin_packages` được tính cho nó. */
export interface DeepSeekRequestLike {
  /** Phiên đã khởi phát request; vắng mặt khi request không thuộc phiên nào. */
  readonly sessionId?: string;
}

/** Một trường mở rộng đăng ký vào sổ `deepseekLlmApiExtensions`. */
export interface DeepSeekExtensionContribution {
  /**
   * Tính giá trị trường cho MỘT request.
   * @param request - request đang chuẩn bị gửi.
   * @returns vật chứa `value` là giá trị sẽ đi trên dây.
   */
  prepare(request: DeepSeekRequestLike): { readonly value: DeepSeekPluginPackageInventoryExtension };
}

/** Sổ đăng ký trường mở rộng request của API DeepSeek. */
export interface DeepSeekExtensionRegistry {
  /**
   * Đăng ký một trường mở rộng.
   * @param field - tên trường trên dây (bản gốc dùng `dsh_plugin_packages`).
   * @param contribution - bộ tính giá trị của trường.
   * @returns không trả gì; bản gốc cũng bỏ qua hàm gỡ.
   */
  register(field: string, contribution: DeepSeekExtensionContribution): void;
}

/** Log của kernel — chỉ phần row này dùng. */
export interface InventoryLogger {
  /**
   * Ghi cảnh báo, kèm tham số định dạng kiểu `%s`/`%o` như bản gốc.
   * @param message - câu định dạng.
   * @param args - tham số định dạng.
   * @returns không trả gì.
   */
  warn(message: string, ...args: readonly unknown[]): void;
}

/** Context cordis mà plugin dùng, khai theo CẤU TRÚC: năm seam, không import gói seam nào. */
export interface PluginPackageInventoryContext {
  /** Base URL của cây host; vắng mặt thì dùng URL của chính bundle này. */
  readonly baseUrl?: string;
  /** Cây Loader: nguồn của danh sách entry đang hoạt động. */
  readonly loader: LoaderTree;
  /** Sổ agent: cần để đọc bố cục preset của agent đang gọi. */
  readonly agents: AgentsRegistry;
  /** Sổ trường mở rộng request DeepSeek: nơi trường `dsh_plugin_packages` được đăng ký. */
  readonly deepseekLlmApiExtensions: DeepSeekExtensionRegistry;
  /** Log của kernel. */
  readonly logger: InventoryLogger;
  /**
   * Đọc một service TUỲ CHỌN của kernel (có thể vắng mặt).
   * @param key - tên service (`agentPresets` · `pluginPackages`).
   * @returns service, hoặc undefined khi kernel không cấp.
   */
  get(key: string): unknown;
}
