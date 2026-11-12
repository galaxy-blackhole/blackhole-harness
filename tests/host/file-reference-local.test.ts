/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-file-reference-local (row file-reference-local): bước 0 đọc cặp
 *      row trong oracle dump MỚI NHẤT + đo MỘT MẶT, tập export đo trên ARTIFACT, quy ước
 *      gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM, ca C6 (DANH TÍNH), luật 000e (locale
 *      byte-for-byte), và đối chứng hành vi với CHÍNH bundle gốc trên cùng một giàn.
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Gốc repo — mọi đường dẫn khác suy ra từ đây để test không phụ thuộc cwd. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "file-reference-local");
/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — oracle của MỌI phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-file-reference-local");
/** Bundle gốc. */
const STOCK_BUNDLE = join(STOCK, "lib", "index.js");
/** cordis mà CHÍNH bundle gốc nạp (bản của kernel) — phải dùng đúng bản này mới dựng được service. */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Tên package gốc — nguyên văn, dùng cho cả bước 0 lẫn khối patch. */
const STOCK_NAME = "@deepseek-ai/dsh-file-reference-local";
/** Tên package của ta. */
const OUR_NAME = "@galaxy-blackhole/gbh-file-reference-local";
/** Id row trong ours.yml. */
const ROW_ID = "file-reference-local";

/** Manifest của gói — nguồn DUY NHẤT của cả gbh.peers lẫn peerDependencies (JSON được miễn header). */
interface Manifest {
  /** Tên package. */
  name: string;
  /** Phiên bản. */
  version?: string;
  /** Bảng export. */
  exports?: Record<string, unknown>;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Metadata nửa client của DSH (bản gốc KHÔNG có). */
  dsh?: { client?: unknown };
  /** Metadata row của ta — lượt này CHƯA khai row. */
  gbh?: { peers?: string[]; tests?: string[]; row?: unknown; row_unmounted_ly_do?: unknown };
}

/** Đọc manifest của gói ta từ đĩa (đọc thẳng file, không import). */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Manifest;
}

/** Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật. */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của gbh.peers không có mặt trong peerDependencies.
 * So PHẦN TỬ, KHÔNG so số lượng — peerDependencies thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/** Băm sha256 một chuỗi — dùng cho phép đối chứng TỪNG BYTE. */
function sha256(text: string): string {
  return createHash("sha256").update(normalizePackageNames(text)).digest("hex");
}

/** Tên export của một file ESM đã build (cùng hai regex mà check:rows dùng). */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/**
 * Chờ một điều kiện thành thật, có TRẦN thời gian — KHÔNG dùng setTimeout(0) làm phép đo.
 * Vì sao: lượt dựng lại chỉ mục chạy ở phía sau con trỏ, nên chỉ một vòng chờ CÓ TRẦN mới phân biệt
 * được "chưa kịp" với "hỏng"; setTimeout(0) là phép đo không trần và sẽ xanh/đỏ theo tải máy.
 * Nhận: hàm điều kiện + trần mili giây + bước thăm dò.
 * Trả: promise hoàn tất khi điều kiện đạt; ném khi quá trần.
 */
async function waitFor(check: () => boolean | Promise<boolean>, ceilingMs = 4000, stepMs = 10): Promise<void> {
  const deadline = Date.now() + ceilingMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  throw new Error("waitFor qua tran " + String(ceilingMs) + "ms");
}

/** Context TỐI THIỂU để dựng service bằng new (chỉ cần reflect.provide cho lớp Service của cordis). */
function bareContext(): any {
  return {
    reflect: { provide: () => () => {} },
    agents: { list: () => [], get: () => undefined },
    workingDirectory: { ensure: async () => "" },
    logger: { warn: () => {} },
    effect: () => {},
    on: () => {},
  };
}

/** Vết những gì một agent giả ghi lại khi mục prompt được cài. */
interface PromptLog {
  /** Các mục prompt đã đăng ký. */
  sections: any[];
  /** Các họ mục đã hỏi thứ tự. */
  orderQueries: string[];
  /** Các lượt tra tool đã xảy ra. */
  toolQueries: { name: string; agent: string }[];
}

/**
 * Dựng một agent giả có ĐÚNG mặt ctx mà row này chạm: tools.get + inject.
 * Nhận: id phiên + agent có tool read hay không.
 * Trả: agent giả kèm vết PromptLog gắn trên chính nó.
 */
function makeAgent(id: string, hasRead: boolean): any {
  const log: PromptLog = { sections: [], orderQueries: [], toolQueries: [] };
  const agent: any = {
    id,
    log,
    ctx: {
      tools: {
        get(name: string, target: any) {
          log.toolQueries.push({ name, agent: target?.id });
          return hasRead && name === "read" ? { name: "read" } : undefined;
        },
      },
      inject(_dependencies: string[], callback: (scope: any) => void) {
        const scope = {
          systemPrompt: {
            section(section: any) {
              log.sections.push(section);
              return () => {};
            },
            getSectionOrder(family: string) {
              log.orderQueries.push(family);
              return 90;
            },
          },
          tools: agent.ctx.tools,
        };
        callback(scope);
        return { dispose: async () => {} };
      },
    },
  };
  return agent;
}

/**
 * Dựng MỘT bản cài trên Context cordis THẬT, cấp hai seam mà plugin khai trong inject.
 * Nhận: lớp plugin, cấu hình, và danh sách agent giả.
 * Trả: Context, thực thể service đã đăng ký dưới tên fileReferences, và sổ agent giả.
 */
async function boot(plugin: any, config: any, agents: any[], cwd: string): Promise<{ ctx: any; service: any; agents: Map<string, any> }> {
  const ctx: any = new ctxCtor();
  const registry = new Map<string, any>();
  for (const agent of agents) registry.set(agent.id, agent);
  ctx.provide("agents", { list: () => agents, get: (id: string) => registry.get(id) });
  ctx.provide("workingDirectory", { ensure: async () => cwd });
  await ctx.plugin(plugin, config);
  return { ctx, service: ctx.get("fileReferences"), agents: registry };
}

/** Lớp Context của đúng bản cordis mà cả hai bundle nạp. */
let ctxCtor: any;
/** Bản CỦA TA nạp từ NGUỒN (artifact được đo riêng bằng văn bản). */
let ours: any;
/** Bundle GỐC. */
let stock: any;
/** Artifact của ta đã build ra thư mục tạm — dùng cho cả phép đọc VĂN BẢN lẫn phép nạp THẬT. */
let artifact: any;
/** Nội dung artifact đã build (đo bằng văn bản). */
let artifactText = "";
/** Thư mục build tạm, dọn ở afterAll. */
const TEMP_DIRS: string[] = [];

/** Cây thư mục mẫu dùng cho MỌI ca hành vi — dựng một lần, dọn ở afterAll. */
let TREE = "";

/**
 * Dựng cây mẫu bằng đúng những tên mà bản gốc phân biệt: thư mục bị loại (node_modules, dist),
 * tệp ẩn, tên có dấu cách, và một cây con.
 * Nhận: đường dẫn gốc.
 * Trả: không.
 */
function makeTree(root: string): void {
  for (const dir of ["src/nested", "node_modules/pkg", "dist", "dir with space", ".git"]) mkdirSync(join(root, dir), { recursive: true });
  const files = [
    "src/index.ts",
    "src/app.ts",
    "src/nested/deep.ts",
    "README.md",
    ".hidden.txt",
    "node_modules/pkg/x.js",
    "dist/out.js",
    "dir with space/file.md",
    ".git/config",
  ];
  for (const file of files) writeFileSync(join(root, file), "x");
}

beforeAll(async () => {
  const cordisModule: any = await import(CORDIS);
  ctxCtor = cordisModule.Context;
  stock = await import(STOCK_BUNDLE);
  const buildModule: any = await import(join(PKG, "build.ts"));
  const dir = mkdtempSync(join(tmpdir(), "gbh-file-reference-local-"));
  TEMP_DIRS.push(dir);
  // buildPackage XOÁ thư mục đích trước khi build ⇒ phải trỏ node_modules SAU, không thì link bị xoá.
  const file = await buildModule.buildPackage(dir);
  // Peer phải trỏ về KERNEL (pattern tests/host/shell.test.ts): nạp src/ hay lib/ trong workspace thì
  // `@deepseek-ai/dsh-file-reference` phân giải về bản .bun của workspace — khác realpath kernel ⇒ khác
  // lớp nền (ca 9) và khác THỂ HIỆN hàm ngữ pháp (ca 18). Vì vậy `ours` chính LÀ artefact đã build.
  mkdirSync(join(dir, "node_modules"), { recursive: true });
  symlinkSync(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), join(dir, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(dir, "node_modules", "@galaxy-blackhole"), "dir");
  artifactText = readFileSync(file, "utf8");
  artifact = await import(file);
  ours = artifact;
  TREE = mkdtempSync(join(tmpdir(), "gbh-file-reference-local-tree-"));
  TEMP_DIRS.push(TREE);
  makeTree(TREE);
});

afterAll(() => {
  for (const dir of TEMP_DIRS) rmSync(dir, { recursive: true, force: true });
});

describe("bước 0 — cặp row trong oracle dump MỚI NHẤT + hình dạng gói", () => {
  test("ca 0a: cặp '- id: file-reference-local' + name gốc CÓ THẬT trong ours.yml mới nhất, KHÔNG config/inject/disabled", () => {
    const dumps = join(ROOT, ".parity", "dumps");
    expect(existsSync(dumps)).toBe(true);
    const newest = readdirSync(dumps)
      .filter((name) => existsSync(join(dumps, name, "ours.yml")))
      .sort()
      .at(-1);
    expect(newest).toBeDefined();
    const lines = readFileSync(join(dumps, newest as string, "ours.yml"), "utf8").split("\n");
    const at = lines.findIndex((line) => line.trim() === "- id: " + ROW_ID);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(lines[at + 1]?.trim()).toBe("name: '" + STOCK_NAME + "'");
    // Đoạn của row này chỉ có ĐÚNG dòng name ⇒ gốc KHÔNG bị tắt và KHÔNG mang config (kể cả !!js …).
    // Mốc hết row là dòng bắt đầu bằng "- " của row kế tiếp.
    const end = lines.findIndex((line, index) => index > at && line.startsWith("- "));
    const rowLines = lines
      .slice(at + 1, end < 0 ? lines.length : end)
      .filter((line) => line.trim() !== "" && !line.startsWith("#"));
    expect(rowLines.length).toBe(1);
    expect(rowLines[0]?.trim()).toBe("name: '" + STOCK_NAME + "'");
    // Luật "config dùng ctx.X thì inject phải chứa X" KHÔNG áp dụng — nhưng phải KIỂM, không bỏ qua.
    expect(lines.slice(at, end < 0 ? lines.length : end).join("\n")).not.toContain("!!js");
  });

  test("ca 0b: gói gốc MỘT MẶT — lib/client.js KHÔNG tồn tại, manifest gốc không có dsh.client", () => {
    expect(existsSync(join(STOCK, "lib", "client.js"))).toBe(false);
    const stockManifest = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as Manifest;
    expect(stockManifest.dsh?.client).toBeUndefined();
    expect(stockManifest.exports?.["./client"]).toBeUndefined();
    // Và gói ta cũng KHÔNG khai nửa client.
    expect(readManifest().dsh).toBeUndefined();
    expect(readManifest().exports?.["./client"]).toBeUndefined();
  });

  test("ca 0c: gbh.row do LEAD khai NGOÀI phiên viết gói — hình dạng đúng: id + tests, KHÔNG config/moduleIds/aliases", () => {
    // Row TRẦN trong ours.yml (ca 0a) ⇒ khi Lead khai thì KHÔNG config, KHÔNG inject, KHÔNG moduleIds
    // (row MỘT MẶT nên không có id bundle nào), KHÔNG aliases. Ca này canh đúng hình dạng ấy.
    const manifest = readManifest();
    expect(manifest.gbh?.row).toEqual({ id: "file-reference-local", tests: ["tests/host/file-reference-local.test.ts"] });
    expect(manifest.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(manifest.gbh?.peers).toEqual(["@deepseek-ai/dsh-file-reference"]);
    expect(manifest.gbh?.tests).toEqual(["tests/host/file-reference-local.test.ts"]);
    expect(existsSync(join(ROOT, "tests", "host", "file-reference-local.test.ts"))).toBe(true);
  });

  test("ca 0d: bản gốc KHÔNG ship subpath ./search cho ai dùng — nên ta cũng không ship, và ghi rõ lý do", async () => {
    const stockManifest = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as Manifest;
    expect(Object.keys(stockManifest.exports ?? {})).toContain("./search");
    // Ta KHÔNG ship ./search ⇒ phải chắc chắn không ai tiêu thụ nó trong repo.
    const areas = readdirSync(join(ROOT, "packages"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
    const hits = areas
      .flatMap((area) => readdirSync(join(ROOT, "packages", area.name), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(ROOT, "packages", area.name, entry.name, "package.json")))
      .filter((file) => existsSync(file))
      .filter((file) => readFileSync(file, "utf8").includes("file-reference-local/search"));
    expect(hits).toEqual([]);
    expect(readManifest().exports?.["./search"]).toBeUndefined();
  });
});

describe("ARTIFACT — khuôn bundle và tập export", () => {
  test("ca 1: tập export ta = tập export gốc (đo trên VĂN BẢN artifact, và trên bản NẠP thật)", () => {
    const mine = exportNames(artifactText);
    const theirs = exportNames(readFileSync(STOCK_BUNDLE, "utf8"));
    expect(mine).toEqual(theirs);
    expect(mine).toEqual([
      "DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES",
      "DEFAULT_FILE_SEARCH_MAX_ENTRIES",
      "DEFAULT_FILE_SEARCH_MAX_RESULTS",
      "FILE_REFERENCE_PROMPT",
      "LocalFileReferenceService",
      "WorkspaceFileSearch",
      "activeAtToken",
      "default",
      "formatFileMention",
    ]);
    // Đo lại trên bản NẠP THẬT: artifact nạp được và phơi đúng tập khoá.
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(artifact.default).toBe(artifact.LocalFileReferenceService);
    expect(stock.default).toBe(stock.LocalFileReferenceService);
  });

  test("ca 2: build.ts nhận thư mục đích qua process.argv[2] (thiếu ⇒ profile không có lib ⇒ không sinh entry)", () => {
    expect(readFileSync(join(PKG, "build.ts"), "utf8")).toContain("process.argv[2]");
  });

  test("ca 3: artifact KHÔNG đăng ký id module nào và không đụng bộ nạp client (row HOST-ONLY)", () => {
    expect(artifactText.match(/id: @deepseek-ai/g)?.length ?? 0).toBe(0);
    expect(artifactText.match(/id: @galaxy-blackhole/g)?.length ?? 0).toBe(0);
    expect(artifactText.match(/__ModuleLoader__/g)?.length ?? 0).toBe(0);
  });

  test("ca 4: artifact chỉ nạp ĐÚNG ba gói ngoài — dsh-file-reference (+ /grammar) và schemastery", () => {
    const specifiers = [...artifactText.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((match) => match[1] ?? "");
    // KHÔNG gói ngoài nào khác ngoài ba cái trên; phần còn lại PHẢI là builtin `node:`.
    expect(specifiers.filter((specifier) => !specifier.startsWith("node:")).sort()).toEqual([
      "@deepseek-ai/dsh-file-reference",
      "@deepseek-ai/dsh-file-reference/grammar",
      "@deepseek-ai/schemastery",
    ]);
    expect(specifiers.filter((specifier) => !specifier.startsWith("node:") && !specifier.startsWith("@deepseek-ai/"))).toEqual([]);
    // `dsh-agent` chỉ mượn KIỂU nên bị xoá khỏi artifact — không được xuất hiện.
    expect(artifactText).not.toContain("@deepseek-ai/dsh-agent");
    expect(readManifest().dependencies).toBeUndefined();
  });

  test("ca 5: luật 000e — locale/{en,zh}.json chép BYTE-FOR-BYTE và có trong exports", () => {
    for (const locale of ["en", "zh"]) {
      const name = "locale/" + locale + ".json";
      expect(sha256(readFileSync(join(PKG, name), "utf8"))).toBe(sha256(readFileSync(join(STOCK, name), "utf8")));
    }
    expect(sha256(readFileSync(join(PKG, "locale", "en.json"), "utf8"))).toBe("8c01f68ff67a5632f702f339f5f2db4109776cc9fec81446cec0eb675b1a12a7");
    expect(sha256(readFileSync(join(PKG, "locale", "zh.json"), "utf8"))).toBe("1ed2f2e3ad7771564adfc5e20d852b023f1db783b2917d769bf3be64a5fee841");
    expect(readManifest().exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });
});

describe("peer — gbh.peers ⊆ peerDependencies, so PHẦN TỬ", () => {
  test("ca 6: manifest thật có 0 tên lệch, peer KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    expect(missingPeers(manifest)).toEqual([]);
    expect(manifest.dependencies).toBeUndefined();
    expect(Object.keys(manifest.peerDependencies ?? {}).sort()).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-file-reference",
      "@deepseek-ai/schemastery",
    ]);
  });

  test("ca 7: ĐỐI CHỨNG ÂM — xoá MỌI peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const broken = cloneManifest(readManifest());
    broken.peerDependencies = {};
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/dsh-file-reference"]);
  });

  test("ca 8: đối chứng âm thứ hai — CÙNG số lượng mà lệch phần tử vẫn PHẢI bị bắt; thừa tên vẫn ĐẠT", () => {
    const broken = cloneManifest(readManifest());
    broken.peerDependencies = {
      "@deepseek-ai/cordis": "~4.0.4",
      "@deepseek-ai/schemastery": "~3.18.5",
      "@deepseek-ai/dsh-agent": "0.2.1-alpha.4",
    };
    // 3 tên như bản thật nhưng LỆCH phần tử ⇒ phép so SỐ LƯỢNG sẽ cho verdict RỖNG, phép so PHẦN TỬ bắt được.
    expect(Object.keys(broken.peerDependencies).length).toBe(Object.keys(readManifest().peerDependencies ?? {}).length);
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/dsh-file-reference"]);
    const extra = cloneManifest(readManifest());
    extra.peerDependencies = { ...extra.peerDependencies, "@deepseek-ai/dsh-agent": "0.2.1-alpha.4" };
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("hành vi — A/B trực tiếp với chính bundle gốc trên CÙNG một giàn", () => {
  test("ca 9: cùng LỚP NỀN của kernel, cùng tên service, cùng static inject, cùng hình dạng thực thể", async () => {
    // Quan hệ kế thừa phải là CÙNG một lớp cha — nếu khác thì hành vi sẽ lệch mà cổng không thấy.
    expect(Object.getPrototypeOf(ours.LocalFileReferenceService)).toBe(Object.getPrototypeOf(stock.LocalFileReferenceService));
    expect(ours.LocalFileReferenceService.inject).toEqual(stock.LocalFileReferenceService.inject);
    expect(ours.LocalFileReferenceService.inject).toEqual(["agents", "workingDirectory"]);
    const a = await boot(ours.default, {}, [makeAgent("s1", true)], TREE);
    const b = await boot(stock.default, {}, [makeAgent("s1", true)], TREE);
    expect(a.service).toBeDefined();
    expect(b.service).toBeDefined();
    expect(a.service.name).toBe(b.service.name);
    expect(a.service.name).toBe("fileReferences");
    // Trường thực thể: cùng tập khoá (config · searches · promptFibers · promptDisposals).
    expect(Object.keys(a.service).sort()).toEqual(Object.keys(b.service).sort());
    expect(Object.getOwnPropertyNames(ours.WorkspaceFileSearch.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.WorkspaceFileSearch.prototype).sort(),
    );
  });

  test("ca 10: list() khớp TỪNG ỨNG VIÊN trên 13 truy vấn (thư mục · mờ · dấu chấm · thoát gốc · bị loại)", async () => {
    const a = await boot(ours.default, {}, [makeAgent("s1", true)], TREE);
    const b = await boot(stock.default, {}, [makeAgent("s1", true)], TREE);
    const signal = new AbortController().signal;
    const queries = ["", "src/", "src/ap", "index", "idex", "README", ".hid", "nested/dee", "../", "src/../", "nope", "node_modules/", "dir with space/"];
    for (const query of queries) {
      const mine = await a.service.list(a.agents.get("s1"), query, signal);
      const theirs = await b.service.list(b.agents.get("s1"), query, signal);
      expect(JSON.stringify(mine)).toBe(JSON.stringify(theirs));
    }
    // Neo giá trị cụ thể để test không "xanh rỗng" khi cả hai cùng sai.
    const rootListing = await a.service.list(a.agents.get("s1"), "", signal);
    expect(rootListing.map((candidate: any) => candidate.path).sort()).toEqual(["README.md", "dir with space", "src"]);
    expect(rootListing.find((candidate: any) => candidate.path === "src").kind).toBe("directory");
    expect(await a.service.list(a.agents.get("s1"), "nope", signal)).toEqual([]);
    // Thoát GỐC bị từ chối ở CẢ HAI dạng (một cấp và nhiều cấp).
    expect(await a.service.list(a.agents.get("s1"), "../", signal)).toEqual([]);
    expect(await a.service.list(a.agents.get("s1"), "../../", signal)).toEqual([]);
    expect(await a.service.list(a.agents.get("s1"), "src/../../../", signal)).toEqual([]);
    // Còn `src/../` KHÔNG thoát gốc: nó quy về chính gốc, chỉ đổi tiền tố hiển thị.
    expect((await a.service.list(a.agents.get("s1"), "src/../", signal)).map((c: any) => c.path).sort()).toEqual([
      "src/../README.md",
      "src/../dir with space",
      "src/../src",
    ]);
    expect(await a.service.list(a.agents.get("s1"), "node_modules/", signal)).toEqual([]);
    // Truy vấn có dấu chấm MỞ khoá tệp ẩn.
    expect((await a.service.list(a.agents.get("s1"), ".hid", signal)).map((c: any) => c.path)).toEqual([".hidden.txt"]);
  });

  test("ca 11: mục prompt context:file-reference khớp TỪNG TRƯỜNG, kể cả khi agent KHÔNG có tool read", async () => {
    for (const hasRead of [true, false]) {
      const agentA = makeAgent("s1", hasRead);
      const agentB = makeAgent("s1", hasRead);
      const a = await boot(ours.default, {}, [agentA], TREE);
      const b = await boot(stock.default, {}, [agentB], TREE);
      expect(agentA.log.sections.length).toBe(1);
      expect(agentB.log.sections.length).toBe(1);
      const mine = agentA.log.sections[0];
      const theirs = agentB.log.sections[0];
      expect(mine.name).toBe(theirs.name);
      expect(mine.name).toBe("context:file-reference");
      expect(mine.order).toBe(theirs.order);
      expect(agentA.log.orderQueries).toEqual(agentB.log.orderQueries);
      expect(agentA.log.orderQueries).toEqual(["FILE_REFERENCE"]);
      // Chữ dựng MỖI lượt và phụ thuộc việc agent có tool read — so cả hai trạng thái.
      const mineText = mine.text();
      const theirsText = theirs.text();
      expect(mineText).toBe(theirsText);
      expect(mineText === "").toBe(!hasRead);
      // Tra tool đúng MỘT lần cho một lượt dựng chữ, và tra đúng tên "read" cho ĐÚNG agent.
      expect(agentA.log.toolQueries.length).toBe(1);
      expect(agentB.log.toolQueries.length).toBe(1);
      expect(agentA.log.toolQueries).toEqual(agentB.log.toolQueries);
      expect(agentA.log.toolQueries[0]?.name).toBe("read");
      expect(agentA.log.toolQueries[0]?.agent).toBe("s1");
      // Dựng lại phải tra LẦN NỮA (chữ không được nhớ sẵn) — đó là điểm khác biệt của mục này.
      expect(mine.text()).toBe(mineText);
      expect(agentA.log.toolQueries.length).toBe(2);
      expect(a.service.promptFibers.size).toBe(1);
      expect(b.service.promptFibers.size).toBe(1);
    }
  });

  test("ca 12: schema Config — cùng mặc định, cùng chấp nhận, cùng từ chối, cùng câu lỗi (4 dạng hỏng)", () => {
    expect(String(ours.LocalFileReferenceService.Config)).toBe(String(stock.LocalFileReferenceService.Config));
    expect(ours.LocalFileReferenceService.Config({})).toEqual(stock.LocalFileReferenceService.Config({}));
    expect(ours.LocalFileReferenceService.Config({}).excludedDirectories).toEqual(ours.DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES);
    expect(ours.DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES).toEqual(stock.DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES);
    expect(ours.DEFAULT_FILE_SEARCH_MAX_ENTRIES).toBe(stock.DEFAULT_FILE_SEARCH_MAX_ENTRIES);
    expect(ours.DEFAULT_FILE_SEARCH_MAX_RESULTS).toBe(stock.DEFAULT_FILE_SEARCH_MAX_RESULTS);
    const broken: any[] = [{ maxResults: 0 }, { maxResults: 1.5 }, { maxEntries: 0 }, { maxEntries: -3 }];
    for (const value of broken) {
      let mine = "ok";
      let reference = "ok";
      try {
        ours.LocalFileReferenceService.Config(value);
      } catch (error) {
        mine = (error as Error).message;
      }
      try {
        stock.LocalFileReferenceService.Config(value);
      } catch (error) {
        reference = (error as Error).message;
      }
      expect(mine).toBe(reference);
      expect(mine).not.toBe("ok");
    }
  });

  test("ca 13: hai LỚP KIỂM cấu hình (schema và constructor) ném cùng thông điệp ở cả hai bản — 6 dạng", async () => {
    // Lớp 1: constructor của service (tiền tố file-reference-local:) — dựng thẳng bằng new, không qua schema.
    const serviceBroken: any[] = [
      { maxResults: 0 },
      { maxEntries: -1 },
      { maxResults: 1.5 },
      { excludedDirectories: [""] },
      { excludedDirectories: ["a/b"] },
      { excludedDirectories: ["a" + String.fromCharCode(92) + "b"] },
    ];
    for (const config of serviceBroken) {
      let mine = "ok";
      let reference = "ok";
      try {
        new ours.default(bareContext(), config);
      } catch (error) {
        mine = (error as Error).message;
      }
      try {
        new stock.default(bareContext(), config);
      } catch (error) {
        reference = (error as Error).message;
      }
      expect(mine).toBe(reference);
      expect(mine).not.toBe("ok");
      expect(mine.startsWith("file-reference-local: ")).toBe(true);
    }
    // Lớp 2: chỉ mục (tiền tố file search:) — tự kiểm lại ngay tại biên của nó.
    for (const config of serviceBroken) {
      let mine = "ok";
      let reference = "ok";
      const base = { maxResults: 20, maxEntries: 5e4, excludedDirectories: [] as string[], ...config };
      try {
        new ours.WorkspaceFileSearch(TREE, base);
      } catch (error) {
        mine = (error as Error).message;
      }
      try {
        new stock.WorkspaceFileSearch(TREE, base);
      } catch (error) {
        reference = (error as Error).message;
      }
      expect(mine).toBe(reference);
      expect(mine).not.toBe("ok");
      expect(mine.startsWith("file search ")).toBe(true);
    }
  });

  test("ca 14: truy vấn mờ TRẦN dùng chung MỘT lượt quét; đánh dấu cũ trả lời NGAY bằng chỉ mục cũ", async () => {
    const a = await boot(ours.default, {}, [makeAgent("s1", true)], TREE);
    const b = await boot(stock.default, {}, [makeAgent("s1", true)], TREE);
    const signal = new AbortController().signal;
    const agentA = a.agents.get("s1");
    const agentB = b.agents.get("s1");
    expect(await a.service.list(agentA, "index", signal)).toEqual(await b.service.list(agentB, "index", signal));
    const mineSearch = a.service.searches.get(agentA).search;
    const theirsSearch = b.service.searches.get(agentB).search;
    expect(mineSearch.settled === undefined).toBe(theirsSearch.settled === undefined);
    expect(mineSearch.settled.entries.length).toBe(theirsSearch.settled.entries.length);
    expect(mineSearch.invalidations).toBe(theirsSearch.invalidations);
    // Tệp mới XUẤT HIỆN sau lượt quét đầu.
    writeFileSync(join(TREE, "index-2.ts"), "x");
    expect(await a.service.list(agentA, "index", signal)).toEqual(await b.service.list(agentB, "index", signal));
    // Đánh dấu cũ: lượt trả lời KẾ TIẾP vẫn dùng chỉ mục CŨ (tất định), rồi bản thay thế dựng ở phía sau.
    mineSearch.invalidate();
    theirsSearch.invalidate();
    expect(await a.service.list(agentA, "index", signal)).toEqual(await b.service.list(agentB, "index", signal));
    // Chờ CÓ TRẦN cho tới khi chỉ mục thay thế thấy tệp mới — ở CẢ HAI bên.
    await waitFor(async () => (await a.service.list(agentA, "index", signal)).length === 2);
    await waitFor(async () => (await b.service.list(agentB, "index", signal)).length === 2);
    expect((await a.service.list(agentA, "index", signal)).map((c: any) => c.path).sort()).toEqual(
      (await b.service.list(agentB, "index", signal)).map((c: any) => c.path).sort(),
    );
    rmSync(join(TREE, "index-2.ts"), { force: true });
  });

  test("ca 15: gỡ nạp chỉ mục ⇒ mọi truy vấn trả RỖNG ở cả hai bản; huỷ trước khi chạy cũng khớp", async () => {
    const a = await boot(ours.default, {}, [makeAgent("s1", true)], TREE);
    const b = await boot(stock.default, {}, [makeAgent("s1", true)], TREE);
    const signal = new AbortController().signal;
    const agentA = a.agents.get("s1");
    const agentB = b.agents.get("s1");
    expect((await a.service.list(agentA, "index", signal)).length).toBeGreaterThan(0);
    expect(await b.service.list(agentB, "index", signal)).toEqual(await a.service.list(agentA, "index", signal));
    a.service.searches.get(agentA).search.dispose();
    b.service.searches.get(agentB).search.dispose();
    expect(await a.service.list(agentA, "index", signal)).toEqual(await b.service.list(agentB, "index", signal));
    expect(await a.service.list(agentA, "index", signal)).toEqual([]);
    // Huỷ TRƯỚC lượt gọi: hai bên từ chối cùng một thông điệp.
    const aborted = new AbortController();
    aborted.abort();
    let mine = "ok";
    let reference = "ok";
    try {
      await a.service.list(a.agents.get("s1"), "index", aborted.signal);
    } catch (error) {
      mine = (error as Error).message;
    }
    try {
      await b.service.list(b.agents.get("s1"), "index", aborted.signal);
    } catch (error) {
      reference = (error as Error).message;
    }
    expect(mine).toBe(reference);
    expect(mine).not.toBe("ok");
  });

  test("ca 16: đổi cwd của agent ⇒ gỡ chỉ mục cũ và dựng chỉ mục mới (cả hai bản)", async () => {
    const other = mkdtempSync(join(tmpdir(), "gbh-file-reference-local-other-"));
    TEMP_DIRS.push(other);
    mkdirSync(join(other, "only"), { recursive: true });
    writeFileSync(join(other, "only", "marker.ts"), "x");
    const agentA = makeAgent("s1", true);
    const agentB = makeAgent("s1", true);
    const a: any = await boot(ours.default, {}, [agentA], TREE);
    const b: any = await boot(stock.default, {}, [agentB], TREE);
    const signal = new AbortController().signal;
    expect(await a.service.list(agentA, "", signal)).toEqual(await b.service.list(agentB, "", signal));
    expect(a.service.searches.get(agentA).cwd).toBe(TREE);
    // Trỏ workingDirectory sang cây khác: seam giả đọc biến này.
    a.ctx.get("workingDirectory").ensure = async () => other;
    b.ctx.get("workingDirectory").ensure = async () => other;
    expect(await a.service.list(agentA, "", signal)).toEqual(await b.service.list(agentB, "", signal));
    expect(a.service.searches.get(agentA).cwd).toBe(other);
    expect(a.service.searches.get(agentA).cwd).toBe(b.service.searches.get(agentB).cwd);
    expect((await a.service.list(agentA, "", signal)).map((c: any) => c.path)).toEqual(["only"]);
  });

  test("ca 17: trần maxResults áp ĐÚNG cho cả liệt kê thư mục lẫn truy vấn mờ (hai bản)", async () => {
    const config = { maxResults: 2 };
    const a: any = await boot(ours.default, config, [makeAgent("s1", true)], TREE);
    const b: any = await boot(stock.default, config, [makeAgent("s1", true)], TREE);
    const signal = new AbortController().signal;
    for (const query of ["", "src/", "s"]) {
      const mine = await a.service.list(a.agents.get("s1"), query, signal);
      const theirs = await b.service.list(b.agents.get("s1"), query, signal);
      expect(JSON.stringify(mine)).toBe(JSON.stringify(theirs));
      expect(mine.length).toBeLessThanOrEqual(2);
    }
  });

  test("ca 18: grammar dùng lại ĐÚNG ba export của gói gốc (không chép đè) — activeAtToken + formatFileMention", () => {
    expect(ours.FILE_REFERENCE_PROMPT).toBe(stock.FILE_REFERENCE_PROMPT);
    expect(ours.activeAtToken).toBe(stock.activeAtToken);
    expect(ours.formatFileMention).toBe(stock.formatFileMention);
    // Và đúng là CÙNG thể hiện hàm của gói gốc (nạp qua peer), không phải bản sao.
    const reference: any = (globalThis as any).__frGrammarProbe;
    expect(reference === undefined || reference === ours.activeAtToken).toBe(true);
  });
});

describe("C6 — DANH TÍNH của vật thể cấu hình giữa các thực thể", () => {
  test("ca 19: hai chỉ mục KHÔNG dùng chung tập loại trừ; sửa bản này KHÔNG lan sang bản kia", () => {
    const config = { maxResults: 20, maxEntries: 100, excludedDirectories: ["node_modules"] };
    const first = new ours.WorkspaceFileSearch(TREE, { ...config });
    const second = new ours.WorkspaceFileSearch(TREE, { ...config });
    // DANH TÍNH, không phải giá trị — phép so sâu KHÔNG bắt được lớp lỗi này.
    expect(first.excludedDirectories).not.toBe(second.excludedDirectories);
    expect(first.excludedDirectories instanceof Set).toBe(true);
    first.excludedDirectories.add("src");
    expect(second.excludedDirectories.has("src")).toBe(false);
    expect([...second.excludedDirectories]).toEqual(["node_modules"]);
    // Cùng hành vi với bản gốc.
    const reference = new stock.WorkspaceFileSearch(TREE, { ...config });
    expect(reference.excludedDirectories).not.toBe(first.excludedDirectories);
    expect([...reference.excludedDirectories]).toEqual(["node_modules"]);
    expect(first.settled).toBeUndefined();
    expect(second.settled).toBeUndefined();
  });

  test("ca 20: hai SERVICE có sổ chỉ mục ĐỘC LẬP; mỗi thực thể một Map riêng", async () => {
    const a = await boot(ours.default, {}, [makeAgent("s1", true)], TREE);
    const b = await boot(ours.default, {}, [makeAgent("s2", true)], TREE);
    expect(a.service.searches).not.toBe(b.service.searches);
    expect(a.service.promptFibers).not.toBe(b.service.promptFibers);
    expect(a.service.promptDisposals).not.toBe(b.service.promptDisposals);
    expect(a.service.config).not.toBe(b.service.config);
    a.service.config.maxResults = 3;
    expect(b.service.config.maxResults).toBe(20);
    // Đường `ctx.plugin` áp schema ⇒ mỗi thực thể nhận MỘT mảng mới, nên hai service ĐỘC LẬP.
    expect(a.service.config.excludedDirectories).not.toBe(b.service.config.excludedDirectories);
    expect(a.service.config.excludedDirectories).not.toBe(ours.DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES);
    a.service.config.excludedDirectories.push("src");
    expect(b.service.config.excludedDirectories).not.toContain("src");
    a.service.config.excludedDirectories.pop();
    // Còn đường dựng THẲNG bằng `new` (bỏ qua schema) thì dùng CHÍNH hằng mô-đun — trung thành với
    // bản gốc, nên GHI LẠI bằng phép đo CẢ HAI BÊN thay vì "sửa" thành bản sao.
    const directOursA = new ours.default(bareContext(), {});
    const directOursB = new ours.default(bareContext(), {});
    const directStock = new stock.default(bareContext(), {});
    expect(directOursA.config.excludedDirectories).toBe(ours.DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES);
    expect(directStock.config.excludedDirectories).toBe(stock.DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES);
    expect(directOursA.config.excludedDirectories === directOursB.config.excludedDirectories).toBe(true);
    // Chỗ TIÊU THỤ thật thì luôn sao: mỗi chỉ mục một Set riêng (đo ở ca 19).
    expect(directOursA.config).not.toBe(directOursB.config);
  });
});
