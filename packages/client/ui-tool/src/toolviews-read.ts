/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sau hang toolview cua row ui-tool: bash · file-mutation · read · read-image · search · web
 */

import { CONVERSATION_NS } from "./ids.ts";
import { classNames as clsx, jsxRuntime, memo, primitives, react } from "./runtime.ts";
import { bashSampleClasses } from "./styles.ts";
import { ExitCodeBadge } from "./components-core.ts";
import { ToolRow } from "./component-tool-row.ts";
import { formatToolBody, toolRowModel } from "./model-tool-call.ts";
import { diffCardModel, readCallLine, readCardModel, searchCardModel } from "./model-cards.ts";
import { imageCardModel } from "./model-image.ts";
import {
  isBackgroundShellCall,
  isSettledPersistentShellCall,
  isSpilledShellCall,
  localizeTerminalCardModel,
  terminalBlockLabels,
  terminalCardModel,
  terminalExitLabel,
  terminalFailed,
  webCardModel,
  webFetchHref,
} from "./model-terminal.ts";
import type { ToolviewScope } from "./types.ts";

/** Du lieu tho doc tu day (khoi goi tool · ket qua · ham dich cua slot) — giu 'any' cho gon nhu ban goc khong dat kieu. */
type Wire = any;

// ===== bash-sample =====

/**
 * Icon cua hang bash. Ban goc la mot phan tu JSX dung san o PHAM VI MODULE; o day phai la ham
 * vi bang primitives chua duoc bom luc nap module (doc o pham vi module se ra undefined).
 * Nhan: khong co.
 * Tra: phan tu icon bash (IconApiOutlineRegular, size 14).
 */
export function BASH_ICON(): Wire {
  return jsxRuntime.jsx(primitives.IconApiOutlineRegular, { size: 14 });
}

/** Visually hidden status for the color-only running sweep and error tone. */
export function stateStatus(state: Wire, t: Wire): Wire {
  switch (state) {
    case "preparing": return t("row.preparing");
    case "running": return t("bash.running");
    case "error": return t("bash.failed");
    case "stopped": return t("bash.stopped");
    default: return null;
  }
}

/**
 * Render expandable Bash output with an accessible lifecycle label. While the
 * call is preparing the row shows the description streamed so far and cannot expand.
 * @param props - tool call, Session sources, locale, and inspection callback.
 * @returns the Bash output row.
 */
export const BashRow = memo(function BashRow({ toolName, block, sessionId, useSessions, inspect, useDisclosure, t }: Wire): Wire {
  const model = react.useMemo(() => toolRowModel(toolName, block), [toolName, block]);
  const cwd = useSessions((list: Wire) => list.byId[sessionId]?.cwd);
  const terminalModel = react.useMemo(() => terminalCardModel(block, cwd), [block, cwd]);
  const terminal = react.useMemo(() => terminalModel === null ? null : localizeTerminalCardModel(terminalModel, t), [terminalModel, t]);
  const labels = react.useMemo(() => terminalBlockLabels(t), [t]);
  const state = model.state === "ok" && terminalModel !== null && terminalFailed(terminalModel) ? "error" : model.state;
  const status = stateStatus(state, t);
  const { expanded, toggle: toggleExpand } = useDisclosure();
  const background = isBackgroundShellCall(block);
  const genericBody = terminal === null && (model.state === "error" || isSettledPersistentShellCall(block) || isSpilledShellCall(block) || background) && (model.bodyRaw !== null || model.output !== null);
  const expandable = terminal !== null || genericBody;
  const open = expanded && expandable;
  const body = react.useMemo(() => open && genericBody && model.bodyRaw !== null ? formatToolBody(model.variant, model.bodyRaw) : null, [
    genericBody,
    model.bodyRaw,
    model.variant,
    open
  ]);
  const normalSummary = terminal?.description ?? model.summary;
  const exitLabel = terminalExitLabel(terminalModel, t);
  const settlementLine = exitLabel !== null ? null : state === "error" ? model.errorSummary ?? normalSummary : state === "stopped" ? t("bash.stopped") : null;
  const running = state === "running" || state === "preparing";
  // react.useCallback la truong TUY CHON trong ReactModule nen phai doc qua 'any' (bang module chi bom luc chay).
  const toggleFromKeyboard = (react as Wire).useCallback((event: Wire) => {
    if (!expandable || event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleExpand();
  }, [expandable, toggleExpand]);
  const leading = open ? jsxRuntime.jsx(primitives.IconChevronUpOutlineRegular, { className: bashSampleClasses.chevron }) : expandable ? jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsx("span", {
    className: bashSampleClasses.iconIdle,
    children: BASH_ICON()
  }), jsxRuntime.jsx(primitives.IconChevronDownOutlineRegular, { className: clsx(bashSampleClasses.chevron, bashSampleClasses.chevronHover) })] }) : BASH_ICON();
  return jsxRuntime.jsxs("div", {
    className: bashSampleClasses.card,
    children: [jsxRuntime.jsxs("div", {
      className: bashSampleClasses.root,
      "data-sample": "bash",
      "data-variant": "bash",
      "data-state": state,
      "data-expandable": expandable || void 0,
      role: expandable ? "button" : void 0,
      tabIndex: expandable ? 0 : void 0,
      "aria-expanded": expandable ? open : void 0,
      onClick: expandable ? toggleExpand : void 0,
      onKeyDown: expandable ? toggleFromKeyboard : void 0,
      children: [
        jsxRuntime.jsx("span", {
          className: bashSampleClasses.leading,
          children: leading
        }),
        status !== null && jsxRuntime.jsx("span", {
          className: bashSampleClasses.visuallyHidden,
          children: status
        }),
        jsxRuntime.jsxs(primitives.TextShimmer, {
          active: running,
          children: [
            jsxRuntime.jsx(primitives.TextShimmer, {
              className: bashSampleClasses.title,
              children: t(model.titleKey)
            }),
            jsxRuntime.jsx("span", {
              className: bashSampleClasses.sep,
              "data-shimmer-decoration": true,
              "aria-hidden": true
            }),
            jsxRuntime.jsx("span", {
              className: clsx(bashSampleClasses.summary, exitLabel === null && state === "error" && bashSampleClasses.errorSummary, exitLabel === null && state === "stopped" && bashSampleClasses.stoppedSummary),
              children: jsxRuntime.jsx(primitives.TextShimmer, { children: settlementLine ?? normalSummary })
            }),
            exitLabel !== null && jsxRuntime.jsx(ExitCodeBadge, { label: exitLabel })
          ]
        })
      ]
    }), open && jsxRuntime.jsxs("div", {
      className: bashSampleClasses.bodyWrap,
      children: [terminal !== null ? jsxRuntime.jsx(primitives.TerminalBlock, {
        ...terminal.card,
        maxLines: Infinity,
        labels,
        className: bashSampleClasses.terminal
      }) : jsxRuntime.jsxs("div", {
        className: bashSampleClasses.ioCard,
        children: [
          body !== null && jsxRuntime.jsxs("div", {
            className: bashSampleClasses.ioSection,
            children: [jsxRuntime.jsx("span", {
              className: bashSampleClasses.ioLabel,
              children: t("row.input")
            }), background ? jsxRuntime.jsx(primitives.CommandText, {
              className: bashSampleClasses.commandInput,
              text: body,
              label: t("row.commandArguments")
            }) : jsxRuntime.jsx("span", {
              className: bashSampleClasses.ioText,
              children: body
            })]
          }),
          body !== null && model.output !== null && jsxRuntime.jsx("span", {
            className: bashSampleClasses.ioDivider,
            "aria-hidden": true
          }),
          model.output !== null && jsxRuntime.jsxs("div", {
            className: bashSampleClasses.ioSection,
            children: [jsxRuntime.jsx("span", {
              className: bashSampleClasses.ioLabel,
              children: t("row.output")
            }), jsxRuntime.jsx("span", {
              className: bashSampleClasses.ioText,
              "data-error": state === "error" || void 0,
              children: model.output
            })]
          })
        ]
      }), inspect !== void 0 && jsxRuntime.jsxs("button", {
        type: "button",
        className: bashSampleClasses.inspectButton,
        onClick: inspect,
        children: [jsxRuntime.jsx(primitives.IconInspectOutlineRegular, {}), t("row.inspect")]
      })]
    })]
  });
});

/**
 * Dang ky hang bash vao slot KEYED "tool.call.toolview" — ban goc la plugin bash-toolview-sample.
 * Nhan: ctx — pham vi toolview (so slot cua context).
 * Tra: khong co.
 */
export function registerBashToolview(ctx: ToolviewScope): void {
  ctx.slots.inject("tool.call.toolview", () =>
    ctx.slots.register({ name: "tool.call.toolview", key: "bash", locale: CONVERSATION_NS }, BashRow));
}

// ===== file-mutation-row =====

/**
 * Icon cua hang sua file. Ban goc la mot phan tu JSX dung san o PHAM VI MODULE; o day phai la ham
 * vi bang primitives chua duoc bom luc nap module (doc o pham vi module se ra undefined).
 * Nhan: khong co.
 * Tra: phan tu icon edit (IconEditOutlineRegular, size 14).
 */
export function FILE_MUTATION_ICON(): Wire {
  return jsxRuntime.jsx(primitives.IconEditOutlineRegular, { size: 14 });
}

/** Cac truong tham so mang noi dung ma hang sua file dem theo kilobyte. */
export const CONTENT_FIELDS: readonly string[] = [
  "content",
  "old_string",
  "new_string"
];

/** So byte cua mot kilobyte — buoc nhay khi dem noi dung dang chay. */
export const KILOBYTE = 1024;

/** Kilobytes of decoded input at every stage; null before any content field arrives. */
export function contentKilobytes(block: Wire): number | null {
  const { args } = block;
  const open = CONTENT_FIELDS.find((key) => args.has(key) && !args.complete(key));
  const completed = CONTENT_FIELDS.reduce((total, key) => key !== open && args.complete(key) ? total + (args.stringLength(key, { step: KILOBYTE }) ?? 0) : total, 0);
  if (open === void 0) return CONTENT_FIELDS.some((key) => args.has(key)) ? Math.ceil(completed / KILOBYTE) : null;
  const chars = completed + (args.stringLength(open, {
    step: KILOBYTE,
    offset: completed
  }) ?? 0);
  return Math.ceil(chars / KILOBYTE);
}

/**
 * Shows the path and decoded input size through preparation, execution, and
 * settlement, with the applied diff available once the call settles.
 * @param props - tool call, workspace paths, file opener, and locale seat.
 * @returns the edit/write row.
 */
export function FileMutationRow({ toolName, block, cwd, home, openFile, inspect, useDisclosure, t }: Wire): Wire {
  const model = toolRowModel(toolName, block, cwd, home);
  const diff = diffCardModel(block);
  const kilobytes = contentKilobytes(block);
  const size = kilobytes === null ? null : t("tool.preparing.content", { kilobytes });
  return jsxRuntime.jsx(ToolRow, {
    useDisclosure,
    t,
    variant: model.variant,
    toolName,
    icon: FILE_MUTATION_ICON(),
    title: t(model.titleKey),
    summary: model.summary,
    summarySuffix: size !== null && model.summary !== "" ? size : void 0,
    output: model.output,
    errorSummary: model.errorSummary,
    diff,
    state: model.state,
    filePath: model.filePath,
    onOpenFile: openFile,
    inspect
  });
}

/**
 * Dang ky hai hang sua file (edit · write) vao slot KEYED "tool.call.toolview" — ban goc la plugin file-mutation-toolview.
 * Nhan: ctx — pham vi toolview (so slot cua context).
 * Tra: khong co.
 */
export function registerFileMutationToolview(ctx: ToolviewScope): void {
  ctx.slots.inject("tool.call.toolview", function* () {
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "edit",
      locale: CONVERSATION_NS
    }, FileMutationRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "write",
      locale: CONVERSATION_NS
    }, FileMutationRow);
  });
}

// ===== read-family-row =====

/**
 * Compose a read-family row: the shared chrome and model-derived fields, plus the
 * caller's card material.
 * @param props - the toolview runtime share and locale seat.
 * @param card - the card props this row owns.
 * @returns the assembled ToolRow.
 */
export function readFamilyRow({ toolName, block, cwd, home, openFile, inspect, useDisclosure, t }: Wire, card: Wire): Wire {
  const model = toolRowModel(toolName, block, cwd, home);
  return jsxRuntime.jsx(ToolRow, {
    useDisclosure,
    t,
    variant: model.variant,
    toolName,
    icon: jsxRuntime.jsx(primitives.IconBrowseOutlineRegular, { size: 14 }),
    title: t(model.titleKey),
    summary: model.summary,
    bodyRaw: null,
    output: model.output,
    errorSummary: model.errorSummary,
    ...card,
    state: model.state,
    filePath: model.filePath,
    onOpenFile: openFile,
    inspect
  });
}

// ===== read-row =====

/**
 * Lets users expand a completed read result and open its reported path at the
 * line the call started from.
 */
export function ReadRow(props: Wire): Wire {
  const { block, cwd, home } = props;
  return readFamilyRow(props, {
    read: readCardModel(block, cwd, home),
    filePathLine: readCallLine(block)
  });
}

/**
 * Dang ky hang read vao slot KEYED "tool.call.toolview" — ban goc la plugin read-toolview.
 * Nhan: ctx — pham vi toolview (so slot cua context).
 * Tra: khong co.
 */
export function registerReadToolview(ctx: ToolviewScope): void {
  ctx.slots.inject("tool.call.toolview", () =>
    ctx.slots.register({ name: "tool.call.toolview", key: "read", locale: CONVERSATION_NS }, ReadRow));
}

// ===== read-image-row =====

/**
 * read_image row: the read-family chrome with the durably committed image as the
 * row's collapsed-by-default card body, rendered through the `tool.call.images`
 * slot this entry declares.
 */
export function ReadImageRow(props: Wire): Wire {
  const { block, renderSlot, loadImage } = props;
  return readFamilyRow(props, {
    image: imageCardModel(block),
    renderSlot,
    loadImage
  });
}

/**
 * Register the read_image row into the Tool-owned keyed view slot.
 * @param ctx - registrant context (disposal rides ctx.effect inside slots.register).
 */
export function registerReadImageToolview(ctx: ToolviewScope): void {
  ctx.slots.inject("tool.call.toolview", () =>
    ctx.slots.register({
      name: "tool.call.toolview",
      key: "read_image",
      locale: CONVERSATION_NS,
      children: { "tool.call.images": {
        kind: "single",
        scope: "session"
      } }
    }, ReadImageRow));
}

// ===== search-row =====

/** Tieu de rieng cua hai tool tim kiem, dung thay tieu de chung cua variant "search". */
export const SEARCH_TITLE_KEYS = {
  grep: "tool.title.grep",
  glob: "tool.title.glob"
};

/** Lets users expand grep or glob results and recover capped searches. */
export function SearchRow({ toolName, block, inspect, useDisclosure, t }: Wire): Wire {
  const model = toolRowModel(toolName, block);
  const search = searchCardModel(block);
  return jsxRuntime.jsx(ToolRow, {
    useDisclosure,
    t,
    variant: model.variant,
    toolName,
    icon: jsxRuntime.jsx(primitives.IconSearchOutlineRegular, { size: 14 }),
    title: t(toolName === "grep" ? SEARCH_TITLE_KEYS.grep : toolName === "glob" ? SEARCH_TITLE_KEYS.glob : model.titleKey),
    summary: model.summary,
    output: model.output,
    errorSummary: model.errorSummary,
    search,
    state: model.state,
    inspect
  });
}

/**
 * Dang ky hai hang tim kiem (grep · glob) vao slot KEYED "tool.call.toolview" — ban goc la plugin search-toolview.
 * Nhan: ctx — pham vi toolview (so slot cua context).
 * Tra: khong co.
 */
export function registerSearchToolview(ctx: ToolviewScope): void {
  ctx.slots.inject("tool.call.toolview", function* () {
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "grep",
      locale: CONVERSATION_NS
    }, SearchRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "glob",
      locale: CONVERSATION_NS
    }, SearchRow);
  });
}

// ===== web-row =====

/** Tieu de rieng cua hai tool web, dung thay tieu de chung cua variant duoc suy ra. */
export const WEB_TITLE_KEYS = {
  web_search: "tool.title.webSearch",
  web_fetch: "tool.title.webFetch"
};

/** Lets users expand a completed web search or fetch result. */
export function WebRow({ toolName, block, inspect, useDisclosure, t }: Wire): Wire {
  const model = toolRowModel(toolName, block);
  const web = webCardModel(block);
  const icon = toolName === "web_fetch" ? jsxRuntime.jsx(primitives.IconBrowseOutlineRegular, { size: 14 }) : jsxRuntime.jsx(primitives.IconGlobeOutlineRegular, { size: 14 });
  return jsxRuntime.jsx(ToolRow, {
    useDisclosure,
    t,
    variant: model.variant,
    toolName,
    icon,
    title: t(toolName === "web_search" ? WEB_TITLE_KEYS.web_search : toolName === "web_fetch" ? WEB_TITLE_KEYS.web_fetch : model.titleKey),
    summary: model.summary,
    output: model.output,
    errorSummary: model.errorSummary,
    web,
    href: webFetchHref(block),
    state: model.state,
    inspect
  });
}

/**
 * Dang ky hai hang web (web_search · web_fetch) vao slot KEYED "tool.call.toolview" — ban goc la plugin web-toolview.
 * Nhan: ctx — pham vi toolview (so slot cua context).
 * Tra: khong co.
 */
export function registerWebToolview(ctx: ToolviewScope): void {
  ctx.slots.inject("tool.call.toolview", function* () {
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "web_search",
      locale: CONVERSATION_NS
    }, WebRow);
    yield ctx.slots.register({
      name: "tool.call.toolview",
      key: "web_fetch",
      locale: CONVERSATION_NS
    }, WebRow);
  });
}
