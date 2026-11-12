/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/TaskDetail.js
		/** One retained task's rule, saved deliveries, run-time edits, deletion, and original-Session link. */
		/** Recurrence choices the Run time card's Repeat row offers, in mock menu order. */
		const RULE_CHOICES = [
			"weekly",
			"weekdays",
			"daily",
			"every-hour",
			"every-minute",
			"every-second",
			"once",
			"cron"
		];
		/** Repeat menu label of each recurrence choice. */
		const RULE_KIND_LABELS = {
			daily: "rule.daily",
			weekdays: "rule.weekdays",
			weekly: "rule.weekly",
			every: "rule.everyMinutes",
			once: "rule.once",
			cron: "rule.cron"
		};
		/** Repeat-menu label of each visible choice. */
		const RULE_CHOICE_LABELS = {
			daily: "rule.daily",
			weekdays: "rule.weekdays",
			weekly: "rule.weekly",
			"every-minute": "rule.everyMinutes",
			"every-hour": "rule.everyHours",
			"every-second": "rule.everySeconds",
			once: "rule.once",
			cron: "rule.cron"
		};
		/** Unit word the elapsed-interval row shows beside its quantity input. */
		const INTERVAL_UNIT_LABELS = {
			hour: "timing.unit.hour",
			minute: "timing.unit.minute",
			second: "timing.unit.second"
		};
		/** Lower-bound hint of the elapsed-interval row, stated in the row's own unit. */
		const INTERVAL_HINT_KEYS = {
			hour: "timing.intervalHint.hour",
			minute: "timing.intervalHint.minute",
			second: "timing.intervalHint.second"
		};
		/** Below-floor save message, stated in the same unit as the row and its hint. */
		const INTERVAL_ERROR_KEYS = {
			hour: "timing.invalidInterval.hour",
			minute: "timing.invalidInterval.minute",
			second: "timing.invalidInterval.second"
		};
		/** Messages `draftError` can return; each clears as soon as edits fix the draft. */
		const LOCAL_FAILURES = new Set([
			"rule.invalidTitle",
			"rule.invalidPrompt",
			"timing.invalidInterval",
			"rule.cronInvalid",
			"timing.invalid"
		]);
		/** Elapsed interval a rule receives when it starts repeating without a stored interval. */
		const RULE_DEFAULT_EVERY_SECONDS = 3600;
		/** Seconds represented by each friendly interval unit. */
		const INTERVAL_UNIT_SECONDS = {
			second: 1,
			minute: 60,
			hour: 3600
		};
		/** Shortest elapsed interval the Host accepts, stated in seconds. */
		const MIN_INTERVAL_SECONDS = 60;
		/** Exhaustive recurrence-choice labels of the stored rule records. */
		const RULE_KIND_BY_RECORD = {
			at: "once",
			after: "once",
			every: "every",
			daily: "daily",
			weekly: "weekly",
			cron: "cron"
		};
		/** ISO weekdays of the weekly choice in display order, Monday through Sunday. */
		const WEEKDAYS = [
			1,
			2,
			3,
			4,
			5,
			6,
			7
		];
		/** ISO weekday set the `weekdays` choice stores: Monday through Friday. */
		const WEEKDAY_RULE = [
			1,
			2,
			3,
			4,
			5
		];
		/**
		* Recurrence choices that state their rule with the clock and zone rows.
		*
		* The cron choice carries its clock inside its expression and its timing draft
		* has no time row, so it neither carries nor receives that pair: an expression
		* seeded from the occurrence's UTC clock with another zone would name a
		* different instant, and carrying an expression's empty time would empty the
		* clock row a switch to another choice shows.
		*/
		const CLOCK_KINDS = [
			"daily",
			"weekdays",
			"weekly"
		];
		/** Localized name of each ISO weekday. */
		const WEEKDAY_LABELS = {
			1: "frequency.weekday.1",
			2: "frequency.weekday.2",
			3: "frequency.weekday.3",
			4: "frequency.weekday.4",
			5: "frequency.weekday.5",
			6: "frequency.weekday.6",
			7: "frequency.weekday.7"
		};
		/**
		* Whether a stored weekly record carries exactly the Monday-to-Friday set the
		* `weekdays` choice stores, so the Repeat row shows that choice for it.
		* @param weekdays - stored ISO weekday set.
		* @returns whether the set is Monday through Friday.
		*/
		function isWeekdayRule(weekdays) {
			return weekdays.length === WEEKDAY_RULE.length && WEEKDAY_RULE.every((day) => weekdays.includes(day));
		}
		const sessionLinkMessages = {
			loading: "detail.sessionLoading",
			archived: "detail.sessionArchived",
			unavailable: "detail.sessionUnavailable"
		};
		/**
		* Own the editing state one task detail shares across both of its owners.
		*
		* The shown task is the catalog row for `taskId`, or the draft a mutation
		* pending against that row retained after the row left the catalog. The view,
		* the confirmation, and the draft all reset when `taskId` changes, so one
		* task's draft never carries into another.
		* @param injected - detail actions, localized copy, and framework readers.
		* @param catalog - the owner's authoritative task catalog snapshot.
		* @param taskId - task the owner selected, or undefined when it selected none.
		* @returns the shown task and catalog row, its element id, its confirmation, and the detail props.
		*/
		function useTaskDetail(injected, catalog, taskId) {
			const [draft, setDraft] = (0, react.useState)(null);
			const [tab, setTab] = (0, react.useState)("rule");
			const [confirmId, setConfirmId] = (0, react.useState)(null);
			const id = (0, react.useId)();
			(0, react.useEffect)(() => {
				setDraft(null);
				setTab("rule");
				setConfirmId(null);
			}, [taskId]);
			const record = taskId === void 0 ? void 0 : catalog.records.find((item) => item.id === taskId);
			return {
				record,
				task: record ?? (draft !== null && draft.id === taskId ? draft : void 0),
				id,
				confirmId,
				setConfirmId,
				setTab,
				props: {
					...injected,
					status: catalog.status,
					deleting: catalog.deleting,
					id,
					onEditState: setDraft,
					tab,
					onTabChange: setTab,
					confirmId,
					onConfirm: setConfirmId
				}
			};
		}
		/**
		* Render one task's rule or saved deliveries with confirm-first deletion and its original Session.
		*
		* A deletion this detail confirmed settles with the refreshed catalog: once
		* that refresh reports the row gone, the detail calls `onDeleted` and its owner
		* leaves the task. The app-wide toast, not this detail, announces the outcome.
		* @param props - task, catalog state, detail view, confirmation, localized copy, and action callbacks.
		* @returns the detail region, its deletion confirmation dialog, and the linked Session entry.
		*/
		function TaskDetail({ task, authoritative, id, status, deleting, onDelete, onRetry, onUpdateTiming, loadHistory, onOpenSession, onEditState, tab, onTabChange, confirmId, onConfirm, onDeleted, onClose, withinSession, useSessions, useWorkspaces, t }) {
			const sessions = useSessions((snapshot) => snapshot);
			const workspaces = useWorkspaces((snapshot) => snapshot);
			const detailTabsRef = (0, react.useRef)(null);
			const moreRef = (0, react.useRef)(null);
			const nameRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const footerRef = (0, react.useRef)(null);
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const now = useRelativeClock();
			const busy = deleting.includes(task.id) || status === "loading";
			const confirming = authoritative && confirmId === task.id;
			const sessionLink = sessionLinkState(task.sessionId, sessions, workspaces);
			const linkedSession = sessionLabel(task.sessionId, sessions);
			const sessionNotice = sessionLink === "available" ? void 0 : t(sessionLinkMessages[sessionLink]);
			const linkedShown = tab === "rule" && withinSession !== task.sessionId;
			const linkedText = t("detail.session");
			const [linkedCompact, setLinkedCompact] = (0, react.useState)(false);
			const linkedRef = (0, react.useRef)(null);
			const linkedExpanded = (0, react.useRef)(void 0);
			const linkedAction = linkedSession.titled ? t("detail.openSessionTitle", { title: linkedSession.text }) : t("detail.openSession");
			const linkedName = (0, react_jsx_runtime.jsx)("span", {
				id: `${id}-session`,
				className: TaskManagerPage_module_css_default.linkedSessionName,
				children: linkedSession.text
			});
			const linkedDescribedBy = `${id}-session${sessionNotice === void 0 ? "" : ` ${id}-session-state`}`;
			(0, react.useLayoutEffect)(() => {
				if (!linkedShown) return;
				const tabs = detailTabsRef.current;
				const linked = linkedRef.current;
				const measure = () => {
					const width = linked.getBoundingClientRect().width;
					if (!linkedCompact) linkedExpanded.current = {
						label: linkedText,
						width
					};
					const expanded = linkedExpanded.current;
					if (expanded.label !== linkedText) {
						setLinkedCompact(false);
						return;
					}
					setLinkedCompact(tabs.lastElementChild.getBoundingClientRect().right - tabs.firstElementChild.getBoundingClientRect().left > tabs.clientWidth - (expanded.width - width) - (linkedCompact ? 1 : 0));
				};
				measure();
				const observer = new ResizeObserver(measure);
				observer.observe(tabs);
				for (const tab of tabs.children) observer.observe(tab);
				return () => {
					observer.disconnect();
				};
			}, [
				linkedShown,
				linkedCompact,
				linkedText
			]);
			const taskIdentity = `${task.sessionId}\u0000${task.id}`;
			const [edit, setEdit] = (0, react.useState)(() => initialRuleEdit(task));
			const [intervalUnit, setIntervalUnit] = (0, react.useState)(() => preferredIntervalUnit(edit.shown.draft.seconds));
			const explicitUnit = (0, react.useRef)(false);
			const previousKind = (0, react.useRef)(edit.shown.kind);
			(0, react.useEffect)(() => {
				if (previousKind.current === edit.shown.kind) return;
				previousKind.current = edit.shown.kind;
				if (edit.shown.kind !== "every") {
					explicitUnit.current = false;
					return;
				}
				if (explicitUnit.current) return;
				setIntervalUnit(preferredIntervalUnit(edit.shown.draft.seconds));
			}, [edit.shown.kind, edit.shown.draft.seconds]);
			const [pending, setPending] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)();
			const shownFailure = failure !== void 0 && LOCAL_FAILURES.has(failure) ? draftError(edit.shown) : failure;
			const [deletionConfirmed, setDeletionConfirmed] = (0, react.useState)(false);
			const deletionInFlight = (0, react.useRef)(null);
			const [trackedIdentity, setTrackedIdentity] = (0, react.useState)(taskIdentity);
			const identityRef = (0, react.useRef)(taskIdentity);
			identityRef.current = taskIdentity;
			const submissions = (0, react.useRef)(0);
			const chosenWeekdays = (0, react.useRef)(void 0);
			/** The day set this task's card remembers, or undefined when it has none. */
			const taskMemory = () => chosenWeekdays.current?.identity === taskIdentity ? chosenWeekdays.current.weekdays : void 0;
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				panelRef.current?.focus({ preventScroll: true });
			}, [task.sessionId, task.id]);
			(0, react.useEffect)(() => {
				onEditState(pending || shownFailure !== void 0 || deletionConfirmed ? task : null);
			}, [
				pending,
				shownFailure,
				deletionConfirmed,
				task,
				onEditState
			]);
			(0, react.useEffect)(() => {
				if (deleting.includes(task.id)) {
					deletionInFlight.current = task.id;
					return;
				}
				if (!deletionConfirmed || deletionInFlight.current !== task.id) return;
				deletionInFlight.current = null;
				if (status === "ready" && authoritative) setDeletionConfirmed(false);
			}, [
				deletionConfirmed,
				deleting,
				task.id,
				status,
				authoritative
			]);
			(0, react.useEffect)(() => {
				if (confirming) footerRef.current?.querySelector("button")?.focus();
			}, [confirming]);
			const closeConfirmation = () => {
				onConfirm(null);
				moreRef.current?.focus();
			};
			const menuItems = [{
				id: "delete",
				label: t(deleting.includes(task.id) ? "delete.pending" : "delete.action"),
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, {}),
				danger: true,
				disabled: busy || !authoritative
			}];
			const storedValues = ruleValues(task);
			const propKey = shownValues(storedValues);
			if (trackedIdentity !== taskIdentity) {
				submissions.current += 1;
				chosenWeekdays.current = void 0;
				explicitUnit.current = false;
				previousKind.current = storedValues.kind;
				setTrackedIdentity(taskIdentity);
				setEdit(initialRuleEdit(task));
				setIntervalUnit(preferredIntervalUnit(storedValues.draft.seconds));
				setPending(false);
				setFailure(void 0);
				setDeletionConfirmed(false);
			} else if (edit.propKey !== propKey) {
				const memory = taskMemory();
				if (memory !== void 0 && sameWeekdays(memory, edit.stored.weekdays)) chosenWeekdays.current = void 0;
				setEdit(task.status === "inactive" ? {
					propKey,
					stored: storedValues,
					shown: storedValues
				} : {
					propKey,
					stored: storedValues,
					shown: mergeRuleDraft(storedValues, edit.shown, edit.stored)
				});
			}
			(0, react.useEffect)(() => {
				if (task.status !== "inactive") return;
				setEdit((current) => shownValues(current.shown) === shownValues(current.stored) ? current : {
					...current,
					shown: current.stored
				});
			}, [task.status]);
			const shown = edit.shown;
			const dirty = shownValues(shown) !== shownValues(edit.stored);
			const deleted = deletionConfirmed && !authoritative;
			(0, react.useEffect)(() => {
				if (deleted) onDeleted();
			}, [deleted, onDeleted]);
			const nextRun = nextRunParts(task.scheduledAt, t("time.locale"), now, t);
			const rememberWeekdays = (weekdays) => {
				chosenWeekdays.current = {
					identity: taskIdentity,
					weekdays
				};
			};
			/**
			* Day set one rule states, when its kind carries one.
			* @param kind - choice the rule is stated as.
			* @param weekdays - that rule's day set.
			* @returns the set for the kinds that carry one, otherwise undefined.
			*/
			const setOf = (kind, weekdays) => kind === "weekdays" || kind === "weekly" ? weekdays : void 0;
			const chooseKind = (kind, unit) => {
				if (unit !== void 0) {
					explicitUnit.current = true;
					setIntervalUnit(unit);
				}
				if (kind === shown.kind) return;
				const leavingSet = setOf(shown.kind, shown.weekdays) ?? (taskMemory() === void 0 ? setOf(storedValues.kind, storedValues.weekdays) : void 0);
				if (leavingSet !== void 0) rememberWeekdays(leavingSet);
				setEdit((current) => {
					const restore = kind === current.stored.kind;
					const carriesClock = !restore && CLOCK_KINDS.includes(kind) && CLOCK_KINDS.includes(current.shown.kind);
					const storedSet = setOf(current.stored.kind, current.stored.weekdays);
					const carried = kind === "weekly" ? setOf(current.shown.kind, current.shown.weekdays) ?? taskMemory() ?? storedSet : void 0;
					return {
						...current,
						shown: {
							...current.shown,
							kind,
							draft: restore ? current.stored.draft : carriesClock ? {
								...seedDraft(task, kind),
								time: current.shown.draft.time,
								timeZone: current.shown.draft.timeZone
							} : unit === void 0 ? seedDraft(task, kind) : {
								...seedDraft(task, kind),
								seconds: String(seedIntervalSeconds())
							},
							weekdays: kind === "weekdays" ? [...WEEKDAY_RULE] : kind === "weekly" && carried !== void 0 ? [...carried] : restore ? current.stored.weekdays : kind === "weekly" && carriesClock ? [zonedWeekday(task.scheduledAt, current.shown.draft.timeZone)] : seedWeekdays(task)
						}
					};
				});
			};
			const chooseZone = (zone) => {
				if (zone === shown.draft.timeZone) return;
				setEdit((current) => ({
					...current,
					shown: {
						...current.shown,
						draft: {
							...current.shown.draft,
							timeZone: zone
						}
					}
				}));
			};
			const toggleWeekday = (weekday) => {
				if (shown.weekdays.length === 1 && shown.weekdays.includes(weekday)) return;
				const weekdays = shown.weekdays.includes(weekday) ? shown.weekdays.filter((day) => day !== weekday) : WEEKDAYS.filter((day) => day === weekday || shown.weekdays.includes(day));
				rememberWeekdays(weekdays);
				setEdit((current) => ({
					...current,
					shown: {
						...current.shown,
						weekdays
					}
				}));
			};
			const editDraft = (patch) => {
				setEdit((current) => ({
					...current,
					shown: {
						...current.shown,
						draft: {
							...current.shown.draft,
							...patch
						}
					}
				}));
			};
			const editContent = (patch) => {
				setEdit((current) => ({
					...current,
					shown: {
						...current.shown,
						...patch
					}
				}));
			};
			const cancelDraft = () => {
				chosenWeekdays.current = void 0;
				setEdit((current) => ({
					...current,
					shown: current.stored
				}));
				setFailure(void 0);
			};
			const saveDraft = async () => {
				const invalid = draftError(shown);
				if (invalid !== void 0) {
					setFailure(invalid);
					return;
				}
				const submitted = taskIdentity;
				const generation = ++submissions.current;
				setPending(true);
				setFailure(void 0);
				const request = {
					sessionId: task.sessionId,
					id: task.id,
					expected: timingSnapshot(task),
					...contentChange(shown, storedValues)
				};
				let result;
				try {
					result = await onUpdateTiming(timingValues(shown) === timingValues(storedValues) ? request : {
						...request,
						change: ruleChange(shown.draft, shown.kind, shown.weekdays)
					});
				} catch (_error) {
					if (!mounted.current || identityRef.current !== submitted || generation !== submissions.current) return;
					setPending(false);
					setFailure("rule.error.unknown");
					return;
				}
				if (!mounted.current || identityRef.current !== submitted || generation !== submissions.current) return;
				setPending(false);
				if (!result.ok) {
					setFailure("rule.error.unknown");
					return;
				}
				if ("code" in result.value) {
					setFailure(ruleError(result.value.code));
					return;
				}
				const saved = ruleValues(result.value.record);
				setEdit((current) => current.propKey === propKey ? {
					...current,
					stored: saved,
					shown: saved
				} : {
					...current,
					shown: current.stored
				});
			};
			const confirmDelete = () => {
				setDeletionConfirmed(true);
				closeConfirmation();
				onDelete(task.id);
			};
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("aside", {
				ref: panelRef,
				className: TaskManagerPage_module_css_default.detail,
				id,
				tabIndex: -1,
				"aria-label": t("detail.label"),
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: TaskManagerPage_module_css_default.detailTabsBar,
						children: [(0, react_jsx_runtime.jsx)("div", {
							ref: detailTabsRef,
							className: TaskManagerPage_module_css_default.detailTabs,
							role: "tablist",
							"aria-label": t("detail.tabs"),
							children: ["rule", "records"].map((value) => (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-detail-tab": value,
								role: "tab",
								id: `${id}-${value}-tab`,
								"aria-controls": `${id}-${value}-panel`,
								"aria-selected": tab === value,
								tabIndex: tab === value ? 0 : -1,
								className: TaskManagerPage_module_css_default.detailTab,
								onClick: () => {
									onTabChange(value);
								},
								onKeyDown: (event) => {
									if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
									let next;
									switch (event.key) {
										case "ArrowLeft":
										case "ArrowRight":
											next = value === "rule" ? "records" : "rule";
											break;
										case "Home":
											next = "rule";
											break;
										case "End":
											next = "records";
											break;
										default: return;
									}
									event.preventDefault();
									onTabChange(next);
									detailTabsRef.current?.querySelector(`[data-detail-tab="${next}"]`)?.focus();
								},
								children: t(`detail.${value}`)
							}, value))
						}), (0, react_jsx_runtime.jsxs)("div", {
							className: TaskManagerPage_module_css_default.detailActions,
							children: [
								linkedShown && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: linkedText,
									side: "bottom",
									portal: true,
									disabled: !linkedCompact,
									children: (0, react_jsx_runtime.jsx)("span", {
										ref: linkedRef,
										className: TaskManagerPage_module_css_default.detailContext,
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											size: linkedCompact ? "sm" : "md",
											className: linkedCompact ? TaskManagerPage_module_css_default.detailIconButton : TaskManagerPage_module_css_default.linkedSession,
											title: linkedCompact ? void 0 : linkedSession.titled ? linkedSession.text : task.sessionId,
											"aria-label": linkedAction,
											"aria-describedby": linkedDescribedBy,
											disabled: sessionLink !== "available",
											onClick: () => {
												onOpenSession(task.sessionId);
											},
											children: linkedCompact ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ReferenceIconRegular, { kind: "session" }), linkedName] }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
												className: TaskManagerPage_module_css_default.linkedSessionLabel,
												children: linkedText
											}), (0, react_jsx_runtime.jsxs)("span", {
												className: TaskManagerPage_module_css_default.linkedSessionTarget,
												children: [linkedName, (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})]
											})] })
										})
									})
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: TaskManagerPage_module_css_default.menuGuard,
									onKeyDown: (event) => {
										guardMenuEscape(event, menuOpen, () => {
											setMenuOpen(false);
											moreRef.current?.focus();
										});
									},
									children: (0, react_jsx_runtime.jsx)(TaskMenu, {
										open: menuOpen,
										onClose: () => {
											setMenuOpen(false);
										},
										items: menuItems,
										onSelect: () => {
											setMenuOpen(false);
											onConfirm(task.id);
										},
										align: "end",
										portal: true,
										anchor: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											size: "sm",
											className: TaskManagerPage_module_css_default.detailIconButton,
											"aria-label": t("detail.more"),
											title: t("detail.more"),
											"aria-haspopup": "menu",
											"aria-expanded": menuOpen,
											onClick: (event) => {
												moreRef.current = event.currentTarget;
												setMenuOpen((open) => !open);
											},
											children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
										})
									})
								}),
								onClose !== void 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									className: TaskManagerPage_module_css_default.detailIconButton,
									"aria-label": t("detail.close"),
									onClick: onClose,
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, {})
								})
							]
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: clsx(TaskManagerPage_module_css_default.detailScroll, tab === "records" && TaskManagerPage_module_css_default.detailRecords),
						children: [
							(0, react_jsx_runtime.jsx)(CatalogFeedback, {
								status,
								populated: true,
								onRetry,
								t
							}),
							tab === "rule" && !deleted && (0, react_jsx_runtime.jsx)("header", {
								className: TaskManagerPage_module_css_default.detailHeader,
								children: task.status === "inactive" ? (0, react_jsx_runtime.jsx)("h2", {
									className: TaskManagerPage_module_css_default.readonlyName,
									children: shown.title
								}) : (0, react_jsx_runtime.jsx)("input", {
									ref: nameRef,
									className: TaskManagerPage_module_css_default.editName,
									"aria-label": t("detail.name"),
									disabled: busy || pending,
									value: shown.title,
									onChange: (event) => {
										editContent({ title: event.target.value });
									}
								})
							}),
							tab === "rule" && !deleted && (0, react_jsx_runtime.jsx)("div", {
								className: TaskManagerPage_module_css_default.nextRun,
								children: task.status === "active" ? (0, react_jsx_runtime.jsxs)("p", { children: [
									t("detail.nextRun"),
									" ",
									(0, react_jsx_runtime.jsx)("time", {
										dateTime: task.scheduledAt,
										children: nextRun.absolute
									}),
									" ",
									(0, react_jsx_runtime.jsx)("span", {
										className: TaskManagerPage_module_css_default.nextRunRelative,
										children: nextRun.relative
									})
								] }) : (0, react_jsx_runtime.jsx)("p", { children: t("status.inactive") })
							}),
							(0, react_jsx_runtime.jsx)("div", {
								role: "tabpanel",
								id: `${id}-rule-panel`,
								"aria-labelledby": `${id}-rule-tab`,
								hidden: tab !== "rule" || deleted,
								tabIndex: 0,
								children: !deleted && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [task.status === "inactive" ? (0, react_jsx_runtime.jsx)("p", {
									className: TaskManagerPage_module_css_default.readonlyPrompt,
									children: shown.prompt
								}) : (0, react_jsx_runtime.jsx)("textarea", {
									className: TaskManagerPage_module_css_default.instruction,
									"aria-label": t("detail.instruction"),
									disabled: busy || pending,
									value: shown.prompt,
									onChange: (event) => {
										editContent({ prompt: event.target.value });
									}
								}), (0, react_jsx_runtime.jsx)(RuleCard, {
									task,
									disabled: busy || pending || task.status === "inactive",
									values: shown,
									intervalUnit,
									failure: shownFailure === "timing.invalidInterval" ? INTERVAL_ERROR_KEYS[intervalUnit] : shownFailure,
									onChooseKind: chooseKind,
									onChooseZone: chooseZone,
									onToggleWeekday: toggleWeekday,
									onEditDraft: editDraft,
									t
								}, JSON.stringify([task.sessionId, task.id]))] })
							}),
							(0, react_jsx_runtime.jsx)("div", {
								role: "tabpanel",
								id: `${id}-records-panel`,
								"aria-labelledby": `${id}-records-tab`,
								className: TaskManagerPage_module_css_default.recordsPanel,
								hidden: tab !== "records",
								tabIndex: 0,
								children: tab === "records" && !deleted && (0, react_jsx_runtime.jsx)(DeliveryHistory, {
									id: task.id,
									sessionId: task.sessionId,
									latestMessageId: task.lastDelivery?.messageId,
									timeZone: recordTimeZone(task),
									loadHistory,
									t
								}, JSON.stringify([task.sessionId, task.id]))
							})
						]
					}),
					tab === "rule" && sessionNotice !== void 0 && (0, react_jsx_runtime.jsx)("p", {
						id: `${id}-session-state`,
						className: TaskManagerPage_module_css_default.detailNotice,
						role: "status",
						children: sessionNotice
					}),
					tab === "records" && shownFailure !== void 0 && (0, react_jsx_runtime.jsx)("p", {
						className: TaskManagerPage_module_css_default.saveFailure,
						role: "alert",
						children: t(shownFailure === "timing.invalidInterval" ? INTERVAL_ERROR_KEYS[intervalUnit] : shownFailure)
					}),
					dirty && !deleted && task.status !== "inactive" && (0, react_jsx_runtime.jsxs)("footer", {
						className: TaskManagerPage_module_css_default.saveFooter,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: TaskManagerPage_module_css_default.saveNotice,
								children: t("rule.unsaved")
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								disabled: pending,
								onClick: cancelDraft,
								children: t("rule.cancel")
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								disabled: pending || !dirty,
								onClick: () => {
									saveDraft();
								},
								children: t(pending ? "rule.saving" : "rule.save")
							})
						]
					})
				]
			}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				className: TaskManagerPage_module_css_default.confirmDialog,
				contentClassName: TaskManagerPage_module_css_default.confirmContent,
				open: confirming,
				title: t("delete.title"),
				description: t("delete.description"),
				closeLabel: t("delete.close"),
				onClose: closeConfirmation,
				footer: confirming && (0, react_jsx_runtime.jsxs)("div", {
					ref: footerRef,
					className: TaskManagerPage_module_css_default.confirmActions,
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						onClick: closeConfirmation,
						children: t("delete.cancel")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						className: TaskManagerPage_module_css_default.deleteButton,
						disabled: busy,
						onClick: confirmDelete,
						children: t("delete.confirm")
					})]
				}),
				children: confirming && (0, react_jsx_runtime.jsx)("p", {
					className: TaskManagerPage_module_css_default.confirmTitle,
					children: task.title
				})
			})] });
		}
		/**
		* Identify the Repeat row choice that represents a stored rule. A weekly rule
		* whose stored set is exactly Monday through Friday maps to the `weekdays`
		* choice, which is the same rule the menu's Monday-to-Friday option submits.
		* @param record - shown rule.
		* @returns the choice matching its stored recurrence kind.
		*/
