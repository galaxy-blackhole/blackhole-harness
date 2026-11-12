/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Lõi parity:trace — ghi HTTP/WS hai bên, chuẩn hoá (bỏ token/id/thời gian) và diff theo route/frame
 */

import { createHash } from "node:crypto";
import type { Page, WebSocket } from "playwright-core";

import { maskString } from "./dump-core.ts";

/** Một bản ghi HTTP đã chuẩn hoá. */
export interface HttpRecord {
  /** Thời điểm so với lúc mở trang (ms). */
  at: number;
  /** Phương thức. */
  method: string;
  /** Đường dẫn đã chuẩn hoá (bỏ query, thay id động). */
  path: string;
  /** Mã trạng thái. */
  status: number;
  /** Loại tài nguyên theo Playwright. */
  resourceType: string;
  /** Thời gian xử lý (ms). */
  durationMs: number;
  /** Số byte thân phản hồi theo header `content-length` (số SAU nén nếu có nén). */
  bytes: number;
  /** Giá trị `content-encoding` (`gzip`/`br`/rỗng). */
  encoding: string;
  /** `content-type` của phản hồi (để biết có thuộc nhóm nén được không). */
  contentType: string;
  /** `accept-encoding` mà client đã gửi (điều kiện thứ ba của phép so nén). */
  acceptEncoding: string;
  /** Khoá so sánh `METHOD path status`. */
  key: string;
}

/** Bằng chứng về tài liệu HTML gốc của một bên. */
export interface DocumentEvidence {
  /** Số byte theo `content-length`. */
  bytes: number;
  /** Encoding phản hồi. */
  encoding: string;
}

/** Một frame WebSocket đã chuẩn hoá. */
export interface WsRecord {
  /** Thời điểm so với lúc mở trang (ms). */
  at: number;
  /** Chiều: `sent` (client → host) hoặc `received`. */
  dir: "sent" | "received";
  /** Loại frame suy ra từ payload (`type`/`method`/`rpc`…). */
  kind: string;
  /** Chữ ký cấu trúc payload (khoá đã sắp xếp, 3 mức). */
  shape: string;
  /** Số byte. */
  bytes: number;
  /** Khoá so sánh `dir kind`. */
  key: string;
}

/** Kết quả phần kịch bản (tạo session, gửi prompt, chờ trả lời). */
export interface ScenarioResult {
  /** true khi mở được trang chủ. */
  opened: boolean;
  /** true khi bấm được nút tạo session mới. */
  sessionCreated: boolean;
  /** true khi gõ được prompt và gửi. */
  promptSent: boolean;
  /** Thời gian tới token trả lời đầu tiên (ms), null nếu không có. */
  firstResponseMs: number | null;
  /** Dấu vân tay ngắn của id session (không lưu id thô). */
  sessionFingerprint: string | null;
  /** Số token báo cáo trong frame (nếu bắt được). */
  tokenUsage: { input: number; output: number; total: number } | null;
  /** Ghi chú thêm. */
  note?: string;
}

/** Toàn bộ một lần ghi trace của một bên. */
export interface SideTrace {
  /** Khoá bên (`ours`/`ref`). */
  side: string;
  /** URL đã mở. */
  url: string;
  /** Cổng. */
  port: number;
  /** Bản ghi HTTP. */
  http: HttpRecord[];
  /** Bản ghi WS. */
  ws: WsRecord[];
  /** Kết quả kịch bản. */
  scenario: ScenarioResult;
}

/** Một khác biệt ở một khoá của trace. */
export interface TraceDelta {
  /** Khoá (`METHOD path status` hoặc `dir kind`). */
  key: string;
  /** Số lần bên ref. */
  ref: number;
  /** Số lần bên ta. */
  ours: number;
}

/** Kết quả diff hai trace. */
export interface TraceDiff {
  /** Route chỉ có ở ta. */
  httpAdded: string[];
  /** Route chỉ có ở ref. */
  httpMissing: string[];
  /** Route đổi số lần gọi. */
  httpChanged: TraceDelta[];
  /** Frame chỉ có ở ta. */
  wsAdded: string[];
  /** Frame chỉ có ở ref. */
  wsMissing: string[];
  /** Frame đổi số lần. */
  wsChanged: TraceDelta[];
  /** Số route HTTP giống nhau. */
  httpSame: number;
  /** Số frame WS giống nhau. */
  wsSame: number;
}

/** Thời gian tối đa chờ token trả lời đầu tiên. */
export const FIRST_RESPONSE_TIMEOUT_MS = 90_000;

/**
 * Chuẩn hoá một URL thành đường dẫn tĩnh: bỏ query, thay id động bằng `<id>`.
 * @param rawUrl URL đầy đủ.
 * @returns đường dẫn đã chuẩn hoá.
 */
export function normalisePath(rawUrl: string): string {
  let path: string;
  try {
    path = new URL(rawUrl).pathname;
  } catch {
    path = rawUrl.split("?")[0] ?? rawUrl;
  }
  return maskDynamicIds(path, []);
}

/**
 * Thay các id động (uuid, hex dài, số dài) bằng `<id>`; đồng thời che secret nếu có.
 * @param value chuỗi cần chuẩn hoá.
 * @param paths tiền tố đường dẫn cần che.
 * @returns chuỗi đã chuẩn hoá.
 */
export function maskDynamicIds(value: string, paths: readonly string[]): string {
  const parts = value.split("/");
  const masked = parts.map((part) => {
    const plain = part.split("?")[0] ?? part;
    if (plain.length >= 16 && looksLikeId(plain)) return "<id>";
    return part;
  });
  return maskString(masked.join("/"), paths);
}

/**
 * Đoán một đoạn có phải id động (uuid/hex/chuỗi ngẫu nhiên) hay không.
 * @param value đoạn cần kiểm tra.
 * @returns true nếu giống id động.
 */
export function looksLikeId(value: string): boolean {
  let digits = 0;
  for (const char of value) {
    const isDigit = char >= "0" && char <= "9";
    const isHex = (char >= "a" && char <= "f") || (char >= "A" && char <= "F");
    const isDash = char === "-";
    if (!isDigit && !isHex && !isDash) return false;
    if (isDigit) digits += 1;
  }
  return digits >= 2;
}

/**
 * Bóc `kind` của một frame WS từ payload JSON.
 * @param payload nội dung frame.
 * @returns tên loại frame.
 */
export function frameKind(payload: string): string {
  if (payload === "") return "<empty>";
  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      for (const field of ["type", "method", "kind", "event", "rpc", "op"]) {
        const value = record[field];
        if (typeof value === "string" && value.length > 0) return field + "=" + value;
      }
      return "json:" + Object.keys(record).sort().join(",");
    }
    return Array.isArray(parsed) ? "array" : "json:scalar";
  } catch {
    return "text:" + (payload.slice(0, 24).replaceAll("\n", " "));
  }
}

/**
 * Chữ ký cấu trúc của một payload (khoá đã sắp xếp, tối đa 3 mức).
 * @param payload nội dung frame.
 * @param depth độ sâu hiện tại.
 * @returns chữ ký cấu trúc.
 */
export function payloadShape(payload: string, depth = 0): string {
  if (depth > 2) return "…";
  try {
    const parsed: unknown = JSON.parse(payload);
    return shapeOf(parsed, depth);
  } catch {
    return "text";
  }
}

/**
 * Chữ ký cấu trúc của một giá trị JS.
 * @param value giá trị cần lấy chữ ký.
 * @param depth độ sâu hiện tại.
 * @returns chữ ký dạng chuỗi.
 */
export function shapeOf(value: unknown, depth: number): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "[" + (value.length === 0 ? "" : shapeOf(value[0], depth + 1)) + "]";
  if (typeof value === "object") {
    if (depth > 2) return "{}";
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return "{" + keys.map((key) => key + ":" + shapeOf((value as Record<string, unknown>)[key], depth + 1)).join(",") + "}";
  }
  return typeof value;
}

/**
 * Lấy số token từ payload nếu frame có báo usage.
 * @param payload nội dung frame.
 * @returns số token, hoặc null.
 */
export function extractTokenUsage(payload: string): { input: number; output: number; total: number } | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    return findUsage(parsed);
  } catch {
    return null;
  }
}

/**
 * Duyệt một giá trị để tìm đối tượng usage có số token.
 * @param value giá trị cần duyệt.
 * @param depth độ sâu hiện tại.
 * @returns số token, hoặc null.
 */
export function findUsage(value: unknown, depth = 0): { input: number; output: number; total: number } | null {
  if (depth > 6 || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUsage(item, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  const input = pickNumber(record, ["inputTokens", "input_tokens", "promptTokens", "prompt_tokens"]);
  const output = pickNumber(record, ["outputTokens", "output_tokens", "completionTokens", "completion_tokens"]);
  const total = pickNumber(record, ["totalTokens", "total_tokens"]);
  if (input !== null || output !== null || total !== null) {
    const inValue = input ?? 0;
    const outValue = output ?? 0;
    return { input: inValue, output: outValue, total: total ?? inValue + outValue };
  }
  for (const key of Object.keys(record)) {
    const found = findUsage(record[key], depth + 1);
    if (found !== null) return found;
  }
  return null;
}

/**
 * Lấy một trường số theo nhiều tên có thể.
 * @param record đối tượng nguồn.
 * @param names các tên trường.
 * @returns số, hoặc null.
 */
export function pickNumber(record: Record<string, unknown>, names: readonly string[]): number | null {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

/**
 * Gắn bộ thu vào một trang Playwright: HTTP request/response + mọi frame WebSocket.
 * @param page trang cần theo dõi.
 * @param options `paths` để che đường dẫn nhạy cảm; `onUsage` nhận số token khi bắt được.
 * @returns bộ đệm ghi được và hàm lấy kết quả.
 */
export function attachRecorder(
  page: Page,
  options: {
    paths?: readonly string[];
    onUsage?: (usage: { input: number; output: number; total: number }) => void;
    onFrame?: (payload: string, dir: "sent" | "received") => void;
  } = {},
): { http: HttpRecord[]; ws: WsRecord[] } {
  const paths = options.paths ?? [];
  const http: HttpRecord[] = [];
  const ws: WsRecord[] = [];
  const startedAt = Date.now();
  const pending = new Map<unknown, number>();

  page.on("request", (request) => {
    pending.set(request, Date.now() - startedAt);
  });
  page.on("response", (response) => {
    const request = response.request();
    const at = pending.get(request) ?? Date.now() - startedAt;
    pending.delete(request);
    const path = normalisePath(response.url());
    const headers = response.headers();
    const rawLength = headers["content-length"];
    http.push({
      at,
      method: request.method(),
      path,
      status: response.status(),
      resourceType: request.resourceType(),
      durationMs: Math.max(0, Date.now() - startedAt - at),
      bytes: rawLength === undefined ? 0 : Number(rawLength) || 0,
      encoding: headers["content-encoding"] ?? "",
      contentType: headers["content-type"] ?? "",
      acceptEncoding: request.headers()["accept-encoding"] ?? "",
      key: request.method() + " " + path + " " + String(response.status()),
    });
  });
  page.on("websocket", (socket: WebSocket) => {
    socket.on("framesent", (frame) => {
      const payload = typeof frame.payload === "string" ? frame.payload : frame.payload.toString("utf8");
      recordFrame(ws, payload, "sent", startedAt, options.onUsage);
      options.onFrame?.(payload, "sent");
    });
    socket.on("framereceived", (frame) => {
      const payload = typeof frame.payload === "string" ? frame.payload : frame.payload.toString("utf8");
      recordFrame(ws, payload, "received", startedAt, options.onUsage);
      options.onFrame?.(payload, "received");
    });
  });
  return { http, ws };
}

/**
 * Ghi một frame vào bộ đệm, có bóc token usage nếu có.
 * @param ws bộ đệm frame.
 * @param payload nội dung frame.
 * @param dir chiều frame.
 * @param startedAt mốc bắt đầu.
 * @param onUsage callback nhận số token.
 * @returns không trả gì.
 */
export function recordFrame(
  ws: WsRecord[],
  payload: string,
  dir: "sent" | "received",
  startedAt: number,
  onUsage?: (usage: { input: number; output: number; total: number }) => void,
): void {
  const kind = frameKind(payload);
  ws.push({
    at: Date.now() - startedAt,
    dir,
    kind,
    shape: payloadShape(payload),
    bytes: payload.length,
    key: dir + " " + kind,
  });
  if (onUsage !== undefined) {
    const usage = extractTokenUsage(payload);
    if (usage !== null) onUsage(usage);
  }
}

/**
 * Tìm id phiên trong một frame và trả về dấu vân tay ngắn (không lưu id thô).
 * @param payload nội dung frame.
 * @returns dấu vân tay 10 ký tự, hoặc null.
 */
export function extractSessionFingerprint(payload: string): string | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    const id = findSessionId(parsed, 0);
    if (id === null) return null;
    return createHash("sha256").update(id).digest("hex").slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * Duyệt một giá trị để tìm trường id phiên.
 * @param value giá trị cần duyệt.
 * @param depth độ sâu hiện tại.
 * @returns id thô, hoặc null.
 */
export function findSessionId(value: unknown, depth: number): string | null {
  if (depth > 6 || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSessionId(item, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["sessionId", "session_id", "session"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.length >= 16) return candidate;
  }
  for (const key of Object.keys(record)) {
    const found = findSessionId(record[key], depth + 1);
    if (found !== null) return found;
  }
  return null;
}

/**
 * Lấy bằng chứng về phản hồi tài liệu gốc (`GET /` 200) — dùng để so kích thước + nén.
 * @param trace trace của một bên.
 * @returns số byte + encoding, hoặc null nếu không thấy.
 */
export function documentEvidence(trace: SideTrace): DocumentEvidence | null {
  const record = trace.http.find(
    (item) => item.method === "GET" && item.path === "/" && item.status === 200 && item.resourceType === "document",
  );
  if (record === undefined) return null;
  return { bytes: record.bytes, encoding: record.encoding };
}

/**
 * Tìm các route cùng khoá nhưng KHÁC encoding giữa hai bên (bắt lỗi nén im lặng không chạy).
 * @param ref trace bên ref.
 * @param ours trace bên ta.
 * @returns danh sách mô tả `route: encRef → encOurs`.
 */
export function encodingMismatches(ref: SideTrace, ours: SideTrace): string[] {
  const refByKey = new Map(ref.http.map((record) => [record.key, record]));
  const mismatches: string[] = [];
  for (const record of ours.http) {
    const other = refByKey.get(record.key);
    if (other === undefined) continue;
    if (other.encoding === record.encoding) continue;
    if (!compressionComparable(other, record)) continue;
    mismatches.push(
      record.key + " (" + String(record.bytes) + " B, " + record.contentType.split(";")[0] + "): " +
        (other.encoding === "" ? "(không nén)" : other.encoding) + " → " + (record.encoding === "" ? "(không nén)" : record.encoding),
    );
  }
  return [...new Set(mismatches)];
}

/** Ngưỡng nén của webserver (byte) — phản hồi nhỏ hơn ngưỡng KHÔNG nén là hành vi đúng. */
export const COMPRESSION_THRESHOLD_BYTES = 1024;

/**
 * Kiểm tra một cặp phản hồi có ĐỦ ĐIỀU KIỆN để kết luận về nén hay không.
 * Đủ cả ba mới kết luận: (1) ≥ ngưỡng nén, (2) content-type nén được, (3) client có gửi accept-encoding.
 * @param ref phản hồi bên ref.
 * @param ours phản hồi bên ta.
 * @returns true khi so được.
 */
export function compressionComparable(ref: HttpRecord, ours: HttpRecord): boolean {
  const bigEnough = ref.bytes >= COMPRESSION_THRESHOLD_BYTES || ours.bytes >= COMPRESSION_THRESHOLD_BYTES;
  return bigEnough && isCompressibleType(ref.contentType) && ref.acceptEncoding.includes("gzip");
}

/**
 * Một content-type có thuộc nhóm nén được hay không.
 * @param contentType giá trị header content-type.
 * @returns true nếu nén được.
 */
export function isCompressibleType(contentType: string): boolean {
  const type = contentType.toLowerCase();
  if (type.startsWith("text/")) return true;
  return (
    type.includes("application/json") ||
    type.includes("application/javascript") ||
    type.includes("application/xml") ||
    type.includes("image/svg+xml")
  );
}

/** Kết quả phép đo thô tài liệu HTML (có/không nén). */
export interface DocumentProbe {
  /** Số byte khi xin bản KHÔNG nén. */
  identityBytes: number;
  /** Số byte thật trên đường truyền khi xin bản nén. */
  gzipBytes: number;
  /** `content-encoding` khi xin bản nén. */
  gzipEncoding: string;
  /** Hai byte đầu của bản nén (\`1f8b\` = magic gzip). */
  magic: string;
  /** Tỉ lệ nén (0..1). */
  ratio: number;
}

/**
 * Gọi THẲNG một URL bằng HTTP thô để đo kích thước thật + magic bytes (fetch tự giải nén nên không dùng được).
 * @param url URL cần gọi.
 * @param cookie giá trị header Cookie (nếu có).
 * @param acceptEncoding giá trị accept-encoding.
 * @returns mã trạng thái, header và thân phản hồi thô.
 */
export async function rawGet(
  url: string,
  cookie: string | null,
  acceptEncoding: string,
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  const { request } = await import("node:http");
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const headers: Record<string, string> = { "accept-encoding": acceptEncoding };
    if (cookie !== null) headers.cookie = cookie;
    const req = request(
      { hostname: target.hostname, port: target.port, path: target.pathname + target.search, method: "GET", headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const flat: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === "string") flat[key] = value;
            else if (Array.isArray(value)) flat[key] = value.join(", ");
          }
          resolve({ status: res.statusCode ?? 0, headers: flat, body: Buffer.concat(chunks) });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Đo tài liệu HTML của một bên: không nén vs nén, kèm magic bytes.
 * @param url URL trang chủ.
 * @param cookie header Cookie (nếu có).
 * @returns số đo, hoặc null nếu không gọi được.
 */
export async function probeDocument(url: string, cookie: string | null): Promise<DocumentProbe | null> {
  try {
    const identity = await rawGet(url, cookie, "identity");
    const gzipped = await rawGet(url, cookie, "gzip");
    if (identity.status >= 400 || gzipped.status >= 400) return null;
    const magic = gzipped.body.subarray(0, 2).toString("hex");
    return {
      identityBytes: identity.body.length,
      gzipBytes: gzipped.body.length,
      gzipEncoding: gzipped.headers["content-encoding"] ?? "",
      magic,
      ratio: identity.body.length === 0 ? 0 : gzipped.body.length / identity.body.length,
    };
  } catch {
    return null;
  }
}

/**
 * Đếm số lần xuất hiện của từng khoá trong một danh sách.
 * @param keys danh sách khoá.
 * @returns bảng đếm.
 */
export function countKeys(keys: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/**
 * Diff hai danh sách khoá theo số lần xuất hiện.
 * @param refKeys khoá bên ref.
 * @param oursKeys khoá bên ta.
 * @returns THÊM / THIẾU / ĐỔI.
 */
export function diffKeys(refKeys: readonly string[], oursKeys: readonly string[]): { added: string[]; missing: string[]; changed: TraceDelta[]; same: number } {
  const ref = countKeys(refKeys);
  const ours = countKeys(oursKeys);
  const added: string[] = [];
  const missing: string[] = [];
  const changed: TraceDelta[] = [];
  let same = 0;
  for (const [key, count] of ours) {
    const other = ref.get(key);
    if (other === undefined) {
      added.push(key + " ×" + String(count));
      continue;
    }
    if (other === count) {
      same += 1;
      continue;
    }
    changed.push({ key, ref: other, ours: count });
  }
  for (const [key, count] of ref) if (!ours.has(key)) missing.push(key + " ×" + String(count));
  added.sort();
  missing.sort();
  changed.sort((left, right) => left.key.localeCompare(right.key));
  return { added, missing, changed, same };
}

/**
 * Diff hai trace theo route HTTP và frame WS.
 * @param ref trace bên ref.
 * @param ours trace bên ta.
 * @returns kết quả diff.
 */
export function diffTraces(ref: SideTrace, ours: SideTrace): TraceDiff {
  const http = diffKeys(ref.http.map((record) => record.key), ours.http.map((record) => record.key));
  const ws = diffKeys(ref.ws.map((frame) => frame.key), ours.ws.map((frame) => frame.key));
  return {
    httpAdded: http.added,
    httpMissing: http.missing,
    httpChanged: http.changed,
    httpSame: http.same,
    wsAdded: ws.added,
    wsMissing: ws.missing,
    wsChanged: ws.changed,
    wsSame: ws.same,
  };
}

/**
 * Bảng tần suất frame WS theo chiều để so nhanh.
 * @param frames danh sách frame.
 * @returns chuỗi `sent N · received M`.
 */
export function frameBalance(frames: readonly WsRecord[]): string {
  const sent = frames.filter((frame) => frame.dir === "sent").length;
  return "sent " + String(sent) + " · received " + String(frames.length - sent);
}
