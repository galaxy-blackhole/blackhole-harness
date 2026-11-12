/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
							write(on ? initialEntries : void 0);
						}
					})]
				}), entries === void 0 ? null : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					entries.length > 0 ? (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["modelReasoningRow"],
						"aria-hidden": "true",
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["modelFieldLabel"],
							children: t("modelReasoningLevel")
						}), (0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["modelFieldLabel"],
							children: t("modelReasoningValue")
						})]
					}) : null,
					entries.map(([level, wire], index) => (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["modelReasoningRow"],
						children: [
							(0, react_jsx_runtime.jsx)("select", {
								className: `${ModelsSection_module_css_default["input"]} ${ModelsSection_module_css_default["selectInput"]}`,
								value: level,
								"aria-label": `${t("modelReasoningLevel")} ${String(index + 1)}`,
								disabled,
								onChange: (event) => {
									changeLevel(entries, index, level, wire, event.target.value);
								},
								children: choicesFor(level).map((choice) => (0, react_jsx_runtime.jsx)("option", {
									value: choice,
									children: choice
								}, choice))
							}),
							(0, react_jsx_runtime.jsx)("input", {
								className: `${ModelsSection_module_css_default["input"]} ${ModelsSection_module_css_default["modelReasoningValueInput"]}`,
								type: "text",
								value: typing?.level === level ? typing.text : typeof wire === "string" ? wire : "",
								placeholder: level === "off" ? t("modelReasoningOffValuePlaceholder") : level,
								"aria-label": `${level} ${t("modelReasoningValue")}`,
								"aria-invalid": !acceptedValue(level, wire),
								disabled: disabled || level === "off",
								onChange: (event) => {
									editValue(entries, index, level, event.target.value);
								},
								onBlur: () => {
									leaveValue(entries, index, level, wire);
								}
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${ModelsSection_module_css_default["iconButton"]} ${ModelsSection_module_css_default["iconButtonDanger"]}`,
								"aria-label": `${t("modelReasoningRemove")} ${level}`,
								title: t("modelReasoningRemove"),
								disabled,
								onClick: () => {
									write(entries.filter((_entry, at) => at !== index));
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
							})
						]
					}, index)),
					refused ? (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["error"],
						children: t("modelReasoningValueRequired")
					}) : missingLevel ? (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["error"],
						children: t("modelReasoningNeedsLevel")
					}) : null,
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: ModelsSection_module_css_default["addModelButton"],
						disabled: disabled || levels.every((level) => used.includes(level)),
						onClick: () => {
							addLevel(entries);
						},
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }), t("modelReasoningAdd")]
					})
				] })]
			});
		}
		//#endregion
		//#region lib/types/client/ModelRow.js
		/**
		* Render consistent model identity, capacity, and input-type controls.
		* @param props - drafted fields and their owning editor's actions.
		* @returns one expandable model entry.
		*/
		function ModelRow(props) {
			const { model, position, t, disabled } = props;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ModelsSection_module_css_default["modelEntry"],
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: ModelsSection_module_css_default["modelRow"],
					children: [
						["id", "name"].map((field) => (0, react_jsx_runtime.jsx)("input", {
							className: ModelsSection_module_css_default["input"],
							type: "text",
							value: typeof model[field] === "string" ? model[field] : "",
							placeholder: t(field === "id" ? "modelId" : "modelName"),
							"aria-label": `${t(field === "id" ? "modelId" : "modelName")} ${String(position)}`,
							disabled,
							onChange: (event) => {
								const value = event.target.value;
								props.onFieldChange(field, field === "name" && value === "" ? void 0 : value);
							},
							onBlur: field === "id" ? (event) => props.onIdBlur?.(event.target.value) : void 0
						}, field)),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ModelsSection_module_css_default["iconButton"],
							"aria-label": `${t("modelAdvanced")} ${String(position)}`,
							"aria-expanded": props.expanded,
							title: t("modelAdvanced"),
							onClick: props.onToggle,
							children: props.expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
						}),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: `${ModelsSection_module_css_default["iconButton"]} ${ModelsSection_module_css_default["iconButtonDanger"]}`,
							"aria-label": `${t("removeModel")} ${String(position)}`,
							title: t("removeModel"),
							disabled,
							onClick: props.onRemove,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
						})
					]
				}), props.expanded ? (0, react_jsx_runtime.jsxs)("div", {
					className: ModelsSection_module_css_default["modelAdvanced"],
					children: [
						["contextWindow", "maxTokens"].map((field) => (0, react_jsx_runtime.jsxs)("label", {
							className: ModelsSection_module_css_default["modelField"],
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: ModelsSection_module_css_default["modelFieldLabel"],
								children: t(field)
							}), (0, react_jsx_runtime.jsx)("input", {
								className: ModelsSection_module_css_default["input"],
								type: "text",
								inputMode: "numeric",
								value: props[field].value,
								placeholder: props[field].placeholder,
								"aria-label": `${t(field)} ${String(position)}`,
								disabled,
								onChange: (event) => {
									props[field].onChange(event.target.value);
								},
								onBlur: props[field].onBlur
							})]
						}, field)),
						(0, react_jsx_runtime.jsx)(ModelInputTypes, {
							model,
							field: props.inputField,
							position,
							fallback: props.inputFallback,
							disabled: disabled || props.inputLoading === true,
							t,
							onChange: props.onChange
						}),
						props.reasoningLevels !== void 0 && props.reasoningLevels.length > 0 ? (0, react_jsx_runtime.jsx)(ModelReasoningEfforts, {
							model,
							levels: props.reasoningLevels,
							position,
							disabled,
							t,
							onChange: props.onChange
						}) : null
					]
				}) : null]
			});
		}
		//#endregion
		//#region lib/types/client/DeepSeekModelsEditor.js
		/**
		* Curated editor for the direct DeepSeek adapter's advisory model catalog.
		* The settings layer replaces `models` as one array, so the parent supplies
		* the effective inherited rows until the first edit materializes a user
		* override; reset removes that override instead of copying defaults into it.
		*/
		/** Row index encoded in an editing-buffer key. */
		function rowOf(key) {
			return Number(key.slice(0, key.indexOf(":")));
		}
		/** Accepted capacity spellings: a decimal count with an optional K/M suffix. */
		const CAPACITY_PATTERN = /^(\d+(?:\.\d+)?)([km])?$/i;
		/** Decimal suffix scales — `1M` is 1000K, matching how model capacities are quoted. */
		const CAPACITY_SCALE = {
			k: 1e3,
			m: 1e6
		};
		/**
		* Read a typed capacity, so a user can write `256K` or `1M` instead of counting
		* zeroes. The stored value stays a plain token count.
		* @param text - raw field text.
		* @returns the count; `undefined` when blank (inherit), `NaN` when unreadable
		* (rejected by {@link validateDeepSeekModels} before any write).
		*/
		function parseCapacity(text) {
			const trimmed = text.trim();
			if (trimmed.length === 0) return void 0;
			const match = CAPACITY_PATTERN.exec(trimmed);
			if (match === null) return NaN;
			const suffix = match[2]?.toLowerCase();
			const scale = suffix === "k" || suffix === "m" ? CAPACITY_SCALE[suffix] : 1;
			const scaled = Number(match[1]) * scale;
			const rounded = Math.round(scaled);
			return Math.abs(scaled - rounded) < 1e-6 ? rounded : scaled;
		}
		/**
		* Spell a stored count back in the shortest form that survives a round trip
		* through {@link parseCapacity}; a count that is not a whole number of
		* thousands stays written out.
		* @param value - stored capacity.
		* @returns the field text.
		*/
		function formatCapacity(value) {
			if (!Number.isInteger(value) || value <= 0) return String(value);
			if (value % CAPACITY_SCALE.m === 0) return `${String(value / CAPACITY_SCALE.m)}M`;
			if (value % CAPACITY_SCALE.k === 0) return `${String(value / CAPACITY_SCALE.k)}K`;
			return String(value);
		}
		/** Convert a schema-validated catalog value into records without dropping hidden fields. */
		function modelDrafts(value) {
			if (!Array.isArray(value)) return [];
			return value.map((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry) ? entry : {});
		}
		/**
		* Validate adapter constraints that the serialized schema cannot express.
		* @param value - user-owned `models` value, or undefined while inherited.
		* @returns the first invalid row, or undefined when the adapter will accept it.
		*/
		function validateDeepSeekModels(value) {
			if (value === void 0) return void 0;
			const models = modelDrafts(value);
			const seen = /* @__PURE__ */ new Set();
			for (const [index, model] of models.entries()) {
				const id = model["id"];
				const trimmed = typeof id === "string" ? id.trim() : void 0;
				if (trimmed === void 0 || trimmed.length === 0) return {
					index,
					key: "modelIdRequired"
				};
				if (seen.has(trimmed)) return {
					index,
					key: "modelIdDuplicate"
				};
				seen.add(trimmed);
				const name = model["name"];
				if (name !== void 0 && (typeof name !== "string" || name.length === 0)) return {
					index,
					key: "modelNameInvalid"
				};
				const contextWindow = model["contextWindow"];
				if (contextWindow !== void 0 && (typeof contextWindow !== "number" || !Number.isInteger(contextWindow) || contextWindow <= 0)) return {
					index,
					key: "modelContextInvalid"
				};
				const maxTokens = model["maxTokens"];
				if (maxTokens !== void 0 && (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens <= 0)) return {
					index,
					key: "modelMaxTokensInvalid"
				};
			}
		}
		/**
		* Render the direct DeepSeek adapter's model catalog: id and display name on
		* each row, capacities and input types behind the row's own disclosure.
		* @param props - effective rows plus the array-level override actions.
		* @returns the catalog editor.
		*/
		function DeepSeekModelsEditor(props) {
			const [editing, setEditing] = (0, react.useState)(() => /* @__PURE__ */ new Map());
			const [expanded, setExpanded] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const update = (index, key, value) => {
				const next = props.models.map((model, at) => {
					const copy = { ...model };
					if (at !== index) return copy;
					if (value === void 0) Reflect.deleteProperty(copy, key);
					else copy[key] = value;
					return copy;
				});
				props.onChange(next);
			};
			const remove = (index) => {
				setEditing((current) => {
					const next = /* @__PURE__ */ new Map();
					for (const [key, text] of current) {
						const at = rowOf(key);
						if (at === index) continue;
						next.set(at > index ? key.replace(/^\d+/, String(at - 1)) : key, text);
					}
					return next;
				});
				setExpanded((current) => {
					const next = /* @__PURE__ */ new Set();
					for (const at of current) {
						if (at === index) continue;
						next.add(at > index ? at - 1 : at);
					}
					return next;
				});
				props.onChange(props.models.filter((_model, at) => at !== index).map((model) => ({ ...model })));
			};
			const reset = () => {
				setEditing(/* @__PURE__ */ new Map());
				setExpanded(/* @__PURE__ */ new Set());
				props.onReset();
			};
			const toggle = (index) => {
				setExpanded((current) => {
					const next = new Set(current);
					if (!next.delete(index)) next.add(index);
					return next;
				});
			};
			/** The field's text: its live keystrokes, else the stored count spelled short. */
			const capacityText = (model, index, field) => {
				const typed = editing.get(`${String(index)}:${field}`);
				if (typed !== void 0) return typed;
				const value = model[field];
				return typeof value === "number" ? formatCapacity(value) : "";
			};
			const settleCapacity = (index, field) => {
				const key = `${String(index)}:${field}`;
				const typed = editing.get(key);
				if (typed === void 0) return;
				const parsed = parseCapacity(typed);
				if (parsed !== void 0 && Number.isNaN(parsed)) return;
				setEditing((current) => {
					const next = new Map(current);
					next.delete(key);
					return next;
				});
			};
			const capacityInput = (model, index, field, fallback) => ({
				value: capacityText(model, index, field),
				placeholder: fallback === void 0 ? props.t(field === "contextWindow" ? "contextWindowPlaceholder" : "maxTokensPlaceholder") : formatCapacity(fallback),
				onChange: (text) => {
					setEditing((current) => new Map(current).set(`${String(index)}:${field}`, text));
					update(index, field, parseCapacity(text));
				},
				onBlur: () => {
					settleCapacity(index, field);
				}
			});
			return (0, react_jsx_runtime.jsxs)("section", {
				className: ModelsSection_module_css_default["modelCatalog"],
				"aria-label": props.t("models"),
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["modelListHead"],
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: ModelsSection_module_css_default["modelCatalogHeading"],
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: ModelsSection_module_css_default["modelCatalogTitle"],
								children: props.t("models")
							}), (0, react_jsx_runtime.jsx)("span", {
								className: ModelsSection_module_css_default["modelCatalogMeta"],
								children: props.overridden ? props.t("modelsCustomized") : props.t("modelsInherited")
							})]
						}), props.overridden ? (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ModelsSection_module_css_default["linkButton"],
							disabled: props.disabled,
							onClick: reset,
							children: props.t("resetModels")
						}) : null]
					}),
					props.models.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["modelEmpty"],
						children: props.t("modelsEmpty")
					}) : (0, react_jsx_runtime.jsx)("div", {
						className: ModelsSection_module_css_default["modelList"],
						children: props.models.map((model, index) => (0, react_jsx_runtime.jsx)(ModelRow, {
							model,
							position: index + 1,
							inputField: "inputModalities",
							expanded: expanded.has(index),
							disabled: props.disabled,
							t: props.t,
							contextWindow: capacityInput(model, index, "contextWindow", props.defaultContextWindow),
							maxTokens: capacityInput(model, index, "maxTokens", props.defaultMaxTokens),
							onFieldChange: (field, value) => {
								update(index, field, value);
							},
							onIdBlur: (value) => {
								const trimmed = value.trim();
								if (trimmed !== value) update(index, "id", trimmed);
							},
							onChange: (next) => {
								props.onChange(props.models.map((row, at) => at === index ? next : row));
							},
							onToggle: () => {
								toggle(index);
							},
							onRemove: () => {
								remove(index);
							}
						}, index))
					}),
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: ModelsSection_module_css_default["addModelButton"],
						disabled: props.disabled,
export {};
