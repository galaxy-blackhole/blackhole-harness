/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sinh docs/DSH-CONVERSION-MATRIX.md: LIỆT KÊ MỌI package DSH đang cài + cột chuyển đổi GBH
 *   (X = chưa chuyển · - = đang chuyển · ✓ = đã chuyển VÀ có đủ 3 chữ ký).
 *
 * CÁCH DÙNG:
 *   ~/.bun/bin/bun run tools/check/conversion-matrix.ts            # ghi lại tài liệu
 *   ~/.bun/bin/bun run tools/check/conversion-matrix.ts --check    # chỉ kiểm tra tài liệu có lệch không
 *
 * NGUỒN SỰ THẬT:
 *   - cây entry đã hợp: "bun run apps/cli/src/main.ts host --dump-config"
 *   - package đang cài: apps/host/node_modules/@deepseek-ai/*
 *   - package của ta: packages/<tier>/<dir>/package.json (gbh.row.aliases quyết định ánh xạ 1:1)
 *   - chữ ký hoàn thành: docs/contracts/data/conversion-signoff.json (dev · owner · reviewer)
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục package gốc của DSH đang cài. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Tệp chữ ký hoàn thành. */
const SIGNOFF = join(REPO, "docs", "contracts", "data", "conversion-signoff.json");
/** Tài liệu sinh ra. */
const OUT = join(REPO, "docs", "DSH-CONVERSION-MATRIX.md");
/** Ký tự backtick trong markdown (tránh lỗi escape của công cụ sinh file). */
const BT = String.fromCharCode(96);
/** Xuống dòng. */
const NL = String.fromCharCode(10);

/** Một package gốc của DSH. */
interface StockRow {
  /** Tên package DSH. */
  name: string;
  /** Nhóm (theo tiền tố tên package). */
  group: string;
  /** Mô tả ngắn lấy từ package.json của bản gốc. */
  description: string;
  /** Có entry đang chạy trong cây đã hợp không. */
  active: boolean;
  /** Package GBH thay thế (nếu có). */
  gbh: string | null;
  /** Đã MOUNT trong cây đã hợp chưa. */
  mounted: boolean;
  /** Có test của gói GBH tương ứng không. */
  tested: boolean;
  /** Ba chữ ký (dev · owner · reviewer) nếu đã có. */
  signoff: { dev?: string; owner?: string; reviewer?: string; evidence?: string[] } | null;
  /** Trạng thái: X · - · ✓. */
  status: "X" | "-" | "✓";
  /** Số dòng bundle host gốc (lib/index.js) — dùng để xếp thứ tự làm việc. */
  lines: number;
}

/**
 * Đếm số dòng bundle host của một package DSH đang cài.
 * @param dirName - tên thư mục trong @deepseek-ai.
 * @returns số dòng lib/index.js (0 nếu không có).
 */
function hostLines(dirName: string): number {
  const file = join(STOCK, dirName, "lib", "index.js");
  if (!existsSync(file)) return 0;
  return readFileSync(file, "utf8").split(NL).length;
}

/**
 * Chạy --dump-config và trả về văn bản cây entry đã hợp.
 * @returns văn bản dump (hoặc chuỗi rỗng khi lệnh hỏng).
 */
function dumpConfig(): string {
  const run = spawnSync(process.execPath, ["run", join(REPO, "apps", "cli", "src", "main.ts"), "host", "--dump-config"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return run.stdout ?? "";
}

/**
 * Tách các bộ ba (id, name, disabled) từ dump.
 * @param text - văn bản dump.
 * @returns danh sách entry ở thụt lề 0.
 */
function entries(text: string): { id: string; name: string; disabled: boolean }[] {
  const out: { id: string; name: string; disabled: boolean }[] = [];
  let current: { id: string; name: string; disabled: boolean } | null = null;
  for (const line of text.split(NL)) {
    if (line.startsWith("- id: ")) {
      if (current !== null) out.push(current);
      current = { id: line.slice(6).trim(), name: "", disabled: false };
      continue;
    }
    if (current === null) continue;
    const named = line.match(/^\s+name: '([^']+)'/);
    if (named) current.name = named[1] as string;
    if (/^\s+disabled: true/.test(line)) current.disabled = true;
  }
  if (current !== null) out.push(current);
  return out;
}

/**
 * Đọc mọi package của ta và dựng hai ánh xạ: alias DSH → tên GBH, và tập package GBH có test.
 * @returns ánh xạ alias và tập package có test.
 */
function ourPackages(): { alias: Map<string, string>; byRowId: Map<string, string>; tested: Set<string> } {
  const alias = new Map<string, string>();
  const explicit = new Map<string, string>();
  const byRowId = new Map<string, string>();
  const tested = new Set<string>();
  for (const tier of ["host", "client"]) {
    const dir = join(REPO, "packages", tier);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const pkgPath = join(dir, name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        name: string;
        gbh?: {
          row?: { id?: string; aliases?: string[]; tests?: string[] };
          provenance?: { stock?: string };
          nested?: { stockId?: string };
        };
      };
      for (const item of pkg.gbh?.row?.aliases ?? []) alias.set(item, pkg.name);
      // 19/10/2026 — `gbh.provenance.stock` + `gbh.nested.stockId` là KHAI BÁO TƯỜNG MINH gói gốc đã port.
      // Thiếu 2 nguồn này thì matrix báo 'X chưa chuyển' OAN cho gói đã port dưới tên khác (vd
      // `skill-filesystem` ↔ `dsh-skill-filesystem`) — đây là nguồn sự thật mạnh nhất, xét TRƯỚC alias.
      if (pkg.gbh?.provenance?.stock !== undefined) explicit.set(pkg.gbh.provenance.stock, pkg.name);
      if (pkg.gbh?.nested?.stockId !== undefined) explicit.set(pkg.gbh.nested.stockId, pkg.name);
      // Ánh xạ QUAN TRỌNG NHẤT với row host: row id của ta = row id trong snapshot DSH.
      if (pkg.gbh?.row?.id !== undefined) byRowId.set(pkg.gbh.row.id, pkg.name);
      const tests = pkg.gbh?.row?.tests ?? [];
      if (tests.some((file: string) => existsSync(join(REPO, file)))) tested.add(pkg.name);
    }
  }
  for (const [stock, ours] of explicit) if (!alias.has(stock)) alias.set(stock, ours);
  return { alias, byRowId, tested };
}

/**
 * Dựng tập tên package CỦA TA để đoán bản nháp theo quy ước tên (dsh-<x> → gbh-<x>).
 * Vì sao cần: gói nháp chưa khai gbh.row (đúng luật "khai cuối cùng") nên không có alias,
 * nhưng vẫn phải hiện là "đang chuyển" chứ không phải "chưa chuyển".
 * @returns tập tên package GBH đang có trong repo.
 */
/**
 * Ten package STOCK da bi REDIRECT luc chay boi co che `gbh.nested` (row LONG trong preset) — doc tu manifest
 * cua repo va CHI tinh khi goi cua ta da duoc stage vao profile (co `lib/index.js`), vi registry chi redirect
 * duoc khi goi nam trong `<profile>/node_modules/@galaxy-blackhole`.
 * @returns tap ten stock khong con chay luc chay (nen khong tinh la 'entry goc con dang chay').
 */
function nestedRedirected(): Set<string> {
  const out = new Set<string>();
  const profile = join(homedir(), ".galaxy", "blackhole", "profiles", "node_modules", "@galaxy-blackhole");
  for (const tier of ["host", "client"]) {
    const dir = join(REPO, "packages", tier);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const pkgPath = join(dir, name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string; gbh?: { nested?: unknown } };
      const nested = pkg.gbh?.nested as { kind?: string; stockId?: string } | undefined;
      // 19/10/2026: KHÔNG loại `kind:'group'` nữa — sau khi bỏ nhánh skip trong `readNestedRedirects()`, nhóm nằm
      // TRONG preset (vd `persistent-shell`, group `compaction`) cũng được registry thay tên lúc chạy (đã chứng
      // minh bằng 24 dòng log `redirect row long`); nhóm TOP-LEVEL thì patch thay trước nên tên stock cũng biến mất.
      if (nested?.stockId === undefined) continue;
      const staged = join(profile, pkg.name?.replace("@galaxy-blackhole/", "") ?? "", "lib", "index.js");
      if (!existsSync(staged)) continue;
      out.add(nested.stockId);
    }
  }
  return out;
}
function ourNames(): Set<string> {
  const out = new Set<string>();
  for (const tier of ["host", "client"]) {
    const dir = join(REPO, "packages", tier);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const pkgPath = join(dir, name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
      if (pkg.name !== undefined) out.add(pkg.name);
    }
  }
  return out;
}

/**
 * Đọc snapshot cây plugin DSH để biết row id ↔ package gốc (nguồn: contracts/data/dsh-packages.json).
 * @returns ánh xạ tên package gốc → danh sách row id.
 */
function stockRowIds(): Map<string, string[]> {
  const file = join(REPO, "docs", "contracts", "data", "dsh-packages.json");
  const out = new Map<string, string[]>();
  if (!existsSync(file)) return out;
  const json = JSON.parse(readFileSync(file, "utf8")) as { rows?: { id?: string; base?: string }[] };
  for (const row of json.rows ?? []) {
    if (row.base === undefined || row.id === undefined) continue;
    const list = out.get(row.base) ?? [];
    list.push(row.id);
    out.set(row.base, list);
  }
  return out;
}

/**
 * Nhóm một package theo tên (kernel/core/api/client-ui/tool/…).
 * @param name - tên package DSH.
 * @returns nhãn nhóm ngắn.
 */
function groupOf(name: string): string {
  const short = name.replace("@deepseek-ai/", "");
  const parts = short.split("-");
  const first = parts[0];
  const second = parts[1];
  if (first === "dsh" && second !== undefined) {
    if (second === "client" && parts[2] === "ui") return "client-ui";
    if (second === "client") return "client";
    return second;
  }
  if (first === "cordis" || first === "cosmokit") return "kernel";
  return first ?? "khác";
}

/**
 * Đọc tệp chữ ký.
 * @returns ánh xạ tên package DSH → ba chữ ký.
 */
function signoffs(): Record<string, { dev?: string; owner?: string; reviewer?: string; evidence?: string[] }> {
  if (!existsSync(SIGNOFF)) return {};
  const json = JSON.parse(readFileSync(SIGNOFF, "utf8")) as {
    packages?: Record<string, { dev?: string; owner?: string; reviewer?: string; evidence?: string[] }>;
  };
  return json.packages ?? {};
}

/**
 * Điểm vào: dựng bảng và (mặc định) ghi tài liệu.
 * @returns không — in tóm tắt ra stdout.
 */
function main(): void {
  const checkOnly = process.argv.includes("--check");
  const tree = entries(dumpConfig());
  // 19/10/2026: co che `gbh.nested` redirect row LONG luc chay (da chung minh bang log `redirect row long`):
  // entry stock do KHONG con chay ⇒ tru ra khoi tap active.
  const redirected = nestedRedirected();
  // 21/10/2026: dong nao dang chay BANG GOI CUA TA (che do patch `replaceInPlace`: giu id stock, doi `name`
  // sang @galaxy-blackhole/...) thi KHONG tinh la "entry goc con chay" — no da la goi ta.
  // 21/10/2026: che do patch `replaceInPlace` GIU id stock va chi doi `name` ⇒ `--dump-config` (offline) van in
  // ten STOCK cho row do, lam chi so "entry goc con chay" dem SAI. Doc thang patch dang song: row nao co
  // `name: '@galaxy-blackhole/...'` thi da la GOI TA, khong tinh la entry goc (so theo ID row, vi id row
  // khong trung ten goi stock).
  const replacedIds = new Set<string>();
  {
    const patchLines = readFileSync(join(homedir(), ".galaxy", "blackhole", "app.patch.yml"), "utf8").split(String.fromCharCode(10));
    for (let index = 0; index < patchLines.length; index += 1) {
      const match = /^- id: (\S+)$/u.exec(patchLines[index] ?? "");
      if (match === null) continue;
      const next = patchLines[index + 1] ?? "";
      if (next.trim().startsWith("name: '@galaxy-blackhole/")) replacedIds.add(String(match[1]));
    }
  }
  const activeNames = new Set(
    tree
      .filter((entry) => !entry.disabled && !redirected.has(entry.name))
      .filter((entry) => !entry.name.startsWith("@galaxy-blackhole/"))
      .filter((entry) => !replacedIds.has(entry.id))
      .map((entry) => entry.name),
  );
  const mounted = new Set(tree.filter((entry) => !entry.disabled && entry.name.startsWith("@galaxy-blackhole/")).map((entry) => entry.name));
  const { alias, byRowId, tested } = ourPackages();
  const names = ourNames();
  const rowIds = stockRowIds();
  const signed = signoffs();
  const rows: StockRow[] = [];
  for (const name of readdirSync(STOCK).sort()) {
    if (!name.startsWith("dsh-")) continue;
    const full = "@deepseek-ai/" + name;
    const pkgPath = join(STOCK, name, "package.json");
    if (!existsSync(pkgPath) || !statSync(pkgPath).isFile()) continue;
    let description = "";
    try {
      description = (JSON.parse(readFileSync(pkgPath, "utf8")) as { description?: string }).description ?? "";
    } catch {
      description = "";
    }
    // Ưu tiên ánh xạ theo ROW ID (đúng với cả row host): row id của ta trùng row id trong snapshot DSH.
    const rowCandidates = rowIds.get(full) ?? [];
    const byRow = rowCandidates.map((id) => byRowId.get(id)).find((name) => name !== undefined) ?? null;
    const byName = names.has("@galaxy-blackhole/" + name.replace("dsh-", "gbh-")) ? "@galaxy-blackhole/" + name.replace("dsh-", "gbh-") : null;
    // Sửa tay cho các gói DSH có TÊN GẦN GIỐNG nhưng KHÁC gói ta viết lại (đo 18/10/2026, reviewer phát hiện):
    //  - `dsh-llm-deepseek-api-key` (75 dòng) mới là thứ `gbh-llm-deepseek` viết lại; `dsh-llm-deepseek` là adapter 41 export — CHƯA chuyển.
    //  - `dsh-sandbox-local` (556 dòng) mới là thứ `gbh-sandbox` viết lại; `dsh-sandbox` là seam trừu tượng 289 dòng — CHƯA chuyển.
    // Gói CHỈ LÀ ARTEFACT (không port được mã nguồn): xem lý do từng gói trong ASSET_ONLY ở đầu tệp.
    const ASSET_ONLY = new Set<string>(["@deepseek-ai/dsh-web-frontend"]);
    const MANUAL: Record<string, string | null> = {
      "@deepseek-ai/dsh-llm-deepseek-api-key": "@galaxy-blackhole/gbh-llm-deepseek",
      "@deepseek-ai/dsh-llm-deepseek": null,
      "@deepseek-ai/dsh-sandbox": null,
      "@deepseek-ai/dsh-sandbox-local": "@galaxy-blackhole/gbh-sandbox",
      // 19/10/2026 — NGOẠI LỆ TÀI LIỆU HOÁ (Lead chốt): `dsh-web-frontend` KHÔNG phải mã nguồn mà là
      // **artefact vite build của web shell** (92 tệp dist/, exports './dist/*'), sinh ra từ chính các
      // gói client DSH mà ta đã port 1:1. Ta phục vụ shell bằng pipeline riêng (apps/web + row web của ta),
      // nên KHÔNG port lại artefact này — đánh dấu null để không bị tính là "X chưa chuyển".
      "@deepseek-ai/dsh-web-frontend": null,
    };
    // Dùng hasOwnProperty thay `in` để TypeScript không coi giá trị là `string | undefined`
    // (noUncheckedIndexedAccess): undefined = "không có override" ⇒ mới rơi về ánh xạ tự động.
    const manual: string | null | undefined = Object.prototype.hasOwnProperty.call(MANUAL, full) ? MANUAL[full] : undefined;
    const gbh: string | null = manual === undefined ? (byRow ?? alias.get(full) ?? byName ?? null) : manual;
    const sign = signed[full] ?? null;
    const signedAll = sign?.dev !== undefined && sign?.owner !== undefined && sign?.reviewer !== undefined;
    // 19/10/2026 — ASSET-ONLY: gói chỉ là ARTEFACT build (không có mã nguồn để port 1:1) ⇒ tính là ĐẠT
    // nhưng KHÔNG cần chữ ký 3 lớp (không có gì để ký). Bắt buộc phải có lý do trong bảng ASSET_ONLY.
    const assetOnly = ASSET_ONLY.has(full);
    const status: StockRow["status"] = assetOnly ? "✓" : signedAll ? "✓" : gbh === null ? "X" : "-";
    rows.push({
      name: full,
      group: groupOf(full),
      description: description.slice(0, 90),
      active: activeNames.has(full),
      gbh,
      mounted: gbh !== null && mounted.has(gbh),
      tested: gbh !== null && tested.has(gbh),
      signoff: sign,
      status,
      lines: hostLines(name),
    });
  }
  const total = rows.length;
  const done = rows.filter((row) => row.status === "✓").length;
  const doing = rows.filter((row) => row.status === "-").length;
  const todo = rows.filter((row) => row.status === "X").length;
  // ĐO TRUNG THỰC (sửa 19/10/2026): "entry gốc còn đang chạy" = row STOCK đang BẬT trong cây cấu hình SỐNG,
// KHÔNG phụ thuộc chữ ký. Bản cũ lọc thêm `status !== "✓"` nên KÝ một gói chưa mount (ví dụ plugin-market
// slice worker) đã làm số này tụt sai 2 đơn vị — chữ ký không tắt được mã gốc, chỉ MOUNT mới tắt.
const activeStock = rows.filter((row) => row.active).length;
  const groups = [...new Set(rows.map((row) => row.group))].sort();
  const lines: string[] = [];
  lines.push("<!--");
  lines.push(" author Bùi Trọng Hiếu");
  lines.push(" email kevinbui210191@gmail.com");
  lines.push(" create date 15/10/2026");
  lines.push(" modify date 18/10/2026");
  lines.push(" desc Bảng theo dõi chuyển đổi DSH → GBH: MỌI package DSH đang cài + cột convert. SINH TỰ ĐỘNG.");
  lines.push("-->");
  lines.push("");
  lines.push("# Ma trận chuyển đổi DSH → Galaxy Blackhole");
  lines.push("");
  lines.push("> **Sinh tự động — KHÔNG sửa tay.** Chạy lại: " + BT + "~/.bun/bin/bun run tools/check/conversion-matrix.ts" + BT + ".");
  lines.push("> Nguồn: cây entry " + BT + "host --dump-config" + BT + " · " + BT + "apps/host/node_modules/@deepseek-ai/*" + BT + " · " + BT + "gbh.row.aliases" + BT + " · " + BT + "docs/contracts/data/conversion-signoff.json" + BT + ".");
  lines.push("");
  lines.push("## 1. Quy ước cột và trạng thái");
  lines.push("");
  lines.push("| cột | nghĩa |");
  lines.push("|---|---|");
  lines.push("| **X** | **chưa chuyển** — chưa có package GBH thay thế (hoặc không ánh xạ được 1:1) |");
  lines.push("| **-** | **đang chuyển** — đã có package GBH nhưng CHƯA đủ 3 chữ ký |");
  lines.push("| **✓** | **đã chuyển thành công** — đủ 3 chữ ký: subagent phát triển · teammate phụ trách · teammate reviewer |");
  lines.push("| **mount** | package GBH đang chạy thật trong cây entry đã hợp |");
  lines.push("| **test** | package GBH có tệp test khai trong " + BT + "gbh.row.tests" + BT + " |");
  lines.push("| **ký** | ba ô theo thứ tự dev · owner · reviewer (" + BT + "·" + BT + " = chưa ký, " + BT + "✓" + BT + " = đã ký) |");
  lines.push("");
  lines.push("## 2. Tổng quan");
  lines.push("");
  lines.push("| hạng mục | số lượng |");
  lines.push("|---|---|");
  lines.push("| package DSH đang cài | **" + total + "** |");
  lines.push("| ✓ đã chuyển + đủ chữ ký | **" + done + "** |");
  lines.push("| - đang chuyển (có GBH, chờ ký) | **" + doing + "** |");
  lines.push("| X chưa chuyển | **" + todo + "** |");
  lines.push("| entry GỐC còn đang chạy (phải thay) | **" + activeStock + "** |");
  lines.push("");
  lines.push("## 3. Bảng theo nhóm");
  lines.push("");
  for (const group of groups) {
    const list = rows.filter((row) => row.group === group);
    lines.push("### " + group + " (" + list.length + ")");
    lines.push("");
    lines.push("| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |");
    lines.push("|---|---|---|---|---|---|---|---|");
    list.forEach((row, index) => {
      const sign = row.signoff === null
        ? "—"
        : ["dev", "owner", "reviewer"].map((role) => (row.signoff?.[role as "dev" | "owner" | "reviewer"] === undefined ? "·" : "✓")).join("");
      lines.push(
        "| " + (index + 1) + " | " + BT + row.name.replace("@deepseek-ai/", "") + BT + " | " + row.description.replace(/\|/g, "/") +
        " | " + (row.gbh === null ? "—" : BT + row.gbh.replace("@galaxy-blackhole/", "") + BT) +
        " | " + (row.mounted ? "C" : "—") + " | " + (row.tested ? "C" : "—") + " | " + sign + " | " + row.status + " |",
      );
    });
    lines.push("");
  }
  lines.push("## 4. Việc kế tiếp đề xuất (entry GỐC còn đang chạy)");
  lines.push("");
  lines.push("Xếp theo số dòng bundle host gốc tăng dần — làm gói nhỏ trước để lấy đà và giữ rủi ro thấp.");
  lines.push("");
  lines.push("| # | package gốc còn chạy | nhóm | dòng host | đã có GBH nháp |");
  lines.push("|---|---|---|---|---|");
  const pending = rows.filter((row) => row.active && row.status !== "✓").sort((a, b) => a.lines - b.lines);
  // 19/10/2026: in DS ten entry GOC con chay ra stdout khi dat `--list` (phuc vu dieu phoi, khong ghi tai lieu)
  // — de biet CHINH XAC con goi nao phai port thay vi suy tu ten (ten goi bundle khac ten row).
  if (process.argv.includes("--list")) {
    const activeRows = rows.filter((row) => row.active).sort((a, b) => a.lines - b.lines);
    for (const row of activeRows) console.log("ACTIVE " + row.name.replace("@deepseek-ai/", "") + " (" + row.lines + " dong, status " + row.status + ")");
  }
  pending.forEach((row, index) => {
    lines.push("| " + (index + 1) + " | " + BT + row.name.replace("@deepseek-ai/", "") + BT + " | " + row.group + " | " + (row.lines === 0 ? "—" : String(row.lines)) + " | " + (row.gbh === null ? "chưa" : BT + row.gbh.replace("@galaxy-blackhole/", "") + BT) + " |");
  });
  lines.push("");
  lines.push("## 5. Việc phải làm để đạt mục tiêu \"không còn DSH\"");
  lines.push("");
  lines.push("1. Mọi dòng **X** phải có package GBH (ánh xạ 1:1, đối chiếu source DSH) + test + mount.");
  lines.push("2. Mọi dòng **-** phải qua reviewer: chạy lại test, đối chiếu source, chạy lab/e2e, rồi ký.");
  lines.push("3. Chỉ khi đủ 3 chữ ký trong " + BT + "docs/contracts/data/conversion-signoff.json" + BT + " thì dòng đó mới thành **✓**.");
  lines.push("4. Icon/asset cũng phải chuyển: không còn tham chiếu SVG/bundle DSH trong UI của ta.");
  lines.push("");
  const text = lines.join(NL);
  if (checkOnly) {
    const old = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (old !== text) {
      console.log("LECH: tai lieu khong khop - chay lai khong co --check de ghi");
      process.exitCode = 1;
      return;
    }
    console.log("KHOP: tai lieu dung trang thai hien tai");
    return;
  }
  writeFileSync(OUT, text);
  console.log("DA GHI " + OUT);
  console.log("tong " + total + " · ✓ " + done + " · - " + doing + " · X " + todo + " · entry goc con chay " + activeStock);
}

main();

