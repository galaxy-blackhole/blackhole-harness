/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dinh dang so du theo luat Platform Web (hai chu so thap phan + luat duoi mot xu) — thay big.js bang so hoc chuoi chinh xac
 */

/** Mot so thap phan da tach dau: dau, phan nguyen, phan thap phan. */
interface Decimal {
  /** true khi am. */
  readonly negative: boolean;
  /** Chuoi chu so phan nguyen (khong dau). */
  readonly integer: string;
  /** Chuoi chu so phan thap phan (khong dau, khong dau cham). */
  readonly fraction: string;
}

/**
 * Tach mot chuoi so thap phan hop le thanh ba phan.
 * Nhan: text — chuoi so (co the co dau +/-, dau cham thap phan, hoac ky phap mu).
 * Tra: so da tach dau.
 */
function parseDecimal(text: string): Decimal {
  const trimmed = text.trim();
  const negative = trimmed.startsWith("-");
  const body = trimmed.replace(/^[+-]/, "");
  const [head = "", tail = ""] = body.split(".");
  return { negative, integer: head === "" ? "0" : head, fraction: tail };
}

/**
 * Bo so 0 vo nghia o dau phan nguyen (giu lai it nhat mot chu so).
 * Nhan: digits — chuoi chu so.
 * Tra: chuoi da rut gon.
 */
function trimLeadingZeros(digits: string): string {
  const stripped = digits.replace(/^0+/, "");
  return stripped === "" ? "0" : stripped;
}

/**
 * So sanh hai so thap phan khong dau.
 * Nhan: a — so thu nhat; b — so thu hai.
 * Tra: -1 khi a < b, 0 khi bang nhau, 1 khi a > b.
 */
function compareMagnitude(a: Decimal, b: Decimal): number {
  const ai = trimLeadingZeros(a.integer);
  const bi = trimLeadingZeros(b.integer);
  if (ai.length !== bi.length) return ai.length < bi.length ? -1 : 1;
  if (ai !== bi) return ai < bi ? -1 : 1;
  const width = Math.max(a.fraction.length, b.fraction.length);
  const af = a.fraction.padEnd(width, "0");
  const bf = b.fraction.padEnd(width, "0");
  if (af === bf) return 0;
  return af < bf ? -1 : 1;
}

/** Kieu lam tron: xuong (roundDown cua big.js) hoac nua len (mac dinh cua big.js). */
type Rounding = "down" | "halfUp";

/**
 * Lam tron mot so thap phan khong dau toi dp chu so thap phan.
 * Nhan: value — so da tach dau; dp — so chu so thap phan; mode — kieu lam tron.
 * Tra: { integer, fraction } da lam tron, fraction du dp chu so.
 */
function roundMagnitude(value: Decimal, dp: number, mode: Rounding): { integer: string; fraction: string } {
  const kept = value.fraction.slice(0, dp).padEnd(dp, "0");
  const rest = value.fraction.slice(dp);
  const up = mode === "halfUp" && rest !== "" && Number(rest[0]) >= 5;
  const digits = trimLeadingZeros(value.integer + kept).padStart(dp + 1, "0");
  if (!up) return { integer: digits.slice(0, digits.length - dp) || "0", fraction: digits.slice(-dp) };
  const bumped = (BigInt(digits) + 1n).toString().padStart(dp + 1, "0");
  return { integer: bumped.slice(0, bumped.length - dp) || "0", fraction: bumped.slice(-dp) };
}

/**
 * Nhom chu so phan nguyen theo dau phay nghin, dung y nguyen ban goc (Number(...).toLocaleString()).
 * Nhan: value — chuoi "nguyen.thapphan".
 * Tra: chuoi da nhom.
 */
function addCommas(value: string): string {
  const [integer = "0", fraction = ""] = value.split(".");
  return Number(integer).toLocaleString() + "." + fraction;
}

/**
 * Dinh dang so du bang luat hien thi cua Platform Web: hai chu so thap phan,
 * so duong duoi mot xu hien "<symbol>0.01", so am duoi mot xu hien "-<symbol>0.01".
 * Nhan: amount — chuoi so du da duoc Host kiem; symbol — ky hieu tien te.
 * Tra: van ban tien te co dau va nhom chu so.
 */
export function formatBalance(amount: string, symbol: string): string {
  const value = parseDecimal(amount);
  const zero = { negative: false, integer: "0", fraction: "" };
  const magnitude = compareMagnitude(value, zero);
  if (magnitude === 0) return symbol + "0.00";
  if (value.negative) {
    const oneCent = parseDecimal("0.01");
    if (compareMagnitude(value, oneCent) < 0) return "-" + symbol + "0.01";
    const rounded = roundMagnitude(value, 2, "halfUp");
    return "-" + symbol + addCommas(rounded.integer + "." + rounded.fraction);
  }
  const oneCent = parseDecimal("0.01");
  if (compareMagnitude(value, oneCent) < 0) return "<" + symbol + "0.01";
  const rounded = roundMagnitude(value, 2, "down");
  return symbol + addCommas(rounded.integer + "." + rounded.fraction);
}
