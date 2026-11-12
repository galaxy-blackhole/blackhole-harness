/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Đóng gói .app TỰ CHỨA: chép runtime NODE + host vào Contents/Resources, ký ad-hoc rồi in dung lượng
 *      11/11/2026: BỎ bun khỏi gói cài. Đo được: harness chỉ boot bằng Node (`node-addon-require-builtin` là
 *      N-API, cần symbol V8 của Node) — chạy bằng bun thì chết với "Unsupported/no-context". Vì vậy .app
 *      nhúng ĐÚNG MỘT runtime là `Contents/Resources/runtime/node`; CLI `blackhole` nếu cần bun thì đó là
 *      chuyện của repo khác, không kéo bun vào app này.
 *      12/11/2026: RÚT GỌN cây host 825 MB → ~120 MB (xem PACKAGING.md §7). Mọi nhóm bị loại được áp NGAY
 *      trong lúc chép (cpSync filter) nên idempotent — không cắt tay, không sót tệp cũ:
 *        (1) nguồn/thử nghiệm/tài liệu của `packages/**` — bản chạy dùng `lib/` dựng sẵn;
 *        (2) bộ LibreOffice 155 MB (chỉ phục vụ office→pdf, không nằm trên đường boot+render); cờ
 *            `--keep-libreoffice` (tên cũ `--keep-office`) để đóng gói kèm;
 *        (3) `apps/host/node_modules` chỉ giữ gói THẬT SỰ được nạp lúc boot, đo bằng NODE_V8_COVERAGE;
 *        (4) trong các gói còn lại: prebuild của nền tảng khác, `docs/`/`test/`, `*.md`, `*.d.ts`,
 *            nguồn `.ts` (trừ tệp mà package.json trỏ tới), `*.map`, `*.tsbuildinfo`;
 *        (5) dấu `.gbh-*`, `*.debundled`, `*.log`, `.DS_Store`, bản sao lưu `*.truoc-vi`.
 *      Không nhóm nào chạm `apps/cli` (chạy thẳng .ts bằng node strip-types) hay `docs/` cấp repo.
 */

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  auditExclusions,
  OFFICE_PACKAGE,
  sizeMb,
  skippable,
  treeSize,
  type SkipRow,
  type TrimContext,
  type TrimOptions,
} from "./embed-trim.ts";

/** Thư mục chứa script này — Bun có `import.meta.dir`, Node thì không, nên đọc qua `import.meta.url`. */
const here = dirname(fileURLToPath(import.meta.url));

/** Gốc repo, suy từ vị trí tệp này nên chạy được từ bất kỳ cwd nào. */
const repoRoot = resolve(here, "..", "..", "..");

/**
 * Mọi thứ host cần lúc chạy, tính từ gốc repo.
 *
 * Root `node_modules` KHÔNG chép: 609 MB, trong đó 604 MB là kho `.bun`. Nó chỉ cần TỒN TẠI để `packages/**`
 * phân giải peer (`@deepseek-ai/cordis`, `schemastery`…), và mọi peer đó đã nằm trong
 * `apps/host/node_modules` — nên embed nối một symlink `host/node_modules -> apps/host/node_modules`.
 * Đo 11/11/2026: boot bằng cây nhúng + symlink này cho 0 dòng 'failed to import' và trang render 38 slot.
 * Bản sao đầy đủ 609 MB cũng boot được, chỉ phình gói cài thêm 609 MB mà không thêm năng lực nào.
 */
const HOST_PATHS: readonly string[] = [
  "apps/cli",
  "apps/host",
  "packages",
  "profiles",
  "tools/p1b",
  "package.json",
  "tsconfig.base.json",
  "docs/PARITY-MATRIX.md",
];

/** Node major thấp nhất chấp nhận được (khớp `apps/cli/src/paths.ts`). */
const MIN_NODE_MAJOR = 26;



/**
 * Gói top-level trong `apps/host/node_modules` THẬT SỰ được nạp lúc boot.
 *
 * Đo 12/11/2026 bằng `NODE_V8_COVERAGE` trên một lượt boot trọn vẹn (cổng 55931, home nhân bản của
 * `~/.galaxy/blackhole`, probe `rootChars` 634955 · 357 slot): 1030 tệp trong cây ⇒ 114 gói top-level,
 * 35,6 MB trên tổng 532 MB. Phần còn lại (423 MB) chỉ được `require` MUỘN (provider SDK, node-pty, sharp,
 * sherpa, bộ LibreOffice…) nên không nằm trên đường boot+render — xem PACKAGING.md §7 để biết mất gì.
 *
 * Danh sách này là hợp đồng với kernel: kernel đổi phiên bản thì phải ĐO LẠI (boot sẽ báo
 * "Cannot find module" ngay dòng đầu nếu thiếu). `--kernel-all` tắt hẳn bước lọc.
 */
const KERNEL_BOOT_PACKAGES: readonly string[] = [
  "@deepseek-ai/cordis",
  "@deepseek-ai/cordis-plugin-group",
  "@deepseek-ai/cordis-plugin-loader",
  "@deepseek-ai/cosmokit",
  "@deepseek-ai/dsh",
  "@deepseek-ai/dsh-app-boot",
  "@deepseek-ai/dsh-atomic-write",
  "@deepseek-ai/dsh-brand",
  "@deepseek-ai/dsh-cmdline",
  "@deepseek-ai/dsh-home-paths",
  "@deepseek-ai/dsh-http-proxy",
  "@deepseek-ai/dsh-launch-environment",
  "@deepseek-ai/dsh-llm",
  "@deepseek-ai/dsh-sandbox",
  "@deepseek-ai/dsh-timeout",
  "@deepseek-ai/dsh-typert-protocol",
  "@deepseek-ai/dsh-util-crypto",
  "@deepseek-ai/dsh-util-values",
  "@deepseek-ai/libreoffice-kit",
  "@deepseek-ai/schemastery",
  "@earendil-works/pi-ai",
  "@earendil-works/pi-telemetry",
  "@js-temporal/polyfill",
  "@keyv/serialize",
  "@opentelemetry/api",
  "@opentelemetry/api-logs",
  "@opentelemetry/core",
  "@opentelemetry/otlp-exporter-base",
  "@opentelemetry/otlp-transformer",
  "@opentelemetry/resources",
  "@opentelemetry/sdk-logs",
  "@opentelemetry/sdk-metrics",
  "@opentelemetry/semantic-conventions",
  "@sec-ant/readable-stream",
  "@sindresorhus/is",
  "@sindresorhus/merge-streams",
  "byte-counter",
  "bytes",
  "cacheable-lookup",
  "cacheable-request",
  "chokidar",
  "commander",
  "compressible",
  "compression",
  "content-type",
  "debug",
  "decompress-response",
  "depd",
  "destroy",
  "diff",
  "ee-first",
  "encodeurl",
  "escape-html",
  "etag",
  "execa",
  "figures",
  "form-data-encoder",
  "fresh",
  "get-stream",
  "got",
  "http-cache-semantics",
  "http-errors",
  "http2-wrapper",
  "human-signals",
  "inherits",
  "ipaddr.js",
  "is-plain-obj",
  "is-stream",
  "is-unicode-supported",
  "js-yaml",
  "jsbi",
  "keyv",
  "lowercase-keys",
  "mime-db",
  "mime-types",
  "mimic-response",
  "minisearch",
  "ms",
  "negotiator",
  "node-addon-native-custom-loader",
  "node-addon-require-builtin",
  "node-addon-require-builtin-darwin-x64",
  "normalize-url",
  "npm-run-path",
  "on-finished",
  "on-headers",
  "p-cancelable",
  "p-limit",
  "parse-ms",
  "parseurl",
  "pretty-ms",
  "quick-lru",
  "range-parser",
  "readdirp",
  "resolve-alpn",
  "resolve.exports",
  "responselike",
  "safe-buffer",
  "semver",
  "send",
  "serve-static",
  "setprototypeof",
  "signal-exit",
  "statuses",
  "strip-final-newline",
  "toidentifier",
  "unicorn-magic",
  "vary",
  "which-command",
  "ws",
  "yaml",
  "yocto-queue",
  "yoctocolors",
  "zod",
];

/**
 * Gói kernel GIỮ THÊM dù không xuất hiện trong phép đo coverage.
 *
 * - `node-addon-system-*`: addon N-API cho khoá tệp (flock) — `gbh-node-addon-system` gọi
 *   `require.resolve` tới nó MUỘN; thiếu thì `gateway/internal: resume failed` và menu "/" mất mục
 *   (xem mount.ts `linkNativeAddonPackages`). 2 MB.
 * - `@vscode/ripgrep-darwin-x64`: binary `rg` mà `@vscode/ripgrep` (peer) gọi tới; thiếu thì mọi lượt
 *   tìm tệp/nội dung của agent hỏng. 4,5 MB — công cụ lõi, không phải tính năng phụ.
 */
const KERNEL_EXTRA_PACKAGES: readonly string[] = [
  "@deepseek-ai/node-addon-system",
  "@deepseek-ai/node-addon-system-darwin-x64",
  "@vscode/ripgrep-darwin-x64",
];



/** Bản kernel của cùng bộ đó trong `apps/host/node_modules` (155 MB). */
const OFFICE_KERNEL_PACKAGE = "@deepseek-ai/libreoffice-kit-darwin-x64";

/** Nhóm dung lượng trong báo cáo TRƯỚC/SAU. */
interface SizeRow {
  /** Tên nhóm (đường dẫn tương đối trong cây host). */
  group: string;
  /** MB của nguồn trong repo (0 khi là nhóm chỉ tồn tại trong gói). */
  beforeMb: number;
  /** MB sau khi chép/lọc. */
  afterMb: number;
  /** Số tệp sau khi lọc. */
  files: number;
}

/** Kết quả một lượt đóng gói. */
interface EmbedReport {
  /** Đường dẫn .app đã sửa. */
  app: string;
  /** Dung lượng .app trước khi nhúng (MB). */
  beforeMb: number;
  /** Dung lượng .app sau khi nhúng (MB). */
  afterMb: number;
  /** Số tệp trong .app sau khi nhúng. */
  files: number;
  /** Runtime node đã nhúng: đường dẫn đích, nguồn, và ghi chú về npm/npx/corepack. */
  runtime: { path: string; source: string; mb: number; version: string; note: string };
  /** Thư mục host đã nhúng (MB). */
  hostMb: number;
  /** Số tệp trong cây host. */
  hostFiles: number;
  /** Bảng dung lượng theo nhóm. */
  rows: SizeRow[];
  /** Bảng dung lượng đã loại theo nhóm (office, kernel, prebuild, kiểu, TS, map…). */
  exclusions: SkipRow[];
  /** Số gói kernel bị loại. */
  kernelDropped: number;
  /** MB kernel bị loại. */
  kernelDroppedMb: number;
  /** Các mục cấp 1 trong Contents/Resources. */
  resources: string[];
}



/** Tham số dòng lệnh. */
interface CliArgs {
  /** .app đích (rỗng = tự dò). */
  app: string;
  /** Binary shell thay thế. */
  binary: string;
  /** Có ký ad-hoc không. */
  sign: boolean;
  /** Chỉ dựng cây host tại đường dẫn này, không đụng .app và không ký. */
  tree: string;
  /** Tuỳ chọn lọc. */
  trim: TrimOptions;
}

/**
 * Đọc tham số dòng lệnh.
 * Nhận: argv — tham số sau tên script.
 * Trả: { app, binary, sign, tree, trim }; app rỗng khi người gọi chưa chỉ định.
 */
function parseArgs(argv: string[]): CliArgs {
  let app = "";
  let binary = "";
  let tree = "";
  let sign = true;
  let keepLibreOffice = false;
  let kernelAll = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--app") {
      app = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--binary") {
      binary = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--tree") {
      tree = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--keep-libreoffice" || arg === "--keep-office") {
      // Hai tên cho CÙNG một cờ: `--keep-libreoffice` là tên chuẩn (chỉ đúng gói bị bỏ),
      // `--keep-office` giữ lại để script cũ không gãy.
      keepLibreOffice = true;
    } else if (arg === "--kernel-all") {
      kernelAll = true;
    } else if (arg === "--no-sign") {
      sign = false;
    }
  }
  return { app, binary, sign, tree, trim: { keepLibreOffice, kernelAll } };
}

/**
 * Đường dẫn đầu tiên tồn tại trong danh sách.
 * Nhận: candidates — các đường dẫn ứng viên.
 * Trả: đường dẫn tồn tại, hoặc undefined.
 */
function firstExisting(candidates: readonly string[]): string | undefined {
  return candidates.find((path) => path !== "" && existsSync(path));
}

/**
 * Ứng viên runtime Node cần nhúng, theo đúng thứ tự vận hành: `GBH_NODE` → node đang chạy → nvm mới nhất
 * → các vị trí hệ thống. Không có bun trong danh sách này, và sẽ không bao giờ có.
 * Nhận: không.
 * Trả: danh sách đường dẫn tuyệt đối (chưa kiểm phiên bản).
 */
function nodeCandidates(): string[] {
  const home = process.env.HOME ?? "";
  const nvmRoot = join(home, ".nvm", "versions", "node");
  let nvm: string[] = [];
  try {
    nvm = readdirSync(nvmRoot)
      .filter((name) => /^v(\d+)\./u.test(name))
      .filter((name) => Number(/^v(\d+)/u.exec(name)?.[1] ?? "0") >= MIN_NODE_MAJOR)
      .sort((left, right) => Number(/^v(\d+)/u.exec(right)?.[1] ?? "0") - Number(/^v(\d+)/u.exec(left)?.[1] ?? "0"))
      .map((version) => join(nvmRoot, version, "bin", "node"));
  } catch {
    // Không có nvm là chuyện bình thường: rơi xuống node đang chạy và các vị trí hệ thống.
  }
  return [process.env.GBH_NODE ?? "", process.execPath, ...nvm, "/usr/local/bin/node", "/opt/homebrew/bin/node"];
}

/**
 * Phiên bản mà một binary node in ra.
 * Nhận: bin — đường dẫn node.
 * Trả: chuỗi `vX.Y.Z`, hoặc undefined khi tệp không chạy được.
 */
function nodeVersion(bin: string): string | undefined {
  const probe = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 15_000 });
  if (probe.status !== 0) return undefined;
  return /v?\d+\.\d+\.\d+/u.exec(probe.stdout ?? "")?.[0];
}

/**
 * Chọn runtime Node đủ mới để nhúng.
 * Nhận: không.
 * Trả: { path, version } — binary tuyệt đối và phiên bản nó in ra.
 * @throws khi máy không có bản node >= {@link MIN_NODE_MAJOR} nào chạy được.
 */
function resolveNode(): { path: string; version: string } {
  const tried: string[] = [];
  for (const candidate of nodeCandidates()) {
    if (candidate === "" || !existsSync(candidate)) {
      tried.push(candidate + " (không có)");
      continue;
    }
    const version = nodeVersion(candidate);
    if (version === undefined) {
      tried.push(candidate + " (không trả --version)");
      continue;
    }
    const major = Number(version.slice(1).split(".")[0]);
    if (major < MIN_NODE_MAJOR) {
      tried.push(candidate + " (" + version + ", dưới v" + MIN_NODE_MAJOR + ")");
      continue;
    }
    return { path: candidate, version };
  }
  throw new Error("không tìm thấy node >= v" + MIN_NODE_MAJOR + " để nhúng. Đã thử: " + tried.join("; "));
}



/**
 * Tên gói top-level của một đường dẫn trong `apps/host/node_modules`.
 * Nhận: rel — đường dẫn tương đối trong cây host, dạng `apps/host/node_modules/…`.
 * Trả: tên gói (`@scope/ten` hoặc `ten`), hoặc undefined khi không thuộc node_modules.
 */
function kernelPackageOf(rel: string): string | undefined {
  // 12/11/2026 — `parts[i]` dưới `noUncheckedIndexedAccess` là `string | undefined`, nên phép so độ dài
  // KHÔNG thu hẹp được kiểu (typecheck đỏ TS2532). Tách biến + kiểm undefined là cách thu hẹp thật.
  const [area, host, modules, first, second] = rel.split("/");
  if (area !== "apps" || host !== "host" || modules !== "node_modules") return undefined;
  if (first === undefined || second === undefined) return undefined;
  return first.startsWith("@") ? first + "/" + second : first;
}



/** Nhớ kết quả quét peer trong tiến trình (được gọi cho từng tệp khi chép). */
let cachePeers: Set<string> | undefined;

/**
 * Tập peer kernel mà mount đòi phải CÓ MẶT trước khi mount một gói của ta.
 *
 * Vì sao phải giữ: `mount.ts` (dòng ~475) chép mỗi `gbh.peers` thành symlink trong profile và
 * **từ chối mount** khi peer vắng mặt trong kernel — rồi rơi về row stock (đo 12/11/2026: bỏ peer ⇒
 * 39 dòng "khong mount duoc … thieu peer trong kernel" ⇒ webserver không mount ⇒ boot chết).
 * Quét thẳng `package.json` của từng gói trong `packages/<tầng>/` nên danh sách luôn khớp mã nguồn.
 * Nhận: không. Trả: tập tên gói (đã bỏ gói `@galaxy-blackhole/*` vì chúng không nằm trong kernel).
 */
function kernelPeers(): Set<string> {
  if (cachePeers !== undefined) return cachePeers;
  const peers = new Set<string>();
  for (const tier of ["host", "client"]) {
    const root = join(repoRoot, "packages", tier);
    let names: string[] = [];
    try {
      names = readdirSync(root);
    } catch {
      continue;
    }
    for (const name of names) {
      const manifest = join(root, name, "package.json");
      let doc: { gbh?: { peers?: unknown }; peerDependencies?: Record<string, string> };
      try {
        doc = JSON.parse(readFileSync(manifest, "utf8")) as typeof doc;
      } catch {
        continue;
      }
      const declared = doc.gbh?.peers;
      if (Array.isArray(declared)) {
        for (const peer of declared) if (typeof peer === "string") peers.add(peer);
      } else {
        peers.add("@deepseek-ai/cordis");
        peers.add("@deepseek-ai/schemastery");
      }
      for (const peer of Object.keys(doc.peerDependencies ?? {})) peers.add(peer);
    }
  }
  for (const peer of [...peers]) if (peer.startsWith("@galaxy-blackhole/")) peers.delete(peer);
  cachePeers = peers;
  return peers;
}

/**
 * Gói kernel này có được giữ lại không.
 * Nhận: pkg — tên gói top-level.
 * Trả: true khi được nạp lúc boot, là peer của một gói ta, hoặc nằm trong danh sách giữ thêm.
 */
function keepKernelPackage(pkg: string): boolean {
  return KERNEL_BOOT_PACKAGES.includes(pkg) || KERNEL_EXTRA_PACKAGES.includes(pkg) || kernelPeers().has(pkg);
}

/** Nhớ ngữ cảnh lọc (dựng MỘT lần: danh sách gói kernel giữ + đường dẫn gốc). */
let cacheTrimContext: TrimContext | undefined;

/**
 * Ngữ cảnh lọc dùng chung cho bộ lọc ở `embed-trim.ts`.
 * Nhận: không. Trả: { repoRoot, hostPaths, officePackage, keepPackage }.
 * @remarks `keepPackage` nhận đường dẫn TƯƠNG ĐỐI trong cây host để tự cắt tên gói — nhờ vậy luật
 *          "gói nào được giữ" vẫn nằm DUY NHẤT trong embed.ts (đo boot + peer), còn luật "bỏ gì" ở module kia.
 */
function trimContext(): TrimContext {
  if (cacheTrimContext !== undefined) return cacheTrimContext;
  cacheTrimContext = {
    repoRoot,
    hostPaths: HOST_PATHS,
    officePackage: OFFICE_PACKAGE,
    keepPackage: (rel) => {
      const pkg = kernelPackageOf(rel);
      return pkg === undefined || pkg === "" || keepKernelPackage(pkg);
    },
  };
  return cacheTrimContext;
}

/**
 * Chép một cây thư mục qua bộ lọc, xoá đích trước để lượt nhúng lại không để sót tệp cũ.
 * Nhận: from — nguồn tuyệt đối; to — đích tuyệt đối; trim — tuỳ chọn lọc.
 * Trả: không.
 */
function copyTree(from: string, to: string, trim: TrimOptions): void {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true, filter: (source) => !skippable(source, trim, trimContext()) });
}



/**
 * Dựng cây host đã rút gọn tại `hostRoot` (idempotent: xoá rồi dựng lại).
 * Nhận: hostRoot — thư mục đích; trim — tuỳ chọn lọc.
 * Trả: bảng dung lượng theo nhóm + tổng MB/số tệp + bảng đã loại + số gói kernel bị bỏ.
 */
function buildHostTree(hostRoot: string, trim: TrimOptions): { rows: SizeRow[]; hostMb: number; hostFiles: number; kernelDropped: number; kernelDroppedMb: number; exclusions: SkipRow[] } {
  const exclusions = auditExclusions(trim, trimContext());
  rmSync(hostRoot, { recursive: true, force: true });
  mkdirSync(hostRoot, { recursive: true });
  const rows: SizeRow[] = [];
  for (const rel of HOST_PATHS) {
    const from = join(repoRoot, rel);
    if (!existsSync(from)) {
      console.warn("[embed] thiếu " + rel + " — bỏ qua");
      continue;
    }
    const to = join(hostRoot, rel);
    copyTree(from, to, trim);
    const stats = treeSize(to);
    rows.push({ group: rel, beforeMb: sizeMb(from), afterMb: Math.round((stats.bytes / 1024 / 1024) * 10) / 10, files: stats.files });
  }
  // Root node_modules của repo → apps/host/node_modules (xem HOST_PATHS): đủ mọi peer, không tốn 609 MB.
  const rootModules = join(hostRoot, "node_modules");
  rmSync(rootModules, { recursive: true, force: true });
  symlinkSync(join("apps", "host", "node_modules"), rootModules);

  const kernel = auditKernel(join(hostRoot, "apps", "host", "node_modules"), trim);
  writeFileSync(
    join(hostRoot, ".gbh-embedded"),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        marker: "host nhúng — mount dùng lib/ dựng sẵn, không chạy build.ts",
        trim: trim.keepLibreOffice ? "office:giu" : "office:bo",
        kernel: trim.kernelAll ? "all" : "boot-only",
      },
      null,
      2,
    ) + "\n",
  );
  const stats = treeSize(hostRoot);
  return {
    rows,
    hostMb: Math.round((stats.bytes / 1024 / 1024) * 10) / 10,
    hostFiles: stats.files,
    kernelDropped: kernel.dropped,
    kernelDroppedMb: Math.round(kernel.droppedBytes / 1024 / 1024 * 10) / 10,
    exclusions,
  };
}

/**
 * Đối chiếu `apps/host/node_modules` sau khi chép với danh sách giữ, và dọn tàn dư.
 * Nhận: modules — thư mục node_modules trong cây đích; trim — tuỳ chọn lọc.
 * Trả: { dropped, droppedBytes } — số gói và số byte đã bị loại (0 khi giữ tất cả).
 * @remarks Bộ lọc của cpSync đã bỏ gói ngoài danh sách; hàm này chỉ để ĐO và dọn thư mục rỗng
 *          (`.bin`, scope không còn con) — nhờ vậy báo cáo nói đúng "đã bỏ bao nhiêu".
 */
function auditKernel(modules: string, trim: TrimOptions): { dropped: number; droppedBytes: number } {
  let dropped = 0;
  let droppedBytes = 0;
  rmSync(join(modules, ".bin"), { recursive: true, force: true });
  for (const entry of readdirSync(modules)) {
    const path = join(modules, entry);
    if (!entry.startsWith("@")) continue;
    let children: string[] = [];
    try {
      children = readdirSync(path);
    } catch {
      continue;
    }
    if (children.length === 0) {
      rmSync(path, { recursive: true, force: true });
      continue;
    }
  }
  // `--kernel-all`: không lọc gói nào ⇒ báo cáo phải nói 0, không được mượn danh sách giữ để đếm.
  if (trim.kernelAll) return { dropped, droppedBytes };
  const sourceModules = join(repoRoot, "apps", "host", "node_modules");
  const walk = (dir: string, prefix: string): void => {
    let names: string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name.startsWith("@")) {
        walk(join(dir, name), prefix + name + "/");
        continue;
      }
      if (name === ".bin") continue;
      if (keepKernelPackage(prefix + name)) continue;
      dropped += 1;
      droppedBytes += treeSize(join(sourceModules, prefix + name)).bytes;
    }
  };
  walk(sourceModules, "");
  return { dropped, droppedBytes };
}

/**
 * Tìm .app của bản build gần nhất khi người gọi không chỉ định.
 * Nhận: không.
 * Trả: đường dẫn .app, hoặc undefined.
 */
function defaultApp(): string | undefined {
  const installed = "/Applications/Galaxy Blackhole (Preview).app";
  if (existsSync(join(installed, "Contents"))) return installed;
  const bundleDir = join(repoRoot, "apps", "desktop", "src-tauri", "target", "release", "bundle", "macos");
  if (!existsSync(bundleDir)) return undefined;
  const apps = readdirSync(bundleDir).filter((name) => name.endsWith(".app"));
  if (apps.length === 0) return undefined;
  return join(bundleDir, apps.sort().reverse()[0] as string);
}

/**
 * Đường dẫn binary shell đã build release.
 * Nhận: người gọi chỉ định, hoặc rỗng.
 * Trả: đường dẫn binary tuyệt đối.
 * @throws khi chưa `cargo build --release`.
 */
function resolveBinary(override: string): string {
  const releaseDir = join(repoRoot, "apps", "desktop", "src-tauri", "target", "release");
  // `cargo build` đặt tên theo package (gbh-desktop); `tauri build` đổi thành CFBundleExecutable
  // (blackhole-desktop). Cả hai đều là binary của vỏ này, nên nhận cả hai thay vì đoán một cái.
  const candidate = override !== "" ? override : firstExisting([join(releaseDir, "blackhole-desktop"), join(releaseDir, "gbh-desktop")]) ?? join(releaseDir, "blackhole-desktop");
  if (!existsSync(candidate)) {
    throw new Error("chưa có binary shell (" + candidate + ") — chạy: cd apps/desktop/src-tauri && cargo build --release");
  }
  return candidate;
}

/**
 * Ghi chú chuẩn của runtime nhúng.
 *
 * Node phát hành cho macOS là MỘT binary tĩnh: `npm`/`npx`/`corepack` chỉ tồn tại khi nhúng cả cây cài đặt
 * (`lib/node_modules/npm`, `bin/npx`, `lib/node_modules/corepack`). Bản này nhúng đúng một binary nên
 * KHÔNG có gì để bỏ; CLI `bh` cũng không chạy npm/npx lúc boot (chỉ nhắc trong chú thích mã) ⇒ quyết định:
 * giữ nguyên binary, không cần npm.
 */
const RUNTIME_NOTE = "binary đơn (không có npm/npx/corepack); CLI không dùng npm";

/**
 * Thư mục con của một bản Node CÀI ĐẶT (không phải binary đơn) mà harness không dùng.
 * Chỉ áp khi nguồn runtime là thư mục — nhánh phòng thủ cho máy cài Node bằng installer có kèm npm.
 */
const RUNTIME_DROP: readonly string[] = ["lib/node_modules/npm", "lib/node_modules/corepack", "bin/npm", "bin/npx"];

/**
 * Nhúng runtime Node + host đã rút gọn vào một .app rồi ký ad-hoc.
 * Nhận: options.app — đường dẫn .app; options.binary — binary shell; options.sign — có ký ad-hoc không;
 *       options.trim — tuỳ chọn lọc cây host.
 * Trả: EmbedReport để in ra bằng chứng.
 * @throws khi .app không tồn tại hoặc thiếu runtime bắt buộc.
 */
function embed(options: { app: string; binary: string; sign: boolean; trim: TrimOptions }): EmbedReport {
  const app = resolve(options.app);
  if (!app.endsWith(".app") || !existsSync(join(app, "Contents"))) {
    throw new Error("không phải gói .app có Contents: " + app);
  }
  const resources = join(app, "Contents", "Resources");
  const beforeMb = sizeMb(app);
  mkdirSync(resources, { recursive: true });

  // 1. Runtime: ĐÚNG MỘT node. Không bun — xem đầu tệp.
  const node = resolveNode();
  const runtimePath = join(resources, "runtime", "node");
  rmSync(runtimePath, { recursive: true, force: true });
  mkdirSync(dirname(runtimePath), { recursive: true });
  // Nguồn là binary (nvm/homebrew) hay cả cây cài đặt (installer .pkg) — xử lý cả hai, và chỉ ở nhánh cây
  // mới có npm/npx/corepack để bỏ (xem RUNTIME_NOTE).
  const nodeIsDirectory = lstatSync(node.path).isDirectory();
  if (nodeIsDirectory) {
    cpSync(node.path, runtimePath, {
      recursive: true,
      force: true,
      filter: (source) => {
        const rel = relative(node.path, source).split(sep).join("/");
        return !RUNTIME_DROP.some((drop) => rel === drop || rel.startsWith(drop + "/"));
      },
    });
  } else {
    cpSync(node.path, runtimePath, { force: true });
  }
  spawnSync("/bin/chmod", ["755", nodeIsDirectory ? join(runtimePath, "bin", "node") : runtimePath]);
  const runtime = {
    path: runtimePath,
    source: node.path,
    mb: sizeMb(runtimePath),
    version: node.version,
    note: nodeIsDirectory ? "cây cài đặt: bỏ lib/node_modules/npm · corepack · bin/npx" : RUNTIME_NOTE,
  };

  // 2. Shell binary: bản release mới nhất, đổi tên theo CFBundleExecutable.
  const binary = resolveBinary(options.binary);
  const target = join(app, "Contents", "MacOS", "blackhole-desktop");
  mkdirSync(dirname(target), { recursive: true });
  cpSync(binary, target, { force: true });
  spawnSync("/bin/chmod", ["755", target]);

  // 3. Host: cây chạy được ĐÃ RÚT GỌN, có dấu `.gbh-embedded` để mount dùng lib/ dựng sẵn.
  const hostRoot = join(resources, "host");
  const built = buildHostTree(hostRoot, options.trim);

  // Ký ad-hoc SAU khi chép: mọi thay đổi trong gói đều làm chữ ký cũ mất hiệu lực và macOS sẽ chặn.
  if (options.sign) {
    const sign = spawnSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", app], { encoding: "utf8" });
    if (sign.status !== 0) {
      throw new Error("ký ad-hoc thất bại: " + (sign.stderr ?? "").trim());
    }
  }

  const appStats = treeSize(app);
  return {
    app,
    beforeMb,
    afterMb: Math.round((appStats.bytes / 1024 / 1024) * 10) / 10,
    files: appStats.files,
    runtime,
    hostMb: built.hostMb,
    hostFiles: built.hostFiles,
    rows: built.rows,
    exclusions: built.exclusions,
    kernelDropped: built.kernelDropped,
    kernelDroppedMb: built.kernelDroppedMb,
    resources: readdirSync(resources),
  };
}

/**
 * In bảng dung lượng TRƯỚC/SAU theo nhóm.
 * Nhận: rows — bảng đo; hostMb — tổng cây host.
 * Trả: không (chỉ ghi ra stdout).
 */
function printRows(rows: readonly SizeRow[], hostMb: number): void {
  console.log("[embed] nhóm".padEnd(34) + "trước".padStart(10) + "sau".padStart(10) + "tệp".padStart(8));
  for (const row of rows) {
    console.log("[embed] " + row.group.padEnd(30) + (row.beforeMb + " MB").padStart(11) + (row.afterMb + " MB").padStart(10) + String(row.files).padStart(8));
  }
  console.log("[embed] " + "TỔNG host".padEnd(30) + "".padStart(11) + (hostMb + " MB").padStart(10));
}

/**
 * In bảng "đã loại" theo nhóm (đo trên cây NGUỒN bằng đúng bộ lọc của bản chép).
 * Nhận: rows — bảng loại trừ; trả: không (chỉ ghi ra stdout).
 */
function printExclusions(rows: readonly SkipRow[]): void {
  if (rows.length === 0) return;
  console.log("[embed] đã loại".padEnd(34) + "MB".padStart(10) + "tệp".padStart(8));
  let mb = 0;
  let files = 0;
  for (const row of rows) {
    mb += row.mb;
    files += row.files;
    console.log("[embed] " + row.label.padEnd(30) + (row.mb + " MB").padStart(11) + String(row.files).padStart(8));
  }
  console.log("[embed] " + "TỔNG đã loại".padEnd(30) + (Math.round(mb * 10) / 10 + " MB").padStart(11) + String(files).padStart(8));
}

/**
 * Điểm vào: nhúng vào .app (tham số --app, mặc định bản đã cài) rồi in báo cáo.
 * Nhận: argv — tham số dòng lệnh.
 * Trả: mã thoát (0 xong, 1 lỗi, 2 sai tham số).
 */
function main(argv: string[]): number {
  const args = parseArgs(argv);
  // --tree: chỉ dựng cây host để đo/boot thử, KHÔNG đụng .app (dùng cho vòng lặp kiểm chứng).
  if (args.tree !== "") {
    try {
      const built = buildHostTree(resolve(args.tree), args.trim);
      printRows(built.rows, built.hostMb);
      printExclusions(built.exclusions);
      console.log("[embed] kernel bỏ " + built.kernelDropped + " gói (" + built.kernelDroppedMb + " MB) · host " + built.hostMb + " MB · " + built.hostFiles + " tệp");
      return 0;
    } catch (error) {
      console.error("embed: " + (error as Error).message);
      return 1;
    }
  }
  const target = args.app === "" ? defaultApp() : args.app;
  if (target === undefined) {
    console.error("embed: không thấy .app — đặt --app '/Applications/…app' hoặc chạy tauri build trước");
    return 2;
  }
  try {
    const report = embed({ app: target, binary: args.binary, sign: args.sign, trim: args.trim });
    console.log("[embed] " + report.app);
    printRows(report.rows, report.hostMb);
    printExclusions(report.exclusions);
    console.log("[embed] dung luong: " + report.beforeMb + " MB → " + report.afterMb + " MB · " + report.files + " tệp");
    console.log("[embed] runtime node " + report.runtime.version + " (" + report.runtime.mb + " MB · " + report.runtime.note + ") ← " + report.runtime.source);
    console.log("[embed] host " + join(report.app, "Contents", "Resources", "host") + " (" + report.hostMb + " MB · " + report.hostFiles + " tệp · kernel bỏ " + report.kernelDropped + " gói " + report.kernelDroppedMb + " MB)");
    console.log("[embed] Contents/Resources: " + report.resources.join(" · "));
    return 0;
  } catch (error) {
    console.error("embed: " + (error as Error).message);
    return 1;
  }
}

process.exit(main(process.argv.slice(2)));
