/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hang so dinh danh cua goi plugin-market (host-only): ten goi ta, ten goi goc, id row top-level va id row LONG
 */

/** Tên package của ta. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-plugin-market";

/** Tên package gốc DSH (đối chiếu). */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-plugin-market";

/** Id row top-level trong cây boot (row DUY NHẤT được khai khi Lead duyệt). */
export const ROW_ID = "plugin-market";

/** Id row LỒNG trong preset-standard/preset-ptc (chỉ khai gbh.nested khi Lead báo A/B ĐẠT). */
export const NESTED_ROW_ID = "tool-plugin-market";

/** Subpath entry mà row lồng nạp (bản gốc: '@deepseek-ai/dsh-plugin-market/tools'). */
export const TOOLS_SUBPATH = "tools";
