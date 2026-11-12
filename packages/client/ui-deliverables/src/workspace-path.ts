/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tien ich duong dan khong gian lam viec cua DSH — NGUYEN VAN ban goc
 */
import { type Any, fragment, jsx, jsxs, primitive, useId, useEffect, useMemo, useRef, useState } from "./runtime.ts";

/**
* The `gbh-resource://file/…` address grammar (nhận cả scheme cũ `gbh-resource://`): how a file is named across the
* Sidebar and the resource model, built and parsed without touching a
* filesystem.
* @module
*/
/** The scheme and type every file address opens with. */
// 18/10/2026 (task-29, Wave D): PHÁT scheme mới gbh-resource:// (bản gốc: gbh-resource://).
const FILE_ADDRESS_PREFIX = "gbh-resource://file/";
/** Component-encode one id or path segment, keeping `:` literal for drive letters. */
function encodeSegment(segment: Any) {
	return encodeURIComponent(segment).replace(/%3A/gi, ":");
}
/** Encode a `/`-separated path segment by segment. */
function encodePath(path: Any) {
	return path.split("/").map(encodeSegment).join("/");
}
/**
* Build the address of a file read through one Session.
* @param sessionId - the Session whose Host workspace resolves the path.
* @param path - absolute or workspace-relative path; backslashes are normalized to `/`, and leading `./` prefixes are dropped.
* @returns the `gbh-resource://file/session/<sessionId>/<path>` address.
*/
export function sessionFileAddress(sessionId: Any,  path: Any) {
	const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
	return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`;
}
/**
* Browser-safe Workspace path and display helpers.
* @module @deepseek-ai/dsh-util-workspace-path
*/
/**
 * Duong dan co dung kieu Windows (o dia hoac UNC) khong.
 * Nhan: value — duong dan can phan loai.
 * Tra: true khi dung kieu Windows.
 */
export function isWindowsStylePath(value: Any) {
	return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
}
/**
* Whether a path is absolute in either spelling the Host accepts: POSIX (`/a/b`) or Windows drive or UNC.
* @param path - the path to classify.
* @returns `true` for an absolute path; `false` for a Workspace-relative one.
*/
export function isAbsoluteWorkspacePath(path: Any) {
	return path.startsWith("/") || isWindowsStylePath(path);
}
/**
* Resolve a Workspace-relative path into the Host-facing spelling used by path operations.
* @param cwd - Session Workspace root, when known.
* @param path - Absolute or Workspace-relative path.
* @returns an absolute path when a Workspace root is available, otherwise the original path.
*/
export function resolveWorkspacePath(cwd: Any,  path: Any) {
	if (isAbsoluteWorkspacePath(path)) return path;
	if (cwd === undefined || cwd === "") return path;
	const separator = isWindowsStylePath(cwd) && cwd.includes("\\") ? "\\" : "/";
	return `${cwd.replace(/[/\\]+$/, "")}${separator}${path.replace(/^[/\\]+/, "")}`;
}
/**
* The address for a path as a caller holds it: a relative path, or an absolute
* path inside the Session's workspace, becomes a `session`-scoped address; an
* absolute path outside it, or one whose workspace root is unknown, keeps its
* absolute path in that Session's address.
* @param sessionId - the Session the path is read in.
* @param cwd - that Session's workspace root, when known.
* @param path - absolute or workspace-relative path, in either separator spelling.
* @returns the `gbh-resource://file/…` address.
*/
export function fileAddressFor(sessionId: Any,   cwd: Any,   path: Any) {
	const normalized = path.replace(/\\/g, "/");
	if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized);
	const root = cwd === undefined ? "" : cwd.replace(/\\/g, "/").replace(/\/+$/, "");
	if (root !== "" && normalized === root) return sessionFileAddress(sessionId, "");
	if (root !== "" && normalized.startsWith(`${root}/`)) return sessionFileAddress(sessionId, normalized.slice(root.length + 1));
	return sessionFileAddress(sessionId, normalized);
}
