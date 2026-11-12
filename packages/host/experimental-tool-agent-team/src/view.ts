/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng MỘT dòng roster mà model nhìn thấy: đổi `name` thành `target` và bỏ `id` của phiên.
 */

import type { TeamMemberView } from "@deepseek-ai/dsh-experimental-agent-team";

/** Một dòng roster đúng như model đọc: địa chỉ là `target`, không lộ `id` của phiên. */
export type ModelMember = Omit<TeamMemberView, "id" | "name"> & { readonly target: string };

/**
 * Đổi một dòng roster của seam `agentTeams` sang hình dạng model nhìn thấy.
 * Nhận: `member` — dòng roster thật (có `id` của phiên và `name` làm địa chỉ).
 * Trả: bản ghi MỚI đặt `name` vào `target` và BỎ `id`; mọi trường khác giữ nguyên giá trị.
 */
export function modelMember(member: TeamMemberView): ModelMember {
  const { id: _id, name, ...details } = member;
  return { target: name, ...details };
}
