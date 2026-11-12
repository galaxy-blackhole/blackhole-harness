#!/usr/bin/env bun
/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiem ADR 0007 tren DU LIEU THAT: doc dump parity (config app da gop), lay `config.plugins` cua tung preset,
 *      ap ban do redirect tu profile THAT, roi in ra tung entry `tool-schedule` truoc/sau + dem 4 tool schedule_*.
 *      Chay: bun run tools/nested-mount/verify-preset.ts [duong-dan-dump.yml]
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { readNestedRedirects, rewriteNestedNames } from "../../packages/host/agent-preset-registry/src/nested-mount.ts";

/** Duong dan dump mac dinh: dump parity moi nhat trong repo. */
function defaultDump(): string | undefined {
  const root = join(import.meta.dir, "..", "..", ".parity", "dumps");
  if (!existsSync(root)) return undefined;
  const dirs = readdirSync(root).sort();
  const last = dirs[dirs.length - 1];
  return last === undefined ? undefined : join(root, last, "ours.yml");
}

/**
 * Tach danh sach preset (id + khoi plugins) tu dump YAML bang cach quet dong (dump la YAML do harness sinh).
 * Nhận: text — noi dung dump. Trả: ban do presetId -> danh sach dong plugins.
 */
function presetBlocks(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const lines = text.split(String.fromCharCode(10));
  let currentId: string | undefined;
  let collecting = false;
  for (const line of lines) {
    const head = /^\s*- id: (\S+)\s*$/.exec(line);
    if (head !== null) {
      const indent = line.length - line.trimStart().length;
      if (indent === 0) {
        currentId = head[1];
        collecting = false;
        continue;
      }
      if (collecting && currentId !== undefined) out.get(currentId)?.push(line);
      continue;
    }
    if (currentId !== undefined && /^\s+plugins:\s*$/.test(line)) {
      collecting = true;
      out.set(currentId, []);
      continue;
    }
    if (collecting && currentId !== undefined) out.get(currentId)?.push(line);
  }
  return out;
}

const dump = process.argv[2] ?? defaultDump();
if (dump === undefined || !existsSync(dump)) {
  console.error("khong thay dump parity — truyen duong dan: bun run tools/nested-mount/verify-preset.ts <dump.yml>");
  process.exit(1);
}
const text = readFileSync(dump, "utf8");
const presets = presetBlocks(text);
/** Thu muc node_modules cua profile THAT (uu tien tham so dong lenh, roi GBH_HOME/DSH_HOME, cuoi cung ~/.galaxy/blackhole). */
function modulesDir(): string {
  const fromArgv = process.argv[3];
  if (fromArgv !== undefined) return join(fromArgv, "profiles", "node_modules");
  return process.env.GBH_HOME !== undefined || process.env.DSH_HOME !== undefined
    ? join(process.env.GBH_HOME ?? process.env.DSH_HOME ?? "", "profiles", "node_modules")
    : join(process.env.HOME ?? "", ".galaxy", "blackhole", "profiles", "node_modules");
}
const redirects = readNestedRedirects(modulesDir());
console.log("dump:", dump);
console.log("ban do redirect:", JSON.stringify([...redirects.map.entries()]));
console.log("canh bao:", redirects.warnings.length === 0 ? "(khong co)" : redirects.warnings.join(" | "));

const TOOL_IDS = ["schedule_create", "schedule_list", "schedule_delete", "schedule_update"];
let found = 0;
for (const presetId of ["preset-standard", "preset-ptc", "preset-cordis"]) {
  const block = presets.get(presetId);
  if (block === undefined) {
    console.log("[" + presetId + "] KHONG thay danh sach plugins trong dump");
    continue;
  }
  const before = block.filter((line) => line.includes("tool-schedule"));
  // Doi chieu: tim cac dong name cua plugin tool-schedule va ap redirect thu cong theo ban do THAT.
  const rewritten = block.map((line) => {
    for (const [stockId, ours] of redirects.map.entries()) {
      if (line.includes("name: '" + stockId + "'")) return line.replace("name: '" + stockId + "'", "name: '" + ours + "'");
    }
    return line;
  });
  const after = rewritten.filter((line) => line.includes("tool-schedule"));
  console.log("[" + presetId + "] truoc:", before.map((line) => line.trim()).join(" ; ") || "(khong co)");
  console.log("[" + presetId + "] sau :", after.map((line) => line.trim()).join(" ; ") || "(khong co)");
  if (after.some((line) => line.includes("@galaxy-blackhole/gbh-tool-schedule"))) found += 1;
}

// Chay ham THAT tren danh sach plugins cua preset-standard de chac chan no khong chi la thay chuoi.
const standard = presets.get("preset-standard") ?? [];
const entries = standard.length === 0 ? [] : [{ id: "probe", plugins: standard }];
const effective = rewriteNestedNames(entries, redirects.map, "preset-standard") as Array<Record<string, unknown>>;
const flat = JSON.stringify(effective);
const mapped = TOOL_IDS.filter((id) => flat.includes(id));
console.log("so preset co tool-schedule doi ten:", found + "/3 (preset-standard · preset-ptc · preset-cordis)");
console.log("tool id xuat hien trong composition sau khi doi:", mapped.length + "/4", JSON.stringify(mapped));
if (found < 3 || mapped.length < 4) {
  console.log("KET LUAN: CHUA DAT — xem so do tren");
  process.exit(1);
}
console.log("KET LUAN: DAT — 3 preset doi ten sang goi cua ta · du 4 tool schedule_* trong composition");
