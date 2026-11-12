/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ai/dsh-agent-preset — MỘT lớp plugin khai
 *      một preset agent (id · tên · mô tả · thứ tự · danh sách plugin con) lên sổ `agentPresets` của kernel.
 *      Bốn row của cây thật (preset-standard · preset-ptc · preset-minimal · preset-cordis) trỏ tới
 *      CÙNG gói này và khác nhau CHỈ ở `config`. Nguồn đối chiếu: README.md của package (G4) và
 *      lib/index.js của bản gốc (29 dòng, CHỈ ĐỌC).
 */
import { Service, type Context } from "@deepseek-ai/cordis";
import { EntryGroup } from "@deepseek-ai/cordis-plugin-loader";
import type AgentPresetRegistry from "@galaxy-blackhole/gbh-agent-preset-registry";

/**
 * Định nghĩa preset mà sổ preset nhận — LẤY TỪ chính tham số public `register()` của gói GBH
 * (`gbh-agent-preset-registry` không mở subpath `./src/*` và entry không tái xuất tên kiểu này),
 * nên không phải phụ thuộc đường dẫn nội bộ của gói khác.
 */
type PresetDefinition = Parameters<InstanceType<typeof AgentPresetRegistry>["register"]>[0];
import z from "@deepseek-ai/schemastery";

/**
 * Seam CẤU TRÚC của sổ preset (ADR 000d — PHASE B 08/11/2026, dev-1): CHỈ khai đúng phần ta dùng nên không
 * phụ thuộc augmentation `declare module "@deepseek-ai/cordis"` của bản stock (gói GBH cố ý không augment Context).
 */
interface PresetRegistryLike {
  /**
   * Đăng ký một định nghĩa preset lên sổ của kernel.
   * Nhận: definition — định nghĩa preset của row (đã qua schema).
   * Trả: hàm huỷ đăng ký; cordis gọi hàm này khi fiber bị dispose.
   */
  register(definition: PresetDefinition): Promise<() => Promise<void>>;
}

/**
 * Lấy seam theo CẤU TRÚC: ưu tiên `ctx.get(name)` (đường chính thức của cordis), chạm dự phòng thuộc tính
 * cùng tên (kernel cũ và giàn test chỉ phơi thuộc tính). Trả undefined khi không có ⇒ nơi gọi tự nổ.
 * Nhận: ctx — context cordis (hoặc vật giả trong test); name — tên service.
 * Trả: seam nếu có, ngược lại undefined.
 */
function seamOf<T>(ctx: unknown, name: string): T | undefined {
  const holder = ctx as { get?: (key: string) => unknown; [key: string]: unknown };
  const viaGet = typeof holder.get === "function" ? holder.get(name) : undefined;
  const value = viaGet ?? holder[name];
  return (value ?? undefined) as T | undefined;
}

/** Cấu hình của một row preset — NGUYÊN VĂN `PresetDefinition` mà sổ preset nhận (bản gốc: `type Config = PresetDefinition`). */
export type Config = PresetDefinition;

/**
 * Một row preset khai báo trong composition cordis thường (bản gốc: lớp `AgentPreset`).
 *
 * Lớp này **không sở hữu Agent**: nó chỉ đăng ký định nghĩa preset lên seam `agentPresets` rồi giữ
 * disposer mà seam trả về, nên Agent đang chạy theo revision cũ không bị gỡ khi row này dispose.
 * Vì vậy nó KHÔNG kế thừa `Service` (bản gốc cũng không): nó là plugin dạng lớp có `[Service.init]`.
 */
export default class AgentPreset {
  /** Seam bắt buộc: sổ preset của kernel (`ctx.agentPresets`) — do row `agent-preset-registry` cấp. */
  static inject = ["agentPresets"];

  /** Giữ NGUYÊN biểu thức `!!js` của các row con cho tới khi chính plugin của chúng kích hoạt. */
  static [EntryGroup.key] = true;

  /**
   * Schema cấu hình của row — NGUYÊN VĂN năm trường của bản gốc (`id` và `plugins` bắt buộc),
   * để config-editor của kernel render được field và tầng nạp từ chối cấu hình thiếu.
   */
  static Config = z.object({
    id: z.string().required(),
    name: z.string(),
    description: z.string(),
    order: z.number(),
    plugins: z.array(z.any()).required(),
  });

  /** Context của fiber chứa seam `agentPresets`. */
  private readonly ctx: Context;

  /** Định nghĩa preset của CHÍNH row này (đã qua schema của tầng nạp). */
  private readonly config: Config;

  /**
   * Giữ context và cấu hình; KHÔNG chạm seam (việc đăng ký nằm ở `[Service.init]`).
   * Nhận: context đã có seam `agentPresets`, và định nghĩa preset của row.
   * Trả: không trả gì (chỉ gán hai trường).
   */
  constructor(ctx: Context, config: Config) {
    this.ctx = ctx;
    this.config = config;
  }

  /**
   * Đăng ký định nghĩa preset lên sổ preset và GIỮ disposer của sổ.
   * Nhận: không tham số — đọc `this.ctx` và `this.config`.
   * Trả: generator nhả ĐÚNG MỘT hàm `() => Promise<void>`; cordis gọi hàm đó khi fiber bị dispose.
   */
  async *[Service.init](): AsyncGenerator<() => Promise<void>, void, unknown> {
    // task-173: cây config (Sổ cài đặt → Plugin) phải mang id GBH, không chỉ lúc mount. Ta viết lại `plugins`
    // ngay trên ROW của mình (entry.options.config) để plugin-manager đọc thấy tên GBH, RỒI đăng ký bản đã đổi.
    // FAIL-SOFT: lỗi đọc bản đồ không bao giờ làm chết boot (chỉ warn 1 lần) — giữ nguyên tên stock như trước.
    const plugins = redirectPresetPlugins(this.ctx, this.config.plugins);
    const config = (plugins === this.config.plugins ? this.config : { ...this.config, plugins }) as Config;
    if (plugins !== this.config.plugins) writeBackRowConfig(this.ctx, plugins);
    // PHASE B: sổ preset lấy qua SEAM CẤU TRÚC `ctx.get` thay vì thuộc tính augment `ctx.agentPresets`;
    // thiếu seam là lỗi cấu hình ⇒ nổ NGAY (fail loud như hành vi bản gốc).
    const registry = seamOf<PresetRegistryLike>(this.ctx, "agentPresets");
    if (registry === undefined) throw new TypeError('agent-preset requires the agentPresets seam (ctx.get("agentPresets"))');
    yield await registry.register(config);
  }
}


/**
 * Đổi tên plugin con của một preset từ id stock sang id GBH bằng dịch vụ sổ preset của TA
 * (`agentPresets.redirectNestedNames` — registry GBH cài đặt; kernel stock không có ⇒ trả nguyên bản).
 * Nhận: ctx — context có seam `agentPresets`; plugins — danh sách entry preset (có thể lồng group).
 * Trả: danh sách đã đổi, hoặc CHÍNH mảng vào khi không đổi / dịch vụ không hỗ trợ (fail-soft).
 */
export function redirectPresetPlugins(ctx: unknown, plugins: readonly unknown[]): readonly unknown[] {
  try {
    const service = (ctx as { agentPresets?: { redirectNestedNames?: (value: readonly unknown[]) => unknown[] } }).agentPresets;
    if (typeof service?.redirectNestedNames !== "function") return plugins;
    const rewritten = service.redirectNestedNames(plugins);
    return Array.isArray(rewritten) && JSON.stringify(rewritten) !== JSON.stringify(plugins) ? rewritten : plugins;
  } catch (error) {
    console.warn("agent-preset: khong doi duoc ten row long ⇒ giu ten stock: " + String(error));
    return plugins;
  }
}

/**
 * Ghi danh sách plugin ĐÃ ĐỔI vào cây cấu hình sống của loader (entry của CHÍNH row preset này), để
 * Sổ cài đặt → Plugin đọc thấy id GBH. Chỉ đổi khoá `config.plugins`; giữ nguyên mọi khoá khác + số entry.
 * Nhận: ctx — context của plugin; plugins — danh sách đã đổi. Trả: true khi đã ghi được.
 */
export function writeBackRowConfig(ctx: unknown, plugins: readonly unknown[]): boolean {
  try {
    const context = ctx as { fiber?: { entry?: { options?: { config?: unknown } } }; [key: symbol]: unknown };
    const entry = context.fiber?.entry ?? (context[Symbol.for("cordis.entry")] as { options?: { config?: unknown } } | undefined);
    const options = entry?.options;
    if (options === undefined || typeof options.config !== "object" || options.config === null) return false;
    options.config = { ...(options.config as Record<string, unknown>), plugins };
    return true;
  } catch (error) {
    console.warn("agent-preset: khong ghi duoc id GBH vao cay config (plugin manager se thay id stock): " + String(error));
    return false;
  }
}
