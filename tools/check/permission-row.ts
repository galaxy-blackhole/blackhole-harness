/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Chẩn đoán dòng "Permission" ở Settings › General: so bề mặt gói host với DSH stock + kiểm payload
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Thư mục repo (gốc blackhole-tauri). */
const REPO = join(import.meta.dir, "..", "..");

/** Thư mục gói host của ta. */
const OURS_DIR = join(REPO, "packages", "host", "permission");

/** Thư mục gói stock tương ứng trong node_modules của host. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-permission-presets");

/** Các export mà bản gốc khai — thiếu cái nào là bề mặt RPC hụt cái đó. */
const EXPORTS = [".", "./types", "./client", "./typert", "./remote", "./package.json"] as const;

/**
 * Đọc `exports` của một package.json.
 * @param dir - thư mục gói.
 * @returns danh sách khoá export, hoặc mảng rỗng khi không đọc được.
 */
function exportsOf(dir: string): string[] {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return [];
  const meta = JSON.parse(readFileSync(file, "utf8")) as { exports?: Record<string, unknown> };
  return Object.keys(meta.exports ?? {});
}

/**
 * Kiểm artefact typert (host + remote-client + types) của một thư mục lib.
 * @param dir - thư mục gói.
 * @returns tên các artefact thiếu.
 */
function missingArtifacts(dir: string): string[] {
  const wanted = ["typert.host.js", "typert.remote-client.js", join("types", "index.d.ts")];
  return wanted.filter((name) => !existsSync(join(dir, "lib", name)));
}

/**
 * Mở URL đã sẵn sàng, đi theo chuyển hướng để lấy phiên (cookie jar), trả HTML.
 * @returns HTML của trang chủ, hoặc chuỗi rỗng khi app chưa sẵn sàng.
 */
async function fetchPage(): Promise<string> {
  const readyFile = join(homedir(), ".galaxy", "blackhole", "ready-url.txt");
  if (!existsSync(readyFile)) return "";
  const base = readFileSync(readyFile, "utf8").trim();
  const visit = async (url: string, cookie: string): Promise<string> => {
    const res = await fetch(url, { redirect: "manual", headers: cookie === "" ? {} : { cookie } });
    const sc = (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    if (res.status === 200) return res.text();
    const loc = res.headers.get("location");
    if (loc === null) return "";
    return visit(new URL(loc, base).toString(), cookie === "" ? sc : cookie);
  };
  try {
    return await visit(base, "");
  } catch {
    return "";
  }
}

/**
 * In bảng chẩn đoán: export, artefact typert, và dấu vết occupant "permission" trong payload đang phục vụ.
 * @returns mã thoát: 0 khi bề mặt đủ (không kết luận về hành vi runtime), 1 khi thiếu.
 */
async function main(): Promise<number> {
  const oursExports = exportsOf(OURS_DIR);
  const stockExports = exportsOf(STOCK_DIR);
  const oursMissing = EXPORTS.filter((key) => !oursExports.includes(key));
  const oursArtifacts = missingArtifacts(OURS_DIR);
  const stockArtifacts = missingArtifacts(STOCK_DIR);
  console.log("[permission-row] export bản gốc : " + stockExports.join(" "));
  console.log("[permission-row] export của ta   : " + oursExports.join(" "));
  console.log("[permission-row] export THIẾU   : " + (oursMissing.length === 0 ? "(khong thieu)" : oursMissing.join(" ")));
  console.log("[permission-row] artefact thiếu : ta=[" + oursArtifacts.join(",") + "] goc=[" + stockArtifacts.join(",") + "]");
  const html = await fetchPage();
  if (html === "") {
    console.log("[permission-row] app chưa phục vụ được (không có ready-url hoặc 401) — bỏ qua phần payload");
  } else {
    const hasPermissionBundle = html.includes("gbh-client-ui-permission-presets");
    const hasOccupant = html.includes("settings.general.item");
    console.log("[permission-row] payload: bundle permission=" + String(hasPermissionBundle) + " · slot settings.general.item=" + String(hasOccupant));
  }
  const broken = oursMissing.length > 0 || oursArtifacts.length > 0;
  console.log(broken ? "[permission-row] KET LUAN: be mat goi host THIEU ⇒ occupant khong co catalog de render" : "[permission-row] be mat goi host DU ⇒ loi (neu co) nam o phia host/runtime, khong phai export");
  return broken ? 1 : 0;
}

process.exit(await main());
