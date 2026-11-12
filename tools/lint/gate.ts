/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cong tong: chay header + do dai + JSDoc + dep-guard + parity-matrix + typecheck, tra exit code != 0 khi do
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runHeaderCheck } from "./header.ts";
import { runFileLengthCheck } from "./file-length.ts";
import { runExportsTargetsCheck } from "./exports-targets.ts";
import { runJsdocCheck } from "./jsdoc.ts";
import { runDepGuardCheck } from "./dep-guard.ts";
import { runHygieneCheck } from "./hygiene.ts";
import { runParityMatrixCheck } from "./parity-matrix.ts";
import {
  createResult,
  exitCodeFor,
  findNodeRuntime,
  isDirectRun,
  partitionFiles,
  printResult,
  REPO_ROOT,
  toRel,
  walkRepo,
  type CheckResult,
} from "./shared.ts";

/** Thứ tự chạy mặc định của các cổng. */
export const GATE_ORDER = ["header", "file-length", "jsdoc", "exports-targets", "dep-guard", "parity-matrix", "typecheck"];

/** Cờ compiler phản chiếu đúng tsconfig.base.json (truyền tay vì chạy tsc theo danh sách file). */
const TSC_BUILD_INFO = join(REPO_ROOT, "node_modules", ".cache", "gbh-typecheck.tsbuildinfo");
const TSC_FLAGS = [
  "--noEmit",
  "--strict",
  "--target",
  "ES2023",
  "--module",
  "ESNext",
  "--moduleResolution",
  "bundler",
  "--allowImportingTsExtensions",
  "--verbatimModuleSyntax",
  "--noUncheckedIndexedAccess",
  "--noImplicitOverride",
  "--noFallthroughCasesInSwitch",
  "--skipLibCheck",
  "--jsx",
  "react-jsx",
];

/** Thời gian tối đa cho một lần typecheck (ms). */
// 01/11/2026: 180s khong du cho 2632 file (do that: tsc vuot han 2/2 luot, gate in SKIP roi VAN bao
// XANH - tuc la xanh gia). Nang han timeout de typecheck that su chay het.
const TSC_TIMEOUT_MS = 900_000;

/**
 * Mảnh de-bundle CỦA MỘT GÓI, theo HAI quy ước đặt tên đang dùng trong repo:
 * (1) `src/parts/part-NN-*.ts` — 15 gói de-bundle theo lối chia `parts`;
 * (2) `src/<tên>-slice[-N].ts` — lát nguyên văn của manifest typert (vd `packages/host/subagent/src/typert-host-slice-b.ts`);
 * (3) `src/parts-<nhóm>/…` — lát tách theo NHÓM artefact của gói nhiều artefact (vd
 *     `packages/host/api-session-controller/src/parts-host/…`, `src/parts-typert-host/…`) — 19/10/2026.
 * (4) `src/client-parts/…` — lát NGUYÊN VĂN của nửa client, sinh bằng script rồi nối lại trong `build.ts`
 *     (vd `packages/client/ui-jobs/src/client-parts/part-00-client.ts`) — 20/10/2026. Cùng bản chất mục (1):
 *     lát cắt ngang cú pháp, `@ts-nocheck` không tắt được lỗi cắt ngang, và luôn có cổng byte chứng minh.
 */
const FRAGMENT_PATH = /\/(?:src\/parts\/[^/]+|src\/parts-[a-z0-9-]+\/[^/]+|src\/client-parts\/[^/]+|src\/[^/]+-slice(?:-[a-z0-9]+)?)\.tsx?$/;

/**
 * Có phải MẢNH DE-BUNDLE của một gói de-bundle hay không. Mảnh là lát NGUYÊN VĂN của bundle gốc, sinh tự động
 * và **KHÔNG phải module**: chúng bị `build.ts` nối lại rồi so BYTE với bundle gốc nên không bao giờ được
 * import trực tiếp. Đưa chúng vào chương trình `tsc` là sai bản chất — lát cắt ngang ranh giới cú pháp sinh
 * TS1005/TS1128/TS1434, mà `// @ts-nocheck` KHÔNG tắt được (nó chỉ tắt lỗi NGỮ NGHĨA). Chỉ miễn khi gói có
 * pipeline artifact thật (`build.ts`), tức bằng chứng thay thế tồn tại. Lý do đầy đủ: ADR 0008.
 * Nhận: đường dẫn TUYỆT ĐỐI của một file TS/TSX.
 * Trả: true khi file là mảnh de-bundle của gói có `build.ts`.
 */
function isGeneratedFragment(abs: string): boolean {
  if (!FRAGMENT_PATH.test(abs)) return false;
  // Thư mục GÓI = phần trước "/src/" (dùng chung cho cả hai quy ước mảnh).
  const srcIndex = abs.indexOf("/src/");
  if (srcIndex < 0) return false;
  const packageDir = abs.slice(0, srcIndex);
  return existsSync(join(packageDir, "build.ts"));
}

/**
 * Chuẩn hoá đường dẫn tuyệt đối của repo khi tiền tố REPO_ROOT bị ghép HAI lần.
 * Vì sao (02/11/2026): 322 tệp `src/parts/*.ts` bị nhân đôi tiền tố ⇒ `isGeneratedFragment` trượt
 * ⇒ lát de-bundle lọt vào typecheck ⇒ 6.057 vi phạm GIẢ. Hàm này gỡ phần lặp để mọi phép so khớp đúng.
 * Nhận: abs — đường dẫn tuyệt đối (có thể lặp tiền tố). Trả: đường dẫn đã gỡ lặp.
 */
function normalizeRepoPath(abs: string): string {
  const last = abs.lastIndexOf(REPO_ROOT);
  return last > 0 ? abs.slice(last) : abs;
}

/**
 * Gom danh sách file TS/TSX cần typecheck (đã trừ file miễn trừ và mảnh de-bundle).
 * Nhận: không.
 * Trả: mảng đường dẫn tuyệt đối.
 */
export function typecheckFiles(): string[] {
  return partitionFiles(walkRepo(), true)
    .checked.filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => !isGeneratedFragment(normalizeRepoPath(f)))
    // 08/11/2026 — LOẠI "BẢN VIẾT TAY CŨ" khỏi phạm vi typecheck: vài gói giữ `src-handwritten/` để đối
    // chiếu lịch sử (vd api-job-controller), nhưng nó KHAI LẠI cùng tên thuộc tính trên Context với `src/`
    // ⇒ tsc báo TS2717 "Subsequent property declarations must have the same type" dù cả hai đều đúng.
    // Đây KHÔNG phải mã đang chạy (build chỉ dùng `src/`) nên loại khỏi phạm vi kiểm là đúng bản chất.
    .filter((f) => !normalizeRepoPath(f).includes("/src-handwritten/"));
}

/**
 * Chạy tsc --noEmit trên toàn bộ file TS/TSX của workspace.
 * Nhận: không.
 * Trả: CheckResult; nếu thiếu typescript hoặc không có runtime Node >= 26 thì ghi chú SKIP và không đỏ cổng.
 */
export function runTypecheck(): CheckResult {
  const t0 = Date.now();
  const res = createResult("typecheck");
  const tsc = join(REPO_ROOT, "node_modules", "typescript", "lib", "tsc.js");
  const files = typecheckFiles();
  res.checked = files.length;
  if (!existsSync(tsc)) {
    res.notes.push("SKIP typecheck: chưa có node_modules/typescript (chạy bun install ở root khi được phép).");
    res.ms = Date.now() - t0;
    return res;
  }
  if (files.length === 0) {
    res.notes.push("SKIP typecheck: chưa có file .ts nào.");
    res.ms = Date.now() - t0;
    return res;
  }
  const node = findNodeRuntime();
  const bun = process.versions.bun !== undefined ? process.execPath : null;
  const runtime = node?.path ?? bun;
  if (!runtime) {
    res.notes.push("SKIP typecheck: không tìm thấy Node >= 26 (đặt GBH_NODE) và tiến trình này không phải bun.");
    res.ms = Date.now() - t0;
    return res;
  }
  // incremental: lan dau cham, cac lan sau nhanh (truoc day tsc 2632 file vuot ca 900s khi may ban).
  const flags: string[] = [];
  if (existsSync(join(REPO_ROOT, "node_modules", "@types", "bun"))) flags.push("--types", "bun");
  // 05/11/2026 (P1b): chạy tsc qua tsconfig SINH TẠM để đặt được `paths` — ép MỘT đường dẫn duy nhất
  // cho mỗi specifier. Không có bước này, cùng một `.d.ts` được nạp từ `node_modules/.bun/…` và từ
  // `packages/…` ⇒ TS coi là HAI kiểu khác nhau (`Session | Session`) dù nội dung y hệt.
  const sinhTsconfig = (extraFlags: string[]): string => {
    const duong = join(REPO_ROOT, "node_modules", ".cache", "gbh-typecheck.tsconfig.json");
    mkdirSync(dirname(duong), { recursive: true });
    const compilerOptions: Record<string, unknown> = {
      noEmit: true,
      strict: true,
      target: "ES2023",
      module: "ESNext",
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      verbatimModuleSyntax: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      skipLibCheck: true,
      jsx: "react-jsx",
      incremental: true,
      tsBuildInfoFile: TSC_BUILD_INFO,
      paths: {
        "@deepseek-ai/*": ["./apps/host/node_modules/@deepseek-ai/*"],
        // 05/11/2026 (P1b, ADR-0030): kernel PHAI la MOT the hien duy nhat — neu khong, moi
        // `declare module "@deepseek-ai/cordis"` trong .d.ts cua ta khong ap vao `Context` ma cac goi dang dung.
        "@galaxy-blackhole/gbh-cordis": ["./apps/host/node_modules/@deepseek-ai/cordis"],
        "@galaxy-blackhole/gbh-schemastery": ["./apps/host/node_modules/@deepseek-ai/schemastery"],
        "@galaxy-blackhole/gbh-cosmokit": ["./apps/host/node_modules/@deepseek-ai/cosmokit"],
      },
    };
    if (existsSync(join(REPO_ROOT, "node_modules", "@types", "bun"))) compilerOptions.types = ["bun"];
    void extraFlags;
    writeFileSync(duong, JSON.stringify({ compilerOptions, files }, null, 2), "utf8");
    return duong;
  };
  const run = (extraFlags: string[]): ReturnType<typeof spawnSync> =>
    spawnSync(runtime, [tsc, "-p", sinhTsconfig(extraFlags)], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: TSC_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
      // 01/11/2026: tsc 2632 file tung chet vi het RAM (<--- Last few GCs --->, exit null) va gate VAN
      // bao XANH. Nang tran heap cho tien trinh con de typecheck chay that.
      env: { ...process.env, NODE_OPTIONS: ((process.env.NODE_OPTIONS ?? "") + " --max-old-space-size=8192").trim() },
    });
  // spawnSync có thể trả Buffer nếu không đọc được encoding: chuẩn hoá về chuỗi trước khi ghép.
  const asText = (value: unknown): string => (typeof value === "string" ? value : "");
  let out = run(flags);
  const text1 = asText(out.stdout) + asText(out.stderr);
  if (out.status !== 0 && /Cannot find type definition file for 'bun'/.test(text1)) {
    out = run(flags.filter((f) => f !== "--types" && f !== "bun"));
  }
  const text = (asText(out.stdout) + asText(out.stderr)).trim();
  // tsc chet giua duong (het RAM/timeout) tra status null va khong co dong loi nhan dang duoc:
  // truoc day gate van coi la XANH. Nay la DO va noi ro ly do.
  if (out.status === null && out.error === undefined && !/error TS\d+/u.test(text)) {
    res.violations.push({ file: "tools/lint/gate.ts", line: 0, message: "tsc ket thuc KHONG co ma thoat (het RAM hoac bi kill): " + text.slice(-160) });
    res.ms = Date.now() - t0;
    return res;
  }
  if (out.error) {
    // 01/11/2026: tsc timeout/ENOBUFS truoc day van duoc coi la XANH (xanh gia). Nay la DO, neu ro.
    res.violations.push({ file: "tools/lint/gate.ts", line: 0, message: "typecheck KHONG xac nhan duoc: tsc loi (" + String(out.error.message) + ")." });
    res.ms = Date.now() - t0;
    return res;
  }
  res.notes.push("typecheck bằng " + (node ? "node " + node.version : "bun") + " · tsc " + toRel(tsc));
  for (const line of text.split("\n")) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/);
    if (!m) continue;
    res.violations.push({ file: toRel((m[1] ?? "").trim()), line: Number(m[2] ?? 0), message: (m[4] ?? "") + " " + (m[5] ?? "") });
  }
  if (res.violations.length === 0 && out.status !== 0 && text !== "") {
    res.notes.push("tsc thoát mã " + String(out.status) + " nhưng không có dòng lỗi nhận dạng được: " + text.split("\n")[0]);
  }
  res.ms = Date.now() - t0;
  return res;
}

/**
 * Chạy các cổng kiểm tra của repo.
 * Nhận: danh sách tên cổng cần chạy (rỗng = tất cả theo GATE_ORDER).
 * Trả: mảng CheckResult theo đúng thứ tự đã chạy.
 */
export function runGate(only: string[] = []): CheckResult[] {
  const wanted = (name: string): boolean => only.length === 0 || only.includes(name);
  const results: CheckResult[] = [];
  if (wanted("header")) results.push(runHeaderCheck());
  if (wanted("file-length")) results.push(runFileLengthCheck());
  if (wanted("jsdoc")) results.push(runJsdocCheck());
  if (wanted("exports-targets")) results.push(runExportsTargetsCheck());
  if (wanted("dep-guard")) results.push(runDepGuardCheck());
  if (wanted("parity-matrix")) results.push(runParityMatrixCheck(true));
  if (wanted("typecheck")) results.push(runTypecheck());
  // Cong ve sinh: package nao DA KHAI gbh.row (tuc da mount that) thi phai (a) co test [G4],
  // (b) co mat trong packages/README.md §4. Package dang viet do KHONG khai gbh.row nen khong bat oan.
  if (wanted("hygiene") || wanted("docs")) results.push(runHygieneCheck(REPO_ROOT));
  return results;
}

/**
 * Dem so tep nguon vua bi ghi trong N giay gan nhat (bo qua `lib/`, `node_modules/`, `.bak`).
 * Nhan: `withinMs` — cua so thoi gian tinh bang mili giay.
 * Tra: so tep dang duoc ghi dong thoi (0 = khong co ai ghi).
 */
function countRecentWrites(withinMs: number): number {
  const since = Date.now() - withinMs;
  let n = 0;
  const roots = [join(REPO_ROOT, "packages"), join(REPO_ROOT, "tests")];
  const walk = (dir: string): void => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (name === "node_modules" || name === "lib" || name.endsWith(".bak")) continue;
      const full = join(dir, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) walk(full);
        else if (st.mtimeMs >= since) n += 1;
      } catch { /* bo qua tep bien mat giua chung */ }
    }
  };
  for (const root of roots) walk(root);
  return n;
}

/**
 * Chạy thêm bun test nếu được yêu cầu tường minh (mặc định không chạy để cổng lint không phụ thuộc test của tầng khác).
 * Nhận: không.
 * Trả: CheckResult với vi phạm là các test đỏ.
 */
export function runTests(): CheckResult {
  const t0 = Date.now();
  const res = createResult("test");
  const dir = join(REPO_ROOT, "tests");
  if (!existsSync(dir)) {
    res.notes.push("SKIP test: chưa có thư mục tests/.");
    res.ms = Date.now() - t0;
    return res;
  }
  // ⚠️ 18/10/2026: cong `test` chay 94-112 giay. Neu mot cong nhan dang ghi file trong khoang do thi
  //   mot file do co the bi nap giua chung => `bun test` do GIA. Da xay ra HAI lan trong ngay
  //   (`bun test` chay tay ngay sau do: 1107 pass / 0 fail va 1205 pass / 0 fail).
  //   => khong sua `bun test`, nhung DANH NHAN ket qua la KHONG DANG TIN de nguoi sau khong duoi do ma.
  const writersBefore = countRecentWrites(120_000);
  const bun = process.versions.bun !== undefined ? process.execPath : "bun";
  // 22/10/2026: bộ test đã lớn (5.332 ca / 332 tệp, ~8 phút) nên hạn 300s của spawnSync CẮT NGANG
  //   giữa lượt chạy và cổng báo đỏ GIẢ. Đây là hạn chờ tiến trình, KHÔNG phải ngưỡng chất lượng.
  // 06/11/2026: `--max-concurrency=2` — KHÔNG phải nới ngưỡng, mà là giảm TRANH CHẤP TÀI NGUYÊN.
  //   Hai tệp nặng IO (`rewrite-metadata` quét + build lại mọi gói; `boot.test.ts` boot host thật, mount
  //   lại profile) chạy song song với 300 tệp khác thì tự phá trạng thái mà chúng đang đo ⇒ đỏ GIẢ.
  //   Đo 06/11/2026: song song mặc định 2 ca đỏ; `--max-concurrency=2` 0 ca đỏ, thời gian 4m07 vs 5m. 
  // 08/11/2026 — SỰ CỐ THẬT: cổng chạy `bun test` KHÔNG có `--timeout` ⇒ hạn mặc định 20s/ca, trong khi lệnh
  //   chạy tay chuẩn của repo là `bun test --timeout 60000`. Dưới `--max-concurrency=2`, ca nặng (mount host
  //   thật: typert-loader) vượt 20s ⇒ cổng ĐỎ GIẢ trong khi chạy riêng 1,9s. Nay truyền đúng hạn 60s như tài liệu.
  const out = spawnSync(bun, ["test", "--max-concurrency=2", "--timeout", "60000"], { cwd: REPO_ROOT, encoding: "utf8", timeout: 1_800_000, maxBuffer: 32 * 1024 * 1024 });
  res.checked = 1;
  res.notes.push("bun test thoát mã " + String(out.status));
  if (out.status !== 0 && writersBefore > 0) {
    res.notes.push(
      "⚠️ KHONG DANG TIN: co " + String(writersBefore) + " tep nguon vua bi ghi trong 120s truoc khi chay — " +
        "do do co the do GIA (mot file do bi nap giua chung). Chay lai khi khong con ai ghi.",
    );
  }
  // 08/11/2026 — SỰ CỐ THẬT: bộ test lớn dần (5.414 ca / 352 tệp) nên lượt chạy vượt hạn 900s và bị CẮT,
  //   spawnSync trả status = null ⇒ cổng báo "test đỏ" trong khi KHÔNG có ca nào sai. Phải phân biệt
  //   "bị cắt vì quá hạn chờ" với "test sai" (chất lượng), nếu không người sau đi tìm lỗi ở chỗ không có.
  const biCat = out.status === null;
  if (biCat) {
    res.violations.push({
      file: "tests/",
      line: 0,
      message: "bun test BỊ CẮT vì quá hạn chờ 1.800s (KHÔNG phải test sai) — chạy lại khi máy rảnh",
    });
  } else if (out.status !== 0) {
    res.violations.push({ file: "tests/", line: 0, message: "bun test đỏ — xem log ở trên" });
  }
  res.ms = Date.now() - t0;
  return res;
}

/**
 * In bảng tổng kết của lần chạy gate.
 * Nhận: mảng kết quả từng cổng.
 * Trả: true nếu toàn bộ xanh.
 */
export function printSummary(results: CheckResult[]): boolean {
  console.log("");
  console.log("=== TỔNG KẾT GATE ===");
  for (const r of results) {
    const state = r.violations.length > 0 ? "ĐỎ " : "XANH";
    console.log(
      state + "  " + r.name.padEnd(14) + " " + String(r.checked).padStart(4) + " file · " +
        r.violations.length + " vi phạm · " + r.warnings.length + " cảnh báo · " + r.ms + "ms",
    );
  }
  const red = results.filter((r) => r.violations.length > 0);
  const total = results.reduce((a, r) => a + r.ms, 0);
  if (red.length === 0) console.log("KẾT LUẬN: XANH — " + results.length + "/" + results.length + " cổng đạt (" + total + "ms)");
  else console.log("KẾT LUẬN: ĐỎ — " + red.length + "/" + results.length + " cổng hỏng: " + red.map((r) => r.name).join(", "));
  return red.length === 0;
}

/**
 * Điểm vào dòng lệnh của gate: chạy cổng, in kết quả, trả mã thoát.
 * Nhận: tham số CLI (đã bỏ tên file); hỗ trợ --only a,b · --strict · --with-tests · --json.
 * Trả: mã thoát 0 nếu xanh, 1 nếu đỏ.
 */
export function runCli(argv: string[]): number {
  const strict = argv.includes("--strict");
  const onlyIndex = argv.indexOf("--only");
  const only = onlyIndex >= 0 ? (argv[onlyIndex + 1] ?? "").split(",").filter((s) => s !== "") : [];
  const t0 = Date.now();
  const results = runGate(only);
  for (const r of results) printResult(r, { strict, limit: 25 });
  // Test chay MAC DINH: "gate XANH" phai co nghia la test xanh. Truoc day no la tuy chon nen hai test
  // do (mot test cu, mot test o nhiem trang thai toan cuc) nam im trong repo ma khong ai thay — dung
  // loai loi "do im lang" ma ca du an dang co loai bo. `--no-tests` de bo qua khi can lap nhanh.
  if (!argv.includes("--no-tests")) {
    const t = runTests();
    printResult(t, { strict });
    results.push(t);
  }
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ totalMs: Date.now() - t0, results }, null, 1));
  }
  const ok = printSummary(results);
  const warningsFail = strict && results.some((r) => r.warnings.length > 0);
  return ok && !warningsFail ? 0 : 1;
}

if (isDirectRun(import.meta.url)) {
  process.exit(runCli(process.argv.slice(2)));
}