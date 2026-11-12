/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Phần KHAI BÁO dùng chung của provider tài khoản Platform (tách khỏi platform.ts 08/11/2026 để giữ luật
 *      ≤1000 dòng/tệp): khoá credential, schema grant/device, và SEAM CẤU TRÚC của miền authorization (ADR 000d
 *      — PHASE B): thay cho thuộc tính augment \`ctx.authorization\` của bản stock nên đổi import sang id GBH
 *      không còn mất augmentation (TS2339) mà vẫn fail loud khi thiếu seam.
 */
import type { AuthorizationSession } from "@galaxy-blackhole/gbh-authorization";
import { credentialKey } from "@deepseek-ai/dsh-credentials";
import { z } from "zod/v4";

/** Khoá credential của grant tài khoản Platform (giữ NGUYÊN VĂN scope/id như bản gốc). */
export const KEY = credentialKey("deepseek-account-platform", "default");

/** Khoá credential của danh tính thiết bị bền (giữ NGUYÊN VĂN scope/id như bản gốc). */
export const DEVICE = credentialKey("deepseek-account-platform", "device");

/** Grant đã lưu: phiên bản 1, token opaque, issuer đã được kiểm lúc đọc. */
export const grant = z.object({
  version: z.literal(1),
  token: z.string().min(1),
  issuer: z.url(),
});

/** Danh tính thiết bị: một UUID do Host sinh ở lần đăng nhập đầu tiên. */
export const device = z.object({ id: z.uuid() });

/** Grant đã kiểm schema (đầu ra của {@link grant}). */
export type Grant = z.infer<typeof grant>;

/**
 * Seam CẤU TRÚC của miền authorization (ADR 000d — PHASE B 08/11/2026, dev-1): CHỈ khai đúng ba phương thức
 * mà nền tảng tài khoản dùng, nên không phụ thuộc augmentation \`declare module "@deepseek-ai/cordis"\`.
 */
export interface AuthorizationLike {
  /** Đăng ký một luồng uỷ quyền mới. Nhận: flow (khoá + nhãn + cách chạy). Trả: hàm huỷ đăng ký. */
  registerFlow(flow: {
    readonly key: string;
    readonly label: string;
    readonly methods: readonly { readonly id: string; readonly label: string }[];
    readonly run: (session: AuthorizationSession) => Promise<void>;
  }): () => void;
  /** Mở một lượt uỷ quyền có tương tác. Nhận: yêu cầu {key, signal, interaction}. Trả: promise kết cục {status}. */
  begin(request: {
    readonly key: string;
    readonly signal: AbortSignal;
    readonly interaction: { notify(): void; prompt(): Promise<never> };
  }): Promise<{ readonly status: string }>;
  /** Huỷ lượt uỷ quyền đang chạy của một khoá. Nhận: key. Trả: không. */
  cancel(key: string): void;
}

/**
 * Lấy seam theo CẤU TRÚC: ưu tiên \`ctx.get(name)\` (đường chính thức của cordis), chạm dự phòng thuộc tính
 * cùng tên (kernel cũ và giàn test chỉ phơi thuộc tính). Trả undefined khi không có ⇒ nơi gọi tự nổ.
 * Nhận: ctx — context cordis (hoặc vật giả trong test); name — tên service. Trả: seam nếu có.
 */
export function seamOf<T>(ctx: unknown, name: string): T | undefined {
  const holder = ctx as { get?: (key: string) => unknown; [key: string]: unknown };
  const viaGet = typeof holder.get === "function" ? holder.get(name) : undefined;
  const value = viaGet ?? holder[name];
  return (value ?? undefined) as T | undefined;
}
