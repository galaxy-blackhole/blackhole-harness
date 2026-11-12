/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bộ quét credential: tìm ứng viên gần nhất kể từ một vị trí, gộp các ứng viên chồng nhau rồi trả node 'secret' kèm mặt nạ
 */

import { CredentialMasks, isWideSpace } from "./credential-masks.ts";
import {
  type CredentialFormat,
  ADDRESS,
  ALNUM,
  CREDENTIAL_FORMATS,
  GOOGLE,
  KEY_BLOCK,
  KEY,
  LABEL,
  PREFIXED,
  SCHEME,
  SK,
  UPPER_ALNUM,
  USER,
  PASSWORD,
  WORD,
} from "./credential-formats.ts";

/** Một node đã nhận ra credential, để renderer vẽ mặt nạ. */
export interface SecretNode {
  /** Id luật UserText đã nhận ra node này. */
  id: "secret";
  /** Vị trí bắt đầu trong chuỗi gốc. */
  start: number;
  /** Vị trí kết thúc (không tính ký tự tại đây). */
  end: number;
  /** Dữ liệu của node: dạng hiển thị đã che. */
  data: { masked: string };
}

/** Bảng bit lớp ký tự cho 128 mã ASCII đầu. */
function charClasses(): Uint16Array {
  const classes = new Uint16Array(128);
  for (let code = 0; code < 128; code++) {
    const upper = code >= 65 && code <= 90;
    const lower = code >= 97 && code <= 122;
    const digit = code >= 48 && code <= 57;
    const alnum = upper || lower || digit;
    // Ký tự được phép trong authority của URL: không phải khoảng trắng, '/', '@', '?' hay '#'.
    const authority = !((code >= 9 && code <= 13) || code === 32 || code === 47 || code === 64 || code === 63 || code === 35);
    classes[code] =
      (alnum || code === 95 || code === 45 ? 1 : 0) |
      (alnum ? 2 : 0) |
      (alnum || code === 95 ? 4 : 0) |
      (alnum || code === 45 ? 8 : 0) |
      (upper || digit ? 16 : 0) |
      (upper || digit || code === 32 ? 32 : 0) |
      (lower || digit || code === 43 || code === 46 || code === 45 ? 64 : 0) |
      (lower ? 128 : 0) |
      (authority && code !== 58 ? 256 : 0) |
      (authority ? 512 : 0);
  }
  return classes;
}

/** Bảng bit dùng chung cho mọi bộ quét. */
const CLASSES = charClasses();

/**
 * Vị trí kết thúc run ký tự thuộc lớp `bits`, tính từ `index`.
 * Nhận: chuỗi, vị trí bắt đầu và bit lớp (chỉ áp cho ASCII).
 * Trả: vị trí sau ký tự cuối cùng của run.
 */
function runEnd(text: string, index: number, bits: number): number {
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code >= 128 || ((CLASSES[code] as number) & bits) === 0) break;
    index++;
  }
  return index;
}

/**
 * Vị trí kết thúc run user của authority ([^\s/:@?#]).
 * Nhận: chuỗi và vị trí bắt đầu.
 * Trả: vị trí sau ký tự cuối cùng.
 */
function userRunEnd(text: string, index: number): number {
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code < 128 ? ((CLASSES[code] as number) & USER) === 0 : isWideSpace(code)) break;
    index++;
  }
  return index;
}

/**
 * Vị trí kết thúc run password của authority ([^\s/@?#]).
 * Nhận: chuỗi và vị trí bắt đầu.
 * Trả: vị trí sau ký tự cuối cùng.
 */
function passwordRunEnd(text: string, index: number): number {
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code < 128 ? ((CLASSES[code] as number) & PASSWORD) === 0 : isWideSpace(code)) break;
    index++;
  }
  return index;
}

/**
 * Có phải ký tự tạo từ (\w) tại một vị trí.
 * Nhận: chuỗi và vị trí (ngoài chuỗi thì trả false).
 * Trả: true nếu là chữ, số hoặc gạch dưới ASCII.
 */
function isWordAt(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;
  const code = text.charCodeAt(index);
  return code < 128 && ((CLASSES[code] as number) & WORD) !== 0;
}

/** Một ứng viên credential đã kiểm xong. */
interface Candidate {
  /** Vị trí bắt đầu. */
  start: number;
  /** Vị trí kết thúc. */
  end: number;
  /** Loại định dạng. */
  kind: number;
}

/**
 * Bộ quét credential của MỘT luật UserText: nhớ chuỗi đang quét và mặt nạ dùng chung.
 * Truy vấn là đồng bộ và không lồng nhau.
 */
export class CredentialScanner {
  /** Dữ liệu định dạng đã đóng băng. */
  private readonly formats: readonly CredentialFormat[];
  /** Bộ dựng mặt nạ. */
  private readonly masks = new CredentialMasks();
  /** Chuỗi của truy vấn hiện tại. */
  private text = "";

  /**
   * Nhận danh sách định dạng cần nhận ra.
   * Nhận: danh sách định dạng (mặc định là bộ chuẩn).
   * Trả: bộ quét dùng được ngay.
   */
  constructor(formats: readonly CredentialFormat[] = CREDENTIAL_FORMATS) {
    this.formats = formats;
  }

  /**
   * Ứng viên gần nhất bắt đầu tại hoặc sau `index`: thử từng chữ mở đầu theo đúng thứ tự khai báo.
   * Nhận: chuỗi và vị trí bắt đầu tìm.
   * Trả: chỉ số định dạng khớp tại vị trí đó, hoặc -1.
   */
  private literalAt(index: number): number {
    for (let slot = 0; slot < this.formats.length; slot++) {
      if (this.text.startsWith((this.formats[slot] as CredentialFormat).literal, index)) return slot;
    }
    return -1;
  }

  /**
   * Ứng viên kế tiếp trong chuỗi tính từ `index`.
   * Nhận: vị trí bắt đầu tìm.
   * Trả: ứng viên đã kiểm, hoặc undefined nếu không còn.
   */
  private nextCandidate(index: number): Candidate | undefined {
    for (let at = Math.max(0, index); at < this.text.length; at++) {
      const slot = this.literalAt(at);
      if (slot < 0) continue;
      const end = this.candidateEnd(slot, at);
      if (end < 0) continue;
      return { start: at, end, kind: (this.formats[slot] as CredentialFormat).kind };
    }
    return undefined;
  }

  /**
   * Vị trí kết thúc của ứng viên có chữ mở đầu tại `at`.
   * Nhận: chỉ số định dạng và vị trí chữ mở đầu.
   * Trả: vị trí kết thúc, hoặc -1 nếu không phải credential.
   */
  private candidateEnd(slot: number, at: number): number {
    const format = this.formats[slot] as CredentialFormat;
    if (format.kind === ADDRESS) {
      const password = this.addressPassword(at);
      return password === undefined ? -1 : password.end;
    }
    if (format.kind === KEY_BLOCK) return this.keyBlockEnd(at);
    return this.prefixedEnd(slot, at);
  }

  /**
   * Khoá/token có tiền tố tại `at`.
   * Nhận: chỉ số định dạng và vị trí chữ mở đầu.
   * Trả: vị trí kết thúc, hoặc -1.
   */
  private prefixedEnd(slot: number, at: number): number {
    const format = this.formats[slot] as CredentialFormat;
    if (isWordAt(this.text, at - 1)) return -1;
    const start = at + format.literal.length;
    if (format.shape === SK) {
      const digit = this.nextDigit(start);
      if (digit - start > 255) return -1;
      const end = runEnd(this.text, start, KEY);
      return end - start >= format.min && digit < end ? end : -1;
    }
    const end = runEnd(this.text, start, format.run);
    const length = end - start;
    if (length < format.min) return -1;
    if (format.shape === 0) return end;
    if (format.shape === GOOGLE) return start + format.min;
    if (format.shape === 1) return length <= format.max && !isWordAt(this.text, end) ? end : -1;
    return this.jwtEnd(start, end, format);
  }

  /**
   * Ba run của một JWT: header, payload (sau ".eyJ") và chữ ký.
   * Nhận: vị trí bắt đầu, vị trí kết thúc header và định dạng.
   * Trả: vị trí kết thúc chữ ký, hoặc -1.
   */
  private jwtEnd(start: number, headerEnd: number, format: CredentialFormat): number {
    if (headerEnd - start > format.max || !this.text.startsWith(".eyJ", headerEnd)) return -1;
    const payloadStart = headerEnd + 4;
    const payloadEnd = runEnd(this.text, payloadStart, KEY);
    if (payloadEnd - payloadStart < format.min || this.text.charCodeAt(payloadEnd) !== 46) return -1;
    const signatureEnd = runEnd(this.text, payloadEnd + 1, KEY);
    return signatureEnd - (payloadEnd + 1) >= format.min ? signatureEnd : -1;
  }

  /**
   * Vị trí chữ số đầu tiên tính từ `start`, hoặc độ dài chuỗi.
   * Nhận: vị trí bắt đầu.
   * Trả: vị trí chữ số đầu tiên.
   */
  private nextDigit(start: number): number {
    let index = start;
    while (index < this.text.length) {
      const code = this.text.charCodeAt(index);
      if (code >= 48 && code <= 57) break;
      index++;
    }
    return index;
  }

  /**
   * Kết thúc nhãn trong dòng BEGIN/END của khối khoá: [A-Z0-9 ]{0,40} rồi "PRIVATE KEY-----".
   * Nhận: vị trí bắt đầu nhãn.
   * Trả: vị trí sau "PRIVATE KEY-----", hoặc -1.
   */
  private labelEnd(start: number): number {
    const limit = Math.min(this.text.length, start + 52);
    let index = start;
    while (index < limit) {
      const code = this.text.charCodeAt(index);
      if (code >= 128 || ((CLASSES[code] as number) & LABEL) === 0) break;
      index++;
    }
    const tail = index - 11;
    return index < start + 52 && tail >= start && this.text.startsWith("PRIVATE KEY-----", tail) ? tail + 16 : -1;
  }

  /**
   * Kết thúc khối khoá bắt đầu bằng "-----BEGIN " tại `at`: sau dòng END đầu tiên, hoặc cuối chuỗi.
   * Nhận: vị trí chữ mở đầu.
   * Trả: vị trí kết thúc, hoặc -1 nếu dòng BEGIN không hợp lệ.
   */
  private keyBlockEnd(at: number): number {
    const header = this.labelEnd(at + 11);
    if (header < 0) return -1;
    for (let line = this.text.indexOf("-----END ", header); line >= 0; line = this.text.indexOf("-----END ", line + 1)) {
      const end = this.labelEnd(line + 9);
      if (end >= 0) return end;
    }
    return this.text.length;
  }

  /**
   * Có phải scheme của URL kết thúc ngay trước `at`: \b[a-z][a-z0-9+.-]{1,15}.
   * Nhận: vị trí.
   * Trả: true nếu đúng.
   */
  private schemeBefore(at: number): boolean {
    for (let start = at - 1; start >= 0 && start >= at - 16; start--) {
      const code = this.text.charCodeAt(start);
      const bits = code < 128 ? (CLASSES[code] as number) : 0;
      if ((bits & SCHEME) === 0) return false;
      if ((bits & 128) !== 0 && at - start >= 2 && !isWordAt(this.text, start - 1)) return true;
    }
    return false;
  }

  /**
   * Password trong "scheme://user:password@".
   * Nhận: vị trí của "://".
   * Trả: { start, end } của password, hoặc undefined.
   */
  private addressPassword(at: number): { start: number; end: number } | undefined {
    if (!this.schemeBefore(at)) return undefined;
    const userStart = at + 3;
    const userEnd = userRunEnd(this.text, userStart);
    if (userEnd - userStart > 256 || this.text.charCodeAt(userEnd) !== 58) return undefined;
    const start = userEnd + 1;
    const end = passwordRunEnd(this.text, start);
    if (end === start || this.text.charCodeAt(end) !== 64) return undefined;
    return { start, end };
  }

  /**
   * Password địa chỉ mà phần "://" nằm TRƯỚC `from` nhưng password thì ở tại/sau `from`.
   * Nhận: vị trí truy vấn.
   * Trả: { start, end } của password, hoặc undefined.
   */
  private addressBefore(from: number): { start: number; end: number } | undefined {
    if (from < 3) return undefined;
    if (this.text.startsWith("://", from - 1)) return this.addressPassword(from - 1);
    if (this.text.startsWith("://", from - 2)) return this.addressPassword(from - 2);
    let index = from - 1;
    const before = this.text.charCodeAt(index);
    let passwordStart: number;
    if (before === 58) {
      passwordStart = from;
      index--;
    } else if (before < 128 ? ((CLASSES[before] as number) & USER) !== 0 : !isWideSpace(before)) {
      const userEnd = userRunEnd(this.text, from);
      if (this.text.charCodeAt(userEnd) !== 58) return undefined;
      passwordStart = userEnd + 1;
    } else {
      return this.text.startsWith("://", from - 3) ? this.addressPassword(from - 3) : undefined;
    }
    const passwordEnd = passwordRunEnd(this.text, passwordStart);
    if (passwordEnd === passwordStart || this.text.charCodeAt(passwordEnd) !== 64) return undefined;
    const lowest = Math.max(0, passwordStart - 258);
    while (index >= lowest && (this.text.charCodeAt(index) < 128 ? ((CLASSES[this.text.charCodeAt(index)] as number) & USER) !== 0 : !isWideSpace(this.text.charCodeAt(index)))) index--;
    return index >= 2 && this.text.startsWith("://", index - 2) ? this.addressPassword(index - 2) : undefined;
  }

  /**
   * Credential gần nhất bắt đầu tại hoặc sau `from`.
   * Các ứng viên chồng nhau nhập vào ứng viên sớm nhất và dùng mặt nạ của nó, nên không credential nào bị che một nửa.
   * Nhận: toàn bộ chuỗi gốc và vị trí bắt đầu truy vấn.
   * Trả: node "secret", hoặc undefined nếu không còn credential nào.
   */
  match(text: string, from: number): SecretNode | undefined {
    this.text = text;
    let start = -1;
    let end = -1;
    let kind = PREFIXED;
    let plain = true;
    let deferred = this.addressBefore(from);
    let deferredStart = deferred === undefined ? -1 : deferred.start;
    let deferredEnd = deferred === undefined ? -1 : deferred.end;
    let at = Math.max(0, from);
    while (at < text.length) {
      const slot = this.literalAt(at);
      if (slot < 0) {
        at++;
        continue;
      }
      if (deferredStart >= 0 && deferredStart <= at) {
        if (start < 0) {
          start = deferredStart;
          end = deferredEnd;
          kind = ADDRESS;
        } else if (deferredStart >= end) break;
        deferredStart = -1;
      }
      if (start >= 0 && (at >= end || end === text.length)) break;
      const literalKind = (this.formats[slot] as CredentialFormat).kind;
      if (literalKind === ADDRESS) {
        const password = this.addressPassword(at);
        deferredStart = password === undefined ? -1 : password.start;
        deferredEnd = password === undefined ? -1 : password.end;
        at++;
        continue;
      }
      const candidateEnd = literalKind === KEY_BLOCK ? this.keyBlockEnd(at) : this.prefixedEnd(slot, at);
      at++;
      if (candidateEnd < 0) continue;
      if (start < 0) {
        start = at - 1;
        end = candidateEnd;
        kind = literalKind;
        plain = literalKind === PREFIXED;
      } else if (candidateEnd > end) {
        end = candidateEnd;
        if (literalKind !== PREFIXED) plain = false;
      }
    }
    if (start < 0 && deferredStart >= 0) {
      start = deferredStart;
      end = deferredEnd;
      kind = ADDRESS;
    }
    if (start < 0) return undefined;
    return { id: "secret", start, end, data: { masked: this.masks.masked(text, kind, plain, start, end) } };
  }
}
