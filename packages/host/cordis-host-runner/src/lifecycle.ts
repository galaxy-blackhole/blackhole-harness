/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vòng đời fiber nửa Host trên nhóm `cordis-dynamic`: chốt một plugin do sandbox sinh ra
 *      thành fiber con (không bao giờ để fiber hỏng nằm lại), và báo các dịch vụ mà một fiber đã chốt
 *      nhưng còn chờ. Dừng không cần trợ giúp — nửa Host gỡ qua `fiber.dispose()` có await, vì
 *      mọi thứ plugin đăng ký đều là hiệu ứng trên fiber của nó (bản gốc: lib/types/lifecycle.js)
 */

import type { Context, Fiber, Plugin } from "@deepseek-ai/cordis";
import { guardedPlugin } from "./guard.ts";

/**
 * Chờ nhóm, khởi động rồi chốt MỘT fiber con đã bọc guard, và gỡ nó TRƯỚC khi ném lại mọi lỗi khởi
 * động để lượt chạy hỏng không nằm lại. Một `inject` hợp lệ chưa thoả có thể vẫn còn chờ.
 * Nhận: `group` — fiber nhóm `cordis-dynamic` mà mọi nửa Host treo dưới;
 * `plugin` — plugin sandbox trả về, được bọc guard đăng ký trước khi khởi động;
 * `reportGuardFailure` — báo các lần guard Host từ chối sau kích hoạt cho Agent sở hữu.
 * Trả: fiber con đã chốt (có thể còn chờ `inject` chưa thoả).
 * @throws Lỗi khởi động của plugin; khi thông điệp chứa `already registered` thì ném lại kèm
 * công thức THAY THẾ gói cũ.
 */
export async function startHostHalf(
  group: Fiber,
  plugin: Plugin,
  reportGuardFailure: (error: Error) => void,
): Promise<Fiber> {
  await group.await();
  const fiber = group.ctx.plugin(guardedPlugin(plugin, reportGuardFailure));
  try {
    await fiber.await();
  }
  catch (error) {
    await fiber.dispose();
    const message = error instanceof Error ? error.message : String(error);
    // Va chạm khởi động phổ biến nhất là chạy MỘT phiên bản MỚI của gói trong khi lượt
    // cũ vẫn giữ tên — dạy luôn công thức thay thế.
    if (message.includes("already registered")) {
      throw new Error(`${message} — to REPLACE something an earlier dynamic package registered, first stop that package through its runner or the Cordis panel `
        + "before running the new version.");
    }
    throw error instanceof Error ? error : new Error(message);
  }
  return fiber;
}

/**
 * Các dịch vụ mà một fiber đã khai trong `inject` nhưng CHƯA tồn tại — một fiber đã chốt mà
 * không hoạt động đang chờ đúng những dịch vụ này (ngữ nghĩa cordis hợp lệ: nó kích hoạt khi dịch vụ
 * xuất hiện).
 * Nhận: `ctx` — context dùng để tra sự tồn tại của dịch vụ; `fiber` — fiber nửa Host
 * cần kiểm các khai báo `inject`.
 * Trả: tên các dịch vụ còn thiếu, theo THỨ TỰ KHAI BÁO.
 */
export function missingServices(ctx: Context, fiber: Fiber): string[] {
  return Object.keys(fiber.inject).filter(service => ctx.get(service) === undefined);
}
