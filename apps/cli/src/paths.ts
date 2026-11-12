/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Quy tac duong dan cua app: home rieng ~/.galaxy/blackhole, credentials dung chung
 *      ~/.galaxy/credentials.yaml, runtime harness pin trong apps/host
 *      11/11/2026: repoRoot() doc moduleDir() (Bun import.meta.dir HOAC Node import.meta.url) + GBH_REPO_ROOT
 *      => launcher chay duoc bang Node, khong con bat buoc bun
 *      12/11/2026: them appPatchStampPath() — stamp de KHONG sinh lai app.patch.yml khi input khong doi
 *      12/11/2026: them kernelModulesDir() — ban npm khong co apps/host/node_modules va npm HOIST kernel
 *      len node_modules cua thu muc CAI, nen helper do nguoc len cac thu muc cha; dshBinPath() doc qua no
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Nhớ kết quả dò kernel trong tiến trình (helper được gọi trong vòng lặp mount ~220 gói). */
let cacheKernel: string | undefined;

/** Port the host listens on by default; the app's fixed web surface. */
export const DEFAULT_PORT = 5439;

/** Loopback host the app binds. The harness refuses `0.0.0.0` for safety, so this stays a literal. */
export const LOOPBACK_HOST = "127.0.0.1";

/** Lowest Node major this app boots the harness with; v24 exits silently on this machine. */
export const MIN_NODE_MAJOR = 26;

/** Profile the app boots. */
export const DEFAULT_PROFILE = "blackhole";

/** Port of the blackhole web install this app measures parity against. */
export const ORACLE_PORT = 4001;

/**
 * Root of the Galaxy ecosystem in the user's home.
 * @returns đường dẫn `~/.galaxy` đã ghép với home của người dùng.
 */
export function galaxyRoot(): string {
  return join(homedir(), ".galaxy");
}

/**
 * Home of this app's harness state. Deliberately NOT `~/.galaxy/gbh`: the running blackhole web
 * keeps that tree and `gate:home-isolation` proves we never write into it.
 * @returns `$GBH_HOME` khi được đặt, ngược lại `~/.galaxy/blackhole`.
 */
export function appHome(): string {
  return process.env.GBH_HOME ?? join(galaxyRoot(), "blackhole");
}

/**
 * The one credentials document shared by every Galaxy project (CLI, extension, desktop, GUI).
 * Read through the harness credential seam; this absolute path is pinned into the app patch.
 * @returns `$GBH_CREDENTIALS` khi được đặt, ngược lại `~/.galaxy/credentials.yaml`.
 */
export function credentialsPath(): string {
  return process.env.GBH_CREDENTIALS ?? join(galaxyRoot(), "credentials.yaml");
}

/**
 * Thư mục profile bên trong home của app.
 * @param name - tên profile (mặc định `blackhole`).
 * @returns đường dẫn `<app home>/profiles/<name>`.
 */
export function profileDir(name: string = DEFAULT_PROFILE): string {
  return join(appHome(), "profiles", name);
}

/**
 * Thư mục chứa chính tệp đang chạy.
 *
 * Bun có `import.meta.dir`; Node thì KHÔNG (chỉ có `import.meta.dirname`/từ `import.meta.url`),
 * nên đọc thẳng `import.meta.dir` làm `repoRoot()` ném TypeError khi launcher chạy bằng Node.
 * @returns đường dẫn tuyệt đối của thư mục chứa module này.
 */
export function moduleDir(): string {
  const fromBun = (import.meta as ImportMeta & { readonly dir?: unknown }).dir;
  return typeof fromBun === "string" ? fromBun : dirname(fileURLToPath(import.meta.url));
}

/**
 * Repository root, resolved from this file so every command works from any cwd.
 * @returns đường dẫn tuyệt đối của `blackhole-tauri`.
 */
export function repoRoot(): string {
  // GBH_REPO_ROOT: đường dẫn ghim cho bản đóng gói (bundle) chạy ngoài cây nguồn.
  const pinned = (process.env.GBH_REPO_ROOT ?? "").trim();
  if (pinned.length > 0) return resolve(pinned);
  return resolve(moduleDir(), "../../..");
}

/**
 * Directory holding the profile templates this repo seeds into the app home.
 * @param name - tên profile (mặc định `blackhole`).
 * @returns đường dẫn `<repo>/profiles/<name>`.
 */
export function profileTemplateDir(name: string = DEFAULT_PROFILE): string {
  return join(repoRoot(), "profiles", name);
}

/**
 * The app-owned `--patch` overlay, regenerated on every boot so it always matches this build.
 * @returns đường dẫn `<app home>/app.patch.yml`.
 */
export function appPatchPath(): string {
  return join(appHome(), "app.patch.yml");
}

/**
 * Stamp của lớp patch cuối: sha256 của văn bản patch đã sinh ở lượt gần nhất.
 * Nhờ nó, boot chỉ GHI LẠI `app.patch.yml` khi input thật sự đổi (parity template, metadata gói,
 * bundle patch, đường dẫn credentials) — xem `writeAppPatch`.
 * @returns đường dẫn `<app home>/.gbh-app-patch-stamp`.
 */
export function appPatchStampPath(): string {
  return join(appHome(), ".gbh-app-patch-stamp");
}

/**
 * Bản sao patch của app trong repo, để `parity:dump` và người đọc thấy đúng lớp cuối cùng.
 * @returns đường dẫn `<repo>/profiles/blackhole/app.patch.yml`.
 */
export function repoAppPatchPath(): string {
  return join(profileTemplateDir(), "app.patch.yml");
}

/**
 * Template ngữ nghĩa patch của oracle (M1a) mà `bh host` ghép vào patch cuối cùng.
 * @returns đường dẫn `<repo>/profiles/blackhole/parity.patch.yml`.
 */
export function parityTemplatePath(): string {
  return join(profileTemplateDir(), "parity.patch.yml");
}

/**
 * Thư mục `node_modules` chứa KERNEL (`@deepseek-ai/*`) mà harness nạp.
 *
 * Hai bố cục phải chạy được bằng cùng một mã nguồn:
 *  - bản repo: kernel cài RIÊNG ở `apps/host/node_modules` (xem `bun run host:install`);
 *  - bản npm (`@galaxy-blackhole/blackhole-harness`): kernel là dependency của chính gói nên nằm ở
 *    `<gói>/node_modules` — KHÔNG có `apps/host/node_modules` nào cả.
 * Thứ tự dò: `$GBH_KERNEL_MODULES` → `apps/host/node_modules` (khi có `@deepseek-ai/dsh`) → `<gói>/node_modules`.
 * @returns đường dẫn tuyệt đối tới thư mục node_modules chứa kernel.
 */
export function kernelModulesDir(): string {
  if (cacheKernel !== undefined) return cacheKernel;
  const pinned = (process.env.GBH_KERNEL_MODULES ?? "").trim();
  if (pinned.length > 0) return (cacheKernel = resolve(pinned));
  const inHost = join(repoRoot(), "apps", "host", "node_modules");
  if (existsSync(join(inHost, "@deepseek-ai", "dsh"))) return (cacheKernel = inHost);
  // 12/11/2026 — BAN NPM: npm HOIST dependency len node_modules cua thu muc CAI, khong de trong
  // <goi>/node_modules (do that: npm i --prefix /tmp/hs2 ... -> /tmp/hs2/node_modules/@deepseek-ai/dsh).
  // Vi vay phai do NGUOC len cac thu muc cha, dung kieu Node phan giai module.
  let dir = repoRoot();
  for (;;) {
    const modules = join(dir, "node_modules");
    if (existsSync(join(modules, "@deepseek-ai", "dsh"))) return (cacheKernel = modules);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return (cacheKernel = join(repoRoot(), "node_modules"));
}

/**
 * Path of the pinned harness runtime the host boots. Installed under `apps/host` so the app owns
 * its runtime version instead of borrowing a global install.
 * @returns `$GBH_DSH_BIN` khi được đặt, ngược lại entry point của runtime trong {@link kernelModulesDir}.
 */
export function dshBinPath(): string {
  return process.env.GBH_DSH_BIN ?? join(kernelModulesDir(), "@deepseek-ai", "dsh", "lib", "bin.js");
}

/**
 * Manifest of the pinned harness runtime; its `version` is what `bh doctor` reports.
 * @returns đường dẫn `package.json` của runtime (cạnh `lib/bin.js`).
 */
export function dshManifestPath(): string {
  return resolve(dshBinPath(), "..", "..", "package.json");
}
