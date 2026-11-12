/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Chay app desktop: mo Tauri dev va giao cho vo shell quyen spawn host
 *      11/11/2026: mac dinh 5439 -> 55907 (GBH_DESKTOP_PORT), bang dung mac dinh cua vo Rust
 *      11/11/2026: thoi xuat GBH_HOST_CMD (vo Rust khong con doc bien do); xuat GBH_NODE + GBH_REPO
 *      DUONG DAN TUYET DOI, dung thu tu giai moi cua host_command.rs (node-only, khong bun)
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/// Root of the repository, resolved from this script so it works from any cwd.
const repoRoot = join(import.meta.dir, "..", "..", "..");

/// Adds the Rust toolchain directory to PATH when it is missing: `tauri dev` cannot run without cargo,
/// and a shell that never sourced the user's profile would otherwise fail with a bare error.
function withCargoOnPath(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const cargoBin = join(process.env.HOME ?? "", ".cargo", "bin");
  const path = env.PATH ?? "";
  if (path.split(":").includes(cargoBin) || !existsSync(join(cargoBin, "cargo"))) {
    return env;
  }
  return { ...env, PATH: `${cargoBin}:${path}` };
}

/**
 * Node >= 26 để vỏ shell spawn host: `GBH_NODE` → bản mới nhất của nvm → `node` trên PATH.
 * Không hard-code phiên bản: máy khác có bản khác, và một `GBH_NODE` trỏ vào tệp không tồn tại thì vỏ
 * Rust từ chối boot (đúng thiết kế — không đoán hộ người vận hành).
 * @returns đường dẫn tuyệt đối của node, hoặc `node` trần khi chỉ có PATH.
 */
function resolveDevNode(): string {
  const pinned = process.env.GBH_NODE ?? "";
  if (pinned !== "") return pinned;
  const nvmRoot = join(process.env.HOME ?? "", ".nvm", "versions", "node");
  try {
    const versions = readdirSync(nvmRoot)
      .filter((name) => /^v(\d+)\./u.test(name) && Number(/^v(\d+)/u.exec(name)?.[1] ?? "0") >= 26)
      .sort((left, right) => Number(/^v(\d+)/u.exec(right)?.[1] ?? "0") - Number(/^v(\d+)/u.exec(left)?.[1] ?? "0"));
    for (const version of versions) {
      const bin = join(nvmRoot, version, "bin", "node");
      if (existsSync(bin)) return bin;
    }
  } catch {
    // Không có nvm là chuyện bình thường: rơi xuống node trên PATH.
  }
  return "node";
}

/// Prefers the workspace Tauri CLI, falling back to whatever `tauri` is on PATH.
function tauriCommand(): string {
  const local = join(repoRoot, "apps", "desktop", "node_modules", ".bin", "tauri");
  return existsSync(local) ? local : (process.env.GBH_TAURI ?? "tauri");
}

/**
 * Starts `tauri dev` with the host command exported, so the shell owns the host process.
 * `--smoke` is forwarded to the app for launch measurement.
 */
function main(): number {
  // 11/11/2026 — vỏ Rust CHỈ chạy node (harness cần symbol V8 của Node; bun ném "Unsupported/no-context").
  // Bản dev vì vậy trỏ GBH_NODE vào một node >= 26 thật, không phải process.execPath (có thể là bun).
  const node = resolveDevNode();
  // 11/11/2026: cùng một con số với DEFAULT_PORT của vỏ Rust (55907); nếu không, "bun run dev" và app
  // đóng gói sẽ nói hai cổng khác nhau — và dev lại đụng host 5439 của Lead. Cờ cũ GBH_PORT vẫn đọc.
  const port = process.env.GBH_DESKTOP_PORT ?? process.env.GBH_PORT ?? "55907";
  if (process.argv.includes("--print-env")) {
    console.log(JSON.stringify({ tauri: tauriCommand(), cwd: join(repoRoot, "apps", "desktop"), GBH_NODE: node, GBH_REPO: repoRoot, GBH_DESKTOP_PORT: port }, null, 2));
    return 0;
  }
  const passthrough = process.argv.slice(2);
  const onlyTauri = passthrough.includes("--tauri-only");
  const args = onlyTauri ? passthrough.filter((arg) => arg !== "--tauri-only") : ["dev"];
  if (!onlyTauri && passthrough.includes("--smoke")) {
    args.push("--", "--smoke");
  }
  const child = spawn(tauriCommand(), args, {
    cwd: join(repoRoot, "apps", "desktop"),
    env: withCargoOnPath({ ...process.env, GBH_NODE: node, GBH_REPO: repoRoot, GBH_DESKTOP_PORT: port }),
    stdio: "inherit",
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  return 0;
}

process.exit(main());
