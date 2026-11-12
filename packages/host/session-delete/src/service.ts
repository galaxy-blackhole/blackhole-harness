/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Dịch vụ XOÁ PHIÊN: gỡ vĩnh viễn nhật ký một phiên đã lưu (ADR 0016). Ba bước: chặn khi phiên
 *      còn sống trong tiến trình → xoá ĐÚNG thư mục nhật ký trong <home>/sessions/<project>/<id> →
 *      gọi một lượt listSessions() để bộ đếm chỉ mục SQLite tự gỡ dòng đã mất tệp.
 */

import { lstat, readdir, realpath, rm } from "node:fs/promises";
import { basename, join, sep } from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import { Remote, RemoteError, TypertRemoteService } from "@galaxy-blackhole/gbh-typert-protocol";

import "./types.ts";

/** Yêu cầu xoá một phiên. */
export interface SessionDeleteRequest {
  /** Id phiên cần xoá (khoá thư mục nhật ký). */
  readonly sessionId: string;
}

/** Kết quả một lượt xoá thành công. */
export interface SessionDeleteResult {
  /** Luôn true khi trả về (lỗi thì ném RemoteError). */
  readonly deleted: true;
  /** Đường dẫn TUYỆT ĐỐI đã gỡ — để client hiện trong toast và để log kiểm toán. */
  readonly path: string;
}

/** Mẫu id hợp lệ: không dấu phân cách đường dẫn, không rỗng. */
const ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/u;

/** Phần dịch vụ lưu trữ phiên mà lượt xoá cần (chỉ đọc). */
interface PersistenceSeam {
  /** Gốc chứa mọi thư mục dự án của nhật ký phiên. */
  readonly root?: string;
  /** Ảnh chụp một phiên đã lưu, hoặc undefined khi không tồn tại. */
  stat(id: string, options?: { readonly signal?: AbortSignal }): Promise<unknown>;
}

/** Phần sổ Agent ĐANG CHẠY trong tiến trình (chỉ đọc). */
interface AgentsSeam {
  /**
   * Tra ve Agent cua phien khi phien DA DUOC NAP (mo phien la co), hoac undefined.
   * Luu y: co Agent KHONG dong nghia dang chay — phai doc `status`.
   */
  get(id: string): { readonly status?: string } | undefined;
}

/** Phần chỉ mục tìm kiếm phiên (chỉ đọc; gọi để đồng bộ lại sau khi xoá). */
interface SessionQuerySeam {
  /** Liệt kê phiên đã lưu; mỗi lượt gọi kích hoạt đối soát chỉ mục. */
  listSessions?(signal?: AbortSignal): Promise<readonly unknown[]>;
}

/**
 * Kiểm tra id phiên do client gửi có an toàn để dùng làm một đoạn đường dẫn.
 * Nhận: id — giá trị thô từ yêu cầu.
 * Trả: id đã chuẩn hoá.
 * Ném: RemoteError "session/delete-invalid" khi rỗng, quá dài, hoặc chứa ký tự đường dẫn.
 */
export function requireSafeId(id: unknown): string {
  const value = typeof id === "string" ? id.trim() : "";
  if (!ID_PATTERN.test(value)) {
    throw new RemoteError("session/delete-invalid", "Session id is not a safe directory name.", { sessionId: String(id) });
  }
  return value;
}

/**
 * Dò thư mục nhật ký của MỘT phiên trong gốc lưu trữ: mỗi dự án là một thư mục con, phiên là thư mục
 * con của nó. Không đoán tên đã mã hoá — chỉ nhận thư mục có tên ĐÚNG BẰNG id.
 * Nhận: root — gốc lưu trữ; id — id phiên.
 * Trả: danh sách đường dẫn ứng viên (kỳ vọng đúng một phần tử).
 */
export async function findSessionDirs(root: string, id: string): Promise<string[]> {
  const found: string[] = [];
  const projects = await readdir(root, { withFileTypes: true });
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const candidate = join(root, project.name, id);
    const info = await lstat(candidate).catch(() => undefined);
    if (info?.isDirectory() === true) found.push(candidate);
  }
  return found;
}

/**
 * Khẳng định thư mục đích nằm trong gốc lưu trữ (sau khi giải hết symlink) và TRÔNG như một thư mục phiên.
 * Nhận: candidate — đường dẫn ứng viên; root — gốc lưu trữ; id — id phiên.
 * Trả: đường dẫn thật đã kiểm.
 * Ném: RemoteError "session/delete-unsafe" khi ra ngoài gốc hoặc thiếu tệp nhật ký.
 */
export async function verifySessionDir(candidate: string, root: string, id: string): Promise<string> {
  const realRoot = await realpath(root);
  const real = await realpath(candidate);
  if (basename(real) !== id || !real.startsWith(realRoot + sep)) {
    throw new RemoteError("session/delete-unsafe", "Refusing to delete a directory outside the session store.", { path: real });
  }
  const entries = await readdir(real);
  // Backend jsonl hiện tại ghi `session.v4.jsonl.zstd` (+ `session.lock`); bản cũ dùng `events*.jsonl`.
  // Chỉ nhận thư mục có ÍT NHẤT một tệp nhật ký như vậy — vẫn là chốt an toàn để không xoá nhầm thư mục khác.
  const looksLikeLog = entries.some((name) => name.startsWith("session.") || name.startsWith("events"));
  if (!looksLikeLog) {
    throw new RemoteError("session/delete-unsafe", "Directory does not look like a session log.", { path: real });
  }
  return real;
}

/** Ba seam mà lõi xoá phiên cần — tách khỏi Cordis để test được bằng đối tượng thuần. */
export interface SessionDeleteDeps {
  /** Seam lưu trữ phiên (bắt buộc để biết gốc và sự tồn tại). */
  readonly persistence?: PersistenceSeam;
  /** Sổ Agent đang chạy (chặn xoá phiên đang có lượt chạy). */
  readonly agents?: AgentsSeam;
  /** Chỉ mục tìm kiếm phiên (gọi để đối soát sau khi xoá). */
  readonly sessionQuery?: SessionQuerySeam;
}

/**
 * Lõi xoá phiên: kiểm id, chặn phiên đang sống, dò + kiểm đường dẫn, gỡ thư mục, rồi đối soát chỉ mục.
 * Nhận: deps — ba seam; request — { sessionId }.
 * Trả: { deleted: true, path } với đường dẫn tuyệt đối đã gỡ.
 * Ném: RemoteError với các mã đã khai trong types.ts.
 */
export async function deleteStoredSession(deps: SessionDeleteDeps, request: SessionDeleteRequest): Promise<SessionDeleteResult> {
  const id = requireSafeId(request?.sessionId);
  // Chỉ chặn khi phiên ĐANG CHẠY THẬT: `agents.get(id)` trả Agent ngay khi phiên được nạp (mở phiên là có),
  // nên điều kiện đúng là `status === "running"` — cùng phép đo mà `session/list` dùng để báo `running`.
  // (Đo 01/11/2026: phiên vừa xem có agentAvailable=true nhưng running=false, xoá vẫn bị chặn sai.)
  if (deps.agents?.get(id)?.status === "running") {
    throw new RemoteError("session/delete-live", "This session has a running turn; stop it before deleting.", { sessionId: id });
  }
  const persistence = deps.persistence;
  if (persistence === undefined) {
    throw new RemoteError("session/delete-unavailable", "Session storage is not mounted.", { sessionId: id });
  }
  const snapshot = await persistence.stat(id).catch(() => undefined);
  if (snapshot === undefined) {
    throw new RemoteError("session/delete-not-found", "Session not found: " + id, { sessionId: id });
  }
  const root = persistence.root;
  if (typeof root !== "string" || root === "") {
    throw new RemoteError("session/delete-unavailable", "Session storage root is not exposed by the backend.", { sessionId: id });
  }
  const candidates = await findSessionDirs(root, id);
  if (candidates.length === 0) {
    throw new RemoteError("session/delete-not-found", "Session log directory not found: " + id, { sessionId: id });
  }
  if (candidates.length > 1) {
    throw new RemoteError("session/delete-ambiguous", "Several log directories match this session id.", { sessionId: id, count: candidates.length });
  }
  const target = await verifySessionDir(candidates[0] as string, root, id);
  try {
    await rm(target, { recursive: true, force: false });
  } catch (error) {
    throw new RemoteError("session/delete-failed", "Could not remove the session log: " + String(error), { sessionId: id });
  }
  // Đối soát chỉ mục: bộ đếm SQLite tự gỡ dòng đã mất tệp ở lượt listSessions() kế tiếp.
  await deps.sessionQuery?.listSessions?.().catch(() => undefined);
  return { deleted: true, path: target };
}

/**
 * Dịch vụ `sessionDelete`: xoá vĩnh viễn nhật ký một phiên đã lưu. Không đánh thức Agent, không đọc
 * lịch sử phiên; chỉ chặn khi phiên còn sống trong tiến trình này.
 */
export class SessionDeleteService extends TypertRemoteService {
  /** Hai seam phải sẵn sàng trước khi dịch vụ thức dậy. */
  static inject = ["sessionPersistence", "agents"];

  /**
   * Đăng ký dịch vụ dưới khoá Cordis `sessionDelete` (namespace Remote cùng tên).
   * Nhận: ctx — Context sở hữu plugin.
   * Trả: thể hiện dịch vụ đã cài.
   */
  constructor(ctx: Context) {
    super(ctx, "sessionDelete");
  }

  /**
   * Xoá vĩnh viễn một phiên đã lưu.
   * Nhận: request — { sessionId }.
   * Trả: { deleted: true, path } với đường dẫn tuyệt đối đã gỡ.
   * Ném: RemoteError `session/delete-live` (phiên đang sống), `session/delete-not-found`,
   *   `session/delete-unavailable` (thiếu gốc lưu trữ), `session/delete-ambiguous` (nhiều thư mục khớp),
   *   `session/delete-unsafe` (ra ngoài gốc / không giống nhật ký), `session/delete-failed`.
   */
  @Remote("delete")
  async delete(request: SessionDeleteRequest): Promise<SessionDeleteResult> {
    return await deleteStoredSession({
      persistence: this.ctx.get("sessionPersistence") as PersistenceSeam | undefined,
      agents: this.ctx.get("agents") as AgentsSeam | undefined,
      sessionQuery: this.ctx.get("sessionQuery") as SessionQuerySeam | undefined,
    }, request);
  }
}

export default SessionDeleteService;
