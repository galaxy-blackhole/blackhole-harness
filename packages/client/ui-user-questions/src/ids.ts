/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bang dinh danh cua row ui-user-questions: id MODULE cua ta, namespace copy, seam inject, slot, su kien Remote va khoa luu nhap
 */

/**
 * Id MODULE chính — package của ta. Bundle tự khai id này trong `__ModuleLoader__.load` (xem build.ts),
 * nên đây là dòng manifest của Host trỏ tới và là `ownerId` để HMR tra `rev`. LUẬT MỘT-ID: artifact chỉ
 * được đăng ký đúng id này, không giữ id của package gốc.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-user-questions";

/** Namespace copy của plugin (giữ nguyên chuỗi của bản gốc — khoá dịch nằm trong locale/*.json). */
export const NS = "question";

/**
 * Seam mà fiber của row cần trước khi `apply` chạy — GIỮ NGUYÊN thứ tự và nội dung của bản gốc:
 * Agent scopes · Remote Events · Remote userQuestions · Session UI · Slot registry · copy · conversation nodes.
 */
export const INJECT = ["sessions", "remote", "remote.userQuestions", "uiSession", "slots", "locale", "uiConversation"] as const;

/** Slot composer mà row này chiếm (ghi thẳng chuỗi tại chỗ đăng ký để `check:rows` đối chiếu được). */
export const COMPOSER_SLOT = "conversation.composer";

/** Slot con (danh sách, phạm vi phiên) chứa hành động cho đúng bản kế hoạch đang được duyệt. */
export const PLAN_REVIEW_ACTIONS_SLOT = "conversation.plan-review.actions";

/** Slot nút của transcript nơi bong bóng trả lời muộn được đăng ký. */
export const CHAT_NODE_SLOT = "conversation.chat.node";

/** Khoá node của bong bóng trả lời muộn trong slot `conversation.chat.node`. */
export const CHAT_NODE_KEY = "question-reply";

/** Sự kiện Remote mà row này tiêu thụ: một yêu cầu hỏi đi qua waterfall. */
export const REQUEST_EVENT = "user-questions/request";

/** Khoá lưu nháp của composer theo phiên (giữ nguyên chuỗi của bản gốc để nháp cũ vẫn đọc được). */
export const DRAFT_STORE_KEY = "dsh.user-questions.drafts.v1";

/** Tên service mà row này `provide` cho các row khác mở lại panel câu hỏi. */
export const PANELS_SERVICE = "userQuestionPanels";

/** Nhãn hiệu ứng vòng đời — giữ nguyên chuỗi của bản gốc để log/chẩn đoán của cordis đối chiếu được. */
export const EFFECT = {
  /** Đăng ký hai bản dịch. */
  dictionaries: "ui-user-questions: dictionaries",
  /** Giải phóng các thẻ câu hỏi khi plugin gỡ. */
  cards: "ui-user-questions: cards",
  /** Gỡ service `userQuestionPanels`. */
  panels: "ui-user-questions: answer panels",
  /** Theo dõi câu hỏi đã được "continued". */
  continued: "ui-user-questions: continued questions",
  /** Giữ chỗ chờ của câu hỏi có hạn (foreground claim). */
  claim: "ui-user-questions: foreground claim",
} as const;

/** Điểm ưu tiên của thẻ trong sổ "pending interaction" (plan-review đứng trước câu hỏi thường). */
export const PRIORITY = {
  /** Thẻ câu hỏi thường. */
  question: 1,
  /** Thẻ duyệt kế hoạch. */
  planReview: 2,
} as const;
