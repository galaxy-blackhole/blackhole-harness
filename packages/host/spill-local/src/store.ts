/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cơ chế lưu trữ KHÔNG phụ thuộc cordis cho backend tràn cục bộ: chọn thư mục riêng theo
 *      phiên, suy tên tệp an toàn (khử đường dẫn leo thang), và ghi độc quyền chỉ-chủ-sở-hữu.
 *      Bản viết lại của Galaxy Blackhole cho row spill-local (@deepseek-ai/dsh-spill-local) —
 *      nguồn đối chiếu: apps/host/node_modules/@deepseek-ai/dsh-spill-local/lib/types/store.d.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Tiền tố dùng chung cho lượt tạo gốc mặc định và lượt dò gốc lúc khởi động. */
export const DEFAULT_ROOT_PREFIX = "dsh-spill-";

/** Quyền thư mục phiên: chỉ chủ sở hữu đọc/ghi (0700). */
const SESSION_DIR_MODE = 0o700;
/** Quyền tệp tràn: chỉ chủ sở hữu đọc/ghi (0600). */
const SPILL_FILE_MODE = 0o600;

/**
 * Kiểm một giá trị đã bắt được xem có đúng mã lỗi hệ thống của Node không.
 * Nhận: giá trị đã bắt (bất kỳ) và mã lỗi mong đợi (ví dụ `ENOENT`).
 * Trả: `true` khi đó là `Error` mang đúng `code`.
 */
export function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && (error as { code?: unknown }).code === code;
}

/** Gốc tràn riêng của tiến trình — tạo LƯỜI đúng một lần rồi dùng lại. */
let defaultRoot: string | undefined;

/**
 * Trả gốc tràn riêng theo tiến trình, tạo lười trong thư mục tạm của hệ điều hành.
 * Nhận: không.
 * Trả: đường dẫn gốc riêng (đã tồn tại, quyền 0700 do `mkdtemp` cấp).
 */
export function privateRoot(): string {
  defaultRoot ??= mkdtempSync(join(tmpdir(), DEFAULT_ROOT_PREFIX));
  return defaultRoot;
}

/**
 * Mã hoá một chuỗi bất kỳ thành MỘT đoạn đường dẫn an toàn, ĐƠN ÁNH trên toàn bộ chuỗi JS (UTF-16).
 * Id phiên / tên gợi ý là dữ liệu KHÔNG tin cậy, nên hàm này vô hiệu hoá `../`, đường dẫn tuyệt đối,
 * NUL và dấu phân cách trước mọi lượt chạm hệ tệp. Mỗi đơn vị mã được giữ nguyên văn
 * (`[A-Za-z0-9._-]`, trừ `~`) hoặc escape thành `~XXXX`; `~` cũng bị escape nên ánh xạ đảo được và
 * hai đầu vào khác nhau không bao giờ đụng nhau. Hai token nguyên-đoạn `.`/`..` bị escape nên không
 * thể leo thang. Chuỗi rỗng mã hoá thành `~` (không bao giờ là đoạn rỗng).
 *
 * @param raw Văn bản không tin cậy.
 * @returns Một đoạn đường dẫn an toàn, đơn ánh.
 */
export function encodeSegment(raw: string): string {
  if (raw.length === 0) return "~";
  if (raw === ".") return "~002E";
  if (raw === "..") return "~002E~002E";
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    const ch = String.fromCharCode(code);
    out += ch !== "~" && /^[A-Za-z0-9._-]$/.test(ch) ? ch : "~" + code.toString(16).toUpperCase().padStart(4, "0");
  }
  return out;
}

/**
 * Suy thư mục ổn định theo phiên dưới một gốc tràn.
 * Nhận: gốc tràn và id phiên sở hữu.
 * Trả: thư mục `session-<12 hex>` — 12 ký tự đầu của `sha256(id phiên)`.
 */
export function sessionDir(root: string, sessionId: string): string {
  return join(root, `session-${createHash("sha256").update(sessionId).digest("hex").slice(0, 12)}`);
}

/** Đầu vào cần để ghi một tệp tràn cục bộ. */
export interface SaveTextOptions {
  /** Gốc tràn. */
  root: string;
  /** Id phiên sở hữu. */
  sessionId: string;
  /** Tên tệp do bên gọi gợi ý (chỉ là gợi ý, không bao giờ là đường dẫn). */
  suggestedName: string;
  /** Toàn văn cần lưu. */
  content: string;
}

/** Một tệp tràn đã ghi. */
export interface SavedText {
  /** Đường dẫn tuyệt đối đã lưu. */
  path: string;
  /** Độ dài nội dung tính theo BYTE UTF-8. */
  bytes: number;
}

/**
 * Tạo thư mục phiên rồi mở một tệp MỚI độc quyền (wx, 0600) — thử lại khi thư mục vừa bị lượt dọn
 * khác gỡ mất giữa `mkdir` và `open`.
 * Nhận: thư mục phiên và đường dẫn tệp đích.
 * Trả: handle đã mở độc quyền; ném lại mọi lỗi khác `ENOENT`.
 */
async function openFresh(dir: string, path: string): Promise<FileHandle> {
  for (;;) {
    await mkdir(dir, { recursive: true, mode: SESSION_DIR_MODE });
    try {
      return await open(path, "wx", SPILL_FILE_MODE);
    } catch (error) {
      if (isErrno(error, "ENOENT")) continue;
      throw error;
    }
  }
}

/**
 * Ghi văn bản vào một tệp 0600 MỚI dưới thư mục phiên riêng của nó.
 * Tên tệp là tiền tố ngẫu nhiên 6 byte + đoạn đã mã hoá của `suggestedName`, nên KHÔNG BAO GIỜ trùng
 * tên bên gọi gợi ý và không thể trỏ ra ngoài thư mục phiên.
 * Nhận: yêu cầu lưu (gốc · id phiên · tên gợi ý · toàn văn).
 * Trả: đường dẫn đã lưu và độ dài UTF-8 theo byte; ném khi hệ tệp từ chối (quyền, ENOSPC…).
 */
export async function saveTextFile(options: SaveTextOptions): Promise<SavedText> {
  const dir = sessionDir(options.root, options.sessionId);
  const path = join(dir, `${randomBytes(6).toString("hex")}-${encodeSegment(options.suggestedName)}`);
  const handle = await openFresh(dir, path);
  try {
    await handle.writeFile(options.content);
  } finally {
    await handle.close();
  }
  return {
    path,
    bytes: Buffer.byteLength(options.content, "utf8"),
  };
}
