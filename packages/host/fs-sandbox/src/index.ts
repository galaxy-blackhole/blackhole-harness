/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Backend hệ tệp CƯỠNG CHẾ sandbox cho seam `ctx.fs`: rào `writeText`/`editText` theo
 *      chính sách của TỪNG lời gọi (read-only từ chối mọi thay đổi, workspace-write giam đích trong gốc
 *      workspace + vùng tạm của nền tảng), còn ĐỌC đi xuyên không rào — bản viết lại của
 *      @deepseek-ai/dsh-fs-sandbox (row `fs-sandbox`)
 */

import type { Context } from "@deepseek-ai/cordis";
import { FsError } from "@deepseek-ai/dsh-fs";
import type { FsEditOutcome, FsEditRequest, FsTarget, FsVersion, FsWriteIntent, FsWriteOutcome } from "@deepseek-ai/dsh-fs";
import { LocalFileSystem } from "@deepseek-ai/dsh-fs-local";
import type { Config as LocalConfig } from "@deepseek-ai/dsh-fs-local";
import { writableRoots } from "@deepseek-ai/dsh-sandbox";
import type { SandboxExecutionPolicy, SandboxMode } from "@deepseek-ai/dsh-sandbox";
import type { SandboxPolicyService } from "@deepseek-ai/dsh-sandbox-policy";
import { isPathUnder } from "./containment.ts";

/**
 * Cấu hình plugin: đúng các núm của backend CỤC BỘ, nguyên văn (`cwd` làm mặc định phân giải đường
 * dẫn tương đối, và `diffBasisMaxBytes` chặn kích thước phần trình bày ghi đè). Chính sách sandbox —
 * chế độ mặc định và gốc `workspace-write` dự phòng — KHÔNG nằm ở đây: nó sống trên
 * `ctx.sandboxPolicy`, nơi giải chế độ + cwd của TỪNG phiên gọi cho mọi năng lực cưỡng chế.
 */
export type Config = LocalConfig;

/** Seam `sandboxPolicy` mà row này đọc để lấy chế độ mặc định và chính sách của từng lời gọi. */
type SandboxPolicySeam = SandboxPolicyService;

/**
 * Backend hệ tệp CƯỠNG CHẾ sandbox. Nó kế thừa `LocalFileSystem` nên TOÀN BỘ cơ chế lưu trữ văn bản —
 * phân giải, `stat`, đọc/luồng, liệt kê, phép ghi nguyên tử và vùng tới hạn đọc–so–ghi của phép sửa —
 * là của backend cục bộ, nguyên văn; gói này chỉ thêm RÀO CHÍNH SÁCH cho hai phép thay đổi. Đọc đi
 * xuyên không rào: mọi chế độ đều cho phép đọc.
 *
 * Rào là phép kiểm chính sách trong mã TIN CẬY trên một đường dẫn do MODEL điều khiển, KHÔNG phải biên
 * giới kernel — các thao tác là của chính seam (`open`, `rename`), và chỉ đường dẫn đích là không tin
 * cậy, nên "chuẩn tắc hoá rồi giam" là câu trả lời ĐẦY ĐỦ cho bề mặt này. Đây là giam đường dẫn, không
 * phải biên giới an ninh; cách ly MÃ không tin cậy ở mức kernel vẫn là việc của `ctx.shell`
 * (`@deepseek-ai/dsh-bash-sandbox`). Khe TOCTOU còn lại (một tổ tiên symlink bị đổi giữa lần kiểm giam
 * và lời gọi hệ thống) được thu hẹp nhờ chuẩn tắc hoá LẠI ngay trước khi uỷ quyền, và được chấp nhận
 * cho mô hình mối đe doạ này.
 *
 * Chính sách theo TỪNG lời gọi: `read-only` từ chối mọi thay đổi; `workspace-write` chỉ cho thay đổi khi
 * đích chuẩn tắc hoá nằm dưới gốc workspace của chính sách hoặc một vùng tạm của nền tảng (từ hàm
 * `writableRoots` dùng chung); `danger-full-access` uỷ quyền không rào. Một lần từ chối ném lỗi có
 * cấu trúc `FS_SANDBOX_DENIED`.
 */
export class SandboxedFileSystem extends LocalFileSystem {
  /** Seam bắt buộc: nhà chính sách sandbox cấp chế độ mặc định và chính sách từng lời gọi. */
  static inject = ["sandboxPolicy"];

  /** Chế độ mặc định của triển khai — sự thật năng lực mà tầng tool đọc để quảng bá đường nâng quyền. */
  private readonly defaultMode: SandboxMode;

  /**
   * Đăng ký làm `ctx.fs` thay cho backend cục bộ (nạp gói này THAY VÌ `dsh-fs-local`, cùng với một
   * `ctx.sandboxPolicy`, là toàn bộ phép hoán đổi — tầng tool nhìn thấy model không đổi); đòi seam
   * `sandboxPolicy`.
   * Nhận: context host (đã có `sandboxPolicy`) và cấu hình của backend cục bộ.
   * Trả: thực thể backend đã đăng ký, với chế độ mặc định đọc từ chính sách triển khai.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, config);
    this.defaultMode = (ctx as unknown as { sandboxPolicy: SandboxPolicySeam }).sandboxPolicy.defaultMode;
  }

  /**
   * Chế độ sandbox mặc định đã cấu hình — sự thật năng lực mà tầng tool đọc để quảng bá nâng quyền.
   * Nhận: không.
   * Trả: chế độ mặc định của triển khai (`read-only` | `workspace-write` | `danger-full-access`).
   */
  override get sandboxMode(): SandboxMode {
    return this.defaultMode;
  }

  /**
   * Rào phép GHI theo chính sách của lời gọi, rồi uỷ quyền cho phép ghi nguyên tử kế thừa. Xem
   * {@link SandboxedFileSystem.checkedTarget}.
   * Nhận: đích đã phân giải; nội dung mới đầy đủ; ý định ghi bảo vệ phép ghi (bỏ trống = vô điều kiện);
   * tín hiệu huỷ trước khi phép công bố nguyên tử có hiệu lực; chính sách của lời gọi (bỏ trống = dùng
   * chính sách dự phòng của triển khai).
   * Trả: kết cục ghi của backend kế thừa.
   */
  override async writeText(
    target: FsTarget,
    content: string,
    expected?: FsWriteIntent,
    signal?: AbortSignal,
    sandboxPolicy?: SandboxExecutionPolicy,
  ): Promise<FsWriteOutcome> {
    return super.writeText(await this.checkedTarget(target, sandboxPolicy), content, expected, signal);
  }

  /**
   * Rào phép SỬA theo chính sách của lời gọi, rồi uỷ quyền cho phép sửa nguyên tử kế thừa. Xem
   * {@link SandboxedFileSystem.checkedTarget}.
   * Nhận: đích đã phân giải; yêu cầu tìm/thay NGUYÊN VĂN; khoá phiên bản (bỏ trống = sửa vô điều kiện);
   * tín hiệu huỷ trước khi phép công bố nguyên tử có hiệu lực; chính sách của lời gọi (bỏ trống = dùng
   * chính sách dự phòng của triển khai).
   * Trả: kết cục sửa của backend kế thừa.
   */
  override async editText(
    target: FsTarget,
    edit: FsEditRequest,
    expected?: { version: FsVersion },
    signal?: AbortSignal,
    sandboxPolicy?: SandboxExecutionPolicy,
  ): Promise<FsEditOutcome> {
    return super.editText(await this.checkedTarget(target, sandboxPolicy), edit, expected, signal);
  }

  /**
   * Cưỡng chế chính sách của lời gọi trên `target` và trả ĐÚNG đích mà phép thay đổi phải dùng, để
   * danh tính đã kiểm CHÍNH LÀ danh tính bị thay đổi (không có khe "kiểm chỗ này, ghi chỗ kia").
   * `read-only` từ chối; `workspace-write` chuẩn tắc hoá LẠI NGAY (`resolve` lấy realpath của tổ tiên
   * có thật sâu nhất, phản ánh một symlink bị đổi đồng thời), đòi đích nằm dưới một gốc ghi được, rồi
   * trả đích MỚI đó; `danger-full-access` trả đích của bên gọi mà không rào. Từ chối thì ném lỗi có
   * cấu trúc `FS_SANDBOX_DENIED` — tầng tool ánh xạ nó thành dấu `[sandbox: …]` cho model và gợi ý
   * nâng quyền.
   * Nhận: đích đã phân giải và chính sách của lời gọi (tuỳ chọn).
   * Trả: đích mà phép thay đổi phải dùng (đích của bên gọi khi toàn quyền, đích chuẩn tắc MỚI khi
   *        `workspace-write`).
   */
  private async checkedTarget(target: FsTarget, sandboxPolicy?: SandboxExecutionPolicy): Promise<FsTarget> {
    const policy = sandboxPolicy ?? (this.ctx as unknown as { sandboxPolicy: SandboxPolicySeam }).sandboxPolicy.resolve();
    const { mode } = policy;
    if (mode === "danger-full-access") return target;
    if (mode === "read-only") {
      throw new FsError(`cannot write "${target.displayPath}": file access denied under read-only mode`, "FS_SANDBOX_DENIED");
    }
    const fresh = await this.resolve(target.displayPath);
    let contained = false;
    for (const root of writableRoots(policy)) {
      if (await isPathUnder(fresh.targetKey, root)) {
        contained = true;
        break;
      }
    }
    if (!contained) {
      throw new FsError(`cannot write "${target.displayPath}": file access denied under workspace-write mode`, "FS_SANDBOX_DENIED");
    }
    return fresh;
  }
}

export default SandboxedFileSystem;
