/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Công cụ KÝ hoàn thành chuyển đổi DSH → GBH (chỉ Lead chạy): kiểm đủ 3 chữ ký + bằng chứng,
 *   ghi nguyên tử vào docs/contracts/data/conversion-signoff.json rồi sinh lại ma trận.
 *
 * LUẬT: một package chỉ được coi là "✓ đã chuyển" khi có ĐỦ ba chữ ký
 *   dev (subagent phát triển) · owner (teammate phụ trách) · reviewer (teammate reviewer),
 *   kèm ít nhất một bằng chứng đo được (test/lab/check:rows/dump).
 *
 * CÁCH DÙNG:
 *   ~/.bun/bin/bun run tools/check/signoff.ts --list
 *   ~/.bun/bin/bun run tools/check/signoff.ts --sign @deepseek-ai/dsh-client-ui-shortcuts \
 *     --gbh @galaxy-blackhole/gbh-client-ui-shortcuts \
 *     --dev "subagent:ui-shortcuts-dev" --owner tm-client-ui-a --reviewer tm-reviewer \
 *     --evidence "tests/client/ui-shortcuts.test.ts: 12 pass" \
 *     --evidence "lab:row ui-shortcuts: 0 console error, 0 did-not-activate"
 *   ~/.bun/bin/bun run tools/check/signoff.ts --unsign @deepseek-ai/dsh-client-ui-shortcuts
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Tệp chữ ký. */
const SIGNOFF = join(REPO, "docs", "contracts", "data", "conversion-signoff.json");
/** Cây package DSH đang cài. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");

/** Một bản ghi chữ ký. */
interface SignRecord {
  /** Tên package GBH thay thế. */
  gbh: string;
  /** Subagent phát triển (hoặc người viết code). */
  dev: string;
  /** Teammate phụ trách. */
  owner: string;
  /** Teammate reviewer độc lập. */
  reviewer: string;
  /** Bằng chứng đo được (test/lab/check:rows/dump). */
  evidence: string[];
  /** Ngày ký (yyyy-mm-dd). */
  signedAt: string;
  /** Ghi chú tuỳ chọn. */
  note?: string;
}

/** Toàn bộ tệp chữ ký. */
interface SignFile {
  /** Ghi chú đầu tệp. */
  "$comment": string;
  /** Ánh xạ tên package DSH → bản ghi chữ ký. */
  packages: Record<string, SignRecord>;
}

/**
 * Đọc tệp chữ ký; tạo khung mới khi chưa có.
 * @returns nội dung tệp đã chuẩn hoá.
 */
function readFile(): SignFile {
  if (!existsSync(SIGNOFF)) {
    return { "$comment": "Chữ ký hoàn thành chuyển đổi DSH → GBH (3 chữ ký + bằng chứng). Lead cập nhật.", packages: {} };
  }
  return JSON.parse(readFileSync(SIGNOFF, "utf8")) as SignFile;
}

/**
 * Ghi tệp chữ ký NGUYÊN TỬ (ghi tệp tạm rồi đổi tên) để không bao giờ để lại JSON hỏng.
 * @param data - nội dung cần ghi.
 */
function writeAtomic(data: SignFile): void {
  const tmp = SIGNOFF + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2) + String.fromCharCode(10));
  renameSync(tmp, SIGNOFF);
}

/**
 * Lấy giá trị của một cờ dạng --name value (hoặc undefined).
 * @param argv - process.argv.
 * @param name - tên cờ (kèm --).
 * @returns giá trị sau cờ, hoặc undefined.
 */
function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  if (at < 0) return undefined;
  return argv[at + 1];
}

/**
 * Lấy TẤT CẢ giá trị của một cờ lặp lại (--evidence nhiều lần).
 * @param argv - process.argv.
 * @param name - tên cờ.
 * @returns mảng giá trị.
 */
function flags(argv: readonly string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name && argv[i + 1] !== undefined) out.push(argv[i + 1] as string);
  }
  return out;
}

/**
 * Tìm tệp test của một package GBH theo BA nguồn, đúng thứ tự ưu tiên:
 * 1) `gbh.row.tests` (gói CÓ thay row) · 2) `gbh.tests` (gói thư viện/nửa host không mount)
 * 3) đường dẫn quy ước `tests/<tier>/<thư mục gói>.test.ts`.
 * Vì sao cần fallback: gói KHÔNG khai `gbh.row` (thư viện, hoặc nửa host của gói hai mặt) vẫn
 * phải ký được — trước đây `declaredTest` chỉ đọc `gbh.row.tests` nên từ chối oan (báo cáo reviewer 18/10).
 * @param gbhName - tên package GBH.
 * @returns tệp test đầu tiên tồn tại, hoặc null.
 */
function declaredTest(gbhName: string): string | null {
  for (const tier of ["host", "client"]) {
    const dir = join(REPO, "packages", tier);
    if (!existsSync(dir)) continue;
    for (const name of require("node:fs").readdirSync(dir) as string[]) {
      const pkgPath = join(dir, name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        name?: string;
        gbh?: { row?: { tests?: string[] }; tests?: string[] };
      };
      if (pkg.name !== gbhName) continue;
      const declared = [...(pkg.gbh?.row?.tests ?? []), ...(pkg.gbh?.tests ?? [])];
      for (const file of declared) if (existsSync(join(REPO, file))) return file;
      const conventional = join("tests", tier, name + ".test.ts");
      if (existsSync(join(REPO, conventional))) return conventional;
      return null;
    }
  }
  return null;
}

/**
 * Sinh lại ma trận sau khi ký/bỏ ký (một lệnh, để tài liệu không bao giờ lệch chữ ký).
 */
function regenerateMatrix(): void {
  const run = spawnSync(process.execPath, ["run", join(REPO, "tools", "check", "conversion-matrix.ts")], {
    cwd: REPO,
    encoding: "utf8",
  });
  const line = (run.stdout ?? "").trim().split(String.fromCharCode(10)).filter((item) => item.startsWith("tong ")).pop();
  console.log(line ?? "(ma tran da sinh lai)");
}

/**
 * Điểm vào: --list · --sign · --unsign.
 * @returns không — in kết quả ra stdout; đặt process.exitCode khi lỗi.
 */
function main(): void {
  const argv = process.argv;
  const data = readFile();
  if (argv.includes("--list")) {
    const entries = Object.entries(data.packages);
    if (entries.length === 0) {
      console.log("Chua co chu ky nao. Dung --sign de ky.");
      return;
    }
    for (const [dsh, record] of entries) {
      console.log(dsh + " -> " + record.gbh + " | dev=" + record.dev + " owner=" + record.owner + " reviewer=" + record.reviewer + " | " + record.signedAt);
      for (const item of record.evidence) console.log("   evidence: " + item);
    }
    return;
  }
  if (argv.includes("--unsign")) {
    const dsh = flag(argv, "--unsign");
    if (dsh === undefined || data.packages[dsh] === undefined) {
      console.log("KHONG THAY chu ky cho: " + String(dsh));
      process.exitCode = 1;
      return;
    }
    delete data.packages[dsh];
    writeAtomic(data);
    console.log("DA BO KY " + dsh);
    regenerateMatrix();
    return;
  }
  if (!argv.includes("--sign") && !argv.includes("--batch")) {
    console.log("Thieu lenh. Dung --list | --sign | --batch <tep.json> | --unsign (xem header tep).");
    process.exitCode = 1;
    return;
  }
  if (argv.includes("--batch")) {
    const batchPath = flag(argv, "--batch");
    if (batchPath === undefined || !existsSync(batchPath)) {
      console.log("KHONG THAY tep batch: " + String(batchPath));
      process.exitCode = 1;
      return;
    }
    const batch = JSON.parse(readFileSync(batchPath, "utf8")) as {
      dev: string;
      owner: string;
      evidence: string[];
      packages: { dsh: string; gbh: string }[];
    };
    // Chuan hoa ten GBH: nguoi viet batch hay ghi thieu scope ("gbh-client-ui-goal").
    for (const item of batch.packages) {
      if (!item.gbh.startsWith("@")) item.gbh = "@galaxy-blackhole/" + item.gbh;
      if (!item.dsh.startsWith("@") && !item.dsh.startsWith("extra:")) item.dsh = "@deepseek-ai/" + item.dsh;
    }
    const bad: string[] = [];
    for (const item of batch.packages) {
      // Khoá "extra:<tên>" dùng cho gói MỚI CỦA TA không có package DSH gốc tương ứng
      // (ví dụ ui-brand, shell-identity). Chúng không nằm trong ma trận DSH nhưng vẫn cần chữ ký.
      const isExtra = item.dsh.startsWith("extra:");
      if (!isExtra && !existsSync(join(STOCK, (item.dsh.split("@deepseek-ai/")[1] ?? "")))) bad.push("khong co package DSH: " + item.dsh);
      if (declaredTest(item.gbh) === null) bad.push("khong co test khai bao: " + item.gbh);
    }
    if (bad.length > 0) {
      console.log("KHONG KY LO NAY — " + bad.length + " loi:");
      for (const item of bad.slice(0, 12)) console.log("  - " + item);
      process.exitCode = 1;
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    for (const item of batch.packages) {
      data.packages[item.dsh] = { gbh: item.gbh, dev: batch.dev, owner: batch.owner, reviewer: "tm-reviewer", evidence: batch.evidence, signedAt: day };
    }
    writeAtomic(data);
    console.log("DA KY LO " + batch.packages.length + " goi (" + day + ")");
    regenerateMatrix();
    return;
  }
  const dsh = flag(argv, "--sign");
  const gbh = flag(argv, "--gbh");
  const dev = flag(argv, "--dev");
  const owner = flag(argv, "--owner");
  const reviewer = flag(argv, "--reviewer");
  const evidence = flags(argv, "--evidence");
  const note = flag(argv, "--note");
  const problems: string[] = [];
  if (dsh === undefined || !existsSync(join(STOCK, (dsh.split("/")[1] ?? "")))) problems.push("package DSH khong ton tai trong cay cai: " + String(dsh));
  if (gbh === undefined) problems.push("thieu --gbh");
  if (dev === undefined || dev.trim() === "") problems.push("thieu --dev (subagent phat trien)");
  if (owner === undefined || owner.trim() === "") problems.push("thieu --owner (teammate phu trach)");
  if (reviewer === undefined || reviewer.trim() === "") problems.push("thieu --reviewer (teammate reviewer doc lap)");
  if (evidence.length === 0) problems.push("thieu --evidence (can it nhat 1 bang chung do duoc)");
  if (dev !== undefined && reviewer !== undefined && dev.trim() === reviewer.trim()) problems.push("dev va reviewer KHONG duoc la cung mot nguoi");
  if (gbh !== undefined && declaredTest(gbh) === null) problems.push("package GBH chua khai gbh.row.tests hoac tep test khong ton tai: " + gbh);
  if (problems.length > 0) {
    console.log("KHONG KY DUOC — thieu dieu kien:");
    for (const item of problems) console.log("  - " + item);
    process.exitCode = 1;
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  data.packages[dsh as string] = {
    gbh: gbh as string,
    dev: dev as string,
    owner: owner as string,
    reviewer: reviewer as string,
    evidence,
    signedAt: today,
    ...(note === undefined ? {} : { note }),
  };
  writeAtomic(data);
  console.log("DA KY " + String(dsh) + " -> " + String(gbh) + " (" + today + ")");
  console.log("test khai bao: " + String(declaredTest(gbh as string)));
  regenerateMatrix();
}

main();

