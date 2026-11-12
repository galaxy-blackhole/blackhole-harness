/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Thư mục Workspace lần dùng đầu trên Host — port 1:1 `lib/types/default-workspace.js` (stock
 *      lib/index.js dòng 571–587) và `lib/types/default-directory.js` (dòng 588–642): hằng tên thư mục
 *      lá, kiểm thư mục Documents, và giải thư mục Documents của hệ điều hành (không tạo tệp).
 *      11/11/2026: đổi thư mục cha `Documents/deepseek-harness` → `Documents/galaxy` (sai khác CÓ CHỦ Ý với
 *      bản gốc, yêu cầu người dùng). Chỉ ảnh hưởng Workspace TẠO MỚI: Workspace đã đăng ký giữ nguyên đường
 *      dẫn tuyệt đối trong `storages/workspace.json`, và sổ đăng ký KHÔNG khởi tạo bản mặc định khi đã có
 *      Workspace/Session nào — nên bản cũ dưới `deepseek-harness` vẫn mở được, không mất, không tạo trùng.
 */

import { runNativeCommand, type NativeCommandRunner } from "@deepseek-ai/dsh-native-command";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";

/**
 * Quan sát nền tảng có thể thay trong test giải thư mục (bản gốc KHÔNG xuất interface này).
 */
interface DocumentsDirectoryInternals {
  /** Nền tảng của Host. */
  readonly platform?: NodeJS.Platform;
  /** Thư mục home của tài khoản (dùng cho phép so Linux). */
  readonly home?: string;
  /** Bộ chạy lệnh native. */
  readonly run?: NativeCommandRunner;
}

/**
 * Tên thư mục lá của Workspace lần dùng đầu dưới
 * `<Documents>/galaxy`. Trung lập ngôn ngữ, nên một bản cài giữ
 * một đường dẫn trên đĩa khi đổi ngôn ngữ. Sổ đăng ký lấy tiêu đề ban đầu từ
 * chính đoạn này — tiêu đề mà `workspaceDisplayTitle` nhận là tự động.
 */
export const DEFAULT_WORKSPACE_DIRECTORY = "default-workspace";

/**
 * Tên thư mục CHA của Workspace lần dùng đầu, dưới thư mục Documents của hệ điều hành.
 *
 * Sai khác CÓ CHỦ Ý với bản gốc (`deepseek-harness`): đây là sản phẩm Galaxy Blackhole, nên thư mục do
 * nó tạo cho người dùng phải mang tên sản phẩm. Hằng tách riêng để test khoá được giá trị và để chỗ đọc
 * cũ (nếu cần dò lại bản cũ) có một cái tên rõ ràng thay vì chuỗi nằm giữa biểu thức.
 */
export const WORKSPACE_PARENT_DIRECTORY = "galaxy";

/**
 * Kiểm một đường dẫn Documents (do cấu hình cấp hoặc OS trả) mà KHÔNG giải tương đối theo cwd.
 * @param directory - cách viết thư mục đã đủ tuyệt đối.
 * @param platform - nền tảng của Host.
 * @returns thư mục đã chuẩn hoá.
 */
export function validateDocumentsDirectory(
  directory: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const paths = platform === "win32" ? win32 : posix;
  const root = paths.parse(directory).root;
  if (!paths.isAbsolute(directory) || (platform === "win32" && (root === "\\" || root === "/"))) {
    throw new Error(`Documents directory must be fully qualified: '${directory}'`);
  }
  return paths.normalize(directory);
}

/**
 * Giải thư mục lần dùng đầu trên Host mà KHÔNG tạo tệp.
 * @param documentsDirectory - ghi đè triển khai cho thư mục Documents của hệ thống.
 * @param signal - vòng đời bên gọi và hạn chót tra cứu.
 * @param internals - dữ kiện nền tảng và bộ chạy lệnh native.
 * @returns đường dẫn ứng viên tuyệt đối.
 */
export async function defaultWorkspaceDirectory(
  documentsDirectory: string | undefined,
  signal: AbortSignal,
  internals: DocumentsDirectoryInternals = {},
): Promise<string> {
  const platform = internals.platform ?? process.platform;
  const paths = platform === "win32" ? win32 : posix;
  signal.throwIfAborted();
  let directory = documentsDirectory;
  if (directory === undefined) {
    const run = internals.run ?? runNativeCommand;
    let stdout: string;
    switch (platform) {
      case "darwin":
        ({ stdout } = await run(
          "osascript",
          ["-e", "POSIX path of (path to documents folder from user domain without folder creation)"],
          signal,
          "hidden",
        ));
        break;
      case "win32":
        ({ stdout } = await run(
          "powershell.exe",
          [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); [Environment]::GetFolderPath([Environment+SpecialFolder]::MyDocuments, [Environment+SpecialFolderOption]::DoNotVerify)",
          ],
          signal,
          "hidden",
        ));
        break;
      case "linux":
        ({ stdout } = await run("xdg-user-dir", ["DOCUMENTS"], signal, "hidden"));
        break;
      default:
        throw new Error(`system Documents directory is unavailable on ${platform}`);
    }
    directory = stdout.replace(/[\r\n]+$/, "");
    if (
      directory === "" ||
      (platform === "linux" && paths.normalize(directory) === (internals.home ?? homedir()))
    ) {
      throw new Error("system Documents directory is unavailable");
    }
  }
  directory = validateDocumentsDirectory(directory, platform);
  signal.throwIfAborted();
  return paths.join(directory, WORKSPACE_PARENT_DIRECTORY, DEFAULT_WORKSPACE_DIRECTORY);
}
