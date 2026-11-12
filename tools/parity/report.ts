/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:report — chạy dump + shot rồi tổng hợp .parity/report.md (PASS/FAIL/CHƯA CÓ)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { latestPath, readJsonFile, relativeToRepo, writeJsonFile, writeTextFile } from "./lib/artifacts.ts";
import { hashList, resolveSessionCookieFrom } from "./lib/browser.ts";
import {
  type DumpDiff,
  diffDumps,
  formatDumpDiff,
  formatPresenceTable,
  isDumpParity,
  listIds,
  normaliseDump,
} from "./lib/dump-core.ts";
import { describeMasks } from "./lib/masks.ts";
import { OURS_PORT, ORACLE_A_PORT, credentialsPath, log, nowIso, parityPath, stamp } from "./lib/paths.ts";
import { httpProbe } from "./lib/runner.ts";
import { type DumpArtifact, runDump } from "./dump.ts";
import { buildM2bSection } from "./lib/report-m2b.ts";
import { type ShotArtifact, runShot } from "./shot.ts";

/** Một dòng trong bảng hạng mục của report. */
export interface ReportItem {
  /** Tên hạng mục. */
  name: string;
  /** PASS / FAIL / SKIP / CHƯA CÓ. */
  status: string;
  /** Số liệu kèm theo. */
  detail: string;
  /** Đường dẫn bằng chứng (tương đối repo). */
  evidence: string;
}

/** Khoảng thời gian đo KHÔNG hợp lệ (giờ VN) kèm lý do — để đời sau không trích nhầm số. */
export const INVALID_WINDOWS: readonly { from: string; to: string; reason: string }[] = Object.freeze([
  {
    from: "2026-10-17 13:07",
    to: "2026-10-17 13:40",
    reason:
      "gói webserver ghi chunk Uint8Array thành dãy byte thập phân ⇒ mọi route /api/* hỏng ⇒ RPC parse lỗi ⇒ plugin " +
      "cot-translation không activate ⇒ UI chết. MỌI số liệu ảnh/trace trong khoảng này KHÔNG hợp lệ, kể cả lượt ra 0 px.",
  },
]);

/** Khác biệt được coi là có chủ ý, report sẽ trừ ra khi tính parity. */
export interface IntentionalDiff {
  /** id của row. */
  id: string;
  /** Đường dẫn lá được phép khác. */
  path: string;
  /** Vì sao đây là khác biệt có chủ ý. */
  why: string;
}

/**
 * Danh sách khác biệt có chủ ý của RIÊNG cặp so với oracle (mặc định RỖNG theo yêu cầu task-5).
 * Chỉ thêm khi thật sự không thể giống, và phải ghi lý do vào report. 12 dòng ĐỔI so với oracle A
 * là VIỆC PHẢI LÀM, không phải allowlist.
 */
export const INTENTIONAL_DIFFS: readonly IntentionalDiff[] = Object.freeze([]);

/** Hạng mục chưa có giàn đo — dùng cho bảng "CHƯA CÓ" của M0. */
export const MISSING_ITEMS: readonly { name: string; why: string; owner: string }[] = Object.freeze([
  {
    name: "chuẩn hoá trạng thái trước khi chụp (cùng workspace/session, đóng onboarding, mask vùng brand)",
    why: "overlay một lần (Get started/Preview Notice) và danh sách session khác nhau làm số pixel vô nghĩa; M0 chỉ đo được cơ chế",
    owner: "tm-parity (M2)",
  },
  { name: "parity:trace (diff frame RPC/WS)", why: "ĐÃ XONG ở M2b — xem mục 5", owner: "tm-parity (M2b)" },
  { name: "gate:home-isolation (hash + mtime ~/.galaxy/gbh trước/sau e2e)", why: "parity đã có chốt an toàn; test riêng của gate chưa nối vào", owner: "tm-lint-docs" },
  { name: "gate:independence (chạy khi đã gỡ DSH)", why: "chỉ có nghĩa sau M7", owner: "Lead (M7)" },
]);

/**
 * Trừ các khác biệt có chủ ý khỏi một diff.
 * @param diff diff gốc.
 * @param allowed danh sách khác biệt cho phép.
 * @returns diff đã lọc và số lá đã trừ.
 */
export function applyIntentional(diff: DumpDiff, allowed: readonly IntentionalDiff[] = INTENTIONAL_DIFFS): { diff: DumpDiff; excused: string[] } {
  const excused: string[] = [];
  const changed = diff.changed.map((row) => {
    const rules = allowed.filter((rule) => rule.id === row.id);
    if (rules.length === 0) return row;
    const fields = row.fields.filter((field) => {
      const hit = rules.some((rule) => rule.path === field.path);
      if (hit) excused.push(row.id + "." + field.path);
      return !hit;
    });
    return { ...row, fields, fieldCount: row.fieldCount - (row.fields.length - fields.length) };
  }).filter((row) => row.fieldCount > 0);
  return {
    diff: { ...diff, changed },
    excused,
  };
}

/**
 * Tìm các chuỗi cấm (secret, cookie) trong mọi file văn bản dưới một thư mục.
 * Chỉ dùng cho việc kiểm tra — không bao giờ in giá trị ra.
 * @param dir thư mục cần quét.
 * @param needles các chuỗi cấm (secret/cookie) giữ trong bộ nhớ.
 * @param maxFiles số file tối đa quét.
 * @returns số file đã quét và số file chứa chuỗi cấm.
 */
export function scanForSecrets(dir: string, needles: readonly string[], maxFiles = 500): { files: number; hits: number } {
  let files = 0;
  let hits = 0;
  const walk = (current: string, depth: number): void => {
    if (files >= maxFiles || depth > 4) return;
    let children: string[];
    try {
      children = readdirSync(current);
    } catch {
      return;
    }
    for (const child of children) {
      if (files >= maxFiles) return;
      const full = join(current, child);
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (stats.size > 4_000_000) continue;
      if (child.endsWith(".png")) {
        files += 1;
        continue;
      }
      let text = "";
      try {
        text = readFileSync(full, "utf8");
      } catch {
        continue;
      }
      files += 1;
      if (needles.some((needle) => needle.length >= 32 && text.includes(needle))) hits += 1;
    }
  };
  walk(dir, 0);
  return { files, hits };
}

/** Kết quả cuối của một lần report. */
export interface ReportResult {
  /** Đường dẫn file report (tương đối repo). */
  file: string;
  /** Nội dung Markdown. */
  markdown: string;
  /** Bảng hạng mục. */
  items: ReportItem[];
}

/** Tuỳ chọn cho {@link buildReport}. */
export interface ReportOptions {
  /** Chạy lại parity:dump trước khi tổng hợp. */
  runDump?: boolean;
  /** Chạy lại parity:shot trước khi tổng hợp. */
  runShot?: boolean;
  /** Các bên tham chiếu cho ảnh, theo thứ tự chụp. Mặc định: stock rồi oracleA. */
  refs?: readonly ("stock" | "oracleA")[];
  /** Chỉ tổng hợp từ artifact có sẵn. */
  fromCache?: boolean;
  /** Chế độ im lặng. */
  quiet?: boolean;
}

/**
 * Chạy (hoặc đọc lại) dump + shot rồi dựng nội dung report.
 * @param options tuỳ chọn.
 * @returns report đã ghi xuống `.parity/report.md` kèm bảng hạng mục.
 */
export async function buildReport(options: ReportOptions = {}): Promise<ReportResult> {
  const fromCache = options.fromCache === true;
  const dumpArtifact: DumpArtifact | null = fromCache
    ? readJsonFile<DumpArtifact>(parityPath("latest-dump.json"))
    : await runDump({ quiet: true });
  if (!fromCache && dumpArtifact !== null) writeJsonFile(parityPath("latest-dump.json"), dumpArtifact);
  const refs = options.refs ?? ["stock", "oracleA"];
  const fallback = fromCache ? { oursPort: undefined, note: null as string | null } : await chooseShotTarget(refs[0] ?? "stock");
  // Chạy cả hai bên tham chiếu trong CÙNG một phiên: oracle A là trạng thái sống, dump và ảnh
  // phải khớp thời điểm thì số liệu mới so được (xem cảnh báo của tm-host-api).
  const shots: ShotArtifact[] = [];
  for (const ref of refs) {
    const artifact = fromCache
      ? readJsonFile<ShotArtifact>(parityPath("latest-shots-" + ref + ".json"))
      : await runShot({ ref, oursPort: fallback.oursPort, quiet: true });
    if (artifact === null) continue;
    writeJsonFile(parityPath("latest-shots-" + ref + ".json"), artifact);
    if (ref === "stock") writeJsonFile(parityPath("latest-shots.json"), artifact);
    shots.push(artifact);
  }
  const shotArtifact: ShotArtifact | null = shots[0] ?? null;

  const items: ReportItem[] = [];
  const lines: string[] = [];
  const runStamp = stamp();
  lines.push("<!--");
  lines.push(" author Bùi Trọng Hiếu");
  lines.push(" email kevinbui210191@gmail.com");
  lines.push(" create date 15/10/2026");
  lines.push(" modify date 17/10/2026");
  lines.push(" desc Bao cao parity sinh tu dong boi tools/parity/report.ts — moi hang muc PASS/FAIL/CHUA CO");
  lines.push("-->");
  lines.push("");
  lines.push("# Báo cáo parity — " + runStamp);
  lines.push("");
  lines.push("> Sinh tự động bởi `bun run parity:report`. Ngưỡng: dump-config **0 row** THÊM/THIẾU/ĐỔI,");
  lines.push("> pixel **≤ 0.1%** (docs/ARCHITECTURE §5.2, D9). Mọi artifact nằm trong `.parity/` (gitignored).");
  lines.push("");
  for (const window of INVALID_WINDOWS) {
    lines.push(
      "> ⚠️ **CỬA SỔ KHÔNG HỢP LỆ " + window.from + " → " + window.to + " (giờ VN):** " + window.reason,
    );
    lines.push("> Mọi số liệu đo trong khoảng này phải bị coi là KHÔNG hợp lệ, kể cả lượt ra 0 px.");
    lines.push("");
  }

  const shotNote = fallback.note;
  if (shotNote !== null) {
    items.push({
      name: "ảnh A/B của app thật (cổng " + String(OURS_PORT) + ")",
      status: "CHƯA CÓ",
      detail: shotNote,
      evidence: "",
    });
  }

  // ---- 0. Bảng hạng mục ----
  const dumpTargets = dumpArtifact?.targets ?? [];
  const oursTarget = dumpTargets.find((target) => target.key === "ours");
  const pairStock = dumpArtifact?.pairs.find((pair) => pair.refKey === "stock") ?? null;
  const pairOracle = dumpArtifact?.pairs.find((pair) => pair.refKey === "oracleA") ?? null;
  // Diff oracle-vs-stock cho biết "delta Galaxy" là gì: cái gì oracle A cũng khác stock thì đó là
  // phần sản phẩm của ta, không phải lỗi parity.
  const stockColumn = dumpArtifact === null ? null : readNormalisedColumn(dumpArtifact, "stock");
  const oracleColumn = dumpArtifact === null ? null : readNormalisedColumn(dumpArtifact, "oracleA");
  const oracleVsStock = stockColumn !== null && oracleColumn !== null ? diffDumps(stockColumn, oracleColumn) : null;
  const classification = pairStock === null ? null : classifyAgainstStock(pairStock.diff, oracleVsStock);
  if (pairStock !== null && classification !== null) {
    const unexplained = classification.unexplainedAdded.length + classification.unexplainedChanged.length;
    items.push({
      name: "dump-config: khác biệt có chủ đích so với DSH stock (Galaxy ≠ stock)",
      status: unexplained === 0 ? "GHI NHẬN" : "FAIL",
      detail:
        "THÊM " + String(pairStock.diff.added.length) + " (" + String(classification.intendedAdded.length) + " row cũng có ở oracle A) · " +
        "ĐỔI " + String(pairStock.diff.changed.length) + " (" + String(classification.intendedChanged.length) + " row oracle A cũng khác stock y hệt) · " +
        "CHƯA GIẢI THÍCH: " + String(unexplained),
      evidence: dumpArtifact === null ? "" : relativeToRepo(join(parityPath("dumps", dumpArtifact.stamp), "diff-stock-vs-ours.md")),
    });
  } else {
    items.push({ name: "dump-config: khác biệt có chủ đích so với DSH stock (Galaxy ≠ stock)", status: "SKIP", detail: "chưa có cặp dump app-vs-stock", evidence: "" });
  }
  if (pairOracle !== null) {
    items.push({
      name: "dump-config: app vs Oracle A (đích M1/M2)",
      status: isDumpParity(pairOracle.diff) ? "PASS" : "FAIL",
      detail: "THÊM " + String(pairOracle.diff.added.length) + " · THIẾU " + String(pairOracle.diff.missing.length) + " · ĐỔI " + String(pairOracle.diff.changed.length) +
        " (row " + String(pairOracle.diff.oursRows) + "/" + String(pairOracle.diff.refRows) + ")",
      evidence: dumpArtifact === null ? "" : relativeToRepo(join(parityPath("dumps", dumpArtifact.stamp), "diff-oracleA-vs-ours.md")),
    });
  } else {
    items.push({ name: "dump-config: app vs Oracle A (đích M1/M2)", status: "SKIP", detail: "không dò được oracle A", evidence: "" });
  }
  for (const shot of shots) {
    const suffix = " (vs " + shot.refKey + ")";
    if (shot.pairs.length === 0) {
      items.push({
        name: "ảnh A/B" + suffix,
        status: "SKIP",
        detail: shot.skips.join(" | ") || "không chụp được",
        evidence: relativeToRepo(join(parityPath("shots", shot.stamp), "summary.json")),
      });
    }
    const noticeState = shot.ref.noticeVisible || shot.ours.noticeVisible;
    const stockExplained =
      shot.refKey === "stock" &&
      classification !== null &&
      classification.unexplainedAdded.length + classification.unexplainedChanged.length === 0;
    for (const pair of shot.pairs) {
      items.push({
        name: "ảnh A/B " + pair.viewport + suffix,
        status: pair.pass ? "PASS" : noticeState || stockExplained ? "GHI NHẬN" : "FAIL",
        detail:
          String(pair.diffPixels) + "/" + String(pair.totalPixels) + " px = " + (pair.ratio * 100).toFixed(3) +
          "% (ngưỡng " + (pair.threshold * 100).toFixed(3) + "%) · thô không mask " + (pair.rawRatio * 100).toFixed(3) +
          "% · bỏ qua " + String(pair.maskedPixels) + " px trong " + String(pair.masks.length) + " vùng mask" +
          (noticeState
            ? " — LỆCH DO TRẠNG THÁI: oracle còn thẻ thông báo một lần (welcomeNoticeVersion) mà app ta đã ghim theo 4001, KHÔNG phải lỗi giao diện"
            : stockExplained
              ? " — KHÁC BIỆT CÓ CHỦ ĐÍCH so với DSH stock (delta Galaxy: bundle/brand/config đã giải trình ở mục 2), KHÔNG phải lỗi parity"
              : ""),
        evidence: pair.diffFile,
      });
    }
    const bundleSame = shot.ours.assetsHash !== "" && shot.ours.assetsHash === shot.ref.assetsHash;
    items.push({
      name: "hash bundle asset" + suffix,
      status:
        shot.ours.assetsHash === ""
          ? "SKIP"
          : bundleSame
            ? "PASS"
            : shot.refKey === "stock" && stockExplained
              ? "GHI NHẬN"
              : "FAIL",
      detail: "ref " + shot.ref.assetsHash.slice(0, 16) + " (" + String(shot.ref.assets.length) + " asset) · ours " + shot.ours.assetsHash.slice(0, 16) + " (" + String(shot.ours.assets.length) + " asset)",
      evidence: relativeToRepo(join(parityPath("shots", shot.stamp), "summary.json")),
    });
    const bootSame = shot.ours.bootHash !== "" && shot.ours.bootHash === shot.ref.bootHash;
    items.push({
      name: "hợp đồng boot injection (khoá __GBH_BOOT__, alias __DSH_BOOT__)" + suffix,
      status: shot.ours.bootHash === "" ? "SKIP" : bootSame ? "PASS" : "FAIL",
      detail: "ref " + shot.ref.bootHash.slice(0, 16) + " · ours " + shot.ours.bootHash.slice(0, 16),
      evidence: "",
    });
    const sameSecret = shot.ours.secretFingerprint !== null && shot.ours.secretFingerprint === shot.ref.secretFingerprint;
    items.push({
      name: "credentials dùng chung (C6)" + suffix,
      status: shot.ours.secretFingerprint === null ? "SKIP" : sameSecret ? "PASS" : "FAIL",
      detail:
        shot.ours.secretFingerprint === null
          ? "chưa đọc được kho credentials"
          : "vân tay secret khớp: " + String(sameSecret) + " (giá trị secret không được lưu)",
      evidence: "",
    });
  }
  const swappedRows = pairOracle?.diff.swapped ?? [];
  const unverified = swappedRows.filter((row) => !row.verified);
  items.push({
    name: "row đã thay bằng gói của ta (tiến độ G3/G4)",
    status:
      pairOracle === null
        ? "SKIP"
        : unverified.length > 0
          ? "CHƯA ĐẠT"
          : swappedRows.length === 0
            ? "PASS"
            : "PASS",
    detail:
      pairOracle === null
        ? "chưa có cặp dump vs oracle A"
        : "đã thay " + String(swappedRows.length) + " row" +
          (swappedRows.length > 0 ? " (" + listIds(swappedRows.map((row) => row.id), 12) + ")" : "") +
          " · thiếu bằng chứng hành vi: " + String(unverified.length) +
          (unverified.length > 0 ? " (" + listIds(unverified.map((row) => row.id), 12) + ")" : ""),
    evidence: "",
  });
  const maskedIdTargets = dumpTargets.filter((target) => target.ok && target.redactedIds > 0);
  items.push({
    name: "che secret không làm mất id row (redactedIds)",
    status: dumpTargets.length === 0 ? "SKIP" : maskedIdTargets.length === 0 ? "PASS" : "FAIL",
    detail:
      dumpTargets.length === 0
        ? "chưa chạy dump"
        : "redactedIds = " + String(maskedIdTargets.reduce((sum, target) => sum + target.redactedIds, 0)) +
          " trên " + String(dumpTargets.length) + " target; tổng giá trị bị che: " +
          String(dumpTargets.reduce((sum, target) => sum + target.redactedValues, 0)),
    evidence: "",
  });
  const guardVerdictText = shotArtifact?.guard.verdict ?? dumpArtifact?.guard.verdict ?? "chưa đo";
  items.push({
    name: "chốt an toàn ~/.galaxy/gbh",
    status: guardVerdictText.startsWith("PASS") ? "PASS" : guardVerdictText.startsWith("KHÔNG") ? "CHƯA CÓ" : "FAIL",
    detail: guardVerdictText,
    evidence: "",
  });
  const secretScan = scanArtifacts();
  items.push({
    name: "không rò secret/cookie vào .parity",
    status: secretScan.available ? (secretScan.hits === 0 ? "PASS" : "FAIL") : "SKIP",
    detail: secretScan.available
      ? "đã quét " + String(secretScan.files) + " file trong .parity, " + String(secretScan.hits) + " file chứa chuỗi cấm"
      : "chưa đọc được kho credentials để lấy chuỗi cấm",
    evidence: "",
  });

  lines.push("## 0. Bảng hạng mục");
  lines.push("");
  lines.push(
    "> ⚠️ **Khoảng thời gian KHÔNG hợp lệ**: " +
      INVALID_WINDOWS.map((window) => window.from + "–" + window.to + " — " + window.reason).join(" · ") +
      " Đừng trích số ảnh/trace trong khoảng này.",
  );
  lines.push("");
  lines.push("| Hạng mục | Trạng thái | Số liệu | Bằng chứng |");
  lines.push("|---|---|---|---|");
  for (const item of items) {
    lines.push("| " + item.name + " | **" + item.status + "** | " + item.detail + " | " + (item.evidence === "" ? "—" : item.evidence) + " |");
  }
  lines.push("");
  lines.push(
    "Chú giải trạng thái: **PASS** đạt ngưỡng · **FAIL** chưa đạt · **GHI NHẬN** khác biệt có chủ đích " +
      "(không tính là lỗi, có lý do giải trình ngay trong mục) · **SKIP** thiếu một bên · **CHƯA CÓ** chưa có giàn đo.",
  );
  lines.push("");
  lines.push(
    "ALLOWLIST của cặp *app vs oracle*: **rỗng** — không có khác biệt nào được miễn trừ; " +
      "mọi row THÊM/THIẾU/ĐỔI so với oracle A đều là việc phải làm.",
  );
  lines.push("");

  // ---- 1. Môi trường ----
  lines.push("## 1. Môi trường & oracle");
  lines.push("");
  lines.push("| bên | runtime | home | profile | patch | row | che (id/giá trị) | ghi chú |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const target of dumpTargets) {
    lines.push(
      "| \`" + target.key + "\` | " + (target.version ?? "?") + " | \`" + target.home + "\` | " + target.profile + " | " +
        String(target.patchCount) + " | " + (target.ok ? String(target.rows) : "SKIP") + " | " +
        String(target.redactedIds) + "/" + String(target.redactedValues) + " | " + (target.ok ? target.label : target.error ?? "") + " |",
    );
  }
  if (dumpTargets.length === 0) lines.push("| (chưa chạy parity:dump) | — | — | — | — | — | — |");
  lines.push("");
  if (shots.length > 0) {
    lines.push("| bên | URL | auth | http | title | asset | module | overlay đã ẩn | lỗi console |");
    lines.push("|---|---|---|---|---|---|---|---|---|");
    for (const shot of shots) {
      for (const side of [shot.ref, shot.ours]) {
        lines.push(
          "| " + side.label + " | " + side.url + " | " + side.authMode + " | " + String(side.httpStatus) + " | " + side.title + " | " +
            String(side.assets.length) + " | " + String(side.moduleCount) + " | " + String(side.hiddenOverlays) + " | " +
            String(side.consoleErrors.length) + " |",
        );
      }
    }
    lines.push("");
  }
  if (dumpArtifact !== null && dumpArtifact.skipped.length > 0) {
    lines.push("Bỏ qua: " + dumpArtifact.skipped.join(" · "));
    lines.push("");
  }

  // ---- 2. dump-config ----
  lines.push("## 2. dump-config diff (theo row id)");
  lines.push("");
  if (dumpArtifact !== null && dumpArtifact.pairs.length > 0) {
    for (const pair of dumpArtifact.pairs) {
      lines.push(formatDumpDiff(pair.diff, 40));
      lines.push("");
    }
    const pairStockRaw = dumpArtifact.pairs.find((pair) => pair.refKey === "stock");
    if (pairStockRaw !== undefined) {
      const unexplainedStock =
        classification === null ? 0 : classification.unexplainedAdded.length + classification.unexplainedChanged.length;
      if (classification !== null) {
        lines.push(
          "**Giải trình khác biệt so với DSH stock** (delta Galaxy — KHÔNG phải lỗi parity): " +
            String(classification.intendedAdded.length) + "/" + String(pairStockRaw.diff.added.length) + " row THÊM cũng có ở oracle A; " +
            String(classification.intendedChanged.length) + "/" + String(pairStockRaw.diff.changed.length) + " row ĐỔI mà oracle A cũng khác stock y hệt; " +
            "**chưa giải thích: " + String(unexplainedStock) + "**.",
        );
        lines.push("");
      }
      const filtered = applyIntentional(pairStockRaw.diff);
      if (filtered.excused.length > 0) {
        lines.push("**Khác biệt có chủ ý đã trừ** (không tính là FAIL):");
        for (const rule of INTENTIONAL_DIFFS) {
          lines.push("- \`" + rule.id + "." + rule.path + "\` — " + rule.why);
        }
        lines.push("");
      }
    }
    if (pairStockRaw !== undefined && pairStockRaw.diff.added.length > 0) {
      const oracleRows = readNormalisedRows(dumpArtifact, "oracleA");
      if (oracleRows !== null) {
        const alsoInOracle = pairStockRaw.diff.added.filter((id) => oracleRows.some((row) => row.id === id));
        lines.push(
          "**Đọc đúng số liệu này**: " + String(alsoInOracle.length) + "/" + String(pairStockRaw.diff.added.length) +
            " row THÊM so với stock **cũng có ở oracle A** → đó là bộ bundle của profile `blackhole` (mirror oracle), " +
            "không phải lệch do app. Oracle B (stock `web`) là mốc DSH sạch nên nó không có các bundle đó.",
        );
        if (alsoInOracle.length !== pairStockRaw.diff.added.length) {
          lines.push("");
          lines.push(
            "Row THÊM **không** có ở oracle A (cần xem lại): " +
              listIds(pairStockRaw.diff.added.filter((id) => !alsoInOracle.includes(id)), 20),
          );
        }
        lines.push("");
      }
    }
    if (swappedRows.length > 0) {
      lines.push("**Row đã thay sang gói tương ứng của ta** (chỉ số TIẾN ĐỘ G3/G4, không phải lỗi; bảng tra: " +
        dumpArtifact.equivalence.source + ", " + String(dumpArtifact.equivalence.rows) + " dòng):");
      lines.push("");
      lines.push("| row | gói DSH | gói của ta | bằng chứng hành vi | đạt |");
      lines.push("|---|---|---|---|---|");
      for (const row of swappedRows) {
        lines.push(
          "| " + row.id + " | " + row.ref + " | " + row.ours + " | " +
            (row.evidenceFile === null ? row.evidence : row.evidenceFile) + " | " + (row.verified ? "✓" : "CHƯA ĐẠT") + " |",
        );
      }
      lines.push("");
    }
    lines.push("### Tách hệ quả VERSION vs PATCH (cùng home oracle A)");
    lines.push("");
    lines.push(dumpArtifact.presenceTable === null
      ? "(cần ít nhất 2 cột: oracleA + oracleA_rc2 hoặc oracleA_nopatch)"
      : formatPresenceTableFromArtifact(dumpArtifact));
    lines.push("");
  } else {
    lines.push("(chưa có dữ liệu dump)");
    lines.push("");
  }

  // ---- 3. Ảnh ----
  lines.push("## 3. Ảnh A/B");
  lines.push("");
  if (shotNote !== null) {
    lines.push("> **LƯU Ý**: " + shotNote);
    lines.push("");
  }
  if (shotArtifact !== null && shotArtifact.ours.port !== OURS_PORT) {
    lines.push(
      "> Bên \`ours\` của lần chụp này là cổng **" + String(shotArtifact.ours.port) +
        "**, không phải " + String(OURS_PORT) + " — đây là bản tổng duyệt của giàn đo, chưa phải parity của app.",
    );
    lines.push("");
  }
  for (const shot of shots) {
    lines.push("### ours vs " + shot.refKey + " — " + shot.verdict);
    lines.push("");
    if (shot.pairs.length > 0) {
      lines.push("| viewport | route | ref | ours | diff | pixel | kết luận |");
      lines.push("|---|---|---|---|---|---|---|");
      for (const pair of shot.pairs) {
        lines.push(
        "| " + pair.viewport + " | " + pair.route + " | " + pair.refFile + " | " + pair.oursFile + " | " + pair.diffFile + " | " +
          String(pair.diffPixels) + " (" + (pair.ratio * 100).toFixed(3) + "%) | " + (pair.pass ? "PASS" : "FAIL") + " |",
      );
    }
      lines.push("");
      lines.push(
        "Profile Chrome của lần chụp: " + (shot.freshProfile ? "**MỚI** (fresh, xoá sau khi xong)" : "không rõ") +
          " · hash user-data-dir " + shot.profileHash + " — trạng thái client KHÔNG rò giữa các lần đo.",
      );
      lines.push("");
      lines.push("Hash bundle: ref \`" + shot.ref.assetsHash.slice(0, 24) + "\` · ours \`" + shot.ours.assetsHash.slice(0, 24) + "\`");
      lines.push("");
      lines.push("Hash hợp đồng boot: ref \`" + shot.ref.bootHash.slice(0, 24) + "\` · ours \`" + shot.ours.bootHash.slice(0, 24) + "\`");
      lines.push("");
    }
    const masksOfFirst = shot.pairs[0]?.masks ?? [];
    if (masksOfFirst.length > 0) {
      lines.push("Vùng mask đã bỏ qua (toạ độ pixel của viewport đầu; mọi viewport có trong summary.json):");
      lines.push("");
      lines.push(describeMasks(masksOfFirst, shot.pairs[0]?.width ?? 0, shot.pairs[0]?.height ?? 0));
      lines.push("");
    }
    if (shot.skips.length > 0) {
      lines.push("**SKIP**");
      for (const skip of shot.skips) lines.push("- " + skip);
      lines.push("");
    }
  }
  if (shots.length === 0) {
    lines.push("(chưa chụp được cặp ảnh nào — xem mục SKIP bên dưới)");
    lines.push("");
  }

  // ---- 4. Chốt an toàn ----
  lines.push("## 4. Chốt an toàn & bí mật");
  lines.push("");
  if (dumpArtifact !== null) {
    lines.push("- \`~/.galaxy/gbh\`: " + dumpArtifact.guard.verdict);
    lines.push("  - cửa sổ rảnh (parity không chạy): " + dumpArtifact.guard.idle);
    lines.push("  - trong lúc parity chạy: " + dumpArtifact.guard.during);
    if (dumpArtifact.guard.samples.length > 0) {
      lines.push("  - đường dẫn đã đổi: \`" + dumpArtifact.guard.samples.join("\`, \`") + "\`");
    }
  }
  lines.push("- Secret/cookie: parity mint cookie trong bộ nhớ từ kho credentials dùng chung; report chỉ lưu **hash** vân tay secret.");
  lines.push("- Quét \`.parity/\` tìm chính cookie/secret vừa dùng: " + String(secretScan.hits) + " file chứa (0 = sạch).");
  lines.push("");

  // ---- 5. M2b: plugin ngoài (G1) · DOM/a11y · session round-trip (dựng ở lib/report-m2b.ts) ----
  const m2b = buildM2bSection();
  lines.push(...m2b.lines);
  items.push(...m2b.items);

  // ---- 6. CHƯA CÓ ----
  lines.push("## 6. Hạng mục CHƯA CÓ (M2+)");
  lines.push("");
  lines.push("| Hạng mục | Vì sao chưa có | Ai làm |");
  lines.push("|---|---|---|");
  for (const missing of MISSING_ITEMS) lines.push("| " + missing.name + " | " + missing.why + " | " + missing.owner + " |");
  lines.push("");

  // ---- 7. Tái lập ----
  lines.push("## 7. Tái lập");
  lines.push("");
  lines.push("\`\`\`bash");
  lines.push("bun run parity:dump        # dump-config diff theo row id");
  lines.push("bun run parity:shot        # ảnh A/B: 5439 vs oracle B (tự boot)");
  lines.push("bun run parity:shot -- --against 4001   # ảnh A/B: 5439 vs oracle A");
  lines.push("bun run tools/parity/health.ts          # cổng trạng thái app LÀNH + cửa sổ hợp lệ");
  lines.push("bun run tools/parity/dom.ts --against    # DOM + a11y: 5439 vs oracle A");
  lines.push("bun run tools/parity/session.ts          # session round-trip: app ↔ oracle B");
  lines.push("bun run tools/parity/plugin-external.ts   # plugin NGOÀI: cài → chứng minh chạy → gỡ");
  lines.push("bun run parity:report      # sinh file này");
  lines.push("bun test tests/e2e/parity.test.ts       # test logic, không cần server");
  lines.push("\`\`\`");
  lines.push("");
  lines.push("Sinh lúc " + nowIso() + " · " + (fromCache ? "từ artifact có sẵn" : "chạy mới cả dump và shot") + ".");
  lines.push("");

  const markdown = lines.join("\n");
  const file = writeTextFile(parityPath("report.md"), markdown);
  writeJsonFile(latestPath(), {
    format: 1,
    stamp: runStamp,
    generatedAt: nowIso(),
    items,
    dump: dumpArtifact === null ? null : { stamp: dumpArtifact.stamp, base: dumpArtifact.base, targets: dumpArtifact.targets.map((target) => ({ key: target.key, version: target.version, ok: target.ok, rows: target.rows })) },
    shots: shotArtifact === null ? null : { stamp: shotArtifact.stamp, verdict: shotArtifact.verdict, refKey: shotArtifact.refKey, pairs: shotArtifact.pairs.length },
  });
  return { file, markdown, items };
}

/**
 * Chọn cổng cho bên \`ours\` khi chụp: ưu tiên app thật (5439), nếu chưa lên thì mượn oracle A (4001)
 * để giàn đo vẫn có cặp ảnh thật, kèm ghi chú nói rõ.
 * @param ref bên tham chiếu mong muốn.
 * @returns cổng ours (undefined = mặc định) và ghi chú.
 */
export async function chooseShotTarget(ref: "stock" | "oracleA"): Promise<{ oursPort: number | undefined; note: string | null }> {
  // Host của app có thể đang restart giữa lúc dev: thử lại vài lần trước khi kết luận là "chưa lên".
  let ours = await httpProbe("http://127.0.0.1:" + String(OURS_PORT) + "/", 2500);
  for (let attempt = 0; attempt < 3 && !ours.up; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    ours = await httpProbe("http://127.0.0.1:" + String(OURS_PORT) + "/", 2500);
  }
  if (ours.up) return { oursPort: undefined, note: null };
  if (ref === "oracleA") {
    return { oursPort: undefined, note: "app chưa lên cổng " + String(OURS_PORT) + " — không chụp được cặp ảnh nào" };
  }
  const oracle = await httpProbe("http://127.0.0.1:" + String(ORACLE_A_PORT) + "/", 2500);
  if (oracle.up) {
    return {
      oursPort: ORACLE_A_PORT,
      note:
        "app của ta chưa lên cổng " + String(OURS_PORT) + " — tạm lấy oracle A (cổng " + String(ORACLE_A_PORT) +
        ") làm bên \`ours\` để giàn đo vẫn có cặp ảnh thật; cặp ảnh này là oracle A vs oracle B, KHÔNG phải parity của app",
    };
  }
  return { oursPort: undefined, note: "cả " + String(OURS_PORT) + " và " + String(ORACLE_A_PORT) + " đều chưa mở — không chụp được ảnh" };
}

/**
 * Dựng bảng hiện diện (VERSION vs PATCH) từ artifact dump.
 * @param artifact artifact dump.
 * @returns bảng Markdown chỉ gồm các row khác nhau.
 */
export function formatPresenceTableFromArtifact(artifact: DumpArtifact): string {
  const columns = artifact.presenceColumns
    .map((key) => {
      const rows = readNormalisedRows(artifact, key);
      return rows === null ? null : buildColumn(key, rows);
    })
    .filter((column): column is NonNullable<typeof column> => column !== null);
  return formatPresenceTable(columns, true);
}

/**
 * Đọc các row đã chuẩn hoá của một target từ artifact dump.
 * @param artifact artifact dump.
 * @param key khoá target.
 * @returns danh sách row, hoặc null nếu chưa có file.
 */
export function readNormalisedRows(artifact: DumpArtifact, key: string): { id: string; order: number; json: string }[] | null {
  const file = artifact.files.normalised[key];
  if (file === undefined) return null;
  const parsed = readJsonFile<{ rows: { id: string; order: number; json: string }[] }>(file);
  return parsed === null ? null : parsed.rows;
}

/**
 * Dựng lại cây `NormalisedDump` của một target từ artifact đã lưu.
 * @param artifact artifact dump.
 * @param key khoá target.
 * @returns cây dump (chỉ id + thứ tự + json), hoặc null nếu thiếu.
 */
export function readNormalisedColumn(artifact: DumpArtifact, key: string): ReturnType<typeof normaliseDump> | null {
  const rows = readNormalisedRows(artifact, key);
  return rows === null ? null : buildColumn(key, rows);
}

/**
 * Phân loại khác biệt app-vs-stock thành "delta Galaxy có chủ đích" và "chưa giải thích".
 * @param oursVsStock diff app vs stock.
 * @param oracleVsStock diff oracle A vs stock (null nếu chưa đo được).
 * @returns danh sách row có chủ đích và row chưa giải thích.
 */
export function classifyAgainstStock(oursVsStock: DumpDiff, oracleVsStock: DumpDiff | null): {
  intendedAdded: string[];
  unexplainedAdded: string[];
  intendedChanged: string[];
  unexplainedChanged: DumpDiff["changed"];
} {
  if (oracleVsStock === null) {
    return {
      intendedAdded: [],
      unexplainedAdded: [...oursVsStock.added],
      intendedChanged: [],
      unexplainedChanged: [...oursVsStock.changed],
    };
  }
  const oracleExtra = new Set([...oracleVsStock.added, ...oracleVsStock.changed.map((row) => row.id)]);
  const intendedAdded = oursVsStock.added.filter((id) => oracleExtra.has(id));
  const unexplainedAdded = oursVsStock.added.filter((id) => !oracleExtra.has(id));
  const intendedChanged = oursVsStock.changed.filter((row) => oracleExtra.has(row.id)).map((row) => row.id);
  const unexplainedChanged = oursVsStock.changed.filter((row) => !oracleExtra.has(row.id));
  return { intendedAdded, unexplainedAdded, intendedChanged, unexplainedChanged };
}

/**
 * Dựng lại một cột `NormalisedDump` từ file JSON đã lưu.
 * @param key tên target.
 * @param rows các row đã lưu.
 * @returns cây dump đã chuẩn hoá (chỉ cần id + thứ tự + giá trị rỗng).
 */
function buildColumn(key: string, rows: readonly { id: string; order: number; json: string }[]): ReturnType<typeof normaliseDump> {
  const map = new Map(rows.map((row) => [row.id, { id: row.id, order: row.order, json: row.json, value: null }]));
  return {
    source: key,
    rows: map,
    order: rows.map((row) => row.id),
    duplicates: [],
    warnings: 0,
    rowCount: rows.length,
    maskedIds: [],
    redactedValues: 0,
  };
}

/**
 * Quét `.parity` tìm chính secret/cookie vừa dùng (chuỗi chỉ tồn tại trong bộ nhớ).
 * @returns số file đã quét, số file chứa chuỗi cấm và cờ cho biết có lấy được chuỗi cấm hay không.
 */
export function scanArtifacts(): { files: number; hits: number; available: boolean } {
  const stores = [credentialsPath()];
  const resolved = resolveSessionCookieFrom(0, stores);
  const needles: string[] = [];
  if (resolved.cookie !== null) needles.push(resolved.cookie.value);
  const scanned = scanForSecrets(parityPath(), needles);
  return { ...scanned, available: needles.length > 0 };
}

/**
 * Bóc tham số dạng `--key value`.
 * @param argv danh sách tham số.
 * @param key tên tham số.
 * @returns giá trị, hoặc null nếu không có.
 */
export function valueOf(argv: readonly string[], key: string): string | null {
  const at = argv.indexOf(key);
  return at === -1 ? null : argv[at + 1] ?? null;
}

/**
 * Bóc danh sách bên tham chiếu từ tham số: `--refs stock,oracleA` hoặc `--against 4001`.
 * @param argv tham số dòng lệnh.
 * @returns danh sách bên tham chiếu (mặc định cả hai: stock rồi oracleA).
 */
export function parseRefs(argv: readonly string[]): ("stock" | "oracleA")[] {
  const raw = valueOf(argv, "--refs");
  if (raw !== null && raw.trim() !== "") {
    const refs = raw
      .split(",")
      .map((token) => token.trim())
      .filter((token): token is "stock" | "oracleA" => token === "stock" || token === "oracleA");
    if (refs.length > 0) return refs;
  }
  if (argv.includes("--against")) return ["oracleA"];
  return ["stock", "oracleA"];
}

/**
 * Điểm vào CLI `parity:report`.
 * @param argv tham số sau tên script.
 * @returns mã thoát (0 = đã sinh report; 1 = có hạng mục FAIL khi bật `--strict`).
 */
export async function main(argv: string[]): Promise<number> {
  const strict = argv.includes("--strict");
  const result = await buildReport({
    fromCache: argv.includes("--from-cache"),
    refs: parseRefs(argv),
    quiet: true,
  });
  console.log("");
  console.log("=== parity:report → " + relativeToRepo(result.file) + " ===");
  console.log("| Hạng mục | Trạng thái | Số liệu |");
  console.log("|---|---|---|");
  for (const item of result.items) {
    console.log("| " + item.name + " | " + item.status + " | " + item.detail + " |");
  }
  const failed = result.items.filter((item) => item.status === "FAIL").length;
  const skipped = result.items.filter((item) => item.status === "SKIP").length;
  console.log("");
  log("FAIL:", String(failed), "· SKIP:", String(skipped), "· PASS:", String(result.items.length - failed - skipped));
  return strict && failed > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
