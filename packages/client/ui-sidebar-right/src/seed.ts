/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hat giong trang mac dinh cua mot phien (ban goc: contract/seed.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/contract/seed.js
 */

/**
* Resolve the default page from the registered entry count.
* @param tabs - current tab registry.
* @returns the sole entry, or the guide when there are zero or multiple entries.
*/
export function defaultSeed(tabs: any) {
	const [only, ...others] = tabs.guide();
	const kind = only !== void 0 && others.length === 0 ? only.kind : GUIDE_KIND;
	const definition = tabs.get(kind);
	if (definition === void 0) throw new Error(`sidebarRight: default tab kind "${kind}" is not registered`);
	return {
		kind,
		title: definition.title(pageAddress(kind))
	};
}
/** The guide tab's kind. */
export const GUIDE_KIND = "guide";
/**
* The address a page tab is recorded under: `sidebar://<kind>`. The scheme is
* this package's bookkeeping for `openTab`, spelled here and nowhere else; a
* caller names the kind and never sees or composes the address.
* @param kind - the page type's kind.
* @returns the page's address.
*/
export function pageAddress(kind: any) {
	return `sidebar://${kind}`;
}
