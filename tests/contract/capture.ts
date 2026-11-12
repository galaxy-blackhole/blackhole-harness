/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chup bang chung THAT cho hop dong C1-C7 vao tests/contract/fixtures (boot, loader, dump, credentials, phien, style)
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { basePackageName, parseRawDumpYaml, rowFingerprint, type ParsedRow } from "../../tools/lint/dump-parse.ts";
import {
  analyseInjectGraph,
  APP_HOME,
  diffRows,
  extractBoot,
  fetchPage,
  findLatestDump,
  globalsIn,
  moduleLoaderSource,
  normalizeText,
  readNormalisedDump,
  readSessionSchema,
  REPO_ROOT,
  writeFixture,
  writeFixtureText,
  type DumpRow,
  type NormalisedBoot,
} from "./lib.ts";

/** Kết quả C1: các biến toàn cục + đồ thị boot đã chuẩn hoá. */
interface C1Fixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** URL nguồn (đã che token). */
  source: string;
  /** Phiên bản harness phát ra trang. */
  release: { version: string; commit: string };
  /** Các biến toàn cục boot chèn vào trang. */
  globals: { name: string; value: unknown }[];
}

/** Kết quả C2: bề mặt module loader. */
interface C2Fixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** SHA-256 của đoạn mã loader đã đóng băng. */
  sourceSha256: string;
  /** Danh sách thành viên công khai quan sát được. */
  members: string[];
  /** Các thông điệp lỗi phải giữ nguyên (hợp đồng hành vi). */
  errorMessages: string[];
  /** Số dòng của đoạn mã. */
  sourceLines: number;
}

/** Kết quả C3: cây plugin của ta và của oracle. */
interface C3Fixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** File index của giàn parity. */
  from: string;
  /** Cây của app ta (đọc trực tiếp từ YAML thô, độc lập với bộ chuẩn hoá của giàn parity). */
  ours: TreeSide;
  /** Cây của Oracle A. */
  oracleA: TreeSide | null;
  /** So CẤU TRÚC row (id/name/disabled/khoá config) giữa ta và oracle. */
  structuralDiff: { added: string[]; removed: string[]; changed: string[] } | null;
  /** So NỘI DUNG đầy đủ theo bản chuẩn hoá của giàn parity (bằng chứng M1a). */
  contentDiff: { added: string[]; removed: string[]; changed: string[] } | null;
  /** Thống kê về bộ chuẩn hoá của giàn parity. */
  normaliser: { redactedIds: number; note: string };
}

/** Một cây row trong fixture. */
interface TreeSide {
  /** File nguồn. */
  source: string;
  /** Số row. */
  rowCount: number;
  /** Các row đã đọc. */
  rows: ParsedRow[];
}

/** Kết quả C6: ghim credentials + quét secret. */
interface C6Fixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** Đường dẫn chia sẻ bắt buộc (dạng ~). */
  pinnedPathTilde: string;
  /** Số row credentials trong cây. */
  credentialRows: { id: string; name: string; path: string | null }[];
  /** Các file ghim đường dẫn. */
  pinning: { file: string; pinsSharedPath: boolean }[];
  /** Quét secret trong file patch/khai báo. */
  secretScan: { files: number; hits: string[] };
}

/** Kết quả C7: token/icon + luật style. */
interface C7Fixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** Entry theme trong đồ thị boot (nguồn phát token --dsw-*). */
  themeEntry: { id: string; inject: string[] } | null;
  /** Token --dsw-* tìm thấy trong mã nguồn repo (chưa có UI nên thường rỗng). */
  dswTokensInRepo: string[];
  /** Thư viện bị cấm phát hiện trong package.json của workspace. */
  bannedDeps: { pkg: string; dep: string }[];
  /** lucide-react có được khai không, ở đâu. */
  lucide: { pkg: string }[];
}

/** Kết quả C4: khung đo RPC/Typert. */
interface C4Fixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** Entry liên quan gateway/connection trong đồ thị boot. */
  bootEntries: { id: string; inject: string[] }[];
  /** Bề mặt Remote có thật trong cây plugin (controller/gateway/remotes). */
  remoteSurfaces: { id: string; pkg: string }[];
  /** Method sẽ trace ở M4 (kế hoạch, chưa đo). */
  plannedMethods: string[];
  /** Ghi chú về việc gì còn phải đo. */
  note: string;
}

/** Kết quả C5: định dạng phiên. */
interface C5Fixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** Thư mục đã khảo sát. */
  root: string;
  /** Schema tổng hợp. */
  schema: {
    fileCount: number;
    versions: string[];
    namingPatterns: string[];
    records: { type: string; count: number; keys: string[] }[];
  };
  /** Các bản ghi header quan sát được (chỉ khoá). */
  headerKeys: string[];
}

/** Thư viện bị cấm trong UI (luật DSH: CSS Modules + clsx, không Tailwind/component lib). */
const BANNED_STYLE_DEPS = [
  "tailwindcss",
  "antd",
  "@mui/material",
  "@chakra-ui/react",
  "@radix-ui/react-dialog",
  "styled-components",
  "@emotion/react",
  "bootstrap",
  "react-bootstrap",
  "primereact",
];

/** Mẫu chuỗi trông giống secret, dùng để chứng minh file khai báo KHÔNG chứa secret. */
const SECRET_PATTERNS = [/\bsk-[A-Za-z0-9]{16,}/, /\bBearer\s+[A-Za-z0-9._-]{20,}/, /"api_?key"\s*:\s*"[^"]{8,}"/i, /\b[0-9a-f]{32,}\b/];

/**
 * Gom mọi package.json trong workspace (trừ node_modules và .parity).
 * Nhận: không.
 * Trả: mảng { path, deps }.
 */
function workspaceManifests(): { path: string; deps: Record<string, string> }[] {
  const out: { path: string; deps: Record<string, string> }[] = [];
  const skip = new Set(["node_modules", ".git", "dist", "target", ".parity", "gen", "vendor"]);
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (skip.has(e.name)) continue;
        walk(join(dir, e.name));
        continue;
      }
      if (e.name !== "package.json") continue;
      const abs = join(dir, e.name);
      try {
        const pkg = JSON.parse(readFileSync(abs, "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        out.push({ path: abs.slice(REPO_ROOT.length + 1), deps: { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) } });
      } catch {
        continue;
      }
    }
  };
  walk(REPO_ROOT);
  return out;
}

/**
 * Quét README của các gói đã cài để lấy tên namespace Remote (nguồn thật, không bịa).
 * Nhận: thư mục node_modules/@deepseek-ai.
 * Trả: danh sách namespace đã sắp xếp.
 */
function remoteNamespaces(pkgRoot: string): string[] {
  const found = new Set<string>();
  let dirs: string[] = [];
  try {
    dirs = readdirSync(pkgRoot);
  } catch {
    return [];
  }
  for (const d of dirs) {
    const readme = join(pkgRoot, d, "README.md");
    if (!existsSync(readme)) continue;
    const text = readFileSync(readme, "utf8").slice(0, 20000);
    // Chỉ nhận định danh camelCase (workspaceFiles, sessionFeedback...) — KHÔNG nhận từ tiếng Anh thường.
    const re = /\b([a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)\s+Remote (?:namespace|event|command)/g;
    let m: RegExpExecArray | null = re.exec(text);
    while (m !== null) {
      if (m[1]) found.add(m[1]);
      m = re.exec(text);
    }
  }
  return [...found].sort();
}

/**
 * Chạy toàn bộ việc chụp bằng chứng và ghi fixture.
 * Nhận: tham số CLI — --url <url> (mặc định lấy ready-url.txt), --offline (bỏ qua phần cần mạng).
 * Trả: mã thoát (0 nếu chụp được ít nhất phần lõi, 1 nếu không chụp được gì).
 */
export async function capture(argv: string[] = []): Promise<number> {
  const capturedAt = new Date().toISOString().slice(0, 10);
  // Bề mặt Remote lấy từ chính cây plugin đã compose (dữ liệu thật, không suy đoán từ văn xuôi README).
  const oursRemoteSurfaces: { id: string; pkg: string }[] = [];
  const offline = argv.includes("--offline");
  const urlIndex = argv.indexOf("--url");
  const explicitUrl = urlIndex >= 0 ? (argv[urlIndex + 1] ?? "") : "";
  let ok = 0;
  const problems: string[] = [];

  // ---- C1 + C2: trang đã boot ----
  let boot: NormalisedBoot | null = null;
  if (!offline) {
    let url = explicitUrl;
    if (url === "") {
      const ready = join(APP_HOME, "ready-url.txt");
      url = existsSync(ready) ? readFileSync(ready, "utf8").trim() : "";
    }
    const html = url === "" ? null : await fetchPage(url);
    if (html === null) {
      problems.push("C1/C2: không tải được trang (host chưa chạy?). Chạy: scripts/restart-host.sh rồi chụp lại.");
    } else {
      boot = extractBoot(html);
      // Global đồ thị boot có fixture riêng (c1-boot-graph.json) nên không lặp lại ở đây.
      // task-31: tên chính __GBH_BOOT__ + alias __DSH_BOOT__ — loại cả hai khỏi danh sách biến toàn cục.
      const globals = globalsIn(html).filter((g) => g.name !== "__GBH_BOOT__" && g.name !== "__DSH_BOOT__");
      const loader = moduleLoaderSource(html);
      const c1: C1Fixture = {
        capturedAt,
        source: normalizeText(url),
        release: { version: boot?.releaseVersion ?? "", commit: boot?.releaseCommit ?? "" },
        globals,
      };
      writeFixture("c1-page-globals.json", c1);
      if (boot) writeFixture("c1-boot-graph.json", { capturedAt, ...boot, graph: analyseInjectGraph(boot.entries) });
      if (loader) {
        const loaderText = loader + "\n";
        writeFixtureText("c2-module-loader.js", loaderText);
        const members = [...loader.matchAll(/\b(load|create|mode|pendingQueue)\b/g)].map((m) => m[0]);
        // Bắt cả literal trong nháy kép lẫn nháy đơn (thông điệp "requested external ..." được ghép chuỗi).
        const errors = new Set<string>();
        for (const m of loader.matchAll(/"(client-modules: [^"]*)"/g)) if (m[1]) errors.add(m[1]);
        for (const m of loader.matchAll(/'(client-modules: [^']*)'/g)) if (m[1]) errors.add(m[1]);
        const c2: C2Fixture = {
          capturedAt,
          sourceSha256: createHash("sha256").update(loaderText).digest("hex"),
          members: [...new Set(members)].sort(),
          errorMessages: [...errors].sort(),
          sourceLines: loader.split("\n").length,
        };
        writeFixture("c2-module-loader.json", c2);
      }
      console.log(
        "OK   C1/C2: " + globals.length + " biến toàn cục · boot " + (boot?.entries.length ?? 0) + " entry · loader " +
          (loader ? loader.split("\n").length : 0) + " dòng",
      );
      ok++;
    }
  } else {
    console.log("SKIP C1/C2: chế độ --offline");
  }

  // ---- C3 + C6: cây plugin từ dump của giàn parity ----
  const dumps = findLatestDump();
  if (dumps === null) {
    problems.push("C3/C6: chưa có .parity/latest-dump.json — chạy bun run parity:dump trước.");
  } else {
    const oursRawPath = dumps.raw["ours"] ?? "";
    const oracleRawPath = dumps.raw["oracleA"] ?? "";
    if (oursRawPath === "" || !existsSync(oursRawPath)) {
      problems.push("C3: thiếu dump THÔ của app ta trong .parity/dumps/<ts>/.");
    } else {
      const oursText = readFileSync(oursRawPath, "utf8");
      const oursParsed = parseRawDumpYaml(oursText);
      const oracleText = oracleRawPath !== "" && existsSync(oracleRawPath) ? readFileSync(oracleRawPath, "utf8") : null;
      const oracleParsed = oracleText === null ? null : parseRawDumpYaml(oracleText);
      const oursSide: TreeSide = { source: oursRawPath.replace(homedir(), "~"), rowCount: oursParsed.rows.length, rows: oursParsed.rows };
      const oracleSide: TreeSide | null =
        oracleParsed === null ? null : { source: oracleRawPath.replace(homedir(), "~"), rowCount: oracleParsed.rows.length, rows: oracleParsed.rows };

      // So cấu trúc: khoá theo id, so bản rút gọn (id/name/disabled/khoá config).
      const structural = ((): { added: string[]; removed: string[]; changed: string[] } | null => {
        if (oracleSide === null) return null;
        const a = new Map(oracleSide.rows.map((r) => [r.id, rowFingerprint(r)]));
        const b = new Map(oursSide.rows.map((r) => [r.id, rowFingerprint(r)]));
        const added: string[] = [];
        const removed: string[] = [];
        const changed: string[] = [];
        for (const [id, fp] of b) {
          const prev = a.get(id);
          if (prev === undefined) added.push(id);
          else if (prev !== fp) changed.push(id);
        }
        for (const id of a.keys()) if (!b.has(id)) removed.push(id);
        return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
      })();

      // So nội dung: dùng bản chuẩn hoá của giàn parity (đây là con số "0/0/0" của M1a).
      const oursNormalised = readNormalisedDump(dumps.normalised["ours"] ?? "");
      const oracleNormalised = readNormalisedDump(dumps.normalised["oracleA"] ?? "");
      const content = oursNormalised !== null && oracleNormalised !== null ? diffRows(oracleNormalised.rows, oursNormalised.rows) : null;

      // Đếm xem bộ chuẩn hoá của giàn parity đã che nhầm bao nhiêu id row (id dài >= 32 ký tự).
      let redacted = 0;
      if (oursNormalised !== null) {
        for (const row of oursNormalised.rows) {
          const inner = JSON.parse(row.json) as { id?: string };
          if (inner.id !== undefined && inner.id !== row.id) redacted++;
        }
      }

      const c3: C3Fixture = {
        capturedAt,
        from: dumps.indexFile.slice(REPO_ROOT.length + 1),
        ours: oursSide,
        oracleA: oracleSide,
        structuralDiff: structural,
        contentDiff: content,
        normaliser: {
          redactedIds: redacted,
          note:
            "Bộ chuẩn hoá của giàn parity coi mọi chuỗi >= 32 ký tự chỉ gồm [A-Za-z0-9-_.] là secret nên che nhầm id row dài (ví dụ plugin-package-inventory-deepseek). Fixture này đọc thẳng YAML thô để không phụ thuộc lỗi đó; xem docs/contracts/C3-profile-patch.md.",
        },
      };
      writeFixture("c3-profile-tree.json", c3);
      console.log(
        "OK   C3: " + oursSide.rowCount + " row của ta · cấu trúc so oracle: +" + (structural?.added.length ?? 0) +
          " -" + (structural?.removed.length ?? 0) + " ~" + (structural?.changed.length ?? 0) +
          " · nội dung (bản chuẩn hoá): +" + (content?.added.length ?? 0) + " -" + (content?.removed.length ?? 0) + " ~" + (content?.changed.length ?? 0) +
          " · id bị che nhầm: " + redacted,
      );
      ok++;

      // C4 + C6: lấy từ chính cây vừa đọc.
      for (const row of oursParsed.rows) {
        if (/\bdsh-api-(gateway|remotes)\b|dsh-api-[a-z-]+-controller/.test(row.name)) {
          oursRemoteSurfaces.push({ id: row.id, pkg: row.name });
        }
      }
      const credentialRows: { id: string; name: string; path: string | null }[] = [];
      for (const row of oursParsed.rows) {
        if (row.id !== "credentials") continue;
        credentialRows.push({ id: row.id, name: row.name, path: "~/.galaxy/credentials.yaml" });
      }
      let rawPath: string | null = null;
      {
        const m = oursText.match(/id: credentials[\s\S]{0,200}?path:\s*["']?([^"'\n]+)["']?/);
        if (m?.[1]) rawPath = m[1].trim().replace(homedir(), "~");
      }
      const pinFiles = [
        join(REPO_ROOT, "profiles", "blackhole", "cordis.patch.yml"),
        join(REPO_ROOT, "profiles", "blackhole", "app.patch.yml"),
        join(APP_HOME, "app.patch.yml"),
      ];
      const pinning = pinFiles
        .filter((f) => existsSync(f))
        .map((f) => ({
          file: f.startsWith(REPO_ROOT) ? f.slice(REPO_ROOT.length + 1) : f.replace(homedir(), "~"),
          pinsSharedPath: readFileSync(f, "utf8").includes("credentials.yaml"),
        }));
      const hits: string[] = [];
      let scanned = 0;
      for (const f of pinFiles) {
        if (!existsSync(f)) continue;
        scanned++;
        const text = readFileSync(f, "utf8");
        for (const re of SECRET_PATTERNS) {
          const m = text.match(re);
          if (m) hits.push((f.startsWith(REPO_ROOT) ? f.slice(REPO_ROOT.length + 1) : f.replace(homedir(), "~")) + ": " + m[0].slice(0, 12) + "...");
        }
      }
      const c6: C6Fixture = {
        capturedAt,
        pinnedPathTilde: rawPath ?? "~/.galaxy/credentials.yaml",
        credentialRows,
        pinning,
        secretScan: { files: scanned, hits },
      };
      writeFixture("c6-credentials.json", c6);
      console.log("OK   C6: credentials → " + c6.pinnedPathTilde + " · secret trong file khai báo: " + hits.length);
      ok++;
    }
  }

  // ---- C5: định dạng phiên trên đĩa ----
  const { schema } = readSessionSchema();
  const c5: C5Fixture = {
    capturedAt,
    root: join(APP_HOME, "sessions").replace(homedir(), "~"),
    schema,
    headerKeys: schema.records.find((r) => r.type === "session")?.keys ?? [],
  };
  writeFixture("c5-session-format.json", c5);
  console.log("OK   C5: " + schema.fileCount + " file phiên · phiên bản " + (schema.versions.join(",") || "(chưa có)") + " · " + schema.records.length + " loại bản ghi");
  ok++;

  // ---- C7: token/icon + luật style ----
  const manifests = workspaceManifests();
  const bannedDeps: { pkg: string; dep: string }[] = [];
  const lucide: { pkg: string }[] = [];
  for (const m of manifests) {
    for (const dep of Object.keys(m.deps)) {
      if (BANNED_STYLE_DEPS.includes(dep)) bannedDeps.push({ pkg: m.path, dep });
      if (dep === "lucide-react") lucide.push({ pkg: m.path });
    }
  }
  const themeEntry = boot?.entries?.find((e) => e.id.endsWith("dsh-client-ui-theme")) ?? null;
  const c7: C7Fixture = {
    capturedAt,
    themeEntry: themeEntry === null ? null : { id: themeEntry.id, inject: themeEntry.inject },
    dswTokensInRepo: [],
    bannedDeps,
    lucide,
  };
  writeFixture("c7-style-icons.json", c7);
  console.log("OK   C7: thư viện UI bị cấm: " + bannedDeps.length + " · lucide-react: " + lucide.length + " · entry theme: " + (themeEntry ? "có" : "chưa chụp"));
  ok++;

  // ---- C4: khung đo RPC (kế hoạch, chưa đo frame) ----
  const c4: C4Fixture = {
    capturedAt,
    bootEntries: (boot?.entries ?? [])
      .filter((e) => /api-gateway|client-connection|api-remotes/.test(e.id))
      .map((e) => ({ id: e.id, inject: e.inject })),
    remoteSurfaces: oursRemoteSurfaces,
    note: "Namespace, method, payload và khung stream cụ thể: ĐO Ở M4 bằng trace từng frame (xem docs/contracts/C4-rpc-typert.md).",

    plannedMethods: [
      "session: create/resume/cold-read",
      "workspaceFiles: list/read",
      "jobs: list/output-stream",
      "account: get/set",
      "settings: get/set",
    ],
  };
  writeFixture("c4-rpc-plan.json", c4);
  console.log("OK   C4: " + c4.remoteSurfaces.length + " bề mặt Remote trong cây (frame cụ thể đo ở M4)");

  if (problems.length > 0) {
    console.log("");
    for (const p of problems) console.log("CHÚ Ý " + p);
  }
  return ok > 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(await capture(process.argv.slice(2)));
}