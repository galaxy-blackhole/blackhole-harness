/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-host-webserver — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/injections.js
/**
* Structured index injections: the typed rows plugins contribute to the boot
* HTML instead of raw `tapIndex` string transforms. Rows are pure
* JSON-serializable data because one table feeds two renderers: the served
* form renders rows into the index.html text ({@link renderIndexInjections}),
* and a static worker deployment ships the same rows over its boot payload
* for a page-side interpreter. Anything not expressible as a row stays on
* `tapIndex`, which runs after row rendering.
*/
/** Escape a row value before placing it in a quoted HTML attribute. */
function escapeHtmlAttribute(value) {
	return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function assertNever(row) {
	throw new Error(`webserver: unknown index injection row ${JSON.stringify(row)}`);
}
/** Render one row to markup with its placement. */
function renderRow(row) {
	switch (row.kind) {
		case "global": return {
			placement: "head",
			markup: `<script>globalThis[${JSON.stringify(row.name).replaceAll("<", "\\u003c")}] = ${row.value === void 0 ? "undefined" : JSON.stringify(row.value).replaceAll("<", "\\u003c")}<\/script>`
		};
		case "script": return {
			placement: row.placement,
			markup: `<script>${row.text}<\/script>`
		};
		case "script-src": return {
			placement: row.placement,
			markup: `<script src="${escapeHtmlAttribute(row.src)}"><\/script>`
		};
		case "script-preload": return {
			placement: "head",
			markup: `<link rel="preload" as="script" href="${escapeHtmlAttribute(row.src)}">`
		};
		case "style": return {
			placement: "head",
			markup: `<style>${row.text}</style>`
		};
		case "html": return {
			placement: row.placement,
			markup: row.html
		};
		default: return assertNever(row);
	}
}
/** Insert `markup` into `html` at `at`. */
function splice(html, at, markup) {
	return `${html.slice(0, at)}${markup}${html.slice(at)}`;
}
/**
* Tail script settling the boot-readiness deferred (`__GBH_BOOT_READY__`):
* the client entry awaits its `.promise` before reading any injected state.
* Whichever side runs first creates the deferred (`??=`), so a bootstrap that
* applies the table asynchronously installs it ahead of the entry module and
* settles it after the last row; the served form below creates and resolves
* it in one statement, because every row is already in the document text.
*/
const READY_MARKUP = "<script>(globalThis.__GBH_BOOT_READY__ ??= Promise.withResolvers()).resolve()<\/script>";
/**
* Render rows into an index.html body: head rows immediately after the
* opening head tag, body rows immediately after the opening body tag, each
* group in table order, and the boot-readiness tail after the last body row.
* @param html - the raw index.html body.
* @param rows - the collected injection table.
* @returns the html with every row rendered.
*/
function renderIndexInjections(html, rows) {
	let head = "";
	let body = "";
	for (const row of rows) {
		const rendered = renderRow(row);
		if (rendered.placement === "head") head += rendered.markup;
		else body += rendered.markup;
	}
	body += READY_MARKUP;
	let out = html;
	if (head !== "") {
		const open = /<head(?:\s[^>]*)?>/i.exec(out);
		out = open === null ? `${head}${out}` : splice(out, open.index + open[0].length, head);
	}
	if (body !== "") {
		const open = /<body(?:\s[^>]*)?>/i.exec(out);
		out = open === null ? `${out}${body}` : splice(out, open.index + open[0].length, body);
	}
	return out;
}
//#endregion

export {};
