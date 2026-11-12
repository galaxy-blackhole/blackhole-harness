/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bon component loi cua row ui-tool: the hoi-dap, khoi chi tiet ket qua Tool, nhan ma thoat, va hang cau hoi
 */

import { jsxRuntime, primitives } from "./runtime.ts";
import {
  askQuestionCardClasses,
  exitCodeBadgeClasses,
  questionToolRowClasses,
  toolDetailsClasses,
  toolRowClasses,
} from "./styles.ts";
import { codeToolbarLabels, markdownLabels } from "./model-primitives.ts";
import { formatToolBody } from "./model-tool-call.ts";

/** Mot muc cau hoi da tra loi trong the hoi-dap. */
interface AnsweredQuestionCardItem {
  /** Id cua cau hoi. */
  id: string;
  /** Van ban cau hoi. */
  question: string;
  /** Cac cau tra loi da chon. */
  answers: readonly string[];
}

/** Mot muc cau hoi chua duoc tra loi trong the hoi-dap. */
interface UnansweredQuestionCardItem {
  /** Id cua cau hoi. */
  id: string;
  /** Van ban cau hoi. */
  question: string;
}

/** Du lieu the hoi-dap da ban dia hoa — hoac da tra loi, hoac chua tra loi. */
type AskQuestionCardModel =
  | {
      /** The da tra loi. */
      kind: "answered";
      /** Danh sach cau hoi kem cau tra loi. */
      questions: readonly AnsweredQuestionCardItem[];
      /** Nhan hien khi cau hoi bi bo qua. */
      skippedLabel: string;
    }
  | {
      /** The chua tra loi. */
      kind: "unanswered";
      /** Danh sach cau hoi chua tra loi. */
      questions: readonly UnansweredQuestionCardItem[];
      /** Ket luan cua phien hoi. */
      verdict: string;
    };

/** Mot thuc the, bien nhan, hoac nhom gia tri gap lai duoc cua ket qua Tool. */
interface ToolDetailItem {
  /** Tieu de muc. */
  title?: string;
  /** Dong phu duoi tieu de. */
  subtitle?: string;
  /** Mo ta day du. */
  description?: string;
  /** The trang thai nho. */
  badge?: {
    /** Chu tren the. */
    label: string;
    /** Sac thai cua the. */
    tone: "neutral" | "info" | "success" | "warning" | "error";
  };
  /** Trang thai cua muc. */
  status?: {
    /** Ma trang thai. */
    value: "completed" | "in_progress" | "pending";
    /** Nhan trang thai da ban dia hoa. */
    label: string;
  };
  /** Trang thai truoc do, khi muc vua doi trang thai. */
  previousStatus?: string;
  /** Thay doi cua muc. */
  change?: {
    /** Loai thay doi. */
    value: "added" | "removed" | "updated";
    /** Nhan thay doi da ban dia hoa. */
    label: string;
  };
  /** Cac cap nhan/gia tri cua muc. */
  fields: readonly {
    /** Nhan truong. */
    label: string;
    /** Gia tri truong. */
    value: string;
  }[];
  /** Cac dong van ban tho. */
  lines?: readonly string[];
  /** Khoi markdown. */
  markdown?: string;
  /** Khoi ma nguon. */
  code?: {
    /** Than ma. */
    text: string;
    /** Ngon ngu cua khoi ma. */
    language?: string;
  };
  /** Vi tri file ma muc tro toi. */
  location?: {
    /** Duong dan file. */
    path: string;
    /** Dong trong file. */
    line?: number;
  };
  /** Cac nhom muc con gap lai duoc. */
  groups?: readonly {
    /** Nhan nhom. */
    label: string;
    /** Cac muc con. */
    items: readonly ToolDetailItem[];
  }[];
}

/** Du lieu hien thi da ban dia hoa ma cac the chi tiet dung chung. */
interface ToolDetailsModel {
  /** Cac muc chi tiet. */
  items: readonly ToolDetailItem[];
  /** Dong tom tat. */
  summary?: string;
  /** Dong tom tat khi mo rong, bo trang thai bien nhan trong than. */
  expandedSummary?: string;
  /** Nhan hien khi khong co muc nao. */
  empty?: string;
  /** Dong chu thich dau khoi. */
  caption?: string;
  /** Nhom cac muc khong doi. */
  unchanged?: {
    /** Nhan nhom. */
    label: string;
    /** Cac muc khong doi. */
    items: ToolDetailsModel["items"];
  };
}

/** Tuy chon mo file ma hang Tool truyen xuong khoi chi tiet. */
interface OpenFileOptions {
  /** Dong can nhay toi. */
  line?: number;
}

/** Ghe dich cua hoi thoai: tra chuoi da ban dia hoa theo khoa. */
type TranslateSeat = (key: string, params?: Record<string, unknown>) => string;

/** Trang thai vong doi cua mot hang Tool. */
type ToolRowState = string;

/** Ham dang ky trang thai mo rong do hang so huu. */
type UseDisclosure = () => {
  /** Hang dang mo rong hay khong. */
  expanded: boolean;
  /** Dao trang thai mo rong. */
  toggle: () => void;
};

/** Props cua nut khoi chi tiet va cac the dung chung. */
interface DetailContentProps {
  /** Ghe dich cua hoi thoai. */
  t: TranslateSeat;
  /** Mo vi tri file da ghi nhan trong workspace cua phien. */
  onOpenFile?: ((path: string, options?: OpenFileOptions) => void) | undefined;
}

/**
 * Render a validated ask-user transcript from plain card data.
 * @param props - Localized transcript card data.
 * @returns the readable answered or unanswered question list.
 */
export function AskQuestionCard({ card }: { card: AskQuestionCardModel }): unknown {
  if (card.kind === "unanswered")
    return jsxRuntime.jsxs("div", {
      className: askQuestionCardClasses.card,
      children: [
        jsxRuntime.jsx("p", {
          className: askQuestionCardClasses.verdict,
          children: card.verdict,
        }),
        jsxRuntime.jsx("ul", {
          className: askQuestionCardClasses.questionList,
          children: card.questions.map((question) =>
            jsxRuntime.jsx(
              "li",
              {
                className: askQuestionCardClasses.unansweredQuestion,
                children: question.question,
              },
              question.id,
            ),
          ),
        }),
      ],
    });
  return jsxRuntime.jsx("dl", {
    className: askQuestionCardClasses.card,
    children: card.questions.map((question) =>
      jsxRuntime.jsxs(
        "div",
        {
          className: askQuestionCardClasses.item,
          children: [
            jsxRuntime.jsx("dt", {
              className: askQuestionCardClasses.question,
              children: question.question,
            }),
            jsxRuntime.jsx("dd", {
              className: askQuestionCardClasses.answer,
              children:
                question.answers.length === 0
                  ? jsxRuntime.jsx("span", {
                      className: askQuestionCardClasses.skipped,
                      children: card.skippedLabel,
                    })
                  : question.answers.map((answer, index) =>
                      jsxRuntime.jsx(
                        "span",
                        {
                          className: askQuestionCardClasses.answerLine,
                          children: answer,
                        },
                        `${question.id}-${String(index)}`,
                      ),
                    ),
            }),
          ],
        },
        question.id,
      ),
    ),
  });
}

/** Compact, read-only fields and lists for recorded Tool results. */
/**
 * Render one recorded entity, receipt field, or a nested group of related values.
 * @param props.item - Localized title, status, badge, fields, and optional blocks.
 * @param props.t - Conversation dictionary for shared Markdown and code controls.
 * @param props.onOpenFile - Open a recorded file location in the session workspace.
 * @returns one detail list entry with its local disclosure and copy controls.
 */
export function DetailItem({
  item,
  t,
  onOpenFile,
}: {
  item: ToolDetailItem;
} & DetailContentProps): unknown {
  const status = item.status;
  return jsxRuntime.jsxs("li", {
    className: toolDetailsClasses.item,
    "data-change": item.change?.value,
    children: [
      item.title !== void 0 &&
        jsxRuntime.jsxs("div", {
          className: toolDetailsClasses.heading,
          children: [
            status !== void 0 &&
              jsxRuntime.jsx("span", {
                className: toolDetailsClasses.status,
                role: "img",
                "aria-label": item.change?.label ?? status.label,
                children:
                  item.change?.value === "added"
                    ? "+"
                    : item.change?.value === "removed"
                      ? "−"
                      : status.value === "completed"
                        ? jsxRuntime.jsx(primitives.IconCheckOutlineRegular, { size: 14 })
                        : status.value === "in_progress"
                          ? jsxRuntime.jsx(primitives.IconPlayOutlineRegular, { size: 14 })
                          : jsxRuntime.jsx("span", { className: toolDetailsClasses.pending }),
              }),
            item.location !== void 0 && onOpenFile !== void 0
              ? jsxRuntime.jsx("button", {
                  className: toolDetailsClasses.path,
                  type: "button",
                  onClick: () => {
                    const location = item.location;
                    if (location !== void 0)
                      onOpenFile(
                        location.path,
                        location.line === void 0 ? void 0 : { line: location.line },
                      );
                  },
                  children: item.title,
                })
              : jsxRuntime.jsx("span", {
                  className: toolDetailsClasses.text,
                  children: item.title,
                }),
            item.badge !== void 0 &&
              jsxRuntime.jsx("span", {
                className: toolDetailsClasses.badge,
                "data-tone": item.badge.tone,
                children: item.badge.label,
              }),
            status !== void 0 &&
              jsxRuntime.jsxs("span", {
                className: toolDetailsClasses.statusText,
                children: [
                  item.previousStatus !== void 0 &&
                    jsxRuntime.jsxs(jsxRuntime.Fragment, {
                      children: [
                        jsxRuntime.jsx("span", {
                          className: toolDetailsClasses.previous,
                          children: item.previousStatus,
                        }),
                        jsxRuntime.jsx("span", { children: " → " }),
                      ],
                    }),
                  jsxRuntime.jsx("span", { children: status.label }),
                  item.change?.value === "updated" &&
                    item.previousStatus === void 0 &&
                    jsxRuntime.jsxs("span", { children: [" · ", item.change.label] }),
                ],
              }),
          ],
        }),
      item.subtitle !== void 0 &&
        jsxRuntime.jsx("div", {
          className: toolDetailsClasses.subtitle,
          children: item.subtitle,
        }),
      item.description !== void 0 &&
        jsxRuntime.jsx("p", {
          className: toolDetailsClasses.description,
          children: item.description,
        }),
      item.fields.length > 0 &&
        jsxRuntime.jsx("dl", {
          className: toolDetailsClasses.fields,
          children: item.fields.map((field) =>
            jsxRuntime.jsxs(
              "div",
              {
                className: toolDetailsClasses.field,
                children: [
                  jsxRuntime.jsx("dt", { children: field.label }),
                  jsxRuntime.jsx("dd", { children: field.value }),
                ],
              },
              field.label,
            ),
          ),
        }),
      item.lines !== void 0 &&
        jsxRuntime.jsx("ul", {
          className: toolDetailsClasses.lines,
          children: item.lines.map((line, index) => jsxRuntime.jsx("li", { children: line }, index)),
        }),
      item.markdown !== void 0 &&
        jsxRuntime.jsx("div", {
          className: toolDetailsClasses.prose,
          children: jsxRuntime.jsx(primitives.MarkdownText, {
            text: item.markdown,
            labels: markdownLabels(t),
          }),
        }),
      item.code !== void 0 &&
        jsxRuntime.jsx(primitives.CodeBlock, {
          toolbarLabels: codeToolbarLabels(t),
          className: toolDetailsClasses.code,
          code: item.code.text,
          lang: item.code.language,
          copyLabel: t("copy"),
          copiedLabel: t("copied"),
        }),
      item.groups?.map((group, index) =>
        jsxRuntime.jsxs(
          "details",
          {
            className: toolDetailsClasses.group,
            children: [
              jsxRuntime.jsxs("summary", {
                children: [
                  jsxRuntime.jsx(primitives.IconChevronRightOutlineRegular, {}),
                  jsxRuntime.jsx("span", { children: group.label }),
                ],
              }),
              jsxRuntime.jsx("ul", {
                className: toolDetailsClasses.list,
                children: group.items.map((child, childIndex) =>
                  jsxRuntime.jsx(
                    DetailItem,
                    {
                      item: child,
                      t,
                      onOpenFile,
                    },
                    childIndex,
                  ),
                ),
              }),
            ],
          },
          index,
        ),
      ),
    ],
  });
}

/**
 * Render recorded values with local disclosures, copy controls, and file navigation.
 * @param props.model - Localized fields or list items; an empty list uses its empty label.
 * @param props.hasInspect - Reserve space for the row's upper-right Inspect button.
 * @param props.t - Conversation dictionary for shared Markdown and code controls.
 * @param props.onOpenFile - Open a recorded file location in the session workspace.
 * @returns The expanded detail body.
 */
export function ToolDetails({
  model,
  hasInspect = false,
  t,
  onOpenFile,
}: {
  model: ToolDetailsModel;
  hasInspect?: boolean;
} & DetailContentProps): unknown {
  return jsxRuntime.jsxs("div", {
    className: toolDetailsClasses.root,
    "data-inspect": hasInspect || void 0,
    "data-caption": model.caption !== void 0 || void 0,
    children: [
      model.caption !== void 0 &&
        jsxRuntime.jsx("div", {
          className: toolDetailsClasses.caption,
          children: model.caption,
        }),
      model.items.length === 0
        ? jsxRuntime.jsx("p", {
            className: toolDetailsClasses.empty,
            children: model.empty,
          })
        : jsxRuntime.jsx("ul", {
            className: toolDetailsClasses.list,
            children: model.items.map((item, index) =>
              jsxRuntime.jsx(
                DetailItem,
                {
                  item,
                  t,
                  onOpenFile,
                },
                index,
              ),
            ),
          }),
      model.unchanged !== void 0 &&
        jsxRuntime.jsxs("details", {
          className: toolDetailsClasses.unchanged,
          children: [
            jsxRuntime.jsxs("summary", {
              children: [
                jsxRuntime.jsx(primitives.IconChevronRightOutlineRegular, {}),
                model.unchanged.label,
              ],
            }),
            jsxRuntime.jsx("ul", {
              className: toolDetailsClasses.list,
              children: model.unchanged.items.map((item, index) =>
                jsxRuntime.jsx(
                  DetailItem,
                  {
                    item,
                    t,
                    onOpenFile,
                  },
                  index,
                ),
              ),
            }),
          ],
        }),
    ],
  });
}

/** Inline exit status for a settled command. */
/**
 * Render a neutral capsule with a failure dot and a localized exit status.
 * @param props - localized exit code or terminating signal label.
 * @returns the exit status capsule.
 */
export function ExitCodeBadge({ label }: { label: string }): unknown {
  return jsxRuntime.jsxs(primitives.Tag, {
    tone: "neutral",
    className: exitCodeBadgeClasses.badge,
    children: [
      jsxRuntime.jsx("span", {
        className: exitCodeBadgeClasses.dot,
        "aria-hidden": true,
      }),
      label,
    ],
  });
}

/** Question-owned summary action and transcript disclosure. */
/**
 * Render a question with its answer-panel entry point.
 * @param props - Question transcript, panel action, and disclosure state.
 * @returns The question's summary and optional expanded record.
 */
export function QuestionToolRow({
  useDisclosure,
  t,
  summary,
  bodyRaw,
  output,
  askQuestion,
  state,
  inspect,
  openPanel,
  panelLabel,
}: {
  /** Trang thai mo rong do hang so huu. */
  useDisclosure: UseDisclosure;
  /** Ghe dich cua hoi thoai. */
  t: TranslateSeat;
  /** Dong tom tat cua hang. */
  summary: string;
  /** Tham so goc dang JSON, chi hien khi mo rong. */
  bodyRaw?: string | null | undefined;
  /** Van ban ket qua da lam phang cho phan Output. */
  output?: string | null | undefined;
  /** The hoi-dap da ban dia hoa. */
  askQuestion?: AskQuestionCardModel | null | undefined;
  /** Trang thai cua hang. */
  state: ToolRowState;
  /** Nhay toi loi goi nay trong khung nhin quy dao. */
  inspect?: (() => void) | undefined;
  /** Mo bang tra loi; tra true khi da xu ly. */
  openPanel: () => boolean;
  /** Nhan cua nut mo bang. */
  panelLabel: string;
}): unknown {
  const { expanded, toggle } = useDisclosure();
  const expandable = bodyRaw != null || output != null || askQuestion != null;
  const open = expanded && expandable;
  return jsxRuntime.jsxs("div", {
    className: toolRowClasses.root,
    "data-variant": "others",
    "data-tool": "ask_user_question",
    "data-state": state,
    children: [
      state === "running" &&
        jsxRuntime.jsx("span", {
          className: toolRowClasses.visuallyHidden,
          children: t("row.running"),
        }),
      jsxRuntime.jsx(primitives.DisclosureRow, {
        rowClassName: toolRowClasses.row,
        leadingClassName: toolRowClasses.leading,
        titleClassName: toolRowClasses.title,
        chevronClassName: toolRowClasses.chevron,
        icon: jsxRuntime.jsx(primitives.IconQuestionOutlineRegular, {}),
        title: t("ask.rowTitle"),
        running: state === "running",
        open,
        expandable,
        keepContentWhenOpen: true,
        onToggle: toggle,
        collapsedContent: jsxRuntime.jsxs(jsxRuntime.Fragment, {
          children: [
            summary !== "" &&
              jsxRuntime.jsxs(jsxRuntime.Fragment, {
                children: [
                  jsxRuntime.jsx("span", {
                    className: toolRowClasses.sep,
                    "aria-hidden": true,
                  }),
                  jsxRuntime.jsx("span", {
                    className: toolRowClasses.summary,
                    children: jsxRuntime.jsx(primitives.TextShimmer, {
                      active: state === "running",
                      children: summary,
                    }),
                  }),
                ],
              }),
            jsxRuntime.jsxs("button", {
              type: "button",
              className: questionToolRowClasses.panelButton,
              onClick: (event: any) => {
                event.stopPropagation();
                if (!openPanel()) toggle();
              },
              onKeyDown: (event: any) => {
                if (event.key === "Enter" || event.key === " ") event.stopPropagation();
              },
              children: [
                jsxRuntime.jsx(primitives.IconQuestionOutlineRegular, {}),
                panelLabel,
              ],
            }),
          ],
        }),
        children:
          open &&
          jsxRuntime.jsxs("div", {
            className: toolRowClasses.bodyWrap,
            children: [
              askQuestion != null
                ? jsxRuntime.jsx(AskQuestionCard, { card: askQuestion })
                : jsxRuntime.jsxs("div", {
                    className: toolRowClasses.ioCard,
                    children: [
                      bodyRaw != null &&
                        jsxRuntime.jsxs("div", {
                          className: toolRowClasses.ioSection,
                          children: [
                            jsxRuntime.jsx("span", {
                              className: toolRowClasses.ioLabel,
                              children: t("row.input"),
                            }),
                            jsxRuntime.jsx("span", {
                              className: toolRowClasses.ioText,
                              children: formatToolBody("others", bodyRaw),
                            }),
                          ],
                        }),
                      bodyRaw != null &&
                        output != null &&
                        jsxRuntime.jsx("span", {
                          className: toolRowClasses.ioDivider,
                          "aria-hidden": true,
                        }),
                      output != null &&
                        jsxRuntime.jsxs("div", {
                          className: toolRowClasses.ioSection,
                          children: [
                            jsxRuntime.jsx("span", {
                              className: toolRowClasses.ioLabel,
                              children: t("row.output"),
                            }),
                            jsxRuntime.jsx("span", {
                              className: toolRowClasses.ioText,
                              children: output,
                            }),
                          ],
                        }),
                    ],
                  }),
              inspect !== void 0 &&
                jsxRuntime.jsxs("button", {
                  type: "button",
                  className: toolRowClasses.inspectButton,
                  onClick: inspect,
                  children: [jsxRuntime.jsx(primitives.IconInspectOutlineRegular, {}), t("row.inspect")],
                }),
            ],
          }),
      }),
    ],
  });
}
