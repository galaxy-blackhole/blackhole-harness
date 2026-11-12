
/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Probe mot lan: do batch/URL combo dang phuc vu va danh sach entry ket cua app 5439 (dung trong vong dieu tra 17/10).
 */
const { chromium } = require("/Users/buitronghieu/Desktop/Project/galaxy/galaxy-blackhole/blackhole-tauri/tools/features/node_modules/playwright-core");
const { readFileSync } = require("node:fs");
const url = readFileSync(process.env.HOME + "/.galaxy/blackhole/ready-url.txt", "utf8").trim();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
const requests = [];
page.on("request", (r) => requests.push(r.url()));
await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(6000);
const data = await page.evaluate(() => {
  const boot = window.__DSH_BOOT__ ?? {};
  const batches = boot.batches ?? [];
  const links = Array.from(document.querySelectorAll("link[rel=modulepreload],script[src]")).map((el) => el.href ?? el.src ?? "");
  return { entryCount: (boot.entries ?? []).length, batches, links, rootChars: (document.getElementById("root")?.textContent ?? "").length };
});
await browser.close();
console.log("entry:", data.entryCount, "| so batch:", data.batches.length, "| #root:", data.rootChars);
console.log("khoa cua batch dau:", JSON.stringify(Object.keys(data.batches[0] ?? {})));
const TARGET = "@deepseek-ai/dsh-client-ui-conversation";
const batch = data.batches.find((b) => (b.entries ?? []).includes(TARGET));
if (batch === undefined) { console.log("KHONG tim thay batch chua", TARGET); }
else {
  const entries = batch.entries ?? [];
  console.log("batch chua target: pha=" + batch.phase + " · so entry=" + entries.length + " · bytes~" + (batch.bytes ?? "?") + " · url=" + batch.url);
  console.log("  vi tri target trong batch:", entries.indexOf(TARGET) + "/" + entries.length);
  console.log("  cac entry TRUOC target:", entries.slice(0, entries.indexOf(TARGET)).slice(-6).join(", "));
  const requested = requests.some((u) => batch.url !== undefined && u.includes(String(batch.url).split("/").pop()));
  console.log("  URL cua batch CO duoc YEU CAU khong:", requested);
  console.log("  co trong link/script cua trang:", data.links.some((h) => h.includes(String(batch.url).split("/").pop())));
}
const bootErr = errors.find((t) => t.includes("did not activate")) ?? "";
console.log("--- ket qua boot ---");
console.log(bootErr.split(String.fromCharCode(10)).slice(0, 8).join(" / ").slice(0, 500));
