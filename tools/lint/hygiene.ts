/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cổng vệ sinh: package CÓ khai `gbh.row` vừa phải có test, vừa phải có mặt trong packages/README.md §4
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult, Violation } from "./shared.ts";

/**
 * Kiem hai luat ve sinh cho moi package khai `gbh.row`.
 *
 * Vi sao chon tieu chi `gbh.row`: do la dau hieu package **DA MOUNT THAT**. Package dang viet do
 * KHONG duoc khai `gbh.row`, nen ca hai luat nay khong bat oan ai.
 * · Luat 1 (G4): khai `gbh.row` tuc la dang phuc vu nguoi dung => phai co test tuong ung.
 * · Luat 2: khai `gbh.row` tuc la da xong => phai duoc ghi trong `packages/README.md` §4.
 * @param repoRoot - thu muc goc repo.
 * @returns ket qua kiem tra.
 */
export function runHygieneCheck(repoRoot: string): CheckResult {
  const violations: Violation[] = [];
  let checked = 0;
  const readmePath = join(repoRoot, "packages", "README.md");
  const readme = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";
  for (const area of ["client", "host"]) {
    const areaDir = join(repoRoot, "packages", area);
    if (!existsSync(areaDir)) continue;
    for (const name of readdirSync(areaDir)) {
      const pkg = join(areaDir, name, "package.json");
      if (!existsSync(pkg)) continue;
      let json: { name?: string; gbh?: { row?: { tests?: unknown; moved?: boolean } } };
      try {
        json = JSON.parse(readFileSync(pkg, "utf8")) as typeof json;
      } catch {
        continue;
      }
      const row = json.gbh?.row;
      if (row === undefined) continue;
      checked += 1;
      const rel = "packages/" + area + "/" + name + "/package.json";
      const declared = Array.isArray(row.tests) ? row.tests : [];
      const byFile = existsSync(join(repoRoot, "tests", area, name + ".test.ts"));
      if (declared.length === 0 && !byFile) {
        violations.push({
          file: rel,
          line: 0,
          message: "khai gbh.row (dang phuc vu nguoi dung) nhung KHONG co test — vi pham G4",
        });
      }
      const pkgName = json.name ?? "";
      // Luat 3 (G3): ten package phai theo quy uoc `@galaxy-blackhole/gbh-*`.
      // NGOAI LE CO TEN: goi `moved: true` la DI CHUYEN (chua viet lai) — doi ten no se pha id bundle
      // tu khai va lam chet entry (da xay ra that). Ngoai le phai duoc khai bang `moved`, khong phai im lang.
      const moved = (row as { moved?: boolean }).moved === true;
      if (!moved && !pkgName.startsWith("@galaxy-blackhole/gbh-")) {
        violations.push({
          file: rel,
          line: 0,
          message: "ten package '" + pkgName + "' khong theo quy uoc @galaxy-blackhole/gbh-* (G3); neu la DI CHUYEN thi khai gbh.row.moved: true",
        });
      }
      if (!readme.includes(name) && !readme.includes(pkgName)) {
        violations.push({
          file: rel,
          line: 0,
          message: "khai gbh.row (da mount that) nhung KHONG co trong packages/README.md §4",
        });
      }
    }
  }
  return {
    name: "hygiene",
    checked,
    skipped: {},
    violations,
    warnings: [],
    notes: ["chi tinh goi CO khai gbh.row (dau hieu da mount that)"],
    ms: 0,
  };
}