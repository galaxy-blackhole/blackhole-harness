/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Sổ đăng ký workspace BỀN VỮNG (bản gốc: lib/types/index.js, phần lớp `WorkspaceRegistry`):
 *      bản ghi workspace, thứ tự ổn định, và tư cách thành viên phiên có kiểm header trên dạng dữ liệu
 *      MIỀN của kho. Lớp kế thừa `Service` của kernel nên thể hiện là DUY NHẤT và sống theo fiber.
 */
import { randomUUID } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";

import { Service, type Context } from "@deepseek-ai/cordis";

import { WorkspaceEntity, type WorkspaceEntityHost } from "./entity.ts";
import {
  WorkspaceActiveSessionError,
  WorkspaceArchivedSessionPinError,
  WorkspaceOrderInvalidError,
  WorkspaceUnknownSessionError,
} from "./errors.ts";
import { defaultWorkspaceTitle, fullyQualifiedWorkspacePath, realpathNormalize } from "./paths.ts";
import type {
  KvTableLike,
  SessionsFacility,
  WorkspaceDomainLike,
  WorkspaceRegistryContext,
} from "./seams.ts";
import { workspaceDomainSpec } from "./spec.ts";
import type { WorkspaceDomainState, WorkspaceRecord } from "./spec.ts";
import type {
  ArchiveSessionOptions,
  SessionActivity,
  SessionHeaderLike,
  SessionId,
  Workspace,
  WorkspaceId,
} from "./types.ts";

/**
 * Hai dãy id có GIỐNG NHAU từng vị trí không.
 * Nhận: hai dãy id.
 * Trả: `true` khi cùng độ dài và mọi vị trí trùng.
 */
const sameIds = <T extends string>(left: readonly T[], right: readonly T[]): boolean =>
  left.length === right.length && left.every((id, index) => id === right[index]);

/**
 * So hai header để xếp "mới nhất trước", phá hoà bằng id.
 * Nhận: hai header phiên.
 * Trả: số âm khi `left` mới hơn (hoặc cùng mốc mà id nhỏ hơn theo `localeCompare`).
 */
const compareHeaders = (left: SessionHeaderLike, right: SessionHeaderLike): number =>
  right.createdAt - left.createdAt || String(left.id).localeCompare(String(right.id));

/** Hai dãy `SessionId` có giống nhau từng vị trí không (dùng trong lượt gieo lịch sử). */
const sameSessionIds = (left: readonly SessionId[], right: readonly SessionId[]): boolean => sameIds(left, right);

/**
 * Sổ đăng ký workspace bền vững. Lượt khởi động CHỜ `sessionPersistence`, dựng MỘT chỉ mục header theo
 * `cwd` chuẩn tắc, và chạy xong lượt gieo lịch sử MỘT-LẦN trước khi dịch vụ thành ACTIVE.
 *
 * Vì sao phụ thuộc persistence là BẮT BUỘC: một peer không sẵn sàng KHÔNG BAO GIỜ được đọc nhầm thành
 * "lịch sử rỗng" rồi đóng dấu `initialized` — dấu đó là vĩnh viễn.
 */
export class WorkspaceRegistry extends Service {
  /** Hai seam bắt buộc, nguyên văn của bản gốc. */
  static inject = ["storageDomain", "sessionPersistence"];

  /** Bảng `workspaces` của miền đã mở; `undefined` cho tới khi lượt khởi động mở xong miền. */
  private table?: KvTableLike<WorkspaceId, WorkspaceRecord>;
  /** Ô singleton toàn cục của miền đã mở. */
  private global?: WorkspaceDomainLike["global"];
  /** Ảnh chụp trạng thái bền gần nhất (được tráo sau mỗi lượt `set`). */
  private state?: WorkspaceDomainState;
  /** Các thực thể đã công bố, theo id — thứ tự hiển thị nằm trong `state.workspaceIds`. */
  private readonly entities = new Map<WorkspaceId, WorkspaceEntity>();
  /** Chỉ mục header phiên theo id. */
  private readonly headers = new Map<SessionId, SessionHeaderLike>();
  /** Chỉ mục `cwd` ĐÃ CHUẨN TẮC của các phiên giải được. */
  private readonly sessionPaths = new Map<SessionId, string>();
  /** Các phiên có `cwd` đầy đủ nhưng KHÔNG giải được vì thiếu một đoạn đường dẫn (`ENOENT`). */
  private readonly missingSessionPaths = new Set<SessionId>();
  /** Các phiên có `cwd` hỏng, kèm lý do — chỉ dùng để viết log chẩn đoán. */
  private readonly invalidSessionPaths = new Map<SessionId, string>();
  /** Đuôi chuỗi tuần tự hoá các lượt thay đổi của sổ đăng ký. */
  private operationTail: Promise<void> = Promise.resolve();
  /** Máy móc mà các thực thể thay đổi qua (bảng, chỉ mục đường dẫn, phép đọc header). */
  private readonly entityHost: WorkspaceEntityHost = {
    table: () => this.requireTable(),
    candidateMatches: (id, path) => this.sessionPaths.get(id) === path || this.missingSessionPaths.has(id),
    readSessionHeader: (id) => this.readSessionHeader(id),
    rememberSessionPath: (id, path) => {
      this.sessionPaths.set(id, path);
      this.missingSessionPaths.delete(id);
      this.invalidSessionPaths.delete(id);
    },
  };

  /**
   * Dựng sổ đăng ký và đăng ký nó dưới tên `workspaceRegistry` (kernel cấp thể hiện DUY NHẤT).
   * Nhận: context cordis.
   * Trả: thể hiện dịch vụ (miền CHƯA mở — việc đó ở lượt khởi động).
   */
  constructor(ctx: Context) {
    super(ctx, "workspaceRegistry");
  }

  /**
   * Context nhìn qua ĐÚNG bề mặt mà sổ đăng ký gọi (xem {@link WorkspaceRegistryContext}).
   * Nhận: không.
   * Trả: context đã ép kiểu tại đúng ranh giới này.
   */
  private get seam(): WorkspaceRegistryContext {
    return this.ctx as unknown as WorkspaceRegistryContext;
  }

  /**
   * Sổ phiên ĐANG SỐNG, nếu chương trình có — headless thì vắng.
   * Nhận: không.
   * Trả: facility `sessions`, hoặc `undefined`.
   */
  private sessions(): SessionsFacility | undefined {
    return this.seam.get("sessions") as SessionsFacility | undefined;
  }

  /**
   * Mở miền, chạy xong lượt gieo lịch sử khi cần, rồi dựng lại cache CÓ THỨ TỰ.
   * Nhận: không (cordis gọi qua ký hiệu `Service.init`).
   * Trả: promise phân giải khi dịch vụ sẵn sàng phục vụ.
   */
  protected async [Service.init](): Promise<void> {
    const domain = await this.seam.storageDomain.open(workspaceDomainSpec);
    this.ctx.effect(() => () => domain.close(), "workspace.domainClose");
    const table = domain.table("workspaces");
    this.table = table;
    this.global = domain.global;
    this.state = domain.global.get();
    await this.recoverPendingMutation();
    const recovered = this.requireState();
    this.validateStoredState(recovered);
    if (!recovered.initialized) {
      const headers = await this.listStoredHeaders();
      await this.replaceHeaderIndex(headers);
      await this.bootstrap(headers);
    } else if (table.size > 0) {
      // 10/11/2026 (Lead): sổ đã initialized KHÔNG có nghĩa là sổ CÒN KHỚP đĩa. Vẫn dựng chỉ mục rồi
      // kiểm lệch — xem {@link adoptOrphanedSessions}. Nhà bình thường: 0 phiên mồ côi ⇒ không ghi gì.
      const headers = await this.listStoredHeaders();
      await this.replaceHeaderIndex(headers);
      await this.adoptOrphanedSessions(headers);
    }
    await this.indexLiveSessions();
    this.validateStoredState(this.requireState());
    this.rebuildEntities();
    this.reportFilteredCandidates();
  }

  /**
   * Tạo mới hoặc dùng lại workspace cho một thư mục CÓ THẬT. Đường dẫn đầy đủ được chuẩn tắc qua
   * `fs.realpath`; đường dẫn tương đối, không tồn tại, hoặc không phải thư mục đều bị từ chối. Gọi lặp
   * lại trên CÙNG đường dẫn chuẩn tắc trả về thực thể đã có mà KHÔNG đổi tiêu đề. Workspace mới được
   * CHÈN LÊN ĐẦU thứ tự bền. Hai đường dẫn chuẩn tắc khác nhau được phép trùng tiêu đề hiển thị.
   * Nhận: đường dẫn thư mục có thật (dạng đầy đủ) và tiêu đề chỉ dùng khi tạo MỚI.
   * Trả: promise của workspace đã có hoặc vừa được ghi bền.
   */
  async create(path: string, title?: string): Promise<Workspace> {
    const canonical = await realpathNormalize(path);
    if (!(await stat(canonical)).isDirectory()) throw new Error(`cannot create a workspace at '${canonical}': path is not a directory`);
    return await this.enqueueOperation(() => this.createCanonical(canonical, title));
  }

  /**
   * Khởi tạo Workspace MẶC ĐỊNH chỉ khi CẢ sổ đăng ký LẪN lịch sử phiên đều rỗng. Lượt gọi lặp lại dùng
   * lại danh tính bền của nó; xoá bản ghi đó VĨNH VIỄN tắt việc tạo tự động.
   *
   * Thư mục thiếu được tạo ĐỆ QUY trước khi đăng ký, và tiêu đề ban đầu là đoạn cuối của CHÍNH đường
   * dẫn được yêu cầu — không phải của bản đã chuẩn tắc, nên một symlink ở đường dẫn đó không đổi tên
   * Workspace theo đích của nó. Sau khi giải xong, việc bên gọi huỷ KHÔNG hoàn tác tạo/đăng ký.
   * Nhận: hàm giải đường dẫn tuyệt đối (chỉ được gọi khi ĐỦ điều kiện tạo, bên trong hàng đợi thay đổi).
   * Trả: promise của workspace vừa khởi tạo, hoặc `undefined` khi không đủ điều kiện tạo tự động.
   */
  initializeDefault(resolveDirectory: () => Promise<string>): Promise<Workspace | undefined> {
    return this.enqueueOperation(async (): Promise<Workspace | undefined> => {
      const state = this.requireState();
      if (state.defaultWorkspaceId !== undefined) return this.entities.get(state.defaultWorkspaceId);
      const sessions = this.sessions();
      if (sessions === undefined) throw new Error("default Workspace initialization requires the Session store");
      if (
        state.workspaceIds.length > 0 ||
        state.archivedSessionIds.length > 0 ||
        sessions.list().length > 0 ||
        (await this.listStoredHeaders()).length > 0
      ) {
        return undefined;
      }
      const path = await resolveDirectory();
      if (!fullyQualifiedWorkspacePath(path)) throw new TypeError(`Workspace path is not fully qualified: '${path}'`);
      await mkdir(path, { recursive: true });
      const canonical = await realpathNormalize(path);
      if ((await this.listStoredHeaders()).length > 0 || sessions.list().length > 0) return undefined;
      return this.createCanonical(canonical, defaultWorkspaceTitle(path), true);
    });
  }

  /**
   * Tra một workspace theo id.
   * Nhận: id workspace.
   * Trả: workspace, hoặc `undefined` khi không có.
   */
  get(id: WorkspaceId): Workspace | undefined {
    return this.entities.get(id);
  }

  /**
   * Phép chiếu ĐỒNG BỘ theo thứ tự bền của sổ đăng ký. Getter `sessionIds` của từng thực thể đã được lọc
   * bằng chỉ mục `cwd` chuẩn tắc của lượt khởi động và của phiên đang sống; phép này KHÔNG đọc môi
   * trường lưu.
   * Nhận: không.
   * Trả: MẢNG MỚI theo thứ tự; NÉM khi thứ tự trỏ vào một workspace không còn thực thể.
   */
  list(): Workspace[] {
    return this.requireState().workspaceIds.map((id) => {
      const entity = this.entities.get(id);
      if (entity === undefined) throw new Error(`workspace registry order references missing workspace '${id}'`);
      return entity;
    });
  }

  /**
   * Xoá MỘT đăng ký workspace, GIỮ LẠI thư mục và mọi log phiên. Thứ tự bền được cập nhật TRƯỚC lượt xoá
   * bảng; một lượt ghi bảng hỏng sẽ khôi phục thứ tự cũ và giữ thực thể đã công bố. Id lạ là lượt
   * không-làm-gì idempotent với bên gọi miền.
   * Nhận: đăng ký workspace cần bỏ.
   * Trả: promise của `true` khi có bản ghi bị xoá, `false` khi id lạ.
   */
  delete(id: WorkspaceId): Promise<boolean> {
    return this.enqueueOperation(() => this.deleteKnown(id));
  }

  /**
   * Chuyển MỘT workspace trong thứ tự hiển thị bền, kiểu DOM-insertBefore: có mốc neo thì đặt TRƯỚC
   * workspace đó, không có thì nối vào CUỐI.
   * Nhận: workspace cần chuyển và mốc neo (tuỳ chọn).
   * Trả: promise của TOÀN BỘ thứ tự workspace đã cam kết.
   */
  insertBefore(id: WorkspaceId, beforeId?: WorkspaceId): Promise<readonly WorkspaceId[]> {
    return this.enqueueOperation(async () => {
      const state = this.requireState();
      if (!state.workspaceIds.includes(id)) throw new WorkspaceOrderInvalidError(id);
      if (beforeId !== undefined && !state.workspaceIds.includes(beforeId)) throw new WorkspaceOrderInvalidError(beforeId);
      if (beforeId === id) return state.workspaceIds;
      const without = state.workspaceIds.filter((workspaceId: WorkspaceId) => workspaceId !== id);
      const at = beforeId === undefined ? without.length : without.indexOf(beforeId);
      const workspaceIds: WorkspaceId[] = [...without.slice(0, at), id, ...without.slice(at)];
      if (sameIds(workspaceIds, state.workspaceIds)) return state.workspaceIds;
      await this.setState({ ...state, workspaceIds });
      return workspaceIds;
    });
  }

  /**
   * Sổ lưu trữ TOÀN SỔ: các phiên bị ẩn khỏi mọi bề mặt nhóm. Lưu trữ KHÔNG BAO GIỜ chạm sổ sở hữu —
   * phiên đã lưu trữ vẫn giữ ô `sessionIds` để bỏ lưu trữ trả lại đúng vị trí.
   * Nhận: không.
   * Trả: các phiên đã lưu trữ, theo thứ tự lưu trữ.
   */
  get archivedSessionIds(): readonly SessionId[] {
    return this.requireState().archivedSessionIds;
  }

  /**
   * Lưu trữ MỘT phiên một cách BỀN. Phiên phải TỒN TẠI (đang sống hoặc trong session persistence); sổ sở
   * hữu của nó — có hay không — đều không liên quan.
   *
   * Không có `stopActivity`: phiên còn phải KHÔNG hoạt động — waterfall `workspace/session-activity`
   * được hỏi MỘT lần, và mọi hoạt động được báo đều làm lượt gọi NÉM
   * {@link WorkspaceActiveSessionError} TRƯỚC khi ghi bất cứ thứ gì.
   *
   * Có `stopActivity`: lượt lưu trữ được ghi mà KHÔNG kiểm hoạt động, rồi các provider
   * `workspace/session-stop` được xin DỪNG công việc của phiên — sổ lưu trữ bền chính là thứ cổng
   * `agent/pre-step` của provider đọc, nên mọi lượt đánh thức do các lượt dừng gây ra đều đã bị chặn.
   *
   * Lượt lưu trữ BỎ GHIM của phiên trong CÙNG lượt ghi bền (ghim và lưu trữ loại trừ nhau). Id đã lưu
   * trữ phân giải mà không ghi, không hỏi, không dừng.
   * Nhận: phiên cần lưu trữ và tuỳ chọn dừng-hoạt-động.
   * Trả: promise phân giải sau khi bền và — với `stopActivity` — sau khi đã xin dừng mọi provider.
   */
  archiveSession(sessionId: SessionId, options: ArchiveSessionOptions = {}): Promise<void> {
    return this.enqueueOperation(async () => {
      if (this.requireState().archivedSessionIds.includes(sessionId)) return;
      if (!(await this.sessionKnown(sessionId))) throw new WorkspaceUnknownSessionError(sessionId, "archive");
      if (options.stopActivity !== true) {
        const activity = await this.seam.waterfall("workspace/session-activity", { sessionId }, () =>
          Promise.resolve([] as readonly SessionActivity[]),
        );
        if (activity.length > 0) throw new WorkspaceActiveSessionError(sessionId, activity);
      }
      const state = this.requireState();
      await this.setState({
        ...state,
        archivedSessionIds: [...state.archivedSessionIds, sessionId],
        pinnedSessionIds: state.pinnedSessionIds.filter((id: SessionId) => id !== sessionId),
      });
      if (options.stopActivity === true) await this.stopSessionActivity(sessionId);
    });
  }

  /**
   * Bỏ lưu trữ MỘT phiên bằng cách rút nó khỏi sổ lưu trữ toàn sổ; ô sở hữu KHÔNG BAO GIỜ bị chạm, nên
   * phiên trở về đúng vị trí đã ghi. Lượt này KHÔNG kiểm phiên có tồn tại: rút một id thì không thể tạo
   * ra id lạ, nên một mục mà phiên đã biến mất vẫn phân giải được. Id KHÔNG nằm trong sổ lưu trữ phân
   * giải mà không ghi.
   * Nhận: phiên cần bỏ lưu trữ.
   * Trả: promise phân giải sau khi bền.
   */
  unarchiveSession(sessionId: SessionId): Promise<void> {
    return this.enqueueOperation(async () => {
      const state = this.requireState();
      if (!state.archivedSessionIds.includes(sessionId)) return;
      await this.setState({ ...state, archivedSessionIds: state.archivedSessionIds.filter((id: SessionId) => id !== sessionId) });
    });
  }

  /**
   * Sổ GHIM toàn sổ: các phiên được đưa lên trước mọi phiên không ghim trên các bề mặt nhóm. Ghim KHÔNG
   * BAO GIỜ chạm sổ sở hữu.
   * Nhận: không.
   * Trả: id phiên theo thứ tự ghim (ghim gần nhất đứng đầu).
   */
  get pinnedSessionIds(): readonly SessionId[] {
    return this.requireState().pinnedSessionIds;
  }

  /**
   * Ghim MỘT phiên một cách bền, CHÈN LÊN ĐẦU sổ ghim toàn sổ. Phiên phải TỒN TẠI (đang sống hoặc trong
   * session persistence) và KHÔNG được đã lưu trữ. Id đã ghim phân giải mà không ghi, không đổi thứ tự.
   * Nhận: phiên cần ghim.
   * Trả: promise phân giải sau khi bền.
   */
  pinSession(sessionId: SessionId): Promise<void> {
    return this.enqueueOperation(async () => {
      if (this.requireState().pinnedSessionIds.includes(sessionId)) return;
      if (this.requireState().archivedSessionIds.includes(sessionId)) throw new WorkspaceArchivedSessionPinError(sessionId);
      if (!(await this.sessionKnown(sessionId))) throw new WorkspaceUnknownSessionError(sessionId, "pin");
      const state = this.requireState();
      await this.setState({ ...state, pinnedSessionIds: [sessionId, ...state.pinnedSessionIds] });
    });
  }

  /**
   * Bỏ ghim MỘT phiên bằng cách rút nó khỏi sổ ghim toàn sổ. Lượt này KHÔNG kiểm phiên có tồn tại (rút
   * một id không thể tạo ra id lạ), nên một mục mà phiên đã biến mất vẫn phân giải được. Id KHÔNG được
   * ghim phân giải mà không ghi.
   * Nhận: phiên cần bỏ ghim.
   * Trả: promise phân giải sau khi bền.
   */
  unpinSession(sessionId: SessionId): Promise<void> {
    return this.enqueueOperation(async () => {
      const state = this.requireState();
      if (!state.pinnedSessionIds.includes(sessionId)) return;
      await this.setState({ ...state, pinnedSessionIds: state.pinnedSessionIds.filter((id: SessionId) => id !== sessionId) });
    });
  }

  /**
   * Phiên có đang SỐNG, có trong chỉ mục header, hoặc có trong một lượt liệt kê persistence MỚI không.
   * Chỉ VẮNG CHẮC CHẮN mới trả `false` — `sessionPersistence.list()` hỏng thì NÉM, để lỗi môi trường lưu
   * không bao giờ giả làm "phiên lạ".
   * Nhận: id phiên cần kiểm.
   * Trả: promise của cờ "phiên có thật".
   */
  private async sessionKnown(id: SessionId): Promise<boolean> {
    if (this.sessions()?.get(id) !== undefined) return true;
    if (this.headers.has(id)) return true;
    await this.indexHeaders(await this.listStoredHeaders());
    return this.headers.has(id);
  }

  /**
   * Xin MỌI provider dừng công việc của một phiên; provider hỏng chỉ bị GHI LOG, không bao giờ là lý do
   * để phiên tiếp tục hiện ra.
   * Nhận: phiên vừa được lưu trữ.
   * Trả: promise phân giải sau khi mọi lượt xin dừng đã phát ra (không chờ công việc kết thúc).
   */
  private async stopSessionActivity(sessionId: SessionId): Promise<void> {
    try {
      await this.seam.parallel("workspace/session-stop", { sessionId });
    } catch (error) {
      const failures = error instanceof AggregateError ? error.errors : [error];
      for (const failure of failures) {
        this.seam.logger.warn(`workspace: stopping session '${sessionId}' for archive failed: ${String(failure)}`);
      }
    }
  }

  /**
   * Giải một workspace theo đường dẫn thư mục chuẩn tắc mà KHÔNG tạo và KHÔNG thay đổi gì. Đường dẫn
   * thiếu bị từ chối ngay trong `realpath`; thư mục có thật mà chưa ai sở hữu trả `undefined`.
   * Nhận: đường dẫn thư mục có thật, dạng đầy đủ.
   * Trả: promise của workspace đang sở hữu đường dẫn chuẩn tắc đó, khi có.
   */
  async resolveByPath(path: string): Promise<Workspace | undefined> {
    const canonical = await realpathNormalize(path);
    for (const entity of this.entities.values()) if (entity.path === canonical) return entity;
    return undefined;
  }

  /**
   * Tạo bản ghi cho MỘT đường dẫn đã chuẩn tắc, với dấu thay-đổi-hai-lần và BA lớp hoàn tác.
   * Nhận: đường dẫn đã chuẩn tắc, tiêu đề (hoặc `undefined` để suy từ đường dẫn), và cờ "lượt dùng đầu".
   * Trả: promise của thực thể đã công bố và đã ghi bền; NÉM (kèm `AggregateError` khi cả hai vế đều
   * hỏng) khi không giữ được nhất quán.
   */
  private async createCanonical(canonical: string, title?: string, firstUse = false): Promise<Workspace> {
    for (const entity of this.entities.values()) if (entity.path === canonical) return entity;
    const workspaceName = title ?? defaultWorkspaceTitle(canonical);
    const table = this.requireTable();
    const state = this.requireState();
    const id = randomUUID() as WorkspaceId;
    const now = new Date().toISOString();
    const record: WorkspaceRecord = { path: canonical, title: workspaceName, sessionIds: [], createdAt: now, updatedAt: now };
    const entity = new WorkspaceEntity(this.entityHost, id, record);
    this.entities.set(id, entity);
    const pendingState: WorkspaceDomainState = { ...state, pendingMutation: { operation: "create", workspaceId: id } };
    try {
      await this.setState(pendingState);
    } catch (error) {
      this.entities.delete(id);
      throw error;
    }
    try {
      await table.put(id, record);
    } catch (error) {
      this.entities.delete(id);
      try {
        await this.setState(state);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], `workspace '${id}' record write and pending-marker rollback both failed`);
      }
      throw error;
    }
    try {
      await this.setState({
        ...state,
        pendingMutation: undefined,
        initialized: true,
        ...(firstUse ? { defaultWorkspaceId: id } : {}),
        workspaceIds: [id, ...state.workspaceIds],
      });
    } catch (error) {
      this.entities.delete(id);
      try {
        await table.delete(id);
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `workspace '${id}' order write and record rollback both failed; the pending marker remains recoverable`,
        );
      }
      try {
        await this.setState(state);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], `workspace '${id}' order write and pending-marker rollback both failed`);
      }
      throw error;
    }
    return entity;
  }

  /**
   * Xoá MỘT bản ghi đã biết, cập nhật thứ tự TRƯỚC rồi mới xoá bảng, và hoàn tác nếu bảng hỏng.
   * Nhận: id đăng ký cần bỏ.
   * Trả: promise của `true` khi xoá xong, `false` khi id lạ.
   */
  private async deleteKnown(id: WorkspaceId): Promise<boolean> {
    const entity = this.entities.get(id);
    if (entity === undefined) return false;
    const state = this.requireState();
    const nextState: WorkspaceDomainState = {
      ...state,
      pendingMutation: undefined,
      initialized: true,
      workspaceIds: state.workspaceIds.filter((workspaceId: WorkspaceId) => workspaceId !== id),
    };
    await this.setState({ ...nextState, pendingMutation: { operation: "delete", workspaceId: id } });
    this.entities.delete(id);
    try {
      await this.requireTable().delete(id);
    } catch (error) {
      this.entities.set(id, entity);
      try {
        await this.setState(state);
      } catch (rollbackError) {
        this.entities.delete(id);
        throw new AggregateError([error, rollbackError], `workspace '${id}' record deletion and registry-order rollback both failed`);
      }
      throw error;
    }
    try {
      await this.setState(nextState);
    } catch (error) {
      this.seam.logger.warn(`workspace '${id}' was deleted but its pending marker could not be cleared: ${String(error)}`);
    }
    return true;
  }

  /**
   * Hoàn tất ĐÚNG lượt thay đổi mà trạng thái bền nêu tên. Thứ tự/bảng lệch nhau KHÔNG giải thích được thì
   * vẫn tới {@link WorkspaceRegistry.validateStoredState} và NỔ THÀNH TIẾNG — đường này không bao giờ
   * đoán xem hình dạng một dòng là do phép nào tạo ra.
   * Nhận: không.
   * Trả: promise phân giải khi dấu treo đã được dọn (hoặc khi không có dấu nào).
   */
  private async recoverPendingMutation(): Promise<void> {
    const state = this.requireState();
    const pending = state.pendingMutation;
    if (pending === undefined) return;
    if (state.workspaceIds.includes(pending.workspaceId)) {
      throw new Error(
        `workspace domain is inconsistent: pending ${pending.operation} workspace '${pending.workspaceId}' is still present in registry order`,
      );
    }
    await this.requireTable().delete(pending.workspaceId);
    await this.setState({ ...state, pendingMutation: undefined });
  }

  /**
   * Lượt gieo lịch sử MỘT-LẦN: dựng workspace từ lịch sử CHỈ-TỪ-HEADER, nhóm theo `cwd` chuẩn tắc, rồi
   * chốt thứ tự hiển thị. Nhóm mới nhất đứng trước; trong một nhóm, phiên mới nhất đứng trước.
   * Nhận: header của MỌI phiên đã lưu (đã nằm trong chỉ mục `cwd`).
   * Trả: promise phân giải khi trạng thái `initialized` đã được đóng dấu.
   */
  private async bootstrap(headers: readonly SessionHeaderLike[]): Promise<void> {
    const table = this.requireTable();
    const state = this.requireState();
    const groupsByPath = new Map<string, SessionHeaderLike[]>();
    for (const header of headers) {
      const path = this.sessionPaths.get(header.id);
      if (path === undefined) continue;
      const group = groupsByPath.get(path);
      if (group === undefined) groupsByPath.set(path, [header]);
      else group.push(header);
    }
    const groups = [...groupsByPath]
      .map(([path, groupHeaders]) => {
        groupHeaders.sort(compareHeaders);
        return { path, headers: groupHeaders, newestAt: (groupHeaders[0] as SessionHeaderLike).createdAt };
      })
      .sort((left, right) => right.newestAt - left.newestAt || left.path.localeCompare(right.path));
    const byPath = new Map<string, WorkspaceId>();
    const accounted = new Map<SessionId, WorkspaceId>();
    for (const [id, record] of table.entries()) {
      byPath.set(record.path, id);
      for (const sessionId of record.sessionIds) accounted.set(sessionId, id);
    }
    for (const group of groups) {
      let id = byPath.get(group.path);
      if (id === undefined) {
        const sessionIds = group.headers.map((header: SessionHeaderLike) => header.id).filter((sessionId: SessionId) => !accounted.has(sessionId));
        if (sessionIds.length === 0) continue;
        id = randomUUID() as WorkspaceId;
        const createdAt = new Date(group.newestAt).toISOString();
        const record: WorkspaceRecord = {
          path: group.path,
          title: defaultWorkspaceTitle(group.path),
          sessionIds,
          createdAt,
          updatedAt: createdAt,
        };
        await table.put(id, record);
        byPath.set(group.path, id);
        for (const sessionId of sessionIds) accounted.set(sessionId, id);
        continue;
      }
      const current = table.get(id);
      if (current === undefined) continue;
      const historical = group.headers
        .map((header: SessionHeaderLike) => header.id)
        .filter((sessionId: SessionId) => accounted.get(sessionId) === undefined || accounted.get(sessionId) === id);
      const historicalSet = new Set(historical);
      const sessionIds = [...historical, ...current.sessionIds.filter((sessionId: SessionId) => !historicalSet.has(sessionId))];
      if (sameSessionIds(current.sessionIds, sessionIds)) continue;
      await table.update(id, (record) => ({ ...record, sessionIds, updatedAt: new Date().toISOString() }));
      for (const sessionId of historical) accounted.set(sessionId, id as WorkspaceId);
    }
    const groupRank = new Map<string, number>(groups.map((group) => [group.path, group.newestAt] as const));
    const priorRank = new Map<WorkspaceId, number>(state.workspaceIds.map((id: WorkspaceId, index: number) => [id, index] as const));
    const workspaceIds = [...table.entries()]
      .sort(([leftId, left], [rightId, right]) => {
        const leftTime = groupRank.get(left.path) ?? Date.parse(left.createdAt);
        return (
          (groupRank.get(right.path) ?? Date.parse(right.createdAt)) - leftTime ||
          (priorRank.get(leftId) ?? Number.MAX_SAFE_INTEGER) - (priorRank.get(rightId) ?? Number.MAX_SAFE_INTEGER) ||
          String(leftId).localeCompare(String(rightId))
        );
      })
      .map(([id]) => id);
    if (!sameIds(state.workspaceIds, workspaceIds)) {
      await this.setState({
        initialized: false,
        workspaceIds,
        archivedSessionIds: state.archivedSessionIds,
        pinnedSessionIds: state.pinnedSessionIds,
      });
    }
    await this.setState({
      initialized: true,
      workspaceIds,
      archivedSessionIds: state.archivedSessionIds,
      pinnedSessionIds: state.pinnedSessionIds,
    });
  }

  /**
   * Nhận nuôi phiên CÓ TRÊN ĐĨA mà sổ chưa ghi tên ai — hiện tượng LỆCH CHỈ MỤC, không phải lỗi đọc phiên.
   *
   * Vì sao cần: {@link bootstrap} là lượt MỘT-LẦN gác bằng dấu `initialized` VĨNH VIỄN. Mọi phiên xuất
   * hiện SAU dấu đó — home được chép từ máy khác, `bh migrate` mang `sessions/` sang, khôi phục backup,
   * hay một host KHÁC dùng chung home tạo phiên bằng `cwd` chứ không bằng `workspaceId` — đều KHÔNG bao
   * giờ vào sổ ⇒ sidebar chỉ còn nhóm workspace có sẵn, phần còn lại rơi vào "Chưa nhóm" (thu gọn).
   * Đo 10/11/2026 trên home `~/.galaxy/blackhole`: 614 thư mục phiên, sổ chỉ ghi 30 id (20 còn header)
   * ⇒ app hiện đúng 1 phiên trong nhóm `galaxy`.
   *
   * BA RÀNG BUỘC cố ý (để không phá hành vi bản gốc):
   * 1. CHỈ nhận nuôi vào workspace ĐÃ CÓ cho đúng đường dẫn chuẩn tắc — KHÔNG tự tạo workspace mới.
   *    Bản gốc coi "xoá workspace" là quyết định VĨNH VIỄN; tự tạo lại sẽ hồi sinh thứ người dùng đã xoá.
   * 2. CHỈ THÊM id: không xoá id cũ (kể cả id trỏ phiên đã mất), không đổi chủ giữa hai workspace.
   * 3. KHÔNG đụng thứ tự workspace (`workspaceIds`) — người dùng có thể đã kéo sắp lại bằng tay.
   *
   * Vì sao KHÔNG phá parity: chỉ chạy khi THẬT SỰ có phiên mồ côi giải được đường dẫn VÀ đã có workspace
   * cho đường dẫn đó; nhà bình thường (mọi phiên đã có chủ) thì trả 0 và KHÔNG ghi một byte nào.
   * Nhận: header của mọi phiên đã lưu (đã nằm trong chỉ mục `cwd` chuẩn tắc).
   * Trả: số phiên đã nhận nuôi (0 = sổ khớp đĩa, không ghi gì).
   */
  private async adoptOrphanedSessions(headers: readonly SessionHeaderLike[]): Promise<number> {
    const table = this.requireTable();
    const accounted = new Map<SessionId, WorkspaceId>();
    for (const [id, record] of table.entries()) {
      for (const sessionId of record.sessionIds) accounted.set(sessionId, id);
    }
    const orphansByPath = new Map<string, SessionHeaderLike[]>();
    for (const header of headers) {
      const path = this.sessionPaths.get(header.id);
      if (path === undefined || accounted.has(header.id)) continue;
      const group = orphansByPath.get(path);
      if (group === undefined) orphansByPath.set(path, [header]);
      else group.push(header);
    }
    if (orphansByPath.size === 0) return 0;
    const ownerOfPath = new Map<string, WorkspaceId>();
    for (const [id, record] of table.entries()) ownerOfPath.set(record.path, id);
    let adopted = 0;
    let touched = 0;
    for (const [path, groupHeaders] of orphansByPath) {
      const id = ownerOfPath.get(path);
      if (id === undefined) continue;
      const current = table.get(id);
      if (current === undefined) continue;
      const historical = [...groupHeaders]
        .sort(compareHeaders)
        .map((header) => header.id)
        .filter((sessionId) => !accounted.has(sessionId));
      if (historical.length === 0) continue;
      const incoming = new Set<SessionId>(historical);
      const sessionIds = [...historical, ...current.sessionIds.filter((sessionId) => !incoming.has(sessionId))];
      if (sameSessionIds(current.sessionIds, sessionIds)) continue;
      await table.update(id, (record) => ({ ...record, sessionIds, updatedAt: new Date().toISOString() }));
      for (const sessionId of historical) accounted.set(sessionId, id);
      adopted += historical.length;
      touched += 1;
    }
    if (touched === 0) return 0;
    this.seam.logger.warn(
      `workspace registry: nhận nuôi ${adopted} phiên có trên đĩa nhưng chưa thuộc workspace nào (${touched} workspace) — sổ đã "initialized" nên lượt gieo lịch sử không chạy lại`,
    );
    return adopted;
  }

  /**
   * Kiểm trạng thái đã lưu có TỰ NHẤT QUÁN không; mọi bất nhất đều NỔ THÀNH TIẾNG thay vì được sửa lặng
   * lẽ. Bốn bất biến: thứ tự không lặp id; mọi id trong thứ tự có bản ghi; khi đã `initialized` thì
   * KHÔNG bản ghi mồ côi; mỗi đường dẫn và mỗi phiên chỉ MỘT chủ.
   * Nhận: trạng thái bền cần kiểm.
   * Trả: không; NÉM khi vi phạm.
   */
  private validateStoredState(state: WorkspaceDomainState): void {
    const table = this.requireTable();
    const order = new Set<WorkspaceId>();
    for (const id of state.workspaceIds) {
      if (order.has(id)) throw new Error(`workspace domain is inconsistent: registry order repeats workspace '${id}'`);
      if (table.get(id) === undefined) {
        throw new Error(`workspace domain is inconsistent: registry order references missing workspace '${id}'`);
      }
      order.add(id);
    }
    if (state.initialized && order.size !== table.size) {
      const orphan = [...table.keys()].find((id: WorkspaceId) => !order.has(id));
      throw new Error(`workspace domain is inconsistent: workspace '${String(orphan)}' is absent from registry order`);
    }
    const paths = new Map<string, WorkspaceId>();
    const accounted = new Map<SessionId, WorkspaceId>();
    for (const [id, record] of table.entries()) {
      const pathHolder = paths.get(record.path);
      if (pathHolder !== undefined) {
        throw new Error(
          `workspace domain is inconsistent: path '${record.path}' is claimed by both workspace '${pathHolder}' and workspace '${id}'`,
        );
      }
      paths.set(record.path, id);
      for (const sessionId of record.sessionIds) {
        const holder = accounted.get(sessionId);
        if (holder !== undefined) {
          throw new Error(
            `workspace domain is inconsistent: session '${sessionId}' is accounted by both workspace '${holder}' and workspace '${id}'`,
          );
        }
        accounted.set(sessionId, id);
      }
    }
  }

  /**
   * Dựng lại toàn bộ bảng thực thể từ thứ tự bền (mỗi lượt khởi động).
   * Nhận: không.
   * Trả: không.
   */
  private rebuildEntities(): void {
    this.entities.clear();
    for (const id of this.requireState().workspaceIds) {
      const record = this.requireTable().get(id);
      if (record === undefined) continue;
      this.entities.set(id, new WorkspaceEntity(this.entityHost, id, record));
    }
  }

  /**
   * Thay TOÀN BỘ chỉ mục header bằng một ảnh chụp mới.
   * Nhận: header cần đánh chỉ mục.
   * Trả: promise phân giải khi mọi header đã vào chỉ mục.
   */
  private async replaceHeaderIndex(headers: readonly SessionHeaderLike[]): Promise<void> {
    this.headers.clear();
    this.sessionPaths.clear();
    this.missingSessionPaths.clear();
    this.invalidSessionPaths.clear();
    await this.indexHeaders(headers);
  }

  /**
   * Đánh chỉ mục một lô header.
   * Nhận: header cần đánh chỉ mục.
   * Trả: promise phân giải khi lô xong.
   */
  private async indexHeaders(headers: readonly SessionHeaderLike[]): Promise<void> {
    for (const header of headers) await this.indexHeader(header);
  }

  /**
   * Đánh chỉ mục MỘT header: `cwd` đầy đủ giải được thành thư mục có thật thì vào `sessionPaths`; `cwd`
   * đầy đủ mà `ENOENT` thì vào `missingSessionPaths` (GIỮ NGUYÊN tư cách thành viên đã có); mọi ca hỏng
   * khác vào `invalidSessionPaths` kèm lý do để viết log.
   * Nhận: header cần đánh chỉ mục.
   * Trả: promise phân giải khi xong.
   */
  private async indexHeader(header: SessionHeaderLike): Promise<void> {
    this.headers.set(header.id, header);
    this.sessionPaths.delete(header.id);
    this.missingSessionPaths.delete(header.id);
    if (header.cwd === undefined) {
      this.invalidSessionPaths.set(header.id, "header has no cwd");
      return;
    }
    try {
      const path = await realpathNormalize(header.cwd);
      if (!(await stat(path)).isDirectory()) {
        this.invalidSessionPaths.set(header.id, `cwd '${header.cwd}' is not a directory`);
        return;
      }
      this.sessionPaths.set(header.id, path);
      this.invalidSessionPaths.delete(header.id);
    } catch (error) {
      if (fullyQualifiedWorkspacePath(header.cwd) && error instanceof Error && "code" in error && error.code === "ENOENT") {
        this.missingSessionPaths.add(header.id);
      }
      this.invalidSessionPaths.set(header.id, `cwd '${header.cwd}' does not resolve`);
    }
  }

  /**
   * Header của MỌI phiên đã lưu, chiếu từ ảnh chụp liệt kê của session persistence.
   * Nhận: không.
   * Trả: promise của mảng header.
   */
  private async listStoredHeaders(): Promise<readonly SessionHeaderLike[]> {
    return (await this.seam.sessionPersistence.list()).map((snapshot) => snapshot.header);
  }

  /**
   * Đánh chỉ mục header của các phiên ĐANG SỐNG (không có sổ phiên thì không làm gì).
   * Nhận: không.
   * Trả: promise phân giải khi xong.
   */
  private async indexLiveSessions(): Promise<void> {
    const sessions = this.sessions();
    if (sessions === undefined) return;
    await this.indexHeaders(sessions.list().map((session) => session.header));
  }

  /**
   * Báo CẢNH BÁO cho mọi ứng viên đã bị phép chiếu lọc khỏi tư cách thành viên, kèm lý do đọc được.
   * Nhận: không.
   * Trả: không (chỉ ghi log).
   */
  private reportFilteredCandidates(): void {
    for (const entity of this.entities.values()) {
      const record = this.requireTable().get(entity.id);
      if (record === undefined) continue;
      for (const sessionId of record.sessionIds) {
        if (this.entityHost.candidateMatches(sessionId, record.path)) continue;
        const path = this.sessionPaths.get(sessionId);
        const reason =
          this.invalidSessionPaths.get(sessionId) ??
          (this.headers.has(sessionId)
            ? `canonical cwd '${String(path)}' differs from workspace path '${record.path}'`
            : "session header is missing");
        this.seam.logger.warn(`workspace '${entity.id}' filtered session '${sessionId}' from membership: ${reason}`);
      }
    }
  }

  /**
   * Đọc header của MỘT phiên để kiểm lúc gắn: ưu tiên phiên ĐANG SỐNG, rồi chỉ mục đã có, cuối cùng là
   * một lượt liệt kê persistence mới.
   * Nhận: phiên cần đọc header.
   * Trả: promise của header; NÉM khi không nguồn nào có phiên đó.
   */
  private async readSessionHeader(id: SessionId): Promise<SessionHeaderLike> {
    const live = this.sessions()?.get(id);
    if (live !== undefined) {
      this.headers.set(id, live.header);
      return live.header;
    }
    const cached = this.headers.get(id);
    if (cached !== undefined) return cached;
    const headers = await this.listStoredHeaders();
    await this.indexHeaders(headers);
    const header = this.headers.get(id);
    if (header === undefined) throw new Error(`cannot validate session '${id}': session persistence holds no such session`);
    return header;
  }

  /**
   * Giải bảng `workspaces` đã mở.
   * Nhận: không.
   * Trả: bảng; NÉM khi sổ đăng ký chưa khởi động xong.
   */
  private requireTable(): KvTableLike<WorkspaceId, WorkspaceRecord> {
    if (this.table === undefined) throw new Error("workspace registry is not started yet");
    return this.table;
  }

  /**
   * Đọc ảnh chụp trạng thái bền hiện tại.
   * Nhận: không.
   * Trả: trạng thái; NÉM khi sổ đăng ký chưa khởi động xong.
   */
  private requireState(): WorkspaceDomainState {
    if (this.state === undefined) throw new Error("workspace registry is not started yet");
    return this.state;
  }

  /**
   * Ghi trạng thái bền rồi tráo ảnh chụp trong bộ nhớ (chỉ tráo SAU khi môi trường lưu đã nhận).
   * Nhận: trạng thái kế.
   * Trả: promise phân giải khi bền; NÉM khi môi trường lưu hỏng (ảnh chụp cũ được giữ nguyên).
   */
  private async setState(state: WorkspaceDomainState): Promise<void> {
    const global = this.global;
    if (global === undefined) throw new Error("workspace registry is not started yet");
    await global.set(state);
    this.state = state;
  }

  /**
   * Xếp một lượt thay đổi vào ĐUÔI tuần tự của sổ đăng ký: mỗi lượt chạy sau khi lượt trước xong (kể cả
   * khi lượt trước HỎNG), và lượt dọn dấu treo chạy TRƯỚC thân lượt.
   * Nhận: hàm thân của lượt thay đổi.
   * Trả: promise của kết quả lượt đó; lỗi của lượt này KHÔNG chặn lượt sau.
   */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(async () => {
      await this.recoverPendingMutation();
      return await operation();
    });
    this.operationTail = result.then(
      () => {},
      () => {},
    );
    return result;
  }
}