/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Muoi anh cua buoc gioi thieu Desktop, do build.ts nhung nguyen van thanh data URI (giu nguyen tung byte)
 */

/** Anh do build.ts nhung bang define; chay tu nguon (test) thi tra chuoi rong. */
declare const __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_DARK__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_ZH__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_ZH_DARK__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_DARK__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_ZH__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_ZH_DARK__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ASSET_OFFICE__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ASSET_CODE__: string;

/**
 * Doc mot hang anh da nhung, chiu duoc truong hop chay tu nguon (khong co define).
 * @param value - gia tri da nhung.
 * @returns data URI, hoac chuoi rong.
 */
function uri(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Anh man chao theo ngon ngu va che do sang/toi — nguyen van ban goc. */
export const WELCOME_ARTWORK = {
  /** Ban tieng Anh, che do sang. */
  light: uri(typeof __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME__ : ""),
  /** Ban tieng Anh, che do toi. */
  dark: uri(typeof __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_DARK__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_DARK__ : ""),
  /** Ban tieng Trung, che do sang. */
  lightZh: uri(typeof __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_ZH__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_ZH__ : ""),
  /** Ban tieng Trung, che do toi. */
  darkZh: uri(typeof __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_ZH_DARK__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ASSET_WELCOME_ZH_DARK__ : ""),
} as const;

/** Anh buoc nap tien theo ngon ngu va che do sang/toi — nguyen van ban goc. */
export const RECHARGE_ARTWORK = {
  /** Ban tieng Anh, che do sang. */
  light: uri(typeof __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE__ : ""),
  /** Ban tieng Anh, che do toi. */
  dark: uri(typeof __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_DARK__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_DARK__ : ""),
  /** Ban tieng Trung, che do sang. */
  lightZh: uri(typeof __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_ZH__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_ZH__ : ""),
  /** Ban tieng Trung, che do toi. */
  darkZh: uri(typeof __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_ZH_DARK__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ASSET_RECHARGE_ZH_DARK__ : ""),
} as const;

/** Hai bieu tuong the muc dich — nguyen van ban goc. */
export const PURPOSE_ARTWORK = {
  /** Bieu tuong nhom cong viec van phong. */
  office: uri(typeof __GBH_UI_SETTINGS_ACCOUNT_ASSET_OFFICE__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ASSET_OFFICE__ : ""),
  /** Bieu tuong nhom cong viec lap trinh. */
  code: uri(typeof __GBH_UI_SETTINGS_ACCOUNT_ASSET_CODE__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ASSET_CODE__ : ""),
} as const;

/** Ba bieu tuong cua buoc chon muc do chi tiet — nguyen van ban goc (base64 nhung thang trong bundle goc). */
export const PROCESS_ICONS = {
  /** Bieu tuong "chi ket qua". */
  compact: "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgNDAgNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJFeGl0RnVsbHNjcmVlbkdseXBoIDEiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNMjIuNSA2LjI1VjE1QzIyLjUgMTUuNjYzIDIyLjc2MzQgMTYuMjk4OSAyMy4yMzIyIDE2Ljc2NzhDMjMuNzAxMSAxNy4yMzY2IDI0LjMzNyAxNy41IDI1IDE3LjVIMzMuNzUiIHN0cm9rZT0iIzgzNzBGMSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGlkPSJWZWN0b3JfMiIgZD0iTTE3LjUgMzMuNzVWMjVDMTcuNSAyNC4zMzcgMTcuMjM2NiAyMy43MDExIDE2Ljc2NzggMjMuMjMyMkMxNi4yOTg5IDIyLjc2MzQgMTUuNjYzIDIyLjUgMTUgMjIuNUg2LjI1IiBzdHJva2U9IiM4MzcwRjEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L2c+Cjwvc3ZnPgo=",
  /** Bieu tuong "chi tiet chinh". */
  standard: "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiB2aWV3Qm94PSIwIDAgMzYgMzYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJJY29uQ2hlY2tsaXN0T3V0bGluZTE0IDEiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNOC40Mzc1IDE0LjA2MjVDMTAuNjEyMSAxNC4wNjI1IDEyLjM3NSAxMi4yOTk2IDEyLjM3NSAxMC4xMjVDMTIuMzc1IDcuOTUwMzggMTAuNjEyMSA2LjE4NzUgOC40Mzc1IDYuMTg3NUM2LjI2Mjg4IDYuMTg3NSA0LjUgNy45NTAzOCA0LjUgMTAuMTI1QzQuNSAxMi4yOTk2IDYuMjYyODggMTQuMDYyNSA4LjQzNzUgMTQuMDYyNVoiIHN0cm9rZT0iIzNCODZGRiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGlkPSJWZWN0b3JfMiIgZD0iTTE2Ljg3NSAxMC4xMjVIMzAuMzc1IiBzdHJva2U9IiMzQjg2RkYiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBpZD0iVmVjdG9yXzMiIGQ9Ik04LjQzNzUgMjkuODEyNUMxMC42MTIxIDI5LjgxMjUgMTIuMzc1IDI4LjA0OTYgMTIuMzc1IDI1Ljg3NUMxMi4zNzUgMjMuNzAwNCAxMC42MTIxIDIxLjkzNzUgOC40Mzc1IDIxLjkzNzVDNi4yNjI4OCAyMS45Mzc1IDQuNSAyMy43MDA0IDQuNSAyNS44NzVDNC41IDI4LjA0OTYgNi4yNjI4OCAyOS44MTI1IDguNDM3NSAyOS44MTI1WiIgc3Ryb2tlPSIjM0I4NkZGIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggaWQ9IlZlY3Rvcl80IiBkPSJNMTYuODc1IDI1Ljg3NUgzMC4zNzUiIHN0cm9rZT0iIzNCODZGRiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjwvZz4KPC9zdmc+Cg==",
  /** Bieu tuong "toan bo qua trinh". */
  detailed: "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiB2aWV3Qm94PSIwIDAgMzYgMzYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJJY29uQnJvd3NlT3V0bGluZTE2IDEiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNMjguMTI1IDMuMzc1SDcuODc1QzYuNjMyMzYgMy4zNzUgNS42MjUgNC4zODIzNiA1LjYyNSA1LjYyNVYzMC4zNzVDNS42MjUgMzEuNjE3NiA2LjYzMjM2IDMyLjYyNSA3Ljg3NSAzMi42MjVIMjguMTI1QzI5LjM2NzYgMzIuNjI1IDMwLjM3NSAzMS42MTc2IDMwLjM3NSAzMC4zNzVWNS42MjVDMzAuMzc1IDQuMzgyMzYgMjkuMzY3NiAzLjM3NSAyOC4xMjUgMy4zNzVaIiBzdHJva2U9IiMwMEE0QzkiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBpZD0iVmVjdG9yXzIiIGQ9Ik0xMi4zNzUgMTIuMzc1SDIzLjYyNSIgc3Ryb2tlPSIjMDBBNEM5IiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggaWQ9IlZlY3Rvcl8zIiBkPSJNMTIuMzc1IDIxLjM3NUgxOS4xMjUiIHN0cm9rZT0iIzAwQTRDOSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjwvZz4KPC9zdmc+Cg==",
} as const;

/** Bieu tuong mui ten trai cua nut "quay lai" — nguyen van ban goc (base64 nhung thang trong bundle goc). */
export const BACK_ICON_MASK = "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjIwLjI3OTIiIGhlaWdodD0iMTYuODI1IiB2aWV3Qm94PSIwIDAgMjAuMjc5MiAxNi44MjUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGlkPSJWZWN0b3IgNTAwOCIgZD0iTTEuMDE5ODYgOC41ODk1OEgyMC4yNzkyTTguNTQzMDMgMC40MDc2NTZMMC44MjU1NTQgOC41ODk1OEw4LjU0MzAzIDE2LjQwNzciIHN0cm9rZT0iIzgxODU4QyIgc3Ryb2tlLXdpZHRoPSIxLjE4ODIzIi8+Cjwvc3ZnPgo=";
