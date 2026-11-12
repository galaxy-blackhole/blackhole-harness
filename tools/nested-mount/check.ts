#!/usr/bin/env bun
/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Tu kiem ADR 0007 (mount row LONG): doc ban do redirect tu profile gia + viet lai ten plugin o MOI do sau,
 *      kiem fail-soft khi goi chua copy, kiem idempotent, kiem khong dung entry khong khop. Chay: bun run tools/nested-mount/check.ts
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  isGroupRow,
  readNestedRedirects,
  rewriteGroupRows,
  rewriteNestedNames,
} from "../../packages/host/agent-preset-registry/src/nested-mount.ts";

let failed = 0;

/**
 * Kiem mot dieu kien. Nhan: ten — mo ta; ok — ket qua; chiTiet — so do khi hong. Tra: khong.
 */
function check(name: string, ok: boolean, chiTiet: string): void {
  if (ok) {
    console.log("[OK  ] " + name);
    return;
  }
  failed += 1;
  console.log("[FAIL] " + name + " — " + chiTiet);
}

const root = mkdtempSync(join(tmpdir(), "gbh-nested-check-"));
try {
  const modules = join(root, "profiles", "node_modules");
  const scope = join(modules, "@galaxy-blackhole");
  // goi A: khai nested + CO lib/index.js (dung duoc)
  mkdirSync(join(scope, "gbh-tool-schedule", "lib"), { recursive: true });
  writeFileSync(
    join(scope, "gbh-tool-schedule", "package.json"),
    JSON.stringify({ name: "@galaxy-blackhole/gbh-tool-schedule", gbh: { nested: { stockId: "@deepseek-ai/dsh-tool-schedule", presets: ["preset-standard"] } } }),
  );
  writeFileSync(join(scope, "gbh-tool-schedule", "lib", "index.js"), "export {};");
  // goi B: khai nested nhung THIEU lib/index.js (fail-soft)
  mkdirSync(join(scope, "gbh-tool-x"), { recursive: true });
  writeFileSync(
    join(scope, "gbh-tool-x", "package.json"),
    JSON.stringify({ name: "@galaxy-blackhole/gbh-tool-x", gbh: { nested: { stockId: "@deepseek-ai/dsh-tool-x" } } }),
  );

  // goi C: `gbh-tool-session-query` — ca ROW NHÓM thật (`optional-session-search` ⇒ con `optional-tool-session-query`)
  mkdirSync(join(scope, "gbh-tool-session-query", "lib"), { recursive: true });
  writeFileSync(
    join(scope, "gbh-tool-session-query", "package.json"),
    JSON.stringify({ name: "@galaxy-blackhole/gbh-tool-session-query", gbh: { nested: { stockId: "@deepseek-ai/dsh-tool-session-query" } } }),
  );
  writeFileSync(join(scope, "gbh-tool-session-query", "lib", "index.js"), "export {};");

  const read = readNestedRedirects(modules);
  check("doc duoc goi co lib ⇒ map co 2 muc", read.map.size === 2, "map.size=" + String(read.map.size));
  check("map tro dung specifier", read.map.get("@deepseek-ai/dsh-tool-schedule") === "@galaxy-blackhole/gbh-tool-schedule", String(read.map.get("@deepseek-ai/dsh-tool-schedule")));
  check("goi thieu lib ⇒ CANH BAO, khong nem", read.warnings.length === 1 && read.warnings[0]?.includes("gbh-tool-x") === true, JSON.stringify(read.warnings));

  const plugins = [
    { id: "persona", name: "@deepseek-ai/dsh-persona" },
    { id: "tool-schedule", name: "@deepseek-ai/dsh-tool-schedule" },
    { id: "planning", name: "cordis:group", group: true, config: { plugins: [{ id: "inner", name: "@deepseek-ai/dsh-tool-schedule" }] } },
  ];
  const rewritten = rewriteNestedNames(plugins, read.map, "preset-standard") as Array<Record<string, unknown>>;
  check("thay o do sau 1", rewritten[1]?.["name"] === "@galaxy-blackhole/gbh-tool-schedule", String(rewritten[1]?.["name"]));
  const inner = ((rewritten[2]?.["config"] as Record<string, unknown>)["plugins"] as Array<Record<string, unknown>>)[0];
  check("thay ca trong cordis:group (do sau 2)", inner?.["name"] === "@galaxy-blackhole/gbh-tool-schedule", String(inner?.["name"]));
  check("khong dung entry khong khop", rewritten[0]?.["name"] === "@deepseek-ai/dsh-persona", String(rewritten[0]?.["name"]));
  check("giu id/group/config", rewritten[2]?.["id"] === "planning" && rewritten[2]?.["group"] === true, JSON.stringify(rewritten[2]?.["id"]));
  const twice = rewriteNestedNames(rewritten, read.map, "preset-standard") as Array<Record<string, unknown>>;
  check("idempotent (chay 2 lan cung ket qua)", JSON.stringify(twice) === JSON.stringify(rewritten), "khac nhau");
  // ===== ROW NHÓM top-level (`cordis:group`) — cấu trúc THẬT của `optional-session-search` trong oracle dump
  // (.parity/dumps/2026-10-17T05-02-00/oracleA_nopatch.yml dòng 1272-1281): `config` là MẢNG con + `isolate`.
  const groupRows = [
    { id: "optional-session-search", name: "cordis:group", group: true, isolate: { sessionQuery: true }, config: [
      { id: "optional-session-query-sqlite", name: "@deepseek-ai/dsh-session-query-sqlite", config: { path: ":memory:", openAt: "first-search" } },
      { id: "optional-tool-session-query", name: "@deepseek-ai/dsh-tool-session-query" },
    ] },
    { id: "plain", name: "@deepseek-ai/dsh-persona" },
  ];
  const grouped = rewriteGroupRows(groupRows, read.map) as Array<Record<string, unknown>>;
  const group = grouped[0] as { id?: string; group?: boolean; isolate?: unknown; config?: Array<Record<string, unknown>> };
  const children = group.config ?? [];
  check("nhom: giu id/group/isolate", group.id === "optional-session-search" && group.group === true && JSON.stringify(group.isolate) === JSON.stringify({ sessionQuery: true }), JSON.stringify(group));
  check("nhom: con tro GBH o do sau 1 trong config MANG", children[0]?.["name"] === "@galaxy-blackhole/gbh-session-query-sqlite" || children[0]?.["name"] === "@deepseek-ai/dsh-session-query-sqlite", String(children[0]?.["name"]));
  check("nhom: con KHONG khai nested thi giu nguyen", children[0]?.["name"] === "@deepseek-ai/dsh-session-query-sqlite", String(children[0]?.["name"]));
  check("nhom: con CO khai nested thi doi specifier", children[1]?.["name"] === "@galaxy-blackhole/gbh-tool-session-query", String(children[1]?.["name"]));
  check("nhom: config cua CON giu nguyen", JSON.stringify(children[0]?.["config"]) === JSON.stringify({ path: ":memory:", openAt: "first-search" }), JSON.stringify(children[0]?.["config"]));
  check("nhom: row khong phai nhom khong bi dung", (grouped[1] as { name?: string }).name === "@deepseek-ai/dsh-persona", String((grouped[1] as { name?: string }).name));
  check("nhom: isGroupRow nhan dung", isGroupRow(groupRows[0]) === true && isGroupRow(groupRows[1]) === false, "isGroupRow sai");
  const again = rewriteGroupRows(grouped, read.map) as Array<Record<string, unknown>>;
  check("nhom: idempotent (chay 2 lan)", JSON.stringify(again) === JSON.stringify(grouped), "lan 2 khac lan 1");
  check("nhom: KHONG sua tham so vao", (groupRows[0] as { config?: Array<Record<string, unknown>> }).config?.[1]?.["name"] === "@deepseek-ai/dsh-tool-session-query", "tham so vao bi sua");

  check("khong sua tham so vao", (plugins[1] as Record<string, unknown>)["name"] === "@deepseek-ai/dsh-tool-schedule", String((plugins[1] as Record<string, unknown>)["name"]));
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failed > 0) {
  console.log("KET LUAN: HONG — " + String(failed) + " dieu kien khong dat");
  process.exit(1);
}
console.log("KET LUAN: DAT — ADR 0007 (ban do redirect + viet lai ten o moi do sau + fail-soft + idempotent)");
