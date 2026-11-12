/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Picker: chọn backend chọn thư mục một lần
 *      lúc boot rồi mount CẶP backend + bề mặt client tương ứng thành entry thật của Loader.
 */

import { hasLinuxChooserBinary, canExecute } from "./probe.ts";
import { launchEnvironmentOf, launchedThroughSsh } from "./launch.ts";
import { resolveDirectoryPickerBackend, type DirectoryPickerBackendKind } from "./resolve.ts";

/** Một fiber của entry Loader, chỉ phần row này dùng. */
export interface LoaderFiberLike {
  /** Chờ fiber chạy xong (hoặc hỏng). */
  await(): Promise<unknown>;
  /** Dừng fiber, trả về promise hoàn tất teardown. */
  dispose(): Promise<unknown> | unknown;
}

/** Một entry trong cây Loader, chỉ phần row này dùng. */
export interface LoaderEntryLike {
  /** Fiber đang chạy entry, vắng khi entry chưa được nạp. */
  fiber?: LoaderFiberLike;
}

/** Seam Loader: nơi row mount cặp entry của nó. */
export interface LoaderLike {
  /** Bảng entry theo id. */
  store: Record<string, LoaderEntryLike | undefined>;
  /** Tạo một entry mới, trả về id. */
  create(options: { name: string }): Promise<string>;
  /** Đọc entry theo id. */
  resolve(id: string): LoaderEntryLike;
  /** Gỡ entry khỏi cây. */
  remove(id: string): void;
}

/** Seam webserver: row chỉ cần địa chỉ bind hiệu dụng. */
export interface WebServerLike {
  /** Địa chỉ bind hiện tại. */
  host: string;
}

/** Seam connection: chính sách tin cậy authority. */
export interface ConnectionLike {
  /** Có nhận authority KHÔNG-loopback hay không. */
  allowsRemoteAuthorities: boolean;
}

/** Context mà row này dùng: tra service qua get (Gateway/Loader cấp context khác nhau). */
export interface PickerContext {
  /** Tra service theo tên, không cần inject. */
  get(name: string): unknown;
  /** Chạy một hiệu ứng có hàm dọn; cordis gọi hàm dọn khi plugin unload. */
  effect(callback: () => Promise<() => Promise<void>>, label?: string): unknown;
}

/** Tên plugin cordis. */
export const name = "directory-picker-auto";

/** Service bắt buộc: cấu hình HTTP (webServer), chính sách tin cậy (connection), cây entry (loader). */
export const inject: string[] = ["webServer", "connection", "loader"];

/**
 * Gói backend host theo từng loại đã giải — từ vựng thành phần CỐ ĐỊNH, không phải tham số chỉnh.
 * Xuất ra vì tham chiếu là chuỗi lúc chạy mà cổng kiểm cấu hình tĩnh không thấy được trong row yml.
 */
export const BACKEND_PACKAGES: Record<DirectoryPickerBackendKind, string> = {
  native: "@deepseek-ai/dsh-host-directory-picker-native",
  browse: "@deepseek-ai/dsh-host-directory-picker-browse",
};

/**
 * Gói bề mặt client theo từng loại đã giải, mount cùng backend để một lựa chọn vẫn ghép đủ hai mặt.
 * Ở đây chỉ tham chiếu specifier vì các gói đó thuộc chương trình Client, phía này không import.
 */
export const SURFACE_PACKAGES: Record<DirectoryPickerBackendKind, string> = {
  native: "@deepseek-ai/dsh-client-ui-directory-picker-native",
  browse: "@deepseek-ai/dsh-client-ui-directory-picker-browse",
};

/**
 * Lấy seam Loader của kernel.
 * @param ctx - context của plugin.
 * @returns seam Loader.
 * @throws Error khi seam chưa sẵn sàng — lỗi rõ ràng thay vì TypeError khó đọc.
 */
function loaderOf(ctx: PickerContext): LoaderLike {
  const loader = ctx.get("loader") as LoaderLike | undefined;
  if (loader === undefined) throw new Error("gbh-host-directory-picker-auto: service loader chưa sẵn sàng");
  return loader;
}

/**
 * Lấy địa chỉ bind của webserver (mặc định 127.0.0.1 khi seam vắng, để phép giải không nổ).
 * @param ctx - context của plugin.
 * @returns địa chỉ bind hiệu dụng.
 */
function bindHostOf(ctx: PickerContext): string {
  const server = ctx.get("webServer") as WebServerLike | undefined;
  return server?.host ?? "127.0.0.1";
}

/**
 * Chính sách tin cậy authority của Connection (mặc định false khi seam vắng: không nới quyền).
 * @param ctx - context của plugin.
 * @returns true khi Connection nhận authority ngoài loopback.
 */
function allowsRemoteAuthoritiesOf(ctx: PickerContext): boolean {
  const connection = ctx.get("connection") as ConnectionLike | undefined;
  return connection?.allowsRemoteAuthorities === true;
}

/**
 * Giải tương tác từ MỘT mẫu lúc boot rồi mount backend và bề mặt của nó thành entry Loader;
 * hàm dọn của hiệu ứng gỡ cả hai entry và chờ teardown của hai fiber, nên unload plugin chỉ trả về
 * sau khi cả hai mặt của tương tác đã mount (và các bên phụ thuộc) lặng hẳn.
 * @param ctx - context cordis mang các seam đã khai trong inject.
 * @returns promise hoàn tất khi đã mount xong cặp entry (hoặc đã dọn sạch nếu lỗi).
 */
export async function apply(ctx: PickerContext): Promise<void> {
  const backend = resolveDirectoryPickerBackend({
    bindHost: bindHostOf(ctx),
    allowsRemoteAuthorities: allowsRemoteAuthoritiesOf(ctx),
    platform: process.platform,
    ssh: launchedThroughSsh(launchEnvironmentOf(ctx)),
    env: { DISPLAY: process.env.DISPLAY, WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY },
    linuxChooser: hasLinuxChooserBinary(process.env.PATH, canExecute),
  });
  await ctx.effect(async () => {
    const loader = loaderOf(ctx);
    const ids: string[] = [];
    const unmount = async (): Promise<void> => {
      for (const id of [...ids].reverse()) {
        const entry = loader.store[id];
        if (entry === undefined) continue;
        const disposal = entry.fiber?.dispose();
        loader.remove(id);
        await disposal;
      }
    };
    try {
      for (const specifier of [BACKEND_PACKAGES[backend], SURFACE_PACKAGES[backend]]) {
        const id = await loader.create({ name: specifier });
        ids.push(id);
        const entry = loader.resolve(id);
        if (entry.fiber === undefined) throw new Error("directory-picker-auto: failed to load " + specifier);
        await entry.fiber.await();
      }
    } catch (cause) {
      await unmount();
      throw cause;
    }
    return unmount;
  }, "directory-picker-auto: interaction entries");
}
