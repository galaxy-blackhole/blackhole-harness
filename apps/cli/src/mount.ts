/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Mount cac package viet lai cua ta vao profile cua app: build + copy vao
 *      <DSH_HOME>/profiles/node_modules, va symlink peer ve DUNG ban kernel dang chay (ADR 0004)
 *      11/11/2026: buoc doi id stock -> GBH co CACHE bang stamp lib/.gbh-rewrite-stamp + co GBH_FORCE_REWRITE=1
 *      12/11/2026: launcher Node khong con thu build.ts (chac chan hong) — chep thang lib/ co san
 *      12/11/2026: kernelModulesDir() lay tu paths.ts (ban npm: kernel o <goi>/node_modules)
 *      12/11/2026: cong chan mount chay duoc duoi Node (mount-gate.ts) — truoc day `node run rows.ts` im lang khong chay
 */

import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { suaIdProfile } from "../../../tools/p1b/denta-profile.ts";
import { dirname, join, relative } from "node:path";
import { appHome, kernelModulesDir as kernelModulesDirFromPaths, repoRoot } from "./paths.ts";
import { linkSelfPackages } from "./self-links.ts";
import { bunOnlyCommand, runMountGate } from "./mount-gate.ts";
import { timePhase } from "./boot-timing.ts";

/** Goc repo (dung cho ban do alias stock → goi ta). */
const REPO_ROOT = repoRoot();

import { chepThuMucCon, chiCoKhaiKieu } from "./mount-copy.ts";
import { parseGbhMetadata, type GbhRowMetadata } from "./rewrite-metadata.ts";
import { buildRuntimeAvailable, embeddedHost, ensureLink, installPrebuiltLib, prebuiltLibs } from "./prebuilt.ts";

/** Mot package viet lai duoc mount vao profile cua app thay cho ban DSH. */
export interface RewritePackage {
  /** Ten package ma row patch se tro toi. */
  specifier: string;
  /** Thu muc nguon trong repo (co src/, build.ts, package.json). */
  sourceDir: string;
  /** Cac peer phai tro ve ban kernel dang chay de chi co MOT instance trong tien trinh. */
  peers: string[];
  /** Duong dan (tuong doi repo) ghi nguon doi chieu G4. */
  reference: string;
  /** Alias host khai o `gbh.nested.hostAliases` (mount alias-only: khong co row nao bi thay). */
  hostAliases?: readonly string[];
  /** Metadata thay row do chinh package khai bao (task-13); VANG khi goi chi khai `gbh.nested`. */
  row?: GbhRowMetadata;
  /** Khai bao row LONG trong preset/group (ADR 0007 — gói tool nằm trong `config.plugins` của preset). */
  nested?: GbhNestedMetadata;
}

/** Khai bao mount row LONG: plugin stock nào bị thay bằng gói của ta, trong những preset nào. */
export interface GbhNestedMetadata {
  /** Id plugin trong danh sách `plugins` của preset (chỉ để đối chiếu, không dùng để import). */
  readonly pluginId?: string;
  /** Tên module STOCK bị thay (khoá của bản đồ redirect). */
  readonly stockId: string;
  /** Các preset chứa plugin này; rỗng = mọi preset. */
  readonly presets?: readonly string[];
  /**
   * 19/10/2026 — MOUNT ALIAS-ONLY (gói `dsh-agent-preset`: MỘT module phục vụ 4 row top-level `preset-*`).
   * Khai ở đây ⇒ mount build+copy gói và tạo symlink `<profile>/node_modules/<stock>` trỏ về gói ta,
   * KHÔNG sinh khối patch nào ⇒ các row giữ nguyên config, chỉ đổi module được nạp.
   */
  readonly hostAliases?: readonly string[];
}

/**
 * Doc khai bao `gbh.nested` tu NGUYEN VAN package.json (khong phu thuoc parseGbhMetadata, de chi sua
 * mot tep theo dung pham vi Lead duyet).
 * Nhan: text — noi dung package.json.
 * Tra: khai bao nested, hoac undefined khi khong khai / khai sai kieu.
 */
export function readNestedDeclaration(text: string): GbhNestedMetadata | undefined {
  let parsed: { gbh?: unknown };
  try {
    parsed = JSON.parse(text) as { gbh?: unknown };
  } catch {
    return undefined;
  }
  const gbh = parsed.gbh;
  if (typeof gbh !== "object" || gbh === null) return undefined;
  const nested = (gbh as { nested?: unknown }).nested;
  const one = (value: unknown): GbhNestedMetadata | undefined => {
    if (typeof value !== "object" || value === null) return undefined;
    const stockId = (value as { stockId?: unknown }).stockId;
    if (typeof stockId !== "string" || stockId.trim() === "") return undefined;
    const pluginId = (value as { pluginId?: unknown }).pluginId;
    const presets = (value as { presets?: unknown }).presets;
    const list = Array.isArray(presets) ? presets.filter((item): item is string => typeof item === "string") : undefined;
    const hostAliasesRaw = (value as { hostAliases?: unknown }).hostAliases;
    const hostAliases = Array.isArray(hostAliasesRaw)
      ? hostAliasesRaw.filter((item): item is string => typeof item === "string")
      : undefined;
    return {
      stockId,
      ...(hostAliases === undefined || hostAliases.length === 0 ? {} : { hostAliases }),
      ...(typeof pluginId === "string" && pluginId.trim() !== "" ? { pluginId } : {}),
      ...(list === undefined ? {} : { presets: list }),
    };
  };
  if (Array.isArray(nested)) {
    const first = nested.map(one).find((item) => item !== undefined);
    return first;
  }
  return one(nested);
}

/** Ket qua mount mot package viet lai. */
export interface MountResult {
  /** Ten package da mount. */
  specifier: string;
  /** Thu muc package trong profile node_modules. */
  dir: string;
  /** true khi vua build lai tu src/. */
  built: boolean;
  /** Cac peer da tro ve kernel. */
  peers: string[];
  /** true khi mount dung de dung duoc. */
  ok: boolean;
  /** Chi tiet loi hoac ly do bo qua. */
  detail?: string;
  /** Ten module STOCK can tro alias ve goi ta (che do alias-only, khong sinh khoi patch). */
  hostAliases?: readonly string[];
  /** Metadata thay row (de profile.ts sinh khoi patch). */
  row?: GbhRowMetadata;
}

/** Mot dong phan quyet cua check:rows sau khi tach cot. */
export interface RowVerdict {
  /** Ten package (da gan tien to @galaxy-blackhole/). */
  pkg: string;
  /** Muc: chan | canh bao | (muc khac neu cong them sau). */
  level: string;
  /** Ly do ngan gon. */
  reason: string;
}

/**
 * Tach bang phan quyet cua check:rows thanh cac dong co CAU TRUC.
 *
 * HOP DONG: cot thu 3 la MUC, va chi muc 'chan' moi duoc chan mount. Truoc 18/10/2026 ham goi dung
 * substring 'chan' tren ca dong nen mot canh bao co chu 'chan' trong cau (vi du 'cong chan KHAO THEO ctx')
 * bi hieu la chan ⇒ bo qua 2 row that.
 * @param output - stdout+stderr cua tien trinh check:rows.
 * @returns cac dong phan quyet da tach cot (bo qua dong khong phai bang).
 */
export function parseRowVerdicts(output: string): RowVerdict[] {
  const out: RowVerdict[] = [];
  for (const line of output.split(String.fromCharCode(10))) {
    if (!line.includes('|')) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    const name = cells[1];
    const level = cells[2];
    const reason = cells[3];
    if (name === undefined || name === '' || level === undefined || reason === undefined) continue;
    if (level !== 'chan' && level !== 'canh bao') continue;
    out.push({ pkg: '@galaxy-blackhole/' + name, level, reason });
  }
  return out;
}

/**
 * Chay cong cu kiem tra truoc mount (tools/check/rows.ts) va tra ve cac package bi CHAN.
 *
 * Dung lai dung cong cu cua Lead qua subprocess (khong chep logic hai noi): no so export + danh sach slot
 * cua ban goc voi nguon cua ta. Package bi chan thi KHONG mount — de mot goi do khong lam mat tinh nang
 * cua ca app (lop loi 'hong im lang' da gap 3 lan trong ngay 17/10).
 * @returns bang specifier -> ly do bi chan (rong khi khong co cong cu hoac tat ca deu dat).
 */
function blockedPackages(): Map<string, string> {
  const blocked = new Map<string, string>();
  const script = join(repoRoot(), 'tools', 'check', 'rows.ts');
  // 12/11/2026 — KHONG IM LANG: .app dong goi KHONG kem tools/check (embed.ts chi chep tools/p1b), nen
  // ban cai that se bo qua cong chan mount. In canh bao ro thay vi im lang; dat GBH_REPO_ROOT de bat lai.
  if (!existsSync(script)) {
    console.warn('[bh] cổng chặn mount bị bỏ qua vì thiếu ' + script + ' — bản đóng gói không kèm tools/check; đặt GBH_REPO_ROOT về repo để bật cổng');
    return blocked;
  }
  // 12/11/2026 — LOI TINH DUNG: `process.execPath run <script>` chi dung khi tien trinh la Bun. App desktop
  // chay launcher bang Node ⇒ lenh vo nghia, tien trinh con chet ngay, output rong ⇒ cong chan mount IM LANG
  // khong chay. mount-gate chon runtime dung (Node --experimental-strip-types, hoac bun du phong) va ghi
  // canh bao RO RANG khi khong runtime nao chay duoc — khong bao gio im lang.
  const gate = timePhase('cong chan mount', () => runMountGate({ script, cwd: repoRoot(), home: appHome() }));
  console.log('[bh] cổng chặn mount: ' + gate.detail);
  if (gate.warning !== undefined) console.warn('[bh] ' + gate.warning);
  const verdicts = parseRowVerdicts(gate.output);
  for (const verdict of verdicts) {
    if (verdict.level === 'chan') continue;
    // MUC KHONG-PHAI-CHAN: IN RA NHUNG KHONG BO ROW. Truoc 18/10/2026 duong mount coi MOI van de la chan
    // (no substring-match chu 'chan' o BAT KY dau trong dong — ke ca trong CAU CHU cua mot canh bao),
    // nen mot luat muc canh bao da BO QUA 2 row that: ui-permission-presets + ui-settings-subagent.
    // Bang chung nguyen van: [bh] khong mount duoc ... (BO QUA (kiem tra truoc mount): artifact con cong chan
    // KHAO THEO ctx ...) -> giu row cua DSH
    console.log('[bh] ' + verdict.pkg + ': ' + verdict.level + ', van mount — ' + verdict.reason);
  }
  for (const verdict of verdicts) {
    if (verdict.level !== 'chan') continue;
    blocked.set(verdict.pkg, verdict.reason);
    // 12/11/2026 — IN ngay tai cho: truoc day mot goi bi CHAN chi hien o dong "khong mount duoc" cua host.ts,
    // nen khi cong chan mount khong chay (app desktop launcher Node) khong ai thay dau vet. Nay moi goi bi
    // chan co mot dong rieng, va dong mo ta runtime o tren chung minh cong da CHAY.
    console.warn('[bh] CHẶN mount ' + verdict.pkg + ' — ' + verdict.reason);
  }
  return blocked;
}

/**
 * Danh sach package viet lai cua buoc 2 (moi lan thay mot row DSH la them mot dong o day).
 * @returns bang package kem peer va nguon doi chieu.
 */
export function rewritePackages(): RewritePackage[] {
  const root = join(repoRoot(), "packages");
  const found: RewritePackage[] = [];
  for (const dir of findPackageDirs(root)) {
    const text = readFileSync(join(dir, "package.json"), "utf8");
    const metadata = parseGbhMetadata(text);
    // 19/10/2026 — ADR 0007: gói khai `gbh.nested` KHÔNG thay row top-level, nhưng VẪN phải build + copy vào
    // profile để registry redirect tên module khi mount preset (row của nó nằm trong config.plugins của preset).
    // Giữ nguyên nhánh cũ cho gói `gbh.row` (chỉ thêm điều kiện OR, không viết lại hàm).
    const nested = readNestedDeclaration(text);
    if (metadata?.row === undefined && nested === undefined) continue;
    let specifier: unknown;
    try {
      specifier = (JSON.parse(text) as { name?: unknown }).name;
    } catch {
      continue;
    }
    if (typeof specifier !== "string" || specifier.trim() === "") continue;
    found.push({
      specifier,
      sourceDir: dir,
      // 19/10/2026: DEDUPE peer — goi khai lai `@deepseek-ai/cordis` trong `gbh.peers` se bi lap (symlink lap
      // vo hai, va test cua tool `rewritePackages` dem sai so peer). Giu thu tu xuat hien dau tien.
      peers: [...new Set(["@deepseek-ai/cordis", "@deepseek-ai/schemastery", ...(metadata?.peers ?? [])])],
      reference: join(relative(repoRoot(), dir), "README.md"),
      ...(metadata?.row === undefined ? {} : { row: metadata.row }),
      ...(nested === undefined ? {} : { nested }),
      ...(nested?.hostAliases === undefined ? {} : { hostAliases: nested.hostAliases }),
    });
  }
  // Thu tu xac dinh (theo ten package) de patch sinh ra on dinh giua cac lan chay.
  return found.sort((left, right) => left.specifier.localeCompare(right.specifier));
}

/**
 * Duyet cay packages/ tim moi package.json (bo qua node_modules/lib/dist).
 * @param root - thu muc packages.
 * @returns danh sach thu muc package, theo thu tu on dinh.
 */
function findPackageDirs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir).sort();
    } catch {
      return;
    }
    if (entries.includes("package.json")) out.push(dir);
    for (const entry of entries) {
      if (entry === "node_modules" || entry === "lib" || entry === "dist" || entry.startsWith(".")) continue;
      const child = join(dir, entry);
      try {
        if (statSync(child).isDirectory()) walk(child);
      } catch {
        // bo qua muc khong doc duoc
      }
    }
  };
  walk(root);
  return out;
}

/** Thu muc node_modules cap profile — noi harness resolve plugin ngoai (va la noi gbh-brand dang nam). */
export function profileModulesDir(): string {
  return join(appHome(), "profiles", "node_modules");
}

/**
 * Thu muc node_modules cua ban kernel dang chay — nguon cho moi peer.
 * 12/11/2026 — chuyen sang `paths.kernelModulesDir()`: bản npm không có `apps/host/node_modules`
 * (kernel là dependency của chính gói, nằm ở `<gói>/node_modules`), nên phép dò phải nằm MỘT chỗ.
 * @returns đường dẫn tuyệt đối tới node_modules chứa kernel.
 */
export function kernelModulesDir(): string {
  return kernelModulesDirFromPaths();
}


/**
 * Build lai package neu ban build cu hon nguon.
 * @param pkg - package can build.
 * @param libDir - thu muc `lib` dich (trong ban mount).
 * @returns true khi da build lai.
 * @throws khi bun khong chay duoc hoac build loi.
 */
export function buildIfStale(pkg: RewritePackage, libDir: string): boolean {
  // 11/11/2026 — host NHÚNG trong .app tự chứa: dùng lib/ ĐÃ BUILD SẴN của gói, không chạy build.ts.
  // Gói cài không mang theo mã nguồn nên build.ts vừa chậm (hàng phút cho ~190 gói) vừa dễ hỏng.
  if (prebuiltLibs()) return installPrebuiltLib(pkg.sourceDir, libDir);
  // 11/11/2026 (Lead): bản NHÚNG mà KHÔNG có lib dựng sẵn (gói chưa từng build) — KHÔNG thử build.ts nữa.
  //   Trong .app không có bun nên mọi lượt build đều nổ "node:internal/modules/cjs/loader" rồi in cảnh báo
  //   "dung artefact co san trong repo (build loi: …)" cho ~190 gói ⇒ người dùng thấy log lỗi giả khi khởi
  //   động. Giữ nguyên artefact đang có trong profile và im lặng; nếu thiếu hẳn thì để mount báo sau.
  if (embeddedHost()) return existsSync(join(libDir, "index.js"));
  // 12/11/2026 — LAUNCHER NODE (app desktop): `node run build.ts` KHONG chay duoc, nen truoc day moi goi
  //   lai spawn mot tien trinh chac chan hong roi moi roi ve artefact co san. Do duoc 39 goi × ~330 ms
  //   ≈ 13 s/luot boot + 39 canh bao "build loi" gia. Co artefact trong repo thi chep thang (mtimes guard),
  //   KHONG thu build nua; thieu artefact thi giu nguyen duong build de loi that van lo ra.
  if (!buildRuntimeAvailable() && (existsSync(join(pkg.sourceDir, "lib", "index.js")) || existsSync(join(pkg.sourceDir, "lib", "client.js")))) {
    return installPrebuiltLib(pkg.sourceDir, libDir);
  }
  // 02/11/2026 — LOI TAT cho vong phat trien: moi luot boot hien rebuild TOAN BO ~190 goi (hang chuc
  // phut tren may dang tai) khien boot.test va viec kiem app khong chay noi. Khi dat BH_SKIP_BUILD=1
  // thi dung artefact da co san; cong gate va CI KHONG dat bien nay nen van luon build that.
  if (process.env.BH_SKIP_BUILD === "1" && existsSync(join(libDir, "index.js"))) return false;
  // ⚠️ 18/10/2026 — LOI LOP 7 ("mount im lang bo qua file client cu"): truoc day ham nay chi xet
  //   MOI lib/index.js. Goi nao co CA HAI dau ra (index.js + client.js) ma index.js moi con
  //   client.js cu/khong co thi ham ket luan "khong cu" => BO QUA BUILD => app phuc vu client CU.
  //   Do that: profile gbh-client-ui-settings/lib/client.js sha a9739932 (CU) trong khi repo
  //   3b8af4d0 (MOI), ma check:app (10) van bao 182 file khop => cong KHONG bat duoc.
  //   => xet MOI dau ra: thieu hoac cu bat ky file nao cung phai build lai.
  const hasClientSource = existsSync(join(pkg.sourceDir, "src", "client.ts"));
  const outputs = hasClientSource ? ["index.js", "client.js"] : ["index.js"];
  // CHU Y: chuoi rong khop MOI file ("x".endsWith("") === true) — co y. Truoc day cho nay chi
  // tinh ".ts", nen sua mot file .module.css KHONG lam ban build cu => app giu ban build CU va
  // nguoi viet tuong ban sua khong co tac dung (su co 17/10/2026 voi row ui-sidebar: ban trong
  // profile 15:06 trong khi repo da build 15:16). Tha build lai hoi nhieu con hon phuc vu code cu.
  // 02/11/2026 — THAY PHEP DO mtime BANG PHEP DO NOI DUNG (stamp sha256):
  //   mtime khong dung duoc (profile luon moi hon nguon => luon ket luan "cu" => build lai MOI goi moi
  //   luot boot: 190 goi x ~1 s => boot 10-20 phut, test boot/rewrite-metadata treo). Nay ghi
  //   `.gbh-build-stamp` = sha256 cua (duong dan + sha256) moi tep nguon; nguon khong doi => BO QUA build,
  //   nguon doi (du chi 1 byte, ke ca .module.css) => build lai. Khong bao gio phuc vu code cu.
  const stampPath = join(libDir, ".gbh-build-stamp");
  const stamp = sourceStamp(pkg.sourceDir);
  const previous = existsSync(stampPath) ? readFileSync(stampPath, "utf8").trim() : "";
  const missingOutput = outputs.some((file) => !existsSync(join(libDir, file)));
  if (!missingOutput && previous === stamp) return false;
  // 08/11/2026 — LOI GOC "exports-targets do ngau nhien theo luot boot": MOI build.ts mo dau bang
  //   `await rm(out, { recursive: true, force: true })` ⇒ xoa CA `lib/types/*.d.ts` (do tools/gen-types.ts sinh,
  //   build KHONG sinh lai) ⇒ moi luot boot rebuild goi nao thi goi do mat types ⇒ cong do dung tap khac nhau.
  //   => snapshot `lib/types` truoc build, phuc hoi sau build. Loi snapshot/restore KHONG duoc lam build that bai.
  const thuMucTypes = join(libDir, "types");
  let banSaoTypes: string | undefined;
  if (existsSync(thuMucTypes)) {
    try {
      banSaoTypes = mkdtempSync(join(tmpdir(), "gbh-types-"));
      cpSync(thuMucTypes, join(banSaoTypes, "types"), { recursive: true });
    } catch (error) {
      banSaoTypes = undefined;
      console.log("[bh] canh bao: khong snapshot duoc lib/types cua " + pkg.specifier + " (" + String(error).slice(0, 80) + ")");
    }
  }
  // 12/11/2026 — build.ts dung Bun.build nên CHỈ chạy được bằng bun; Node phải dò bun (GBH_BUN/~/.bun/bin)
  // thay vì spawn "node run build.ts" (luôn hỏng) và báo lỗi rõ khi máy không có bun.
  const build = bunOnlyCommand(join(pkg.sourceDir, "build.ts"), [libDir]);
  if (build === undefined) throw new Error("khong build duoc " + pkg.specifier + ": thieu bun — cài bun hoặc đặt GBH_BUN");
  const result = spawnSync(build.command, build.args, {
    cwd: pkg.sourceDir,
    encoding: "utf8",
    timeout: 60_000,
  });
  if (banSaoTypes !== undefined) {
    try {
      cpSync(join(banSaoTypes, "types"), thuMucTypes, { recursive: true, force: true });
    } catch (error) {
      console.log("[bh] canh bao: khong phuc hoi duoc lib/types cua " + pkg.specifier + " (" + String(error).slice(0, 80) + ")");
    }
    try {
      rmSync(banSaoTypes, { recursive: true, force: true });
    } catch {
      // Don ban sao that bai khong phai loi boot: thu muc tam se duoc he dieu hanh don sau.
    }
  }
  if (result.status !== 0) {
    throw new Error("khong build duoc " + pkg.specifier + ": " + (result.stderr.trim() || result.stdout.trim() || "loi khong ro"));
  }
  mkdirSync(libDir, { recursive: true });
  writeFileSync(stampPath, stamp + "\n", "utf8");
  return true;
}

/**
 * Bam noi dung cay nguon cua mot goi (moi tep trong src/ + build.ts) de biet co can build lai khong.
 * Nhan: sourceDir - thu muc goi trong repo. Tra: chuoi sha256 hex.
 */
function sourceStamp(sourceDir: string): string {
  const hash = createHash("sha256");
  const files: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      if (name === "node_modules") continue;
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else files.push(abs);
    }
  };
  walk(join(sourceDir, "src"));
  const buildTs = join(sourceDir, "build.ts");
  if (existsSync(buildTs)) files.push(buildTs);
  for (const abs of files.sort()) {
    hash.update(abs.slice(sourceDir.length));
    hash.update("\u0000");
    hash.update(readFileSync(abs));
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

/**
 * Mount mot package viet lai vao profile cua app: build tu src/, copy manifest, va tro tung peer ve ban
 * kernel dang chay. Khong bao gio ghi vao ~/.galaxy/gbh.
 * @param pkg - package can mount.
 * @returns ket qua mount.
 */
export function mountRewritePackage(pkg: RewritePackage): MountResult {
  const dir = join(profileModulesDir(), pkg.specifier);
  const peers: string[] = [];
  try {
    if (!existsSync(join(pkg.sourceDir, "package.json"))) {
      return { specifier: pkg.specifier, row: pkg.row, dir, built: false, peers, ok: false, detail: "thieu nguon " + pkg.sourceDir };
    }

const trace = process.env.BH_TRACE === "1" ? (step: string): void => { console.log("[trace] " + pkg.specifier + " " + step); } : (): void => {};
    trace("bat dau");
    // 02/11/2026 — DU PHONG: mot so goi co build.ts hong (vd ui-chat: lat viet tay chua tai sinh duoc)
    //   thi build nem loi => mount hong => harness thieu bundle client va app khong boot. Nay: neu repo
    //   DA co artefact san thi chep vao profile va di tiep (canh bao ro rang), thay vi lam sap ca app.
    let built = false;
    let buildError = "";
    try {
      built = buildIfStale(pkg, join(dir, "lib"));
    } catch (error) {
      buildError = String(error);
    }
    if (buildError !== "") {
      const repoLib = join(pkg.sourceDir, "lib");
      if (existsSync(join(repoLib, "index.js"))) {
        mkdirSync(join(dir, "lib"), { recursive: true });
        cpSync(repoLib, join(dir, "lib"), { recursive: true });
        if (!embeddedHost()) console.log("[bh] " + pkg.specifier + ": dung artefact co san trong repo (build loi: " + buildError.slice(0, 120) + ")");
      } else {
        throw new Error(buildError);
      }
    }
    trace("build xong built=" + String(built));
    mkdirSync(dir, { recursive: true });
    // 12/11/2026 — chỉ ghi khi KHÁC: ghi lại y nguyên làm mtime đổi mỗi lượt boot (kéo theo bước đổi id
    // phải viết lại manifest lần nữa). Nội dung y hệt ⇒ bỏ qua là no-op đúng nghĩa.
    const manifestNguon = readFileSync(join(pkg.sourceDir, "package.json"), "utf8");
    const manifestDich = join(dir, "package.json");
    if (!existsSync(manifestDich) || readFileSync(manifestDich, "utf8") !== manifestNguon) writeFileSync(manifestDich, manifestNguon);
    // ⚠️ 18/10/2026 — LOI THAT (row `authorization` phat hien): mount CHI copy `lib/` + `package.json`
    //   => gói có `locale/` thì **000e đúng ở tầng REPO nhưng THIẾU ở tầng PROFILE**: harness đọc
    //   `locale/` của gói ĐÃ MOUNT để lấy chuỗi giao diện ⇒ mất chuỗi ⇒ tiêu đề/mục UI hiển thị
    //   khoá thô thay vì bản dịch. Đo được: 5/5 gói đã mount đều thiếu `locale/` trong profile.
    //   => copy thêm `locale/` (nếu nguồn có) để parity G1 đúng ở CẢ HAI tầng.
    // 08/11/2026 — dùng helper an toàn (xem chepThuMucCon: chặn ca đích là symlink về nguồn).
    chepThuMucCon(dir, pkg.sourceDir, "locale");
    // 25/10/2026 — LO HONG THAT (goi skill-badge phat hien): mount chỉ chép lib/ + locale/ + package.json,
    // KHÔNG chép assets/ ⇒ 19/10/2026 đã sửa đúng cho locale nhưng bỏ sót assets: gói skill đọc
    // `../assets/dsh-badge.md` nên provider CHẾT ("1 entry did not activate") dù artefact repo đủ.
    // => chép thêm `assets/` (nếu nguồn có), đúng khuôn khối locale ở trên.
    chepThuMucCon(dir, pkg.sourceDir, "assets");
    // 25/10/2026 — CÙNG LOẠI LỖ HỔNG, đo trên trang setup của voice-input: gói sensevoice chuẩn bị model
    // bằng `runtime/assets.json`, nhưng mount chỉ chép lib/locale/assets ⇒ profile thiếu `runtime/` nên
    // "Chuẩn bị thất bại: ENOENT … runtime/assets.json". Chép thêm `runtime/` (nếu nguồn có).
    chepThuMucCon(dir, pkg.sourceDir, "runtime");
    // ⚠️ 07/11/2026 — ICON của gói (trang Plugin + danh sách plugin đọc `icon.svg` trong thư mục gói).
    //   Mount chỉ chép lib/locale/assets/runtime ⇒ mọi gói thay thế hiện icon rỗng dù bản stock có icon.
    //   Chép icon.svg/icon.png (nếu nguồn có) để UI parity giữ đúng biểu tượng của DSH.
    for (const ten of ["icon.svg", "icon.png"]) {
      const nguonIcon = join(pkg.sourceDir, ten);
      if (existsSync(nguonIcon)) cpSync(nguonIcon, join(dir, ten));
    }
    // ⚠️ 19/10/2026 — LO HONG THAT (goi loi `session` phat hien): mount chi thay ROW trong patch, nhung
    //   20+ goi kernel van `import "@deepseek-ai/dsh-session"` ⇒ van nap BAN STOCK ⇒ co HAI ban cung ten
    //   (service cua ta + ham/class cua stock). `gbh.row.aliases` chi la id module CLIENT, khong tao mapping host.
    //   => `gbh.row.hostAliases` (mang ten goi stock): tao symlink <profile>/node_modules/<stock> -> <goi cua ta>
    //   de MOI import host resolve ve artefact cua ta. Fail-soft: khong tao duoc thi canh bao, app van boot.
    trace("chuan bi peer " + String(pkg.peers.length));
    for (const peer of pkg.peers) {
      const link = join(profileModulesDir(), peer);
      const source = join(kernelModulesDir(), peer);
      if (!existsSync(source)) {
        // 12/11/2026 — PEER LÀ GÓI CỦA TA (không phải kernel): bản npm để kernel do npm cài nên
        // <kernel>/@galaxy-blackhole/* KHÔNG tồn tại (repo thì có, do bun workspace link). Bỏ qua symlink
        // thay vì bỏ cả gói: import vẫn phân giải được nhờ linkMoiGoiGbh() liên kết mọi gói GBH vào profile.
        if (peer.startsWith("@galaxy-blackhole/")) continue;
        return { specifier: pkg.specifier, row: pkg.row, dir, built, peers, ok: false, detail: "thieu peer trong kernel: " + source };
      }
      mkdirSync(dirname(link), { recursive: true });
      rmSync(link, { recursive: true, force: true });
      symlinkSync(source, link, "dir");
      peers.push(peer);
    }
    // Host alias KHÔNG tạo ở đây: vòng peer của những gói mount SAU sẽ ghi đè cùng đường dẫn
    // (đo thật: @deepseek-ai/dsh-session là peer của nhiều gói). Alias được áp ở lượt TOÀN CỤC sau
    // khi mọi package đã mount — xem applyHostAliases() ngay dưới ensureRewriteMounts().
    trace("xong");
    return { specifier: pkg.specifier, row: pkg.row, dir, built, peers, ok: true };
  } catch (error) {
    return { specifier: pkg.specifier, row: pkg.row, dir, built: false, peers, ok: false, detail: String(error) };
  }
}

/**
 * Áp LẠI host alias ngay trước khi exec harness (belt-and-braces cho boot path, task-110):
 * đọc lại row.hostAliases từ các package đã mount trong profile và trỏ symlink về thư mục CỦA TA.
 * Nhận: không. Trả: các alias đã áp.
 */
export function applyAliasesBeforeBoot(): string[] {
  const results: MountResult[] = [];
  for (const pkg of rewritePackages()) {
    if (pkg.row?.hostAliases === undefined) continue;
    results.push({ specifier: pkg.specifier, row: pkg.row, dir: join(profileModulesDir(), pkg.specifier), built: false, peers: [], ok: existsSync(join(profileModulesDir(), pkg.specifier)) });
  }
  return applyHostAliases(results);
}

/**
 * Link các gói HẠ TẦNG của ta vào profile (nếu chưa có) để harness luôn phân giải được.
 * Nhận: không. Trả: danh sách tên đã link.
 */
export function linkInfrastructurePackages(): string[] {
  const linked: string[] = [];
  const modules = profileModulesDir();
  for (const ten of ["cordis", "schemastery", "cosmokit"]) {
    const nguon = join(repoRoot(), "packages", "host", ten);
    const manifest = join(nguon, "package.json");
    if (!existsSync(manifest)) continue;
    let specifier: unknown;
    try {
      specifier = (JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown }).name;
    } catch {
      continue;
    }
    if (typeof specifier !== "string") continue;
    const link = join(modules, specifier);
    try {
      if (existsSync(link) || lstatSync(link).isSymbolicLink()) continue;
    } catch {
      // chưa tồn tại — tiếp tục tạo link
    }
    try {
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(nguon, link, "dir");
      linked.push(specifier);
    } catch {
      continue;
    }
  }
  if (linked.length > 0) console.log("[bh] link ha tang: " + linked.join(", "));
  return linked;
}

/**
 * Link các gói ADDON NATIVE theo nền tảng của bản kernel vào profile.
 * Nhận: không. Trả: danh sách tên đã link.
 *
 * ⚠️ 07/11/2026 — LỖ HỔNG THẬT (đo được): `gbh-node-addon-system/lib/flock.js` gọi
 *   `require.resolve("@deepseek-ai/node-addon-system-<platform>-<arch>/package.json")`. Gói addon đó là
 *   gói STOCK chỉ có trong bản cài kernel (`apps/host/node_modules`), KHÔNG phải gói ta viết lại nên
 *   `gbh.row.hostAliases` không sinh symlink cho nó ⇒ trong profile KHÔNG phân giải được ⇒ khoá tệp
 *   (flock) ném "Cannot find module …" ⇒ `gateway/internal: resume failed` ⇒ `command.list` hỏng ⇒
 *   menu "/" MẤT các mục quan trọng (goal · plan · compact · quyền) và tab Terminal báo lỗi.
 *   Vì là BINARY BIÊN DỊCH THEO NỀN TẢNG, không thể port sang gói của ta — chỉ có thể symlink.
 */
export function linkNativeAddonPackages(): string[] {
  const linked: string[] = [];
  const nguonModules = kernelModulesDir();
  const thuMucStock = join(nguonModules, "@deepseek-ai");
  let ten: string[] = [];
  try {
    ten = readdirSync(thuMucStock);
  } catch {
    return linked;
  }
  // Chỉ những gói có đuôi nền tảng-kien trúc (vd node-addon-system-darwin-x64, @xterm/addon-… không khớp).
  const mau = /-(?:darwin|linux|win32)-(?:x64|arm64|ia32)$/u;
  for (const goi of ten) {
    if (!mau.test(goi)) continue;
    const nguon = join(thuMucStock, goi);
    const link = join(profileModulesDir(), "@deepseek-ai", goi);
    try {
      if (existsSync(link)) continue;
    } catch {
      // chưa tồn tại — tạo link
    }
    try {
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(nguon, link, "dir");
      linked.push("@deepseek-ai/" + goi);
    } catch {
      continue;
    }
  }
  if (linked.length > 0) console.log("[bh] link addon native: " + linked.join(", "));
  return linked;
}


/**
 * Mount moi package viet lai cua buoc 2.
 * @returns ket qua tung package, theo thu tu bang.
 */
export function ensureRewriteMounts(): MountResult[] {
  // 12/11/2026 — chay TRUOC moi buoc mount: import cheo giua cac goi GBH phai phan giai duoc tu cay goi.
  linkSelfPackages();
  const disabled = (process.env.GBH_DISABLE_REWRITES ?? "").trim() !== "";
  // 12/11/2026: che do TAT (A/B) khong mount gi ⇒ khong can chay cong chan mount (tiet kiem ~2,6 s).
  const blocked = disabled ? new Map<string, string>() : blockedPackages();
  const results = rewritePackages().map((pkg) =>
    disabled
      ? {
          specifier: pkg.specifier,
          dir: join(profileModulesDir(), pkg.specifier),
          built: false,
          peers: [],
          ok: false,
          detail: "GBH_DISABLE_REWRITES=1 — phep thu A/B: giu row cua DSH (xem docs/ADR/0004)",
        }
      : blocked.has(pkg.specifier)
        ? {
            specifier: pkg.specifier,
            row: pkg.row,
            dir: join(profileModulesDir(), pkg.specifier),
            built: false,
            peers: [],
            ok: false,
            detail: 'BO QUA (kiem tra truoc mount): ' + (blocked.get(pkg.specifier) ?? '?'),
          }
        : mountRewritePackage(pkg),
  );
  applyHostAliases(results);
  // 21/10/2026 (task-204): alias stock-name -> goi ta cho MOI goi da chuyen.
  applyProvenanceAliases();
  // 08/11/2026 — liên kết đủ mọi gói GBH vào profile (xem linkMoiGoiGbh: import chéo id GBH từng làm chết boot).
  const soLink = linkMoiGoiGbh();
  if (soLink > 0) console.log("[bh] lien ket them " + String(soLink) + " goi GBH vao profile");
  // 02/11/2026 — LINK HẠ TẦNG: gói hạ tầng của ta (cordis · schemastery · cosmokit) KHÔNG phải row nên
  // trước đây không được mount ⇒ nếu một artefact nào đó import '@galaxy-blackhole/gbh-cordis' thì
  // harness chết với ERR_MODULE_NOT_FOUND (đo được 13 lỗi, app không boot). Nay luôn link sẵn.
  linkInfrastructurePackages();
  linkNativeAddonPackages();
  // 25/10/2026 (yêu cầu Lead, ADR 0024): chép MỌI bundle cục bộ (packages/host/bundle-*) vào profile.
  // Trước đây chỉ bundle nằm trong `dsh.profile.bundles` mới có mặt ⇒ bật một bundle CHƯA TỪNG cài
  // (vd auto-review, worktree, voice-input) thì host trả "operation-error: cannot resolve profile …".
  mountLocalBundles();
  return results;
}

/**
 * Chuẩn hoá bản cài trong profile NGAY TRƯỚC KHI chạy harness — bước LUÔN chạy, không đặt trong
 * mountRewritePackage được vì mount bỏ qua gói còn "tươi" (short-circuit theo stamp).
 * Nhận: không. Trả: { tep, icon, va } — số tệp đã đổi id, số icon đã chép, số tệp vá mặt API.
 *
 * ⚠️ 07/11/2026 — HAI SỰ CỐ THẬT đo trên app đang chạy:
 *  1. Tab Terminal báo "lookup provider "agent" does not match its strict definition" và menu "/" mất
 *     mục: artefact trong profile giữ id/symbol STOCK (repo cố ý giữ nguyên văn stock) còn bảng module +
 *     hợp đồng typert dùng id GBH. Phép đổi id chỉ chạy trong `scripts/sync-lib-to-profile.sh` nên
 *     đường restart CHUẨN (`scripts/restart-host.sh`) luôn để lại profile lệch.
 *  2. Trang Plugin hiện icon rỗng cho mọi gói thay thế: mount chỉ chép lib/locale/assets/runtime, không
 *     chép `icon.svg` mà bản stock có.
 */
export function chuanHoaProfile(): { tep: number; icon: number; va: number } {
  return { tep: suaIdTrongProfile(), icon: chepIconVaoProfile(), va: vaMatApiLlmDeepSeek() };
}

/**
 * Chép `icon.svg`/`icon.png` của từng gói ta vào bản cài trong profile (UI parity: icon của DSH).
 * Nhận: không. Trả: số tệp icon đã chép.
 */
export function chepIconVaoProfile(): number {
  let soIcon = 0;
  const gocProfile = profileModulesDir();
  for (const nhom of ["host", "client", "tools"]) {
    const thuMuc = join(repoRoot(), "packages", nhom);
    let ten: string[] = [];
    try {
      ten = readdirSync(thuMuc);
    } catch {
      continue;
    }
    for (const goi of ten) {
      const nguonDir = join(thuMuc, goi);
      let tenGoi: unknown;
      try {
        tenGoi = (JSON.parse(readFileSync(join(nguonDir, "package.json"), "utf8")) as { name?: unknown }).name;
      } catch {
        continue;
      }
      if (typeof tenGoi !== "string") continue;
      const dichDir = join(gocProfile, tenGoi);
      for (const f of ["icon.svg", "icon.png"]) {
        const nguon = join(nguonDir, f);
        if (!existsSync(nguon)) continue;
        try {
          cpSync(nguon, join(dichDir, f));
          soIcon += 1;
        } catch {
          continue;
        }
      }
    }
  }
  if (soIcon > 0) console.log("[bh] chep icon vao profile: " + String(soIcon));
  return soIcon;
}


/**
 * Vá bản cài: trỏ import của 2 gói "account" về CHÍNH bản stock trong kernel.
 * Nhận: không. Trả: số tệp đã vá.
 *
 * ⚠️ 07/11/2026 — LỖ HỔNG MẶT API (đo được, `check:app` chỉ số (5) = 1): `gbh-llm-deepseek-account` và
 * `gbh-llm-deepseek-account/*` cần `catalogModelInfo` · `catalogModelFields` · `registerDeepSeekProvider`
 * từ `@galaxy-blackhole/gbh-llm-deepseek`, nhưng gói ta CỐ Ý chỉ export tập hẹp
 * (`{ Config, plainOptions, resolveAdapterOptions }`) — `tests/host/llm-deepseek.test.ts` khoá đúng tập đó
 * để đối chứng A/B với bản gốc. Thêm re-export trong repo sẽ đỏ test, còn trỏ id stock trong profile thì
 * thành self-import (alias trỏ về chính gói ta) ⇒ entry chết. Vì vậy vá ở BẢN CÀI: đổi specifier sang
 * đường dẫn tuyệt đối của bản stock trong `apps/host/node_modules` (chỉ đọc, không sửa kernel).
 */
export function vaMatApiLlmDeepSeek(): number {
  const stock = join(kernelModulesDir(), "@deepseek-ai", "dsh-llm-deepseek", "lib", "index.js");
  if (!existsSync(stock)) return 0;
  let soTep = 0;
  const gocProfile = join(profileModulesDir(), "@galaxy-blackhole");
  for (const goi of ["gbh-llm-deepseek-account", "gbh-llm-deepseek-api-key"]) {
    const tep = join(gocProfile, goi, "lib", "index.js");
    if (!existsSync(tep)) continue;
    let text = "";
    try {
      text = readFileSync(tep, "utf8");
    } catch {
      continue;
    }
    const sau = text.split('from "@galaxy-blackhole/gbh-llm-deepseek"').join('from ' + JSON.stringify(stock));
    if (sau === text) continue;
    try {
      writeFileSync(tep, sau);
      soTep += 1;
    } catch {
      continue;
    }
  }
  if (soTep > 0) console.log("[bh] va mat API llm-deepseek: " + String(soTep) + " tep");
  return soTep;
}

/**
 * Đổi id stock → id của ta trong bản cài ở profile (gọi trong đường boot, sau khi mount xong).
 * Nhận: không. Trả: số tệp đã đổi (0 khi không có gì để đổi).
 */
export function suaIdTrongProfile(): number {
  const thuMuc = join(profileModulesDir(), "@galaxy-blackhole");
  try {
    // 11/11/2026 — CACHE buoc doi id (stamp `lib/.gbh-rewrite-stamp`, xem tools/p1b/denta-profile.ts):
    //   stamp khop + con artefact ⇒ BO QUA cay lib/ cua goi do. Do that truoc khi va: 8,95 giay moi luot boot
    //   (66 MB / 3315 tep lib, 217 goi) du ket qua 0 tep. `GBH_FORCE_REWRITE=1` ep doi lai toan bo de debug.
    const force = (process.env.GBH_FORCE_REWRITE ?? "").trim() === "1";
    const kq = suaIdProfile(thuMuc, repoRoot(), { force });
    console.log(
      "[bh] doi id stock -> GBH: " + String(kq.tep) + " tep / " + String(kq.goi) + " goi · manifest " + String(kq.manifest) +
        " · bo qua " + String(kq.boQua) + "/" + String(kq.soGoi) + " goi" +
        (force ? " (GBH_FORCE_REWRITE=1)" : kq.boQua > 0 ? " (stamp khop)" : ""),
    );
    return kq.tep;
  } catch (error) {
    // Fail-soft: mount đã xong, app vẫn boot được (chỉ có thể lệch symbol ở vài gói).
    console.warn("[bh] doi id stock -> GBH THAT BAI: " + String(error));
    return 0;
  }
}

/**
 * Chép các bundle patch cục bộ (package.json + cordis.patch.yml) vào profile để bật/tắt được ngay.
 * Nhận: không. Trả: danh sách tên bundle đã chép (rỗng khi không có thư mục packages/host).
 */
export function mountLocalBundles(): string[] {
  const root = join(repoRoot(), "packages", "host");
  if (!existsSync(root)) return [];
  const copied: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("bundle-")) continue;
    const source = join(root, entry.name);
    const manifestPath = join(source, "package.json");
    if (!existsSync(manifestPath)) continue;
    let specifier: string;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: unknown };
      if (typeof manifest.name !== "string") continue;
      specifier = manifest.name;
    } catch {
      continue;
    }
    const dir = join(profileModulesDir(), specifier);
    mkdirSync(dir, { recursive: true });
    for (const file of ["package.json", "cordis.patch.yml"]) {
      const from = join(source, file);
      if (!existsSync(from)) continue;
      const to = join(dir, file);
      const text = readFileSync(from, "utf8");
      if (existsSync(to) && readFileSync(to, "utf8") === text) continue;
      writeFileSync(to, text);
    }
    copied.push(specifier);
  }
  return copied;
}

/**
 * Host alias cho symbol/identity: symlink <profile>/node_modules/<tên stock> -> thư mục gói CỦA TA,
 * áp MỘT LƯỢT sau khi mọi package đã mount (vòng peer của gói mount sau sẽ ghi đè cùng đường dẫn nếu
 * tạo sớm — đo thật với @deepseek-ai/dsh-session là peer của nhiều gói).
 * Nhận: results — kết quả ensureRewriteMounts (đọc row.hostAliases + dir). Trả: các alias đã tạo.
 */
export function applyHostAliases(results: readonly MountResult[]): string[] {
  const applied: string[] = [];
  for (const result of results) {
    if (!result.ok || result.dir === undefined) continue;
    const aliases = [...(result.row?.hostAliases ?? []), ...(result.hostAliases ?? [])];
    for (const alias of aliases) {
      const link = join(profileModulesDir(), alias);
      try {
        mkdirSync(dirname(link), { recursive: true });
        rmSync(link, { recursive: true, force: true });
        symlinkSync(result.dir, link, "dir");
        applied.push(alias + " -> " + result.specifier);
      } catch (error) {
        console.warn("[bh] khong tao duoc host alias " + alias + " -> " + result.dir + ": " + String(error));
      }
    }
  }
  if (applied.length > 0) console.log("[bh] host alias (toan cuc): " + applied.join(", "));
  return applied;
}

/**
 * Alias theo provenance: symlink <profile>/node_modules/<tên stock> -> <bản profile của gói TA>.
 * Nhận: không. Trả: danh sách alias đã tạo (dạng stock -> tên gói ta).
 * Lý do (đo 21/10/2026, task-204): artefact de-bundle giữ NGUYÊN id stock trong import, nên profile phải có alias
 * cho mọi gói đã chuyển; nếu không, import nổ (vd dsh-host-plugin-inventory) ⇒ module nạp dở ⇒ service đăng ký
 * hai lần ⇒ preset báo 'Tải thất bại'. Trước bản vá chỉ 11/106 tên stock có alias.
 */
/**
 * Liên kết MỌI gói GBH trong repo vào `node_modules` của profile để import giữa các gói GBH luôn phân giải được.
 * Nhận: khong. Trả: số liên kết mới tạo.
 * @returns số symlink mới được tạo trong node_modules của profile.
 */
function linkMoiGoiGbh(): number {
  // ⚠️ 08/11/2026 — SỰ CỐ BOOT THẬT: sau khi dev đổi import sang id GBH (R6a), host chết vì
  //   ERR_MODULE_NOT_FOUND cho \`@galaxy-blackhole/gbh-credentials\` và \`…gbh-lazy-require\` — hai gói THƯ VIỆN
  //   (không có gbh.row) nên mount KHÔNG chép vào profile. Nay liên kết đủ mọi gói GBH (idempotent) để import
  //   chéo giữa các gói GBH không bao giờ phụ thuộc việc gói đó có được mount hay không.
  let tao = 0;
  const modules = profileModulesDir();
  for (const tang of ["host", "client", "tools"]) {
    const goc = join(repoRoot(), "packages", tang);
    if (!existsSync(goc)) continue;
    for (const ten of readdirSync(goc)) {
      const pj = join(goc, ten, "package.json");
      if (!existsSync(pj)) continue;
      try {
        const meta = JSON.parse(readFileSync(pj, "utf8")) as { name?: string };
        const tenGoi = meta.name ?? "";
        if (!tenGoi.startsWith("@galaxy-blackhole/")) continue;
        const ngan = tenGoi.slice("@galaxy-blackhole/".length);
        const link = join(modules, "@galaxy-blackhole", ngan);
        // 11/11/2026 — ensureLink chữa cả link GÃY (profile tạo bởi bản chạy từ repo, nay app dùng host nhúng):
        // existsSync(link) trả false cho link gãy nên mã cũ giữ nguyên link chết ⇒ import nổ khi boot.
        if (!ensureLink(link, join(goc, ten))) continue;
        tao += 1;
      } catch {
        continue;
      }
    }
  }
  return tao;
}

/**
 * Tạo alias trong profile cho mọi id stock đã có gói GBH thay thế (và liên kết mọi gói GBH vào profile).
 * Nhận: không. Trả: danh sách alias đã tạo, dạng "<id stock> -> <id ta>".
 * @returns mảng mô tả các alias/provenance vừa tạo trong node_modules của profile.
 */
export function applyProvenanceAliases(): string[] {
  const applied: string[] = [];
  const modules = profileModulesDir();
  // Tên stock KHÔNG bao giờ alias: hạ tầng dùng chung phải trỏ KERNEL để giữ MỘT thể hiện.
  const CAM = new Set([
    '@deepseek-ai/cordis',
    '@deepseek-ai/cordis-plugin-include',
    '@deepseek-ai/cordis-plugin-loader',
    '@deepseek-ai/cordis-plugin-timer',
    '@deepseek-ai/cosmokit',
    '@deepseek-ai/schemastery',
    '@deepseek-ai/dsh',
    // 21/10/2026: app-boot la HA TANG BOOT cua harness — ban trong repo thieu dependency rieng
    // (node-addon-require-builtin) nen alias ve no lam experimental-inspector chet. Giu KERNEL stock.
    '@deepseek-ai/dsh-app-boot',
    '@deepseek-ai/libreoffice-kit',
    '@deepseek-ai/node-addon-system',
  ]);
  for (const tier of ['host', 'client']) {
    const goc = join(REPO_ROOT, 'packages', tier);
    if (!existsSync(goc)) continue;
    for (const ten of readdirSync(goc)) {
      const dir = join(goc, ten);
      try {
        const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
          name?: string;
          gbh?: { provenance?: { stock?: unknown }; row?: { aliases?: unknown; hostAliases?: unknown } };
        };
        const ours = typeof manifest.name === 'string' ? manifest.name : '';
        if (!ours.startsWith('@galaxy-blackhole/')) continue;
        const stocks: string[] = [];
        const prov = manifest.gbh?.provenance?.stock;
        if (typeof prov === 'string') stocks.push(prov);
        for (const ds of [manifest.gbh?.row?.aliases, manifest.gbh?.row?.hostAliases]) {
          if (!Array.isArray(ds)) continue;
          for (const a of ds) if (typeof a === 'string') stocks.push(a);
        }
        // 21/10/2026 (task-204): bo sung ten stock SUY RA tu ten goi ta (nhieu goi khong khai provenance/aliases,
        // vd gbh-host-plugin-manager). Chi nhan khi KERNEL that su co goi stock do => khong bia ten.
        const tenNgan = ours.replace("@galaxy-blackhole/", "").replace(/^gbh-/, "").replace(/^host-/, "");
        for (const ung of ["@deepseek-ai/dsh-" + tenNgan, "@deepseek-ai/dsh-host-" + tenNgan]) {
          const thuMucKernel = join(kernelModulesDir(), ung);
          if (existsSync(thuMucKernel)) stocks.push(ung);
        }
        // 21/10/2026 (task-214): gói THƯ VIỆN (không có row) không được mount vào profile, nên trước đây bị bỏ qua
        // => client vẫn require '@deepseek-ai/...' và rơi vào BẢN STOCK trong kernel (đo được: payload còn
        // @deepseek-ai/dsh-client-ui-directory-picker-native). Nay: nếu profile chưa có bản sao thì symlink thẳng
        // tới thư mục gói trong repo; alias stock -> link đó.
        const dichProfile = join(modules, ours);
        if (!existsSync(dichProfile) && !existsSync(join(dir, "lib"))) continue;
        const dich = existsSync(dichProfile) ? dichProfile : dir;
        for (const stock of stocks) {
          if (!stock.startsWith('@deepseek-ai/') || CAM.has(stock)) continue;
          const link = join(modules, stock);
          try {
            // 12/11/2026 — ĐÍCH THẬT của alias tính TRƯỚC để nhận ra "đã trỏ đúng" (xem chặn dưới).
            const thuMucKernelTruoc = join(kernelModulesDir(), stock);
            const nguonTruoc = chiCoKhaiKieu(dir) && existsSync(thuMucKernelTruoc) ? thuMucKernelTruoc : dich;
            const dichThat = realpathSync(nguonTruoc);
            if (existsSync(link)) {
              const hienTai = lstatSync(link).isSymbolicLink() ? realpathSync(link) : undefined;
              // 12/11/2026 — ĐÃ TRỎ ĐÚNG ĐÍCH thì không rm+symlink lại: đo được 205 alias bị tạo lại mỗi
              // lượt boot (~0,8 s) dù đích y hệt. Bỏ qua ở đây KHÔNG đổi trạng thái cuối (link vẫn trỏ
              // đúng chỗ) mà chỉ bỏ thao tác thừa.
              if (hienTai !== undefined && hienTai === dichThat) continue;
              if (hienTai === undefined) continue;
              // 21/10/2026: alias dang tro thu muc REPO cung phai duoc TRO LAI ve ban profile khi da co ban profile
              // (test session-alias doi @deepseek-ai/dsh-session tro artefact 'gbh-session' trong profile).
              if (hienTai === realpathSync(dich)) continue;
              if (hienTai.startsWith(modules) && dich === dichProfile) continue;
            }
            mkdirSync(dirname(link), { recursive: true });
            rmSync(link, { recursive: true, force: true });
            // ⚠️ 08/11/2026 — SỰ CỐ BOOT THẬT: port de-bundle của \`gbh-session\` chỉ có \`lib/types/*.d.ts\` (KHÔNG có .js),
            //   nên khi alias \`@deepseek-ai/dsh-session\` trỏ vào nó thì mọi consumer import subpath runtime
            //   (\`…/lib/types/types.js\`) đều ERR_MODULE_NOT_FOUND ⇒ host chết ngay lúc boot ("1 required plugin did not
            //   activate"). Khi gói ta CHỈ có khai kiểu mà KERNEL có bản đầy đủ thì alias phải trỏ KERNEL.
            const thuMucKernel = join(kernelModulesDir(), stock);
            const nguonAlias = chiCoKhaiKieu(dir) && existsSync(thuMucKernel) ? thuMucKernel : dich;
            symlinkSync(realpathSync(nguonAlias), link, 'dir');
            applied.push(stock + ' -> ' + ours);
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
  }
  if (applied.length > 0) console.log('[bh] alias provenance: ' + String(applied.length) + ' ten stock -> goi ta');
  return applied;
}
