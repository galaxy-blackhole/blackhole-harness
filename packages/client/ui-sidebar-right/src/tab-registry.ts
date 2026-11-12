/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc So dang ky loai tab: thu tu, bang uu tien, doi chieu dia chi (ban goc: tab-registry.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/tab-registry.js
 */

import * as _deepseek_ai_dsh_client_store from "@galaxy-blackhole/gbh-client-store";
import { compileGlob } from "./glob.ts";

/** Rank of each band, highest first. */
const RANKS: any = {
	extension: 3,
	builtin: 2,
	fallback: 1
};
/** The band a definition that names none is in. */
const DEFAULT_BAND = "extension";
/**
* Whether a band may join a held kind: an `extension` and a `builtin` pair up
* once, and a `fallback` shares its kind with nothing.
*/
function coexists(slot: any, band: any) {
	return band !== "fallback" && slot.inForce.band !== "fallback" && slot.inForce.band !== band && slot.shadowed === void 0;
}
/**
* The address's URI path: what a pattern with no scheme separator matches
* against. `gbh-resource://file/session/s1/home/me/b.md` gives `/session/s1/home/me/b.md`;
* `sidebar://guide` gives `''`; an address that is not a URI gives nothing.
*/
function pathOf(address: any) {
	try {
		return new URL(address).pathname;
	} catch {
		return;
	}
}
/** Compile one declared pattern into the test the router runs. */
function matcherFor(pattern: any) {
	const whole = pattern.includes(":");
	const match = compileGlob(pattern, {
		nocase: true,
		dot: true,
		...whole ? {} : { basename: true }
	});
	return (address: any) => {
		if (whole) return match(address);
		const path = pathOf(address);
		return path !== void 0 && match(path);
	};
}
/** Hai scheme dia chi TEP (moi + cu) ma phan cuu ho ap dung. */
const FILE_ADDRESS_PATTERN = /^(?:gbh|dsh)-resource:\/\/file\//iu;

/**
* The registered tab types.
*
* Registration order is part of the contract: it breaks ties between types that
* recognize an address equally well.
* @param ctx - Context whose effects own the contributed types.
*/
export class SidebarRightTabRegistry {
	ctx: any;
	kinds = /* @__PURE__ */ new Map();
	ids = /* @__PURE__ */ new Set();
	listeners = /* @__PURE__ */ new Set();
	registrations = 0;
	cached: any[] = [];
	guideEntries: any[] = [];
	/** @param ctx - Context whose effects own the contributed types. */
	constructor(ctx: any) {
		this.ctx = ctx;
	}
	/**
	* Register one tab type for the caller's lifetime.
	*
	* The caller holds the returned disposer inside its own `ctx.effect`, so a
	* type's registration lives exactly as long as the plugin that contributed it.
	* An `extension` may register a kind a `builtin` already holds and takes it
	* over until it unregisters; a second registration in the same band, or any
	* registration meeting a `fallback` of the same kind, is a wiring mistake, and
	* so is an `id` already in use.
	* @param definition - the contributed type.
	* @returns idempotent disposer.
	* @throws when the id is taken, or the kind is already registered in a way this one cannot coexist with.
	*/
	register(definition: any) {
		const { id, kind } = definition;
		const entries = definition.guide ?? [];
		if (new Set(entries.map((entry: any) => entry.id)).size !== entries.length) throw new Error(`sidebarRight: duplicate guide entry id in "${id}"`);
		const band = definition.priority ?? DEFAULT_BAND;
		if (this.ids.has(id)) throw new Error(`sidebarRight: tab type id "${id}" is already registered`);
		const held = this.kinds.get(kind);
		if (held !== void 0 && !coexists(held, band)) throw new Error(`sidebarRight: tab kind "${kind}" is already registered (${held.inForce.band})`);
		this.registrations += 1;
		const entry = {
			definition,
			band,
			matchers: (definition.patterns ?? []).map((pattern: any) => ({
				pattern,
				test: matcherFor(pattern)
			})),
			order: this.registrations
		};
		const dispose = this.ctx.effect(() => {
			this.ids.add(id);
			const slot = this.enter(kind, entry);
			this.refresh();
			return () => {
				this.ids.delete(id);
				this.leave(kind, slot, entry);
				this.refresh();
			};
		}, `sidebarRight.tabs.register(${JSON.stringify(id)})`);
		return () => {
			dispose();
		};
	}
	/** Add a registration to its kind's slot, the higher band in force; `coexists` has already admitted it. */
	enter(kind: any, entry: any) {
		const held = this.kinds.get(kind);
		if (held === void 0) {
			const slot = {
				inForce: entry,
				shadowed: void 0
			};
			this.kinds.set(kind, slot);
			return slot;
		}
		if (RANKS[entry.band] > RANKS[held.inForce.band]) {
			held.shadowed = held.inForce;
			held.inForce = entry;
		} else held.shadowed = entry;
		return held;
	}
	/** Remove a registration from its kind's slot: a shadowed builtin resumes, and an emptied kind is freed. */
	leave(kind: any, slot: any, entry: any) {
		if (slot.inForce !== entry) slot.shadowed = void 0;
		else if (slot.shadowed === void 0) this.kinds.delete(kind);
		else {
			slot.inForce = slot.shadowed;
			slot.shadowed = void 0;
		}
	}
	/** Every kind's registration in force, in registration order. */
	active() {
		return [...this.kinds.values()].map((slot: any) => slot.inForce).sort((left: any, right: any) => left.order - right.order);
	}
	/**
	* Registered types in registration order.
	* @returns reference-stable entries.
	*/
	entries() {
		return this.cached;
	}
	/**
	* Every type in force's guide entries, in `order`, each naming the kind it opens.
	* @returns reference-stable entries.
	*/
	guide() {
		return this.guideEntries;
	}
	/**
	* The type in force for a kind.
	* @param kind - the type discriminator.
	* @returns the type, or `undefined` when nothing registered it.
	*/
	get(kind: any) {
		return this.kinds.get(kind)?.inForce.definition;
	}
	/**
	* Every type that would open an address, best first.
	*
	* Ranked by priority band, then by the length of the pattern that matched,
	* then by registration order. Types whose `canOpen` vetoes are absent.
	* @param address - the address a caller wants opened.
	* @returns the ranked types; empty when nothing recognizes the address.
	*/
	candidates(address: any) {
		const ranked = [];
		for (const { definition, band, matchers, order } of this.active()) {
			let length = -1;
			for (const matcher of matchers) if (matcher.test(address) && matcher.pattern.length > length) length = matcher.pattern.length;
			if (length < 0) continue;
			if (definition.canOpen !== void 0 && !definition.canOpen(address)) continue;
			ranked.push({
				definition,
				rank: RANKS[band],
				length,
				order
			});
		}
		ranked.sort((left: any, right: any) => right.rank - left.rank || right.length - left.length || left.order - right.order);
		return ranked.map((entry: any) => entry.definition);
	}
	/**
	* Decide which type opens an address, and as what.
	*
	* Without `kind`, the best candidate wins. With `kind`, that type opens the
	* address if its `canOpen` agrees — its globs are not consulted, because
	* naming the type IS the decision.
	*
	* An address no type will open is a wiring mistake, not a user error, so this
	* throws rather than reporting absence.
	* @param address - the address a caller wants opened.
	* @param kind - a type named by the caller, overriding the ranking.
	* @returns the claiming type and the record to open.
	*/
	claim(address: any, kind: any) {
		if (kind !== void 0) {
			const definition = this.get(kind);
			if (definition === void 0) throw new Error(`sidebarRight: no tab type is registered as "${kind}"`);
			if (definition.canOpen !== void 0 && !definition.canOpen(address)) throw new Error(`sidebarRight: tab type "${kind}" refuses "${address}"`);
			return {
				kind,
				contentId: address,
				title: definition.title(address)
			};
		}
		const [chosen] = this.candidates(address);
		if (chosen !== void 0) {
			return {
				kind: chosen.kind,
				contentId: address,
				title: chosen.title(address)
			};
		}
		/*
		 * CUU HO (01/11/2026): dia chi TEP ma khong loai tab nao nhan theo glob.
		 * Do that: chip tep trong khoi "Ban giao tep" mang `dsh-resource://file/session/<id>/<tep>` nhung
		 * `candidates()` rong ⇒ nem loi va nguoi dung chi thay popup. Khi dia chi dung la dia chi TEP va
		 * CO loai tab nhan no qua `canOpen`, dung loai do thay vi nem.
		 */
		if (FILE_ADDRESS_PATTERN.test(address)) {
			const rescued = this.active().find((entry: any) => entry.definition.canOpen !== void 0 && entry.definition.canOpen(address));
			if (rescued !== void 0) {
				return {
					kind: rescued.definition.kind,
					contentId: address,
					title: rescued.definition.title(address)
				};
			}
		}
		throw new Error(`sidebarRight: no registered tab type claims "${address}"`);
	}
	/**
	* Observe low-frequency registry changes.
	* @param listener - synchronous invalidation callback.
	* @returns unsubscribe callback.
	*/
	subscribe(listener: any) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	refresh() {
		this.cached = this.active().map((entry: any) => entry.definition);
		this.guideEntries = this.cached.flatMap((definition: any) => (definition.guide ?? []).map((entry: any) => ({
			...entry,
			kind: definition.kind,
			providerId: definition.id
		}))).sort((left: any, right: any) => left.order - right.order);
		(0, _deepseek_ai_dsh_client_store.notifySubscribers)(this.listeners, "[ui-sidebar-right] tab registry");
	}
};
