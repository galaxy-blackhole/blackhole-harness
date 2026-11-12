/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					entry.settled = skills;
					notifyLexicon(sessionId);
				}, () => {
					if (fetches.get(sessionId) === entry) fetches.delete(sessionId);
				});
				return entry;
			};
			const invalidate = (key) => {
				const entry = fetches.get(key);
				if (entry === void 0) return;
				fetches.delete(key);
				entry.abort.abort();
				notifyLexicon(key);
			};
			const clearAll = () => {
				for (const key of [...fetches.keys()]) invalidate(key);
			};
			const t = ctx.locale.bind(NS);
			const source = {
				trigger: "/",
				name: "skill",
				order: 2,
				async candidates(session, { query, signal }) {
					if (sessions.subagentAddress(session.sessionId) !== void 0) return [];
					const skills = await fetchCatalog(session.sessionId).promise;
					if (signal.aborted) return [];
					return (0, _deepseek_ai_dsh_client_ui_primitives.rankByName)(skills, query).map((skill) => ({
						name: skill.name,
						description: skill.modelInvocable ? skill.description : `${t("menu.userOnly")} · ${skill.description}`
					}));
				},
				warm(session) {
					if (sessions.subagentAddress(session.sessionId) !== void 0) return;
					fetchCatalog(session.sessionId).promise.catch(() => {});
				},
				lexicon(session) {
					return fetches.get(session.sessionId)?.settled?.map((skill) => skill.name);
				},
				subscribeLexicon(session, listener) {
					const key = session.sessionId;
					const listeners = lexiconListeners.get(key) ?? /* @__PURE__ */ new Set();
					listeners.add(listener);
					lexiconListeners.set(key, listeners);
					return () => {
						listeners.delete(listener);
						if (listeners.size === 0) lexiconListeners.delete(key);
					};
				},
				openReference(session, { ref }) {
					if (sessions.subagentAddress(session.sessionId) !== void 0) return false;
					const cwd = sessions.list.getSnapshot().byId[session.sessionId]?.cwd;
					const open = (catalog) => {
						const path = catalog.find((skill) => `/${skill.name}` === ref)?.path;
						if (path === void 0) return false;
						ctx.sidebarRight.openResource(fileAddressFor(session.sessionId, cwd, path));
						return true;
					};
					const settled = fetches.get(session.sessionId)?.settled;
					if (settled !== void 0) return open(settled);
					const entry = fetchCatalog(session.sessionId);
					entry.promise.then((catalog) => {
						if (!entry.abort.signal.aborted) open(catalog);
					}).catch((error) => {
						if (!entry.abort.signal.aborted) console.error("[ui-skill] reference preview failed:", error);
					});
					return true;
				},
				onPick({ candidate }) {
					return { text: `/${candidate.name} ` };
				}
			};
			ctx.slots.inject("conversation.user.text.node", () => ctx.slots.register({
				name: "conversation.user.text.node",
				key: "skill",
				priority: 100,
				inject: (sessionId) => ({ openSkill: (name) => {
					if (sessions.scope(sessionId) === void 0) return;
					source.openReference({ sessionId }, { ref: `/${name}` });
				} })
			}, SkillReference));
			const inputTriggers = ctx.get("inputTriggers");
			ctx.remote.$on("agent-preset/selected", invalidate);
			ctx.on("connection/reset", clearAll);
			ctx.effect(() => {
				const unregister = inputTriggers.registerSource(source);
				return () => {
					unregister();
					clearAll();
				};
			}, "ui-skill: source");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
