/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Script thao bundle: de-bundle NGUYEN VAN ban bien dich ui-conversation thanh cac phan <=900 dong + CSS nguyen van
 *
 * Cach dung: bun run tools/extract.ts   (chay tu thu muc goi)
 *
 * Nguon doi chieu (CHI DOC): apps/host/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js
 * Vi sao cat theo `//#region`: bundle goc do tsdown/rolldown sinh ra con nguyen dau vung cua tung file
 * nguon upstream, nen moi vung la mot don vi cu phap tron ven — cat o do khong lam dut cau lenh.
 * Bat bien: noi cac phan lai theo src/manifest.ts PHAI ra DUNG TUNG BYTE than cua factory ban goc.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Thu muc goi cua ta. */
const PKG = join(import.meta.dir, "..");
/** Thu muc goc repo (ba cap tren packages/client/ui-conversation). */
const REPO = join(PKG, "..", "..", "..");
/** Bundle goc cua DSH — nguon su that cua hanh vi. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-conversation", "lib", "client.js");
/** Noi ghi cac phan ma nguon. */
const PARTS = join(PKG, "src", "parts");
/** Noi ghi cac file .module.css nguyen van. */
const STYLES = join(PKG, "src", "styles");

/** Ngan sach dong cho THAN mot phan (chua 7 dong header + 1 dong @ts-nocheck). */
const MAX_PART_LINES = 900;

/** Ten vung cua file apply — noi dat cong chong cai hai lan. */
const APPLY_REGION = "lib/types/client/apply.js";

/**
 * Khoi 7 dong header bat buoc cua repo.
 * Nhan: desc — dong mo ta cua file.
 * Tra: van ban header.
 */
function header(desc: string): string {
  return [
    "/**",
    " * author Bùi Trọng Hiếu",
    " * email kevinbui210191@gmail.com",
    " * create date 15/10/2026",
    " * modify date 18/10/2026",
    " * desc " + desc,
    " */",
  ].join("\n");
}

/**
 * Dat ten file cho mot vung nguon: ba doan cuoi cua duong dan, da lam sach.
 * Nhan: region — ten vung nguyen van trong bundle.
 * Tra: slug an toan cho ten file.
 */
export function slugOf(region: string): string {
  const clean = region.startsWith("\\0") ? region.slice(2) : region;
  const tail = clean
    .split("/")
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .slice(-3)
    .join("-");
  return tail
    .replace(/\.[A-Za-z0-9]+$/, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Kiem mot doan ma co parse duoc khong, bang chinh bo phan tich cua Bun.
 * Nhan: code — doan ma can kiem.
 * Tra: true khi parse duoc.
 */
export function parses(code: string): boolean {
  try {
    new Bun.Transpiler({ loader: "ts" }).transformSync(code);
    return true;
  } catch {
    return false;
  }
}

/**
 * Liet ke cac dong mo dau mot khai bao o cap cao nhat (thut le dung hai tab).
 * Nhan: text — than cua mot vung.
 * Tra: chi so cac dong co the cat.
 */
export function cutPoints(text: string): number[] {
  const lines = text.split("\n");
  const out: number[] = [];
  for (let i = 1; i < lines.length; i += 1) if (/^\t\t[^\s})]/.test(lines[i] as string)) out.push(i);
  return out;
}

/**
 * Cat mot vung thanh cac manh <= MAX_PART_LINES dong, tai diem cat ma Bun parse duoc.
 * Nhan: text — than cua vung.
 * Tra: cac manh; noi chung lai bang "" ra dung text ban dau.
 */
export function splitPiece(text: string): string[] {
  const lines = text.split("\n");
  if (lines.length <= MAX_PART_LINES) return [text];
  const cuts = cutPoints(text).filter((i) => i > 100 && i < lines.length - 20);
  const chosen: number[] = [];
  let start = 0;
  while (lines.length - start > MAX_PART_LINES) {
    const limit = start + MAX_PART_LINES;
    const target = start + Math.floor(MAX_PART_LINES / 2);
    let picked = -1;
    for (const candidate of cuts) {
      if (candidate <= target || candidate >= limit) continue;
      if (parses(lines.slice(start, candidate).join("\n"))) {
        picked = candidate;
        break;
      }
    }
    if (picked < 0) throw new Error("khong tim duoc diem cat cho vung tu dong " + start);
    chosen.push(picked);
    start = picked;
  }
  const bounds = [0, ...chosen, lines.length];
  const out: string[] = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const piece = lines.slice(bounds[i], bounds[i + 1]).join("\n");
    // Manh khong phai manh cuoi phai giu lai ki tu xuong dong o diem cat, neu khong phep ghep se mat mot dong.
    out.push(i === bounds.length - 2 ? piece : piece + "\n");
  }
  return out;
}

/**
 * Chen cong chong cai hai lan vao vung apply.js: doi ten ham apply goc thanh applyInner.
 * Nhan: text — than vung apply.js nguyen van.
 * Tra: than vung da chen cong (chi khac dung khoi cong + mot dong doi ten).
 */
export function injectGuard(text: string): string {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => line === '\t\tfunction apply(ctx, config = Config({})) {');
  if (at < 0) throw new Error("khong thay function apply(ctx, config = Config({})) trong vung apply.js");
  let doc = at - 1;
  while (doc > 0 && lines[doc] !== "\t\t/**") doc -= 1;
  if (lines[doc] !== "\t\t/**") throw new Error("khong thay JSDoc cua apply");
  const guard = [
    "\t\t// \u26a0\ufe0f 18/10/2026: CONG CHONG CAI HAI LAN \u2014 PHAM VI MODULE, dat TRUOC JSDoc cua ham duoi day.",
    "\t\t// Ca that: tang nap sinh HAI entry (id cua ta + alias cua goi goc) \u21d2 loader.create cho MOI entry \u21d2 ctx MOI",
    "\t\t//   \u21d2 cong khoa-theo-ctx KHONG BAO GIO kich hoat \u21d2 apply chay hai lan \u21d2 'service has been registered'.",
    "\t\tlet uiConversationInstalled = false;",
    "\t\tconst uiConversationContexts = new WeakSet();",
    "\t\t/**",
    "\t\t * Cong idempotent cua row ui-conversation: than dang ky chi chay MOT lan cho moi tien trinh.",
    "\t\t * Nhan: ctx \u2014 context goc phia client do Loader cap; config \u2014 cau hinh da kiem cua plugin.",
    "\t\t * Tra: khong \u2014 bo qua im lang khi bundle da duoc cai.",
    "\t\t */",
    "\t\tfunction apply(ctx, config = Config({})) {",
    "\t\t\tif (uiConversationInstalled || uiConversationContexts.has(ctx)) {",
    '\t\t\t\tconsole.warn("gbh-client-ui-conversation: bundle da duoc cai, bo qua lan thu hai");',
    "\t\t\t\treturn;",
    "\t\t\t}",
    "\t\t\tapplyInner(ctx, config);",
    "\t\t\t// \u26a0\ufe0f CO CHI BAT SAU KHI applyInner CHAY XONG: bat som \u21d2 lan cai thu hai thoat som \u21d2 slot khong bao",
    "\t\t\t//   gio duoc dang ky lai \u21d2 renderer gap undefined (React #130).",
    "\t\t\tuiConversationInstalled = true;",
    "\t\t\tuiConversationContexts.add(ctx);",
    "\t\t}",
  ].join("\n");
  // JSDoc GOC cua apply phai duoc GIU LAI: cong chen TRUOC no, chi doi ten dong khai bao.
  const renamed = (lines[at] as string).replace("function apply(", "function applyInner(");
  return [...lines.slice(0, doc), guard, ...lines.slice(doc, at), renamed, ...lines.slice(at + 1)].join("\n");
}

/**
 * Diem vao: doc bundle goc, cat thanh cac phan, ghi src/parts + src/styles + src/manifest.ts.
 * Nhan: khong.
 * Tra: khong.
 */
export function extract(): { parts: string[]; css: string[] } {
  const all = readFileSync(STOCK, "utf8").split("\n");
  const start = all.findIndex((line) => /^\t\tObject\.defineProperty\(exports, Symbol\.toStringTag/.test(line));
  let end = -1;
  for (let i = all.length - 1; i >= 0; i -= 1) if (all[i] === "\t\treturn module.exports;") { end = i; break; }
  if (start < 0 || end < start) throw new Error("khong tim duoc than factory trong bundle goc");
  const body = all.slice(start, end + 1).join("\n");
  const chunks = body.split("\t\t//#region ");
  const head = chunks.shift() as string;
  if (!head.includes("Object.defineProperty(exports, Symbol.toStringTag")) throw new Error("phan dau khong nhu mong doi");
  if (!body.includes('react_dom = require("react-dom")') || !body.includes('require("@galaxy-blackhole/gbh-client-ui-primitives")')) throw new Error("than factory thieu bon lenh require");

  const regions = chunks.map((chunk) => {
    const nl = chunk.indexOf("\n");
    return { name: chunk.slice(0, nl), text: "\t\t//#region " + chunk };
  });

  rmSync(PARTS, { recursive: true, force: true });
  rmSync(STYLES, { recursive: true, force: true });
  mkdirSync(PARTS, { recursive: true });
  mkdirSync(STYLES, { recursive: true });

  const partFiles: string[] = [];
  const cssFiles: { placeholder: string; file: string }[] = [];
  let counter = 0;

  counter += 1;
  const headName = String(counter).padStart(2, "0") + "-requires.ts";
  writeFileSync(join(PARTS, headName), header("Phan " + counter + " cua ban bien dich ui-conversation \u2014 nguyen van dau factory (requires)") + "\n// @ts-nocheck\n" + head);
  partFiles.push("parts/" + headName);

  for (const region of regions) {
    const isCss = region.name.includes("dsh-css:");
    if (isCss) {
      const base = region.name.split("/").pop() as string;
      const mod = base.replace(/\.module\.css\.mjs$/, "");
      const found = /^\t\tconst (css(?:\$\d+)?) = (".*");$/m.exec(region.text);
      if (found === null) throw new Error("khong doc duoc chuoi CSS cua " + region.name);
      const literal = found[2] as string;
      const css = JSON.parse(literal) as string;
      const placeholder = "__GBH_UI_CONVERSATION_CSS_" + mod.replace(/[^A-Za-z0-9]/g, "_") + "__";
      counter += 1;
      const partName = String(counter).padStart(2, "0") + "-css-" + mod + ".ts";
      writeFileSync(join(PARTS, partName), header("Phan CSS " + mod + " \u2014 nguyen van vung " + region.name) + "\n// @ts-nocheck\n" + region.text.replace(literal, placeholder));
      writeFileSync(join(STYLES, mod + ".module.css"), header("CSS " + mod + " cua row ui-conversation \u2014 NGUYEN VAN ban goc (tien to hash giu nguyen)") + "\n" + css + "\n");
      partFiles.push("parts/" + partName);
      cssFiles.push({ placeholder, file: "styles/" + mod + ".module.css" });
      continue;
    }
    const slug = slugOf(region.name);
    if (slug === "") throw new Error("khong dat duoc ten cho vung " + region.name);
    const text = region.name === APPLY_REGION ? injectGuard(region.text) : region.text;
    const pieces = splitPiece(text);
    pieces.forEach((piece, index) => {
      counter += 1;
      const suffix = pieces.length === 1 ? "" : String.fromCharCode(97 + index);
      const partName = String(counter).padStart(2, "0") + "-" + slug + suffix + ".ts";
      writeFileSync(join(PARTS, partName), header("Phan " + (index + 1) + "/" + pieces.length + " cua ban bien dich ui-conversation \u2014 nguyen van vung " + region.name) + "\n// @ts-nocheck\n" + piece);
      partFiles.push("parts/" + partName);
    });
  }

  const manifest = [
    header("Manifest ban bien dich ui-conversation: thu tu ghep cac phan + bang thay the CSS (do build.ts doc)"),
    "",
    "/**",
    " * Thu tu ghep cac phan cua ban bien dich, dung NGUYEN VAN thu tu vung cua bundle goc.",
    " * Nhan: khong.",
    " * Tra: mang duong dan tuong doi so voi src/.",
    " */",
    "export const PART_FILES: readonly string[] = [",
    ...partFiles.map((file) => "  " + JSON.stringify(file) + ","),
    "];",
    "",
    "/** Mot cho thay the CSS trong ban bien dich. */",
    "export interface CssReplacement {",
    "  /** Dinh danh xuat hien trong phan ma (build.ts thay bang chuoi CSS da ma hoa). */",
    "  placeholder: string;",
    "  /** Duong dan file .module.css tuong doi so voi src/ \u2014 nguon su that cua CSS. */",
    "  file: string;",
    "}",
    "",
    "/**",
    " * Bang thay the CSS: moi dinh danh trong phan ma ung voi dung mot file .module.css.",
    " * Nhan: khong.",
    " * Tra: mang cac cap dinh danh \u2194 file CSS, theo thu tu xuat hien.",
    " */",
    "export const CSS_REPLACEMENTS: readonly CssReplacement[] = [",
    ...cssFiles.map((item) => "  { placeholder: " + JSON.stringify(item.placeholder) + ", file: " + JSON.stringify(item.file) + " },"),
    "];",
    "",
  ].join("\n");
  writeFileSync(join(PKG, "src", "manifest.ts"), manifest);
  return { parts: partFiles, css: cssFiles.map((item) => item.file) };
}

if (import.meta.main) {
  const result = extract();
  console.log("parts=" + result.parts.length + " css=" + result.css.length);
  for (const file of result.parts) console.log("  " + file + " · " + (readFileSync(join(PKG, "src", file), "utf8").split("\n").length - 1) + " dong");
}
