/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dựng hồ sơ (profile) argv cho từng runner của sandbox cục bộ — mount bwrap, grant Landlock, SBPL Seatbelt — từ policy của MỘT lượt gọi
 */

import { writableRoots } from "@deepseek-ai/dsh-sandbox";
import type { SandboxPolicy } from "@deepseek-ai/dsh-sandbox";
import { grantArgs } from "@deepseek-ai/node-addon-system/landlock-run";

/**
 * Bọc một đường dẫn thành chuỗi literal SBPL (thoát \ và ").
 * Nhận: đường dẫn cần đưa vào hồ sơ.
 * Trả: chuỗi đã bọc trong nháy kép, đúng cú pháp của sandbox-exec.
 */
function sbplString(path: string): string {
  return `"${path.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/**
 * Dựng tham số hồ sơ bwrap cho một policy tác động tệp: gốc chỉ-đọc, /dev mới, /proc trong PID namespace riêng;
 * `workspace-write` thêm /tmp tạm và một bind ghi được vào gốc workspace.
 * Nhận: policy của lượt gọi.
 * Trả: tham số hồ sơ, TRƯỚC dấu phân cách `--` và argv của lệnh.
 */
export function bwrapProfileArgs(policy: SandboxPolicy): string[] {
  const args = ["--ro-bind", "/", "/", "--dev", "/dev", "--unshare-pid", "--proc", "/proc", "--die-with-parent"];
  if (policy.mode === "workspace-write") {
    args.push("--tmpfs", "/tmp");
    args.push("--bind", policy.workspaceRoot, policy.workspaceRoot);
  }
  return args;
}

/**
 * Dựng grant của launcher Landlock: gốc chỉ-đọc + danh sách ghi được (luôn có /dev/null).
 * Nhận: policy của lượt gọi.
 * Trả: tham số grant (`--ro`/`--rw`) TRƯỚC dấu phân cách `--` và argv của lệnh.
 */
export function landlockProfileArgs(policy: SandboxPolicy): string[] {
  const readWrite = ["/dev/null"];
  if (policy.mode === "workspace-write") readWrite.push("/tmp", policy.workspaceRoot);
  return grantArgs({ readOnly: ["/"], readWrite });
}

/**
 * Dựng argv của sandbox-exec kèm hồ sơ SBPL: allow-default, CẤM mọi `file-write*`, rồi mở lại đúng các gốc
 * ghi được do `writableRoots` cấp (đã canonical + khử trùng) — nhờ vậy grant của Seatbelt và hàng rào fs
 * trong tiến trình không bao giờ lệch nhau.
 * Nhận: policy của lượt gọi.
 * Trả: tham số `-p <hồ sơ>` TRƯỚC dấu phân cách `--` và argv của lệnh.
 */
export function seatbeltProfileArgs(policy: SandboxPolicy): string[] {
  const forms = [
    "(version 1)",
    "(allow default)",
    "(deny file-write*)",
    `(allow file-write* (literal ${sbplString("/dev/null")}))`,
  ];
  const roots = writableRoots(policy);
  if (roots.length > 0) forms.push(`(allow file-write* ${roots.map((root) => `(subpath ${sbplString(root)})`).join(" ")})`);
  return ["-p", forms.join(" ")];
}
