/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nua host cua row ui-conversation — luoc do cai dat Conversation (busyEnter), nguyen hanh vi ban goc
 */

import z from "@deepseek-ai/schemastery";

/**
 * Namespace cai dat do plugin Conversation so huu — NGUYEN VAN ban goc lib/index.js.
 * Nhan: khong co.
 * Tra: chuoi namespace.
 */
export const CONVERSATION_SETTINGS_NAMESPACE = "ui-conversation";

/**
 * Ten truong mang che do gui khi nhan Enter don trong luc agent dang ban — NGUYEN VAN ban goc.
 * Nhan: khong co.
 * Tra: chuoi ten truong.
 */
export const BUSY_ENTER_FIELD = "busyEnter";

/**
 * Cac che do busy-Enter duoc chap nhan o bien cai dat va bien dau vao — NGUYEN VAN ban goc.
 * Nhan: khong co.
 * Tra: mang hai chuoi che do.
 */
export const BUSY_ENTER_BEHAVIORS: readonly ["queue", "steer"] = ["queue", "steer"];

/**
 * Mac dinh giu Enter-la-Xep-hang cho hoi thoai dang chay — NGUYEN VAN ban goc.
 * Nhan: khong co.
 * Tra: chuoi che do mac dinh.
 */
export const DEFAULT_BUSY_ENTER_BEHAVIOR: "queue" | "steer" = "queue";

/**
 * Luoc do Conversation ben vung; cung la phong bi wire ma pham vi trinh duyet kiem chung.
 * Nhan: khong co.
 * Tra: doi tuong truong cua luoc do.
 */
export const ConversationSettingsFields = {
  [BUSY_ENTER_FIELD]: z.union([...BUSY_ENTER_BEHAVIORS]).default(DEFAULT_BUSY_ENTER_BEHAVIOR),
};

/**
 * Tuy chon song duoc chieu sang trinh duyet — NGUYEN VAN ban goc (truong busyEnter o dang volatile).
 * Nhan: khong co.
 * Tra: luoc do cau hinh cua plugin.
 */
export const Config = z.object({
  [BUSY_ENTER_FIELD]: ConversationSettingsFields[BUSY_ENTER_FIELD].volatile(),
});
