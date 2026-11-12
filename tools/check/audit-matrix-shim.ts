/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc TASK-194: audit conversion-matrix theo thuoc do RIENG (patch dang song + payload boot dang phuc vu +
 *      symlink profile), khong dung --dump-config (dump tu build lai, khong on dinh khi repo dang ghi).
 */

import { readFileSync, readdirSync, lstatSync, readlinkSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PATCH = join(homedir(), ".galaxy", "blackhole", "app.patch.yml");
const PROFILE = join(homedir(), ".galaxy", "blackhole", "profiles", "node_modules");
const READY = join(homedir(), ".galaxy", "blackhole", "ready-url.txt");

/** Doc patch: tra ve (a) id bi doi name sang goi ta, (b) id bi disable, (c) id co insert goi ta. */
function patchFacts(): { replaced: Set<string>; disabled: Set<string>; inserted: Set<string> } {
  const lines = readFileSync(PATCH, "utf8").split(String.fromCharCode(10));
  const replaced = new Set<string>(); const disabled = new Set<string>(); const inserted = new Set<string>();
  let lastId: string | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const id = /^- id: (\S+)$/u.exec(line);
    if (id !== null) { lastId = id[1] as string; continue; }
    if (lastId !== null && line.trim() === "disabled: true") disabled.add(lastId);
    if (lastId !== null && (lines[i + 1] ?? "").trim().startsWith("name: '@galaxy-blackhole/") && line.trim().startsWith("name:")) replaced.add(lastId);
    const ins = /^- insert: *$/u.test(line) ? "" : null;
    if (ins !== null) { for (let j = i + 1; j < lines.length; j += 1) { const m = /^ {4}- id: (\S+)$/u.exec(lines[j] ?? ""); if (m === null) break; inserted.add(m[1] as string); } }
  }
  return { replaced, disabled, inserted };
}

/** Giai ten goi qua profile, tra ve duong dan that. */
function resolveProfile(name: string): string | null {
  const [scope, pkg] = name.split("/");
  try { const p = join(PROFILE, scope as string, pkg as string); return lstatSync(p).isSymbolicLink() ? readlinkSync(p) : p; } catch { return null; }
}

/** Tai trang dang phuc vu (token -> cookie) va tra HTML. */
async function fetchPage(url: string, cookie = ""): Promise<string> {
  const res = await fetch(url, { headers: cookie.length > 0 ? { cookie } : {}, redirect: "manual" });
  const setCookie = res.headers.get("set-cookie");
  const next = setCookie !== null ? (setCookie.split(";")[0] ?? cookie) : cookie;
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (loc !== null) return fetchPage(new URL(loc, url).toString(), next);
  }
  return res.status === 200 ? res.text() : "";
}

const facts = patchFacts();
const html = await fetchPage(readFileSync(READY, "utf8").trim());
const payloadMatch = html.match(/globalThis\["__GBH_BOOT__"\] = ([\s\S]*?)<\/script>/u);
const payload = payloadMatch === null ? { entries: [], batches: [] } : JSON.parse((payloadMatch[1] as string).replace(/;$/u, "")) as { entries?: { url?: string }[]; batches?: { url?: string }[] };
const urls = [...(payload.entries ?? []), ...(payload.batches ?? [])].map((x) => x.url ?? "").join(" ");
const stockInPayload = new Set((urls.match(/@deepseek-ai\/[a-z0-9-]+/gu) ?? []));
console.log("== MATRIX: SU THAT DOC TU PATCH + PAYLOAD (khong qua --dump-config) ==");
console.log("patch: id bi doi name sang ta " + String(facts.replaced.size) + " · id disabled " + String(facts.disabled.size) + " · entry insert " + String(facts.inserted.size));
console.log("payload boot: " + String((payload.entries ?? []).length) + " entry · ten STOCK con trong URL: " + String(stockInPayload.size) + " → " + [...stockInPayload].join(", "));
let stillStock = 0; const examples: string[] = [];
for (const name of stockInPayload) {
  const r = resolveProfile(name);
  if (r === null || r.includes("node_modules/@deepseek-ai/")) { stillStock += 1; examples.push(name + " -> " + (r === null ? "KHONG CO" : "stock path")); }
}
console.log("trong so do giai qua profile VAN tro ma STOCK: " + String(stillStock) + (examples.length > 0 ? " [" + examples.slice(0, 4).join(" · ") + "]" : ""));
console.log("== DIEM MU (theo ma nguon conversion-matrix.ts) ==");
console.log("1) dong 269-276: id co name '@galaxy-blackhole/...' bi loai khoi 'entry goc' — neu goi ta chi la SHIM nap lai stock thi so lieu ve 0 sai.");
console.log("2) dong 325: ✓ = co 3 chu ky HOAC assetOnly — khong kiem hanh vi/thuc thi, nen goi hong van ✓.");
console.log("3) dong 346/381/440: activeStock dem tu cay --dump-config (offline) + 3 phep tru; khong doi chieu payload dang phuc vu (noi lo ten stock: " + String(stockInPayload.size) + " ten).");
console.log("4) khong dem duoc entry client: payload client batch van chua ten stock nhung khong co dong nao trong matrix.");
console.log("FIXTURE dong hinh: row stock X bi doi name '@galaxy-blackhole/x' → tap replacedIds loai X khoi activeStock (che duoc) — dung nhu dong 269.");
