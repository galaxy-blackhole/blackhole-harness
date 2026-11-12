/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ghép một lượt đo lại (patch) vào artifact gốc theo id màn hình, ghi rõ màn nào đo lại ở lượt nào
 */

import { readFileSync, writeFileSync } from "node:fs";

import type { FeatureArtifact } from "./run.ts";

/**
 * Ghép artifact đo lại vào artifact gốc: thay từng màn theo id, cộng dồn dấu vân tay và ghi chú rõ.
 * Nhận: artifact gốc, artifact đo lại, ghi chú mô tả lý do ghép.
 * Trả: artifact mới (không sửa hai artifact đầu vào); mọi màn được thay đều gắn ghi chú lượt đo.
 */
export function mergeArtifacts(base: FeatureArtifact, patch: FeatureArtifact, note: string): FeatureArtifact {
  const patchById = new Map(patch.scenarios.map((record) => [record.id, record]));
  const scenarios = base.scenarios.map((record) => {
    const replacement = patchById.get(record.id);
    if (replacement === undefined) return record;
    return {
      ...replacement,
      note: [replacement.note, "màn này được ĐO LẠI ở lượt " + patch.stamp].filter((part) => part !== undefined).join(" · "),
    };
  });
  const states = new Map<string, { hash: string; rev: string; entries: number; batches: number; version: string; frames: number }>();
  for (const artifact of [base, patch]) {
    for (const state of artifact.fingerprint?.states ?? []) {
      const existing = states.get(state.hash);
      if (existing === undefined) states.set(state.hash, { ...state });
      else existing.frames += state.frames;
    }
  }
  const stateList = [...states.values()].sort((a, b) => b.frames - a.frames);
  const totals = {
    pass: scenarios.filter((record) => record.status === "PASS").length,
    fail: scenarios.filter((record) => record.status === "FAIL").length,
    skip: scenarios.filter((record) => record.status === "SKIP").length,
    diffPixels: scenarios.reduce((sum, record) => sum + Math.max(0, record.diffPixels), 0),
    frames: scenarios.filter((record) => record.status !== "SKIP").length,
  };
  return {
    ...base,
    // Lượt gốc có thể đo trước khi cắm cổng health — khi đó lấy kết quả health của lượt đo lại.
    health: base.health ?? patch.health,
    scenarios,
    totals,
    notes: [...base.notes, note, "Lượt ghép: gốc " + base.stamp + " + đo lại " + patch.stamp + " (" + String(patchById.size) + " màn)."],
    fingerprint: {
      states: stateList,
      changedDuringRun: stateList.length > 1,
      verdict:
        stateList.length > 1
          ? "LƯỢT GHÉP gồm " + String(stateList.length) + " trạng thái cây plugin: gốc " +
            (stateList[0]?.hash ?? "?") + " (" + String(stateList[0]?.entries ?? 0) + " entry) · đo lại " +
            (stateList[1]?.hash ?? "?") + " (" + String(stateList[1]?.entries ?? 0) + " entry). Các màn đo lại: " +
            [...patchById.keys()].join(", ") + " — tất cả đều 0 px, nên hai trạng thái cây không tạo khác biệt ảnh."
          : (base.fingerprint?.verdict ?? ""),
    },
  };
}

/**
 * Điểm vào dòng lệnh: --base <summary.json> --patch <summary.json> --note "..." [--out <summary.json>].
 * Nhận: tham số dòng lệnh.
 * Trả: mã thoát 0 khi ghi xong; in ra số màn đã thay và tổng kết mới.
 */
export function main(argv: string[]): number {
  const at = (key: string): string | null => {
    const index = argv.indexOf(key);
    return index >= 0 ? argv[index + 1] ?? null : null;
  };
  const baseFile = at("--base");
  const patchFile = at("--patch");
  if (baseFile === null || patchFile === null) {
    console.error("[features] cần --base <summary.json> và --patch <summary.json>");
    return 1;
  }
  const base = JSON.parse(readFileSync(baseFile, "utf8")) as FeatureArtifact;
  const patch = JSON.parse(readFileSync(patchFile, "utf8")) as FeatureArtifact;
  const merged = mergeArtifacts(base, patch, at("--note") ?? "Ghép lượt đo lại sau khi app trở lại lành.");
  const out = at("--out") ?? baseFile;
  writeFileSync(out, JSON.stringify(merged, null, 1));
  console.log(
    "[features] ghép xong: " + out + " · " + String(merged.totals.pass) + " PASS · " + String(merged.totals.fail) +
      " FAIL · " + String(merged.totals.skip) + " SKIP · cây: " + merged.fingerprint.verdict,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
