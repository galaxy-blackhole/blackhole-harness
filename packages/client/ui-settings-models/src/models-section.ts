/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Than trang Models: danh sach nha cung cap + the trinh sua
 */

import * as reactModule from "react";
import * as jsxRuntimeModule from "react/jsx-runtime";
import * as primitivesModule from "@galaxy-blackhole/gbh-client-ui-primitives";
import { deriveKeyRef } from "./store.ts";
import { protocolChoices } from "./store.ts";
import { reasoningLevelChoices } from "./store.ts";
import { providerUsable } from "./store.ts";
import { CustomProviderCard } from "./custom-provider-card.ts";
import { ProviderEditor } from "./provider-editor.ts";
import { CSS_SECTION } from "./styles.ts";

/** Namespace React cua bang module (khai long de giu nguyen dang ma cua ban goc). */
const react: any = reactModule;
/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;
/** Nguyen thu giao dien dung chung cua DSH. */
const _deepseek_ai_dsh_client_ui_primitives: any = primitivesModule;

/**
* Models settings section: the provider rows joined from the configurable
* directory, settings namespaces, and credential states, with one editor
* card at a time. Rows retain the account-first order supplied by the store
* and expose only confirmed API-key state through accessible
* solid configured or missing dots. A whole-section provider without a
* configured key renders as its open setup card instead of a row, but only in
* the first-run posture — no provider on the page can serve requests yet — and
* only until the user closes that card. The add flow is one card behind one
* button: a mode switch chooses between adopting a dormant directory provider
* (the catalog select over the provider editor) and declaring a custom model
* API (the create form). A panel mounts the first time its mode is shown and
* stays mounted, hidden, while the card is open and its mode stays offered,
* so switching modes discards neither draft and an unvisited mode costs
* nothing; the switch holds still while either panel has a write or an
* endpoint interrogation in flight, since a switch underneath one would
* orphan the answer. Each card kind owns its own open state, so closing one
* never discards a draft in another. Every
* mutation writes through the wire, while a provider removal first requires
* confirmation; the page re-renders from pushed invalidations or the
* post-apply reload.
*/
/** Render an editor for either the setup posture or an expanded provider row. */
function renderProviderEditor({ target, row, ...props }: any) {
	return (0, react_jsx_runtime.jsx)(ProviderEditor, {
		provider: target.provider,
		displayName: target.displayName,
		settingsPath: target.settingsPath,
		...target.declared === true ? { declared: true } : {},
		...target.defaultBaseURL === void 0 ? {} : { defaultBaseURL: target.defaultBaseURL },
		...target.baseURLEnv === void 0 ? {} : { baseURLEnv: target.baseURLEnv },
		...target.nativeAuth === void 0 ? {} : { nativeAuth: target.nativeAuth },
		...row.credential === void 0 ? {} : { credential: row.credential },
		...row.credentialChecks === void 0 ? {} : { credentialChecks: row.credentialChecks },
		...props
	});
}
/**
* Remove one user-added provider and its page-managed credential. Credential
* removal comes first so a second-step failure leaves the provider row visible
* and the whole operation safely retryable; both unsets are idempotent.
* The settings removal names the profile rather than rebuilding its whole
* namespace from a partial view.
* @param operations - the page's Host operations.
* @param controller - the page store to refresh.
* @param target - the provider's settings address and optional managed credential.
* @returns the failure message, or undefined once the write and reload landed.
*/
async function removeProviderProfile(operations: any, controller: any, target: any) {
	if (target.credentialRef !== void 0) {
		const credential = await operations.removeCredential(target.credentialRef);
		if (credential !== void 0) return credential;
	}
	const written = await operations.writeSettings(target.settingsNs, [{
		op: "unset",
		path: [...target.settingsPath]
	}], void 0);
	if (written.kind !== "written") return written.message;
	await controller.load();
}
/**
* Whether a whole-section provider still needs its first key: an unconfigured
* credential opens the setup card instead of showing a row. This is the
* first-run posture alone — a user who can already reach some provider gets an
* ordinary row with the missing-key dot, since nothing here is blocking them.
* @param row - the joined provider row.
* @param anyUsable - whether any joined row can already serve requests.
* @returns whether to render the setup card.
*/
function needsSetup(row: any, anyUsable: any) {
	if (anyUsable || row.entry.provider === "deepseek-account") return false;
	if (row.entry.settingsPath.length > 0) return false;
	return row.credential?.configured !== true;
}
/**
* The provider-card seat's credential fact: the reference this page would use
* for the row — the profile's `apiKeyEnv`, or the page's derived
* `<ROUTE>_API_KEY` while the profile names none — confirmed configured. The
* derived half is what keeps the seat consistent with the editor on the
* add-provider draft, whose dormant row names no reference yet.
*/
function keyConfiguredOf(row: any) {
	return row.apiKeyEnv !== void 0 ? row.credential?.configured === true : row.derivedCredential?.configured === true;
}
function targetOf(row: any) {
	const managedRef = deriveKeyRef(row.entry.provider);
	const credentialRef = row.apiKeyEnv === managedRef && row.credential?.configured === true && row.credential.writable ? managedRef : void 0;
	return {
		provider: row.entry.provider,
		displayName: row.entry.displayName,
		settingsNs: row.entry.settingsNs,
		settingsPath: row.entry.settingsPath,
		...credentialRef === void 0 ? {} : { credentialRef },
		...row.entry.declared === true ? { declared: true } : {},
		...row.entry.defaultBaseURL === void 0 ? {} : { defaultBaseURL: row.entry.defaultBaseURL },
		...row.entry.baseURLEnv === void 0 ? {} : { baseURLEnv: row.entry.baseURLEnv },
		...row.entry.nativeAuth === void 0 ? {} : { nativeAuth: row.entry.nativeAuth }
	};
}
/** Stable visible and accessible identity for one provider target. */
function providerTargetLabel(target: any) {
	return target.provider === target.displayName ? target.provider : `${target.displayName} (${target.provider})`;
}
/** Replace the one provider placeholder in localized destructive-action copy. */
function providerCopy(template: any, target: any) {
	return template.replace("{provider}", () => providerTargetLabel(target));
}
/**
* Render the Models section content column.
* @param props - slot-delivered injected dependencies.
* @returns the section, or null while the shell has not injected yet.
*/
export function ModelsSection(props: any) {
	const { controller, useSnapshot, operations, schema, t, renderSlot } = props;
	if (controller === void 0 || useSnapshot === void 0 || operations === void 0 || schema === void 0 || t === void 0) return null;
	return (0, react_jsx_runtime.jsx)(Loaded, {
		injected: {
			controller,
			useSnapshot,
			operations,
			schema,
			t
		},
		renderSlot
	});
}
function Loaded({ injected, renderSlot }: any) {
	const { controller, operations, schema, t } = injected;
	const snapshot = injected.useSnapshot((value: any) => value);
	const state = {
		...snapshot,
		rows: snapshot.rows.map((row: any) => row.entry.provider === "deepseek-account" ? {
			...row,
			entry: {
				...row.entry,
				displayName: t("deepSeekAccount")
			}
		} : row)
	};
	/** A new or failed surface waits for a current snapshot; background refreshes preserve its drafts. */
	const [hasReadySnapshot, setHasReadySnapshot] = (0, react.useState)(state.status === "ready");
	if (state.status === "ready" && !hasReadySnapshot) setHasReadySnapshot(true);
	if (state.status === "error" && hasReadySnapshot) setHasReadySnapshot(false);
	const [editing, setEditing] = (0, react.useState)(void 0);
	const [addOpen, setAddOpen] = (0, react.useState)(false);
	const [addMode, setAddMode] = (0, react.useState)("catalog");
	/** The modes shown since the add card opened; each keeps its panel mounted. */
	const [visited, setVisited] = (0, react.useState)(() => /* @__PURE__ */ new Set());
	/** Whether each add panel has a write or an interrogation in flight. */
	const [catalogBusy, setCatalogBusy] = (0, react.useState)(false);
	const [customBusy, setCustomBusy] = (0, react.useState)(false);
	/** Base of the add card's tab and panel ids. */
	const addId = (0, react.useId)();
	const [deleteTarget, setDeleteTarget] = (0, react.useState)(void 0);
	const [deleting, setDeleting] = (0, react.useState)(false);
	const [deleteFailure, setDeleteFailure] = (0, react.useState)(void 0);
	const [savedTarget, setSavedTarget] = (0, react.useState)(void 0);
	const [dismissedSetup, setDismissedSetup] = (0, react.useState)(() => /* @__PURE__ */ new Set());
	const announceSaved = (target: any) => {
		controller.load().then(() => {
			setSavedTarget(target);
		});
	};
	/**
	* Close the add card whole. The catalog target is forgotten with it, since
	* `editing` doubles as the row editor's target once the card is closed and a
	* refresh could otherwise open the row of a provider the draft never saved.
	* The busy flags reset here because a panel that closes itself on success
	* unmounts before it can report idle.
	*/
	const closeAdd = () => {
		setEditing(void 0);
		setAddOpen(false);
		setCatalogBusy(false);
		setCustomBusy(false);
	};
	const closeEditor = (changed: any, target: any) => {
		closeAdd();
		if (changed) announceSaved(target);
	};
	/**
	* Close a setup card, which owns none of the state above: the row-editor
	* and add cards each own one of those, so clearing them here would discard
	* a draft the user opened beside this card. Dismissal is this card's own —
	* the provider falls back to an ordinary row for the rest of the session,
	* and reopens through Edit.
	*/
	const closeSetup = (changed: any, target: any) => {
		setDismissedSetup((previous: any) => new Set([...previous, target.provider]));
		if (changed) announceSaved(target);
	};
	const closeDelete = () => {
		if (deleting) return;
		setDeleteTarget(void 0);
		setDeleteFailure(void 0);
	};
	const confirmDelete = () => {
		/* v8 ignore next -- the action only renders with a target and is disabled while a deletion is pending */
		if (deleteTarget === void 0 || deleting) return;
		setDeleting(true);
		setDeleteFailure(void 0);
		removeProviderProfile(operations, controller, deleteTarget).then((failure) => {
			if (failure !== void 0) {
				setDeleteFailure(failure);
				return;
			}
			setDeleteTarget(void 0);
		}).finally(() => {
			setDeleting(false);
		});
	};
	if (state.status === "idle") controller.load();
	if (state.status === "error") {
		/* v8 ignore next -- an error status always carries text; the fallback satisfies the nullable type */
		const errorText = state.error ?? "";
		return (0, react_jsx_runtime.jsxs)("div", {
			className: CSS_SECTION["section"],
			children: [(0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["error"],
				children: `${t("loadFailed")}: ${errorText}`
			}), (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: CSS_SECTION["secondaryButton"],
				onClick: () => {
					controller.load();
				},
				children: t("retry")
			})]
		});
	}
	if (!hasReadySnapshot && state.status !== "ready") return (0, react_jsx_runtime.jsxs)("div", {
		className: CSS_SECTION["section"],
		children: [(0, react_jsx_runtime.jsx)("h2", {
			className: CSS_SECTION["title"],
			children: t("title")
		}), (0, react_jsx_runtime.jsx)("p", {
			className: CSS_SECTION["intro"],
			children: t("intro")
		})]
	});
	const savedRow = savedTarget === void 0 ? void 0 : state.rows.find((row: any) => row.entry.provider === savedTarget.provider);
	const savedIdentity = savedRow === void 0 ? savedTarget : {
		provider: savedRow.entry.provider,
		displayName: savedRow.entry.displayName
	};
	const anyUsable = state.rows.some(providerUsable);
	const configured = state.rows.filter((row: any) => row.configured);
	const configurable = state.rows.filter((row: any) => state.namespaces.has(row.entry.settingsNs));
	const addable = state.rows.flatMap((row: any) => {
		const namespace = state.namespaces.get(row.entry.settingsNs);
		return namespace === void 0 || row.configured ? [] : [{
			row,
			namespace
		}];
	});
	const piAi = state.namespaces.get("llm-pi-ai");
	const protocols = protocolChoices(piAi, schema);
	const reasoningLevels = reasoningLevelChoices(piAi, schema);
	const catalogOffered = configurable.length > 0;
	const catalogEnabled = addable.length > 0;
	const customOffered = piAi !== void 0;
	const customEnabled = protocols.length > 0;
	const bothOffered = catalogOffered && customOffered;
	const mode = bothOffered ? addMode : customOffered ? "custom" : "catalog";
	const mounted = (candidate: any) => mode === candidate || visited.has(candidate);
	const switchLocked = catalogBusy || customBusy;
	const draft = (() => {
		if (!addOpen || !catalogOffered) return void 0;
		const kept = editing === void 0 ? void 0 : state.namespaces.get(editing.settingsNs);
		if (editing !== void 0 && kept !== void 0) return {
			target: editing,
			namespace: kept
		};
		const first = addable[0];
		return first === void 0 ? void 0 : {
			target: targetOf(first.row),
			namespace: first.namespace
		};
	})();
	const addRow = draft === void 0 ? void 0 : state.rows.find((row: any) => row.entry.provider === draft.target.provider);
	return (0, react_jsx_runtime.jsxs)("div", {
		className: CSS_SECTION["section"],
		children: [
			(0, react_jsx_runtime.jsx)("h2", {
				className: CSS_SECTION["title"],
				children: t("title")
			}),
			(0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["intro"],
				children: t("intro")
			}),
			!state.writable && state.status === "ready" ? (0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["notice"],
				children: t("readOnly")
			}) : null,
			savedIdentity === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["savedNotice"],
				role: "status",
				"aria-live": "polite",
				children: providerCopy(t("savedProvider"), savedIdentity)
			}),
			(0, react_jsx_runtime.jsx)("ul", {
				className: CSS_SECTION["rows"],
				children: configured.map((row: any) => {
					const target = targetOf(row);
					const namespace = state.namespaces.get(target.settingsNs);
					/* v8 ignore next -- the join marks a row configured only when its namespace resolved */
					if (namespace === void 0) return null;
					const error = row.entry.error === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: CSS_SECTION["error"],
						children: row.entry.error
					});
					if (needsSetup(row, anyUsable) && !dismissedSetup.has(row.entry.provider)) return (0, react_jsx_runtime.jsxs)("li", {
						className: CSS_SECTION["setupCard"],
						children: [
							error,
							renderProviderEditor({
								target,
								row,
								namespace,
								schema,
								operations,
								t,
								readOnly: !state.writable,
								// 25/10/2026 (yêu cầu Lead): provider Galaxy Blackhole (route `auto`) CHỈ hiện ô "Khoá API".
								// Khoá này mặc định là của Ollama; ngầm hiểu route `auto` là deepseek-v4.1-flash, nên các trường
								// "Cài đặt tuỳ chỉnh" (tên hiển thị / URL gốc) không có nghĩa. Xem ADR 0021.
								credentialOnly: target.provider === "auto",
								onClose: (changed: any) => {
									closeSetup(changed, target);
								}
							}),
							renderSlot("settings.models.provider-card", {
								provider: row.entry,
								configured: row.configured,
								keyConfigured: keyConfiguredOf(row)
							}, { entryKey: row.entry.settingsNs })
						]
					}, row.entry.provider);
					const open = !addOpen && editing?.provider === row.entry.provider;
					const credentialConfigured = row.credential?.configured === true;
					const credentialMissing = !credentialConfigured && row.apiKeyEnv !== void 0 && row.credential?.configured === false;
					return (0, react_jsx_runtime.jsxs)("li", {
						className: CSS_SECTION["rowCard"],
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: CSS_SECTION["rowHead"],
								children: [(0, react_jsx_runtime.jsxs)("span", {
									className: CSS_SECTION["rowIdentity"],
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											className: CSS_SECTION["rowName"],
											children: row.entry.displayName
										}),
										row.entry.declared === true ? (0, react_jsx_runtime.jsx)("span", {
											className: CSS_SECTION["rowTag"],
											children: t("customTag")
										}) : null,
										row.entry.provider === "deepseek-account" ? (0, react_jsx_runtime.jsxs)("span", {
											className: CSS_SECTION["accountStatus"],
											children: [(0, react_jsx_runtime.jsx)("span", {
												className: `${CSS_SECTION["credentialDot"]} ${CSS_SECTION["credentialDotConfigured"]}`,
												"aria-hidden": "true"
											}), t("accountSignedIn")]
										}) : null,
										credentialConfigured ? (0, react_jsx_runtime.jsx)("span", {
											className: `${CSS_SECTION["credentialDot"]} ${CSS_SECTION["credentialDotConfigured"]}`,
											role: "img",
											"aria-label": t("credentialConfigured"),
											title: t("credentialConfigured")
										}) : credentialMissing ? (0, react_jsx_runtime.jsx)("span", {
											className: `${CSS_SECTION["credentialDot"]} ${CSS_SECTION["credentialDotMissing"]}`,
											role: "img",
											"aria-label": t("credentialMissing"),
											title: t("credentialMissing")
										}) : null
									]
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: CSS_SECTION["rowActions"],
									children: [row.entry.provider === "deepseek-account" ? null : (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: CSS_SECTION["secondaryButton"],
										"aria-label": providerCopy(t("editProvider"), target),
										disabled: !open && state.status !== "ready",
										onClick: () => {
											if (!open && controller.store.getSnapshot().status !== "ready") return;
											setSavedTarget(void 0);
											setAddOpen(false);
											setEditing(open ? void 0 : target);
										},
										children: t("edit")
									}), row.removable ? (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: CSS_SECTION["dangerButton"],
										"aria-label": providerCopy(t("removeProvider"), target),
										disabled: !state.writable || state.status !== "ready",
										onClick: () => {
											if (controller.store.getSnapshot().status !== "ready") return;
											setSavedTarget(void 0);
											setDeleteFailure(void 0);
											setDeleteTarget(target);
										},
										children: t("remove")
									}) : null]
								})]
							}),
							error,
							renderSlot("settings.models.provider-card", {
								provider: row.entry,
								configured: row.configured,
								keyConfigured: keyConfiguredOf(row)
							}, { entryKey: row.entry.settingsNs }),
							open ? renderProviderEditor({
								target,
								row,
								namespace,
								schema,
								operations,
								t,
								readOnly: !state.writable,
								credentialOnly: target.provider === "auto",
								onClose: (changed: any) => {
									closeEditor(changed, target);
								}
							}) : null
						]
					}, row.entry.provider);
				})
			}),
			(0, react_jsx_runtime.jsx)("div", {
				className: CSS_SECTION["addBlock"],
				children: addOpen ? (0, react_jsx_runtime.jsxs)("div", {
					className: CSS_SECTION["addCard"],
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: CSS_SECTION["addModes"],
							children: [bothOffered ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SegmentedControl, {
								id: addId,
								label: t("addMode"),
								value: mode,
								disabled: switchLocked,
								options: [{
									value: "catalog",
									label: t("addCatalog"),
									disabled: !catalogEnabled,
									...catalogEnabled ? {} : { title: t("addCatalogExhausted") }
								}, {
									value: "custom",
									label: t("addCustom"),
									disabled: !customEnabled,
									...customEnabled ? {} : { title: t("addCustomUnavailable") }
								}],
								onChange: (next: any) => {
									setAddMode(next);
									setVisited((previous: any) => new Set([...previous, next]));
								}
							}) : (0, react_jsx_runtime.jsx)("div", {
								className: CSS_SECTION["editorHeader"],
								children: (0, react_jsx_runtime.jsx)("span", {
									className: CSS_SECTION["editorTitle"],
									children: t(mode === "catalog" ? "addCatalog" : "addCustom")
								})
							}), (0, react_jsx_runtime.jsx)("p", {
								className: CSS_SECTION["advancedHint"],
								children: t(mode === "catalog" ? "addCatalogHint" : "addCustomHint")
							})]
						}),
						mounted("catalog") && draft !== void 0 ? (0, react_jsx_runtime.jsxs)("div", {
							id: `${addId}-catalog-panel`,
							...bothOffered ? {
								role: "tabpanel",
								"aria-labelledby": `${addId}-catalog`
							} : {},
							hidden: mode !== "catalog",
							className: CSS_SECTION["addPanel"],
							children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: CSS_SECTION["field"],
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: CSS_SECTION["fieldLabel"],
										children: t("provider")
									}), (0, react_jsx_runtime.jsx)("select", {
										className: `${CSS_SECTION["input"]} ${CSS_SECTION["selectInput"]}`,
										value: draft.target.provider,
										"aria-label": t("provider"),
										disabled: catalogBusy,
										onChange: (event: any) => {
											const picked = addable.find((candidate: any) => candidate.row.entry.provider === event.target.value);
											/* v8 ignore next -- the select only lists addable rows */
											if (picked === void 0) return;
											setEditing(targetOf(picked.row));
										},
										children: addable.map(({ row }: any) => (0, react_jsx_runtime.jsx)("option", {
											value: row.entry.provider,
											children: row.entry.displayName
										}, row.entry.provider))
									})]
								}),
								(0, react_jsx_runtime.jsx)(ProviderEditor, {
									provider: draft.target.provider,
									displayName: draft.target.displayName,
									hideTitle: true,
									namespace: draft.namespace,
									schema,
									settingsPath: draft.target.settingsPath,
									operations,
									...draft.target.defaultBaseURL === void 0 ? {} : { defaultBaseURL: draft.target.defaultBaseURL },
									...draft.target.baseURLEnv === void 0 ? {} : { baseURLEnv: draft.target.baseURLEnv },
									...draft.target.nativeAuth === void 0 ? {} : { nativeAuth: draft.target.nativeAuth },
									...addRow?.credentialChecks === void 0 ? {} : { credentialChecks: addRow.credentialChecks },
									t,
									readOnly: !state.writable,
									onClose: (changed: any) => {
										closeEditor(changed, draft.target);
									},
									onBusyChange: setCatalogBusy
								}, draft.target.provider),
								addRow === void 0 ? null : renderSlot("settings.models.provider-card", {
									provider: addRow.entry,
									configured: addRow.configured,
									keyConfigured: keyConfiguredOf(addRow)
								}, { entryKey: addRow.entry.settingsNs })
							]
						}) : null,
						mounted("custom") && piAi !== void 0 ? (0, react_jsx_runtime.jsx)("div", {
							id: `${addId}-custom-panel`,
							...bothOffered ? {
								role: "tabpanel",
								"aria-labelledby": `${addId}-custom`
							} : {},
							hidden: mode !== "custom",
							className: CSS_SECTION["addPanel"],
							children: (0, react_jsx_runtime.jsx)(CustomProviderCard, {
								taken: state.rows.map((row: any) => row.entry.provider),
								protocols,
								reasoningLevels,
								revision: piAi.revision,
								operations,
								t,
								readOnly: !state.writable,
								onClose: (changed: any) => {
									closeAdd();
									if (changed) controller.load();
								},
								onBusyChange: setCustomBusy
							})
						}) : null
					]
				}) : catalogOffered || customOffered ? (0, react_jsx_runtime.jsx)("div", {
					className: CSS_SECTION["addActions"],
					children: (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: CSS_SECTION["addButton"],
						disabled: !state.writable || state.status !== "ready" || !catalogEnabled && !customEnabled,
						onClick: () => {
							if (controller.store.getSnapshot().status !== "ready") return;
							const first = addable[0];
							const initial = catalogEnabled ? "catalog" : "custom";
							setSavedTarget(void 0);
							setEditing(first === void 0 ? void 0 : targetOf(first.row));
							setAddMode(initial);
							setVisited(new Set([initial]));
							setAddOpen(true);
						},
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }), t("add")]
					})
				}) : null
			}),
			renderSlot("settings.models.footer", {}),
			(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: deleteTarget !== void 0,
				onClose: closeDelete,
				title: deleteTarget === void 0 ? "" : providerCopy(t("deleteTitle"), deleteTarget),
				closeLabel: t("close"),
				description: deleteTarget === void 0 ? "" : providerCopy(deleteTarget.credentialRef === void 0 ? t("deleteDescription") : t("deleteDescriptionWithCredential"), deleteTarget),
				className: CSS_SECTION["deleteDialog"],
				footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					"data-modal-autofocus": true,
					disabled: deleting,
					onClick: closeDelete,
					children: t("cancel")
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					className: CSS_SECTION["deleteConfirm"],
					disabled: deleting,
					onClick: confirmDelete,
					children: deleteTarget === void 0 ? "" : providerCopy(deleting ? t("deleting") : t("deleteConfirm"), deleteTarget)
				})] }),
				children: deleteFailure === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
					className: CSS_SECTION["error"],
					children: deleteFailure
				})
			})
		]
	});
}
