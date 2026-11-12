/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Default-model: dịch vụ `agentDefaultModel` — model
 *      MẶC ĐỊNH dùng chung cho mọi điểm vào Agent. Mỗi lượt đọc lấy từ tham chiếu Config SỐNG;
 *      mỗi lượt ghi đẩy lựa chọn ĐẦY ĐỦ vào profile qua seam `configEditor`. Nguồn đối chiếu: README.md (G4).
 */
import { Service, type Context, type Volatile } from "@deepseek-ai/cordis";
import type { ModelSelection } from "@deepseek-ai/dsh-agent";
import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import z from "@deepseek-ai/schemastery";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Lựa chọn model mặc định cho Agent tạo ra mà không nêu model rõ ràng. */
    agentDefaultModel: AgentDefaultModelConfig;
  }
}

/** Cấu hình của row — ba THAM CHIẾU SỐNG (bản gốc: `Volatile` của schemastery). */
export interface Config {
  /** Tuyến provider đã đăng ký (bắt buộc). */
  provider: Volatile<string>;
  /** Id model do provider sở hữu (bắt buộc). */
  model: Volatile<string>;
  /** Mức suy luận do adapter sở hữu; vắng mặt thì theo mặc định của provider. */
  reasoningEffort: Volatile<string | undefined>;
}

/** Ba giá trị ĐÃ ĐỌC khỏi tham chiếu Config — đầu vào của phép chiếu `selection`. */
interface StoredSelection {
  /** Tuyến provider. */
  provider: string;
  /** Id model. */
  model: string;
  /** Mức suy luận thô (chuỗi chưa đóng dấu hiệu), hoặc `undefined` khi cấu hình không khai. */
  reasoningEffort?: string;
}

/** Hình dạng tối thiểu của seam `settings` mà row này chạm tới (một lời gọi `configure`). */
interface SettingsSeam {
  /** Sổ mẫu cấu hình của kernel: chính sách trang tự động của MỘT thể hiện plugin. */
  settings: {
    /** Đăng ký chính sách trang cho thể hiện `owner`; trả disposer. */
    configure(presentation: { auto?: boolean }, owner?: unknown): () => void;
  };
}

/** Hình dạng tối thiểu của seam `configEditor` mà row này dùng (một phương thức `edit`). */
interface ConfigEditorSeam {
  /** Ghi cấu hình THÔ đầy đủ cho một mục profile; trả promise hoàn tất sau khi Loader đối soát. */
  edit(
    entry: unknown,
    change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<void>;
}

/**
 * Chiếu cấu hình đã lưu sang kiểu lựa chọn mà điểm vào Agent nhận.
 * Nhận: ba giá trị đã đọc khỏi tham chiếu Config (chuỗi thô, có thể thiếu `reasoningEffort`).
 * Trả: object MỚI `{ provider, model }` kèm `reasoningEffort` ĐÃ ĐÓNG DẤU HIỆU — chỉ khi cấu hình có khai.
 */
function selection(settings: StoredSelection): ModelSelection {
  return {
    provider: settings.provider,
    model: settings.model,
    ...(settings.reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(settings.reasoningEffort) }),
  };
}

/**
 * Sở hữu lựa chọn model mặc định, ĐỘC LẬP với mọi Host và mọi tầng vận chuyển.
 * Mỗi lượt thao tác đều đọc lại tham chiếu Config của chính thực thể này.
 */
export class AgentDefaultModelConfig extends Service {
  /** Context sở hữu tham chiếu Config (cũng là nơi lấy `fiber.entry` của mục profile). */
  private readonly ownerContext: Context;

  /** Tham chiếu Config SỐNG do tầng nạp cấp — KHÔNG sao chép giá trị lúc dựng. */
  private readonly config: Config;

  /** Hàng đợi tuần tự: mỗi lượt ghi chờ lượt trước, kể cả khi người gọi chồng lên nhau. */
  private saves: Promise<void> = Promise.resolve();

  /**
   * Schema cấu hình — hai trường bắt buộc dạng tham chiếu sống, một trường tuỳ chọn.
   * `volatile()` biến mỗi trường thành tham chiếu để Settings/config-editor sửa được mà không dựng lại plugin.
   */
  static Config = z.object({
    provider: z.string().required().volatile(),
    model: z.string().required().volatile(),
    reasoningEffort: z.string().volatile(),
  });

  /**
   * Đăng ký dịch vụ dưới tên `agentDefaultModel` và xin seam `settings` một chính sách trang TẮT tự động.
   * Nhận: context sở hữu tham chiếu Config, và cấu hình đã qua schema (ba tham chiếu sống).
   * Trả: không trả gì; hiệu ứng là dịch vụ đã đăng ký + một hiệu ứng `configure({ auto: false })` trên fiber chủ.
   */
  constructor(ownerContext: Context, config: Config) {
    super(ownerContext, "agentDefaultModel");
    this.ownerContext = ownerContext;
    this.config = config;
    ownerContext.inject(["settings"], (child) => {
      const seam = child as unknown as SettingsSeam;
      child.effect(() => seam.settings.configure({ auto: false }, ownerContext.fiber));
    });
  }

  /**
   * Đọc lựa chọn model mặc định hiện tại.
   * Nhận: không (đọc ba tham chiếu Config sống, nên giá trị vừa được Settings sửa là thấy ngay).
   * Trả: object TÁCH RỜI `{ provider, model, reasoningEffort? }` — sửa nó KHÔNG chạm cấu hình của dịch vụ.
   */
  currentSelection(): ModelSelection {
    const reasoningEffort = this.config.reasoningEffort.get();
    return selection({
      provider: this.config.provider.get(),
      model: this.config.model.get(),
      ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    });
  }

  /**
   * Ghi lựa chọn model mặc định ĐẦY ĐỦ vào profile. Triển khai không có config-editor thì giữ nguyên mục
   * thành phần. Các lượt ghi xếp hàng theo thứ tự nộp; một lượt ghi hỏng làm promise của CHÍNH người gọi
   * đó bị từ chối nhưng KHÔNG chặn các lượt ghi sau.
   * Nhận: lựa chọn đã phân giải mà một điểm vào chấp nhận (`reasoningEffort` đã đóng dấu hiệu hoặc vắng mặt).
   * Trả: promise hoàn tất sau khi lượt ghi profile (tuỳ chọn) kết thúc.
   */
  async saveSelection(next: ModelSelection): Promise<void> {
    const entry = (this.ownerContext.fiber as unknown as { entry?: unknown }).entry;
    if (entry === undefined) return;
    const editor = this.ctx.get("configEditor") as ConfigEditorSeam | undefined;
    if (editor === undefined) return;
    const config: Record<string, unknown> = {
      provider: next.provider,
      model: next.model,
      ...(next.reasoningEffort === undefined ? {} : { reasoningEffort: String(next.reasoningEffort) }),
    };
    const saved = this.saves.then(() => editor.edit(entry, () => config));
    this.saves = saved.catch(() => {});
    await saved;
  }
}

export default AgentDefaultModelConfig;
