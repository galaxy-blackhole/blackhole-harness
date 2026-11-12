/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Đọc/ghi kho phiên của DSH: file session.v4.jsonl.zstd là NHIỀU frame zstd nối tiếp, mỗi frame
 *      một lần ghi JSONL. Hợp đồng lưu trữ dùng chung cho app, oracle A và oracle B
 */

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { zstdDecompressSync } from "node:zlib";

/** Một bản ghi trong log phiên. */
export interface SessionRecord {
  /** Loại bản ghi (session, agent/inbox/spliced, assistant/attempt, session/title, ...). */
  type: string;
  /** Số thứ tự trong log (nếu có). */
  seq: number | null;
  /** Dữ liệu kèm theo. */
  data: Record<string, unknown>;
}

/** Một phiên trên đĩa, kèm bằng chứng BYTE của nó. */
export interface SessionFolder {
  /** Bên sở hữu (app / oracleA / stock / khác). */
  side: string;
  /** DSH_HOME của bên đó. */
  home: string;
  /** Slug workspace trong tên thư mục. */
  slug: string;
  /** Định danh phiên (session-<uuid>). */
  id: string;
  /** Thư mục phiên. */
  dir: string;
  /** Các tệp trong thư mục phiên. */
  files: string[];
  /** Số byte của session.v4.jsonl.zstd. */
  bytes: number;
  /** sha256 của session.v4.jsonl.zstd. */
  sha256: string;
  /** 4 byte đầu dạng hex (kỳ vọng 28b52ffd). */
  magic: string;
  /** true khi magic đúng zstd. */
  magicOk: boolean;
  /** Số frame zstd trong file (DSH ghi nối tiếp từng lần). */
  frames: number;
  /** Khoá của bản ghi header, đã sắp xếp. */
  headerKeys: string[];
  /** true khi header có đủ lõi type/version/id/createdAt/cwd/isSeeded. */
  headerCoreOk: boolean;
  /** cwd ghi trong header. */
  cwd: string;
  /** Số bản ghi giải mã được từ mọi frame. */
  recordCount: number;
  /** Các loại bản ghi gặp phải. */
  recordTypes: string[];
  /** Tiêu đề phiên (nếu log có bản ghi session/title). */
  title: string;
  /** Câu người dùng gõ (nếu có) — dùng làm kim chỉ nam khi kiểm UI bên kia. */
  userText: string;
  /** Thời điểm sửa cuối (ms). */
  mtimeMs: number;
}

/** Lõi bắt buộc của bản ghi header phiên. */
export const HEADER_CORE_KEYS: readonly string[] = Object.freeze(["type", "version", "id", "createdAt", "cwd", "isSeeded"]);

/** Magic của frame zstd. */
export const ZSTD_MAGIC = 0x28b52ffd;

/**
 * Tìm offset của mọi frame zstd trong một buffer (DSH ghi nối tiếp từng lần ghi thành một frame).
 * @param buf nội dung file.
 * @returns danh sách offset, theo thứ tự tăng dần.
 */
export function findFrames(buf: Buffer): number[] {
  const offsets: number[] = [];
  for (let index = 0; index + 4 <= buf.length; index += 1) {
    if (buf.readUInt32BE(index) === ZSTD_MAGIC) offsets.push(index);
  }
  return offsets;
}

/**
 * Giải mã mọi frame của một file log phiên thành danh sách bản ghi JSONL.
 * @param file đường dẫn session.v4.jsonl.zstd.
 * @returns danh sách bản ghi; rỗng khi file không đọc được.
 */
export function readRecords(file: string): SessionRecord[] {
  let buf: Buffer;
  try {
    buf = readFileSync(file);
  } catch {
    return [];
  }
  const offsets = findFrames(buf);
  const records: SessionRecord[] = [];
  offsets.forEach((offset, index) => {
    const end = offsets[index + 1] ?? buf.length;
    let text: string;
    try {
      text = zstdDecompressSync(buf.subarray(offset, end)).toString("utf8");
    } catch {
      return;
    }
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue;
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const type = typeof parsed.type === "string" ? parsed.type : "(không rõ)";
        const seq = typeof parsed.seq === "number" ? parsed.seq : null;
        // Bản ghi header của DSH nằm ngay ở tầng trên (không có trường data), các bản ghi sau mới có data.
        const data = (parsed.data ?? parsed) as Record<string, unknown>;
        records.push({ type, seq, data });
      } catch {
        // dòng hỏng: bỏ qua, không làm hỏng phép đo
      }
    }
  });
  return records;
}

/**
 * Bóc tiêu đề phiên và câu người dùng gõ từ danh sách bản ghi.
 * @param records bản ghi của phiên.
 * @returns tiêu đề và câu người dùng (chuỗi rỗng nếu không có).
 */
export function extractTexts(records: readonly SessionRecord[]): { title: string; userText: string } {
  let title = "";
  let userText = "";
  for (const record of records) {
    if (record.type === "session/title" && typeof record.data.title === "string") title = record.data.title;
    const inserted = record.data.inserted;
    if (record.type === "agent/inbox/spliced" && Array.isArray(inserted)) {
      for (const item of inserted as Record<string, unknown>[]) {
        const content = item.content;
        if (!Array.isArray(content)) continue;
        const text = (content as Record<string, unknown>[])
          .map((part) => (typeof part.text === "string" ? part.text : ""))
          .join(" ")
          .trim();
        if (text !== "" && userText === "") userText = text;
      }
    }
  }
  return { title, userText };
}

/**
 * Đọc đầy đủ một thư mục phiên, kèm bằng chứng byte và hợp đồng header.
 * @param home DSH_HOME.
 * @param side nhãn bên sở hữu.
 * @param slug slug workspace.
 * @param id định danh phiên.
 * @returns thông tin phiên.
 */
export function readSessionFolder(home: string, side: string, slug: string, id: string): SessionFolder {
  const dir = join(home, "sessions", slug, id);
  const file = join(dir, "session.v4.jsonl.zstd");
  const exists = existsSync(file);
  const buf = exists ? readFileSync(file) : Buffer.alloc(0);
  const records = exists ? readRecords(file) : [];
  const header = records.find((record) => record.type === "session");
  const headerSource = (header?.data ?? {}) as Record<string, unknown>;
  const stats = exists ? statSync(file) : null;
  const { title, userText } = extractTexts(records);
  return {
    side,
    home,
    slug,
    id,
    dir,
    files: existsSync(dir) ? readdirSync(dir).sort() : [],
    bytes: stats?.size ?? 0,
    sha256: createHash("sha256").update(buf).digest("hex"),
    magic: buf.subarray(0, 4).toString("hex"),
    magicOk: buf.length >= 4 && buf.readUInt32BE(0) === ZSTD_MAGIC,
    frames: findFrames(buf).length,
    headerKeys: Object.keys(headerSource).sort(),
    headerCoreOk: HEADER_CORE_KEYS.every((key) => Object.keys(headerSource).includes(key)),
    cwd: typeof headerSource.cwd === "string" ? headerSource.cwd : "",
    recordCount: records.length,
    recordTypes: [...new Set(records.map((record) => record.type))].sort(),
    title,
    userText,
    mtimeMs: stats?.mtimeMs ?? 0,
  };
}

/**
 * Liệt kê mọi phiên trong một home.
 * @param home DSH_HOME.
 * @param side nhãn bên sở hữu.
 * @returns danh sách phiên, sắp theo thời điểm sửa cuối tăng dần.
 */
export function listSideSessions(home: string, side: string): SessionFolder[] {
  const root = join(home, "sessions");
  if (!existsSync(root)) return [];
  const out: SessionFolder[] = [];
  for (const slug of readdirSync(root)) {
    const slugDir = join(root, slug);
    if (!statSync(slugDir).isDirectory()) continue;
    for (const name of readdirSync(slugDir)) {
      if (!name.startsWith("session-")) continue;
      out.push(readSessionFolder(home, side, slug, name));
    }
  }
  return out.sort((a, b) => a.mtimeMs - b.mtimeMs);
}

/**
 * Copy BYTE-NGUYÊN một phiên sang home khác (giữ nguyên slug), không copy session.lock.
 * @param source phiên nguồn.
 * @param targetHome home đích.
 * @returns thông tin phiên tại home đích, kèm cờ byte giống nhau.
 */
export function copySessionTo(source: SessionFolder, targetHome: string): { folder: SessionFolder; byteIdentical: boolean } {
  const dir = join(targetHome, "sessions", source.slug, source.id);
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(source.dir, "session.v4.jsonl.zstd"), join(dir, "session.v4.jsonl.zstd"));
  const folder = readSessionFolder(targetHome, "copy", source.slug, source.id);
  return { folder, byteIdentical: folder.sha256 === source.sha256 && folder.bytes === source.bytes };
}

/**
 * Xoá thư mục một phiên đã copy (chỉ dùng cho bản copy của phép đo).
 * @param home DSH_HOME chứa bản copy.
 * @param slug slug workspace.
 * @param id định danh phiên.
 * @returns true khi thư mục không còn tồn tại sau khi xoá.
 */
export function removeSessionCopy(home: string, slug: string, id: string): boolean {
  const dir = join(home, "sessions", slug, id);
  rmSync(dir, { recursive: true, force: true });
  return !existsSync(dir);
}
