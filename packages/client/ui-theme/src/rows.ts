/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bon component cua row ui-theme — chuyen 1:1 tu AppearanceRow.js · FontSizeRow.js · FontFamilyRow.js
 *   · FontSettingsGroup.js cua bundle goc (lib/client.js dong 44-96 · 1168-1358)
 */

import { APPEARANCE_CLASS, FONT_FAMILY_CLASS, FONT_SIZE_CLASS, FONT_SETTINGS_GROUP_CLASS } from "./class-names.ts";
import type { ClassValue } from "./clsx.ts";
import { FONT_SIZE_SPECS, normalizeFontFamily } from "./theme-settings.ts";
import type { FontFamilies, FontRole, FontSizes } from "./theme-settings.ts";

/** Hàm dựng element của React JSX runtime. */
export type JsxFn = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => unknown;

/** Runtime JSX mà các component dùng. */
export interface RowsRuntime {
  /** Dựng một element. */
  jsx: JsxFn;
  /** Dựng nhiều con. */
  jsxs: JsxFn;
  /** Bọc nhiều con. */
  Fragment: unknown;
}

/** Hook React mà các component dùng. */
export interface RowsReact {
  /** State (có dạng cập nhật hàm như React thật — FontSettingsGroup dùng). */
  useState: <T>(initial: T) => [T, (next: T | ((previous: T) => T)) => void];
  /** Id ổn định. */
  useId: () => string;
}

/** Nguyên thuỷ của DSH mà bốn component dùng. */
export interface RowsPrimitives extends Record<string, unknown> {
  /** Icon giao diện sáng. */
  IconLightOutlineMedium: unknown;
  /** Icon giao diện tối. */
  IconDarkOutlineMedium: unknown;
  /** Icon theo hệ thống. */
  IconFollowsystemOutlineMedium: unknown;
  /** Ô nhập văn bản. */
  Input: unknown;
  /** Mũi tên lên. */
  IconChevronUpOutlineRegular: unknown;
  /** Mũi tên xuống. */
  IconChevronDownOutlineRegular: unknown;
}

/** Từ điển đã bind của namespace settings.theme. */
export type Dictionary = (key: string, params?: Record<string, unknown>) => string;

/** Phụ thuộc để dựng bốn component. */
export interface RowsDeps {
  /** Runtime JSX. */
  runtime: RowsRuntime;
  /** Hook React. */
  react: RowsReact;
  /** Nguyên thuỷ của DSH. */
  primitives: RowsPrimitives;
  /** Hàm ghép lớp có điều kiện (clsx của bản gốc). */
  clsx: (...inputs: readonly ClassValue[]) => string;
}

/** Props của hàng Appearance. */
export interface AppearanceRowProps {
  /** Từ điển. */
  t: Dictionary;
  /** Ghi tuỳ chọn theme. */
  setTheme(id: string): void;
  /** Hook đọc store của chỗ ngồi. */
  useStore: <T>(select: (state: { preference: string; revision: number }) => T) => T;
}

/** Props mà nhóm co font dùng chung cho các hàng con. */
export interface FontSharedProps {
  /** Từ điển. */
  t: Dictionary;
  /** Hook đọc store của chỗ ngồi. */
  useStore: <T>(select: (state: { fontSizes: FontSizes; fontFamilies: FontFamilies; revision: number }) => T) => T;
}

/** Props của một hàng cỡ chữ. */
export interface FontSizeRowProps extends FontSharedProps {
  /** Vai trò font. */
  role: FontRole;
  /** Ghi cỡ chữ. */
  setFontSize(px: number): void;
  /** Bộ mô tả nút mở rộng (chỉ hàng text). */
  expander?: { open: boolean; controls: string; onToggle(): void };
}

/** Props của một hàng danh sách font. */
export interface FontFamilyRowProps extends FontSharedProps {
  /** Vai trò font. */
  role: FontRole;
  /** Ghi danh sách font của vai trò. */
  setFontFamily(value: string): void;
}

/** Props của nhóm co font (chỗ ngồi trong slot). */
export interface FontSettingsGroupProps extends FontSharedProps {
  /** Ghi danh sách font của một vai trò. */
  setFontFamily(role: FontRole, value: string): void;
  /** Ghi cỡ chữ của một vai trò. */
  setFontSize(role: FontRole, px: number): void;
}

/** Bốn component mà apply đăng ký vào slot. */
export interface RowsComponents {
  /** Hàng ba khối giao diện. */
  AppearanceRow: (props: AppearanceRowProps) => unknown;
  /** Nhóm co font (mở rộng). */
  FontSettingsGroup: (props: FontSettingsGroupProps) => unknown;
  /** Một hàng cỡ chữ. */
  FontSizeRow: (props: FontSizeRowProps) => unknown;
  /** Một hàng danh sách font. */
  FontFamilyRow: (props: FontFamilyRowProps) => unknown;
}

/**
 * Dựng bốn component của row từ phụ thuộc do plugin gom (không import React trực tiếp).
 * Nhận: phụ thuộc — runtime JSX, hook React, nguyên thuỷ DSH, clsx.
 * Trả: { AppearanceRow, FontSettingsGroup, FontSizeRow, FontFamilyRow }.
 */
export function createRows(deps: RowsDeps): RowsComponents {
  const { runtime: jsxRuntime, react, primitives, clsx } = deps;
  const jsx = jsxRuntime.jsx;
  const jsxs = jsxRuntime.jsxs;

  /** Thứ tự khối và icon (figma 501:30015-30017: Light, Dark, System). */
  const CUBES = [
    { id: "light", labelKey: "appearance.light", Icon: primitives.IconLightOutlineMedium },
    { id: "dark", labelKey: "appearance.dark", Icon: primitives.IconDarkOutlineMedium },
    { id: "system", labelKey: "appearance.system", Icon: primitives.IconFollowsystemOutlineMedium },
  ];

  /**
   * Vẽ hàng Appearance: tiêu đề + ba khối chọn giao diện (chọn theo tuỳ chọn ĐÃ LƯU, không theo theme đang áp dụng).
   * Nhận: props — từ điển, động tử setTheme, hook store.
   * Trả: element hàng.
   */
  function AppearanceRow({ t, setTheme, useStore }: AppearanceRowProps): unknown {
    const preference = useStore((state) => state.preference);
    return jsxs("div", {
      className: APPEARANCE_CLASS.group,
      children: [
        jsx("div", { className: APPEARANCE_CLASS.title, children: t("appearance.title") }),
        jsx("div", {
          className: APPEARANCE_CLASS.cubeRow,
          children: CUBES.map(({ id, labelKey, Icon }) =>
            jsxs(
              "button",
              {
                type: "button",
                className: clsx(APPEARANCE_CLASS.themeCube, preference === id && APPEARANCE_CLASS.selected),
                "aria-pressed": preference === id,
                onClick: () => {
                  setTheme(id);
                },
                children: [jsx(Icon, {}), t(labelKey)],
              },
              id,
            ),
          ),
        }),
      ],
    });
  }

  /**
   * Vẽ một hàng danh sách font: tiêu đề + mô tả + ô nhập; blur/Enter chuẩn hoá rồi ghi, ô rỗng trả về stack dựng sẵn.
   * Nhận: props — từ điển, vai trò font, động tử setFontFamily, hook store.
   * Trả: element hàng.
   */
  function FontFamilyRow({ t, role, setFontFamily, useStore }: FontFamilyRowProps): unknown {
    const value = useStore((state) => state.fontFamilies[role]);
    const title = t("fontFamily." + role + ".title");
    /** Chuẩn hoá giá trị ngay trên ô nhập rồi ghi (bản gốc: input.value = normalizeFontFamily(input.value)). */
    const commit = (input: { value: string }): void => {
      input.value = normalizeFontFamily(input.value);
      setFontFamily(input.value);
    };
    return jsxs("div", {
      className: FONT_SIZE_CLASS.row,
      children: [
        jsxs("div", {
          className: FONT_SIZE_CLASS.rowText,
          children: [
            jsx("div", { className: FONT_SIZE_CLASS.title, children: title }),
            jsx("div", { className: FONT_SIZE_CLASS.desc, children: t("fontFamily." + role + ".description") }),
          ],
        }),
        jsx(
          primitives.Input,
          {
            className: FONT_FAMILY_CLASS.field,
            defaultValue: value,
            placeholder: t("fontFamily.placeholder"),
            "aria-label": title,
            spellCheck: false,
            autoComplete: "off",
            onBlur: (event: { currentTarget: { value: string } }) => {
              commit(event.currentTarget);
            },
            maxLength: 200,
            onKeyDown: (event: { nativeEvent: { isComposing: boolean; keyCode: number }; key: string; currentTarget: { blur(): void } }) => {
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
              if (event.key === "Enter") event.currentTarget.blur();
            },
          },
          value,
        ),
      ],
    });
  }

  /**
   * Vẽ một hàng cỡ chữ: tiêu đề + mô tả + viên giá trị (mũi tên hiện khi hover) + nhãn px + nút mở rộng.
   * Nhận: props — từ điển, vai trò font, động tử setFontSize, hook store, bộ mô tả nút mở rộng.
   * Trả: element hàng.
   */
  function FontSizeRow({ t, role, setFontSize, useStore, expander }: FontSizeRowProps): unknown {
    const fontSize = useStore((state) => state.fontSizes[role]);
    const { min, max } = FONT_SIZE_SPECS[role];
    return jsxs("div", {
      className: FONT_SIZE_CLASS.row,
      children: [
        jsxs("div", {
          className: FONT_SIZE_CLASS.rowText,
          children: [
            jsx("div", { className: FONT_SIZE_CLASS.title, children: t("fontSize." + role + ".title") }),
            jsx("div", { className: FONT_SIZE_CLASS.desc, children: t("fontSize." + role + ".description") }),
          ],
        }),
        jsxs("div", {
          className: FONT_SIZE_CLASS.control,
          children: [
            jsxs("div", {
              className: FONT_SIZE_CLASS.stepper,
              children: [
                jsx("span", { className: FONT_SIZE_CLASS.value, children: fontSize }),
                jsxs("span", {
                  className: FONT_SIZE_CLASS.arrows,
                  children: [
                    jsx("button", {
                      type: "button",
                      className: FONT_SIZE_CLASS.arrow,
                      "aria-label": t("fontSize." + role + ".increase"),
                      disabled: fontSize >= max,
                      onClick: () => {
                        setFontSize(fontSize + 1);
                      },
                      children: jsx(primitives.IconChevronUpOutlineRegular, { size: 9 }),
                    }),
                    jsx("button", {
                      type: "button",
                      className: FONT_SIZE_CLASS.arrow,
                      "aria-label": t("fontSize." + role + ".decrease"),
                      disabled: fontSize <= min,
                      onClick: () => {
                        setFontSize(fontSize - 1);
                      },
                      children: jsx(primitives.IconChevronDownOutlineRegular, { size: 9 }),
                    }),
                  ],
                }),
              ],
            }),
            jsx("span", { className: FONT_SIZE_CLASS.unit, children: t("fontSize.unit") }),
            expander !== undefined &&
              jsx("button", {
                type: "button",
                className: FONT_SIZE_CLASS.expander,
                "aria-label": t("fontSize.more"),
                title: t("fontSize.more"),
                "aria-expanded": expander.open,
                "aria-controls": expander.controls,
                onClick: expander.onToggle,
                children: jsx(primitives.IconChevronDownOutlineRegular, { size: 12 }),
              }),
          ],
        }),
      ],
    });
  }

  /**
   * Vẽ hàng cỡ chữ text + vùng mở rộng (font của cả ba vai trò + cỡ chữ code/terminal); vùng bắt đầu THU GỌN.
   * Nhận: props — từ điển, hook store, hai động tử ghi.
   * Trả: element nhóm.
   */
  function FontSettingsGroup({ setFontFamily, setFontSize, ...shared }: FontSettingsGroupProps): unknown {
    const [open, setOpen] = react.useState(false);
    const regionId = react.useId();
    /** Một hàng danh sách font cho vai trò. */
    const family = (role: FontRole): unknown =>
      jsx(FontFamilyRow, {
        ...shared,
        role,
        setFontFamily: (value: string) => {
          setFontFamily(role, value);
        },
      });
    /** Một hàng cỡ chữ cho vai trò (kèm bộ mô tả nút mở rộng khi cần). */
    const size = (role: FontRole, expander?: FontSizeRowProps["expander"]): unknown =>
      jsx(FontSizeRow, {
        ...shared,
        role,
        ...(expander === undefined ? {} : { expander }),
        setFontSize: (px: number) => {
          setFontSize(role, px);
        },
      });
    return jsxs("div", {
      className: FONT_SETTINGS_GROUP_CLASS.group,
      children: [
        size("text", {
          open,
          controls: regionId,
          onToggle: () => {
            setOpen((value) => !value);
          },
        }),
        open &&
          jsxs("div", {
            id: regionId,
            children: [family("text"), family("code"), size("code"), family("terminal"), size("terminal")],
          }),
      ],
    });
  }

  return { AppearanceRow, FontSettingsGroup, FontSizeRow, FontFamilyRow };
}
