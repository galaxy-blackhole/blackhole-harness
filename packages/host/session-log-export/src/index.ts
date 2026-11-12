/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa HOST của session-log-export: lệnh /export trên Web + route tải ZIP do Host sở hữu — port 1:1
 *      lib/index.js của @deepseek-ai/dsh-session-log-export (vùng lib/types/index.js).
 *      Gói gốc là HAI MẶT (dsh.client 5 inject + lib/client.js 317 dòng) nên gói này CHỈ port nửa host
 *      và KHÔNG khai gbh.row (quy ước file-upload/task-22).
 */

import Schema from "@deepseek-ai/schemastery";
import { brandString } from "@deepseek-ai/dsh-brand";
import type { Context } from "@deepseek-ai/cordis";

import { flushLiveSessionLog, readSessionLogText, sessionLogExportDeps, sessionLogZipFilename, streamSessionLogZip } from "./archive.ts";
import { SESSION_LOG_EXPORT_PATH } from "./routes.ts";
import type { CommandRegistry, ConnectionFetch, SessionId, SessionLogCompressionLevel } from "./types.ts";

export {
  DEFAULT_SESSION_LOG_COMPRESSION_LEVEL,
  flushLiveSessionLog,
  readSessionLogText,
  serializeSessionLog,
  SESSION_LOG_FILENAME,
  sessionLogExportDeps,
  sessionLogZipEntries,
  sessionLogZipFilename,
  streamSessionLogZip,
} from "./archive.ts";
export type { SessionLogCompressionLevel, SessionLogExportDeps, SessionLogExportReady, SessionLogZipEntry } from "./types.ts";
export { SESSION_LOG_EXPORT_PATH } from "./routes.ts";

/** Tên plugin cordis — NGUYÊN VĂN bản gốc (cũng là namespace từ điển của row). */
export const name = "session-log-download";

/** Service bắt buộc: sổ lệnh của con người và tầng vận chuyển HTTP — NGUYÊN VĂN bản gốc. */
export const inject: string[] = ["commands", "connection"];

/** Chính sách lưu trữ log phiên. */
export interface Config {
  /** Mức DEFLATE cho mỗi mục ZIP. Mặc định 6. */
  readonly compressionLevel?: SessionLogCompressionLevel;
}

/** Schema loader cho chính sách lưu trữ log phiên (đã kiểm, đã điền mặc định). */
export const Config: Schema<Config> = Schema.object({
  compressionLevel: Schema.number().step(1).min(0).max(9).default(6),
}) as unknown as Schema<Config>;

/** Câu trả lời khi một lời gọi /export không kèm đường dẫn — NGUYÊN VĂN bản gốc. */
const REQUESTED = {
  kind: "success",
  text: "Session log download requested.",
} as const;

/**
 * Đăng ký lệnh /export CHỈ cho Web và route tải ZIP có xác thực.
 * Nhận: ctx — context Host mang sổ lệnh của con người và tầng vận chuyển; config — chính sách nén đã giải.
 * Trả: không; đăng ký một hiệu ứng lệnh và một route.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const commands = (ctx as unknown as { commands: CommandRegistry }).commands;
  ctx.effect(() => commands.register({
    definitionId: brandString("@deepseek-ai/dsh-session-log-export") as unknown as string,
    name: "export",
    description: "Download this Session log as a ZIP archive",
    handler: (invocation) => Promise.resolve(invocation.rawInput.trim() === "" ? REQUESTED : {
      kind: "error",
      text: "The Web /export command does not accept a path.",
    }),
  }), "session-log-download: command");
  connectionOf(ctx).fetch.register({
    path: SESSION_LOG_EXPORT_PATH,
    methods: ["GET", "HEAD"],
    requestBody: "buffered",
    fetch: async (request) => {
      const response = await sessionLogExportResponse(ctx, request, config.compressionLevel ?? 6);
      if (request.method === "GET") return response;
      await response.body?.cancel();
      return new Response(null, {
        status: response.status,
        headers: response.headers,
      });
    },
  });
}

/**
 * Lấy tầng vận chuyển HTTP từ context. Dùng Reflect vì service do plugin khác cấp và không khai kiểu
 * ở đây — NGUYÊN VĂN cách bản gốc làm.
 * Nhận: ctx — context Host.
 * Trả: bề mặt fetch của tầng vận chuyển.
 */
function connectionOf(ctx: Context): { fetch: ConnectionFetch } {
  return Reflect.get(ctx, "connection") as { fetch: ConnectionFetch };
}

/**
 * Dựng phản hồi cho MỘT yêu cầu xuất ZIP: kiểm tham số, kiểm dịch vụ, đọc log gốc (để trả 404/500 gọn
 * trước khi sinh byte nào), rồi phát luồng ZIP.
 * Nhận: ctx — context Host; request — yêu cầu HTTP đã xác thực; compressionLevel — mức DEFLATE đã kiểm.
 * Trả: phản hồi HTTP (400/404/500 hoặc 200 kèm luồng ZIP).
 */
async function sessionLogExportResponse(ctx: Context, request: Request, compressionLevel: SessionLogCompressionLevel): Promise<Response> {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  const sessionIdValue = query["sessionId"];
  const descendantsValue = query["includeDescendants"];
  if (sessionIdValue === void 0 || sessionIdValue.length === 0 || descendantsValue !== void 0 && descendantsValue !== "true" && descendantsValue !== "false") {
    return new Response("missing or invalid sessionId query parameter", { status: 400 });
  }
  const sessionId = brandString<SessionId>(sessionIdValue);
  const deps = sessionLogExportDeps(ctx);
  if (deps.sessionQuery === void 0 || deps.sessionPersistence === void 0 || deps.attachments === void 0) {
    return new Response("session log export is unavailable: missing session-query, session-persistence, or attachments service", { status: 500 });
  }
  const ready = {
    sessionQuery: deps.sessionQuery,
    sessionPersistence: deps.sessionPersistence,
    attachments: deps.attachments,
    sessions: deps.sessions,
  };
  let rootContent: string | undefined;
  try {
    await flushLiveSessionLog(deps, sessionId, request.signal);
    rootContent = await readSessionLogText(deps.sessionPersistence, sessionId, request.signal);
    request.signal.throwIfAborted();
  } catch {
    request.signal.throwIfAborted();
    return new Response("session log export failed to read the stored log", { status: 500 });
  }
  if (rootContent === void 0) return new Response("session not found", { status: 404 });
  return new Response(streamSessionLogZip(ready, rootContent, sessionId, descendantsValue === "true", compressionLevel, request.signal), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${sessionLogZipFilename(sessionId)}"`,
    },
  });
}
