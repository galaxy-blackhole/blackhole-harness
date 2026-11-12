/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa Host của row file-upload: service Remote fileUploads — nhận tải tệp theo luồng qua route
 *      đã xác thực, lưu byte bền vững qua kho attachment, và giữ biên nhận staged theo ĐÚNG Session
 *      của Agent nhận. Port 1:1 lib/index.js của @deepseek-ai/dsh-client-file-upload.
 */

import { randomUUID } from "node:crypto";

import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

import { FILE_UPLOAD_PATH, handleFileUploadHttp } from "./http-route.ts";
import { remoteFailure } from "./remote-failure.ts";
import { PromptFileBindingGuard, StagedFiles } from "./staged-files.ts";
import type {
  AgentLike,
  AgentResolver,
  EncodedFileUploadRequest,
  FileAttachmentRef,
  FileUploadReceiptId,
  FileUploadSeams,
  FileUploadValue,
  SessionEventLike,
  SessionId,
  SessionLike,
  StreamUploadRequest,
} from "./types.ts";

/**
 * Ép Context cordis sang seam Host mà row này đọc (khai theo CẤU TRÚC — luật 000d).
 * @param ctx - Context của plugin. Nhận: Context thật. Trả: seam đọc được các dịch vụ cần dùng.
 * @returns seam Host.
 */
function seamOf(ctx: Context): FileUploadSeams {
  return ctx as unknown as FileUploadSeams;
}

/**
 * Service Host sở hữu kho tải tệp + biên nhận, khoá theo ĐÚNG Session của Agent nhận.
 */
export class FileUploads extends TypertRemoteService {
  /** Seam bắt buộc trước khi service thức dậy (nguyên văn inject của bản gốc). */
  static inject = ["agents", "attachments", "commands", "connection"];

  /** Seam Host đã chụp lúc dựng: dùng dịch vụ qua ctx.get chứ không qua thuộc tính của ctx gọi. */
  private readonly seam: FileUploadSeams;

  /** Biên nhận staged theo đối tượng phiên (WeakMap như bản gốc). */
  private readonly stagedFiles = new StagedFiles();

  /** Hàm giải Agent thường cho phiên lạnh; chỉ MỘT resolver được đăng ký. */
  private agentResolver: AgentResolver | undefined;

  /**
   * Đăng ký service fileUploads, resolver biên nhận cho commands, route tải byte thô, và hai lượt nghe phiên.
   * @param ctx - Context Host mang Agent, attachment, command, và Connection.
   */
  constructor(ctx: Context) {
    super(ctx, "fileUploads");
    const seam = seamOf(ctx);
    this.seam = seam;
    const resolve = (agent: AgentLike, receiptId: FileUploadReceiptId) => this.resolve(agent, receiptId);
    ctx.effect(() => seam.commands.registerFileReceiptResolver(resolve), "file-upload: command file receipt resolver");
    ctx.effect(
      () =>
        seam.connection.fetch.register({
          path: FILE_UPLOAD_PATH,
          methods: ["POST"],
          requestBody: "streaming",
          fetch: (request: Request) => handleFileUploadHttp(this, request),
        }),
      "file-upload: streaming route",
    );
    seam.on("session/event", (session, event) => {
      this.observeSessionEvent(session, event);
    });
    seam.on("session/disposed", (session) => {
      this.stagedFiles.forget(session);
    });
  }

  /**
   * Đăng ký hàm giải Agent thường dùng khi một lượt tải thô nhắm tới Session lạnh.
   * @param resolve - hàm trả ĐÚNG Agent đang sống hoặc ném lỗi Remote.
   * @returns hàm dọn gỡ resolver này.
   * @throws Error khi đã có resolver được đăng ký trước đó.
   */
  registerAgentResolver(resolve: AgentResolver): () => void {
    if (this.agentResolver !== undefined) throw new Error("file-upload: Agent resolver is already registered");
    this.agentResolver = resolve;
    return () => {
      if (this.agentResolver === resolve) this.agentResolver = undefined;
    };
  }

  /**
   * Lưu MỘT tệp đã mã hoá base64 và stage nó dưới Agent nhận do Typert chọn.
   * Nhận: agent nhận, yêu cầu base64 + tên tuỳ chọn, và tín hiệu huỷ của bên gọi.
   * Trả: biên nhận staged kèm tham chiếu tệp bền vững.
   * @throws DOMException khi tín hiệu đã bị huỷ trước khi lưu.
   */
  @Remote("upload")
  upload(agent: AgentLike, request: EncodedFileUploadRequest, signal: AbortSignal): Promise<FileUploadValue> {
    signal.throwIfAborted();
    return this.commit(agent, () =>
      this.seam.attachments.admitEncodedFile({
        data: request.data,
        ...(request.name === undefined ? {} : { name: request.name }),
      }),
    );
  }

  /**
   * Lưu các khối byte thô cho MỘT Session mà KHÔNG gộp lượt tải.
   * Nhận: danh tính phiên, byte theo thứ tự, huỷ, và tên hiển thị tuỳ chọn.
   * Trả: biên nhận staged kèm tham chiếu tệp bền vững.
   */
  async uploadStream(request: StreamUploadRequest): Promise<FileUploadValue> {
    const agent = await this.resolveAgent(request.sessionId);
    return this.commit(agent, () =>
      this.seam.attachments.saveFileStream({
        data: request.data,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
        ...(request.name === undefined ? {} : { name: request.name }),
      }),
    );
  }

  /**
   * Giải MỘT biên nhận staged cho ĐÚNG Session của Agent nhận.
   * @param agent - Agent nhận.
   * @param receiptId - biên nhận mờ do Host cấp cho một lượt tải đã xong.
   * @returns tham chiếu tệp bền vững, hoặc undefined khi biên nhận lạ/không thuộc phiên.
   */
  resolve(agent: AgentLike, receiptId: FileUploadReceiptId): FileAttachmentRef | undefined {
    return this.stagedFiles.resolve(agent.session, receiptId);
  }

  /**
   * Gắn biên nhận trong lúc một prompt vào hộp thư Agent.
   * Dispose khôi phục mọi gắn kết cũ trừ khi bên gọi commit lần gửi thành công.
   * @param agent - Agent nhận.
   * @param receiptIds - các biên nhận (phân biệt) mà prompt tham chiếu.
   * @param requestId - danh tính prompt sẽ quan sát thấy trong hàng đợi/lịch sử.
   * @returns binding được giữ sau commit cho tới khi hàng đợi/lịch sử gỡ biên nhận.
   * @throws RemoteError 'session/attachment-invalid' khi có biên nhận chưa staged.
   */
  bindPrompt(agent: AgentLike, receiptIds: readonly FileUploadReceiptId[], requestId: string): PromptFileBindingGuard {
    return this.stagedFiles.bindPrompt(agent.session, receiptIds, requestId);
  }

  /**
   * Gỡ mọi biên nhận đã được một mục hàng đợi bị xoá nhận.
   * @param agent - Agent nhận.
   * @param requestId - danh tính prompt mà mục hàng đợi mang.
   * @returns không.
   */
  retirePrompt(agent: AgentLike, requestId: string): void {
    this.retire(agent.session, requestId);
  }

  /**
   * Lưu bền vững rồi stage biên nhận, sau khi kiểm Agent còn sống.
   * @param agent - Agent nhận.
   * @param save - thao tác lưu bền vững trả tham chiếu tệp.
   * @returns biên nhận staged kèm tham chiếu tệp.
   * @throws RemoteError 'session/attachment-invalid' khi kho attachment từ chối tệp.
   * @throws RemoteError 'gateway/internal' khi lưu hỏng vì lý do khác.
   * @throws RemoteError 'session/not-found' khi phiên bị dọn trước lúc lưu xong.
   */
  private async commit(agent: AgentLike, save: () => Promise<FileAttachmentRef>): Promise<FileUploadValue> {
    this.assertOrdinaryAgent(agent);
    let file: FileAttachmentRef;
    try {
      file = await save();
    } catch (error) {
      if (this.seam.attachments.isAttachmentError(error)) {
        throw remoteFailure("session/attachment-invalid", error.message, { reason: error.code });
      }
      throw remoteFailure("gateway/internal", "failed to store file upload: " + String(error), {}, { cause: error });
    }
    if (this.seam.agents.get(agent.id) !== agent) {
      throw remoteFailure("session/not-found", 'session "' + agent.id + '" was disposed before its file upload completed', { sessionId: agent.id });
    }
    const receiptId = randomUUID();
    this.stagedFiles.stage(agent.session, receiptId, file);
    return { receiptId, file };
  }

  /**
   * Giải Agent đang sống của một phiên, hoặc nhờ resolver đã đăng ký.
   * @param sessionId - danh tính phiên.
   * @returns Agent đang sống (hoặc do resolver trả).
   * @throws RemoteError 'session/not-found' khi phiên chưa attach và chưa có resolver.
   */
  private async resolveAgent(sessionId: SessionId): Promise<AgentLike> {
    const live = this.seam.agents.get(sessionId);
    if (live !== undefined) return live;
    const resolver = this.agentResolver;
    if (resolver === undefined) {
      throw remoteFailure("session/not-found", 'session "' + sessionId + '" is not attached', { sessionId });
    }
    return resolver(sessionId);
  }

  /**
   * Từ chối tải tệp cho phiên của subagent (nguyên văn bản gốc).
   * @param agent - Agent nhận.
   * @returns không.
   * @throws RemoteError 'subagent/attachment-invalid' khi phiên có header.origin = 'subagent'.
   */
  private assertOrdinaryAgent(agent: AgentLike): void {
    if (agent.session.header.origin === "subagent") {
      throw remoteFailure("subagent/attachment-invalid", "subagent conversations do not accept file uploads", { reason: "SUBAGENT_FILE_UNSUPPORTED" });
    }
  }

  /**
   * Quan sát sự kiện phiên: tin nhắn người dùng đã vào lịch sử thì gỡ biên nhận của lời gọi đó.
   * @param session - phiên phát sự kiện.
   * @param event - sự kiện phiên.
   * @returns không.
   */
  private observeSessionEvent(session: SessionLike, event: SessionEventLike): void {
    if (event.type !== "user/message" || event.data.source.kind !== "user" || !("rpcId" in event.data.source)) return;
    if (typeof event.data.source.rpcId === "string") this.retire(session, event.data.source.rpcId);
  }

  /**
   * Gỡ mọi biên nhận mà một prompt đang giữ.
   * @param session - phiên sở hữu.
   * @param requestId - danh tính prompt.
   * @returns không.
   */
  private retire(session: SessionLike, requestId: string): void {
    this.stagedFiles.retire(session, requestId);
  }
}

export default FileUploads;
