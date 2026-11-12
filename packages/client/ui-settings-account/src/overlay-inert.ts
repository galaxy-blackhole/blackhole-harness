/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chu so huu inert dung chung cho cac lop phu chong nhau cua tai khoan
 */

/** Mot nguoi dang giu inert tren mot phan tu. */
interface InertState {
  /** So nguoi dang giu. */
  count: number;
  /** Gia tri inert truoc khi co nguoi dau tien giu. */
  previous: boolean;
}

/** Chu so huu inert theo phan tu — ban goc dung WeakMap o pham vi module. */
const owners = new WeakMap<HTMLElement, InertState>();

/**
 * Tat tuong tac voi nen cho toi khi moi lop phu tai khoan nha phan tu ra.
 * @param element - phan tu nen bi lop phu che.
 * @returns ham nha idempotent, tra lai trang thai inert goc sau nguoi giu cuoi cung.
 */
export function acquireOverlayInert(element: HTMLElement): () => void {
  const state = owners.get(element) ?? { count: 0, previous: element.inert };
  state.count++;
  owners.set(element, state);
  element.inert = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--state.count === 0) {
      element.inert = state.previous;
      owners.delete(element);
    }
  };
}
