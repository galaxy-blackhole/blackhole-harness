/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nửa CLIENT của session-log-export — port NGUYÊN VĂN 317 dòng lib/client.js của gói gốc: bảng tải
 *      Session trên Header + hộp thoại trạng thái dùng chung + từ điển zh/en + phản ứng lệnh /export.
 *      SEAM CẤU TRÚC: createPlugin(require) nhận bảng module của harness, KHÔNG import gói client nào và
 *      KHÔNG augment module (luật ADR 000d). Artifact tự khai ĐÚNG MỘT id — id của ta.
 */

/**
 * Id module DUY NHẤT mà artifact tự khai (luật MỘT-ID). Id gốc KHÔNG có trong tệp này lẫn artifact:
 * tầng nạp sinh entry alias từ gbh.row.aliases khi gói được mount.
 * Nhận: không.
 * Trả: tên package dùng làm id module và chủ sở hữu thẻ CSS.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-session-log-export";

/** Hàm require do bảng module cấp cho factory (seam cấu trúc — không import tĩnh gói client nào). */
type RequireFn = (specifier: string) => unknown;

/** Store quan sát được mà seam client-store cấp (uSES-safe). */
interface SnapshotStore<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot(): T;
  /** Ghi đè ảnh chụp. */
  set(next: T): void;
  /** Sửa ảnh chụp tại chỗ rồi công bố. */
  update(mutate: (draft: T) => void): void;
}

/** Bảng service của seam client-store (chỉ phần tệp này dùng). */
interface ClientStoreModule {
  /** Tạo một snapshot store từ giá trị đầu. */
  createSnapshotStore<T>(initial: T): SnapshotStore<T>;
}

/** Runtime JSX do bảng module cấp (react/jsx-runtime). */
interface JsxRuntime {
  /** Một phần tử. */
  jsx(type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown;
  /** Nhiều phần tử con. */
  jsxs(type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown;
  /** Mảnh bao ngoài. */
  Fragment: unknown;
}

/** Hook React mà tệp này dùng (react). */
interface ReactHooks {
  /** State cục bộ của một component. */
  useState<T>(initial: T): readonly [T, (next: T | ((value: T) => T)) => void];
}

/** Primitive UI do bảng module cấp (dsh-client-ui-primitives). */
interface PrimitivesModule {
  /** Hộp thoại. */
  Modal: unknown;
  /** Nút. */
  Button: unknown;
  /** Menu. */
  Menu: unknown;
  /** Icon tải xuống. */
  IconDownloadOutlineRegular: unknown;
  /** Icon gửi phản hồi. */
  IconPaperPlaneOutlineRegular: unknown;
  /** Icon ba chấm. */
  IconEllipsisOutlineRegular: unknown;
}

/** Pha tải xuống mà hộp thoại dùng chung trình bày. */
type SessionLogDownloadStatus = "downloading" | "success" | "error";

/** Trạng thái hộp thoại của MỘT Session. */
interface SessionLogDownloadEntry {
  /** Hộp thoại đang mở. */
  readonly open: boolean;
  /** Pha hiện tại. */
  readonly status: SessionLogDownloadStatus;
  /** Thông điệp lỗi gần nhất, hoặc null. */
  readonly error: string | null;
}

/** Trạng thái tải xuống khoá theo Session sở hữu hộp thoại. */
interface SessionLogDownloadState {
  /** Bản đồ Session id → trạng thái hộp thoại. */
  bySession: Record<string, SessionLogDownloadEntry | undefined>;
}

/** Bộ vận chuyển HTTP của route xuất ZIP. */
type SessionLogFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

/** Thao tác lưu của trình duyệt. */
type SessionLogSave = (url: string, filename: string) => void;

/** Một lượt tải đang chạy của MỘT Session. */
interface ActiveDownload {
  /** Bộ điều khiển huỷ của lượt tải. */
  readonly abort: AbortController;
  /** Lời hứa kết thúc lượt tải. */
  readonly done: Promise<void>;
}

/** Hàm dọn dẹp mà ctx.effect nhận (đồng bộ hoặc bất đồng bộ). */
type EffectCleanup = void | (() => void) | (() => Promise<void>);

/** Phạm vi mà ctx.inject cấp cho callback (chỉ cần effect). */
interface ClientInjectScope {
  /** Đăng ký một hiệu ứng có vòng đời. */
  effect(run: () => EffectCleanup, label?: string): void;
}

/** Định nghĩa một slot occupant mà Header action đăng ký. */
interface SlotDefinition {
  /** Tên slot. */
  readonly name: string;
  /** Id occupant (KHÔNG phải id module). */
  readonly id: string;
  /** Namespace từ điển của occupant. */
  readonly locale: string;
  /** Mặt tiêm (hooks + hành động) mà slot runtime truyền vào component. */
  readonly inject: () => Record<string, unknown>;
}

/** Context phía browser (chỉ khai phần tệp này chạm tới). */
interface ClientContext {
  /** Cấp một service cho plugin khác. */
  provide(name: string, service: unknown): void;
  /** Đăng ký hiệu ứng có vòng đời. */
  effect(run: () => EffectCleanup, label?: string): void;
  /** Khi một service xuất hiện thì chạy callback trong phạm vi của nó. */
  inject(names: readonly string[], callback: (scope: ClientInjectScope) => void): void;
  /** Nghe một sự kiện của runtime. */
  on(event: string, listener: (sessionId: string, commandName: string, result: { readonly kind: string }) => void): void;
  /** Đọc một service đã có (có thể vắng). */
  get(name: string): { openSession(sessionId: string): void } | undefined;
  /** Sổ từ điển. */
  locale: {
    /** Đăng ký từ điển của một namespace; trả hàm gỡ. */
    register(namespace: string, copy: { zh: Record<string, string>; en: Record<string, string> }): () => void;
  };
  /** Sổ slot của giao diện. */
  slots: {
    /** Chờ một slot xuất hiện rồi đăng ký occupant. */
    inject(name: string, callback: () => unknown): unknown;
    /** Đăng ký một occupant; trả hàm gỡ. */
    register(definition: SlotDefinition, component: unknown): () => void;
  };
}

/** Hợp đồng plugin phía browser mà factory trả về. */
interface SessionLogClientPlugin {
  /** Cài nửa client vào context. */
  apply(ctx: ClientContext): void;
  /** Service mà nửa client cần. */
  readonly inject: string[];
}

/**
 * Dạng trình duyệt-tương-đối của đường dẫn xuất ZIP mà Host sở hữu.
 * Nhận: không.
 * Trả: đường dẫn tương đối với tài liệu ("api/session.export").
 */
export const SESSION_LOG_EXPORT_ROUTE = "/api/session.export".slice(1);

/**
 * Trạng thái tải xuống ban đầu, dùng chung cho nút trên Session Header và lệnh /export.
 * Nhận: không.
 * Trả: bản đồ Session rỗng.
 */
export const INITIAL: SessionLogDownloadState = { bySession: {} };

/**
 * Ép một Session id không tin cậy về quy ước tên tệp của endpoint Host.
 * Nhận: sessionId — Session cần tải ZIP.
 * Trả: một tên tệp tải xuống an toàn cho trình duyệt.
 */
export function sessionLogZipFilename(sessionId: string): string {
  return `dsh-session-${String(sessionId).replace(/[^A-Za-z0-9_-]/g, "_")}.zip`;
}

/**
 * Trao route tải của Host cho bộ quản lý tải xuống của trình duyệt, nơi tự phân giải route theo
 * base của chính tài liệu.
 * Nhận: url — route tải tương đối với tài liệu; filename — tên tệp tải xuống.
 * Trả: không.
 */
export function downloadUrl(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

/**
 * Rút thông điệp hiển thị từ một giá trị bị ném.
 * Nhận: error — giá trị bất kỳ bị ném.
 * Trả: thông điệp của Error, hoặc dạng chuỗi của giá trị.
 */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * CSS của Header action — NGUYÊN VĂN từng byte, giữ hash lớp của bản gốc.
 * Nhận: không.
 * Trả: chuỗi CSS của nút "more".
 */
export const HEADER_ACTION_CSS =
  ".nL4_yW_moreButton{width:28px;color:var(--dsw-alias-label-secondary);flex:none;padding:0}.nL4_yW_moreButton svg{width:15px;height:15px}";

/**
 * Bảng tên lớp của Header action — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: ánh xạ tên lớp "moreButton" → hash gốc.
 */
export const HEADER_ACTION_CLASS = { moreButton: "nL4_yW_moreButton" } as const;

/**
 * Namespace từ điển do phản hồi tải Session sở hữu.
 * Nhận: không.
 * Trả: tên namespace "session-log-download".
 */
export const NS = "session-log-download";

/**
 * Chuỗi tiếng Trung giản thể của tính năng xuất Session.
 * Nhận: không.
 * Trả: từ điển zh (NGUYÊN VĂN bản gốc).
 */
export const zh = {
  "header.more": "更多操作",
  "menu.download": "下载 Session 日志",
  "menu.feedback": "反馈",
  "dialog.preparingTitle": "正在导出 Session",
  "dialog.preparingDescription": "正在准备包含当前 Session、子 Session 和附件的 ZIP 文件。",
  "dialog.successTitle": "Session 导出已开始下载",
  "dialog.successDescription": "浏览器正在下载 Session ZIP 文件。",
  "dialog.errorTitle": "Session 导出失败",
  "dialog.close": "关闭",
  "dialog.commandFailed": "无法启动 Session 导出。",
} as const;

/** Khoá từ điển ổn định mà hộp thoại dùng chung tiêu thụ. */
type SessionLogDownloadKey = keyof typeof zh;

/**
 * Chuỗi tiếng Anh của tính năng xuất Session — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: từ điển en đủ mọi khoá của zh.
 */
export const en: Record<SessionLogDownloadKey, string> = {
  "header.more": "More actions",
  "menu.download": "Download session log",
  "menu.feedback": "Feedback",
  "dialog.preparingTitle": "Exporting Session",
  "dialog.preparingDescription": "Preparing a ZIP containing this Session, its sub-Sessions, and attachments.",
  "dialog.successTitle": "Session download started",
  "dialog.successDescription": "The browser is downloading the Session ZIP.",
  "dialog.errorTitle": "Session export failed",
  "dialog.close": "Close",
  "dialog.commandFailed": "Could not start the Session export.",
};

/**
 * Plugin phía browser sở hữu trạng thái tải Session và hộp thoại dùng chung.
 * Nhận: không.
 * Trả: danh sách service mà nửa client cần (["slots", "locale"]).
 */
export const inject: string[] = ["slots", "locale"];

/**
 * Dựng nửa client từ bảng module của harness: controller tải, hộp thoại, Header action, từ điển và apply.
 * Nhận: requireFn — hàm require do bảng module cấp (client-store · react · react/jsx-runtime · ui-primitives).
 * Trả: { apply, inject } đúng hợp đồng plugin phía browser.
 */
export function createPlugin(requireFn: RequireFn): SessionLogClientPlugin {
  const storeModule = requireFn("@galaxy-blackhole/gbh-client-store") as ClientStoreModule;
  const { jsx, jsxs, Fragment } = requireFn("react/jsx-runtime") as JsxRuntime;
  const { useState } = requireFn("react") as ReactHooks;
  const {
    Modal,
    Button,
    Menu,
    IconDownloadOutlineRegular,
    IconPaperPlaneOutlineRegular,
    IconEllipsisOutlineRegular,
  } = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule;

  /** Sở hữu MỘT lượt tải trình duyệt đang chạy mỗi Session và công bố trạng thái hộp thoại. */
  class SessionLogDownloadController {
    private readonly fetcher: SessionLogFetch;
    private readonly save: SessionLogSave;
    /** Nguồn trạng thái an toàn với uSES, dùng chung cho mọi đóng góp hộp thoại theo Session. */
    readonly store: SnapshotStore<SessionLogDownloadState> = storeModule.createSnapshotStore(INITIAL);
    private readonly active = new Map<string, ActiveDownload>();
    private disposed = false;

    /**
     * Dựng bộ điều khiển với bộ vận chuyển HTTP và thao tác lưu của trình duyệt.
     * Nhận: fetcher — bộ vận chuyển HTTP đọc ZIP do Host phát; save — thao tác lưu của trình duyệt.
     * Trả: đối tượng điều khiển.
     */
    constructor(fetcher: SessionLogFetch = (input, init) => fetch(input, init), save: SessionLogSave = downloadUrl) {
      this.fetcher = fetcher;
      this.save = save;
    }

    /**
     * Tải trọn một cây Session; thao tác đồng thời trên cùng Session chia sẻ MỘT lượt chạy.
     * Nhận: sessionId — Session gốc mà ZIP gồm hậu duệ và tệp đính kèm.
     * Trả: sau khi trình duyệt bắt đầu lưu, một trạng thái lỗi được công bố, hoặc yêu cầu muộn sau khi
     *      dispose bị bỏ qua.
     */
    download(sessionId: string): Promise<void> {
      const existing = this.active.get(sessionId);
      if (existing !== void 0) return existing.done;
      if (this.disposed) return Promise.resolve();
      const abort = new AbortController();
      const done = this.run(sessionId, abort.signal).finally(() => {
        this.active.delete(sessionId);
      });
      this.active.set(sessionId, {
        abort,
        done,
      });
      return done;
    }

    /**
     * Đóng hộp thoại của MỘT Session mà KHÔNG huỷ lượt tải đang chạy.
     * Nhận: sessionId — Session cần đóng hộp thoại.
     * Trả: không.
     */
    dismiss(sessionId: string): void {
      const current = this.store.getSnapshot().bySession[String(sessionId)];
      if (current === void 0 || !current.open) return;
      this.publish(sessionId, {
        ...current,
        open: false,
      });
    }

    /**
     * Huỷ mọi lượt đọc đang chạy và đạt trạng thái tĩnh.
     * Nhận: không.
     * Trả: sau khi mọi thao tác đang chạy kết thúc.
     */
    async dispose(): Promise<void> {
      this.disposed = true;
      const active = [...this.active.values()];
      for (const operation of active) operation.abort.abort();
      await Promise.allSettled(active.map((operation) => operation.done));
    }

    /**
     * Chạy MỘT lượt tải: công bố "downloading", HEAD route, lưu tệp, rồi công bố kết quả.
     * Nhận: sessionId — Session gốc; signal — tín hiệu huỷ của lượt tải.
     * Trả: sau khi trạng thái cuối được công bố (hoặc lượt bị huỷ im lặng).
     */
    private async run(sessionId: string, signal: AbortSignal): Promise<void> {
      this.publish(sessionId, {
        open: true,
        status: "downloading",
        error: null,
      });
      try {
        const route = `${SESSION_LOG_EXPORT_ROUTE}?${new URLSearchParams({
          sessionId,
          includeDescendants: "true",
        }).toString()}`;
        const response = await this.fetcher(route, {
          method: "HEAD",
          signal,
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(`Export failed: HTTP ${response.status}${detail === "" ? "" : ` ${detail}`}`);
        }
        this.save(route, sessionLogZipFilename(sessionId));
        const open = this.store.getSnapshot().bySession[String(sessionId)]?.open ?? true;
        this.publish(sessionId, {
          open,
          status: "success",
          error: null,
        });
      } catch (error) {
        if (signal.aborted) return;
        const open = this.store.getSnapshot().bySession[String(sessionId)]?.open ?? true;
        this.publish(sessionId, {
          open,
          status: "error",
          error: messageOf(error),
        });
      }
    }

    /**
     * Công bố trạng thái hộp thoại của MỘT Session.
     * Nhận: sessionId — Session sở hữu hộp thoại; entry — trạng thái mới.
     * Trả: không.
     */
    private publish(sessionId: string, entry: SessionLogDownloadEntry): void {
      this.store.update((state) => {
        state.bySession = {
          ...state.bySession,
          [String(sessionId)]: entry,
        };
      });
    }
  }

  /**
   * Hộp thoại dùng chung cho mục tải trên Session Header và lệnh /export của trình duyệt này.
   * Nhận: props — runtime Session, trạng thái controller đã buộc, hành động và chữ đã dịch.
   * Trả: đóng góp portal của hộp thoại.
   */
  function SessionLogDownloadDialog({
    sessionId,
    useSessionLogDownload,
    dismiss,
    t,
  }: {
    readonly sessionId: string;
    readonly useSessionLogDownload: (
      select: (state: SessionLogDownloadState) => SessionLogDownloadEntry | undefined,
    ) => SessionLogDownloadEntry | undefined;
    readonly dismiss: (sessionId: string) => void;
    readonly t: (key: string) => string;
  }): unknown {
    const entry = useSessionLogDownload((state) => state.bySession[String(sessionId)]);
    const status = entry?.status;
    const open = entry?.open === true;
    const error = status === "error" ? entry?.error || t("dialog.commandFailed") : null;
    return jsx(Modal, {
      open,
      onClose: () => {
        dismiss(sessionId);
      },
      title: status === "downloading" ? t("dialog.preparingTitle") : status === "success" ? t("dialog.successTitle") : t("dialog.errorTitle"),
      description: status === "downloading" ? t("dialog.preparingDescription") : status === "success" ? t("dialog.successDescription") : error ?? t("dialog.commandFailed"),
      closeLabel: t("dialog.close"),
      footer: jsx(Button, {
        variant: "primary",
        onClick: () => {
          dismiss(sessionId);
        },
        children: t("dialog.close"),
      }),
    });
  }

  const tagId = PACKAGE_NAME + "/HeaderAction.module.css";
  if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
    const tag = document.createElement("style");
    tag.dataset.plugin = PACKAGE_NAME;
    tag.dataset.pluginCss = tagId;
    tag.textContent = HEADER_ACTION_CSS;
    document.head.appendChild(tag);
  }

  /**
   * Dựng menu của Session Header với hành động tải và hành động phản hồi tuỳ chọn.
   * Nhận: props — runtime Session, controller tải, và chữ đã dịch.
   * Trả: action thường trực trên Header cùng hộp thoại theo Session.
   */
  function SessionLogDownloadHeaderAction(props: {
    readonly sessionId: string;
    readonly useSessionLogDownload: (
      select: (state: SessionLogDownloadState) => SessionLogDownloadEntry | undefined,
    ) => SessionLogDownloadEntry | undefined;
    readonly useFeedbackAvailable: (select: (value: boolean) => boolean) => boolean;
    readonly request: (sessionId: string) => Promise<void>;
    readonly dismiss: (sessionId: string) => void;
    readonly openFeedback: (sessionId: string) => void;
    readonly t: (key: string) => string;
  }): unknown {
    const { sessionId, useSessionLogDownload, useFeedbackAvailable, request, openFeedback, t } = props;
    const feedbackAvailable = useFeedbackAvailable((value) => value);
    const busy = useSessionLogDownload((state) => state.bySession[String(sessionId)])?.status === "downloading";
    const [open, setOpen] = useState(false);
    return jsxs(Fragment, {
      children: [
        jsx(Menu, {
          open,
          align: "end",
          dense: true,
          onClose: () => {
            setOpen(false);
          },
          items: [
            {
              id: "download",
              label: t("menu.download"),
              icon: jsx(IconDownloadOutlineRegular, {}),
              disabled: busy,
            },
            ...(feedbackAvailable
              ? [
                  {
                    id: "feedback",
                    label: t("menu.feedback"),
                    icon: jsx(IconPaperPlaneOutlineRegular, {}),
                  },
                ]
              : []),
          ],
          onSelect: (id: string) => {
            setOpen(false);
            if (id === "feedback") openFeedback(sessionId);
            else request(sessionId);
          },
          anchor: jsx(Button, {
            size: "sm",
            className: HEADER_ACTION_CLASS.moreButton,
            "aria-label": t("header.more"),
            "aria-haspopup": "menu",
            "aria-expanded": open,
            "aria-busy": busy,
            onClick: () => {
              setOpen((value) => !value);
            },
            children: jsx(IconEllipsisOutlineRegular, {}),
          }),
        }),
        jsx(SessionLogDownloadDialog, { ...props }),
      ],
    });
  }

  /**
   * Cấp controller tải và gắn hộp thoại của nó vào Session Header.
   * Nhận: ctx — context browser mang service slots và locale.
   * Trả: không.
   */
  function apply(ctx: ClientContext): void {
    const controller = new SessionLogDownloadController();
    ctx.provide("sessionLogDownload", controller);
    ctx.effect(() => async () => {
      await controller.dispose();
    }, "session-log-download: browser download lifecycle");
    ctx.effect(() => ctx.locale.register(NS, {
      zh,
      en,
    }), "session-log-download: browser dictionaries");
    const feedbackAvailable = storeModule.createSnapshotStore(false);
    ctx.inject(["feedbackUi"], (scope) => {
      scope.effect(() => {
        feedbackAvailable.set(true);
        return () => {
          feedbackAvailable.set(false);
        };
      }, "session-log-download: feedback availability");
    });
    ctx.on("command/executed", (sessionId, commandName, result) => {
      if (commandName === "export" && result.kind === "success") controller.download(sessionId);
    });
    ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
      name: "conversation.session.header.utilities",
      id: "session-log-download",
      locale: NS,
      inject: () => ({
        hooks: {
          sessionLogDownload: controller.store,
          feedbackAvailable,
        },
        request: (sessionId: string) => controller.download(sessionId),
        dismiss: (sessionId: string) => {
          controller.dismiss(sessionId);
        },
        openFeedback: (sessionId: string) => {
          ctx.get("feedbackUi")?.openSession(sessionId);
        },
      }),
    }, SessionLogDownloadHeaderAction));
  }

  return { apply, inject };
}

/** Factory mà bảng module gọi khi materialize bundle. */
const factory = (requireFn: RequireFn): SessionLogClientPlugin => createPlugin(requireFn);

/** Hình dạng bảng module của harness (global do vỏ client cấp). */
interface ModuleLoaderLike {
  /** Đăng ký một bundle với bảng module. */
  load(registration: { id: string; factory: (require: RequireFn) => unknown }): void;
}

/** Khai báo global của RIÊNG gói này (không augment type của stock — ADR 000d). */
declare global {
  /** Bảng module do vỏ client cấp; có thể vắng khi nạp ESM trong Node/test. */
  var __ModuleLoader__: ModuleLoaderLike | undefined;
}

/** Factory mà wrapper classic-script ở build.ts bọc và đăng ký với bảng module của vỏ client. */
export { factory };
