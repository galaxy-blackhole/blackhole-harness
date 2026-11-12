/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bo khop mau glob cho danh sach `ignored` cua watcher — thay picomatch cua ban goc.
 */

/** Ky tu phai escape khi dung trong RegExp (gom ca dau gach cheo nguoc). */
const REGEXP_SPECIAL = /[.+^$(){}|[\]\\]/g;

/**
 * Chuyen MOT mau glob thanh RegExp neo hai dau.
 * Ho tro dung ba cu phap ma ban goc dung: "hai sao + gach cheo" (khong hoac nhieu thu muc), "hai sao" (bat ky),
 * "mot sao" (trong mot cap thu muc) va "cham hoi" (mot ky tu). Cac ky tu con lai la literal.
 * @param pattern - mau glob (vi du mau mac dinh thu nhat cua ban goc).
 * @returns RegExp khop ca chuoi.
 */
function toRegExp(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index] ?? "";
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        index += 1;
        if (pattern[index + 1] === "/") {
          index += 1;
          source += "(?:[^/]+/)*";
        } else source += ".*";
      } else source += "[^/]*";
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    source += char.replace(REGEXP_SPECIAL, "\\$&");
  }
  return new RegExp("^" + source + "$");
}

/**
 * Dung ham khop cho ca danh sach mau `ignored` (ngu nghia: khop BAT KY mau nao la bi loai).
 * @param patterns - danh sach mau glob cua cau hinh.
 * @returns Ham nhan duong dan TUONG DOI so voi goc watch va tra true khi bi loai.
 */
export function globMatcher(patterns: readonly string[]): (path: string) => boolean {
  const compiled = patterns.map(toRegExp);
  return (path: string) => compiled.some((matcher) => matcher.test(path));
}
