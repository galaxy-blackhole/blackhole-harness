/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			marketMenu: "Switch plugin market, currently {market}",
			sourcesTitle: "Index sources",
			sourcesDescription: "A plugin market is published as the URL of one index file. Discover browses the indexes listed here.",
			sourcesLabel: "Added index sources",
			sourceUrl: "Index URL",
			sourcePlaceholder: "https://example.com/index.json",
			addSource: "Add",
			removeSource: "Remove",
			removeSourceNamed: "Remove {url}",
			sourcesTrust: "Indexes come from third parties. Add only sources you trust: their plugins run with your permissions once installed.",
			sourceInvalid: "Use an http or https address without a user name, password, or # fragment.",
			sourceDuplicate: "This index source is already added.",
			sourceUnavailable: "Index sources cannot be saved here.",
			sourceFailed: "Could not save the index sources.",
			readFailed: "Could not read this index.",
			readInvalid: "This index is not in a valid format.",
			readChanged: "This index changed while loading.",
			search: "Search plugins",
			filter: "Labels",
			filterCount: "Labels · {count}",
			sortBy: "Sort: {sort}",
			sortRelevance: "Best match",
			sortDefault: "Default order",
			sortPublished: "Publish date",
			switchToAscending: "Sort ascending",
			switchToDescending: "Sort descending",
			categoriesLabel: "Categories",
			allCategories: "All",
			emptyIndex: "This index lists no plugins.",
			noMatches: "No plugins match.",
			showMore: "Show more",
			entryMeta: "{version} · {date}",
			entryMetaAuthor: "{version} · {author} · {date}",
			openEntry: "View {name}",
			install: "Install",
			installTitle: "Install {name}",
			installVersionTitle: "Install {name} {version}",
			openInstalled: "View {name} in Installed",
			statusInstalled: "Installed",
			statusUpdate: "Update available",
			statusProvided: "Provided by DSH",
			incompatible: "This version is not compatible with the running DSH {runtime}; it requires DSH {range}.",
			noCompatibleVersion: "No version is compatible with DSH {runtime}",
			exempted: "This version is not compatible with the running DSH, but you set a compatibility exemption for it.",
			backToList: "Discover",
			factSource: "Source",
			factPackage: "Package",
			factRegistry: "Registry",
			factRepository: "Repository",
			factCommit: "Commit",
			factDirectory: "Directory",
			factPublished: "Published",
			factAuthor: "Author",
			factHomepage: "Homepage",
			factSourceCode: "Source code",
			factCategory: "Category",
			factLabels: "Labels",
			factMarket: "Plugin market",
			versionsTitle: "Versions",
			versionsLabel: "Versions of {name}",
			versionDefault: "Recommended",
			versionInstalled: "Installed",
			versionIncompatible: "Incompatible",
			versionExempted: "Exempted",
			versionPrerelease: "Prerelease",
			confirmTitle: "Install \"{name}\"?",
			installTrust: "Plugins run on this machine with your permissions. Make sure you trust where this one comes from."
		};
		/** Largest page the Host returns, the `limit` bound of `pluginMarket.search`. */
		const MAX_PAGE = 100;
		const INITIAL = {
			status: "idle",
			indexes: [],
			selected: null,
			listing: null,
			editing: false,
			draft: "",
			saving: false,
			sourceFailure: null
		};
		function sourceFailure(failure) {
			if (failure.code === "plugin-market/invalid-index-url") return { kind: failure.details.reason === "duplicate" ? "duplicate" : "invalid" };
			if (failure.code === "plugin-market/settings-unavailable") return { kind: "unavailable" };
			return {
				kind: "other",
				reason: failure.message
			};
		}
		function listingFailure(failure) {
			return failure.code === "plugin-market/invalid-index" ? "invalid" : "fetch";
		}
		/** Owns Discover reads and source edits for one Client. */
		var DiscoverController = class {
			ctx;
			/** Shared Discover state published to the tab. */
			store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(INITIAL);
			disposed = false;
			indexRead = 0;
			listingRead = 0;
			/** Select the last source once the list it was added to arrives. */
			selectAdded = false;
			/** Runs the listing read that failed last. */
			failed = () => {};
			/** @param ctx - the plugin context whose `remote.pluginMarket` namespace answers. */
			constructor(ctx) {
				this.ctx = ctx;
			}
			/** Stop publishing late settlements. */
			dispose() {
				this.disposed = true;
			}
			/**
			* Build the tab's injected face.
			* @param resolveText - current-language text resolution from the locale service.
			* @returns the tab's injected state sources and actions.
			*/
			face(resolveText) {
				return {
					hooks: {
						discover: this.store,
						locale: this.ctx.locale
					},
					resolveText,
					ensure: () => {
						if (this.state().status === "idle") this.loadIndexes();
					},
					reload: () => {
						this.loadIndexes();
					},
					select: (url) => {
						if (this.state().selected === url) return;
						this.patch({ selected: url });
						this.load(url, INITIAL_QUERY, 50, false);
					},
					search: (query) => {
						const listing = this.state().listing;
						if (listing !== null) this.load(listing.url, query, 50, false);
					},
					more: () => {
						this.loadMore();
					},
					retry: () => {
						this.failed();
					},
					refresh: () => {
						const listing = this.state().listing;
						if (listing !== null) this.load(listing.url, listing.query, 50, true);
					},
					toggleSources: () => {
						this.patch({
							editing: !this.state().editing,
							sourceFailure: null
						});
					},
					editDraft: (text) => {
						this.patch({
							draft: text,
							sourceFailure: null
						});
					},
					addSource: () => {
						const draft = this.state().draft.trim();
						if (draft === "") return;
						this.selectAdded = true;
						this.saveSources([...this.state().indexes.map((index) => index.url), draft], true);
					},
					removeSource: (url) => {
						this.saveSources(this.state().indexes.map((index) => index.url).filter((item) => item !== url), false);
					}
				};
			}
			/** Re-read the sources after the Host announced a change or the connection reset; an unrendered tab stays idle. */
			sourcesChanged() {
				if (this.state().status !== "idle") this.loadIndexes();
			}
			/** Recompute installation status of every loaded plugin after the profile's bundles changed; the Host reuses its cached document. */
			bundlesChanged() {
				const { listing } = this.state();
				if (listing?.status === "ready") this.load(listing.url, listing.query, Math.max(listing.value.entries.length, 50), false);
			}
			state() {
				return this.store.getSnapshot();
			}
			patch(next) {
				this.store.set({
					...this.state(),
					...next
				});
			}
			async loadIndexes() {
				const read = ++this.indexRead;
				if (this.state().status === "idle") this.patch({ status: "loading" });
				const answer = await this.ctx.remote.pluginMarket.listIndexes();
				if (this.disposed || read !== this.indexRead) return;
				if (!answer.ok) {
					this.patch({ status: "error" });
					return;
				}
				const indexes = answer.value;
				const previous = this.state().selected;
				const last = indexes.at(-1);
				const selected = this.selectAdded && last !== void 0 ? last.url : indexes.some((index) => index.url === previous) ? previous : indexes[0]?.url ?? null;
				this.selectAdded = false;
				this.patch({
					status: "ready",
					indexes,
					selected,
					...indexes.length === 0 ? { editing: false } : {}
				});
				if (selected === null) this.patch({ listing: null });
				else if (selected !== this.state().listing?.url) this.load(selected, INITIAL_QUERY, 50, false);
			}
			/**
			* Load the first `count` results of a query in pages the Host accepts, replacing the shown results at once. Later
			* pages pin the first page's document; when the Host answers from a replaced document the read restarts once, and
			* fails if the document is replaced again. The index's undeclared ids leave the query.
			*/
			async load(url, query, count, refresh) {
				const read = ++this.listingRead;
				const current = this.state().listing;
				const [kept, answered] = current?.url === url ? [current.value, current.answered] : [null, null];
				this.patch({ listing: {
					url,
					query,
					status: "loading",
					value: kept,
					answered,
					failure: null
				} });
				const fail = (failure) => {
					this.failed = () => {
						this.load(url, query, count, refresh);
					};
					return {
						url,
						query,
						status: "error",
						value: kept,
						answered,
						failure
					};
				};
				let value = null;
				let restarted = false;
				while (value === null || value.entries.length < count && value.nextOffset !== null) {
					const offset = value?.entries.length ?? 0;
					const limit = Math.min(count - offset, MAX_PAGE);
					const answer = await this.page(url, query, offset, limit, value?.fetchedAt, refresh && value === null && !restarted);
					if (this.disposed || read !== this.listingRead) return;
					if (!answer.ok) {
						this.settle(url, fail(listingFailure(answer.error)), answer);
						return;
					}
					if (value === null || answer.value.fetchedAt === value.fetchedAt) value = value === null ? answer.value : {
						...answer.value,
						entries: [...value.entries, ...answer.value.entries]
					};
					else if (restarted) {
						this.patch({ listing: fail("changed") });
						return;
					} else {
						restarted = true;
						value = null;
					}
				}
				const declared = declaredQuery(query, value.metadata);
				if (declared !== query) {
					this.load(url, declared, count, false);
					return;
				}
				this.settle(url, {
					url,
					query,
					status: "ready",
					value,
					answered: query,
					failure: null
				}, {
					ok: true,
					value
				});
			}
			/** Load the page after the shown results; a replaced document reloads them from the first page. */
			async loadMore() {
				const listing = this.state().listing;
				if (listing === null || listing.status !== "ready" && listing.status !== "error" || listing.answered !== listing.query) return;
				if (listing.value?.nextOffset == null) return;
				const { url, query, value } = listing;
				const read = ++this.listingRead;
				this.patch({ listing: {
					...listing,
					status: "more",
					failure: null
				} });
				const answer = await this.page(url, query, value.entries.length, 50, value.fetchedAt, false);
				if (this.disposed || read !== this.listingRead) return;
				if (!answer.ok) {
					this.failed = () => {
						this.loadMore();
					};
					this.settle(url, {
						...listing,
						status: "error",
						failure: listingFailure(answer.error)
					}, answer);
					return;
				}
				if (answer.value.fetchedAt !== value.fetchedAt) {
					this.load(url, query, value.entries.length + 50, false);
					return;
				}
				const next = {
					...answer.value,
					entries: [...value.entries, ...answer.value.entries]
				};
				this.settle(url, {
					...listing,
					status: "ready",
					value: next,
					failure: null
				}, {
					ok: true,
					value: next
				});
			}
			page(url, query, offset, limit, fetchedAt, refresh) {
				return this.ctx.remote.pluginMarket.search(url, {
					...query.text.trim() === "" ? {} : { text: query.text },
					...query.category === null ? {} : { category: query.category },
					...query.labels.length === 0 ? {} : { labels: query.labels },
					sort: query.sort,
					offset,
					limit,
					...fetchedAt === void 0 ? {} : { fetchedAt },
					...refresh ? { refresh: true } : {}
				});
			}
			/** Publish a settled read and the index title or error it taught about its source. */
			settle(url, listing, answer) {
				const indexes = this.state().indexes.map((index) => {
					if (index.url !== url) return index;
					if (!answer.ok) return {
						...index,
						error: answer.error.message
					};
					const { title, description } = answer.value;
					return {
						url,
						title,
						...description === void 0 ? {} : { description }
					};
				});
				this.patch({
					listing,
					indexes
				});
			}
			async saveSources(urls, adding) {
				this.patch({
					saving: true,
					sourceFailure: null
				});
				const answer = await this.ctx.remote.pluginMarket.setIndexes(urls);
				if (this.disposed) return;
				if (!answer.ok) {
					this.selectAdded = false;
					this.patch({
						saving: false,
						sourceFailure: sourceFailure(answer.error)
					});
					return;
				}
				this.patch({
					saving: false,
					...adding ? { draft: "" } : {}
				});
				await this.loadIndexes();
			}
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "pluginMarket";
		/** Services the section reads. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.pluginMarket"
		];
		/**
		* Contribute Discover to the Plugins page and keep it current on Host changes.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-plugin-market: dictionaries");
			const controller = new DiscoverController(ctx);
export {};
