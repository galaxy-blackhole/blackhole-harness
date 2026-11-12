/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Từ vựng app-attribution cho request provider: gom danh tính sản phẩm KHÔNG bí mật mà mọi request
 *      gửi trong `User-Agent` về một chỗ, để adapter không trôi lệch. Port 1:1 vùng
 *      lib/types/attribution.js (dòng 839–880) của @deepseek-ai/dsh-llm — giữ nguyên chuỗi.
 */

import { createRequire } from "node:module";

/**
 * Danh tính ứng dụng công khai, tĩnh, gửi cho provider LLM.
 *
 * Mọi trường đều là dữ kiện sản phẩm công khai, an toàn trong mọi request: không bí mật, không đường
 * dẫn cục bộ, không session id, không văn bản prompt, không định danh theo người dùng; và không có gì
 * theo từng request được phép ảnh hưởng tới các giá trị này.
 */
export interface AppIdentity {
  /** Token sản phẩm của `User-Agent` (chữ thường, nối bằng gạch nối). */
  product: string;
  /** Phiên bản sản phẩm; lấy từ metadata của package, không chép tay. */
  version: string;
  /** URL nhà của ứng dụng, dùng làm chú thích `User-Agent`. */
  url: string;
}

/** Phiên bản đọc từ `package.json` của chính package này (cùng cơ chế với bản gốc). */
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

/**
 * Danh tính của chính harness: giá trị mặc định mà mọi adapter gửi. Triển khai cần danh tính
 * white-label thì truyền {@link AppIdentity} của riêng mình vào {@link attributionHeaders} — bỏ trống
 * thì rơi về mặc định này; không gì có thể tắt hẳn attribution.
 */
export const APP_IDENTITY: AppIdentity = {
  product: "deepseek-harness",
  version,
  url: "https://github.com/deepseek-ai/deepseek-harness",
};

/**
 * Giá trị `User-Agent` chuẩn: `product/version (+url)`. Chú thích `+url` trong ngoặc là dạng tự
 * nhận diện quy ước (RFC 9110 §10.1.5, cú pháp product + comment).
 * Nhận: identity — danh tính cần dựng; mặc định là {@link APP_IDENTITY}.
 * Trả: giá trị header sẵn sàng gửi.
 */
export function userAgent(identity: AppIdentity = APP_IDENTITY): string {
  return `${identity.product}/${identity.version} (+${identity.url})`;
}

/**
 * Dựng các header attribution mà adapter phải gửi trong MỌI request provider. Tên header viết chữ
 * thường (tên trường HTTP không phân biệt hoa thường trên đường truyền).
 * Nhận: identity — danh tính cần gửi; mặc định là {@link APP_IDENTITY} — bỏ trống không thể tắt
 * attribution.
 * Trả: các header cần trộn vào request provider (hiện chỉ `user-agent`).
 */
export function attributionHeaders(identity: AppIdentity = APP_IDENTITY): Record<string, string> {
  return { "user-agent": userAgent(identity) };
}
