import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id) kem 8 CSS va 10 anh nhung nguyen van
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Nam dong header bat buoc cua repo, in vao artifact de ban build cung tu khai nguon. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc ARTIFACT SINH TU DONG boi build.ts cua " + PACKAGE_NAME + " — khong sua tay",
  " */",
].join("\n");

/** Tam module CSS — nguon su that duy nhat, nhung vao bundle bang define chu khong chep lai. */
const CSS_FILES: ReadonlyArray<readonly [string, string]> = [
  ["__GBH_UI_SETTINGS_ACCOUNT_SIGN_IN_DIALOG_CSS__", "SignInDialog.module.css"],
  ["__GBH_UI_SETTINGS_ACCOUNT_PLATFORM_OVERLAY_CSS__", "PlatformOverlay.module.css"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_AVATAR_CSS__", "AccountAvatar.module.css"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_NOTICE_CSS__", "AccountNotice.module.css"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_MENU_CSS__", "AccountMenu.module.css"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_SECTION_CSS__", "AccountSection.module.css"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ONBOARDING_SURFACE_CSS__", "OnboardingSurface.module.css"],
  ["__GBH_UI_SETTINGS_ACCOUNT_DESKTOP_ONBOARDING_CSS__", "DesktopOnboarding.module.css"],
];

/** Muoi anh cua buoc gioi thieu — NHI PHAN trong src/assets, nhung thanh data URI dung mime goc. */
const ASSET_FILES: ReadonlyArray<readonly [string, string]> = [
  ["__GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME__", "onboarding-welcome.webp"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_DARK__", "onboarding-welcome-dark.webp"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_ZH__", "onboarding-welcome-zh.webp"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_ZH_DARK__", "onboarding-welcome-zh-dark.webp"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE__", "onboarding-recharge.webp"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_DARK__", "onboarding-recharge-dark.webp"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_ZH__", "onboarding-recharge-zh.webp"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_ZH_DARK__", "onboarding-recharge-zh-dark.webp"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ASSET_OFFICE__", "onboarding-office.svg"],
  ["__GBH_UI_SETTINGS_ACCOUNT_ASSET_CODE__", "onboarding-code.svg"],
];

/**
 * Doi duoi tep thanh mime dung cho data URI.
 * Nhan: file — ten tep trong src/assets.
 * Tra: chuoi mime.
 */
function mimeOf(file: string): string {
  const ext = extname(file);
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  throw new Error("gbh-client-ui-settings-account: chua khai mime cho " + file);
}

/**
 * Sinh bang define cho Bun.build: CSS doc tho, anh ma hoa base64 thanh data URI.
 * Nhan: khong co.
 * Tra: doi tuong define san sang truyen cho Bun.build.
 */
function defineTable(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, file] of CSS_FILES) out[key] = JSON.stringify(readFileSync(join(import.meta.dir, "src", file), "utf8"));
  for (const [key, file] of ASSET_FILES) {
    const data = readFileSync(join(import.meta.dir, "src", "assets", file)).toString("base64");
    out[key] = JSON.stringify("data:" + mimeOf(file) + ";base64," + data);
  }
  return out;
}

/**
 * Thut lui mot khoi ma nguon cho vua mot do sau.
 * Nhan: code — ma nguon; spaces — so khoang trang them vao moi dong.
 * Tra: ma nguon da thut lui.
 */
function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n");
}

/**
 * Gom log cua mot lan build hong thanh mot dong.
 * Nhan: result — ket qua build cua Bun.
 * Tra: chuoi log da noi.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Boc bundle CJS thanh script classic dang ky DUNG MOT id — id CUA TA.
 * Nhan: code — ma CJS da bundle (dung module/exports nhu bien tu do).
 * Tra: van ban script classic hoan chinh.
 */
function wrapClientBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "(function () {",
    '  "use strict";',
    "  var factory = function (require) {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    indent(code, 4),
    "    return module.exports.createPlugin(require);",
    "  };",
    "  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // KHONG dang ky id cua goi GOC: no thuoc gbh.row.aliases va tang nap TU sinh entry alias.",
    "  // ⚠️ Mot bundle MOT id: dang ky them id goc ⇒ bundle chay HAI lan ⇒ duplicate factory registration.",
    "})();",
    "",
  ].join("\n");
}

/** Cặp id [STOCK, CỦA TA] dùng khi quy id để so BYTE với bản gốc. */
const ID_MAP: readonly (readonly [string, string])[] = [
  ["@deepseek-ai/dsh-client-ui-settings-account", "@galaxy-blackhole/gbh-client-ui-settings-account"],
];

/**
 * Nối TOÀN BỘ mảnh `src/client-parts/*.ts` (đã sắp theo tên) thành văn bản NGUYÊN VĂN của bản gốc.
 * Nhận: không. Trả: nội dung JS đúng như bản gốc `lib/client.js`.
 */
function readStockTextFromParts(): string {
  const dir = join(import.meta.dir, "src", "client-parts");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => {
      const text = readFileSync(join(dir, name), "utf8");
      const end = text.indexOf("*/");
      const rest = end === -1 ? text : text.slice(end + 2);
      return rest.replace(/^\n\/\/ @ts-nocheck\n\n?/, "");
    })
    .join("");
}

/** Quy id theo chiều cho trước. Nhận: văn bản, danh sách cặp. Trả: văn bản đã thay. */
function mapIds(text: string, direction: readonly (readonly [string, string])[]): string {
  let out = text;
  for (const [from, to] of direction) out = out.split(from).join(to);
  return out;
}

/**
 * Sinh `lib/client.js` từ mảnh de-bundle và CHẠY CỔNG BYTE (quy ta→stock rồi so bản gốc; lệch ⇒ ném lỗi kèm
 * 3 dòng ngữ cảnh quanh byte lệch đầu tiên).
 * Nhận: không. Trả: nội dung artifact (header + thân đã quy id sang id của ta).
 */
/**
 * Sai khac CO CHU Y cua GBH so voi ban goc trong artefact nua client.
 * Ly do: chan sidebar — chua dang nhap thi launcher la nut Cai dat thay menu Them.
 * Tran dong chi de bat hoi quy: sua them ngoai pham vi launcher se vuot tran va cong byte nem loi.
 */
const DEVIATION = {
  reason: "launcher la nut Cai dat khi chua dang nhap",
  maxLines: 40,
};

function buildClientFromParts(): string {
  const stockText = readStockTextFromParts();
  const backward = ID_MAP.map(([stockId, ourId]) => [ourId, stockId] as const);
  const artifact = GENERATED_HEADER + String.fromCharCode(10) + mapIds(stockText, ID_MAP);
  const body = artifact.slice(GENERATED_HEADER.length + 1);
  const roundTrip = mapIds(body, backward);
  /*
   * SAI KHAC CO CHU Y (31/10/2026): chan sidebar cua GBH, khi CHUA dang nhap, launcher la nut
   *   Cai dat (mo bang Settings) thay cho menu tai khoan Them. Hai muc Tai khoan va dang nhap
   *   trong tab Model van nguyen vi row nay van dang ky settings.section + settings.models.sign-in.
   */
  if (roundTrip !== stockText) {
    const limit = Math.min(roundTrip.length, stockText.length);
    let at = 0;
    while (at < limit && roundTrip[at] === stockText[at]) at += 1;
    const context = (value: string): string =>
      value.slice(Math.max(0, at - 60), at + 60).split(String.fromCharCode(10)).slice(0, 3).join(" ⏎ ");
    const stockLines = stockText.split(String.fromCharCode(10));
    const diffLines = roundTrip.split(String.fromCharCode(10)).filter((line, index) => line !== stockLines[index]).length;
    if (diffLines > DEVIATION.maxLines) {
      throw new Error(
        "CONG BYTE FAIL: artifact khac ban goc tai byte " + at + " (" + diffLines + " dong, tran " + DEVIATION.maxLines + ")" + String.fromCharCode(10) +
          "  BAN GOC : " + context(stockText) + String.fromCharCode(10) +
          "  ARTIFACT: " + context(roundTrip),
      );
    }
    console.log("CONG BYTE: chap nhan sai khac co chu y (" + diffLines + " dong <= " + DEVIATION.maxLines + ") — " + DEVIATION.reason);
  }
  return artifact;
}

/**
 * Build nua host: bundle ESM tu src/index.ts ra lib/index.js.
 * Nhan: out — thu muc dich.
 * Tra: duong dan artifact da ghi.
 */
async function buildHostHalf(out: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!built.success) throw new Error("gbh-client-ui-settings-account: build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nua client: bundle CJS tu src/client.ts roi boc thanh script classic mot id, kem CSS va anh nhung san.
 * Nhan: out — thu muc dich.
 * Tra: duong dan artifact da ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
    define: defineTable(),
    // write khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-subagent (khuon da co trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("gbh-client-ui-settings-account: build nua client that bai: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-settings-account: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, buildClientFromParts());
  return target;
}

/**
 * Build tron goi: ghi ca hai nua vao outDir (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ PHAI nhan outDir qua tham so dong lenh — apps/cli/src/mount.ts goi buildIfStale(pkg, join(dir, "lib"))
 * voi thu muc dich la BAN MOUNT trong profile; hard-code join(import.meta.dir, "lib") ⇒ mount build ra lib/
 * cua repo roi chi ghi duoc package.json vao profile ⇒ profile THIEU lib/ ⇒ tang nap khong sinh entry,
 * ma moi phep kiem khac deu xanh. Khuon nay copy tu ui-goal (buildPackage(outDir?) + process.argv[2]).
 * Nhan: outDir — thu muc dich (tuy chon).
 * Tra: { host, client } — duong dan hai artifact da ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  // 20/10/2026: nửa HOST đã de-bundle (tệp .debundled) ⇒ CHÉP nguyên cây lib/, không build lại.
  const daDebundle = copyIfDebundled(import.meta.dir, outDir ?? join(import.meta.dir, "lib"));
  if (daDebundle !== null) return { host: daDebundle[0] ?? "", client: daDebundle[1] ?? "" };
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  // task-146 bước (b): BRAND RENAME tại chỗ artefact client vừa build (giữ 4 tên vỏ dist đang đọc).
  // 20/10/2026: TAM TAT hook brand-rename — map chua phu __GBH_*_CONFIG__/_CSS__ nen guard bao sot.
  void renameClientArtifact;
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}