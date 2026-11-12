/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc TASK-194: audit dsh-residue — quet TAN DU theo thuoc do RIENG (payload boot, batch URL dang phuc vu,
 *      toan bo tep van ban trong repo), chi ra mau nam NGOAI pham vi cua tools/check/dsh-residue.ts.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, extname } from "node:path";

const REPO = process.cwd();
const READY = join(homedir(), ".galaxy", "blackhole", "ready-url.txt");

/** Tai mot URL kem cookie (token chi doi duoc qua mot luot dieu huong). */
async function get(url: string, cookie = ""): Promise<{ status: number; text: string; cookie: string }> {
  const res = await fetch(url, { headers: cookie.length > 0 ? { cookie } : {}, redirect: "manual" });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const next = setCookie.length > 0 ? setCookie.split(";")[0] ?? cookie : cookie;
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (loc !== null) return get(new URL(loc, url).toString(), next);
  }
  return { status: res.status, text: res.status === 200 ? await res.text() : "", cookie: next };
}

/** Dem token trong van ban (4 kieu ma cong cu cua Lead khong dem du). */
function tokens(text: string): { upper: number; hyphen: number; camel: number; scope: number } {
  return {
    upper: text.split("DSH").length - 1,
    hyphen: (text.match(/dsh-/gu) ?? []).length,
    camel: (text.match(/dsh[A-Z]/gu) ?? []).length,
    scope: (text.match(/@deepseek-ai\//gu) ?? []).length,
  };
}

/** Thu thap tep van ban trong repo (bo node_modules/.git/.parity/docs). */
function repoFiles(): string[] {
  const out: string[] = [];
  const exts = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".scss", ".json", ".html", ".svg", ".yml", ".yaml", ".sh", ".md"]);
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".git" || name === ".parity" || name === "docs") continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (exts.has(extname(name))) out.push(p);
    }
  };
  for (const root of ["packages", "apps", "tools", "profiles", "scripts"]) {
    const p = join(REPO, root);
    try { if (statSync(p).isDirectory()) walk(p); } catch { /* khong co */ }
  }
  return out;
}

const ready = readFileSync(READY, "utf8").trim();
const page = await get(ready);
const html = page.text;
const payloadMatch = html.match(/globalThis\["__GBH_BOOT__"\] = ([\s\S]*?)<\/script>/u);
const payload = payloadMatch === null ? { entries: [], batches: [] } : JSON.parse((payloadMatch[1] as string).replace(/;$/u, "")) as { entries?: { url?: string }[]; batches?: { url?: string }[] };
const urls = new Set<string>();
for (const batch of payload.batches ?? []) if (batch.url !== undefined) urls.add(new URL(batch.url, ready).toString());
for (const entry of payload.entries ?? []) if (entry.url !== undefined) urls.add(new URL(entry.url, ready).toString());
console.log("== PAYLOAD BOOT ==");
console.log("entries " + String((payload.entries ?? []).length) + " · batch " + String((payload.batches ?? []).length) + " · URL rieng " + String(urls.size));
const stockRefs = new Set<string>();
for (const url of urls) for (const m of url.matchAll(/@deepseek-ai\/[a-z0-9-]+/gu)) stockRefs.add(m[0]);
console.log("ten STOCK con nam trong URL batch dang phuc vu: " + String(stockRefs.size) + " → " + [...stockRefs].slice(0, 12).join(", "));
console.log("ui-trajectory co trong payload: " + String(html.includes("ui-trajectory") || [...urls].some((u) => u.includes("ui-trajectory"))));
let total = { upper: 0, hyphen: 0, camel: 0, scope: 0 };
for (const url of urls) {
  const res = await get(url, page.cookie);
  if (res.status !== 200) continue;
  const t = tokens(res.text);
  total = { upper: total.upper + t.upper, hyphen: total.hyphen + t.hyphen, camel: total.camel + t.camel, scope: total.scope + t.scope };
}
console.log("== TAI NGUYEN DANG PHUC VU (batch bundles) ==");
console.log("DSH " + String(total.upper) + " · dsh- " + String(total.hyphen) + " · dshCamel " + String(total.camel) + " · @deepseek-ai/ " + String(total.scope));
const files = repoFiles();
const byExt = new Map<string, number>();
const hits: { file: string; t: ReturnType<typeof tokens> }[] = [];
for (const file of files) {
  let text = "";
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  const t = tokens(text);
  if (t.hyphen + t.camel + t.upper + t.scope === 0) continue;
  byExt.set(extname(file), (byExt.get(extname(file)) ?? 0) + t.hyphen + t.camel + t.upper + t.scope);
  hits.push({ file: file.replace(REPO + "/", ""), t });
}
hits.sort((a, b) => (b.t.hyphen + b.t.camel + b.t.scope + b.t.upper) - (a.t.hyphen + a.t.camel + a.t.scope + a.t.upper));
console.log("== REPO (moi tep van ban, TRU docs) ==");
console.log("tep co tan du: " + String(hits.length) + " / " + String(files.length) + " · theo duoi: " + [...byExt.entries()].map(([e, n]) => e + "=" + String(n)).join(" "));
for (const hit of hits.slice(0, 10)) console.log("  " + String(hit.t.hyphen + hit.t.camel + hit.t.scope).padStart(6) + " · " + hit.file + " · " + JSON.stringify(hit.t));
console.log("== DIEM MU CUA tools/check/dsh-residue.ts ==");
console.log("1) chi quet tep DANG PHUC VU (index.html + plugin bundles + assets/*.css trong index.html) — khong thay repo sources, .svg/.json/.css khong duoc tham chieu, .md, binaries.");
console.log("2) regex /__DSH_[A-Z_]+__|dsh-[a-z0-9-]{2,40}/ bo sot: dshCamelCase (vd dshHomePath), dsh_ snake, 'dsh' tran, '@deepseek-ai/' path (khong tinh la du).");
console.log("3) khong quet payload boot: URL batch la noi ten stock lo ra (vi du @deepseek-ai/dsh-client-ui-settings/client.js).");
console.log("4) khong phan biet DSH trong comment/minified string vs DSH hien thi — dem chuoi tran khong phai 'tan du nguoi dung thay'.");
