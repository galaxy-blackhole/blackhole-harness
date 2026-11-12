/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Sinh bang tien do M5: moi row T3 — da thay chua, package co trong repo chua, co test/README chua.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { bootJson } from "./app-health";
import { profileOf } from "./row-cost";
import { readMatrix } from "../scaffold/lib";

/** Thu muc goc repo. */
const ROOT = join(import.meta.dir, "..", "..");

/**
 * Doc PATCH DANG CHAY cua app de biet row nao da bi thay THAT.
 * Nguon su that la <home>/app.patch.yml (patch cua luot boot dang phuc vu), khong phai
 * `--dump-config` (lenh do SINH LAI patch) va khong phai payload (payload chi cho biet
 * goi CO MAT, khong cho biet row da bi thay hay chua).
 * @returns tap id row da bi thay.
 */
function swappedRows(): Set<string> {
  const out = new Set<string>();
  const file = join(homedir(), ".galaxy", "blackhole", "app.patch.yml");
  if (!existsSync(file)) return out;
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^- id: (\S+)$/.exec(lines[i] ?? "");
    if (m === null) continue;
    const id = m[1] ?? "";
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j += 1) {
      if (/^\s+disabled: true$/.test(lines[j] ?? "")) {
        out.add(id);
        break;
      }
    }
  }
  return out;
}

/**
 * Doc danh sach id package DANG CHAY THAT tu payload __GBH_BOOT__ (alias __DSH_BOOT__) cua app.
 * @returns tap id, hoac rong neu khong doc duoc.
 */
async function liveIds(): Promise<Set<string>> {
  const out = new Set<string>();
  const file = join(homedir(), ".galaxy", "blackhole", "ready-url.txt");
  if (!existsSync(file)) return out;
  try {
    const url = readFileSync(file, "utf8").trim();
    const first = await fetch(url, { redirect: "manual" });
    const cookie = (first.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    const html = first.status === 200 ? await first.text()
      : await (await fetch(new URL(url).origin + "/", { headers: cookie ? { cookie } : {} })).text();
    for (const m of html.matchAll(/@(?:galaxy-blackhole|deepseek-ai)\/[a-z0-9-]+/g)) out.add(m[0]);
  } catch {
    return out;
  }
  return out;
}

/**
 * Do kich thuoc ban build cua goi DSH goc.
 * @param pkg - ten package goc.
 * @returns so dong JS.
 */
function stockLines(pkg: string): number {
  const lib = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", pkg.split("/").pop() as string, "lib");
  let n = 0;
  if (!existsSync(lib)) return n;
  for (const f of readdirSync(lib)) {
    const full = join(lib, f);
    if (statSync(full).isFile() && f.endsWith(".js")) n += readFileSync(full, "utf8").split("\n").length;
  }
  return n;
}

/**
 * Kiem trang thai thu muc package cua ta.
 * @param dir - thu muc package.
 * @returns so file nguon, co test khong, co README khong.
 */
function oursState(dir: string): { exists: boolean; sources: number; tests: boolean; readme: boolean } {
  if (!existsSync(dir)) return { exists: false, sources: 0, tests: false, readme: false };
  let sources = 0;
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|css)$/.test(name)) sources += 1;
    }
  };
  walk(join(dir, "src"));
  const tdir = join(ROOT, "tests", "client");
  const base = dir.split("/").pop() as string;
  const tests = existsSync(tdir) && readdirSync(tdir).some((f) => f.endsWith(".test.ts") && f.includes(base.replace(/^client-/, "")));
  return { exists: true, sources, tests, readme: existsSync(join(dir, "README.md")) };
}

/**
 * Doc payload MOT lan va dem so row inject tung package.
 * @returns anh xa ten package goc -> so row inject no.
 */
async function blastMap(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const url = readFileSync(join(homedir(), ".galaxy", "blackhole", "ready-url.txt"), "utf8").trim();
  try {
    const first = await fetch(url, { redirect: "manual" });
    const cookie = (first.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    const html = first.status === 200 ? await first.text() : await (await fetch(new URL(url).origin + "/", { headers: cookie ? { cookie } : {} })).text();
    const raw = bootJson(html);
    if (raw === null) return out;
    const json = JSON.parse(raw) as { entries?: { inject?: string[] }[] };
    for (const e of json.entries ?? []) for (const i of e.inject ?? []) out.set(i, (out.get(i) ?? 0) + 1);
  } catch {
    return out;
  }
  return out;
}

/**
 * Kiem xem test cua mot row co BANG CHUNG TANG ARTIFACT khong.
 *
 * Vi sao can rieng phep kiem nay: mot test chi import `src/` se XANH ke ca khi bundle build ra
 * sai (ESM thay vi CJS, thieu id literal, hong o buoc dong goi). Do la lop loi ma `gate` khong thay
 * va `check:rows` chi bat duoc luc mount. Bang chung tang artifact = test CO doc file da build
 * (`readFileSync` vao `lib/*.js`), thuong kem doc bundle GOC de doi chieu (G4).
 * @param rowId - id row (vd `ui-goal`).
 * @param packageName - ten package cua ta (vd `@galaxy-blackhole/gbh-client-ui-goal`).
 * @returns `true` neu co it nhat mot file test cua row doc artifact da build.
 */
function artifactEvidence(rowId: string, packageName: string): boolean {
  const dir = join(ROOT, "tests");
  if (!existsSync(dir)) return false;
  const files: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at)) {
      const full = join(at, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".test.ts")) files.push(full);
    }
  };
  walk(dir);
  const slug = rowId.replace(/^client-/, "");
  for (const file of files) {
    const base = file.split("/").pop() ?? "";
    const mine = base.includes(slug) || base.includes(rowId);
    if (!mine) continue;
    const text = readFileSync(file, "utf8");
    if (!text.includes("readFileSync")) continue;
    // Doc artifact that su: duong dan tro toi file da build, khong phai fixture JSON.
    if (/lib\/[a-z-]+\.js|\.client\b|built\.|client\.js|index\.js/.test(text)) return true;
    if (text.includes(packageName)) return true;
  }
  return false;
}

/**
 * Diem vao: sinh docs/M5-STATUS.md.
 * @returns ma thoat tien trinh.
 */
async function main(): Promise<number> {
  const swapped = swappedRows();
  const live = await liveIds();
  const rows = readMatrix().filter((r) => r.tier.startsWith("T3"));
  const out: string[] = [];
  out.push("<!--");
  out.push(" author Bùi Trọng Hiếu");
  out.push(" email kevinbui210191@gmail.com");
  out.push(" create date 15/10/2026");
  out.push(" modify date 17/10/2026");
  out.push(" desc Bảng tiến độ M5 — SINH TỰ ĐỘNG bởi bun run m5:status, đừng sửa tay.");
  out.push("-->");
  out.push("");
  out.push("# Tiến độ M5 — " + rows.length + " row client (tier T3)");
  out.push("");
  out.push("Sinh tự động bởi bun run m5:status. Cột 'Đang chạy' đọc từ **patch của lượt boot đang phục vụ** (`<home>/app.patch.yml`): row đã bị `disabled: true` ⇒ đã thay.");
  out.push("");
  out.push("| # | Row | Dòng gốc | Package của ta | Trong repo | Nguồn | Test | **Artifact** | README | Đang chạy |");
  out.push("|---|---|---|---|---|---|---|---|---|---|");
  let done = 0;
  let artifactRows = 0;
  for (const r of rows) {
    const dir = join(ROOT, "packages", "client", r.rowId);
    const st = oursState(dir);
    const ourName = r.rowId.startsWith("client-") ? "@galaxy-blackhole/gbh-" + r.rowId : "@galaxy-blackhole/gbh-client-" + r.rowId;
    const isLive = swapped.has(r.rowId);
    if (isLive) done += 1;
    const artifact = st.exists ? artifactEvidence(r.rowId, ourName) : false;
    if (artifact) artifactRows += 1;
    out.push("| " + r.index + " | " + r.rowId + " | " + stockLines(r.stock) + " | " + ourName + " | " +
      (st.exists ? "có" : "—") + " | " + (st.sources === 0 ? "—" : String(st.sources)) + " | " +
      (st.tests ? "có" : "—") + " | " + (artifact ? "**có**" : "—") + " | " +
      (st.readme ? "có" : "—") + " | " + (isLive ? "CÓ" : "—") + " |");
  }
  out.push("");
  out.push("**Đang chạy thật: " + done + "/" + rows.length + " row.**");
  out.push("");
  out.push("**Bằng chứng tầng ARTIFACT: " + artifactRows + "/" + done + " row đang chạy** — tức test có ĐỌC file đã build " +
    "(`readFileSync` vào `lib/*.js`), thường kèm đọc bundle GỐC để đối chiếu (G4). Test chỉ import `src/` vẫn XANH " +
    "kể cả khi bundle build ra sai (ESM thay vì CJS · thiếu id literal · hỏng ở bước đóng gói) — đó là lớp lỗi mà " +
    "`gate` không thấy. **— KHÔNG phải cổng chặn**: row thiếu cột này vẫn hợp lệ nếu đã có lab + `check:app`; " +
    "nhưng khi sửa row đó thì nên bổ sung.");
  out.push("");
  // Hang doi theo CHI PHI THAT (khong theo so dong): primitive + khoa tu dien + trang thai song.
  const todo = rows.filter((r) => !oursState(join(ROOT, "packages", "client", r.rowId)).exists);
  const prof = todo.map((r) => ({ r, c: profileOf(r.rowId) })).filter((x) => x.c !== null);
  prof.sort((a, b) => (a.c!.primitives + a.c!.localeKeys + (a.c!.live ? 8 : 0)) - (b.c!.primitives + b.c!.localeKeys + (b.c!.live ? 8 : 0)));
  out.push("## Hàng đợi theo CHI PHÍ THẬT (rẻ trước — không xếp theo số dòng)");
  out.push("");
  const blast = await blastMap();
  out.push("| # | Row | Dòng ROW | Primitive | Khoá | Sống | Điểm | **Nổ** |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const x of prof.slice(0, 20)) {
    const c = x.c!;
    const score = c.primitives + c.localeKeys + (c.live ? 8 : 0);
    const b = blast.get(x.r.stock) ?? -1;
    out.push("| " + x.r.index + " | " + x.r.rowId + " | " + c.entryLines + (c.chunkLines > 0 ? " (+" + c.chunkLines + " TV)" : "") + " | " + c.primitives + " | " + c.localeKeys + " | " + (c.live ? "có" : "—") + " | " + score + " | " + (b < 0 ? "?" : String(b)) + " |");
  }
  out.push("");
  out.push("Điểm = primitive + khoá từ điển + 8 nếu có trạng thái sống. **Nổ** = số row khác inject package này.");
  out.push("**Dòng ROW** = dòng code của CHÍNH row; `(+N TV)` = chunk lazy chứa thư viện bên thứ ba — **KHÔNG tính vào công viết lại**.");
  out.push("");
  out.push("**Xếp lịch theo HAI trục**: *điểm* = công viết lại · *nổ* = hậu quả nếu sai. Một row điểm thấp mà nổ lớn");
  out.push("(ví dụ `locale`: điểm 13 nhưng **48 row** phụ thuộc, entry `immediately`) thì phải làm CẨN THẬN, không phải làm nhanh.");
  out.push("");
  writeFileSync(join(ROOT, "docs", "M5-STATUS.md"), out.join("\n"), "utf8");
  console.log("docs/M5-STATUS.md: " + rows.length + " row, dang chay that " + done);
  return 0;
}

// Chi chay CLI khi file nay DUOC GOI TRUC TIEP — neu thieu guard nay thi moi lan import no
// se chay luon CLI cua no (loi that: m5-status.ts import row-cost.ts va bi no 'cuop' mat luong).
if (import.meta.main) process.exit(await main());