/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đo bằng chứng lab cho TỪNG row: dựng lab cách ly, probe DOM thật (console + #root + overlay + dấu hiệu did-not-activate), dọn lab, ghi .parity/lab-evidence
 */

// VI SAO CO CONG CU NAY
//   Quy trinh nghiem thu (docs/recipes/ROW-REVIEW-CHECKLIST.md muc D) doi moi row phai co
//   "bun run lab:row <row> => 0 loi console · 0 did not activate". Lam tay 41 lan thi:
//     (1) phai tu parse URL tu stdout cua lab, (2) phai nho kill listener + rm home (neu khong, lan
//     sau lab bao "het cong trong" hoac boot cham), (3) so lieu nam rai rac, khong thanh bang.
//   Cong cu nay lam dung ba viec do, va ghi ket qua co CAU TRUC de bao cao khong phai chep tay.
//
// PHEP DO (khong suy tu anh):
//   - console errors / pageerrors cua trang that (Chrome headless, channel chrome).
//   - #root innerHTML.length + chuoi text: bat lop "mat noi dung am tham" (ROW-REVIEW C3).
//   - overlay phu man hinh dang mo: bat lop "modal bo mo" (ROW-REVIEW C5).
//   - dau hieu "did not activate" / "Failed to load plugins": CHUOI NAY chi xuat hien khi cay plugin
//     co entry khong activate (ban goc nem "web boot: N entries did not activate"), nen dem duoc
//     ngay tren trang ma khong can doc log host (lab khong ghi log ra file).
//
// CACH DUNG
//   bun run tools/check/lab-evidence.ts ui-settings-general ui-chat ...
//   bun run tools/check/lab-evidence.ts --all            # danh sach mac dinh: 41 goi da sua o phien truoc
//   bun run tools/check/lab-evidence.ts --all --continue # bo qua row da co artifact (chay tiep sau khi dut)
//   Ket qua: .parity/lab-evidence/<row>.json + .parity/lab-evidence/summary.md

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { repoRoot } from "../../apps/cli/src/paths.ts";
import { runLab } from "../lab/row.ts";
import { acquireLabLock, releaseLabLock } from "./lab-lock.ts";

/** Thư mục artifact của phép đo (nằm trong .parity, đã gitignore). */
export const EVIDENCE_DIR = join(repoRoot(), ".parity", "lab-evidence");

/**
 * Danh sách row MAC DINH = 41 gói client đã sửa ở phiên trước, đo được bằng
 * "git diff --name-only 99c488b..HEAD -- packages | awk -F/ '{print $3}' | sort -u".
 * Gồm: 4 gói de-bundle (ui-chat · ui-conversation · ui-schedule · ui-trajectory) vì luật "gen-vi --write
 * KHÔNG sinh file cho 4 gói de-bundle" là lỗi làm hỏng build; 11 gói ui-settings-* (10 gói khai
 * gbh.row.moduleIds + gói gốc ui-settings); phần còn lại là các gói chỉ thêm cặp từ điển vi.
 */
export const DEFAULT_ROWS: readonly string[] = Object.freeze([
  "locale",
  "ui-agent-preset",
  "ui-approval",
  "ui-attachment",
  "ui-chat",
  "ui-commands",
  "ui-conversation",
  "ui-deliverables",
  "ui-goal",
  "ui-jobs",
  "ui-layout",
  "ui-message-feedback",
  "ui-open-in-app",
  "ui-permission",
  "ui-plan",
  "ui-plugin-market",
  "ui-reference",
  "ui-schedule",
  "ui-secret-mask",
  "ui-settings",
  "ui-settings-account",
  "ui-settings-agent-loop",
  "ui-settings-general",
  "ui-settings-models",
  "ui-settings-plugin-inventory",
  "ui-settings-plugins",
  "ui-settings-session-log",
  "ui-settings-shell",
  "ui-settings-subagent",
  "ui-settings-web-search",
  "ui-sidebar",
  "ui-sidebar-browser",
  "ui-sidebar-documentpreview",
  "ui-sidebar-files",
  "ui-sidebar-right",
  "ui-sidebar-terminal",
  "ui-skill",
  "ui-subagent",
  "ui-trajectory",
  "ui-workflow-run",
  "ui-workspace",
]);

/** Một phần tử phủ màn hình đang mở (cùng hình dạng với tools/check/overlay-probe.ts). */
export interface LabOverlay {
  /** Tên thẻ HTML. */
  tag: string;
  /** Lớp CSS (cắt ngắn) để truy ra gói sở hữu. */
  cls: string;
  /** z-index tính toán được. */
  z: string;
  /** Chiều rộng vật lý. */
  w: number;
  /** Chiều cao vật lý. */
  h: number;
}

/** Kết quả đo MOT row trong lab. */
export interface LabRowEvidence {
  /** Tên row (= tên thư mục package). */
  row: string;
  /** Thời điểm đo (ISO). */
  measuredAt: string;
  /** Cổng lab đã dùng (5460..5479). */
  port: number;
  /** Home cách ly của lab. */
  home: string;
  /** true khi lab boot được và trả URL. */
  booted: boolean;
  /** Lý do khi không đo được. */
  error?: string;
  /** Số ký tự innerHTML của #root. */
  rootChars: number;
  /** Số ký tự text hiển thị trong #root. */
  rootTextChars: number;
  /** Lỗi console loại error. */
  consoleErrors: string[];
  /** Lỗi trang (pageerror / uncaught). */
  pageErrors: string[];
  /** Số dấu hiệu "did not activate" đếm được (console + DOM). */
  didNotActivate: number;
  /** Số dòng "did not activate" trong LOG HOST của lab (bắt cả entry NỬA HOST mà trang không thấy). */
  hostDidNotActivate: number;
  /** Tên các entry host không activate (trích từ log host). */
  hostNotActivatedEntries: string[];
  /** Bản sao log host để hậu kiểm (rỗng khi không đọc được). */
  hostLogFile: string;
  /** true khi DOM có banner "Failed to load plugins"/"did not activate". */
  bannerVisible: boolean;
  /** Các dấu hiệu bất thường khác tìm thấy trong text. */
  symptoms: string[];
  /** Overlay phủ màn hình đang mở. */
  overlays: LabOverlay[];
  /** Số phần tử có data-slot (đo độ phủ slot). */
  slotCount: number;
  /** rev của cây boot (window.__GBH_BOOT__.rev; __DSH_BOOT__ là alias tương thích). */
  bootRev: string;
  /** Số entry trong cây boot. */
  bootEntries: number;
  /** Số batch của cây boot. */
  bootBatches: number;
  /** Các entry có "brand" trong id/name/aliases (để truy đăng ký trùng slot). */
  brandEntries: { id: string; name: string; aliases: string[] }[];
  /** Số button hiển thị. */
  buttonCount: number;
  /** Kết luận của phép đo. */
  verdict: "DAT" | "KHONG DAT" | "BO QUA";
  /** Ghi chú kết luận. */
  note: string;
}

/** Trang Playwright tối thiểu mà phép đo cần. */
interface ProbePage {
  /** Đăng ký nghe sự kiện console/pageerror. */
  on: (event: string, handler: (arg: unknown) => void) => void;
  /** Điều hướng tới URL. */
  goto: (url: string, options: unknown) => Promise<unknown>;
  /** Chạy mã trong trang. */
  evaluate: <T>(fn: () => T) => Promise<T>;
  /** Chờ theo thời gian. */
  waitForTimeout: (ms: number) => Promise<void>;
  /** Đóng trang. */
  close: () => Promise<void>;
}

/** Browser Chrome tối thiểu. */
interface ProbeBrowser {
  /** Mở trang mới. */
  newPage: () => Promise<ProbePage>;
  /** Đóng browser. */
  close: () => Promise<void>;
}

/** Dấu hiệu bất thường cần tìm trong text của trang (không phải brand, là lỗi thật). */
export const SYMPTOM_MARKERS: readonly string[] = Object.freeze([
  "did not activate",
  "Failed to load plugins",
  "Enter your Galaxy API key",
  "Enter your DeepSeek API key",
  "Something went wrong",
]);

/** Ngưỡng #root của lab: dưới mức này nghĩa là app gần như không render (thẻ lỗi ~620 ký tự). */
export const MIN_LAB_ROOT_CHARS = 20_000;

/**
 * Mở một browser Chrome dùng chung cho cả lượt đo (tiết kiệm 8-10 giây/lần so với mở mỗi row).
 * Dùng đúng playwright-core của giàn parity để không cài thêm dependency.
 * @returns browser, hoặc null khi không mở được Chrome.
 */
export async function launchLabBrowser(): Promise<ProbeBrowser | null> {
  const pw = join(repoRoot(), "tools", "parity", "node_modules", "playwright-core", "index.js");
  if (!existsSync(pw)) return null;
  const mod = (await import(pathToFileURL(pw).href)) as {
    chromium?: { launch: (o: unknown) => Promise<ProbeBrowser> };
    default?: { chromium?: { launch: (o: unknown) => Promise<ProbeBrowser> } };
  };
  const chromium = mod.chromium ?? mod.default?.chromium;
  if (chromium === undefined) return null;
  try {
    return await chromium.launch({ headless: true, channel: "chrome", args: ["--no-sandbox"] });
  } catch {
    return null;
  }
}

/**
 * Đo phía trang của một URL lab: console errors, #root, text, overlay, dấu hiệu did-not-activate.
 * Chờ #root ổn định (hai lần đo liên tiếp bằng nhau) thay vì ngủ cố định, để không bỏ sót lần render muộn.
 * @param browser browser đang mở.
 * @param url URL lab đầy đủ kèm token.
 * @returns các số đo; ném lỗi khi không điều hướng được.
 */
export async function probeLabPage(browser: ProbeBrowser, url: string): Promise<{
  rootChars: number;
  rootTextChars: number;
  consoleErrors: string[];
  pageErrors: string[];
  didNotActivate: number;
  bannerVisible: boolean;
  symptoms: string[];
  overlays: LabOverlay[];
  slotCount: number;
  buttonCount: number;
  boot: { rev: string; entries: number; batches: number; brandEntries: { id: string; name: string; aliases: string[] }[] };
}> {
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message: unknown) => {
    const msg = message as { type?: () => string; text?: () => string };
    if (msg.type?.() === "error") consoleErrors.push((msg.text?.() ?? "").slice(0, 300));
  });
  page.on("pageerror", (error: unknown) => {
    pageErrors.push(String(error).slice(0, 300));
  });
  try {
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    // DONG hop thoai MOT LAN (onboarding) truoc khi do — de moi row cung TRANG THAI, khong phu thuoc
    //   "lan dau vao origin nay" (lab lap lai cung cong 5460 => localStorage dung chung giua cac row).
    await page.waitForTimeout(1_500);
    await page.evaluate(() => {
      const labels = ["later", "got it", "continue", "skip", "dismiss", "not now", "start exploring", "ok", "để sau", "đã hiểu", "tiếp tục", "bỏ qua", "không phải bây giờ", "bắt đầu khám phá"];
      for (const node of Array.from(document.querySelectorAll("button"))) {
        const text = (node.textContent ?? "").replace(/\s+/gu, " ").trim().toLowerCase();
        const primary = text.split(" ")[0] ?? "";
        if (!labels.includes(text) && !labels.includes(primary)) continue;
        (node as HTMLElement).click();
      }
    });
    await page.waitForTimeout(600);
    // Cho #root ON DINH that su: phai qua TOI THIEU 8 giay VA on dinh 5 lan do lien tiep (2.5s) moi doc.
    //   Vi sao: do 18/10/2026 luc may dang tai nang, ban cu (on dinh 1.5s) doc phai luc React con dang
    //   render => #root 21.985 trong khi cung row do luc ranh la 42.190 — SO DO SAI, khong phai row hong.
    //   Tran 30s: may rat cham thi dung lai va ghi so da co (khong treo vo han).
    let previous = -1;
    let stable = 0;
    const started = Date.now();
    for (let i = 0; i < 60; i += 1) {
      await page.waitForTimeout(500);
      const now = await page.evaluate(() => document.querySelector("#root")?.innerHTML.length ?? 0);
      if (now > 0 && now === previous) {
        stable += 1;
        if (stable >= 5 && Date.now() - started >= 8_000) break;
      } else {
        stable = 0;
      }
      previous = now;
    }
    const measured = await page.evaluate(() => {
      const root = document.querySelector("#root");
      const text = (document.body.innerText || "").replace(/\s+/gu, " ");
      const hits: LabOverlay[] = [];
      for (const node of Array.from(document.querySelectorAll("body *")) as HTMLElement[]) {
        const rect = node.getBoundingClientRect();
        if (rect.width < 400 || rect.height < 300) continue;
        const cs = getComputedStyle(node);
        if (cs.position !== "fixed" && cs.position !== "absolute") continue;
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) continue;
        // LOP VO HAI DA BIET: khung shell "overlayLayer" (data-shell-overlay) la vung chua modal,
        // luon ton tai va pointer-events:none. No KHONG phai modal dang mo — ban goc cung co.
        if (node.hasAttribute("data-shell-overlay") || cs.pointerEvents === "none") continue;
        hits.push({
          tag: node.tagName,
          cls: String(node.className).slice(0, 90),
          z: cs.zIndex,
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
      // CAY BOOT: id/rev/aliases cua tung entry — du de tru entry dang ky trung slot (vd brand.mark).
      // task-31: đọc global CHÍNH __GBH_BOOT__; __DSH_BOOT__ chỉ là ALIAS tương thích (external/stock).
      const scope = globalThis as unknown as {
        __GBH_BOOT__?: { rev?: unknown; batches?: unknown[]; entries?: unknown[] };
        __DSH_BOOT__?: { rev?: unknown; batches?: unknown[]; entries?: unknown[] };
      };
      const boot = scope.__GBH_BOOT__ ?? scope.__DSH_BOOT__ ?? {};
      const bootEntries = Array.isArray(boot.entries) ? (boot.entries as Record<string, unknown>[]) : [];
      const brandEntries = bootEntries
        .filter((entry) => JSON.stringify(entry).toLowerCase().includes("brand"))
        .map((entry) => ({
          id: String(entry.id ?? ""),
          name: String(entry.name ?? ""),
          aliases: Array.isArray(entry.aliases) ? (entry.aliases as unknown[]).map(String) : [],
        }));
      return {
        rootChars: root?.innerHTML.length ?? 0,
        rootTextChars: (root?.textContent ?? "").length,
        fullText: text,
        overlays: hits,
        slotCount: document.querySelectorAll("[data-slot]").length,
        buttonCount: Array.from(document.querySelectorAll("button")).filter((b) => (b as HTMLElement).offsetParent !== null).length,
        boot: {
          rev: String(boot.rev ?? ""),
          entries: bootEntries.length,
          batches: Array.isArray(boot.batches) ? boot.batches.length : 0,
          brandEntries,
        },
      };
    });
    const lower = measured.fullText.toLowerCase();
    const symptoms = SYMPTOM_MARKERS.filter((marker) => lower.includes(marker.toLowerCase()));
    const fromConsole = consoleErrors.filter((line) => /did not activate/iu.test(line)).length;
    const fromPageErrors = pageErrors.filter((line) => /did not activate/iu.test(line)).length;
    const bannerVisible = lower.includes("did not activate") || lower.includes("failed to load plugins");
    return {
      rootChars: measured.rootChars,
      rootTextChars: measured.rootTextChars,
      consoleErrors,
      pageErrors,
      didNotActivate: fromConsole + fromPageErrors + (bannerVisible ? 1 : 0),
      bannerVisible,
      symptoms,
      overlays: measured.overlays,
      slotCount: measured.slotCount,
      buttonCount: measured.buttonCount,
      boot: measured.boot,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Dọn lab của một row: CHỈ kill tiến trình đang LISTEN cổng (luật 18/10 — lsof trần có thể trả
 * kết nối, kill nhầm), chờ cổng nhả, rồi xoá home tạm.
 * @param port cổng lab.
 * @param home home cách ly của lab.
 */
export function cleanupLab(port: number, home: string): void {
  const listeners = spawnSync("lsof", ["-ti", "tcp:" + String(port), "-sTCP:LISTEN"], { encoding: "utf8" });
  const pids = (listeners.stdout ?? "").split("\n").map((line) => line.trim()).filter((line) => line !== "");
  for (const pid of pids) spawnSync("kill", [pid], { encoding: "utf8" });
  for (let i = 0; i < 20; i += 1) {
    const probe = spawnSync("lsof", ["-ti", "tcp:" + String(port), "-sTCP:LISTEN"], { encoding: "utf8" });
    if ((probe.stdout ?? "").trim() === "") break;
    spawnSync("sleep", ["0.5"]);
  }
  rmSync(home, { recursive: true, force: true });
}

/**
 * Đo MỘT row: boot lab cách ly, probe trang thật, kết luận, rồi DỌN lab (kể cả khi probe ném lỗi).
 * @param row tên row (thư mục trong packages/client).
 * @param browser browser dùng chung của lượt đo.
 * @returns bằng chứng có cấu trúc của row.
 */
export async function measureRow(row: string, browser: ProbeBrowser | null): Promise<LabRowEvidence> {
  const measuredAt = new Date().toISOString();
  const base: LabRowEvidence = {
    row,
    measuredAt,
    port: 0,
    home: "",
    booted: false,
    rootChars: 0,
    rootTextChars: 0,
    consoleErrors: [],
    pageErrors: [],
    didNotActivate: 0,
    hostDidNotActivate: 0,
    hostNotActivatedEntries: [],
    hostLogFile: "",
    bannerVisible: false,
    symptoms: [],
    overlays: [],
    slotCount: 0,
    buttonCount: 0,
    bootRev: "",
    bootEntries: 0,
    bootBatches: 0,
    brandEntries: [],
    verdict: "BO QUA",
    note: "",
  };
  if (browser === null) return { ...base, error: "khong mo duoc Chrome (playwright-core/channel chrome)" };
  let lab: { home: string; port: number; url: string } | null = null;
  try {
    lab = await runLab(row);
    if (lab === null) return { ...base, error: "lab khong boot duoc (xem stdout o tren)" };
    base.port = lab.port;
    base.home = lab.home;
    base.booted = true;
    // LOG HOST: bat entry NUA HOST khong activate (trang van render, console 0 loi ⇒ probe trang mot minh
    //   se bao DAT oan — ca that 18/10/2026: config-editor/pwsh-sandbox/documentpreview).
    const hostLogPath = join(lab.home, "host.log");
    let hostLogText = "";
    try {
      hostLogText = readFileSync(hostLogPath, "utf8");
    } catch {
      hostLogText = "";
    }
    const hostLines = hostLogText.split("\n");
    const hostNotActivatedEntries = hostLines
      .map((line) => /^([A-Za-z0-9._-]+) \(@[^)]+\):/u.exec(line)?.[1])
      .filter((name): name is string => name !== undefined);
    const hostDidNotActivate = hostLines.filter((line) => /did not activate/iu.test(line)).length;
    // Luu ban sao log host vao artifact TRUOC khi cleanup xoa home.
    let hostLogFile = "";
    if (hostLogText !== "") {
      hostLogFile = join(EVIDENCE_DIR, row + ".host.log");
      writeFileSync(hostLogFile, hostLogText, "utf8");
    }
    const probe = await probeLabPage(browser, lab.url);
    const dat =
      probe.rootChars >= MIN_LAB_ROOT_CHARS &&
      probe.consoleErrors.length === 0 &&
      probe.pageErrors.length === 0 &&
      probe.didNotActivate === 0 &&
      probe.bannerVisible === false &&
      hostDidNotActivate === 0 &&
      hostNotActivatedEntries.length === 0;
    return {
      ...base,
      ...probe,
      bootRev: probe.boot.rev,
      bootEntries: probe.boot.entries,
      bootBatches: probe.boot.batches,
      brandEntries: probe.boot.brandEntries,
      hostDidNotActivate,
      hostNotActivatedEntries,
      hostLogFile,
      verdict: dat ? "DAT" : "KHONG DAT",
      note:
        (dat ? "" : "nguyen nhan: ") +
        (probe.rootChars < MIN_LAB_ROOT_CHARS ? "#root " + String(probe.rootChars) + " < " + String(MIN_LAB_ROOT_CHARS) + " · " : "") +
        (probe.consoleErrors.length > 0 ? String(probe.consoleErrors.length) + " loi console · " : "") +
        (probe.pageErrors.length > 0 ? String(probe.pageErrors.length) + " loi trang · " : "") +
        (probe.didNotActivate > 0 ? "did-not-activate(trang)=" + String(probe.didNotActivate) + " · " : "") +
        (hostDidNotActivate > 0 ? "did-not-activate(host)=" + String(hostDidNotActivate) + " [" + hostNotActivatedEntries.join(", ") + "] · " : "") +
        (probe.bannerVisible ? "banner loi hien tren trang" : ""),
    };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) };
  } finally {
    if (lab !== null) cleanupLab(lab.port, lab.home);
  }
}

/**
 * Chạy phép đo cho nhiều row, tuần tự (mỗi lần chỉ MỘT lab sống để số đo không tranh CPU/cổng).
 * @param rows danh sách row cần đo.
 * @param options.continueOnArtifact bỏ qua row đã có artifact (chạy tiếp sau khi bị ngắt).
 * @returns bằng chứng của mọi row đã chạy, theo đúng thứ tự đầu vào.
 */
export async function runRows(rows: readonly string[], options: { continueOnArtifact?: boolean } = {}): Promise<LabRowEvidence[]> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const browser = await launchLabBrowser();
  if (browser === null) console.error("[lab-evidence] KHONG mo duoc Chrome — se ghi 'BO QUA' cho moi row");
  const out: LabRowEvidence[] = [];
  try {
    for (const row of rows) {
      const file = join(EVIDENCE_DIR, row + ".json");
      if (options.continueOnArtifact === true && existsSync(file)) {
        const cached = JSON.parse(readFileSync(file, "utf8")) as LabRowEvidence;
        out.push(cached);
        console.log("[lab-evidence] " + row + ": BO QUA (da co artifact)");
        continue;
      }
      const started = Date.now();
      // Khoa trong suot boot + probe + don cleanup (runLab acquire long nhau duoc refcount).
      acquireLabLock();
      let evidence: LabRowEvidence;
      try {
        evidence = await measureRow(row, browser);
      } finally {
        releaseLabLock();
      }
      writeFileSync(file, JSON.stringify(evidence, null, 1), "utf8");
      out.push(evidence);
      console.log(
        "[lab-evidence] " + row + ": " + evidence.verdict +
          " · #root " + String(evidence.rootChars) +
          " · loi console " + String(evidence.consoleErrors.length) +
          " · loi trang " + String(evidence.pageErrors.length) +
          " · did-not-activate(trang) " + String(evidence.didNotActivate) +
          " · did-not-activate(host) " + String(evidence.hostDidNotActivate ?? 0) +
          ((evidence.hostNotActivatedEntries ?? []).length > 0 ? " [" + (evidence.hostNotActivatedEntries ?? []).join(",") + "]" : "") +
          " · overlay " + String(evidence.overlays.length) +
          " · " + ((Date.now() - started) / 1000).toFixed(1) + "s" +
          (evidence.error !== undefined ? " · LOI: " + evidence.error : ""),
      );
      writeFileSync(join(EVIDENCE_DIR, "summary.md"), renderMarkdownTable(out), "utf8");
    }
  } finally {
    if (browser !== null) await browser.close().catch(() => undefined);
  }
  return out;
}

/**
 * Dựng bảng Markdown từ bằng chứng để báo cáo không phải chép tay.
 * @param rows bằng chứng của các row.
 * @returns nội dung bảng Markdown (kèm header 5 dòng của repo).
 */
export function renderMarkdownTable(rows: readonly LabRowEvidence[]): string {
  const lines: string[] = [];
  lines.push("<!--");
  lines.push(" author Bùi Trọng Hiếu");
  lines.push(" email kevinbui210191@gmail.com");
  lines.push(" create date 15/10/2026");
  lines.push(" modify date 18/10/2026");
  lines.push(" desc Bang bang chung lab tung row — sinh tu dong boi tools/check/lab-evidence.ts");
  lines.push("-->");
  lines.push("");
  lines.push("# Bằng chứng lab theo row — " + new Date().toISOString());
  lines.push("");
  lines.push("> Sinh tự động bởi bun run tools/check/lab-evidence.ts. Ngưỡng DAT: #root ≥ " + String(MIN_LAB_ROOT_CHARS) +
    " · **0 lỗi console** · **0 lỗi trang** · **0 did-not-activate**. Cột overlay chỉ để RÀ (ROW-REVIEW C5);" +
    " khung shell data-shell-overlay đã bị loại vì nó luôn tồn tại ở cả bản gốc.");
  lines.push("");
  lines.push("| row | #root | lỗi console | lỗi trang | did-not-activate (trang) | did-not-activate (host) | overlay | slot | nút | kết luận |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const row of rows) {
    lines.push(
      "| " + row.row + " | " + String(row.rootChars) + " | " + String(row.consoleErrors.length) + " | " +
        String(row.pageErrors.length) + " | " + String(row.didNotActivate) + " | " + String(row.hostDidNotActivate ?? 0) +
        ((row.hostNotActivatedEntries ?? []).length > 0 ? " [" + (row.hostNotActivatedEntries ?? []).join(", ") + "]" : "") + " | " +
        String(row.overlays.length) + " | " +
        String(row.slotCount) + " | " + String(row.buttonCount) + " | " + row.verdict +
        (row.error !== undefined ? " (" + row.error + ")" : "") + " |",
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * Điểm vào dòng lệnh: nhận danh sách row, hoặc --all, hoặc --all --continue.
 * @param argv tham số sau tên script.
 * @returns mã thoát: 0 khi mọi row DAT, 1 khi có row KHONG DAT, 2 khi thiếu đối số.
 */
async function main(argv: readonly string[]): Promise<number> {
  const all = argv.includes("--all");
  const rows = all ? [...DEFAULT_ROWS] : argv.filter((arg) => !arg.startsWith("--"));
  if (rows.length === 0) {
    console.log("Dung: bun run tools/check/lab-evidence.ts <row...> | --all [--continue]");
    return 2;
  }
  const result = await runRows(rows, { continueOnArtifact: argv.includes("--continue") });
  const bad = result.filter((row) => row.verdict !== "DAT");
  console.log("");
  console.log("TONG: " + String(result.length) + " row · DAT " + String(result.length - bad.length) + " · KHONG DAT " + String(bad.length));
  if (bad.length > 0) console.log("Row KHONG DAT: " + bad.map((row) => row.row).join(", "));
  console.log("Bang: " + join(EVIDENCE_DIR, "summary.md"));
  return bad.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
