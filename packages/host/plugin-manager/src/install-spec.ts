/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/install-spec.js' (118 dòng) của @deepseek-ai/dsh-plugin-manager: đọc một install
 *      spec TRƯỚC khi pnpm thấy nó — nó thuộc dạng spec nào của pnpm, và với một tên registry thì tên đó có
 *      phải tên registry chấp nhận được không; kèm spec 'pnpm add' nhận cho một dependency của manifest profile.
 */
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

/**
 * Một spec đã đọc thành dạng của nó và các phần một lần soi cần. Spec git và URL tarball mang `host` mà pnpm
 * tải chúng từ đó — không registry nào thay thế được; chỉ dependency của chúng mới đến từ registry.
 */
export type ParsedInstallSpec =
  | {
      readonly kind: "registry";
      readonly spec: string;
      readonly name: string;
      readonly range?: string;
    }
  | {
      readonly kind: "path";
      readonly spec: string;
      readonly path: string;
    }
  | {
      readonly kind: "tarball";
      readonly spec: string;
      readonly path?: string;
      readonly host?: string;
    }
  | {
      readonly kind: "git";
      readonly spec: string;
      readonly host: string;
    };

/** Các dạng pnpm phân giải qua một git host: shorthand của host, URL git, hoặc URL repository được host. */
const GIT_SHORTHAND = /^(?:github|gitlab|bitbucket|gist):/i;
const GIT_URL = /^git(?:\+[a-z]+)?:\/\/|^git@[^:]+:/i;
const HOSTED_REPOSITORY_URL = /^https?:\/\/[^/]+\/[^/]+\/[^/#]+(?:\.git)?(?:#.*)?$/i;
/** Các host mà shorthand của pnpm đại diện. */
const GIT_SHORTHAND_HOSTS = {
  github: "github.com", gitlab: "gitlab.com", bitbucket: "bitbucket.org", gist: "gist.github.com",
} as const;
/** Một tarball, trên đĩa hoặc qua HTTP. */
const TARBALL_SPEC = /\.(?:tgz|tar\.gz)(?:#.*)?$/i;
/** Một tên package npm: các đoạn an toàn URL viết thường, scope tuỳ chọn, không mở đầu bằng dấu chấm hay gạch dưới. */
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
const PACKAGE_NAME_MAX_LENGTH = 214;

/** Một spec mà cả pnpm lẫn registry đều không nhận; `reason` là câu người dùng đọc được. */
export class InvalidInstallSpecError extends Error {
  /** Spec đúng như đã nhập, đã trim. */
  readonly spec: string;

  /** Vì sao bị từ chối, một câu. */
  readonly reason: string;

  /**
   * Dựng lỗi spec không hợp lệ.
   * Nhận: `spec` — spec đúng như đã nhập (đã trim); `reason` — vì sao bị từ chối, một câu.
   * Trả: thể hiện lỗi mới với `message` nguyên văn bản gốc `plugin-manager: <reason>: <spec>`, `spec`,
   * `reason`, và `name` là `InvalidInstallSpecError`.
   */
  constructor(spec: string, reason: string) {
    super(`plugin-manager: ${reason}: ${spec}`);
    this.spec = spec;
    this.reason = reason;
    this.name = "InvalidInstallSpecError";
  }
}

/**
 * Dựng lỗi spec không hợp lệ cho một spec và một lý do.
 * Nhận: `spec` — spec đúng như đã nhập (đã trim); `reason` — vì sao bị từ chối, một câu tiếng Anh.
 * Trả: thể hiện `InvalidInstallSpecError` mới.
 * @throws {InvalidInstallSpecError} không ném — hàm chỉ DỰNG lỗi, không kiểm gì thêm.
 */
function invalid(spec: string, reason: string): InvalidInstallSpecError {
  return new InvalidInstallSpecError(spec, reason);
}

/**
 * Host mà một spec git được clone về: host của shorthand, `user@host` kiểu scp, hoặc host (kèm cổng) của URL.
 * Nhận: `spec` — spec git đã trim.
 * Trả: tên host viết thường.
 * @throws {TypeError} khi spec không khớp shorthand/scp nào và không phải URL hợp lệ (`new URL` ném).
 */
function gitHost(spec: string): string {
  const shorthand = /^([a-z]+):/i.exec(spec)?.[1]?.toLowerCase();
  if (shorthand !== undefined && Object.hasOwn(GIT_SHORTHAND_HOSTS, shorthand))
    return GIT_SHORTHAND_HOSTS[shorthand as keyof typeof GIT_SHORTHAND_HOSTS];
  const scp = /^git@([^:]+):/i.exec(spec)?.[1];
  if (scp !== undefined) return scp.toLowerCase();
  return new URL(spec.replace(/^git\+/i, "")).host;
}

/**
 * Đọc một spec thành dạng của nó. Đường dẫn phải TUYỆT ĐỐI: thư mục làm việc của Host không có nghĩa gì với
 * người đang gõ trong trình duyệt, và một đường dẫn tương đối phân giải theo profile sẽ trỏ vào bên trong nó.
 * Nhận: `raw` — spec đúng như đã nhập.
 * Trả: spec đã phân tích (`ParsedInstallSpec`: registry kèm name/range, path, tarball, hoặc git kèm host).
 * @throws {InvalidInstallSpecError} khi spec rỗng, là đường dẫn tương đối, là tên mà registry sẽ từ chối, hoặc
 * là URL không phải git host lẫn tarball.
 */
export function parseInstallSpec(raw: string): ParsedInstallSpec {
  const spec = raw.trim();
  if (spec === "") throw invalid(spec, "the package spec must not be empty");
  const path = spec.replace(/^(?:file|link):/, "");
  if (path !== spec || isAbsolute(path)) {
    if (!isAbsolute(path)) throw invalid(spec, "a local path must be absolute");
    return TARBALL_SPEC.test(path) ? { kind: "tarball", spec, path } : { kind: "path", spec, path };
  }
  if (/^\.{1,2}(?:[\\/]|$)/.test(spec)) throw invalid(spec, "a local path must be absolute");
  const git = GIT_SHORTHAND.test(spec) || GIT_URL.test(spec) || HOSTED_REPOSITORY_URL.test(spec);
  if (git && !TARBALL_SPEC.test(spec)) return { kind: "git", spec, host: gitHost(spec) };
  if (/^https?:\/\//i.test(spec)) {
    if (TARBALL_SPEC.test(spec)) return { kind: "tarball", spec, host: new URL(spec).host };
    throw invalid(spec, "a URL must point at a git repository or a tarball");
  }
  const at = spec.indexOf("@", 1);
  const name = at === -1 ? spec : spec.slice(0, at);
  const range = at === -1 ? undefined : spec.slice(at + 1);
  if (name.length > PACKAGE_NAME_MAX_LENGTH || !PACKAGE_NAME.test(name)) {
    throw invalid(spec, "not a package name the registry accepts");
  }
  if (range === "") throw invalid(spec, "a version after @ must not be empty");
  return range === undefined ? { kind: "registry", spec, name } : { kind: "registry", spec, name, range };
}

/** Một giá trị dependency đã ghi mà pnpm phân giải ngoài registry: protocol khác alias registry, hoặc địa chỉ git kiểu scp. */
const NON_REGISTRY_VALUE = /^(?!(?:npm|jsr|workspace|catalog):)[a-z][a-z0-9+.-]*:|^[^@/:\s]+@[^:/\s]+:/i;
/** Phần thông tin người dùng của một URL http(s), tới `@` cuối trước đường dẫn — nơi chứa mật khẩu hoặc access token khi có. */
const HTTP_USER_INFO = /^((?:git\+)?https?:\/\/)[^/]*@/i;

/**
 * Spec `pnpm add` nhận cho một dependency mà manifest profile ghi. Địa chỉ git, URL, hay protocol khác
 * registry là giá trị đã ghi BỎ phần thông tin người dùng của URL http(s), giữ nguyên query string; đường dẫn
 * `file:`/`link:` — pnpm ghi tương đối theo profile hoặc bằng `~` cho thư mục home — thành TUYỆT ĐỐI. Một
 * range/tag/alias registry đi sau tên dependency kèm `@`, như một giá trị ngoài registry được cài dưới tên
 * khác tên của chính package.
 * Nhận: `name` — tên dependency; `recorded` — giá trị manifest profile ghi; `profileDir` — thư mục profile
 * để phân giải đường dẫn cục bộ tương đối; `packageName` — tên manifest của package đã cài, khi đọc được.
 * Trả: spec cài được (chuỗi).
 */
export function dependencySpec(name: string, recorded: string, profileDir: string, packageName: string = name): string {
  const local = /^(file|link):(.*)$/s.exec(recorded);
  let spec: string;
  if (local !== null) {
    // Bỏ phần tử 0 (cả chuỗi khớp) để lấy đúng hai nhóm: scheme (file|link) và phần đường dẫn.
    const [, scheme = "", recordedPath = ""] = local;
    const path = recordedPath.replace(/^~(?=$|[\\/])/, () => homedir());
    spec = `${scheme}:${resolve(profileDir, path)}`;
  } else if (NON_REGISTRY_VALUE.test(recorded)) {
    spec = recorded.replace(HTTP_USER_INFO, "$1");
  } else {
    return `${name}@${recorded}`;
  }
  return packageName === name ? spec : `${name}@${spec}`;
}
