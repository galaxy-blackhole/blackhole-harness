/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bản viết lại phần bàn giao trình duyệt mặc định của row `web-runtime`: chạy trình mở của nền tảng
 *      trong TIẾN TRÌNH CON đã gột biến môi trường Harness, rồi đổi mã thoát thành thông điệp cảnh báo.
 */
import { spawn } from "node:child_process";
import { scrubbedParentEnv } from "@deepseek-ai/dsh-subprocess";

/** Gói mở trình duyệt của nền tảng, phân giải MỘT LẦN thành URL tuyệt đối cho tiến trình con. */
const BROWSER_OPENER_MODULE = import.meta.resolve("open");

/**
 * Chương trình của tiến trình con: nạp `open`, mở URL, và trên Windows giữ tham chiếu tới launcher
 * PowerShell cho tới khi nó giao URL xong. Lỗi được ghi ra stderr để tiến trình cha đổi thành cảnh báo.
 */
const BROWSER_OPENER_PROGRAM = `
try {
  const { default: open } = await import(${JSON.stringify(BROWSER_OPENER_MODULE)})
  const launcher = await open(process.argv[1])
  if (process.platform === 'win32') {
    // open resolves at PowerShell spawn; keep it referenced until that launcher hands the URL to Windows.
    const code = launcher.exitCode ?? await new Promise((resolve, reject) => {
      function onError(error) {
        launcher.off('close', onClose)
        reject(error)
      }
      function onClose(code) {
        launcher.off('error', onError)
        resolve(code)
      }
      launcher.ref()
      launcher.once('error', onError)
      launcher.once('close', onClose)
    })
    if (code !== 0) throw new Error('browser operating-system launcher exited with code ' + String(code))
  }
  process.exitCode = 0
} catch (error) {
  // The parent turns this exit into the manual-URL warning.
  console.error(error)
  process.exitCode = 1
}
`;

/**
 * Khởi động trình mở của nền tảng mà KHÔNG chuyển tiếp thông tin xác thực của Harness sang tiến trình con.
 * @param url - URL đã kèm token cần giao cho trình duyệt mặc định.
 * @returns tiến trình con đã spawn (stderr ở dạng pipe để cha đọc lý do thất bại).
 */
function spawnBrowserLauncher(url: string) {
  return spawn(process.execPath, ["--input-type=module", "--eval", BROWSER_OPENER_PROGRAM, "--", url], {
    env: scrubbedParentEnv(),
    stdio: ["ignore", "inherit", "pipe"],
  });
}

/**
 * Giao một URL cho trình duyệt mặc định của hệ điều hành.
 *
 * Mã thoát khác 0 biến thành `Error` mang DÒNG ĐẦU của stderr (bỏ tiền tố `SomeError:`), đúng như bản gốc —
 * nhờ vậy cảnh báo của row nói được lý do thật thay vì chỉ nói "exit code".
 * @param url - URL cần mở.
 * @returns lời hứa hoàn tất khi trình mở thoát thành công; `reject` khi spawn lỗi hoặc mã thoát khác 0.
 */
export async function openBrowser(url: string): Promise<void> {
  const launcher = spawnBrowserLauncher(url);
  let launcherStderr = "";
  launcher.stderr?.setEncoding("utf8");
  launcher.stderr?.on("data", (chunk: string) => {
    launcherStderr += chunk;
  });
  await new Promise<void>((resolve, reject) => {
    function onError(error: Error): void {
      launcher.off("close", onClose);
      reject(error);
    }
    function onClose(code: number | null): void {
      launcher.off("error", onError);
      if (code !== 0) {
        const firstLine = launcherStderr.trim().split(/\r?\n/u)[0];
        const reason =
          firstLine === undefined || firstLine === ""
            ? `browser launcher exited with code ${String(code)}`
            : firstLine.replace(/^(?:[A-Za-z]*Error):\s*/u, "");
        reject(new Error(reason));
        return;
      }
      if (launcherStderr !== "") process.stderr.write(launcherStderr);
      resolve();
    }
    launcher.once("error", onError);
    launcher.once("close", onClose);
  });
}
