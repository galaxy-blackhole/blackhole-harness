/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					defaultValue: value,
					placeholder: t("fontFamily.placeholder"),
					"aria-label": title,
					spellCheck: false,
					autoComplete: "off",
					onBlur: (event) => {
						commit(event.currentTarget);
					},
					maxLength: 200,
					onKeyDown: (event) => {
						if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
						if (event.key === "Enter") event.currentTarget.blur();
					}
				}, value)]
			});
		}
		//#endregion
		//#region lib/types/client/FontSizeRow.js
		/**
		* Font-size preference row: title + role description + stepper pill (centered value; hover
		* reveals the up/down arrow column anchored to the pill's right edge) + a px
		* unit label after the pill. The text row is registered into the General
		* section item slot; the code and terminal rows render inside the font
		* settings group. The displayed value follows the persisted setting, never the
		* click echo.
		*/
		/**
		* Render the font-size row.
		* @param props - composed slot props.
		* @returns the row element tree.
		*/
		function FontSizeRow({ t, role, setFontSize, useStore, expander }) {
			const fontSize = useStore((s) => s.fontSizes[role]);
			const { min, max } = FONT_SIZE_SPECS[role];
			return (0, react_jsx_runtime.jsxs)("div", {
				className: FontSizeRow_module_css_default.row,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: FontSizeRow_module_css_default.rowText,
					children: [(0, react_jsx_runtime.jsx)("div", {
						className: FontSizeRow_module_css_default.title,
						children: t(`fontSize.${role}.title`)
					}), (0, react_jsx_runtime.jsx)("div", {
						className: FontSizeRow_module_css_default.desc,
						children: t(`fontSize.${role}.description`)
					})]
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: FontSizeRow_module_css_default.control,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: FontSizeRow_module_css_default.stepper,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: FontSizeRow_module_css_default.value,
								children: fontSize
							}), (0, react_jsx_runtime.jsxs)("span", {
								className: FontSizeRow_module_css_default.arrows,
								children: [(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FontSizeRow_module_css_default.arrow,
									"aria-label": t(`fontSize.${role}.increase`),
									disabled: fontSize >= max,
									onClick: () => {
										setFontSize(fontSize + 1);
									},
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, { size: 9 })
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FontSizeRow_module_css_default.arrow,
									"aria-label": t(`fontSize.${role}.decrease`),
									disabled: fontSize <= min,
									onClick: () => {
										setFontSize(fontSize - 1);
									},
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 9 })
								})]
							})]
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: FontSizeRow_module_css_default.unit,
							children: t("fontSize.unit")
						}),
						expander !== void 0 && (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: FontSizeRow_module_css_default.expander,
							"aria-label": t("fontSize.more"),
							title: t("fontSize.more"),
							"aria-expanded": expander.open,
							"aria-controls": expander.controls,
							onClick: expander.onToggle,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 12 })
						})
					]
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/client/FontSettingsGroup.module.css.mjs
		const css = "._01tsjW_group:last-child>:last-child,._01tsjW_group:last-child>:last-child>:last-child{border-bottom:0}";
		const tagId = "@deepseek-ai/dsh-client-ui-theme/FontSettingsGroup.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-theme";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var FontSettingsGroup_module_css_default = { "group": "_01tsjW_group" };
		//#endregion
		//#region lib/types/client/FontSettingsGroup.js
		/**
		* Font settings registered into the General section item slot: the text
		* font-size row, whose disclosure button expands a region holding the font
		* row for each role and the code and terminal size rows. The region starts
		* collapsed on every mount.
		*/
		/**
		* Render the text font-size row and its expandable font settings.
		* @param props - composed slot props.
		* @returns the text size row and, when expanded, the font rows.
		*/
		function FontSettingsGroup({ setFontFamily, setFontSize, ...shared }) {
			const [open, setOpen] = (0, react.useState)(false);
			const regionId = (0, react.useId)();
			const family = (role) => (0, react_jsx_runtime.jsx)(FontFamilyRow, {
				...shared,
				role,
				setFontFamily: (value) => {
					setFontFamily(role, value);
				}
			});
			const size = (role, expander) => (0, react_jsx_runtime.jsx)(FontSizeRow, {
				...shared,
				role,
				expander,
				setFontSize: (px) => {
					setFontSize(role, px);
				}
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: FontSettingsGroup_module_css_default.group,
				children: [size("text", {
					open,
					controls: regionId,
					onToggle: () => {
						setOpen((value) => !value);
					}
				}), open && (0, react_jsx_runtime.jsxs)("div", {
					id: regionId,
					children: [
						family("text"),
						family("code"),
						size("code"),
						family("terminal"),
						size("terminal")
					]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/settings-store.js
		/**
		* Appearance and font row slot stores: mirrors of the theme service
		* snapshot. The plugin's apply-world change listener is the only writer; the
		* row components read via props.useStore.
		*/
		/**
		* Declares the Appearance row state and write surface.
		* @returns the store handle.
		*/
		function createAppearanceRowStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					preference: "system",
					revision: -1
				}),
				actions: { sync: (d, preference, revision) => {
					if (revision <= d.revision) return;
					d.preference = preference;
					d.revision = revision;
				} }
			});
		}
		/**
		* Declares the font rows' state and write surface.
		* @returns the store handle.
		*/
		function createFontRowStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					fontSizes: DEFAULT_FONT_SIZES,
					fontFamilies: {
						text: "",
						code: "",
						terminal: ""
					},
					revision: -1
				}),
				actions: { sync: (d, fontSizes, fontFamilies, revision) => {
					if (revision <= d.revision) return;
					d.fontSizes = fontSizes;
					d.fontFamilies = fontFamilies;
					d.revision = revision;
				} }
			});
		}
		//#endregion
		//#region \0dsh-inline-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/styles/base.css.mjs
		var base_css_default = ":root{--dsh-font-family-text-default:-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Helvetica Neue\", Helvetica, Arial, sans-serif;--dsw-font-family:var(--dsh-font-family-text-default);--dsw-font-family-brand:\"Montserrat\", var(--dsh-font-family-text-default);--dsh-font-family-code-default:\"SF Mono\", \"JetBrains Mono\", \"Fira Code\", Consolas, \"Liberation Mono\", Menlo, Courier, \"PingFang SC\", \"Microsoft YaHei\";--ds-font-family-code:var(--dsh-font-family-code-default);--ds-ease-in-out:cubic-bezier(.4, 0, .2, 1);--ds-transition-duration:.2s;--ds-transition-duration-fast:.1s;--ds-transition-duration-slow:.3s;--dsw-radius-xs:4px;--dsw-radius-sm:8px;--dsw-radius-md:12px;--dsw-radius-lg:16px;--dsw-radius-xl:20px;--dsw-radius-panel:28px}body{--dsw-font-family:var(--dsh-font-family-text,var(--dsh-font-family-text-default)), var(--dsh-font-family-text-default);--ds-font-family-code:var(--dsh-font-family-code,var(--dsh-font-family-code-default)), var(--dsh-font-family-code-default);--dsw-alias-settings-card-fill:var(--dsw-alias-bg-layer-2);--dsw-alias-settings-card-stroke:var(--dsw-alias-border-l4)}[data-dsh-automatic-focus]:focus,[data-dsh-automatic-focus]:focus:focus-visible{outline:none}";
		//#endregion
		//#region \0dsh-inline-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/styles/corner-shape.css.mjs
		var corner_shape_css_default = "@supports (corner-shape:superellipse(1.5)){:root{--dsw-corner-shape:superellipse(1.5)}*,:before,:after{corner-shape:var(--dsw-corner-shape)}}";
		//#endregion
		//#region \0dsh-inline-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css.mjs
		var design_platform_css_default = "body{--dsw-static-amber-100:#fef5e7;--dsw-static-amber-400:#f7ad31;--dsw-static-amber-500:#f59e0b;--dsw-static-amber-600:#dd8629;--dsw-static-amber-900:#27241f;--dsw-static-blue-100:#dbeafe;--dsw-static-blue-300:#93c5fd;--dsw-static-blue-400:#60a5fa;--dsw-static-blue-450:#4d93f8;--dsw-static-blue-500:#3b82f6;--dsw-static-blue-50:#eff6ff;--dsw-static-blue-50p:#eaf3ff;--dsw-static-blue-600:#2563eb;--dsw-static-blue-75:#e5f0ff;--dsw-static-blue-800:#1e40af;--dsw-static-blue-900:#0e3074;--dsw-static-blue-950:#172554;--dsw-static-deepseek-100:#e4edfd;--dsw-static-deepseek-200:#d3e2ff;--dsw-static-deepseek-300:#b7c8fe;--dsw-static-deepseek-400:#7aaaff;--dsw-static-deepseek-450:#5686fe;--dsw-static-deepseek-500:#4176e6;--dsw-static-deepseek-50:#edf3fe;--dsw-static-deepseek-600:#4868b2;--dsw-static-deepseek-700-delete:#2f4c8f;--dsw-static-deepseek-800:#34415b;--dsw-static-deepseek-900:#283142;--dsw-static-green-100:#e6faed;--dsw-static-green-400:#4ed17e;--dsw-static-green-500:#22c55e;--dsw-static-green-500-a08:#22c55e14;--dsw-static-green-500-a12:#22c55e1f;--dsw-static-green-900:#233c2c;--dsw-static-neutral-00:#fff;--dsw-static-neutral-1000:#000;--dsw-static-neutral-100:#f5f5f5;--dsw-static-neutral-150:#ededed;--dsw-static-neutral-200:#e5e5e5;--dsw-static-neutral-250:#dcdcdc;--dsw-static-neutral-300:#d4d4d4;--dsw-static-neutral-400:#a2a4a6;--dsw-static-neutral-500:#7f8287;--dsw-static-neutral-50:#fafafa;--dsw-static-neutral-550:#65676b;--dsw-static-neutral-600:#545557;--dsw-static-neutral-700:#3c3c3d;--dsw-static-neutral-800:#292929;--dsw-static-neutral-850:#212123;--dsw-static-neutral-900:#0f0f0f;--dsw-static-neutral-bluish-00:#fff;--dsw-static-neutral-bluish-1000:#0f1115;--dsw-static-neutral-bluish-100:#ebeef2;--dsw-static-neutral-bluish-150:#e9ecf2;--dsw-static-neutral-bluish-200:#e1e5ee;--dsw-static-neutral-bluish-300:#cfd3d6;--dsw-static-neutral-bluish-400:#adb2b8;--dsw-static-neutral-bluish-500:#979da6;--dsw-static-neutral-bluish-50:#f9fafb;--dsw-static-neutral-bluish-600:#81858c;--dsw-static-neutral-bluish-60:#f5f6f7;--dsw-static-neutral-bluish-700:#61666b;--dsw-static-neutral-bluish-750:#43454a;--dsw-static-neutral-bluish-75:#f1f3f5;--dsw-static-neutral-bluish-800:#353638;--dsw-static-neutral-bluish-850:#2c2c2e;--dsw-static-neutral-bluish-875:#232324;--dsw-static-neutral-bluish-900:#1b1b1c;--dsw-static-neutral-bluish-950:#151517;--dsw-static-red-100:#fee2e2;--dsw-static-red-400:#f25a5a;--dsw-static-red-400-a12:#f25a5a1f;--dsw-static-red-500:#ef4444;--dsw-static-red-50:#fef2f2;--dsw-static-red-600:#ec1313;--dsw-static-red-600-a08:#ec131314;--dsw-static-red-900:#570c0c}body[data-ds-dark-theme]{--dsw-static-amber-100:#fef5e7;--dsw-static-amber-400:#f7ad31;--dsw-static-amber-500:#f59e0b;--dsw-static-amber-600:#dd8629;--dsw-static-amber-900:#27241f;--dsw-static-blue-100:#dbeafe;--dsw-static-blue-300:#93c5fd;--dsw-static-blue-400:#60a5fa;--dsw-static-blue-450:#4d93f8;--dsw-static-blue-500:#3b82f6;--dsw-static-blue-50:#eff6ff;--dsw-static-blue-50p:#eaf3ff;--dsw-static-blue-600:#2563eb;--dsw-static-blue-75:#e5f0ff;--dsw-static-blue-800:#1e40af;--dsw-static-blue-900:#0e3074;--dsw-static-blue-950:#172554;--dsw-static-deepseek-100:#e4edfd;--dsw-static-deepseek-200:#d3e2ff;--dsw-static-deepseek-300:#b7c8fe;--dsw-static-deepseek-400:#7aaaff;--dsw-static-deepseek-450:#5686fe;--dsw-static-deepseek-500:#4176e6;--dsw-static-deepseek-50:#edf3fe;--dsw-static-deepseek-600:#4868b2;--dsw-static-deepseek-700-delete:#2f4c8f;--dsw-static-deepseek-800:#34415b;--dsw-static-deepseek-900:#283142;--dsw-static-green-100:#e6faed;--dsw-static-green-400:#4ed17e;--dsw-static-green-500:#22c55e;--dsw-static-green-500-a08:#22c55e14;--dsw-static-green-500-a12:#22c55e1f;--dsw-static-green-900:#233c2c;--dsw-static-neutral-00:#fff;--dsw-static-neutral-1000:#000;--dsw-static-neutral-100:#f5f5f5;--dsw-static-neutral-150:#ededed;--dsw-static-neutral-200:#e5e5e5;--dsw-static-neutral-250:#dcdcdc;--dsw-static-neutral-300:#d4d4d4;--dsw-static-neutral-400:#a2a4a6;--dsw-static-neutral-500:#7f8287;--dsw-static-neutral-50:#fafafa;--dsw-static-neutral-550:#65676b;--dsw-static-neutral-600:#545557;--dsw-static-neutral-700:#3c3c3d;--dsw-static-neutral-800:#292929;--dsw-static-neutral-850:#212123;--dsw-static-neutral-900:#0f0f0f;--dsw-static-neutral-bluish-00:#fff;--dsw-static-neutral-bluish-1000:#0f1115;--dsw-static-neutral-bluish-100:#ebeef2;--dsw-static-neutral-bluish-150:#e9ecf2;--dsw-static-neutral-bluish-200:#e1e5ee;--dsw-static-neutral-bluish-300:#cfd3d6;--dsw-static-neutral-bluish-400:#adb2b8;--dsw-static-neutral-bluish-500:#979da6;--dsw-static-neutral-bluish-50:#f9fafb;--dsw-static-neutral-bluish-600:#81858c;--dsw-static-neutral-bluish-60:#f9fafb;--dsw-static-neutral-bluish-700:#61666b;--dsw-static-neutral-bluish-750:#43454a;--dsw-static-neutral-bluish-75:#f1f3f5;--dsw-static-neutral-bluish-800:#353638;--dsw-static-neutral-bluish-850:#2c2c2e;--dsw-static-neutral-bluish-875:#232324;--dsw-static-neutral-bluish-900:#1b1b1c;--dsw-static-neutral-bluish-950:#151517;--dsw-static-red-100:#fee2e2;--dsw-static-red-400:#f25a5a;--dsw-static-red-400-a12:#f25a5a1f;--dsw-static-red-500:#ef4444;--dsw-static-red-50:#fef2f2;--dsw-static-red-600:#ec1313;--dsw-static-red-600-a08:#ec131314;--dsw-static-red-900:#570c0c}body{--dsw-alias-bg-base:var(--dsw-static-neutral-bluish-00);--dsw-alias-bg-document-preview:var(--dsw-static-neutral-bluish-100);--dsw-alias-bg-document-selection:color-mix(in srgb, var(--dsw-static-blue-500) 40%, transparent);--dsw-alias-label-document-preview:var(--dsw-static-neutral-bluish-700);--dsw-alias-bg-layer-1:var(--dsw-static-neutral-bluish-00);--dsw-alias-bg-layer-2:var(--dsw-static-neutral-bluish-00);--dsw-alias-bg-layer-3:var(--dsw-static-neutral-bluish-00);--dsw-alias-bg-mask-1:#0000003d;--dsw-alias-bg-mask-2:#0000001f;--dsw-alias-bg-mask-3:#0000007a;--dsw-alias-bg-mask-photo:#000000e0;--dsw-alias-bg-mask-drop:#ffffffb3;--dsw-alias-bg-module-platform:var(--dsw-static-neutral-bluish-60);--dsw-alias-bg-multi-select:var(--dsw-static-neutral-bluish-60);--dsw-alias-bg-overlay:var(--dsw-static-neutral-bluish-150);--dsw-alias-bg-skeleton:#0000000a;--dsw-alias-border-inverted2:#0000;--dsw-alias-border-inverted:#0000;--dsw-alias-border-l1:#0000000a;--dsw-alias-border-l2-darkmode-thin:#0000001a;--dsw-alias-border-l2:#0000001a;--dsw-alias-border-l3:#0000001f;--dsw-alias-border-l4:#00000029;--dsw-alias-brand-primary-invert:var(--dsw-static-neutral-bluish-1000);--dsw-alias-brand-primary-new-colorprimary-new-color:#4176e6;--dsw-alias-brand-primary:var(--dsw-static-neutral-bluish-1000);--dsw-alias-brand-text:var(--dsw-static-neutral-bluish-1000);--dsw-alias-button-contrast-fill:var(--dsw-static-neutral-bluish-700);--dsw-alias-button-elevated-fill:var(--dsw-static-neutral-bluish-00);--dsw-alias-button-floating-fill:var(--dsw-static-neutral-bluish-00);--dsw-alias-button-floating-hover:var(--dsw-static-neutral-bluish-75);--dsw-alias-button-ghost-active-border:var(--dsw-static-neutral-bluish-500);--dsw-alias-button-ghost-active-fill:var(--dsw-static-neutral-bluish-100);--dsw-alias-button-ghost-active-hover:var(--dsw-static-neutral-bluish-150);--dsw-alias-button-info-fill:var(--dsw-static-deepseek-500);--dsw-alias-button-info-hover:var(--dsw-static-deepseek-400);--dsw-alias-button-primary-dimmed:var(--dsw-static-neutral-bluish-100);--dsw-alias-button-primary-fill:var(--dsw-alias-brand-primary);--dsw-alias-button-primary-hover:var(--dsw-static-neutral-bluish-750);--dsw-alias-button-tool-bar-fill-invisible:#1f1f1f5c;--dsw-alias-button-tool-bar-fill:#54555780;--dsw-alias-button-tool-bar-hover:#54555799;--dsw-alias-interactive-bg-active:#2631481a;--dsw-alias-interactive-bg-hover-accent:#26314824;--dsw-alias-interactive-bg-hover-danger:#ec13130d;--dsw-alias-interactive-bg-hover-solid:var(--dsw-static-neutral-bluish-75);--dsw-alias-interactive-bg-hover:#2631480f;--dsw-alias-label-caption:var(--dsw-static-neutral-bluish-400);--dsw-alias-label-deep-diving:color-mix(in srgb, var(--dsw-static-deepseek-500) 70%, var(--dsw-static-blue-950));--dsw-alias-label-deep-diving-shimmer:color-mix(in srgb, var(--dsw-static-deepseek-500) 30%, var(--dsw-static-blue-950));--dsw-alias-label-dimmed:var(--dsw-static-neutral-bluish-200);--dsw-alias-label-primary-bluish:var(--dsw-static-blue-900);--dsw-alias-label-primary-dimmed:var(--dsw-static-neutral-bluish-950);--dsw-alias-label-primary-foreground:var(--dsw-static-neutral-bluish-00);--dsw-alias-label-primary-inverted:var(--dsw-static-neutral-bluish-00);--dsw-alias-label-primary:var(--dsw-static-neutral-bluish-1000);--dsw-alias-label-secondary:var(--dsw-static-neutral-bluish-700);--dsw-alias-label-shimmer:color-mix(in srgb, var(--dsw-static-neutral-1000) 30%, transparent);--dsw-alias-label-tertiary:var(--dsw-static-neutral-bluish-600);--dsw-alias-menu-icon:var(--dsw-static-neutral-bluish-800);--dsw-alias-link:var(--dsw-static-deepseek-500);--dsw-alias-markdown-citation:var(--dsw-static-neutral-bluish-100);--dsw-alias-markdown-code-block-banner:var(--dsw-static-neutral-bluish-50);--dsw-alias-markdown-code-block:var(--dsw-static-neutral-bluish-50);--dsw-alias-markdown-code-segment-selected:var(--dsw-static-neutral-bluish-00);--dsw-alias-markdown-code-segment-unselected:var(--dsw-static-neutral-bluish-75);--dsw-alias-markdown-inline-code:var(--dsw-static-neutral-50);--dsw-alias-markdown-placeholder:var(--dsw-static-neutral-bluish-60);--dsw-alias-markdown-tag:var(--dsw-static-neutral-bluish-75);--dsw-alias-scrollbar-bg-l1:var(--dsw-static-neutral-200);--dsw-alias-scrollbar-bg-l2:var(--dsw-static-neutral-200);--dsw-alias-scrollbar-hover-l1:var(--dsw-static-neutral-300);--dsw-alias-scrollbar-hover-l2:var(--dsw-static-neutral-300);--dsw-alias-state-business-primary:var(--dsw-static-deepseek-500);--dsw-alias-state-business-tertiary:var(--dsw-static-deepseek-100);--dsw-alias-code-diff-added:var(--dsw-static-green-500-a08);--dsw-alias-code-diff-deleted:var(--dsw-static-red-600-a08);--dsw-alias-file-diff-added-bg:#e6f4e7;--dsw-alias-file-diff-added-gutter:#edf7ed;--dsw-alias-file-diff-added-marker:#01a241;--dsw-alias-file-diff-deleted-bg:#fce6e2;--dsw-alias-file-diff-deleted-gutter:#fdece9;--dsw-alias-file-diff-deleted-marker:#ba2723;--dsw-alias-state-error-primary:var(--dsw-static-red-600);--dsw-alias-state-error-secondary:var(--dsw-static-red-400);--dsw-alias-state-idle-primary:var(--dsw-static-neutral-300);--dsw-alias-state-success-primary:var(--dsw-static-green-500);--dsw-alias-state-success-secondary:var(--dsw-static-green-400);--dsw-alias-state-success-tertiary:var(--dsw-static-green-100);--dsw-alias-state-warn-label:var(--dsw-static-amber-600);--dsw-alias-state-warn-primary:var(--dsw-static-amber-500);--dsw-alias-state-warn-secondary:var(--dsw-static-amber-400);--dsw-alias-state-warn-tertiary:var(--dsw-static-amber-100);--dsw-alias-switch-thumb:var(--dsw-static-neutral-bluish-00);--dsw-alias-toast-bg:var(--dsw-static-neutral-bluish-800);--dsw-alias-toast-label:var(--dsw-static-neutral-bluish-00);--dsw-alias-tooltip-bg:var(--dsw-static-neutral-bluish-850);--dsw-alias-tooltip-key-bg:color-mix(in srgb, var(--dsw-alias-tooltip-bg), white 18%);--dsw-alias-turn-trigger-bg:var(--dsw-alias-markdown-code-block);--dsw-alias-turn-trigger-bg-hover:var(--dsw-alias-interactive-bg-hover);--dsw-specific-bubble-highlight:var(--dsw-static-deepseek-200);--dsw-specific-bubble:var(--dsw-static-deepseek-50);--dsw-specific-input-major:var(--dsw-static-neutral-bluish-00);--dsw-specific-login-input:var(--dsw-static-neutral-bluish-50);--dsw-menu-surface-fill:#f8f9fa94;--dsw-alias-menu-group-header-fill:#f8f9faf0;--dsw-specific-menu:var(--dsw-menu-surface-fill);--dsw-specific-selector:var(--dsw-static-neutral-bluish-60);--dsw-specific-sidebar-fill:var(--dsw-static-neutral-bluish-50);--dsw-specific-sidebar-nav-item-active-accent:var(--dsw-static-deepseek-100);--dsw-specific-sidebar-nav-item-active:var(--dsw-static-neutral-bluish-100);--dsw-specific-sidebar-nav-item-hover:var(--dsw-static-neutral-bluish-75);--dsw-specific-tip:var(--dsw-static-neutral-bluish-60);background-color:var(--dsw-alias-bg-base)}body[data-ds-dark-theme]{--dsw-alias-bg-base:var(--dsw-static-neutral-bluish-950);--dsw-alias-bg-document-preview:var(--dsw-static-neutral-bluish-950);--dsw-alias-bg-document-selection:color-mix(in srgb, var(--dsw-static-blue-500) 40%, transparent);--dsw-alias-label-document-preview:var(--dsw-static-neutral-bluish-300);--dsw-alias-bg-layer-1:var(--dsw-static-neutral-bluish-875);--dsw-alias-bg-layer-2:var(--dsw-static-neutral-bluish-850);--dsw-alias-bg-layer-3:var(--dsw-static-neutral-bluish-800);--dsw-alias-bg-mask-1:#00000080;--dsw-alias-bg-mask-2:#0003;--dsw-alias-bg-mask-3:#0000007a;--dsw-alias-bg-mask-photo:#000000e0;--dsw-alias-bg-mask-drop:#272730b3;--dsw-alias-bg-module-platform:var(--dsw-static-neutral-bluish-800);--dsw-alias-bg-multi-select:var(--dsw-static-neutral-850);--dsw-alias-bg-overlay:var(--dsw-static-neutral-bluish-700);--dsw-alias-bg-skeleton:#ffffff14;--dsw-alias-border-inverted2:#ffffff14;--dsw-alias-border-inverted:#ffffff0f;--dsw-alias-border-l1:#ffffff0f;--dsw-alias-border-l2-darkmode-thin:#ffffff0f;--dsw-alias-border-l2:#ffffff1f;--dsw-alias-border-l3:#ffffff29;--dsw-alias-border-l4:#fff3;--dsw-alias-brand-primary-invert:var(--dsw-static-neutral-bluish-50);--dsw-alias-brand-primary-new-colorprimary-new-color:var(--dsw-static-deepseek-450);--dsw-alias-brand-primary:var(--dsw-static-neutral-bluish-50);--dsw-alias-brand-text:var(--dsw-static-neutral-bluish-50);--dsw-alias-button-contrast-fill:var(--dsw-static-neutral-bluish-50);--dsw-alias-button-elevated-fill:var(--dsw-static-neutral-bluish-750);--dsw-alias-button-floating-fill:var(--dsw-static-neutral-bluish-850);--dsw-alias-button-floating-hover:var(--dsw-static-neutral-bluish-800);--dsw-alias-button-ghost-active-border:var(--dsw-static-neutral-bluish-600);--dsw-alias-button-ghost-active-fill:var(--dsw-static-neutral-bluish-750);--dsw-alias-button-ghost-active-hover:var(--dsw-static-neutral-bluish-700);--dsw-alias-button-info-fill:var(--dsw-static-deepseek-400);--dsw-alias-button-info-hover:var(--dsw-static-deepseek-500);--dsw-alias-button-primary-dimmed:var(--dsw-static-neutral-bluish-750);--dsw-alias-button-primary-fill:var(--dsw-alias-brand-primary);--dsw-alias-button-primary-hover:var(--dsw-static-neutral-bluish-100);--dsw-alias-button-tool-bar-fill-invisible:#1f1f1f5c;--dsw-alias-button-tool-bar-fill:#54555780;--dsw-alias-button-tool-bar-hover:#54555799;--dsw-alias-interactive-bg-active:#ffffff24;--dsw-alias-interactive-bg-hover-accent:#ffffff3d;--dsw-alias-interactive-bg-hover-danger:#f25a5a26;--dsw-alias-interactive-bg-hover-solid:var(--dsw-static-neutral-bluish-800);--dsw-alias-interactive-bg-hover:#ffffff14;--dsw-alias-label-caption:var(--dsw-static-neutral-bluish-600);--dsw-alias-label-deep-diving:color-mix(in srgb, var(--dsw-static-deepseek-450) 55%, var(--dsw-static-neutral-bluish-400));--dsw-alias-label-deep-diving-shimmer:color-mix(in srgb, var(--dsw-static-blue-300) 65%, var(--dsw-static-deepseek-400));--dsw-alias-label-dimmed:var(--dsw-static-neutral-bluish-750);--dsw-alias-label-primary-bluish:var(--dsw-static-neutral-bluish-50);--dsw-alias-label-primary-dimmed:var(--dsw-static-neutral-bluish-100);--dsw-alias-label-primary-foreground:var(--dsw-static-neutral-bluish-1000);--dsw-alias-label-primary-inverted:var(--dsw-static-neutral-bluish-800);--dsw-alias-label-primary:var(--dsw-static-neutral-bluish-50);--dsw-alias-label-secondary:var(--dsw-static-neutral-bluish-300);--dsw-alias-label-shimmer:color-mix(in srgb, var(--dsw-static-neutral-00) 45%, transparent);--dsw-alias-label-tertiary:var(--dsw-static-neutral-bluish-400);--dsw-alias-menu-icon:var(--dsw-alias-label-primary-dimmed);--dsw-alias-link:var(--dsw-static-deepseek-400);--dsw-alias-markdown-citation:var(--dsw-static-neutral-bluish-800);--dsw-alias-markdown-code-block-banner:var(--dsw-static-neutral-bluish-850);--dsw-alias-markdown-code-block:var(--dsw-static-neutral-bluish-900);--dsw-alias-markdown-code-segment-selected:var(--dsw-static-neutral-bluish-800);--dsw-alias-markdown-code-segment-unselected:var(--dsw-static-neutral-bluish-900);--dsw-alias-markdown-inline-code:var(--dsw-static-neutral-800);--dsw-alias-markdown-placeholder:var(--dsw-static-neutral-bluish-850);--dsw-alias-markdown-tag:var(--dsw-static-neutral-bluish-850);--dsw-alias-scrollbar-bg-l1:var(--dsw-static-neutral-700);--dsw-alias-scrollbar-bg-l2:var(--dsw-static-neutral-600);--dsw-alias-scrollbar-hover-l1:var(--dsw-static-neutral-600);--dsw-alias-scrollbar-hover-l2:var(--dsw-static-neutral-550);--dsw-alias-state-business-primary:var(--dsw-static-deepseek-400);--dsw-alias-state-business-tertiary:var(--dsw-static-deepseek-800);--dsw-alias-code-diff-added:var(--dsw-static-green-500-a12);--dsw-alias-code-diff-deleted:var(--dsw-static-red-400-a12);--dsw-alias-file-diff-added-bg:#1f3124;--dsw-alias-file-diff-added-gutter:#132016;--dsw-alias-file-diff-added-marker:#41c977;--dsw-alias-file-diff-deleted-bg:#3c1f1b;--dsw-alias-file-diff-deleted-gutter:#28130e;--dsw-alias-file-diff-deleted-marker:#fa423e;--dsw-alias-state-error-primary:var(--dsw-static-red-400);--dsw-alias-state-error-secondary:var(--dsw-static-red-400);--dsw-alias-state-idle-primary:var(--dsw-static-neutral-600);--dsw-alias-state-success-primary:var(--dsw-static-green-500);--dsw-alias-state-success-secondary:var(--dsw-static-green-400);--dsw-alias-state-success-tertiary:var(--dsw-static-green-900);--dsw-alias-state-warn-label:var(--dsw-static-amber-600);--dsw-alias-state-warn-primary:var(--dsw-static-amber-500);--dsw-alias-state-warn-secondary:var(--dsw-static-amber-400);--dsw-alias-state-warn-tertiary:var(--dsw-static-amber-900);--dsw-alias-switch-thumb:var(--dsw-static-neutral-bluish-400);--dsw-alias-toast-bg:var(--dsw-static-neutral-bluish-750);--dsw-alias-toast-label:var(--dsw-static-neutral-bluish-00);--dsw-alias-turn-trigger-bg:var(--dsw-alias-interactive-bg-hover);--dsw-alias-turn-trigger-bg-hover:var(--dsw-alias-interactive-bg-active);--dsw-alias-tooltip-bg:var(--dsw-static-neutral-bluish-750);--dsw-alias-tooltip-key-bg:color-mix(in srgb, var(--dsw-alias-tooltip-bg), white 18%);--dsw-specific-bubble-highlight:var(--dsw-static-neutral-bluish-750);--dsw-specific-bubble:var(--dsw-static-neutral-bluish-850);--dsw-specific-input-major:var(--dsw-static-neutral-bluish-850);--dsw-specific-login-input:var(--dsw-static-neutral-bluish-900);--dsw-menu-surface-fill:#43454a73;--dsw-alias-menu-group-header-fill:#303136f0;--dsw-specific-menu:var(--dsw-menu-surface-fill);--dsw-specific-selector:var(--dsw-static-neutral-bluish-800);--dsw-specific-sidebar-fill:var(--dsw-static-neutral-bluish-900);--dsw-specific-sidebar-nav-item-active-accent:var(--dsw-static-neutral-bluish-800);--dsw-specific-sidebar-nav-item-active:var(--dsw-static-neutral-bluish-750);--dsw-specific-sidebar-nav-item-hover:var(--dsw-static-neutral-bluish-850);--dsw-specific-tip:var(--dsw-static-neutral-bluish-800)}html[data-platform=darwin] body{--dsw-specific-menu:#f8f9faf0}html[data-platform=darwin] body[data-ds-dark-theme]{--dsw-specific-menu:#303136f0}";
		//#endregion
		//#region \0dsh-inline-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/styles/focus.css.mjs
		var focus_css_default = ":root{--dsw-focus-ring-width:2px}:focus-visible{outline-color:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-width:var(--dsw-focus-ring-width)}html[data-input-modality=pointer] body :focus-visible:not(:read-write){--dsw-focus-ring-color:transparent;outline-color:#0000}";
		//#endregion
		//#region \0dsh-inline-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/styles/onboarding.css.mjs
		var onboarding_css_default = "body{--dsw-alias-onboarding-accent:#3964fe;--dsw-gradient-onboarding-violet-stops:#2a2fb6 33.102%, #8b76f6 50.954%, #c5c0ff 85.326%, #2a2fb6;--dsw-gradient-onboarding-blue-stops:#3964fe 18.75%, #398efe 51.78%, #6dccff 86.252%, #3964fe;--dsw-gradient-onboarding-cyan-stops:#0293b4 21.154%, #2dc8eb 50.954%, #aff0ff 85.326%, #0293b4;--dsw-alias-onboarding-card-fill:color-mix(in srgb, var(--dsw-static-neutral-bluish-00) 80%, transparent);--dsw-alias-onboarding-secondary-fill:var(--dsw-static-neutral-bluish-00);--dsw-alias-onboarding-checkbox-border:color-mix(in srgb, var(--dsw-static-neutral-bluish-1000) 20%, transparent)}body[data-ds-dark-theme]{--dsw-alias-onboarding-card-fill:color-mix(in srgb, var(--dsw-static-neutral-bluish-850) 80%, transparent);--dsw-alias-onboarding-secondary-fill:#48494c;--dsw-alias-onboarding-checkbox-border:var(--dsw-alias-border-l2)}";
		//#endregion
		//#region \0dsh-inline-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/styles/scrollbar.css.mjs
		var scrollbar_css_default = "body{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l1);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l1);--dsh-scrollbar-thumb-border:0px;--dsh-scrollbar-track-margin:0px;--dsh-scrollbar-width:5px}@supports not selector(::-webkit-scrollbar){body,body *{scrollbar-width:thin;scrollbar-color:var(--dsh-scrollbar-thumb) transparent}}::-webkit-scrollbar{width:var(--dsh-scrollbar-width);height:var(--dsh-scrollbar-width)}::-webkit-scrollbar-track{margin-block:var(--dsh-scrollbar-track-margin);background:0 0}::-webkit-scrollbar-thumb{border:var(--dsh-scrollbar-thumb-border) solid transparent;corner-shape:round;background:var(--dsh-scrollbar-thumb);background-clip:content-box;border-radius:999px}::-webkit-scrollbar-thumb:hover{background-color:var(--dsh-scrollbar-thumb-hover)}::-webkit-scrollbar-corner{background:0 0}";
		//#endregion
		//#region \0dsh-inline-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/styles/gradient-shadow-text.css.mjs
		var gradient_shadow_text_css_default = "body{--dsw-linear-gradient-think:linear-gradient(180deg, #fff 20.19%, #fff0 100%);--dsw-linear-think-select:linear-gradient(180deg, #f5f6f7 20.19%, #f5f6f700 100%);--dsw-shadow-lv1:0 2px 4px 0 #0000000d;--dsw-shadow-lv1-blur:0 4px 12px 0 #00000005;--dsw-shadow-lv2:0 4px 12px 0 #00000005, 0 2px 8px 0 #0000000a;--dsw-shadow-lv3:0 0 1px 0 #0003, 0 0 4px 0 #00000005, 0 12px 32px 0 #00000014;--dsw-elevation-stroke-color:var(--dsw-alias-border-l4);--dsw-mask-blur:none;--dsw-menu-backdrop-filter:blur(40px) saturate(150%)}body[data-ds-dark-theme] [data-menu-material]{--dsw-elevation-stroke-color:var(--dsw-alias-border-l3)}body,body *{--dsw-elevation-stroke:0 0 0 .5px var(--dsw-elevation-stroke-color);--dsw-elevation-panel:var(--dsw-elevation-stroke), 0 3px 8px 0 #00000008, 0 0 16px 0 #00000005;--dsw-elevation-prominent:var(--dsw-elevation-stroke), 0 3px 8px 0 #0000000a, 0 0 20px 0 #0000000d;--dsw-elevation-soft:var(--dsw-elevation-stroke), 0 4px 16px 0 #00000008, 0 0 24px 0 #00000008}body[data-ds-dark-theme]{--dsw-linear-gradient-think:linear-gradient(180deg, #151517 20.19%, #15151700 100%);--dsw-linear-think-select:linear-gradient(180deg, #232325 20.19%, #23232500 100%)}body{--dsh-content-font-delta:calc(var(--dsh-content-font-size,14px) - 14px);--dsh-content-font-size-secondary:min(calc(var(--dsh-content-font-size,14px) - 1px), max(13px, calc(var(--dsh-content-font-size,14px) - 2px)));--dsh-content-font-delta-secondary:calc(var(--dsh-content-font-size-secondary) - 13px);--dsh-code-font-delta:calc(var(--dsh-code-font-size,11px) - 11px);--dsw-font-markdown-h1:700 calc(21px + var(--dsh-content-font-delta)) / calc(30px + var(--dsh-content-font-delta)) var(--dsw-font-family);--dsw-font-markdown-h1-font-family:var(--dsw-font-family);--dsw-font-markdown-h1-font-weight:700;--dsw-font-markdown-h1-line-height:calc(30px + var(--dsh-content-font-delta));--dsw-font-markdown-h1-font-size:calc(21px + var(--dsh-content-font-delta));--dsw-font-markdown-h1-font-style:normal;--dsw-font-markdown-h2:700 calc(19px + var(--dsh-content-font-delta)) / calc(28px + var(--dsh-content-font-delta)) var(--dsw-font-family);--dsw-font-markdown-h2-font-family:var(--dsw-font-family);--dsw-font-markdown-h2-font-weight:700;--dsw-font-markdown-h2-line-height:calc(28px + var(--dsh-content-font-delta));--dsw-font-markdown-h2-font-size:calc(19px + var(--dsh-content-font-delta));--dsw-font-markdown-h2-font-style:normal;--dsw-font-markdown-h3:700 calc(18px + var(--dsh-content-font-delta)) / calc(26px + var(--dsh-content-font-delta)) var(--dsw-font-family);--dsw-font-markdown-h3-font-family:var(--dsw-font-family);--dsw-font-markdown-h3-font-weight:700;--dsw-font-markdown-h3-line-height:calc(26px + var(--dsh-content-font-delta));--dsw-font-markdown-h3-font-size:calc(18px + var(--dsh-content-font-delta));--dsw-font-markdown-h3-font-style:normal;--dsw-font-markdown-h4:600 var(--dsh-content-font-size,14px) / calc(24px + var(--dsh-content-font-delta)) var(--dsw-font-family);--dsw-font-markdown-h4-font-family:var(--dsw-font-family);--dsw-font-markdown-h4-font-weight:600;--dsw-font-markdown-h4-line-height:calc(24px + var(--dsh-content-font-delta));--dsw-font-markdown-h4-font-size:var(--dsh-content-font-size,14px);--dsw-font-markdown-h4-font-style:normal;--dsw-font-markdown-base:var(--dsh-content-font-size,14px) / calc(24px + var(--dsh-content-font-delta)) var(--dsw-font-family);--dsw-font-markdown-base-font-family:var(--dsw-font-family);--dsw-font-markdown-base-font-weight:400;--dsw-font-markdown-base-line-height:calc(24px + var(--dsh-content-font-delta));--dsw-font-markdown-base-font-size:var(--dsh-content-font-size,14px);--dsw-font-markdown-base-font-style:normal;--dsw-font-markdown-base-strong:600 var(--dsh-content-font-size,14px) / calc(24px + var(--dsh-content-font-delta)) var(--dsw-font-family);--dsw-font-markdown-base-strong-font-family:var(--dsw-font-family);--dsw-font-markdown-base-strong-font-weight:600;--dsw-font-markdown-base-strong-line-height:calc(24px + var(--dsh-content-font-delta));--dsw-font-markdown-base-strong-font-size:var(--dsh-content-font-size,14px);--dsw-font-markdown-base-strong-font-style:normal;--dsw-font-markdown-base-italic:italic var(--dsh-content-font-size,14px) / calc(24px + var(--dsh-content-font-delta)) var(--dsw-font-family);--dsw-font-markdown-base-italic-font-family:var(--dsw-font-family);--dsw-font-markdown-base-italic-font-weight:400;--dsw-font-markdown-base-italic-line-height:calc(24px + var(--dsh-content-font-delta));--dsw-font-markdown-base-italic-font-size:var(--dsh-content-font-size,14px);--dsw-font-markdown-base-italic-font-style:italic;--dsw-font-markdown-base-strong-italic:italic 600 var(--dsh-content-font-size,14px) / calc(24px + var(--dsh-content-font-delta)) var(--dsw-font-family);--dsw-font-markdown-base-strong-italic-font-family:var(--dsw-font-family);--dsw-font-markdown-base-strong-italic-font-weight:600;--dsw-font-markdown-base-strong-italic-line-height:calc(24px + var(--dsh-content-font-delta));--dsw-font-markdown-base-strong-italic-font-size:var(--dsh-content-font-size,14px);--dsw-font-markdown-base-strong-italic-font-style:italic;--dsw-font-markdown-table:var(--dsh-content-font-size-secondary,13px)/calc(22px + var(--dsh-content-font-delta-secondary,0px)) var(--dsw-font-family);--dsw-font-markdown-table-font-family:var(--dsw-font-family);--dsw-font-markdown-table-font-weight:400;--dsw-font-markdown-table-line-height:calc(22px + var(--dsh-content-font-delta-secondary,0px));--dsw-font-markdown-table-font-size:var(--dsh-content-font-size-secondary,13px);--dsw-font-markdown-table-font-style:normal;--dsw-font-markdown-table-head:500 var(--dsh-content-font-size-secondary,13px)/calc(22px + var(--dsh-content-font-delta-secondary,0px)) var(--dsw-font-family);--dsw-font-markdown-table-head-font-family:var(--dsw-font-family);--dsw-font-markdown-table-head-font-weight:500;--dsw-font-markdown-table-head-line-height:calc(22px + var(--dsh-content-font-delta-secondary,0px));--dsw-font-markdown-table-head-font-size:var(--dsh-content-font-size-secondary,13px);--dsw-font-markdown-table-head-font-style:normal;--dsw-font-markdown-small:12px/20px var(--dsw-font-family);--dsw-font-markdown-small-font-family:var(--dsw-font-family);--dsw-font-markdown-small-font-weight:400;--dsw-font-markdown-small-line-height:20px;--dsw-font-markdown-small-font-size:12px;--dsw-font-markdown-small-font-style:normal;--dsw-font-markdown-small-strong:600 12px/20px var(--dsw-font-family);--dsw-font-markdown-small-strong-font-family:var(--dsw-font-family);--dsw-font-markdown-small-strong-font-weight:600;--dsw-font-markdown-small-strong-line-height:20px;--dsw-font-markdown-small-strong-font-size:12px;--dsw-font-markdown-small-strong-font-style:normal;--dsw-font-markdown-small-italic:italic 12px/20px var(--dsw-font-family);--dsw-font-markdown-small-italic-font-family:var(--dsw-font-family);--dsw-font-markdown-small-italic-font-weight:400;--dsw-font-markdown-small-italic-line-height:20px;--dsw-font-markdown-small-italic-font-size:12px;--dsw-font-markdown-small-italic-font-style:italic;--dsw-font-markdown-small-strong-italic:italic 600 12px/20px var(--dsw-font-family);--dsw-font-markdown-small-strong-italic-font-family:var(--dsw-font-family);--dsw-font-markdown-small-strong-italic-font-weight:600;--dsw-font-markdown-small-strong-italic-line-height:20px;--dsw-font-markdown-small-strong-italic-font-size:12px;--dsw-font-markdown-small-strong-italic-font-style:italic;--dsw-font-markdown-code:calc(12px + var(--dsh-code-font-delta)) / calc(19px + var(--dsh-code-font-delta)) var(--ds-font-family-code);--dsw-font-markdown-code-font-family:var(--ds-font-family-code);--dsw-font-markdown-code-font-weight:400;--dsw-font-markdown-code-line-height:calc(19px + var(--dsh-code-font-delta));--dsw-font-markdown-code-font-size:calc(12px + var(--dsh-code-font-delta));--dsw-font-markdown-code-font-style:normal;--dsw-font-markdown-code-block:var(--dsh-code-font-size,11px) / calc(19px + var(--dsh-code-font-delta)) var(--ds-font-family-code);--dsw-font-markdown-code-block-font-family:var(--ds-font-family-code);--dsw-font-markdown-code-block-font-weight:400;--dsw-font-markdown-code-block-line-height:calc(19px + var(--dsh-code-font-delta));--dsw-font-markdown-code-block-font-size:var(--dsh-code-font-size,11px);--dsw-font-markdown-code-block-font-style:normal;--dsw-font-markdown-code-block-small:var(--dsh-code-font-size,11px) / calc(16px + var(--dsh-code-font-delta)) var(--ds-font-family-code);--dsw-font-markdown-code-block-small-font-family:var(--ds-font-family-code);--dsw-font-markdown-code-block-small-font-weight:400;--dsw-font-markdown-code-block-small-line-height:calc(16px + var(--dsh-code-font-delta));--dsw-font-markdown-code-block-small-font-size:var(--dsh-code-font-size,11px);--dsw-font-markdown-code-block-small-font-style:normal;--dsw-font-xl-24:600 24px/32px var(--dsw-font-family);--dsw-font-xl-24-font-family:var(--dsw-font-family);--dsw-font-xl-24-font-weight:600;--dsw-font-xl-24-line-height:32px;--dsw-font-xl-24-font-size:24px;--dsw-font-xl-24-font-style:normal;--dsw-font-l-20:500 20px/28px var(--dsw-font-family);--dsw-font-l-20-font-family:var(--dsw-font-family);--dsw-font-l-20-font-weight:500;--dsw-font-l-20-line-height:28px;--dsw-font-l-20-font-size:20px;--dsw-font-l-20-font-style:normal;--dsw-font-m-18:500 16px/28px var(--dsw-font-family);--dsw-font-m-18-font-family:var(--dsw-font-family);--dsw-font-m-18-font-weight:500;--dsw-font-m-18-line-height:28px;--dsw-font-m-18-font-size:16px;--dsw-font-m-18-font-style:normal;--dsw-font-base-16:16px/24px var(--dsw-font-family);--dsw-font-base-16-font-family:var(--dsw-font-family);--dsw-font-base-16-font-weight:400;--dsw-font-base-16-line-height:24px;--dsw-font-base-16-font-size:16px;--dsw-font-base-16-font-style:normal;--dsw-font-base-strong-16:500 16px/24px var(--dsw-font-family);--dsw-font-base-strong-16-font-family:var(--dsw-font-family);--dsw-font-base-strong-16-font-weight:500;--dsw-font-base-strong-16-line-height:24px;--dsw-font-base-strong-16-font-size:16px;--dsw-font-base-strong-16-font-style:normal;--dsw-font-s-14:14px/22px var(--dsw-font-family);--dsw-font-s-14-font-family:var(--dsw-font-family);--dsw-font-s-14-font-weight:400;--dsw-font-s-14-line-height:22px;--dsw-font-s-14-font-size:14px;--dsw-font-s-14-font-style:normal;--dsw-font-s-strong-14:500 14px/22px var(--dsw-font-family);--dsw-font-s-strong-14-font-family:var(--dsw-font-family);--dsw-font-s-strong-14-font-weight:500;--dsw-font-s-strong-14-line-height:22px;--dsw-font-s-strong-14-font-size:14px;--dsw-font-s-strong-14-font-style:normal;--dsw-font-xs-13:13px/20px var(--dsw-font-family);--dsw-font-xs-13-font-family:var(--dsw-font-family);--dsw-font-xs-13-font-weight:400;--dsw-font-xs-13-line-height:20px;--dsw-font-xs-13-font-size:13px;--dsw-font-xs-13-font-style:normal;--dsw-font-xs-strong-13:500 13px/20px var(--dsw-font-family);--dsw-font-xs-strong-13-font-family:var(--dsw-font-family);--dsw-font-xs-strong-13-font-weight:500;--dsw-font-xs-strong-13-line-height:20px;--dsw-font-xs-strong-13-font-size:13px;--dsw-font-xs-strong-13-font-style:normal;--dsw-font-xxs-12:12px/18px var(--dsw-font-family);--dsw-font-xxs-12-font-family:var(--dsw-font-family);--dsw-font-xxs-12-font-weight:400;--dsw-font-xxs-12-line-height:18px;--dsw-font-xxs-12-font-size:12px;--dsw-font-xxs-12-font-style:normal;--dsw-font-xxs-strong-12:500 12px/18px var(--dsw-font-family);--dsw-font-xxs-strong-12-font-family:var(--dsw-font-family);--dsw-font-xxs-strong-12-font-weight:500;--dsw-font-xxs-strong-12-line-height:18px;--dsw-font-xxs-strong-12-font-size:12px;--dsw-font-xxs-strong-12-font-style:normal;--dsw-font-xxxs-11:11px/14px var(--dsw-font-family);--dsw-font-xxxs-11-font-family:var(--dsw-font-family);--dsw-font-xxxs-11-font-weight:400;--dsw-font-xxxs-11-line-height:14px;--dsw-font-xxxs-11-font-size:11px;--dsw-font-xxxs-11-font-style:normal;--dsw-font-xxxs-strong-11:500 11px/14px var(--dsw-font-family);--dsw-font-xxxs-strong-11-font-family:var(--dsw-font-family);--dsw-font-xxxs-strong-11-font-weight:500;--dsw-font-xxxs-strong-11-line-height:14px;--dsw-font-xxxs-strong-11-font-size:11px;--dsw-font-xxxs-strong-11-font-style:normal}";
		//#endregion
		//#region \0dsh-inline-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-theme/src/styles/shiki.css.mjs
		var shiki_css_default = ":root{--shiki-foreground:var(--dsw-alias-label-primary);--shiki-background:var(--dsw-alias-markdown-code-block);--shiki-token-constant:#1c7ed6;--shiki-token-string:#2f9e44;--shiki-token-comment:#868e96;--shiki-token-keyword:#d6336c;--shiki-token-parameter:#e8590c;--shiki-token-function:#6741d9;--shiki-token-string-expression:#2b8a3e;--shiki-token-punctuation:#495057;--shiki-token-link:#1971c2}body[data-ds-dark-theme]{--shiki-token-constant:#4dabf7;--shiki-token-string:#69db7c;--shiki-token-comment:#adb5bd;--shiki-token-keyword:#faa2c1;--shiki-token-parameter:#ffa94d;--shiki-token-function:#b197fc;--shiki-token-string-expression:#8ce99a;--shiki-token-punctuation:#ced4da;--shiki-token-link:#74c0fc}";
		//#endregion
		//#region lib/types/client/styles.js
		const PLUGIN_ID = "@deepseek-ai/dsh-client-ui-theme";
		const STYLES = [
			["base.css", base_css_default],
			["corner-shape.css", corner_shape_css_default],
			["design-platform.css", design_platform_css_default],
			["focus.css", focus_css_default],
			["onboarding.css", onboarding_css_default],
			["scrollbar.css", scrollbar_css_default],
			["gradient-shadow-text.css", gradient_shadow_text_css_default],
			["shiki.css", shiki_css_default]
		];
		/**
		* Mount the global theme sheets for exactly the owning plugin lifetime.
		* @param ctx - Owning plugin context.
		*/
		function installThemeStyles(ctx) {
			if (typeof document === "undefined") return;
			for (const [name, css] of STYLES) ctx.effect(() => {
				const tag = document.createElement("style");
				tag.dataset.plugin = PLUGIN_ID;
				tag.dataset.pluginCss = `${PLUGIN_ID}/${name}`;
				tag.textContent = css;
				document.head.appendChild(tag);
				return () => {
					tag.remove();
				};
			}, `ui-theme: ${name} stylesheet`);
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `settings.theme` namespace dictionaries (the Appearance and font settings rows' copy). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"appearance.title": "外观",
			"appearance.light": "浅色",
			"appearance.dark": "深色",
			"appearance.system": "跟随系统",
			"fontSize.text.title": "字号大小",
			"fontSize.text.description": "仅影响会话内容的字号",
			"fontSize.text.increase": "增大字号",
			"fontSize.text.decrease": "减小字号",
			"fontSize.code.title": "代码字号",
			"fontSize.code.description": "用于代码块、行内代码与工具输出",
			"fontSize.code.increase": "增大代码字号",
			"fontSize.code.decrease": "减小代码字号",
			"fontSize.terminal.title": "终端字号",
			"fontSize.terminal.description": "用于侧栏终端",
			"fontSize.terminal.increase": "增大终端字号",
			"fontSize.terminal.decrease": "减小终端字号",
			"fontSize.unit": "px",
			"fontFamily.text.title": "正文字体",
			"fontFamily.text.description": "用于界面与会话正文。多个字体用逗号分隔，留空使用默认字体",
			"fontFamily.code.title": "代码字体",
			"fontFamily.code.description": "用于代码块、行内代码与工具输出。多个字体用逗号分隔，留空使用默认字体",
			"fontFamily.terminal.title": "终端字体",
			"fontFamily.terminal.description": "用于侧栏终端。多个字体用逗号分隔，留空使用默认字体",
			"fontFamily.placeholder": "默认",
			"fontSize.more": "更多字体设置"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"appearance.title": "Appearance",
			"appearance.light": "Light",
			"appearance.dark": "Dark",
			"appearance.system": "System",
			"fontSize.text.title": "Font size",
			"fontSize.text.description": "Only affects conversation content",
			"fontSize.text.increase": "Increase font size",
			"fontSize.text.decrease": "Decrease font size",
			"fontSize.code.title": "Code font size",
			"fontSize.code.description": "Used for code blocks, inline code, and tool output",
			"fontSize.code.increase": "Increase code font size",
			"fontSize.code.decrease": "Decrease code font size",
			"fontSize.terminal.title": "Terminal font size",
			"fontSize.terminal.description": "Used for the sidebar terminal",
			"fontSize.terminal.increase": "Increase terminal font size",
			"fontSize.terminal.decrease": "Decrease terminal font size",
			"fontSize.unit": "px",
			"fontFamily.text.title": "Text font",
			"fontFamily.text.description": "Used for the interface and conversation text. Separate fonts with commas; leave empty for the default",
			"fontFamily.code.title": "Code font",
			"fontFamily.code.description": "Used for code blocks, inline code, and tool output. Separate fonts with commas; leave empty for the default",
			"fontFamily.terminal.title": "Terminal font",
			"fontFamily.terminal.description": "Used for the sidebar terminal. Separate fonts with commas; leave empty for the default",
			"fontFamily.placeholder": "Default",
			"fontSize.more": "More font settings"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Namespace owning this feature's settings-row copy. */
		const SETTINGS_NS = "settings.theme";
		const BUILTIN_THEMES = Object.freeze([Object.freeze({
			id: "light",
			colorScheme: "light",
			tokens: Object.freeze({})
		}), Object.freeze({
			id: "dark",
			colorScheme: "dark",
			tokens: Object.freeze({})
		})]);
		const BUILTIN_INSPECT_TOKENS = Object.freeze([
			{
				name: "--dsw-alias-bg-base",
				description: "Application base background.",
				valueType: "CSS color",
				requiresLightAndDark: true,
				cssVariable: "--dsw-alias-bg-base"
			},
			{
				name: "--dsw-alias-bg-layer-1",
				description: "Primary raised surface background.",
				valueType: "CSS color",
				requiresLightAndDark: true,
				cssVariable: "--dsw-alias-bg-layer-1"
			},
			{
				name: "--dsw-alias-bg-layer-2",
				description: "Secondary nested surface background.",
				valueType: "CSS color",
				requiresLightAndDark: true,
				cssVariable: "--dsw-alias-bg-layer-2"
			},
			{
				name: "--dsw-alias-bg-overlay",
				description: "Overlay and popover background.",
				valueType: "CSS color",
				requiresLightAndDark: true,
				cssVariable: "--dsw-alias-bg-overlay"
			},
			{
				name: "--dsw-alias-border-l1",
				description: "Primary subtle border.",
				valueType: "CSS color",
				requiresLightAndDark: true,
				cssVariable: "--dsw-alias-border-l1"
			},
			{
				name: "--dsw-alias-border-l2",
				description: "Secondary stronger border.",
				valueType: "CSS color",
				requiresLightAndDark: true,
				cssVariable: "--dsw-alias-border-l2"
			},
			{
				name: "--dsw-alias-brand-primary",
				description: "Primary brand accent.",
				valueType: "CSS color",
				requiresLightAndDark: true,
				cssVariable: "--dsw-alias-brand-primary"
			},
			{
				name: "--dsw-alias-label-primary",
				description: "Primary text color.",
				valueType: "CSS color",
				requiresLightAndDark: true,
				cssVariable: "--dsw-alias-label-primary"
			},
			{
				name: "--dsw-alias-label-secondary",
				description: "Secondary text color.",
				valueType: "CSS color",
				requiresLightAndDark: true,
				cssVariable: "--dsw-alias-label-secondary"
			},
			{
				name: "--dsw-alias-state-error-primary",
				description: "Primary error state color.",
				valueType: "CSS color",
				requiresLightAndDark: true,
				cssVariable: "--dsw-alias-state-error-primary"
export {};
