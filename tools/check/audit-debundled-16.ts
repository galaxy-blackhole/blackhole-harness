/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc TASK-212: audit doc lap 16 goi de-bundle (chon 10 theo seed co dinh) — byte-identical voi stock,
 *      .debundled, test khai trong gbh.row.tests va chay xanh, exports phu du so voi stock.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO = process.cwd();
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");

/** Ma hoa ten goi de chon mau co the lap lai. */
function seedOf(name: string): string { return createHash("sha256").update(name).digest("hex").slice(0, 8); }

/** Liet ke tep trong thu muc (de quy, bo node_modules). */
function files(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p); else out.push(relative(dir, p));
    }
  };
  try { walk(dir); } catch { return []; }
  return out.sort();
}

/** So sanh byte toan thu muc lib/ voi stock. */
function compareLib(pkgDir: string, stockDir: string): { same: number; diff: string[]; missing: string[] } {
  const ours = files(join(pkgDir, "lib"));
  const theirs = files(join(stockDir, "lib"));
  const diff: string[] = []; let same = 0; const missing: string[] = [];
  for (const rel of ours) {
    if (!theirs.includes(rel)) { missing.push(rel); continue; }
    const a = readFileSync(join(pkgDir, "lib", rel));
    const b = readFileSync(join(stockDir, "lib", rel));
    if (a.equals(b)) same += 1; else diff.push(rel);
  }
  return { same, diff, missing };
}

const markers = execFileSync("find", ["packages", "-maxdepth", "3", "-name", ".debundled"], { cwd: REPO, encoding: "utf8" }).trim().split(String.fromCharCode(10)).filter((x) => x.length > 0);
const dirs = markers.map((m) => m.replace("/.debundled", "")).sort();
const ranked = dirs.slice().sort((a, b) => seedOf(a).localeCompare(seedOf(b)));
const chosen = ranked.slice(0, 10);
console.log("tong 16 goi · seed chon 10: " + chosen.join(", "));
for (const dir of chosen) {
  const pkg = JSON.parse(readFileSync(join(REPO, dir, "package.json"), "utf8")) as { name?: string; exports?: unknown; gbh?: { row?: { tests?: string[]; stockId?: string }; tests?: string[]; provenance?: { stock?: string } } };
  const g = pkg.gbh ?? {};
  const stockName = g.provenance?.stock ?? g.row?.stockId ?? null;
  const stockDir = stockName === null ? "" : join(STOCK, String(stockName).replace("@deepseek-ai/", ""));
  const cmp = existsSync(stockDir) ? compareLib(join(REPO, dir), stockDir) : { same: 0, diff: [], missing: [] };
  const tests = [...(g.row?.tests ?? []), ...(g.tests ?? [])];
  let testOk = "KHONG-KHAI";
  if (tests.length > 0) {
    try {
      const out = execFileSync("bun", ["test", ...tests], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      const pass = /(\d+) pass/u.exec(out); const fail = /(\d+) fail/u.exec(out);
      testOk = (pass?.[1] ?? "0") + " pass/" + (fail?.[1] ?? "?") + " fail";
    } catch (e) { testOk = "FAIL: " + String(e).slice(0, 60); }
  }
  const stockExports = existsSync(stockDir) ? Object.keys((JSON.parse(readFileSync(join(stockDir, "package.json"), "utf8")) as { exports?: Record<string, unknown> }).exports ?? {}).sort() : [];
  const ourExports = Object.keys((pkg.exports as Record<string, unknown> | undefined) ?? {}).sort();
  const exportDiff = JSON.stringify(stockExports) === JSON.stringify(ourExports);
  console.log(JSON.stringify({ dir, stock: stockName, debundled: existsSync(join(REPO, dir, ".debundled")), libSame: cmp.same, libDiff: cmp.diff.slice(0, 3), libMissing: cmp.missing.slice(0, 3), tests: tests.length, testOk, exportsEqual: exportDiff, stockExports: stockExports.length, ourExports: ourExports.length }));
}
