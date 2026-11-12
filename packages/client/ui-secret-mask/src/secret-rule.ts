/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Luật UserText "secret": mỗi luật sở hữu một bộ quét riêng
 */

import { CredentialScanner, type SecretNode } from "./credential-scanner.ts";

/** Luật UserText mà registry của khung hội thoại nhận. */
export interface UserTextRule {
  /** Id luật; cũng là id node do luật này sinh ra. */
  id: "secret";
  /** Thứ tự ưu tiên khi nhiều luật cùng khớp. */
  order: number;
  /** Tìm credential gần nhất tại hoặc sau một vị trí. */
  match(text: string, from: number): SecretNode | undefined;
}

/**
 * Tạo bộ nhận diện credential.
 * Nhận: không.
 * Trả: luật "secret" dùng một bộ quét riêng; luật không đọc Facts nên đổi Facts không làm nó mất hiệu lực.
 */
export function createSecretRule(): UserTextRule {
  const scanner = new CredentialScanner();
  return {
    id: "secret",
    order: 0,
    match: (text: string, from: number): SecretNode | undefined => scanner.match(text, from),
  };
}
