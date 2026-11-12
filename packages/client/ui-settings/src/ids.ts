/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang dinh danh cua row ui-settings: id module (HAI id) + namespace rieng cua row
 */

/**
 * Id MODULE chinh — package cua ta. Day la dong ma manifest cua Host tro toi, va la ownerId ma HMR
 * tra rev.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings";

/**
 * Id MODULE phu — package goc cua DSH.
 *
 * PHAI dang ky: 23 goi khac inject row nay qua TEN GOI GOC (vi du dsh-client-ui-conversation co
 * dsh.client.inject chua "@galaxy-blackhole/gbh-client-ui-settings"), nen bang module phai co id stock
 * thi chung moi resolve duoc. Khuon nay da duoc kiem chung trong nha: ui-layout (12 phu thuoc) va
 * ui-sidebar, ui-session deu dang ky hai id va dang chay that.
 *
 * An toan vi row stock da bi khoi patch cua ta TAT (disabled: true) => khong co ban dang ky thu hai.
 * Su co connection la ca KHAC: row stock con bat nen moi trung that.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-settings";

/**
 * Namespace cua chinh row nay (tuy chon developer tools). Giu nguyen chuoi cua ban goc de
 * Settings/config-editor cua kernel tim thay dung muc.
 */
export const DEVELOPER_TOOLS_NAMESPACE = "ui-settings";
