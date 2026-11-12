/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Scaffold mot package thay row DSH: doc ma tran + package goc roi sinh khung package cua ta.
 *      12/11/2026: ROOT doc import.meta.url thay import.meta.dir (Bun-only) — rows.ts (cong chan mount)
 *      import module nay va phai chay duoc bang Node khi app desktop dung launcher Node
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Thu muc goc cua repo (tools/scaffold -> ../..; import.meta.url: Bun va Node deu co). */
export const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
/** Noi cai runtime DSH (chi doc). */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai");

/** Mot dong cua ma tran parity. */
export interface MatrixRow {
  /** So thu tu trong ma tran. */
  index: number;
  /** Id row trong cay plugin. */
  rowId: string;
  /** Ten package DSH goc. */
  stock: string;
  /** Ten package cua ta theo ma tran. */
  ours: string;
  /** Tier (T0..T5). */
  tier: string;
}

/**
 * Doc docs/PARITY-MATRIX.md thanh danh sach row.
 * @returns moi dong co du 5 cot va cot dau la so.
 */
export function readMatrix(): MatrixRow[] {
  const file = join(ROOT, "docs", "PARITY-MATRIX.md");
  const out: MatrixRow[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.startsWith("| ")) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
    const [idx, rowId, stock, ours, tier] = cells;
    if (idx === undefined || rowId === undefined || stock === undefined) continue;
    if (ours === undefined || tier === undefined || !/^\d+$/.test(idx)) continue;
    out.push({
      index: Number(idx),
      rowId: rowId.replace(/`/g, ""),
      stock: stock.replace(/`/g, ""),
      ours: ours.replace(/`/g, ""),
      tier,
    });
  }
  return out;
}

/**
 * Tim row theo id hoac ten package goc.
 * @param rows - danh sach row.
 * @param key - id row hoac ten package.
 * @returns row khop, hoac undefined.
 */
export function findRow(rows: MatrixRow[], key: string): MatrixRow | undefined {
  return rows.find((r) => r.rowId === key || r.stock === key || r.ours === key);
}

/** Kieu metadata nua client trong package.json cua DSH. */
export interface DshClientMeta {
  /** Cac service phia browser ma goi nay phu thuoc. */
  inject?: string[] | string;
  /** Nen tang (thuong la 'web'). */
  platform?: string;
  /** Nap ngay khi boot hay khong. */
  immediately?: boolean;
}

/** Thong tin doc duoc tu package goc. */
export interface StockInfo {
  /** Co nua client hay khong (cau hoi 5 cua cong thuc). */
  twoSided: boolean;
  /** Metadata nua client neu co. */
  client?: DshClientMeta;
  /** Cac goi DSH ma goi goc can (ngoai cordis). */
  peers: string[];
  /** So dong JS da build, TINH CA chunk lazy (thuong chua ca thu vien ben thu ba). */
  builtLines: number;
  /** So dong cua CHINH row: `lib/index.js` + `lib/client.js` (khong tinh chunk lazy). */
  entryLines: number;
  /** So dong trong cac chunk lazy (`lib/*.js` khac hai file tren) — phan lon la thu vien. */
  chunkLines: number;
}

/**
 * Doc package.json + do kich thuoc ban build cua goi goc.
 * @param stock - ten package DSH goc.
 * @returns thong tin nua client, peer va kich thuoc.
 */
export function readStock(stock: string): StockInfo {
  const dir = join(STOCK, stock.split("/").pop() as string);
  const pkg = join(dir, "package.json");
  let client: DshClientMeta | undefined;
  const peers: string[] = [];
  if (existsSync(pkg)) {
    const json = JSON.parse(readFileSync(pkg, "utf8")) as {
      dsh?: { client?: DshClientMeta };
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    client = json.dsh?.client;
    for (const key of Object.keys({ ...json.dependencies, ...json.peerDependencies })) {
      if (key !== "@deepseek-ai/cordis" && !key.startsWith("node:")) peers.push(key);
    }
  }
/**
 * Dem so DONG CODE THAT trong mot file bundle, TRU cac vung vendor nhung thang vao entry chunk.
 * Nhan: `text` - noi dung file bundle. Tra: so dong ngoai moi vung vendor.
 *
 * LY DO (do 17/10/2026): bundle cua DSH nhung THU VIEN BEN THU BA THANG VAO entry chunk bang moc
 * esbuild, khong tach thanh chunk lazy:
 *   //#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
 *   //#region ../../../vendor/cosmokit/lib/index.js
 *   //#region ../../../vendor/schemastery/lib/index.mjs
 * Do duoc tren `ui-theme`: 2.082 dong bundle nhung 902 dong la vendor (cosmokit + schemastery +
 * clsx) => code that ~1.180 dong. Truoc ban sua nay `row:cost` bao 2.301 => PHONG DAI ~2x, va hai
 * nguoi doc no da uoc luong cong sai gap doi. Cung lop voi `ui-settings` (900 dong vendor).
 * @param text - noi dung file bundle.
 * @returns so dong ngoai cac vung vendor.
 */
function countCodeLines(text: string): number {
  let n = 0;
  let trongVendor = false;
  for (const line of text.split("\n")) {
    if (!trongVendor && line.includes("#region") && (line.includes("vendor/") || line.includes("node_modules/"))) {
      trongVendor = true;
      continue;
    }
    if (trongVendor) {
      if (line.includes("#endregion")) trongVendor = false;
      continue;
    }
    n += 1;
  }
  return n;
}
  let builtLines = 0;
  let entryLines = 0;
  let chunkLines = 0;
  const lib = join(dir, "lib");
  if (existsSync(lib)) {
    const walk = (d: string): void => {
      for (const name of readdirSync(d)) {
        const full = join(d, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith(".js")) {
          const n = countCodeLines(readFileSync(full, "utf8"));
          builtLines += n;
          // Tach dong cua CHINH row khoi chunk lazy: row `ui-sidebar-terminal` co 497 dong that
          // nhung chunk lazy 13.516 dong, trong do ~13.070 dong la thu vien @xterm/xterm.
          if (d === lib && (name === "index.js" || name === "client.js")) entryLines += n;
          else chunkLines += n;
        }
      }
    };
    walk(lib);
  }
  return { twoSided: client !== undefined, client, peers, builtLines, entryLines, chunkLines };
}

/**
 * Sinh header 5 dong bat buoc theo AGENTS.md.
 * @param desc - mo ta file.
 * @returns khoi comment header.
 */
export function header(desc: string): string {
  return [
    "/**",
    " * author Bùi Trọng Hiếu",
    " * email kevinbui210191@gmail.com",
    " * create date 15/10/2026",
    " * modify date 17/10/2026",
    " * desc " + desc,
    " */",
  ].join("\n");
}

/**
 * Sinh noi dung package.json cho package cua ta.
 * @param ourName - ten package cua ta.
 * @param rowId - id row stock bi thay.
 * @param testPath - duong dan file test.
 * @param stock - ten package goc (de ghi chu).
 * @returns chuoi JSON da dinh dang.
 */
export function makePackageJson(ourName: string, rowId: string, testPath: string, stock: string): string {
  return JSON.stringify({
    name: ourName,
    version: "0.1.0",
    private: true,
    type: "module",
    main: "lib/index.js",
    description: "Ban viet lai cua Galaxy Blackhole cho row " + rowId + " cua DSH (" + stock + ").",
    scripts: { build: "bun run build.ts" },
    // KHONG khai `gbh.row` o day. Khai no = tat row stock cua MOI NGUOI o luot boot ke tiep,
    // trong khi be mat cua ban chua xong (bai hoc 17/10/2026: mot goi do lam mat tinh nang
    // cua ca app, va mot lan khac lam app CHET hoan toan).
    // Bat `gbh.row` CHI KHI: be mat xong + `check:rows` sach + `gate` XANH + lab 0 loi +
    // `check:app` DAT ca chi so (8) do phia trang. Xem docs/recipes/HOST-ROW-REWRITE.md muc 7.
    // Khi bat, dien them tuy nhu cau:
    //   moduleIds: ["<ten package>"]  — BAT BUOC neu bundle dung khuon CJS-boc-IIFE
    //                                   (id sinh qua JSON.stringify nen check:rows khong thay bang regex)
    //   aliases:   ["<id stock>"]      — neu con consumer nao require id goc
    //   insertAs:  "<id row>"          — chi khi can khop id row voi oracle (vi du brand)
    gbh: { draft: "CHUA KHAI gbh.row — xem comment ngay tren va cong thuc muc 7", tests: [testPath] },
  }, null, 2) + "\n";
}

/**
 * Sinh noi dung build.ts chuan cua repo.
 * @param ourName - ten package, dung trong mo ta.
 * @returns noi dung file build.ts.
 */
export function makeBuildTs(ourName: string): string {
  const L = [
    header("Build " + ourName + " ve lib/index.js (ESM, target node) — ban build chi nam trong profile cua app."),
    "import { rm } from \"node:fs/promises\";",
    "import { join } from \"node:path\";",
    "",
    "/**",
    " * Build package thanh mot file ESM duy nhat.",
    " * @param outDir - thu muc dich (mac dinh: lib canh package).",
    " * @returns duong dan file da build.",
    " */",
    "export async function buildPackage(outDir?: string): Promise<string> {",
    "  const out = outDir ?? join(import.meta.dir, \"lib\");",
    "  await rm(out, { recursive: true, force: true });",
    "  const result = await Bun.build({",
    "    entrypoints: [join(import.meta.dir, \"src\", \"index.ts\")],",
    "    outdir: out,",
    "    target: \"node\",",
    "    format: \"esm\",",
    "    naming: \"index.js\",",
    "    packages: \"external\",",
    "  });",
    "  if (!result.success) throw new Error(\"build that bai: \" + result.logs.map((log) => String(log)).join(\" | \"));",
    "  return join(out, \"index.js\");",
    "}",
    "",
    "if (import.meta.main) {",
    "  const target = process.argv[2];",
    "  console.log(\"built \" + (await buildPackage(target)));",
    "}",
  ];
  return L.join("\n");
}