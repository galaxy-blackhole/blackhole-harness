/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Model-selection-settings (subpath
 *      @deepseek-ai/dsh-tool-subagent/model-selection-settings): dịch vụ subagentModelSelection —
 *      chủ sở hữu DUY NHẤT lựa chọn model cho tool giao việc, đọc hai tham chiếu Config SỐNG mỗi lượt
 *      gọi và trả bản TÁCH RỜI (kiểm bằng danh tính, không bằng so sâu — luật C6).
 */
import { Service, type Context, type Volatile } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
// Bản gốc mang dòng này ở ĐẦU module (dấu vết của `import type` phía upstream): nó chỉ nạp KIỂU, row
// không chạm `ctx.llm` ở đâu cả. Giữ nguyên để ĐỒ THỊ MODULE của ta khớp bản gốc từng specifier, và
// khai `@deepseek-ai/dsh-llm` là peer để kernel cấp ĐÚNG MỘT thể hiện.
import "@deepseek-ai/dsh-llm";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Lựa chọn model cho tool giao việc, đọc lúc một Session nhận tool đó. */
    subagentModelSelection: SubagentModelSelectionConfig;
  }
}

/** Một tuyến LLM con mà cấu hình người dùng cho phép chọn. */
export interface AllowedModelRoute {
  /** Id provider đã đăng ký trong LLM runtime. */
  readonly provider: string;
  /** Id model do provider sở hữu. */
  readonly model: string;
}

/** Lựa chọn đã lưu — hình dạng mà tool giao việc nhận ở mỗi lượt soạn Session. */
export interface SubagentModelSelectionSettings {
  /** Session soạn mới có nhận lựa chọn model hay không. */
  enabled: boolean;
  /** Danh sách tuyến con được phép chọn. */
  allowedModels: AllowedModelRoute[];
}

/** Cấu hình của row — hai THAM CHIẾU SỐNG (bản gốc: `Volatile` của schemastery). */
export interface Config {
  /** Trạng thái bật ban đầu, chỉ dùng khi tài liệu người dùng không ghi đè. */
  enabled: Volatile<boolean>;
  /** Danh sách tuyến ban đầu, chỉ dùng khi tài liệu người dùng không ghi đè. */
  allowedModels: Volatile<AllowedModelRoute[]>;
}

/** Schema một tuyến — dùng chung cho cấu hình triển khai và cấu hình người dùng của row. */
const AllowedModelRouteSchema = z.object({
  provider: z.string().min(1).required(),
  model: z.string().min(1).required(),
});

/**
 * Khoá danh tính cho một cặp provider/model.
 * Nhận: tuyến exact (provider + model).
 * Trả: khoá đóng kín, dùng phép so bằng khi dò tuyến trùng.
 */
function modelRouteKey(route: AllowedModelRoute): string {
  return `${route.provider}\0${route.model}`;
}

/**
 * Từ chối tuyến sai hình dạng hoặc trùng lặp tại biên cấu hình (tài liệu bền hoặc cấu hình triển khai).
 * Nhận: giá trị bất kỳ mà cấu hình đưa vào.
 * Trả: khẳng định mảng tuyến hợp lệ; ném lỗi với đúng ba thông điệp của bản gốc khi sai.
 */
function assertAllowedModelRoutes(routes: unknown): asserts routes is readonly AllowedModelRoute[] {
  if (!Array.isArray(routes)) throw new Error("subagent model selection requires an array of routes");
  const seen = new Set<string>();
  for (const candidate of routes as unknown[]) {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate) ||
      !("provider" in candidate) ||
      typeof (candidate as { provider: unknown }).provider !== "string" ||
      !("model" in candidate) ||
      typeof (candidate as { model: unknown }).model !== "string" ||
      (candidate as { provider: string }).provider.length === 0 ||
      (candidate as { model: string }).model.length === 0
    ) {
      throw new Error("subagent model selection requires non-empty provider and model ids");
    }
    const route: AllowedModelRoute = {
      provider: (candidate as { provider: string }).provider,
      model: (candidate as { model: string }).model,
    };
    const key = modelRouteKey(route);
    if (seen.has(key)) throw new Error(`subagent model selection repeats route "${route.provider}/${route.model}"`);
    seen.add(key);
  }
}

/**
 * Chủ sở hữu lựa chọn model cho tool giao việc, ĐỘC LẬP với mọi Host và mọi tầng vận chuyển.
 * Mỗi lượt đọc đọc lại hai tham chiếu Config của chính thực thể này.
 */
export class SubagentModelSelectionConfig extends Service {
  /** Tham chiếu Config SỐNG do tầng nạp cấp — KHÔNG sao chép giá trị lúc dựng. */
  private config: Config;

  /**
   * Schema cấu hình — hai trường dạng tham chiếu sống, có mặc định của bản gốc
   * (tắt sẵn · danh sách rỗng). `volatile()` biến mỗi trường thành tham chiếu để Settings sửa được
   * mà không dựng lại plugin.
   */
  static Config = z.object({
    enabled: z.boolean().default(false).volatile(),
    allowedModels: z.array(AllowedModelRouteSchema).default([]).volatile(),
  });

  /**
   * Đăng ký dịch vụ dưới tên `subagentModelSelection`.
   * Nhận: context chủ sở hữu tham chiếu Config, và cấu hình đã qua schema (hai tham chiếu sống).
   * Trả: không trả gì; hiệu ứng là dịch vụ đã cấp trên context.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "subagentModelSelection");
    this.config = config;
  }

  /**
   * Đọc lựa chọn cho lượt soạn Session kế tiếp, sau khi kiểm toàn vẹn danh sách tuyến.
   * Nhận: không (đọc hai tham chiếu Config sống, nên giá trị vừa được Settings sửa là thấy ngay).
   * Trả: object TÁCH RỜI `{ enabled, allowedModels }` — mảng mới và mỗi tuyến là bản sao mới, nên sửa
   * nó KHÔNG chạm cấu hình của dịch vụ; ném lỗi khi tuyến sai/trùng hoặc khi bật mà danh sách rỗng.
   */
  current(): SubagentModelSelectionSettings {
    const enabled = this.config.enabled.get();
    const allowedModels: readonly AllowedModelRoute[] = this.config.allowedModels.get();
    assertAllowedModelRoutes(allowedModels);
    if (enabled && allowedModels.length === 0) {
      throw new Error("enabled subagent model selection requires at least one allowed model");
    }
    return { enabled, allowedModels: allowedModels.map((route) => ({ ...route })) };
  }
}

/** Tên plugin — giữ NGUYÊN VĂN tên row gốc (tầng nạp và tài liệu khoá theo tên này). */
export const name = "subagent-model-selection-settings";

export default SubagentModelSelectionConfig;
