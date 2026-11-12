/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang dinh danh cua row ui-theme: id module (MOT id) + id goi goc + id plugin + hai namespace
 */

/** Id MODULE duy nhat ma bundle tu khai (id goc chi nam o gbh.row.aliases) — id CUA TA, không phải stock. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-theme";

/** Id gói gốc DSH — chỉ khai ở gbh.row.aliases, KHÔNG đăng ký trong bundle. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-theme";

/** Id plugin của bản gốc, dùng cho thuoc tinh data-plugin / data-plugin-css của thẻ style — giữ NGUYÊN VĂN. */
export const THEME_PLUGIN_ID = STOCK_PACKAGE_NAME;

/** Namespace TỪ ĐIỂN của row (bản gốc gọi ctx.locale.register("settings.theme", …)). */
export const SETTINGS_NS = "settings.theme";

/** Namespace SETTINGS của Host (bản gốc: THEME_SETTINGS_NAMESPACE = "ui-theme"). */
export const THEME_SETTINGS_NAMESPACE = "ui-theme";

/** Sự kiện phát ra mỗi khi theme/typography đổi (bản gốc: ctx.emit("theme/change")). */
export const THEME_CHANGE_EVENT = "theme/change";

/** Sáu gói mà bản gốc khai ở dsh.client.inject (package.json gốc) — giữ NGUYÊN VĂN thứ tự. */
export const STOCK_CLIENT_INJECT: readonly string[] = [
  "@deepseek-ai/dsh-client-connection",
  "@deepseek-ai/dsh-client-locale",
  "@deepseek-ai/dsh-client-shortcuts",
  "@deepseek-ai/dsh-client-ui-renderer",
  "@deepseek-ai/dsh-client-ui-settings",
  "@deepseek-ai/dsh-api-remotes",
];
