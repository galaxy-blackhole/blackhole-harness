/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Thẻ hiển thị một credential đã che, kèm nút hiện/che khi văn bản cho tương tác
 */

import type { MaskedSecretNode } from "./types.ts";

/** Thân mắt thường (giữ nguyên SVG gốc của DSH). */
const EYE_CONTOUR =
  "M1.5 8C2.9 5.25 5.25 3.5 8 3.5C10.75 3.5 13.1 5.25 14.5 8C13.1 10.75 10.75 12.5 8 12.5C5.25 12.5 2.9 10.75 1.5 8Z";
/** Mắt có con ngươi. */
const EYE_PATH = EYE_CONTOUR + "M10 8C10 9.1 9.1 10 8 10C6.9 10 6 9.1 6 8C6 6.9 6.9 6 8 6C9.1 6 10 6.9 10 8Z";
/** Glyph gạch chéo bỏ con ngươi để vẫn khác biệt ở cỡ chữ nhỏ. */
const EYE_OFF_PATH = EYE_CONTOUR + "M2.5 2.5L13.5 13.5";

/** Mặt nạ vẽ bằng mask SVG: ba nét gạch chéo trong một ô 12x20. */
const MASK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 20'%3E%3Cpath d='M6 5.6v8.8M2.19 7.8l7.62 4.4M2.19 12.2l7.62-4.4' stroke='%23000' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E";

/** CSS của thẻ, viết theo token --dsw-* của DSH. */
export const SECRET_TEXT_CSS = [
  ".gbhSecret{box-sizing:border-box;max-width:100%;font-family:var(--ds-font-family-code);align-items:center;margin:0 2px;font-size:.875em;display:inline-flex}",
  ".gbhSecret_value{overflow-wrap:anywhere;min-width:0}",
  ".gbhSecret_mask{-webkit-text-fill-color:transparent;background-color:currentColor;-webkit-mask:url(\"" +
    MASK_IMAGE +
    "\") 0/1ch 100% repeat-x;mask:url(\"" +
    MASK_IMAGE +
    "\") 0/1ch 100% repeat-x}",
  ".gbhSecret_mask,.gbhSecret_toggle{position:relative;top:-.125em}",
  ".gbhSecret_toggle{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;flex:none;align-items:center;padding:0;display:inline-flex}",
  ".gbhSecret_toggle:hover{color:var(--dsw-alias-label-primary)}",
  ".gbhSecret_toggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px;border-radius:var(--dsw-radius-xs)}",
  ".gbhSecret_icon{width:1em;height:1em}",
].join("");

/** Tên lớp của thẻ này. */
const CSS = Object.freeze({
  icon: "gbhSecret_icon",
  mask: "gbhSecret_mask",
  secret: "gbhSecret_secret",
  toggle: "gbhSecret_toggle",
  value: "gbhSecret_value",
});

/** Id của thẻ style để không chèn hai lần. */
const CSS_TAG_ID = "@galaxy-blackhole/gbh-client-ui-secret-mask/SecretText.module.css";

/** Hàm dựng phần tử của jsx runtime. */
export interface JsxRuntimeLike {
  /** Một phần tử con. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Nhiều phần tử con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
}

/** Module react mà thẻ này dùng. */
export interface ReactLike {
  /** Hook trạng thái. */
  useState<T>(initial?: T): [T | undefined, (value: T | undefined) => void];
}

/** Props renderer bơm cho thẻ này. */
export interface SecretTextProps {
  /** Node đã nhận ra credential. */
  node: MaskedSecretNode;
  /** Chữ gốc của node. */
  raw: string;
  /** Văn bản này có cho tương tác hay không. */
  interactive?: boolean;
  /** Hàm đọc từ điển đã bind namespace. */
  t: (key: "secret.reveal" | "secret.hide") => string;
}

/**
 * Chèn CSS của thẻ một lần vào document (không làm gì khi không có document, ví dụ lúc test).
 * Nhận: không.
 * Trả: không.
 */
export function ensureSecretTextCss(): void {
  if (typeof document === "undefined") return;
  const existing = document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG_ID) + "]");
  if (existing !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-secret-mask";
  tag.dataset.pluginCss = CSS_TAG_ID;
  tag.textContent = SECRET_TEXT_CSS;
  document.head.appendChild(tag);
}

/**
 * Dựng hàm render thẻ SecretText từ các module do bảng module cấp.
 * Nhận: jsx runtime và module react.
 * Trả: hàm render nhận props — một run đã che, kèm nút hiện/che khi văn bản cho tương tác.
 */
export function createSecretText(
  runtime: JsxRuntimeLike,
  react: ReactLike,
): (props: SecretTextProps) => unknown {
  const { jsx, jsxs } = runtime;
  /**
   * Glyph con mắt.
   * Nhận: đường vẽ path.
   * Trả: phần tử svg.
   */
  const eyeGlyph = (path: string): unknown =>
    jsx("svg", {
      className: CSS.icon,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.3,
      strokeLinecap: "round",
      "aria-hidden": "true",
      children: jsx("path", { d: path }),
    });
  /**
   * Chia dạng đã che thành chữ giữ nguyên và các run dấu.
   * Run dấu giữ ký tự gốc cho việc sao chép và trình đọc màn hình nhưng vẽ dấu ở giữa dòng.
   * Nhận: chuỗi đã che.
   * Trả: mảng phần tử con.
   */
  const maskedText = (masked: string): unknown[] => {
    let offset = 0;
    const parts: unknown[] = [];
    for (const part of masked.split(/(\*+)/u)) {
      const key = offset;
      offset += part.length;
      if (part === "") continue;
      parts.push(
        part.startsWith("*")
          ? jsx("span", { className: CSS.mask, children: part }, key)
          : jsx("span", { children: part }, key),
      );
    }
    return parts;
  };
  return (props: SecretTextProps): unknown => {
    const [revealedRaw, setRevealedRaw] = react.useState<string>();
    const revealed = props.interactive === true && revealedRaw === props.raw;
    return jsxs("span", {
      className: CSS.secret,
      "data-secret": "",
      children: [
        jsx(
          "span",
          { className: CSS.value, children: revealed ? props.raw : maskedText(props.node.data.masked) },
          "value",
        ),
        props.interactive === true
          ? jsx(
              "button",
              {
                type: "button",
                className: CSS.toggle,
                "aria-pressed": revealed,
                "aria-label": props.t(revealed ? "secret.hide" : "secret.reveal"),
                onClick: () => {
                  setRevealedRaw(revealed ? undefined : props.raw);
                },
                children: eyeGlyph(revealed ? EYE_OFF_PATH : EYE_PATH),
              },
              "toggle",
            )
          : null,
      ],
    });
  };
}
