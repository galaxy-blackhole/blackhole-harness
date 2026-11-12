/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row product-analytics — mot id module, mot ten service, hai nua dung chung
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-product-analytics";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio dang ky trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-product-analytics";

/**
 * Ten row trong cordis (giu nguyen ten ban goc nen patch va inject khong doi).
 * Nhan: khong co.
 * Tra: chuoi ten row.
 */
export const ROW_NAME = "product-analytics";

/**
 * Ten service cua ca HAI nua: nua host dang ky service cordis nay (kem namespace Remote cung ten),
 * nua browser phoi service cung ten cho cac row khac goi track(). Nguyen van tu bundle goc.
 * Nhan: khong co.
 * Tra: chuoi ten service.
 */
export const SERVICE_NAME = "productAnalytics";

/**
 * Danh sach inject cua nua browser — NGUYEN VAN tu bundle goc: service remote + namespace cua row nay.
 * Nhan: khong co.
 * Tra: mang ten service ma fiber phia trang phai cho.
 */
export const CLIENT_INJECT: readonly string[] = ["remote", "remote.productAnalytics"];

/**
 * Danh sach inject cua nua host.
 *
 * KHAC BAN GOC CO Y (mot dong, co ghi ly do): ban goc inject [deepseekAccount, productTelemetry].
 * Trong profile khong phai desktop (blackhole · web), row desktop-product-telemetry — nguon DUY NHAT cua
 * service productTelemetry — bi TAT (disabled: !!js ctx.get(profileContext)?.name !== desktop), nen giu
 * productTelemetry trong inject TINH se lam entry nay PENDING VINH VIEN: service productAnalytics khong bao
 * gio duoc dang ky ⇒ namespace remote.productAnalytics khong ton tai ⇒ nua browser cung pending ⇒ dong
 * entries did not activate. Vi vay: cho service THAT SU phu thuoc (deepseekAccount), con telemetry tra bang
 * ctx.get luc GOI (thieu thi bo qua, khong nem) — xem report() trong service.ts.
 * Nhan: khong co.
 * Tra: mang ten service ma fiber phia host phai cho.
 */
export const HOST_INJECT: readonly string[] = ["deepseekAccount"];

/**
 * Ten luong policy ma nua browser mo qua remote.$stream (nguyen van tu bundle goc; dung cho chan doan).
 * Nhan: khong co.
 * Tra: chuoi ten luong.
 */
export const POLICY_STREAM_NAME = "product analytics policy";

/**
 * Cau bao ket thuc luong policy (nguyen van tu bundle goc; nua browser dung lam ly do dong luong).
 * Nhan: khong co.
 * Tra: chuoi thong bao.
 */
export const POLICY_STREAM_ENDED = "product analytics policy stream ended";

/**
 * Ten namespace Remote cua row — phai bang SERVICE_NAME de nua browser co dung service remote.productAnalytics.
 * Nhan: khong co.
 * Tra: chuoi ten namespace.
 */
export const REMOTE_NAMESPACE = "productAnalytics";
