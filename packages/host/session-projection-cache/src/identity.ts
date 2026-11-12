/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nhân dạng vòng đời phiên của cache: chiếu một header lên các trường BẤT BIẾN phân biệt hai vòng
 *      đời dưới CÙNG một id, ghép thêm mốc cắt thừa kế khi fork, và bốn phép so khớp mà đường đọc dùng
 *      (đầy đủ cho phép gộp, chỉ-vòng-đời cho phép xem, và tiền nhiệm cho gợi ý tiêu đề).
 */

import { SessionLogOffset } from "./brand.ts";
import type { SessionHeader } from "./types.ts";

/** Nhân dạng mà MỘT header tự chứng minh được (không cần đọc log). */
export interface LifecycleIdentity {
  /** Thế hệ định dạng log phiên. */
  readonly formatVersion: number;
  /** Mốc tạo phiên. */
  readonly createdAt: number;
  /** Thư mục làm việc lúc tạo (VẮNG khi header không có — phép so vẫn phân biệt được). */
  readonly cwd?: string;
  /** Phiên có tiền tố thừa kế hay không. */
  readonly isSeeded: boolean;
}

/** Nhân dạng ĐẦY ĐỦ của phép gộp: vòng đời + độ dài tiền tố thừa kế khi fork. */
export interface FoldIdentity extends LifecycleIdentity {
  /** Độ dài tiền tố thừa kế — một phần của phép gộp, không phải của header. */
  readonly inheritedEventCount: number;
}

/** Nhân dạng đã LƯU của một bản ghi: các trường vòng đời có thể vắng (bản ghi tiền nhiệm). */
export interface StoredIdentity {
  /** Thế hệ định dạng đã lưu (vắng với bản ghi tiền nhiệm). */
  readonly formatVersion?: number;
  /** Mốc tạo phiên đã lưu. */
  readonly createdAt: number;
  /** Thư mục làm việc đã lưu (vắng khi phiên không ghi). */
  readonly cwd?: string;
  /** Cờ tiền tố thừa kế đã lưu (vắng = chưa gieo). */
  readonly isSeeded?: boolean;
  /** Độ dài tiền tố thừa kế đã lưu (vắng = dòng dõi chưa gieo). */
  readonly inheritedEventCount?: number;
}

/**
 * Chiếu một header lên nhân dạng mà RIÊNG header chứng minh được: mốc cắt thừa kế KHÔNG nằm ở đây vì
 * header không mang nó (nó cố định lúc fork trong CÙNG một thế hệ định dạng).
 * Nhận: header phiên.
 * Trả: nhân dạng vòng đời (object MỚI mỗi lần gọi).
 */
export function lifecycleIdentityOf(header: SessionHeader): LifecycleIdentity {
  return {
    formatVersion: header.version,
    createdAt: header.createdAt,
    ...(header.cwd === undefined ? {} : { cwd: header.cwd }),
    isSeeded: header.isSeeded,
  };
}

/**
 * Chiếu một header và mốc cắt thừa kế CHÍNH XÁC lên nhân dạng đầy đủ của phép gộp.
 * Nhận: header phiên và độ dài tiền tố thừa kế.
 * Trả: nhân dạng đầy đủ; ném `Error` (cùng câu với bản gốc) khi phiên CHƯA gieo mà cắt khác 0.
 */
export function identityOf(header: SessionHeader, inheritedEventCount: number): FoldIdentity {
  const cut = SessionLogOffset(inheritedEventCount);
  if (!header.isSeeded && cut !== 0) throw new Error("unseeded projection-cache identity inherited event count must be 0");
  return { ...lifecycleIdentityOf(header), inheritedEventCount: cut };
}

/**
 * Bản ghi đã lưu có được MỒI phép gộp của bên gọi hay không: cùng thế hệ định dạng, cùng vòng đời, và
 * cùng mốc cắt thừa kế. Bản ghi gộp dưới cắt KHÁC mã hoá cắt đó trong trạng thái đơn vị, nên nó sẽ
 * mang cắt lạ vào phép gộp tiếp và checkpoint kế tiếp.
 * Nhận: nhân dạng đã lưu và nhân dạng đầy đủ của bên gọi.
 * Trả: `true` khi bản ghi dùng được làm mồi.
 */
export function identityMatches(stored: StoredIdentity, expected: FoldIdentity): boolean {
  return currentLifecycleMatches(stored, expected) && (stored.inheritedEventCount ?? 0) === expected.inheritedEventCount;
}

/**
 * Bản ghi đã lưu có thuộc ĐÚNG vòng đời của bên gọi ở THẾ HỆ ĐỊNH DẠNG HIỆN TẠI hay không. Thế hệ
 * định dạng vắng mặt thì không chứng minh được ngữ nghĩa phép gộp ⇒ KHÔNG BAO GIỜ khớp. Đây là toàn
 * bộ nhân dạng mà một bên đọc chỉ-có-header (liệt kê) kiểm được.
 * Nhận: nhân dạng đã lưu và nhân dạng vòng đời của bên gọi.
 * Trả: `true` khi khớp cả thế hệ định dạng lẫn vòng đời.
 */
export function currentLifecycleMatches(stored: StoredIdentity, expected: LifecycleIdentity): boolean {
  return stored.formatVersion === expected.formatVersion && lifecycleIdentityMatches(stored, expected);
}

/**
 * Bản ghi đã lưu có phải TIỀN NHIỆM của vòng đời đang được liệt kê hay không: thế hệ định dạng vắng
 * (bản ghi rất cũ) hoặc CŨ HƠN, và vòng đời khớp. Chỉ dùng cho gợi ý tiêu đề — không bao giờ cho phép
 * mồi phép gộp.
 * Nhận: nhân dạng đã lưu và nhân dạng vòng đời của bên gọi.
 * Trả: `true` khi bản ghi là tiền nhiệm của vòng đời đó.
 */
export function predecessorIdentityMatches(stored: StoredIdentity, expected: LifecycleIdentity): boolean {
  return (
    (stored.formatVersion === undefined || stored.formatVersion < expected.formatVersion) &&
    lifecycleIdentityMatches(stored, expected)
  );
}

/**
 * So các trường KHÔNG phụ thuộc thế hệ định dạng mà vẫn phân biệt được hai vòng đời phiên. Cờ
 * `isSeeded` vắng được đọc là CHƯA gieo (bản ghi tiền nhiệm).
 * Nhận: nhân dạng đã lưu và nhân dạng vòng đời của bên gọi.
 * Trả: `true` khi ba trường khớp.
 */
export function lifecycleIdentityMatches(stored: StoredIdentity, expected: LifecycleIdentity): boolean {
  return (
    stored.createdAt === expected.createdAt &&
    stored.cwd === expected.cwd &&
    (stored.isSeeded ?? false) === expected.isSeeded
  );
}
