/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-plugin-market",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		//#region lib/types/client/presentation.js
		/** The query a newly selected index starts with. */
		const INITIAL_QUERY = {
			text: "",
			category: null,
			labels: [],
			sort: { kind: "index" }
		};
		/**
		* Replace the query text. Index order becomes relevance order when blank text gains words, and returns when the text
		* becomes blank; an order chosen while text is present stays.
		* @param query - the current query.
		* @param text - the new text.
		* @returns the query with the text and its order.
		*/
		function withText(query, text) {
			const [was, blank] = [query.text.trim() === "", text.trim() === ""];
			const sort = was && !blank && query.sort.kind === "index" ? { kind: "relevance" } : blank && query.sort.kind === "relevance" ? { kind: "index" } : query.sort;
			return {
				...query,
				text,
				sort
			};
		}
		/**
		* Drop filters and the sort key the index no longer declares, so every active choice stays visible in the toolbar.
		* @param query - the current query.
		* @param metadata - the declarations of the index that answered it.
		* @returns the query itself when every id is declared, otherwise a reduced copy.
		*/
		function declaredQuery(query, metadata) {
			const category = query.category !== null && !Object.hasOwn(metadata.categories, query.category) ? null : query.category;
			const labels = query.labels.filter((label) => Object.hasOwn(metadata.labels, label));
			const sort = query.sort.kind === "key" && !Object.hasOwn(metadata.sortKeys, query.sort.id) ? { kind: "index" } : query.sort;
			return category === query.category && labels.length === query.labels.length && sort === query.sort ? query : {
				...query,
				category,
				labels,
				sort
			};
		}
		/**
		* Order declarations by their localized title, then by id code points.
		* @param declarations - id → declaration with a `title`.
		* @param resolveText - current-language text resolution.
		* @param language - current UI language for collation.
		* @returns declarations in display order.
		*/
		function displayDeclarations(declarations, resolveText, language) {
			const collator = new Intl.Collator(language);
			return Object.entries(declarations).map(([id, declaration]) => ({
				id,
				title: resolveText(declaration.title),
				declaration
			})).sort((a, b) => collator.compare(a.title, b.title) || (a.id < b.id ? -1 : 1));
		}
		/**
		* The version an entry presents and installs by default: its default version, or its highest version when none is compatible.
		* @param entry - the market entry.
		* @returns the presented version.
		*/
		function presentedVersion(entry) {
			return entry.versions.find((version) => version.version === entry.defaultVersion) ?? entry.versions[0];
		}
		/**
		* List where a version installs from, so users can check its origin before installing.
		* @param name - the entry's package name.
		* @param version - the version to install.
		* @returns the npm package and registry, or the repository, full commit, and package directory.
		*/
		function sourceFacts(name, version) {
			const { source } = version;
			if (source.type === "npm") return [{
				kind: "package",
				value: `${name}@${version.version}`
			}, ...source.registry === void 0 ? [] : [{
				kind: "registry",
				value: source.registry
			}]];
			return [
				{
					kind: "repository",
					value: source.url
				},
				{
					kind: "commit",
					value: source.commit
				},
				...source.path === void 0 ? [] : [{
					kind: "directory",
					value: source.path
				}]
			];
		}
		/**
		* Name an index source: its market title once read, otherwise its host.
		* @param index - the configured source.
		* @param resolveText - current-language text resolution.
		* @returns the display name; a URL the browser cannot parse is shown as written.
		*/
		function indexLabel(index, resolveText) {
			if (index.title !== void 0) return resolveText(index.title);
			return URL.canParse(index.url) ? new URL(index.url).host : index.url;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-plugin-market/src/client/DiscoverSection.module.css.mjs
		const css = ".dq5LxG_section{flex-direction:column;gap:16px;display:flex}.dq5LxG_toolbar{align-items:center;gap:8px;display:flex}.dq5LxG_marketButton{max-width:240px;margin-left:-8px;font-weight:500}.dq5LxG_marketName{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.dq5LxG_search{flex:1;min-width:120px}.dq5LxG_categories{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.dq5LxG_muted,.dq5LxG_meta{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:20px}.dq5LxG_meta{overflow-wrap:anywhere;font-size:12px;line-height:18px}.dq5LxG_strong{overflow-wrap:anywhere;font-size:14px;font-weight:500;line-height:20px}.dq5LxG_error{color:var(--dsw-alias-state-error-primary);align-items:center;gap:6px;margin:0;font-size:13px;line-height:20px;display:inline-flex}.dq5LxG_failure{align-items:center;gap:10px;display:flex}.dq5LxG_notice{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-label-secondary);align-items:flex-start;gap:8px;margin:0;padding:10px 12px;font-size:12px;line-height:18px;display:flex}.dq5LxG_notice>svg{color:var(--dsw-alias-state-warn-primary);flex:none;margin-top:2px}.dq5LxG_cards{flex-direction:column;gap:2px;margin:0;padding:0;list-style:none;display:flex}.dq5LxG_card{border-radius:var(--dsw-radius-xl);align-items:center;gap:14px;margin:0 -8px;padding:8px;display:flex;position:relative}.dq5LxG_card:hover{background:var(--dsw-alias-interactive-bg-hover)}.dq5LxG_icon{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);width:48px;height:48px;color:var(--dsw-alias-label-secondary);flex:none;justify-content:center;align-items:center;display:inline-flex}.dq5LxG_image{object-fit:contain}.dq5LxG_main{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.dq5LxG_titleRow{flex-wrap:wrap;align-items:center;gap:8px;min-width:0;display:flex}.dq5LxG_cardOpen{max-width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;text-overflow:ellipsis;white-space:nowrap;background:0 0;border:0;padding:0;font-size:14px;font-weight:500;line-height:20px;overflow:hidden}.dq5LxG_cardOpen:after{content:\"\";border-radius:var(--dsw-radius-xl);position:absolute;inset:0}.dq5LxG_cardOpen:focus-visible{outline:none}.dq5LxG_cardOpen:focus-visible:after{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.dq5LxG_description{color:var(--dsw-alias-label-tertiary);-webkit-line-clamp:1;-webkit-box-orient:vertical;font-size:13px;line-height:18px;display:-webkit-box;overflow:hidden}.dq5LxG_cardEnd{z-index:1;flex:none;align-items:center;gap:8px;display:inline-flex;position:relative}.dq5LxG_blocked{opacity:.5;cursor:not-allowed}.dq5LxG_more{align-self:center}.dq5LxG_empty{text-align:center;flex-direction:column;align-items:center;gap:8px;padding:64px 0;display:flex}.dq5LxG_emptyTitle{margin:8px 0 0;font-size:14px;font-weight:500;line-height:20px}.dq5LxG_empty>button{margin-top:8px}.dq5LxG_detail{flex-direction:column;gap:16px;display:flex}.dq5LxG_crumb{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;align-self:flex-start;align-items:center;gap:6px;padding:0;font-size:12.5px;display:inline-flex}.dq5LxG_crumb:hover{color:var(--dsw-alias-label-primary)}.dq5LxG_crumb:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.dq5LxG_crumbIcon{transform:rotate(90deg)}.dq5LxG_detailHead{align-items:center;gap:14px;display:flex}.dq5LxG_detailTitle{margin:0;font-size:20px;font-weight:500;line-height:28px}.dq5LxG_detailDescription{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;margin:0;font-size:14px;line-height:22px}.dq5LxG_detailSection{flex-direction:column;gap:12px;margin-top:16px;display:flex}.dq5LxG_sectionTitle{margin:0;font-size:14px;font-weight:500;line-height:20px}.dq5LxG_facts{margin:0}.dq5LxG_facts div{border-bottom:.5px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:16px;min-height:44px;padding:8px 2px;display:flex}.dq5LxG_facts dt{color:var(--dsw-alias-label-secondary);flex:none;font-size:13px;line-height:20px}.dq5LxG_facts dd{text-align:end;overflow-wrap:anywhere;min-width:0;margin:0;font-size:13px;line-height:20px}.dq5LxG_facts code{background:var(--dsw-alias-bg-module-platform);box-decoration-break:clone;font-family:var(--ds-font-family-code);border-radius:4px;padding:2px 6px;font-size:12px}.dq5LxG_tags{flex-wrap:wrap;justify-content:flex-end;gap:6px;display:flex}.dq5LxG_dialog{width:min(480px,100vw - 32px)}.dq5LxG_dialogBody{flex-direction:column;gap:12px;display:flex}.dq5LxG_sourceList,.dq5LxG_versions{flex-direction:column;margin:0;padding:0;list-style:none;display:flex}.dq5LxG_sourceRow,.dq5LxG_versionRow{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:8px 0;display:flex}.dq5LxG_sourceError{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;font-size:12px;line-height:18px}.dq5LxG_sourceForm{align-items:center;gap:8px;display:flex}.dq5LxG_grow{flex:1;min-width:0}.dq5LxG_confirmHead{align-items:center;gap:14px;display:flex}.dq5LxG_skeletonFill{background:var(--dsw-alias-bg-skeleton);animation:2s cubic-bezier(.36,0,.64,1) infinite dq5LxG_dsh-market-skeleton}.dq5LxG_icon.dq5LxG_skeletonFill{border-color:#0000}.dq5LxG_skeletonBar{border-radius:var(--dsw-radius-xs);height:12px;margin:4px 0;display:block}.dq5LxG_skeletonTitle{width:min(144px,60%)}.dq5LxG_skeletonDescription{width:min(280px,85%)}@keyframes dq5LxG_dsh-market-skeleton{0%{opacity:1}40%{opacity:.6}80%,to{opacity:1}}@media (prefers-reduced-motion:reduce){.dq5LxG_skeletonFill{animation:none}}.dq5LxG_link{color:var(--dsw-alias-link);overflow-wrap:anywhere;text-decoration:none}.dq5LxG_link:hover{text-decoration:underline}";
		const tagId = "@deepseek-ai/dsh-client-ui-plugin-market/DiscoverSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-plugin-market";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var DiscoverSection_module_css_default = {
			"blocked": "dq5LxG_blocked",
			"card": "dq5LxG_card",
			"cardEnd": "dq5LxG_cardEnd",
			"cardOpen": "dq5LxG_cardOpen",
			"cards": "dq5LxG_cards",
			"categories": "dq5LxG_categories",
			"confirmHead": "dq5LxG_confirmHead",
			"crumb": "dq5LxG_crumb",
			"crumbIcon": "dq5LxG_crumbIcon",
			"description": "dq5LxG_description",
			"detail": "dq5LxG_detail",
			"detailDescription": "dq5LxG_detailDescription",
			"detailHead": "dq5LxG_detailHead",
			"detailSection": "dq5LxG_detailSection",
			"detailTitle": "dq5LxG_detailTitle",
			"dialog": "dq5LxG_dialog",
			"dialogBody": "dq5LxG_dialogBody",
			"dsh-market-skeleton": "dq5LxG_dsh-market-skeleton",
			"empty": "dq5LxG_empty",
			"emptyTitle": "dq5LxG_emptyTitle",
			"error": "dq5LxG_error",
			"facts": "dq5LxG_facts",
			"failure": "dq5LxG_failure",
			"grow": "dq5LxG_grow",
			"icon": "dq5LxG_icon",
			"image": "dq5LxG_image",
			"link": "dq5LxG_link",
			"main": "dq5LxG_main",
			"marketButton": "dq5LxG_marketButton",
			"marketName": "dq5LxG_marketName",
			"meta": "dq5LxG_meta",
			"more": "dq5LxG_more",
			"muted": "dq5LxG_muted",
			"notice": "dq5LxG_notice",
			"search": "dq5LxG_search",
			"section": "dq5LxG_section",
			"sectionTitle": "dq5LxG_sectionTitle",
			"skeletonBar": "dq5LxG_skeletonBar",
			"skeletonDescription": "dq5LxG_skeletonDescription",
			"skeletonFill": "dq5LxG_skeletonFill",
			"skeletonTitle": "dq5LxG_skeletonTitle",
			"sourceError": "dq5LxG_sourceError",
			"sourceForm": "dq5LxG_sourceForm",
			"sourceList": "dq5LxG_sourceList",
			"sourceRow": "dq5LxG_sourceRow",
			"strong": "dq5LxG_strong",
			"tags": "dq5LxG_tags",
			"titleRow": "dq5LxG_titleRow",
			"toolbar": "dq5LxG_toolbar",
			"versionRow": "dq5LxG_versionRow",
			"versions": "dq5LxG_versions"
		};
		//#endregion
		//#region lib/types/client/DiscoverSection.js
		/** Discover: search one plugin market index, read an entry's page, and install a version. */
		/** Typing pause before the query text is sent. */
		const TEXT_DELAY_MS = 250;
		/** Artwork size inside the 48px icon frame, as on the Installed tab. */
		const ICON = 36;
		const FAILURE_KEYS = {
			fetch: "readFailed",
			invalid: "readInvalid",
			changed: "readChanged"
		};
		const FACT_KEYS = {
			package: "factPackage",
			registry: "factRegistry",
			repository: "factRepository",
			commit: "factCommit",
			directory: "factDirectory"
		};
		function MarketIcon({ src, size }) {
			const [failed, setFailed] = (0, react.useState)();
			return src === void 0 || src === failed ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.PluginArtworkDefault, { size }) : (0, react_jsx_runtime.jsx)("img", {
				className: DiscoverSection_module_css_default.image,
				src,
				width: size,
				height: size,
				alt: "",
				loading: "lazy",
				referrerPolicy: "no-referrer",
				onError: () => {
					setFailed(src);
				}
			});
		}
		function sourceFailureText(failure, t) {
			switch (failure.kind) {
				case "invalid": return t("sourceInvalid");
				case "duplicate": return t("sourceDuplicate");
				case "unavailable": return t("sourceUnavailable");
				case "other": return t("sourceFailed");
			}
		}
		function entryTitle(entry, face) {
			return entry.title === void 0 ? entry.name : face.resolveText(entry.title);
		}
		/** Whether installation accepts a version: compatible, or covered by an exemption. */
		function installable(compatibility) {
			return compatibility.compatible || compatibility.exempted;
		}
		function formatDate(timestamp, language, style) {
			return new Intl.DateTimeFormat(language, { dateStyle: style }).format(/* @__PURE__ */ new Date(timestamp * 1e3));
		}
		/** The one action an entry offers in its current state; Install chooses its default version. */
		function EntryAction({ entry, title, t, onInstall, onOpenInstalled }) {
			const { status } = entry.installation;
			if (status !== "not-installed") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "ghost",
				size: "sm",
				"aria-label": t("openInstalled", { name: title }),
				onClick: onOpenInstalled,
				children: t(status === "update-available" ? "statusUpdate" : status === "provided" ? "statusProvided" : "statusInstalled")
			});
			const version = presentedVersion(entry);
			if (!version.compatibility.compatible && !version.compatibility.exempted) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: t("noCompatibleVersion", { runtime: version.compatibility.runtimeVersion }),
				side: "bottom",
				portal: true,
				delayMs: 300,
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					className: DiscoverSection_module_css_default.blocked,
					"aria-disabled": "true",
					"aria-label": t("installTitle", { name: title }),
					children: t("install")
				})
			});
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "outline",
				size: "sm",
				"aria-label": t("installTitle", { name: title }),
				onClick: () => {
					onInstall(version);
				},
				children: t("install")
			});
		}
		function EntryCard({ entry, t, face, language, labels, onOpen, onInstall, onOpenInstalled }) {
			const title = entryTitle(entry, face);
			const version = presentedVersion(entry);
			const date = formatDate(version.publishTimestamp, language, "medium");
			return (0, react_jsx_runtime.jsxs)("li", {
				className: DiscoverSection_module_css_default.card,
				"data-market-entry": entry.name,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: DiscoverSection_module_css_default.icon,
						"aria-hidden": "true",
						children: (0, react_jsx_runtime.jsx)(MarketIcon, {
							src: entry.icon,
							size: ICON
						})
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: DiscoverSection_module_css_default.main,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: DiscoverSection_module_css_default.titleRow,
								children: [(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: DiscoverSection_module_css_default.cardOpen,
									"aria-label": t("openEntry", { name: title }),
									onClick: onOpen,
									children: title
								}), labels.filter((label) => entry.metadata.labels.includes(label.id)).map((label) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, { children: label.title }, label.id))]
							}),
							entry.description === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
								className: DiscoverSection_module_css_default.description,
								children: face.resolveText(entry.description)
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: DiscoverSection_module_css_default.meta,
								children: entry.author === void 0 ? t("entryMeta", {
									version: version.version,
									date
								}) : t("entryMetaAuthor", {
									version: version.version,
									author: entry.author,
									date
								})
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: DiscoverSection_module_css_default.cardEnd,
						children: (0, react_jsx_runtime.jsx)(EntryAction, {
							entry,
							title,
							t,
							onInstall,
							onOpenInstalled
						})
					})
				]
			});
		}
		/** One row of the version list: its state tags and an Install button when installation accepts it. */
		function VersionRow({ entry, version, title, t, language, onInstall }) {
			const current = entry.installation.installedVersion === version.version;
			const offered = !current && entry.installation.status !== "provided" && installable(version.compatibility);
			const { compatibility } = version;
			return (0, react_jsx_runtime.jsxs)("li", {
				className: DiscoverSection_module_css_default.versionRow,
				"data-market-version": version.version,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: DiscoverSection_module_css_default.main,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: DiscoverSection_module_css_default.titleRow,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: DiscoverSection_module_css_default.strong,
								children: version.version
							}),
							version.version === entry.defaultVersion ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: "info",
								children: t("versionDefault")
							}) : null,
							version.version.split("+")[0]?.includes("-") === true ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: "neutral",
								children: t("versionPrerelease")
							}) : null,
							current ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: "success",
								children: t("versionInstalled")
							}) : null,
							compatibility.compatible ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: "warning",
								children: t(compatibility.exempted ? "versionExempted" : "versionIncompatible")
							})
						]
					}), (0, react_jsx_runtime.jsx)("span", {
						className: DiscoverSection_module_css_default.meta,
						children: compatibility.compatible ? formatDate(version.publishTimestamp, language, "medium") : compatibility.exempted ? t("exempted") : t("incompatible", {
							runtime: compatibility.runtimeVersion,
							range: Object.values(compatibility.requirements).join(" ")
						})
					})]
				}), !offered ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					size: "sm",
					"aria-label": t("installVersionTitle", {
						name: title,
						version: version.version
					}),
					onClick: () => {
						onInstall(version);
					},
					children: t("install")
				})]
			});
		}
		function EntryDetail({ entry, listing, t, face, language, onBack, onInstall, onOpenInstalled }) {
			const title = entryTitle(entry, face);
			const version = presentedVersion(entry);
			const date = formatDate(version.publishTimestamp, language, "long");
			const categoryId = entry.metadata.category;
			const category = categoryId === void 0 ? void 0 : listing.metadata.categories[categoryId];
			const labels = displayDeclarations(listing.metadata.labels, face.resolveText, language).filter((label) => entry.metadata.labels.includes(label.id));
			const { compatibility } = version;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: DiscoverSection_module_css_default.detail,
				"data-market-detail": entry.name,
				children: [
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: DiscoverSection_module_css_default.crumb,
						onClick: onBack,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
							className: DiscoverSection_module_css_default.crumbIcon,
							"aria-hidden": "true"
						}), (0, react_jsx_runtime.jsx)("span", { children: t("backToList") })]
					}),
export {};
