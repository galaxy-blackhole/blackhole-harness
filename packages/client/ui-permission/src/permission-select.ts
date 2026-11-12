/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chip quyen tren composer: chon preset cho PHIEN HIEN TAI (menu bung + hop xac nhan rui ro)
 */

import { SELECT_CLASS } from "./class-names.ts";
import { AUTO_REVIEW_PRESET, FULL_ACCESS_PRESET } from "./ids.ts";
import type { PermissionAccessKey } from "./locales.ts";
import {
  optionBadge,
  optionDescription,
  permissionLabel,
  type GlyphElement,
  type JsxFn,
} from "./presentation.ts";
import type { PermissionCatalog, PermissionCatalogState } from "./catalog.ts";
import type { JsxRuntime, ReactModule } from "./permission-row.ts";

/** Bam ui-primitives ma chip nay require. */
export interface SelectPrimitives {
  /** Menu bung dung chung (tu lo neo + portal). */
  Menu: unknown;
  /** Hop xac nhan rui ro dung chung. */
  RiskConfirmation: unknown;
  /** Mui ten xuong. */
  IconChevronDownOutlineRegular: unknown;
}

/** Props ma renderer bind cho chip (hook catalog + projection + hanh dong gui lenh). */
export interface PermissionSelectProps {
  /** Khi composer dang bi khoa (dang chay luot khac) thi chip khong cho bam. */
  locked: boolean;
  /** Gui mot preset qua duong lenh cua phien hien tai. */
  select: (preset: string) => Promise<boolean>;
  /** Hook doc catalog quyen dung chung cua tien trinh. */
  usePermissionCatalog: (select: (state: PermissionCatalogState) => PermissionCatalog | null) => PermissionCatalog | null;
  /** Hook doc projection cua mot phien; "permissions" tra gia tri quyen hien hanh. */
  useProjection: (name: string) => { currentValue: string } | undefined;
  /** Ham doc tu dien cua be mat phien hien tai. */
  t: (key: PermissionAccessKey, params?: Record<string, unknown>) => string;
}

/**
 * Noi hai ten lop khi can (thay cho clsx: bundle khong keo them thu vien).
 * Nhan: danh sach ten lop, bo qua gia tri rong.
 * Tra: chuoi ten lop da noi bang dau cach.
 */
function joinClasses(...names: readonly (string | false | undefined)[]): string {
  return names.filter((name): name is string => typeof name === "string" && name !== "").join(" ");
}

/**
 * Dung component chip quyen tren composer (ban goc: PermissionSelect).
 * Nhan: runtime JSX, phan React, ui-primitives va bang glyph cua bon preset.
 * Tra: component nhan props cua renderer — hoac null khi thieu projection/catalog.
 */
export function makePermissionSelect(
  runtime: JsxRuntime,
  react: ReactModule,
  primitives: SelectPrimitives,
  glyphs: ReadonlyMap<string, GlyphElement>,
): (props: PermissionSelectProps) => unknown {
  const { jsx, jsxs, Fragment } = runtime;
  const glyphOf = (value: string): GlyphElement | undefined => glyphs.get(value);

  return function PermissionSelect(props: PermissionSelectProps): unknown {
    const { t } = props;
    const selection = props.useProjection("permissions");
    const catalog = props.usePermissionCatalog((state) => state.value);
    const [pick, setPick] = react.useState<string | null>(null);
    const [open, setOpen] = react.useState(false);
    const [confirmation, setConfirmation] = react.useState<string | null>(null);
    const [acknowledged, setAcknowledged] = react.useState(false);

    react.useEffect(() => {
      const stillValid =
        !props.locked &&
        selection !== undefined &&
        catalog !== null &&
        (confirmation === null || catalog.options.some((option) => option.value === confirmation));
      if (stillValid) return;
      setOpen(false);
      setAcknowledged(false);
      setConfirmation(null);
    }, [catalog, confirmation, props.locked, selection]);

    if (selection === undefined || catalog === null) return null;

    const currentValue =
      pick !== null && catalog.options.some((option) => option.value === pick) ? pick : selection.currentValue;
    const current = catalog.options.find((option) => option.value === currentValue);
    const currentLabel =
      current === undefined
        ? permissionLabel(currentValue, currentValue, t)
        : permissionLabel(current.value, current.name, t);
    const busy = pick !== null || confirmation !== null;

    const items = catalog.options.map((option) => {
      const icon = glyphOf(option.value);
      const label = permissionLabel(option.value, option.name, t);
      const badge = optionBadge(option.value, t);
      return {
        id: option.value,
        label:
          badge === undefined
            ? label
            : jsxs("span", {
                className: SELECT_CLASS.optionLabel,
                "aria-label": label + " " + badge,
                children: [
                  jsx("span", { className: SELECT_CLASS.optionLabelText, children: label }),
                  jsx("span", { className: SELECT_CLASS.badge, children: badge }),
                ],
              }),
        ...(icon === undefined ? {} : { icon }),
      };
    });

    const submit = (id: string): void => {
      setPick(id);
      void props
        .select(id)
        .catch(() => false)
        .then(() => {
          setPick(null);
        });
    };
    const choose = (id: string): void => {
      setOpen(false);
      if (id === selection.currentValue) return;
      if (id === FULL_ACCESS_PRESET || id === AUTO_REVIEW_PRESET) {
        setAcknowledged(false);
        setConfirmation(id);
        return;
      }
      submit(id);
    };
    const closeConfirmation = (): void => {
      setAcknowledged(false);
      setConfirmation(null);
    };
    const isAuto = confirmation === AUTO_REVIEW_PRESET;

    const currentGlyph = glyphOf(currentValue);

    return jsxs(Fragment, {
      children: [
        jsx(primitives.Menu, {
          open,
          items,
          selectedId: currentValue,
          onSelect: choose,
          onClose: () => {
            setOpen(false);
          },
          side: "top",
          portal: true,
          anchor: jsxs("button", {
            type: "button",
            className: SELECT_CLASS.trigger,
            "aria-label": t("mode", { name: currentLabel }),
            title: current === undefined ? undefined : optionDescription(current, t),
            disabled: props.locked || busy,
            onClick: () => {
              setOpen(!open);
            },
            children: [
              currentGlyph !== undefined &&
                jsx("span", {
                  className: SELECT_CLASS.triggerIcon,
                  "aria-hidden": true,
                  children: currentGlyph,
                }),
              jsx("span", { className: SELECT_CLASS.triggerLabel, children: currentLabel }),
              jsx("span", {
                className: joinClasses(SELECT_CLASS.chevron, open && SELECT_CLASS.chevronOpen),
                "aria-hidden": true,
                children: jsx(primitives.IconChevronDownOutlineRegular, {}),
              }),
            ],
          }),
        }),
        confirmation !== null &&
          jsx(primitives.RiskConfirmation, {
            open: true,
            title: t(isAuto ? "auto.confirm.title" : "confirm.title"),
            description: t(isAuto ? "auto.confirm.description" : "confirm.description"),
            acknowledgeLabel: t(isAuto ? "auto.confirm.acknowledge" : "confirm.acknowledge"),
            cancelLabel: t("confirm.cancel"),
            closeLabel: t("close"),
            confirmLabel: t(isAuto ? "auto.confirm.enable" : "confirm.enable"),
            acknowledged,
            disabled: props.locked,
            onAcknowledgedChange: setAcknowledged,
            onCancel: closeConfirmation,
            onConfirm: () => {
              const id = confirmation;
              closeConfirmation();
              submit(id);
            },
          }),
      ],
    });
  };
}
