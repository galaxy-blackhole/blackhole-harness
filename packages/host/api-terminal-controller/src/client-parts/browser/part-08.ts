/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/bindings.js
		const PREFIX = "dsh.terminal.binding.v1.";
		/** Saved recovery targets keyed by Session and globally unique terminal content identity. */
		var TerminalBindings = class {
			memory = /* @__PURE__ */ new Map();
			/**
			* Read a saved target, retaining this window's value when storage is unavailable.
			* @param sessionId - owning Session.
			* @param contentId - terminal content identity, shared only by deliberate copies.
			* @returns the existing Host identity, if one has been saved.
			*/
			get(sessionId, contentId) {
				const key = this.key(sessionId, contentId);
				const known = this.memory.get(key);
				if (known !== void 0) return known;
				if (typeof localStorage === "undefined") return void 0;
				try {
					const raw = localStorage.getItem(key);
					if (raw === null) return void 0;
					const value = JSON.parse(raw);
					if (typeof value !== "string" || !/^[\w-]{1,128}$/u.test(value)) return void 0;
					this.memory.set(key, value);
					return value;
				} catch (_storageUnavailable) {
					return;
				}
			}
			/**
			* Save an identity before its Host allocation begins.
			* @param sessionId - owning Session.
			* @param contentId - globally unique terminal content identity.
			* @param id - existing or newly allocated Host identity.
			*/
			set(sessionId, contentId, id) {
				const key = this.key(sessionId, contentId);
				this.memory.set(key, id);
				if (typeof localStorage === "undefined") return;
				try {
					localStorage.setItem(key, JSON.stringify(id));
				} catch (error) {
					console.error("Terminal binding persistence failed:", error);
				}
			}
			/**
			* Remove this content's target after its close intent has been saved.
			* @param sessionId - owning Session.
			* @param contentId - closing terminal content identity.
			*/
			delete(sessionId, contentId) {
				const key = this.key(sessionId, contentId);
				this.memory.delete(key);
				if (typeof localStorage === "undefined") return;
				try {
					localStorage.removeItem(key);
				} catch (error) {
					console.error("Terminal binding cleanup failed:", error);
				}
			}
			/** Release cached values when the Client service is disposed. */
			clear() {
				this.memory.clear();
			}
			key(sessionId, contentId) {
				return PREFIX + JSON.stringify([sessionId, contentId]);
			}
		};
		//#endregion

export {};
