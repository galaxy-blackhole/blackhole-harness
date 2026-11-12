/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chủ sở hữu Remote của Workspace phía Host — bản viết lại 1:1 vùng `lib/types/index.js` của
 *      `@deepseek-ai/dsh-api-workspace-controller` (stock `lib/index.js` dòng 643–1048, BỎ 38 dòng helper
 *      emit `__runInitializers`/`__esDecorate` vì decorator TS biên dịch native): class
 *      `WorkspaceController` phục vụ namespace `ctx.remote.workspace` với 11 điểm cuối và `assertNever`.
 */

import z from "@deepseek-ai/schemastery";
import { Remote, RemoteError, TypertRemoteService, remoteErrorOf } from "@galaxy-blackhole/gbh-typert-protocol";

import { WorkspaceCommands } from "./commands.ts";
import { DirectoryPickerController } from "./directory-picker.ts";
import { defaultWorkspaceDirectory, validateDocumentsDirectory } from "./defaults.ts";
import { WorkspaceFeed, workspaceView } from "./feed.ts";

import type { Context } from "@deepseek-ai/cordis";
import type { SessionId } from "@galaxy-blackhole/gbh-session";
import type { Workspace, WorkspaceId } from "@galaxy-blackhole/gbh-workspace";
import type {
  WorkspaceArchiveSessionRequest,
  WorkspaceArchiveValue,
  WorkspaceBaseline,
  WorkspaceCreateRequest,
  WorkspaceCreateValue,
  WorkspaceDeleteRequest,
  WorkspaceDeleteValue,
  WorkspaceFollowFrame,
  WorkspaceInsertBeforeRequest,
  WorkspaceInsertSessionBeforeRequest,
  WorkspaceOrderValue,
  WorkspacePinSessionRequest,
  WorkspacePinValue,
  WorkspaceRenameRequest,
  WorkspaceUnarchiveSessionRequest,
  WorkspaceUnpinSessionRequest,
  WorkspaceValue,
} from "./types.ts";

/** Chính sách thư mục lần dùng đầu cho tài khoản Host. */
export interface Config {
  /** Ghi đè thư mục Documents của hệ thống bằng một đường dẫn đủ tuyệt đối. */
  documentsDirectory?: string;
  /** Thời lượng TỐI ĐA của phép tra thư mục Documents của hệ điều hành. */
  documentsLookupTimeoutMs?: number;
}

/** Chính sách thư mục SAU khi schema đã áp mặc định. */
type ResolvedConfig = Config & { documentsLookupTimeoutMs: number };

/**
 * Bề mặt context mà controller gọi tới, khai theo CẤU TRÚC để không phụ thuộc augmentation của gói khác
 * (bản gốc gọi thẳng `ctx.typert`, `ctx.remoteAccess` và `ctx.workspaceRegistry`).
 */
interface WorkspaceControllerContext {
  /** Bộ tra cứu Typert: nơi đăng ký trường wire mặc định của kind tài nguyên `workspace`. */
  readonly typert: {
    /** Sổ tài nguyên của Gateway; `register` trả hàm dọn gỡ. */
    readonly resources: { register(kind: string, declaration: { readonly field: string }): () => void };
  };
  /** Sổ quyết định truy cập của Gateway cho principal KHÔNG phải chủ. */
  readonly remoteAccess: {
    /** Tài nguyên mà lời gọi đang phục vụ có được phép đọc hay không. */
    allows(resource: { readonly kind: string; readonly id: string }): boolean;
  };
  /** Sổ đăng ký Workspace có thẩm quyền. */
  readonly workspaceRegistry: {
    /** Khởi tạo Workspace mặc định khi lần dùng đầu còn đủ điều kiện; trả `undefined` khi không. */
    initializeDefault(resolveDirectory: () => Promise<string>): Promise<Workspace | undefined>;
  };
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** API nghiệp vụ Workspace phía Host và chủ của namespace Remote. */
    workspaceController: WorkspaceController;
  }
}

/** Service Host đứng sau namespace `ctx.remote.workspace` sinh tự động. */
export class WorkspaceController extends TypertRemoteService {
  /** Ba seam phải sẵn sàng trước khi service thức dậy: quyền truy cập, bộ tra cứu Typert, sổ đăng ký. */
  static inject = ["remoteAccess", "typert", "workspaceRegistry"];

  /** Schema Loader: ghi đè thư mục Documents và hạn chót tra cứu (mặc định 10 giây, nguyên văn bản gốc). */
  static Config: z<Config, ResolvedConfig> = z.object({
    documentsDirectory: z.string(),
    documentsLookupTimeoutMs: z.natural().min(1).default(1e4),
  }) as unknown as z<Config, ResolvedConfig>;

  /** Chính sách thư mục lần dùng đầu đã phân giải của deployment. */
  private readonly config: ResolvedConfig;

  /** Thực thi các lệnh biến đổi Workspace trên sổ đăng ký. */
  private readonly commands: WorkspaceCommands;

  /** Dòng trạng thái Workspace an toàn khi nối lại. */
  private readonly feed: WorkspaceFeed;

  /**
   * Đăng ký service dưới khoá `workspaceController`, gắn namespace wire `workspace`, đăng ký trường
   * tài nguyên mặc định, và nạp controller chọn thư mục.
   * Nhận: context Host mang sổ đăng ký Workspace; chính sách thư mục lần dùng đầu (có thể rỗng).
   * Trả: không — cordis dùng ngay thể hiện sau khi dựng.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, "workspaceController", { namespace: "workspace" });
    this.seam.typert.resources.register("workspace", { field: "workspaceId" });
    this.config = WorkspaceController.Config(config);
    if (this.config.documentsDirectory !== undefined) validateDocumentsDirectory(this.config.documentsDirectory);
    this.commands = new WorkspaceCommands(ctx);
    this.feed = new WorkspaceFeed(ctx);
    ctx.plugin(DirectoryPickerController);
  }

  /**
   * Context nhìn qua ĐÚNG bề mặt mà controller gọi.
   * Nhận: không.
   * Trả: context đã ép kiểu tại đúng ranh giới này.
   */
  private get seam(): WorkspaceControllerContext {
    return this.ctx as unknown as WorkspaceControllerContext;
  }

  /**
   * Tạo hoặc phân giải IDEMPOTENT một Workspace trên thư mục đã tồn tại.
   * Nhận: yêu cầu mang đường dẫn thư mục cần đăng ký.
   * Trả: Workspace và cờ cho biết lần gọi này có tạo mới hay không.
   */
  @Remote("create")
  create(request: WorkspaceCreateRequest): Promise<WorkspaceCreateValue> {
    return this.commands.create(request);
  }

  /**
   * Khởi tạo hoặc dùng lại Workspace mặc định lúc khởi động lần dùng đầu. Tên thư mục là CỐ ĐỊNH nên Host
   * không bao giờ đổi tên hay di chuyển bản mặc định đã có; tiêu đề ban đầu là chính tên đó, và bên tiêu
   * thụ trình duyệt gắn nhãn theo ngôn ngữ của người đọc.
   * Nhận: vòng đời bên gọi; huỷ sẽ huỷ phép tra thư mục native.
   * Trả: Workspace bền vững, hoặc `undefined` khi lần dùng đầu không đủ điều kiện; KHÔNG tạo Session hay tin nhắn.
   */
  @Remote("initializeDefault")
  async initializeDefault(signal: AbortSignal): Promise<WorkspaceValue | undefined> {
    const workspace = await this.seam.workspaceRegistry.initializeDefault(async () => {
      const timeout = AbortSignal.timeout(this.config.documentsLookupTimeoutMs);
      return await defaultWorkspaceDirectory(this.config.documentsDirectory, AbortSignal.any([signal, timeout]));
    });
    return workspace === undefined ? undefined : { workspace: workspaceView(workspace) };
  }

  /**
   * Đổi tên MỘT Workspace thành tiêu đề không rỗng và duy nhất.
   * Nhận: yêu cầu mang định danh Workspace và tiêu đề đề xuất.
   * Trả: bản chiếu Workspace sau khi đổi.
   */
  @Remote("rename")
  rename(request: WorkspaceRenameRequest): Promise<WorkspaceValue> {
    return this.commands.rename(request);
  }

  /**
   * Gỡ MỘT đăng ký Workspace trong khi GIỮ LẠI tệp và các Session.
   * Nhận: yêu cầu mang định danh Workspace cần gỡ.
   * Trả: biên nhận xoá.
   */
  @Remote("delete")
  delete(request: WorkspaceDeleteRequest): Promise<WorkspaceDeleteValue> {
    return this.commands.delete(request);
  }

  /**
   * Di chuyển MỘT Workspace trong thứ tự hiển thị của sổ đăng ký.
   * Nhận: yêu cầu mang Workspace cần di chuyển và mỏ neo tuỳ chọn.
   * Trả: toàn bộ thứ tự Workspace sau phép di chuyển.
   */
  @Remote("insertBefore")
  insertBefore(request: WorkspaceInsertBeforeRequest): Promise<WorkspaceOrderValue> {
    return this.commands.insertBefore(request);
  }

  /**
   * Di chuyển MỘT Session đã được tính trong MỘT Workspace.
   * Nhận: yêu cầu mang định danh Workspace, Session và mỏ neo tuỳ chọn.
   * Trả: bản chiếu Workspace sau khi di chuyển.
   */
  @Remote("insertSessionBefore")
  insertSessionBefore(request: WorkspaceInsertSessionBeforeRequest): Promise<WorkspaceValue> {
    return this.commands.insertSessionBefore(request);
  }

  /**
   * Ẩn MỘT Session đã biết khỏi các bề mặt nhóm theo Workspace.
   * Nhận: yêu cầu mang định danh Session cần lưu trữ.
   * Trả: toàn bộ tập Session đã lưu trữ sau phép đổi.
   */
  @Remote("archiveSession")
  archiveSession(request: WorkspaceArchiveSessionRequest): Promise<WorkspaceArchiveValue> {
    return this.commands.archiveSession(request);
  }

  /**
   * Trả MỘT Session đã lưu trữ về các bề mặt nhóm theo Workspace.
   * Nhận: yêu cầu mang định danh Session cần bỏ lưu trữ.
   * Trả: toàn bộ tập Session đã lưu trữ sau phép đổi.
   */
  @Remote("unarchiveSession")
  unarchiveSession(request: WorkspaceUnarchiveSessionRequest): Promise<WorkspaceArchiveValue> {
    return this.commands.unarchiveSession(request);
  }

  /**
   * Đưa MỘT Session đã biết và chưa lưu trữ lên trước các Session chưa ghim.
   * Nhận: yêu cầu mang định danh Session cần ghim.
   * Trả: toàn bộ tập Session đã ghim, ghim gần nhất đứng đầu.
   */
  @Remote("pinSession")
  pinSession(request: WorkspacePinSessionRequest): Promise<WorkspacePinValue> {
    return this.commands.pinSession(request);
  }

  /**
   * Gỡ ghim của MỘT Session mà KHÔNG đổi thứ tự Session đã lưu.
   * Nhận: yêu cầu mang định danh Session cần bỏ ghim.
   * Trả: toàn bộ tập Session đã ghim, ghim gần nhất đứng đầu.
   */
  @Remote("unpinSession")
  unpinSession(request: WorkspaceUnpinSessionRequest): Promise<WorkspacePinValue> {
    return this.commands.unpinSession(request);
  }

  /**
   * Phát MỘT baseline Workspace đầy đủ, rồi các increment có thứ tự. Principal không phải chủ chỉ nhận
   * Workspace và Session mà `allows()` chấp nhận. Khi một Workspace đã giao không còn được chấp nhận ở
   * lần đổi kế tiếp — hoặc ở lần đổi thứ tự kế tiếp — dòng gửi khung `replace` mang toàn bộ trạng thái đã
   * lọc thay vì `remove`, vì Client KHÔNG BAO GIỜ hồi sinh một Workspace đã bị gỡ; khung `remove` báo một
   * lần xoá thật và chỉ tới Client đã nhận Workspace đó.
   * Nhận: tín hiệu huỷ của thế hệ.
   * Trả: baseline rồi tới các increment Workspace có thứ tự.
   */
  @Remote({ mode: "stream" })
  async *follow(signal: AbortSignal): AsyncIterable<WorkspaceFollowFrame> {
    const access = this.seam.remoteAccess;
    const visible = (workspaceId: WorkspaceId): boolean => access.allows({ kind: "workspace", id: workspaceId });
    const sessions = (sessionIds: readonly SessionId[]): SessionId[] =>
      sessionIds.filter((sessionId) => access.allows({ kind: "session", id: sessionId }));
    /** Các Workspace mà thế hệ này đã giao và CHƯA gỡ. */
    const delivered = new Set<WorkspaceId>();
    /** Phần ĐƯỢC CHẤP NHẬN của `value`; nó trở thành tập đã giao. */
    const filtered = (value: WorkspaceBaseline): WorkspaceBaseline => {
      const items = value.items.filter((item) => visible(item.workspaceId));
      delivered.clear();
      for (const item of items) delivered.add(item.workspaceId);
      return {
        items: items.map((item) => ({
          ...item,
          sessionIds: sessions(item.sessionIds),
        })),
        archivedSessionIds: sessions(value.archivedSessionIds),
        pinnedSessionIds: sessions(value.pinnedSessionIds),
      };
    };
    for await (const frame of this.feed.follow(signal)) {
      switch (frame.type) {
        case "baseline":
          yield {
            type: "baseline",
            value: filtered(frame.value),
          };
          break;
        case "upsert": {
          const workspaceId = frame.workspace.workspaceId;
          if (visible(workspaceId)) {
            delivered.add(workspaceId);
            yield {
              type: "upsert",
              workspace: {
                ...frame.workspace,
                sessionIds: sessions(frame.workspace.sessionIds),
              },
            };
          } else if (delivered.has(workspaceId)) {
            yield {
              type: "replace",
              value: filtered(this.feed.baseline()),
            };
          }
          break;
        }
        case "remove":
          if (delivered.delete(frame.workspaceId)) yield frame;
          break;
        case "order":
          if (frame.workspaceIds.some((workspaceId) => delivered.has(workspaceId) && !visible(workspaceId))) {
            yield {
              type: "replace",
              value: filtered(this.feed.baseline()),
            };
          } else {
            yield {
              type: "order",
              workspaceIds: frame.workspaceIds.filter(visible),
            };
          }
          break;
        case "archived":
          yield {
            type: "archived",
            archivedSessionIds: sessions(frame.archivedSessionIds),
          };
          break;
        case "pinned":
          yield {
            type: "pinned",
            pinnedSessionIds: sessions(frame.pinnedSessionIds),
          };
          break;
        /* v8 ignore next -- closed follow-frame union. */
        default:
          assertNever(frame);
      }
    }
  }
}

/**
 * Chốt cuối của hợp ĐÓNG: frame nào lọt tới nhánh `default` là bất khả.
 * Nhận: frame đã bị thu hẹp về `never`.
 * Trả: không trả gì — luôn ném lỗi.
 */
/* v8 ignore next 3 -- closed-union backstop. */
function assertNever(value: never): never {
  throw new Error(`unreachable Workspace follow frame: ${JSON.stringify(value)}`);
}
