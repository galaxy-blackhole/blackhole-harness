/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Anh dai dien dung chung voi bieu tuong mac dinh khi thieu anh hoac anh loi
 */

import { accountAvatarStyles } from "./class-names.ts";
import type { AvatarSnapshot } from "./contracts.ts";
import type { RenderDeps } from "./types.ts";

/** Du lieu ma anh dai dien nhan. */
export interface AccountAvatarProps {
  /** Lan tai anh dung chung, vang khi chua co. */
  readonly avatar?: AvatarSnapshot;
  /** Bao anh ve nhung that bai. */
  readonly avatarFailed: (snapshot: AvatarSnapshot) => void;
}

/**
 * Dung component anh dai dien.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @returns component anh dai dien.
 */
export function createAccountAvatar(deps: RenderDeps): (props: AccountAvatarProps) => unknown {
  const { jsx } = deps.jsxRuntime;
  const { IconUserOutlineMedium } = deps.primitives;

  /**
   * Ve anh dai dien trang tri canh danh tinh tai khoan.
   * @param props - ket qua tai anh dung chung va bao loi khi anh ve that bai; thieu du lieu thi dung bieu tuong mac dinh.
   * @returns anh, hoac bieu tuong tai khoan mac dinh.
   */
  return function AccountAvatar({ avatar, avatarFailed }: AccountAvatarProps): unknown {
    return avatar?.status === "ready"
      ? jsx("img", {
          className: accountAvatarStyles.image,
          src: avatar.url,
          alt: "",
          referrerPolicy: "no-referrer",
          onError: () => {
            avatarFailed(avatar);
          },
        })
      : jsx(IconUserOutlineMedium, { size: 16 });
  };
}
