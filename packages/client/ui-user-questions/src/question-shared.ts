/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Phan dung chung cua composer cau hoi: ten lop CSS module, nhan "recommended", kiem nhap da luu, IME va o tra loi tu dong cao
 */

import { clsx } from "./clsx.ts";
import { PACKAGE_NAME } from "./ids.ts";
import type { QuestionDraftAnswer, QuestionDraftProgress } from "./draft-store.ts";
import { injectStyleTag } from "./styles.ts";
import type { JsxRuntime, ReactRuntime, UserQuestionItem } from "./types.ts";

/** CSS của composer do `build.ts` nhúng bằng `define`; chạy từ nguồn (test) thì tra biến toàn cục cùng tên. */
declare const __GBH_QUESTION_COMPOSER_CSS__: string;

/** Tên lớp CSS — GIỮ NGUYÊN hash của bản gốc để DOM không lệch (xem QuestionComposer.module.css). */
export const CLASS = {
  /** Khung ngoài của composer takeover. */
  frame: "Mbwy4a_frame",
  /** Thẻ câu hỏi. */
  card: "Mbwy4a_card",
  /** Thẻ khi thu gọn. */
  cardMinimized: "Mbwy4a_cardMinimized",
  /** Đầu thẻ. */
  header: "Mbwy4a_header",
  /** Nhóm nút ở đầu thẻ. */
  headerActions: "Mbwy4a_headerActions",
  /** Khối tiêu đề. */
  headingBlock: "Mbwy4a_headingBlock",
  /** Nhãn nhỏ phía trên tiêu đề. */
  eyebrow: "Mbwy4a_eyebrow",
  /** Tiêu đề câu hỏi. */
  title: "Mbwy4a_title",
  /** Nút "cứ từ từ". */
  waitButton: "Mbwy4a_waitButton",
  /** Dòng trạng thái chờ. */
  waitStatus: "Mbwy4a_waitStatus",
  /** Vùng cuộn của thân thẻ. */
  body: "Mbwy4a_body",
  /** Chi tiết phụ của câu hỏi. */
  detail: "Mbwy4a_detail",
  /** Danh sách lựa chọn. */
  options: "Mbwy4a_options",
  /** Một lựa chọn. */
  option: "Mbwy4a_option",
  /** Lựa chọn đang được chọn (chọn một). */
  optionSelected: "Mbwy4a_optionSelected",
  /** Ô đánh số thứ tự lựa chọn. */
  number: "Mbwy4a_number",
  /** Ô kiểm của câu hỏi chọn nhiều. */
  checkbox: "Mbwy4a_checkbox",
  /** Ô kiểm đang chọn. */
  checkboxChecked: "Mbwy4a_checkboxChecked",
  /** Phần chữ của lựa chọn. */
  optionCopy: "Mbwy4a_optionCopy",
  /** Dòng nhãn + huy hiệu + mô tả. */
  optionLine: "Mbwy4a_optionLine",
  /** Nhãn lựa chọn. */
  optionLabel: "Mbwy4a_optionLabel",
  /** Huy hiệu "đề xuất". */
  badge: "Mbwy4a_badge",
  /** Mô tả của lựa chọn. */
  description: "Mbwy4a_description",
  /** Ghi chú của bản đọc-lại khi câu hỏi bị bỏ qua. */
  reviewNote: "Mbwy4a_reviewNote",
  /** Hàng "câu trả lời tự nhập" khi có lựa chọn. */
  customRow: "Mbwy4a_customRow",
  /** Hàng tự nhập đang có chữ. */
  customRowActive: "Mbwy4a_customRowActive",
  /** Hàng tự nhập nhường chỗ cho lựa chọn đã chọn (chọn một). */
  customRowYielded: "Mbwy4a_customRowYielded",
  /** Lưới của ô trả lời. */
  field: "Mbwy4a_field",
  /** Bản gương ẩn quyết định chiều cao. */
  fieldMirror: "Mbwy4a_fieldMirror",
  /** Textarea thật. */
  fieldInput: "Mbwy4a_fieldInput",
  /** Ô trả lời kiểu nội tuyến. */
  customInline: "Mbwy4a_customInline",
  /** Ô trả lời kiểu khối. */
  customBlock: "Mbwy4a_customBlock",
  /** Chân thẻ. */
  footer: "Mbwy4a_footer",
  /** Dòng phản hồi. */
  feedback: "Mbwy4a_feedback",
  /** Nhóm nút hành động. */
  footerActions: "Mbwy4a_footerActions",
  /** Cụm phân trang. */
  pager: "Mbwy4a_pager",
  /** Số thứ tự câu hỏi. */
  progress: "Mbwy4a_progress",
  /** Nút biểu tượng. */
  iconButton: "Mbwy4a_iconButton",
} as const;

/** Id gắn vào `data-plugin-css` để không chèn style hai lần. */
const STYLE_TAG_ID = `${PACKAGE_NAME}/QuestionComposer.module.css`;

/** Thẻ đã bị gỡ vẫn có thể còn mount cho tới khi ghế composer cập nhật. */
export const REMOVED_CARD = {
  state: "open",
  waitState: "counting",
  countdown: void 0,
  channel: "none",
  closed: true,
} as const;

/** Sự kiện thay đổi của ô nhập mà composer đọc. */
export interface ChangeEventLike {
  /** Phần tử phát sự kiện, với giá trị hiện tại. */
  readonly target: { readonly value: string };
}

/** Sự kiện bàn phím của ô nhập mà composer đọc. */
export interface KeyEventLike {
  /** Tên phím. */
  readonly key: string;
  /** Có giữ Shift không. */
  readonly shiftKey: boolean;
  /** Sự kiện gốc của trình duyệt. */
  readonly nativeEvent: { readonly isComposing: boolean };
  /** Ngăn hành vi mặc định. */
  preventDefault(): void;
}

/** Sự kiện focus/blur lan trong một phần tử. */
export interface FocusWithinEvent {
  /** Phần tử đang xử lý sự kiện. */
  readonly currentTarget: { contains(other: Node | null): boolean };
  /** Phần tử nhận focus kế tiếp. */
  readonly relatedTarget: EventTarget | null;
}

/** Props của ô trả lời tự lớn. */
export interface AnswerFieldProps {
  /** Kiểu hiển thị: nội tuyến trong hàng lựa chọn, hay khối riêng. */
  readonly variant: "inline" | "block";
  /** Chữ hiện tại. */
  readonly value: string;
  /** Khoá nhập khi đang bận hoặc đang đọc-lại. */
  readonly disabled: boolean;
  /** Tự focus khi mount. */
  readonly autoFocus?: boolean;
  /** Gợi ý trong ô. */
  readonly placeholder: string;
  /** Gọi khi ô nhận focus. */
  readonly onFocus?: () => void;
  /** Gọi khi chữ đổi. */
  readonly onChange: (event: ChangeEventLike) => void;
  /** Gọi khi có phím. */
  readonly onKeyDown: (event: KeyEventLike) => void;
}

/**
 * Chèn CSS của composer nếu chưa có.
 * Nhận: không.
 * Trả: không.
 */
export function injectQuestionComposerStyles(): void {
  injectStyleTag(STYLE_TAG_ID, typeof __GBH_QUESTION_COMPOSER_CSS__ === "string" ? __GBH_QUESTION_COMPOSER_CSS__ : "");
}

/**
 * Tách hậu tố "đề xuất" quen thuộc mà không đổi giá trị câu trả lời.
 * Nhận: label — nhãn gốc của lựa chọn, được trả về nguyên văn nếu được chọn.
 * Trả: nhãn hiển thị kèm trạng thái đề xuất.
 */
export function parseRecommendedLabel(label: string): { label: string; recommended: boolean } {
  const suffix = /\s*(?:\((?:recommended|推荐)\)|（(?:recommended|推荐)）)\s*$/i;
  return suffix.test(label)
    ? {
        label: label.replace(suffix, ""),
        recommended: true,
      }
    : {
        label,
        recommended: false,
      };
}

/**
 * Lựa chọn đầu tiên có đánh dấu "đề xuất" là nháp ngầm; người dùng vẫn phải gửi nó.
 * Nhận: question — câu hỏi cần đọc.
 * Trả: nhãn gốc của lựa chọn đầu khi nó được đánh dấu đề xuất, ngược lại undefined.
 */
export function recommendedFirstOption(question: UserQuestionItem): string | undefined {
  const label = question.options?.[0]?.label;
  return label !== void 0 && parseRecommendedLabel(label).recommended ? label : void 0;
}

/**
 * Chỉ nhận tiến trình đã lưu khi nó còn mô tả đúng lô câu hỏi này.
 * Nhận: value — giá trị đọc từ kho nháp; questionCount — số câu hỏi của lô hiện tại.
 * Trả: true khi `value` là tiến trình dùng được cho lô này.
 */
export function isQuestionDraftProgress(value: unknown, questionCount: number): value is QuestionDraftProgress {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const progress = value as Partial<QuestionDraftProgress>;
  if (
    typeof progress.index !== "number" ||
    !Number.isInteger(progress.index) ||
    progress.index < 0 ||
    progress.index >= questionCount ||
    !Array.isArray(progress.drafts) ||
    progress.drafts.length !== questionCount ||
    (progress.wait !== void 0 && progress.wait !== "editing" && progress.wait !== "waiting")
  )
    return false;
  return progress.drafts.every((item: QuestionDraftAnswer) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    const draft = item as Partial<QuestionDraftAnswer>;
    return (
      Array.isArray(draft.selected) &&
      draft.selected.every((label) => typeof label === "string") &&
      typeof draft.custom === "string" &&
      typeof draft.skipped === "boolean"
    );
  });
}

/**
 * Cho biết một sự kiện phím của ô nhập thuộc một lần gõ IME đang hoạt động.
 * Nhận: event — sự kiện bàn phím của ô nhập.
 * Trả: true khi phím thuộc IME đang ghép chữ.
 */
export function isComposing(event: KeyEventLike): boolean {
  return event.nativeEvent.isComposing || Reflect.get(event.nativeEvent, "keyCode") === 229;
}

/**
 * Dựng ô trả lời tự lớn: textarea thật (để câu trả lời dài tự xuống dòng mềm và Shift+Enter ngắt dòng) đặt
 * trên một bản gương ẩn quyết định chiều cao; cả hai chia sẻ đúng một ô lưới.
 * Nhận: react — runtime React/JSX do bảng module cấp.
 * Trả: component ô trả lời nhận `AnswerFieldProps`.
 */
export function createAnswerField(react: JsxRuntime & ReactRuntime): (props: AnswerFieldProps) => unknown {
  const { jsx, jsxs } = react;
  return function AnswerField(props: AnswerFieldProps): unknown {
    return jsxs("div", {
      className: clsx(CLASS.field, props.variant === "inline" ? CLASS.customInline : CLASS.customBlock),
      children: [
        jsx("div", {
          "aria-hidden": true,
          className: CLASS.fieldMirror,
          children: `${props.value}\n`,
        }),
        jsx("textarea", {
          autoFocus: props.autoFocus,
          className: CLASS.fieldInput,
          value: props.value,
          disabled: props.disabled,
          rows: 1,
          placeholder: props.placeholder,
          onFocus: props.onFocus,
          onChange: props.onChange,
          onKeyDown: props.onKeyDown,
        }),
      ],
    });
  };
}
