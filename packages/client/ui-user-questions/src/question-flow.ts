/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Luong cau hoi thuong cua composer takeover (1:1 QuestionFlow trong lib/types/client/QuestionComposer.js)
 */

import type { PendingQuestion, QuestionAnswer, QuestionCardSnapshot } from "./contract.ts";
import { clsx } from "./clsx.ts";
import type { QuestionDraftAnswer, QuestionDraftBoundActions, QuestionDraftProgress, QuestionDraftState } from "./draft-store.ts";
import { CLASS, REMOVED_CARD, createAnswerField, isComposing, isQuestionDraftProgress, parseRecommendedLabel, recommendedFirstOption } from "./question-shared.ts";
import type { AnswerFieldProps, ChangeEventLike, FocusWithinEvent, KeyEventLike } from "./question-shared.ts";
import type { PanelRuntime } from "./plan-review-panel.ts";
import type { PrimitivesSeam, Translate, UserQuestionAnswerItem, UserQuestionItem } from "./types.ts";

/** Trạng thái bận của luồng: đang gửi câu trả lời, đang huỷ, hay rảnh. */
type Busy = "cancel" | "answer" | null;

/** Phản hồi hiện trong dòng chân thẻ: một khoá dịch, hoặc thông điệp lỗi nguyên văn. */
type Notice = { readonly key: string } | { readonly text: string } | null;

/** Cách người dùng đã chọn khi đồng hồ đếm ngược bị giữ. */
type WaitDisposition = "editing" | "waiting" | undefined;

/** Props của luồng câu hỏi thường. */
export interface QuestionFlowProps {
  /** Yêu cầu đang chờ. */
  readonly pending: PendingQuestion;
  /** Bộ dịch của namespace `question`. */
  readonly t: Translate;
  /** Hook đọc kho nháp của phiên. */
  readonly useStore: <T>(selector: (state: QuestionDraftState) => T) => T;
  /** Keyed Hook đọc ảnh chụp thẻ theo khoá. */
  readonly useQuestionCard: <T>(key: string, select: (snapshot: QuestionCardSnapshot | undefined) => T) => T;
  /** Bề mặt ghi của kho nháp, đã buộc khoá. */
  readonly actions: QuestionDraftBoundActions;
}

/**
 * Dựng luồng câu hỏi thường: chọn lựa chọn, nhập câu trả lời tự do, bỏ qua, và phân trang giữa các câu hỏi.
 * Nhận: react — runtime React/JSX do bảng module cấp; primitives — bề mặt ui-primitives.
 * Trả: component nhận `QuestionFlowProps` và trả thẻ câu hỏi chiếm ghế composer.
 */
export function createQuestionFlow(react: PanelRuntime, primitives: PrimitivesSeam): (props: QuestionFlowProps) => unknown {
  const { jsx, jsxs, Fragment, useState, useRef, useEffect, useMemo } = react;
  const AnswerField = createAnswerField(react);

  /**
   * Render thẻ câu hỏi hiện tại của một yêu cầu.
   * Nhận: props — thẻ đang chờ, bộ dịch, kho nháp và keyed Hook của thẻ.
   * Trả: composer takeover của luồng câu hỏi thường.
   */
  return function QuestionFlow({ pending, t, useStore, useQuestionCard, actions }: QuestionFlowProps): unknown {
    const questions = pending.questions;
    const review = pending.review;
    const markdownLabels = useMemo(
      () => ({
        code: {
          copyLabel: t("copy"),
          copiedLabel: t("copied"),
          toolbarLabels: {
            codeLabel: t("codeBlock.title"),
            wrapLabel: t("codeBlock.wrap"),
            unwrapLabel: t("codeBlock.unwrap"),
          },
        },
        footnotes: t("markdown.footnotes"),
      }),
      [t],
    );
    const initialDrafts = useMemo(() => {
      const recorded = new Map<string, UserQuestionAnswerItem>((review ?? []).map((answer) => [answer.id, answer]));
      return questions.map((item) => {
        const answer = recorded.get(item.id);
        const custom = answer?.custom ?? "";
        const recommended = review === void 0 ? recommendedFirstOption(item) : void 0;
        return {
          selected: answer === void 0 && recommended !== void 0 ? [recommended] : [...(answer?.selected ?? [])],
          custom,
          skipped: answer !== void 0 && answer.selected.length === 0 && custom === "",
        };
      });
    }, [questions, review]);
    const stored = useStore((state) => state.progressByRequest[pending.key]);
    const validStored = isQuestionDraftProgress(stored, questions.length) ? stored : void 0;
    const storedProgress = review === void 0 ? validStored : void 0;
    const index = validStored?.index ?? 0;
    const drafts = storedProgress?.drafts ?? initialDrafts;
    const restoredWait: WaitDisposition =
      storedProgress?.wait ??
      (storedProgress?.drafts.some(
        (item, itemIndex) =>
          item.selected.length !== initialDrafts[itemIndex]?.selected.length ||
          item.selected.some((label, labelIndex) => label !== initialDrafts[itemIndex]?.selected[labelIndex]) ||
          item.custom !== "" ||
          item.skipped,
      ) === true
        ? "editing"
        : void 0);
    const [busy, setBusy] = useState<Busy>(null);
    const [error, setError] = useState<Notice>(null);
    const card = useQuestionCard(pending.key, (snapshot) => snapshot ?? REMOVED_CARD);
    const canSubmit = card.channel !== "none";
    const locked = busy !== null || review !== void 0;
    const sentVia = useRef<"waterfall" | null>(null);
    useEffect(() => {
      if (sentVia.current !== "waterfall" || card.state !== "continued") return;
      sentVia.current = null;
      setBusy(null);
      setError({ key: "error.resubmit" });
    }, [card.state]);
    useEffect(() => {
      if (card.closed) actions.clear(pending.key);
    }, [actions, card.closed, pending.key]);
    useEffect(() => {
      actions.prune(pending.liveKeys());
    }, [actions, pending]);
    const waitDisposition = useRef<WaitDisposition>(restoredWait);
    useEffect(() => {
      if (waitDisposition.current === "waiting") pending.takeTime();
      if (waitDisposition.current === "editing") pending.engage();
    }, [pending]);
    const countdown = card.countdown;
    const [minimized, setMinimized] = useState(false);
    const focusedQuestions = useRef<Set<number>>(new Set());
    const answerSurface = useRef<HTMLElement | null>(null);
    const question = questions[index] as UserQuestionItem;
    const draft = drafts[index] as QuestionDraftAnswer;
    const hasOptions = (question.options?.length ?? 0) > 0;
    /**
     * Ghi tiến trình mới của yêu cầu, kèm lựa chọn chờ hiện tại.
     * Nhận: nextIndex — câu hỏi đang mở; nextDrafts — toàn bộ nháp theo thứ tự câu hỏi.
     * Trả: không.
     */
    const replaceProgress = (nextIndex: number, nextDrafts: QuestionDraftAnswer[]): void => {
      actions.replace(pending.key, {
        index: nextIndex,
        drafts: nextDrafts,
        ...(waitDisposition.current === void 0 ? {} : { wait: waitDisposition.current }),
      });
    };
    /**
     * Chọn chờ vô thời hạn rồi ghi lại tiến trình.
     * Nhận: không.
     * Trả: không.
     */
    const takeTime = (): void => {
      waitDisposition.current = "waiting";
      pending.takeTime();
      replaceProgress(index, drafts);
    };
    /**
     * Ghi nhận người dùng đã sửa nháp (bỏ hạn foreground), chỉ một lần cho mỗi thẻ.
     * Nhận: không.
     * Trả: không.
     */
    const engage = (): void => {
      if (waitDisposition.current !== void 0) return;
      waitDisposition.current = "editing";
      pending.engage();
    };
    /**
     * Giữ đồng hồ khi focus vào bề mặt trả lời.
     * Nhận: event — sự kiện focus lan.
     * Trả: không.
     */
    const focusAnswerSurface = (event: FocusWithinEvent): void => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) pending.holdFocus();
    };
    /**
     * Chạy tiếp đồng hồ khi focus rời bề mặt trả lời.
     * Nhận: event — sự kiện blur lan.
     * Trả: không.
     */
    const blurAnswerSurface = (event: FocusWithinEvent): void => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) pending.releaseFocus();
    };
    useEffect(() => {
      const release = (): void => {
        pending.releaseFocus();
      };
      const refocus = (): void => {
        if (waitDisposition.current === "editing") {
          pending.engage();
          return;
        }
        if (answerSurface.current?.contains(document.activeElement) === true) pending.holdFocus();
      };
      const visibilityChanged = (): void => {
        if (document.hidden) release();
        else refocus();
      };
      window.addEventListener("blur", release);
      window.addEventListener("focus", refocus);
      document.addEventListener("visibilitychange", visibilityChanged);
      return () => {
        release();
        window.removeEventListener("blur", release);
        window.removeEventListener("focus", refocus);
        document.removeEventListener("visibilitychange", visibilityChanged);
      };
    }, [pending]);
    /**
     * Đóng thẻ: thẻ khoá theo lời gọi công cụ chỉ rời ghế, thẻ không tên kết thúc yêu cầu.
     * Nhận: không.
     * Trả: không.
     */
    const dismissFlow = (): void => {
      if (pending.dismissal === "hide") {
        pending.dismiss();
        return;
      }
      if (!canSubmit) {
        setError({ key: "error.unavailable" });
        return;
      }
      setBusy("cancel");
      setError(null);
      sentVia.current = "waterfall";
      pending.dismiss().catch((cause: unknown) => {
        sentVia.current = null;
        setBusy(null);
        setError({ text: cause instanceof Error ? cause.message : String(cause) });
      });
    };
    /**
     * Sửa nháp của một câu hỏi rồi ghi lại tiến trình.
     * Nhận: update — phép biến đổi nháp hiện tại; nextIndex — câu hỏi đang mở sau khi sửa.
     * Trả: không.
     */
    const updateDraft = (update: (current: QuestionDraftAnswer) => QuestionDraftAnswer, nextIndex = index): void => {
      engage();
      replaceProgress(
        nextIndex,
        drafts.map((item, itemIndex) => (itemIndex === index ? update(item) : item)),
      );
      setError(null);
    };
    /**
     * Chọn (hoặc bỏ chọn) một lựa chọn; chọn một thì tự sang câu kế tiếp.
     * Nhận: label — nhãn gốc của lựa chọn.
     * Trả: không.
     */
    const choose = (label: string): void => {
      updateDraft(
        (current) => {
          if (question.multiSelect === true) {
            const selected = current.selected.includes(label) ? current.selected.filter((item) => item !== label) : [...current.selected, label];
            return {
              ...current,
              selected,
              skipped: false,
            };
          }
          return {
            selected: [label],
            custom: "",
            skipped: false,
          };
        },
        question.multiSelect !== true && index < questions.length - 1 ? index + 1 : index,
      );
    };
    /**
     * Câu hỏi đã có câu trả lời chưa.
     * Nhận: item — nháp của câu hỏi.
     * Trả: true khi đã chọn lựa chọn hoặc đã nhập chữ.
     */
    const answered = (item: QuestionDraftAnswer): boolean => item.selected.length > 0 || item.custom.trim() !== "";
    /**
     * Câu hỏi đã xong chưa (trả lời hoặc bỏ qua).
     * Nhận: item — nháp của câu hỏi.
     * Trả: true khi xong.
     */
    const completed = (item: QuestionDraftAnswer): boolean => answered(item) || item.skipped;
    /**
     * Gửi cả lô câu trả lời qua kênh đang sống.
     * Nhận: values — nháp của mọi câu hỏi theo thứ tự.
     * Trả: không.
     */
    const submitDrafts = (values: QuestionDraftAnswer[]): void => {
      const missing = values.findIndex((item) => !completed(item));
      if (missing >= 0) {
        replaceProgress(missing, values);
        setError({ key: "error.incomplete" });
        return;
      }
      if (!canSubmit) {
        setError({ key: "error.unavailable" });
        return;
      }
      const answer: QuestionAnswer = {
        answers: questions.map((item, itemIndex) => {
          const value = values[itemIndex] as QuestionDraftAnswer;
          if (value.skipped)
            return {
              id: item.id,
              selected: [],
            };
          const custom = value.custom.trim();
          return {
            id: item.id,
            selected: custom === "" || item.multiSelect === true ? value.selected : [],
            ...(custom === "" ? {} : { custom }),
          };
        }),
      };
      setBusy("answer");
      setError(null);
      const channel = pending.snapshot().channel;
      sentVia.current = channel === "waterfall" ? "waterfall" : null;
      pending
        .answer(answer)
        .then(() => {
          if (channel !== "rpc") return;
          sentVia.current = null;
          setBusy(null);
          setError(null);
          pending.dismiss().catch(() => {
            setError({ key: "status.sent" });
          });
        })
        .catch((cause: unknown) => {
          sentVia.current = null;
          setBusy(null);
          setError({ text: cause instanceof Error ? cause.message : String(cause) });
        });
    };
    /**
     * Sang câu kế tiếp, hoặc gửi cả lô khi đang ở câu cuối.
     * Nhận: không.
     * Trả: không.
     */
    const continueFlow = (): void => {
      if (!answered(draft)) {
        setError({ key: "error.unanswered" });
        return;
      }
      if (index < questions.length - 1) {
        replaceProgress(index + 1, drafts);
        setError(null);
        return;
      }
      submitDrafts(drafts);
    };
    /**
     * Ghi câu trả lời tự nhập.
     * Nhận: event — sự kiện thay đổi của ô nhập.
     * Trả: không.
     */
    const draftCustom = (event: ChangeEventLike): void => {
      const value = event.target.value;
      updateDraft((current) => ({
        ...current,
        selected: question.multiSelect === true ? current.selected : [],
        custom: value,
        skipped: false,
      }));
    };
    /**
     * Enter (không Shift, không IME) trong ô tự nhập thì đi tiếp.
     * Nhận: event — sự kiện bàn phím của ô nhập.
     * Trả: không.
     */
    const continueFromCustom = (event: KeyEventLike): void => {
      if (event.key !== "Enter" || event.shiftKey || isComposing(event)) return;
      event.preventDefault();
      continueFlow();
    };
    /**
     * Bỏ qua câu hỏi này rồi sang câu kế tiếp (câu cuối thì gửi luôn).
     * Nhận: không.
     * Trả: không.
     */
    const skipQuestion = (): void => {
      engage();
      const nextDrafts = drafts.map((item, itemIndex) =>
        itemIndex === index
          ? {
              selected: [],
              custom: "",
              skipped: true,
            }
          : item,
      );
      replaceProgress(index < questions.length - 1 ? index + 1 : index, nextDrafts);
      setError(null);
      if (index < questions.length - 1) return;
      submitDrafts(nextDrafts);
    };
    const answerFieldProps: AnswerFieldProps = {
      variant: "block",
      value: draft.custom,
      disabled: locked,
      placeholder: t("custom.placeholder"),
      onChange: draftCustom,
      onKeyDown: continueFromCustom,
    };
    return jsx("div", {
      className: CLASS.frame,
      "data-question-key": pending.key,
      children: jsxs("section", {
        className: clsx(CLASS.card, minimized && CLASS.cardMinimized),
        "aria-labelledby": `question-${pending.key}-${String(index)}`,
        children: [
          jsxs("header", {
            className: CLASS.header,
            children: [
              jsxs("div", {
                className: CLASS.headingBlock,
                children: [
                  question.header !== void 0 &&
                    jsx("div", {
                      className: CLASS.eyebrow,
                      children: question.header,
                    }),
                  jsx("h2", {
                    className: CLASS.title,
                    id: `question-${pending.key}-${String(index)}`,
                    children: question.question,
                  }),
                ],
              }),
              jsxs("div", {
                className: CLASS.headerActions,
                children: [
                  countdown !== void 0 &&
                    card.waitState !== "waiting" &&
                    card.waitState !== "editing" &&
                    card.waitState !== "continued" &&
                    jsx("span", {
                      className: CLASS.waitStatus,
                      children: t(countdown.running ? "wait.countdown" : "wait.paused", { seconds: Math.ceil(countdown.remainingMs / 1e3) }),
                    }),
                  countdown !== void 0 &&
                    card.waitState !== "waiting" &&
                    card.waitState !== "editing" &&
                    card.waitState !== "continued" &&
                    jsx(primitives.Button, {
                      variant: "outline",
                      className: CLASS.waitButton,
                      onClick: takeTime,
                      children: t("wait.takeTime"),
                    }),
                  card.state === "continued" &&
                    jsx("span", {
                      className: CLASS.waitStatus,
                      children: t("wait.continued"),
                    }),
                  countdown !== void 0 &&
                    (card.waitState === "waiting" || card.waitState === "editing") &&
                    jsx("span", {
                      className: CLASS.waitStatus,
                      children: t("wait.held"),
                    }),
                  review !== void 0 &&
                    jsx("span", {
                      className: CLASS.waitStatus,
                      children: t("review.status"),
                    }),
                  jsx("button", {
                    type: "button",
                    className: CLASS.iconButton,
                    "aria-label": t(minimized ? "nav.maximize" : "nav.minimize"),
                    title: t(minimized ? "nav.maximize" : "nav.minimize"),
                    "aria-expanded": !minimized,
                    disabled: busy !== null,
                    onClick: () => {
                      setMinimized((current) => !current);
                    },
                    children: minimized ? jsx(primitives.IconChevronUpOutlineRegular, {}) : jsx(primitives.IconChevronDownOutlineRegular, {}),
                  }),
                  jsx("button", {
                    type: "button",
                    className: CLASS.iconButton,
                    "aria-label": t(pending.dismissal === "hide" ? "nav.close" : "nav.cancel"),
                    title: t(pending.dismissal === "hide" ? "nav.close" : "nav.cancel"),
                    disabled: busy !== null,
                    onClick: dismissFlow,
                    children: jsx(primitives.IconCloseOutlineRegular, {}),
                  }),
                ],
              }),
            ],
          }),
          !minimized &&
            jsxs(Fragment, {
              children: [
                jsxs("div", {
                  ref: answerSurface,
                  className: CLASS.body,
                  "data-question-scroll": true,
                  onFocusCapture: focusAnswerSurface,
                  onBlurCapture: blurAnswerSurface,
                  children: [
                    question.detail !== void 0 &&
                      jsx("div", {
                        className: CLASS.detail,
                        children: jsx(primitives.MarkdownText, {
                          text: question.detail,
                          labels: markdownLabels,
                        }),
                      }),
                    jsxs("div", {
                      className: CLASS.options,
                      role: question.multiSelect === true ? "group" : "radiogroup",
                      children: [
                        (question.options ?? []).map(
                          (option, optionIndex) => {
                            const selected = draft.selected.includes(option.label);
                            const display = parseRecommendedLabel(option.label);
                            return jsxs(
                              "button",
                              {
                                type: "button",
                                className: clsx(CLASS.option, selected && question.multiSelect !== true && CLASS.optionSelected),
                                role: question.multiSelect === true ? "checkbox" : "radio",
                                "aria-checked": selected,
                                "aria-label": display.label,
                                disabled: locked,
                                onClick: () => {
                                  choose(option.label);
                                },
                                onKeyDown: (event: KeyEventLike) => {
                                  if (event.key !== "Enter") return;
                                  event.preventDefault();
                                  submitDrafts(drafts);
                                },
                                children: [
                                  question.multiSelect === true
                                    ? jsx("span", {
                                        className: clsx(CLASS.checkbox, selected && CLASS.checkboxChecked),
                                        "aria-hidden": "true",
                                        children: selected && jsx(primitives.IconCheckOutlineRegular, { size: 12 }),
                                      })
                                    : jsx("span", {
                                        className: CLASS.number,
                                        children: optionIndex + 1,
                                      }),
                                  jsx("span", {
                                    className: CLASS.optionCopy,
                                    children: jsxs("span", {
                                      className: CLASS.optionLine,
                                      children: [
                                        jsx("span", {
                                          className: CLASS.optionLabel,
                                          children: display.label,
                                        }),
                                        display.recommended &&
                                          jsx("span", {
                                            className: CLASS.badge,
                                            children: t("option.recommended"),
                                          }),
                                        option.description !== void 0 &&
                                          jsx("span", {
                                            className: CLASS.description,
                                            children: option.description,
                                          }),
                                      ],
                                    }),
                                  }),
                                ],
                              },
                              `${option.label}-${String(optionIndex)}`,
                            );
                          },
                        ),
                        review !== void 0 &&
                          draft.skipped &&
                          jsx("p", {
                            className: CLASS.reviewNote,
                            children: t("review.skipped"),
                          }),
                        (review === void 0 || draft.custom !== "") &&
                          (hasOptions
                            ? jsxs("div", {
                                className: clsx(
                                  CLASS.customRow,
                                  draft.custom !== "" && CLASS.customRowActive,
                                  question.multiSelect !== true && draft.selected.length > 0 && CLASS.customRowYielded,
                                ),
                                children: [
                                  question.multiSelect === true
                                    ? jsx("span", {
                                        className: clsx(CLASS.checkbox, draft.custom !== "" && CLASS.checkboxChecked),
                                        "aria-hidden": "true",
                                        children: draft.custom !== "" && jsx(primitives.IconCheckOutlineRegular, { size: 12 }),
                                      })
                                    : jsx("span", {
                                        className: CLASS.number,
                                        "aria-hidden": "true",
                                        children: jsx(primitives.IconEditOutlineRegular, { size: 12 }),
                                      }),
                                  jsx(AnswerField, {
                                    variant: "inline",
                                    value: draft.custom,
                                    disabled: locked,
                                    placeholder: t("custom.placeholder"),
                                    onChange: draftCustom,
                                    onKeyDown: continueFromCustom,
                                  }),
                                ],
                              })
                            : jsx(AnswerField, {
                                ...answerFieldProps,
                                autoFocus: canSubmit && countdown === void 0 && !locked && !focusedQuestions.current.has(index),
                                onFocus: () => {
                                  focusedQuestions.current.add(index);
                                },
                              })),
                      ],
                    }),
                  ],
                }),
                jsxs("footer", {
                  className: CLASS.footer,
                  children: [
                    jsxs("div", {
                      className: CLASS.pager,
                      children: [
                        jsx("button", {
                          type: "button",
                          className: CLASS.iconButton,
                          "aria-label": t("nav.prev"),
                          disabled: index === 0 || busy !== null,
                          onClick: () => {
                            replaceProgress(index - 1, drafts);
                            setError(null);
                          },
                          children: jsx(primitives.IconChevronLeftOutlineRegular, {}),
                        }),
                        jsxs("span", {
                          className: CLASS.progress,
                          children: [index + 1, " / ", questions.length],
                        }),
                        jsx("button", {
                          type: "button",
                          className: CLASS.iconButton,
                          "aria-label": t("nav.next"),
                          disabled: index === questions.length - 1 || busy !== null,
                          onClick: () => {
                            replaceProgress(index + 1, drafts);
                            setError(null);
                          },
                          children: jsx(primitives.IconChevronRightOutlineRegular, {}),
                        }),
                      ],
                    }),
                    jsx("div", {
                      className: CLASS.feedback,
                      role: "status",
                      children: error === null ? null : "key" in error ? t(error.key) : error.text,
                    }),
                    review === void 0 &&
                      jsxs("div", {
                        className: CLASS.footerActions,
                        children: [
                          jsx(primitives.Button, {
                            variant: "outline",
                            disabled: busy !== null,
                            onClick: skipQuestion,
                            children: t("action.skip"),
                          }),
                          jsx(primitives.Button, {
                            variant: "primary",
                            disabled: busy !== null || !answered(draft) || (index === questions.length - 1 && !canSubmit),
                            onClick: continueFlow,
                            children: busy === "answer" ? t("submitting") : index === questions.length - 1 ? t("submit") : t("action.next"),
                          }),
                        ],
                      }),
                  ],
                }),
              ],
            }),
        ],
      }),
    });
  };
}
