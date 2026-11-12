/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Panel duyet ke hoach chiem cho composer (1:1 lib/types/client/PlanReviewPanel.js) — hai nut quyet dinh mot ban ke hoach
 */

import { PACKAGE_NAME, PLAN_REVIEW_ACTIONS_SLOT } from "./ids.ts";
import type { PlanReview, QuestionComposerProps } from "./contract.ts";
import type { PendingQuestion } from "./contract.ts";
import type { JsxRuntime, PrimitivesSeam, ReactRuntime, Translate } from "./types.ts";
import { injectStyleTag } from "./styles.ts";

/** CSS của panel do `build.ts` nhúng bằng `define`; chạy từ nguồn (test) thì tra biến toàn cục cùng tên. */
declare const __GBH_PLAN_REVIEW_CSS__: string;

/** Tên lớp CSS — GIỮ NGUYÊN hash của bản gốc để DOM không lệch (xem PlanReviewPanel.module.css). */
export const CLASS = {
  /** Khung ngoài của composer takeover. */
  frame: "LVzXQa_frame",
  /** Thẻ của bản duyệt. */
  card: "LVzXQa_card",
  /** Dải tiêu đề "kế hoạch chờ duyệt". */
  strip: "LVzXQa_strip",
  /** Vùng chứa tiêu đề và mô tả. */
  summary: "LVzXQa_summary",
  /** Tiêu đề (dòng đầu của kế hoạch). */
  title: "LVzXQa_title",
  /** Mô tả (đoạn đầu của kế hoạch). */
  description: "LVzXQa_description",
  /** Hàng chân thẻ. */
  footer: "LVzXQa_footer",
  /** Dòng phản hồi lỗi. */
  feedback: "LVzXQa_feedback",
  /** Nhóm nút quyết định. */
  actions: "LVzXQa_actions",
  /** Nút "yêu cầu sửa". */
  discuss: "LVzXQa_discuss",
  /** Chỗ đặt hành động xem trước do slot con cấp. */
  previewActions: "LVzXQa_previewActions",
} as const;

/** Id gắn vào `data-plugin-css` để không chèn style hai lần. */
const STYLE_TAG_ID = `${PACKAGE_NAME}/PlanReviewPanel.module.css`;

/** Props của panel: bề mặt miền câu hỏi, bản duyệt đã thu hẹp, và ghế copy. */
export type PlanReviewPanelProps = {
  /** Yêu cầu đang chờ. */
  readonly pending: PendingQuestion;
  /** Bản duyệt đã thu hẹp. */
  readonly review: PlanReview;
} & Pick<QuestionComposerProps, "t" | "renderSlot">;

/** Runtime mà panel cần (React hooks + JSX). */
export interface PanelRuntime extends JsxRuntime, ReactRuntime {}

/**
 * Chèn CSS của panel nếu chưa có.
 * Nhận: không.
 * Trả: không.
 */
export function injectPlanReviewStyles(): void {
  injectStyleTag(STYLE_TAG_ID, typeof __GBH_PLAN_REVIEW_CSS__ === "string" ? __GBH_PLAN_REVIEW_CSS__ : "");
}

/**
 * Trải prop tuỳ chọn cho tooltip của nút quyết định: `title` là tuỳ chọn trên props DOM, và
 * `exactOptionalPropertyTypes` từ chối một `undefined` hiện diện.
 * Nhận: description — mô tả của lựa chọn người hỏi, khi có.
 * Trả: prop `title` để trải, hoặc không có gì.
 */
function tooltip(description: string | undefined): Record<string, string> {
  return description === void 0 ? {} : { title: description };
}

/**
 * Dựng panel duyệt kế hoạch.
 * Nhận: react — runtime React/JSX do bảng module cấp; primitives — bề mặt ui-primitives.
 * Trả: component nhận props của renderer và trả composer takeover cho yêu cầu này.
 */
export function createPlanReviewPanel(react: PanelRuntime, primitives: PrimitivesSeam): (props: PlanReviewPanelProps) => unknown {
  /** Lấy các hàm dựng element và khối markdown của runtime. */
  const { jsx, jsxs, useState, useMemo } = react;

  /**
   * Render điều khiển duyệt kế hoạch; tài liệu được gửi đi mở trong sidebar.
   * Nhận: props — bề mặt miền câu hỏi, bản duyệt đã thu hẹp, và `t`.
   * Trả: composer takeover của bản duyệt cho yêu cầu này.
   */
  return function PlanReviewPanel({ pending, review, t, renderSlot }: PlanReviewPanelProps): unknown {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Gửi một quyết định (hoặc yêu cầu sửa) rồi cập nhật trạng thái bận/lỗi.
     * Nhận: send — thao tác gửi; remote — có đang gửi qua đường Remote (câu hỏi đã "continued") không.
     * Trả: không.
     */
    const settle = (send: () => Promise<void>, remote = false): void => {
      setBusy(true);
      setError(null);
      send()
        .then(() => {
          if (!remote) return;
          setBusy(false);
          pending.dismiss().catch(() => {
            setError(t("status.sent"));
          });
        })
        .catch((cause: unknown) => {
          setBusy(false);
          setError(cause instanceof Error ? cause.message : String(cause));
        });
    };

    /**
     * Trả lời câu hỏi duyệt bằng đúng nhãn của lựa chọn.
     * Nhận: label — nhãn lựa chọn (approve hoặc decline).
     * Trả: không.
     */
    const decide = (label: string): void => {
      settle(
        () =>
          pending.answer({
            answers: [
              {
                id: review.id,
                selected: [label],
              },
            ],
          }),
        pending.snapshot().channel === "rpc",
      );
    };

    const summary = useMemo(() => {
      const title = primitives.extractMarkdownPlainText(review.plan, { mode: "first-line" });
      const description = primitives.extractMarkdownPlainText(review.plan, { mode: "first-paragraph" });
      return {
        title,
        description: description === title ? "" : description,
      };
    }, [review.plan]);

    return jsx("div", {
      className: CLASS.frame,
      "data-plan-review-key": pending.key,
      children: jsxs("section", {
        className: CLASS.card,
        "aria-label": review.question,
        "aria-busy": busy,
        children: [
          jsxs("div", {
            className: CLASS.strip,
            children: [
              jsx(primitives.StateDot, { state: busy ? "ongoing" : "warning" }),
              t("plan.header"),
              jsx("div", {
                className: CLASS.previewActions,
                children: renderSlot(PLAN_REVIEW_ACTIONS_SLOT, {
                  review,
                  requestKey: pending.key,
                }),
              }),
            ],
          }),
          jsxs("div", {
            className: CLASS.summary,
            children: [
              jsx("h3", {
                className: CLASS.title,
                children: summary.title,
              }),
              summary.description !== "" &&
                jsx("p", {
                  className: CLASS.description,
                  children: summary.description,
                }),
            ],
          }),
          jsxs("div", {
            className: CLASS.footer,
            children: [
              jsx("div", {
                className: CLASS.feedback,
                role: "status",
                children: error,
              }),
              jsxs("div", {
                className: CLASS.actions,
                children: [
                  jsx(primitives.Button, {
                    variant: "outline",
                    className: CLASS.discuss,
                    icon: jsx(primitives.IconEditOutlineRegular, { size: 14 }),
                    disabled: busy,
                    onClick: () => {
                      settle(() => pending.dismiss());
                    },
                    children: t("plan.discuss"),
                  }),
                  jsx(primitives.Button, {
                    variant: "primary",
                    ...tooltip(review.approve.description),
                    disabled: busy,
                    onClick: () => {
                      decide(review.approve.label);
                    },
                    children: t("plan.approve"),
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
