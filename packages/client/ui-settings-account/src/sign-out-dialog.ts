/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hop thoai xac nhan dang xuat kem anh huong len cac tac vu dang chay, va bieu tuong dang xuat cua menu
 */

import { signInDialogStyles } from "./class-names.ts";
import type { RenderDeps, Translator } from "./types.ts";

/** Du lieu ma hop thoai dang xuat nhan. */
export interface SignOutDialogProps {
  /** Anh huong len tac vu dang chay: true · false · "unknown". */
  readonly running: boolean | "unknown";
  /** Dang xuat. */
  readonly signOut: () => Promise<void>;
  /** Dong hop thoai. */
  readonly close: () => void;
  /** Ham dich cua namespace settings.account. */
  readonly t: Translator;
}

/**
 * Dung hop thoai dang xuat va bieu tuong dang xuat.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @returns hai component cua duong dang xuat.
 */
export function createSignOutComponents(deps: RenderDeps): { SignOutDialog: (props: SignOutDialogProps) => unknown; LogoutIcon: () => unknown } {
  const { jsx, jsxs } = deps.jsxRuntime;
  const { useState } = deps.react;
  const { Modal, Button, IconCloseOutlineRegular } = deps.primitives;

  /**
   * Bieu tuong dang xuat cua Figma IcDsLogOutOutline16, luu thang trong ma de doi theo giao dien.
   * @returns bieu tuong dang xuat cua menu tai khoan.
   */
  function LogoutIcon(): unknown {
    return jsx("span", {
      style: { width: 16, height: 16, position: "relative" },
      "aria-hidden": "true",
      children: jsxs("svg", {
        style: { position: "absolute", left: 1.168, top: 1.214 },
        width: "13.664",
        height: "13.571",
        viewBox: "0 0 14 14",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        children: [
          jsx("path", {
            d: "M3.9961 1.40039C3.37842 1.40039 2.96028 1.40039 2.63867 1.42871C2.32631 1.45627 2.17171 1.50666 2.06641 1.56543C1.85606 1.68288 1.68189 1.85605 1.56446 2.06641C1.50569 2.17173 1.45625 2.32627 1.42871 2.63867C1.40036 2.9603 1.39942 3.37827 1.39942 3.9961L1.39942 9.5752C1.39942 10.193 1.40036 10.611 1.42871 10.9326C1.45625 11.245 1.50569 11.3996 1.56445 11.5049C1.68188 11.7153 1.85605 11.8884 2.06641 12.0059C2.17171 12.0646 2.32631 12.115 2.63867 12.1426C2.96028 12.1709 3.37842 12.1709 3.9961 12.1709V13.5713C3.4033 13.5713 2.91297 13.5721 2.51563 13.5371C2.10906 13.5013 1.73277 13.4233 1.38379 13.2285C0.946838 12.9845 0.585697 12.6235 0.341799 12.1865C0.14725 11.8377 0.0700118 11.4621 0.0341815 11.0557C-0.000847399 10.6583 1.58129e-06 10.1681 1.85029e-06 9.5752L2.09416e-06 3.9961C1.83027e-06 3.40325 -0.000846367 2.91297 0.0341818 2.51563C0.0700164 2.10924 0.147239 1.73362 0.341799 1.38477C0.585703 0.947758 0.946825 0.586744 1.38379 0.342775C1.73277 0.148001 2.10906 0.0700381 2.51563 0.0341813C2.91297 -0.000823893 3.40331 1.37805e-06 3.9961 1.71712e-06L3.9961 1.40039Z",
            fill: "currentColor",
          }),
          jsx("path", {
            d: "M13.6426 6.51953C13.6705 6.6957 13.6705 6.8756 13.6426 7.05176C13.5902 7.38188 13.4302 7.64112 13.2539 7.86035C13.0857 8.06937 12.8546 8.29971 12.6006 8.55371L9.3086 11.8447L8.31836 10.8545L11.6104 7.56348C11.637 7.53681 11.6628 7.51104 11.6875 7.48633H3.74317V6.08594H11.6885C11.6635 6.06088 11.6374 6.03487 11.6104 6.00781L8.31836 2.7168L9.3086 1.72656L12.6006 5.01758C12.8547 5.27169 13.0857 5.50185 13.2539 5.71094C13.4303 5.93018 13.5902 6.18939 13.6426 6.51953Z",
            fill: "currentColor",
          }),
        ],
      }),
    });
  }

  /**
   * Xac nhan dang xuat kem anh huong len cac tac vu dang chay.
   * @param props - anh huong luc mo, ban dich va hanh dong tai khoan.
   * @returns hop thoai xac nhan dang xuat.
   */
  function SignOutDialog({ running, signOut, close, t }: SignOutDialogProps): unknown {
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    /** Dong hop thoai khi khong ban. */
    const dismiss = (): void => {
      if (!busy) close();
    };
    /** Xac nhan dang xuat. */
    const confirm = async (): Promise<void> => {
      setBusy(true);
      setFailed(false);
      try {
        await signOut();
        close();
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    };
    return jsxs(Modal, {
      open: true,
      headless: true,
      title: t("signOut"),
      onClose: dismiss,
      className: signInDialogStyles.dialog,
      children: [
        jsxs("div", {
          className: signInDialogStyles.content,
          children: [
            jsxs("div", {
              className: signInDialogStyles.header,
              children: [
                jsx("h2", { className: signInDialogStyles.title, children: t("signOut") }),
                jsx("button", {
                  type: "button",
                  className: signInDialogStyles.close,
                  "aria-label": t("close"),
                  disabled: busy,
                  onClick: dismiss,
                  children: jsx(IconCloseOutlineRegular, { size: 14 }),
                }),
              ],
            }),
            jsx("p", {
              className: signInDialogStyles.description,
              children: t(running === "unknown" ? "signOutUnknownDescription" : running ? "signOutRunningDescription" : "signOutDescription"),
            }),
            failed && jsx("p", { className: signInDialogStyles.description, role: "alert", children: t("failed") }),
          ],
        }),
        jsxs("div", {
          className: signInDialogStyles.actions,
          children: [
            jsx(Button, {
              variant: "outline",
              className: signInDialogStyles.secondaryButton,
              disabled: busy,
              onClick: dismiss,
              children: t("cancel"),
            }),
            jsx(Button, {
              variant: "primary",
              className: signInDialogStyles.primaryButton,
              disabled: busy,
              onClick: () => {
                void confirm();
              },
              children: t("signOut"),
            }),
          ],
        }),
      ],
    });
  }

  return { SignOutDialog, LogoutIcon };
}
