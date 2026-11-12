/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Từ điển namespace secretMask cho nút hiện/che một credential
 */

/** Namespace từ điển do plugin này sở hữu. */
export const NS = "secretMask";

/** Bản tiếng Trung giản thể — nguồn đúng của tập khoá. */
export const zh = {
  "secret.reveal": "显示密钥",
  "secret.hide": "隐藏密钥",
} as const;

/** Khoá của namespace secretMask. */
export type SecretMaskKey = keyof typeof zh;

/** Bản tiếng Anh, đã đối chiếu đủ khoá với bản tiếng Trung. */
export const en: Record<SecretMaskKey, string> = {
  "secret.reveal": "Show secret",
  "secret.hide": "Hide secret",
};
