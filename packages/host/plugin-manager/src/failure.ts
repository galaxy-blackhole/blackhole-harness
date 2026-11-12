/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/failure.js' (24 dòng) của @deepseek-ai/dsh-plugin-manager: ManagementFailure — lỗi
 *      quản trị ĐƯỢC DỰ KIẾN mang mã để từ điển locale của bên gọi render — và incompatiblePlugin, bỏ cờ
 *      miễn trừ khỏi một kết quả tương thích chưa được miễn.
 */
import type { PluginCompatibility } from "@deepseek-ai/dsh-app-boot";
import type { IncompatiblePlugin, ManagementError } from "./types.ts";

/** Lỗi quản trị được DỰ KIẾN; phần trình bày thuộc từ điển locale của bên gọi. */
export class ManagementFailure extends Error {
  /** Mã được từ điển locale của bên gọi render. */
  readonly code: ManagementError["code"];

  /** Các package mà một lần từ chối `incompatible-version` nêu tên. */
  readonly incompatible: IncompatiblePlugin[] | undefined;

  /**
   * Dựng lỗi quản trị.
   * Nhận: `code` — mã từ chối bản địa hoá được; `incompatible` — các package mà phiên bản DSH đang chạy từ
   * chối, dành cho `incompatible-version`.
   * Trả: thể hiện lỗi mới; `message` là chính `code` (nguyên văn bản gốc), `incompatible` giữ nguyên tham số.
   */
  constructor(code: ManagementError["code"], incompatible?: IncompatiblePlugin[]) {
    super(code);
    this.code = code;
    this.incompatible = incompatible;
  }
}

/**
 * Bỏ trạng thái miễn trừ khỏi một kết quả tương thích chưa được miễn.
 * Nhận: `issue` — kết quả tương thích mà miễn trừ của nó KHÔNG hiệu lực.
 * Trả: object MỚI đúng bốn trường `{ name, version, runtimeVersion, requirements }` của package, runtime và
 * các yêu cầu DSH chưa thoả (bản gốc chỉ chép bốn trường này, bỏ `exempted`).
 */
export function incompatiblePlugin(issue: PluginCompatibility): IncompatiblePlugin {
  return { name: issue.name, version: issue.version, runtimeVersion: issue.runtimeVersion, requirements: issue.requirements };
}
