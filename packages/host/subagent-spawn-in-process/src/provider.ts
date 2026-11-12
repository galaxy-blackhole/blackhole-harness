/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Backend SPAWN trong tiến trình của row subagent-spawn-in-process: lớp provider (KHÔNG export ra artifact)
 *      + bảng năng lực start-time. Tách khỏi index.ts để artifact giữ ĐÚNG tập export của bản gốc.
 */
import type { ContinuableCreateSpec, SubagentCapabilities, SubagentProvider } from "@galaxy-blackhole/gbh-subagent";

/**
 * Bảng năng lực start-time của provider `spawn` — NGUYÊN VĂN bản gốc: đủ CẢ BỐN năng lực, kể cả
 * `agentPreset` (chọn preset độc lập với composition của cha ⇒ chỉ hợp lệ khi KHÔNG thừa hưởng ngữ cảnh).
 */
export const SPAWN_CAPABILITIES: SubagentCapabilities = {
  agentOptions: true,
  agentPreset: true,
  outputSchema: true,
  depthLimit: true,
};

/**
 * Provider SPAWN: mỗi con là một Agent MỚI trên CÙNG context cordis — phiên riêng, system prompt riêng,
 * KHÔNG mang ngữ cảnh của cha (trái với provider `fork`, bên thứ hai gieo tiền tố lượt đã xong của cha).
 *
 * Vì sao chỉ khai `prepareContinuable` mà KHÔNG khai `start`: sự HIỆN DIỆN của phương thức đó là
 * năng lực "continuable" — nó chọn đường kích hoạt CỤC BỘ (continuation manager dựng Agent, giao prompt,
 * resume nguội, sở hữu và dọn dẹp), nên provider không bao giờ thấy Agent/handle/lượt của con.
 */
export class SpawnInProcessProvider implements SubagentProvider {
  /** Tên đăng ký trong sổ `ctx.subagents` (mặc định `spawn`, cấu hình được qua `providerName`). */
  readonly name: string;

  /**
   * Bốn năng lực start-time mà backend này nhận — xem {@link SPAWN_CAPABILITIES}.
   * Trải ra thành object MỚI cho TỪNG thực thể (không chia sẻ hằng): bản gốc khai object literal ngay
   * trong class field, nên hai provider khác nhau KHÔNG dùng chung một object — sửa một cái không lan
   * sang cái kia. Chia sẻ hằng là khác biệt hành vi mà phép so sâu KHÔNG bắt được.
   */
  readonly capabilities: SubagentCapabilities = { ...SPAWN_CAPABILITIES };

  /** KHÔNG thừa hưởng ngữ cảnh của cha: con bắt đầu từ log RỖNG (mô tả, không phải kiểm tra của seam). */
  readonly inheritsParentContext: boolean = false;

  /**
   * Dựng provider với tên đăng ký cho trước.
   * Nhận: tên duy nhất trong sổ provider (do `Config.providerName` quyết định).
   * Trả: thực thể provider sẵn sàng đăng ký (chưa đăng ký — việc đó thuộc `apply`).
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Phần đóng góp của provider vào VIỆC TẠO con continuable: SPAWN trả RỖNG, tức KHÔNG có `seed` ⇒ phiên
   * của con không mang sự kiện nào của cha.
   * Nhận: yêu cầu tạo continuable của seam (không dùng — bản gốc cũng không đọc trường nào).
   * Trả: Promise giải ra `{}`; seam hiểu vắng `seed` là "con tươi".
   */
  prepareContinuable(): Promise<ContinuableCreateSpec> {
    return Promise.resolve({});
  }
}
