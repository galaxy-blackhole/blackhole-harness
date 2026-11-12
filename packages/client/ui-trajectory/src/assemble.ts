/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ghep 12 lat nguyen van + bon module CSS thanh MOT than bundle, roi boc thanh script classic mot id
 */

import { CLIENT_EXPORT_LINES, CLIENT_TAIL_LINES, CSS_REPLACEMENTS, FRAGMENT_MARKER_LINE, HANDWRITTEN_PARTS, PART_FILES } from "./manifest.ts";
import { PACKAGE_NAME, REQUIRE_BINDINGS } from "./ids.ts";

/** Ten file entry tam ma build.ts ghi ra roi giao cho Bun.build kiem cu phap va bundle. */
export const ENTRY_FILE_NAME = ".entry.js";

/** Dong danh dau lat nguyen van — moi lat deu phai co, neu thieu thi day khong phai lat cua ta. */
const SLICE_MARKER = "// @ts-nocheck";

/**
 * Dau hieu cua mot DONG VIET TAY — BAT BIEN: khong duoc xuat hien trong bat ky lat NGUYEN VAN nao.
 * Co y KHONG dua "WeakSet" vao day: bundle goc co dung WeakSet that.
 */
const HANDWRITTEN_MARKERS: readonly string[] = ["gbh-vi-locale", "vi dictionaries", "Installed = false"];

/**
 * Khang dinh vung NGUYEN VAN khong lan dong viet tay: dong viet tay phai nam o HANDWRITTEN_PARTS.
 * Nhan: sources — noi dung tho cac lat nguyen van (truoc khi bo phan giao ke).
 * Tra: khong — nem loi neu thay dau hieu viet tay trong vung nguyen van.
 */
export function assertVerbatimParts(sources: readonly string[]): void {
  for (const source of sources) {
    for (const marker of HANDWRITTEN_MARKERS) {
      if (source.includes(marker)) throw new Error(PACKAGE_NAME + ": vung NGUYEN VAN con dong viet tay (" + marker + ") — dua dong do sang HANDWRITTEN_PARTS");
    }
  }
}

/** Dong ket thuc mot module TS ma tools/split-stock-bundle.ts chen vao cuoi moi lat. */
const MODULE_TAIL = "export {};";

/** Khoi header 7 dong (5 dong bat buoc + hai dong bao) cua moi file nguon trong repo. */
const HEADER_END = "*/";

/**
 * Bo phan GIAO ke cua mot lat: khoi header 7 dong, dong danh dau @ts-nocheck va dong export {};.
 * Phan con lai la NGUYEN VAN bundle goc, khong sua mot byte nao.
 * Nhan: source — noi dung file lat; fileName — ten file (dung cho thong bao loi).
 * Tra: than lat da bo phan giao ke.
 */
export function stripPartScaffold(source: string, fileName: string): string {
  const lines = source.split(String.fromCharCode(10));
  const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
  if (marker < 0) throw new Error(fileName + ': khong thay dong danh dau lat nguyen van');
  const headerOk = lines.slice(0, marker).some((line) => line.trim() === HEADER_END);
  if (!headerOk) throw new Error(fileName + ': thieu khoi header 5 dong bat buoc');
  return lines
    .slice(marker + 1)
    .filter((line) => line.trim() !== MODULE_TAIL)
    // ⚠️ Dòng ĐÁNH DẤU VỎ của mảnh bị cắt giữa câu lệnh (xem tools/split-stock-bundle.ts): gỡ cả dòng,
    // kể cả phần ngoặc đứng trước dấu — nhờ vậy văn bản ghép lại đúng NGUYÊN VĂN bản gốc.
    .filter((line) => !FRAGMENT_MARKER_LINE.test(line))
    .join(String.fromCharCode(10));
}

/**
 * Lay phan CSS NGUYEN VAN cua mot file .module.css: bo khoi header 7 dong va dung mot ky tu xuong dong cuoi file.
 * Nhan: source — noi dung file .module.css.
 * Tra: van ban CSS dung tung byte nhu trong bundle goc.
 */
export function readCssSource(source: string): string {
  const end = source.indexOf(HEADER_END);
  if (end < 0) throw new Error('file .module.css thieu khoi header 5 dong bat buoc');
  let css = source.slice(end + HEADER_END.length);
  if (css.startsWith(String.fromCharCode(10))) css = css.slice(1);
  if (css.endsWith(String.fromCharCode(10))) css = css.slice(0, -1);
  return css;
}

/**
 * Thay moi diem thay the CSS trong THAN bundle bang chuoi CSS da ma hoa JSON (dung nhu bundle goc phat ra).
 * Moi diem thay the phai xuat hien DUNG MOT lan: khong thay = lat da bi sua tay, thay nhieu lan = CSS se
 * bi nhan ban ⇒ ca hai deu la loi, khong phai canh bao.
 * Nhan: source — than bundle (da ghep 12 lat); cssByPlaceholder — anh xa diem thay the sang van ban CSS.
 * Tra: than bundle da nhung CSS nguyen van.
 */
export function embedCss(source: string, cssByPlaceholder: ReadonlyMap<string, string>): string {
  let out = source;
  for (const item of CSS_REPLACEMENTS) {
    const css = cssByPlaceholder.get(item.placeholder);
    if (css === undefined) throw new Error('thieu CSS cho diem thay the ' + item.placeholder);
    const token = JSON.stringify(item.placeholder);
    const hits = out.split(token).length - 1;
    if (hits !== 1) throw new Error('diem thay the ' + item.placeholder + ' xuat hien ' + hits + ' lan (phai dung 1)');
    out = out.split(token).join(JSON.stringify(css));
  }
  return out;
}

/**
 * Dong require cua bang module — NGUYEN VAN danh sach cua bundle goc, sinh tu REQUIRE_BINDINGS.
 * Nhan: khong.
 * Tra: mang dong require (moi dong mot binding).
 */
export function requireLines(): string[] {
  return REQUIRE_BINDINGS.map((item) => '\t\tlet ' + item.binding + ' = require(' + JSON.stringify(item.specifier) + ');');
}

/**
 * Than cac lat VIET TAY theo dung thu tu manifest, da bo phan giao ke (header + @ts-nocheck + export {}).
 * Nhan: srcDir — thu muc src/ cua goi; readFile — ham doc file.
 * Tra: mang than lat viet tay.
 */
export function readHandwrittenSources(srcDir: string, readFile: ReadFileFn): string[] {
  const join = (a: string, b: string): string => a.replace(/\/+$/, '') + '/' + b;
  return HANDWRITTEN_PARTS.map((file) => stripPartScaffold(readFile(join(srcDir, file)), file));
}

/**
 * Van ban khoi VIET TAY dung nhu build.ts chen vao bundle: nam SAU CLIENT_EXPORT_LINES va TRUOC
 * CLIENT_TAIL_LINES. Test parity doi chung dung chuoi nay de BO DUNG khoi viet tay theo VI TRI MANIFEST
 * (khong do chuoi noi dung) — nho vay phan con lai phai la NGUYEN VAN ban goc tung byte.
 * Nhan: srcDir — thu muc src/ cua goi; readFile — ham doc file.
 * Tra: van ban khoi viet tay.
 */
export function assembleHandwrittenFromDisk(srcDir: string, readFile: ReadFileFn): string {
  return readHandwrittenSources(srcDir, readFile).join(String.fromCharCode(10));
}

/**
 * Ghep nam dong require + 12 lat + hai dong exports nguyen van + khoi viet tay + dong cuoi thanh MOT than
 * bundle (chua boc factory). Thu tu bat buoc: nam dong require dung truoc vi moi lat deu tham chieu ten bien do;
 * khoi viet tay dat TRUOC dong tra module.exports de no boc duoc ham apply vua gan vao exports.
 * Nhan: partSources — noi dung 12 lat theo dung thu tu manifest; cssByPlaceholder — CSS da doc tu dia;
 *        handwrittenSources — than cac lat viet tay theo manifest.
 * Tra: than bundle hoan chinh (chua co IIFE, chua co loi goi load).
 */
export function assembleBundleBody(partSources: readonly string[], cssByPlaceholder: ReadonlyMap<string, string>, handwrittenSources: readonly string[]): string {
  if (partSources.length !== PART_FILES.length) {
    throw new Error('so lat khong khop manifest: ' + partSources.length + ' ≠ ' + PART_FILES.length);
  }
  if (handwrittenSources.length !== HANDWRITTEN_PARTS.length) {
    throw new Error('so lat viet tay khong khop manifest: ' + handwrittenSources.length + ' ≠ ' + HANDWRITTEN_PARTS.length);
  }
  assertVerbatimParts(partSources);
  const bodies = partSources.map((source, index) => stripPartScaffold(source, PART_FILES[index] as string));
  // Nhung CSS SAU khi ghep: mot diem thay the co the nam o bat ky lat nao, va phep dem "dung mot lan"
  // chi co nghia tren toan than bundle.
  return embedCss([...requireLines(), ...bodies, ...CLIENT_EXPORT_LINES, ...handwrittenSources, ...CLIENT_TAIL_LINES].join(String.fromCharCode(10)), cssByPlaceholder);
}

/**
 * Boc than bundle thanh script classic dang ky DUNG MOT id — id CUA TA.
 * Nhan: code — ma da qua Bun.build (dung require/module/exports nhu bien tu do).
 * Tra: van ban script classic hoan chinh.
 */
export function wrapClientBundle(code: string): string {
  const eol = String.fromCharCode(10);
  const tab = '  ';
  const header = [
    '/*',
    ' * author Bùi Trọng Hiếu',
    ' * email kevinbui210191@gmail.com',
    ' * create date 15/10/2026',
    ' * modify date 18/10/2026',
    ' * desc ARTIFACT SINH TU DONG boi build.ts cua ' + PACKAGE_NAME + ' — khong sua tay',
    ' */',
  ].join(eol);
  const body = code
    .split(eol)
    .map((line) => (line.length > 0 ? tab + tab + tab + line : line))
    .join(eol);
  return [
    header,
    '(function () {',
    '  "use strict";',
    '  var factory = function (require) {',
    '    var module = { exports: {} };',
    '    var exports = module.exports;',
    body,
    '  };',
    '  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).',
    '  window.__ModuleLoader__.load({ id: ' + JSON.stringify(PACKAGE_NAME) + ', factory: factory });',
    '  // KHONG dang ky id cua goi GOC: no thuoc gbh.row.aliases va tang nap TU sinh entry alias.',
    '})();',
    '',
  ].join(eol);
}

/** Kieu ham doc file ma build.ts truyen vao (de test thay bang bang gia). */
export type ReadFileFn = (path: string) => string;

/**
 * Doc 12 lat, bon file CSS va cac lat viet tay tu dia, roi ghep thanh than bundle.
 * Nhan: srcDir — thu muc src/ cua goi; readFile — ham doc file (mac dinh la readFileSync cua node).
 * Tra: than bundle hoan chinh.
 */
export function assembleBundleFromDisk(srcDir: string, readFile: ReadFileFn): string {
  const join = (a: string, b: string): string => a.replace(/\/+$/, '') + '/' + b;
  const cssByPlaceholder = new Map<string, string>();
  for (const item of CSS_REPLACEMENTS) cssByPlaceholder.set(item.placeholder, readCssSource(readFile(join(srcDir, item.file))));
  const parts = PART_FILES.map((file) => readFile(join(srcDir, file)));
  return assembleBundleBody(parts, cssByPlaceholder, readHandwrittenSources(srcDir, readFile));
}

/**
 * Dem so lan mot diem thay the CSS xuat hien trong cac lat NGUON (truoc khi nhung CSS).
 * Dung cho test doi chung: moi diem thay the phai xuat hien DUNG MOT lan, neu khong thi mot lat
 * nao do da bi sua tay va CSS se khong con la nguyen van.
 * Nhan: sources — noi dung tho cua cac lat; placeholder — diem thay the can dem.
 * Tra: so lan xuat hien.
 */
export function countPlaceholder(sources: readonly string[], placeholder: string): number {
  const token = JSON.stringify(placeholder);
  return sources.reduce((total, source) => total + source.split(token).length - 1, 0);
}
