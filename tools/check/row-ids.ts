/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Luat MOT row.id MOT package — tach khoi rows.ts de giu file <= 1000 dong
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Issue } from "./rows.ts";

/**
 * Bao loi khi HAI package cung khai mot `gbh.row.id`.
 *
 * Vi sao la loi CHAN: tang nap chi sinh MOT entry cho moi row ⇒ package khai sau KHONG BAO GIO chay,
 * nhung no van co trong `app.patch.yml` + trong profile ⇒ nguoi lam TUONG no da mount. Ca that
 * 18/10/2026: `ui-brand-official` trung `row.id` voi `ui-brand` (@galaxy-stack/gbh-brand, co tu truoc);
 * moi phep kiem khac deu xanh (patch ✓ profile ✓ artifact 1 id ✓ check:rows 0 chan) ma goi moi
 * khong co entry nao trong manifest.
 *
 * Nhan: dirs — duong dan cac thu muc package row.
 * Tra: danh sach van de muc 'chan' (rong khi moi row.id chi co mot package).
 */
export function duplicateRowIdIssues(dirs: readonly string[]): Issue[] {
  const byRowId = new Map<string, string[]>();
  for (const dir of dirs) {
    try {
      const meta = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
        name: string;
        gbh?: { row?: { id?: string } };
      };
      const rowId = meta.gbh?.row?.id;
      if (rowId === undefined) continue;
      byRowId.set(rowId, [...(byRowId.get(rowId) ?? []), meta.name]);
    } catch {
      // package.json hong thi `checkOne` da bao o noi khac — o day chi bo qua.
    }
  }
  const issues: Issue[] = [];
  for (const [rowId, names] of byRowId) {
    if (names.length > 1) {
      issues.push({
        pkg: names.join(" + "),
        level: "chan",
        detail:
          'HAI package cung khai row.id "' + rowId + '" (' + names.join(" · ") + ')' +
          " ⇒ tang nap chi sinh MOT entry cho moi row nen package khai sau KHONG BAO GIO chay" +
          " (du no co trong patch + profile). MOT row.id chi duoc MOT package khai.",
      });
    }
  }
  return issues;
}
