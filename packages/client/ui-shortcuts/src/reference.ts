/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hop thoai tra cuu/sua phim tat + hang "Phim tat" trong Settings — chuyen 1:1 tu Reference.js
 *   cua bundle goc @deepseek-ai/dsh-client-ui-shortcuts (lib/client.js dong 502-881)
 */

import type { ClassValue } from "./clsx.ts";
import type { ShortcutEditorProps } from "./editor.ts";
import type { ShortcutDictionary, ShortcutWriteFailure, UnreadableConfig } from "./feedback.ts";
import type { CatalogEntry, ConfigSnapshot, FixedCatalogRow } from "./types.ts";

/** Hàm dựng element của React JSX runtime. */
export type JsxFn = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => unknown;

/** Runtime JSX mà module này dùng. */
export interface ReferenceRuntime {
  /** Dựng một element. */
  jsx: JsxFn;
  /** Dựng nhiều con. */
  jsxs: JsxFn;
  /** Bọc nhiều con không cần node. */
  Fragment: unknown;
}

/** Hook React mà hai component này dùng (chỉ khai phần thật dùng). */
export interface ReferenceReact {
  /** State (hỗ trợ cả dạng cập nhật hàm như React thật — `notify` dùng). */
  useState: <T>(initial: T) => [T, (next: T | ((previous: T) => T)) => void];
  /** Ref. */
  useRef: <T>(initial: T) => { current: T };
  /** Hiệu ứng. */
  useEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Hiệu ứng layout. */
  useLayoutEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Callback ổn định. */
  useCallback: <T>(fn: T, deps?: readonly unknown[]) => T;
  /** Id ổn định (component con dùng). */
  useId?: () => string;
}

/**
 * Bộ nguyên thuỷ của DSH mà hộp thoại dùng — ĐÚNG các tên hàm bản gốc gọi, không thêm bớt.
 * rankByName giữ đúng chữ ký thật của gói @galaxy-blackhole/gbh-client-ui-primitives: (rows, query).
 */
export interface ReferencePrimitives extends Record<string, unknown> {
  /** Nút (memo component của shell). */
  Button: unknown;
  /** Modal. */
  Modal: unknown;
  /** Toast. */
  Toast: unknown;
  /** Tooltip. */
  Tooltip: unknown;
  /** Hiển thị tổ hợp phím. */
  ShortcutKeys: unknown;
  /** Icon đóng. */
  IconCloseOutlineRegular: unknown;
  /** Icon làm mới. */
  IconRefreshOutlineRegular: unknown;
  /** Đóng modal trên cùng. */
  closeTopModal: (target: unknown) => void;
  /** Focus không viền. */
  focusWithoutRing: (element: unknown, options?: { readonly preventScroll?: boolean }) => void;
  /** Có nằm sau modal không. */
  isBehindModal: (element: unknown) => boolean;
  /** Theo dõi composition. */
  observeComposition: (target: unknown) => { guards: (event: unknown) => boolean; dispose: () => void };
  /** Xếp hạng theo tên. */
  rankByName: <T extends { readonly name: string }>(rows: readonly T[], query: string) => readonly T[];
}

/** Từ điển của namespace "shortcuts" (đã bind tham số). */
export type Dictionary = (key: string, params?: Record<string, unknown>) => string;

/** Hook đọc danh mục lệnh (renderer cấp qua hooks.catalog). */
export type UseCatalog = <T>(select: (value: readonly CatalogEntry[]) => T) => T;

/** Hook đọc cấu hình phím tắt (renderer cấp qua hooks.config). */
export type UseConfig = <T>(select: (value: ConfigSnapshot) => T) => T;

/** Hook đọc danh mục CỐ ĐỊNH (renderer cấp qua hooks.fixedCatalog). */
export type UseFixedCatalog = <T>(select: (value: readonly FixedCatalogRow[]) => T) => T;

/** Trạng thái store của hộp thoại (khớp store.ts). */
export interface ReferenceState {
  /** Hộp thoại đang mở. */
  open: boolean;
  /** Từ khoá tìm. */
  query: string;
  /** Số lần yêu cầu focus. */
  focusRequest: number;
}

/** Hook đọc store cấp gốc (renderer cấp theo trường store của chỗ ngồi). */
export type UseStore = <T>(select: (state: ReferenceState) => T) => T;

/** Động tử của store — renderer cấp từ store.actions. */
export interface ReferenceActions {
  /** Mở hộp thoại tra cứu. */
  open(): void;
  /** Ghi từ khoá tìm. */
  search(query: string): void;
  /** Đóng hộp thoại. */
  close(): void;
}

/** Props của hàng "Phím tắt" trong Settings (settings.general.item). */
export interface ShortcutsRowProps {
  /** Động tử của store dùng chung. */
  actions: ReferenceActions;
  /** Từ điển đã bind. */
  t: Dictionary;
  /** Hook danh mục lệnh. */
  useCatalog: UseCatalog;
}

/**
 * Kết quả đã phân loại của một lượt ghi cấu hình — đúng kiểu của bản gốc
 * (ShortcutSaveResult bên gói dsh-client-shortcuts, xem feedback.ts).
 */
export type EditResult = ShortcutWriteFailure;

/** Props của hộp thoại tra cứu (shell.overlay) — đúng bộ InjectFace bản gốc. */
export interface ShortcutReferenceProps {
  /** Hook store cấp gốc. */
  useStore: UseStore;
  /** Động tử của store. */
  actions: ReferenceActions;
  /** Hook danh mục lệnh. */
  useCatalog: UseCatalog;
  /** Hook cấu hình. */
  useConfig: UseConfig;
  /** Hook danh mục cố định. */
  useFixedCatalog: UseFixedCatalog;
  /** Nền tảng (macos/windows/linux). */
  platform: string;
  /** Nơi lưu (web/desktop). */
  runtime: string;
  /** Ghi cấu hình phím tắt. */
  edit: (operation: Record<string, unknown>, revision: number) => Promise<EditResult>;
  /** Bật/tắt chế độ ghi tổ hợp. */
  recording: (active: boolean) => Promise<void>;
  /** Mô tả tổ hợp vật lý. */
  describeBinding: (binding: unknown) => {
    binding: { code?: string; secondCode?: string; modifiers: readonly string[] } | null;
    keys: readonly string[];
    issue: string | null;
    conflicts: readonly string[];
  };
  /** Từ điển đã bind. */
  t: Dictionary;
}

/** Phụ thuộc để dựng hai component của hộp thoại. */
export interface ReferenceDeps {
  /** Runtime JSX. */
  runtime: ReferenceRuntime;
  /** Hook React. */
  react: ReferenceReact;
  /** Nguyên thuỷ của DSH. */
  primitives: ReferencePrimitives;
  /** Bảng lớp CSS của Reference.module.css (hash nhfO0a_). */
  classes: Record<string, string>;
  /** Glyph của gói (bản gốc Icons.js). */
  ShortcutIcon: (props: { kind: string; className?: string }) => unknown;
  /** Dựng component trình ghi (editor.ts). */
  createShortcutEditor: (deps: Record<string, unknown>) => (props: ShortcutEditorProps) => unknown;
  /** Câu chữ chẩn đoán khi ghi thất bại. */
  shortcutFailure: (
    result: ShortcutWriteFailure,
    catalog: readonly Pick<CatalogEntry, "id" | "label">[],
    t: ShortcutDictionary,
    runtime: string,
  ) => string;
  /** Câu chữ chẩn đoán khi đọc thất bại. */
  shortcutReadFailure: (config: UnreadableConfig, runtime: string, t: ShortcutDictionary) => string;
  /** Ghép lớp có điều kiện (clsx của bản gốc). */
  clsx: (...inputs: readonly ClassValue[]) => string;
}

/** Hai component mà apply đăng ký vào slot. */
export interface ReferenceComponents {
  /** Hàng trong Settings mở hộp thoại. */
  ShortcutsRow: (props: ShortcutsRowProps) => unknown;
  /** Hộp thoại tra cứu/sửa. */
  ShortcutReference: (props: ShortcutReferenceProps) => unknown;
  /** Vị trí các lệnh lõi (bản gốc: thứ tự sản phẩm, độc lập nhãn và thứ tự đăng ký plugin). */
  coreActionOrder: ReadonlyMap<string, number>;
}

/** Một dòng đã gộp của danh mục (catalog + fixed) để xếp hạng và vẽ. */
interface RankedRow {
  /** Id lệnh. */
  readonly id: string;
  /** Nhãn hiển thị. */
  readonly label: string;
  /** Phím hiển thị. */
  readonly keys: readonly string[];
  /** Tên gọi khác (chỉ catalog). */
  readonly aliases?: readonly string[];
  /** Nhãn trợ giúp (chỉ catalog). */
  readonly aria?: string | undefined;
  /** Tổ hợp đang gán (chỉ catalog). */
  readonly binding?: unknown;
  /** Đã sửa so với mặc định — CHỈ catalog có trường này (bản gốc dùng "modified" in row). */
  readonly modified?: boolean;
  /** Nhóm hiển thị. */
  readonly group: string;
  /** Các tên dùng để tìm. */
  readonly names: readonly string[];
}

/** Một dòng ứng viên đưa vào rankByName. */
interface RankCandidate {
  /** Tên để so khớp. */
  readonly name: string;
  /** Nhãn hiển thị. */
  readonly label: string;
  /** Dòng gốc. */
  readonly row: RankedRow;
}

/** Thứ tự hiển thị của các lệnh lõi — NGUYÊN VĂN danh sách của bản gốc (Reference.js dòng 505-526). */
const CORE_ACTION_IDS: readonly string[] = [
  "shortcuts.open",
  "session.new",
  "sidebar.left.toggle",
  "session.search",
  "workspace.add",
  "session.rename",
  "session.fork",
  "session.archive",
  "settings.open",
  "fontSize.increase",
  "fontSize.decrease",
  "workspace.openLocal",
  "sidebar.right.toggle",
  "workspace.files",
  "browser.new",
  "terminal.new",
  "pane.split",
  "pane.fullscreen.toggle",
  "page.refresh",
  "page.close",
];

/**
 * Dựng hai component của row từ phụ thuộc do plugin gom (không import React trực tiếp — cùng khuôn editor.ts).
 * Nhận: phụ thuộc — runtime JSX, hook React, nguyên thuỷ DSH, bảng lớp, glyph, factory trình ghi, câu chữ chẩn đoán, clsx.
 * Trả: { ShortcutsRow, ShortcutReference, coreActionOrder }.
 */
export function createReference(deps: ReferenceDeps): ReferenceComponents {
  const { runtime: jsxRuntime, react, primitives, classes, ShortcutIcon, shortcutFailure, shortcutReadFailure, clsx } = deps;
  const jsx = jsxRuntime.jsx;
  const jsxs = jsxRuntime.jsxs;
  const Fragment = jsxRuntime.Fragment;
  const coreActionOrder: ReadonlyMap<string, number> = new Map(CORE_ACTION_IDS.map((id, index) => [id, index]));
  const ShortcutEditor = deps.createShortcutEditor({
    runtime: jsxRuntime,
    react,
    primitives,
    classes,
    clsx,
    ShortcutIcon,
    shortcutFailure,
    shortcutReadFailure,
  });

  /**
   * Vẽ hàng "Phím tắt" trong Settings: nút mở hộp thoại tra cứu, kèm tooltip tổ hợp toàn cục.
   * Nhận: props — động tử mở hộp thoại, từ điển, hook danh mục lệnh.
   * Trả: element của hàng cài đặt (div + nút).
   */
  function ShortcutsRow({ actions, t, useCatalog }: ShortcutsRowProps): unknown {
    const shortcut = useCatalog((rows) => rows.find((row) => row.id === "shortcuts.open"));
    return jsxs("div", {
      className: classes.setting,
      children: [
        jsxs("div", {
          className: classes.settingText,
          children: [
            jsx("div", { className: classes.settingTitle, children: t("settings") }),
            jsx("p", { className: classes.settingDescription, children: t("description") }),
          ],
        }),
        jsx(primitives.Tooltip, {
          disabled: !(shortcut?.keys.length ?? 0),
          label: t("global-hint"),
          shortcutKeys: shortcut?.keys,
          children: jsx("button", {
            className: classes.button,
            type: "button",
            "aria-label": t("view"),
            "aria-keyshortcuts": shortcut?.aria,
            onClick: () => {
              actions.open();
            },
            children: t("view"),
          }),
        }),
      ],
    });
  }

  /**
   * Vẽ hộp thoại tra cứu/sửa phím tắt (overlay duy nhất của shell) + hộp xác nhận khôi phục tất cả + toast.
   * Nhận: props — store cấp gốc, danh mục (catalog/fixed), cấu hình, nền tảng/nơi lưu, ba seam dịch vụ, từ điển.
   * Trả: element Fragment gồm Modal chính (chỉ có nội dung khi open), Modal xác nhận và Toast.
   */
  function ShortcutReference({
    useStore,
    actions,
    useCatalog,
    useConfig,
    useFixedCatalog,
    platform,
    runtime,
    edit,
    recording,
    describeBinding,
    t,
  }: ShortcutReferenceProps): unknown {
    const { open, query, focusRequest } = useStore((state) => state);
    const catalog = useCatalog((value) => value);
    const config = useConfig((value) => value);
    const fixedCatalog = useFixedCatalog((value) => value);
    const [target, setTarget] = react.useState<RankedRow | null>(null);
    const [resetRevision, setResetRevision] = react.useState<number | null>(null);
    const [busy, setBusy] = react.useState(false);
    const [toast, setToast] = react.useState<{ text: string; error: boolean; seq: number } | null>(null);
    const mounted = react.useRef(true);
    const search = react.useRef<{ focus(): void; closest(selector: string): unknown } | null>(null);
    react.useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
      };
    }, []);
    /** Xoá toast đang hiện (dùng làm onDone của Toast). */
    const dismissToast = react.useCallback(() => {
      setToast(null);
    }, []);
    /** Hiện toast; lỗi TRÙNG nội dung thì giữ nguyên (đúng bản gốc). */
    const notify = react.useCallback((text: string, error = false) => {
      setToast((previous) => {
        if (error && previous?.error && previous.text === text) return previous;
        return { text, error, seq: (previous?.seq ?? 0) + 1 };
      });
    }, []);
    react.useEffect(() => {
      if (open && config.status === "unreadable") notify(shortcutReadFailure(config, runtime, t), true);
    }, [open, config, runtime, notify, t]);
    /**
     * Đóng trình sửa đang mở và trả focus về hộp thoại.
     * Nhận: không.
     * Trả: không.
     */
    const closeEditor = (): void => {
      setTarget(null);
      const dialog = search.current?.closest('[role="dialog"]');
      if (dialog !== null && dialog !== undefined) primitives.focusWithoutRing(dialog, { preventScroll: true });
    };
    /**
     * Đóng lớp trên cùng: hộp xác nhận → trình sửa → cả hộp thoại (đúng thứ tự bản gốc).
     * Nhận: không.
     * Trả: không.
     */
    const closeReference = (): void => {
      if (busy) return;
      if (resetRevision !== null) setResetRevision(null);
      else if (target !== null) closeEditor();
      else actions.close();
    };
    react.useEffect(() => {
      if (!open) setResetRevision(null);
    }, [open]);
    /**
     * Gọi seam edit của dịch vụ và bật/tắt cờ busy quanh lượt gọi.
     * Nhận: operation — thao tác ghi; revision — revision người dùng đã xem.
     * Trả: kết quả đã phân loại của dịch vụ.
     */
    const persist = async (operation: Record<string, unknown>, revision: number): Promise<EditResult> => {
      setBusy(true);
      const result = await edit(operation, revision);
      if (mounted.current) setBusy(false);
      return result;
    };
    /**
     * Khôi phục TOÀN BỘ mặc định của nền tảng hiện tại theo revision đã xác nhận.
     * Nhận: không.
     * Trả: không (cập nhật toast và đóng hộp xác nhận theo kết quả).
     */
    const resetAll = async (): Promise<void> => {
      if (resetRevision === null) return;
      const result = await persist({ type: "reset-all" }, resetRevision);
      if (!mounted.current) return;
      if (result.status === "saved" || result.status === "stale") setResetRevision(null);
      notify(
        result.status === "saved"
          ? t("reset-saved")
          : result.status === "write-failed"
            ? t("reset-failed")
            : shortcutFailure(result, catalog, t, runtime),
        result.status !== "saved",
      );
    };
    const editorProps = {
      useCatalog,
      useConfig,
      useFixedCatalog,
      platform,
      runtime,
      edit: persist,
      recording,
      describeBinding,
      t,
      onClose: closeEditor,
      onSaved: () => {
        notify(t("saved"));
        closeEditor();
      },
      onError: (message: string) => {
        notify(message, true);
      },
    };
    react.useLayoutEffect(() => {
      const input = search.current;
      if (open && input !== null && !primitives.isBehindModal(input)) primitives.focusWithoutRing(input);
    }, [open, focusRequest]);
    const candidates: RankedRow[] = [
      ...catalog.map((row) => ({
        ...row,
        names: [
          ...row.aliases,
          row.keys.filter((key) => key !== "+").join("+"),
          row.keys.filter((key) => key !== "+").join(""),
          row.aria ?? "",
          row.aria?.replace("Meta", "Cmd") ?? "",
        ],
        group: "application",
      })),
      ...fixedCatalog.map((row) => ({ ...row, names: [row.id, row.keys.join(" ")] })),
    ];
    // Thứ tự bản gốc: response.stop xuống cuối, rồi vị trí lệnh lõi, rồi so id — sau đó gộp theo từng tên.
    const ordered = candidates.sort(
      (left, right) =>
        Number(left.id === "response.stop") - Number(right.id === "response.stop") ||
        (coreActionOrder.get(left.id) ?? coreActionOrder.size) - (coreActionOrder.get(right.id) ?? coreActionOrder.size) ||
        Number(left.id > right.id) - Number(left.id < right.id),
    );
    const rankedEntries: RankCandidate[] = ordered.flatMap((row) => row.names.map((name) => ({ name, label: row.label, row })));
    const ranked = primitives.rankByName(rankedEntries, query.trim());
    const matches = [...new Set(ranked.map((match) => match.row))];
    const profiles = (config.document as { profiles?: Record<string, Record<string, unknown> | undefined> } | undefined)?.profiles;
    const modifiedCount = Object.keys(profiles?.[runtime + ":" + platform] ?? {}).length;
    react.useLayoutEffect(() => {
      const input = search.current;
      if (open && resetRevision === null && modifiedCount === 0 && document.activeElement === document.body && input !== null) {
        primitives.focusWithoutRing(input);
      }
    }, [open, resetRevision, modifiedCount]);
    return jsxs(Fragment, {
      children: [
        jsx(
          primitives.Modal,
          {
            open,
            onClose: closeReference,
            title: t("title"),
            headless: true,
            shortcutModal: "shortcuts",
            className: classes.dialog,
            children: jsxs("div", {
              className: classes.contents,
              onPointerDownCapture: (event: { target: unknown; preventDefault(): void }) => {
                const element = event.target as { closest?(selector: string): unknown } | null;
                if (target === null || busy || typeof element?.closest !== "function") return;
                if (element.closest('button, input, a, [contenteditable="true"], [role="group"]') !== null) return;
                event.preventDefault();
                closeEditor();
              },
              children: [
                jsxs("header", {
                  className: classes.header,
                  children: [
                    jsx("h2", { className: classes.title, children: t("title") }),
                    jsx("button", {
                      type: "button",
                      className: classes.close,
                      "aria-label": t("close"),
                      disabled: busy,
                      onClick: closeReference,
                      children: jsx(primitives.IconCloseOutlineRegular, { size: 14 }),
                    }),
                  ],
                }),
                jsx("div", {
                  className: classes.searchRow,
                  children: jsxs("div", {
                    className: classes.searchField,
                    role: "search",
                    "aria-label": t("search"),
                    children: [
                      jsxs(
                        "svg",
                        {
                          className: classes.searchIcon,
                          width: "14",
                          height: "14",
                          viewBox: "0 0 14 14",
                          fill: "none",
                          "aria-hidden": "true",
                          children: [
                            jsx("path", {
                              d: "M10.28 5.86536C10.28 3.41381 8.29245 1.42644 5.84094 1.42627C3.38929 1.42627 1.40186 3.4137 1.40186 5.86536C1.40203 8.31686 3.38939 10.3044 5.84094 10.3044C8.29234 10.3043 10.2799 8.31676 10.28 5.86536ZM11.4174 5.86536C11.4172 8.94498 8.92057 11.4416 5.84094 11.4418C2.76117 11.4418 0.263843 8.94509 0.263672 5.86536C0.263672 2.78548 2.76106 0.288086 5.84094 0.288086C8.92067 0.288258 11.4174 2.78559 11.4174 5.86536Z",
                              fill: "currentColor",
                            }),
                            jsx("path", {
                              d: "M13.7372 12.9078L12.9323 13.7127L9.9732 10.7536L10.7781 9.94867L13.7372 12.9078Z",
                              fill: "currentColor",
                            }),
                          ],
                        },
                      ),
                      jsx("input", {
                        ref: search,
                        "data-modal-autofocus": true,
                        className: classes.search,
                        type: "search",
                        "aria-label": t("search"),
                        placeholder: t("search"),
                        value: query,
                        onChange: (event: { target: { value: string } }) => {
                          actions.search(event.target.value);
                        },
                      }),
                      query !== "" &&
                        jsx("button", {
                          type: "button",
                          className: classes.clearSearch,
                          "aria-label": t("clear-search"),
                          onClick: () => {
                            actions.search("");
                            search.current?.focus();
                          },
                          children: jsx(primitives.IconCloseOutlineRegular, { size: 10 }),
                        }),
                    ],
                  }),
                }),
                jsxs("div", {
                  className: classes.list,
                  "aria-busy": config.status === "loading",
                  children: [
                    ["application", "input", "menus", "approval"].map((group) => {
                      const rows = matches.filter((row) => row.group === group);
                      if (rows.length === 0) return null;
                      return jsxs(
                        "section",
                        {
                          "aria-label": t(group),
                          children: [
                            group !== "application" && jsx("h3", { className: classes.group, children: t(group) }),
                            jsx("ul", {
                              className: classes.rows,
                              children: rows.map((row) =>
                                jsxs(
                                  "li",
                                  {
                                    className: classes.row,
                                    children: [
                                      "modified" in row &&
                                        target?.id !== row.id &&
                                        jsx("button", {
                                          type: "button",
                                          className: classes.rowButton,
                                          "aria-label": t("edit-label", { command: row.label }),
                                          disabled: busy || config.status !== "ready",
                                          onClick: () => {
                                            setTarget(row);
                                          },
                                        }),
                                      jsx("span", { className: classes.commandLabel, children: row.label }),
                                      jsx("span", {
                                        className: classes.binding,
                                        children:
                                          "modified" in row
                                            ? target?.id === row.id
                                              ? jsx(
                                                  ShortcutEditor,
                                                  { target: row, ...editorProps } as unknown as ShortcutEditorProps & Record<string, unknown>,
                                                  row.id,
                                                )
                                              : jsxs(Fragment, {
                                                  children: [
                                                    jsx("span", { className: classes.rowActions, children: jsx(ShortcutIcon, { kind: "edit" }) }),
                                                    row.keys.length === 0
                                                      ? jsx("span", { className: classes.unbound, children: t("unbound") })
                                                      : jsx(primitives.ShortcutKeys, { keys: row.keys, className: classes.keyBadge }),
                                                  ],
                                                })
                                            : jsx(primitives.ShortcutKeys, { keys: row.keys, className: classes.fixedKeyBadge }),
                                      }),
                                    ],
                                  },
                                  row.id,
                                ),
                              ),
                            }),
                          ],
                        },
                        group,
                      );
                    }),
                    matches.length === 0 && jsx("p", { className: classes.hint, role: "status", children: t("empty") }),
                  ],
                }),
                jsxs("footer", {
                  className: classes.footer,
                  children: [
                    jsxs("button", {
                      type: "button",
                      className: classes.resetAll,
                      disabled: busy || config.status !== "ready" || modifiedCount === 0,
                      onClick: (event: { currentTarget: { focus(): void } }) => {
                        event.currentTarget.focus();
                        setTarget(null);
                        setResetRevision(config.revision);
                      },
                      children: [jsx(primitives.IconRefreshOutlineRegular, { size: 12 }), t("reset-all")],
                    }),
                    modifiedCount > 0 &&
                      jsx("span", { className: classes.modifiedCount, children: t("modified-count", { count: modifiedCount }) }),
                  ],
                }),
              ],
            }),
          },
        ),
        jsx(primitives.Modal, {
          open: open && resetRevision !== null,
          title: t("reset-title"),
          description: t("reset-description"),
          closeLabel: t("close-confirmation"),
          onClose: () => {
            if (!busy) setResetRevision(null);
          },
          footer: jsxs(Fragment, {
            children: [
              jsx(primitives.Button, {
                "data-modal-autofocus": true,
                disabled: busy,
                onClick: () => {
                  setResetRevision(null);
                },
                children: t("cancel"),
              }),
              jsx(primitives.Button, {
                variant: "primary",
                disabled: busy || config.status !== "ready",
                onClick: () => {
                  void resetAll();
                },
                children: t("reset"),
              }),
            ],
          }),
        }),
        toast !== null &&
          jsx(
            primitives.Toast,
            {
              text: toast.text,
              onDone: dismissToast,
              icon: jsx(ShortcutIcon, {
                kind: toast.error ? "error" : "success",
                className: toast.error ? classes.toastError : classes.toastSuccess,
              }),
            },
            toast.seq,
          ),
      ],
    });
  }

  return { ShortcutsRow, ShortcutReference, coreActionOrder };
}
