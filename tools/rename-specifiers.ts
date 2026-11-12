/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 02/11/2026
 * desc Đổi tên specifier DSH sang GBH cho MỘT gói (hoặc danh sách gói): src/** + package.json
 *      (deps/peers/devDeps) + kỳ vọng trong test của chính gói đó. KHÔNG đụng gbh.provenance.stock
 *      (đó là vết kiểm toán, phải giữ tên gốc) và KHÔNG đụng đường dẫn oracle trong tests.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..");

/**
 * Dựng bản đồ tên stock sang tên gói GBH từ `gbh.provenance.stock` của mọi package.
 * Nhận: không. Trả: bản đồ (chỉ gồm cặp có thật).
 */
export function stockToGbhMap(): Record<string, string> {
  const ra: Record<string, string> = {};
  for (const tier of ["host", "client", "tools"]) {
    const dir = join(REPO, "packages", tier);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name, "package.json");
      if (!existsSync(p)) continue;
      const j = JSON.parse(readFileSync(p, "utf8")) as { name?: string; gbh?: { provenance?: { stock?: unknown } } };
      const stock = j.gbh?.provenance?.stock;
      if (typeof stock === "string" && typeof j.name === "string") ra[stock] = j.name;
    }
  }
  return ra;
}

/**
 * Đổi mọi chuỗi `"@deepseek-ai/x"` thành tên gói GBH tương ứng trong một văn bản.
 * Nhận: text — nội dung tệp; banDo — bản đồ stock sang GBH. Trả: văn bản đã đổi.
 */
export function renameSpecifiers(text: string, banDo: Record<string, string>): { text: string; replaced: number } {
  let replaced = 0;
  const out = text.replace(/"(@deepseek-ai\/[a-z0-9./-]+)"/gu, (whole, spec: string) => {
    const ours = banDo[spec];
    if (ours === undefined) return whole;
    replaced += 1;
    return '"' + ours + '"';
  });
  return { text: out, replaced };
}

/**
 * Liệt kê mọi tệp .ts/.tsx trong một cây (bỏ node_modules).
 * Nhận: dir — thư mục gốc. Trả: mảng đường dẫn tuyệt đối.
 */
function listSources(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...listSources(abs));
    else if (/\.tsx?$/u.test(name)) out.push(abs);
  }
  return out;
}

/**
 * Đổi tên specifier cho một gói: src/**, package.json (deps/peers/devDeps) và test của chính gói.
 * Nhận: pkgDir — thư mục gói (tuyệt đối hoặc tương đối repo); banDo — bản đồ stock sang GBH.
 * Trả: số tệp đã sửa và số lần thay.
 */
export function renamePackage(pkgDir: string, banDo: Record<string, string>): { files: number; replaced: number } {
  const dir = pkgDir.startsWith("/") ? pkgDir : join(REPO, pkgDir);
  let files = 0;
  let replaced = 0;
  for (const file of listSources(join(dir, "src"))) {
    const t = readFileSync(file, "utf8");
    const r = renameSpecifiers(t, banDo);
    if (r.replaced === 0) continue;
    writeFileSync(file, r.text, "utf8");
    files += 1;
    replaced += r.replaced;
  }
  const pkgJsonPath = join(dir, "package.json");
  if (existsSync(pkgJsonPath)) {
    const j = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as Record<string, unknown>;
    let localReplaced = 0;
    for (const field of ["dependencies", "peerDependencies", "devDependencies"]) {
      const table = j[field] as Record<string, string> | undefined;
      if (table === undefined) continue;
      for (const key of Object.keys(table)) {
        const ours = banDo[key];
        if (ours === undefined) continue;
        const value = table[key] ?? "";
        delete table[key];
        table[ours] = value;
        localReplaced += 1;
      }
    }
    // `gbh.peers` là danh sách peer CHỌN LỌC của gói ⇒ đổi theo; còn `gbh.row.aliases` và
    // `gbh.provenance.stock` PHẢI giữ tên gốc (vết kiểm toán + bảng id của loader).
    const gbh = j.gbh as { peers?: unknown } | undefined;
    if (Array.isArray(gbh?.peers)) {
      gbh.peers = gbh.peers.map((peer: unknown) => (typeof peer === "string" ? (banDo[peer] ?? peer) : peer));
      localReplaced += 1;
    }
    if (localReplaced > 0) {
      writeFileSync(pkgJsonPath, JSON.stringify(j, null, 2) + "\n", "utf8");
      files += 1;
      replaced += localReplaced;
    }
  }
  // Kỳ vọng trong CHÍNH test của gói: đổi tên stock sang GBH, TRỪ các dòng trỏ oracle kernel
  // (`apps/host/node_modules/...` phải giữ tên stock để so với bản gốc).
  const testsDir = join(REPO, "tests");
  const testFiles: string[] = [];
  if (existsSync(testsDir)) {
    const walkTests = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const abs = join(dir, name);
        if (statSync(abs).isDirectory()) walkTests(abs);
        else if (/\.test\.tsx?$/u.test(name)) testFiles.push(abs);
      }
    };
    walkTests(testsDir);
  }
  // `gbh.tests` là danh sách CHÍNH XÁC các tệp test của gói ⇒ dùng nó thay vì đoán theo tên.
  const manifestJson = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { gbh?: { tests?: unknown } };
  const declared = Array.isArray(manifestJson.gbh?.tests) ? (manifestJson.gbh?.tests as unknown[]).filter((x): x is string => typeof x === "string") : [];
  // Gói không khai `gbh.tests`: đoán theo tên thư mục gói (vd `timer` ⇒ `tests/**/timer.test.ts`).
  const dirName = dir.split("/").pop() ?? "";
  for (const testFile of testFiles) {
    const rel = testFile.slice(REPO.length + 1);
    const byDeclared = declared.includes(rel);
    const bySlug = declared.length === 0 && rel.endsWith("/" + dirName + ".test.ts");
    if (!byDeclared && !bySlug) continue;
    const t = readFileSync(testFile, "utf8");
    const lines = t.split("\n");
    let localReplaced = 0;
    const out = lines.map((line) => {
      if (line.includes("apps/host/node_modules")) return line;
      const r = renameSpecifiers(line, banDo);
      localReplaced += r.replaced;
      return r.text;
    });
    if (localReplaced === 0) continue;
    writeFileSync(testFile, out.join("\n"), "utf8");
    files += 1;
    replaced += localReplaced;
  }
  return { files, replaced };
}

/**
 * Điểm vào CLI: `bun run tools/rename-specifiers.ts <gói> [<gói>...]`.
 * Nhận: argv là danh sách thư mục gói tương đối repo. Trả: không (in tổng kết).
 */
function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("dung: bun run tools/rename-specifiers.ts packages/host/<goi> [...]");
    return;
  }
  const banDo = stockToGbhMap();
  let files = 0;
  let replaced = 0;
  for (const dir of args) {
    const r = renamePackage(dir, banDo);
    files += r.files;
    replaced += r.replaced;
    console.log(dir + ": " + r.files + " tệp · " + r.replaced + " lần");
  }
  console.log("TONG: " + files + " tệp · " + replaced + " lần thay");
}

if (import.meta.main) main();
