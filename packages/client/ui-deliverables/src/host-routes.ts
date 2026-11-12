/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nua host cua row ui-deliverables: nam tuyen API co xac thuc — NGUYEN VAN ban goc (present-open)
 */
import { CHANGED_FILES_PATH, CHANGES_DIFF_PATH, CHANGES_OPEN_PATH } from "./changes.ts";
import { PRESENT_HOST_PATH, PRESENT_OPEN_PATH, isPresentedData, isPresentedFile } from "./presented.ts";
import { FILE_REFERENCE_PROMPT } from "./host-prompt.ts";
import type { Any } from "./runtime.ts";

/** Context phia Host; chi khai nhung dich vu row nay that su dung (ten nguyen van nhu ban goc). */
export interface HostCtx {
  /** Vong doi cua plugin. */
  effect: (run: () => unknown) => void;
  /** Cau noi dang ky tuyen API co xac thuc. */
  connection: { fetch: { register: (route: Any) => unknown } };
  /** Dich vu doc su kien cua phien. */
  sessionQuery: Any;
  /** Dieu khien phien: desktop, mo duong dan, danh sach ung dung. */
  sessionController: Any;
  /** File trong khong gian lam viec. */
  workspaceFiles: Any;
  /** Anh xa duong dan Host <-> tien trinh. */
  fs: Any;
  /** Chinh sach sandbox: goc khong gian lam viec. */
  sandboxPolicy: Any;
  /** Bang tom tat va so sanh cua mot luot. */
  workspaceChanges: Any;
  /** So dang ky muc system prompt. */
  systemPrompt: Any;
}

/**
 * Nhan dien loi tu xa bang CAU TRUC (khong phu thuoc lop) — ban rut gon nguyen van cua
 * @deepseek-ai/dsh-typert-protocol: nua host cua ta khong keo them phu thuoc ngoai repo.
 * Nhan: value — gia tri bat duoc.
 * Tra: loi tu xa khi dau hieu khop, nguoc lai undefined.
 */
function remoteErrorOf(value: unknown): { code: string } | undefined {
  if (typeof value === "object" && value !== null) {
    const remote = value as { isDSHRemoteError?: unknown; code?: unknown };
    if (remote.isDSHRemoteError === true && typeof remote.code === "string") return value as { code: string };
  }
  return undefined;
}
/**
* Register the deliverables routes inside Connection's authentication fence:
* desktop metadata, change summaries and comparisons, declared-file actions,
* and changed-file opening.
* @param ctx - Session lookup, change summaries, native opener, and route lifetime.
*/
function registerPresentOpen(ctx: Any) {
ctx.connection.fetch.register({
	path: PRESENT_HOST_PATH,
	methods: ["GET"],
	requestBody: "buffered",
	fetch: () => Promise.resolve(Response.json(ctx.sessionController.workspaceDesktop(), { headers: { "cache-control": "no-store" } }))
});
ctx.connection.fetch.register({
	path: CHANGED_FILES_PATH,
	methods: ["GET"],
	requestBody: "buffered",
	fetch: (request: Any) => Promise.resolve(handleChangesSummary(ctx, request))
});
const lifetime = new AbortController();
const pending = /* @__PURE__ */ new Set();
ctx.effect(() => async () => {
	lifetime.abort();
	await Promise.allSettled(pending);
});
const routes: Any[] = [
	[
		PRESENT_OPEN_PATH,
		["GET", "POST"],
		handlePresentOpen
	],
	[
		CHANGES_OPEN_PATH,
		["GET", "POST"],
		handleChangesOpen
	],
	[
		CHANGES_DIFF_PATH,
		["GET"],
		handleChangesDiff
	]
];
for (const [path, methods, handler] of routes as [string, string[], (ctx: HostCtx, request: Request) => Promise<Response>][]) ctx.connection.fetch.register({
	path,
	methods: [...methods],
	requestBody: "buffered",
	fetch: (request: Any) => {
		const task = handler(ctx, new Request(request, { signal: AbortSignal.any([request.signal, lifetime.signal]) }));
		pending.add(task);
		task.then(() => {
			pending.delete(task);
		}, () => {
			pending.delete(task);
		});
		return task;
	}
});
}
const NUMERIC = /^\d+$/;
function coordinate(value: Any) {
return value !== null && NUMERIC.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
}
/** Translate lookup and filesystem failures into the not-found or failure status the browser retries from. */
function failureStatus(error: Any) {
const remote = remoteErrorOf(error);
return remote?.code === "session/not-found" || remote?.code === "workspace-file/not-found" || remote?.code === "workspace-file/not-regular-file" || error instanceof Error && "code" in error && (error.code === "SESSION_QUERY_SESSION_NOT_FOUND" || error.code === "SESSION_QUERY_EVENT_NOT_FOUND" || error.code === "ENOENT" || error.code === "ENOTDIR") ? 404 : 500;
}
/**
* Read the addressed event once the Host desktop is known to be available.
* @returns the event with its Session header, or the refusal to answer with.
*/
async function readTarget(ctx: Any,    request: Any,    id: Any,    seq: Any) {
request.signal.throwIfAborted();
if (!ctx.sessionController.workspaceDesktop().available) return new Response("Host desktop unavailable.", { status: 409 });
return ctx.sessionQuery.readEvent({
	sessionId: id,
	seq,
	before: 0,
	after: 0
}, request.signal);
}
/**
* Open one verified Host path. A file is verified through the Session
* filesystem; a directory is verified by the Host filesystem mapping alone.
* @returns the HTTP status to answer with.
*/
async function openVerified(ctx: Any,    request: Any,    path: Any,    action: Any) {
const { fs } = ctx;
const mapped = fs.processPathFromHostPath(path);
if (mapped === undefined || fs.processPath(await fs.resolve(mapped, { signal: request.signal })) !== path) return new Response("Path has no verified Host path.", { status: 422 });
request.signal.throwIfAborted();
if (request.method === "GET") return Response.json(await ctx.sessionController.workspacePathApplications({ path }, request.signal), { headers: { "cache-control": "no-store" } });
const application = new URL(request.url).searchParams.get("application");
await ctx.sessionController.openWorkspacePath({
	path,
	...action === "reveal" ? { action } : application === null ? {} : { application }
}, request.signal);
return new Response(null, {
	status: 204,
	headers: { "cache-control": "no-store" }
});
}
async function handlePresentOpen(ctx: Any,  request: Any) {
const query = new URL(request.url).searchParams;
const action = query.get("action") ?? "open";
if (action !== "open" && action !== "reveal") return new Response("Invalid file action.", { status: 400 });
const id = query.get("sessionId");
const seq = coordinate(query.get("seq"));
const index = coordinate(query.get("index"));
if (!id || seq === undefined || index === undefined) return new Response("Invalid Presented file coordinates.", { status: 400 });
try {
	const read = await readTarget(ctx, request, id, seq);
	if (read instanceof Response) return read;
	const { target, session } = read;
	const file = target.type === "deliverables/presented" && isPresentedData(target.data) ? target.data.files[index] : undefined;
	if (!isPresentedFile(file)) return new Response("Presented file not found in this Session result.", { status: 404 });
	request.signal.throwIfAborted();
	const { absolutePath: path } = await ctx.workspaceFiles.stat({
		sessionId: id,
		workspaceRoot: session.cwd ?? ctx.sandboxPolicy.workspaceRoot
	}, file.path, request.signal);
	return await openVerified(ctx, request, path, action);
} catch (error) {
	request.signal.throwIfAborted();
	return new Response("Presented file unavailable.", { status: failureStatus(error) });
}
}
/** The summary one `workspace/changes` event announced, without the Host working directory; 404 once the Host no longer serves it. */
function handleChangesSummary(ctx: Any,  request: Any) {
const query = new URL(request.url).searchParams;
const id = query.get("sessionId");
const seq = coordinate(query.get("seq"));
if (!id || seq === undefined) return new Response("Invalid change summary coordinates.", { status: 400 });
const summary = ctx.workspaceChanges.summary(id, seq);
if (summary === undefined) {
	// 10/11/2026 (Lead): 404 ỏ đây KHÔNG phải lỗi định tuyến mà là "không có bản ghi". Đo được: row
	// packages/host/workspace-changes CHƯA TỪNG được mount (0 lần trong composed config) nên recorder chỉ
	// ghi các lượt nó quan sát trực tiếp (session/event turn/*, tool/result, tools/pre-execute,
	// fs/write-intent) ⇒ mọi phiên CŨ đều không có bản tóm tắt. Row nay đã mount (lượt mới sẽ có bản ghi);
	// với phiên cũ trả 200 RỖNG kèm cờ recorded:false để UI hiện "không có dữ liệu" thay vì lỗi console —
	// không nuốt thông tin, chỉ nói đúng sự thật là chưa ghi.
	return Response.json({
		turn: seq,
		files: [],
		total: 0,
		added: 0,
		deleted: 0,
		recorded: false
	}, { headers: { "cache-control": "no-store" } });
}
const { turn, files, total, added, deleted } = summary;
return Response.json({
	turn,
	files,
	total,
	added,
	deleted
}, { headers: { "cache-control": "no-store" } });
}
/** A changed file's coordinates from a route query, or the 400 to answer with. */
function changedFileCoordinates(request: Any) {
const query = new URL(request.url).searchParams;
const id = query.get("sessionId");
const seq = coordinate(query.get("seq"));
const index = coordinate(query.get("index"));
if (!id || seq === undefined || index === undefined) return new Response("Invalid changed file coordinates.", { status: 400 });
return {
	id,
	seq,
	index
};
}
/** One listed file's comparison; 404 once the Host no longer serves the summary or the index names no file. */
async function handleChangesDiff(ctx: Any,  request: Any) {
const coordinates = changedFileCoordinates(request);
if (coordinates instanceof Response) return coordinates;
const { id, seq, index } = coordinates;
try {
	const diff = await ctx.workspaceChanges.diff(id, seq, index, request.signal);
	if (diff === undefined) return new Response("Change comparison unavailable.", { status: 404 });
	return Response.json(diff, { headers: { "cache-control": "no-store" } });
} catch (error) {
	request.signal.throwIfAborted();
	return new Response("Change comparison unavailable.", { status: failureStatus(error) });
}
}
async function handleChangesOpen(ctx: Any,  request: Any) {
const action = new URL(request.url).searchParams.get("action") ?? "open";
if (action !== "open" && action !== "reveal") return new Response("Invalid file action.", { status: 400 });
const coordinates = changedFileCoordinates(request);
if (coordinates instanceof Response) return coordinates;
const { id, seq, index } = coordinates;
try {
	request.signal.throwIfAborted();
	if (!ctx.sessionController.workspaceDesktop().available) return new Response("Host desktop unavailable.", { status: 409 });
	const changes = ctx.workspaceChanges.summary(id, seq);
	if (changes === undefined) return new Response("Change summary unavailable.", { status: 404 });
	const workspaceRoot = changes.cwd;
	const file = changes.files[index];
	if (file === undefined) return new Response("Changed file not found in this summary.", { status: 404 });
	const { absolutePath: path } = await ctx.workspaceFiles.stat({
		sessionId: id,
		workspaceRoot
	}, file.path, request.signal);
	return await openVerified(ctx, request, path, action);
} catch (error) {
	request.signal.throwIfAborted();
	return new Response("Changed file unavailable.", { status: failureStatus(error) });
}
}

export const inject = [
"systemPrompt",
"connection",
"sessionQuery",
"sessionController",
"workspaceFiles",
"fs",
"sandboxPolicy",
"workspaceChanges"
];

/**
 * Than plugin phia Host: dang ky nam tuyen API roi tiem huong dan tham chieu file vao system prompt.
 * Nhan: ctx — context phia Host (connection, sessionController, sessionQuery, workspaceFiles, fs, sandboxPolicy, workspaceChanges).
 * Tra: khong co.
 */
export function apply(ctx: HostCtx): void {
  registerPresentOpen(ctx);
  ctx.systemPrompt.section({
    name: "ui:deliverable-file-references",
    order: ctx.systemPrompt.getSectionOrder("DELIVERABLE_FILE_REFERENCES"),
    text: FILE_REFERENCE_PROMPT,
  });
}
