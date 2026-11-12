/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Trang thai khong giao dien cua hop thoai phan hoi — mot bieu mau, hai dich
 */

import { createSnapshotStore, type SnapshotStore } from "./store";
import type { FeedbackCategory, MessageFeedbackActionResult, MessageFeedbackRating } from "./controller";

/** Dich ma mot lan gui se ghi vao: ca phien, hoac mot tin nhan voi danh gia da chon. */
export type FeedbackDialogTarget =
  | { readonly kind: "session" }
  | { readonly kind: "message"; readonly messageId: string; readonly rating: MessageFeedbackRating };

/** Ban nhap cua hop thoai. */
export interface FeedbackDraft {
  /** Giai thich tuy chon (da cat khoang trang o dau/cuoi). */
  readonly text?: string;
  /** Phan loai tuy chon. */
  readonly category?: FeedbackCategory;
}

/** Anh chup ma muc overlay doc de ve hop thoai va cac toast. */
export interface FeedbackDialogState {
  /** Dich dang mo, hoac null khi hop thoai dong. */
  readonly target: FeedbackDialogTarget | null;
  /** Phan loai dang chon, hoac null. */
  readonly category: FeedbackCategory | null;
  /** Ban nhap dang go. */
  readonly text: string;
  /** Dang gui. */
  readonly submitting: boolean;
  /** Ma that bai cua lan gui gan nhat, hoac null. */
  readonly failure: string | null;
  /** So thu tu cua toast dang hien (0 = khong co). */
  readonly toast: number;
}

/** Ham gui mot ban nhap toi Host, do chu so huu dinh tuy theo dich. */
export type FeedbackSubmit = (target: FeedbackDialogTarget, entry: FeedbackDraft) => Promise<MessageFeedbackActionResult>;

/** Trang thai dong: khong dich, khong nhap, khong toast. */
const CLOSED = {
  target: null,
  category: null,
  text: "",
  submitting: false,
  failure: null,
} as const;

/**
 * Tang hop thoai cua MOT phien: mot bieu mau phuc vu hai dich (ca phien khi go /feedback, va mot tin
 * nhan khi bam Like/Dislike). Ban viet lai trung thanh cua `FeedbackDialogController` trong ban goc.
 */
export class FeedbackDialogController {
  /** Ham gui ban nhap; chu so huu dinh tuy theo dich. */
  private readonly submit: FeedbackSubmit;
  /** Kho anh chup ma muc overlay dang ky nghe. */
  readonly state: SnapshotStore<FeedbackDialogState>;
  /** Tang moi lan mo/dong/huy de mot ket qua ve muon biet ban nhap cua no da bien mat. */
  private generation = 0;
  /** So thu tu toast. */
  private toastSeq = 0;

  /**
   * Nhan: submit — ham ghi mot lan gui.
   * Tra: doi tuong tang.
   */
  constructor(submit: FeedbackSubmit) {
    this.submit = submit;
    this.state = createSnapshotStore<FeedbackDialogState>({ ...CLOSED, toast: 0 });
  }

  /**
   * Mo hop thoai voi ban nhap rong, thay moi ban nhap dang mo.
   * Nhan: target — dich ma lan gui se ghi vao.
   * Tra: khong co.
   */
  open(target: FeedbackDialogTarget): void {
    this.generation += 1;
    this.state.set({ ...CLOSED, target, toast: this.state.getSnapshot().toast });
  }

  /**
   * Dong hop thoai va bo ban nhap; toast dang hien van o lai.
   * Nhan: khong co.
   * Tra: khong co.
   */
  dismiss(): void {
    this.generation += 1;
    this.state.set({ ...CLOSED, toast: this.state.getSnapshot().toast });
  }

  /**
   * Thay mot phan ban nhap khi con sua duoc.
   * Nhan: draft — phan loai (null de bo chon) hoac van ban nguoi dung go.
   * Tra: khong co.
   */
  edit(draft: Partial<Pick<FeedbackDialogState, "category" | "text">>): void {
    const s = this.state.getSnapshot();
    if (s.target === null || s.submitting) return;
    this.state.set({ ...s, ...draft });
  }

  /**
   * Gui ban nhap; ban nhap rong van la mot lan gui hop le.
   * Nhan: khong co.
   * Tra: sau khi lan gui da chot.
   */
  async submitDraft(): Promise<void> {
    const s = this.state.getSnapshot();
    if (s.target === null || s.submitting) return;
    const generation = this.generation;
    this.state.set({ ...s, submitting: true, failure: null });
    const text = s.text.trim();
    const result = await this.submit(s.target, {
      ...(text.length === 0 ? {} : { text }),
      ...(s.category === null ? {} : { category: s.category }),
    });
    if (result.ok) {
      if (generation === this.generation) this.dismiss();
      this.acknowledge();
      return;
    }
    if (generation !== this.generation) return;
    this.state.set({ ...this.state.getSnapshot(), submitting: false, failure: result.error.code, toast: 0 });
  }

  /**
   * Tat toast that bai ma khong dong ban nhap cua no.
   * Nhan: khong co.
   * Tra: khong co.
   */
  dismissFailure(): void {
    this.state.set({ ...this.state.getSnapshot(), failure: null });
  }

  /**
   * Hien toast xac nhan; toast dang hien thi bat dau lai.
   * Nhan: khong co.
   * Tra: khong co.
   */
  acknowledge(): void {
    this.toastSeq += 1;
    this.state.set({ ...this.state.getSnapshot(), toast: this.toastSeq });
  }

  /**
   * Retire mot toast sau khi no mo dan; toast moi hon duoc de yen.
   * Nhan: seq — so thu tu toast ma giao dien da hien xong.
   * Tra: khong co.
   */
  dismissToast(seq: number): void {
    const s = this.state.getSnapshot();
    if (s.toast === seq) this.state.set({ ...s, toast: 0 });
  }

  /**
   * Don dep khi fiber go xuong: bo ban nhap va toast, de ket qua dang bay mo coi.
   * Nhan: khong co.
   * Tra: khong co.
   */
  dispose(): void {
    this.generation += 1;
    this.state.set({ ...CLOSED, toast: 0 });
  }
}
