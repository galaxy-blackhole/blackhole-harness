/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Module phụ của row account-platform: trạng thái NỘI BỘ một lần đăng nhập PKCE (view mutable, hồ sơ
 *      cache, toàn bộ attempt), hình dạng lỗi payload, và tiện ích nhận diện hệ điều hành.
 *      Tách khỏi platform.ts để giữ luật ≤1000 dòng/tệp mà không đổi logic.
 *      Export: AttemptViewState · CachedProfile · LoginAttempt · PayloadIssue · PayloadRejection · deviceOsVersion.
 */

import type { ServerResponse } from "node:http";
import { platform, release } from "node:os";
import type {
  AccountDetails,
  SignInAttemptId,
  SignInAttemptView,
  SignInErrorCode,
} from "@deepseek-ai/dsh-deepseek-account";
import type { PlatformHeaders } from "./types.ts";

/**
 * Một issue tối thiểu của zod mà rejectPayload cần để chẩn đoán.
 * Nhận: dữ liệu do zod cấp. Trả: kiểu chỉ-đọc gồm path/code/input.
 */
export interface PayloadIssue {
  readonly path: readonly PropertyKey[];
  readonly code?: string;
  readonly input?: unknown;
}

/**
 * Lỗi kiểm schema tối thiểu, khai theo CẤU TRÚC: chỉ cần danh sách issue.
 * Nhận: lỗi bất kỳ có `issues`. Trả: kiểu chỉ-đọc dùng cho chẩn đoán payload hỏng.
 */
export interface PayloadRejection {
  readonly issues: readonly PayloadIssue[];
}

/**
 * Trạng thái MUTABLE của một lần đăng nhập; bản ra ngoài chỉ là {@link SignInAttemptView} chỉ-đọc.
 * Nhận: giá trị do provider ghi. Trả: kiểu dùng nội bộ khi cập nhật ảnh chụp.
 */
export interface AttemptViewState {
  id: SignInAttemptId;
  phase: SignInAttemptView["phase"];
  authorizeUrl?: string;
  expiresAt?: number;
  errorCode?: SignInErrorCode;
}

/**
 * Hồ sơ đã đọc THÀNH CÔNG, buộc vào đúng token grant đã dùng để đọc.
 * Nhận: token grant và kết cục ready. Trả: kiểu cache danh tính không sống qua lần đổi credential.
 */
export interface CachedProfile {
  token: string;
  profile: Extract<AccountDetails["profile"], { status: "ready" }>;
}

/**
 * Hồ sơ đọc được NGAY từ phản hồi exchange, dùng một lần cho truy vấn hồ sơ kế tiếp.
 * Nhận: token grant vừa cấp và kết cục ready. Trả: kiểu giữ tên trường `value` y bản gốc.
 */
export interface InitialProfile {
  token: string;
  value: Extract<AccountDetails["profile"], { status: "ready" }>;
}

/**
 * Toàn bộ trạng thái một lần đăng nhập PKCE mà provider tự sở hữu.
 * Nhận: provider ghi trong startSignIn/run. Trả: kiểu dùng nội bộ cho flow, huỷ, và dọn callback.
 */
export interface LoginAttempt {
  origin: string;
  loginSource: "web" | "desktop";
  locale: "zh_CN" | "en_US";
  clientHeaders: PlatformHeaders;
  view: AttemptViewState;
  controller: AbortController;
  done: Promise<void>;
  running: Promise<void>;
  callback?: ServerResponse;
  completionUrl?: string;
  disposeCallback?: () => Promise<void>;
  initialProfile?: InitialProfile;
}

/**
 * Nhận diện hệ điều hành, dùng chung cho login và lần đọc danh tính không credential.
 * Nhận: không tham số. Trả: chuỗi "<platform> <release>" của máy đang chạy.
 */
export function deviceOsVersion(): string {
  return `${platform()} ${release()}`;
}
