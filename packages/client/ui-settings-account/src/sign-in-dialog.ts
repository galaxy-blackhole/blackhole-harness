/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hop thoai uy quyen tai khoan (kem buoc chon tai khoan cua Models): loi cho phep thu lai sau khi huy lan dang chay
 */

import { authorizeUrlWithTheme } from "./browser-login.ts";
import { signInDialogStyles } from "./class-names.ts";
import type { AccountSnapshot } from "./contracts.ts";
import type { RenderDeps, Translator } from "./types.ts";

/** Du lieu ma hop thoai dang nhap nhan — nguyen van ten truong cua ban goc. */
export interface SignInDialogProps {
  /** Anh chup tai khoan an toan. */
  readonly account: AccountSnapshot;
  /** Bang mau dang hoat dong. */
  readonly colorScheme: string;
  /** Bat dau mot lan dang nhap. */
  readonly start: () => Promise<void>;
  /** Huy mot lan dang nhap theo id. */
  readonly cancel: (id: string) => Promise<void>;
  /** Dong hop thoai. */
  readonly close: () => void;
  /** Chuyen sang duong API Key. */
  readonly useApiKey: () => void;
  /** Ham dich cua namespace settings.account. */
  readonly t: Translator;
}

/** Du lieu ma buoc tai khoan cua Models nhan. */
export interface AccountOnboardingProps {
  /** Bao buoc credential da xong. */
  readonly complete: () => void;
  /** Chuyen sang duong API Key cua chu slot. */
  readonly useApiKey: () => void;
  /** Hook tai khoan do renderer dung tu kho cua ta. */
  readonly useAccount: <T>(select: (snapshot: AccountSnapshot) => T) => T;
  /** Hook giao dien do renderer dung tu seam theme. */
  readonly useTheme: <T>(select: (snapshot: { active: { colorScheme: string } }) => T) => T;
  /** Bat/tat co "buoc credential dang chiem man hinh". */
  readonly setOnboarding: (active: boolean) => void;
  /** Bat/tat hop thoai dang nhap cua lop phu shell. */
  readonly showLogin: (visible: boolean) => void;
  /** Bat dau mot lan dang nhap. */
  readonly start: () => Promise<void>;
  /** Huy mot lan dang nhap theo id. */
  readonly cancel: (id: string) => Promise<void>;
  /** Ham dich cua namespace settings.account. */
  readonly t: Translator;
}

/** Pha dang "dang lam viec" cua mot lan dang nhap — nguyen van ban goc. */
const ACTIVE_PHASES: readonly string[] = ["initializing", "waiting-browser", "exchanging", "committing"];

/** Thoi gian hien thong bao "da sao chep" (ms) — ban goc dung 2e3. */
const COPY_RESULT_MS = 2000;

/**
 * Dung hai component cua duong dang nhap.
 * @param deps - bo cong cu JSX/React/nguyen thu cua row.
 * @returns component hop thoai dang nhap va component buoc tai khoan cua Models.
 */
export function createSignInComponents(deps: RenderDeps): { SignInDialog: (props: SignInDialogProps) => unknown; AccountOnboarding: (props: AccountOnboardingProps) => unknown } {
  const { jsx, jsxs, Fragment } = deps.jsxRuntime;
  const { useState, useEffect } = deps.react;
  const { Modal, Button, IconCloseOutlineRegular, IconLoadingOutlineRegular } = deps.primitives;

  /**
   * Hop thoai uy quyen tai khoan; loi cho phep thu lai sau khi huy moi lan dang chay.
   * @param props - trang thai tai khoan an toan, ban dich va hanh dong cua nguoi dung.
   * @returns hop thoai dang nhap.
   */
  function SignInDialog({ account, colorScheme, start, cancel, close, useApiKey, t }: SignInDialogProps): unknown {
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const [copyResult, setCopyResult] = useState<{ messageKey: string } | null>(null);
    const attempt = account.view?.attempt;
    useEffect(() => {
      setCopyResult(null);
    }, [attempt?.id, attempt?.authorizeUrl]);
    useEffect(() => {
      if (copyResult === null) return;
      const timer = setTimeout(() => {
        setCopyResult(null);
      }, COPY_RESULT_MS);
      return () => {
        clearTimeout(timer);
      };
    }, [copyResult]);
    const authorizeUrl = attempt?.authorizeUrl;
    const phase = attempt?.phase;
    const active = busy || ACTIVE_PHASES.includes(phase ?? "");
    const expired = phase === "expired";
    const localFailure = failed || account.loginFailed === true || account.failed;
    const error = localFailure || phase === "failed";
    const failureKey = !localFailure && phase === "failed" && attempt?.errorCode === "no-response" ? "noResponse" : "failed";
    const waiting = active && !error;
    const committing = phase === "committing";
    useEffect(() => {
      if (account.view?.status === "credential-stored") close();
    }, [account.view?.status, close]);
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
    /** Dong hop thoai, huy lan dang chay neu can. */
    const dismiss = (): void => {
      if (committing || busy) return;
      if (active && attempt) void run(async () => {
        await cancel(attempt.id);
        close();
      });
      else close();
    };
    /** Huy lan cu roi bat dau lai. */
    const retry = async (): Promise<void> => {
      if (active && attempt) await cancel(attempt.id);
      await start();
    };
    /**
     * Sao chep lien ket uy quyen kem bang mau dang dung.
     * @param url - dia chi uy quyen.
     */
    const copyLink = async (url: string): Promise<void> => {
      try {
        await navigator.clipboard.writeText(authorizeUrlWithTheme(url, colorScheme));
        setCopyResult({ messageKey: "copiedLink" });
      } catch {
        setCopyResult({ messageKey: "copyFailed" });
      }
    };
    const title = error ? t("failureTitle") : active ? t("browserTitle") : expired ? t("timeoutTitle") : t("loginTitle");
    return jsxs(Modal, {
      open: true,
      headless: true,
      title,
      onClose: dismiss,
      className: signInDialogStyles.dialog,
      children: [
        jsxs("div", {
          className: signInDialogStyles.content,
          children: [
            jsxs("div", {
              className: signInDialogStyles.header,
              children: [
                jsx("h2", { className: signInDialogStyles.title, children: title }),
                jsx("button", {
                  type: "button",
                  className: signInDialogStyles.close,
                  "aria-label": t("close"),
                  onClick: dismiss,
                  children: jsx(IconCloseOutlineRegular, { size: 14 }),
                }),
              ],
            }),
            waiting
              ? jsxs("p", {
                  className: signInDialogStyles.description,
                  children: [
                    t("browserPrompt"),
                    jsx("button", {
                      type: "button",
                      className: signInDialogStyles.link,
                      disabled: !authorizeUrl,
                      onClick: authorizeUrl
                        ? () => {
                            void copyLink(authorizeUrl);
                          }
                        : undefined,
                      children: t(copyResult?.messageKey ?? "copyLink"),
                    }),
                    t("browserDescription"),
                  ],
                })
              : jsx("p", {
                  className: signInDialogStyles.description,
                  children: error ? t(failureKey) : expired ? t("timeoutDescription") : t("loginDescription"),
                }),
          ],
        }),
        jsxs("div", {
          className: signInDialogStyles.actions,
          children: [
            jsx(Button, {
              variant: "outline",
              className: signInDialogStyles.secondaryButton,
              disabled: committing || busy,
              onClick: active ? dismiss : useApiKey,
              children: t(active ? "cancel" : "addApiKey"),
            }),
            jsx(Button, {
              variant: "primary",
              className: signInDialogStyles.primaryButton,
              disabled: busy || committing || waiting || account.view === undefined,
              "aria-label": waiting ? t("waiting") : undefined,
              onClick: () => {
                void run(retry);
              },
              children: waiting ? jsx(IconLoadingOutlineRegular, { className: signInDialogStyles.spinner }) : t(expired || error ? "retry" : "signIn"),
            }),
          ],
        }),
      ],
    });
  }

  /**
   * Lua chon tai khoan trong buoc credential cua Models.
   * @param props - cach ket thuc buoc, trang thai tai khoan va hanh dong.
   * @returns hop thoai tai khoan khi chua dang nhap, hoac null.
   */
  function AccountOnboarding({ complete, useApiKey, useAccount, useTheme, setOnboarding, showLogin, start, cancel, t }: AccountOnboardingProps): unknown {
    const account = useAccount((value) => value);
    const colorScheme = useTheme((snapshot) => snapshot.active.colorScheme);
    useEffect(() => {
      setOnboarding(true);
      return () => {
        setOnboarding(false);
      };
    }, [setOnboarding]);
    useEffect(() => {
      if (account.view?.status === "credential-stored") complete();
    }, [account.view?.status, complete]);
    if (!account.view || account.view.status === "credential-stored") return null;
    return jsx(SignInDialog, {
      account,
      colorScheme,
      start,
      cancel,
      t,
      close: () => {
        showLogin(false);
        complete();
      },
      useApiKey: () => {
        showLogin(false);
        useApiKey();
      },
    });
  }

  void Fragment;
  return { SignInDialog, AccountOnboarding };
}
