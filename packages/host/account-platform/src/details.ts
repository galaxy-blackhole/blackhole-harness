/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Truy vấn hồ sơ và ví của Platform Web, chiếu về dạng UI tài khoản đọc được: schema user/decimal/wallet/
 *      summary/bonus, phép chiếu hồ sơ, đọc MỘT trường chi tiết, đọc và báo bonus chưa hiển thị.
 *      Export: profile · readAccountDetail · readUnnotifiedBonuses · sendBonusNotified.
 */

import type {
  AccountBonusNotification,
  AccountBonusOrderId,
  AccountDetails,
  AccountProfile,
  AccountUserId,
} from "@deepseek-ai/dsh-deepseek-account/types";
import { z } from "zod/v4";
import {
  AccountUnauthorizedError,
  PlatformAuthError,
  requestAccount,
  requestBonusNotified,
  requestUnnotifiedBonuses,
} from "./protocol.ts";
import type { AccountDetailPath, AccountField, AccountToken, PlatformHeaders } from "./types.ts";

const user = z.object({
  id: z.string().nullish(),
  email: z.string(),
  mobile: z.string().optional(),
  mobile_number: z.string().optional(),
  id_profile: z.object({ name: z.string().nullable(), picture: z.string().nullish() }).nullish(),
});

// Số dư và số tiền đến dưới dạng chuỗi mà client Web của Platform đưa vào big.js, nên văn phạm thập phân
// cũng nhận phần nguyên hoặc phần lẻ bị lược và số mũ thập phân (0E-16, 1e+3).
const decimal = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

const wallet = z.object({
  currency: z.enum(["CNY", "USD"]),
  balance: z.string().regex(decimal),
});

const summary = z.object({ normal_wallets: z.array(wallet), bonus_wallets: z.array(wallet) });

const bonus = z.object({
  order_id: z.uuid(),
  campaign: z.string(),
  amount: z.string().regex(decimal),
  currency: z.enum(["CNY", "USD"]),
  granted_at: z.string(),
  expires_at: z.string(),
  msg: z.string(),
});

// Bộ đọc phản hồi dùng chung đã bóc biz_data, nên payload ở đây chính là danh sách bonus.
const unnotified = z.array(bonus);

/**
 * Chiếu dữ liệu người dùng Platform, không giữ lại credential hay trường thừa.
 * Nhận: `value` là phản hồi user hiện tại hoặc phản hồi đổi mã.
 * Trả: hồ sơ tài khoản cho UI.
 * @throws PlatformAuthError("protocol") khi phản hồi không khớp schema `user`.
 */
export function profile(value: unknown): AccountProfile {
  const parsed = user.safeParse(value);
  if (!parsed.success) throw new PlatformAuthError("protocol");
  return projectProfile(parsed.data);
}

/**
 * Rút bốn trường UI cần từ dữ liệu người dùng đã kiểm.
 * Nhận: `value` là dữ liệu `user` đã qua schema.
 * Trả: hồ sơ với danh tính, ảnh, tên và liên hệ (liên hệ giữ nguyên cách che của Platform).
 */
function projectProfile(value: z.infer<typeof user>): AccountProfile {
  const { email, mobile, mobile_number: mobileNumber, id_profile: identity } = value;
  return {
    id: value.id == null ? null : (value.id as AccountUserId),
    avatarUrl: identity?.picture || null,
    name: identity?.name || null,
    contact: mobile || mobileNumber || email || null,
  };
}

/**
 * Kiểm một payload chi tiết bằng schema của nó, ghi chẩn đoán không bí mật khi hỏng.
 * Nhận: `schema` là schema zod của trường; `value` là payload thô; `field` là tên trường để ghi log.
 * Trả: payload đã kiểm.
 * @throws PlatformAuthError("protocol") khi payload không khớp schema.
 */
function accountPayload<T>(schema: z.ZodType<T>, value: unknown, field: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    console.error(`[deepseek-account] ${field} schema rejected`, {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
    });
    throw new PlatformAuthError("protocol");
  }
  return parsed.data;
}

const queries: {
  readonly [K in AccountField]: {
    readonly path: AccountDetailPath;
    readonly parse: (value: unknown) => AccountDetails[K];
  };
} = {
  profile: {
    path: "/auth-api/v0/users/current",
    parse: (value) => ({
      status: "ready",
      value: projectProfile(accountPayload(user, value, "profile")),
    }),
  },
  balance: {
    path: "/api/v0/users/get_user_summary",
    parse: (value) => {
      const parsed = accountPayload(summary, value, "balance");
      return {
        status: "ready",
        value: parsed.normal_wallets,
        bonusWallets: parsed.bonus_wallets,
      };
    },
  },
};

/**
 * Đọc MỘT trường tài khoản Platform mà không chờ trường kia.
 * Nhận: `field` là `profile` hoặc `balance`; `origin` khớp issuer của grant đang lưu; `token` là token uỷ
 * quyền đang lưu (token trong phản hồi bị bỏ); `signal` là đời sống request và credential; `headers` là
 * header deployment của origin đã cấu hình.
 * Trả: kết cục đã làm sạch; hỏng không bao giờ thành số dư 0.
 * @throws AccountUnauthorizedError khi Platform từ chối token đang lưu bằng HTTP 401 hoặc mã 40003.
 */
export async function readAccountDetail<K extends AccountField>(
  field: K,
  origin: string,
  token: AccountToken,
  signal: AbortSignal,
  headers: PlatformHeaders,
): Promise<AccountDetails[K]> {
  const query = queries[field];
  try {
    return query.parse(await requestAccount(origin, query.path, token, signal, headers));
  } catch (error) {
    if (error instanceof AccountUnauthorizedError) throw error;
    return { status: "failed" } as AccountDetails[K];
  }
}

/**
 * Đọc danh sách bonus chưa báo cho MỘT credential đã bắt.
 * Nhận: `origin` khớp issuer của grant đang lưu; `token` là grant đã bắt (bên gọi đã buộc nó vào tài khoản);
 * `signal` là đời sống credential và hạn request; `headers` là header deployment + danh tính client.
 * Trả: thông báo theo đúng thứ tự Platform; payload sai là hỏng giao thức.
 */
export async function readUnnotifiedBonuses(
  origin: string,
  token: AccountToken,
  signal: AbortSignal,
  headers: PlatformHeaders,
): Promise<readonly AccountBonusNotification[]> {
  const parsed = accountPayload(unnotified, await requestUnnotifiedBonuses(origin, token, signal, headers), "bonus");
  return parsed.map((row) => ({
    orderId: row.order_id as AccountBonusOrderId,
    campaign: row.campaign,
    amount: row.amount,
    currency: row.currency,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    message: row.msg,
  }));
}

/**
 * Ghi nhận MỘT bonus đã hiển thị là đã báo, bằng chính credential đã đọc nó.
 * Nhận: `origin` khớp issuer của grant đang lưu; `token` là grant đã bắt (bên gọi đã buộc nó vào tài khoản);
 * `orderId` là đơn bonus người dùng đã thấy; `signal` là đời sống credential và hạn request; `headers` là
 * header deployment + danh tính client.
 * Trả: xong khi Platform ghi nhận; hỏng HTTP và hỏng nghiệp vụ đều ném lỗi.
 */
export async function sendBonusNotified(
  origin: string,
  token: AccountToken,
  orderId: AccountBonusOrderId,
  signal: AbortSignal,
  headers: PlatformHeaders,
): Promise<void> {
  await requestBonusNotified(origin, token, orderId, signal, headers);
}