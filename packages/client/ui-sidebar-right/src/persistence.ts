/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Luu truc tien trinh bo cuc thanh ben phai bang zod (ban goc: persistence.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/persistence.js
 */

import * as _deepseek_ai_dsh_client_ui_dockkit from "@galaxy-blackhole/gbh-client-ui-dockkit";
import * as zod from "zod";
import { SIDEBAR_RIGHT_PREFIX, migrateSidebarRightPersistence } from "./persist-migration.ts";

/** Validated current-layout snapshots; undo history belongs to the live window. */
/** Persistence namespace shared by scoped stores and startup discovery. */
// 18/10/2026 (task-38): tiền tố MỚI của Galaxy Blackhole; tiền tố cũ chỉ còn trong migration.
const sidebarPersistence = SIDEBAR_RIGHT_PREFIX;
export const paneId = zod.z.string().regex(/^(?:pane|float)[1-9][0-9]*$/u);
export const splitId = zod.z.string().regex(/^split[1-9][0-9]*$/u);
export const tabId = zod.z.string().regex(/^tab[1-9][0-9]*$/u);
const nodeId = zod.z.union([paneId, splitId]);
const rectangle = zod.z.object({
	x: zod.z.number(),
	y: zod.z.number(),
	width: zod.z.number().positive(),
	height: zod.z.number().positive()
});
const node = zod.z.discriminatedUnion("kind", [zod.z.object({
	kind: zod.z.literal("pane"),
	id: paneId,
	host: zod.z.enum(["dock", "float"]),
	tabs: zod.z.array(tabId),
	activeTabId: tabId.optional(),
	rect: rectangle.optional()
}), zod.z.object({
	kind: zod.z.literal("split"),
	id: splitId,
	axis: zod.z.enum(["row", "column"]),
	children: zod.z.array(nodeId).min(2),
	sizes: zod.z.array(zod.z.number().positive()).min(2)
})]);
export const layout = zod.z.object({
	nodes: zod.z.record(nodeId, node),
	tabs: zod.z.record(tabId, zod.z.object({
		id: tabId,
		kind: zod.z.string().min(1),
		contentId: zod.z.string().min(1),
		title: zod.z.string()
	})),
	rootId: nodeId,
	floats: zod.z.array(paneId),
	activePaneId: paneId,
	expanded: zod.z.boolean(),
	mode: zod.z.enum(["push", "fullscreen"])
});
export const surface = zod.z.object({
	layout,
	minted: zod.z.int().nonnegative()
});
const envelope = zod.z.object({ bySession: zod.z.record(zod.z.string(), zod.z.unknown()) });
function validateReferences(value: any) {
	const { layout, minted } = value;
	const reject = () => {
		throw new Error("Invalid saved sidebar layout references");
	};
	const visited = /* @__PURE__ */ new Set();
	const usedTabs = /* @__PURE__ */ new Set();
	const pending = [{
		id: layout.rootId,
		host: "dock"
	}, ...layout.floats.map((id: any) => ({
		id,
		host: "float"
	}))];
	for (const [id, entry] of [...Object.entries(layout.nodes), ...Object.entries(layout.tabs)] as any) if (entry.id !== id || Number(id.replace(/^[a-z]+/u, "")) > minted) reject();
	for (const { id, host } of pending) {
		const entry = layout.nodes[id];
		if (visited.has(id) || entry === void 0) reject();
		visited.add(id);
		if (entry.kind === "split") {
			if (host !== "dock" || id !== layout.rootId || entry.axis !== "row" || entry.children.length !== 2 || entry.children.length !== entry.sizes.length || Math.abs(entry.sizes.reduce((sum: any, size: any) => sum + size, 0) - 1) > 1e-9) reject();
			pending.push(...entry.children.map((id: any) => ({
				id,
				host
			})));
		} else {
			if (entry.host !== host || (host === "float" ? entry.rect === void 0 || entry.tabs.length !== 1 : entry.rect !== void 0)) reject();
			if (entry.tabs.length === 0 ? entry.activeTabId !== void 0 : !entry.tabs.includes(entry.activeTabId ?? "")) reject();
			for (const tab of entry.tabs) {
				if (usedTabs.has(tab) || layout.tabs[tab] === void 0) reject();
				usedTabs.add(tab);
			}
		}
	}
	if (visited.size !== Object.keys(layout.nodes).length || usedTabs.size !== Object.keys(layout.tabs).length || layout.nodes[layout.activePaneId]?.kind !== "pane") reject();
}
/**
* Restore one validated Session layout with a fresh in-window undo history.
* @param sessionId - storage scope.
* @returns the saved surface, or undefined when absent, inaccessible or invalid.
*/
export function readSidebarLayout(sessionId: any) {
	if (typeof localStorage === "undefined") return void 0;
	// 18/10/2026 (task-38): MIGRATION MỘT LẦN mọi khoá dsh.sidebar-right.v1.* → gbh.sidebar-right.v1.*
	// TRƯỚC lần đọc đầu tiên (nếu chạy sau thì bố cục đã lưu bị mất).
	migrateSidebarRightPersistence();
	let raw: any;
	try {
		raw = localStorage.getItem(`${sidebarPersistence}.${sessionId}`);
	} catch (_storageUnavailable: any) {
		return;
	}
	if (raw === null) return void 0;
	try {
		const saved = envelope.parse(JSON.parse(raw)).bySession[sessionId];
		if (saved === void 0) return void 0;
		const parsed = surface.parse(saved);
		validateReferences(parsed);
		return {
			layout: parsed.layout,
			minted: parsed.minted,
			history: _deepseek_ai_dsh_client_ui_dockkit.EMPTY_HISTORY
		};
	} catch (_invalidLayout: any) {
		clearSidebarLayout(sessionId);
		return;
	}
}
/**
* Persist current layout and identity allocation without retaining undo entries.
* @param sessionId - storage scope.
* @param surface - current in-memory surface.
*/
export function writeSidebarLayout(sessionId: any, surface: any) {
	if (typeof localStorage === "undefined") return;
	const saved = { bySession: { [sessionId]: {
		layout: surface.layout,
		minted: surface.minted
	} } };
	try {
		localStorage.setItem(`${sidebarPersistence}.${sessionId}`, JSON.stringify(saved));
	} catch (error: any) {
		console.error("Sidebar layout persistence failed:", error);
	}
}
/**
* Remove only one Session's persisted layout.
* @param sessionId - storage scope to discard.
*/
export function clearSidebarLayout(sessionId: any) {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.removeItem(`${sidebarPersistence}.${sessionId}`);
	} catch (_storageUnavailable: any) {}
}
