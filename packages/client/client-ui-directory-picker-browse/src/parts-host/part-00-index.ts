/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-client-ui-directory-picker-browse — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/index.js
/**
* Directory-picker browsing surface, node half. Pure UI plugin: the empty
* apply exists so the plugin appears in the host cordis.yml / Loader; the
* browser half ships via exports["./client"], discovered through the
* package.json dsh.client declaration. The listing and creation primitives it
* drives live in `@deepseek-ai/dsh-host-directory-picker-browse`.
*/
/** Host plugin body — no host-side behavior for this surface plugin. */
function apply() {}
//#endregion

export {};
