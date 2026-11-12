/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kho nhap theo phien cua composer cau hoi (1:1 lib/types/client/draft-store.js) — chi xuat factory, so slot so huu the hien
 */

// Bản gốc lấy `defineStore` từ bảng module (@galaxy-blackhole/gbh-client-store). Bản viết lại nhận ĐÚNG hàm đó
// làm tham số đầu — cùng khuôn các row khác trong repo (createTextStore(defineStore)…) — để bán kính
// typecheck hẹp không phải kéo node_modules của DSH.

/** Một câu trả lời đang soạn, kể cả một lần bỏ qua có chủ ý. */
export interface QuestionDraftAnswer {
  /** Nhãn các lựa chọn đang được chọn. */
  selected: string[];
  /** Câu trả lời tự nhập. */
  custom: string;
  /** Người dùng đã bỏ qua câu hỏi này. */
  skipped: boolean;
}

/** Điều hướng và nháp câu trả lời của một yêu cầu đang chờ. */
export interface QuestionDraftProgress {
  /** Chỉ số câu hỏi hiện tại. */
  index: number;
  /** Mỗi câu hỏi một bản nháp, theo thứ tự yêu cầu. */
  drafts: QuestionDraftAnswer[];
  /** Lựa chọn chờ vô thời hạn, được khôi phục cùng nháp. */
  wait?: "editing" | "waiting";
}

/** Trạng thái kho nháp của composer. */
export interface QuestionDraftState {
  /** Nháp theo khoá yêu cầu. */
  progressByRequest: Record<string, QuestionDraftProgress>;
}

/** Bề mặt ghi của kho nháp. */
export interface QuestionDraftActions {
  /** Ghi đè nháp của một yêu cầu. */
  replace: (draft: QuestionDraftState, requestKey: string, progress: QuestionDraftProgress) => void;
  /** Xoá nháp của một yêu cầu. */
  clear: (draft: QuestionDraftState, requestKey: string) => void;
  /** Giữ lại đúng các khoá còn sống. */
  prune: (draft: QuestionDraftState, keep: readonly string[]) => void;
}

/** Bề mặt ghi đã buộc sẵn khoá yêu cầu (dạng mà PropsStore của framework cấp cho component). */
export interface QuestionDraftBoundActions {
  /** Ghi đè nháp của yêu cầu đang mở. */
  replace: (requestKey: string, progress: QuestionDraftProgress) => void;
  /** Xoá nháp của một yêu cầu. */
  clear: (requestKey: string) => void;
  /** Giữ lại đúng các khoá còn sống. */
  prune: (keep: readonly string[]) => void;
}

/** Handle store mà `defineStore` trả về. */
export interface QuestionDraftStoreHandle {
  /** Tạo một thể hiện (không tham số = scope gốc). */
  create(): unknown;
}

/** Hàm `defineStore` do bảng module cấp (@galaxy-blackhole/gbh-client-store). */
export type DefineStore = (spec: Record<string, unknown>) => QuestionDraftStoreHandle;

/**
 * Khai kho phiên của composer câu hỏi. Nháp sống theo từng phiên, nên rời phiên hoặc khởi động lại Client
 * không xoá mất câu trả lời đang dở.
 * Nhận: defineStore — hàm `defineStore` của bảng module.
 * Trả: handle store đã lưu, thể hiện của nó do sổ slot sở hữu.
 */
export function createQuestionDraftStore(defineStore: DefineStore): QuestionDraftStoreHandle {
  return defineStore({
    init: (): QuestionDraftState => ({ progressByRequest: {} }),
    persist: "dsh.user-questions.drafts.v1",
    actions: {
      replace: (draft: QuestionDraftState, requestKey: string, progress: QuestionDraftProgress) => {
        draft.progressByRequest[requestKey] = progress;
      },
      clear: (draft: QuestionDraftState, requestKey: string) => {
        draft.progressByRequest = Object.fromEntries(Object.entries(draft.progressByRequest).filter(([key]) => key !== requestKey));
      },
      prune: (draft: QuestionDraftState, keep: readonly string[]) => {
        const live = new Set(keep);
        draft.progressByRequest = Object.fromEntries(Object.entries(draft.progressByRequest).filter(([key]) => live.has(key)));
      },
    },
  });
}
