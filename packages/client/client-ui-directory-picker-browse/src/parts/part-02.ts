/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			* bounds the wait for the parent leg; `announce` surfaces a failure as the
			* dialog's alert.
			*/
			const land = (0, react.useCallback)((path, options) => {
				const { seq, scan } = launchListing(path);
				setLoading(true);
				if (options.announce) setError(null);
				const settle = () => {
					setLoading(false);
					if (options.closeEditor) {
						setPathDraft(null);
						return;
					}
					setError(null);
					refocusPathInput.current = true;
				};
				scan.then((target) => {
					if (seq !== requestSeq.current) return;
					if (!options.closeEditor && path !== void 0) scanned.current = {
						directory: path,
						landed: target.path
					};
					let landed = false;
					const landSingle = () => {
						if (landed || seq !== requestSeq.current) return;
						landed = true;
						setParent(target);
						setSelected(null);
						setChild(null);
						settle();
					};
					if (displayCrumbs(target, "").length < 2) {
						landSingle();
						return;
					}
					const parentCrumb = target.crumbs.at(-2);
					/* v8 ignore next -- narrowing: a two-deep display chain implies a parent crumb (root-to-target inclusive). */
					if (parentCrumb === void 0) {
						landSingle();
						return;
					}
					continueScan(parentCrumb.path).then((parentLevel) => {
						if (seq !== requestSeq.current) return;
						const sep = separatorOf(parentLevel);
						const fold = (value) => sep === "\\" ? value.toLowerCase() : value;
						const match = parentLevel.entries.find((entry) => fold(entry.path) === fold(target.path));
						if (match === void 0) {
							landSingle();
							return;
						}
						landed = true;
						setParent(parentLevel);
						setSelected(match);
						setChild(target);
						settle();
					}, () => {
						landSingle();
					});
					if (options.closeEditor) window.setTimeout(landSingle, PARENT_LEG_WAIT_MS);
				}, (reason) => {
					if (seq !== requestSeq.current) return;
					setLoading(false);
					if (options.announce) setError(failureText(reason));
				});
			}, [launchListing, continueScan]);
			/** Commit a submitted path (Enter, a crumb, the initial home listing): the editor closes, failures surface. */
			const navigate = (0, react.useCallback)((path) => {
				land(path, {
					closeEditor: true,
					announce: true
				});
			}, [land]);
			const refocusPick = (0, react.useRef)(false);
			const refocusEditZone = (0, react.useRef)(false);
			const pathInputRef = (0, react.useRef)(null);
			const editZoneRef = (0, react.useRef)(null);
			/**
			* Select a row of the listed level and preview its children on the right.
			* Deliberately NOT one-frame like navigate(): a pick's first duty is the
			* immediate selected state on the clicked row, and the pane split IS that
			* feedback (aria-current pill, crumbs following the selection) — holding
			* it back for the child listing would make clicks feel dropped. The quiet
			* rule governs whole-view replacement, where nothing acknowledges the
			* click but the swap itself.
			*/
			const select = (0, react.useCallback)((entry) => {
				const { seq, scan } = launchListing(entry.path);
				if (pathDraft !== null) refocusPick.current = true;
				setPathDraft(null);
				setSelected(entry);
				setChild(null);
				setLoading(true);
				setError(null);
				scan.then((next) => {
					if (seq !== requestSeq.current) return;
					setChild(next);
					setLoading(false);
				}, (reason) => {
					if (seq !== requestSeq.current) return;
					setLoading(false);
					setError(failureText(reason));
					setSelected(null);
					refocusEditZone.current = true;
				});
			}, [launchListing, pathDraft]);
			/**
			* Walk the panes to the directory the draft addresses, WITHOUT closing the
			* editor. The landing is an ordinary one — selection-anchored and two-pane
			* away from the display root — so typing a path moves the Miller view
			* exactly as a crumb jump does, and the draft's final segment
			* prefix-filters the arrival from the next render on.
			*/
			const previewDraftLevel = (0, react.useCallback)((directory) => {
				land(directory, {
					closeEditor: false,
					announce: false
				});
			}, [land]);
			/** Abandon path editing (Escape or clicking away) and restore the crumb view. */
			const cancelPathEdit = (0, react.useCallback)(() => {
				supersede();
				setLoading(false);
				setPathDraft(null);
				setError(null);
				if (child === null) setSelected(null);
				if (parent === null) navigate();
			}, [
				supersede,
				child,
				parent,
				navigate
			]);
			/** A right-column pick advances the view one level: child becomes the level. */
			const advance = (0, react.useCallback)((entry) => {
				/* v8 ignore next -- narrowing guard: the right column only renders with a child listing. */
				if (child === null) return;
				setParent(child);
				select(entry);
			}, [child, select]);
			(0, react.useEffect)(() => {
				openGeneration.current += 1;
				if (open) {
					setParent(null);
					setSelected(null);
					setChild(null);
					setCreatingFolder(false);
					setShowHidden(false);
					navigate();
					return;
				}
				supersede();
				setLoading(false);
				setError(null);
				setPathDraft(null);
				setFolderDraft(null);
				setCreateError(null);
				refocusPick.current = false;
				refocusEditZone.current = false;
			}, [
				open,
				navigate,
				supersede
			]);
			/** The folder a create or Open acts on: the selection, else the listed level. */
			const targetPath = selected?.path ?? parent?.path ?? null;
			const targetName = selected?.name ?? (parent === null ? "" : displayCrumbs(parent, t("browser.home")).at(-1)?.name ?? parent.path);
			const confirmCreate = () => {
				/* v8 ignore next -- reentry fence: the nested dialog only renders with a target and disables while creating. */
				if (targetPath === null || folderDraft === null || creatingFolder) return;
				const name = folderDraft;
				if (name.trim() === "") return;
				setCreatingFolder(true);
				setCreateError(null);
				const generation = openGeneration.current;
				createDirectory(targetPath, name).then((createdPath) => {
					if (generation !== openGeneration.current) return;
					setCreatingFolder(false);
					setFolderDraft(null);
					const { seq, scan } = launchListing(targetPath);
					setLoading(true);
					setError(null);
					scan.then((level) => {
						/* v8 ignore next -- same fence as navigate/select; the modal blocks superseding input */
						if (seq !== requestSeq.current) return;
						setParent(level);
						setLoading(false);
						select({
							name,
							path: createdPath,
							hidden: false
						});
					}, (reason) => {
						/* v8 ignore next -- same fence as navigate/select; the modal blocks superseding input */
						if (seq !== requestSeq.current) return;
						setLoading(false);
						setError(failureText(reason));
					});
				}, (reason) => {
					if (generation !== openGeneration.current) return;
					setCreatingFolder(false);
					setCreateError(failureText(reason));
				});
			};
			(0, react.useEffect)(() => {
				if (!loading) {
					setSlowScan(false);
					return;
				}
				const timer = window.setTimeout(() => {
					setSlowScan(true);
				}, SLOW_SCAN_DELAY_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [loading, scanWindow]);
			(0, react.useEffect)(() => {
				if (pathDraft === null) return;
				const timer = window.setTimeout(() => {
					if (previewSuspended.current) return;
					const current = viewRef.current.child ?? viewRef.current.parent;
					if (current === null) return;
					const { directory, tail } = readDraft(current, pathDraft, scanned.current);
					if (directory === null || tail !== null) return;
					previewDraftLevel(directory);
				}, DRAFT_PREVIEW_DEBOUNCE_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [pathDraft, previewDraftLevel]);
			const crumbSource = child ?? parent;
			const typedPrefix = crumbSource === null || pathDraft === null ? null : readDraft(crumbSource, pathDraft, scanned.current).tail;
			const crumbs = crumbSource === null ? [] : displayCrumbs(crumbSource, t("browser.home"));
			const crumbTail = crumbs.at(-1)?.path;
			(0, react.useEffect)(() => {
				const trail = crumbTrailRef.current;
				if (trail !== null) trail.scrollLeft = trail.scrollWidth;
			}, [crumbTail]);
			const millerRowRef = (0, react.useRef)(null);
			const childPath = child?.path;
			(0, react.useEffect)(() => {
				const row = millerRowRef.current;
				if (row !== null && childPath !== void 0) row.scrollLeft = row.scrollWidth;
			}, [childPath]);
			(0, react.useEffect)(() => {
				if (refocusPathInput.current) {
					refocusPathInput.current = false;
					if (document.activeElement === document.body) pathInputRef.current?.focus();
				}
				if (pathDraft !== null) return;
				if (refocusPick.current) {
					refocusPick.current = false;
					refocusEditZone.current = false;
					const rowHost = millerRowRef.current;
					/* v8 ignore next -- narrowing guard: the miller row is mounted whenever a pick just committed. */
					if (rowHost === null) return;
					const row = rowHost.querySelector("button[aria-current=\"true\"]");
					/* v8 ignore next -- narrowing guard: the pick that set the flag just rendered its aria-current row. */
					if (row === null) return;
					row.focus();
					return;
				}
				if (refocusEditZone.current) {
					refocusEditZone.current = false;
					if (document.activeElement !== document.body) return;
					const zone = editZoneRef.current;
					/* v8 ignore next -- narrowing guard: crumb mode renders the edit zone whenever the editor just closed. */
					if (zone === null) return;
					zone.focus();
				}
			});
			if (!open) return null;
			const twoPane = selected !== null;
			const parentInert = busy || folderDraft !== null;
			const draftPending = pathDraft !== null;
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open,
				onClose: () => {
					if (folderDraft === null && !busy) onClose();
				},
				title: t("browser.title"),
				className: clsx(DirectoryBrowser_module_css_default.dialog),
				headless: true,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: DirectoryBrowser_module_css_default.editorScope,
					onKeyDown: (event) => {
						if (event.key !== "Escape" || pathDraft === null) return;
						event.stopPropagation();
						refocusEditZone.current = document.activeElement === pathInputRef.current;
						cancelPathEdit();
					},
					onBlur: (event) => {
						if (pathDraft === null) return;
						if (!document.hasFocus()) return;
						const card = event.currentTarget.closest("[role=\"dialog\"]");
						/* v8 ignore next -- narrowing guard: this scope always renders inside the Modal card. */
						if (card === null) return;
						if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) return;
						refocusEditZone.current = false;
						cancelPathEdit();
					},
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: DirectoryBrowser_module_css_default.header,
							children: [(0, react_jsx_runtime.jsx)("h2", {
								className: DirectoryBrowser_module_css_default.title,
								children: t("browser.title")
							}), (0, react_jsx_runtime.jsx)("div", {
								className: DirectoryBrowser_module_css_default.crumbBar,
								children: pathDraft === null ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
									className: DirectoryBrowser_module_css_default.crumbTrail,
									role: "navigation",
									ref: crumbTrailRef,
									children: crumbs.map((crumb, index) => (0, react_jsx_runtime.jsxs)("span", {
										className: DirectoryBrowser_module_css_default.crumbSeat,
										children: [index > 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
											size: 12,
											className: DirectoryBrowser_module_css_default.crumbChevron
										}), (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: DirectoryBrowser_module_css_default.crumb,
											disabled: parentInert,
											onClick: () => {
												navigate(crumb.path);
											},
											children: crumb.name
										})]
									}, crumb.path))
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: DirectoryBrowser_module_css_default.crumbEditZone,
									"aria-label": t("browser.editPath"),
									title: t("browser.editPath"),
									disabled: parentInert,
									ref: editZoneRef,
									onClick: () => {
										supersede();
										setLoading(false);
										previewSuspended.current = false;
										if (parent === null) {
											setPathDraft("");
											return;
										}
										const base = selected?.path ?? parent.path;
										const sep = separatorOf(parent);
										setPathDraft(base.endsWith(sep) ? base : `${base}${sep}`);
									},
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, {
										size: 14,
										className: DirectoryBrowser_module_css_default.crumbEditGlyph
									})
								})] }) : (0, react_jsx_runtime.jsx)("input", {
									className: DirectoryBrowser_module_css_default.pathInput,
									value: pathDraft,
									"aria-label": t("browser.editPath"),
									autoFocus: true,
									ref: pathInputRef,
									disabled: parentInert,
									onChange: (event) => {
										supersede();
										setLoading(false);
										previewSuspended.current = false;
										setPathDraft(event.target.value);
									},
									...compositionGuard,
									onKeyDown: (event) => {
										if (event.key === "Enter" && !composingRef.current) {
											event.preventDefault();
											if (pathDraft.trim() !== "") {
												refocusEditZone.current = true;
												previewSuspended.current = true;
												navigate(pathDraft);
											}
										}
									}
								})
							})]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: DirectoryBrowser_module_css_default.content,
							children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: DirectoryBrowser_module_css_default.millerRow,
									ref: millerRowRef,
									children: [
										parent !== null && (0, react_jsx_runtime.jsx)(LevelColumn, {
											entries: parent.entries,
											selectedPath: selected?.path ?? null,
											busy: parentInert,
											onPick: select,
											showHidden,
											filterPrefix: child === null ? typedPrefix : null,
											pathEditing: draftPending
										}),
										twoPane && (0, react_jsx_runtime.jsx)("span", { className: DirectoryBrowser_module_css_default.divider }),
										twoPane && child !== null && (0, react_jsx_runtime.jsx)(LevelColumn, {
											entries: child.entries,
											selectedPath: null,
											busy: parentInert,
											onPick: advance,
											showHidden,
export {};
