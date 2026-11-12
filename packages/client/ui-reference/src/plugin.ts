/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Nua browser cua row ui-reference: nguon \`@\` hop nhat (file + phien) + hai rule van ban + hai chip inline
 */

import {
  crumbsFor,
  fileCandidate,
  parseCandidate,
  sessionCandidate,
  type Crumb,
  type FileCandidateRow,
  type RpcResult,
  type SessionCandidateRow,
  type Translator,
  type TriggerItem,
} from "./candidates.ts";
import { NS } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { fileReferenceRule, folderReferenceRule } from "./user-text-rules.ts";
import { createViews, type PrimitivesModule, type ReactHooks, type JsxRuntime } from "./view.ts";
import { fileAddressFor } from "./workspace-path.ts";
import { vi } from "./locales-vi.ts";

/** `require` do bảng module cấp cho factory (lazy-CJS, hợp đồng C2). */
export type RequireFn = (specifier: string) => unknown;

/** Service phía browser mà nửa client cần — giữ ĐÚNG 9 tên của bản gốc. */
export const inject: string[] = [
  "inputTriggers",
  "locale",
  "sessions",
  "remote",
  "remote.fileReferences",
  "remote.sessionReferenceResolver",
  "sidebarRight",
  "slots",
  "uiConversation",
];

/** Bề mặt plugin mà Loader cần ở mỗi entry. */
export interface PluginFace {
  /** Điểm vào phía browser. */
  apply(ctx: ClientContext): void;
  /** Seam service mà plugin cần. */
  inject: string[];
}

/** Phiên đang soạn (chỉ phần row này dùng). */
export interface ComposerSession {
  /** Id phiên. */
  sessionId: string;
}

/** Yêu cầu lấy ứng viên của seam input-trigger. */
export interface CandidateRequest {
  /** Văn bản sau dấu `@`. */
  query: string;
  /** Token đang là đường dẫn trong ngoặc (`@"…`). */
  quoted?: boolean;
  /** Lần gọi này do drill (đi sâu một cấp) hay do gõ. */
  drilled?: boolean;
  /** Tín hiệu huỷ của lần gọi. */
  signal: AbortSignal;
}

/** Kết quả một lần chọn trong menu `@`. */
export interface PickOutcome {
  /** Văn bản thay thế (dùng khi đi sâu một cấp). */
  text?: string;
  /** true khi ô soạn phải giữ menu mở để đi tiếp. */
  continue?: boolean;
  /** Tham chiếu đã chèn. */
  insert?: {
    /** Nguồn sinh ra tham chiếu. */
    source: string;
    /** Chuỗi tham chiếu trong văn bản. */
    ref: string;
    /** Nhãn hiển thị. */
    label: string;
    /** Hình thức chip. */
    appearance: string;
    /** Văn bản khi sao chép. */
    clipboardText: string;
  };
}

/** Nguồn `@` mà seam `inputTriggers` nhận. */
export interface TriggerSource {
  /** Ký tự kích hoạt. */
  trigger: string;
  /** Tên nguồn. */
  name: string;
  /** Nguồn này có tự hiện tiêu đề nhóm không. */
  showGroupTitle: boolean;
  /**
   * Liệt kê ứng viên cho một truy vấn.
   * Nhận: `session` — phiên đang soạn, `request` — truy vấn và tín hiệu huỷ.
   * Trả: danh sách mục menu (rỗng khi không có gì hoặc đã bị huỷ).
   */
  candidates(session: ComposerSession, request: CandidateRequest): Promise<TriggerItem[]>;
  /**
   * Breadcrumb của thư mục đang xem (chỉ khi đi sâu bằng drill).
   * Nhận: `session` — phiên, `request` — truy vấn.
   * Trả: danh sách crumb, hoặc `undefined`.
   */
  header(session: ComposerSession, request: { query: string; quoted?: boolean; drilled?: boolean }): Crumb[] | undefined;
  /**
   * Xử lý khi người dùng chọn một mục.
   * Nhận: `input` — mục đã chọn và hành động (nếu có).
   * Trả: kết quả chèn, hoặc `undefined` khi mục này không sinh tham chiếu.
   */
  onPick(input: { candidate: { value?: string }; action?: string }): PickOutcome | undefined;
  /**
   * Mở tham chiếu cũ bằng quyền của phiên.
   * Nhận: `session` — phiên, `input` — tham chiếu và hình thức chip.
   * Trả: true khi nguồn này xử lý được.
   */
  openReference(session: ComposerSession, input: { ref: string; appearance: string }): boolean;
  /** Mã hoá tham chiếu khi sao chép và khi gửi. */
  codec: {
    /** Trả văn bản khi người dùng sao chép tham chiếu. */
    clipboardText(ref: string): string;
    /** Trả chuỗi gửi lên Host. */
    serialize(ref: string): Promise<string>;
  };
}

/** Bản chụp trạng thái mở của một phiên (chỉ phần dùng). */
interface SessionOpenState {
  /** `open` khi phiên đã mở xong. */
  openState: string;
  /** Lỗi giữ phiên ở trạng thái không mở được. */
  openError?: Error;
}

/** Binding đang giữ một phiên đã mở. */
interface SessionBinding {
  /** Phiên được giữ. */
  binding: { session: { getSnapshot(): SessionOpenState } };
}

/** Bản ghi tóm tắt một phiên trong danh sách. */
interface SessionSummary {
  /** Gốc workspace của phiên. */
  cwd?: string;
  /** `subagent` khi phiên do một phiên khác sinh ra. */
  origin?: string;
  /** Phiên cha (khi là subagent). */
  parentId?: string;
  /** Mốc cập nhật gần nhất. */
  updatedAt?: number;
}

/** Seam `sessions` phía browser (chỉ phần dùng). */
export interface SessionsService {
  /**
   * Binding đang giữ phiên này (undefined khi phiên không còn được giữ).
   * Nhận: `sessionId` — id phiên.
   * Trả: binding hoặc `undefined`.
   */
  binding(sessionId: string): unknown;
  /**
   * Vào một phiên đã mở với tư cách một nguồn dữ liệu.
   * Nhận: `sessionId`, tuỳ chọn `{ source, signal }`, và hàm xử lý binding.
   * Trả: giá trị mà hàm xử lý trả về.
   */
  using<T>(
    sessionId: string,
    options: { source: string; signal: AbortSignal },
    callback: (binding: SessionBinding) => Promise<T>,
  ): Promise<T>;
  /** Danh sách phiên (bản chụp có `byId`). */
  list: { getSnapshot(): { byId: Record<string, SessionSummary | undefined> } };
}

/** Seam `remote` (chỉ hai namespace và `$host` mà row này dùng). */
export interface RemoteFace {
  /** Thông tin Host đứng sau kết nối. */
  $host: { home?: string };
  /** Tra tệp/thư mục trong workspace của một phiên. */
  fileReferences: {
    /**
     * Liệt kê ứng viên tệp/thư mục.
     * Nhận: `sessionId`, `query`, `signal`.
     * Trả: `Result` chứa danh sách ứng viên.
     */
    list(sessionId: string, query: string, signal: AbortSignal): Promise<RpcResult<FileCandidateRow[]>>;
  };
  /** Tra các phiên để nhắc tới. */
  sessionReferenceResolver: {
    /**
     * Liệt kê ứng viên phiên.
     * Nhận: `sessionId`, `query`, `signal`.
     * Trả: `Result` chứa danh sách ứng viên.
     */
    candidates(sessionId: string, query: string, signal: AbortSignal): Promise<RpcResult<SessionCandidateRow[]>>;
  };
}

/** Seam `inputTriggers` (chỉ phần dùng). */
export interface InputTriggersService {
  /**
   * Đăng ký một nguồn gợi ý cho ô soạn.
   * Nhận: `source` — nguồn `@`.
   * Trả: hàm gỡ đăng ký (nếu seam có).
   */
  registerSource(source: TriggerSource): unknown;
}

/** Context plugin phía browser (chỉ seam mà row này dùng). */
export interface ClientContext {
  /**
   * Gắn một hiệu ứng vào vòng đời plugin.
   * Nhận: hàm hiệu ứng (có thể trả hàm dọn dẹp) và nhãn chẩn đoán.
   * Trả: không.
   */
  effect(callback: () => unknown, label: string): void;
  /**
   * Lấy một service phía browser theo tên.
   * Nhận: `name` — tên service.
   * Trả: service (ném khi chưa có, vì `inject` đã bảo đảm thứ tự).
   */
  get<T>(name: string): T;
  /** Seam từ điển. */
  locale: {
    /** Đăng ký từ điển cho một namespace; trả hàm gỡ. */
    register(namespace: string, copy: Record<string, Record<string, string>>): () => void;
    /** Buộc namespace thành hàm dịch. */
    bind(namespace: string): Translator;
  };
  /** Seam sổ occupant của các slot. */
  slots: {
    /** Đăng ký vào một slot ngay khi slot đó sống. */
    inject(slot: string, register: () => unknown): void;
    /** Chiếm một chỗ trong slot; trả hàm gỡ. */
    register(definition: Record<string, unknown>, component: unknown): () => void;
  };
  /** Seam văn bản người dùng của hội thoại. */
  uiConversation: { userText: { register(rule: unknown): unknown } };
  /** Seam ngăn kéo phải. */
  sidebarRight: { openResource(address: string): void };
  /** Seam RPC đã inject. */
  remote: RemoteFace;
}

/**
 * Dựng nguồn `@` hợp nhất: ứng viên tệp/thư mục + ứng viên phiên, breadcrumb, chọn, mở lại.
 * Nhận: `ctx` — context phía browser, `sessions` — seam phiên, `t` — hàm dịch,
 *       `relativeTime` — hàm tính tuổi phiên của ui-primitives.
 * Trả: nguồn `@` để đăng ký vào seam input-trigger.
 */
function createSource(
  ctx: ClientContext,
  sessions: SessionsService,
  t: Translator,
  relativeTime: (at: number, now: number) => { unit: string; n: number },
): TriggerSource {
  return {
    trigger: "@",
    name: "reference",
    showGroupTitle: false,
    async candidates(session, { query, quoted, drilled, signal }): Promise<TriggerItem[]> {
      if (sessions.binding(session.sessionId) === undefined) {
        throw new Error('reference candidates require a retained session "' + session.sessionId + '"');
      }
      const [fileItems, sessionItems] = await sessions.using(
        session.sessionId,
        { source: "referenceCandidates", signal },
        async (reference) => {
          signal.throwIfAborted();
          const state = reference.binding.session.getSnapshot();
          if (state.openState !== "open") {
            throw state.openError ?? new Error('session "' + session.sessionId + '" is not open');
          }
          const fileLookup = ctx.remote.fileReferences
            .list(session.sessionId, query, signal)
            .then((result) => (result.ok ? result.value : []));
          const sessionLookup =
            quoted === true
              ? Promise.resolve<SessionCandidateRow[]>([])
              : ctx.remote.sessionReferenceResolver
                  .candidates(session.sessionId, query, signal)
                  .then((result) => (result.ok ? result.value : []));
          return Promise.all([fileLookup, sessionLookup]);
        },
      );
      if (signal.aborted) return [];
      const withLocation = crumbsFor(query, quoted === true, drilled === true, t) === undefined;
      const now = Date.now();
      const home = ctx.remote.$host.home;
      const listed = sessions.list.getSnapshot().byId;
      const sessionRows = sessionItems.map((candidate) => {
        const summary = listed[candidate.sessionId];
        const child = summary?.origin === "subagent" && summary.parentId === session.sessionId;
        return {
          child,
          row: sessionCandidate(
            candidate,
            candidate.displayTitle ?? candidate.label,
            summary?.updatedAt ?? candidate.createdAt,
            now,
            home,
            t(child ? "section.subagents" : "section.sessions"),
            t,
            relativeTime,
          ),
        };
      });
      return [
        ...fileItems.flatMap((candidate) => fileCandidate(candidate, quoted === true, withLocation, t)),
        ...sessionRows.filter((item) => item.child).map((item) => item.row),
        ...sessionRows.filter((item) => !item.child).map((item) => item.row),
      ];
    },
    header(_session, request): Crumb[] | undefined {
      return crumbsFor(request.query, request.quoted === true, request.drilled === true, t);
    },
    onPick({ candidate, action }): PickOutcome | undefined {
      const value = parseCandidate(candidate.value);
      if (value?.kind === "file") {
        if (value.fileKind === "directory" && action === "drill") {
          return { text: value.mention, continue: true };
        }
        const directory = value.fileKind === "directory";
        return {
          insert: {
            source: "reference",
            ref: value.mention,
            label: directory ? value.label + "/" : value.label,
            appearance: directory ? "folder" : "file",
            clipboardText: value.mention,
          },
        };
      }
      if (value?.kind === "session") {
        return {
          insert: {
            source: "reference",
            ref: value.mention,
            label: value.label,
            appearance: "session",
            clipboardText: value.mention,
          },
        };
      }
      return undefined;
    },
    openReference(session, { ref, appearance }): boolean {
      if (appearance !== "file") return false;
      const path = ref.startsWith('@"') ? ref.slice(2, -1) : ref.slice(1);
      const cwd = sessions.list.getSnapshot().byId[session.sessionId]?.cwd;
      ctx.sidebarRight.openResource(fileAddressFor(session.sessionId, cwd, path));
      return true;
    },
    codec: {
      clipboardText: (ref: string): string => ref,
      serialize: (ref: string): Promise<string> => Promise.resolve(ref),
    },
  };
}

/**
 * Cờ "đã cài" ở PHẠM VI MODULE (không phải trong `apply`, cũng không trong `createPlugin`).
 *
 * Vì sao: row hai id làm loader gọi factory hai lần ⇒ hai plugin instance ⇒ `apply` chạy lần hai ⇒ đăng ký lại
 * slot/từ điển ⇒ cordis ném lỗi ⇒ row kẹt `loading` ⇒ mọi row stock inject nó cũng kẹt. Cờ ở phạm vi module
 * chặn đúng lần cài thứ hai dù factory được gọi lại (tm-host-api đã đối chứng trước/sau: 3 row của họ activate,
 * 17 row hai-id khác vẫn `loading`). Khi tầng nạp dùng lại cùng plugin instance thì đây là phòng thủ nhiều lớp.
 */
let bundleInstalled = false;

/**
 * Dựng mặt plugin của row ui-reference.
 * @param requireFn - hàm require của Loader trong trang.
 * @returns đối tượng plugin ({ apply, inject }).
 */
export function createPlugin(requireFn: RequireFn): PluginFace {
  const hooks = requireFn("react") as ReactHooks;
  const views = createViews({
    hooks,
    jsx: requireFn("react/jsx-runtime") as JsxRuntime,
    primitives: requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule,
  });
  const relativeTime = (requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule & {
    relativeTime(at: number, now: number): { unit: string; n: number };
  }).relativeTime;

  /**
   * Đăng ký từ điển, hai rule văn bản, hai chip inline và nguồn `@` hợp nhất.
   * Nhận: `ctx` — context phía browser.
   * Trả: không.
   */
  function apply(ctx: ClientContext): void {
    if (bundleInstalled) {
      console.warn("gbh-client-ui-reference: bundle da duoc cai, bo qua lan thu hai");
      return;
    }
    try {
      applyInner(ctx);
      /* CHỈ bật sau khi đăng ký XONG: nếu applyInner ném giữa đường thì cờ KHÔNG được khoá,
         nếu không lần cài thứ hai sẽ không đăng ký gì ⇒ slot rỗng ⇒ renderer gặp undefined ⇒ React #130. */
      bundleInstalled = true;
    } catch (error) {
      /* Cordis NUỐT lỗi trong apply ⇒ không có dòng này thì không ai biết vì sao row kẹt loading. Vẫn ném lại. */
      console.error("gbh-client-ui-reference: apply nem loi", error);
      throw error;
    }
  }

  /**
   * Thân cài đặt thật của lần cài ĐẦU TIÊN.
   * @param ctx - context phía browser.
   */
  function applyInner(ctx: ClientContext): void {
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-reference: dictionaries");
    const t = ctx.locale.bind(NS);
    const sessions = ctx.get<SessionsService>("sessions");
    ctx.uiConversation.userText.register(fileReferenceRule);
    ctx.uiConversation.userText.register(folderReferenceRule);
    ctx.slots.inject("conversation.user.text.node", function* () {
      yield ctx.slots.register(
        {
          name: "conversation.user.text.node",
          key: "file",
          priority: 100,
          locale: NS,
          inject: (sessionId: string) => ({
            openFile: (path: string) => {
              const cwd = sessions.list.getSnapshot().byId[sessionId]?.cwd;
              ctx.sidebarRight.openResource(fileAddressFor(sessionId, cwd, path));
            },
          }),
        },
        views.FileReference,
      );
      yield ctx.slots.register(
        { name: "conversation.user.text.node", key: "folder", priority: 100 },
        views.FolderReference,
      );
    });
    const source = createSource(ctx, sessions, t, relativeTime);
    const inputTriggers = ctx.get<InputTriggersService>("inputTriggers");
    ctx.effect(() => inputTriggers.registerSource(source), "ui-reference: @ source");
  }

  return { apply, inject };
}
