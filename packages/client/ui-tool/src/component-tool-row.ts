/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hàng tool của row ui-tool: ToolRow (hàng tóm tắt + thẻ kết quả nở ra) và GenericToolCard (bảng biểu tượng variant)
 */

import { classNames as clsx, jsxRuntime, memo, primitives, react } from "./runtime.ts";
import { toolRowClasses } from "./styles.ts";
import { AskQuestionCard, ExitCodeBadge, ToolDetails } from "./components-core.ts";
import { diffCardModel, readCardModel, searchCardModel } from "./model-cards.ts";
import { codeToolbarLabels, diffBlockLabels, readBlockLabels, searchBlockLabels, webBlockLabels } from "./model-primitives.ts";
import { formatToolBody, localizeAutoReviewDenial, toolRowModel } from "./model-tool-call.ts";
import { localizeTerminalCardModel, terminalBlockLabels, terminalCardModel, terminalExitLabel, terminalFailed, webCardModel } from "./model-terminal.ts";

/** Dữ liệu thô đọc từ dây (khối gọi tool · kết quả · hàm dịch của slot) — giữ 'any' cho gọn như bản gốc không đặt kiểu. */
type Wire = any;

/** Ghế dịch của hội thoại: nhận khoá và tham số nội suy, trả chuỗi đã bản địa hoá. */
type TranslateSeat = (key: string, params?: Record<string, unknown>) => string;

/** Keep a summary link click from toggling the row; the browser still follows the link. */
/**
 * Chặn cú nhấp vào liên kết tóm tắt khỏi việc mở/đóng hàng; trình duyệt vẫn đi theo liên kết.
 * Nhận: event — sự kiện click của liên kết tóm tắt.
 * Trả: không có.
 */
export function stopLinkClick(event: Wire): void {
  event.stopPropagation();
}

/** Visually hidden run-state label for color-only running and settlement cues. */
/**
 * Nhãn trạng thái chạy ẩn khỏi mắt thường, dùng cho các tín hiệu chỉ phân biệt bằng màu (đang chạy · đã kết thúc).
 * Nhận: state — trạng thái vòng đời của hàng; t — ghế dịch của hội thoại.
 * Trả: chuỗi đã bản địa hoá, hoặc null khi trạng thái không cần nhãn.
 */
export function stateStatus$1(state: Wire, t: TranslateSeat): string | null {
  switch (state) {
    case "preparing": return t("row.preparing");
    case "running": return t("row.running");
    case "error": return t("row.failed");
    case "stopped": return t("row.stopped");
    default: return null;
  }
}

/**
 * Render one localized tool summary and lazily mounted result card.
 * Preparation retains the icon, title, and optional tool-name summary without disclosure.
 * @param props - tool state, summary, output, and navigation callbacks.
 * @returns the tool disclosure.
 */
export const ToolRow = memo(function ToolRow({
  t,
  variant,
  toolName,
  icon,
  title,
  summary,
  summarySuffix,
  bodyRaw,
  output,
  askQuestion,
  errorSummary,
  terminal,
  diff,
  read,
  image,
  renderSlot,
  loadImage,
  search,
  web,
  details,
  state,
  filePath,
  filePathLine,
  onOpenFile,
  href,
  inspect,
  useDisclosure,
}: Wire): Wire {
  const { expanded, toggle: toggleExpand } = useDisclosure();
  const terminalLabels = react.useMemo(() => terminalBlockLabels(t), [t]);
  const diffLabels = react.useMemo(() => diffBlockLabels(t), [t]);
  const readLabels = react.useMemo(() => readBlockLabels(t), [t]);
  const searchLabels = react.useMemo(() => searchBlockLabels(t), [t]);
  const webLabels = react.useMemo(() => webBlockLabels(t), [t]);
  const terminalBody: Wire = react.useMemo(() => terminal === void 0 || terminal === null ? null : localizeTerminalCardModel(terminal, t), [terminal, t]);
  const diffBody: Wire = diff ?? null;
  const readBody: Wire = read ?? null;
  const imageBody: Wire = image !== void 0 && image !== null && renderSlot !== void 0 && loadImage !== void 0 ? image : null;
  const searchBody: Wire = search ?? null;
  const webBody: Wire = web ?? null;
  const askQuestionBody: Wire = askQuestion ?? null;
  const detailsBody: Wire = details ?? null;
  const inputRaw: Wire = bodyRaw ?? null;
  const outputText: Wire = output ?? null;
  const card: Wire = askQuestionBody ?? terminalBody ?? diffBody ?? readBody ?? imageBody ?? searchBody ?? webBody ?? detailsBody;
  const expandable = state !== "preparing" && (inputRaw !== null || outputText !== null || card !== null);
  const open = expanded && expandable;
  const bodyText = react.useMemo(() => open && card === null && inputRaw !== null ? formatToolBody(variant, inputRaw) : null, [
    card,
    inputRaw,
    open,
    variant
  ]);
  const status = stateStatus$1(state, t);
  const running = state === "running" || state === "preparing";
  const normalSummary: Wire = terminalBody?.description ?? (open ? detailsBody?.expandedSummary ?? summary : summary);
  const exitLabel: Wire = terminalExitLabel(terminal, t);
  const summaryText: Wire = (state === "error" && exitLabel === null ? errorSummary ?? normalSummary : null) ?? normalSummary;
  const diffStat: Wire = react.useMemo(() => diffBody === null ? null : (primitives.diffTotals as (diffs: Wire) => { added: number; removed: number })(diffBody.card.diffs), [diffBody]);
  const settledWithCue = state === "error" || state === "stopped";
  const suffix: Wire = settledWithCue ? null : summarySuffix ?? null;
  const totals: Wire = settledWithCue ? null : diffStat;
  const openFile = react.useMemo(() => filePath !== void 0 && onOpenFile !== void 0 && !settledWithCue ? (event: Wire) => {
    event.stopPropagation();
    if (filePathLine === void 0) onOpenFile(filePath);
    else onOpenFile(filePath, { line: filePathLine });
  } : void 0, [
    filePath,
    filePathLine,
    onOpenFile,
    settledWithCue
  ]);
  const linkHref = settledWithCue ? void 0 : href;
  const summaryLinkKeyDown = react.useCallback!((event: Wire) => {
    if (event.key === "Enter" || event.key === " ") event.stopPropagation();
  }, []);
  const cardBody = variant === "code" ? null : bodyText;
  const collapsedContent = react.useMemo(() => summaryText !== "" && jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    jsxRuntime.jsx("span", {
      className: toolRowClasses.sep,
      "data-shimmer-decoration": true,
      "aria-hidden": true
    }),
    exitLabel === null && openFile !== void 0 ? jsxRuntime.jsx("button", {
      type: "button",
      className: toolRowClasses.fileLink,
      onClick: openFile,
      onKeyDown: summaryLinkKeyDown,
      children: jsxRuntime.jsx(primitives.TextShimmer, { children: summaryText })
    }) : exitLabel === null && linkHref !== void 0 ? jsxRuntime.jsx("a", {
      className: toolRowClasses.fileLink,
      href: linkHref,
      target: "_blank",
      rel: "noopener noreferrer",
      onClick: stopLinkClick,
      onKeyDown: summaryLinkKeyDown,
      children: jsxRuntime.jsx(primitives.TextShimmer, { children: summaryText })
    }) : jsxRuntime.jsx("span", {
      className: clsx(toolRowClasses.summary, exitLabel === null && state === "error" && toolRowClasses.errorSummary, exitLabel === null && state === "stopped" && toolRowClasses.stoppedSummary),
      children: jsxRuntime.jsx(primitives.TextShimmer, { children: summaryText })
    }),
    exitLabel !== null && jsxRuntime.jsx(ExitCodeBadge, { label: exitLabel }),
    suffix !== null && jsxRuntime.jsx(primitives.TextShimmer, {
      className: toolRowClasses.summarySuffix,
      children: suffix
    }),
    totals !== null && jsxRuntime.jsxs(primitives.TextShimmer, {
      className: clsx(toolRowClasses.summarySuffix, toolRowClasses.diffStat),
      children: [
        jsxRuntime.jsx("span", {
          className: toolRowClasses.diffAdded,
          children: `+${totals.added}`
        }),
        " ",
        jsxRuntime.jsx("span", {
          className: toolRowClasses.diffRemoved,
          children: `-${totals.removed}`
        })
      ]
    })
  ] }), [
    summaryLinkKeyDown,
    linkHref,
    openFile,
    state,
    suffix,
    totals,
    summaryText,
    exitLabel
  ]);
  const expandedContent = react.useMemo(() => open ? jsxRuntime.jsxs("div", {
    className: clsx(toolRowClasses.bodyWrap, detailsBody !== null && toolRowClasses.detailsBodyWrap),
    children: [askQuestionBody !== null ? jsxRuntime.jsx(AskQuestionCard, { card: askQuestionBody }) : terminalBody !== null ? jsxRuntime.jsx(primitives.TerminalBlock, {
      ...terminalBody.card,
      maxLines: Infinity,
      labels: terminalLabels,
      className: toolRowClasses.terminalBody
    }) : diffBody !== null ? jsxRuntime.jsx(primitives.DiffBlock, {
      ...diffBody.card,
      labels: diffLabels,
      maxLines: 9,
      className: toolRowClasses.diffBody
    }) : readBody !== null ? jsxRuntime.jsx(primitives.ReadBlock, {
      ...readBody,
      labels: readLabels,
      maxLines: 8,
      className: toolRowClasses.readBody
    }) : imageBody !== null ? jsxRuntime.jsxs("div", {
      className: toolRowClasses.imageBody,
      children: [
        renderSlot !== void 0 && loadImage !== void 0 && renderSlot("tool.call.images", {
          images: imageBody.images,
          loadImage,
          align: "start"
        }),
        jsxRuntime.jsxs("div", {
          className: toolRowClasses.imageMeta,
          children: [jsxRuntime.jsx("div", { children: imageBody.path }), imageBody.images.map(({ attachment }: Wire, index: number) => jsxRuntime.jsx("div", { children: attachment.originalDimensions === void 0 ? t("row.imageSize", {
            width: attachment.width,
            height: attachment.height,
            bytes: attachment.bytes
          }) : t("row.imageSizeDownscaled", {
            width: attachment.width,
            height: attachment.height,
            originalWidth: attachment.originalDimensions.width,
            originalHeight: attachment.originalDimensions.height,
            bytes: attachment.bytes
          }) }, index))]
        }),
        imageBody.extraText !== null && jsxRuntime.jsx("div", {
          className: toolRowClasses.imageExtra,
          children: imageBody.extraText
        })
      ]
    }) : searchBody !== null ? jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsx(primitives.SearchBlock, {
      ...searchBody.card,
      labels: searchLabels,
      maxLines: 8,
      className: toolRowClasses.searchBody
    }), searchBody.recovery !== void 0 && jsxRuntime.jsx("div", {
      className: toolRowClasses.searchRecovery,
      children: searchBody.recovery
    })] }) : webBody !== null ? jsxRuntime.jsx(primitives.WebBlock, {
      ...webBody,
      labels: webLabels,
      className: toolRowClasses.webBody
    }) : detailsBody !== null ? jsxRuntime.jsx(ToolDetails, {
      model: detailsBody,
      hasInspect: inspect !== void 0,
      t,
      onOpenFile
    }) : jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [variant === "code" && bodyText !== null && jsxRuntime.jsx("div", {
      className: toolRowClasses.bodyScroll,
      children: jsxRuntime.jsx(primitives.CodeBlock, {
        code: bodyText,
        lang: "typescript",
        copyLabel: t("copy"),
        copiedLabel: t("copied"),
        toolbarLabels: codeToolbarLabels(t),
        className: toolRowClasses.codeBody
      })
    }), (cardBody !== null || outputText !== null) && jsxRuntime.jsxs("div", {
      className: toolRowClasses.ioCard,
      children: [
        cardBody !== null && jsxRuntime.jsxs("div", {
          className: toolRowClasses.ioSection,
          children: [jsxRuntime.jsx("span", {
            className: toolRowClasses.ioLabel,
            children: t("row.input")
          }), jsxRuntime.jsx("span", {
            className: toolRowClasses.ioText,
            children: cardBody
          })]
        }),
        cardBody !== null && outputText !== null && jsxRuntime.jsx("span", {
          className: toolRowClasses.ioDivider,
          "aria-hidden": true
        }),
        outputText !== null && jsxRuntime.jsxs("div", {
          className: toolRowClasses.ioSection,
          children: [jsxRuntime.jsx("span", {
            className: toolRowClasses.ioLabel,
            children: t("row.output")
          }), jsxRuntime.jsx("span", {
            className: toolRowClasses.ioText,
            "data-error": state === "error" || void 0,
            children: outputText
          })]
        })
      ]
    })] }), inspect !== void 0 && jsxRuntime.jsxs("button", {
      type: "button",
      className: toolRowClasses.inspectButton,
      onClick: inspect,
      children: [jsxRuntime.jsx(primitives.IconInspectOutlineRegular, {}), t("row.inspect")]
    })]
  }) : void 0, [
    open,
    detailsBody,
    askQuestionBody,
    terminalBody,
    terminalLabels,
    diffBody,
    diffLabels,
    readBody,
    readLabels,
    imageBody,
    renderSlot,
    loadImage,
    searchBody,
    searchLabels,
    webBody,
    webLabels,
    inspect,
    t,
    onOpenFile,
    variant,
    bodyText,
    cardBody,
    outputText,
    state
  ]);
  return jsxRuntime.jsxs("div", {
    className: toolRowClasses.root,
    "data-variant": variant,
    "data-tool": toolName,
    "data-state": state,
    children: [status !== null && jsxRuntime.jsx("span", {
      className: toolRowClasses.visuallyHidden,
      children: status
    }), jsxRuntime.jsx(primitives.DisclosureRow, {
      rowClassName: toolRowClasses.row,
      leadingClassName: toolRowClasses.leading,
      titleClassName: toolRowClasses.title,
      icon,
      title,
      running,
      open,
      expandable,
      expandOnRowClick: true,
      keepContentWhenOpen: true,
      onToggle: toggleExpand,
      collapsedContent,
      children: expandedContent
    })]
  });
});

/** Variant leading icons (figma table); all glyphs render at 14 inside the 16px leading box. */
/** ⚠️ Bản gốc dựng element ngay ở phạm vi module; bảng module chưa được bơm lúc nạp nên ở đây mỗi khoá là một getter — element chỉ được dựng khi hàng thật sự đọc tới nó (trong thân hàm render). */
export const VARIANT_ICONS: Record<string, unknown> = {
  get search(): unknown { return jsxRuntime.jsx(primitives.IconSearchOutlineRegular, { size: 14 }); },
  get read(): unknown { return jsxRuntime.jsx(primitives.IconBrowseOutlineRegular, { size: 14 }); },
  get bash(): unknown { return jsxRuntime.jsx(primitives.IconApiOutlineRegular, { size: 14 }); },
  get write(): unknown { return jsxRuntime.jsx(primitives.IconEditOutlineRegular, { size: 14 }); },
  get edit(): unknown { return jsxRuntime.jsx(primitives.IconEditOutlineRegular, { size: 14 }); },
  get code(): unknown { return jsxRuntime.jsx(primitives.IconCodeOutlineRegular, { size: 14 }); },
  get others(): unknown { return jsxRuntime.jsx(primitives.IconSparkleRegular, { size: 14 }); }
};

/**
 * Render the generic tool card for the current stage: derive the row model, its settled state, and the variant icon, then hand everything to ToolRow.
 * @param props - current tool stage and locale.
 * @returns its preparation or dispatched card.
 */
export function GenericToolCard({ toolName, block, cwd, home, openFile, inspect, useDisclosure, t }: Wire): Wire {
  const model = toolRowModel(toolName, block, cwd, home);
  const autoReview = model.autoReviewDenial === null ? null : localizeAutoReviewDenial(model.autoReviewDenial, t);
  const terminal = terminalCardModel(block, cwd);
  const read = readCardModel(block, cwd, home);
  const diff = diffCardModel(block);
  const search = searchCardModel(block);
  const web = webCardModel(block);
  const state = model.state === "ok" && terminal !== null && terminalFailed(terminal) ? "error" : model.state;
  const singleFile = model.filePath !== void 0;
  return jsxRuntime.jsx(ToolRow, {
    useDisclosure,
    t,
    variant: model.variant,
    toolName,
    icon: VARIANT_ICONS[model.variant],
    title: t(model.titleKey),
    summary: model.summary,
    bodyRaw: singleFile || autoReview !== null ? null : model.bodyRaw,
    output: autoReview?.output ?? model.output,
    errorSummary: autoReview?.summary ?? model.errorSummary,
    terminal,
    diff,
    read,
    search,
    web,
    state,
    filePath: model.filePath,
    onOpenFile: singleFile ? openFile : void 0,
    inspect
  });
}
