/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Trinh ghi to hop phim vat ly + sua lenh theo revision (chuyen tu bundle goc, giu nguyen logic/JSDoc)
 */

import type { CatalogEntry, ConfigSnapshot, FixedCatalogRow, KeyboardEventLike } from "./types.ts";

/** Ham dung element cua React runtime. */
export type JsxFn = (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;

/** Runtime JSX. */
export interface EditorRuntime {
  /** Mot con. */
  jsx: JsxFn;
  /** Nhieu con. */
  jsxs: JsxFn;
  /** Fragment. */
  Fragment: unknown;
}

/** Hook React ma component nay dung. */
export interface EditorReact {
  /** State. */
  useState: <T>(initial: T) => [T, (next: T) => void];
  /** Ref. */
  useRef: <T>(initial: T) => { current: T };
  /** Hieu ung. */
  useEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Hieu ung layout. */
  useLayoutEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Callback on dinh. */
  useCallback: <T>(fn: T, deps?: readonly unknown[]) => T;
  /** Id on dinh. */
  useId: () => string;
}

/** Bo nguyen thuy cua DSH ma component nay dung. */
export interface EditorPrimitives extends Record<string, unknown> {
  /** Nut. */
  Button: unknown;
  /** Modal. */
  Modal: unknown;
  /** Toast. */
  Toast: unknown;
  /** Tooltip. */
  Tooltip: unknown;
  /** Hien thi to hop phim. */
  ShortcutKeys: unknown;
  /** Icon dong. */
  IconCloseOutlineRegular: unknown;
  /** Icon lam moi. */
  IconRefreshOutlineRegular: unknown;
  /** Dong modal tren cung. */
  closeTopModal: () => void;
  /** Focus khong vien. */
  focusWithoutRing: (el: unknown) => void;
  /** Co nam sau modal khong. */
  isBehindModal: (el: unknown) => boolean;
  /** Theo doi composition. */
  observeComposition: (target: unknown) => { guards: (event: unknown) => boolean; dispose: () => void };
  /** Xep theo ten — chu ky THAT cua primitive: (rows, query), ten nam trong truong `name` cua dong. */
  rankByName: <T extends { readonly name: string }>(rows: readonly T[], query: string) => readonly T[];
}

/** Props ma trinh ghi nhan. */
export interface ShortcutEditorProps extends Record<string, unknown> {
  /** Lenh dang sua. */
  target: CatalogEntry;
  /** Dong trinh ghi. */
  onClose: () => void;
  /** Da luu. */
  onSaved: () => void;
  /** Loi. */
  onError: (message: string) => void;
  /** Hook danh muc lenh. */
  useCatalog: <T>(select: (value: readonly CatalogEntry[]) => T) => T;
  /** Hook cau hinh. */
  useConfig: <T>(select: (value: ConfigSnapshot) => T) => T;
  /** Hook danh muc co dinh. */
  useFixedCatalog: <T>(select: (value: readonly FixedCatalogRow[]) => T) => T;
  /** Sua cau hinh (tra ket qua da phan loai). */
  edit: (edit: { type: string; binding?: unknown }, revision: number) => Promise<{ status: string }>;
  /** Bat/tat che do ghi to hop. */
  recording: (active: boolean) => Promise<void>;
  /** Mo ta to hop vat ly. */
  describeBinding: (binding: unknown) => { binding: { code?: string; secondCode?: string; modifiers: readonly string[] } | null; keys: readonly string[]; issue: string | null; conflicts: readonly string[] };
  /** Noi luu (web/desktop). */
  runtime: string;
  /** Nen tang (macos/win/linux). */
  platform: string;
  /** Tu dien. */
  t: (key: string, params?: Record<string, unknown>) => string;
}

/** Phu thuoc de dung trinh ghi. */
export interface EditorDeps {
  /** Runtime JSX. */
  runtime: EditorRuntime;
  /** Hook React. */
  react: EditorReact;
  /** Nguyen thuy. */
  primitives: EditorPrimitives;
  /** Bang lop CSS. */
  classes: Record<string, string>;
  /** Ham clsx cua du an. */
  clsx: (...args: unknown[]) => string;
  /** Cau chu chan doan khi ghi that bai. */
  shortcutFailure: (result: unknown, catalog: readonly unknown[], t: (key: string, params?: Record<string, unknown>) => string, runtime: string) => string;
  /** Cau chu chan doan khi doc that bai. */
  shortcutReadFailure: (config: unknown, runtime: string, t: (key: string, params?: Record<string, unknown>) => string) => string;
  /** Glyph. */
  ShortcutIcon: (props: { kind: string; className?: string }) => unknown;
}

/**
 * Dung component trinh ghi phim tat.
 * Nhan: phu thuoc (runtime/hook/nguyen thuy/lop/glyph).
 * Tra: component 'ShortcutEditor'.
 */
export function createShortcutEditor(deps: EditorDeps): (props: ShortcutEditorProps) => unknown {
  const { runtime: jsxRuntime, react, primitives, classes, clsx, ShortcutIcon, shortcutFailure, shortcutReadFailure } = deps;

/** Inline physical-key recording and revision-aware command editing. */
/**
* Save a released physical combination against the configuration the user reviewed.
* @param props - command, accepted snapshots, and storage/feedback callbacks.
* @returns inline command controls; failures retain the draft and allow another recording.
*/
function ShortcutEditor({ target, onClose, onSaved, onError, useCatalog, useConfig, useFixedCatalog, edit, recording, describeBinding, runtime, platform, t }: ShortcutEditorProps): unknown {
const config = useConfig((value) => value);
const catalog = useCatalog((value) => value);
const fixed = useFixedCatalog((value) => value);
const [revision, setRevision] = react.useState(config.revision);
const [candidate, setCandidate] = react.useState<unknown>(null);
const [captured, setCaptured] = react.useState(false);
const [busy, setBusy] = react.useState(false);
const [nativeReady, setNativeReady] = react.useState(runtime === "web");
const [message, setMessage] = react.useState<string>("");
const [retry, setRetry] = react.useState<unknown>(null);
const descriptionId = react.useId();
const recorder = react.useRef(null);
const mounted = react.useRef(true);
const writing = react.useRef(false);
/* v8 ignore next -- The effect installs reset before the recorder is enabled. */
const restart = react.useRef(() => {});
const desktopChords = runtime === "desktop" && (platform === "macos" || platform === "windows");
const targetId = target.id;
const stale = revision !== config.revision;
const report = (text: string): void => {
	setMessage(text);
	onError(text);
};
const save = async (operation: { type: string; id?: string; binding?: unknown }, reviewedRevision: number = revision): Promise<void> => {
	if (writing.current) return;
	writing.current = true;
	setBusy(true);
	const result = await edit(operation, reviewedRevision);
	if (!mounted.current) return;
	writing.current = false;
	setBusy(false);
	if (result.status === "saved") onSaved();
	else {
setRetry(operation.type === "set" ? operation.binding : null);
report(shortcutFailure(result, [...catalog, ...fixed], t, runtime));
	}
};
const capture = (binding: unknown, id: string): void => {
	setCandidate(binding);
	setCaptured(true);
	setRetry(null);
	const described = describeBinding(binding);
	const conflicts = described.conflicts.filter((value) => value !== id).map((value) => [...catalog, ...fixed].find((row) => row.id === value)?.label ?? value);
	if (described.issue !== null) {
report(t(described.issue));
return;
	}
	if (conflicts.length > 0) {
report(t("conflict", { commands: conflicts.join(", ") }));
return;
	}
	if (stale) {
setRetry(binding);
report(t("stale"));
return;
	}
	if (config.status !== "ready") {
report(config.status === "loading" ? t("not-ready") : shortcutReadFailure(config, runtime, t));
return;
	}
	save({
type: "set",
id,
binding
	});
};
const handlers = react.useRef({
	capture,
	report,
	onClose
});
react.useLayoutEffect(() => {
	handlers.current = {
capture,
report,
onClose
	};
});
react.useEffect(() => {
	mounted.current = true;
	return () => {
mounted.current = false;
	};
}, []);
react.useEffect(() => {
	let disposed = false;
	recording(true).then(() => {
if (!disposed) setNativeReady(true);
	}, () => {
if (!disposed) handlers.current.report(t("native-failed"));
	});
	const composition = primitives.observeComposition(document);
	let pending: { code?: string; secondCode?: string; modifiers: readonly string[] } | null = null;
	let dead = false;
	let blocked = false;
	const held = /* @__PURE__ */ new Set();
	const reset = () => {
pending = null;
held.clear();
blocked = false;
dead = false;
	};
	restart.current = reset;
	const down = (event: KeyboardEventLike): void => {
if (composition.guards(event) || event.getModifierState("AltGraph")) {
	if (desktopChords) reset();
	return;
}
if ((!desktopChords || document.activeElement !== recorder.current) && event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
	event.preventDefault();
	event.stopPropagation();
	if (!event.repeat && !writing.current) handlers.current.onClose();
	return;
}
const commandDeadKey = runtime === "web" && platform === "macos" && document.activeElement === recorder.current && event.code === "KeyN" && event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey;
if (event.key === "Dead" && !commandDeadKey) {
	if (desktopChords) reset();
	dead = true;
	return;
}
if (dead) {
	dead = false;
	return;
}
const modifiers = [
	"control",
	"alt",
	"shift",
	"meta"
].filter((value) => ({
	control: event.ctrlKey,
	alt: event.altKey,
	shift: event.shiftKey,
	meta: event.metaKey
})[value]);
const recordTab = desktopChords || (platform === "macos" || platform === "windows") && modifiers.length >= 3;
if (document.activeElement !== recorder.current || event.key === "Tab" && !recordTab) return;
event.preventDefault();
event.stopPropagation();
if (writing.current || event.repeat) return;
if (/^(Control|Alt|Shift|Meta)(Left|Right)$/u.test(String(event.code ?? ""))) {
	if (desktopChords && pending !== null) {
		reset();
		setCandidate(null);
		setCaptured(false);
	}
	return;
}
if (desktopChords) {
	held.add(event.code);
	if (blocked) return;
	if (held.size > 2) {
		blocked = true;
		pending = null;
		handlers.current.report(t("too-many-keys"));
		return;
	}
}
try {
	const codes = [event.code, ...desktopChords ? [...held].filter((value) => value !== event.code) : []];
	pending = describeBinding({
		code: codes[0],
		...codes[1] === void 0 ? {} : { secondCode: codes[1] },
		modifiers
	}).binding;
	setCandidate(pending);
	setCaptured(desktopChords);
	setMessage("");
	setRetry(null);
} catch (_error) {
	blocked = desktopChords;
	pending = null;
	handlers.current.report(t("unsupported-key"));
}
	};
	const up = (event: KeyboardEventLike): void => {
held.delete(event.code);
if (desktopChords && document.activeElement === recorder.current) {
	event.preventDefault();
	event.stopPropagation();
}
const binding = pending !== null && (pending.code === String(event.code ?? "") || pending.secondCode === String(event.code ?? "") || pending.modifiers.some((modifier) => modifier === String(event.code ?? "").replace(/(Left|Right)$/u, "").toLowerCase())) ? pending : null;
if (binding !== null) {
	pending = null;
	blocked = desktopChords;
}
if (desktopChords && (held.size === 0 || platform === "macos" && /^Meta(Left|Right)$/u.test(String(event.code ?? "")))) {
	held.clear();
	blocked = false;
}
if (binding === null) return;
handlers.current.capture(binding, targetId);
	};
	const blur = () => {
reset();
if (desktopChords) {
	setCandidate(null);
	setCaptured(false);
}
	};
	const focus = () => {
if (document.activeElement !== recorder.current) blur();
	};
	document.addEventListener("keydown", down, true);
	document.addEventListener("keyup", up, true);
	window.addEventListener("blur", blur);
	if (desktopChords) {
document.addEventListener("focusin", focus, true);
document.addEventListener("compositionstart", blur, true);
	}
	return () => {
disposed = true;
composition.dispose();
document.removeEventListener("keydown", down, true);
document.removeEventListener("keyup", up, true);
window.removeEventListener("blur", blur);
document.removeEventListener("focusin", focus, true);
document.removeEventListener("compositionstart", blur, true);
recording(false).catch(() => {});
	};
}, [
	describeBinding,
	recording,
	t,
	targetId,
	runtime,
	platform,
	desktopChords
]);
react.useEffect(() => {
	const element = recorder.current;
	if (nativeReady && element !== null) primitives.focusWithoutRing(element);
}, [nativeReady]);
const readonly = busy || stale || config.status !== "ready";
const review = stale && jsxRuntime.jsxs("div", {
	className: classes.review,
	children: [jsxRuntime.jsx("span", { children: t("stale") }), jsxRuntime.jsx("button", {
type: "button",
className: classes.inlineAction,
disabled: busy,
onClick: () => {
	setRevision(config.revision);
	setMessage("");
},
children: t("review")
	})]
});
return jsxRuntime.jsxs("div", {
	className: classes.inlineEditor,
	role: "group",
	"aria-label": target.label,
	"data-shortcut-modal": "shortcut-edit",
	"aria-busy": busy,
	children: [
jsxRuntime.jsxs("div", {
	className: classes.inlineControls,
	children: [
		jsxRuntime.jsx("button", {
			type: "button",
			className: classes.inlineAction,
			disabled: readonly,
			onClick: () => {
				save({
					type: "reset",
					id: target.id
				});
			},
			children: t("reset")
		}),
		target.binding !== null && jsxRuntime.jsx("button", {
			type: "button",
			className: classes.inlineAction,
			disabled: readonly,
			onClick: () => {
				save({
					type: "set",
					id: target.id,
					binding: null
				});
			},
			children: t("clear")
		}),
		jsxRuntime.jsx("button", {
			ref: recorder,
			type: "button",
			className: clsx(classes.recorder, message && classes.invalid),
			disabled: !nativeReady,
			"aria-disabled": busy || !nativeReady,
			onBlur: () => {
				restart.current();
			},
			"aria-label": t("record"),
			"aria-invalid": message !== "",
			"aria-describedby": descriptionId,
			onClick: () => {
				if (!writing.current) {
					restart.current();
					setCaptured(false);
					setMessage("");
					setRetry(null);
				}
			},
			children: captured && message === "" ? jsxRuntime.jsx(primitives.ShortcutKeys, {
				keys: describeBinding(candidate).keys,
				className: classes.recorded
			}) : t("record")
		})
	]
}),
jsxRuntime.jsx("span", {
	id: descriptionId,
	className: classes.srOnly,
	children: message || (desktopChords ? "" : t(runtime === "web" ? platform === "windows" ? "windows-web-help" : platform === "macos" ? "macos-web-help" : "web-help" : "record-help"))
}),
review,
retry !== null && !stale && jsxRuntime.jsx("button", {
	type: "button",
	className: classes.inlineAction,
	disabled: readonly,
	onClick: () => {
		capture(retry, target.id);
	},
	children: t("retry-save")
})
	]
});
}

  return ShortcutEditor;
}
