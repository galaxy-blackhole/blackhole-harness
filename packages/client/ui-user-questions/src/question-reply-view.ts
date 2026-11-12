/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bong bong tra loi muon (1:1 lib/types/client/QuestionReplyView.js): nhan ten cau hoi cu, tung cap hoi-dap khi mo, va nut sao chep
 */

import { PACKAGE_NAME } from "./ids.ts";
import type { QuestionReplyData } from "./question-reply.ts";
import { replyAnswerValues, replyClipboardText } from "./question-reply.ts";
import { injectStyleTag } from "./styles.ts";
import type { PanelRuntime } from "./plan-review-panel.ts";
import type { PrimitivesSeam, Translate } from "./types.ts";

/** CSS của bong bóng do `build.ts` nhúng bằng `define`; chạy từ nguồn (test) thì tra biến toàn cục cùng tên. */
declare const __GBH_QUESTION_REPLY_CSS__: string;

/** Tên lớp CSS — GIỮ NGUYÊN hash của bản gốc để DOM không lệch (xem QuestionReplyView.module.css). */
export const CLASS = {
  /** Hàng canh phải của bong bóng. */
  row: "ROF66W_row",
  /** Thân bong bóng. */
  bubble: "ROF66W_bubble",
  /** Nút mở/đóng chi tiết. */
  toggle: "ROF66W_toggle",
  /** Hàng nhãn + mũi tên. */
  labelRow: "ROF66W_labelRow",
  /** Mũi tên mở/đóng. */
  caret: "ROF66W_caret",
  /** Nhãn "trả lời câu hỏi trước". */
  label: "ROF66W_label",
  /** Tóm tắt câu trả lời khi đang đóng. */
  summary: "ROF66W_summary",
  /** Văn bản hướng mô hình khi payload không đọc được. */
  text: "ROF66W_text",
  /** Khối chi tiết từng câu hỏi. */
  details: "ROF66W_details",
  /** Một câu hỏi trong chi tiết. */
  question: "ROF66W_question",
  /** Tiêu đề nhóm của câu hỏi. */
  header: "ROF66W_header",
  /** Chi tiết phụ của câu hỏi. */
  detail: "ROF66W_detail",
  /** Nội dung câu hỏi. */
  questionText: "ROF66W_questionText",
  /** Danh sách lựa chọn đã đưa ra. */
  options: "ROF66W_options",
  /** Câu trả lời. */
  answer: "ROF66W_answer",
  /** Nhãn "trả lời:". */
  answerLabel: "ROF66W_answerLabel",
  /** Hàng thời gian + nút sao chép. */
  actions: "ROF66W_actions",
  /** Thời gian. */
  time: "ROF66W_time",
  /** Nút hành động. */
  action: "ROF66W_action",
} as const;

/** Id gắn vào `data-plugin-css` để không chèn style hai lần. */
const STYLE_TAG_ID = `${PACKAGE_NAME}/QuestionReplyView.module.css`;

/** Props của bong bóng trả lời muộn (khớp `PropsRuntime<'conversation.chat.node','question-reply'> & PropsLocale<'question'>`). */
export interface QuestionReplyViewProps {
  /** Node hội thoại đã dựng. */
  readonly node: { readonly data: QuestionReplyData };
  /** Bộ dịch của namespace `question`. */
  readonly t: Translate;
}

/** Props của phần thân bong bóng. */
export interface QuestionReplyBubbleProps {
  /** Dữ liệu trả lời đã chiếu. */
  readonly data: QuestionReplyData;
  /** Bộ dịch của namespace `question`. */
  readonly t: Translate;
}

/**
 * Chèn CSS của bong bóng nếu chưa có.
 * Nhận: không.
 * Trả: không.
 */
export function injectQuestionReplyStyles(): void {
  injectStyleTag(STYLE_TAG_ID, typeof __GBH_QUESTION_REPLY_CSS__ === "string" ? __GBH_QUESTION_REPLY_CSS__ : "");
}

/**
 * Dựng bong bóng trả lời muộn canh phải: một nhãn gọi tên các câu hỏi đang chờ trước đó, rồi mỗi câu hỏi
 * một cặp hỏi–đáp. Payload mà Client không đọc được thì lùi về văn bản hướng mô hình.
 * Nhận: react — runtime React/JSX do bảng module cấp; primitives — bề mặt ui-primitives.
 * Trả: component `QuestionReplyView` đã bọc `memo`.
 */
export function createQuestionReplyView(react: PanelRuntime, primitives: PrimitivesSeam): (props: QuestionReplyViewProps) => unknown {
  const { jsx, jsxs, useState, useCallback, memo } = react;
  injectQuestionReplyStyles();

  /**
   * Render một câu trả lời đã xong thành bong bóng transcript gọn.
   * Nhận: props — dữ liệu trả lời và bộ dịch namespace `question`.
   * Trả: bong bóng mở/đóng được.
   */
  function QuestionReplyBubble({ data, t }: QuestionReplyBubbleProps): unknown {
    const label = t("reply.label");
    const [open, setOpen] = useState(false);
    const toggleLabel = t(open ? "reply.close" : "reply.open");
    const summary = data.questions.map((question) => replyAnswerValues(data, question.id)).flat().join(", ");
    const copyText = replyClipboardText(data, t);
    const [copied, setCopied] = useState(false);
    const onCopy = useCallback(() => {
      if (copied) return;
      void primitives.writeClipboard(copyText).then((ok) => {
        if (!ok) return;
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1e3);
      });
    }, [copied, copyText]);
    return jsxs("div", {
      className: CLASS.row,
      "data-question-reply": data.callId,
      "data-reply-outcome": data.outcome,
      role: "group",
      "aria-label": label,
      children: [
        jsxs("div", {
          className: CLASS.bubble,
          children: [
            jsxs("button", {
              type: "button",
              className: CLASS.toggle,
              "aria-expanded": open,
              "aria-label": `${label} · ${toggleLabel}`,
              onClick: () => {
                setOpen((value) => !value);
              },
              children: [
                jsxs("span", {
                  className: CLASS.labelRow,
                  children: [
                    jsx("span", {
                      className: CLASS.caret,
                      "aria-hidden": "true",
                      children: open ? jsx(primitives.IconChevronDownOutlineRegular, {}) : jsx(primitives.IconChevronRightOutlineRegular, {}),
                    }),
                    jsx("span", {
                      className: CLASS.label,
                      children: label,
                    }),
                  ],
                }),
                !open &&
                  jsx("span", {
                    className: CLASS.summary,
                    children: summary === "" ? t("reply.skipped") : summary,
                  }),
              ],
            }),
            open &&
              (data.questions.length === 0
                ? jsx("p", {
                    className: CLASS.text,
                    children: data.text,
                  })
                : jsx("dl", {
                    className: CLASS.details,
                    children: data.questions.map((question) => {
                      const values = replyAnswerValues(data, question.id);
                      return jsxs(
                        "div",
                        {
                          children: [
                            jsxs("dt", {
                              className: CLASS.question,
                              children: [
                                question.header &&
                                  question.header !== question.question &&
                                  jsx("span", {
                                    className: CLASS.header,
                                    children: question.header,
                                  }),
                                jsx("span", {
                                  className: CLASS.questionText,
                                  children: question.question,
                                }),
                                question.detail &&
                                  jsx("span", {
                                    className: CLASS.detail,
                                    children: question.detail,
                                  }),
                                question.options &&
                                  question.options.length > 0 &&
                                  jsx("ul", {
                                    className: CLASS.options,
                                    children: question.options.map((option) =>
                                      jsxs(
                                        "li",
                                        {
                                          children: [option.label, option.description && ` — ${option.description}`],
                                        },
                                        option.label,
                                      ),
                                    ),
                                  }),
                              ],
                            }),
                            jsxs("dd", {
                              className: CLASS.answer,
                              children: [
                                jsx("span", {
                                  className: CLASS.answerLabel,
                                  children: t("reply.answerLabel"),
                                }),
                                values.length === 0 ? t("reply.skipped") : values.join(", "),
                              ],
                            }),
                          ],
                        },
                        question.id,
                      );
                    }),
                  })),
          ],
        }),
        jsxs("div", {
          className: CLASS.actions,
          children: [
            jsx("span", {
              className: CLASS.time,
              children: new Intl.DateTimeFormat(void 0, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(data.time),
            }),
            jsx(primitives.Tooltip, {
              label: copied ? t("copied") : t("copy"),
              side: "bottom",
              children: jsx("button", {
                type: "button",
                className: CLASS.action,
                "aria-label": copied ? t("copied") : t("copy"),
                onClick: onCopy,
                children: copied ? jsx(primitives.IconCheckOutlineRegular, {}) : jsx(primitives.IconCopyOutlineRegular, {}),
              }),
            }),
          ],
        }),
      ],
    });
  }

  /**
   * Bọc bong bóng trong `memo` để chỉ render lại khi props đổi, y như bản gốc.
   * Nhận: props — node hội thoại đã dựng và bộ dịch namespace `question`.
   * Trả: bong bóng trả lời của node.
   */
  return memo(function QuestionReplyView({ node, t }: QuestionReplyViewProps): unknown {
    return jsx(QuestionReplyBubble, {
      data: node.data,
      t,
    });
  });
}
