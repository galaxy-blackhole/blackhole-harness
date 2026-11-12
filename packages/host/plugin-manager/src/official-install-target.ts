/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chọn gói bundle Official từ CHÍNH bản cài đang chạy mà không import mã của provider: bản cài
 *      nguồn (workspace) trả về spec `link:<thư mục>` sau khi xác minh checkout đầy đủ, bản phát hành
 *      trả về `<tên>@<version>`; thiếu gói workspace, thiếu patch bundle hay thiếu runtime đã build
 *      đều là LỖI — KHÔNG BAO GIỜ rơi về registry.
 */

import { existsSync, globSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { bundlePatchPaths } from "@deepseek-ai/dsh-app-boot";

/** Phần package.json mà bộ chọn này đọc: danh tính, phụ thuộc, và khai báo bundle. */
interface PackageManifest {
  readonly name?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly main?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly dsh?: { readonly bundle?: { readonly patch: string | string[] } };
}

/**
 * Đọc một package.json thành manifest cấu trúc.
 * Nhận: `file` — đường dẫn tuyệt đối tới tệp package.json.
 * Trả: manifest đã đọc và phân tích.
 * @throws Lỗi hệ thống tệp khi không đọc được tệp, hoặc lỗi cú pháp của `JSON.parse` khi JSON hỏng.
 */
function manifestAt(file: string): PackageManifest {
  return JSON.parse(readFileSync(file, "utf8")) as PackageManifest;
}

/**
 * Đề xuất một liên kết checkout nguồn hoặc một version phát hành CHÍNH XÁC. Bản cài nguồn được nhận
 * diện bằng manifest CLI thật và các phụ thuộc workspace đã unpack, kể cả symlink phát triển của
 * Desktop. Một checkout KHÔNG đầy đủ là lỗi, không bao giờ là dự phòng registry.
 * Nhận: `name` — tên gói trong catalog Official; `installAnchor` — package.json của DSH đang chạy
 *      (có thể tới được qua symlink); `version` — version DSH đang chạy mà dòng phát hành của nó dùng.
 * Trả: một spec quản lý gói thông thường (`<tên>@<version>`, hoặc `link:<thư mục>` cho bản cài
 *      nguồn) kèm version của gói.
 * @throws khi bản cài nguồn thiếu checkout workspace đầy đủ, thiếu gói workspace (không đúng MỘT gói),
 *      không khai bundle công khai đúng version DSH, thiếu runtime đã build, hoặc thiếu patch bundle.
 */
export function officialBundleInstallTarget(
  name: string,
  installAnchor: string,
  version: string,
): { spec: string; version: string } {
  const anchor = realpathSync(installAnchor);
  const installation = manifestAt(anchor);
  const source = installation.name === "@deepseek-ai/dsh"
    && Object.values(installation.dependencies ?? {}).some((value) => value.startsWith("workspace:"));
  if (!source) return { spec: `${name}@${version}`, version };
  const root = resolve(dirname(anchor), "../..");
  if (anchor !== join(root, "apps", "cli", "package.json")
    || !existsSync(join(root, "package.json"))
    || manifestAt(join(root, "package.json")).name !== "@deepseek-ai/dsh-root") {
    throw new Error(`Official bundle ${name}: source DSH installation ${anchor} requires its complete workspace checkout`);
  }
  const matches = globSync("packages/*/*/package.json", { cwd: root })
    .map((file) => ({ file: join(root, file), manifest: manifestAt(join(root, file)) }))
    .filter((entry) => entry.manifest.name === name);
  const selected = matches[0];
  if (matches.length !== 1 || selected === undefined) {
    throw new Error(`Official bundle ${name}: expected one workspace package in ${root}, found ${matches.length}; restore the checkout and run pnpm install`);
  }
  const { file, manifest } = selected;
  const directory = realpathSync(dirname(file));
  const bundle = manifest.dsh?.bundle;
  if (manifest.version !== version || manifest.private === true || bundle === undefined) {
    throw new Error(`Official bundle ${name}: ${file} must declare a public bundle at DSH version ${version}`);
  }
  const main = typeof manifest.main === "string" ? resolve(directory, manifest.main) : undefined;
  if (main === undefined || !existsSync(main) || !statSync(main).isFile()) {
    throw new Error(`Official bundle ${name}: built runtime is missing in ${directory}; run pnpm install and pnpm run build in ${root}`);
  }
  for (const patch of bundlePatchPaths(directory, bundle)) {
    if (!existsSync(patch) || !statSync(patch).isFile()) {
      throw new Error(`Official bundle ${name}: bundle patch ${patch} is missing; restore the checkout`);
    }
  }
  return { spec: `link:${directory}`, version };
}
