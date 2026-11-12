/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Lớp đăng ký lệnh của MỘT phạm vi (global hoặc theo agent): bảng tên duy nhất + thông điệp trùng tên riêng cho từng loại phạm vi.
 */

import { NamedEntries } from "@deepseek-ai/dsh-scope";
import type { RegisteredCommand } from "./normalize.ts";

/** Toàn bộ đăng ký lệnh thuộc một lớp global hoặc theo phạm vi. */
export class CommandLayer {
  /** Bảng lệnh của lớp này, chèn theo thứ tự và từ chối tên trùng. */
  readonly commands: NamedEntries<RegisteredCommand>;

  /**
   * Tạo một lớp lệnh với chẩn đoán riêng cho phạm vi sở hữu nó.
   * Nhận: `scope` — chủ sở hữu theo phạm vi, hoặc `undefined` cho đăng ký toàn cục.
   */
  constructor(scope: object | undefined) {
    this.commands = new NamedEntries<RegisteredCommand>((name) =>
      new Error(
        scope === undefined
          ? `command "${name}" is already registered (for a per-agent variant, mount a command-injected plugin under that agent's \`agent.ctx\`)`
          : `command "${name}" is already registered in this scope`,
      ),
    );
  }

  /**
   * Cho biết lớp này có không giữ đăng ký lệnh nào.
   * Nhận: không.
   * Trả: `true` khi bảng lệnh rỗng.
   */
  isEmpty(): boolean {
    return this.commands.isEmpty();
  }
}
