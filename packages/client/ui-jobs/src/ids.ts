/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bang dinh danh cua row ui-jobs: id MODULE (vao bang module) tach han id SLOT OCCUPANT
 */

/**
 * Id MODULE chinh — package cua ta. Day la id bundle tu khai trong __ModuleLoader__.load,
 * nen no la dong ma manifest cua Host tro toi va la ownerId ma HMR tra rev.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-jobs";

/**
 * Id package GOC cua DSH — chi de DOI CHIEU: no nam o `gbh.row.aliases` trong package.json va tang nap
 * TU sinh entry alias, nen bundle phu thuoc require(id goc) van tim thay module.
 * Bundle cua ta KHONG dang ky id nay (MOT bundle MOT id): dang ky them ⇒ bundle chay hai lan ⇒
 * duplicate factory registration.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-jobs";

/**
 * Id SLOT OCCUPANT cua nut trong slot conversation.session.header.actions — KHONG phai id module.
 * No chi dinh danh nguoi ngoi trong slot; giu nguyen nhu ban goc de hang dau session doi chieu duoc.
 */
export const SLOT_OCCUPANT_ID = "job-list";

/** Thu tu cua occupant trong slot; ban goc xep 20. */
export const SLOT_ORDER = 20;

/** Khoa locale ma slot nay dung (xem src/locales.ts). */
export const LOCALE_KEY = "job";
