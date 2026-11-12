/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nut mo dung chung cho tep va thu muc: mot hanh dong mac dinh, menu ung dung, bao loi theo cu chi
 */

import { CLASS } from "./styles.ts";
import type { OpenInAppPathFailure } from "./controller.ts";
import type { JsxRuntimeLike, PrimitivesLike, ReactLike, ShortcutCatalogEntry } from "./types.ts";

/** Mot ung dung hien tren nut: id danh muc, ten da dich, icon da resolve. */
export interface OpenTargetApplication {
  /** Id trong danh muc cua Host. */
  readonly id: string;
  /** Ten hien thi (da dich). */
  readonly name: string;
  /** Dia chi icon, hoac null khi khong co. */
  readonly icon: string | null;
}

/** Y dinh cua mot lan bam nut; lua chon mac dinh van thuoc ve adapter cua dich. */
export type OpenTargetOperation =
  | { readonly kind: "default" }
  | { readonly kind: "application"; readonly id: string }
  | { readonly kind: "reveal" };

/** Ham dich cua namespace `open-in-app`. */
export type TranslateLike = (key: string, params?: Record<string, string>) => string;

/** Props cua {@link OpenTargetParts.OpenTargetButton} — dung chung cho ca hai adapter. */
export interface OpenTargetButtonProps {
  /** Loai dich: tep hay thu muc. */
  readonly kind: "file" | "directory";
  /** Ung dung kha dung (da loc theo ten dat duoc). */
  readonly applications: readonly OpenTargetApplication[];
  /** Id ung dung mac dinh (undefined khi khong co). */
  readonly defaultId: string | undefined;
  /** Lan doc hiep tro that bai (hien dong "khong lay duoc danh sach"). */
  readonly failed: boolean;
  /** Co thao tac nao dang chay khong. */
  readonly busy?: boolean;
  /** Con dang doc danh muc lan dau khong. */
  readonly loading?: boolean;
  /** Bien the lon co nhan (trang thai rong cua tai lieu khong xem truoc duoc). */
  readonly prominent?: boolean;
  /** Muc phim tat da resolve cua lenh mo workspace. */
  readonly shortcut?: Pick<ShortcutCatalogEntry, "keys" | "aria"> | undefined;
  /** Ham dich cua namespace. */
  readonly t: TranslateLike;
  /** Chay mot y dinh; tra loai loi de thong bao, hoac null khi thanh cong. */
  readonly execute: (operation: OpenTargetOperation) => Promise<OpenInAppPathFailure | null>;
  /** Doc lai danh muc ung dung truoc khi mo menu. */
  readonly refresh?: (() => void) | undefined;
}

/** Bang ham ma {@link makeOpenTarget} tra ve. */
export interface OpenTargetParts {
  /**
   * Bang bao loi thuoc ve chinh control da kich hoat cu chi.
   * Nhan: khong co.
   * Tra: `toast` cua control va `show` de thong bao mot lan that bai (goi lai thi phat lai bang).
   */
  useOpenFailureToast(): { toast: unknown; show: (text: string) => void };
  /**
   * Noi tiep cac cu chi va thong bao that bai qua toast cua control da kich hoat.
   * Nhan: execute — adapter cua dich, tra loi de thong bao hoac null; t — chu da dich.
   * Tra: trang thai dang cho, phan hoi, va ham hanh dong da chan do.
   */
  useOpenTargetGesture(
    execute: OpenTargetButtonProps["execute"],
    t: TranslateLike,
  ): { pending: boolean; toast: unknown; act: (operation: OpenTargetOperation) => void };
  /**
   * Mot anh ung dung voi fallback rieng tung anh, dung chung cho nut chinh va menu.
   * Nhan: props.source — dia chi anh hoac null; props.size — canh icon.
   * Tra: element anh, hoac bieu tuong mo ra ngoai khi thieu anh.
   */
  ApplicationIcon(props: { source: string | null; size?: number }): unknown;
  /**
   * Ve hai nut ghep giong nhau cho tep va thu muc. Muc "hien vi tri tep" luon o cuoi;
   * no la mac dinh chi khi khong co ung dung nao duoc dang ky.
   * Nhan: props — danh muc ung dung, lua chon mac dinh, va cac thao tac.
   * Tra: control va phan hoi that bai tam thoi cua no.
   */
  OpenTargetButton(props: OpenTargetButtonProps): unknown;
}

/**
 * Dung bo ba nguyen tu cua nut mo (toast loi, cu chi, nut ghep) tren runtime cua bang module.
 * Nhan: jsxRuntime — `react/jsx-runtime`; react — `react`; primitives — `@galaxy-blackhole/gbh-client-ui-primitives`.
 * Tra: bang ham {@link OpenTargetParts}.
 */
export function makeOpenTarget(
  jsxRuntime: JsxRuntimeLike,
  react: ReactLike,
  primitives: PrimitivesLike,
): OpenTargetParts {
  const jsx = jsxRuntime.jsx;
  const jsxs = jsxRuntime.jsxs;
  const Fragment = jsxRuntime.Fragment;

  /** Bang bao loi thuoc ve chinh control da kich hoat cu chi. */
  function useOpenFailureToast(): { toast: unknown; show: (text: string) => void } {
    const seq = react.useRef(0);
    const [banner, setBanner] = react.useState<{ seq: number; text: string } | null>(null);
    const dismiss = react.useCallback(() => {
      setBanner(null);
    }, []);
    return {
      toast:
        banner === null
          ? null
          : jsx(
              primitives.Toast,
              {
                text: banner.text,
                icon: jsx(primitives.IconWarningOutlineRegular, {}),
                onDone: dismiss,
              },
              banner.seq,
            ),
      show: (text: string) => {
        seq.current += 1;
        setBanner({ seq: seq.current, text });
      },
    };
  }

  /** Noi tiep cac cu chi va thong bao that bai qua toast cua control da kich hoat. */
  function useOpenTargetGesture(
    execute: OpenTargetButtonProps["execute"],
    t: TranslateLike,
  ): { pending: boolean; toast: unknown; act: (operation: OpenTargetOperation) => void } {
    const [pending, setPending] = react.useState(false);
    const inFlight = react.useRef(false);
    const { toast, show } = useOpenFailureToast();
    return {
      pending,
      toast,
      act: (operation: OpenTargetOperation) => {
        if (inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        execute(operation)
          .then((failure) => {
            if (failure !== null) show(t("path." + failure));
          })
          .finally(() => {
            inFlight.current = false;
            setPending(false);
          });
      },
    };
  }

  /** Mot anh ung dung voi fallback rieng tung anh. */
  function ApplicationIcon(props: { source: string | null; size?: number }): unknown {
    const [failed, setFailed] = react.useState(false);
    const size = props.size ?? 14;
    if (props.source === null || failed) return jsx(primitives.IconRightUpOutlineRegular, { size });
    return jsx("img", {
      src: props.source,
      width: size,
      height: size,
      className: CLASS.appIcon,
      alt: "",
      draggable: false,
      onError: () => {
        setFailed(true);
      },
    });
  }

  /** Nut ghep: mot hanh dong mac dinh, menu ung dung, va phan hoi theo tung cu chi. */
  function OpenTargetButton(props: OpenTargetButtonProps): unknown {
    const { applications, defaultId, kind, t } = props;
    const [menuOpen, setMenuOpen] = react.useState(false);
    const { pending, toast, act } = useOpenTargetGesture(props.execute, t);
    const preferred =
      kind === "file"
        ? applications.find((app) => app.id === defaultId) ?? applications[0]
        : applications.find((app) => app.id === defaultId);
    const disabled = pending || props.busy === true || props.loading === true;
    const hasMenu = props.loading === true || props.failed || applications.length + (kind === "file" ? 1 : 0) > 1;
    const revealDefault = kind === "file" && preferred === undefined && props.loading !== true;
    const primaryLabel = preferred === undefined ? t("path.reveal") : t("open.title", { app: preferred.name });
    const size = props.prominent === true ? 18 : 13;
    const run = (operation: OpenTargetOperation): void => {
      setMenuOpen(false);
      act(operation);
    };
    const primary = (): void => {
      if (revealDefault) {
        run({ kind: "reveal" });
        return;
      }
      if (preferred !== undefined && preferred.id !== defaultId) {
        run({ kind: "application", id: preferred.id });
        return;
      }
      run({ kind: "default" });
    };
    const icon =
      props.loading === true && preferred === undefined
        ? jsx("span", {
            className: CLASS.skeleton,
            "data-open-target-skeleton": true,
            "aria-hidden": "true",
            style: { width: size, height: size },
          })
        : revealDefault
          ? jsx(primitives.IconFolderOpenOutlineRegular, { size })
          : jsx(ApplicationIcon, { source: preferred?.icon ?? null, size }, preferred?.icon);
    return jsxs(Fragment, {
      children: [
        jsx(primitives.Menu, {
          className: CLASS.menuAnchor,
          open: menuOpen && !disabled && hasMenu,
          autoFocus: true,
          portal: true,
          dense: true,
          align: "end",
          onClose: () => {
            setMenuOpen(false);
          },
          items: [
            ...applications.map((app) => ({
              id: "app:" + app.id,
              icon: jsx(ApplicationIcon, { source: app.icon }, app.icon),
              label: app.id === preferred?.id ? t("path.appDefault", { app: app.name }) : app.name,
            })),
            ...(props.failed ? [{ id: "unavailable", label: t("path.appsError"), disabled: true }] : []),
          ],
          footer:
            kind === "file"
              ? [
                  {
                    id: "reveal",
                    icon: jsx(primitives.IconFolderOpenOutlineRegular, {}),
                    label: revealDefault ? t("path.appDefault", { app: t("path.reveal") }) : t("path.reveal"),
                  },
                ]
              : [],
          onSelect: (id: string) => {
            run(id === "reveal" ? { kind: "reveal" } : { kind: "application", id: id.slice(4) });
          },
          anchor: jsxs("div", {
            className: CLASS.split,
            "data-open-target": kind,
            "data-size": props.prominent === true ? "large" : "compact",
            "data-open-path": kind === "file" && props.prominent !== true ? "" : undefined,
            "data-state": disabled ? "busy" : "idle",
            children: [
              jsx(primitives.Tooltip, {
                portal: true,
                label: primaryLabel,
                shortcutKeys: props.shortcut?.keys,
                side: "bottom",
                delayMs: 500,
                children: jsxs("button", {
                  type: "button",
                  className: CLASS.main,
                  disabled,
                  "aria-label": props.prominent === true ? undefined : primaryLabel,
                  "aria-keyshortcuts": props.shortcut?.aria,
                  "data-open-path-open": kind === "file" && props.prominent !== true ? "" : undefined,
                  "data-open-path-unpreviewable": props.prominent === true ? "" : undefined,
                  onClick: primary,
                  children: [icon, props.prominent === true && (revealDefault ? t("path.reveal") : t("path.open"))],
                }),
              }),
              hasMenu &&
                jsx("button", {
                  type: "button",
                  className: CLASS.chevron,
                  disabled,
                  "aria-haspopup": "menu",
                  "aria-expanded": menuOpen && !disabled,
                  "aria-label": t("path.more"),
                  "data-open-path-more": kind === "file" && props.prominent !== true ? "" : undefined,
                  onClick: () => {
                    if (!menuOpen) props.refresh?.();
                    setMenuOpen((value) => !value);
                  },
                  children: jsx(primitives.IconChevronDownOutlineRegular, { size: props.prominent === true ? 14 : 10 }),
                }),
            ],
          }),
        }),
        toast,
      ],
    });
  }

  return { useOpenFailureToast, useOpenTargetGesture, ApplicationIcon, OpenTargetButton };
}
