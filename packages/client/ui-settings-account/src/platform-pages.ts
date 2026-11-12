/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kenh yeu cau trang Platform dung chung cho ca tinh nang tai khoan — HOP DONG DAY DU getSnapshot/subscribe/open/close/dispose
 */

import type { PlatformPageClaim, PlatformPages } from "./contracts.ts";
import type { SnapshotStore, StoreModule } from "./store.ts";

/**
 * Dung kenh yeu cau dung chung cho cac be mat tai khoan va mot host duy nhat ve trang cua chung.
 * Kho anh chup cua vo cung cap observable va co lap nguoi nghe nem loi khoi nhung nguoi con lai.
 *
 * ⚠️ HOP DONG (bai hoc ui-workspace): doi tuong tra ve PHAI co du getSnapshot + subscribe + open + close
 *   + dispose nhu defineStore cua ban goc. Tra thieu getSnapshot ⇒ renderer goi w.getSnapshot() tren
 *   undefined ⇒ TypeError ⇒ CA thanh ben khong render (khong co loi console ro rang).
 * @param storeModule - seed kho cua vo.
 * @returns kenh yeu cau trang Platform.
 */
export function createPlatformPages(storeModule: StoreModule): PlatformPages {
  const store: SnapshotStore<PlatformPageClaim | null> = storeModule.createSnapshotStore<PlatformPageClaim | null>(null);
  let owner: ((reason: string) => void) | undefined;
  let token: object | null = null;
  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: (listener) => store.subscribe(listener),
    /**
     * Mo mot trang; trang dang mo truoc do bi bao "superseded".
     * @param page - ten trang (usage · top-up).
     * @param onClose - ham nhan ly do dong trang.
     * @returns ham nha cua chinh lan mo nay (idempotent).
     */
    open(page: string, onClose: (reason: string) => void): () => void {
      const previous = owner;
      const own = {};
      token = own;
      owner = onClose;
      store.set({ page });
      previous?.("superseded");
      return () => {
        if (token !== own) return;
        token = null;
        owner = undefined;
        store.set(null);
      };
    },
    /** Dong trang dang mo va bao "returned" cho nguoi mo no. */
    close(): void {
      if (store.getSnapshot() === null) return;
      const retiring = owner;
      token = null;
      owner = undefined;
      store.set(null);
      retiring?.("returned");
    },
    /** Dong trang ma khong bao ai — dung luc go plugin. */
    dispose(): void {
      token = null;
      owner = undefined;
      if (store.getSnapshot() === null) return;
      store.set(null);
    },
  };
}

/**
 * Thu hep kenh dung chung thanh lan doc sau khi tro ve cua mot be mat: chi nguoi quay ve tu
 * trang nap tien moi doc lai, nen mot trang bi thay the hoac mot lan go plugin khong kich hoat viec doc.
 * @param pages - kenh yeu cau trang Platform.
 * @param reRead - lan doc sau khi tro ve cua rieng be mat do.
 * @returns ham mo trang ma be mat do tiem vao.
 */
export function createPlatformPageOpener(
  pages: PlatformPages,
  reRead: () => void | Promise<void>,
): (page: string, onClose: (reason: string) => void) => () => void {
  return (page, onClose) =>
    pages.open(page, (reason) => {
      onClose(reason);
      if (reason === "returned" && page === "top-up") void refreshAfterReturn(Promise.resolve(), reRead);
    });
}

/**
 * Cho lan doc truoc khi tro ve xong, roi yeu cau mot anh chup tai khoan moi.
 * @param pending - truy van da chay truoc khi nguoi dung tro ve.
 * @param refresh - nghiep vu doc lai thong thuong cua chu tai khoan.
 * @returns khi truy van moi ket thuc, doc lap voi ket qua cua truy van cu.
 */
export async function refreshAfterReturn(pending: Promise<unknown> | undefined, refresh: () => void | Promise<void>): Promise<void> {
  try {
    await pending;
  } catch {
    /* loi cua truy van cu khong anh huong lan doc moi */
  }
  await refresh();
}
