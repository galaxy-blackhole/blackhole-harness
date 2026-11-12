/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Muc Tai khoan va so du trong khung Settings: ve trang thai an toan cua Host va cac hanh dong dang nhap ro rang
 */

import { accountSectionStyles } from "./class-names.ts";
import { formatBalance } from "./format-balance.ts";
import type { AccountSnapshot, AvatarSnapshot, ProfileValue } from "./contracts.ts";
import type { RenderDeps, Translator } from "./types.ts";

/** Du lieu ma muc tai khoan nhan — nguyen van ten truong cua ban goc. */
export interface AccountSectionProps {
  /** Ham dich cua namespace settings.account. */
  readonly t: Translator;
  /** Hook tai khoan do renderer dung tu kho cua ta. */
  readonly useAccount: <T>(select: (snapshot: AccountSnapshot) => T) => T;
  /** Hook giao dien do renderer dung tu seam theme. */
  readonly useTheme: <T>(select: (snapshot: { active: { colorScheme: string } }) => T) => T;
  /** Bat dau mot lan dang nhap. */
  readonly start: () => Promise<void>;
  /** Huy mot lan dang nhap theo id. */
  readonly cancel: (id: string) => Promise<void>;
  /** Mo mot trang Platform (chi co khi vo Desktop tiem dshPlatform). */
  readonly openPlatformPage?: (page: string, onClose: (reason: string) => void) => () => void;
  /** Bao anh dai dien tai len that bai. */
  readonly avatarFailed: (snapshot: AvatarSnapshot) => void;
}

/** Pha dang "dang lam viec" cua mot lan dang nhap. */
const ACTIVE_PHASES: readonly string[] = ["initializing", "waiting-browser", "exchanging", "committing"];

/**
 * Dung muc tai khoan trong khung Settings.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @param AccountAvatar - component anh dai dien dung lai.
 * @param authorizeUrlWithTheme - ham them bang mau vao dia chi uy quyen.
 * @returns component muc tai khoan.
 */
export function createAccountSection(
  deps: RenderDeps,
  AccountAvatar: (props: { avatar?: AvatarSnapshot; avatarFailed: (snapshot: AvatarSnapshot) => void }) => unknown,
  authorizeUrlWithTheme: (url: string, colorScheme: string) => string,
): (props: AccountSectionProps) => unknown {
  const { jsx, jsxs, Fragment } = deps.jsxRuntime;
  const { useState, useRef, useEffect } = deps.react;
  const { Button, IconRightUpOutlineRegular } = deps.primitives;

  /**
   * Muc tai khoan trong Settings: ve trang thai an toan cua Host va cac hanh dong dang nhap ro rang.
   * @param props - hanh dong da ban dich, dang ky tai khoan va kenh trang Platform dung chung.
   * @returns giao dien muc tai khoan.
   */
  return function AccountSection({ t, useAccount, useTheme, start, cancel, openPlatformPage, avatarFailed }: AccountSectionProps): unknown {
    const { view: state, details, avatar, failed: streamFailed } = useAccount((value) => value);
    const colorScheme = useTheme((snapshot) => snapshot.active.colorScheme);
    const releasePage = useRef<(() => void) | undefined>(undefined);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const profile: ProfileValue | undefined = details?.profile?.status === "ready" ? details.profile.value : undefined;
    const balance = details?.balance;
    const wallets: readonly { readonly currency: string; readonly balance: string }[] | undefined = balance?.status === "ready" ? balance.value ?? [] : undefined;
    const bonusWallets = balance?.status === "ready" ? (balance.bonusWallets ?? []).filter((wallet) => positive(wallet.balance)) : [];
    const showBonusRow = details?.balance?.status !== "ready" || bonusWallets.length > 0;
    const attempt = state?.attempt;
    const active = attempt !== null && attempt !== undefined && ACTIVE_PHASES.includes(attempt.phase);
    const signedIn = state?.status === "credential-stored";
    useEffect(() => () => {
      releasePage.current?.();
      releasePage.current = undefined;
    }, []);
    useEffect(() => {
      if (signedIn) return;
      releasePage.current?.();
      releasePage.current = undefined;
    }, [signedIn]);
    /**
     * Mo mot trang Platform va giu ham nha cua no.
     * @param open - ham mo trang cua kenh dung chung.
     * @param page - ten trang.
     */
    const showPage = (open: (page: string, onClose: (reason: string) => void) => () => void, page: string): void => {
      releasePage.current?.();
      releasePage.current = open(page, () => {
        releasePage.current = undefined;
      });
    };
    /**
     * Chay mot hanh dong co bat co "dang ban".
     * @param action - hanh dong bat dong bo.
     */
    const run = async (action: () => Promise<void>): Promise<void> => {
      setBusy(true);
      setFailed(false);
      try {
        await action();
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    };
    /**
     * Chan dieu huong mac dinh khi Desktop mo trang nhung.
     * @param event - cu click vao lien ket Platform.
     */
    const openUsage = (event: { preventDefault: () => void }): void => {
      if (openPlatformPage !== undefined && signedIn) {
        event.preventDefault();
        showPage(openPlatformPage, "usage");
      }
    };
    /**
     * Dia chi Platform ma cac dong so du dung chung voi hanh dong Usage: trang nhung tren Desktop,
     * tab moi o noi khac. Mot lan doc vi that bai van toi cung dich den, de nguoi dung xem duoc
     * so du ma Harness khong doc noi; dich den lay tu lien ket tai khoan, khong tu phan hoi so du.
     * @param label - chu cua lien ket da ban dich.
     * @param className - kieu lien ket cua dong dang ve, vang khi bang khong co luat do.
     * @returns the a cua Platform.
     */
    const platformLink = (label: string, className: string | undefined): unknown =>
      jsx("a", {
        className,
        href: state?.links.usageUrl,
        "aria-disabled": state === undefined,
        target: "_blank",
        rel: "noreferrer",
        onClick: openUsage,
        children: label,
      });
    const status = failed || streamFailed || attempt?.phase === "failed"
      ? t("failed")
      : attempt?.phase === "expired"
        ? t("expired")
        : active
          ? t(attempt?.phase === "initializing" ? "initializing" : attempt?.phase === "waiting-browser" ? "waiting" : "completing")
          : signedIn
            ? profile?.contact ?? t(details?.profile === undefined ? "loading" : "profileUnavailable")
            : t("signInDescription");
    if (!signedIn && !active) {
      return jsx("section", {
        className: accountSectionStyles.signedOut,
        "aria-label": t("nav"),
        children: jsxs("div", {
          className: accountSectionStyles.signedOutContent,
          children: [
            jsxs("div", {
              className: accountSectionStyles.signedOutCopy,
              children: [
                jsx("span", { className: accountSectionStyles.signedOutTitle, children: t("settingsSignedOutTitle") }),
                jsx("span", {
                  className: accountSectionStyles.signedOutDescription,
                  role: "status",
                  children: failed || streamFailed ? t("failed") : t("settingsSignedOutDescription"),
                }),
              ],
            }),
            jsx(Button, {
              variant: "primary",
              className: accountSectionStyles.signInButton,
              disabled: busy || state === undefined,
              onClick: () => {
                void run(start);
              },
              children: t("signIn"),
            }),
          ],
        }),
      });
    }
    return jsxs("section", {
      className: accountSectionStyles.section,
      "aria-label": t("nav"),
      children: [
        jsxs("div", {
          className: accountSectionStyles.card,
          children: [
            jsxs("div", {
              className: accountSectionStyles.identity,
              children: [
                jsx("span", {
                  className: accountSectionStyles.avatar,
                  "data-avatar-status": signedIn ? avatar?.status : undefined,
                  children: jsx(AccountAvatar, { avatar: signedIn ? avatar : undefined, avatarFailed }),
                }),
                jsxs("div", {
                  className: accountSectionStyles.identityCopy,
                  children: [
                    jsx("span", { className: accountSectionStyles.name, children: signedIn ? profile?.name ?? t("signedIn") : t("signedOut") }),
                    jsx("span", { className: accountSectionStyles.status, role: "status", children: status }),
                  ],
                }),
              ],
            }),
            signedIn &&
              jsxs("a", {
                className: accountSectionStyles.accountInfo,
                href: new URL("/", state?.links.usageUrl).href,
                target: "_blank",
                rel: "noopener noreferrer",
                children: [t("accountInfo"), jsx(IconRightUpOutlineRegular, { size: 12 })],
              }),
          ],
        }),
        active &&
          jsxs("div", {
            className: accountSectionStyles.actions,
            children: [
              attempt?.authorizeUrl &&
                jsx("a", {
                  className: accountSectionStyles.linkButton,
                  href: authorizeUrlWithTheme(attempt.authorizeUrl, colorScheme),
                  target: "_blank",
                  rel: "noreferrer",
                  children: t("open"),
                }),
              jsx(Button, {
                variant: "outline",
                disabled: busy || attempt?.phase === "committing",
                onClick: () => {
                  const id = attempt?.id;
                  if (id === undefined) return;
                  void run(() => cancel(id));
                },
                children: t("cancel"),
              }),
            ],
          }),
        jsxs("div", {
          className: accountSectionStyles.balanceCard,
          children: [
            jsxs("div", {
              className: accountSectionStyles.row,
              children: [
                jsx("span", { children: t("balance") }),
                signedIn && wallets !== undefined && wallets.length > 0
                  ? jsx("span", {
                      className: accountSectionStyles.amount,
                      children: wallets.map((wallet) => jsx("span", { children: formatBalance(wallet.balance, wallet.currency === "CNY" ? "¥" : "$") }, wallet.currency)),
                    })
                  : !signedIn || details?.balance === undefined
                    ? jsx("span", { className: accountSectionStyles.unavailable, children: t(!signedIn ? "balanceSignedOut" : "loading") })
                    : platformLink(t("balanceUnavailable"), accountSectionStyles.unavailableLink),
              ],
            }),
            signedIn && showBonusRow &&
              jsxs(Fragment, {
                children: [
                  jsx("div", { className: accountSectionStyles.divider }),
                  jsxs("div", {
                    className: accountSectionStyles.row,
                    children: [
                      jsx("span", { children: t("bonusBalance") }),
                      jsx("span", {
                        className: accountSectionStyles.bonusValue,
                        children:
                          bonusWallets.length > 0
                            ? jsx("span", {
                                className: accountSectionStyles.amount,
                                children: bonusWallets.map((wallet) => jsx("span", { children: formatBalance(wallet.balance, wallet.currency === "CNY" ? "¥" : "$") }, wallet.currency)),
                              })
                            : details?.balance === undefined
                              ? jsx("span", { className: accountSectionStyles.unavailable, children: t("loading") })
                              : platformLink(t("balanceUnavailable"), accountSectionStyles.unavailableLink),
                      }),
                    ],
                  }),
                ],
              }),
            jsx("div", { className: accountSectionStyles.divider }),
            jsxs("div", {
              className: accountSectionStyles.row,
              children: [
                jsx("span", { className: accountSectionStyles.secondary, children: t("more") }),
                jsxs("div", {
                  className: accountSectionStyles.links,
                  children: [
                    platformLink(t("usage"), accountSectionStyles.linkButton),
                    jsx("a", {
                      className: accountSectionStyles.linkButton + " " + accountSectionStyles.primary,
                      href: state?.links.topUpUrl,
                      "aria-disabled": state === undefined,
                      target: "_blank",
                      rel: "noreferrer",
                      onClick: (event: { preventDefault: () => void }) => {
                        if (openPlatformPage !== undefined && signedIn) {
                          event.preventDefault();
                          showPage(openPlatformPage, "top-up");
                        }
                      },
                      children: t("topUp"),
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  /**
   * Chuoi so du co phai so duong khong (thay Big(...).gt(0)).
   * @param amount - chuoi so thap phan.
   * @returns true khi lon hon 0.
   */
  function positive(amount: string): boolean {
    return /[1-9]/.test(amount.trim().replace(/^[+-]/, ""));
  }
}
