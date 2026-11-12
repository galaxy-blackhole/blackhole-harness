/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang hoi khach hang: dung dia chi ngoai khong kem thong tin xac thuc, kem tuy chon cong khai do Host phat
 */

import type { ContactConfig } from "./contracts.ts";

/** Dia chi bang hoi mac dinh — nguyen van ban goc. */
export const DEFAULT_CONTACT_FORM_URL = "https://trtgsjkv6r.feishu.cn/share/base/form/shrcnlCoGElW7MQznGy9r3YYXcg?hide_uid=1&hide_device_info=1&hide_harness_version=1";

/** Do tre thu lai xac nhan thuong mac dinh (ms) — ban goc dung 1e3. */
export const DEFAULT_BONUS_ACK_RETRY_DELAY_MS = 1000;

/** Tran do tre thu lai xac nhan thuong mac dinh (ms) — ban goc dung 6e4. */
export const DEFAULT_BONUS_ACK_RETRY_MAX_DELAY_MS = 60000;

/**
 * Doc tuy chon bang hoi tu payload Host phat, ap dung dung mac dinh cua ban goc.
 *
 * ⚠️ Khac biet CO Y so voi ban goc: ban goc validate bang schemastery (Schema.object) va bundle
 * ca schemastery vao nua client; o day nua client KHONG nhung schemastery nua ma kiem tung truong
 * theo dung luat cua schema goc (pattern https + min(1)), sai thi roi ve mac dinh.
 * @param payload - gia tri toan cuc __GBH_CONTACT_CONFIG__ (co the khong phai object).
 * @returns tuy chon da kiem.
 */
export function resolveContactConfig(payload: unknown): ContactConfig {
  const source = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const url = typeof source["contactFormUrl"] === "string" && /^https:\/\/[^/\s]+\//.test(source["contactFormUrl"]) ? source["contactFormUrl"] : DEFAULT_CONTACT_FORM_URL;
  const contactSource = typeof source["contactSource"] === "string" ? source["contactSource"] : "";
  const delay = typeof source["bonusAckRetryDelayMs"] === "number" && source["bonusAckRetryDelayMs"] >= 1 ? source["bonusAckRetryDelayMs"] : DEFAULT_BONUS_ACK_RETRY_DELAY_MS;
  const maxDelay = typeof source["bonusAckRetryMaxDelayMs"] === "number" && source["bonusAckRetryMaxDelayMs"] >= 1 ? source["bonusAckRetryMaxDelayMs"] : DEFAULT_BONUS_ACK_RETRY_MAX_DELAY_MS;
  return { contactFormUrl: url, contactSource, bonusAckRetryDelayMs: delay, bonusAckRetryMaxDelayMs: maxDelay };
}

/** Thong tin tai khoan, ban dung va moi truong ma nguoi goi lay mau. */
export interface ContactContext {
  /** Ma nguoi dung, null khi chua doc duoc. */
  readonly uid: string | null;
  /** Phien ban ban dung. */
  readonly version: string;
  /** Chieu rong cua so (CSS px). */
  readonly width: number;
  /** Chieu cao cua so (CSS px). */
  readonly height: number;
  /** Ti le diem anh. */
  readonly pixelRatio: number;
  /** Mo ta thiet bi do vo Desktop doc. */
  readonly deviceInfo?: string;
}

/**
 * Dung dia chi bang hoi ngoai khong kem thong tin xac thuc.
 * @param config - dich den bang hoi va nhan nguon.
 * @param context - thong tin tai khoan, ban dung va moi truong.
 * @returns dia chi bang hoi voi cac truong ngu canh an san.
 */
export function contactUrl(config: ContactConfig, context: ContactContext): string {
  const url = new URL(config.contactFormUrl);
  const ratio = Number.isFinite(context.pixelRatio) ? context.pixelRatio : 1;
  const width = Math.round(context.width * ratio);
  const height = Math.round(context.height * ratio);
  const deviceInfo = [context.deviceInfo];
  if (width > 0 && height > 0) deviceInfo.push("screen_resolution=" + width + "x" + height);
  const fields: Record<string, string | null> = {
    uid: context.uid,
    source: config.contactSource,
    harness_version: context.version,
    device_info: deviceInfo.filter(Boolean).join("; "),
  };
  for (const [name, value] of Object.entries(fields)) {
    url.searchParams.set("hide_" + name, "1");
    url.searchParams.delete("prefill_" + name);
    if (value) url.searchParams.set("prefill_" + name, value);
  }
  for (const name of ["os_version", "device_brand", "app_locale", "screen_resolution", "app_version", "device_model"]) {
    url.searchParams.delete("prefill_" + name);
    url.searchParams.delete("hide_" + name);
  }
  return url.href;
}
