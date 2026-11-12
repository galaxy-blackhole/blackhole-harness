/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Rà lại một lần chạy ma trận ảnh đã lưu bằng cổng hợp lệ 4 điều kiện (ảnh + DOM + chuỗi lỗi)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parityPath } from "../parity/lib/paths.ts";

import { type ValidityReport, checkValidity } from "./lib/validity.ts";
import { findScenario } from "./scenarios.ts";
import type { FeatureArtifact, ScenarioRecord } from "./run.ts";
import type { ElementRow } from "./lib/types.ts";

/** Kết quả rà lại một màn hình. */
interface AuditRow {
  /** Khoá màn hình. */
  id: string;
  /** Tên màn hình. */
  title: string;
  /** Kết luận cũ trong summary.json. */
  previousStatus: string;
  /** Số pixel lệch cũ. */
  diffPixels: number;
  /** Cổng hợp lệ tính lại từ ảnh đã lưu. */
  ours: ValidityReport;
  /** Cổng hợp lệ của bên tham chiếu. */
  ref: ValidityReport;
  /** Kết luận sau khi rà: giữ nguyên hay đánh dấu KHÔNG HỢP LỆ. */
  verdict: "GIỮ NGUYÊN" | "KHÔNG HỢP LỆ (chụp lại)";
  /** Lý do. */
  reasons: string[];
}

/**
 * Đọc danh sách phần tử DOM của một màn hình từ file inventory-<id>.json trong thư mục ảnh.
 * Nhận: thư mục artifact của lần chạy và id màn hình.
 * Trả: { ref, ours } danh sách phần tử; mảng rỗng nếu không đọc được.
 */
export function readInventory(dir: string, id: string): { ref: ElementRow[]; ours: ElementRow[] } {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, "inventory-" + id + ".json"), "utf8")) as {
      ref?: ElementRow[];
      ours?: ElementRow[];
    };
    return { ref: parsed.ref ?? [], ours: parsed.ours ?? [] };
  } catch {
    return { ref: [], ours: [] };
  }
}

/**
 * Rà lại toàn bộ một lần chạy đã lưu bằng cổng hợp lệ 4 điều kiện, dùng ảnh và DOM còn trên đĩa.
 * Nhận: artifact đã đọc từ summary.json và thư mục artifact.
 * Trả: mảng kết quả rà theo từng màn hình.
 */
export function auditArtifact(artifact: FeatureArtifact, dir: string): AuditRow[] {
  const rows: AuditRow[] = [];
  for (const record of artifact.scenarios) {
    // Dùng ĐÚNG yêu cầu hợp lệ của kịch bản trong danh mục hiện tại (không đoán).
    const spec = findScenario(record.id)?.validity ?? {};
    const inventory = readInventory(dir, record.id);
    const measure = (side: "ours" | "ref"): ValidityReport => {
      const png = readPng(join(dir, (side === "ours" ? "ours-" : "ref-") + record.id + ".png"));
      const symptoms = side === "ours" ? record.ours.symptoms : record.ref.symptoms;
      return checkValidity({
        rows: side === "ours" ? inventory.ours : inventory.ref,
        png,
        symptoms,
        spec,
        masks: record.masks,
      });
    };
    const ours = measure("ours");
    const ref = measure("ref");
    const ok = ours.ok && ref.ok;
    const reasons = [...ours.reasons.map((reason) => "ours: " + reason), ...ref.reasons.map((reason) => "ref: " + reason)];
    rows.push({
      id: record.id,
      title: record.title,
      previousStatus: record.status,
      diffPixels: record.diffPixels,
      ours,
      ref,
      verdict: ok ? "GIỮ NGUYÊN" : "KHÔNG HỢP LỆ (chụp lại)",
      reasons,
    });
  }
  return rows;
}

/**
 * Đọc một file PNG, trả buffer rỗng nếu không có.
 * Nhận: đường dẫn file.
 * Trả: buffer nội dung file (rỗng khi lỗi).
 */
function readPng(file: string): Buffer | undefined {
  try {
    const buffer = readFileSync(file);
    return buffer.length > 0 ? buffer : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Điểm vào dòng lệnh: rà lại một lần chạy và ghi validity-audit.json.
 * Nhận: tham số dòng lệnh — đường dẫn thư mục artifact (mặc định .parity/features/latest.json).
 * Trả: mã thoát 0 khi chạy xong.
 */
export async function main(argv: string[]): Promise<number> {
  const dir = argv[0] ?? parityPath("features");
  const summaryFile = dir.endsWith(".json") ? dir : join(dir, "summary.json");
  const artifact = JSON.parse(readFileSync(summaryFile, "utf8")) as FeatureArtifact;
  const shotsDir = join(parityPath(".."), artifact.shotsDir);
  const rows = auditArtifact(artifact, shotsDir);
  const payload = {
    audited: artifact.stamp,
    rule: "Bốn điều kiện: sidebar; ô soạn tin; DOM không chứa chuỗi lỗi; mỗi vùng ảnh không quá 95% một màu.",
    note: "Rà từ ảnh và DOM đã lưu trên đĩa (không chụp lại).",
    total: rows.length,
    invalid: rows.filter((row) => row.verdict !== "GIỮ NGUYÊN").map((row) => row.id),
    rows,
  };
  writeFileSync(join(shotsDir, "validity-audit.json"), JSON.stringify(payload, null, 1));
  for (const row of rows) {
    console.log(
      "[features] " + (row.verdict === "GIỮ NGUYÊN" ? "OK  " : "SKIP") + " " + row.id.padEnd(26) + " " +
        row.previousStatus.padEnd(5) + " " + String(row.diffPixels).padStart(6) + " px  " + row.reasons.join(" · ").slice(0, 150),
    );
  }
  console.log("[features] tổng " + String(rows.length) + " màn · không hợp lệ: " + String(payload.invalid.length));
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
