/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Định nghĩa kiểu tab §files§ của sidebar phải (nguyên văn id/kind/thẻ hướng dẫn của bản gốc).
 */

import { FILES_ID, FILES_KIND, SHORTCUT_ID } from "./ids.ts";
import type { FilesTranslate } from "./locales.ts";
import type { FilesPrimitivesLike } from "./types.ts";

/**
 * Dựng định nghĩa kiểu tab §files§.
 *
 * Nhãn là HÀM chứ không phải chuỗi: sổ kiểu tab gọi lại mỗi lần vẽ, nên đổi ngôn ngữ là đổi ngay, và
 * thẻ hướng dẫn trỏ tới §commandId§ của chính phím tắt mà gói này đăng ký.
 * Nhận: t — hàm dịch đã bind namespace; primitives — primitive của DSH (lấy hình minh hoạ thẻ hướng dẫn).
 * Trả: định nghĩa để đăng ký với sổ kiểu tab.
 */
export function filesDefinition(t: FilesTranslate, primitives: FilesPrimitivesLike): Record<string, unknown> {
  return {
    id: FILES_ID,
    kind: FILES_KIND,
    priority: "builtin",
    title: () => t("type.label"),
    guide: [
      {
        id: "workspace",
        commandId: SHORTCUT_ID,
        order: 10,
        title: () => t("guide.title"),
        description: () => t("guide.description"),
        icon: primitives.GuideArtworkFiles,
      },
    ],
  };
}
