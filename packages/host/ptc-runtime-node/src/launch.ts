/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chọn bootstrap nguồn hay bản build trong thế giới thực thi đã mount của worker PTC — port 1:1 vùng
 *      launch của @deepseek-ai/dsh-ptc-runtime-node (index.js 634–687)
 */

import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* Select source or built bootstrap assets in the mounted execution world. */

/**
 * Deployment-owned worker invocation in the subprocess execution world.
 * Nhận: không (chỉ là khai báo kiểu).
 * Trả: không (không sinh mã lúc chạy).
 */
export type LaunchConfig = {
  /** Start a separately installed Node executable and JavaScript bootstrap. */
  kind: "node-script";
  /** Executable name or path resolved by the subprocess provider. */
  executable: string;
  /** Absolute preinstalled bootstrap; omitted maps this package's bootstrap into the execution world. */
  bootstrapPath?: string;
} | {
  /** Start the private PTC worker embedded in a packaged executable. */
  kind: "embedded";
  /** Packaged executable name or path resolved by the subprocess provider. */
  executable: string;
};

/**
 * Phần TỐI THIỂU của `FileSystem` mà bootstrap cần — `Pick<FileSystem, 'processPathFromHostPath'>`
 * của bản gốc (@deepseek-ai/dsh-fs KHÔNG được cài thật trong gói nên khai cục bộ).
 * Nhận: không (chỉ là khai báo kiểu).
 * Trả: không (không sinh mã lúc chạy).
 */
interface ProcessPathMapper {
  /** Ánh xạ một đường dẫn host sang thế giới thực thi; `undefined` khi không ánh xạ được. */
  processPathFromHostPath(path: string): string | undefined;
}

/**
 * Khẳng định một nhánh union là KHÔNG THỂ tới được — bản địa phương của `assertNever` ở
 * @deepseek-ai/dsh-util-values (gói ngoài bảng phụ thuộc của package này, và import thật là TS2307 ở
 * máy chưa cài), giữ NGUYÊN VĂN câu lỗi.
 * Nhận: value — giá trị đã bị vét cạn; context — tên union để chẩn đoán (tùy chọn).
 * Trả: không trả — LUÔN ném `Error`.
 */
function assertNever(value: never, context?: string): never {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}

/**
 * Resolve the local carrier default or validate an explicit execution-world invocation.
 * Nhận: config — cấu hình worker tường minh (xa hoặc cục bộ); bỏ trống ⇒ chọn carrier này.
 * Trả: LaunchConfig — lời gọi worker đã chốt, KHÔNG đoán đường dẫn của thế giới thực thi.
 */
export function resolveLaunch(config?: LaunchConfig): LaunchConfig {
  /* Bản gốc viết gộp: { kind: "pkg" in process ? "embedded" : "node-script", executable: process.execPath }.
     Tách đôi nhánh để TypeScript giữ được union phân biệt — cùng một giá trị, cùng một điều kiện. */
  const launch: LaunchConfig = config ?? ("pkg" in process
    ? { kind: "embedded", executable: process.execPath }
    : { kind: "node-script", executable: process.execPath });
  if (launch.executable.length === 0) throw new Error("ptc-runtime-node: launch.executable must be non-empty");
  if (launch.kind === "node-script" && launch.bootstrapPath !== undefined && !isAbsolute(launch.bootstrapPath)) throw new Error("ptc-runtime-node: launch.bootstrapPath must be absolute");
  return launch;
}

/**
 * Select explicit arguments without inheriting host loader or inspector flags.
 * Nhận: fs — ánh xạ tài sản bootstrap của host vào thế giới tiến trình; config — lời gọi worker đã
 *   chốt; maxMessageBytes — hạn frame/byte ghi đã kiểm; persistent — chọn bootstrap REPL trong bộ nhớ
 *   thay cho evaluator một lần.
 * Trả: string[] — tham số nối sau executable Node đã chốt.
 */
export function bootstrapArgs(fs: ProcessPathMapper, config: LaunchConfig, maxMessageBytes: number, persistent = false): string[] {
  switch (config.kind) {
    case "embedded":
      if (persistent) throw new Error("Persistent PTC requires a node-script launch");
      return [String(maxMessageBytes)];
    case "node-script": return scriptBootstrapArgs(fs, config.bootstrapPath, maxMessageBytes, persistent);
    default: return assertNever(config);
  }
}

/**
 * Chọn tham số bootstrap cho nhánh `node-script` (đường dẫn tường minh, hoặc ánh xạ tài sản của
 * package sang thế giới thực thi rồi chạy qua `--eval`).
 * Nhận: fs — ánh xạ đường dẫn; bootstrapPath — đường dẫn tuyệt đối đã cài sẵn (nếu có); maxMessageBytes
 *   — hạn byte; persistent — chọn bootstrap REPL.
 * Trả: string[] — tham số cho executable Node.
 */
function scriptBootstrapArgs(fs: ProcessPathMapper, bootstrapPath: string | undefined, maxMessageBytes: number, persistent: boolean): string[] {
  const moduleName = persistent ? "persistent-process" : "process";
  if (bootstrapPath !== undefined) return [bootstrapPath, String(maxMessageBytes)];
  const mapped = (path: string): string => {
    const result = fs.processPathFromHostPath(path);
    if (result === undefined) throw new Error(`PTC runtime bootstrap is unavailable in the subprocess execution world: ${path}`);
    return result;
  };
  if (!new URL(import.meta.url).pathname.endsWith(".ts")) return [mapped(fileURLToPath(new URL(`./${moduleName}.js`, import.meta.url))), String(maxMessageBytes)];
  // 19/10/2026 — nhánh CHẠY TỪ NGUỒN: bản gốc nạp `./process.ts` / `./persistent-process.ts` (mỗi tệp vừa là
  // entry vừa export run*Main). Gói ta tách đôi vì hai tệp gốc >1000 dòng: entry chỉ gọi, RUNNER mới export
  // `runNodeMain` / `runPersistentMain` ⇒ nhánh .ts phải trỏ tới `<moduleName>-runner.ts`. Artifact .js
  // KHÔNG đổi (vẫn ./process.js · ./persistent-process.js tự chứa), nên hành vi trên app y nguyên.
  const entry = mapped(fileURLToPath(new URL(`./${moduleName}-runner.ts`, import.meta.url)));
  const helper = mapped(resolve(dirname(fileURLToPath(import.meta.resolve("@deepseek-ai/dsh-subprocess/package.json"))), "src/control.ts"));
  const main = persistent ? "runPersistentMain" : "runNodeMain";
  return [
    "--input-type=module",
    "--eval",
    `const {openInheritedControlChannel}=await import(${JSON.stringify(pathToFileURL(helper).href)});const {${main}}=await import(${JSON.stringify(pathToFileURL(entry).href)});await ${main}(openInheritedControlChannel(),${maxMessageBytes},process);`
  ];
}
