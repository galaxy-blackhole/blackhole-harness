/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tra tu trang thai khung nhin da giu khi tab dong hoac plugin bi go
 */

/** Mot lan tra tu da dang ky, khoa theo tin hieu vong doi cua tab. */
type Dispose = () => void;

/**
 * Giai phong trang thai khung nhin da giu khi tab dong hoac plugin bi go.
 * Nhan: ctx — context cua plugin so huu ban xem.
 * Tra: callback nhan tab, tin hieu vong doi cua no, va action forget cua store; nhieu lan giu chia mot listener.
 */
export function retainDocumentTabs(ctx: { effect(callback: () => unknown, label?: string): unknown }): (tabId: string, signal: AbortSignal, forgetTab: (tabId: string) => void) => void {
  const retained = new Map<AbortSignal, Dispose>();
  ctx.effect(() => () => {
    for (const forget of retained.values()) forget();
  });
  return (tabId, signal, forgetTab) => {
    if (signal.aborted) {
      forgetTab(tabId);
      return;
    }
    if (retained.has(signal)) return;
    const forget = (): void => {
      signal.removeEventListener("abort", forget);
      retained.delete(signal);
      forgetTab(tabId);
    };
    retained.set(signal, forget);
    signal.addEventListener("abort", forget, { once: true });
  };
}
