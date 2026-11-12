/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bo loc su kien be mat cua phien — nguyen van ban goc cua DSH (core/session surface)
 */

import { isRecord } from "./util.ts";

/** Cac loai su kien duoc phep xuat hien tren be mat hoi thoai. */
const SURFACE_EVENT_TYPES = new Set([
  "system/message",
  "developer/message",
  "user/message",
  "assistant/message",
  "tool/result",
]);

/**
 * Thu hep mot su kien thanh su kien du dieu kien be mat va co dau hieu bat buoc.
 * Nhan: event — su kien can xet.
 * Tra: true khi ca loai lan dau hieu deu xac dinh mot su kien be mat.
 */
export function isSurfaceEvent(event: unknown): boolean {
  if (!isRecord(event)) return false;
  if (!SURFACE_EVENT_TYPES.has(event["type"] as string)) return false;
  return event["surfaceOp"] !== undefined;
}

/**
 * Thu hep mot su kien thanh su kien be mat goc-them: su kien vao be mat ngay tai vi tri
 * cua no trong nhat ky va khong bao gio la ban sao thay the.
 *
 * Be mat ma mo hinh nhin thay co y che cac doan da bi thay the, nen no la nguon SAI cho
 * bang hoi thoai cua nguoi dung — mot lan thay the da den se xoa mat hoi thoai nguoi dung
 * da doc. Su kien goc-them moi la nguyen lieu ben vung cua bang do.
 * Nhan: event — su kien can xet.
 * Tra: true khi su kien duoc them vao duoi be mat.
 */
export function isAppendSurfaceEvent(event: unknown): boolean {
  return isSurfaceEvent(event) && isRecord(event) && event["surfaceOp"] === "append";
}
