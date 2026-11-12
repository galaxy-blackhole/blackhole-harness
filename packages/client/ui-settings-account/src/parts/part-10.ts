/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					darkSrc: locale === "zh" ? onboarding_recharge_zh_dark_default : onboarding_recharge_dark_default
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: DesktopOnboarding_module_css_default.copy,
					children: [
						(0, react_jsx_runtime.jsx)("h1", {
							id: "desktop-onboarding-title",
							ref: heading,
							tabIndex: -1,
							children: t("onboardingCredit")
						}),
						(0, react_jsx_runtime.jsx)("p", {
							className: DesktopOnboarding_module_css_default.heroDescription,
							children: t("onboardingCreditDescription")
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: DesktopOnboarding_module_css_default.creditActions,
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								className: DesktopOnboarding_module_css_default.action,
								variant: "primary",
								disabled: busy || !funded && !canRecharge,
								onClick: funded ? onContinue : onRecharge,
								children: t(funded ? "onboardingContinue" : "onboardingTopUp")
							}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								className: `${DesktopOnboarding_module_css_default.action} ${DesktopOnboarding_module_css_default.laterAction}`,
								disabled: busy || funded && !canRecharge,
								onClick: funded ? onRecharge : onLater,
								children: t(funded ? "onboardingFundedTopUp" : "onboardingLater")
							})]
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/assets/onboarding-office.svg
		var onboarding_office_default = "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgNDAgNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJGcmFtZSAyMTE3MTMxMzc4Ij4KPHBhdGggaWQ9IlZlY3RvciIgZD0iTTEwLjUxNTYgMzMuNzcyN0gyOS40ODE2QzMwLjcyNDIgMzMuNzcyNyAzMS43MzE2IDMyLjc2NTQgMzEuNzMxNiAzMS41MjI3VjE1LjcxNkMzMS43MzE2IDE1LjEwODkgMzEuNDg2MyAxNC41Mjc3IDMxLjA1MTYgMTQuMTA0MkwyMy42MjMgNi44Njg2NkMyMy4yMDI5IDYuNDU5NDUgMjIuNjM5NSA2LjIzMDQ3IDIyLjA1MzIgNi4yMzA0N0gxMC41MTU2QzkuMjczIDYuMjMwNDcgOC4yNjU2MiA3LjIzNzgyIDguMjY1NjIgOC40ODA0N1YzMS41MjI3QzguMjY1NjIgMzIuNzY1NCA5LjI3Mjk3IDMzLjc3MjcgMTAuNTE1NiAzMy43NzI3WiIgc3Ryb2tlPSIjODM3MEYxIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggaWQ9IlZlY3Rvcl8yIiBkPSJNMjEuOTE2IDYuNDc2NTZWMTMuMzc4OUMyMS45MTYgMTQuNjIxNiAyMi45MjMzIDE1LjYyODkgMjQuMTY2IDE1LjYyODlIMzEuNjMxNyIgc3Ryb2tlPSIjODM3MEYxIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggaWQ9IlZlY3Rvcl8zIiBkPSJNMTIuMTk1MyAyMS42MDE2SDE5LjY0MjciIHN0cm9rZT0iIzgzNzBGMSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGlkPSJWZWN0b3JfNCIgZD0iTTEyLjE5NTMgMjcuMTE3MkgyMi44OTI0IiBzdHJva2U9IiM4MzcwRjEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L2c+Cjwvc3ZnPgo=";
		//#endregion
		//#region src/client/assets/onboarding-code.svg
		var onboarding_code_default = "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgNDAgNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJMaW5rSWNvbi0tY29kZSAxIj4KPHBhdGggaWQ9IlZlY3RvciIgZD0iTTEwLjYyNSAxMi41TDMuNzUgMjBMMTAuNjI1IDI3LjUiIHN0cm9rZT0iIzNCODZGRiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGlkPSJWZWN0b3JfMiIgZD0iTTI5LjM3NSAxMi41TDM2LjI1IDIwTDI5LjM3NSAyNy41IiBzdHJva2U9IiMzQjg2RkYiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBpZD0iVmVjdG9yXzMiIGQ9Ik0yMy4xMjUgMTEuMjVMMTYuODc1IDI4Ljc1IiBzdHJva2U9IiMzQjg2RkYiIHN0cm9rZS13aWR0aD0iMiIvPgo8L2c+Cjwvc3ZnPgo=";
		//#endregion
		//#region lib/types/client/OnboardingPurposeStep.js
		/** Work-purpose selection with controlled, independently selectable cards. */
		/** @param props - selected purposes, localized copy and persistence callbacks. @returns the purpose step. */
		function OnboardingPurposeStep({ t, heading, busy, purpose, onSelect, onContinue }) {
			const selected = (value) => purpose === value || purpose === "both";
			const toggle = (value) => {
				if (busy) return;
				const office = value === "office" ? !selected("office") : selected("office");
				const development = value === "development" ? !selected("development") : selected("development");
				onSelect(office && development ? "both" : office ? "office" : development ? "development" : null);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: `${DesktopOnboarding_module_css_default.content} ${DesktopOnboarding_module_css_default.purpose}`,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: DesktopOnboarding_module_css_default.copy,
						children: [(0, react_jsx_runtime.jsxs)("h1", {
							id: "desktop-onboarding-title",
							ref: heading,
							tabIndex: -1,
							children: [
								t("onboardingPurposePrefix"),
								" ",
								(0, react_jsx_runtime.jsx)("em", {
									className: DesktopOnboarding_module_css_default.brand,
									children: t("onboardingBrand")
								}),
								" ",
								t("onboardingPurposeSuffix")
							]
						}), (0, react_jsx_runtime.jsx)("p", {
							className: DesktopOnboarding_module_css_default.subtitle,
							children: t("onboardingPurposeDescription")
						})]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: DesktopOnboarding_module_css_default.purposeCards,
						children: ["office", "development"].map((value) => (0, react_jsx_runtime.jsx)(PurposeCard, {
							purpose: value,
							checked: selected(value),
							t,
							onToggle: () => {
								toggle(value);
							}
						}, value))
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: DesktopOnboarding_module_css_default.primaryAction,
						children: purpose !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: DesktopOnboarding_module_css_default.action,
							variant: "primary",
							"aria-disabled": busy,
							onClick: () => {
								if (!busy) onContinue();
							},
							children: t("onboardingContinue")
						})
					})
				]
			});
		}
		function PurposeCard({ purpose, checked, t, onToggle }) {
			const previous = (0, react.useRef)(checked);
			const [entering, setEntering] = (0, react.useState)(false);
			(0, react.useLayoutEffect)(() => {
				setEntering(checked && !previous.current);
				previous.current = checked;
			}, [checked]);
			const titleKey = purpose === "office" ? "onboardingOffice" : "onboardingDevelopment";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: `${DesktopOnboarding_module_css_default.card} ${checked ? DesktopOnboarding_module_css_default.selected : ""} ${purpose === "office" ? DesktopOnboarding_module_css_default.officeCard : ""}`,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: DesktopOnboarding_module_css_default.cardTop,
						children: [checked ? (0, react_jsx_runtime.jsx)("span", {
							className: `${DesktopOnboarding_module_css_default.fileIcons} ${entering ? DesktopOnboarding_module_css_default.iconsEntering : ""}`,
							"aria-hidden": "true",
							children: (purpose === "office" ? [
								"word",
								"ppt",
								"excel",
								"pdf",
								"image"
							] : [
								"typescript",
								"javascript",
								"sql",
								"python",
								"cpp"
							]).map((kind) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
								kind,
								size: 28
							}, kind))
						}) : (0, react_jsx_runtime.jsx)("img", {
							src: purpose === "office" ? onboarding_office_default : onboarding_code_default,
							width: 40,
							height: 40,
							alt: ""
						}), (0, react_jsx_runtime.jsxs)("label", {
							className: DesktopOnboarding_module_css_default.cardCheckbox,
							children: [(0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								"aria-label": t(titleKey),
								checked,
								onChange: onToggle
							}), (0, react_jsx_runtime.jsx)("span", {
								className: DesktopOnboarding_module_css_default.indicator,
								"aria-hidden": "true",
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, {})
							})]
						})]
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: DesktopOnboarding_module_css_default.cardTitle,
						children: t(titleKey)
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: DesktopOnboarding_module_css_default.cardDescription,
						children: t(purpose === "office" ? "onboardingOfficeDescription" : "onboardingDevelopmentDescription")
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/OnboardingProcessStep.js
		const options = [
			{
				value: "compact",
				titleKey: "onboardingCompact",
				descriptionKey: "onboardingCompactDescription",
				icon: "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgNDAgNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJFeGl0RnVsbHNjcmVlbkdseXBoIDEiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNMjIuNSA2LjI1VjE1QzIyLjUgMTUuNjYzIDIyLjc2MzQgMTYuMjk4OSAyMy4yMzIyIDE2Ljc2NzhDMjMuNzAxMSAxNy4yMzY2IDI0LjMzNyAxNy41IDI1IDE3LjVIMzMuNzUiIHN0cm9rZT0iIzgzNzBGMSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGlkPSJWZWN0b3JfMiIgZD0iTTE3LjUgMzMuNzVWMjVDMTcuNSAyNC4zMzcgMTcuMjM2NiAyMy43MDExIDE2Ljc2NzggMjMuMjMyMkMxNi4yOTg5IDIyLjc2MzQgMTUuNjYzIDIyLjUgMTUgMjIuNUg2LjI1IiBzdHJva2U9IiM4MzcwRjEiIHN0cm9rZS13aWR0aD0iMiIvPgo8L2c+Cjwvc3ZnPgo=",
				size: 40
			},
			{
				value: "standard",
				titleKey: "onboardingStandard",
				descriptionKey: "onboardingStandardDescription",
				icon: "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiB2aWV3Qm94PSIwIDAgMzYgMzYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJJY29uQ2hlY2tsaXN0T3V0bGluZTE0IDEiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNOC40Mzc1IDE0LjA2MjVDMTAuNjEyMSAxNC4wNjI1IDEyLjM3NSAxMi4yOTk2IDEyLjM3NSAxMC4xMjVDMTIuMzc1IDcuOTUwMzggMTAuNjEyMSA2LjE4NzUgOC40Mzc1IDYuMTg3NUM2LjI2Mjg4IDYuMTg3NSA0LjUgNy45NTAzOCA0LjUgMTAuMTI1QzQuNSAxMi4yOTk2IDYuMjYyODggMTQuMDYyNSA4LjQzNzUgMTQuMDYyNVoiIHN0cm9rZT0iIzNCODZGRiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGlkPSJWZWN0b3JfMiIgZD0iTTE2Ljg3NSAxMC4xMjVIMzAuMzc1IiBzdHJva2U9IiMzQjg2RkYiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBpZD0iVmVjdG9yXzMiIGQ9Ik04LjQzNzUgMjkuODEyNUMxMC42MTIxIDI5LjgxMjUgMTIuMzc1IDI4LjA0OTYgMTIuMzc1IDI1Ljg3NUMxMi4zNzUgMjMuNzAwNCAxMC42MTIxIDIxLjkzNzUgOC40Mzc1IDIxLjkzNzVDNi4yNjI4OCAyMS45Mzc1IDQuNSAyMy43MDA0IDQuNSAyNS44NzVDNC41IDI4LjA0OTYgNi4yNjI4OCAyOS44MTI1IDguNDM3NSAyOS44MTI1WiIgc3Ryb2tlPSIjM0I4NkZGIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggaWQ9IlZlY3Rvcl80IiBkPSJNMTYuODc1IDI1Ljg3NUgzMC4zNzUiIHN0cm9rZT0iIzNCODZGRiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjwvZz4KPC9zdmc+Cg==",
				size: 36
			},
			{
				value: "detailed",
				titleKey: "onboardingDetailed",
				descriptionKey: "onboardingDetailedDescription",
				icon: "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiB2aWV3Qm94PSIwIDAgMzYgMzYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJJY29uQnJvd3NlT3V0bGluZTE2IDEiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNMjguMTI1IDMuMzc1SDcuODc1QzYuNjMyMzYgMy4zNzUgNS42MjUgNC4zODIzNiA1LjYyNSA1LjYyNVYzMC4zNzVDNS42MjUgMzEuNjE3NiA2LjYzMjM2IDMyLjYyNSA3Ljg3NSAzMi42MjVIMjguMTI1QzI5LjM2NzYgMzIuNjI1IDMwLjM3NSAzMS42MTc2IDMwLjM3NSAzMC4zNzVWNS42MjVDMzAuMzc1IDQuMzgyMzYgMjkuMzY3NiAzLjM3NSAyOC4xMjUgMy4zNzVaIiBzdHJva2U9IiMwMEE0QzkiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBpZD0iVmVjdG9yXzIiIGQ9Ik0xMi4zNzUgMTIuMzc1SDIzLjYyNSIgc3Ryb2tlPSIjMDBBNEM5IiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggaWQ9IlZlY3Rvcl8zIiBkPSJNMTIuMzc1IDIxLjM3NUgxOS4xMjUiIHN0cm9rZT0iIzAwQTRDOSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjwvZz4KPC9zdmc+Cg==",
				size: 36
			}
		];
		/** @param props - selected detail, localized copy and persistence callbacks. @returns the process step. */
		function OnboardingProcessStep({ t, heading, busy, process, onSelect, onComplete }) {
			const onKeyDown = (event, value) => {
				if (busy) return;
				const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
				if (direction === 0) return;
				event.preventDefault();
				const next = options[(options.findIndex((option) => option.value === value) + direction + options.length) % options.length];
				onSelect(next.value);
				event.currentTarget.parentElement?.querySelector(`[data-process="${next.value}"]`)?.focus();
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: `${DesktopOnboarding_module_css_default.content} ${DesktopOnboarding_module_css_default.process}`,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: DesktopOnboarding_module_css_default.copy,
						children: [(0, react_jsx_runtime.jsx)("h1", {
							id: "desktop-onboarding-title",
							ref: heading,
							tabIndex: -1,
							children: t("onboardingProcess")
						}), (0, react_jsx_runtime.jsx)("p", {
							className: DesktopOnboarding_module_css_default.subtitle,
							children: t("onboardingProcessDescription")
						})]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: DesktopOnboarding_module_css_default.processCards,
						role: "radiogroup",
						"aria-labelledby": "desktop-onboarding-title",
						children: options.map((option) => (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "radio",
							"data-process": option.value,
							"aria-checked": process === option.value,
							tabIndex: process === option.value || process === null && option.value === "compact" ? 0 : -1,
							className: `${DesktopOnboarding_module_css_default.card} ${process === option.value ? DesktopOnboarding_module_css_default.selected : ""}`,
							"aria-disabled": busy,
							onClick: () => {
								if (!busy) onSelect(option.value);
							},
							onKeyDown: (event) => {
								onKeyDown(event, option.value);
							},
							children: [
								(0, react_jsx_runtime.jsx)("span", {
									className: DesktopOnboarding_module_css_default.processIcon,
									children: (0, react_jsx_runtime.jsx)("img", {
										src: option.icon,
										width: option.size,
										height: option.size,
										alt: ""
									})
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: DesktopOnboarding_module_css_default.cardTitle,
									children: t(option.titleKey)
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: DesktopOnboarding_module_css_default.cardDescription,
									children: t(option.descriptionKey)
								})
							]
						}, option.value))
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: DesktopOnboarding_module_css_default.primaryAction,
						children: process !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: DesktopOnboarding_module_css_default.action,
							variant: "primary",
							"aria-disabled": busy,
							onClick: () => {
								if (!busy) onComplete();
							},
							children: t("onboardingEnter")
						})
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/OnboardingConfirmation.js
		/** Credit and setup confirmations with contained keyboard focus. */
		/** @param props - confirmation action, localized copy and navigation callbacks. @returns a focus-contained dialog. */
		function OnboardingConfirmation({ kind, t, busy, canRecharge, onClose, onContinueSetup, onContinue, onRecharge, onSkip }) {
			const credit = kind !== "skip";
			const title = t(credit ? "onboardingNoCreditTitle" : "onboardingSkipTitle");
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				headless: true,
				backdropBlur: false,
				title,
				onClose,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: DesktopOnboarding_module_css_default.confirmation,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: DesktopOnboarding_module_css_default.confirmationHeading,
							children: [(0, react_jsx_runtime.jsx)("h2", { children: title }), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: DesktopOnboarding_module_css_default.confirmationClose,
								"aria-label": t("close"),
								onClick: onClose,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
							})]
						}),
						(0, react_jsx_runtime.jsx)("p", { children: t(credit ? "onboardingNoCreditDescription" : "onboardingSkipDescription") }),
						(0, react_jsx_runtime.jsxs)("div", {
							className: DesktopOnboarding_module_css_default.confirmationActions,
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								className: DesktopOnboarding_module_css_default.dialogButton,
								variant: "outline",
								disabled: busy,
								onClick: kind === "credit-skip" ? onSkip : kind === "credit" ? onContinue : onContinueSetup,
								children: t(credit ? "onboardingUnderstood" : "onboardingKeepSetting")
							}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								className: DesktopOnboarding_module_css_default.dialogButton,
								variant: "primary",
								disabled: busy || credit && !canRecharge,
								onClick: credit ? onRecharge : onSkip,
								children: t(credit ? "onboardingGoTopUp" : "onboardingEnter")
							})]
						})
					]
				})
			});
		}
		//#endregion
		//#region lib/types/client/DesktopOnboarding.js
		const onboardingPages = {
			welcome: "onboarding_welcome",
			credit: "onboarding_recharge",
			purpose: "onboarding_use_case",
			process: "onboarding_process",
			done: void 0
		};
		/**
		* @param props - durable choices, account state, localized copy and the shared recharge page channel.
		* @returns the active first-run page.
		*/
		function DesktopOnboarding({ state, account, openPlatformPage, update, complete, retry, t, locale, track, exiting = false }) {
			const [dialog, setDialog] = (0, react.useState)(null);
			const heading = (0, react.useRef)(null);
			const page = (0, react.useRef)(null);
			const releaseRecharge = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => () => {
				releaseRecharge.current?.();
				releaseRecharge.current = void 0;
			}, []);
			const progress = state.progress;
			const targetStep = progress.step;
			const [step, setStep] = (0, react.useState)(targetStep);
			const busy = state.status === "loading" || state.status === "saving" || exiting || step !== targetStep;
			(0, react.useEffect)(() => {
				if (step === targetStep) return;
				const element = page.current;
				if (!state.visible || element?.animate === void 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
					setStep(targetStep);
					return;
				}
				const animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
					duration: 40,
					fill: "forwards",
					easing: "ease-out"
				});
				animation.finished.then(() => {
					setStep(targetStep);
				}, (_error) => {});
				return () => {
					animation.cancel();
				};
			}, [
				targetStep,
				step,
				state.visible
			]);
			(0, react.useEffect)(() => {
				heading.current?.focus();
			}, [step]);
			const pageName = onboardingPages[step];
			const shownPage = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!state.visible || pageName === void 0 || exiting) {
					shownPage.current = null;
					return;
				}
				if (state.status === "loading") return;
				if (shownPage.current === pageName) return;
				shownPage.current = pageName;
				track?.("onboarding_page_view", { page_name: pageName });
			}, [
				state.visible,
				state.status,
				step,
				pageName,
				exiting,
				track
			]);
			const shownPopup = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (dialog === null || !state.visible || state.status === "loading" || step === "done") {
					shownPopup.current = null;
					return;
				}
				if (shownPopup.current === dialog) return;
				shownPopup.current = dialog;
				track?.("onboarding_popup_view", { popup_name: dialog === "skip" ? "skip_setting" : "skip_charge" });
			}, [
				dialog,
				track,
				state.visible,
export {};
