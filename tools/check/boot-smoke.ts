/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc boot-smoke — cong chan lop loi "trang khong co bootstrap facade": boot app THAT trong home cach ly
 *      (mount DUNG mot row qua overlay patch) roi do 5 chi so tren HTML + DOM + log boot
 */
//
// VÌ SAO CÓ CÔNG CỤ NÀY (sự cố thật 18/10/2026):
//   Mount row ui-renderer ⇒ app 5439 chết: trang 2.882 B, #root 329 ký tự, lỗi
//   "web boot: window.__ModuleLoader__ bootstrap facade is missing", HMR 404.
//   Trong khi đó lab:row của CÙNG gói báo 24.602 ký tự · 0 lỗi console — tức lab KHÔNG bắt được lớp lỗi
//   này. Lý do: lab chỉ đo TRANG ĐÃ RENDER; còn lớp lỗi ở đây là BẢNG INJECTION của index.html RỖNG
//   (không có facade window.__ModuleLoader__, không có global __GBH_BOOT__ (alias __DSH_BOOT__)) ⇒ kernel web boot ném lỗi
//   ngay, trang chỉ còn thẻ lỗi ~329 ký tự. Phép đo phải là:
//     HTML > 40.000 B VÀ có __GBH_BOOT__ (alias __DSH_BOOT__) VÀ có __ModuleLoader__ VÀ #root >= 40.000
//     VÀ 0 lỗi console VÀ 0 dòng "did not activate".
//
// Cách dùng:
//   bun run tools/check/boot-smoke.ts ui-renderer                 # mount row của gói đó
//   bun run tools/check/boot-smoke.ts ui-renderer --skip-stage    # ĐỐI CHỨNG ÂM: cố ý KHÔNG cài gói
//   bun run tools/check/boot-smoke.ts ui-renderer --port 5471 --keep
//
// ⚠️ KHÔNG dùng cổng 5439 và KHÔNG ghi ~/.galaxy/gbh: mọi thứ nằm trong home tạm /tmp/gbh-smoke-<row>.

import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { hostChildEnv, resolveLaunch } from "../../apps/cli/src/host.ts";
import { ensureProfile } from "../../apps/cli/src/profile.ts";
import { repoRoot } from "../../apps/cli/src/paths.ts";
import { hasBootGlobal as htmlHasBootGlobal } from "./boot-global.ts";
import { probePage } from "./page-probe.ts";

/** Ngưỡng của phép đo — lấy từ sự cố thật: trang lành ~108–110 KB, trang lỗi 2.882 B. */
export const MIN_HTML_BYTES = 40_000;
/**
 * Ngưỡng #root cho HOME TẠM (chưa có phiên): đo được **24.602** ở cả row gốc lẫn gói ta (lab 18/10/2026).
 *
 * Vì sao không dùng 40.000: con số 40.000+ là của app THẬT đang có phiên/hội thoại. Home smoke mới tinh
 * không có phiên nên vỏ chỉ vẽ khung ~24.6k ký tự — đặt 40.000 sẽ báo ĐỎ OAN cho một boot hoàn toàn lành
 * (đã xảy ra ở lượt đo đầu). Muốn so CHÍNH XÁC theo đường nền thì chạy boot-smoke hai lần (không overlay
 * rồi có overlay) và so #root — rig 2 biến thể đã làm đúng như vậy: 24.602 = 24.602.
 */
export const MIN_ROOT_CHARS = 20_000;

/** Metadata gbh.row của một gói (hoặc gbh.row_unmounted_ly_do.row khi row đã bị gỡ mount). */
export interface SmokeRow {
  /** Đường dẫn thư mục nguồn của gói. */
  readonly dir: string;
  /** Tên package (giá trị name của row chèn). */
  readonly name: string;
  /** Id row stock bị tắt. */
  readonly id: string;
  /** Id row được chèn (mặc định <id>-ours). */
  readonly insertAs: string;
  /** Alias id module (nếu có). */
  readonly aliases: readonly string[];
  /** Danh sách inject của row chèn (nếu có). */
  readonly inject: readonly string[];
  /** Cấu hình của row (nếu có) — BẮT BUỘC phát vào overlay, nếu không row cần config sẽ ném ValidationError. */
  readonly config?: unknown;
}

/** Kết quả một lần đo. */
export interface SmokeResult {
  /** Home cách ly đã dùng. */
  readonly home: string;
  /** Cổng đã dùng. */
  readonly port: number;
  /** URL có token (rỗng khi boot hỏng). */
  readonly url: string;
  /** Số byte HTML nhận được. */
  readonly htmlBytes: number;
  /** HTML có global CHÍNH __GBH_BOOT__ (hoac alias __DSH_BOOT__). */
  readonly hasBootGlobal: boolean;
  /** HTML có facade __ModuleLoader__. */
  readonly hasFacade: boolean;
  /** Số ký tự #root (0 khi không probe được). */
  readonly rootChars: number;
  /** Lỗi console thu được. */
  readonly consoleErrors: readonly string[];
  /** Số dòng "did not activate" trong log boot. */
  readonly notActivated: number;
  /** Tất cả chỉ số đạt. */
  readonly ok: boolean;
}

/**
 * Đọc metadata row của một package (ưu tiên gbh.row, sau đó gbh.row_unmounted_ly_do.row).
 * Nhận: rowId — tên thư mục trong packages/client hoặc packages/host.
 * Trả: metadata row, hoặc null khi không có.
 */
export function readSmokeRow(rowId: string): SmokeRow | null {
  for (const half of ["client", "host"]) {
    const dir = join(repoRoot(), "packages", half, rowId);
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    const json = JSON.parse(readFileSync(manifest, "utf8")) as {
      name: string;
      gbh?: { row?: Record<string, unknown>; row_unmounted_ly_do?: { row?: Record<string, unknown> } };
    };
    const row = json.gbh?.row ?? json.gbh?.row_unmounted_ly_do?.row;
    if (row === undefined || typeof row["id"] !== "string") return null;
    return {
      dir,
      name: json.name,
      id: row["id"] as string,
      insertAs: (row["insertAs"] as string | undefined) ?? (row["id"] as string) + "-ours",
      aliases: (row["aliases"] as string[] | undefined) ?? [],
      inject: (row["inject"] as string[] | undefined) ?? [],
      config: row["config"],
    };
  }
  return null;
}

/**
 * Render một scalar YAML — QUOTE khi cần (entry bắt đầu bằng @ là KÝ TỰ DÀNH RIÊNG của YAML; để trần thì
 * patch KHÔNG PARSE ĐƯỢC và mọi lượt boot sau đều chết — lỗi thật 17/10/2026, xem rewrite-metadata.ts).
 * Nhận: value — chuỗi cần render.
 * Trả: văn bản YAML an toàn.
 */
export function yamlScalar(value: string): string {
  if (value.length === 0) return "''";
  const unsafe = /^[\s@\`\-?:,\[\]{}#&*!|>'"%]/.test(value) || /: | #/.test(value) || /^(true|false|null|~|yes|no|on|off)$/i.test(value);
  return unsafe ? "'" + value.replace(/'/g, "''") + "'" : value;
}

/**
 * Phát một giá trị YAML bất kỳ (object/array/string/number/boolean/null) vào mảng dòng, thụt lề cho trước.
 * Vì sao cần: overlay của boot-smoke phải chép ĐÚNG `gbh.row.config`; row nào có config bắt buộc (ví dụ
 * engine sqlite với `path`) mà overlay bỏ config sẽ ném ValidationError khi nạp ⇒ service không xuất hiện
 * ⇒ chuỗi entry phụ thuộc pending và #root sụp (lỗi thật 19/10/2026, phát hiện nhờ row session-query-sqlite).
 * @param value - giá trị cần render.
 * @param lines - mảng dòng đích (sửa tại chỗ).
 * @param indent - số khoảng trắng thụt lề của dòng đầu tiên.
 * @returns không.
 */
function emitYaml(value: unknown, lines: string[], indent: number): void {
  const pad = " ".repeat(indent);
  if (value === null) {
    lines[lines.length - 1] = (lines[lines.length - 1] ?? pad) + " null";
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry !== null && typeof entry === "object") {
        lines.push(pad + "-");
        emitYaml(entry, lines, indent + 2);
      } else if (typeof entry === "string" && entry.startsWith("!!js ")) {
        // 19/10/2026 (row webserver): config co the luu bieu thuc dang CHUOI "!!js <expr>" (dung nguyen van tu
        // package.json) ⇒ phai phat lai TAG, khong quote — neu khong plugin nhan chuoi va nem
        // "host \"!!js ctx.webStartup.host …\" is not a concrete IPv4 or IPv6 address literal".
        lines.push(pad + "- " + entry);
      } else {
        lines.push(pad + "- " + scalarOf(entry));
      }
    }
    return;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    // ⚠️ 19/10/2026 — LOI THAT (row session-persistence-jsonl): config kieu `{ js: "dshHomePath('sessions')" }`
    //   phai phat ra tag `!!js <bieu thuc>` (giong patch that), KHONG duoc phat thanh object long nhau —
    //   neu khong plugin nhan object => "ValidationError: $.root expected string but got [object Object]".
    if (keys.length === 1 && keys[0] === "js" && typeof (value as { js?: unknown }).js === "string") {
      lines[lines.length - 1] = (lines[lines.length - 1] ?? pad) + " !!js " + (value as { js: string }).js;
      return;
    }
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (typeof entry === "string" && entry.startsWith("!!js ")) {
        // Cung ly do nhu nhanh mang: chuoi "!!js …" la BIEU THUC, khong phai chuoi thuong.
        lines.push(pad + key + ": " + entry);
        continue;
      }
      if (entry !== null && typeof entry === "object") {
        lines.push(pad + key + ":");
        emitYaml(entry, lines, indent + 2);
      } else {
        lines.push(pad + key + ": " + scalarOf(entry));
      }
    }
    return;
  }
  lines.push(pad + scalarOf(value));
}

/**
 * Render một giá trị vô hướng (string/number/boolean/null) thành YAML an toàn.
 * Nhận: value — giá trị vô hướng.
 * Trả: văn bản YAML.
 */
function scalarOf(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return yamlScalar(String(value));
}

/**
 * Dựng overlay patch bật ĐÚNG một row của ta (tắt row stock tương ứng).
 * Nhận: row — metadata row.
 * Trả: văn bản YAML của overlay.
 */
/**
 * Promote khối PARK thành `gbh.row` trong BẢN COPY package.json của home CÁCH LY.
 * Vì sao: `client-modules` đọc alias CLIENT từ `gbh.row.aliases` (không đọc `row_unmounted_ly_do`), nên row đang park
 * thì smoke sẽ đo oan ("58 entry client chờ service sessions"). Chỉ sửa bản copy trong <smoke-home>, KHÔNG chạm repo/app.
 * Nhận: manifestPath — đường dẫn package.json trong profile của home cách ly. Trả: không (fail-soft: lỗi ⇒ cảnh báo).
 */
export /**
 * Symlink peer cua goi duoc stage vao profile cua home smoke (mirror mount.ts) de import ngoai resolve duoc.
 * @param target - thu muc goi trong profile smoke.
 * @param home - home cach ly cua smoke.
 * @returns so peer da link.
 */
function linkSmokePeers(target: string, home: string): number {
  let text: string;
  try {
    text = readFileSync(join(target, "package.json"), "utf8");
  } catch {
    return 0;
  }
  const peers = ((JSON.parse(text) as { gbh?: { peers?: string[] } }).gbh?.peers ?? []) as string[];
  let linked = 0;
  for (const peer of peers) {
    const candidates = [
      join(repoRoot(), "apps", "host", "node_modules", peer),
      join(repoRoot(), "node_modules", peer),
    ];
    const source = candidates.find((path) => existsSync(path));
    if (source === undefined) continue;
    const link = join(home, "profiles", "node_modules", peer);
    try {
      mkdirSync(dirname(link), { recursive: true });
      rmSync(link, { recursive: true, force: true });
      symlinkSync(source, link, "dir");
      linked += 1;
    } catch {
      // fail-soft: peer khong link duoc thi de nguyen, loi import se do nguyen nhan khac
    }
  }
  return linked;
}
function promoteParkedRow(manifestPath: string): void {
  try {
    if (!existsSync(manifestPath)) return;
    const text = readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(text) as { gbh?: Record<string, unknown> };
    const gbh = parsed.gbh;
    if (gbh === undefined) return;
    const parked = gbh["row_unmounted_ly_do"] as { row?: Record<string, unknown> } | undefined;
    const row = parked?.row;
    if (row === undefined) return;
    gbh["row"] = row;
    delete gbh["row_unmounted_ly_do"];
    writeFileSync(manifestPath, JSON.stringify(parsed, null, 2) + String.fromCharCode(10));
    const id = typeof row["id"] === "string" ? row["id"] : "?";
    console.log("[smoke] promote park -> gbh.row cho " + id + " (chi trong home cach ly)");
  } catch (error) {
    // Fail-soft: đây là bước tái hiện trạng thái, không phải đường nghiệp vụ — lỗi thì cảnh báo và đi tiếp.
    console.warn("[smoke] khong promote duoc khoi park (bo qua): " + String(error));
  }
}

/**
 * Sinh patch overlay cho home cách ly: tắt row stock rồi chèn row của ta (kèm inject/aliases/config đã khai).
 * Nhận: row — metadata row đã đọc từ package.json của gói.
 * Trả: văn bản YAML của overlay (mỗi dòng một mục, kết thúc bằng newline).
 */
export function smokeOverlay(row: SmokeRow): string {
  const lines = ["- id: " + row.id, "  disabled: true", "", "- insert:", "    - id: " + row.insertAs, "      name: " + yamlScalar(row.name)];
  if (row.inject.length > 0) {
    lines.push("      inject:");
    for (const entry of row.inject) lines.push("        - " + yamlScalar(entry));
  }
  if (row.aliases.length > 0) {
    lines.push("      aliases:");
    for (const entry of row.aliases) lines.push("        - " + yamlScalar(entry));
  }
  if (row.config !== undefined) {
    lines.push("      config:");
    emitYaml(row.config, lines, 8);
  }
  return lines.join("\n") + "\n";
}
/**
 * Tìm một cổng trống trong dải smoke (5471..5499 — KHÔNG bao giờ là 5439 hay dải lab 5460).
 * Nhận: không.
 * Trả: số cổng.
 */
function freePort(): number {
  for (let port = 5471; port < 5500; port += 1) {
    const probe = Bun.spawnSync(["lsof", "-ti", "tcp:" + String(port)]);
    if (probe.stdout.toString().trim() === "") return port;
  }
  throw new Error("het cong trong 5471..5499");
}

/**
 * Chạy boot-smoke cho MỘT row.
 * Nhận: row — metadata row; options.port — cổng (mặc định tự tìm); options.skipStage — cố ý KHÔNG cài
 * gói vào profile (đối chứng âm: tái hiện sự cố "row chèn nhưng gói không có"); options.keep — giữ build.
 * Trả: số đo.
 */
export async function runBootSmoke(
  row: SmokeRow,
  options: { port?: number; negative?: boolean; keep?: boolean; realHome?: boolean } = {},
): Promise<SmokeResult> {
  const root = repoRoot();
  // ── CHẾ ĐỘ HOME THẬT (--real-home) ────────────────────────────────────────────────────────────────
  // Vì sao cần: boot-smoke trên home TẠM luôn ĐẠT trong khi app thật (CÓ PHIÊN) suy giảm — (8) #root
  // 46.224 < 47.181 · 45 slot (yêu cầu 46) · 60 lỗi console · 2 pageerror 404. Lớp lỗi đó chỉ hiện khi
  // có phiên/dữ liệu sống. Chế độ này đo trên ~/.galaxy/blackhole nhưng BOOT Ở CỔNG RIÊNG (KHÔNG 5439).
  // ⚠️ BẪY: host ghi ready-url.txt trong home ⇒ SAO LƯU trước và KHÔI PHỤC sau, nếu không lượt check:app
  // của người khác sẽ đọc token cũ (bài học 17/10/2026).
  const home = options.realHome === true ? join(homedir(), ".galaxy", "blackhole") : join("/tmp", "gbh-smoke-" + row.id);
  const readyUrlPath = join(home, "ready-url.txt");
  const readyBackup = existsSync(readyUrlPath) ? readFileSync(readyUrlPath) : undefined;
  if (options.realHome === true) {
    mkdirSync(home, { recursive: true });
    console.log("[boot-smoke] CHE DO HOME THAT: " + home + " (boot o cong rieng, ready-url.txt se duoc khoi phuc)");
  } else {
    rmSync(home, { recursive: true, force: true });
    mkdirSync(home, { recursive: true });
  }
  // CÀI GÓI CỦA ROW TRƯỚC KHI BOOT (kể cả khi row đang bị GỠ MOUNT — khi đó CLI KHÔNG mount nó vì
  // `rewritePackages()` chỉ đi qua gói có gbh.row): overlay của smoke chèn row, nên package PHẢI có mặt trong
  // profile thì loader mới import được. Thiếu bước này, boot-smoke đo oan (1 row failed ⇒ slots không có ⇒
  // 109 entry pending "waiting for services: slots, locale, theme").
  const prevHome = process.env.GBH_HOME;
  const prevDsh = process.env.DSH_HOME;
  process.env.GBH_HOME = home;
  delete process.env.DSH_HOME;
  try {
    ensureProfile();
  } finally {
    if (prevHome === undefined) delete process.env.GBH_HOME;
    else process.env.GBH_HOME = prevHome;
    if (prevDsh !== undefined) process.env.DSH_HOME = prevDsh;
  }
  if (options.negative !== true) {
    const buildOut = join(home, "build-out");
    const build = (await import(join(row.dir, "build.ts"))) as { buildPackage?: (out: string) => Promise<unknown> };
    if (build.buildPackage === undefined) throw new Error(row.name + ": build.ts khong export buildPackage");
    // 19/10/2026 (row experimental-inspector): co goi buildPackage(out) gia dinh thu muc DICH da ton tai
    // (vd copy devtools/ bang cpSync/lstat) => tao truoc de smoke khong chet ENOENT vi ly do khong lien quan.
    mkdirSync(buildOut, { recursive: true });
    await build.buildPackage(buildOut);
    const target = join(home, "profiles", "node_modules", row.name);
    mkdirSync(target, { recursive: true });
    cpSync(join(row.dir, "package.json"), join(target, "package.json"));
    // ADR 0007 mở rộng (19/10/2026, Lead duyệt C1): smoke phải tái hiện ĐÚNG trạng thái mount, kể cả metadata CLIENT
    // (`gbh.row.aliases` mà client-modules đọc để phát entry alias). Row đang PARK thì promote CHỈ TRONG BẢN COPY này.
    promoteParkedRow(join(target, "package.json"));
    cpSync(buildOut, join(target, "lib"), { recursive: true });
    const locale = join(row.dir, "locale");
    if (existsSync(locale)) cpSync(locale, join(target, "locale"), { recursive: true });
    // 19/10/2026 (row experimental-inspector): CLI mount KHONG chay cho goi dang PARK (repo package.json chua
    // co gbh.row) nen PEER chua duoc symlink vao profile ⇒ import that bai (vd `ws`, `open`, `serve-static`).
    // Smoke phai symlink peer y nhu mount.ts lam, neu khong se bao loi "khong lien quan san pham".
    linkSmokePeers(target, home);
  }
  // VÌ SAO ĐI QUA CLI THAT (bh host) thay vì tự dựng harness: chính CLI chạy `ensureRewriteMounts()`
  // (build + copy MỌI package có gbh.row vào profiles/node_modules của home này). Tự stage một gói là
  // KHÔNG TRUNG THÀNH: home tạm có patch của CẢ repo (≈40 row thay thế) nên thiếu 39 gói kia ⇒ boot chết
  // vì lý do không liên quan. Đo lần đầu 18/10/2026 đã mắc đúng bẫy này ("1 required plugin did not activate").
  const overlay = join(home, "overlay-smoke.patch.yml");
  writeFileSync(overlay, smokeOverlay(row));
  const port = options.port ?? freePort();
  let child: ReturnType<typeof spawn>;
  if (options.negative === true) {
    // ĐỐI CHỨNG ÂM (nhà ấm từ lần chạy dương trước): gỡ ĐÚNG gói của row khỏi profile rồi boot bằng
    // harness trực tiếp — tái hiện lớp lỗi "row chèn nhưng gói không có" (đúng trạng thái sự cố 18/10).
    rmSync(join(home, "profiles", "node_modules", row.name), { recursive: true, force: true });
    const launch = resolveLaunch({ port, openBrowser: false, profile: "blackhole", extraPatches: [overlay] } as never);
    child = spawn(launch.node, launch.args, {
      cwd: root,
      env: { ...hostChildEnv(home), DSH_HOME: home, GBH_HOME: home },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } else {
    // ĐƯỜNG THẬT: CLI tự mount mọi gói (đúng `bh host`), rồi boot harness.
    const cli = [join(root, "apps", "cli", "src", "main.ts"), "host", "--port", String(port), "--patch", overlay];
    child = spawn(process.execPath, ["run", ...cli], {
      cwd: root,
      env: { ...hostChildEnv(home), DSH_HOME: home, GBH_HOME: home },
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  let buffer = "";
  const url = await new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve(""), 240_000);
    const onData = (chunk: string): void => {
      buffer = (buffer + chunk).slice(-400_000);
      const match = /http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/.exec(buffer);
      if (match !== null) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", () => {
      clearTimeout(timer);
      resolve("");
    });
  });
  const notActivated = buffer.split("\n").filter((line) => line.includes("did not activate")).length;
  let htmlBytes = 0;
  let hasBootGlobal = false;
  let hasFacade = false;
  let rootChars = 0;
  let consoleErrors: readonly string[] = [];
  try {
    if (url !== "") {
      // PHAI co cookie jar: token chi doi duoc thanh phien qua MOT luot dieu huong (curl tran luon 401).
      const jar = join(home, "cookies.txt");
      const fetched = Bun.spawnSync(["curl", "-sL", "-c", jar, "-b", jar, url]);
      const html = fetched.stdout.toString();
      htmlBytes = html.length;
      // task-31: đọc qua helper dùng chung — ưu tiên __GBH_BOOT__, fallback alias __DSH_BOOT__.
      hasBootGlobal = htmlHasBootGlobal(html);
      hasFacade = html.includes("__ModuleLoader__");
      const probed = await probePage(url, root);
      rootChars = probed.rootChars;
      consoleErrors = probed.errors;
      writeFileSync(join(home, "index.html"), html);
    }
    writeFileSync(join(home, "host.log"), buffer);
  } finally {
    child.kill("SIGTERM");
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const probe = Bun.spawnSync(["lsof", "-ti", "tcp:" + String(port)]);
      if (probe.stdout.toString().trim() === "") break;
    }
    try {
      child.kill("SIGKILL");
    } catch {
      // da chet
    }
    if (options.keep !== true) rmSync(join(home, "build-out"), { recursive: true, force: true });
    if (readyBackup !== undefined) writeFileSync(readyUrlPath, readyBackup);
  }
  const ok =
    url !== "" &&
    htmlBytes > MIN_HTML_BYTES &&
    hasBootGlobal &&
    hasFacade &&
    rootChars >= MIN_ROOT_CHARS &&
    consoleErrors.length === 0 &&
    notActivated === 0;
  return { home, port, url, htmlBytes, hasBootGlobal, hasFacade, rootChars, consoleErrors, notActivated, ok };
}
/**
 * In bảng kết quả và kết luận của một lần smoke.
 * Nhận: row — metadata row; result — số đo.
 * Trả: mã thoát (0 = đạt, 1 = không đạt).
 */
export function reportSmoke(row: SmokeRow, result: SmokeResult): number {
  /** In một dòng của bảng. */
  const line = (name: string, value: string, threshold: string, ok: boolean): void => {
    console.log("| " + name + " | " + value + " | " + threshold + " | " + (ok ? "DAT" : "KHONG DAT") + " |");
  };
  console.log("=== boot-smoke: " + row.name + " (row " + row.id + " -> " + row.insertAs + ") ===");
  console.log("| chi so | do duoc | nguong | ket qua |");
  console.log("|---|---|---|---|");
  line("HTML bytes", String(result.htmlBytes), "> " + String(MIN_HTML_BYTES), result.htmlBytes > MIN_HTML_BYTES);
  line("__DSH_BOOT__", String(result.hasBootGlobal), "true", result.hasBootGlobal);
  line("__ModuleLoader__ (facade)", String(result.hasFacade), "true", result.hasFacade);
  line("#root ky tu", String(result.rootChars), ">= " + String(MIN_ROOT_CHARS), result.rootChars >= MIN_ROOT_CHARS);
  line("loi console", String(result.consoleErrors.length), "0", result.consoleErrors.length === 0);
  line("dong did-not-activate", String(result.notActivated), "0", result.notActivated === 0);
  console.log("");
  for (const error of result.consoleErrors.slice(0, 5)) console.log("  loi: " + error.slice(0, 300));
  console.log(
    result.ok
      ? "KET LUAN: boot LANH — duoc phep khai gbh.row."
      : "KET LUAN: KHONG DAT — KHONG duoc khai gbh.row. Home giu lai: " + result.home + " (index.html + host.log)",
  );
  return result.ok ? 0 : 1;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const rowId = args.find((arg) => !arg.startsWith("--") && !/^[0-9]+$/.test(arg));
  if (rowId === undefined) {
    console.log("Dung: bun run tools/check/boot-smoke.ts <row-id> [--port <n>] [--negative] [--keep] [--real-home]");
    process.exit(2);
  }
  const row = readSmokeRow(rowId);
  if (row === null) {
    console.error("row " + rowId + " khong khai gbh.row / gbh.row_unmounted_ly_do — khong biet row nao de thay.");
    process.exit(2);
  }
  const portIndex = args.indexOf("--port");
  const result = await runBootSmoke(row, {
    ...(portIndex === -1 ? {} : { port: Number(args[portIndex + 1]) }),
    negative: args.includes("--negative"),
    realHome: args.includes("--real-home"),
    keep: args.includes("--keep"),
  });
  process.exit(reportSmoke(row, result));
}