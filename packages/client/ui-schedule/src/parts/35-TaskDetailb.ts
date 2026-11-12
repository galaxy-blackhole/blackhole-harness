/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		function ruleKind(record) {
			if (record.kind === "weekly" && isWeekdayRule(record.weekdays)) return "weekdays";
			return RULE_KIND_BY_RECORD[record.kind];
		}
		/**
		* Choice that states the same stored rule as another.
		*
		* The Monday-to-Friday choice and the weekly choice both submit one Host
		* `weekly` rule, so a comparison of choices must fold them together; the three
		* elapsed-interval choices already share the one `every` choice, and every other
		* choice names its own Host rule.
		* @param kind - Repeat row choice.
		* @returns the choice that states the same stored rule.
		*/
		function storedRuleChoice(kind) {
			return kind === "weekdays" ? "weekly" : kind;
		}
		/**
		* Preserve a native time's declared precision when only minutes were entered.
		* @param time - native time value.
		* @returns the same time with whole seconds.
		*/
		function withSeconds(time) {
			return time.length === 5 ? `${time}:00` : time;
		}
		/**
		* Native input values a rule gets when it is on, or switches to, one choice.
		*
		* A one-shot target, a daily clock time, a Monday-to-Friday clock time, and a
		* weekly clock time all start from the zone the stored rule states, or from
		* this device's zone when the rule stores none; the one-shot rows show the
		* committed occurrence in that zone, so the pair still names the same instant.
		* The weekly choice seeds its weekday set separately, and the cron choice seeds
		* a daily expression from that occurrence. A switch between two clock-time
		* choices replaces the seeded time and zone with the pair the card shows,
		* wherever `chooseKind` carries it, and a switch into the elapsed interval
		* replaces its seeded seconds with `seedIntervalSeconds` for the chosen unit.
		* @param record - shown rule.
		* @param kind - choice to seed.
		* @returns complete native input values for that choice.
		*/
		function seedDraft(record, kind) {
			const zone = draftZone(record).zone;
			switch (kind) {
				case "once": {
					const wallClock = zonedWallClock(record.scheduledAt, zone);
					return {
						date: wallClock.slice(0, 10),
						time: wallClock.slice(11, 23),
						timeZone: zone,
						seconds: "",
						expression: ""
					};
				}
				case "every": return {
					date: "",
					time: "",
					timeZone: "",
					seconds: String(RULE_DEFAULT_EVERY_SECONDS),
					expression: ""
				};
				case "daily":
				case "weekdays":
				case "weekly": return {
					date: "",
					time: zonedWallClock(record.scheduledAt, zone).slice(11, 23),
					timeZone: zone,
					seconds: "",
					expression: ""
				};
				case "cron": return {
					date: "",
					time: "",
					timeZone: zone,
					seconds: "",
					expression: seedCronExpression(record, zone)
				};
			}
		}
		/**
		* Cron expression the cron choice starts from: the committed occurrence's clock
		* in the choice's zone as a daily rule, the same instant and zone the other
		* wall-clock choices seed their time row with.
		* @param record - shown rule.
		* @param zone - IANA zone the seeded expression is stated in.
		* @returns five-field expression matching that occurrence.
		*/
		function seedCronExpression(record, zone) {
			const wallClock = zonedWallClock(record.scheduledAt, zone);
			return `${Number(wallClock.slice(14, 16))} ${Number(wallClock.slice(11, 13))} * * *`;
		}
		/**
		* ISO weekday set the weekly choice edits. A weekly rule keeps its stored set;
		* another kind seeds the committed occurrence's weekday in the zone `seedDraft`
		* gives that choice, so the set and the seeded clock describe the same local day.
		* A switch between two clock-time choices carries the shown clock and zone into
		* that time, and the weekly choice then takes the occurrence's weekday in that
		* zone from `zonedWeekday`, so the set and the carried clock name one local day.
		* @param record - shown rule.
		* @returns ascending ISO weekdays, never empty.
		*/
		function seedWeekdays(record) {
			if (record.kind === "weekly") return [...record.weekdays];
			const zone = draftZone(record).zone;
			return [zonedWeekday(record.scheduledAt, zone)];
		}
		/**
		* ISO weekday one instant falls on in one zone, for the weekly choice's set.
		*
		* The formatter locale is fixed, because the seeded weekday is part of the rule
		* a save submits: it must not change with the interface language.
		* @param instant - canonical instant the rule commits.
		* @param timeZone - IANA zone whose calendar day names the weekday.
		* @returns that weekday, ISO 1 through 7; an unparsable instant reads UTC.
		*/
		function zonedWeekday(instant, timeZone) {
			const at = new Date(instant);
			let calendarDay;
			try {
				const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
					timeZone,
					year: "numeric",
					month: "2-digit",
					day: "2-digit"
				}).formatToParts(at).map((part) => [part.type, part.value]));
				calendarDay = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
			} catch {
				calendarDay = at;
			}
			return (calendarDay.getUTCDay() + 6) % 7 + 1;
		}
		/**
		* Build the timing change one staged Run time draft saves.
		*
		* The draft already holds complete values for its choice: switching recurrence
		* seeds them at the switch, so every edit stays in the request.
		* @param draft - values the card shows.
		* @param kind - choice the values belong to.
		* @param weekdays - ISO weekday set the weekly choice saves.
		* @returns the complete timing change for the compare-and-update request.
		*/
		function ruleChange(draft, kind, weekdays) {
			switch (kind) {
				case "once": return {
					kind: "at",
					at: {
						date: draft.date,
						time: withSeconds(draft.time),
						time_zone: draft.timeZone.trim()
					}
				};
				case "every": return {
					kind: "every",
					every_seconds: Number(draft.seconds)
				};
				case "daily": return {
					kind: "daily",
					daily: {
						time: withSeconds(draft.time),
						time_zone: draft.timeZone.trim()
					}
				};
				case "cron": return {
					kind: "cron",
					cron: {
						expression: draft.expression.trim(),
						time_zone: draft.timeZone.trim()
					}
				};
				case "weekdays":
				case "weekly": return {
					kind: "weekly",
					weekly: {
						time: withSeconds(draft.time),
						time_zone: draft.timeZone.trim(),
						weekdays: kind === "weekdays" ? [...WEEKDAY_RULE] : [...weekdays]
					}
				};
			}
		}
		/**
		* Longest task name the Host accepts. The browser-safe Schedule entry exports
		* types only, so the client repeats the limit its local validation uses.
		*/
		const RULE_TITLE_MAX_LENGTH = 120;
		/**
		* Whether a staged one-shot date is a real ISO calendar date.
		*
		* The control is a text field, so the value can be anything the reader types;
		* only `YYYY-MM-DD` naming an existing day is accepted. A round trip through
		* `Date.UTC` rejects a shape-correct but impossible date such as `2026-02-31`.
		* @param value - staged date text.
		* @returns true when the text is an existing ISO calendar date.
		*/
		function validIsoDate(value) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
			const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
			return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
		}
		/**
		* Local validation of a staged draft before it is saved.
		* @param shown - values the detail shows.
		* @returns dictionary key of the invalid field, or undefined when the draft can be saved.
		*/
		function draftError(shown) {
			const title = shown.title.trim();
			if (title.length === 0 || title.length > RULE_TITLE_MAX_LENGTH) return "rule.invalidTitle";
			if (shown.prompt.trim().length === 0) return "rule.invalidPrompt";
			if (shown.kind === "every") return /^\d+$/.test(shown.draft.seconds) && Number(shown.draft.seconds) >= MIN_INTERVAL_SECONDS ? void 0 : "timing.invalidInterval";
			if (shown.kind === "cron") return parseCronExpression(shown.draft.expression) === void 0 ? "rule.cronInvalid" : void 0;
			if (shown.kind === "once" && !validIsoDate(shown.draft.date) || !/^\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(shown.draft.time)) return "timing.invalid";
		}
		/**
		* Name and instruction one staged save replaces, omitting each value the
		* authoritative record already stores.
		* @param shown - values the detail edits.
		* @param stored - authoritative values the request carries as its expected record.
		* @returns content fields to submit, empty when both already match that record.
		*/
		function contentChange(shown, stored) {
			const content = {};
			const title = shown.title.trim();
			const prompt = shown.prompt.trim();
			if (title !== stored.title) content.title = title;
			if (prompt !== stored.prompt) content.prompt = prompt;
			return content;
		}
		/**
		* Display the recurrence the Repeat row shows: the staged choice while it differs
		* from the stored kind, otherwise the stored rule's localized frequency. The
		* cron choice always reads as its menu label: the rule card's own rows and
		* sentence state the rule, and an unrecognized expression has no short summary.
		* @param record - stored rule.
		* @param kind - choice the draft stages.
		* @param t - namespace-bound task-manager translate.
		* @param zone - host-zone context the frequency line uses to omit or name the stored zone.
		* @returns localized recurrence text.
		*/
		function repeatValue(record, kind, t, zone) {
			if (kind === "cron" || ruleKind(record) !== kind) return t(RULE_KIND_LABELS[kind]);
			return formatScheduleFrequency(record, t, zone);
		}
		/** Prefer the largest friendly unit that represents a stored whole-second interval exactly. */
		function preferredIntervalUnit(seconds) {
			const value = Number(seconds);
			if (Number.isSafeInteger(value) && value > 0 && value % INTERVAL_UNIT_SECONDS.hour === 0) return "hour";
			if (Number.isSafeInteger(value) && value > 0 && value % INTERVAL_UNIT_SECONDS.minute === 0) return "minute";
			return "second";
		}
		/** Repeat-menu label for one elapsed interval unit. */
		function intervalRuleLabel(unit) {
			if (unit === "hour") return "rule.everyHours";
			if (unit === "minute") return "rule.everyMinutes";
			return "rule.everySeconds";
		}
		/** Whether one visible Repeat-menu option selects an elapsed interval. */
		function isIntervalChoice(choice) {
			return choice === "every-hour" || choice === "every-minute" || choice === "every-second";
		}
		/** Stored interval unit selected by one visible interval choice. */
		function intervalChoiceUnit(choice) {
			if (choice === "every-hour") return "hour";
			if (choice === "every-minute") return "minute";
			return "second";
		}
		/**
		* Elapsed seconds the elapsed-interval row starts from when the user selects one
		* unit explicitly, so the number the row shows and the unit it shows agree: 3600
		* seconds is one whole hour and sixty whole minutes. The unit itself always
		* follows the user's choice, so this seed never has to express minutes or
		* seconds as the base unit.
		* @returns whole seconds that display as a whole number of the chosen unit.
		*/
		function seedIntervalSeconds() {
			return INTERVAL_UNIT_SECONDS.hour;
		}
		/**
		* Three shared timing messages name Save, Cancel, and a retained draft, none of
		* which this card has; the other codes keep their shared wording.
		*/
		const RULE_ERROR_OVERRIDES = {
			"timing.conflict": "rule.error.conflict",
			"timing.notFound": "rule.error.notFound",
			"timing.error": "rule.error.unknown"
		};
		/**
		* Localize a rejected rule update without exposing transport or storage diagnostics.
		* @param code - error code returned by the compare-and-update.
		* @returns dictionary key describing the recovery action.
		*/
		function ruleError(code) {
			const key = timingError(code);
			return RULE_ERROR_OVERRIDES[key] ?? key;
		}
		/**
		* Close an open dropdown on Escape before the page's own Escape handler sees
		* the key, so dismissing a menu never closes the whole task detail. Stopping
		* the key's propagation withholds it from the menu's own document listener,
		* which the page's handler honors; this guard covers a dropdown whose listener
		* stands down before that.
		* @param event - keydown from the wrapper around that menu.
		* @param open - whether this wrapper's menu is showing.
		* @param close - dismiss that menu and return focus to its trigger.
		*/
		function guardMenuEscape(event, open, close) {
			if (event.key !== "Escape") return;
			if (!open) return;
			event.stopPropagation();
			close();
		}
		/**
		* Seed the detail's editable values from one stored record.
		* @param record - rule to seed from.
		* @returns complete shown values for that rule.
		*/
		function ruleValues(record) {
			return {
				title: record.title,
				prompt: record.prompt,
				kind: ruleKind(record),
				draft: timingDraft(record),
				weekdays: seedWeekdays(record)
			};
		}
		/**
		* Seed the detail's staged draft state from one stored record.
		* @param record - rule to seed from.
		* @returns a clean draft that equals its stored values.
		*/
		function initialRuleEdit(record) {
			const values = ruleValues(record);
			return {
				propKey: shownValues(values),
				stored: values,
				shown: values
			};
		}
		/**
		* Comparison key of the staged timing values alone, without the stored record's
		* identity or committed target.
		* @param shown - values the detail displays.
		* @returns key that changes exactly when one staged timing value changes.
		*/
		function timingValues(shown) {
			const { kind, draft, weekdays } = shown;
			return JSON.stringify([
				kind,
				draft.date,
				draft.time,
				draft.timeZone,
				draft.seconds,
				draft.expression,
				weekdays
			]);
		}
		/**
		* Comparison key of every staged value, without the stored record's identity or
		* committed target. The name and instruction compare trimmed, because the Host
		* stores both trimmed.
		* @param shown - values the detail displays.
		* @returns key that changes exactly when one shown value changes.
		*/
		function shownValues(shown) {
			return JSON.stringify([
				shown.title.trim(),
				shown.prompt.trim(),
				timingValues(shown)
			]);
		}
		/**
		* Choose one merged text field: text the user changed keeps the draft value,
		* and text the user left untouched takes the refreshed record. Both sides
		* compare trimmed, because the Host stores both trimmed.
		* @param draft - text the control shows.
		* @param stored - authoritative text the draft was compared against.
		* @param authoritative - text of the refreshed record.
		* @returns the text the merge keeps.
		*/
		function reseedText(draft, stored, authoritative) {
			return draft.trim() === stored.trim() ? authoritative : draft;
		}
		/** Whether two weekday sets hold the same days in the same order. */
		function sameWeekdays(left, right) {
			return left.length === right.length && left.every((day, index) => day === right[index]);
		}
		/**
		* Whether the user changed any timing field of a draft.
		* @param draft - values the detail currently shows.
		* @param stored - values the draft was compared against.
		* @returns whether any timing field differs from the stored one.
		*/
		function editedTiming(draft, stored) {
			return draft.draft.date !== stored.draft.date || draft.draft.time !== stored.draft.time || draft.draft.timeZone !== stored.draft.timeZone || draft.draft.seconds !== stored.draft.seconds || draft.draft.expression !== stored.draft.expression || !sameWeekdays(draft.weekdays, stored.weekdays);
		}
		/**
		* Choose one merged timing field of a draft whose rule kind did not change.
		* @param draft - value the detail shows.
		* @param stored - value the draft was compared against.
		* @param authoritative - value of the refreshed record.
		* @returns the value the merge keeps.
		*/
		function reseedValue(draft, stored, authoritative) {
			return draft === stored ? authoritative : draft;
		}
		/**
		* Merge one refreshed authoritative record into a staged draft.
		*
		* Three cases, because a rule kind and the fields that describe it are one
		* value. The Monday-to-Friday choice and the weekly choice state the same Host
		* weekly rule, so the comparisons below fold them together and only the day set
		* tells them apart.
		*
		* The draft stages another kind than the stored record. Its fields describe a
		* rule the refreshed record does not state, so the draft keeps them whole.
		*
		* The draft stages the stored kind, and the refreshed record changed that kind.
		* The two rules cannot be mixed, so the draft is kept whole when the user edited
		* it and the refreshed rule is adopted whole when the user did not.
		*
		* All three kinds agree. Only here can one field differ legitimately on each
		* side, so the fields merge on their own: a field the user changed keeps the
		* draft value and every other field takes the refreshed record, which is what
		* carries a concurrent remote timing edit into an unrelated local edit.
		*
		* The name and the instruction merge field by field in every case: another
		* client's rename reaches this detail even while a rule change is staged.
		* @param authoritative - values of the refreshed record.
		* @param draft - values the detail currently shows.
		* @param stored - authoritative values the draft was compared against.
		* @returns the merged values.
		*/
		function mergeRuleDraft(authoritative, draft, stored) {
			const text = {
				title: reseedText(draft.title, stored.title, authoritative.title),
				prompt: reseedText(draft.prompt, stored.prompt, authoritative.prompt)
			};
			if (storedRuleChoice(draft.kind) !== storedRuleChoice(stored.kind)) return {
				...draft,
				...text
			};
			if (storedRuleChoice(authoritative.kind) !== storedRuleChoice(stored.kind)) return editedTiming(draft, stored) ? {
				...draft,
				...text
			} : {
				...authoritative,
				...text
			};
			const weekdays = sameWeekdays(draft.weekdays, stored.weekdays) ? authoritative.weekdays : draft.weekdays;
			const stagedChoice = draft.kind !== stored.kind || !sameWeekdays(draft.weekdays, stored.weekdays);
			return {
				...text,
				kind: storedRuleChoice(draft.kind) === "weekly" ? stagedChoice ? draft.kind : isWeekdayRule(weekdays) ? "weekdays" : "weekly" : reseedValue(draft.kind, stored.kind, authoritative.kind),
				draft: {
					date: reseedValue(draft.draft.date, stored.draft.date, authoritative.draft.date),
					time: reseedValue(draft.draft.time, stored.draft.time, authoritative.draft.time),
					timeZone: reseedValue(draft.draft.timeZone, stored.draft.timeZone, authoritative.draft.timeZone),
					seconds: reseedValue(draft.draft.seconds, stored.draft.seconds, authoritative.draft.seconds),
					expression: reseedValue(draft.draft.expression, stored.draft.expression, authoritative.draft.expression)
				},
				weekdays
			};
		}
		/**
		* Render the weekly rule's Weekday row: one pill per weekday, named by the row's
		* label and toggled in the rule the caller is editing.
		* @param props.weekdays - weekdays the rule currently selects, as the builder's stored day numbers.
		* @param props.disabled - whether the rule's controls are read-only.
		* @param props.t - frequency translator owning the weekday labels.
		* @param props.rowId - id builder for the row's label, which names the pill group.
		* @param props.onToggle - toggle one weekday in the rule being edited.
		* @returns the labelled Weekday row.
		*/
		function WeekdayRow({ weekdays, disabled, t, rowId, onToggle }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: TaskManagerPage_module_css_default.ruleRow,
				children: [(0, react_jsx_runtime.jsx)("span", {
					className: TaskManagerPage_module_css_default.ruleLabel,
					id: rowId("weekday"),
					children: t("rule.weekday")
				}), (0, react_jsx_runtime.jsx)("div", {
					className: clsx(TaskManagerPage_module_css_default.ruleWeekdays, TaskManagerPage_module_css_default.ruleControl),
					role: "group",
					"aria-labelledby": rowId("weekday"),
					children: WEEKDAYS.map((weekday) => {
						const selected = weekdays.includes(weekday);
						return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
							className: TaskManagerPage_module_css_default.ruleControl,
							active: selected,
							disabled,
							"aria-pressed": selected,
							"aria-label": t("rule.weekdayOption", { weekday: t(WEEKDAY_LABELS[weekday]) }),
							onClick: () => {
								onToggle(weekday);
							},
							children: t(WEEKDAY_LABELS[weekday])
						}, weekday);
					})
				})]
			});
		}
		/**
		* Render the rule's recurrence, time, and zone as rows that edit a local draft.
		*
		* No row reaches the Host on its own: the detail's Save action submits the
		* complete expected record with the staged name, instruction, and timing change
		* through `schedule.update`.
		* @param props - task, staged values, blocking state, draft callbacks, and locale.
		* @returns the bordered Run time card with its staged rows.
		*/
