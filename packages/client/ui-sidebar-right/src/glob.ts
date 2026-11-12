/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bo doi chieu glob thay picomatch cua ban goc (chi nhanh dung boi so dang ky loai tab)
 *
 * ⚠️ 18/10/2026 — DOI CHIEU HANH VI: ban goc bundle CA picomatch 4.0.7 vao client.js (1.899 dong,
 * nam trong vung `../../../node_modules/.pnpm/picomatch@4.0.7/...`) chi de dung MOT lan: doi chieu
 * "patterns" cua mot dinh nghia loai tab voi dia chi tai nguyen. Goi lai ca thu vien do vao bundle
 * cua ta la khong can thiet; bo doi chieu duoi day phu DUNG tap cu phap ma cac pattern dang dung:
 *   · gbh-resource://file/[\\s\\S]+            (lop ky tu, escape regex)
 *   · gbh-resource://changes-review/**
 *   · gbh-resource://plan/** va gbh-resource://plan-review/**
 *   · gbh-resource://subagentchat/session/**
 * Tuy chon duoc ho tro dung nhu tham so ban goc truyen: nocase (khong phan biet hoa/thuong),
 * dot (ky tu dai dien an duoc dau cham), basename (chi doi chieu doan cuoi cua duong dan).
 * Nhan: khong co.
 * Tra: khong co.
 */

/** Tuy chon doi chieu, dung dung ten tuy chon cua picomatch ma ban goc truyen. */
export interface GlobOptions {
  /** Khong phan biet chu hoa/chu thuong. */
  nocase?: boolean;
  /** Ky tu dai dien an duoc dau cham o dau doan duong dan. */
  dot?: boolean;
  /** Chi doi chieu doan cuoi cung cua duong dan (sau dau "/"). */
  basename?: boolean;
}

/** Ky tu dac biet cua regex phai escape khi gap ky tu thuong cua glob. */
const REGEX_SPECIALS = ".+()|^$@%,";

/**
 * Mo rong cum ngoac nhon thanh danh sach phuong an (ho tro long nhau).
 * Nhan: pattern — mau glob con cum {a,b}.
 * Tra: danh sach mau da thay cum ngoac nhon.
 */
export function expandBraces(pattern: string): string[] {
  const open = pattern.indexOf("{");
  if (open < 0) return [pattern];
  let depth = 0;
  let close = -1;
  const parts: string[] = [];
  let start = open + 1;
  for (let i = open; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        parts.push(pattern.slice(start, i));
        break;
      }
    } else if (c === "," && depth === 1) {
      parts.push(pattern.slice(start, i));
      start = i + 1;
    }
  }
  if (close < 0) return [pattern];
  const head = pattern.slice(0, open);
  const tail = pattern.slice(close + 1);
  const out: string[] = [];
  for (const part of parts) for (const expanded of expandBraces(head + part + tail)) out.push(expanded);
  return out;
}

/**
 * Dich mot mau glob thanh than regex (khong neo).
 * Nhan: pattern — mau glob mot phuong an; dot — ky tu dai dien an duoc dau cham.
 * Tra: than regex tuong ung.
 */
function translate(pattern: string, dot: boolean): string {
  let out = "";
  let atSegmentStart = true;
  let i = 0;
  /** Chen ve "khong an dau cham" khi dang o dau doan va khong bat dot. */
  const guardDot = (): string => (dot || !atSegmentStart ? "" : "(?!\\.)");
  while (i < pattern.length) {
    const c = pattern[i] as string;
    if (c === "*") {
      const globstar = pattern[i + 1] === "*";
      if (globstar) {
        if (pattern[i + 2] === "/") {
          out += guardDot() + "(?:[^/]*/)*";
          i += 3;
          atSegmentStart = true;
          continue;
        }
        out += guardDot() + ".*";
        i += 2;
        atSegmentStart = false;
        continue;
      }
      out += guardDot() + "[^/]*";
      i += 1;
      atSegmentStart = false;
      continue;
    }
    if (c === "?") {
      out += guardDot() + "[^/]";
      i += 1;
      atSegmentStart = false;
      continue;
    }
    if (c === "[") {
      const end = pattern.indexOf("]", i + 1);
      if (end > i + 1) {
        const body = pattern.slice(i + 1, end);
        const negated = body.startsWith("!") || body.startsWith("^");
        const inner = negated ? body.slice(1) : body;
        out += guardDot() + "[" + (negated ? "^" : "") + inner.replace(/\\/g, "\\\\") + "]";
        i = end + 1;
        atSegmentStart = false;
        continue;
      }
    }
    if (c === "\\" && i + 1 < pattern.length) {
      out += (pattern[i + 1] as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i += 2;
      atSegmentStart = false;
      continue;
    }
    if (c === "/") {
      out += "/";
      i += 1;
      atSegmentStart = true;
      continue;
    }
    out += REGEX_SPECIALS.includes(c) || c === "{" || c === "}" || c === "[" || c === "]" || c === "\\"
      ? "\\" + c
      : c;
    i += 1;
    atSegmentStart = false;
  }
  return out;
}

/**
 * Bien mot mau glob thanh ham doi chieu — thay picomatch cua ban goc.
 * Nhan: pattern — mau glob; options — tuy chon nhu ban goc truyen (nocase · dot · basename).
 * Tra: ham nhan chuoi va tra true khi chuoi khop mau.
 */
export function compileGlob(pattern: string, options: GlobOptions = {}): (input: string) => boolean {
  const alternatives = expandBraces(pattern).map((one: any) => translate(one, options.dot === true));
  const source = alternatives.length === 1 ? (alternatives[0] as string) : "(?:" + alternatives.join("|") + ")";
  const regex = new RegExp("^" + source + "$", options.nocase === true ? "iu" : "u");
  return (input: string): boolean => {
    if (options.basename === true) return regex.test(input.slice(input.lastIndexOf("/") + 1));
    return regex.test(input);
  };
}
