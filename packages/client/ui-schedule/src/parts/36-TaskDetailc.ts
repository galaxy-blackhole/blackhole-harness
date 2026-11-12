/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		function RuleCard({ task, disabled, values, intervalUnit, failure, onChooseKind, onChooseZone, onToggleWeekday, onEditDraft, t }) {
			const shown = values;
			const [repeatOpen, setRepeatOpen] = (0, react.useState)(false);
			const [zoneOpen, setZoneOpen] = (0, react.useState)(false);
			const [zoneQuery, setZoneQuery] = (0, react.useState)("");
			const [dateOpen, setDateOpen] = (0, react.useState)(false);
			const [timeOpen, setTimeOpen] = (0, react.useState)(false);
			const systemZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const [recentZones, setRecentZones] = (0, react.useState)(() => loadRecentTimeZones(systemZone));
			const frequencyZone = {
				system: systemZone,
				label: (zone) => zoneLabel(zone, t)
			};
			const repeatRef = (0, react.useRef)(null);
			const zoneRef = (0, react.useRef)(null);
			const dateRef = (0, react.useRef)(null);
			const timeRef = (0, react.useRef)(null);
			const cardId = (0, react.useId)();
			const rowId = (name) => `${cardId}-${name}`;
			(0, react.useEffect)(() => {
				if (!disabled) return;
				setDateOpen(false);
				setTimeOpen(false);
			}, [disabled]);
			const chooseChoice = (choice) => {
				setRepeatOpen(false);
				if (isIntervalChoice(choice)) {
					onChooseKind("every", intervalChoiceUnit(choice));
					return;
				}
				onChooseKind(choice);
			};
			const intervalMin = Math.ceil(MIN_INTERVAL_SECONDS / INTERVAL_UNIT_SECONDS[intervalUnit]);
			const intervalValue = shown.draft.seconds === "" ? void 0 : Number(shown.draft.seconds) / INTERVAL_UNIT_SECONDS[intervalUnit];
			const stepInterval = (delta) => {
				const next = intervalValue === void 0 ? intervalMin : Math.max(intervalMin, intervalValue + delta);
				onEditDraft({ seconds: String(Math.round(next * INTERVAL_UNIT_SECONDS[intervalUnit])) });
			};
			const chooseZone = (zone) => {
				setZoneOpen(false);
				setZoneQuery("");
				setRecentZones((recent) => rememberTimeZone(recent, zone));
				onChooseZone(zone);
			};
			const zoneCatalog = (0, react.useMemo)(() => {
				if (!zoneOpen) return [];
				const at = Date.now();
				const byLabel = /* @__PURE__ */ new Map();
				for (const zone of zoneChoices(shown.draft.timeZone, systemZone, at)) {
					const label = zoneName(zone, systemZone, t, at);
					const existing = byLabel.get(label);
					if (existing === void 0) {
						byLabel.set(label, {
							id: zone,
							label,
							disabled,
							zones: [zone]
						});
						continue;
					}
					existing.zones.push(zone);
					if (zone === shown.draft.timeZone) existing.id = zone;
				}
				return [...byLabel.values()];
			}, [
				disabled,
				shown.draft.timeZone,
				systemZone,
				t,
				zoneOpen
			]);
			const zoneLocale = t("time.locale");
			const normalizedZoneQuery = zoneQuery.trim().toLocaleLowerCase(zoneLocale);
			const namedZone = (zones, preferred) => {
				if (normalizedZoneQuery === "") return void 0;
				const exact = zones.find((zone) => zone.toLocaleLowerCase(zoneLocale) === normalizedZoneQuery);
				if (exact !== void 0) return exact;
				const partial = zones.filter((zone) => zone.toLocaleLowerCase(zoneLocale).includes(normalizedZoneQuery));
				if (partial.length === 0) return void 0;
				return partial.includes(preferred) ? preferred : partial[0];
			};
			const zoneItems = zoneCatalog.filter((item) => `${item.zones.join(" ")} ${item.label}`.toLocaleLowerCase(zoneLocale).includes(normalizedZoneQuery)).map((item) => ({
				...item,
				id: namedZone(item.zones, item.id) ?? item.id
			}));
			const recentItems = normalizedZoneQuery === "" ? recentZones.flatMap((zone) => {
				const item = zoneCatalog.find((choice) => choice.zones.includes(zone));
				return item === void 0 ? [] : [{
					...item,
					id: zone
				}];
			}).filter((item, index, items) => items.findIndex((candidate) => candidate.label === item.label) === index) : [];
			const recentLabels = new Set(recentItems.map((item) => item.label));
			const availableZoneItems = zoneItems.filter((item) => !recentLabels.has(item.label));
			const shownZoneItems = recentItems.length === 0 ? availableZoneItems : availableZoneItems.length === 0 ? recentItems : [
				...recentItems,
				{
					type: "separator",
					id: "__recent"
				},
				...availableZoneItems
			];
			const parsedCron = shown.kind === "cron" ? parseCronExpression(shown.draft.expression) : void 0;
			const clockHint = shown.kind === "once" && !draftZone(task).stored ? "timing.zoneNoStored" : void 0;
			const clockLine = failure ?? clockHint;
			return (0, react_jsx_runtime.jsxs)("section", {
				className: TaskManagerPage_module_css_default.ruleCard,
				"aria-label": t("rule.title"),
				children: [
					(0, react_jsx_runtime.jsx)("h3", { children: t("rule.title") }),
					(0, react_jsx_runtime.jsxs)("div", {
						className: TaskManagerPage_module_css_default.ruleRows,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: TaskManagerPage_module_css_default.menuGuard,
								onKeyDown: (event) => {
									guardMenuEscape(event, repeatOpen, () => {
										setRepeatOpen(false);
										repeatRef.current?.focus();
									});
								},
								children: (0, react_jsx_runtime.jsx)(TaskMenu, {
									className: TaskManagerPage_module_css_default.ruleRowMenu,
									open: repeatOpen,
									onClose: () => {
										setRepeatOpen(false);
									},
									items: RULE_CHOICES.map((value) => ({
										id: value,
										label: t(RULE_CHOICE_LABELS[value]),
										disabled
									})),
									selectedId: shown.kind === "every" ? `every-${intervalUnit}` : shown.kind,
									onSelect: (id) => {
										chooseChoice(id);
									},
									align: "end",
									portal: true,
									anchor: (0, react_jsx_runtime.jsxs)("button", {
										ref: repeatRef,
										type: "button",
										className: TaskManagerPage_module_css_default.ruleValue,
										disabled,
										"aria-haspopup": "menu",
										"aria-expanded": repeatOpen,
										onClick: () => {
											setRepeatOpen((open) => !open);
										},
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: TaskManagerPage_module_css_default.ruleLabel,
											children: t("rule.repeat")
										}), (0, react_jsx_runtime.jsxs)("span", {
											className: clsx(TaskManagerPage_module_css_default.ruleValueFace, TaskManagerPage_module_css_default.ruleControl),
											children: [(0, react_jsx_runtime.jsx)("span", {
												className: TaskManagerPage_module_css_default.ruleCurrent,
												children: shown.kind === "every" ? t(intervalRuleLabel(intervalUnit)) : repeatValue(task, shown.kind, t, frequencyZone)
											}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})]
										})]
									})
								})
							}),
							shown.kind === "weekly" && (0, react_jsx_runtime.jsx)(WeekdayRow, {
								weekdays: shown.weekdays,
								disabled,
								t,
								rowId,
								onToggle: onToggleWeekday
							}),
							shown.kind === "every" ? (0, react_jsx_runtime.jsxs)("div", {
								className: TaskManagerPage_module_css_default.ruleRow,
								children: [(0, react_jsx_runtime.jsx)("label", {
									className: TaskManagerPage_module_css_default.ruleLabel,
									htmlFor: rowId("interval"),
									children: t("timing.interval")
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: TaskManagerPage_module_css_default.ruleInterval,
									children: [(0, react_jsx_runtime.jsxs)("span", {
										className: TaskManagerPage_module_css_default.ruleIntervalStepper,
										style: { "--interval-digits": String(intervalValue ?? "").length || 1 },
										children: [(0, react_jsx_runtime.jsx)("input", {
											id: rowId("interval"),
											className: clsx(TaskManagerPage_module_css_default.ruleInput, TaskManagerPage_module_css_default.ruleControl, TaskManagerPage_module_css_default.ruleIntervalInput),
											type: "number",
											min: intervalMin,
											step: "any",
											disabled,
											value: intervalValue ?? "",
											"aria-describedby": rowId("interval-hint"),
											onChange: (event) => {
												const value = event.target.value;
												onEditDraft({ seconds: value === "" ? "" : String(Math.round(Number(value) * INTERVAL_UNIT_SECONDS[intervalUnit])) });
											}
										}), (0, react_jsx_runtime.jsxs)("span", {
											className: TaskManagerPage_module_css_default.ruleIntervalArrows,
											children: [(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: TaskManagerPage_module_css_default.ruleIntervalArrow,
												"aria-label": t("timing.intervalIncrease"),
												disabled,
												onClick: () => {
													stepInterval(1);
												},
												children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, { size: 9 })
											}), (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: TaskManagerPage_module_css_default.ruleIntervalArrow,
												"aria-label": t("timing.intervalDecrease"),
												disabled: disabled || intervalValue !== void 0 && intervalValue <= intervalMin,
												onClick: () => {
													stepInterval(-1);
												},
												children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 9 })
											})]
										})]
									}), (0, react_jsx_runtime.jsx)("span", {
										className: TaskManagerPage_module_css_default.ruleIntervalUnit,
										children: t(INTERVAL_UNIT_LABELS[intervalUnit])
									})]
								})]
							}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								shown.kind === "once" && (0, react_jsx_runtime.jsxs)("div", {
									className: TaskManagerPage_module_css_default.ruleRow,
									children: [(0, react_jsx_runtime.jsx)("label", {
										className: TaskManagerPage_module_css_default.ruleLabel,
										htmlFor: rowId("date"),
										children: t("timing.date")
									}), (0, react_jsx_runtime.jsxs)("span", {
										className: TaskManagerPage_module_css_default.menuGuard,
										onKeyDown: (event) => {
											guardMenuEscape(event, dateOpen, () => {
												setDateOpen(false);
												dateRef.current?.focus();
											});
										},
										children: [(0, react_jsx_runtime.jsxs)("button", {
											ref: dateRef,
											id: rowId("date"),
											type: "button",
											className: clsx(TaskManagerPage_module_css_default.ruleInput, TaskManagerPage_module_css_default.ruleControl, TaskManagerPage_module_css_default.pickerTrigger),
											disabled,
											"aria-label": t("timing.date"),
											"aria-haspopup": "dialog",
											"aria-expanded": dateOpen,
											"aria-describedby": clockHint === void 0 ? void 0 : rowId("time-hint"),
											onClick: () => {
												setDateOpen((open) => !open);
											},
											children: [(0, react_jsx_runtime.jsx)("span", { children: slashDate(shown.draft.date) }), (0, react_jsx_runtime.jsx)(IconCalendarOutlineRegular, { className: TaskManagerPage_module_css_default.pickerIcon })]
										}), (0, react_jsx_runtime.jsx)(DatePicker, {
											open: dateOpen,
											anchorRef: dateRef,
											value: shown.draft.date,
											onPick: (date) => {
												onEditDraft({ date });
											},
											onClose: () => {
												setDateOpen(false);
											},
											t
										})]
									})]
								}),
								shown.kind !== "cron" && (0, react_jsx_runtime.jsxs)("div", {
									className: TaskManagerPage_module_css_default.ruleRow,
									children: [(0, react_jsx_runtime.jsx)("label", {
										className: TaskManagerPage_module_css_default.ruleLabel,
										htmlFor: rowId("time"),
										children: t("timing.time")
									}), (0, react_jsx_runtime.jsxs)("span", {
										className: TaskManagerPage_module_css_default.menuGuard,
										onKeyDown: (event) => {
											guardMenuEscape(event, timeOpen, () => {
												setTimeOpen(false);
												timeRef.current?.focus();
											});
										},
										children: [(0, react_jsx_runtime.jsxs)("button", {
											ref: timeRef,
											id: rowId("time"),
											type: "button",
											className: clsx(TaskManagerPage_module_css_default.ruleInput, TaskManagerPage_module_css_default.ruleControl, TaskManagerPage_module_css_default.pickerTrigger),
											disabled,
											"aria-label": t("timing.time"),
											"aria-haspopup": "dialog",
											"aria-expanded": timeOpen,
											"aria-describedby": clockHint === void 0 ? void 0 : rowId("time-hint"),
											onClick: () => {
												setTimeOpen((open) => !open);
											},
											children: [(0, react_jsx_runtime.jsx)("span", { children: secondPrecision(shown.draft.time) }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, { className: TaskManagerPage_module_css_default.pickerIcon })]
										}), (0, react_jsx_runtime.jsx)(ClockPicker, {
											open: timeOpen,
											anchorRef: timeRef,
											value: shown.draft.time,
											onPick: (time) => {
												onEditDraft({ time });
											},
											onClose: () => {
												setTimeOpen(false);
											},
											t
										})]
									})]
								}),
								shown.kind === "cron" && (0, react_jsx_runtime.jsx)(CronRows, {
									task,
									disabled,
									expression: shown.draft.expression,
									timeZone: shown.draft.timeZone,
									hintId: rowId("expression-hint"),
									onEditExpression: (expression) => {
										onEditDraft({ expression });
									},
									t
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: TaskManagerPage_module_css_default.menuGuard,
									onKeyDown: (event) => {
										guardMenuEscape(event, zoneOpen, () => {
											setZoneOpen(false);
											zoneRef.current?.focus();
										});
									},
									children: (0, react_jsx_runtime.jsx)(TaskMenu, {
										className: TaskManagerPage_module_css_default.ruleRowMenu,
										open: zoneOpen,
										onClose: () => {
											setZoneOpen(false);
											setZoneQuery("");
										},
										items: shownZoneItems.length > 0 ? shownZoneItems : [{
											id: "__empty",
											label: t("timing.zoneNoResults"),
											disabled: true
										}],
										listClassName: TaskManagerPage_module_css_default.zoneMenu,
										header: (0, react_jsx_runtime.jsx)("input", {
											className: TaskManagerPage_module_css_default.zoneSearch,
											type: "search",
											value: zoneQuery,
											placeholder: t("timing.zoneSearch"),
											"aria-label": t("timing.zoneSearch"),
											"data-menu-field": "",
											onChange: (event) => {
												setZoneQuery(event.target.value);
											}
										}),
										selectedId: shown.draft.timeZone,
										onSelect: (id) => {
											chooseZone(id);
										},
										align: "end",
										portal: true,
										anchor: (0, react_jsx_runtime.jsxs)("button", {
											ref: zoneRef,
											type: "button",
											className: TaskManagerPage_module_css_default.ruleValue,
											disabled,
											"aria-haspopup": "menu",
											"aria-expanded": zoneOpen,
											onClick: () => {
												setZoneOpen((open) => {
													if (open) setZoneQuery("");
													return !open;
												});
											},
											children: [(0, react_jsx_runtime.jsx)("span", {
												className: TaskManagerPage_module_css_default.ruleLabel,
												children: t("timing.zone")
											}), (0, react_jsx_runtime.jsxs)("span", {
												className: clsx(TaskManagerPage_module_css_default.ruleValueFace, TaskManagerPage_module_css_default.ruleControl),
												children: [(0, react_jsx_runtime.jsx)("span", {
													className: TaskManagerPage_module_css_default.ruleCurrent,
													children: zoneName(shown.draft.timeZone, systemZone, t)
												}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})]
											})]
										})
									})
								})
							] })
						]
					}),
					shown.kind === "every" && (0, react_jsx_runtime.jsx)("p", {
						id: rowId("interval-hint"),
						role: failure === void 0 ? void 0 : "alert",
						className: clsx(TaskManagerPage_module_css_default.ruleHint, failure !== void 0 && TaskManagerPage_module_css_default.ruleHintError),
						children: t(failure ?? INTERVAL_HINT_KEYS[intervalUnit])
					}),
					shown.kind !== "every" && (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: shown.kind === "cron" ? (0, react_jsx_runtime.jsx)("p", {
						id: rowId("expression-hint"),
						role: failure === void 0 && parsedCron !== void 0 ? void 0 : "alert",
						className: clsx(TaskManagerPage_module_css_default.ruleHint, (failure !== void 0 || parsedCron === void 0) && TaskManagerPage_module_css_default.ruleHintError),
						children: failure !== void 0 ? t(failure) : parsedCron === void 0 ? t("rule.cronInvalid") : cronPreview(parsedCron, t, t("time.locale"))
					}) : clockLine !== void 0 && (0, react_jsx_runtime.jsx)("p", {
						id: rowId("time-hint"),
						role: failure === void 0 ? void 0 : "alert",
						className: clsx(TaskManagerPage_module_css_default.ruleHint, failure !== void 0 && TaskManagerPage_module_css_default.ruleHintError),
						children: t(clockLine)
					}) })
				]
			});
		}
		/** Cron builder frequency choices in menu order; `raw` edits the expression text itself. */
		const CRON_SHAPE_CHOICES = [
			"monthly",
			"weekly",
			"daily",
			"hourly",
			"minutely",
			"raw"
		];
		/** Days a month can hold, in the date grid's order. */
		const MONTH_DAYS = Array.from({ length: 31 }, (_value, index) => index + 1);
		/** Frequency-menu label of each builder choice; the stepped shapes reuse the Repeat menu's wording. */
		const CRON_SHAPE_LABELS = {
			monthly: "cronForm.monthly",
			weekly: "cronForm.weekly",
			daily: "cronForm.daily",
			hourly: "rule.everyHours",
			minutely: "rule.everyMinutes",
			raw: "rule.cronLabel"
		};
		/** Whole minutes between runs a switch to the minutely shape starts from. */
		const CRON_DEFAULT_MINUTE_STEP = 5;
		/**
		* Render the cron choice as structured rows when the staged expression matches
		* one recognized shape, and as the raw expression input otherwise.
		*
		* The builder owns no rule state: every row edit regenerates the staged
		* expression, so storage stays a plain cron rule. Choosing the raw option keeps
		* the expression text editable even while it stays recognizable, until another
		* shape is chosen.
		* @param props - staged expression, blocking state, expression callback, and locale.
		* @returns the cron rows of the Run time card.
		*/
		function CronRows({ task, disabled, expression, timeZone, hintId, onEditExpression, t }) {
			const parsed = parseCronExpression(expression);
			const shape = parsed === void 0 ? void 0 : recognizeCronShape(parsed);
			const [rawChosen, setRawChosen] = (0, react.useState)(false);
			const [freqOpen, setFreqOpen] = (0, react.useState)(false);
			const [timeOpen, setTimeOpen] = (0, react.useState)(false);
			const freqRef = (0, react.useRef)(null);
			const timeRef = (0, react.useRef)(null);
			const baseId = (0, react.useId)();
			const rowId = (name) => `${baseId}-${name}`;
			(0, react.useEffect)(() => {
				if (disabled) setTimeOpen(false);
			}, [disabled]);
			const builder = rawChosen ? void 0 : shape;
			const chooseShape = (choice) => {
				setFreqOpen(false);
				if (choice === "raw") {
					setRawChosen(true);
					return;
				}
				setRawChosen(false);
				if (choice === shape?.kind) return;
				const wallClock = zonedWallClock(task.scheduledAt, timeZone);
				const minute = shape !== void 0 && shape.kind !== "minutely" ? shape.minute : Number(wallClock.slice(14, 16));
				const hour = shape?.kind === "daily" || shape?.kind === "weekly" || shape?.kind === "monthly" ? shape.hour : Number(wallClock.slice(11, 13));
				switch (choice) {
					case "minutely":
						onEditExpression(cronShapeExpression({
							kind: "minutely",
							step: CRON_DEFAULT_MINUTE_STEP
						}));
						return;
					case "hourly":
						onEditExpression(cronShapeExpression({
							kind: "hourly",
							step: 1,
							minute
						}));
						return;
					case "daily":
						onEditExpression(cronShapeExpression({
							kind: "daily",
							hour,
							minute
						}));
						return;
					case "weekly":
						onEditExpression(cronShapeExpression({
							kind: "weekly",
							weekdays: [zonedWeekday(task.scheduledAt, timeZone)],
							hour,
							minute
						}));
						return;
					case "monthly":
						onEditExpression(cronShapeExpression({
							kind: "monthly",
							days: [Number(wallClock.slice(8, 10))],
							hour,
							minute
						}));
						return;
					/* v8 ignore next -- the switch covers every CronShapeChoice, so the default holds no reachable statement. */
					default: assertNever(choice);
				}
			};
			const toggleDay = (current, weekday) => {
				if (current.weekdays.length === 1 && current.weekdays.includes(weekday)) return;
				const weekdays = current.weekdays.includes(weekday) ? current.weekdays.filter((day) => day !== weekday) : WEEKDAYS.filter((day) => day === weekday || current.weekdays.includes(day));
				onEditExpression(cronShapeExpression({
					...current,
					weekdays
				}));
			};
			const toggleDate = (current, day) => {
				if (current.days.length === 1 && current.days.includes(day)) return;
				const days = current.days.includes(day) ? current.days.filter((value) => value !== day) : MONTH_DAYS.filter((value) => value === day || current.days.includes(value));
				onEditExpression(cronShapeExpression({
					...current,
					days
				}));
			};
			const pad = (value) => String(value).padStart(2, "0");
			const clock = builder?.kind === "daily" || builder?.kind === "weekly" || builder?.kind === "monthly" ? `${pad(builder.hour)}:${pad(builder.minute)}` : "";
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("span", {
					className: TaskManagerPage_module_css_default.menuGuard,
					onKeyDown: (event) => {
						guardMenuEscape(event, freqOpen, () => {
							setFreqOpen(false);
							freqRef.current?.focus();
						});
					},
					children: (0, react_jsx_runtime.jsx)(TaskMenu, {
						className: TaskManagerPage_module_css_default.ruleRowMenu,
						open: freqOpen,
						onClose: () => {
							setFreqOpen(false);
						},
						items: CRON_SHAPE_CHOICES.map((value) => ({
							id: value,
							label: t(CRON_SHAPE_LABELS[value]),
							disabled
						})),
						selectedId: builder?.kind ?? "raw",
						onSelect: (id) => {
							chooseShape(id);
						},
						align: "end",
						portal: true,
						anchor: (0, react_jsx_runtime.jsxs)("button", {
							ref: freqRef,
							type: "button",
							className: TaskManagerPage_module_css_default.ruleValue,
							disabled,
							"aria-haspopup": "menu",
							"aria-expanded": freqOpen,
							"aria-describedby": hintId,
							onClick: () => {
								setFreqOpen((open) => !open);
							},
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: TaskManagerPage_module_css_default.ruleLabel,
								children: t("cronForm.frequency")
							}), (0, react_jsx_runtime.jsxs)("span", {
								className: clsx(TaskManagerPage_module_css_default.ruleValueFace, TaskManagerPage_module_css_default.ruleControl),
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: TaskManagerPage_module_css_default.ruleCurrent,
									children: t(builder === void 0 ? "rule.cronLabel" : CRON_SHAPE_LABELS[builder.kind])
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})]
							})]
						})
					})
				}),
				builder?.kind === "monthly" && (0, react_jsx_runtime.jsxs)("div", {
					className: TaskManagerPage_module_css_default.ruleRow,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: TaskManagerPage_module_css_default.ruleLabel,
						id: rowId("dates"),
						children: t("cronForm.dates")
					}), (0, react_jsx_runtime.jsx)("div", {
						className: clsx(TaskManagerPage_module_css_default.ruleMonthDays, TaskManagerPage_module_css_default.ruleControl),
						role: "group",
						"aria-labelledby": rowId("dates"),
						children: MONTH_DAYS.map((day) => {
							const selected = builder.days.includes(day);
							return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
								className: TaskManagerPage_module_css_default.ruleControl,
								active: selected,
								disabled,
								"aria-pressed": selected,
								"aria-label": t("cronForm.dateOption", { day }),
								onClick: () => {
									toggleDate(builder, day);
								},
								children: day
							}, day);
						})
					})]
				}),
				builder?.kind === "weekly" && (0, react_jsx_runtime.jsx)(WeekdayRow, {
					weekdays: builder.weekdays,
					disabled,
					t,
					rowId,
					onToggle: (weekday) => {
						toggleDay(builder, weekday);
					}
				}),
				(builder?.kind === "minutely" || builder?.kind === "hourly") && (0, react_jsx_runtime.jsxs)("div", {
					className: TaskManagerPage_module_css_default.ruleRow,
					children: [(0, react_jsx_runtime.jsx)("label", {
						className: TaskManagerPage_module_css_default.ruleLabel,
						htmlFor: rowId("step"),
						children: t("timing.interval")
					}), (0, react_jsx_runtime.jsxs)("span", {
						className: TaskManagerPage_module_css_default.ruleInterval,
						children: [(0, react_jsx_runtime.jsx)(CronStepper, {
							id: rowId("step"),
							min: 1,
							max: builder.kind === "minutely" ? 59 : 23,
							value: builder.step,
							disabled,
							increaseLabel: t("timing.intervalIncrease"),
							decreaseLabel: t("timing.intervalDecrease"),
							onChange: (step) => {
								onEditExpression(cronShapeExpression({
									...builder,
									step
								}));
							}
						}), (0, react_jsx_runtime.jsx)("span", {
							className: TaskManagerPage_module_css_default.ruleIntervalUnit,
							children: t(builder.kind === "minutely" ? "timing.unit.minute" : "timing.unit.hour")
						})]
					})]
				}),
				builder?.kind === "hourly" && (0, react_jsx_runtime.jsxs)("div", {
					className: TaskManagerPage_module_css_default.ruleRow,
					children: [(0, react_jsx_runtime.jsx)("label", {
						className: TaskManagerPage_module_css_default.ruleLabel,
						htmlFor: rowId("minute"),
						children: t("cronForm.atMinute")
					}), (0, react_jsx_runtime.jsx)("span", {
						className: TaskManagerPage_module_css_default.ruleInterval,
						children: (0, react_jsx_runtime.jsx)(CronStepper, {
							id: rowId("minute"),
							min: 0,
							max: 59,
							value: builder.minute,
							disabled,
							increaseLabel: t("cronForm.minuteIncrease"),
							decreaseLabel: t("cronForm.minuteDecrease"),
							onChange: (minute) => {
								onEditExpression(cronShapeExpression({
									...builder,
									minute
								}));
							}
						})
					})]
				}),
				(builder?.kind === "daily" || builder?.kind === "weekly" || builder?.kind === "monthly") && (0, react_jsx_runtime.jsxs)("div", {
					className: TaskManagerPage_module_css_default.ruleRow,
					children: [(0, react_jsx_runtime.jsx)("label", {
						className: TaskManagerPage_module_css_default.ruleLabel,
						htmlFor: rowId("time"),
						children: t("timing.time")
					}), (0, react_jsx_runtime.jsxs)("span", {
						className: TaskManagerPage_module_css_default.menuGuard,
						onKeyDown: (event) => {
							guardMenuEscape(event, timeOpen, () => {
								setTimeOpen(false);
								timeRef.current?.focus();
							});
						},
						children: [(0, react_jsx_runtime.jsxs)("button", {
							ref: timeRef,
							id: rowId("time"),
							type: "button",
							className: clsx(TaskManagerPage_module_css_default.ruleInput, TaskManagerPage_module_css_default.ruleControl, TaskManagerPage_module_css_default.pickerTrigger),
							disabled,
							"aria-label": t("timing.time"),
							"aria-haspopup": "dialog",
							"aria-expanded": timeOpen,
							onClick: () => {
								setTimeOpen((open) => !open);
							},
							children: [(0, react_jsx_runtime.jsx)("span", { children: clock }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, { className: TaskManagerPage_module_css_default.pickerIcon })]
						}), (0, react_jsx_runtime.jsx)(ClockPicker, {
							open: timeOpen,
							anchorRef: timeRef,
							value: clock,
							seconds: false,
							onPick: (time) => {
								onEditExpression(cronShapeExpression({
									...builder,
									hour: Number(time.slice(0, 2)),
									minute: Number(time.slice(3, 5))
								}));
							},
							onClose: () => {
								setTimeOpen(false);
							},
							t
						})]
					})]
				}),
				builder === void 0 && (0, react_jsx_runtime.jsxs)("div", {
					className: TaskManagerPage_module_css_default.ruleRow,
					children: [(0, react_jsx_runtime.jsx)("label", {
						className: TaskManagerPage_module_css_default.ruleLabel,
						htmlFor: rowId("expression"),
						children: t("rule.cronLabel")
					}), (0, react_jsx_runtime.jsx)("input", {
						id: rowId("expression"),
						className: clsx(TaskManagerPage_module_css_default.ruleInput, TaskManagerPage_module_css_default.ruleControl),
						type: "text",
						spellCheck: false,
						autoComplete: "off",
						disabled,
						"aria-invalid": parsed === void 0,
						"aria-describedby": hintId,
						value: expression,
						onChange: (event) => {
							onEditExpression(event.target.value);
						}
					})]
				})
			] });
		}
		/**
		* One whole-number stepper of the cron builder, styled like the elapsed-interval
		* stepper. Values clamp to the shape's own bounds, and an emptied or fractional
		* input stages nothing, so the regenerated expression stays valid on every edit.
		* @param props - bounds, staged value, blocking state, arrow labels, and callback.
		* @returns the stepper pill.
		*/
		function CronStepper({ id, min, max, value, disabled, increaseLabel, decreaseLabel, onChange }) {
			const clamp = (next) => Math.min(max, Math.max(min, next));
			return (0, react_jsx_runtime.jsxs)("span", {
				className: TaskManagerPage_module_css_default.ruleIntervalStepper,
				style: { "--interval-digits": String(value).length },
				children: [(0, react_jsx_runtime.jsx)("input", {
					id,
					className: clsx(TaskManagerPage_module_css_default.ruleInput, TaskManagerPage_module_css_default.ruleControl, TaskManagerPage_module_css_default.ruleIntervalInput),
					type: "number",
					min,
					max,
					step: 1,
					disabled,
					value,
					onChange: (event) => {
						const next = Number(event.target.value);
						if (event.target.value === "" || !Number.isSafeInteger(next)) return;
						onChange(clamp(next));
					}
				}), (0, react_jsx_runtime.jsxs)("span", {
					className: TaskManagerPage_module_css_default.ruleIntervalArrows,
					children: [(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: TaskManagerPage_module_css_default.ruleIntervalArrow,
						"aria-label": increaseLabel,
						disabled: disabled || value >= max,
						onClick: () => {
							onChange(clamp(value + 1));
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, { size: 9 })
					}), (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: TaskManagerPage_module_css_default.ruleIntervalArrow,
						"aria-label": decreaseLabel,
						disabled: disabled || value <= min,
						onClick: () => {
							onChange(clamp(value - 1));
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 9 })
					})]
				})]
			});
		}
		//#endregion
