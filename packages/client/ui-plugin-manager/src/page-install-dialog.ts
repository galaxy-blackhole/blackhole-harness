/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hộp thoại cài đặt (form spec · hướng dẫn · registry · tiến trình/log · xác nhận gỡ) + bảng primitive dùng chung — port 1:1 vùng client.js (2986-3828)
 */
import { PAGE_CLASS } from "./class-names.ts";
import type { PluginManagerModules } from "./runtime.ts";
import type {
  ChangeEventLike,
  InstallFailureKindView,
  InstallInputErrorView,
  InstallRunView,
  InstallStateView,
  InstallSubjectView,
  KeyboardEventLike,
  MouseEventLike,
  PageJsx,
  PageNode,
  PageTranslate,
  PluginManagerPageDeps,
  RefLike,
  RegistryRef,
} from "./page-detail.ts";

/** Bảng lớp CSS của trang — bản gốc gọi là PluginManagerPage_module_css_default. */
const css = PAGE_CLASS;

/* ------------------------------------------------------------------------------------------------------------
 * Primitive của bộ giao diện — khai HẸP đúng phần ba file trang dùng, không import tĩnh DSH.
 * (Đặt ở file này để cả ba file cùng dưới 1000 dòng; page.ts và page-detail.ts import lại.)
 * ---------------------------------------------------------------------------------------------------------- */

/** Toạ độ fixed mà useAnchoredPosition trả (chỉ hai trường trang dùng). */
export interface AnchoredStyle {
  readonly left: number;
  readonly top: number;
}
/** Icon/artwork của bộ primitive (chỉ size, className và aria-hidden). */
export interface IconPrimitive {
  (props: { size?: number; className?: string; "aria-hidden"?: "true" }): PageNode;
}
/** Props của primitive đơn giản: chỉ thuộc tính mà trang truyền. */
export type PrimitiveProps = Readonly<Record<string, unknown>>;
/** Nút của bộ primitive. */
export interface ButtonPrimitive {
  (props: {
    children?: PageNode; variant?: "primary" | "ghost" | "outline" | "toolbar"; size?: "md" | "sm";
    icon?: PageNode; className?: string; disabled?: boolean; autoFocus?: boolean; title?: string;
    "aria-label"?: string; "aria-haspopup"?: string; "aria-expanded"?: boolean; "aria-busy"?: boolean;
    ref?: RefLike<HTMLElement | null>; onClick?: (event: MouseEventLike) => void;
    onKeyDown?: (event: KeyboardEventLike) => void;
  }): PageNode;
}
/** Menu thả xuống của bộ primitive. */
export interface MenuPrimitive {
  (props: {
    open: boolean; anchor: PageNode; children?: PageNode; onClose: () => void;
    align?: "start" | "end"; side?: "bottom" | "top" | "right"; portal?: boolean;
    autoFocus?: boolean; listClassName?: string; className?: string;
  }): PageNode;
}
/** Công tắc bật/tắt. */
export interface SwitchPrimitive {
  (props: {
    checked: boolean; onChange: (next: boolean) => void; label: string;
    disabled?: boolean; title?: string | undefined; className?: string | undefined;
  }): PageNode;
}
/** Ô nhập của bộ primitive. */
export interface InputPrimitive {
  (props: {
    type?: string; className?: string; placeholder?: string; "aria-label"?: string;
    value: string; onChange: (event: ChangeEventLike<HTMLInputElement>) => void;
  }): PageNode;
}
/** Hộp thoại giữa màn hình. */
export interface ModalPrimitive {
  (props: {
    open: boolean; onClose: () => void; title: string; closeLabel?: string; description?: string;
    headless?: boolean; className?: string; contentClassName?: string; footer?: PageNode; children?: PageNode;
  }): PageNode;
}
/** Khung terminal hiển thị một lệnh và đầu ra của nó. */
export interface TerminalBlockPrimitive {
  (props: {
    command: string; output?: string; exitCode?: number | null; running?: boolean;
    maxLines?: number; className?: string;
    labels: {
      commandLine?: (line: number) => string;
      signal: (signal: string) => string; exitCode: (code: number) => string; noExitCode: string;
      running: string; failed: string; done: string; copy: string; copied: string; noOutput: string;
      collapseAria: string; collapse: string; expandAria: (hidden: number) => string;
      expand: (hidden: number) => string;
    };
  }): PageNode;
}
/** Bảng primitive mà ba file của trang Plugins lấy qua bảng module của nửa browser. */
export interface PrimitivesSeam {
  /** Nút. */ Button: ButtonPrimitive;
  /** Menu thả xuống. */ Menu: MenuPrimitive;
  /** Dòng menu. */ MenuItemButton: (props: PrimitiveProps) => PageNode;
  /** Công tắc. */ Switch: SwitchPrimitive;
  /** Ô nhập. */ Input: InputPrimitive;
  /** Nhãn. */ Tag: (props: PrimitiveProps) => PageNode;
  /** Chấm trạng thái. */ StateDot: (props: PrimitiveProps) => PageNode;
  /** Gợi ý. */ Tooltip: (props: PrimitiveProps) => PageNode;
  /** Toast. */ Toast: (props: PrimitiveProps) => PageNode;
  /** Hộp thoại. */ Modal: ModalPrimitive;
  /** Tab phân đoạn. */ SegmentedTabs: (props: PrimitiveProps) => PageNode;
  /** Khung terminal. */ TerminalBlock: TerminalBlockPrimitive;
  /** useAnchoredPosition — toạ độ fixed cho panel neo. */
  useAnchoredPosition(options: {
    open: boolean; anchorRef: RefLike<HTMLElement | null>; panelRef: RefLike<HTMLElement | null>;
    side?: "top" | "bottom"; align?: "start" | "end"; gap: number; margin: number;
  }): AnchoredStyle | null;
  /** useDismissOnOutsidePointer — đóng panel khi bấm ra ngoài. */
  useDismissOnOutsidePointer(
    root: RefLike<HTMLElement | null>, open: boolean,
    setOpen: (open: boolean) => void, portal?: RefLike<HTMLElement | null>,
  ): void;
  /** pointerModality — lần tương tác gần nhất là chuột hay bàn phím. */
  pointerModality(): boolean;
  /** Artwork của plugin chính thức (terminal · loop · subagent · search · mặc định). */
  PluginArtworkTerminal: IconPrimitive; PluginArtworkLoop: IconPrimitive; PluginArtworkSubagent: IconPrimitive;
  PluginArtworkSearch: IconPrimitive; PluginArtworkDefault: IconPrimitive;
  /** Icon: cộng · mũi tên xuống · mũi tên phải · mũi tên trái cỡ vừa. */
  IconPlusOutlineRegular: IconPrimitive; IconChevronDownOutlineRegular: IconPrimitive;
  IconChevronRightOutlineRegular: IconPrimitive; IconChevronLeftOutlineMedium: IconPrimitive;
  /** Icon: tải xuống · làm mới · thùng rác · cảnh báo · thông tin · đóng · tích tròn. */
  IconDownloadOutlineRegular: IconPrimitive; IconRefreshOutlineRegular: IconPrimitive;
  IconTrashOutlineRegular: IconPrimitive; IconWarningOutlineRegular: IconPrimitive;
  IconInfoOutlineRegular: IconPrimitive; IconCloseOutlineMedium: IconPrimitive;
  IconCheckCircleFillRegular: IconPrimitive;
}

/* ------------------------------------------------------------------------------------------------------------
 * Props của hộp thoại.
 * ---------------------------------------------------------------------------------------------------------- */

/** Props của hộp thoại cài đặt: trạng thái lượt cài + các hành động của controller (face) + ghế dịch. */
export interface InstallDialogProps {
  /** Lượt cài và pha của nó. */ readonly install: InstallStateView;
  /** Ghế dịch. */ readonly t: PageTranslate;
  /** Đóng dialog. */ readonly onClose: () => void;
  /** Sửa spec. */ readonly onEditSpec: (text: string) => void;
  /** Kiểm tra rồi cài (hoặc chạy lại). */ readonly onRun: () => void;
  /** Rời màn hình kiểm tra/lỗi, hoặc xin dừng lượt chạy. */ readonly onCancel: () => void;
  /** Hỏi Host kết quả của lượt cài đã mất phản hồi. */ readonly onReconcile: () => void;
  /** Mở/đóng phần chi tiết. */ readonly onToggleDetails: () => void;
  /** Bật gói vừa cài. */ readonly onEnableNow: () => void;
  /** Cho phép các gói mà pnpm để script cài chờ. */ readonly onApproveBuilds: () => void;
  /** Mở/đóng các lựa chọn registry. */ readonly onToggleRegistry: () => void;
  /** Chọn một registry. */ readonly onChooseRegistry: (choice: { readonly kind: "offered"; readonly registry: RegistryRef } | { readonly kind: "custom"; readonly url: string }) => void;
  /** Từ màn hình lỗi về ô spec với các lựa chọn registry mở. */ readonly onChangeRegistry: () => void;
  /** Từ lỗi GitHub về ô spec trống hỏi mirror. */ readonly onUseGithubMirror: () => void;
}
/** Dòng chữ của card gói trong dialog cài đặt. */
export interface SubjectLines {
  readonly spec: string; readonly title: string; readonly description?: string | undefined;
  readonly version?: string | undefined; readonly showSpec: boolean;
}
/** Props của hộp thoại xác nhận gỡ: tên hiển thị + hai hành động. */
export interface ConfirmDialogProps {
  /** Tên gói để nhắc. */ readonly name: string;
  /** Ghế dịch. */ readonly t: PageTranslate;
  /** Xác nhận gỡ. */ readonly onConfirm: () => void;
  /** Bỏ qua. */ readonly onCancel: () => void;
}
/** Hai hộp thoại mà createInstallDialog trả về. */
export interface InstallDialogParts {
  /** Hộp thoại cài đặt (form spec, hướng dẫn, registry, tiến trình, log). */
  readonly InstallDialog: (props: InstallDialogProps) => PageNode;
  /** Hộp thoại xác nhận gỡ. */
  readonly ConfirmDialog: (props: ConfirmDialogProps) => PageNode;
}

/** Số dòng đầu ra mà terminal của một lượt cài hiện trước khi gập phần giữa: sáu dòng đầu và sáu dòng cuối của log dài. */
const INSTALL_TERMINAL_LINES = 12;
/** Câu dưới ô nhập khi spec bị kiểm tra từ chối. */
const INPUT_PROBLEM_KEYS: Readonly<Record<InstallInputErrorView["problem"], string>> = {
  "invalid-spec": "installProblemInvalid", "already-installed": "installProblemInstalled",
  "shipped": "installProblemShipped", "not-found": "installProblemNotFound",
  "not-a-package": "installProblemNotPackage", "not-a-bundle": "installProblemNotBundle",
  "network": "installProblemNetwork", "unknown": "installProblemUnknown",
};
/** Dạng spec mà hướng dẫn cài hiện, kèm ví dụ người dùng có thể đưa vào ô. */
const GUIDE_EXAMPLES: readonly { key: string; titleKey: string; exampleKey: string; hintKey: string }[] = [
  { key: "id", titleKey: "installGuideIdTitle", exampleKey: "installGuideIdExample", hintKey: "installGuideIdHint" },
];
/** Cách đọc một lỗi pnpm đã phân loại thành một dòng. */
const FAILURE_KIND_KEYS: Readonly<Record<InstallFailureKindView, string>> = {
  "pnpm-missing": "installFailurePnpmMissing", "timeout": "installFailureTimeout",
  "not-found": "installFailureNotFound", "no-matching-version": "installFailureNoMatchingVersion",
  "network": "installFailureNetwork", "disk-full": "installFailureDiskFull",
  "permission": "installFailurePermission", "build-blocked": "installFailureBuildBlocked",
  "integrity": "installFailureIntegrity", "unknown": "installFailureGeneric",
};
/** Tiêu đề của mỗi màn hình sau ô spec. */
const SCREEN_TITLE_KEYS: Readonly<Record<string, string>> = {
  starting: "installStarting", running: "installingTitle", cancelling: "installCancelling",
  applying: "installApplying", unconfirmed: "installUnconfirmedTitle", unknown: "installUnknownTitle",
  done: "installedTitle", failed: "installFailedTitle",
};
/** Câu mô tả dạng spec khi gói không có mô tả riêng. */
const SUBJECT_KIND_KEYS: Readonly<Record<string, string | undefined>> = {
  registry: undefined, path: "installSubjectPath", git: "installSubjectGit", tarball: "installSubjectTarball",
};

/**
 * Bộ theo dõi composition của một ô nhập, kể cả cửa sổ 10ms sau composition của Safari.
 * Nhận: active — ô có đang dùng hay không (đổi thì đặt lại bộ theo dõi).
 * Trả: hai handler composition, handler blur và hàm isComposing của sự kiện gốc.
 */
function useInstallComposition(active: boolean, react: PluginManagerModules["react"]): {
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onBlur: () => void;
  isComposing: (event: { readonly isComposing?: boolean; readonly keyCode?: number }) => boolean;
} {
  const composition = react.useRef({ active: false, until: 0 });
  react.useEffect(() => {
    composition.current = { active: false, until: 0 };
  }, [active]);
  return {
    onCompositionStart: () => {
      composition.current.active = true;
    },
    onCompositionEnd: () => {
      composition.current = { active: false, until: Date.now() + 10 };
    },
    onBlur: () => {
      composition.current = { active: false, until: 0 };
    },
    isComposing: (event) =>
      event.isComposing === true || Reflect.get(event, "keyCode") === 229 || composition.current.active || Date.now() < composition.current.until,
  };
}

/**
 * Dựng hai hộp thoại của trang Plugins (port 1:1 vùng install dialog của bundle gốc).
 *
 * Nhận: modules — bảng module của nửa browser; deps — các hàm thuộc cụm file khác.
 * Trả: InstallDialogParts — hộp thoại cài đặt và hộp thoại xác nhận gỡ, đã ràng buộc vào modules.
 */
export function createInstallDialog(modules: PluginManagerModules, deps: PluginManagerPageDeps): InstallDialogParts {
  const react = modules.react;
  const jsx = modules.jsxRuntime.jsx as PageJsx;
  const jsxs = modules.jsxRuntime.jsxs as PageJsx;
  const Fragment = modules.jsxRuntime.Fragment as (props: { children?: PageNode }) => PageNode;
  const useId = modules.react.useId as () => string;
  const createPortal = modules.reactDom.createPortal;
  const prim = modules.primitives as unknown as PrimitivesSeam;
  const { Button, Modal, StateDot, TerminalBlock } = prim;
  const { IconWarningOutlineRegular, IconChevronDownOutlineRegular, IconCloseOutlineMedium } = prim;
  const { IconChevronLeftOutlineMedium, IconCheckCircleFillRegular } = prim;
  const { registryText, managementText, restartText } = deps;
  const { offeredRegistries, isInstallPending, githubRecoveryRegistry, asksMirror } = deps;

  /** Copy hiển thị của terminal cài đặt, lấy từ từ điển của tab. */
  function terminalLabels(t: PageTranslate): Parameters<TerminalBlockPrimitive>[0]["labels"] {
    return {
      commandLine: (line) => t("terminalCommandLine", { n: String(line) }),
      signal: (signal) => t("terminalSignal", { signal }),
      exitCode: (code) => t("terminalExitCode", { code: String(code) }),
      noExitCode: t("terminalNoExitCode"), running: t("terminalRunning"),
      failed: t("terminalFailed"), done: t("terminalDone"),
      copy: t("terminalCopy"), copied: t("terminalCopied"), noOutput: t("terminalNoOutput"),
      collapseAria: t("terminalCollapseAria"), collapse: t("terminalCollapse"),
      expandAria: (hidden) => t("terminalExpandAria", { n: String(hidden) }),
      expand: (hidden) => t("terminalExpand", { n: String(hidden) }),
    };
  }

  /** Một lượt kiểm tra mà không registry nào trả lời thì nêu mọi registry đã hỏi; từ chối khác đọc theo vấn đề của nó. */
  function inputProblemSentence(problem: InstallInputErrorView, t: PageTranslate, resolved: string | null): string {
    const asked = problem.registries ?? [];
    return problem.problem === "network" && asked.length > 1
      ? t("installProblemNetworkAll", { registries: registryList(asked, t, resolved) })
      : t(INPUT_PROBLEM_KEYS[problem.problem], { reason: problem.reason });
  }

  /** Các registry đã hỏi, theo tên, ở dạng danh sách của từ điển. */
  function registryList(registries: readonly RegistryRef[], t: PageTranslate, resolved: string | null): string {
    return registries.map((registry) => registryText(registry, t, resolved).name).join(t("registryListSeparator"));
  }

  /** Tên một lựa chọn kèm host ở chữ bậc ba, trừ khi host chính là tên. */
  function registryOption(registry: RegistryRef, t: PageTranslate, resolved: string | null): PageNode {
    const { name, host } = registryText(registry, t, resolved);
    return name === host ? name : jsxs(Fragment, { children: [name, " ", jsx("span", { className: css.registryHint, children: host })] });
  }

  /**
   * Dòng duy nhất của màn hình lỗi: lỗi pnpm theo loại, từ chối theo mã, lỗi khác theo lời Host; đầu ra của lượt chạy
   * nằm sau phần chi tiết. Lượt chạy mà Host quy cho host của spec thì nói vậy; quy cho registry thì nêu mọi registry
   * đã hỏi khi có nhiều hơn một.
   */
  function failureText(failure: InstallStateView["failure"], t: PageTranslate, install: InstallStateView): string {
    if (failure === null) return t("installFailureGeneric");
    if (failure.code === "incompatible-version") {
      const incompatible = failure.incompatible === undefined ? {} : { incompatible: failure.incompatible };
      return managementText({ code: failure.code, installing: true, ...incompatible }, t);
    }
    if (failure.kind === "build-blocked" && !failure.pendingBuilds?.length) return t("installFailureBuildBlockedManual");
    const host = install.subject?.host;
    if (failure.failedAt === "spec-host" && host !== undefined) return t("installFailureNetworkHost", { host });
    const asked = install.attempts?.registries ?? [];
    if (failure.failedAt === "registry" && (failure.kind === "network" || failure.kind === "timeout") && asked.length > 1)
      return t("installFailureNetworkAll", { registries: registryList(asked, t, install.registries?.resolved ?? null) });
    if (failure.kind !== undefined) return t(FAILURE_KIND_KEYS[failure.kind]);
    if (failure.code !== undefined) return managementText({ code: failure.code, diagnostic: failure.reason }, t);
    return failure.reason === "" ? t("installFailureGeneric") : failure.reason;
  }

  /** Gói mà lượt cài nói tới: tên, dòng mô tả, phiên bản và, khi showSpec bật, cả spec. */
  function SubjectBlock({ lines, t }: { readonly lines: SubjectLines; readonly t: PageTranslate }): PageNode {
    return jsxs("div", {
      className: css.subject, "data-install-subject": lines.spec,
      children: [
        jsx("p", { className: css.subjectName, children: lines.title }),
        lines.description === undefined ? null : jsx("p", { className: css.subjectDesc, children: lines.description }),
        lines.version === undefined ? null : jsx("p", { className: css.subjectMeta, children: t("installVersion", { version: lines.version }) }),
        lines.showSpec ? jsx("p", { className: css.subjectSpec, children: lines.spec }) : null,
      ],
    });
  }

  /** Gói đã kiểm tra như Host đọc trước khi cài; phiên bản đã xác nhận giữ tên và phiên bản của tab nó. */
  function SubjectCard({
    subject, confirmed, t,
  }: {
    readonly subject: InstallSubjectView;
    readonly confirmed: { readonly title: string; readonly version: string } | undefined;
    readonly t: PageTranslate;
  }): PageNode {
    const kindKey = SUBJECT_KIND_KEYS[subject.kind];
    return jsx(SubjectBlock, {
      t,
      lines: {
        spec: subject.spec, title: confirmed?.title ?? subject.name ?? subject.spec,
        description: subject.description ?? (kindKey === undefined ? undefined : t(kindKey)),
        version: subject.version ?? confirmed?.version, showSpec: confirmed !== undefined,
      },
    });
  }

  /**
   * Hộp thoại cài đặt: ô spec và lượt kiểm tra, rồi các màn hình đang cài, đã cài và thất bại trên cùng một card gói.
   * Một lượt chạy hỏng còn để script cài chưa quyết thì hiện chúng để cho phép ngay tại chỗ thay vì chỉ thử lại.
   */
  function InstallDialog({
    install,
    t,
    onClose,
    onEditSpec,
    onRun,
    onCancel,
    onReconcile,
    onToggleDetails,
    onEnableNow,
    onApproveBuilds,
    onToggleRegistry,
    onChooseRegistry,
    onChangeRegistry,
    onUseGithubMirror,
  }: InstallDialogProps): PageNode {
    const errorId = useId();
    const templateHintId = useId();
    const guideId = useId();
    const approvalId = useId();
    const registryId = useId();
    const registryErrorId = useId();
    const [guideOpen, setGuideOpen] = react.useState<boolean>(false);
    const [customRegistryDraft, setCustomRegistryDraft] = react.useState<string>("");
    const { phase } = install;
    const registryToggleRef = react.useRef<HTMLElement | null>(null);
    const registryPanelRef = react.useRef<HTMLElement | null>(null);
    const registryCustomRef = react.useRef<HTMLInputElement | null>(null);
    const registryShown = install.registryOpen && phase === "idle";
    const specComposition = useInstallComposition(install.open && phase === "idle", react);
    const registryComposition = useInstallComposition(install.open && registryShown, react);
    const registryPosition = prim.useAnchoredPosition({
      open: registryShown,
      anchorRef: registryToggleRef,
      panelRef: registryPanelRef,
      align: "end",
      gap: 6,
      margin: 12,
    });
    const registryReady = registryShown && registryPosition !== null;
    react.useEffect(() => {
      if (registryReady && install.registryError) registryCustomRef.current?.focus();
    }, [registryReady, install.registryError]);
    prim.useDismissOnOutsidePointer(registryToggleRef, registryShown, onToggleRegistry, registryPanelRef);
    react.useEffect(() => {
      if (!registryShown) return;
      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onToggleRegistry();
      };
      document.addEventListener("keydown", onKeyDown, true);
      return () => {
        document.removeEventListener("keydown", onKeyDown, true);
      };
    }, [registryShown, onToggleRegistry]);
    if (githubRecoveryRegistry(install) !== undefined) {
      const anotherWay = asksMirror(install);
      return jsx(Modal, {
        open: install.open,
        onClose,
        title: t(install.failure?.kind === "timeout" ? "installGithubTimeoutTitle" : "installGithubFailedTitle"),
        closeLabel: t("close"),
        description: t("installGithubFailedDescription"),
        footer: jsxs(Fragment, {
          children: [
            jsx(Button, { variant: "outline", onClick: onClose, children: t("cancel") }),
            jsx(Button, {
              variant: "primary",
              autoFocus: true,
              onClick: () => {
                if (anotherWay) setGuideOpen(true);
                onUseGithubMirror();
              },
              children: t(anotherWay ? "installTryAnotherWay" : "installUseGithubMirror"),
            }),
          ],
        }),
      });
    }
    if ((phase === "idle" || phase === "checking") && install.confirmed !== undefined) {
      const checking = phase === "checking";
      const problem = install.inputError;
      return jsx(Modal, {
        open: install.open,
        onClose,
        title: t(problem === null ? "installConfirmedTitle" : "installConfirmedRefused"),
        closeLabel: t("close"),
        className: css.installDialog,
        footer: checking
          ? undefined
          : jsxs(Fragment, {
              children: [
                jsx(Button, { variant: "outline", onClick: onClose, children: t("close") }),
                jsx(Button, {
                  variant: "primary",
                  autoFocus: true,
                  onClick: onRun,
                  children: t(problem === null ? "installRun" : "retry"),
                }),
              ],
            }),
        children: jsxs("div", {
          className: css.installBody,
          "data-install-phase": phase,
          children: [
            jsx(SubjectBlock, { t, lines: { spec: install.spec, ...install.confirmed, showSpec: true } }),
            checking
              ? jsxs("p", {
                  className: css.status + " " + css.statusWithDot,
                  role: "status",
                  children: [jsx(StateDot, { state: "ongoing" }), t("installChecking")],
                })
              : problem === null
                ? null
                : jsx("p", {
                    className: css.inputError,
                    role: "alert",
                    children: inputProblemSentence(problem, t, install.registries?.resolved ?? null),
                  }),
          ],
        }),
      });
    }
    if (phase === "idle" || phase === "checking") {
      const checking = phase === "checking";
      const empty = install.spec.trim() === "";
      const choice = install.registry;
      const resolved = install.registries?.resolved ?? null;
      const chosenTitle = choice.kind === "custom" ? t("registryCustom") : registryText(choice.registry, t, resolved).name;
      const inputSentence = install.inputError === null ? null : inputProblemSentence(install.inputError, t, resolved);
      const templateHint =
        install.spec === "https://github.com/author/dsh-plugin"
          ? t("installGitTemplateHint")
          : install.spec === "/Users/name/my-plugin"
            ? t("installPathTemplateHint")
            : null;
      return jsx(Modal, {
        open: install.open,
        onClose,
        title: t("installTitle"),
        closeLabel: t("close"),
        ...(install.mirrorRecovery ? {} : { description: t("installDescription") }),
        className: css.installDialog,
        contentClassName: css.installContent,
        footer: jsxs("div", {
          className: css.installFooter,
          children: [
            jsxs("p", {
              className: css.installSafety,
              role: "note",
              children: [
                jsx(IconWarningOutlineRegular, { size: 14, "aria-hidden": "true" }),
                jsxs("span", {
                  className: css.installSafetyText,
                  children: [jsx("span", { children: t("installGuideSafety") }), jsx("span", { children: t("installUpgradeNotice") })],
                }),
              ],
            }),
            jsxs(Button, {
              variant: "primary",
              className: css.wide,
              disabled: checking || empty,
              "aria-busy": checking,
              onClick: onRun,
              children: [checking ? jsx(StateDot, { state: "ongoing" }) : null, t(checking ? "installChecking" : "installRun")],
            }),
          ],
        }),
        children: jsxs("div", {
          className: css.installBody,
          children: [
            jsx("div", {
              className: css.installField,
              children: jsx("input", {
                type: "text",
                autoFocus: install.mirrorRecovery === true,
                "data-modal-autofocus": true,
                value: install.spec,
                placeholder: t("installSpecPlaceholder"),
                disabled: checking,
                "aria-label": t(install.mirrorRecovery === true ? "installPackageLabel" : "installSpecLabel"),
                "aria-invalid": install.inputError !== null,
                "aria-describedby": inputSentence !== null ? errorId : templateHint !== null ? templateHintId : undefined,
                onChange: (event: ChangeEventLike<HTMLInputElement>) => {
                  onEditSpec(event.currentTarget.value);
                },
                onCompositionStart: specComposition.onCompositionStart,
                onCompositionEnd: specComposition.onCompositionEnd,
                onBlur: specComposition.onBlur,
                onKeyDown: (event: KeyboardEventLike) => {
                  if (specComposition.isComposing(event.nativeEvent)) return;
                  if (event.key === "Enter" && !empty && !checking) onRun();
                },
              }),
            }),
            inputSentence === null
              ? null
              : jsx("p", { id: errorId, className: css.inputError, role: "alert", children: inputSentence }),
            inputSentence === null && templateHint !== null
              ? jsx("p", { id: templateHintId, className: css.templateHint, role: "status", children: templateHint })
              : null,
            jsxs("div", {
              className: css.optionsRow,
              children: [
                jsxs("button", {
                  type: "button",
                  className: css.guideToggle,
                  "aria-expanded": guideOpen,
                  "aria-controls": guideId,
                  onClick: () => {
                    setGuideOpen((open) => !open);
                  },
                  children: [
                    jsx(IconChevronDownOutlineRegular, { className: css.guideChevron, "aria-hidden": "true" }),
                    jsx("span", { children: t(guideOpen ? "installGuideHide" : "installGuideToggle") }),
                  ],
                }),
                jsxs("button", {
                  ref: registryToggleRef,
                  type: "button",
                  className: css.registryToggle,
                  "aria-expanded": install.registryOpen,
                  "aria-controls": registryId,
                  "aria-haspopup": "dialog",
                  disabled: checking,
                  onClick: onToggleRegistry,
                  children: [
                    jsx("span", { children: t("registryToggle") }),
                    " ",
                    jsx("span", { className: css.registryChosen, children: chosenTitle }),
                    jsx(IconChevronDownOutlineRegular, { className: css.guideChevron, "aria-hidden": "true" }),
                  ],
                }),
              ],
            }),
            guideOpen
              ? jsx("div", {
                  id: guideId,
                  className: css.guide,
                  "data-install-guide": true,
                  children: jsx("ol", {
                    className: css.guideList,
                    children: GUIDE_EXAMPLES.map(({ key, titleKey, exampleKey, hintKey }) =>
                      jsxs(
                        "li",
                        {
                          className: css.guideItem,
                          children: [
                            jsxs("div", {
                              className: css.guideMain,
                              children: [
                                jsx("span", { className: css.guideTitle, children: t(titleKey) }),
                                jsx("span", { className: css.guideHint, children: t(hintKey) }),
                                jsxs("span", {
                                  className: css.guideExample,
                                  children: [
                                    jsx("span", { className: css.guideExampleLabel, children: t("installGuideExampleLabel") }),
                                    jsx("code", { children: t(exampleKey) }),
                                  ],
                                }),
                              ],
                            }),
                            jsx(Button, {
                              variant: "outline",
                              size: "sm",
                              "aria-label": t("installGuideFillAria", { example: t(exampleKey) }),
                              disabled: checking,
                              onClick: () => {
                                onEditSpec(t(exampleKey));
                              },
                              children: t("installGuideFill"),
                            }),
                          ],
                        },
                        key,
                      ),
                    ),
                  }),
                })
              : null,
            registryShown
              ? createPortal(
                  jsxs("fieldset", {
                    ref: registryPanelRef,
                    id: registryId,
                    className: css.registry,
                    style: registryPosition ?? { visibility: "hidden", left: 0, top: 0 },
                    "data-install-registry": true,
                    "aria-label": t("registryLegend"),
                    onKeyDown: (event: KeyboardEventLike) => {
                      if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey || event.nativeEvent.isComposing === true) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const radio = event.currentTarget.querySelector<HTMLInputElement>('input[type="radio"]:checked');
                      const field = registryCustomRef.current;
                      if (event.shiftKey && event.target === field) radio?.focus();
                      else if (!event.shiftKey && event.target !== field) field?.focus();
                      else {
                        onToggleRegistry();
                        registryToggleRef.current?.focus();
                      }
                    },
                    children: [
                      offeredRegistries(install.registries).map((registry) => {
                        const checked = choice.kind === "offered" && choice.registry === registry;
                        return jsxs(
                          "label",
                          {
                            className: css.registryOption,
                            "data-checked": checked,
                            children: [
                              jsx("input", {
                                type: "radio",
                                name: registryId,
                                checked,
                                onChange: () => {
                                  if (choice.kind === "custom") setCustomRegistryDraft(choice.url);
                                  onChooseRegistry({ kind: "offered", registry });
                                },
                              }),
                              jsx("span", { className: css.registryTitle, children: registryOption(registry, t, resolved) }),
                            ],
                          },
                          registry ?? "",
                        );
                      }),
                      jsxs("div", {
                        className: css.registryOption,
                        "data-checked": choice.kind === "custom",
                        onClick: (event: MouseEventLike) => {
                          if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
                          registryCustomRef.current?.focus();
                        },
                        children: [
                          jsxs("label", {
                            className: css.registryCustomPick,
                            children: [
                              jsx("input", {
                                type: "radio",
                                name: registryId,
                                checked: choice.kind === "custom",
                                onChange: () => {
                                  onChooseRegistry({ kind: "custom", url: customRegistryDraft });
                                  registryCustomRef.current?.focus();
                                },
                              }),
                              jsx("span", {
                                className: css.registryTitle,
                                children: jsx("span", { children: t("registryCustom") }),
                              }),
                            ],
                          }),
                          jsx("input", {
                            ref: registryCustomRef,
                            type: "text",
                            className: css.registryCustomField,
                            "aria-label": t("registryCustom"),
                            placeholder: t("registryCustomPlaceholder"),
                            value: choice.kind === "custom" ? choice.url : customRegistryDraft,
                            "aria-invalid": install.registryError,
                            "aria-describedby": install.registryError ? registryErrorId : undefined,
                            onFocus: () => {
                              if (prim.pointerModality() && choice.kind !== "custom")
                                onChooseRegistry({ kind: "custom", url: customRegistryDraft });
                            },
                            onChange: (event: ChangeEventLike<HTMLInputElement>) => {
                              onChooseRegistry({ kind: "custom", url: event.currentTarget.value });
                            },
                            onCompositionStart: registryComposition.onCompositionStart,
                            onCompositionEnd: registryComposition.onCompositionEnd,
                            onBlur: registryComposition.onBlur,
                            onKeyDown: (event: KeyboardEventLike) => {
                              if (registryComposition.isComposing(event.nativeEvent)) return;
                              if (event.key === "Enter" && !empty) onRun();
                            },
                          }),
                          install.registryError
                            ? jsx("p", { id: registryErrorId, className: css.inputError, role: "alert", children: t("registryCustomInvalid") })
                            : null,
                          jsx("span", { className: css.registryHint, children: t("registryCustomHint") }),
                        ],
                      }),
                    ],
                  }),
                  document.body,
                )
              : null,
          ],
        }),
      });
    }
    const heading = t(SCREEN_TITLE_KEYS[phase] ?? "installFailedTitle");
    const pending = isInstallPending(phase);
    const cancellable = phase === "starting" || phase === "running" || phase === "unconfirmed";
    const stoppable = cancellable || phase === "failed" || phase === "unknown";
    const failure = install.failure;
    const uncertainty = failure?.uncertainty;
    const uncertaintyText =
      failure?.uncertainty === undefined
        ? null
        : t(
            {
              result: "installResultUnconfirmed",
              cancellation: phase === "applying" ? "installApplyingCancellationError" : "installCancelUnconfirmed",
              acceptance: "installAwaitingAcceptance",
            }[failure.uncertainty],
            { reason: failure.reason },
          );
    const pendingBuilds = phase === "failed" ? (install.failure?.pendingBuilds ?? []) : [];
    const approvable = pendingBuilds.length > 0;
    const firstRun = install.runs[0];
    const asked = install.attempts !== null && install.attempts.registries.length > 1 ? install.attempts : null;
    const current = asked === null ? undefined : asked.registries.at(-1);
    const previous = asked === null ? undefined : asked.registries.at(-2);
    const resolved = install.registries?.resolved ?? null;
    const attemptLine =
      pending && asked !== null && current !== undefined && previous !== undefined
        ? t("installAttempt", {
            previous: registryText(previous, t, resolved).name,
            registry: registryText(current, t, resolved).name,
            index: String(asked.registries.length),
            total: String(asked.total),
          })
        : null;
    const changeable = phase === "failed" && !approvable && install.failure?.failedAt === "registry" && install.confirmed === undefined;
    const subject = install.subject;
    return jsx(Modal, {
      open: install.open,
      onClose,
      title: heading,
      headless: true,
      className: css.installDialog,
      children: jsxs("div", {
        className: css.wizard,
        "data-install-phase": phase,
        children: [
          jsxs("div", {
            className: css.wizardHead,
            children: [
              phase === "done" || (install.confirmed !== undefined && !pending)
                ? jsx("span", {})
                : jsxs("button", {
                    type: "button", className: css.wizardBack, disabled: !stoppable, onClick: onCancel,
                    "aria-label": t(install.confirmed !== undefined ? "cancel" : pending ? "installCancelAndEdit" : "installEditAria"),
                    children: [
                      jsx(IconChevronLeftOutlineMedium, { "aria-hidden": "true" }),
                      jsx("span", { children: t(install.confirmed !== undefined ? "cancel" : pending ? "installCancelAndEdit" : "installEdit") }),
                    ],
                  }),
              jsx("button", {
                type: "button", className: css.wizardClose, onClick: onClose,
                "aria-label": t(cancellable ? "installCloseCancels" : "close"),
                children: jsx(IconCloseOutlineMedium, { size: 14 }),
              }),
            ],
          }),
          jsxs("div", {
            className: css.wizardScroll,
            children: [
              jsxs("div", {
                className: css.wizardHero,
                children: [
                  jsx("span", {
                    className: css.wizardIcon, "aria-hidden": "true",
                    "data-state": pending ? "ongoing" : phase === "done" ? "done" : "error",
                    children: pending
                      ? jsx(StateDot, { state: "ongoing", size: 28 })
                      : phase === "done"
                        ? jsx(IconCheckCircleFillRegular, { size: 28 })
                        : jsx(IconWarningOutlineRegular, { size: 28 }),
                  }),
                  jsx("h2", { className: css.wizardTitle, role: phase === "failed" ? "alert" : "status", children: heading }),
                  phase === "failed" ? jsx("p", { className: css.wizardSub, children: failureText(install.failure, t, install) }) : null,
                  attemptLine === null ? null : jsx("p", { className: css.wizardSub, children: attemptLine }),
                  uncertaintyText === null ? null : jsx("p", { className: css.wizardSub, role: "alert", children: uncertaintyText }),
                  phase === "unknown" ? jsx("p", { className: css.wizardSub, children: t("installUnknownDescription") }) : null,
                ],
              }),
              subject === null
                ? null
                : jsx(SubjectCard, {
                    subject: phase === "done" && install.installedVersion !== null ? { ...subject, version: install.installedVersion } : subject,
                    confirmed: install.confirmed, t,
                  }),
              approvable
                ? jsxs("section", {
                    className: css.approval, role: "group", "data-install-approval": true, "aria-labelledby": approvalId,
                    children: [
                      jsx("h3", { id: approvalId, className: css.approvalTitle, children: t("installApprovalTitle") }),
                      jsx("p", { className: css.approvalText, children: t("installApprovalDescription") }),
                      jsx("ul", {
                        className: css.approvalList,
                        children: pendingBuilds.map((name) => jsx("li", { children: jsx("code", { children: name }) }, name)),
                      }),
                      jsx("p", { className: css.approvalText, children: t("installApprovalConsequence") }),
                      jsx("p", { className: css.approvalCaution, children: t("installApprovalCaution") }),
                      jsx(Button, { variant: "primary", className: css.wide, onClick: onApproveBuilds, children: t("installApproveAndRetry") }),
                    ],
                  })
                : null,
              phase === "done" && install.installed === null
                ? jsx("p", { className: css.result, role: "status", children: t("installDoneNothing") })
                : null,
              phase === "done" && install.restartRequired
                ? jsx("p", { className: css.resultWarn, role: "status", children: restartText("installDoneRestart", install.restartReason, t) })
                : null,
              phase === "done" && subject?.kind === "registry" && subject.name !== undefined && subject.version !== undefined &&
              install.installedVersion !== null && install.installedVersion !== subject.version &&
              (install.attempts?.registries.length ?? 1) === 1
                ? jsx("p", {
                    className: css.resultWarn, role: "status",
                    children: t("installDoneOtherVersion", {
                      installed: install.installedVersion, version: subject.version, exact: subject.name + "@" + subject.version,
                    }),
                  })
                : null,
              phase === "done" && install.approvedBuilds.length > 0
                ? jsx("p", {
                    className: css.result, role: "status",
                    children: t("installDoneApproved", { names: install.approvedBuilds.join(", ") }),
                  })
                : null,
              jsxs("div", {
                className: css.wizardFoot,
                children: [
                  jsxs("button", {
                    type: "button", className: css.detailsToggle, onClick: onToggleDetails, "aria-expanded": install.detailsOpen,
                    children: [
                      jsx("span", { children: t(install.detailsOpen ? "installDetailsHide" : "installDetailsShow") }),
                      jsx(IconChevronDownOutlineRegular, { className: css.detailsChevron, "aria-hidden": "true" }),
                    ],
                  }),
                  uncertainty === "result"
                    ? jsx(Button, { variant: "outline", size: "sm", className: css.footAction, onClick: onReconcile, children: t("installReconcile") })
                    : null,
                  pending
                    ? jsx(Button, {
                        variant: "outline", size: "sm", className: css.footAction, disabled: !cancellable, onClick: onCancel,
                        children: t(phase === "cancelling" ? "installCancelling" : "installCancel"),
                      })
                    : null,
                  phase === "failed" && !approvable
                    ? jsxs("span", {
                        className: css.wizardActions,
                        children: [
                          changeable
                            ? jsx(Button, {
                                variant: "outline", size: "sm", className: css.footAction, onClick: onChangeRegistry,
                                children: t("installChangeRegistry"),
                              })
                            : null,
                          jsx(Button, { variant: "primary", size: "sm", className: css.footAction, onClick: onRun, children: t("installRetry") }),
                        ],
                      })
                    : null,
                ],
              }),
              install.detailsOpen
                ? jsxs("div", {
                    className: css.detailsBody,
                    children: [
                      jsx("p", {
                        className: css.installLocation,
                        children: firstRun === undefined ? t("terminalNoOutput") : t("installLocation", { dir: firstRun.cwd }),
                      }),
                      install.runs.map((run: InstallRunView, index: number) => {
                        const registry = asked?.registries[index];
                        return jsxs(
                          "div",
                          {
                            className: css.run,
                            children: [
                              registry === undefined
                                ? null
                                : jsx("p", {
                                    className: css.attemptBadge,
                                    children: t("installAttemptBadge", { index: String(index + 1), registry: registryText(registry, t, resolved).name }),
                                  }),
                              jsx(TerminalBlock, {
                                command: run.command, output: run.output, running: run.exitCode === undefined,
                                exitCode: run.exitCode, maxLines: INSTALL_TERMINAL_LINES,
                                labels: {
                                  ...terminalLabels(t),
                                  ...(phase === "cancelling" ? { failed: t("installCancelledShort") } : {}),
                                },
                                className: css.terminal,
                              }),
                            ],
                          },
                          run.jobId,
                        );
                      }),
                    ],
                  })
                : null,
              phase !== "done"
                ? null
                : install.installed !== null && install.subject?.selection === undefined
                  ? jsx(Button, {
                      variant: "primary",
                      className: css.wide,
                      disabled: install.enabling,
                      "aria-busy": install.enabling,
                      onClick: onEnableNow,
                      children: t("installEnableNow"),
                    })
                  : jsx(Button, { variant: "primary", className: css.wide, onClick: onClose, children: t("installClose") }),
            ],
          }),
        ],
      }),
    });
  }

  /** Hộp thoại xác nhận mà một lượt gỡ chờ. */
  function ConfirmDialog({ name, t, onConfirm, onCancel }: ConfirmDialogProps): PageNode {
    return jsx(Modal, {
      open: true,
      onClose: onCancel,
      title: t("confirmUninstallTitle", { name }),
      closeLabel: t("close"),
      description: t("confirmUninstallDescription"),
      footer: jsxs(Fragment, {
        children: [
          jsx(Button, { variant: "outline", onClick: onCancel, children: t("cancel") }),
          jsx(Button, { variant: "primary", className: css.dangerButton, onClick: onConfirm, children: t("confirmUninstall") }),
        ],
      }),
    });
  }

  return { InstallDialog, ConfirmDialog };
}
