/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Router cua composer takeover (1:1 QuestionComposer cua ban goc): mot entry, hai cach trinh bay — luong cau hoi thuong hoac the duyet ke hoach
 */

import { planReviewOf, type PendingQuestion, type QuestionComposerProps } from "./contract.ts";
import { createPlanReviewPanel, injectPlanReviewStyles } from "./plan-review-panel.ts";
import type { PanelRuntime } from "./plan-review-panel.ts";
import { createQuestionFlow } from "./question-flow.ts";
import { injectQuestionComposerStyles } from "./question-shared.ts";
import type { PrimitivesSeam } from "./types.ts";

export { parseRecommendedLabel } from "./question-shared.ts";
export type { QuestionAnswer, PendingQuestion, PlanReview, QuestionComposerProps, QuestionWait } from "./contract.ts";
export type { QuestionKey } from "./locales.ts";

/**
 * Dựng router composer takeover: nháp của câu hỏi thường sống trong kho Slot theo phiên của entry này, khoá
 * theo carrier đang chờ, nên một lần mount lại entry của Session khôi phục đúng yêu cầu đó mà không lộ nó
 * sang phiên khác.
 *
 * Một takeover, hai cách trình bày: yêu cầu khai ý định trình bày mà package này render thì dùng cách trình
 * bày đó (duyệt kế hoạch là một quyết định trên một bản kế hoạch, không phải một lô câu hỏi), mọi yêu cầu
 * khác đi luồng câu hỏi thường. Việc định tuyến nằm ở đây, tại đúng entry sở hữu ghế composer, nên không
 * cách trình bày nào nhận được yêu cầu mà cách kia đang render.
 *
 * Nhận: react — runtime React/JSX do bảng module cấp; primitives — bề mặt ui-primitives.
 * Trả: component nhận props của renderer và trả luồng câu hỏi, hoặc bề mặt của ý định, cho yêu cầu này.
 */
export function createQuestionComposer(react: PanelRuntime, primitives: PrimitivesSeam): (props: QuestionComposerProps) => unknown {
  const { jsx, useMemo } = react;
  injectQuestionComposerStyles();
  injectPlanReviewStyles();
  const QuestionFlow = createQuestionFlow(react, primitives);
  const PlanReviewPanel = createPlanReviewPanel(react, primitives);

  /**
   * Chọn cách trình bày cho yêu cầu đang khớp và khoá React theo khoá của carrier.
   * Nhận: props — carrier câu hỏi đã khớp cùng bộ chuẩn của framework.
   * Trả: luồng câu hỏi, hoặc bề mặt của ý định, cho yêu cầu này.
   */
  return function QuestionComposer(props: QuestionComposerProps): unknown {
    const question: PendingQuestion = props.matched;
    const review = useMemo(() => planReviewOf(question.questions), [question]);
    return review === void 0
      ? jsx(
          QuestionFlow,
          {
            pending: question,
            t: props.t,
            useStore: props.useStore,
            useQuestionCard: props.useQuestionCard,
            actions: props.actions,
          },
          question.key,
        )
      : jsx(
          PlanReviewPanel,
          {
            pending: question,
            review,
            t: props.t,
            renderSlot: props.renderSlot,
          },
          question.key,
        );
  };
}
