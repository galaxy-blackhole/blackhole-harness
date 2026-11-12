/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Đo TÀN DƯ DSH trong UI ĐANG PHỤC VỤ: tải HTML + mọi bundle script được nhắc tới, rồi đếm
 *      `DSH` và `dsh-` — thước đo của mục tiêu "không còn tham chiếu DSH nào trong UI của ta".
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Tệp chứa URL có token của host đang chạy. */
const READY = join(homedir(), ".galaxy", "blackhole", "ready-url.txt");
/** Kích thước tối thiểu của trang lành (dưới ngưỡng này là trang lỗi). */
const MIN_PAGE_BYTES = 40_000;

/** Một tệp được quét. */
interface Asset {
  /** Nhãn tệp. */
  url: string;
  /** Số byte. */
  bytes: number;
  /** Số lần xuất hiện `DSH`. */
  upper: number;
  /** Số lần xuất hiện `dsh-`. */
  lower: number;
  /** Mẫu tiêu biểu. */
  samples: string[];
}

/**
 * Đọc URL có token từ ready-url.txt.
 * @returns URL đầy đủ, hoặc null khi chưa có tệp.
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
 * Tải một URL, tự xử lý token → cookie.
 * @param url - URL đầy đủ.
 * @param cookie - cookie đã có.
 * @returns nội dung, mã trạng thái, cookie mới.
 */
async function fetchText(url: string, cookie = ""): Promise<{ text: string; status: number; cookie: string }> {
  const headers: Record<string, string> = cookie.length > 0 ? { cookie } : {};
  const res = await fetch(url, { redirect: "manual", headers });
  const setCookie = (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  if (res.status === 200) return { text: await res.text(), status: 200, cookie: cookie.length > 0 ? cookie : setCookie };
  const location = res.headers.get("location");
  if (location !== null) return fetchText(new URL(location, url).toString(), setCookie);
  return { text: "", status: res.status, cookie: setCookie };
}

/**
 * Đếm số lần xuất hiện.
 * @param text - văn bản.
 * @param needle - mẫu.
 * @returns số lần.
 */
function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Lấy mẫu ngữ cảnh của các token DSH.
 * @param text - văn bản nguồn.
 * @returns tối đa 10 mẫu.
 */
function samples(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/__DSH_[A-Z_]+__|dsh-[a-z0-9-]{2,40}/gu)) {
    out.add(match[0]);
    if (out.size >= 10) break;
  }
  return [...out];
}

/**
 * Quét một tệp.
 * @param url - nhãn tệp.
 * @param text - nội dung.
 * @returns số đo.
 */
function scan(url: string, text: string): Asset {
  return { url, bytes: Buffer.byteLength(text, "utf8"), upper: count(text, "DSH"), lower: count(text, "dsh-"), samples: samples(text) };
}

/**
 * Tách danh sách script src khỏi HTML.
 * @param html - nội dung trang.
 * @param baseUrl - URL gốc.
 * @returns danh sách URL tuyệt đối, không trùng.
 */
function scriptUrls(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/gu)) out.add(new URL(match[1] as string, baseUrl).toString());
  return [...out];
}

/**
 * Lấy danh sách URL bundle client từ payload boot trong HTML.
 * @param html - nội dung trang.
 * @param baseUrl - URL gốc.
 * @returns danh sách URL tuyệt đối (đã phân giải tương đối), không trùng.
 */
function payloadPluginUrls(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const match = html.match(/globalThis\["__GBH_BOOT__"\] = ([\s\S]*?)<\/script>/u);
  if (match === null) return [];
  try {
    const payload = JSON.parse((match[1] as string).replace(/;$/u, "")) as { batches?: { url?: string }[]; entries?: { url?: string }[] };
    for (const batch of payload.batches ?? []) if (batch.url !== undefined) out.add(new URL(batch.url, baseUrl).toString());
    for (const entry of payload.entries ?? []) if (entry.url !== undefined) out.add(new URL(entry.url, baseUrl).toString());
  } catch {
    return [];
  }
  return [...out];
}

/**
 * Chạy đo và in báo cáo.
 * @returns mã thoát (luôn 0 — công cụ đo).
 */
async function main(): Promise<number> {
  const ready = readUrl();
  if (ready === null) {
    console.log("KHONG DOC DUOC ready-url.txt — app chua chay.");
    return 0;
  }
  const page = await fetchText(ready);
  if (page.status !== 200 || Buffer.byteLength(page.text, "utf8") < MIN_PAGE_BYTES) {
    console.log("KHONG TAI DUOC TRANG LANH (status=" + page.status + ").");
    return 0;
  }
  const origin = new URL(ready).origin;
  const assets: Asset[] = [scan("index.html", page.text)];
  const urls = scriptUrls(page.text, ready).filter((url) => url.includes("/plugins/") === false);
  for (const url of urls) {
    const res = await fetchText(url, page.cookie);
    if (res.status === 200) assets.push(scan(url.replace(origin, ""), res.text));
  }
  // Bundle client KHÔNG nằm trong <script src> — chúng được tải động theo URL trong payload boot
  // (`entries[].url` / `batches[].url`, dạng "plugins/??a.js,b.js"): phải đọc payload mới đo được UI thật.
  const pluginUrls = [...payloadPluginUrls(page.text, ready), ...scriptUrls(page.text, ready).filter((url) => url.includes("/plugins/"))].filter((url, index, all) => all.indexOf(url) === index);
  // Mỗi URL "plugins/??a.js,b.js" trả về BYTE GHÉP của các bundle — đúng thứ trình duyệt nhận, nên
  // đo trên chính phản hồi đó (tách từng phần sẽ sai vì đường dẫn phần tử không phải /plugins/<tên>).
  for (const url of pluginUrls) {
    const res = await fetchText(url, page.cookie);
    if (res.status === 200) assets.push(scan(url.replace(origin, "").split("&rev=")[0] as string, res.text));
  }
  // 19/10/2026: quét CẢ CSS được nhắc trong index.html — token `--dsh-*` nằm ở đó, thiếu bước này thì
  // thước đo bỏ sót phần lớn tàn dư người dùng NHÌN THẤY (đã gây ước lượng sai 122 vs 11 lần đổi).
  for (const match of page.text.matchAll(/assets\/[A-Za-z0-9._-]+\.css/gu)) {
    const res = await fetchText(origin + "/" + match[0], page.cookie);
    if (res.status === 200) assets.push(scan("/" + match[0], res.text));
  }
  const totalUpper = assets.reduce((sum, item) => sum + item.upper, 0);
  const totalLower = assets.reduce((sum, item) => sum + item.lower, 0);
  assets.sort((a, b) => b.upper + b.lower - (a.upper + a.lower));
  console.log("== TAN DU DSH TRONG UI DANG PHUC VU ==");
  for (const asset of assets.slice(0, 12)) {
    console.log("  " + String(asset.upper).padStart(5) + " DSH · " + String(asset.lower).padStart(4) + " dsh- · " + String(asset.bytes).padStart(8) + " B · " + asset.url);
  }
  console.log("MẪU: " + assets.slice(0, 6).flatMap((item) => item.samples).slice(0, 14).join(" "));
  console.log("TONG: DSH " + totalUpper + " · dsh- " + totalLower + " tren " + assets.length + " tep");
  return 0;
}

process.exit(await main());
