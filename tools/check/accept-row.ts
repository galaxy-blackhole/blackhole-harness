/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chuẩn hoá bằng chứng nghiệm thu MỘT row: test + check:rows + lab (probe DOM thật) + dọn lab, in khối dán thẳng vào báo cáo/signoff
 */

// VI SAO CO CONG CU NAY
//   Muc F cua docs/recipes/ROW-REVIEW-CHECKLIST.md doi nguoi ky ghi 5 dong bang chung cho moi row.
//   Lam tay = 4 lenh + parse log + tu nho don lab; moi cho de sai mot kieu khac nhau. Cong cu nay
//   chay dung 4 buoc va IN RA MOT KHOI duy nhat, moi buoc co SO, khong co cho dien giai.
//
// DO DUNG (DoD — khong noi nguong):
//   - bun test <tests cua goi> ...................... FAIL = 0
//   - check:rows (loc dung row) ..................... dong "chan" = 0
//   - lab:row <row> + probe DOM that ................ loi console = 0 · did-not-activate = 0 · #root >= 20000
//   - app 5439 van chay duoc: lab dung home + cong RIENG (5460..5479), khong dung app that.
//
// CACH DUNG
//   bun run tools/check/accept-row.ts ui-shortcuts
//   bun run tools/check/accept-row.ts ui-shortcuts --json   # them khoi JSON doc bang may
//   Ma thoat: 0 = DAT, 1 = KHONG DAT, 2 = thieu doi so / khong doc duoc row.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "../../apps/cli/src/paths.ts";
import {
  MIN_LAB_ROOT_CHARS,
  cleanupLab,
  launchLabBrowser,
  probeLabPage,
  type LabOverlay,
} from "./lab-evidence.ts";
import { acquireLabLock, releaseLabLock } from "./lab-lock.ts";

/** Ngưỡng thời gian (ms) cho từng bước — quá hạn thì báo lỗi rõ, không treo. */
export const STEP_TIMEOUT_MS: Readonly<Record<"test" | "rows" | "lab", number>> = Object.freeze({
  test: 600_000,
  rows: 240_000,
  // 18/10/2026: 180s tung lam accept-row bao "lab:row KHONG in URL" OAN khi may tai nang — lab phai
  // mount/build 124 goi TRUOC khi spawn host, duoi tai co the vuot 180s. Do that: host.log 0 byte,
  // log lab dung o dong canh bao mount cuoi cung (chua he spawn host). Nang len 420s.
  lab: 420_000,
});

/** Kết quả bước test. */
export interface TestEvidence {
  /** Các tệp test đã chạy. */
  files: string[];
  /** Số ca pass. */
  pass: number;
  /** Số ca fail. */
  fail: number;
  /** Mã thoát của bun test. */
  exitCode: number | null;
  /** Tên các ca fail (tối đa 5). */
  failedNames: string[];
  /** Lỗi khi không chạy được. */
  error?: string;
}

/** Một dòng phán quyết của check:rows cho đúng row. */
export interface RowCheckLine {
  /** Mức: chan | canh bao. */
  level: string;
  /** Lý do. */
  detail: string;
}

/** Kết quả bước check:rows. */
export interface RowsEvidence {
  /** Số dòng mức chan. */
  chan: number;
  /** Số dòng mức canh bao. */
  canhBao: number;
  /** Nội dung các dòng liên quan tới row. */
  lines: RowCheckLine[];
  /** Kết luận tổng của check:rows (nếu đọc được). */
  summary: string;
  /** Mã thoát. */
  exitCode: number | null;
  /** Lỗi khi không chạy được. */
  error?: string;
}

/** Kết quả bước lab. */
export interface LabEvidence {
  /** Cổng lab đã dùng. */
  port: number;
  /** URL lab (rỗng khi không boot được). */
  url: string;
  /** Đường dẫn log của lab:row. */
  logFile: string;
  /** Số dòng chứa "did not activate" trong stdout của lab:row (thường 0 — host bị lab nuốt stdout). */
  logDidNotActivate: number;
  /** Số dòng "did not activate" trong <home>/host.log (BẮT CẢ entry NỬA HOST — nguồn chính). */
  hostLogDidNotActivate: number;
  /** Tên các entry host không activate. */
  hostNotActivatedEntries: string[];
  /** Số dấu hiệu did-not-activate đo TRÊN TRANG (console + banner DOM). */
  pageDidNotActivate: number;
  /** Số ký tự #root. */
  rootChars: number;
  /** Lỗi console. */
  consoleErrors: string[];
  /** Lỗi trang. */
  pageErrors: string[];
  /** Overlay phủ màn hình đang mở (đã loại khung shell data-shell-overlay). */
  overlays: LabOverlay[];
  /** rev cây boot (window.__DSH_BOOT__.rev). */
  bootRev: string;
  /** Số entry trong cây boot. */
  bootEntries: number;
  /** Số batch của cây boot. */
  bootBatches: number;
  /** Entry có "brand" trong id/name/aliases (truy đăng ký trùng slot). */
  brandEntries: { id: string; name: string; aliases: string[] }[];
  /** Ghi chú về phép đo. */
  note: string;
  /** Lỗi khi không đo được. */
  error?: string;
}

/** Bằng chứng nghiệm thu đầy đủ của một row. */
export interface AcceptEvidence {
  /** Tên row. */
  row: string;
  /** Tên package GBH. */
  packageName: string;
  /** Thư mục package. */
  packageDir: string;
  /** Id row gốc bị thay. */
  stockRowId: string;
  /** Thời điểm đo. */
  measuredAt: string;
  /** Bước test. */
  test: TestEvidence;
  /** Bước check:rows. */
  rows: RowsEvidence;
  /** Bước lab. */
  lab: LabEvidence;
  /** Kết luận DAT/KHONG DAT. */
  verdict: "DAT" | "KHONG DAT";
  /** Lý do ngắn gọn của kết luận. */
  reasons: string[];
}

/**
 * Tìm thư mục package của một row (client trước, host sau).
 * @param row tên row.
 * @returns đường dẫn thư mục, hoặc null khi không có.
 */
export function findRowDir(row: string): string | null {
  for (const half of ["client", "host"]) {
    const dir = join(repoRoot(), "packages", half, row);
    if (existsSync(join(dir, "package.json"))) return dir;
  }
  return null;
}

/**
 * Đọc metadata gbh.row của package: tên, id row gốc và danh sách test đã khai.
 * @param dir thư mục package.
 * @returns manifest gọn; ném lỗi khi không đọc được.
 */
export function readRowManifest(dir: string): { name: string; rowId: string; tests: string[] } {
  const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    name?: string;
    gbh?: { row?: { id?: string; tests?: string[] }; tests?: string[] };
  };
  return {
    name: json.name ?? "(khong ten)",
    rowId: json.gbh?.row?.id ?? "(chua khai gbh.row)",
    tests: json.gbh?.row?.tests ?? json.gbh?.tests ?? [],
  };
}

/**
 * Chạy bun test trên các tệp test đã khai và đếm pass/fail.
 * @param files tệp test (tương đối repo).
 * @returns số pass, số fail, tên ca fail và mã thoát.
 */
export function runTests(files: readonly string[]): TestEvidence {
  if (files.length === 0) {
    return { files: [], pass: 0, fail: 0, exitCode: null, failedNames: [], error: "package khong khai gbh.row.tests/gbh.tests" };
  }
  const result = spawnSync(process.execPath, ["test", ...files], { cwd: repoRoot(), encoding: "utf8", timeout: STEP_TIMEOUT_MS.test });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  const pass = Number(/(\d+) pass/u.exec(output)?.[1] ?? "0");
  const fail = Number(/(\d+) fail/u.exec(output)?.[1] ?? "0");
  const failedNames = output.split("\n").filter((line) => line.startsWith("(fail) ")).map((line) => line.replace(/\[[0-9.]+ms\]/u, "").trim()).slice(0, 5);
  if (result.status !== 0 && pass === 0 && fail === 0) {
    return { files: [...files], pass, fail, exitCode: result.status, failedNames, error: output.slice(-500).replace(/\s+/gu, " ") };
  }
  return { files: [...files], pass, fail, exitCode: result.status, failedNames };
}

/**
 * Chạy check:rows và lọc đúng dòng của row này.
 * @param row tên row (khớp cột Package — short name).
 * @returns số dòng chan/canh bao và nội dung các dòng liên quan.
 */
export function runCheckRows(row: string): RowsEvidence {
  const result = spawnSync(process.execPath, ["run", join(repoRoot(), "tools", "check", "rows.ts")], {
    cwd: repoRoot(),
    encoding: "utf8",
    timeout: STEP_TIMEOUT_MS.rows,
  });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  const lines: RowCheckLine[] = [];
  for (const line of output.split("\n")) {
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    const name = cells[1] ?? "";
    const level = cells[2] ?? "";
    const detail = cells[3] ?? "";
    if (level !== "chan" && level !== "canh bao") continue;
    if (name !== row) continue;
    lines.push({ level, detail });
  }
  const summary = output.split("\n").find((line) => line.startsWith("KET LUAN:")) ?? "";
  return {
    chan: lines.filter((line) => line.level === "chan").length,
    canhBao: lines.filter((line) => line.level === "canh bao").length,
    lines,
    summary,
    exitCode: result.status,
    error: result.status === null ? "check:rows khong chay duoc (timeout?)" : undefined,
  };
}

/**
 * Chạy lab:row như TIEN TRINH CON, ghi toàn bộ stdout/stderr vào log để đọc URL và đếm dòng
 * "did not activate". Lab dùng home + cổng riêng nên app 5439 không bị ảnh hưởng.
 * @param row tên row.
 * @returns thông tin log, cổng và URL; error khi không boot được.
 */
export function bootLabWithLog(row: string): { port: number; url: string; home: string; logFile: string; logText: string; error?: string } {
  const logFile = join("/tmp", "gbh-accept-lab-" + row + ".log");
  const result = spawnSync(process.execPath, ["run", join(repoRoot(), "tools", "lab", "row.ts"), row], {
    cwd: repoRoot(),
    encoding: "utf8",
    timeout: STEP_TIMEOUT_MS.lab,
    // Cha DA giu khoa lab (acquireLabLock) nen con khong duoc tu cho (deadlock).
    env: { ...process.env, GBH_LAB_LOCK_BYPASS: "1" },
  });
  const logText = (result.stdout ?? "") + (result.stderr ?? "");
  writeFileSync(logFile, logText, "utf8");
  const url = /http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/u.exec(logText)?.[0] ?? "";
  const port = url === "" ? 0 : Number(/:(\d+)\//u.exec(url)?.[1] ?? "0");
  const home = /home\s*:\s*(\/tmp\/gbh-lab-\S+)/u.exec(logText)?.[1] ?? join("/tmp", "gbh-lab-" + row);
  if (url === "") {
    return { port: 0, url: "", home, logFile, logText, error: "lab:row KHONG in URL — xem " + logFile };
  }
  return { port, url, home, logFile, logText };
}

/**
 * Đo bước lab đầy đủ: boot có log, probe trang thật, rồi DỌN lab (kể cả khi probe ném lỗi).
 * @param row tên row.
 * @param browser browser dùng chung.
 * @returns số đo lab.
 */
export async function measureLab(row: string, browser: Awaited<ReturnType<typeof launchLabBrowser>>): Promise<LabEvidence> {
  // KHOA TOAN CUC (18/10/2026): boot + probe + don lab nam TRON trong mot khoa. Neu chi khoa luc boot
  //   thi luot khac co the xoa home trong luc ta dang probe (su co EEXIST/ENOENT that).
  acquireLabLock();
  let boot: ReturnType<typeof bootLabWithLog> | null = null;
  try {
    boot = bootLabWithLog(row);
    // LOG HOST: nguồn CHÍNH để đếm entry nửa HOST không activate (lab:row nay tee stdout host vào file này).
    const hostLogPath = join(boot.home, "host.log");
    let hostLogText = "";
    try {
      hostLogText = readFileSync(hostLogPath, "utf8");
    } catch {
      hostLogText = "";
    }
    const hostNotActivatedEntries = hostLogText
      .split("\n")
      .map((line) => /^([A-Za-z0-9._-]+) \(@[^)]+\):/u.exec(line)?.[1])
      .filter((name): name is string => name !== undefined);
    // Luu ban sao log host truoc khi cleanup xoa home (bang chung hau kiem duoc dan vao report/signoff).
    if (hostLogText !== "") writeFileSync(join("/tmp", "gbh-accept-lab-" + row + ".host.log"), hostLogText, "utf8");
    const base: LabEvidence = {
      port: boot.port,
      url: boot.url,
      logFile: boot.logFile,
      logDidNotActivate: boot.logText.split("\n").filter((line) => /did not activate/iu.test(line)).length,
      hostLogDidNotActivate: hostLogText.split("\n").filter((line) => /did not activate/iu.test(line)).length,
      hostNotActivatedEntries,
      pageDidNotActivate: 0,
      rootChars: 0,
      consoleErrors: [],
      pageErrors: [],
      overlays: [],
      bootRev: "",
      bootEntries: 0,
      bootBatches: 0,
      brandEntries: [],
      note: "so did-not-activate phia HOST doc tu <home>/host.log (lab:row tee stdout/stderr host vao file nay); so tren TRANG chi bat loi client boot",
    };
    if (boot.error !== undefined) return { ...base, error: boot.error };
    if (browser === null) return { ...base, error: "khong mo duoc Chrome de probe" };
    try {
      const probe = await probeLabPage(browser, boot.url);
      return {
        ...base,
        pageDidNotActivate: probe.didNotActivate,
        rootChars: probe.rootChars,
        consoleErrors: probe.consoleErrors,
        pageErrors: probe.pageErrors,
        overlays: probe.overlays,
        bootRev: probe.boot.rev,
        bootEntries: probe.boot.entries,
        bootBatches: probe.boot.batches,
        brandEntries: probe.boot.brandEntries,
      };
    } catch (error) {
      return { ...base, error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) };
    }
  } finally {
    // DoD buoc 4: don lab — CHI kill listener cua cong lab, roi xoa home tam.
    if (boot !== null && boot.port > 0) cleanupLab(boot.port, join("/tmp", "gbh-lab-" + row));
    releaseLabLock();
  }
}

/**
 * Chạy đủ 4 bước nghiệm thu cho một row và trả bằng chứng có cấu trúc.
 * @param row tên row.
 * @returns bằng chứng đầy đủ + kết luận theo DoD.
 */
export async function acceptRow(row: string): Promise<AcceptEvidence | null> {
  const dir = findRowDir(row);
  if (dir === null) return null;
  const manifest = readRowManifest(dir);
  const test = runTests(manifest.tests);
  const rows = runCheckRows(row);
  const browser = await launchLabBrowser();
  let lab: LabEvidence;
  try {
    lab = await measureLab(row, browser);
  } finally {
    if (browser !== null) await browser.close().catch(() => undefined);
  }
  const reasons: string[] = [];
  if (test.fail !== 0) reasons.push("test fail=" + String(test.fail));
  if (rows.chan !== 0) reasons.push("check:rows chan=" + String(rows.chan));
  if (lab.error !== undefined) reasons.push("lab: " + lab.error);
  if (lab.consoleErrors.length !== 0) reasons.push("loi console=" + String(lab.consoleErrors.length));
  if (lab.pageDidNotActivate !== 0) reasons.push("did-not-activate(trang)=" + String(lab.pageDidNotActivate));
  if (lab.hostLogDidNotActivate !== 0) reasons.push("did-not-activate(host)=" + String(lab.hostLogDidNotActivate) + " [" + lab.hostNotActivatedEntries.join(", ") + "]");
  if (lab.rootChars < MIN_LAB_ROOT_CHARS) reasons.push("#root=" + String(lab.rootChars) + " < " + String(MIN_LAB_ROOT_CHARS));
  return {
    row,
    packageName: manifest.name,
    packageDir: dir.replace(repoRoot() + "/", ""),
    stockRowId: manifest.rowId,
    measuredAt: new Date().toISOString(),
    test,
    rows,
    lab,
    verdict: reasons.length === 0 ? "DAT" : "KHONG DAT",
    reasons,
  };
}

/**
 * In khối bằng chứng dán thẳng vào báo cáo / signoff (mỗi bước MỘT con số).
 * @param evidence bằng chứng đã đo.
 * @returns văn bản nhiều dòng.
 */
export function renderBlock(evidence: AcceptEvidence): string {
  const lines: string[] = [];
  lines.push("row: " + evidence.row);
  lines.push("package GBH: " + evidence.packageName + "  (thay row stock: " + evidence.stockRowId + ")");
  lines.push("1) test: " + (evidence.test.files.length === 0 ? "(khong khai test)" : evidence.test.files.join(" · ")) +
    " => PASS " + String(evidence.test.pass) + " · FAIL " + String(evidence.test.fail) +
    (evidence.test.failedNames.length > 0 ? "  [fail: " + evidence.test.failedNames.join(" | ") + "]" : "") +
    (evidence.test.error !== undefined ? "  LOI: " + evidence.test.error : ""));
  lines.push("2) check:rows: chan=" + String(evidence.rows.chan) + " · canh bao=" + String(evidence.rows.canhBao) +
    "  (" + (evidence.rows.summary === "" ? "khong doc duoc ket luan" : evidence.rows.summary) + ")");
  for (const line of evidence.rows.lines) lines.push("   [" + line.level + "] " + line.detail);
  lines.push("3) lab: cong " + String(evidence.lab.port) + " · #root " + String(evidence.lab.rootChars) + " ky tu" +
    " · loi console " + String(evidence.lab.consoleErrors.length) +
    " · loi trang " + String(evidence.lab.pageErrors.length) +
    " · did-not-activate (trang) " + String(evidence.lab.pageDidNotActivate) +
    " · did-not-activate (host log) " + String(evidence.lab.hostLogDidNotActivate) +
    (evidence.lab.hostNotActivatedEntries.length > 0 ? " [" + evidence.lab.hostNotActivatedEntries.join(", ") + "]" : "") +
    " · did-not-activate (stdout lab) " + String(evidence.lab.logDidNotActivate) +
    " · overlay " + String(evidence.lab.overlays.length) +
    (evidence.lab.error !== undefined ? "  LOI: " + evidence.lab.error : ""));
  // In NGUYEN VAN vai loi dau: khoi bang chung phai du de nguoi ky tu phan loai, khong phai doan.
  for (const message of evidence.lab.consoleErrors.slice(0, 3)) lines.push("   [console] " + message);
  for (const message of evidence.lab.pageErrors.slice(0, 3)) lines.push("   [pageerror] " + message);
  for (const overlay of evidence.lab.overlays.slice(0, 3)) lines.push("   [overlay] " + overlay.tag + "." + overlay.cls + " z=" + overlay.z + " " + String(overlay.w) + "x" + String(overlay.h));
  lines.push("   URL lab: " + evidence.lab.url);
  lines.push("   cay boot: rev=" + evidence.lab.bootRev + " · " + String(evidence.lab.bootEntries) + " entry · " + String(evidence.lab.bootBatches) + " batch" +
    " · entry brand: " + (evidence.lab.brandEntries.length === 0 ? "(khong co)" : evidence.lab.brandEntries.map((entry) => entry.id + " (" + entry.name + ")" + (entry.aliases.length > 0 ? " aliases=" + entry.aliases.join(",") : "")).join(" | ")));
  lines.push("   log lab: " + evidence.lab.logFile + " · log host: /tmp/gbh-accept-lab-" + evidence.row + ".host.log");
  lines.push("4) don lab: kill listener cong " + String(evidence.lab.port) + " · rm -rf /tmp/gbh-lab-" + evidence.row);
  lines.push("ket luan: " + evidence.verdict +
    (evidence.reasons.length > 0 ? " — " + evidence.reasons.join(" · ") : " — test 0 fail · 0 chan · 0 loi console · 0 did-not-activate"));
  return lines.join("\n");
}

/**
 * Điểm vào dòng lệnh.
 * @param argv tham số sau tên script.
 * @returns mã thoát: 0 DAT, 1 KHONG DAT, 2 thiếu đối số / không thấy row.
 */
async function main(argv: readonly string[]): Promise<number> {
  const row = argv.find((arg) => !arg.startsWith("--"));
  if (row === undefined) {
    console.log("Dung: bun run tools/check/accept-row.ts <row> [--json]");
    return 2;
  }
  const evidence = await acceptRow(row);
  if (evidence === null) {
    console.log("khong thay package cua row " + row + " trong packages/client/ hay packages/host/");
    return 2;
  }
  console.log(renderBlock(evidence));
  if (argv.includes("--json")) {
    console.log("");
    console.log(JSON.stringify(evidence, null, 1));
  }
  return evidence.verdict === "DAT" ? 0 : 1;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
