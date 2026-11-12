/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hang "Quyen" trong Settings > General: chon preset mac dinh cho cac phien tao sau
 */

import { ROW_CLASS } from "./class-names.ts";
import { FULL_ACCESS_PRESET } from "./ids.ts";
import type { SettingsPermissionKey } from "./locales.ts";
import { displayPermissionPreset, type JsxFn } from "./presentation.ts";
import type { PermissionSettingsState } from "./settings-store.ts";

/** Bam JSX day du (jsx + jsxs + Fragment) ma runtime cap. */
export interface JsxRuntime {
  /** Dung mot element. */
  jsx: JsxFn;
  /** Dung element co nhieu con dang mang. */
  jsxs: JsxFn;
  /** Node Fragment. */
  Fragment: unknown;
}

/** Phan React ma hang nay dung. */
export interface ReactModule {
  /** State cua React (ham set nhan CA gia tri lan ham cap nhat, dung nhu React that). */
  useState<T>(initial: T): [T, (next: T | ((previous: T) => T)) => void];
  /** Hieu ung vong doi cua React. */
  useEffect(run: () => void | (() => void), deps?: readonly unknown[]): void;
}

/** Bam ui-primitives ma hang nay require. */
export interface RowPrimitives {
  /** Menu bung dung chung (tu lo portal, neo, dong khi bam ra ngoai). */
  Menu: unknown;
  /** Hop xac nhan rui ro dung chung. */
  RiskConfirmation: unknown;
  /** Mui ten xuong. */
  IconChevronDownOutlineRegular: unknown;
}

/** Props ma renderer bind cho hang (hook tu inject() + copy + hai hanh dong). */
export interface PermissionRowProps {
  /** Hook doc anh chup hang cai dat; ten do khoa "permission" trong inject() quyet dinh. */
  usePermission: (select: (snapshot: PermissionSettingsState) => PermissionSettingsState) => PermissionSettingsState;
  /** Tai descriptor khi hang hien lan dau. */
  load: () => Promise<void>;
  /** Ghi mot preset duoc cong bo lam mac dinh cho phien moi. */
  select: (preset: string) => Promise<void>;
  /**
   * Ham doc tu dien cua hang.
   * Co ca khoa "close" vi BAN GOC cung hoi khoa do o namespace settings.permission (tu dien do khong co
   * khoa nay) — giu nguyen de nhan nut dong ra GIONG HET ban goc, khong tu sua thanh confirm.cancel.
   */
  t: (key: SettingsPermissionKey | "close") => string;
}

/**
 * Dung component cua hang "Quyen" trong Settings > General.
 * Nhan: runtime JSX, phan React va ui-primitives (lay luc vat chat hoa factory).
 * Tra: component nhan props cua renderer — hoac null khi Host khong cong bo cai dat quyen.
 */
export function makePermissionRow(
  runtime: JsxRuntime,
  react: ReactModule,
  primitives: RowPrimitives,
): (props: PermissionRowProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;

  return function PermissionRow(props: PermissionRowProps): unknown {
    const { t } = props;
    const state = props.usePermission((snapshot) => snapshot);
    const [open, setOpen] = react.useState(false);
    const [confirmingFullAccess, setConfirmingFullAccess] = react.useState(false);
    const [acknowledged, setAcknowledged] = react.useState(false);

    react.useEffect(() => {
      void props.load();
    }, [props.load]);
    react.useEffect(() => {
      if (state.writable && state.status !== "unavailable") return;
      setOpen(false);
      setAcknowledged(false);
      setConfirmingFullAccess(false);
    }, [state.status, state.writable]);

    if (state.status === "unavailable") return null;

    const selected = state.options.find((option) => option.id === state.currentValue);
    const busy = state.status === "loading" || state.status === "saving" || confirmingFullAccess;
    const optionLabel = (option: { id: string; label: string }): string =>
      displayPermissionPreset(option.id, option.label, (key) => t(key));
    const label = selected !== undefined ? optionLabel(selected) : busy ? t("loading") : t("unavailable");
    const description = state.error ?? t("description");

    return jsxs(Fragment, {
      children: [
        jsxs("div", {
          className: ROW_CLASS.row,
          children: [
            jsxs("div", {
              className: ROW_CLASS.rowText,
              children: [
                jsx("div", { className: ROW_CLASS.title, children: t("title") }),
                jsx("div", {
                  className: ROW_CLASS.desc,
                  role: state.error === null ? undefined : "alert",
                  children: description,
                }),
              ],
            }),
            jsx(primitives.Menu, {
              open,
              onClose: () => {
                setOpen(false);
              },
              items: state.options.map((option) => ({ id: option.id, label: optionLabel(option) })),
              selectedId: state.currentValue,
              onSelect: (id: string) => {
                setOpen(false);
                if (id === state.currentValue) return;
                if (id === FULL_ACCESS_PRESET) {
                  setAcknowledged(false);
                  setConfirmingFullAccess(true);
                  return;
                }
                void props.select(id);
              },
              align: "end",
              portal: true,
              anchor: jsxs("button", {
                type: "button",
                className: ROW_CLASS.selector,
                "aria-haspopup": "menu",
                "aria-expanded": open,
                disabled: busy || !state.writable || state.options.length === 0,
                onClick: () => {
                  setOpen((value) => !value);
                },
                children: [
                  label,
                  jsx(primitives.IconChevronDownOutlineRegular, { className: ROW_CLASS.chevron }),
                ],
              }),
            }),
          ],
        }),
        jsx(primitives.RiskConfirmation, {
          open: confirmingFullAccess,
          title: t("confirm.title"),
          description: t("confirm.description"),
          acknowledgeLabel: t("confirm.acknowledge"),
          cancelLabel: t("confirm.cancel"),
          closeLabel: t("close"),
          confirmLabel: t("confirm.enable"),
          acknowledged,
          disabled: !state.writable || state.status === "saving",
          onAcknowledgedChange: setAcknowledged,
          onCancel: () => {
            setAcknowledged(false);
            setConfirmingFullAccess(false);
          },
          onConfirm: () => {
            setAcknowledged(false);
            setConfirmingFullAccess(false);
            void props.select(FULL_ACCESS_PRESET);
          },
        }),
      ],
    });
  };
}
