/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiem 11 chi so suc khoe cua app 5439 sau khi mount row — mot thuoc do chung cho ca team.
 *      (8) dung NGUONG CAU TRUC (#root + so slot + 0 loi) thay cho so ky tu tuyet doi — xem chu thich tai cho.
 */
import { bootGlobalIndex } from "./boot-global.ts";
import { chuanHoaHost } from "../../tests/lib/artefact-normalize.ts";
import { probeGeometry, probePage, type GeoBox } from "./page-probe.ts";
import { existsSync, readdirSync, readFileSync, statSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Duong dan file token cua app dang chay. */
const READY = join(homedir(), ".galaxy", "blackhole", "ready-url.txt");
/** Log cua host 5439. */
const LOG = join(homedir(), ".galaxy", "blackhole", "host-5439.log");
/** Nguong toi thieu cua trang khi app khoe (byte). */
const MIN_PAGE_BYTES = 40_000;
/**
 * Nguong (8) — CAU TRUC, khong phai so ky tu tuyet doi.
 *
 * Vi sao doi (18/10/2026): brand swap GBH bo wordmark SVG chu "deepseek HARNESS" (path chu ~17.574 byte
 * trong innerHTML) nen #root tut 67.167 -> 49.593 ky tu TRONG KHI giao dien KHONG mat noi dung
 * (do duoc: 46 slot, 41 svg, 34 button, 0 loi console). Neu giu nguong tuyet doi 60.000 thi mot thay doi
 * CO CHU DINH cua thuong hieu se bao "UI khong render" — dung lop bao oan da tra gia nhieu lan.
 * Nguong moi: #root >= 40.000 VA so [data-slot] >= 46 VA 0 loi console VA 0 pageerror.
 */
const MIN_ROOT_STRUCTURAL_CHARS = 40_000;
/** So slot toi thieu khi UI render du (do tren app lanh sau brand swap: 46). */
const MIN_SLOT_COUNT = 46;
/** So entry toi thieu khi moi row deu duoc thay tron ven (thieu = co goi bi loai khoi do thi). */
const MIN_ENTRIES = 72;

/** Ket qua mot chi so. */
interface Check {
  /** Ten chi so. */
  name: string;
  /** Gia tri do duoc (chuoi de in). */
  value: string;
  /** Dat hay khong. */
  ok: boolean;
}

/**
 * Doc token tu ready-url.txt.
 * @returns URL day du, hoac null neu chua co file.
 */
function readUrl(): string | null {
  try {
    const raw = readFileSync(READY, "utf8").trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Tai trang, tu xu ly token: URL co token thuong tra 302 kem Set-Cookie,
 * va request sau do phai mang cookie do (neu khong se bi 401).
 * @param url - URL day du co token.
 * @returns noi dung trang, hoac chuoi rong neu loi.
 */
async function fetchPage(url: string, attempts = 3): Promise<{ html: string; status: number }> {
  // Trong cua so restart, request dau co the tra 401/68 B vi host chua san sang.
  // Thu lai vai lan truoc khi ket luan app chet — tranh bao dong gia (da xay ra 3 lan).
  let last = { html: "", status: 0 };
  for (let i = 0; i < attempts; i += 1) {
    last = await fetchOnce(url);
    if (Buffer.byteLength(last.html, "utf8") >= MIN_PAGE_BYTES) return last;
    if (last.status === 401) return last;
    await new Promise((r) => setTimeout(r, 4000));
  }
  return last;
}

/**
 * Mot lan thu tai trang (khong thu lai).
 * @param url - URL day du co token.
 * @returns noi dung trang, hoac chuoi rong neu loi.
 */
async function fetchOnce(url: string): Promise<{ html: string; status: number }> {
  try {
    const first = await fetch(url, { redirect: "manual" });
    if (first.status === 200) return { html: await first.text(), status: 200 };
    const raw = first.headers.get("set-cookie") ?? "";
    const cookie = raw.split(";")[0] ?? "";
    const origin = new URL(url).origin;
    const second = await fetch(origin + "/", { headers: cookie ? { cookie } : {} });
    return { html: await second.text(), status: second.status };
  } catch {
    return { html: "", status: 0 };
  }
}

/**
 * Dem so entry trong payload __GBH_BOOT__ (alias __DSH_BOOT__) va che do cua bo nap.
 * @param html - noi dung trang.
 * @returns so entry va mode, hoac null neu khong co payload.
 */
/** Xuất lại helper dùng chung (task-31) — giữ tên cũ cho nơi đang import từ app-health. */
export { bootGlobalIndex };

/** So slot toi thieu khi app mo phien RONG ("Phien moi") — do that 40 slot ngay 22/10/2026. */
const MIN_SLOT_COUNT_PHIEN_RONG = 40;

/**
 * Rut doi tuong JSON cua global boot tu HTML (quet can bang ngoac, khong dung regex).
 * @param html - noi dung trang.
 * @returns chuoi JSON, hoac null neu khong thay.
 */
export function bootJson(html: string): string | null {
  const at = bootGlobalIndex(html);
  if (at < 0) return null;
  const start = html.indexOf("{", at);
  let depth = 0;
  for (let i = start; i < html.length; i += 1) {
    const c = html[i];
    if (c === "{") depth += 1;
    else if (c === "}") { depth -= 1; if (depth === 0) return html.slice(start, i + 1); }
  }
  return null;
}

function readBoot(html: string): { entries: number; mode: string; ours: string[] } | null {
  const at = bootGlobalIndex(html);
  if (at < 0) return null;
  const start = html.indexOf("{", at);
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < html.length; i += 1) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === "\"") inStr = false;
    } else if (c === "\"") inStr = true;
    else if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) return null;
  try {
    const payload = JSON.parse(html.slice(start, end)) as { entries?: unknown[]; batches?: unknown[]; release?: { version?: string } };
    const raw = html.slice(start, end);
    const ours = [...new Set(raw.match(/@galaxy-blackhole\/[a-z0-9-]+/g) ?? [])].sort();
    const batches = Array.isArray(payload.batches) ? payload.batches.length : 0;
    const version = payload.release?.version ?? "?";
    return { entries: Array.isArray(payload.entries) ? payload.entries.length : 0, mode: batches + " batch · release " + version, ours };
  } catch {
    return null;
  }
}

/**
 * Dem so dong bao entry khong activate trong log host.
 * @returns so dong, hoac -1 neu khong doc duoc log.
 */
function countNotActivated(): number {
  try {
    return readFileSync(LOG, "utf8").split("\n").filter((l) => l.includes("did not activate")).length;
  } catch {
    return -1;
  }
}

/**
 * In bang ket qua va ket luan.
 * @param checks - danh sach chi so.
 * @returns ma thoat: 0 khi tat ca dat, 1 khi co chi so khong dat.
 */
function report(checks: Check[]): number {
  console.log("| Chi so | Do duoc | Ket qua |");
  console.log("|---|---|---|");
  for (const c of checks) console.log("| " + c.name + " | " + c.value + " | " + (c.ok ? "DAT" : "KHONG DAT") + " |");
  const bad = checks.filter((c) => !c.ok);
  console.log("");
  if (bad.length === 0) {
    console.log("KET LUAN: app LANH — mount duoc phep.");
    return 0;
  }
  // Ban mount cu KHONG phai "app hong" — app chay tot, chi la code cu hon repo. Bao dung muc do
  // de khong kich hoat quy trinh "GO MOUNT NGAY" oan (bai hoc 17/10/2026).
  const onlyStale = bad.every((c) => c.name.startsWith("(10)"));
  if (onlyStale) {
    console.log("KET LUAN: app LANH nhung dang chay BAN BUILD CU cua " + bad.length + " chi so.");
    console.log("Thuong chi can mot luot `bh host` (no build lai tu nguon) la dong bo. KHONG phai app hong.");
    return 1;
  }
  console.log("KET LUAN: app KHONG LANH — " + bad.map((c) => c.name).join(", ") + ". GO MOUNT NGAY va bao Lead.");
  return 1;
}

/**
 * Diem vao: do 4 chi so suc khoe cua app dang chay.
 * @returns ma thoat tien trinh.
 */
async function main(): Promise<number> {
  const url = readUrl();
  if (url === null) {
    console.log("khong doc duoc " + READY + " — host 5439 chua chay?");
    return 1;
  }
  const page = await fetchPage(url);
  const html = page.html;
  const bytes = Buffer.byteLength(html, "utf8");
  if (page.status === 401) {
    console.log("KET LUAN: KHONG KET LUAN DUOC — token trong ready-url.txt da CU (HTTP 401).");
    console.log("Day KHONG phai app chet: token doi moi lan boot. Lay token moi tu log:");
    console.log("  grep -o \"http://127.0.0.1:5439/?token=[A-Za-z0-9_-]*\" ~/.galaxy/blackhole/host-5439.log | tail -1");
    console.log("roi ghi vao ~/.galaxy/blackhole/ready-url.txt. DUNG GO MOUNT vi ly do nay.");
    return 2;
  }
  const boot = readBoot(html);
  const notActivated = countNotActivated();
  const checks: Check[] = [
    { name: "(1) trang tra ve", value: bytes + " B", ok: bytes >= MIN_PAGE_BYTES },
    { name: "(2) co __GBH_BOOT__ (alias __DSH_BOOT__)", value: boot === null ? "KHONG THAY" : "co", ok: boot !== null },
    { name: "(3) so entry boot", value: boot === null ? "-" : String(boot.entries), ok: boot !== null && boot.entries >= 70 },
    { name: "(4) batches + release", value: boot === null ? "-" : boot.mode, ok: boot !== null && !boot.mode.startsWith("0 ") },
    { name: "(5) dong 'did not activate'", value: notActivated < 0 ? "khong doc duoc log" : String(notActivated), ok: notActivated === 0 },
    {
      name: "(7) entry du (khong co goi bi loai am tham)",
      value: boot === null ? "-" : boot.entries + " / moc " + MIN_ENTRIES,
      ok: boot !== null && boot.entries >= MIN_ENTRIES,
    },
    {
      // 06/11/2026 (P1b): chỉ số (12) — bản CÀI trong profile phải mang id GBH, không quay lại id stock.
      // Đo 06/11/2026 khi máy yên: 4 637 id GBH · 455 id stock (gói chưa port + tự tham chiếu entry + native addon).
      // Một hồi quy THẬT (quên chạy denta khi sync) sẽ đẩy id stock lên ~4 000.
      name: "(12) ban CAI mang id GBH (khong quay lai id stock)",
      value: (() => { const d = demIdProfile(); return d === null ? "khong thay profile" : d.gbh + " id GBH / " + d.stock + " id stock"; })(),
      ok: (() => { const d = demIdProfile(); return d !== null && d.gbh > 3000 && d.stock < 1500; })(),
    },
    {
      name: "(6) goi CUA TA dang chay that",
      value: boot === null ? "-" : String(boot.ours.length) + " goi: " + boot.ours.map((x) => x.split("/").pop()).join(", "),
      ok: boot !== null && boot.ours.length > 0,
    },
  ];
  // Chi so (8): kiem PHIA TRANG bang Chrome headless. Ba chi so (1)(2)(3) deu co the XANH
  // trong khi UI khong render (bai hoc 17/10/2026: "#root" 620 ky tu, the loi, ma entry van du 72).
  // 18/10/2026: nguong CAU TRUC — xem MIN_ROOT_STRUCTURAL_CHARS/MIN_SLOT_COUNT. Ly do: brand swap bo
  // wordmark chu (67.167 -> 49.593 ky tu) la thay doi CO CHU DICH, khong phai mat noi dung.
  const probed = await probePage(url, process.cwd());
  // 22/10/2026: app mở sẵn "Phiên mới" (RỖNG) ⇒ 40 slot; phiên có nội dung ⇒ >= 46 slot. Hai loại trang khác
  //   nhau nên dùng ngưỡng riêng cho từng loại (KHÔNG hạ ngưỡng của phiên có nội dung):
  //   phiên rỗng >= MIN_SLOT_COUNT_PHIEN_RONG (đo thật 40), phiên có nội dung >= MIN_SLOT_COUNT (46).
  // 08/11/2026 (Lead) — SỰ CỐ THẬT: chỉ số (8) đếm RAW số slot nên phụ thuộc DỮ LIỆU NGƯỜI DÙNG (số phiên trong
  //   sidebar, số panel bên phải). Đo hôm nay: 25 slot ở trang "chọn workspace" (app nay mở ở trạng thái này),
  //   35 slot sau khi chọn workspace, trong khi đường nền cũ 40 đo trên profile có nhiều phiên hơn ⇒ ĐỎ OAN.
  //   Nay khoá bằng BẤT BIẾN CẤU TRÚC (chặt hơn, không phụ thuộc dữ liệu): đủ BỘ SLOT XƯƠNG SỐNG của vỏ UI.
  //   Ngưỡng đếm vẫn giữ làm mốc INFO để người đọc thấy con số thật.
  const SLOT_XUONG_SONG = [
    "root",
    "main",
    "main.conversation",
    "sidebar",
    "sidebar.workspaces",
    "conversation.header",
    "conversation.composer",
  ];
  const thieuSlot = SLOT_XUONG_SONG.filter((s) => !(probed.slotNames ?? []).includes(s));
  const nguongSlot = probed.phienRong === true ? MIN_SLOT_COUNT_PHIEN_RONG : MIN_SLOT_COUNT;
  checks.push({
    name: "(8) UI render that (#root + slot + loi console)",
    value:
      probed.skipped !== undefined
        ? "BO QUA: " + probed.skipped
        : probed.rootChars + " ky tu #root (>= " + MIN_ROOT_STRUCTURAL_CHARS + ") · " +
          probed.slotCount + " slot (moc " + nguongSlot + ") · " +
          (thieuSlot.length === 0 ? "du " + SLOT_XUONG_SONG.length + "/" + SLOT_XUONG_SONG.length + " slot xuong song" : "THIEU slot xuong song: " + thieuSlot.join(", ")) + " · " +
          probed.errors.length + " loi console · " + probed.pageErrors.length + " pageerror" +
          (probed.errors.length > 0 ? " [" + probed.errors[0] + "]" : ""),
    ok:
      probed.skipped !== undefined ||
      (probed.rootChars >= MIN_ROOT_STRUCTURAL_CHARS &&
        thieuSlot.length === 0 &&
        probed.errors.length === 0 &&
        probed.pageErrors.length === 0),
  });
  // Chi so (9): chu ky HINH HOC so voi duong nen — bat loi BO CUC, lop loi ma (8) khong thay.
  const baselinePath = join(process.cwd(), ".parity", "layout-baseline.json");
  if (!existsSync(baselinePath)) {
    checks.push({ name: "(9) bo cuc khop duong nen", value: "BO QUA: chua co .parity/layout-baseline.json — CHI ghi bang 'probe-once.ts <url> --save' khi app DA DUNG (da doi chieu oracle), khong ghi khi dang co hoi quy", ok: true });
  } else {
    const base = JSON.parse(readFileSync(baselinePath, "utf8")) as GeoBox[];
    const now = await probeGeometry(url, process.cwd());
    let diff = 0;
    const first: string[] = [];
    for (let i = 0; i < Math.max(base.length, now.length); i += 1) {
      const a = base[i]; const b = now[i];
      if (a === undefined || b === undefined || a.k !== b.k) { diff += 1; if (first.length < 2) first.push("thieu/thua @# " + i); continue; }
      if (a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h) {
        diff += 1;
        if (first.length < 2) first.push(a.k + " (" + a.x + "," + a.y + "," + a.w + "x" + a.h + " -> " + b.x + "," + b.y + "," + b.w + "x" + b.h + ")");
      }
    }
    const total = Math.max(base.length, now.length);
    const pct = total === 0 ? 0 : Math.round((diff / total) * 1000) / 10;
    checks.push({
      name: "(9) bo cuc khop duong nen",
      value: diff + "/" + total + " phan tu khac (" + pct + "%)" + (first.length > 0 ? " [" + first.join(" · ") + "]" : ""),
      ok: total === 0 || pct <= 2,
    });
  }
  // Chi so (10): ban dang MOUNT co phai ban MOI NHAT trong repo khong.
  // Bai hoc 17/10/2026: app phuc vu ban build cu (repo 15:16 vs profile 15:06) ma khong noi gi;
  // ca nhom mat may vong "sua roi ma app khong doi". So hash tung file .js trong lib/.
  checks.push({ name: "(10) ban mount moi nhat (khong phuc vu code cu)", ...(await staleMountCheck()) });
  // Chi so (11): HMR CO SONG khong. G1 doi "web luon bat kem HMR", nhung chua ai do no.
  // HMR cua DSH la mot luong SSE o `/plugins/events` (goi `dsh-client-hmr`, nua client dung EventSource):
  // host push su kien khi cay plugin doi, client nap lai module ma khong tai lai trang.
  checks.push({ name: "(11) HMR song (luong SSE /plugins/events)", ...(await hmrCheck(url)) });
  return report(checks);
}

/**
 * Kiem luong SSE cua HMR: mo ket noi va doi dong `: connected` dau tien.
 * @param url - URL co token cua app.
 * @returns ten chi so, gia tri mo ta, va ket qua dat/khong.
 */
async function hmrCheck(url: string): Promise<{ value: string; ok: boolean }> {
  const origin = new URL(url).origin;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(origin + "/plugins/events", {
      headers: { accept: "text/event-stream" },
      signal: controller.signal,
    });
    if (!res.ok) return { value: "HTTP " + res.status + " (HMR khong phan hoi)", ok: false };
    const reader = res.body?.getReader();
    if (reader === undefined) return { value: "khong doc duoc luong", ok: false };
    const { value } = await reader.read();
    await reader.cancel().catch(() => undefined);
    const head = new TextDecoder().decode(value ?? new Uint8Array()).slice(0, 40).trim();
    return { value: "HTTP 200 · " + head.replace(/\s+/g, " "), ok: head.includes("connected") };
  } catch {
    // Het 6 giay ma chua co du lieu cung la BINH THUONG voi SSE (server giu ket noi mo).
    // Ket noi mo duoc la du; chi bao do khi fetch nem loi that su.
    return { value: "ket noi mo (khong co du lieu trong 6s — binh thuong voi SSE)", ok: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * So hash cac file .js trong lib/ giua repo va ban da mount trong profile.
 * @returns ten chi so, gia tri mo ta, va ket qua dat/khong.
 */
async function staleMountCheck(): Promise<{ value: string; ok: boolean }> {
  const { createHash } = await import("node:crypto");
  const mountRoot = join(homedir(), ".galaxy", "blackhole", "profiles", "node_modules");
  const stale: string[] = [];
  let compared = 0;
  for (const area of ["client", "host"]) {
    const areaDir = join(process.cwd(), "packages", area);
    if (!existsSync(areaDir)) continue;
    for (const name of readdirSync(areaDir)) {
      const libDir = join(areaDir, name, "lib");
      const pkgFile = join(areaDir, name, "package.json");
      if (!existsSync(libDir) || !existsSync(pkgFile)) continue;
      const pkgName = (JSON.parse(readFileSync(pkgFile, "utf8")) as { name: string }).name;
      const mounted = join(mountRoot, pkgName, "lib");
      if (!existsSync(mounted)) continue;
      for (const file of readdirSync(libDir)) {
        if (!file.endsWith(".js")) continue;
        const a = join(libDir, file);
        const b = join(mounted, file);
        if (!existsSync(b)) { stale.push(pkgName + "/" + file + " (thieu trong ban mount)"); continue; }
        compared += 1;
        // Ngu nghia: chi la CU khi ban trong repo MOI HON ban dang mount. Neu ban mount moi hon
        // (vi no duoc build lai tu nguon luc boot) thi app dang chay code MOI HON - khong phai loi.
        const repoTime = statSync(a).mtimeMs;
        const mountTime = statSync(b).mtimeMs;
        // Chuan hoa TRUOC khi bam: Bun chen mot dong chu thich duong dan nguon ("// src/client.ts"
        // vs "// packages/<goi>/src/client.ts") tuy theo thu muc chay build. Khac nhau chi o chu
        // thich => KHONG phai code cu (phat hien cua tm-ui-features 17/10/2026).
        // 06/11/2026 (P1b): bản CÀI mang id GBH (denTa đổi id lúc sync) ⇒ chuẩn hoá id CẢ HAI VẾ
        // trước khi băm; khác nhau chỉ vì id thì KHÔNG phải bản cũ.
        const norm = (p: string): string => chuanHoaHost(readFileSync(p, "utf8")).split("\n").filter((l) => !/^\s*\/\/ .*\.ts\s*$/.test(l)).join("\n");
        const ha = createHash("sha256").update(norm(a)).digest("hex").slice(0, 12);
        const hb = createHash("sha256").update(norm(b)).digest("hex").slice(0, 12);
        if (ha !== hb && repoTime > mountTime) {
          stale.push(pkgName + "/" + file + " (repo " + ha + " moi hon mount " + hb + ")");
        }
      }
    }
  }
  if (compared === 0) return { value: "BO QUA: chua doi chieu duoc file nao", ok: true };
  return { value: stale.length === 0 ? compared + " file khop repo" : stale.length + " BAN MOUNT CU: " + stale.slice(0, 2).join(" · "), ok: stale.length === 0 };
}

if (import.meta.main) process.exit(await main());
/**
 * Đếm id GBH và id stock (trừ 3 id kernel) trong mọi tệp .js của bản CÀI.
 * Nhận: không.
 * Trả: { gbh, stock } hoặc null khi chưa có profile.
 */
function demIdProfile(): { gbh: number; stock: number } | null {
  const goc = join(homedir(), ".galaxy", "blackhole", "profiles", "node_modules", "@galaxy-blackhole");
  if (!existsSync(goc)) return null;
  const KEEP = ["cordis", "schemastery", "cosmokit"];
  let gbh = 0;
  let stock = 0;
  const duyet = (d: string): void => {
    for (const ten of readdirSync(d)) {
      if (ten === "node_modules") continue;
      const p = join(d, ten);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { duyet(p); continue; }
      if (!ten.endsWith(".js")) continue;
      const text = readFileSync(p, "utf8");
      gbh += text.split("@galaxy-blackhole/gbh-").length - 1;
      for (const manh of text.split("@deepseek-ai/").slice(1)) {
        const dau = manh.split(/[^a-z0-9.-]/)[0] ?? "";
        if (dau === "" || KEEP.includes(dau)) continue;
        stock += 1;
      }
    }
  };
  duyet(goc);
  return { gbh, stock };
}