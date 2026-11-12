/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dinh nghia loai tab huong dan (ban goc: tabs/guide/definition.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/tabs/guide/definition.js
 */

import { GUIDE_KIND } from "./seed.ts";

/** The shipped guide implementation's identity: the key its body registers under. */
export const GUIDE_ID = "@deepseek-ai/dsh-client-ui-sidebar-right/guide";
/**
* The guide type's registry definition.
*
* A page type: it recognizes no resource address, because a guide views
* nothing, and is opened by kind; `builtin` is the ordinary band for a type
* shipped here.
* @param t - namespace-bound translate, read fresh on every title call.
* @returns the definition to register.
*/
export function guideDefinition(t: any) {
	return {
		id: GUIDE_ID,
		kind: GUIDE_KIND,
		priority: "builtin",
		title: () => t("tab.guide.title")
	};
}
