/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa HOST của session-log-export: tuần tự hoá log canonical, đọc qua tay nắm lưu bền, và phát
 *      MỘT ZIP theo luồng (fflate) gồm log gốc + mọi subagent + ảnh/tệp được tham chiếu — port 1:1
 *      lib/index.js của @deepseek-ai/dsh-session-log-export (vùng lib/types/archive.js)
 */

import { Zip, ZipDeflate } from "fflate";
import { SESSION_FORMAT_VERSION } from "@deepseek-ai/dsh-session";
import { sessionFormatLogFilename } from "@deepseek-ai/dsh-session-format";
import { SessionPersistenceNotFoundError } from "@deepseek-ai/dsh-session-persistence";
import type { Context } from "@deepseek-ai/cordis";
import type { AttachmentStore, FileAttachmentRef, ImageAttachmentRef, StoredImageAttachment } from "@deepseek-ai/dsh-attachment";
import type { SessionEvent, SessionHeader, SessionId, SessionStore } from "@deepseek-ai/dsh-session";
import type { SessionPersistence } from "@deepseek-ai/dsh-session-persistence";
import type { SessionQueryEngine } from "@deepseek-ai/dsh-session-query";
import type { SessionLogCompressionLevel, SessionLogExportDeps, SessionLogExportReady, SessionLogZipEntry } from "./types.ts";

/** Mức nén cân bằng dùng khi cấu hình xuất phiên không nêu mức nén. */
export const DEFAULT_SESSION_LOG_COMPRESSION_LEVEL: SessionLogCompressionLevel = 6;

/**
 * Lấy các dịch vụ mà một lần xuất log cần từ context đã hợp thành.
 * Nhận: ctx — context host đã hợp thành.
 * Trả: bộ dịch vụ (vắng mặt khi bản triển khai không mount chúng).
 */
export function sessionLogExportDeps(ctx: Context): SessionLogExportDeps {
  /** Đọc service theo tên; cordis trả undefined khi chưa có plugin nào cấp. */
  const pick = (name: string): unknown => (ctx.get as (key: string) => unknown)(name);
  return {
    sessionQuery: pick("sessionQuery") as SessionQueryEngine | undefined,
    sessionPersistence: pick("sessionPersistence") as SessionPersistence | undefined,
    attachments: pick("attachments") as AttachmentStore | undefined,
    sessions: pick("sessions") as SessionStore | undefined,
  };
}

/**
 * Flush một phiên ĐANG SỐNG qua hàng rào bền vững của sổ ngay TRƯỚC khi đọc log logic của nó.
 * Phiên nguội hoặc id không tồn tại thì không có việc gì trong bộ nhớ để flush.
 * Nhận: deps — bộ dịch vụ xuất, gồm sổ phiên sống tuỳ chọn; id — phiên sắp đọc; signal — huỷ tuỳ chọn.
 * Trả: không (Promise hoàn tất khi flush xong).
 */
export async function flushLiveSessionLog(deps: Pick<SessionLogExportDeps, "sessions">, id: SessionId, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const sessions = deps.sessions;
  if (sessions === void 0) return;
  const session = sessions.get(id);
  if (session === void 0) return;
  await sessions.flush(session);
  signal?.throwIfAborted();
}

/** Tên tệp cơ sở canonical của thế hệ hiện tại cho MỌI log phiên được xuất. */
export const SESSION_LOG_FILENAME = sessionFormatLogFilename(SESSION_FORMAT_VERSION);

/**
 * Tuần tự hoá log logic của MỘT phiên thành văn bản JSONL canonical: dòng đầu phiên, rồi mỗi sự kiện
 * một dòng, kèm một ký tự xuống dòng ở cuối.
 * Nhận: header — dòng đầu phiên bất biến; events — các sự kiện đã kiểm, theo thứ tự seq.
 * Trả: văn bản JSONL.
 */
export function serializeSessionLog(header: SessionHeader, events: readonly SessionEvent[]): string {
  const lines = [JSON.stringify({
    type: "session",
    version: header.version,
    id: header.id,
    createdAt: header.createdAt,
    ...header.cwd !== void 0 ? { cwd: header.cwd } : {},
    ...header.parentSession !== void 0 ? { parentSession: header.parentSession } : {},
    isSeeded: header.isSeeded,
    ...header.origin !== void 0 ? { origin: header.origin } : {},
    delegationDepth: header.delegationDepth ?? 0,
    ...header.agentPreset !== void 0 ? { agentPreset: header.agentPreset } : {},
  })];
  for (const event of events) lines.push(JSON.stringify(event));
  return lines.join(String.fromCharCode(10)) + String.fromCharCode(10);
}

/**
 * Nhan dien loi "khong tim thay phien" BAT KE lop den tu dau.
 * Vi sao (01/11/2026): goi cua ta import peer `@deepseek-ai/dsh-session-persistence`; trong test/
 * workspace specifier nay phan giai ve MOT BAN SAO khac kernel (`apps/host/node_modules`) nen
 * `instanceof` truot ⇒ ham nem loi thay vi tra `undefined`. Kiem ca TEN LOP va MA LOI.
 * Nhan: error - gia tri bat duoc. Tra: true khi la loi NotFound cua kho luu ben.
 */
function isPersistenceNotFound(error: unknown): boolean {
  if (error instanceof SessionPersistenceNotFoundError) return true;
  if (!(error instanceof Error)) return false;
  const name = (error as { name?: string }).name ?? "";
  const code = String((error as { code?: unknown }).code ?? "");
  return name === "SessionPersistenceNotFoundError" || code === "SESSION_NOT_FOUND";
}

/**
 * Đọc log logic hoàn chỉnh của một phiên qua tay nắm đọc và tuần tự hoá nó. Phép đọc chỉ thấy log
 * ĐÃ COMMIT — kho lưu bền không bao giờ trả đuôi bị rách — và một tay nắm đọc sau khi flush đã xong
 * thấy ÍT NHẤT tiền tố đã flush.
 * Nhận: persistence — backend lưu bền đã mount; id — phiên cần đọc; signal — huỷ tuỳ chọn.
 * Trả: văn bản JSONL đã tuần tự hoá, hoặc undefined khi phiên không tồn tại.
 */
export async function readSessionLogText(persistence: SessionPersistence, id: SessionId, signal?: AbortSignal): Promise<string | undefined> {
  const options = signal === void 0 ? {} : { signal };
  let handle;
  try {
    handle = await persistence.open(id, "read", options);
  } catch (error) {
    if (isPersistenceNotFound(error)) return void 0;
    throw error;
  }
  try {
    const { events } = await handle.read(0, void 0, options);
    return serializeSessionLog(handle.header, events);
  } finally {
    await handle.close();
  }
}

/** Đuôi tệp trong ZIP cho mỗi loại ảnh raster được nhận. */
const MEDIA_TYPE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Đường dẫn trong ZIP của MỘT đối tượng ảnh: đặt địa chỉ theo nội dung bằng id đính kèm đục, nhờ vậy
 * ảnh dùng chung chỉ vào một lần và id trong log ánh xạ ngược lại mục trong ZIP mà không cần manifest.
 * Nhận: ref — tham chiếu bền đọc từ log phiên.
 * Trả: đường dẫn trong ZIP.
 */
function mediaEntryPath(ref: ImageAttachmentRef): string {
  return `media/${String(ref.attachmentId)}.${MEDIA_TYPE_EXTENSIONS[ref.mediaType]}`;
}

/**
 * Đường dẫn trong ZIP giữ nguyên digest và tên của MỘT tham chiếu tệp đã lưu.
 * Nhận: ref — tham chiếu tệp bền đọc từ log phiên.
 * Trả: đường dẫn trong ZIP (tên đã làm sạch ký tự điều khiển và dấu phân cách).
 */
function fileEntryPath(ref: FileAttachmentRef): string {
  const digest = String(ref.attachmentId).replace(/^sha256:/u, "");
  const name = ref.name.replace(/[\\/\u0000-\u001f\u007f]/gu, "_");
  const safeName = name === "." || name === ".." || name === "" ? "file" : name;
  return `files/${digest.slice(0, 2)}/${digest}/${safeName}`;
}

/** Một khối nội dung V4 (chỉ những trường phép thu thập đọc). */
interface ContentBlock {
  /** Loại khối (image · file · …). */
  readonly type?: string;
  /** Tham chiếu đính kèm của khối. */
  readonly attachment?: unknown;
}

/**
 * Thu thập các khối đính kèm TRỰC TIẾP từ một mảng nội dung V4 đã khai.
 * Nhận: content — mảng nội dung của sự kiện hoặc tin nhắn; images — bản đồ khử trùng theo id đính kèm;
 *        files — bản đồ khử trùng theo id đính kèm và tên đã lưu.
 * Trả: không — hai bản đồ được cập nhật tại chỗ.
 */
function collectAttachmentRefs(content: unknown, images: Map<string, ImageAttachmentRef>, files: Map<string, FileAttachmentRef>): void {
  if (!Array.isArray(content)) return;
  for (const value of content) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const block = value as ContentBlock;
    if (block.type === "image" && typeof block.attachment === "object" && block.attachment !== null) {
      const ref = block.attachment as ImageAttachmentRef;
      images.set(String(ref.attachmentId), ref);
    }
    if (block.type === "file" && typeof block.attachment === "object" && block.attachment !== null) {
      const ref = block.attachment as FileAttachmentRef;
      files.set(String(ref.attachmentId) + String.fromCharCode(0) + ref.name, ref);
    }
  }
}

/** Thân dữ liệu của một sự kiện (chỉ những trường phép thu thập đọc). */
interface EventData {
  /** Nội dung của tin nhắn người dùng / ptc-dispatch. */
  readonly content?: unknown;
  /** Tin nhắn mang nội dung (system · developer · tool-result · team-message). */
  readonly message?: { readonly content?: unknown };
  /** Các tin nhắn được chèn vào hộp thư agent. */
  readonly inserted?: unknown;
  /** Bản tóm tắt nén. */
  readonly summary?: unknown;
  /** Kết quả thô của lần nén. */
  readonly rawOutput?: unknown;
  /** Dòng sự kiện của lượt trợ lý. */
  readonly stream?: readonly StreamRecord[];
}

/** Một bản ghi trong dòng sự kiện của lượt trợ lý. */
interface StreamRecord {
  /** Loại bản ghi. */
  readonly type?: string;
  /** Khối của bản ghi. */
  readonly chunk?: { readonly type?: string; readonly block?: unknown };
}

/**
 * Thu thập tham chiếu CHỈ từ những trường nội dung hạng nhất đã khai và các khối Trợ lý ĐÃ HOÀN TẤT.
 * Sự kiện lạ và trường thân không liên quan vẫn là đục (không suy diễn).
 * Nhận: event — một đối tượng sự kiện JSONL đã parse; images/files — hai bản đồ khử trùng.
 * Trả: không — hai bản đồ được cập nhật tại chỗ.
 */
function collectEventAttachmentRefs(event: unknown, images: Map<string, ImageAttachmentRef>, files: Map<string, FileAttachmentRef>): void {
  if (typeof event !== "object" || event === null || Array.isArray(event)) return;
  const row = event as { readonly type?: string; readonly data?: unknown };
  const data = row.data;
  if (typeof data !== "object" || data === null) return;
  const carrier = data as EventData;
  switch (row.type) {
    case "user/message":
    case "tool/ptc-dispatch":
      collectAttachmentRefs(carrier.content, images, files);
      return;
    case "system/message":
    case "developer/message":
    case "tool/result":
    case "team/message/queued":
      collectAttachmentRefs(carrier.message?.content, images, files);
      return;
    case "agent/inbox/spliced": {
      const messages = carrier.inserted;
      if (!Array.isArray(messages)) return;
      for (const message of messages) {
        if (typeof message !== "object" || message === null || Array.isArray(message)) continue;
        collectAttachmentRefs((message as { readonly content?: unknown }).content, images, files);
      }
      return;
    }
    case "compaction/summary":
      collectAttachmentRefs(carrier.summary, images, files);
      collectAttachmentRefs(carrier.rawOutput, images, files);
      return;
    case "assistant/message":
      collectAttachmentRefs(carrier.message?.content, images, files);
      break;
    case "assistant/attempt":
      break;
    default:
      return;
  }
  if (carrier.stream !== void 0) {
    for (const record of carrier.stream) {
      if (record.type === "chunk" && record.chunk?.type === "block-end") collectAttachmentRefs([record.chunk.block], images, files);
    }
  }
}

/**
 * Thu thập các tham chiếu đính kèm PHÂN BIỆT mà một văn bản artifact đã lưu nêu tên.
 * Dòng không parse được thì không thể tham chiếu đính kèm và bị bỏ qua (chính văn bản artifact vẫn
 * được xuất nguyên văn).
 * Nhận: content — văn bản artifact đã lưu.
 * Trả: hai bản đồ khử trùng ảnh và tệp.
 */
function attachmentRefsInArtifact(content: string): { images: Map<string, ImageAttachmentRef>; files: Map<string, FileAttachmentRef> } {
  const images = new Map<string, ImageAttachmentRef>();
  const files = new Map<string, FileAttachmentRef>();
  for (const line of content.split(String.fromCharCode(10))) {
    if (line === "") continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    collectEventAttachmentRefs(event, images, files);
  }
  return { images, files };
}

/**
 * Một đoạn đường dẫn ZIP AN TOÀN từ id phiên không tin cậy. Id phiên do host cấp, nhưng chuỗi brand
 * cho phép chuỗi bất kỳ, nên "../", đoạn chấm và dấu phân cách bị trung hoà trước khi chúng định hình
 * mục ZIP. Hai id khác nhau có thể gộp về một đoạn (host cấp UUID nên không thể đụng, vì vậy không
 * thêm hậu tố duy nhất).
 * Nhận: id — id phiên thô.
 * Trả: một đoạn đường dẫn an toàn với hệ tệp.
 */
function safeSessionIdSegment(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * Tên tệp ZIP của một phiên gốc.
 * Nhận: sessionId — id phiên gốc (đã làm sạch thành một đoạn đường dẫn an toàn).
 * Trả: tên tệp đính kèm cho ZIP xuất của phiên.
 */
export function sessionLogZipFilename(sessionId: string): string {
  return `dsh-session-${safeSessionIdSegment(sessionId)}.zip`;
}

/** Một nút trong cây dòng dõi subagent (chỉ trường phép duyệt đọc). */
interface LineageNode {
  /** Phiên của nút. */
  readonly session: { readonly header: { readonly id: SessionId } };
  /** Các nút con. */
  readonly descendants: readonly LineageNode[];
}

/**
 * Phát các mục xuất theo thứ tự ZIP: log gốc đã nạp trước, rồi từng subagent con theo thứ tự dòng dõi
 * (mỗi phiên đang sống được flush, đọc qua tay nắm ngay trước khi phát, và bỏ đi khi bên tiêu thụ đi
 * tiếp), rồi từng đính kèm PHÂN BIỆT được log đã gồm tham chiếu. Ảnh được đọc và kiểm là đối tượng đã
 * lưu có trần kích thước; tệp chung vẫn được phát theo luồng qua bộ ghi ZIP. Host giữ tối đa một log
 * con, một ảnh và một đoạn tệp ngoài log gốc.
 * Nhận: deps — dịch vụ xuất đã mount (bên gọi đã trả 500 trước khi chạy tới đây); rootContent — log gốc
 *        đã tuần tự hoá; sessionId — id phiên gốc; includeDescendants — có gồm mọi subagent con không;
 *        signal — huỷ tuỳ chọn.
 * Trả: các mục xuất theo thứ tự ZIP.
 */
export async function* sessionLogZipEntries(
  deps: SessionLogExportReady,
  rootContent: string,
  sessionId: SessionId,
  includeDescendants: boolean,
  signal?: AbortSignal,
): AsyncGenerator<SessionLogZipEntry> {
  const media = new Map<string, ImageAttachmentRef>();
  const files = new Map<string, FileAttachmentRef>();
  /** Ghi nhớ mọi đính kèm mà một văn bản log nêu tên (hai bản đồ khử trùng dùng chung). */
  const rememberAttachments = (content: string): void => {
    const refs = attachmentRefsInArtifact(content);
    for (const [id, ref] of refs.images) media.set(id, ref);
    for (const [id, ref] of refs.files) files.set(id, ref);
  };
  rememberAttachments(rootContent);
  yield { path: SESSION_LOG_FILENAME, content: rootContent };
  if (includeDescendants) {
    const seen = new Set<string>([sessionId]);
    /** Duyệt cây dòng dõi và phát log của từng phiên CHƯA thấy. */
    const collect = async function* (nodes: readonly LineageNode[]): AsyncGenerator<SessionLogZipEntry> {
      for (const node of nodes) {
        signal?.throwIfAborted();
        const id = node.session.header.id;
        if (seen.has(id)) continue;
        seen.add(id);
        await flushLiveSessionLog(deps, id, signal);
        const content = await readSessionLogText(deps.sessionPersistence, id, signal);
        signal?.throwIfAborted();
        if (content === void 0) throw new Error(`subagent "${id}" has no stored log`);
        rememberAttachments(content);
        yield { path: `subagents/${safeSessionIdSegment(id)}/${SESSION_LOG_FILENAME}`, content };
        yield* collect(node.descendants);
      }
    };
    const lineage = await deps.sessionQuery.traceSession(sessionId, signal);
    signal?.throwIfAborted();
    yield* collect((lineage as unknown as { descendants: readonly LineageNode[] }).descendants);
  }
  for (const ref of media.values()) {
    signal?.throwIfAborted();
    const stored = (await deps.attachments.readImage(ref, signal)) as StoredImageAttachment;
    signal?.throwIfAborted();
    yield { path: mediaEntryPath(ref), data: stored.data };
  }
  for (const ref of files.values()) {
    signal?.throwIfAborted();
    yield { path: fileEntryPath(ref), chunks: deps.attachments.readFileStream(ref, signal) };
  }
}

/** Bao nhiêu đơn vị mã văn bản Session-log một lần đẩy ZIP mang (bộ nhớ mã hoá có trần). */
const PUSH_CHUNK_CODE_UNITS = 65536;
/** Bao nhiêu byte ảnh một lần đẩy ZIP mang (bộ nhớ có trần; ảnh đã bị chặn kích thước). */
const PUSH_CHUNK_BYTES = 65536;
/** Sức chứa byte mà luồng phản hồi giữ lại trước khi phần sản xuất ZIP phải đợi bên tiêu thụ kéo. */
const RESPONSE_HIGH_WATER_MARK_BYTES = 65536;

/** Một chỗ đợi của bên sản xuất, chỉ được nhả khi bên tiêu thụ kéo (pull) trả lại sức chứa. */
class ResponseCapacityGate {
  /** Hàm nhả chỗ đợi hiện tại, nếu có. */
  releasePending: (() => void) | undefined;

  /**
   * Đợi tới khi hàng đợi phản hồi còn sức chứa byte dương, hoặc bị huỷ.
   * Nhận: controller — bộ điều khiển phản hồi mà desiredSize là nguồn sức chứa;
   *        signal — tín hiệu huỷ đã gộp yêu cầu và bên tiêu thụ.
   * Trả: không (Promise hoàn tất khi có sức chứa hoặc khi huỷ).
   */
  async wait(controller: ReadableStreamDefaultController<Uint8Array>, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (controller.desiredSize === null || controller.desiredSize > 0) return;
    await new Promise<void>((resolve) => {
      /** Nhả chỗ đợi: gỡ listener huỷ rồi đánh thức bên sản xuất. */
      const release = (): void => {
        this.releasePending = void 0;
        signal.removeEventListener("abort", release);
        resolve();
      };
      this.releasePending = release;
      signal.addEventListener("abort", release, { once: true });
    });
    signal.throwIfAborted();
  }

  /**
   * Nhả chỗ đợi hiện tại của bên sản xuất sau một lần bên tiêu thụ kéo.
   * Nhận: không.
   * Trả: không.
   */
  pulled(): void {
    this.releasePending?.();
  }
}

/**
 * Đẩy byte của MỘT đối tượng ảnh vào luồng deflate theo khúc có trần, đợi sức chứa của bên tiêu thụ
 * giữa các khúc như đường artifact.
 * Nhận: deflate — luồng deflate của mục ZIP; data — byte ảnh đã lưu; controller — bộ điều khiển hàng
 *        đợi phản hồi; capacity — cổng sức chứa do pull điều khiển; signal — huỷ (ném khi bị huỷ).
 * Trả: không (Promise hoàn tất khi đẩy xong).
 */
async function pushBinaryChunks(deflate: ZipDeflate, data: Uint8Array, controller: ReadableStreamDefaultController<Uint8Array>, capacity: ResponseCapacityGate, signal: AbortSignal): Promise<void> {
  let offset = 0;
  do {
    signal.throwIfAborted();
    const end = Math.min(offset + PUSH_CHUNK_BYTES, data.byteLength);
    const finalChunk = end >= data.byteLength;
    deflate.push(data.subarray(offset, end), finalChunk);
    offset = end;
    await capacity.wait(controller, signal);
  } while (offset < data.byteLength);
}

/**
 * Đẩy MỘT mục tệp theo luồng mà không giữ lại toàn bộ chuỗi byte của nó.
 * Nhận: deflate — luồng deflate của mục ZIP; chunks — dòng byte của tệp; controller — bộ điều khiển
 *        hàng đợi phản hồi; capacity — cổng sức chứa; signal — huỷ.
 * Trả: không (Promise hoàn tất khi kết thúc luồng).
 */
async function pushStreamChunks(deflate: ZipDeflate, chunks: AsyncIterable<Uint8Array>, controller: ReadableStreamDefaultController<Uint8Array>, capacity: ResponseCapacityGate, signal: AbortSignal): Promise<void> {
  for await (const chunk of chunks) {
    signal.throwIfAborted();
    if (chunk.byteLength === 0) continue;
    deflate.push(chunk, false);
    await capacity.wait(controller, signal);
  }
  signal.throwIfAborted();
  deflate.push(new Uint8Array(), true);
  await capacity.wait(controller, signal);
}

/**
 * Đẩy văn bản của MỘT artifact vào luồng deflate theo khúc có trần, KHÔNG BAO GIỜ cắt đôi một cặp
 * surrogate qua ranh giới khúc (một nửa cao surrogate mã hoá lại thành U+FFFD và sẽ âm thầm làm hỏng
 * artifact được xuất).
 * Nhận: deflate — luồng deflate của mục ZIP; content — văn bản log canonical; controller — bộ điều
 *        khiển hàng đợi phản hồi; capacity — cổng sức chứa; signal — huỷ.
 * Trả: không (Promise hoàn tất khi đẩy xong).
 */
async function pushArtifactChunks(deflate: ZipDeflate, content: string, controller: ReadableStreamDefaultController<Uint8Array>, capacity: ResponseCapacityGate, signal: AbortSignal): Promise<void> {
  const encoder = new TextEncoder();
  let offset = 0;
  let finalChunk = false;
  do {
    signal.throwIfAborted();
    let end = Math.min(offset + PUSH_CHUNK_CODE_UNITS, content.length);
    if (end < content.length && end - offset > 1) {
      const last = content.charCodeAt(end - 1);
      if (last >= 55296 && last <= 56319) end -= 1;
    }
    finalChunk = end >= content.length;
    deflate.push(encoder.encode(content.slice(offset, end)), finalChunk);
    offset = end;
    await capacity.wait(controller, signal);
  } while (!finalChunk);
}

/**
 * Phát MỘT ZIP của log phiên dưới dạng ReadableStream (WHATWG). Log gốc do bên gọi đọc và tuần tự hoá
 * TRƯỚC khi hàm này chạy (thiếu log gốc hoặc thiếu dịch vụ trả lời gọn trước khi sinh byte nào); mỗi
 * mục sau đó được mã hoá và nén theo khúc có trần ngay khi được sinh, nên byte của ZIP đến dần. Một
 * phiên con đọc hỏng sẽ làm luồng lỗi (fail-loud, không bao giờ xuất thiếu âm thầm).
 * Nhận: deps — dịch vụ xuất đã mount; rootContent — log gốc đã tuần tự hoá (mục ZIP đầu); sessionId —
 *        id phiên gốc; includeDescendants — có gồm mọi subagent con không; compressionLevel — mức
 *        DEFLATE đã kiểm cho mọi mục ZIP; signal — huỷ yêu cầu đã gộp huỷ của bên tiêu thụ.
 * Trả: luồng byte ZIP.
 */
export function streamSessionLogZip(
  deps: SessionLogExportReady,
  rootContent: string,
  sessionId: SessionId,
  includeDescendants: boolean,
  compressionLevel: SessionLogCompressionLevel,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const consumerAbort = new AbortController();
  const producerSignal = AbortSignal.any([signal, consumerAbort.signal]);
  let zip: Zip | undefined;
  let zipTerminated = false;
  const capacity = new ResponseCapacityGate();
  /** Kết thúc bộ nén đang chạy (một lần duy nhất). */
  const terminateZip = (): void => {
    if (zip === void 0 || zipTerminated) return;
    zipTerminated = true;
    zip.terminate();
  };
  /**
   * Chiến lược xếp hàng: trần byte của hàng đợi phản hồi và cách đo một khúc.
   * NGUYÊN VĂN bản gốc (highWaterMark 64 KiB, size = số byte của khúc); khai thành biến để kiểu
   * QueuingStrategy của lib DOM không làm lệch overload của ReadableStream.
   */
  const strategy: QueuingStrategy<Uint8Array> = {
    highWaterMark: RESPONSE_HIGH_WATER_MARK_BYTES,
    size: (chunk) => (chunk as Uint8Array).byteLength,
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const archive = new Zip((error, data, final) => {
        if (error) {
          controller.error(error);
          return;
        }
        if (data.byteLength > 0) controller.enqueue(data);
        if (final) controller.close();
      });
      zip = archive;
      void (async () => {
        try {
          for await (const entry of sessionLogZipEntries(deps, rootContent, sessionId, includeDescendants, producerSignal)) {
            const deflate = new ZipDeflate(entry.path, { level: compressionLevel });
            archive.add(deflate);
            if ("content" in entry) await pushArtifactChunks(deflate, entry.content, controller, capacity, producerSignal);
            else if ("data" in entry) await pushBinaryChunks(deflate, entry.data, controller, capacity, producerSignal);
            else await pushStreamChunks(deflate, entry.chunks, controller, capacity, producerSignal);
          }
          archive.end();
        } catch (error) {
          terminateZip();
          controller.error(error instanceof Error ? error : new Error(String(error)));
        }
      })();
    },
    pull() {
      capacity.pulled();
    },
    cancel(reason) {
      consumerAbort.abort(reason instanceof Error ? reason : new Error("session log export stream cancelled"));
      terminateZip();
    },
  }, strategy);
}
