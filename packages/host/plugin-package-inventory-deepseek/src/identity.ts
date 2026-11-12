/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bộ phân giải DANH TÍNH gói từ một entry của Loader: gói trần thì tra manifest qua seam
 *      `pluginPackages` hoặc `createRequire`; module tương đối/tuyệt đối thì lần ngược lên
 *      manifest gần nhất. Dùng CHỈ `node:` builtins, đúng như bản gốc — không đọc registry npm.
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, parse } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ActiveEntry, DeepSeekPluginPackageIdentity, PackageRegistry } from "./types.ts";

/**
 * Tách tên gói TRẦN khỏi một specifier.
 * Nhận: specifier của entry (ví dụ `@scope/ten`, `@scope/ten/sub`, `./x.js`, `node:fs`, `cordis:x`).
 * Trả: tên gói (`@scope/ten` hoặc `ten`), hoặc undefined khi specifier KHÔNG phải gói trần
 *      (bắt đầu bằng `.`, chứa `:`, hoặc là đường dẫn tuyệt đối).
 * @param specifier - chuỗi module của entry.
 * @returns tên gói trần, hoặc undefined.
 */
export function barePackageName(specifier: string): string | undefined {
  if (specifier.startsWith(".") || specifier.includes(":") || isAbsolute(specifier)) return undefined;
  const [first = "", second = ""] = specifier.split("/");
  return first.startsWith("@") ? `${first}/${second}` : first;
}

/**
 * Đọc danh tính của một manifest, chỉ nhận `name`/`version` là chuỗi KHÔNG rỗng.
 * Nhận: đường dẫn tuyệt đối tới `package.json` (JSON hỏng ⇒ ném, như bản gốc).
 * Trả: `{ name, version }` khi có phiên bản, `{ name }` khi không, undefined khi thiếu tên hợp lệ.
 * @param path - đường dẫn manifest.
 * @returns danh tính gói, hoặc undefined.
 */
export function identityFromManifest(path: string): DeepSeekPluginPackageIdentity | undefined {
  const manifest = JSON.parse(readFileSync(path, "utf8")) as { name?: unknown; version?: unknown };
  if (typeof manifest.name !== "string" || manifest.name.trim().length === 0) return undefined;
  return typeof manifest.version === "string" && manifest.version.trim().length > 0
    ? { name: manifest.name, version: manifest.version }
    : { name: manifest.name };
}

/**
 * Tra manifest của một gói TRẦN theo thứ tự neo, KHÔNG cần gói đó export `./package.json`.
 * Nhận: tên gói, danh sách neo (URL), và seam `pluginPackages` (có thể vắng).
 * Trả: đường dẫn manifest, hoặc undefined khi không neo nào tra được.
 * Hành vi đúng bản gốc: khi seam `pluginPackages` CÓ mặt thì chỉ dùng `packageOf` — KHÔNG
 * rơi về `createRequire` (một neo trả undefined sẽ được thử neo kế tiếp và bị bỏ qua).
 * @param packageName - tên gói trần.
 * @param anchors - các URL neo, theo thứ tự ưu tiên.
 * @param packages - seam tra gói của kernel, hoặc undefined.
 * @returns đường dẫn manifest, hoặc undefined.
 */
export function barePackageManifest(
  packageName: string,
  anchors: readonly string[],
  packages: PackageRegistry | undefined,
): string | undefined {
  for (const anchor of anchors) {
    const location = packages?.packageOf(packageName, anchor);
    if (location !== undefined) return location.manifestPath;
    if (packages !== undefined) continue;
    // `resolve.paths` trả `null` khi specifier không dò được; bản gốc ném TypeError ở đó và
    // caller coi là KHÔNG ĐỌC ĐƯỢC. Coi null là "không có đường dò" chỉ đổi LOẠI lỗi, không đổi
    // giá trị đi trên dây (cả hai đều rơi vào nhánh cảnh báo-rồi-bỏ), nên ở đây dùng `?? []`.
    const searchPaths = createRequire(anchor).resolve.paths(packageName) ?? [];
    for (const searchPath of searchPaths) {
      const manifest = join(searchPath, packageName, "package.json");
      if (existsSync(manifest)) return manifest;
    }
  }
  return undefined;
}

/**
 * Tìm manifest GẦN NHẤT bao quanh một module tương đối/tuyệt đối.
 * Nhận: đường dẫn tuyệt đối của module (đã quy về đường dẫn tệp).
 * Trả: đường dẫn `package.json` gần nhất khi lần ngược lên, undefined khi chạm gốc đĩa.
 * @param modulePath - đường dẫn tệp module.
 * @returns đường dẫn manifest, hoặc undefined.
 */
export function nearestManifest(modulePath: string): string | undefined {
  let current = dirname(modulePath);
  const root = parse(current).root;
  while (true) {
    const manifest = join(current, "package.json");
    if (existsSync(manifest)) return manifest;
    if (current === root) return undefined;
    current = dirname(current);
  }
}

/**
 * Bộ phân giải danh tính gói cho MỘT lần cài plugin, có cache manifest CỐ ĐỊNH theo tiến trình.
 * Cùng một entry (cùng bộ neo + cùng tên module) ⇒ cùng một VẬT THỂ danh tính (đọc manifest một lần).
 */
export class PackageIdentityResolver {
  /** Base URL của host — neo cuối cùng khi entry không mang base URL. */
  readonly hostBaseUrl: string;
  /** Seam tra gói của kernel, hoặc undefined khi kernel không cấp. */
  readonly packages: PackageRegistry | undefined;
  /** Cache danh tính theo (bộ neo, tên module); undefined cũng được cache (quyết định "không có danh tính"). */
  private readonly cache = new Map<string, DeepSeekPluginPackageIdentity | undefined>();

  /**
   * Dựng bộ phân giải cho một lần cài.
   * @param hostBaseUrl - base URL của host.
   * @param packages - seam `pluginPackages` của kernel, hoặc undefined.
   */
  constructor(hostBaseUrl: string, packages: PackageRegistry | undefined) {
    this.hostBaseUrl = hostBaseUrl;
    this.packages = packages;
  }

  /**
   * Phân giải gói sở hữu MỘT entry của Loader.
   * Nhận: entry đang hoạt động (tên module + neo).
   * Trả: danh tính gói, hoặc undefined khi entry không có danh tính gói (module rời, `cordis:`).
   * Ném khi gói trần KHÔNG tra được manifest — caller biến nó thành cảnh báo "unreadable".
   * @param entry - entry cần phân giải.
   * @returns danh tính gói, hoặc undefined.
   */
  resolve(entry: ActiveEntry): DeepSeekPluginPackageIdentity | undefined {
    const treeBase = entry.baseUrl ?? this.hostBaseUrl;
    const anchors = [
      ...new Set([entry.bareBaseUrl ?? treeBase, treeBase, this.hostBaseUrl, import.meta.url]),
    ];
    const key = `${anchors.join("\0")}\u0000${entry.moduleName}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const packageName = barePackageName(entry.moduleName);
    let manifest: string | undefined;
    if (packageName !== undefined) {
      manifest = barePackageManifest(packageName, anchors, this.packages);
      if (manifest === undefined) {
        throw new Error(
          `plugin-package-inventory-deepseek: cannot resolve active package ${JSON.stringify(packageName)}`,
        );
      }
    } else if (!entry.moduleName.startsWith("cordis:")) {
      const moduleUrl = isAbsolute(entry.moduleName)
        ? pathToFileURL(entry.moduleName)
        : new URL(entry.moduleName, treeBase);
      if (moduleUrl.protocol === "file:") manifest = nearestManifest(fileURLToPath(moduleUrl));
    }
    const identity = manifest === undefined ? undefined : identityFromManifest(manifest);
    this.cache.set(key, identity);
    return identity;
  }
}
