/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thân tab cây thư mục: gốc workspace của phiên, đọc từng mức, mở thư mục và mở tệp.
 */

import { FILES_BODY_CLASS } from "./body-css.ts";
import { childPath, fileAddressFor } from "./paths.ts";
import type { FilesActionsLike, FilesFaceLike } from "./face.ts";
import type { FilesTranslate } from "./locales.ts";
import type { FilesStoreState, FilesTreeState } from "./store.ts";
import type { FileEntryLike, FilesPrimitivesLike, JsxRuntimeLike, ReactLike, RemoteFailureLike } from "./types.ts";

/** Thông tin một tab mà khung bơm cho chỗ ngồi. */
export interface FilesTabInfo {
  /** Id tab. */
  id: string;
  /** Tên tab lúc mở. */
  title?: string;
  /** Tín hiệu vòng đời của tab. */
  signal: AbortSignal;
  /** Phím tắt đọc lại của tab (nếu khung cấp). */
  refreshShortcut?: { keys?: unknown; aria?: string };
  /** Hành động của tab. */
  actions: {
    /** Gắn lệnh cho tab (khung gọi lại khi cần đọc lại). */
    bindCommands(commands: { refresh: () => void }): unknown;
    /** Mở một tài nguyên theo địa chỉ. */
    openResource(address: string): void;
  };
}

/** Props mà khe cắm bơm cho thân tab: phần khung cấp + phần mặt cây cấp. */
export interface FilesBodyProps extends FilesFaceLike {
  /** Thông tin tab đang mở. */
  useTabInfo: () => { tab: FilesTabInfo };
  /** Phiên đang xem. */
  sessionId: string;
  /** Hook đọc sổ phiên. */
  useSessions: <T>(selector: (state: { byId: Record<string, { cwd?: string } | undefined> }) => T) => T;
  /** Hook đọc store độc quyền của kiểu tab này. */
  useStore: <T>(selector: (state: FilesStoreState) => T) => T;
  /** Hành động của store (đã bind). */
  actions: FilesActionsLike;
  /** Hàm dịch đã bind namespace. */
  t: FilesTranslate;
  /** Vẽ một slot con trong header. */
  renderSlot: (name: string, props: Record<string, unknown>) => unknown;
}

/** Cây mà hai component dòng/mức dùng chung. */
interface TreeView {
  /** Trạng thái cây của tab. */
  state: FilesTreeState;
  /** Mở hoặc đóng một thư mục. */
  onToggle: (parent: string, path: string) => void;
  /** Mở một tệp. */
  onOpen: (path: string) => void;
  /** Hàm dịch đã bind namespace. */
  t: FilesTranslate;
}

/** Thứ tự tên tự nhiên, không phân biệt hoa thường, để §file2§ đứng trước §file10§. */
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Xếp một mức để hiển thị: thư mục trước, rồi mới tới các mục khác, mỗi nhóm theo tên.
 * Nhận: entries — danh sách như endpoint trả về.
 * Trả: mảng MỚI, thư mục trước rồi theo tên trong từng nhóm.
 */
export function orderEntries(entries: readonly FileEntryLike[]): FileEntryLike[] {
  return [...entries].sort((left, right) => {
    const group = Number(right.type === "directory") - Number(left.type === "directory");
    return group !== 0 ? group : byName.compare(left.name, right.name);
  });
}

/**
 * Nói vì sao một thư mục không đọc được, theo cách nói về chính thư mục đó.
 * Nhận: t — hàm dịch đã bind namespace; failure — lỗi Remote đã settled.
 * Trả: dòng chữ hiện dưới thư mục.
 */
export function failureLine(t: FilesTranslate, failure: RemoteFailureLike): string {
  switch (failure.code) {
    case "workspace-file/not-found":
      return t("error.notFound");
    case "workspace-file/outside-workspace":
      return t("error.outsideWorkspace");
    case "workspace-file/not-directory":
      return t("error.notDirectory");
    default:
      return t("error.unavailable", { message: failure.message });
  }
}

/**
 * Dựng thân tab cây thư mục.
 *
 * Mọi thứ cây giữ nằm ở store theo tab; mọi thứ cây hỏi đi qua mặt đã inject. Component chỉ quyết định
 * vẽ gì cho từng đường dẫn tuyệt đối và một cú bấm nghĩa là gì: thư mục thì mở/đóng, tệp thì mở qua
 * §openResource§ để một trình xem §file:§ nhận, còn loại khác thì hiện mà không mở được.
 * Nhận: runtime — jsx runtime; react — module react (hook); primitives — primitive của DSH.
 * Trả: component nhận props của khe cắm.
 */
export function createFilesBody(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  primitives: FilesPrimitivesLike,
): (props: FilesBodyProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;

  /**
   * Một dòng mục, kèm con khi là thư mục đang mở.
   * Nhận: props — parent (đường dẫn thư mục chứa), entry (mục), tree (cây dùng chung).
   * Trả: cây phần tử của một mục.
   */
  const Entry = (props: { parent: string; entry: FileEntryLike; tree: TreeView }): unknown => {
    const path = childPath(props.parent, props.entry.name);
    if (props.entry.type === "directory") {
      const expanded = props.tree.state.expanded.includes(path);
      return jsxs(
        "li",
        {
          className: FILES_BODY_CLASS.item,
          "data-files-entry": "directory",
          "data-files-path": path,
          children: [
            jsxs(
              "button",
              {
                type: "button",
                className: FILES_BODY_CLASS.row,
                "aria-expanded": expanded,
                onClick: () => {
                  props.tree.onToggle(props.parent, path);
                },
                children: [
                  expanded
                    ? jsx(primitives.IconFolderOpenRegular, { className: FILES_BODY_CLASS.icon })
                    : jsx(primitives.IconFolderCloseRegular, { className: FILES_BODY_CLASS.icon }),
                  jsx("span", { className: FILES_BODY_CLASS.name, children: props.entry.name }),
                ],
              },
              undefined,
            ),
            expanded
              ? jsx("ul", { className: FILES_BODY_CLASS.level, children: jsx(Level, { path, tree: props.tree }) })
              : null,
          ],
        },
        undefined,
      );
    }
    if (props.entry.type === "file") {
      return jsx("li", {
        className: FILES_BODY_CLASS.item,
        "data-files-entry": "file",
        "data-files-path": path,
        children: jsxs("button", {
          type: "button",
          className: FILES_BODY_CLASS.row,
          onClick: () => {
            props.tree.onOpen(path);
          },
          children: [
            jsx(primitives.FileTypeIcon, {
              kind: primitives.classifyFileType(props.entry.name),
              size: 16,
              className: FILES_BODY_CLASS.fileIcon,
            }),
            jsx("span", { className: FILES_BODY_CLASS.name, children: props.entry.name }),
          ],
        }),
      });
    }
    return jsx("li", {
      className: FILES_BODY_CLASS.item,
      "data-files-entry": "other",
      "data-files-path": path,
      children: jsx("span", {
        className: FILES_BODY_CLASS.row + " " + FILES_BODY_CLASS.other,
        "aria-disabled": "true",
        title: props.tree.t("entry.other"),
        children: jsx("span", { className: FILES_BODY_CLASS.name, children: props.entry.name }),
      }),
    });
  };

  /**
   * Các dòng của MỘT thư mục: trạng thái đang đọc, hoặc danh sách mục đã đọc.
   * Nhận: props — path (đường dẫn tuyệt đối), tree (cây dùng chung).
   * Trả: cây phần tử của một mức.
   */
  const Level = (props: { path: string; tree: TreeView }): unknown => {
    const { state, t } = props.tree;
    const level = state.levels[props.path];
    if (level === undefined || level.kind === "loading") {
      return jsx("li", { className: FILES_BODY_CLASS.note, "data-files-row": "loading", children: t("loading") });
    }
    if (level.kind === "failed") {
      return jsx("li", {
        className: FILES_BODY_CLASS.note,
        "data-files-row": "failed",
        "data-files-code": level.failure.code,
        children: failureLine(t, level.failure),
      });
    }
    const entries = orderEntries(level.level.entries);
    return jsxs(Fragment, {
      children: [
        level.failure !== undefined
          ? jsx("li", { className: FILES_BODY_CLASS.note, "data-files-row": "failed", children: failureLine(t, level.failure) })
          : null,
        entries.length === 0
          ? jsx("li", { className: FILES_BODY_CLASS.note, "data-files-row": "empty", children: t("empty") })
          : null,
        entries.map((entry) => jsx(Entry, { parent: props.path, entry, tree: props.tree }, entry.name)),
        level.level.truncated
          ? jsx("li", { className: FILES_BODY_CLASS.note, "data-files-row": "truncated", children: t("truncated") })
          : null,
      ],
    });
  };

  return (props: FilesBodyProps): unknown => {
    const { tab } = props.useTabInfo();
    react.useEffect(
      () =>
        tab.actions.bindCommands({
          refresh: () => {
            props.refresh(tab.id);
          },
        }),
      [tab.actions, tab.id, props.refresh],
    );
    const { signal, actions: tabActions } = tab;
    const cwd = props.useSessions((sessions) => sessions.byId[props.sessionId]?.cwd);
    const state = props.useStore((store) => store.byTab[tab.id]);
    const bodyRef = react.useRef<HTMLElement | null>(null);
    const scrollTopRef = react.useRef(0);
    const seeded = state !== undefined;
    react.useLayoutEffect(() => {
      const body = bodyRef.current;
      if (state === undefined || body === null) return;
      body.scrollTop = state.scrollTop;
      scrollTopRef.current = body.scrollTop;
    }, [seeded]);
    react.useEffect(
      () => () => {
        if (seeded && !signal.aborted) props.actions.scrolled(tab.id, scrollTopRef.current);
      },
      [seeded, signal, tab.id, props.actions],
    );
    react.useEffect(() => {
      if (state !== undefined || cwd === undefined || signal.aborted) return;
      props.start(tab.id, cwd, signal);
    }, [state, cwd, tab.id, signal, props.start]);
    if (cwd === undefined) {
      return jsx("div", {
        className: FILES_BODY_CLASS.status,
        "data-files-state": "no-workspace",
        children: jsx("p", { className: FILES_BODY_CLASS.statusLine, children: props.t("noWorkspace") }),
      });
    }
    if (state === undefined) return null;
    const tree: TreeView = {
      state,
      onToggle: (parent: string, path: string) => {
        props.toggle(tab.id, parent, path, state.expanded, signal);
      },
      onOpen: (path: string) => {
        tabActions.openResource(fileAddressFor(props.sessionId, state.root, path));
      },
      t: props.t,
    };
    return jsxs("div", {
      className: FILES_BODY_CLASS.root,
      "data-files-state": "tree",
      "data-files-root": state.root,
      children: [
        jsxs("div", {
          className: FILES_BODY_CLASS.header,
          children: [
            jsx(primitives.PathLabel, {
              path: state.root,
              className: FILES_BODY_CLASS.path,
              "data-files-path": true,
            }),
            jsx("span", {
              hidden: true,
              children: jsx("button", {
                type: "button",
                className: FILES_BODY_CLASS.tool,
                "aria-label": props.t("autoRefresh"),
                "aria-pressed": state.autoRefresh,
                "data-files-auto-refresh": true,
                title: props.t(state.autoRefresh ? "autoRefresh.disable" : "autoRefresh.enable"),
                onClick: () => {
                  props.setAutoRefresh(tab.id, !state.autoRefresh);
                },
                children: state.autoRefresh
                  ? jsx(primitives.IconPauseOutlineRegular, {})
                  : jsx(primitives.IconPlayOutlineRegular, {}),
              }),
            }),
            jsx(primitives.Tooltip, {
              label: props.t("reload"),
              shortcutKeys: tab.refreshShortcut?.keys,
              side: "bottom",
              delayMs: 500,
              children: jsx("button", {
                type: "button",
                className: FILES_BODY_CLASS.tool,
                "aria-label": props.t("reload"),
                "aria-keyshortcuts": tab.refreshShortcut?.aria,
                "data-files-reload": true,
                onClick: () => {
                  props.refresh(tab.id);
                },
                children: jsx(primitives.IconRefreshOutlineRegular, {}),
              }),
            }),
            props.renderSlot("sidebar.right.tab.files.actions", { absolutePath: state.root }),
          ],
        }),
        jsx("div", {
          ref: bodyRef,
          className: FILES_BODY_CLASS.body,
          "data-files-body": true,
          onScroll: (event: { currentTarget: { scrollTop: number } }) => {
            scrollTopRef.current = event.currentTarget.scrollTop;
          },
          children: jsx("ul", {
            className: FILES_BODY_CLASS.level,
            children: jsx(Level, { path: state.root, tree }),
          }),
        }),
      ],
    });
  };
}
