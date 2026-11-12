/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/run-tree.js' (56 dòng) của @deepseek-ai/dsh-plugin-manager: chờ cây tiến trình của
 *      MỘT lượt chạy package biến mất trước khi bên gọi chạm vào profile — leadsOwnGroup + treeAlive +
 *      awaitTreeGone, giữ nguyên hai hằng chờ (TREE_WAIT_MS 5_000, TREE_POLL_MS 15).
 */

/** Thời gian tối đa một cây đã bị kết liễu được phép tồn tại trước khi bên gọi thôi chờ. */
const TREE_WAIT_MS = 5_000;
/** Nhịp thăm dò trong lúc chờ một cây đã bị kết liễu biến mất. */
const TREE_POLL_MS = 15;

/** Tiến trình (hoặc nhóm tiến trình) mà một lượt chạy chiếm. */
export interface RunTree {
  /** PID của lượt chạy, khi lần spawn đã công bố nó. */
  pid: number | undefined;
  /** Lượt chạy có dẫn đầu nhóm tiến trình của chính nó không — thứ mà phép thăm dò nhóm POSIX nhắm tới. */
  grouped: boolean;
}

/** Các phép xử lý tiến trình TIÊM ĐƯỢC, để mọi nền tảng đều kiểm thử được trên bất kỳ host nào. */
export interface RunTreeInternals {
  /** Nền tảng host ghi đè cho các quyết định nhắm mục tiêu. */
  platform?: NodeJS.Platform;
  /** Phép thăm dò sống/chết ghi đè, mặc định `process.kill(target, 0)`. */
  alive?: (target: number) => boolean;
  /** Giới hạn chờ ghi đè, mặc định là hằng chờ của cây. */
  waitMs?: number;
}

/**
 * Một lượt chạy có dẫn đầu nhóm tiến trình của chính nó không — nhóm là mục tiêu mà phép thăm dò sống/chết
 * POSIX nhắm tới cho CẢ cây. Lượt chạy thu giữ output được spawn làm leader nhóm riêng, vì cây của nó bị kết
 * liễu như một khối; lượt chạy thừa hưởng descriptor của bên gọi thì giữ nhóm của bên gọi, nên một lần ngắt
 * vẫn tới được nó.
 * Nhận: `execution` — lượt chạy thu giữ output hay thừa hưởng descriptor của bên gọi; `platform` — nền tảng
 * host quyết định cách nhắm tới một cây.
 * Trả: true khi lượt chạy dẫn đầu nhóm tiến trình của chính nó.
 */
export function leadsOwnGroup(execution: "cli" | "service", platform: NodeJS.Platform = process.platform): boolean {
  return execution === "service" && platform !== "win32";
}

/**
 * Mục tiêu mà phép thăm dò cây nhắm tới: nhóm POSIX khi lượt chạy dẫn đầu một nhóm, ngược lại là chính tiến trình.
 * Nhận: `pid` — PID của lượt chạy; `grouped` — lượt chạy có dẫn đầu nhóm riêng không; `platform` — nền tảng host.
 * Trả: số mục tiêu (âm là nhóm, dương là tiến trình) đưa cho phép thăm dò sống/chết.
 */
function targetOf(pid: number, grouped: boolean, platform: NodeJS.Platform): number {
  return platform !== "win32" && grouped ? -pid : pid;
}

/**
 * Có thành viên nào của cây một lượt chạy còn sống không.
 * Nhận: `tree` — PID của lượt chạy và việc nó có dẫn đầu nhóm riêng không; `internals` — các phép tiến trình
 * tiêm được (`platform`, `alive`, `waitMs`).
 * Trả: true khi phép thăm dò còn thấy tiến trình hoặc một thành viên của nhóm; false khi `pid` vắng mặt hoặc
 * phép thăm dò ném (tiến trình đã biến mất).
 * @throws không ném — lỗi của phép thăm dò được nuốt và hiểu là "đã biến mất".
 */
export function treeAlive(tree: RunTree, internals: RunTreeInternals = {}): boolean {
  const pid = tree.pid;
  if (pid === undefined) return false;
  const platform = internals.platform ?? process.platform;
  const alive = internals.alive ?? ((target: number): boolean => {
    process.kill(target, 0);
    return true;
  });
  try {
    return alive(targetOf(pid, tree.grouped, platform));
  } catch {
    return false;
  }
}

/**
 * Chờ tới khi cây của một lượt chạy đã bị kết liễu biến mất, để bên gọi chỉ phục hồi và mở khoá profile SAU khi
 * các script nó khởi động đã thôi ghi.
 * Nhận: `tree` — PID của lượt chạy và việc nó có dẫn đầu nhóm riêng không; `internals` — các phép tiến trình
 * tiêm được (`platform`, `alive`, `waitMs`).
 * Trả: promise hoàn tất khi không còn thành viên nào, hoặc khi giới hạn chờ đã hết.
 * @throws không ném — mọi lỗi của phép thăm dò đều thành "đã biến mất" qua `treeAlive`.
 */
export async function awaitTreeGone(tree: RunTree, internals: RunTreeInternals = {}): Promise<void> {
  const deadline = Date.now() + (internals.waitMs ?? TREE_WAIT_MS);
  while (treeAlive(tree, internals)) {
    if (Date.now() >= deadline) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, TREE_POLL_MS);
    });
  }
}
