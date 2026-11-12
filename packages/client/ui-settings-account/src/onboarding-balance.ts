/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc So du dung cho buoc nap tien cua gioi thieu Desktop: gom ca vi nap va vi thuong
 */

import type { BalanceValue } from "./contracts.ts";

/**
 * Kiem tra tin dung mua va tin dung thuong ma khong coi truy van dang cho la 0.
 * @param balance - ket qua so du tai khoan hien tai.
 * @returns true khi mot trong hai nhom vi co tin dung duong.
 */
export function hasOnboardingCredit(balance: BalanceValue | undefined): boolean {
  if (balance?.status !== "ready") return false;
  const wallets = [...(balance.value ?? []), ...(balance.bonusWallets ?? [])];
  return wallets.some((wallet) => positive(wallet.balance));
}

/**
 * Chuoi so du co phai so duong khong (thay Big(wallet.balance).gt(0) cua ban goc).
 * @param amount - chuoi so thap phan.
 * @returns true khi lon hon 0.
 */
function positive(amount: string): boolean {
  const trimmed = amount.trim().replace(/^[+-]/, "");
  return /[1-9]/.test(trimmed);
}

/** Kieu so du ma buoc nap tien doc — nguyen van hinh dang cua Host. */
export type OnboardingBalance = BalanceValue;
