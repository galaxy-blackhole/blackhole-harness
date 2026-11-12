/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Luật LOẠI TRỪ của `embed.ts`: nhóm nào bị bỏ khỏi cây host nhúng, đo dung lượng từng nhóm, và
 *      bộ lọc dùng CHUNG cho bản chép (cpSync) lẫn bảng báo cáo. Tách khỏi embed.ts để giữ luật ≤ 1000 dòng.
 *      Mọi hàm ở đây là HÀM THUẦN trên đường dẫn: không đụng trạng thái ngoài `TrimContext`, nên bảng
 *      "đã loại" luôn khớp tuyệt đối với tệp thật sự không được chép.
 */
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

/** Tuỳ chọn lọc cây host. */
export interface TrimOptions {
  /** Giữ bộ LibreOffice (mặc định false: bỏ 155 MB; cờ `--keep-libreoffice`). */
  keepLibreOffice: boolean;
  /** Giữ NGUYÊN `apps/host/node_modules` (mặc định false: lọc theo phép đo boot). */
  kernelAll: boolean;
}

/** Một dòng của bảng "đã loại" (nhóm · MB · số tệp). */
export interface SkipRow {
  /** Nhãn nhóm (tiếng Việt, xem {@link SKIP_LABELS}). */
  label: string;
  /** Dung lượng bị loại, MB (1 MB = 1024 KB). */
  mb: number;
  /** Số tệp bị loại. */
  files: number;
}

/** Phần phụ thuộc mà `embed.ts` truyền vào (nhờ vậy module này không import ngược). */
export interface TrimContext {
  /** Gốc repo — mọi đường dẫn nguồn quy về đây để tính đường dẫn tương đối. */
  repoRoot: string;
  /** Các mục cấp 1 của cây host (xem `HOST_PATHS` trong embed.ts). */
  hostPaths: readonly string[];
  /** Đường dẫn (tương đối) của bộ LibreOffice phải bỏ khi không có cờ. */
  officePackage: string;
  /** Gói kernel này có được giữ không (hàm của embed.ts: danh sách đo boot + peer + ngoại lệ). */
  keepPackage: (rel: string) => boolean;
}

/** Bộ LibreOffice trong `packages/` (155 MB) — chỉ phục vụ chuyển office→pdf. */
export const OFFICE_PACKAGE = "packages/host/gbh-libreoffice-kit-darwin-x64";

/**
 * Tên thư mục bị loại khỏi `packages/**` (KHÔNG áp cho `apps/host/node_modules`: nhiều gói npm để mã chạy
 * trong `src/`, vd `send/node_modules/debug/src/node.js` — đo được là tệp ĐƯỢC NẠP lúc boot).
 *
 * - `src`: 30 MB mã nguồn; bản chạy trong .app dùng `lib/` đã build (mount chép lib/ vào profile).
 * - `test`/`tests`/`__tests__`: không có runner nào trong gói cài.
 * - `docs`: tài liệu từng gói; `docs/PARITY-MATRIX.md` ở cấp repo vẫn được giữ (nằm ngoài `packages/`).
 */
const PACKAGE_DROP_DIRS: readonly string[] = ["src", "test", "tests", "__tests__", "docs"];

/**
 * Tên thư mục bị loại trong `apps/host/node_modules` (KHÔNG có `src` — xem chú thích trên).
 * Không gói nào nạp `docs/` hay thư mục thử nghiệm lúc chạy; đo 12/11/2026: 7 thư mục · 2,5 MB.
 */
const MODULE_DROP_DIRS: readonly string[] = ["docs", "test", "tests", "__tests__"];

/**
 * Hai cây được phép bỏ `.ts`/`.d.ts`/`.md`.
 *
 * `apps/cli` KHÔNG nằm trong đây: vỏ Tauri chạy `node --experimental-strip-types apps/cli/src/main.ts`,
 * tức .ts ở đó LÀ mã chạy. `docs/` cấp repo cũng không: `docs/PARITY-MATRIX.md` là dữ liệu của cổng mount.
 */
const SOURCE_TRIM_SCOPES: readonly string[] = ["apps/host/node_modules/", "packages/"];

/** `.d.ts`/`.d.mts`/`.d.cts`: chỉ `tsc` đọc, runtime không bao giờ nạp (đo 12/11/2026: 26,9 MB · 4673 tệp). */
const TYPE_DECL = /\.d\.(ts|mts|cts)$/u;

/** Mã nguồn TS (trừ khai báo kiểu) — bỏ được khi không phải entry trong package.json của gói. */
const TS_SOURCE = /\.(ts|mts|cts)$/u;

/** Tên thư mục prebuild của một nền tảng (`darwin-x64`, `win32-arm64`, …). */
const PREBUILD_TAG = /^(darwin|win32|linux|freebsd|openbsd|android)-(x64|arm64|arm|armv7l|ia32|universal)$/u;

/** Nền tảng của máy đang chạy, đúng cách node-pty/sharp đặt tên thư mục prebuild (`darwin-x64`). */
const HOST_PREBUILD_TAG = `${process.platform}-${process.arch}`;

/** Prebuild được GIỮ: đúng nền tảng máy này, hoặc bản `universal` (chạy được mọi kiến trúc). */
const KEEP_PREBUILD_TAGS: readonly string[] = [HOST_PREBUILD_TAG, `${process.platform}-universal`];

/** Mẫu tệp bị loại ở MỌI nơi trong cây chép (không có tác dụng lúc chạy: chỉ cho gỡ lỗi/đọc). */
const DROP_FILE_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: "map", pattern: /\.map$/u },
  { label: "map", pattern: /\.tsbuildinfo$/u },
  { label: "stamp", pattern: /^\.DS_Store$/u },
  { label: "stamp", pattern: /^\.gbh-/u },
  { label: "stamp", pattern: /\.debundled$/u },
  { label: "stamp", pattern: /\.log$/u },
  { label: "stamp", pattern: /\.truoc-vi$/u },
  { label: "readme", pattern: /^README(\..+)?$/u },
  { label: "readme", pattern: /^CHANGELOG(\..+)?$/u },
  { label: "readme", pattern: /^HISTORY(\..+)?$/u },
];

/** Nhãn hiển thị của từng nhóm loại trừ trong báo cáo TRƯỚC/SAU. */
export const SKIP_LABELS: Record<string, string> = {
  office: "office: gbh-libreoffice-kit-darwin-x64",
  kernel: "kernel: gói ngoài đường boot (V8)",
  prebuild: "prebuild của nền tảng khác",
  moduledocs: "node_modules: docs/ test/",
  src: "packages: src/ test/ docs/",
  types: "khai báo kiểu (*.d.ts)",
  ts: "nguồn TS (*.ts, không phải entry)",
  markdown: "README/CHANGELOG/*.md",
  map: "source map (*.map, *.tsbuildinfo)",
  stamp: "stamp/log/.DS_Store",
};

/**
 * Dung lượng + số tệp của một cây.
 * Nhận: path — tệp hoặc thư mục.
 * Trả: { bytes, files }; 0/0 khi đường dẫn không đọc được.
 * @remarks Dùng lstat, KHÔNG stat: cây host có symlink trỏ về repo và đi theo chúng sẽ lặp vô hạn.
 */
export function treeSize(path: string): { bytes: number; files: number } {
  let bytes = 0;
  let files = 0;
  const walk = (target: string): void => {
    let stat;
    try {
      stat = lstatSync(target);
    } catch {
      return;
    }
    if (stat.isSymbolicLink()) return;
    if (!stat.isDirectory()) {
      bytes += stat.size;
      files += 1;
      return;
    }
    for (const entry of readdirSync(target)) walk(join(target, entry));
  };
  walk(path);
  return { bytes, files };
}

/**
 * Dung lượng một cây thư mục, tính bằng MB (1 MB = 1024 KB).
 * Nhận: path — tệp hoặc thư mục. Trả: số MB, làm tròn 1 chữ số.
 */
export function sizeMb(path: string): number {
  return Math.round((treeSize(path).bytes / 1024 / 1024) * 10) / 10;
}

/**
 * Tên gói top-level của một đường dẫn trong `apps/host/node_modules`.
 * Nhận: rel — đường dẫn tương đối trong cây host, dạng `apps/host/node_modules/…`.
 * Trả: tên gói (`@scope/ten` hoặc `ten`), hoặc undefined khi không thuộc node_modules.
 */
function kernelPackageOf(rel: string): string | undefined {
  const parts = rel.split("/");
  if (parts[0] !== "apps" || parts[1] !== "host" || parts[2] !== "node_modules" || parts.length < 5) return undefined;
  return parts[3] === undefined ? undefined : parts[3].startsWith("@") ? parts[3] + "/" + parts[4] : parts[3];
}

/**
 * Đường dẫn (tương đối, dạng `/`) có thuộc cây được phép bỏ `.ts`/`.md` không.
 * Nhận: rel — đường dẫn tương đối trong cây host. Trả: true khi thuộc {@link SOURCE_TRIM_SCOPES}.
 */
function inSourceScope(rel: string): boolean {
  return SOURCE_TRIM_SCOPES.some((scope) => rel.startsWith(scope));
}

/**
 * Thư mục prebuild của nền tảng KHÁC máy này, nếu có.
 * Nhận: rel — đường dẫn tương đối trong cây host (đã đổi `\` thành `/`).
 * Trả: tag nền tảng (`win32-x64`, `linux-arm64`, …) khi phải bỏ; undefined khi giữ.
 * @remarks Máy này là `${process.platform}-${process.arch}` (xem {@link HOST_PREBUILD_TAG}); bản
 *          `universal` cũng giữ vì nó chạy được trên mọi kiến trúc cùng HĐH.
 */
function foreignPrebuild(rel: string): string | undefined {
  const parts = rel.split("/");
  const at = parts.indexOf("prebuilds");
  if (at < 0) return undefined;
  const tag = parts[at + 1];
  if (tag === undefined || !PREBUILD_TAG.test(tag)) return undefined;
  return KEEP_PREBUILD_TAGS.includes(tag) ? undefined : tag;
}

/** Nhớ tập entry runtime của mọi gói (hàm dưới được gọi cho từng tệp khi chép). */
let cacheRuntimeEntries: Set<string> | undefined;

/**
 * Tệp `.ts` mà một `package.json` trỏ tới (`main`/`module`/`bin`/`exports`, BỎ khoá `types`/`typings`).
 *
 * Vì sao phải giữ: gói npm có thể để mã chạy ở `src/*.ts` (Node 26 strip-types nạp thẳng được). Bỏ đúng
 * tệp đó là gói chết — nên luật "bỏ nguồn TS" chỉ áp cho tệp KHÔNG được manifest nào trỏ tới.
 * Nhận: repoRoot — gốc repo. Trả: tập đường dẫn tuyệt đối (đã resolve) của các entry như vậy.
 */
function runtimeEntries(repoRoot: string): Set<string> {
  if (cacheRuntimeEntries !== undefined) return cacheRuntimeEntries;
  const entries = new Set<string>();
  const collect = (pkgDir: string): void => {
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as unknown;
    } catch {
      return;
    }
    const walk = (value: unknown, key: string): void => {
      if (typeof value === "string") {
        if (key === "types" || key === "typings") return;
        // package.json luôn ghi đường dẫn TƯƠNG ĐỐI cho main/bin/exports — nhận cả "src/index.ts" lẫn "./src/index.ts".
        if (!TS_SOURCE.test(value) || TYPE_DECL.test(value)) return;
        entries.add(resolve(pkgDir, value));
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) walk(item, key);
        return;
      }
      if (value === null || typeof value !== "object") return;
      for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) walk(child, childKey);
    };
    for (const key of ["main", "module", "bin", "exports"]) walk((doc as Record<string, unknown>)[key], key);
  };
  const scan = (root: string): void => {
    let names: string[] = [];
    try {
      names = readdirSync(root);
    } catch {
      return;
    }
    for (const name of names) {
      if (name.startsWith(".")) continue;
      if (!name.startsWith("@")) {
        collect(join(root, name));
        continue;
      }
      let scoped: string[] = [];
      try {
        scoped = readdirSync(join(root, name));
      } catch {
        continue;
      }
      for (const child of scoped) collect(join(root, name, child));
    }
  };
  scan(join(repoRoot, "apps", "host", "node_modules"));
  for (const tier of ["host", "client"]) scan(join(repoRoot, "packages", tier));
  cacheRuntimeEntries = entries;
  return entries;
}

/**
 * Nhóm loại trừ của một đường dẫn nguồn.
 * Nhận: source — đường dẫn tuyệt đối trong repo; trim — tuỳ chọn lọc; ctx — phụ thuộc của embed.ts.
 * Trả: khoá nhóm (xem {@link SKIP_LABELS}) khi bị bỏ; undefined khi được chép.
 * @remarks Thứ tự kiểm tra = thứ tự ưu tiên trong báo cáo: một đường dẫn chỉ rơi vào MỘT nhóm.
 */
export function skipReason(source: string, trim: TrimOptions, ctx: TrimContext): string | undefined {
  const rel = relative(ctx.repoRoot, source).split(sep).join("/");
  // `.gbh-embedded` do chính buildHostTree ghi (dấu "dùng lib/ dựng sẵn") — không bao giờ lọc.
  if (rel === "" || rel === ".gbh-embedded") return undefined;
  const name = basename(source);
  let isDir = false;
  try {
    isDir = lstatSync(source).isDirectory();
  } catch {
    return undefined;
  }
  // (1) Bộ LibreOffice: 155 MB, chỉ phục vụ office→pdf — không nằm trên đường boot+render.
  if (!trim.keepLibreOffice && (rel === ctx.officePackage || rel.startsWith(ctx.officePackage + "/"))) return "office";
  // (2) Kernel: chỉ giữ gói đã đo là được nạp lúc boot (+ peer của gói ta + ngoại lệ có chủ đích).
  if (!trim.kernelAll) {
    const pkg = kernelPackageOf(rel);
    if (pkg !== undefined && pkg !== "" && !ctx.keepPackage(rel)) return "kernel";
  }
  // (3) Nguồn/thử nghiệm/tài liệu của chính gói ta (bản chạy dùng lib/ dựng sẵn).
  if (rel.startsWith("packages/") && isDir && PACKAGE_DROP_DIRS.includes(name)) return "src";
  // (4) docs/ + test/ trong node_modules.
  if (inSourceScope(rel) && isDir && MODULE_DROP_DIRS.includes(name)) return "moduledocs";
  // (5) Prebuild của nền tảng khác.
  if (foreignPrebuild(rel) !== undefined) return "prebuild";
  // (6) Khai báo kiểu: không bao giờ nạp lúc chạy.
  if (TYPE_DECL.test(name)) return "types";
  // (7) Nguồn TS: GIỮ tệp mà package.json trỏ tới (entry runtime), bỏ phần còn lại.
  if (TS_SOURCE.test(name) && inSourceScope(rel) && !runtimeEntries(ctx.repoRoot).has(source)) return "ts";
  // (8) Rác không đọc lúc chạy: map, stamp, log, README/CHANGELOG.
  for (const rule of DROP_FILE_PATTERNS) if (rule.pattern.test(name)) return rule.label;
  // (9) Markdown trong cây chạy.
  if (name.endsWith(".md") && inSourceScope(rel)) return "markdown";
  return undefined;
}

/**
 * Bộ lọc của cpSync: true khi bỏ qua đường dẫn này.
 * Nhận: source, trim, ctx — như {@link skipReason}. Trả: true khi không chép.
 */
export function skippable(source: string, trim: TrimOptions, ctx: TrimContext): boolean {
  return skipReason(source, trim, ctx) !== undefined;
}

/**
 * Quét cây NGUỒN và cộng dung lượng theo từng nhóm loại trừ.
 * Nhận: trim — tuỳ chọn lọc; ctx — phụ thuộc của embed.ts.
 * Trả: các dòng { nhóm, MB, tệp } đã bị bỏ, sắp theo MB giảm dần (rỗng khi không bỏ gì).
 * @remarks Dùng ĐÚNG bộ lọc của cpSync ({@link skipReason}) nên bảng báo cáo không thể lệch bản chép;
 *          nhờ vậy "đã bỏ bao nhiêu" là phép ĐO, không phải lời khai.
 */
export function auditExclusions(trim: TrimOptions, ctx: TrimContext): SkipRow[] {
  const totals = new Map<string, { bytes: number; files: number }>();
  const walk = (target: string): void => {
    let stat;
    try {
      stat = lstatSync(target);
    } catch {
      return;
    }
    if (stat.isSymbolicLink()) return;
    const label = skipReason(target, trim, ctx);
    if (label !== undefined) {
      const size = treeSize(target);
      const row = totals.get(label) ?? { bytes: 0, files: 0 };
      row.bytes += size.bytes;
      row.files += size.files;
      totals.set(label, row);
      return;
    }
    if (!stat.isDirectory()) return;
    for (const child of readdirSync(target)) walk(join(target, child));
  };
  for (const rel of ctx.hostPaths) {
    const from = join(ctx.repoRoot, rel);
    if (existsSync(from)) walk(from);
  }
  return [...totals]
    .map(([label, row]) => ({
      label: SKIP_LABELS[label] ?? label,
      mb: Math.round((row.bytes / 1024 / 1024) * 10) / 10,
      files: row.files,
    }))
    .sort((left, right) => right.mb - left.mb);
}
