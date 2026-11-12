/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Sinh docs/PARITY-MATRIX.md tu snapshot cay plugin DSH: ten, vai tro, tang, moc, trang thai + kiem tra lech
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  createResult,
  exitCodeFor,
  isDirectRun,
  printResult,
  REPO_ROOT,
  toRel,
  type CheckResult,
} from "./shared.ts";
import { ROLES_VI } from "./parity-roles.ts";
import { basePackageName, parseRawDumpYaml } from "./dump-parse.ts";

/** Ký hiệu trạng thái dùng trong tài liệu (viết bằng escape để mã nguồn thuần ASCII). */
export const MARK = {
  todo: "\u2b1c",
  doing: "\u{1f504}",
  done: "\u2705",
  temp: "\u{1f7e1}",
  none: "\u2796",
} as const;

/** Tầng → người phụ trách (theo ARCHITECTURE.md §9.1). */
export const TIER_OWNER: Record<string, string> = {
  T0: "tm-kernel-core (M3)",
  T1: "tm-kernel-core (M3)",
  T2: "tm-host-api (M4)",
  T3: "tm-client-ui (M5)",
  T4: "tm-tools (M6)",
  T5: "chưa quyết (sau M7)",
};

/** Nhãn ngắn của từng test hợp đồng, dùng trong cột "test tương ứng". */
export const TEST_LABEL: Record<string, string> = {
  "tests/contract/c1-boot-injection.test.ts": "C1 boot injection",
  "tests/contract/c2-module-loader.test.ts": "C2 module loader",
  "tests/contract/c3-profile-patch.test.ts": "C3 profile/patch",
  "tests/contract/c4-rpc-typert.test.ts": "C4 RPC (khung)",
  "tests/contract/c5-session-format.test.ts": "C5 session (khung)",
  "tests/contract/c6-credentials.test.ts": "C6 credentials",
  "tests/contract/c7-tokens-icons.test.ts": "C7 token/icon",
};

/**
 * Gán test đang canh một row.
 * Nhận: row đã enrich.
 * Trả: chuỗi nhãn ngắn (ví dụ "C3 · C6"), hoặc "—" nếu chỉ có test ở mốc sau.
 */
export function testsForRow(row: DumpRow): string {
  const files: string[] = ["tests/contract/c3-profile-patch.test.ts"];
  if (row.id === "credentials") files.push("tests/contract/c6-credentials.test.ts");
  if (/^@deepseek-ai\/dsh-session/.test(row.base)) files.push("tests/contract/c5-session-format.test.ts");
  if (/^@deepseek-ai\/dsh-api-/.test(row.base)) files.push("tests/contract/c4-rpc-typert.test.ts");
  if (row.base === "@deepseek-ai/dsh-client-modules") files.push("tests/contract/c2-module-loader.test.ts");
  if (row.group === "client") files.push("tests/contract/c1-boot-injection.test.ts");
  if (row.base === "@deepseek-ai/dsh-client-ui-theme" || row.base === "@deepseek-ai/dsh-client-locale") {
    files.push("tests/contract/c7-tokens-icons.test.ts");
  }
  return files.map((f) => (TEST_LABEL[f] ?? f).replace(/^(C\d) .*/, "$1")).join(" · ");
}

/**
 * Suy ra trạng thái thi công của một row từ chính tên package.
 * Nhận: row đã enrich.
 * Trả: nhãn trạng thái ngắn.
 */
export function statusForRow(row: DumpRow): string {
  if (row.name.startsWith("cordis:")) return MARK.none + " row nhóm";
  if (row.name.startsWith("@galaxy-blackhole/")) return MARK.done + " của ta";
  if (row.name.startsWith("@galaxy-stack/")) return MARK.temp + " tạm dùng (M5 thay)";
  return MARK.todo + " dùng nguyên bản";
}

/**
 * Suy ra người phụ trách một row.
 * Nhận: row đã enrich + tầng.
 * Trả: tên vai trò trong team (theo §9.1).
 */
export function ownerForRow(row: DumpRow, tier: string): string {
  if (row.name.startsWith("cordis:")) return "—";
  if (row.name.startsWith("@galaxy-")) return "Lead";
  return TIER_OWNER[tier] ?? "chưa rõ";
}

/** Đường dẫn snapshot dữ liệu cây plugin (đầu vào duy nhất của bộ sinh). */
export const DATA_PATH = join(REPO_ROOT, "docs", "contracts", "data", "dsh-packages.json");

/** Đường dẫn tài liệu ma trận parity được sinh ra. */
export const MATRIX_PATH = join(REPO_ROOT, "docs", "PARITY-MATRIX.md");

/** Một row plugin trong cây đã compose. */
export interface DumpRow {
  /** Số dòng trong dump gốc (1-based) — dấu vết để đối chiếu lại. */
  line: number;
  /** Vị trí row trong cây (0-based). */
  index: number;
  /** id row trong cây cordis. */
  id: string;
  /** Tên package đầy đủ, kèm subpath nếu có. */
  name: string;
  /** Tên package gốc (bỏ subpath). */
  base: string;
  /** Subpath trong package, rỗng nếu là gói gốc. */
  sub: string;
  /** Row bị patch tắt (disabled) hay không. */
  disabled: boolean;
  /** Các khoá cấp 1 trong config của row. */
  configKeys: string[];
  /** Nhóm package ở upstream (thư mục packages/<nhóm>/). */
  group: string;
  /** Mô tả gốc tiếng Anh của package (chính thức từ DSH). */
  desc: string;
  /** Khoá dịch vụ cordis mà gói này cung cấp/tiêu thụ (ctx.*), rút từ README của gói. */
  ctxKeys: string[];
  /** Phụ thuộc trực tiếp (đã rút gọn tên) của gói trong runtime đã cài. */
  deps: string[];
}

/** Dữ liệu đầu vào của bộ sinh ma trận. */
export interface MatrixData {
  /** Phiên bản schema dữ liệu. */
  schema: number;
  /** Ngày sinh dữ liệu. */
  generatedAt: string;
  /** Nguồn gốc để truy vết. */
  sources: { dump: string; dumpLines: number; upstream: string; pluginsDoc: string };
  /** Số liệu đếm được, ghi rõ quy tắc đếm. */
  counts: {
    rows: number;
    distinctNames: number;
    basePackages: number;
    allIdLines: number;
    nestedIdLines: number;
    disabledRows: number;
  };
  /** Các row plugin theo đúng thứ tự trong cây. */
  rows: DumpRow[];
  /** Tên package xuất hiện trong bảng DSH-PLUGINS.md (để biết còn gì ngoài cây). */
  knownPlugins: string[];
}

/** Thang tầng và mốc thi công, theo ARCHITECTURE.md §5.5 và thứ tự M4 → M5 → M6 → M3. */
export const TIER_INFO: Record<string, { label: string; order: string; milestone: string; note: string }> = {
  T0: { label: "Kernel / hạ tầng Loader-patch-HMR", order: "4 (cuối)", milestone: "M3", note: "Dựng trên cordis (MIT) rồi viết lại ruột ở K2" },
  T1: { label: "Core spine: session, agent, tools, prompt, kho dữ liệu", order: "5 (cuối)", milestone: "M3", note: "Viết cuối cùng vì mọi tầng khác chạy trên nó" },
  T2: { label: "Host/API: webserver, gateway, controller, Remote", order: "1", milestone: "M4", note: "Làm ĐẦU TIÊN của bước 2" },
  T3: { label: "Client shell + plugin UI", order: "2", milestone: "M5", note: "Mỗi plugin UI phải có ảnh A/B khi chuyển" },
  T4: { label: "Tool/LLM/sandbox/subagent/goal/schedule/workflow/mcp", order: "3", milestone: "M6", note: "unit + e2e cho từng plugin" },
  T5: { label: "experimental", order: "6", milestone: "chưa quyết (sau M7)", note: "Có thể bỏ qua ở bước 2" },
};

/** Tầng mặc định theo nhóm upstream; nhóm không có trong bảng này mặc định T4. */
export const GROUP_TIER: Record<string, string> = {
  boot: "T0",
  typert: "T0",
  core: "T1",
  session: "T1",
  "session-query": "T1",
  storage: "T1",
  attachment: "T1",
  spill: "T1",
  settings: "T1",
  context: "T1",
  api: "T2",
  host: "T2",
  bundle: "T2",
  client: "T3",
  experimental: "T5",
};

/** Ghi đè tầng cho vài package nằm ngoài mọi nhóm (đều kèm lý do trong tài liệu). */
export const NAME_TIER: Record<string, string> = {
  "@deepseek-ai/cordis-plugin-timer": "T0",
  "@deepseek-ai/dsh-skill-badge": "T5",
  "@deepseek-ai/dsh-tool-ralph": "T5",
  // Nằm trong thư mục upstream experimental nhưng là seam phiên/tiêu đề đang chạy thật → xếp theo tầng thật.
  "@deepseek-ai/dsh-session-title-all-prompts-llm": "T1",
  "@deepseek-ai/dsh-working-directory": "T1",
  "@deepseek-ai/dsh-tool-working-directory": "T1",
  // Row nhóm của Loader cordis (không phải gói): thuộc hạ tầng kernel.
  "cordis:group": "T0",
  // Gói thương hiệu của hệ Galaxy dùng TẠM (shim đổi tên dsh->gbh).
  // ⚠️ 18/10/2026: shim đã NHẢ ROW `ui-brand-official`; row đó nay do bản viết lại trung thành của ta
  //   nắm (`@galaxy-blackhole/gbh-client-ui-brand-official`). Shim KHÔNG còn entry trong manifest
  //   (đo: 0 lần trong `__GBH_BOOT__ (alias __DSH_BOOT__)`) nhưng VẪN được giữ lại theo quyết định của chủ dự án
  //   (còn `app-icons`/`favicon`/`journey-*`) ⇒ giữ ánh xạ này cho tới khi shim được xoá hẳn.
  "@galaxy-stack/gbh-brand": "T3",
  "@galaxy-blackhole/gbh-client-ui-brand-official": "T3",
};

/**
 * Tính tầng thi công của một package.
 * Nhận: tên package gốc + nhóm upstream.
 * Trả: mã tầng "T0".."T5".
 */
export function tierOf(base: string, group: string): string {
  return NAME_TIER[base] ?? GROUP_TIER[group] ?? "T4";
}

/**
 * Quy đổi tên package DSH sang tên package của ta.
 * Nhận: tên DSH kèm subpath (ví dụ "@deepseek-ai/dsh-tool-bash").
 * Trả: tên gbh tương ứng (ví dụ "@galaxy-blackhole/gbh-tool-bash").
 */
export function gbhName(dshName: string): string {
  const parts = dshName.split("/");
  const pkg = parts[1] ?? dshName;
  const rest = parts.slice(2).join("/");
  // Bỏ tiền tố dsh- của DSH, và gbh- nếu gói đã thuộc hệ Galaxy (tránh gbh-gbh-brand).
  const bare = pkg.replace(/^(dsh-|gbh-)/, "");
  const mapped = "@galaxy-blackhole/gbh-" + bare;
  return rest === "" ? mapped : mapped + "/" + rest;
}

/**
 * Tách tên package thành gói gốc và subpath.
 * Nhận: tên đầy đủ (ví dụ "@deepseek-ai/dsh-web-app/startup").
 * Trả: { base, sub }.
 */
function splitName(name: string): { base: string; sub: string } {
  const parts = name.split("/");
  if (parts.length <= 2) return { base: name, sub: "" };
  return { base: parts.slice(0, 2).join("/"), sub: parts.slice(2).join("/") };
}

/**
 * Đọc cây plugin từ dump YAML của harness.
 * Nhận: nội dung file dump.
 * Trả: danh sách row (chỉ row thụt lề 0) + số liệu thô để ghi rõ quy tắc đếm.
 */
export function parseDump(text: string): {
  rows: DumpRow[];
  allIdLines: number;
  nestedIdLines: number;
  distinctNames: number;
  basePackages: number;
  dumpLines: number;
} {
  const parsed = parseRawDumpYaml(text);
  const rows: DumpRow[] = parsed.rows.map((r) => {
    const parts = splitName(r.name);
    return {
      line: r.line,
      index: r.index,
      id: r.id,
      name: r.name,
      base: parts.base,
      sub: parts.sub,
      disabled: r.disabled,
      configKeys: r.configKeys,
      group: "",
      desc: "",
      ctxKeys: [],
      deps: [],
    };
  });
  return {
    rows,
    allIdLines: parsed.allIdLines,
    nestedIdLines: parsed.nestedIdLines,
    distinctNames: new Set(rows.map((r) => r.name)).size,
    basePackages: new Set(rows.map((r) => r.base)).size,
    dumpLines: parsed.totalLines,
  };
}

/** Metadata đọc được từ cây upstream: nhóm (thư mục) + mô tả chính thức. */
interface UpstreamMeta {
  /** Nhóm package, ví dụ "client". */
  group: string;
  /** Mô tả chính thức lấy từ frontmatter README. */
  desc: string;
}

/**
 * Duyệt cây upstream để lấy nhóm + mô tả của từng package.
 * Nhận: thư mục gốc chứa các nhóm package.
 * Trả: map tên package -> metadata (rỗng nếu không đọc được).
 */
export function loadUpstream(root: string): Map<string, UpstreamMeta> {
  const out = new Map<string, UpstreamMeta>();
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules") continue;
        walk(abs);
        continue;
      }
      if (e.name !== "package.json") continue;
      let name = "";
      try {
        const pkg = JSON.parse(readFileSync(abs, "utf8")) as { name?: string };
        name = pkg.name ?? "";
      } catch {
        continue;
      }
      if (name === "") continue;
      const rel = abs.slice(root.length + 1);
      const group = rel.split("/")[0] ?? "";
      let desc = "";
      const readme = join(dirname(abs), "README.md");
      if (existsSync(readme)) {
        const head = readFileSync(readme, "utf8").slice(0, 4000);
        const block = head.match(/^---\n([\s\S]*?)\n---/);
        const d = block ? (block[1] ?? "").match(/^description:\s*"?([\s\S]*?)"?\s*$/m) : null;
        desc = d ? (d[1] ?? "").replace(/^"|"$/g, "").trim() : "";
      }
      out.set(name, { group, desc });
    }
  };
  walk(root);
  return out;
}

/** Metadata đọc được từ runtime đã cài. */
interface RuntimeMeta {
  /** Khoá dịch vụ cordis nhắc trong README (dạng "ctx.xxx"). */
  ctxKeys: string[];
  /** Phụ thuộc trực tiếp đã rút gọn (ví dụ "dsh-session", "cordis"). */
  deps: string[];
}

/**
 * Duyệt runtime đã cài để lấy khoá ctx.* và phụ thuộc trực tiếp của từng gói.
 * Nhận: thư mục node_modules (chứa các scope @...).
 * Trả: map tên package -> RuntimeMeta.
 */
export function loadRuntimeMeta(root: string): Map<string, RuntimeMeta> {
  const out = new Map<string, RuntimeMeta>();
  let scopes: string[] = [];
  try {
    scopes = readdirSync(root);
  } catch {
    return out;
  }
  for (const scope of scopes) {
    if (!scope.startsWith("@")) continue;
    let dirs: string[] = [];
    try {
      dirs = readdirSync(join(root, scope));
    } catch {
      continue;
    }
    for (const dir of dirs) {
      const pkgPath = join(root, scope, dir, "package.json");
      if (!existsSync(pkgPath)) continue;
      let name = scope + "/" + dir;
      const deps = new Set<string>();
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
          name?: string;
          dependencies?: Record<string, string>;
          peerDependencies?: Record<string, string>;
        };
        if (typeof pkg.name === "string" && pkg.name !== "") name = pkg.name;
        for (const dep of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})]) {
          const bare = dep.startsWith("@deepseek-ai/") ? dep.slice("@deepseek-ai/".length) : (dep.split("/")[1] ?? dep);
          deps.add(bare);
        }
      } catch {
        continue;
      }
      const ctxKeys = new Set<string>();
      const readme = join(root, scope, dir, "README.md");
      if (existsSync(readme)) {
        const text = readFileSync(readme, "utf8").slice(0, 30000);
        for (const m of text.matchAll(/ctx\.([A-Za-z][A-Za-z0-9_]*)/g)) if (m[1]) ctxKeys.add("ctx." + m[1]);
      }
      out.set(name, {
        ctxKeys: [...ctxKeys].sort().slice(0, 8),
        deps: [...deps]
          .filter((d) => d.startsWith("dsh-") || d.startsWith("cordis"))
          .sort()
          .slice(0, 8),
      });
    }
  }
  return out;
}

/**
 * Đọc danh sách package trong bảng DSH-PLUGINS.md (nguồn tham chiếu của repo).
 * Nhận: đường dẫn file markdown.
 * Trả: mảng tên package đã gắn scope @deepseek-ai/.
 */
export function readPluginsDoc(path: string): string[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*\d+\s*\|\s*\x60(dsh-[a-z0-9-]+)\x60\s*\|/);
    if (m && m[1]) out.push("@deepseek-ai/" + m[1]);
  }
  return [...new Set(out)];
}

/**
 * Tạo lại snapshot dữ liệu từ dump (và tuỳ chọn từ cây upstream).
 * Nhận: đường dẫn dump, thư mục upstream (có thể rỗng), dữ liệu cũ để giữ mô tả khi thiếu nguồn.
 * Trả: dữ liệu mới sẵn sàng ghi xuống DATA_PATH.
 */
export function refreshData(dumpPath: string, upstreamRoot: string, previous: MatrixData | null): MatrixData {
  const raw = readFileSync(dumpPath, "utf8");
  const parsed = parseDump(raw);
  const upstream = upstreamRoot === "" ? new Map<string, UpstreamMeta>() : loadUpstream(upstreamRoot);
  const prevByKey = new Map<string, DumpRow>();
  for (const r of previous?.rows ?? []) prevByKey.set(r.id + "|" + r.name, r);
  // Bảng plugin tiếng Việt nằm ở repo anh em: galaxy-blackhole/docs-blackhole/DSH-PLUGINS.md
  const pluginsDocPath = join(REPO_ROOT, "..", "docs-blackhole", "DSH-PLUGINS.md");
  const known = readPluginsDoc(pluginsDocPath);
  const runtime = loadRuntimeMeta(join(REPO_ROOT, "apps", "host", "node_modules"));
  const rows: DumpRow[] = parsed.rows.map((r) => {
    const meta = upstream.get(r.base);
    const prev = prevByKey.get(r.id + "|" + r.name);
    const rt = runtime.get(r.base);
    return {
      ...r,
      group: meta?.group ?? prev?.group ?? "",
      desc: meta?.desc ?? prev?.desc ?? "",
      ctxKeys: rt?.ctxKeys ?? prev?.ctxKeys ?? [],
      deps: rt?.deps ?? prev?.deps ?? [],
    };
  });
  const pretty = (p: string): string => (p.startsWith(homedir()) ? "~" + p.slice(homedir().length) : p);
  return {
    schema: 2,
    generatedAt: new Date().toISOString().slice(0, 10),
    sources: {
      dump: pretty(dumpPath.startsWith(REPO_ROOT) ? toRel(dumpPath) : dumpPath),
      dumpLines: parsed.dumpLines,
      upstream: upstreamRoot === "" ? "(không đọc lại; giữ mô tả của lần trước)" : pretty(upstreamRoot),
      pluginsDoc: "galaxy-blackhole/docs-blackhole/DSH-PLUGINS.md",
    },
    counts: {
      rows: parsed.rows.length,
      distinctNames: parsed.distinctNames,
      basePackages: parsed.basePackages,
      allIdLines: parsed.allIdLines,
      nestedIdLines: parsed.nestedIdLines,
      disabledRows: parsed.rows.filter((r) => r.disabled).length,
    },
    rows,
    knownPlugins: known.length > 0 ? known : (previous?.knownPlugins ?? []),
  };
}

/**
 * Đọc snapshot dữ liệu đã commit.
 * Nhận: không.
 * Trả: dữ liệu ma trận, hoặc null nếu chưa có (phải chạy --refresh trước).
 */
export function loadData(): MatrixData | null {
  if (!existsSync(DATA_PATH)) return null;
  try {
    return JSON.parse(readFileSync(DATA_PATH, "utf8")) as MatrixData;
  } catch {
    return null;
  }
}

/**
 * Sinh nội dung markdown của ma trận parity.
 * Nhận: dữ liệu ma trận.
 * Trả: chuỗi markdown đầy đủ của docs/PARITY-MATRIX.md (chưa ghi ra đĩa).
 */
export function buildMatrix(data: MatrixData): string {
  const c = data.counts;
  const rowList = data.rows;
  const tierCounts = new Map<string, number>();
  const tierDisabled = new Map<string, number>();
  for (const r of rowList) {
    const t = tierOf(r.base, r.group);
    tierCounts.set(t, (tierCounts.get(t) ?? 0) + 1);
    if (r.disabled) tierDisabled.set(t, (tierDisabled.get(t) ?? 0) + 1);
  }
  const out: string[] = [];
  const p = (s: string): void => {
    out.push(s);
  };
  const code = "\x60";
  p("<!--");
  p(" author Bùi Trọng Hiếu");
  p(" email kevinbui210191@gmail.com");
  p(" create date 15/10/2026");
  p(" modify date " + data.generatedAt.split("-").reverse().join("/"));
  p(" desc Ma tran parity DSH -> gbh: tung row trong cay plugin web kem vai tro, tang, moc va trang thai");
  p("-->");
  p("");
  p("# Ma trận parity DSH → Galaxy Blackhole");
  p("");
  p("> **Sinh tự động — KHÔNG sửa tay.** Sinh lại: " + code + "bun run tools/lint/parity-matrix.ts" + code + "; kiểm tra lệch: thêm " + code + "--check" + code + " (đã nằm trong " + code + "bun run gate" + code + ").");
  p("> Nguồn dữ liệu đóng băng ở " + code + "docs/contracts/data/dsh-packages.json" + code + " (kèm cả mô tả gốc tiếng Anh của từng package).");
  p("");
  p("## 1. Nguồn và quy tắc đếm");
  p("");
  p("| Nguồn | Chi tiết |");
  p("|---|---|");
  p("| Cây plugin đã compose của APP (profile blackhole @ 5439, harness 0.2.1-alpha.4) | " + code + data.sources.dump + code + " (" + data.sources.dumpLines + " dòng) |");
  p("| Cây của Oracle A (4001) để đối chiếu | cùng thư mục " + code + ".parity/dumps/<ts>/oracleA.yml" + code + " — tại lần chụp: 0 thêm, 0 thiếu, 0 đổi |");
  p("| Bằng chứng hợp đồng | " + code + "tests/contract/*.test.ts" + code + " + fixture " + code + "tests/contract/fixtures/" + code + " |");
  p("| Metadata package DSH | " + data.sources.upstream + " — README frontmatter description, đối chiếu " + code + data.sources.pluginsDoc + code + " |");
  p("| Snapshot dùng để sinh tài liệu | " + code + "docs/contracts/data/dsh-packages.json" + code + " (schema " + data.schema + ", sinh ngày " + data.generatedAt + ", " + c.rows + " row) |");
  p("");
  p("**Quy tắc đếm — đọc kỹ để không hiểu lệch nhau:**");
  p("");
  p("- **row (dòng plugin)** = số dòng " + code + "- id:" + code + " ở **thụt lề 0** trong dump → **" + c.rows + "** row. Đây là đơn vị thi công: mỗi row là một plugin trong cây.");
  p("- **tên package** = số giá trị " + code + "name:" + code + " **duy nhất** trong các row đó → **" + c.distinctNames + "** tên.");
  p("- **package gốc** = sau khi gộp các row cùng gói nhưng khác subpath (" + code + "/tools" + code + ", " + code + "/host" + code + ", " + code + "/startup" + code + ", " + code + "/list-agents" + code + ", " + code + "/model-selection-settings" + code + ") → **" + c.basePackages + "** gói.");
  p("- Con số **" + c.allIdLines + "** là tổng số dòng " + code + "- id:" + code + " **kể cả entry lồng trong " + code + "config:" + code + "** (" + c.nestedIdLines + " entry lồng ở thụt lề 6/10). Con số đó KHÔNG phải số row plugin — dùng nó để đếm tiến độ sẽ sai.");
  p("- Vì vậy *“" + c.rows + " row / " + c.basePackages + " gói”* và *“" + c.allIdLines + " dòng " + code + "- id:" + code + "”* là hai cách đếm khác nhau của **cùng một dump**, không mâu thuẫn.");
  p("");
  p("## 2. Thang tầng & mốc thi công");
  p("");
  p("| Tầng | Nội dung | Thứ tự viết lại | Mốc | Ghi chú |");
  p("|---|---|---|---|---|");
  for (const t of ["T0", "T1", "T2", "T3", "T4", "T5"]) {
    const info = TIER_INFO[t];
    if (!info) continue;
    p("| **" + t + "** | " + info.label + " | " + info.order + " | " + info.milestone + " | " + info.note + " |");
  }
  p("");
  p("Cột:");
  p("");
  p("- **ctx key**: khoá dịch vụ cordis mà gói cung cấp/tiêu thụ, rút từ README của gói trong runtime đã cài (tối đa 3 mục, phần dư ghi +n).");
  p("- **Phụ thuộc**: phụ thuộc trực tiếp giữa các gói DSH/cordis (đọc từ package.json của runtime đã cài).");
  p("- **Test đang canh**: hợp đồng nào đang canh row này. " + Object.entries(TEST_LABEL).map(([f, l]) => code + l + code + " = " + code + f + code).join(" · ") + ".");
  p("- **Trạng thái**: " + code + MARK.todo + code + " dùng nguyên bản của DSH · " + code + MARK.temp + code + " gói tạm của hệ Galaxy (sẽ thay) · " + code + MARK.done + code + " do ta viết · " + code + MARK.none + code + " row nhóm của Loader. Đếm theo **row**; row bị patch tắt được ghi thêm.");
  p("- **Người phụ trách**: theo bảng vai trò ở ARCHITECTURE.md §9.1 (T0/T1 → tm-kernel-core ở M3, T2 → tm-host-api ở M4, T3 → tm-client-ui ở M5, T4 → tm-tools ở M6).");
  p("");
  p("## 3. Ma trận (" + c.rows + " row)");
  p("");
  p("| # | id row (cây) | Plugin DSH | Tương ứng gbh | Tầng | Vai trò | ctx key | Phụ thuộc | Test đang canh | Mốc | Trạng thái | Người phụ trách |");
  p("|---|---|---|---|---|---|---|---|---|---|---|---|");
  let i = 0;
  for (const r of rowList) {
    i++;
    const t = tierOf(r.base, r.group);
    const info = TIER_INFO[t];
    const role = ROLES_VI[r.base] ?? (r.desc !== "" ? r.desc : "chưa rõ — cần đọc package");
    const shortList = (items: string[]): string => {
      if (items.length === 0) return "—";
      const head = items.slice(0, 3).join(", ");
      return items.length > 3 ? head + " +" + (items.length - 3) : head;
    };
    const status = statusForRow(r) + (r.disabled ? " · row bị patch tắt" : "");
    p(
      "| " + i +
        " | " + code + r.id + code +
        " | " + code + r.name + code +
        " | " + code + gbhName(r.name) + code +
        " | " + t +
        " | " + role +
        " | " + shortList(r.ctxKeys) +
        " | " + shortList(r.deps) +
        " | " + testsForRow(r) +
        " | " + (info?.milestone ?? "?") +
        " | " + status +
        " | " + ownerForRow(r, t) + " |",
    );
  }
  p("");
  p("## 4. Tổng hợp theo tầng");
  p("");
  p("| Tầng | Số row | Trong đó bị patch tắt | Mốc |");
  p("|---|---|---|---|");
  for (const t of ["T0", "T1", "T2", "T3", "T4", "T5"]) {
    if (!tierCounts.has(t)) continue;
    p("| " + t + " | " + (tierCounts.get(t) ?? 0) + " | " + (tierDisabled.get(t) ?? 0) + " | " + (TIER_INFO[t]?.milestone ?? "?") + " |");
  }
  p("| **Tổng** | " + c.rows + " | " + c.disabledRows + " | — |");
  p("");
  const inTree = new Set(rowList.map((r) => r.base));
  const extra = data.knownPlugins.filter((n) => !inTree.has(n));
  p("## 5. Package DSH có trong danh mục nhưng KHÔNG nằm trong cây web (" + extra.length + ")");
  p("");
  p("Những gói này chưa được profile web nạp — phần lớn thuộc bề mặt desktop/ACP/LSP/computer-use. Sẽ lập ma trận riêng khi làm app desktop (M1 và M7).");
  p("");
  p(extra.map((n) => code + n + code).join(" · "));
  p("");
  p("## 6. Quy tắc ánh xạ tên");
  p("");
  p("- " + code + "@deepseek-ai/dsh-<vai trò>" + code + " → " + code + "@galaxy-blackhole/gbh-<vai trò>" + code + " (giữ nguyên subpath nếu row trỏ vào subpath).");
  p("- Gói không thuộc scope " + code + "dsh-" + code + " (ví dụ " + code + "@deepseek-ai/cordis-plugin-timer" + code + " của cordis MIT) → " + code + "@galaxy-blackhole/gbh-cordis-plugin-timer" + code + "; nếu giữ kernel K1 thì vẫn dùng được bản cordis gốc, không cần đổi tên.");
  p("- Icon/thương hiệu giữ nguyên SVG gốc của DSH (G1); chỉ UI mới của Blackhole mới dùng " + code + "lucide-react" + code + ".");
  p("");
  return out.join("\n");
}

/**
 * Sinh ma trận + ghi ra đĩa, hoặc kiểm tra tài liệu có khớp dữ liệu không.
 * Nhận: checkOnly = true thì chỉ kiểm tra, không ghi.
 * Trả: CheckResult (vi phạm = tài liệu lệch dữ liệu / thiếu dữ liệu).
 */
export function runParityMatrixCheck(checkOnly: boolean): CheckResult {
  const t0 = Date.now();
  const res = createResult("parity-matrix");
  const data = loadData();
  if (!data) {
    res.notes.push("Chưa có " + toRel(DATA_PATH) + " — chạy: bun run tools/lint/parity-matrix.ts --refresh --dump <file dump>");
    res.violations.push({ file: toRel(MATRIX_PATH), line: 0, message: "thiếu snapshot dữ liệu nên không sinh được ma trận" });
    res.ms = Date.now() - t0;
    return res;
  }
  const text = buildMatrix(data);
  res.checked = 1;
  if (checkOnly) {
    if (!existsSync(MATRIX_PATH)) {
      res.violations.push({ file: toRel(MATRIX_PATH), line: 0, message: "chưa có tài liệu — chạy: bun run tools/lint/parity-matrix.ts" });
    } else if (readFileSync(MATRIX_PATH, "utf8") !== text) {
      res.violations.push({
        file: toRel(MATRIX_PATH),
        line: 0,
        message: "tài liệu lệch với snapshot dữ liệu — sinh lại: bun run tools/lint/parity-matrix.ts",
      });
    }
  } else {
    mkdirSync(dirname(MATRIX_PATH), { recursive: true });
    writeFileSync(MATRIX_PATH, text);
    res.notes.push("Đã ghi " + toRel(MATRIX_PATH) + " (" + data.counts.rows + " row, " + text.split("\n").length + " dòng)");
  }
  const missingRoles = data.rows.filter((r) => !ROLES_VI[r.base]);
  if (missingRoles.length > 0) {
    res.warnings.push({
      file: toRel(MATRIX_PATH),
      line: 0,
      message: missingRoles.length + " package chưa có vai trò tiếng Việt trong tools/lint/parity-roles.ts (đang dùng mô tả gốc tiếng Anh)",
    });
  }
  res.ms = Date.now() - t0;
  return res;
}

/**
 * Chạy chế độ dòng lệnh: sinh tài liệu, hoặc làm mới dữ liệu từ dump.
 * Nhận: mảng tham số CLI (đã bỏ phần tên file).
 * Trả: mã thoát (0 = xanh).
 */
export function runCli(argv: string[]): number {
  const strict = argv.includes("--strict");
  const check = argv.includes("--check");
  const refresh = argv.includes("--refresh");
  const dumpIndex = argv.indexOf("--dump");
  const upstreamIndex = argv.indexOf("--upstream");
  if (refresh) {
    const dumpPath = dumpIndex >= 0 ? (argv[dumpIndex + 1] ?? "") : "";
    if (dumpPath === "" || !existsSync(dumpPath)) {
      console.error("FAIL thiếu --dump <đường dẫn dump-config> (ví dụ /tmp/bh-ref/dsh-profile-web.dump.yml)");
      return 1;
    }
    const upstream = upstreamIndex >= 0 ? (argv[upstreamIndex + 1] ?? "") : "";
    const data = refreshData(dumpPath, existsSync(upstream) ? upstream : "", loadData());
    mkdirSync(dirname(DATA_PATH), { recursive: true });
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 1) + "\n");
    console.log(
      "OK   refresh " + toRel(DATA_PATH) + " — " + data.counts.rows + " row, " +
        data.counts.basePackages + " gói, " + data.counts.disabledRows + " row bị patch tắt",
    );
  }
  const res = runParityMatrixCheck(check);
  printResult(res, { strict });
  return exitCodeFor(res, { strict });
}

if (isDirectRun(import.meta.url)) {
  process.exit(runCli(process.argv.slice(2)));
}
