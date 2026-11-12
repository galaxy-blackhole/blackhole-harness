/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Than tab trinh duyet: thanh cong cu, o dia chi, canh bao sandbox, loi tai va vung noi dung
 */

import { emptyBrowserFrame, type BrowserFrameState } from "../frame.ts";
import { currentBrowserTarget, type BrowserTabState } from "../persistence.ts";
import { CLASS } from "./css.ts";
import { createSandboxPolicyIcon, type SandboxIconPrimitivesLike } from "./icons.ts";
import type { BrowserControllerState } from "../controller.ts";
import type { BrowserMountRequest } from "../controllers.ts";
import type { BrowserState } from "../store.ts";
import type { JsxRuntimeLike, ReactLike, TabInfoLike } from "../types.ts";

/** Phan cua ui-primitives ma than trinh duyet can. */
export interface BrowserBodyPrimitivesLike extends SandboxIconPrimitivesLike {
  /** Bieu tuong lui. */
  IconChevronLeftOutlineRegular: unknown;
  /** Bieu tuong tien. */
  IconChevronRightOutlineRegular: unknown;
  /** Bieu tuong tai lai. */
  IconRefreshOutlineRegular: unknown;
  /** Bieu tuong di. */
  IconLinkOutlineRegular: unknown;
  /** Bieu tuong mo ra ngoai. */
  IconRightUpOutlineRegular: unknown;
  /** Nhan co goi y. */
  Tooltip: unknown;
  /** Nut cua bo primitive. */
  Button: unknown;
}

/** Props ma cho ngoi than tab bom cho than trinh duyet. */
export interface BrowserBodyProps {
  /** Gan tab vao vung noi dung. */
  mount(request: BrowserMountRequest): () => void;
  /** Tai mot dia chi trong tab. */
  loadUrl(tabId: string, value: string): void;
  /** Khoi phuc dia chi da luu. */
  restore(tabId: string): void;
  /** Lui. */
  goBack(tabId: string): void;
  /** Tien. */
  goForward(tabId: string): void;
  /** Tai lai. */
  reload(tabId: string): void;
  /** Bat/tat sandbox nhung. */
  setSandbox(tabId: string, enabled: boolean): void;
  /** Hook trang thai trinh duyet theo tab. */
  useBrowserState: (key: string) => BrowserControllerState | undefined;
  /** Hook doc store checkpoint. */
  useStore: <S>(selector: (state: BrowserState) => S) => S;
  /** Hook thong tin tab. */
  useTabInfo: () => TabInfoLike;
  /** Action cua store (dung lam khoa phu thuoc cua hieu ung). */
  actions: unknown;
  /** Ham doc tu dien da bind namespace. */
  t: (key: string, params?: Record<string, string>) => string;
}

/** Trang thai khung dung khi tab chua co controller. */
const EMPTY_FRAME: BrowserFrameState = emptyBrowserFrame();

/**
 * Dung than tab trinh duyet.
 * Nhan: runtime — jsx runtime; react — module react; primitives — phan ui-primitives can dung.
 * Tra: component nhan props cua cho ngoi than tab.
 */
export function createBrowserBody(
  runtime: JsxRuntimeLike,
  react: ReactLike,
  primitives: BrowserBodyPrimitivesLike,
): (props: BrowserBodyProps) => unknown {
  const { jsx, jsxs } = runtime;
  const SandboxPolicyIcon = createSandboxPolicyIcon(runtime, primitives);

  /**
  * Ban nhap cua o dia chi: gia tri nguoi dung go duoc giu theo the he dia chi.
  * Nhan: url — dia chi dang hien; revision — the he ban nhap cua controller.
  * Tra: cap [ban nhap, ham ghi ban nhap].
  */
  function useBrowserDraft(url: string | undefined, revision: number): [string, (value: string) => void] {
    const [edit, setEdit] = react.useState<{ revision: number; value: string } | undefined>(undefined);
    const value = edit?.revision === revision ? edit.value : (url ?? "");
    return [value, (next: string): void => { setEdit({ revision, value: next }); }];
  }

  return function BrowserBody(props: BrowserBodyProps): unknown {
    const { mount, loadUrl, restore, goBack, goForward, reload, setSandbox, useBrowserState, useStore, useTabInfo, t } = props;
    const { tab } = useTabInfo();
    react.useEffect(
      () => tab.actions.bindCommands({ refresh: (): void => { reload(tab.id); } }),
      [tab.actions, tab.id, reload],
    );
    const initial = react.useRef<BrowserTabState | undefined>(useStore((state) => state.byTab[tab.id]));
    const initialUrl = react.useRef<string | undefined>(tab.navigation.params?.url);
    const viewportId = react.useId();
    const [mountEpoch, setMountEpoch] = react.useState(0);
    const state = useBrowserState(tab.id);
    const frame = state?.frame ?? EMPTY_FRAME;
    const restoreTarget = state === undefined ? currentBrowserTarget(initial.current) : state.restoreTarget;
    const target = frame.target ?? restoreTarget;
    const [draft, setDraft] = useBrowserDraft(target?.url ?? initialUrl.current, state?.addressRevision ?? 0);
    react.useLayoutEffect(() => {
      const hide = mount({
        tabId: tab.id,
        signal: tab.signal,
        viewportId,
        applicationOrigin: window.location.origin,
        initial: initial.current,
        initialUrl: initialUrl.current,
        openTab: (url: string): void => {
          tab.actions.openTab("browser", { params: { url }, revealIfOpened: false });
        },
      });
      setMountEpoch((value: number): number => value + 1);
      return hide;
    }, [mount, tab.id, tab.signal, tab.actions, viewportId, props.actions]);
    const unknown = frame.address === "unknown";
    const externalUrl = unknown ? undefined : target?.url;
    const sandboxed = frame.sandboxEnabled;
    const failure = state?.addressFailure;
    const error = frame.error;
    const submit = (event: { preventDefault(): void }): void => {
      event.preventDefault();
      loadUrl(tab.id, draft);
    };
    return jsxs("div", {
      className: CLASS.root,
      children: [
        jsxs("form", {
          className: CLASS.toolbar,
          onSubmit: submit,
          children: [
            jsx("button", {
              type: "button",
              className: CLASS.tool,
              "aria-label": t("back"),
              title: t("back"),
              disabled: !frame.canGoBack,
              onClick: (): void => { goBack(tab.id); },
              children: jsx(primitives.IconChevronLeftOutlineRegular, {}),
            }),
            jsx("button", {
              type: "button",
              className: CLASS.tool,
              "aria-label": t("forward"),
              title: t("forward"),
              disabled: !frame.canGoForward,
              onClick: (): void => { goForward(tab.id); },
              children: jsx(primitives.IconChevronRightOutlineRegular, {}),
            }),
            jsx(primitives.Tooltip, {
              label: t("reload"),
              shortcutKeys: tab.refreshShortcut?.keys,
              side: "bottom",
              delayMs: 500,
              children: jsx("button", {
                type: "button",
                className: CLASS.tool,
                "aria-label": t("reload"),
                "aria-keyshortcuts": tab.refreshShortcut?.aria,
                disabled: target === undefined || mountEpoch === 0,
                onClick: (): void => { reload(tab.id); },
                children: jsx(primitives.IconRefreshOutlineRegular, {}),
              }),
            }),
            jsxs("div", {
              className: CLASS.addressBox,
              children: [
                jsx("input", {
                  className: [CLASS.address, unknown ? CLASS.addressUnknown : ""].join(" "),
                  value: draft,
                  "aria-label": t("address.placeholder"),
                  placeholder: t("address.placeholder"),
                  spellCheck: false,
                  onChange: (event: { currentTarget: { value: string } }): void => { setDraft(event.currentTarget.value); },
                }),
                unknown && jsx("span", { className: CLASS.addressChanged, children: t("address.changed") }),
                jsx("button", {
                  type: "submit",
                  className: [CLASS.tool, CLASS.addressGo].join(" "),
                  "aria-label": t("go"),
                  title: t("go"),
                  children: jsx(primitives.IconLinkOutlineRegular, {}),
                }),
              ],
            }),
            jsx("button", {
              type: "button",
              className: CLASS.tool,
              "aria-label": t("external"),
              title: t("external"),
              disabled: externalUrl === undefined,
              onClick: externalUrl === undefined ? undefined : (): void => { window.open(externalUrl, "_blank", "noopener,noreferrer"); },
              children: jsx(primitives.IconRightUpOutlineRegular, { size: 14 }),
            }),
            sandboxed !== undefined && jsx("button", {
              type: "button",
              className: [CLASS.tool, sandboxed ? "" : CLASS.sandboxOff].join(" "),
              "aria-label": t(sandboxed ? "sandbox.disable" : "sandbox.enable"),
              title: t(sandboxed ? "sandbox.disable" : "sandbox.enable"),
              "aria-pressed": !sandboxed,
              onClick: (): void => { setSandbox(tab.id, !sandboxed); },
              children: jsx(SandboxPolicyIcon, { sandboxed }),
            }),
          ],
        }),
        sandboxed === false && jsx("div", { className: CLASS.sandboxWarning, role: "status", children: t("sandbox.warning") }),
        error !== undefined && jsx("div", {
          className: CLASS.failure,
          role: "status",
          children: error.code !== undefined && error.description !== undefined
            ? t("load.failed.detail", { code: String(error.code), description: error.description })
            : t("load.failed"),
        }),
        failure !== undefined && jsx("div", { className: CLASS.failure, role: "alert", children: t("error." + failure) }),
        jsxs("div", {
          className: CLASS.content,
          "aria-busy": frame.loading,
          children: [
            jsx("div", { id: viewportId, className: CLASS.viewport, "aria-label": t("type.label") }),
            restoreTarget !== undefined && jsxs("section", {
              className: CLASS.restore,
              "aria-label": t("restore.previous"),
              children: [
                jsx("p", { className: CLASS.restoreLabel, children: t("restore.previous") }),
                jsx("p", { className: CLASS.restoreTitle, children: restoreTarget.title }),
                jsx("p", { className: CLASS.restoreUrl, children: restoreTarget.url }),
                jsx(primitives.Button, {
                  variant: "primary",
                  size: "sm",
                  disabled: mountEpoch === 0,
                  onClick: (): void => { restore(tab.id); },
                  children: t("restore.action"),
                }),
              ],
            }),
            restoreTarget === undefined && (target === undefined || frame.loading) && error === undefined && jsx("div", {
              className: CLASS.placeholder,
              children: jsx("div", { className: CLASS.start, children: t(target === undefined ? "start" : "loading") }),
            }),
          ],
        }),
        unknown && jsx("p", { className: CLASS.limit, children: t("address.unknown") }),
      ],
    });
  };
}
