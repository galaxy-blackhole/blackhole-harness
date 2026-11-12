/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Dong Language trong Settings: kho doi trang thai (mirror cua dich vu locale) + component Menu
 */

import { CLASS } from "./styles.ts";

/** Bảng hook React mà dòng Language dùng. */
export interface ReactHooks {
  /** Trả về cặp [giá trị, hàm đặt giá trị]. */
  useState<S>(initial: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void];
}

/** Bảng `react/jsx-runtime` (chỉ phần dùng). */
export interface JsxRuntime {
  /** Fragment của React. */
  Fragment: unknown;
  /** Dựng phần tử có một con. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Dựng phần tử có nhiều con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
}

/** Bảng `ui-primitives` (chỉ phần dòng Language dùng). */
export interface PrimitivesModule {
  /** Menu chọn (neo vào một nút). */
  Menu: unknown;
  /** Icon mũi tên xuống. */
  IconChevronDownOutlineRegular: unknown;
}

/** Bảng `client-store` (chỉ phần dùng). */
export interface ClientStoreModule {
  /**
   * Khai báo một kho có hành động.
   * Nhận: `definition` — `init` và `actions`.
   * Trả: handle kho để slot và `useStore` dùng.
   */
  defineStore(definition: {
    init(): Record<string, unknown>;
    actions: Record<string, (draft: Record<string, unknown>, ...args: unknown[]) => void>;
  }): unknown;
}

/** Giá trị chạy mà dòng Language cần. */
export interface LanguageRowRuntime {
  /** Hook React. */
  hooks: ReactHooks;
  /** jsx runtime. */
  jsx: JsxRuntime;
  /** Bảng ui-primitives. */
  primitives: PrimitivesModule;
  /** Bảng client-store. */
  store: ClientStoreModule;
}

/** Một lựa chọn ngôn ngữ trong menu. */
export interface LanguageOption {
  /** Id ngôn ngữ. */
  id: string;
  /** Nhãn hiển thị. */
  label: string;
}

/** Trạng thái kho của dòng Language. */
export interface LanguageRowState {
  /** Ngôn ngữ đang hiện. */
  active: string;
  /** Các lựa chọn. */
  options: LanguageOption[];
  /** Revision của bản chụp đã đồng bộ. */
  revision: number;
}

/** Props mà slot bind cho dòng Language. */
export interface LanguageRowProps {
  /** Hàm dịch namespace `settings.locale`. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Đặt ngôn ngữ đang hiện. */
  setLocale(id: string): void;
  /** Đọc kho trạng thái của dòng. */
  useStore<T>(selector: (state: LanguageRowState) => T): T;
}

/** Kho trạng thái + component của dòng Language. */
export interface LanguageRowViews {
  /** Khai báo kho để slot dùng. */
  store: unknown;
  /** Component dòng Language. */
  LanguageRow: (props: LanguageRowProps) => unknown;
}

/**
 * Khai báo kho trạng thái của dòng Language (gương của bản chụp dịch vụ locale).
 * Nhận: `runtime` — bảng client-store.
 * Trả: handle kho.
 */
export function createLanguageRowStore(runtime: LanguageRowRuntime): unknown {
  return runtime.store.defineStore({
    init: () => ({ active: "", options: [], revision: -1 }),
    actions: {
      sync: (draft, active, options, revision) => {
        if ((revision as number) <= (draft.revision as number)) return;
        draft.active = active;
        draft.options = options;
        draft.revision = revision;
      },
    },
  });
}

/**
 * Dựng component dòng Language với bộ giá trị chạy cho trước.
 * Nhận: `runtime` — hook React, jsx runtime, ui-primitives.
 * Trả: component dòng Language.
 */
export function createLanguageRow(runtime: LanguageRowRuntime): (props: LanguageRowProps) => unknown {
  const { hooks, primitives } = runtime;
  const { jsx, jsxs } = runtime.jsx;

  /**
   * Dòng Language: tiêu đề + nút chọn đang mở menu các ngôn ngữ có mặt.
   * Nhận: `props` — hàm dịch, hàm đặt ngôn ngữ và kho trạng thái của slot.
   * Trả: cây element React.
   */
  function LanguageRow(props: LanguageRowProps): unknown {
    const active = props.useStore((state) => state.active);
    const options = props.useStore((state) => state.options);
    const [open, setOpen] = hooks.useState(false);
    const activeLabel = options.find((option) => option.id === active)?.label ?? active;
    return jsxs("div", {
      className: CLASS.row,
      children: [
        jsx("div", {
          className: CLASS.rowText,
          children: jsx("div", { className: CLASS.title, children: props.t("language.title") }),
        }),
        jsx(primitives.Menu, {
          open,
          onClose: () => {
            setOpen(false);
          },
          items: options.map((option) => ({ id: option.id, label: option.label })),
          selectedId: active,
          onSelect: (id: string) => {
            props.setLocale(id);
            setOpen(false);
          },
          align: "end",
          portal: true,
          anchor: jsxs("button", {
            type: "button",
            className: CLASS.selector,
            "aria-haspopup": "menu",
            "aria-expanded": open,
            onClick: () => {
              setOpen((value) => !value);
            },
            children: [
              activeLabel,
              jsx(primitives.IconChevronDownOutlineRegular, { className: CLASS.chevron }),
            ],
          }),
        }),
      ],
    });
  }

  return LanguageRow;
}
