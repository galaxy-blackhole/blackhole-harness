/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			installProblemNotFound: "No such plugin was found",
			installProblemNotPackage: "The path does not exist or is not a valid plugin package",
			installProblemNotBundle: "This package declares no bundle, so it cannot be installed as a plugin: {reason}",
			installProblemNetwork: "The plugin registry could not be reached; check the network and try again",
			installProblemNetworkAll: "No registry could be reached (tried: {registries}); check the network or proxy settings, or change the registry",
			installProblemUnknown: "The plugin could not be looked up: {reason}",
			installingTitle: "Installing the plugin…",
			installedTitle: "Installed",
			statusNotInstalled: "Not installed",
			statusMissingFiles: "Package unavailable",
			statusUpdateAvailable: "Update available",
			sourceNotInstalled: "Not installed",
			sourceTargetSpec: "Source for this DSH",
			sourceTargetVersion: "Version for this DSH",
			update: "Update",
			updateLabel: "Update {name}",
			installFailedTitle: "The plugin could not be installed",
			installGithubFailedTitle: "Cannot access GitHub",
			installGithubTimeoutTitle: "GitHub connection timed out",
			installGithubFailedDescription: "Try another installation source.",
			installUseGithubMirror: "Use mainland China mirror",
			installTryAnotherWay: "Try another way",
			installPackageLabel: "Plugin package name",
			installEdit: "Edit",
			installEditAria: "Back to editing",
			installCancelAndEdit: "Cancel installation and return to editing",
			installApplyingCancellationError: "Cancellation was not confirmed. Installation is being applied; wait for its result. {reason}",
			installReconcile: "Check installation status",
			installUnknownTitle: "Installation result unavailable",
			installUnknownDescription: "The Host has no active installation with this request id. Check the plugin list before trying again.",
			installResultUnconfirmed: "The installation result was not received. Check installation status. {reason}",
			installAwaitingAcceptance: "Waiting for the Host to accept installation. Cancellation will retry automatically after confirmation.",
			installBackgroundUnknown: "Installation result unavailable. Check the plugin list.",
			installCancel: "Cancel install",
			installCloseCancels: "Cancel install and close",
			installViewTask: "View installation",
			installUnconfirmedTitle: "Installation status unconfirmed",
			installBackgroundDone: "Installation finished. View installation details.",
			installBackgroundFailed: "Installation failed. View installation details.",
			installBackgroundUnconfirmed: "Installation status is unconfirmed. View the installation for details.",
			installBackgroundApplying: "Installation is being applied and cannot be cancelled. View installation progress.",
			installStarting: "Preparing installation…",
			installCancelling: "Stopping installation…",
			installApplying: "Applying configuration, please wait…",
			installCancelledShort: "Cancelled",
			installCancelled: "Installation cancelled; the plugin is not enabled, and downloaded files may remain",
			installCancelUnconfirmed: "Installation has not been confirmed stopped. Retry cancellation or wait for the installation result. {reason}",
			installEnableNow: "Enable now",
			installDetailsShow: "Show install details",
			installDetailsHide: "Hide install details",
			installVersion: "Version {version}",
			installSubjectPath: "Local directory",
			installSubjectGit: "Git repository",
			installSubjectTarball: "Tarball",
			installLocation: "Installs into {dir}",
			installRetry: "Retry",
			installChangeRegistry: "Change registry",
			installAttempt: "{previous} could not serve the package; retrying through {registry} (registry {index} of {total})",
			installAttemptBadge: "Attempt {index} · {registry}",
			installFailureNetwork: "The network connection failed",
			installFailureNetworkAll: "No registry could be reached (tried: {registries}). Check the network or proxy settings, or change the registry and retry.",
			installFailureNetworkHost: "{host} could not be reached. A GitHub address or a .tgz link is not fetched through the registry: this machine must reach it directly or through a proxy. If the plugin is also published to npm, enter its package name instead.",
			installFailureNotFound: "No such plugin was found",
			installFailureNoMatchingVersion: "No version matches the request",
			installFailureDiskFull: "The disk is full; the install stopped",
			installFailurePermission: "No write permission; the plugin cannot be installed",
			installFailureBuildBlocked: "A dependency's install scripts need your permission before the install can continue",
			installFailureBuildBlockedManual: "pnpm blocked install scripts; allow them under allowBuilds in pnpm-workspace.yaml and retry",
			installFailureIntegrity: "The downloaded package failed its integrity check",
			installFailureTimeout: "The install timed out",
			installFailurePnpmMissing: "pnpm was not found, so nothing can be installed",
			installFailureGeneric: "Something went wrong during the install; the details say what",
			terminalCommandLine: "Command line {n}",
			terminalRunning: "Running",
			terminalFailed: "Failed",
			terminalDone: "Done",
			terminalCopy: "Copy",
			terminalCopied: "Copied",
			terminalNoOutput: "No output",
			terminalCollapseAria: "Collapse output",
			terminalCollapse: "Collapse",
			terminalExpandAria: "Expand the remaining {n} output lines",
			terminalExpand: "… {n} more lines",
			terminalExitCode: "exit code {code}",
			terminalSignal: "signal {signal}",
			terminalNoExitCode: "no exit code",
			installDoneNothing: "Install finished with no new dependency.",
			installDoneRestart: "Installed; restart DSH to load it. {reason}",
			installDoneApproved: "Install scripts allowed for {names}",
			installDoneOtherVersion: "Under pnpm's supply-chain security policy (minimumReleaseAge), versions published more recently than the required age are not installed automatically, so this installation used {installed} instead of the latest version {version}. A newly published version has not completed this waiting period and may contain undetected malicious code or defects. If you need {version}, uninstall the current version and then install {exact} to request that version.",
			installApprovalTitle: "Install scripts need permission",
			installApprovalDescription: "These packages have install scripts that pnpm did not run.",
			installApprovalConsequence: "Once allowed, the scripts run here with your permissions, and the permission is saved in this profile.",
			installApprovalCaution: "Allow only packages you trust.",
			installApproveAndRetry: "Allow these scripts and retry",
			installClose: "Done",
			close: "Close",
			cancel: "Cancel",
			confirmUninstallTitle: "Uninstall \"{name}\"?",
			confirmUninstallDescription: "What it provides goes away once it is uninstalled.",
			confirmUninstall: "Uninstall",
			failedEnable: "Could not enable: {reason}",
			failedDisable: "Could not disable: {reason}",
			failedUninstall: "Could not uninstall: {reason}",
			failedRowEnable: "Could not enable the component: {reason}",
			failedRowDisable: "Could not disable the component: {reason}",
			reasonManagementRequired: "Plugin management needs it; it cannot be switched off or uninstalled.",
			reasonUnaddressable: "The profile patch cannot address this one uniquely.",
			reasonUnknownPlugin: "No such plugin.",
			reasonInvalidSpec: "Enter a valid package name or address.",
			reasonAlreadyInstalled: "This package is already installed; uninstall it before installing another version.",
			reasonAmbiguousInstall: "Which package was installed cannot be told from the dependency change.",
			reasonNotBundle: "This package declares no bundle, so it cannot be managed as a plugin.",
			reasonNotRemovable: "This package is not owned by the profile, or plugin management needs it.",
			reasonStopProfile: "This profile runs without HMR; stop it and uninstall the package with dsh plugin.",
			reasonBundleInUse: "Other configuration still uses this bundle's components; switch them off first.",
			reasonStaleApproval: "The pending script approvals changed; install again to refresh them.",
			reasonIncompatibleVersion: "{plugin} is incompatible with DSH {runtime} (requires {requirements}); running it may cause crashes or data loss.",
			reasonIncompatibleVersionUnnamed: "This plugin is incompatible with the running DSH version; running it may cause crashes or data loss.",
			reasonIncompatibleInstall: "Install a plugin version compatible with this DSH.",
			reasonIncompatibleInstalled: "Uninstall it and install a version compatible with this DSH.",
			reasonOperationError: "The Host reported an error."
		};
		//#endregion
		//#region lib/types/client/sanitize-install-input.js
		/** Privacy-safe installation input classification shared by click and result events. */
		/**
		* Keep registry package names and plain versions; classify other installer inputs without their contents.
		* @param spec - user-entered installation spec.
		* @returns an identifier safe to send without URL credentials, tokens, or local paths.
		*/
		function sanitizeInstallInput(spec) {
			if (/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*(?:@[a-z0-9.*^~+<>=| -]+)?$/iu.test(spec)) return spec;
			if (/^(?:git[+:]|git@|github:|gitlab:|bitbucket:)/iu.test(spec)) return "[git]";
			if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(spec)) return "[url]";
			return "[path-or-other]";
		}
		//#endregion
		//#region ../../util/crypto/lib/index.js
		/**
		* Random v4 UUID, minted from `crypto.getRandomValues`.
		* @returns the UUID string.
		*/
		function randomUUID() {
			const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
			const hex = Array.from(bytes, (byte, index) => {
				return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
			}).join("");
			return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
		}
		/** Public npmmirror URL shared by the fallback configuration and public-registry comparison. */
		const NPMMIRROR_REGISTRY = "https://registry.npmmirror.com/";
		/** An http(s) URL, as pnpm's `--registry` takes it. */
		const REGISTRY_URL = /^https?:\/\/\S+$/;
		/**
		* Parse a registry URL into the form pnpm compares registries in: lower-case host, trailing slash.
		* @param url - the registry as configured or requested.
		* @returns the normalized URL.
		* @throws {Error} for anything but an http(s) URL.
		*/
		function normalizeRegistry(url) {
			let parsed;
			try {
				parsed = new URL(url);
			} catch {}
			if (parsed === void 0 || parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error(`a registry must be an http(s) URL: ${url}`);
			if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
			return parsed.href;
		}
		//#endregion
		//#region lib/types/client/presentation.js
		/** Display labels and toast sentences for global plugin management. */
		/** The registries with a name of their own, by host. */
		const REGISTRY_COPY = new Map([["registry.npmmirror.com", "registryNpmmirror"]]);
		/** npm's own registry, which reads by name rather than by host. */
		const OFFICIAL_NPM_HOST = "registry.npmjs.org";
		/**
		* What a registry reads as: npm's own by its name, a known mirror by its name, any other registry by its host;
		* and the host each names, for where the name alone would leave it unsaid. The registry pnpm's own configuration
		* names reads by the registry it names, so the label never claims npm's own for another one.
		* @param registry - the registry, null for the one pnpm's own configuration names.
		* @param t - the manager's translate seat.
		* @param resolved - the URL pnpm's own configuration names, null while the Host could not read it.
		* @returns the name and the host.
		*/
		function registryText(registry, t, resolved) {
			const url = registry ?? resolved;
			if (url === null) return {
				name: t("registryDefault"),
				host: OFFICIAL_NPM_HOST
			};
			const host = registryHost(url);
			const key = host === OFFICIAL_NPM_HOST ? "registryOfficial" : REGISTRY_COPY.get(host);
			return {
				name: key === void 0 ? host : t(key),
				host
			};
		}
		/** The host of a registry URL; the URL as written when it does not parse. */
		function registryHost(registry) {
			try {
				return new URL(registry).host;
			} catch {
				return registry;
			}
		}
		/** The sentence each of the Host's refusal codes reads as. */
		const CODE_KEYS = {
			"management-required": "reasonManagementRequired",
			"unaddressable": "reasonUnaddressable",
			"unknown-plugin": "reasonUnknownPlugin",
			"invalid-spec": "reasonInvalidSpec",
			"already-installed": "reasonAlreadyInstalled",
			"ambiguous-install": "reasonAmbiguousInstall",
			"not-bundle": "reasonNotBundle",
			"not-removable": "reasonNotRemovable",
			"stop-profile": "reasonStopProfile",
			"bundle-in-use": "reasonBundleInUse",
			"stale-approval": "reasonStaleApproval",
			"incompatible-version": "reasonIncompatibleVersionUnnamed",
			"operation-error": "reasonOperationError"
		};
		/** The sentence a failed action opens with, by what was being done. */
		const FAILED_KEYS = {
			enable: "failedEnable",
			disable: "failedDisable",
			uninstall: "failedUninstall",
			rowEnable: "failedRowEnable",
			rowDisable: "failedRowDisable"
		};
		/**
		* What a management error reads as: the code's sentence; for an incompatibility, one sentence per
		* package it names, then the remedy for an install or for an installed plugin; or, for an operation error, the Host's diagnostic as it is.
		* @param error - the Host's code, its diagnostic, and the packages an incompatibility names.
		* @param t - the manager's translate seat.
		* @returns the sentence.
		*/
		function managementText(error, t) {
			if (error.code === "incompatible-version") {
				const named = error.incompatible ?? [];
				return [...named.length === 0 ? [t("reasonIncompatibleVersionUnnamed")] : named.map((plugin) => t("reasonIncompatibleVersion", {
					plugin: `${plugin.name}@${plugin.version}`,
					runtime: plugin.runtimeVersion,
					requirements: Object.entries(plugin.requirements).map(([name, range]) => `${name} ${range}`).join(", ")
				})), t(error.installing ? "reasonIncompatibleInstall" : "reasonIncompatibleInstalled")].join(t("sentenceSeparator"));
			}
			if (error.code !== "operation-error") return t(CODE_KEYS[error.code]);
			return error.diagnostic === void 0 || error.diagnostic === "" ? t("reasonOperationError") : error.diagnostic;
		}
		/**
		* Compact a package name to what a person calls it.
		* @param name - the package name.
		* @returns the unscoped name without the harness prefixes.
		*/
		function shortName(name) {
			return (name.startsWith("@") ? name.slice(name.indexOf("/") + 1) : name).replace(/^dsh-(?:host-|client-)?/, "");
		}
		/**
		* Resolve installed package metadata without changing its technical identity.
		* @param pkg - package identity and local metadata.
		* @param resolveText - current-locale package text resolver.
		* @returns localized copy with a technical-name fallback and the independent beta status.
		*/
		function packageText(pkg, resolveText) {
			return {
				title: pkg.meta?.title === void 0 ? pkg.name : resolveText(pkg.meta.title),
				description: pkg.meta?.description === void 0 ? void 0 : resolveText(pkg.meta.description) || void 0,
				beta: pkg.name.startsWith("@deepseek-ai/dsh-experimental-")
			};
		}
		/**
		* Resolve a bundle row's plugin metadata, using its full module specifier as the final title fallback.
		* @param row - row identity and local metadata.
		* @param resolveText - current-locale package text resolver.
		* @returns the row's display title and optional description.
		*/
		function rowText(row, resolveText) {
			return {
				title: row.meta?.title === void 0 ? row.moduleName : resolveText(row.meta.title),
				description: row.meta?.description === void 0 ? void 0 : resolveText(row.meta.description) || void 0
			};
		}
		/** The sentence naming why a change waits for a restart. */
		const RESTART_REASON_KEYS = {
			"no-hmr": "restartReasonNoHmr",
			"package-moved": "restartReasonPackageMoved",
			"host-module": "restartReasonHostModule",
			"unmanaged-plugin": "restartReasonUnmanagedPlugin",
			"module-comparison": "restartReasonModuleComparison"
		};
		/**
		* A restart prompt with its reason.
		* @param key - the prompt's sentence, which takes the reason as `{reason}`.
		* @param reason - why the change waits for a restart.
		* @param t - the manager's translate seat.
		* @returns the prompt.
		*/
		function restartText(key, reason, t) {
			return t(key, { reason: reason === void 0 ? "" : t(RESTART_REASON_KEYS[reason]) }).trimEnd();
		}
		/**
		* The sentence one notice shows.
		* @param notice - the last action's outcome.
		* @param t - the manager's translate seat.
		* @returns the sentence.
		*/
		function noticeText(notice, t) {
			switch (notice.kind) {
				case "restart": return restartText("restartNotice", notice.reason, t);
				case "overridden": return t("overriddenNotice", { name: notice.packageName });
				case "cancelled": return t("installCancelled");
				case "refresh-failed": return t("refreshError");
				case "install": return t({
					done: "installBackgroundDone",
					failed: "installBackgroundFailed",
					unconfirmed: "installBackgroundUnconfirmed",
					applying: "installBackgroundApplying",
					unknown: "installBackgroundUnknown"
				}[notice.outcome]);
				case "failed": {
					const reason = notice.code === void 0 ? notice.reason : managementText({
						code: notice.code,
						diagnostic: notice.reason,
						...notice.incompatible === void 0 ? {} : { incompatible: notice.incompatible }
					}, t);
					return t(FAILED_KEYS[notice.action], { reason: reason === "" ? t("reasonOperationError") : reason });
				}
			}
		}
		//#endregion
		//#region lib/types/client/manager-store.js
		/** The choice shown until the Host has said which registry it asks first: the one pnpm's own configuration names. */
		const OFFICIAL_REGISTRY = {
			kind: "offered",
			registry: null
		};
		/** Hold the manual-refresh spinner at least this long so a fast read does not flash it. */
		const REFRESH_SPINNER_MIN_MS = 400;
		/**
		* The registry a choice asks, as the Host's install plan compares registries: pnpm's own configuration stands for
		* the URL it names, once the Host has read it.
		* @param registry - the registry, null for the one pnpm's own configuration names.
		* @param resolved - the URL pnpm's own configuration names, null while the Host could not read it.
		* @returns the comparison key; a registry that does not parse compares as written.
		*/
		function registryKey(registry, resolved) {
			const url = registry ?? resolved;
			if (url === null) return "";
			try {
				return normalizeRegistry(url);
			} catch {
				return url;
			}
		}
		/**
		* The registries the dialog offers: the Host's first, its fallbacks, and pnpm's own, each once. pnpm's own
		* configuration stands for the registry it names, so it never repeats a registry the Host already offers.
		* @param registries - what the Host configured, or null while unread.
		* @returns the registries in the order the dialog lists them.
		*/
		function offeredRegistries(registries) {
			const offered = [];
			const keys = [];
			for (const registry of [...registries === null ? [] : [registries.registry, ...registries.fallbackRegistries], null]) {
				const key = registryKey(registry, registries?.resolved ?? null);
				if (keys.includes(key)) continue;
				offered.push(registry);
				keys.push(key);
			}
			return offered;
		}
		/**
		* Whether an installation is still owned by the Host.
		* @param phase - the dialog's current installation phase.
		* @returns true while a Host result or a check for an active request is outstanding.
		*/
		function isInstallPending(phase) {
			return phase === "starting" || phase === "running" || phase === "cancelling" || phase === "applying" || phase === "unconfirmed";
		}
		/**
		* Offer the configured mainland mirror after a confirmed GitHub connection failure.
		* @param install - the installation and the Host's failure attribution.
		* @returns the offered entry that asks npmmirror, null when that entry is pnpm's own configuration, or undefined when
		* this recovery does not apply; test for undefined, because null is a valid entry.
		*/
		function githubRecoveryRegistry(install) {
			if (install.confirmed !== void 0 || install.phase !== "failed" || install.failure?.failedAt !== "spec-host" || install.failure.kind !== "network" && install.failure.kind !== "timeout") return void 0;
			const host = install.subject?.host?.toLowerCase().split(":")[0];
			if (host !== "github.com" && !host?.endsWith(".github.com")) return void 0;
			const resolved = install.registries?.resolved ?? null;
			return offeredRegistries(install.registries).find((registry) => registryKey(registry, resolved) === NPMMIRROR_REGISTRY);
		}
		/**
		* Whether the install already asks npmmirror first, so switching to the offered mirror would not change the registry.
		* @param install - the installation and its registry choice.
		* @returns true when the chosen registry, offered or typed, compares as npmmirror.
		*/
		function asksMirror(install) {
			const choice = install.registry;
			return registryKey(choice.kind === "custom" ? choice.url.trim() : choice.registry, install.registries?.resolved ?? null) === NPMMIRROR_REGISTRY;
export {};
