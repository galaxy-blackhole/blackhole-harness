/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thong bao het han muc toan khung do tai khoan tiep quan: Modal so du hoac Toast du phong
 */

import type { AccountSnapshot, MatchedQuotaNotice } from "./contracts.ts";
import type { PlatformPageClaim } from "./contracts.ts";
import type { RenderDeps, Translator } from "./types.ts";

/** Du lieu ma thong bao het han muc nhan — nguyen van ten truong cua ban goc. */
export interface AccountQuotaNoticeProps {
  /** Thong bao ma chu slot dua xuong nguoi ngoi. */
  readonly matched: MatchedQuotaNotice;
  /** Mo mot trang Platform (chi co khi vo Desktop tiem dshPlatform). */
  readonly openPlatformPage?: (page: string, onClose: (reason: string) => void) => () => void;
  /** Hook tai khoan do renderer dung tu kho cua ta. */
  readonly useAccount: <T>(select: (snapshot: AccountSnapshot) => T) => T;
  /** Hook kenh trang Platform do renderer dung tu kho cua ta. */
  readonly usePlatformPage: <T>(select: (claim: PlatformPageClaim | null) => T) => T;
  /** Ham dich cua namespace settings.account. */
  readonly t: Translator;
}

/**
 * Dung thong bao het han muc cua tai khoan.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @returns component thong bao het han muc.
 */
export function createAccountQuotaNotice(deps: RenderDeps): (props: AccountQuotaNoticeProps) => unknown {
  const { jsx, jsxs, Fragment } = deps.jsxRuntime;
  const { useState, useRef, useEffect } = deps.react;
  const { Modal, Button, Toast, IconWarningOutlineRegular } = deps.primitives;

  return function AccountQuotaNotice({ matched, openPlatformPage, useAccount, usePlatformPage, t }: AccountQuotaNoticeProps): unknown {
    const { dismiss, keepOpen, message } = matched;
    const accountStatus = useAccount((snapshot) => snapshot.view?.status);
    const accountFailed = useAccount((snapshot) => snapshot.failed);
    const signedIn = accountStatus === "credential-stored";
    const platformPage = usePlatformPage((current) => current);
    const [opened, setOpened] = useState(false);
    const previousSignedIn = useRef(signedIn);
    const releaseHold = useRef<(() => void) | undefined>(undefined);
    const releasePage = useRef<(() => void) | undefined>(undefined);
    /** Nha ca hai claim cua thong bao. */
    const releaseClaims = (): void => {
      releasePage.current?.();
      releasePage.current = undefined;
      releaseHold.current?.();
      releaseHold.current = undefined;
    };
    useEffect(() => releaseClaims, []);
    useEffect(() => {
      if (previousSignedIn.current && !signedIn) {
        releaseClaims();
        dismiss();
      }
      previousSignedIn.current = signedIn;
    }, [dismiss, signedIn]);
    if (accountStatus === undefined && !accountFailed && openPlatformPage !== undefined) return null;
    if (!signedIn || openPlatformPage === undefined) {
      return jsx(Toast, { text: message, icon: jsx(IconWarningOutlineRegular, { size: 18 }), onDone: dismiss });
    }
    if (opened || platformPage !== null) return null;
    return jsx(Modal, {
      open: true,
      title: t("quotaTitle"),
      closeLabel: t("close"),
      onClose: dismiss,
      description: t("quotaDescription"),
      footer: jsxs(Fragment, {
        children: [
          jsx(Button, { variant: "outline", onClick: dismiss, children: t("cancel") }),
          jsx(Button, {
            variant: "primary",
            onClick: () => {
              releaseHold.current = keepOpen();
              releasePage.current = openPlatformPage("top-up", () => {
                releasePage.current = undefined;
                dismiss();
              });
              setOpened(true);
            },
            children: t("quotaTopUp"),
          }),
        ],
      }),
    });
  };
}
