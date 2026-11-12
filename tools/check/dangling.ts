/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Phep kiem CANH INJECT TREO (lop loi GOC 17/10/2026) — tach khoi rows.ts vi luat <=1000 dong/file
 */

import type { Issue } from "./rows.ts";

export interface ReplacedRow {
  /** Ten package cua ta. */
  pkg: string;
  /** Id row (vi du "shortcuts"). */
  rowId: string;
  /** Id package stock bi thay (vi du "@deepseek-ai/dsh-client-shortcuts"). */
  stockId: string;
  /** Row nay co dang BAT trong patch khong. */
  enabled: boolean;
}

/**
 * Bat lop loi GOC cua ngay 17/10/2026: thay mot row thi entry id STOCK bien mat khoi do thi, nhung cac
 * entry STOCK khac van inject dung id do, nen chung khong bao gio activate, treo loading, roi cascade
 * (waiting for service) va trang trang/ngan. parity:dump KHONG thay lop nay vi no so danh sach row trong
 * config, khong so DO THI CLIENT.
 *
 * LUAT (Lead chot 17/10/2026): voi MOI id stock bi ta thay, neu con entry khac inject id do thi tap id ta
 * dang ky (gbh.row.moduleIds hoac gbh.row.aliases) PHAI chua no, neu khong la CHAN kem ten row phu thuoc.
 * Khi tang nap da dang ky alias (nap MOT lan, dang ky N id) thi phep kiem nay tu dong xanh.
 *
 * Nguon du lieu deu co that trong repo, khong doc fixture:
 *   - row ta da thay: package.json co gbh.row (+ gbh.row.id, va ten package stock lay tu PARITY-MATRIX);
 *   - ai inject id stock: dsh.client.inject cua moi goi da cai (stock + cua ta).
 * @param rows - cac row ta da thay.
 * @param injectors - anh xa id package stock -> danh sach entry dang inject no.
 * @param declared - anh xa ten package cua ta -> id da khai trong moduleIds/aliases.
 * @returns van de chan cho moi id stock bi bo trong khi van con entry phu thuoc.
 */
export function danglingInjectIssues(
  rows: readonly ReplacedRow[],
  injectors: ReadonlyMap<string, readonly string[]>,
  declared: ReadonlyMap<string, readonly string[]>,
): Issue[] {
  const issues: Issue[] = [];
  for (const row of rows) {
    if (!row.enabled) continue;
    const dependents = injectors.get(row.stockId) ?? [];
    if (dependents.length === 0) continue;
    if ((declared.get(row.pkg) ?? []).includes(row.stockId)) continue;
    issues.push({
      pkg: row.pkg,
      level: "chan",
      detail:
        "canh inject treo: id stock " + row.stockId + " KHONG con entry (ta da thay row '" + row.rowId +
        "') nhung " + dependents.length + " entry khac van inject id do (" + dependents.slice(0, 4).join(", ") +
        (dependents.length > 4 ? ", ..." : "") +
        ") — chung se treo loading cho toi khi ta dang ky id do (gbh.row.moduleIds hoac gbh.row.aliases)",
    });
  }
  return issues;
}
