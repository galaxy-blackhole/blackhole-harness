/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Dữ liệu các định dạng credential mà bộ quét nhận ra: chữ mở đầu, cách kiểm, và lớp ký tự dùng để kiểm
 */

/** Lớp ký tự [A-Za-z0-9_-]. */
export const KEY = 1;
/** Lớp ký tự [A-Za-z0-9]. */
export const ALNUM = 2;
/** Lớp ký tự \w. */
export const WORD = 4;
/** Lớp ký tự [A-Za-z0-9-]. */
export const ALNUM_DASH = 8;
/** Lớp ký tự [A-Z0-9]. */
export const UPPER_ALNUM = 16;
/** Lớp ký tự [A-Z0-9 ] (nhãn trong dòng BEGIN/END của khối khoá). */
export const LABEL = 32;
/** Lớp ký tự [a-z0-9+.-] (scheme của URL). */
export const SCHEME = 64;
/** Lớp ký tự [a-z]. */
export const LOWER = 128;
/** Lớp ký tự [^\s/:@?#] (phần user của authority). */
export const USER = 256;
/** Lớp ký tự [^\s/@?#] (phần password của authority). */
export const PASSWORD = 512;

/** Khối khoá riêng tư, tính từ dòng "-----BEGIN". */
export const KEY_BLOCK = 0;
/** Password của một địa chỉ có kèm credential. */
export const ADDRESS = 1;
/** Khoá/token của nhà cung cấp, tính từ chữ mở đầu cố định. */
export const PREFIXED = 2;

/** Cả run, tối thiểu min ký tự. */
export const RUN = 0;
/** Từ min đến max rồi hết từ (\b). */
export const BOUNDED = 1;
/** Tối thiểu min, và phải có một chữ số trong 256 ký tự đầu. */
export const SK = 2;
/** Đúng min ký tự (Google API key). */
export const GOOGLE = 3;
/** Ba run nối bằng ".eyJ" và "." (JWT). */
export const JWT = 4;

/** Một định dạng credential. */
export interface CredentialFormat {
  /** Chữ ASCII mà ứng viên bắt đầu bằng; không chữ nào nằm trong chữ khác. */
  readonly literal: string;
  /** Loại định dạng. */
  readonly kind: typeof KEY_BLOCK | typeof ADDRESS | typeof PREFIXED;
  /** Chỉ với định dạng có tiền tố: cách kiểm run sau chữ mở đầu. */
  readonly shape: number;
  /** Chỉ với định dạng có tiền tố: bit lớp ký tự của run sau chữ mở đầu. */
  readonly run: number;
  /** Số ký tự tối thiểu. */
  readonly min: number;
  /** Số ký tự tối đa (0 nghĩa là không giới hạn). */
  readonly max: number;
}

/**
 * Dựng một định dạng có tiền tố.
 * Nhận: chữ mở đầu, cách kiểm, lớp ký tự của run, min và max.
 * Trả: bản ghi định dạng đã chuẩn hoá cờ.
 */
function prefixed(literal: string, shape: number, run: number, min: number, max = 0): CredentialFormat {
  return { literal, kind: PREFIXED, shape, run, min, max };
}

/** Mọi định dạng có tiền tố đều dài hơn 8 ký tự mà mặt nạ còn để lộ. */
export const CREDENTIAL_FORMATS: readonly CredentialFormat[] = Object.freeze([
  { literal: "-----BEGIN ", kind: KEY_BLOCK, shape: RUN, run: 0, min: 0, max: 0 },
  { literal: "://", kind: ADDRESS, shape: RUN, run: 0, min: 0, max: 0 },
  prefixed("sk-", SK, KEY, 20),
  prefixed("AIza", GOOGLE, KEY, 35),
  prefixed("ghp_", RUN, ALNUM, 36),
  prefixed("gho_", RUN, ALNUM, 36),
  prefixed("ghu_", RUN, ALNUM, 36),
  prefixed("ghs_", RUN, ALNUM, 36),
  prefixed("ghr_", RUN, ALNUM, 36),
  prefixed("github_pat_", RUN, WORD, 22),
  prefixed("glpat-", RUN, KEY, 20),
  prefixed("npm_", RUN, ALNUM, 36),
  prefixed("hf_", RUN, ALNUM, 30),
  prefixed("AKIA", BOUNDED, UPPER_ALNUM, 16, 16),
  prefixed("ASIA", BOUNDED, UPPER_ALNUM, 16, 16),
  prefixed("LTAI", BOUNDED, ALNUM, 12, 20),
  prefixed("AKID", BOUNDED, ALNUM, 28, 36),
  prefixed("xoxa-", RUN, ALNUM_DASH, 10),
  prefixed("xoxb-", RUN, ALNUM_DASH, 10),
  prefixed("xoxp-", RUN, ALNUM_DASH, 10),
  prefixed("xoxr-", RUN, ALNUM_DASH, 10),
  prefixed("xoxs-", RUN, ALNUM_DASH, 10),
  prefixed("sk_live_", RUN, ALNUM, 16),
  prefixed("sk_test_", RUN, ALNUM, 16),
  prefixed("rk_live_", RUN, ALNUM, 16),
  prefixed("rk_test_", RUN, ALNUM, 16),
  prefixed("whsec_", RUN, ALNUM, 24),
  prefixed("eyJ", JWT, KEY, 8, 2048),
]);

/** Số ký tự đầu của khoá có tiền tố được để lộ trong mặt nạ. */
export const VISIBLE_PREFIX = 8;
