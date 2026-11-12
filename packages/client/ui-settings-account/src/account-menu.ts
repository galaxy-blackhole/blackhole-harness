/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nut khoi dong tai khoan o thanh ben va hanh dong dang xuat do noi bo quyet dinh
 */

import { accountMenuStyles } from "./class-names.ts";
import type { AccountSnapshot, AccountOperations, AvatarSnapshot } from "./contracts.ts";
import type { AccountNoticeCardProps } from "./account-notice.ts";
import type { SignInDialogProps } from "./sign-in-dialog.ts";
import type { SignOutDialogProps } from "./sign-out-dialog.ts";
import type { RenderDeps, Translator } from "./types.ts";

/** Du lieu ma menu tai khoan nhan — nguyen van ten truong cua ban goc. */
export interface AccountMenuProps extends AccountOperations {
  /** Thanh ben dang mo rong khong. */
  readonly wide: boolean;
  /** To hop phim mo Settings, neu chu slot co. */
  readonly settingsShortcut?: unknown;
  /** Mo khung Settings. */
  readonly openSettings: () => void;
  /** Mo buoc nhap API Key cua Models. */
  readonly openOnboarding: (id: string) => void;
  /** Khung Settings dang mo khong. */
  readonly settingsOpen: boolean;
  /** Hook tai khoan do renderer dung tu kho cua ta. */
  readonly useAccount: <T>(select: (snapshot: AccountSnapshot) => T) => T;
  /** Hook giao dien do renderer dung tu seam theme. */
  readonly useTheme: <T>(select: (snapshot: { active: { colorScheme: string } }) => T) => T;
  /** Ham dich cua namespace settings.account. */
  readonly t: Translator;
}

/** Cac component ma menu tai khoan dung lai. */
export interface AccountMenuParts {
  /** The thong bao thuong. */
  readonly AccountNoticeCard: (props: AccountNoticeCardProps) => unknown;
  /** Hop thoai dang nhap. */
  readonly SignInDialog: (props: SignInDialogProps) => unknown;
  /** Hop thoai dang xuat. */
  readonly SignOutDialog: (props: SignOutDialogProps) => unknown;
  /** Bieu tuong dang xuat. */
  readonly LogoutIcon: () => unknown;
  /** Anh dai dien. */
  readonly AccountAvatar: (props: { avatar?: AvatarSnapshot; avatarFailed: (snapshot: AvatarSnapshot) => void }) => unknown;
}

/**
 * Dung nut khoi dong tai khoan o thanh ben.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @param parts - cac component dung lai.
 * @returns component menu tai khoan.
 */
export function createAccountMenu(deps: RenderDeps, parts: AccountMenuParts): (props: AccountMenuProps) => unknown {
  const { jsx, jsxs } = deps.jsxRuntime;
  const { useState, useRef, useEffect } = deps.react;
  const { Menu, Toast, IconEllipsisOutlineMedium, IconSettingsOutlineMedium, IconPaperPlaneOutlineMedium, IconUserOutlineMedium } = deps.primitives;
  const { AccountNoticeCard, SignInDialog, SignOutDialog, LogoutIcon, AccountAvatar } = parts;

  /**
   * Nut khoi dong tai khoan o thanh ben, kem thong bao va hai hop thoai cua no.
   * @param props - hinh hoc thanh ben, dieu huong Settings va nghiep vu tai khoan.
   * @returns nut khoi dong tai khoan.
   */
  return function AccountMenu(props: AccountMenuProps): unknown {
    const { wide, settingsShortcut, openSettings, openOnboarding, settingsOpen, useAccount, useTheme, signOut, hasRunningAccountTasks, refreshAccount, bonusNoticeShown, bonusNoticeDismissed, contactUs, showLogin, start, cancel, avatarFailed, t } = props;
    const anchor = useRef<HTMLElement | null>(null);
    const settingsWasOpen = useRef(false);
    useEffect(() => {
      if (settingsOpen && !settingsWasOpen.current) void refreshAccount();
      settingsWasOpen.current = settingsOpen;
    }, [refreshAccount, settingsOpen]);
    const account = useAccount((state) => state);
    const colorScheme = useTheme((snapshot) => snapshot.active.colorScheme);
    const signedIn = account.view?.status === "credential-stored";
    const [signInNotice, setSignInNotice] = useState(0);
    useEffect(() => props.subscribeModelSignInRequired(() => {
      setSignInNotice((value) => value + 1);
    }), [props.subscribeModelSignInRequired]);
    const [expiryNotice, setExpiryNotice] = useState(false);
    useEffect(() => props.subscribeSessionExpired(() => {
      setExpiryNotice(true);
    }), [props.subscribeSessionExpired]);
    const profile = account.details?.profile;
    const label = profile === undefined ? null : profile.status === "ready" ? profile.value.name ?? profile.value.contact ?? t("signedIn") : t("signedIn");
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLElement | null>(null);
    const [busy, setBusy] = useState(false);
    const [signOutImpact, setSignOutImpact] = useState<boolean | "unknown" | undefined>(undefined);
    /** Hoi anh huong len tac vu dang chay roi mo hop thoai dang xuat. */
    const requestSignOut = async (): Promise<void> => {
      setBusy(true);
      try {
        setSignOutImpact(await hasRunningAccountTasks());
        setOpen(false);
      } catch {
        setSignOutImpact("unknown");
        setOpen(false);
      } finally {
        setBusy(false);
      }
    };
    /** Dong menu roi bat dau dang nhap. */
    const beginSignIn = (): void => {
      setOpen(false);
      void start().catch(() => undefined);
    };
    // 22/10/2026 (yêu cầu chủ dự án): ẩn TẠM hai mục "Liên hệ/Phản hồi" và "Đăng nhập" khỏi menu tài khoản.
    // Bật lại bằng cách đổi AN_MUC_TAM thành false (giữ nguyên mã gốc bên dưới để khôi phục dễ dàng).
    const AN_MUC_TAM = true;
    const items: unknown[] = [
      {
        id: "settings",
        label: t("settings"),
        icon: jsx(IconSettingsOutlineMedium, { size: 16 }),
        ...(settingsShortcut === undefined ? {} : { shortcut: settingsShortcut }),
      },
      ...(AN_MUC_TAM
        ? []
        : [
            { id: "contact", label: t("contactUs"), icon: jsx(IconPaperPlaneOutlineMedium, { size: 16 }) },
            ...(signedIn
              ? [{ id: "signout", label: t("signOut"), icon: jsx(LogoutIcon, {}), disabled: busy }]
              : [{ id: "signin", label: t("signIn"), icon: jsx(IconUserOutlineMedium, { size: 16 }) }]),
          ]),
    ];
    return jsxs("div", {
      ref: anchor,
      className: accountMenuStyles.root,
      children: [
        signInNotice > 0 &&
          jsx(
            Toast,
            {
              text: t("modelSignInRequired"),
              onDone: () => {
                setSignInNotice(0);
              },
            },
            signInNotice,
          ),
        expiryNotice &&
          jsx(Toast, {
            text: t("sessionExpired"),
            onDone: () => {
              setExpiryNotice(false);
            },
          }),
        signedIn && !account.desktopOnboardingVisible && !account.onboarding && account.notice &&
          jsx(
            AccountNoticeCard,
            {
              notice: account.notice,
              anchor,
              title: t("bonusNoticeTitle"),
              closeLabel: t("close"),
              onShown: bonusNoticeShown,
              onDismiss: bonusNoticeDismissed,
            },
            account.notice.orderId,
          ),
        jsx(Menu, {
          open,
          side: "top",
          portal: true,
          autoFocus: true,
          className: accountMenuStyles.anchor,
          listClassName: signedIn ? undefined : accountMenuStyles.signedOutMenu,
          anchor: jsxs("button", {
            ref: trigger,
            type: "button",
            className: accountMenuStyles.trigger,
            "data-collapsed": !wide,
            "data-signed-out": !signedIn,
            "aria-label": t("menu"),
            "aria-haspopup": "menu",
            "aria-expanded": open,
            onClick: () => {
              setOpen((value) => !value);
            },
            children: [
              signedIn
                ? jsx("span", {
                    className: accountMenuStyles.avatar,
                    "data-avatar-status": account.avatar?.status,
                    children: jsx(AccountAvatar, { avatar: account.avatar, avatarFailed }),
                  })
                : jsx(IconEllipsisOutlineMedium, { size: 14 }),
              wide && jsx("span", { className: accountMenuStyles.label, children: signedIn ? label : t("more") }),
            ],
          }),
          items,
          onClose: () => {
            setOpen(false);
          },
          onSelect: (id: string) => {
            if (id === "settings") {
              setOpen(false);
              trigger.current?.focus();
              openSettings();
            } else if (id === "contact") {
              setOpen(false);
              contactUs();
            } else if (id === "signin") beginSignIn();
            else void requestSignOut();
          },
        }),
        account.loginVisible && !account.onboarding &&
          jsx(SignInDialog, {
            account,
            colorScheme,
            start,
            cancel,
            t,
            close: () => {
              showLogin(false);
            },
            useApiKey: () => {
              showLogin(false);
              openOnboarding("deepseek-official");
            },
          }),
        signedIn && signOutImpact !== undefined &&
          jsx(SignOutDialog, {
            running: signOutImpact,
            signOut,
            close: () => {
              setSignOutImpact(undefined);
            },
            t,
          }),
      ],
    });
  };
}
