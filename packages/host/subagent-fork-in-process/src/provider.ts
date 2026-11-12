/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Backend FORK trong tiến trình của row subagent-fork-in-process: lớp provider (KHÔNG export ra
 *      artifact) + phép cắt TIỀN TỐ LƯỢT ĐÃ XONG của log phiên cha. Tách khỏi index.ts để artifact
 *      giữ ĐÚNG tập export của bản gốc.
 */
import type {
  ContinuableCreateRequest,
  ContinuableCreateSpec,
  SubagentCapabilities,
  SubagentProvider,
} from "@galaxy-blackhole/gbh-subagent";

/** Một sự kiện log phiên, lấy ĐÚNG kiểu mà hợp đồng `seed` của seam chấp nhận (không import thêm gói). */
export type SeedEvent = NonNullable<ContinuableCreateSpec["seed"]>[number];

/**
 * Hình dạng TỐI THIỂU của nguồn log mà phép cắt cần — khai theo CẤU TRÚC (không import
 * `@deepseek-ai/dsh-agent`/`dsh-session`): bản gốc chỉ đọc `parent.session.snapshotEvents()`,
 * nên đây đúng là bề mặt nó chạm tới, và một `Agent` thật thoả mãn hình dạng này.
 */
export interface ParentLogSource {
  /** Phiên sống của agent cha — nguồn sự thật bền của log. */
  readonly session: {
    /**
     * Ảnh chụp sự kiện của log phiên, theo thứ tự `seq`.
     * Nhận: không (bản gốc cũng không truyền khoảng).
     * Trả: mảng sự kiện chỉ đọc, chỉ số mảng TRÙNG với `seq` sống.
     */
    snapshotEvents(): readonly SeedEvent[];
  };
}

/**
 * Bảng năng lực start-time của provider `fork` — NGUYÊN VĂN bản gốc: `agentPreset: false` (con KHÔNG
 * chọn preset độc lập — nó thừa hưởng composition của cha), ba năng lực còn lại đều `true`.
 */
export const FORK_CAPABILITIES: SubagentCapabilities = {
  agentOptions: true,
  agentPreset: false,
  outputSchema: true,
  depthLimit: true,
};

/**
 * Tiền tố LƯỢT ĐÃ XONG của log cha: mọi sự kiện tới và bao gồm `turn/end` CUỐI CÙNG.
 * Lượt đang chạy bị loại (nó chưa cân bằng nên không thể phát lại thành phiên con hợp lệ); trước lượt
 * hoàn tất đầu tiên thì con bắt đầu tươi. Vì `seq` sống bằng chỉ số mảng, kết quả vẫn là seed hợp lệ
 * bắt đầu từ seq 0.
 * Nhận: nguồn log của agent cha (chỉ cần `session.snapshotEvents`).
 * Trả: mảng sự kiện liên tục từ seq 0; RỖNG khi chưa có lượt nào hoàn tất (mảng MỚI, không phải mảng của phiên).
 */
export function completedTurnPrefix(parent: ParentLogSource): SeedEvent[] {
  const events = parent.session.snapshotEvents();
  const lastEnd = events.findLast((event) => event.type === "turn/end");
  if (lastEnd === undefined) return [];
  return events.slice(0, lastEnd.seq + 1);
}

/**
 * Provider FORK: mỗi con là một Agent trên CÙNG context cordis nhưng được GIEO tiền tố lượt đã xong
 * của log cha ⇒ con thừa hưởng ngữ cảnh hội thoại thay vì bắt đầu tươi (trái với provider `spawn`,
 * bên trả `{}`).
 *
 * Vì sao chỉ khai `prepareContinuable` mà KHÔNG khai `start`: sự HIỆN DIỆN của phương thức đó là
 * năng lực "continuable" — nó chọn đường kích hoạt CỤC BỘ (continuation manager dựng Agent, giao prompt,
 * resume nguội, sở hữu và dọn dẹp), nên provider không bao giờ thấy Agent/handle/lượt của con.
 */
export class ForkInProcessProvider implements SubagentProvider {
  /** Tên đăng ký trong sổ `ctx.subagents` (mặc định `fork`, cấu hình được qua `providerName`). */
  readonly name: string;

  /**
   * Bốn năng lực start-time mà backend này nhận — xem {@link FORK_CAPABILITIES}.
   * Trải ra thành object MỚI cho TỪNG thực thể (không chia sẻ hằng): bản gốc khai object literal ngay
   * trong class field, nên hai provider khác nhau KHÔNG dùng chung một object — sửa một cái không lan
   * sang cái kia. Chia sẻ hằng là khác biệt hành vi mà phép so sâu KHÔNG bắt được (xem test).
   */
  readonly capabilities: SubagentCapabilities = { ...FORK_CAPABILITIES };

  /** CÓ thừa hưởng ngữ cảnh của cha: con được gieo tiền tố log (mô tả, không phải kiểm tra của seam). */
  readonly inheritsParentContext: boolean = true;

  /**
   * Dựng provider với tên đăng ký cho trước.
   * Nhận: tên duy nhất trong sổ provider (do `Config.providerName` quyết định).
   * Trả: thực thể provider sẵn sàng đăng ký (chưa đăng ký — việc đó thuộc `apply`).
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Phần đóng góp của provider vào VIỆC TẠO con continuable: FORK trả `{ seed }` khi cha đã có ít nhất
   * một lượt hoàn tất, và `{}` (KHÔNG có khoá `seed`) khi chưa có — seam hiểu vắng `seed` là "con tươi".
   * Nhận: yêu cầu tạo continuable của seam; chỉ trường `parent` được đọc (bản gốc cũng vậy).
   * Trả: Promise giải ra spec; `seed` là tiền tố lượt đã xong của log cha.
   */
  prepareContinuable(request: ContinuableCreateRequest): Promise<ContinuableCreateSpec> {
    // ADR 000d (08/11/2026 dev-1, Lead chỉ định): `Agent` của gói GBH KHÔNG khai `session.snapshotEvents` trong kiểu
    // (bản port thiếu khai kiểu) trong khi phiên THẬT của kernel CÓ — ép MỘT chỗ tại biên, không nới kiểu toàn cục.
    const seed = completedTurnPrefix(request.parent as unknown as ParentLogSource);
    return Promise.resolve(seed.length > 0 ? { seed } : {});
  }
}
