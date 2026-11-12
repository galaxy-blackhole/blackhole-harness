/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chạy ma trận ảnh A/B theo từng màn hình: cổng trạng thái, chụp hai bên, đo pixel, ghi artifact + tài liệu
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ensureDir, nowIso, parityPath, stamp } from "../parity/lib/paths.ts";

import { type SideSpec, captureSide, defaultSides, withFreshChrome } from "./lib/capture.ts";
import { type SideHealth, probeSideHealth } from "./lib/gate.ts";
import { type Cluster, annotateClusters, composePair, measurePair, scalePng } from "./lib/measure.ts";
import type { NetEntry } from "./lib/net.ts";
import { type ValidityReport, checkValidity } from "./lib/validity.ts";
import { SCENARIOS } from "./scenarios.ts";
import type {
  BootFingerprint,
  ElementRow,
  MaskRegion,
  Scenario,
  ScrollState,
  SideCapture,
  Viewport,
} from "./lib/types.ts";

/** Khung nhìn bắt buộc của ma trận: 1440x900 theo yêu cầu task-9. */
export const VIEWPORT: Viewport = Object.freeze({ name: "1440x900", width: 1440, height: 900 });

/** Phiên bản định dạng artifact của ma trận tính năng. */
export const FEATURE_FORMAT = 1;

/** Bề rộng ảnh thu nhỏ nhúng vào tài liệu (pixel). */
const THUMB_WIDTH = 720;

/** Tóm tắt một bên trong bản ghi (không chứa ảnh, không chứa secret). */
export interface SideSummary {
  /** Khoá bên. */
  key: string;
  /** Cổng server. */
  port: number;
  /** Tiêu đề tài liệu. */
  title: string;
  /** Mã HTTP. */
  httpStatus: number;
  /** Chụp được ảnh hay không. */
  ok: boolean;
  /** Lý do khi không chụp được. */
  error?: string;
  /** Số phần tử tương tác đọc được. */
  labelCount: number;
  /** Số hộp thoại một lần đã đóng (khác biệt trạng thái onboarding). */
  dismissed: number;
  /** Còn hộp thoại chặn thao tác lúc chụp. */
  blockedByDialog: boolean;
  /** Dấu hiệu bất thường trong chữ hiển thị. */
  symptoms: string[];
  /** Lỗi console. */
  consoleErrors: string[];
  /** Các bước không chạy được. */
  failedSteps: string[];
  /** true khi nội dung thật của màn hình đã tải xong. */
  ready: boolean;
  /** Mô tả điều kiện sẵn sàng và thời gian đã chờ. */
  readyNote: string;
  /** Request không phải asset tĩnh (đã lọc giá trị token) — bằng chứng mạng của bên này. */
  net: NetEntry[];
  /** Request còn treo lúc chụp ảnh. */
  pending: NetEntry[];
  /** Số asset tĩnh đã bỏ qua khi ghi nhật ký mạng. */
  staticAssets: number;
  /** Dấu vân tay cây plugin lúc chụp bên này. */
  fingerprint: BootFingerprint;
  /** Chữ tiêu đề đầu tiên (anchor vị trí dọc). */
  headingText: string;
  /** Toạ độ y tiêu đề đầu tiên, -1 nếu không có. */
  headingY: number;
  /** Trạng thái cuộn lúc chụp (đã đưa về 0). */
  scroll: ScrollState;
}

/** Bản ghi một màn hình trong ma trận. */
export interface ScenarioRecord {
  /** Khoá kịch bản. */
  id: string;
  /** Tên màn hình. */
  title: string;
  /** Nhóm chức năng. */
  group: string;
  /** Tính năng chứng minh. */
  feature: string;
  /** Ghi chú vận hành của kịch bản. */
  note?: string;
  /** Chế độ màu đã ép. */
  scheme: string;
  /** Kết luận: PASS đạt ngưỡng, FAIL lệch quá ngưỡng, SKIP không chụp/không đo được. */
  status: "PASS" | "FAIL" | "SKIP";
  /** Lý do khi SKIP. */
  skipReason?: string;
  /** Ảnh tham chiếu (tương đối repo). */
  refFile?: string;
  /** Ảnh của ta (tương đối repo). */
  oursFile?: string;
  /** Ảnh diff (tương đối repo). */
  diffFile?: string;
  /** Ảnh ghép cạnh nhau (tương đối repo). */
  pairFile?: string;
  /** Ảnh thu nhỏ để nhúng vào tài liệu (tương đối repo). */
  thumbFile?: string;
  /** Chiều rộng khung. */
  width: number;
  /** Chiều cao khung. */
  height: number;
  /** Số pixel khác nhau ngoài vùng mask. */
  diffPixels: number;
  /** Số pixel được so (đã trừ mask). */
  totalPixels: number;
  /** Tỉ lệ lệch ngoài mask (0..1). */
  ratio: number;
  /** Số pixel khác nhau khi bỏ qua mask (số thô). */
  rawDiffPixels: number;
  /** Tỉ lệ thô. */
  rawRatio: number;
  /** Số pixel nằm trong mask. */
  maskedPixels: number;
  /** Ngưỡng cho phép. */
  threshold: number;
  /** Vùng mask đã áp cho khung này. */
  masks: MaskRegion[];
  /** Các cụm pixel lệch còn lại ngoài mask kèm nhãn phần tử gần nhất. */
  clusters: Cluster[];
  /** Tóm tắt bên tham chiếu. */
  ref: SideSummary;
  /** Tóm tắt bên của ta. */
  ours: SideSummary;
  /** Nhãn phần tử tương tác chỉ có ở bên tham chiếu (khác biệt cấu trúc/trạng thái). */
  onlyInRef: string[];
  /** Nhãn phần tử tương tác chỉ có ở bên của ta. */
  onlyInOurs: string[];
  /**
   * Phần tử LẠ: có aria-label/role/data-testid ở bên này mà KHÔNG hề có ở bên kia (không phụ thuộc chữ).
   * Đây là lớp bắt lỗi "component render ra phần tử sai chỗ" mà cổng phía server không thấy
   * (ca thật: toast placeholder luôn hiện ⇒ 388 px lệch, check:app vẫn báo ĐẠT).
   */
  stray: { ours: StrayElement[]; ref: StrayElement[] };
  /** Sức khoẻ hai bên lúc chụp. */
  health: { ours: SideHealth; ref: SideHealth };
  /** Điều kiện sẵn sàng đã áp cho màn hình này (rỗng nghĩa là màn hình tĩnh). */
  readySpec: string;
  /** Nhật ký mạng hai bên (đã lọc token), tương đối repo. */
  netFile?: string;
  /** Cổng hợp lệ 4 điều kiện của từng bên (sidebar · composer · search · không chuỗi lỗi · ảnh không trắng). */
  validity: { ours: ValidityReport; ref: ValidityReport };
}

/** Một phần tử có khai báo aria/role/testid chỉ xuất hiện ở MỘT bên. */
export interface StrayElement {
  /** Khoá nhận dạng (tag|role|aria|testid). */
  key: string;
  /** Hộp bao trên ảnh chụp. */
  x: number;
  /** Toạ độ dọc. */
  y: number;
  /** Chiều rộng. */
  w: number;
  /** Chiều cao. */
  h: number;
}

/**
 * Khoá nhận dạng một phần tử, KHÔNG dùng chữ nội dung (chữ đổi theo trạng thái sống).
 * Nhận: một dòng inventory.
 * Trả: chuỗi khoá "tag|role|aria|testid".
 */
function strayKey(row: ElementRow): string {
  return [row.tag, row.role, row.aria, row.testid].join("|");
}

/**
 * Lọc ra các phần tử chỉ có ở một bên: bắt buộc phải có khai báo aria-label / role / data-testid
 * (phần tử trần không khai gì thì trùng khoá nhau gần hết nên không nói lên điều gì).
 * Nhận: inventory bên này và tập khoá của bên kia.
 * Trả: danh sách phần tử lạ kèm hộp bao.
 */
function strayElements(rows: ElementRow[], otherKeys: Set<string>): StrayElement[] {
  const seen = new Set<string>();
  const out: StrayElement[] = [];
  for (const row of rows) {
    if (row.aria === "" && row.role === "" && row.testid === "") continue;
    const key = strayKey(row);
    if (otherKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, x: row.x, y: row.y, w: row.w, h: row.h });
  }
  return out;
}

/** Artifact đầy đủ của một lần chạy ma trận. */
export interface FeatureArtifact {
  /** Phiên bản định dạng. */
  format: number;
  /** Dấu thời gian của lần chạy (dùng làm tên thư mục ảnh). */
  stamp: string;
  /** Bắt đầu (ISO). */
  startedAt: string;
  /** Kết thúc (ISO). */
  finishedAt: string;
  /** Khung nhìn đã dùng. */
  viewport: Viewport;
  /** Ngưỡng tỉ lệ pixel cho phép. */
  threshold: number;
  /** Nhãn hai bên. */
  sides: { ours: string; ref: string; oursPort: number; refPort: number };
  /** Thư mục ảnh (tương đối repo). */
  shotsDir: string;
  /** Bản ghi từng màn hình. */
  scenarios: ScenarioRecord[];
  /** Tổng hợp đếm theo kết luận. */
  totals: { pass: number; fail: number; skip: number; diffPixels: number; frames: number };
  /** Ghi chú chung của lần chạy. */
  notes: string[];
  /** Kết quả cổng trạng thái parity:health ở đầu và cuối lượt. */
  health: {
    /** Kết quả đầu lượt. */
    start: HealthRun;
    /** Kết quả cuối lượt. */
    end: HealthRun;
    /** true khi health đỏ hoặc cây plugin đổi giữa lượt. */
    contaminated: boolean;
    /** Kết luận ngắn để in lên tài liệu. */
    verdict: string;
  };
  /** Dấu vân tay trạng thái cây plugin của cả lượt: các trạng thái gặp phải và cờ nghi nhiễm. */
  fingerprint: {
    /** Các trạng thái cây khác nhau gặp trong lượt (mỗi trạng thái kèm số màn đo được). */
    states: { hash: string; rev: string; entries: number; batches: number; version: string; frames: number }[];
    /** true khi cây plugin ĐỔI giữa lượt — số liệu có thể bị nhiễm, phải đọc kèm cảnh báo. */
    changedDuringRun: boolean;
    /** Kết luận ngắn để in lên tài liệu. */
    verdict: string;
  };
}

/** Tuỳ chọn chạy ma trận. */
export interface RunOptions {
  /** Chỉ chạy các id này (rỗng = tất cả). */
  ids?: readonly string[];
  /** Chỉ chạy các nhóm này (rỗng = tất cả). */
  groups?: readonly string[];
  /** Thư mục ghi ảnh; mặc định .parity/features/<stamp>. */
  outDir?: string;
  /** Ngưỡng tỉ lệ pixel cho phép. */
  threshold?: number;
  /** Số lần thử lại khi cổng trạng thái hoặc dấu hiệu bất thường chưa sạch. */
  attempts?: number;
  /** Tuổi tối thiểu của instance (giây) trước khi chụp. */
  minUptimeSeconds?: number;
  /** Có sinh docs/UI-PARITY.md hay không. */
  writeDoc?: boolean;
  /** Im lặng khi chạy từng kịch bản. */
  quiet?: boolean;
  /** Thư mục cha chứa các lần chạy, mặc định .parity/features. */
  rootDir?: string;
}

/**
 * In một dòng log có tiền tố của ma trận tính năng.
 * Nhận: các phần sẽ nối bằng khoảng trắng.
 * Trả: không trả gì.
 */
export function log(...parts: unknown[]): void {
  console.log("[features]", ...parts);
}

/**
 * In chỉ số PHẦN TỬ LẠ của một khung: phần tử có aria/role/testid chỉ xuất hiện ở một bên.
 * Nhận: bản ghi khung và hàm log.
 * Trả: không trả gì; in tối đa 3 ví dụ mỗi bên để truy toạ độ ngay trên log.
 */
export function logStray(record: ScenarioRecord): void {
  const ours = record.stray.ours;
  const ref = record.stray.ref;
  const head = "[features]   phần tử lạ so với ref: ours +" + String(ours.length) + " · ref +" + String(ref.length);
  const sample = (items: StrayElement[], side: string): string[] =>
    items.slice(0, 3).map((item) => side + " " + item.key + " @ " + String(item.x) + "," + String(item.y) + " " + String(item.w) + "x" + String(item.h));
  log(head, ...sample(ours, "·"), ...sample(ref, "·"));
}

/**
 * Rút gọn kết quả chụp một bên thành bản ghi không chứa ảnh.
 * Nhận: kết quả chụp của một bên.
 * Trả: bản tóm tắt dùng cho summary.json và tài liệu.
 */
export function summariseSide(captureSideResult: SideCapture): SideSummary {
  return {
    key: captureSideResult.key,
    port: captureSideResult.port,
    title: captureSideResult.title,
    httpStatus: captureSideResult.httpStatus,
    ok: captureSideResult.ok,
    error: captureSideResult.error,
    labelCount: captureSideResult.labels.length,
    dismissed: captureSideResult.dismissed,
    blockedByDialog: captureSideResult.blockedByDialog,
    symptoms: captureSideResult.symptoms,
    consoleErrors: captureSideResult.consoleErrors,
    failedSteps: captureSideResult.steps.filter((step) => !step.ok).map((step) => step.label),
    fingerprint: captureSideResult.fingerprint,
    headingText: captureSideResult.headingText,
    headingY: captureSideResult.headingY,
    scroll: captureSideResult.scroll,
    ready: captureSideResult.ready,
    readyNote: captureSideResult.readyNote,
    net: captureSideResult.net,
    pending: captureSideResult.pending,
    staticAssets: captureSideResult.staticAssets,
  };
}

/** Kết quả một lần gọi giàn parity:health. */
export interface HealthRun {
  /** Thời điểm gọi (ISO). */
  at: string;
  /** 0 = mọi cổng lành, 1 = có cổng không lành, 2 = thời điểm đo nằm trong cửa sổ không hợp lệ, -1 = không chạy được. */
  exitCode: number;
  /** Các dòng kết quả của parity:health. */
  output: string[];
}

/**
 * Gọi parity:health của giàn parity cho hai cổng và thu kết quả (không in secret — health chỉ in trạng thái).
 * Nhận: danh sách cổng cần kiểm.
 * Trả: { at, exitCode, output } — exitCode 0 là lành, 1 là có cổng hỏng, 2 là cửa sổ đo không hợp lệ.
 */
export function runParityHealth(ports: readonly number[]): HealthRun {
  const at = nowIso();
  const result = spawnSync(
    process.versions.bun !== undefined ? process.execPath : "bun",
    ["run", "tools/parity/health.ts", ...ports.map((port) => String(port))],
    { cwd: parityPath(".."), encoding: "utf8", timeout: 120_000 },
  );
  const output = (result.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (result.error !== undefined) output.push("không chạy được parity:health: " + result.error.message);
  return { at, exitCode: result.status ?? -1, output };
}

/**
 * Ghi một ảnh PNG vào thư mục artifact và trả đường dẫn tương đối repo.
 * Nhận: thư mục đích, tên file, buffer PNG.
 * Trả: đường dẫn tương đối tính từ gốc repo (dấu /).
 */
function writeShot(dir: string, name: string, png: Buffer): string {
  writeFileSync(join(dir, name), png);
  return relToRepo(join(dir, name));
}

/**
 * Đổi đường dẫn tuyệt đối trong repo thành đường dẫn tương đối repo (dấu /).
 * Nhận: đường dẫn tuyệt đối.
 * Trả: đường dẫn tương đối tính từ gốc repo, ví dụ .parity/features/<stamp>/ref-x.png.
 */
function relToRepo(abs: string): string {
  const root = parityPath("..");
  return abs.replace(root, "").replaceAll("\\", "/").replace(/^\//u, "");
}

/**
 * Ghi nhật ký mạng hai bên của một màn hình ra file JSON (đã lọc token/khoá bí mật).
 * Nhận: thư mục artifact, id kịch bản, kết quả chụp hai bên.
 * Trả: đường dẫn tương đối repo của file net-<id>.json.
 */
function writeNetFile(
  dir: string,
  id: string,
  refSide: SideCapture,
  oursSide: SideCapture,
): string {
  const payload = {
    id,
    note: "URL đã lọc giá trị token/khoá; chỉ giữ request KHÔNG phải asset tĩnh (document/xhr/fetch/websocket).",
    ref: { port: refSide.port, staticAssets: refSide.staticAssets, pending: refSide.pending, entries: refSide.net },
    ours: { port: oursSide.port, staticAssets: oursSide.staticAssets, pending: oursSide.pending, entries: oursSide.net },
  };
  const file = join(dir, "net-" + id + ".json");
  writeFileSync(file, JSON.stringify(payload, null, 1));
  return relToRepo(file);
}

/**
 * Chạy một kịch bản: cổng trạng thái hai bên, chụp cặp ảnh bằng profile Chrome MỚI, đo pixel và ghi ảnh.
 * Nhận: kịch bản, hai bên, thư mục artifact, dấu thời gian và tuỳ chọn chạy.
 * Trả: bản ghi của màn hình (status PASS/FAIL/SKIP kèm lý do khi SKIP).
 */
async function runScenario(
  scenario: Scenario,
  sides: { ours: SideSpec; ref: SideSpec },
  dir: string,
  runStamp: string,
  options: RunOptions,
): Promise<ScenarioRecord> {
  const threshold = options.threshold ?? 0.001;
  const attempts = Math.max(1, options.attempts ?? 2);
  let lastReason = "chưa chạy";
  let health: { ours: SideHealth; ref: SideHealth } = {
    ours: { key: "ours", port: sides.ours.port, httpStatus: 0, pid: null, uptimeSeconds: null, ok: false, notes: [] },
    ref: { key: "ref", port: sides.ref.port, httpStatus: 0, pid: null, uptimeSeconds: null, ok: false, notes: [] },
  };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const oursHealth = await probeSideHealth(sides.ours, options.minUptimeSeconds ?? 10, 30_000);
    const refHealth = await probeSideHealth(sides.ref, options.minUptimeSeconds ?? 10, 30_000);
    health = { ours: oursHealth, ref: refHealth };
    if (!oursHealth.ok || !refHealth.ok) {
      lastReason =
        "cổng trạng thái không đạt — ours: " + (oursHealth.notes.join("; ") || "ok") +
        " · ref: " + (refHealth.notes.join("; ") || "ok");
      continue;
    }
    let capture: { refSide: SideCapture; oursSide: SideCapture };
    try {
      capture = await withFreshChrome(runStamp + "-" + scenario.id + "-t" + String(attempt), async (session) => {
        const refSide = await captureSide(session, sides.ref, scenario, VIEWPORT);
        const oursSide = await captureSide(session, sides.ours, scenario, VIEWPORT);
        return { refSide, oursSide };
      });
    } catch (error) {
      // Lỗi hạ tầng trình duyệt (Chrome chết, hết bộ nhớ...) → bỏ màn này, KHÔNG làm sập cả lượt.
      lastReason = "lỗi hạ tầng trình duyệt: " + (error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error));
      continue;
    }
    const symptoms = [...capture.refSide.symptoms, ...capture.oursSide.symptoms];
    if (!capture.refSide.ok || !capture.oursSide.ok) {
      lastReason = "không chụp được — ref: " + (capture.refSide.error ?? "ok") + " · ours: " + (capture.oursSide.error ?? "ok");
      continue;
    }
    const notReady = !capture.refSide.ready || !capture.oursSide.ready;
    const pending = [...capture.refSide.pending, ...capture.oursSide.pending];
    if ((symptoms.length > 0 || notReady || pending.length > 0) && attempt < attempts) {
      lastReason =
        (symptoms.length > 0 ? "trang có dấu hiệu bất thường: " + [...new Set(symptoms)].join(" · ") + " · " : "") +
        (notReady ? "nội dung chưa tải: " + capture.refSide.readyNote + " | " + capture.oursSide.readyNote + " · " : "") +
        (pending.length > 0 ? "request treo: " + pending.map((entry) => entry.method + " " + entry.url).join(", ") : "");
      continue;
    }
    const refPng = capture.refSide.png ?? Buffer.alloc(0);
    const oursPng = capture.oursSide.png ?? Buffer.alloc(0);
    // Cổng HỢP LỆ (Lead chốt): không đạt thì ghi SKIP kèm lý do, tuyệt đối không tính PASS/FAIL.
    const spec = scenario.validity ?? {};
    const oursValidity = checkValidity({
      rows: capture.oursSide.inventory,
      png: oursPng,
      symptoms: capture.oursSide.symptoms,
      spec,
      masks: scenario.masks,
    });
    const refValidity = checkValidity({
      rows: capture.refSide.inventory,
      png: refPng,
      symptoms: capture.refSide.symptoms,
      spec,
      masks: scenario.masks,
    });
    if ((!oursValidity.ok || !refValidity.ok) && attempt < attempts) {
      lastReason =
        "cổng hợp lệ không đạt — ours: " + (oursValidity.reasons.join("; ") || "ok") +
        " · ref: " + (refValidity.reasons.join("; ") || "ok");
      continue;
    }
    const { measurement, diffPng } = measurePair(refPng, oursPng, scenario.masks, VIEWPORT, threshold);
    const clusters = annotateClusters(measurement.clusters, capture.oursSide.inventory);
    const refFile = writeShot(dir, "ref-" + scenario.id + ".png", refPng);
    const oursFile = writeShot(dir, "ours-" + scenario.id + ".png", oursPng);
    const diffFile = writeShot(dir, "diff-" + scenario.id + ".png", diffPng);
    const pairPng = composePair(refPng, oursPng);
    const pairFile = writeShot(dir, "pair-" + scenario.id + ".png", pairPng);
    const thumbFile = writeShot(dir, "thumb-" + scenario.id + ".png", scalePng(pairPng, THUMB_WIDTH));
    writeFileSync(
      join(dir, "inventory-" + scenario.id + ".json"),
      JSON.stringify({ ref: capture.refSide.inventory, ours: capture.oursSide.inventory }, null, 1),
    );
    const refLabels = new Set(capture.refSide.labels);
    const oursLabels = new Set(capture.oursSide.labels);
    const netFile = writeNetFile(dir, scenario.id, capture.refSide, capture.oursSide);
    // Trạng thái "chưa tải xong" hoặc "app đang ở lượt boot lỗi" KHÔNG phải khác biệt giao diện:
    // vẫn giữ ảnh làm bằng chứng nhưng ghi SKIP kèm lý do, đúng yêu cầu của Lead.
    const blockers: string[] = [];
    if (!oursValidity.ok) blockers.push("KHÔNG HỢP LỆ (ours): " + oursValidity.reasons.join("; "));
    if (!refValidity.ok) blockers.push("KHÔNG HỢP LỆ (ref): " + refValidity.reasons.join("; "));
    if (symptoms.length > 0) blockers.push("dấu hiệu bất thường trên trang: " + [...new Set(symptoms)].join(", "));
    if (notReady) blockers.push("nội dung chưa tải — ref: " + capture.refSide.readyNote + " · ours: " + capture.oursSide.readyNote);
    if (pending.length > 0) blockers.push("request còn treo: " + pending.map((entry) => entry.method + " " + entry.url).join(", "));
    return {
      id: scenario.id,
      title: scenario.title,
      group: scenario.group,
      feature: scenario.feature,
      note: scenario.note,
      scheme: scenario.scheme ?? "light",
      status: blockers.length > 0 ? "SKIP" : measurement.pass ? "PASS" : "FAIL",
      skipReason: blockers.length > 0
        ? blockers.join(" · ") + " (KHÔNG tính là khác biệt giao diện; ảnh vẫn giữ làm bằng chứng)"
        : undefined,
      readySpec: capture.oursSide.readyNote,
      netFile,
      validity: { ours: oursValidity, ref: refValidity },
      refFile,
      oursFile,
      diffFile,
      pairFile,
      thumbFile,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      diffPixels: measurement.diff.diffPixels,
      totalPixels: measurement.diff.totalPixels,
      ratio: measurement.diff.ratio,
      rawDiffPixels: measurement.diff.rawDiffPixels,
      rawRatio: measurement.diff.rawRatio,
      maskedPixels: measurement.maskedPixels,
      threshold,
      masks: [...scenario.masks],
      clusters,
      ref: summariseSide(capture.refSide),
      ours: summariseSide(capture.oursSide),
      onlyInRef: [...refLabels].filter((label) => !oursLabels.has(label)),
      onlyInOurs: [...oursLabels].filter((label) => !refLabels.has(label)),
      // Phần tử LẠ: so theo khoá tag|role|aria|testid (bỏ chữ) — bắt được lớp lỗi "render ra phần tử sai".
      stray: {
        ours: strayElements(capture.oursSide.inventory, new Set(capture.refSide.inventory.map(strayKey))),
        ref: strayElements(capture.refSide.inventory, new Set(capture.oursSide.inventory.map(strayKey))),
      },
      health,
    };
  }
  const emptySide: SideSummary = {
    key: "ours",
    port: sides.ours.port,
    title: "",
    httpStatus: 0,
    ok: false,
    labelCount: 0,
    dismissed: 0,
    blockedByDialog: false,
    symptoms: [],
    consoleErrors: [],
    failedSteps: [],
    ready: false,
    readyNote: "",
    net: [],
    pending: [],
    staticAssets: 0,
    fingerprint: { rev: "", entries: 0, batches: 0, hash: "", version: "" },
    headingText: "",
    headingY: -1,
    scroll: { documentBefore: 0, documentAfter: 0, regions: [] },
  };
  return {
    id: scenario.id,
    title: scenario.title,
    group: scenario.group,
    feature: scenario.feature,
    note: scenario.note,
    scheme: scenario.scheme ?? "light",
    status: "SKIP",
    skipReason: lastReason,
    readySpec: scenario.ready?.description ?? "trang tĩnh — chỉ cần tải xong",
    netFile: undefined,
    validity: {
      ours: { ok: false, checks: [], notes: [], reasons: [lastReason] },
      ref: { ok: false, checks: [], notes: [], reasons: [lastReason] },
    },
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    diffPixels: -1,
    totalPixels: 0,
    ratio: 1,
    rawDiffPixels: -1,
    rawRatio: 1,
    maskedPixels: 0,
    threshold,
    masks: [...scenario.masks],
    clusters: [],
    ref: { ...emptySide, key: "ref", port: sides.ref.port },
    ours: emptySide,
    onlyInRef: [],
    onlyInOurs: [],
    stray: { ours: [], ref: [] },
    health,
  };
}

/**
 * Chạy toàn bộ ma trận ảnh theo tính năng và ghi artifact.
 * Nhận: tuỳ chọn chạy (danh sách id/nhóm, ngưỡng, số lần thử, nơi ghi).
 * Trả: artifact đầy đủ; đồng thời ghi summary.json và (mặc định) docs/UI-PARITY.md.
 */
export async function runMatrix(options: RunOptions = {}): Promise<FeatureArtifact> {
  const startedAt = nowIso();
  const runStamp = stamp();
  const root = options.rootDir ?? parityPath("features");
  const dir = ensureDir(options.outDir ?? join(root, runStamp));
  const sides = defaultSides();
  const wanted = SCENARIOS.filter((scenario) => {
    if (options.ids !== undefined && options.ids.length > 0 && !options.ids.includes(scenario.id)) return false;
    if (options.groups !== undefined && options.groups.length > 0 && !options.groups.includes(scenario.group)) return false;
    return true;
  });
  const ports = [sides.ours.port, sides.ref.port];
  const healthStart = runParityHealth(ports);
  if (options.quiet !== true) log("parity:health (đầu lượt) →", String(healthStart.exitCode), "·", healthStart.output.join(" | ").slice(0, 200));
  const records: ScenarioRecord[] = [];
  for (const scenario of wanted) {
    if (options.quiet !== true) log("chụp", scenario.id, "·", scenario.title);
    const record = await runScenario(scenario, sides, dir, runStamp, options);
    records.push(record);
    if (options.quiet !== true) {
      log(
        "  ->",
        record.status,
        record.status === "SKIP" ? (record.skipReason ?? "") : "lệch " + String(record.diffPixels) + "/" + String(record.totalPixels) + " px ngoài mask",
        "· anchor y: ref " + String(record.ref.headingY) + " / ours " + String(record.ours.headingY),
        "· cây " + (record.ours.fingerprint.hash || "?"),
      );
      if (record.status !== "SKIP") logStray(record);
    }
  }
  const states = new Map<string, { hash: string; rev: string; entries: number; batches: number; version: string; frames: number }>();
  for (const record of records) {
    const print = record.ours.fingerprint;
    if (print.hash === "") continue;
    const existing = states.get(print.hash);
    if (existing === undefined) {
      states.set(print.hash, {
        hash: print.hash,
        rev: print.rev,
        entries: print.entries,
        batches: print.batches,
        version: print.version,
        frames: 1,
      });
    } else {
      existing.frames += 1;
    }
  }
  const healthEnd = runParityHealth(ports);
  const stateList = [...states.values()].sort((a, b) => b.frames - a.frames);
  const dominant = stateList[0];
  const contaminated = healthStart.exitCode !== 0 || healthEnd.exitCode !== 0 || stateList.length > 1;
  writeFileSync(
    join(dir, "health.json"),
    JSON.stringify(
      {
        note: "Kết quả parity:health ở đầu và cuối lượt; kèm dấu vân tay cây plugin của mỗi bên.",
        start: healthStart,
        end: healthEnd,
        fingerprints: stateList,
        contaminated,
        verdict: contaminated
          ? "NGHI NHIỄM: health đỏ hoặc cây plugin đổi giữa lượt — chỉ dùng số liệu để tham chiếu"
          : "lành: health xanh ở cả hai đầu và cây plugin không đổi trong suốt lượt",
      },
      null,
      1,
    ),
  );
  if (options.quiet !== true) log("parity:health (cuối lượt) →", String(healthEnd.exitCode), "·", healthEnd.output.join(" | ").slice(0, 200));
  const fingerprint = {
    states: stateList,
    changedDuringRun: stateList.length > 1,
    verdict:
      stateList.length === 0
        ? "không đọc được dấu vân tay (trang không có __DSH_BOOT__)"
        : stateList.length > 1
          ? "NGHI NHIỄM: cây plugin đổi giữa lượt (" + String(stateList.length) + " trạng thái khác nhau) — số liệu chỉ dùng để tham chiếu"
          : "sạch: toàn lượt đo trên MỘT trạng thái cây — rev " + (dominant?.rev ?? "") + " · " +
            String(dominant?.entries ?? 0) + " entry · " + String(dominant?.batches ?? 0) + " batch · hash " +
            (dominant?.hash ?? ""),
  };
  const artifact: FeatureArtifact = {
    format: FEATURE_FORMAT,
    fingerprint,
    health: {
      start: healthStart,
      end: healthEnd,
      contaminated,
      verdict: contaminated
        ? "NGHI NHIỄM: parity:health đỏ hoặc cây plugin đổi giữa lượt — số liệu chỉ để tham chiếu"
        : "lành: parity:health xanh ở cả hai đầu và cây plugin không đổi trong suốt lượt",
    },
    stamp: runStamp,
    startedAt,
    finishedAt: nowIso(),
    viewport: VIEWPORT,
    threshold: options.threshold ?? 0.001,
    sides: { ours: sides.ours.label, ref: sides.ref.label, oursPort: sides.ours.port, refPort: sides.ref.port },
    shotsDir: dir.replace(parityPath(".."), "").replaceAll("\\", "/").replace(/^\//u, ""),
    scenarios: records,
    totals: {
      pass: records.filter((record) => record.status === "PASS").length,
      fail: records.filter((record) => record.status === "FAIL").length,
      skip: records.filter((record) => record.status === "SKIP").length,
      diffPixels: records.reduce((sum, record) => sum + Math.max(0, record.diffPixels), 0),
      frames: records.filter((record) => record.status !== "SKIP").length,
    },
    notes: [
      "Mỗi kịch bản chạy bằng một profile Chrome MỚI dưới thư mục tạm (.parity/tmp) và LUÔN đóng trong finally.",
      "Cookie phiên mint trong bộ nhớ từ credentials dùng chung; giá trị cookie/secret không được in hay ghi.",
      "Cổng trạng thái: HTTP 200 + instance đã lên >= 10 giây; không đạt thì SKIP kèm lý do, không tính là khác biệt giao diện.",
      "Dấu vân tay cây plugin (rev + số entry + hash danh sách entry) đọc từ __DSH_BOOT__ ngay lúc chụp và ghi vào từng màn; lượt nào đổi cây giữa chừng bị đánh dấu NGHI NHIỄM.",
    ],
  };
  writeFileSync(join(dir, "summary.json"), JSON.stringify(artifact, null, 1));
  writeFileSync(parityPath("features", "latest.json"), JSON.stringify(artifact, null, 1));
  if (options.writeDoc !== false) {
    const { renderUiParityDoc } = await import("./matrix.ts");
    renderUiParityDoc(artifact);
  }
  return artifact;
}

/**
 * In bảng tóm tắt ma trận ra console.
 * Nhận: artifact của lần chạy.
 * Trả: không trả gì.
 */
export function printSummary(artifact: FeatureArtifact): void {
  console.log("");
  console.log("=== MA TRẬN ẢNH A/B THEO TÍNH NĂNG — " + artifact.stamp + " ===");
  console.log("| màn hình | nhóm | px lệch ngoài mask | ngưỡng | kết luận |");
  console.log("|---|---|---|---|---|");
  for (const record of artifact.scenarios) {
    const cell =
      record.status === "SKIP"
        ? "—"
        : String(record.diffPixels) + "/" + String(record.totalPixels) + " (" + (record.ratio * 100).toFixed(3) + "%)";
    console.log(
      "| " + record.title + " | " + record.group + " | " + cell + " | " +
        (record.threshold * 100).toFixed(1) + "% | " + record.status + " |",
    );
  }
  console.log("");
  console.log(
    "Tổng: " + String(artifact.totals.pass) + " PASS · " + String(artifact.totals.fail) + " FAIL · " +
      String(artifact.totals.skip) + " SKIP · tổng pixel lệch " + String(artifact.totals.diffPixels),
  );
  console.log("Ảnh: " + artifact.shotsDir);
}

/**
 * Điểm vào dòng lệnh: --ids a,b · --groups x,y · --out <dir> · --threshold 0.001 · --json · --no-doc.
 * Nhận: tham số dòng lệnh sau tên script.
 * Trả: mã thoát 0 khi chạy xong (1 nếu --strict và có màn hình FAIL).
 */
export async function main(argv: string[]): Promise<number> {
  const at = (key: string): string | null => {
    const index = argv.indexOf(key);
    return index >= 0 ? argv[index + 1] ?? null : null;
  };
  const listOf = (value: string | null): string[] =>
    value === null ? [] : value.split(",").map((item) => item.trim()).filter((item) => item !== "");
  const artifact = await runMatrix({
    ids: listOf(at("--ids")),
    groups: listOf(at("--groups")),
    outDir: at("--out") ?? undefined,
    threshold: at("--threshold") === null ? undefined : Number(at("--threshold")),
    attempts: at("--attempts") === null ? undefined : Number(at("--attempts")),
    minUptimeSeconds: at("--min-uptime") === null ? undefined : Number(at("--min-uptime")),
    quiet: argv.includes("--quiet"),
    writeDoc: !argv.includes("--no-doc"),
  });
  if (argv.includes("--json")) console.log(JSON.stringify(artifact, null, 1));
  else printSummary(artifact);
  return argv.includes("--strict") && artifact.totals.fail > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
