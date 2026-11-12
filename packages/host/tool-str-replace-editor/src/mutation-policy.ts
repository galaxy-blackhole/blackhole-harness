/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Chính sách đột biến NGUYÊN VĂN của @deepseek-ai/dsh-tool-str-replace-editor: phân giải sandboxPolicy theo lời gọi và dịch lỗi FS_SANDBOX_DENIED thành dấu từ chối.
 */

import { FsError } from "@deepseek-ai/dsh-fs";
import { sandboxDenialMarker } from "@deepseek-ai/dsh-sandbox";

import type { EditorContext, EditorExec, ResolvedSandboxPolicy, SandboxPolicyService } from "./seams.ts";


/**
 * Nhận diện một lớp lỗi theo TÊN, bền với MỌI bản sao module của lớp đó.
 * Vì sao (01/11/2026): `FsError` được import qua peer `@deepseek-ai/dsh-fs`; trong test specifier đó phân giải về MỘT BẢN SAO
 * khác kernel nên `instanceof` trượt, khiến dấu từ chối sandbox KHÔNG được dịch và thông điệp gốc của fs
 * rò ra ngoài ("fake denied" thay vì dấu chuẩn "[sandbox: file access denied under … mode]").
 * Nhận: error — giá trị bắt được; name — tên lớp cần khớp.
 * Trả: true khi chuỗi prototype của lỗi chứa một lớp mang đúng tên đó.
 */
function isNamedError(error: unknown, name: string): boolean {
  try {
    if (!(error instanceof Error)) return false;
    for (let proto: object | null = Object.getPrototypeOf(error); proto !== null; proto = Object.getPrototypeOf(proto)) {
      const ctor = (proto as { constructor?: { name?: string } }).constructor;
      if (typeof ctor === "function" && ctor.name === name) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Cầu nối `ctx.fs.sandboxMode` → `ctx.sandboxPolicy` — NGUYÊN VĂN logic và nguyên văn chuỗi lỗi của bundle gốc. */
export class MutationPolicy {
  /** Service chính sách sandbox đã tra lúc `apply`; `undefined` khi fs không giam giữ. */
  private readonly policy: SandboxPolicyService | undefined;

  /**
   * Chụp chính sách sandbox của context đang mount.
   * Nhận: ctx — context plugin (đọc `ctx.fs.sandboxMode` và `ctx.get('sandboxPolicy')`).
   * Trả: không.
   * @throws {Error} khi fs giam giữ mà thiếu service `sandboxPolicy` — NGUYÊN VĂN thông điệp bản gốc.
   */
  constructor(ctx: EditorContext) {
    this.policy = ctx.fs.sandboxMode === void 0 ? void 0 : ctx.get("sandboxPolicy");
    if (ctx.fs.sandboxMode !== void 0 && this.policy === void 0) throw new Error("tool-str-replace-editor: the mounted filesystem confines but ctx.sandboxPolicy is missing");
  }

  /**
   * Phân giải chính sách cho một lời gọi — NGUYÊN VĂN bản gốc (chỉ chuyển `session` khi có agent).
   * Nhận: exec — ngữ cảnh thực thi của lời gọi.
   * Trả: chính sách đã phân giải, hoặc `undefined` khi fs không giam giữ.
   */
  resolve(exec: EditorExec): ResolvedSandboxPolicy | undefined {
    return this.policy?.resolve({ ...exec.agent === void 0 ? {} : { session: exec.agent.session } });
  }

  /**
   * Dịch lỗi fs thành dấu từ chối sandbox khi mã là `FS_SANDBOX_DENIED` — NGUYÊN VĂN bản gốc.
   * Nhận: error — lỗi fs ném ra; policy — chính sách đã phân giải của lời gọi.
   * Trả: lỗi gốc khi không phải từ chối sandbox, ngược lại `FsError` mới mang dấu từ chối.
   */
  mapError(error: unknown, policy: ResolvedSandboxPolicy | undefined): unknown {
    if (!isNamedError(error, "FsError") || (error as { code?: unknown }).code !== "FS_SANDBOX_DENIED") return error;
    // Bản gốc đọc thẳng `policy.mode`: không có chính sách thì ném TypeError — ép kiểu chỉ để giữ NGUYÊN hành vi đó.
    const mode = (policy as ResolvedSandboxPolicy).mode;
    return new FsError(sandboxDenialMarker(mode), "FS_SANDBOX_DENIED", { cause: error });
  }
}
