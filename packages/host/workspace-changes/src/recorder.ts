/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bản viết lại 1:1 recorder.js của @deepseek-ai/dsh-workspace-changes: TurnRecorder ghi nhận thay đổi tệp theo lượt bằng snapshot git và capture toàn tệp.
 */

import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { captureFile, sameCapture } from "./capture.ts";
import { compareText } from "./compare.ts";
import {
  blobText,
  diffTrees,
  gitlinkPaths,
  ignoredPaths,
  locateGitWorkspace,
  snapshotTree,
  treeBlob,
} from "./git.ts";
import {
  canonicalPath,
  compareDisplay,
  displayPathOf,
  durablePathOf,
  isInside,
  isTemporaryPath,
  temporaryRoots,
  toPosix,
} from "./paths.ts";
import type { WorkspaceChangesSummary, WorkspaceFileDiff } from "./types.ts";

/**
 * Phiên đang sống, khai theo CẤU TRÚC: chỉ đúng một đường ghi mà recorder dùng.
 * Sự kiện được nêu cụ thể để `Session` thật (với `SessionEventMap` đã được mặt
 * ./types mở rộng) gán được vào đây mà không phải import kiểu của @deepseek-ai.
 */
interface RecorderSession {
  /**
   * Nối sự kiện `workspace/changes` vào nhật ký phiên.
   * Nhận: loại sự kiện và thân mang số lượt.
   * Trả: sự kiện đã cam kết, mang số thứ tự `seq`.
   */
  append(type: "workspace/changes", data: { turn: number }): { readonly seq: number };
}

/** Sự kiện `tool/result` đã cam kết, khai theo CẤU TRÚC: chỉ hai trường mà recorder đọc. */
interface ToolResultEvent {
  /** Vị trí sự kiện trong log. */
  readonly seq: number;
  /** Thân sự kiện; recorder chỉ đọc số lượt. */
  readonly data: { readonly turn: number };
}

/** Đường dẫn chuẩn của phiên: thư mục làm việc, home, và các gốc tạm. */
interface CanonicalPaths {
  /** Thư mục làm việc của phiên, đã giải symlink. */
  cwd: string;
  /** Thư mục home, đã chuẩn hoá. */
  home: string;
  /** Các gốc thư mục tạm mà sandbox workspace-write cấp. */
  temporaryRoots: string[];
}

/** Bộ chạy git, suy ra từ chữ ký của `snapshotTree` để không phụ thuộc tên kiểu của module git. */
type GitRunner = Parameters<typeof snapshotTree>[0];

/** Kho chứa đã định vị, suy ra từ `locateGitWorkspace`. */
type GitWorkspace = NonNullable<Awaited<ReturnType<typeof locateGitWorkspace>>>;

/** Kho chứa kèm bộ chạy git dùng để chạm vào nó. */
interface Repository {
  /** Bộ chạy git. */
  git: GitRunner;
  /** Kho chứa đã định vị. */
  workspace: GitWorkspace;
}

/** Một phía đã capture, suy ra từ `captureFile`. */
type Capture = NonNullable<Awaited<ReturnType<typeof captureFile>>>;

/** Một dòng numstat giữa hai snapshot, suy ra từ `diffTrees`. */
type TreeEntry = Awaited<ReturnType<typeof diffTrees>>[number];

/** Một tệp đã đổi trong lượt, lấy đúng kiểu từ mặt `./types`. */
type ChangedFile = WorkspaceChangesSummary["files"][number];

/** Một phía của phép so sánh: không có tệp, bản sao đã lưu, hoặc blob trong snapshot. */
type FileSide =
  | { readonly kind: "absent" }
  | { readonly kind: "file"; readonly file: string }
  | {
      readonly kind: "snapshot";
      readonly repository: Repository;
      readonly tree: string;
      readonly path: string;
    };

/** Nguồn của một dòng trong summary: từ chối so sánh, hoặc hai phía để so sánh. */
type ChangeSource =
  | { readonly refusal: "binary" | "oversized" }
  | { readonly before: FileSide; readonly after: FileSide };

/** Một dòng đã liệt kê: tệp hiển thị kèm nguồn so sánh của nó. */
interface ListedEntry {
  /** Tệp đã đổi. */
  file: ChangedFile;
  /** Nguồn so sánh tương ứng. */
  sources: ChangeSource;
}

/** Baseline của lượt: snapshot đầu lượt, `failed` khi snapshot lỗi, hoặc null khi không có kho chứa. */
interface SnapshotBaseline {
  /** Bộ chạy git. */
  git: GitRunner;
  /** Kho chứa đã định vị. */
  workspace: GitWorkspace;
  /** Id cây snapshot đầu lượt. */
  tree: string;
}

/** Trạng thái riêng của một lượt. */
interface TurnState {
  /** Số lượt. */
  turn: number;
  /** Baseline đầu lượt; null khi lượt chưa chụp hoặc không có kho chứa. */
  baseline: SnapshotBaseline | "failed" | null;
  /** Bản capture đầu tiên của từng đường dẫn tuyệt đối trong lượt. */
  captures: Map<string, Capture>;
  /** Số thứ tự của `tool/result` cuối cùng thuộc lượt, -1 khi chưa có. */
  lastToolResultSeq: number;
  /** Số thứ tự cuối cùng mà một lần ghi đã thử phủ, -1 khi chưa thử. */
  attemptedAfterSeq: number;
  /** Số thứ tự của sự kiện `workspace/changes` đã ghi trong lượt, -1 khi chưa ghi. */
  recordedAfterSeq: number;
}

/** Bản ghi giữ lại cho một sự kiện `workspace/changes`. */
interface RecorderRecord {
  /** Summary đã phát. */
  summary: WorkspaceChangesSummary;
  /** Nguồn so sánh theo đúng chỉ số của `summary.files`. */
  sources: ChangeSource[];
}

/** Số dòng cộng/trừ của một tệp; cờ binary/oversized quyết định việc từ chối so sánh. */
interface ChangeCounts {
  /** Số dòng thêm. */
  added: number;
  /** Số dòng xoá. */
  deleted: number;
  /** Git báo tệp nhị phân. */
  binary?: boolean;
  /** Một phía vượt trần byte. */
  oversized?: boolean;
}

/** Một phía snapshot vượt trần byte. */
const OVERSIZED = Symbol("oversized");

/**
 * Dựng trạng thái rỗng cho một lượt.
 * Nhận: số lượt.
 * Trả: trạng thái lượt với baseline null, chưa capture và chưa ghi gì.
 */
function freshState(turn: number): TurnState {
  return {
    turn,
    baseline: null,
    captures: new Map(),
    lastToolResultSeq: -1,
    attemptedAfterSeq: -1,
    recordedAfterSeq: -1,
  };
}

/** Các fact dùng chung cho mọi recorder của một thể hiện plugin. */
export interface RecorderEnvironment {
  /** Phân giải ra bộ chạy git, hoặc null khi không có git và không chụp snapshot. */
  git: Promise<GitRunner | null>;
  /** Thư mục nhận thư mục tạm của từng phiên. */
  tempRoot: string;
  /** Số tệp tối đa mang trong một summary. */
  maxFiles: number;
  /** Trần byte bao gồm cho một bản capture và cho một blob snapshot đọc để so sánh. */
  maxFileBytes: number;
  /** Số mili giây phép so sánh dòng chạy trước khi hạ xuống thay-thế-toàn-tệp. */
  diffTimeoutMs: number;
  /** Báo lỗi; lượt hỏng không ghi gì và lượt sau thử lại. */
  warn: (message: string) => void;
}

/**
 * Tuần tự hoá việc ghi nhận của một phiên: snapshot đầu lượt, capture toàn tệp
 * trước mỗi lần tool tệp sửa, snapshot cuối lượt kèm diff, và sự kiện
 * `workspace/changes` được nối vào log cùng summary và các phép so sánh mà
 * recorder giữ lại. Đối tượng snapshot và bản capture nằm trong thư mục tạm do
 * recorder sở hữu; dispose xoá cả thư mục lẫn các summary. Việc chạy tool chờ
 * công việc đang xếp hàng nên snapshot/capture không bao giờ đua với thao tác
 * sửa. Thư mục làm việc ngoài mọi kho chứa, hoặc máy chủ không có git, thì
 * không có snapshot; summary của nó liệt kê các tệp mà tool tệp đã đổi.
 *
 * Nhận: phiên đang sống, thư mục làm việc của phiên, và môi trường dùng chung.
 * Trả: thể hiện TurnRecorder dùng cho toàn vòng đời của một phiên.
 */
export class TurnRecorder {
  /** Phiên nhận các sự kiện `workspace/changes`. */
  private readonly session: RecorderSession;
  /** Thư mục làm việc của phiên. */
  private readonly cwd: string;
  /** Môi trường dùng chung của plugin. */
  private readonly env: RecorderEnvironment;
  /** Chuỗi công việc nối tiếp; mọi snapshot, capture và lần ghi đều xếp sau nó. */
  private chain: Promise<void> = Promise.resolve();
  /** Lượt đang mở; trước `turn/start` đầu tiên là placeholder rỗng mà không sự kiện nào khớp. */
  private state: TurnState = freshState(0);
  /** Đường dẫn chuẩn, phân giải ở lượt đầu. */
  private paths?: CanonicalPaths;
  /** Kho chứa đã định vị, dùng lại qua các lượt một khi tìm thấy; null thì lượt nào cũng thử lại. */
  private repository: Repository | null = null;
  /** Thư mục tạm giữ đối tượng snapshot, index nháp và bản capture của phiên này. */
  private scratch?: Promise<string>;
  /** Bản ghi theo số thứ tự của sự kiện đã công bố chúng. */
  private readonly records = new Map<number, RecorderRecord>();
  /** Cờ sống/chết của recorder; abort khi dispose. */
  private readonly lifetime = new AbortController();

  /**
   * Khởi tạo recorder cho một phiên.
   * Nhận: phiên đang sống, thư mục làm việc của phiên, và môi trường dùng chung.
   * Trả: thể hiện TurnRecorder chưa chụp gì.
   */
  constructor(session: RecorderSession, cwd: string, env: RecorderEnvironment) {
    this.session = session;
    this.cwd = cwd;
    this.env = env;
  }

  /**
   * Mở một lượt với trạng thái mới và xếp hàng snapshot baseline của nó.
   * Nhận: số lượt từ `turn/start`.
   * Trả: không; snapshot chạy nền theo chuỗi công việc.
   */
  start(turn: number): void {
    const state = freshState(turn);
    this.state = state;
    void this.enqueue(async (signal: AbortSignal): Promise<void> => {
      try {
        const paths = (this.paths ??= {
          cwd: await realpath(this.cwd),
          home: await canonicalPath(homedir()),
          temporaryRoots: await temporaryRoots(),
        });
        const repository = await this.locate(paths.cwd, signal);
        if (repository === null) return;
        const tree = await snapshotTree(repository.git, repository.workspace, signal);
        state.baseline = { ...repository, tree };
      } catch (error) {
        // Kho chứa chụp snapshot lỗi không được tóm tắt như thể nó không có snapshot.
        state.baseline = "failed";
        throw error;
      }
    });
  }

  /**
   * Xếp hàng capture đường dẫn mà một tool tệp sắp sửa, trước khi tool chạy;
   * chỉ lần sửa đầu tiên của một đường dẫn trong lượt mới capture nó. Chờ
   * `settled` sau đó để tool không vượt qua capture.
   * Nhận: đường dẫn tuyệt đối (đường dẫn tiến trình) của đích sửa đã phân giải.
   * Trả: không; capture chạy nền theo chuỗi công việc.
   */
  capture(path: string): void {
    const state = this.state;
    void this.enqueue(async (): Promise<void> => {
      const paths = this.paths;
      if (paths === undefined) return;
      const absolute = await canonicalPath(path);
      if (state.captures.has(absolute)) return;
      const capture = await captureFile(
        absolute,
        join(await this.scratchDir(), "captures"),
        this.env.maxFileBytes,
      );
      if (capture !== undefined) state.captures.set(absolute, capture);
    });
  }

  /**
   * Ghi nhớ một kết quả tool đã chốt, để lần ghi sau `turn/end` phủ được nó.
   * Nhận: sự kiện `tool/result` đã nối vào log.
   * Trả: không.
   */
  observe(event: ToolResultEvent): void {
    const state = this.state;
    if (event.data.turn === state.turn) state.lastToolResultSeq = event.seq;
  }

  /**
   * Ghi thay đổi của lượt ngay trong lượt, trước khi `turn/end` cam kết.
   * Nhận: lượt đang dừng.
   * Trả: phân giải sau khi sự kiện được nối hoặc lần thử thất bại.
   */
  stopping(turn: number): Promise<void> {
    const state = this.state;
    if (turn !== state.turn) return Promise.resolve();
    return this.enqueue((signal: AbortSignal) => this.record(state, signal));
  }

  /**
   * Ghi sau `turn/end` trừ khi đã có lần ghi thử sau kết quả tool cuối của lượt.
   * Nhận: số lượt từ `turn/end`.
   * Trả: không; lần ghi chạy nền theo chuỗi công việc.
   */
  end(turn: number): void {
    const state = this.state;
    if (turn !== state.turn || state.attemptedAfterSeq >= state.lastToolResultSeq) return;
    void this.enqueue((signal: AbortSignal) => this.record(state, signal));
  }

  /**
   * Chờ mọi snapshot, capture và lần ghi đã xếp hàng chốt xong.
   * Nhận: không.
   * Trả: phân giải khi chuỗi công việc rỗng.
   */
  settled(): Promise<void> {
    return this.chain;
  }

  /**
   * Summary mà một sự kiện `workspace/changes` của phiên này đã công bố.
   * Nhận: số thứ tự của sự kiện.
   * Trả: summary, hoặc undefined với số thứ tự mà recorder này không công bố.
   */
  summary(seq: number): WorkspaceChangesSummary | undefined {
    return this.records.get(seq)?.summary;
  }

  /**
   * So sánh nội dung một tệp trong danh sách giữa đầu lượt và cuối lượt.
   * Nhận: số thứ tự của sự kiện công bố, chỉ số của tệp trong `files` của summary, và tín hiệu huỷ đọc.
   * Trả: phép so sánh, hoặc undefined khi số thứ tự/chỉ số không biết hoặc recorder đã dispose.
   * @throws khi một lần đọc lỗi trong lúc recorder còn sống.
   */
  async diff(seq: number, index: number, signal: AbortSignal): Promise<WorkspaceFileDiff | undefined> {
    const record = this.records.get(seq);
    const file = record?.summary.files[index];
    const sources = record?.sources[index];
    if (file === undefined || sources === undefined) return undefined;
    const { path, display } = file;
    if ("refusal" in sources) return { kind: sources.refusal, path, display };
    const combined = AbortSignal.any([signal, this.lifetime.signal]);
    try {
      const [before, after] = await Promise.all([
        this.readSide(sources.before, combined),
        this.readSide(sources.after, combined),
      ]);
      if (before === OVERSIZED || after === OVERSIZED) return { kind: "oversized", path, display };
      const { hunks, coarse } = compareText(before, after, this.env.diffTimeoutMs);
      return { kind: "text", path, display, before: before !== null, after: after !== null, hunks, coarse };
    } catch (error) {
      // Dispose xoá thư mục tạm dưới một lần đọc đang chạy; phiên đằng nào cũng đã mất.
      if (this.lifetime.signal.aborted) return undefined;
      throw error;
    }
  }

  /**
   * Huỷ công việc đang xếp hàng, quên mọi bản ghi, và xoá thư mục tạm.
   * Nhận: không.
   * Trả: phân giải khi thư mục tạm đã biến mất.
   */
  async dispose(): Promise<void> {
    this.lifetime.abort();
    this.records.clear();
    await this.chain;
    if (this.scratch !== undefined) await rm(await this.scratch, { recursive: true, force: true });
  }

  /**
   * Nối một việc vào chuỗi công việc và bắt lỗi của nó.
   * Nhận: hàm nhận tín hiệu huỷ của recorder.
   * Trả: phân giải khi việc chạy xong (kể cả khi việc ném lỗi).
   */
  private enqueue(task: (signal: AbortSignal) => Promise<void>): Promise<void> {
    const run = this.chain.then(async (): Promise<void> => {
      if (this.lifetime.signal.aborted) return;
      try {
        await task(this.lifetime.signal);
      } catch (error) {
        this.warnUnlessDisposed(error);
      }
    });
    this.chain = run;
    return run;
  }

  /**
   * Báo lỗi trừ khi recorder đã dispose; lỗi sau dispose là huỷ dự kiến nên im lặng.
   * Nhận: lỗi bắt được.
   * Trả: không.
   */
  private warnUnlessDisposed(error: unknown): void {
    if (!this.lifetime.signal.aborted) this.env.warn(`workspace-changes: ${String(error)}`);
  }

  /**
   * Thư mục tạm của phiên này, tạo ở lần dùng đầu.
   * Nhận: không.
   * Trả: promise của đường dẫn thư mục tạm.
   */
  private scratchDir(): Promise<string> {
    this.scratch ??= mkdtemp(join(this.env.tempRoot, "dsh-workspace-changes-"));
    return this.scratch;
  }

  /**
   * Kho chứa bao quanh thư mục làm việc, định vị một lần; null thì lượt sau thử lại.
   * Nhận: thư mục làm việc đã chuẩn hoá và tín hiệu huỷ.
   * Trả: kho chứa kèm bộ chạy git, hoặc null khi không có git/kho chứa.
   */
  private async locate(cwd: string, signal: AbortSignal): Promise<Repository | null> {
    if (this.repository !== null) return this.repository;
    const git = await this.env.git;
    if (git === null) return null;
    const workspace = await locateGitWorkspace(git, cwd, () => this.scratchDir(), signal);
    if (workspace === null) return null;
    this.repository = { git, workspace };
    return this.repository;
  }

  /**
   * Nội dung một phía: null khi tệp vắng mặt, hoặc `OVERSIZED` khi phía snapshot vượt trần byte.
   * Nhận: phía cần đọc và tín hiệu huỷ.
   * Trả: văn bản, null, hoặc symbol `OVERSIZED`.
   */
  private async readSide(source: FileSide, signal: AbortSignal): Promise<string | null | typeof OVERSIZED> {
    switch (source.kind) {
      case "absent":
        return null;
      case "file":
        return readFile(source.file, { encoding: "utf8", signal });
      case "snapshot": {
        const { git, workspace } = source.repository;
        const blob = await treeBlob(git, workspace, source.tree, source.path, signal);
        if (blob === null) return null;
        if (blob.size > this.env.maxFileBytes) return OVERSIZED;
        return blobText(git, workspace, blob.oid, this.env.maxFileBytes, signal);
      }
    }
  }

  /**
   * Chụp cuối lượt, so với baseline, và nối sự kiện `workspace/changes` kèm bản ghi.
   * Nhận: trạng thái lượt và tín hiệu huỷ.
   * Trả: phân giải sau khi ghi xong hoặc bỏ qua vì thiếu điều kiện.
   */
  private async record(state: TurnState, signal: AbortSignal): Promise<void> {
    const paths = this.paths;
    const { baseline } = state;
    if (paths === undefined || baseline === "failed" || state.lastToolResultSeq < 0) return;
    state.attemptedAfterSeq = state.lastToolResultSeq;
    // Không có snapshot thì chính thư mục làm việc là biên của workspace.
    const root = baseline?.workspace.root ?? paths.cwd;
    const listed = new Map<string, ListedEntry>();
    let snapshot: { before: string; after: string } | undefined;
    if (baseline !== null) {
      const after = await snapshotTree(baseline.git, baseline.workspace, signal);
      snapshot = { before: baseline.tree, after };
      const repository: Repository = { git: baseline.git, workspace: baseline.workspace };
      for (const entry of await diffTrees(baseline.git, baseline.workspace, baseline.tree, after, signal)) {
        const absolute = resolve(root, entry.path);
        listed.set(absolute, {
          file: changedFile(paths, root, absolute, entry),
          sources: entry.binary
            ? { refusal: "binary" }
            : {
                before: { kind: "snapshot", repository, tree: baseline.tree, path: entry.oldPath ?? entry.path },
                after: { kind: "snapshot", repository, tree: after, path: entry.path },
              },
        });
      }
    }
    // Các đường dẫn đã capture mà snapshot không phủ được thì so bằng bản sao của chúng.
    const captured = [...state.captures.keys()].filter((absolute) => !listed.has(absolute));
    const workTreePath = (absolute: string): string => toPosix(relative(root, absolute));
    let inWorkspace = captured.filter((absolute) => isInside(root, absolute));
    if (baseline !== null && inWorkspace.length > 0) {
      // Kho chứa lồng nhau và submodule là gitlink: nội dung của chúng không bao giờ vào summary.
      const gitlinks = await gitlinkPaths(baseline.git, baseline.workspace, signal);
      inWorkspace = inWorkspace.filter(
        (absolute) => ![...gitlinks].some((link) => isInside(resolve(root, link), absolute)),
      );
    }
    // Snapshot phủ mọi tệp workspace trừ tệp bị ignore; không có snapshot thì mọi lần sửa đều tính.
    const uncoveredInWorkspace =
      baseline === null
        ? new Set(inWorkspace.map(workTreePath))
        : await ignoredPaths(baseline.git, baseline.workspace, inWorkspace.map(workTreePath), signal);
    for (const absolute of captured) {
      // Ngoài workspace, tệp nháp dưới một gốc tạm bị loại.
      const uncovered = isInside(root, absolute)
        ? uncoveredInWorkspace.has(workTreePath(absolute))
        : !isTemporaryPath(absolute, paths.temporaryRoots);
      if (!uncovered) continue;
      // Vòng lặp đi đúng các khoá vừa lấy từ captures nên phía trước chắc chắn tồn tại.
      const before = state.captures.get(absolute)!;
      const after = await captureFile(absolute, join(await this.scratchDir(), "captures"), this.env.maxFileBytes);
      if (after === undefined || sameCapture(before, after)) continue;
      listed.set(absolute, await this.compared(paths, root, absolute, before, after));
    }
    const sorted = [...listed.values()].sort((a, b) => compareDisplay(a.file, b.file));
    // Danh sách rỗng sau một lần ghi trong lượt thay thế lần ghi ấy.
    if (sorted.length === 0 && state.recordedAfterSeq < 0) return;
    const event = this.session.append("workspace/changes", { turn: state.turn });
    const kept = sorted.slice(0, this.env.maxFiles);
    this.records.set(event.seq, {
      summary: {
        turn: state.turn,
        cwd: this.cwd,
        files: kept.map((entry) => entry.file),
        total: sorted.length,
        added: sorted.reduce((sum, entry) => sum + entry.file.added, 0),
        deleted: sorted.reduce((sum, entry) => sum + entry.file.deleted, 0),
        ...(snapshot === undefined ? {} : { snapshot }),
      },
      sources: kept.map((entry) => entry.sources),
    });
    state.recordedAfterSeq = event.seq;
  }

  /**
   * Liệt kê một cặp đã capture: phía quá cỡ liệt kê tệp không kèm số dòng và từ
   * chối so sánh, phía nhị phân cũng vậy, hai phía văn bản mang số dòng của phép
   * so sánh theo dòng.
   * Nhận: đường dẫn chuẩn của phiên, gốc workspace, đường dẫn tuyệt đối, và hai bản capture trước/sau.
   * Trả: dòng đã liệt kê kèm nguồn so sánh.
   */
  private async compared(
    paths: CanonicalPaths,
    root: string,
    absolute: string,
    before: Capture,
    after: Capture,
  ): Promise<ListedEntry> {
    const list = (counts: ChangeCounts, sources: ChangeSource): ListedEntry => ({
      file: changedFile(paths, root, absolute, counts),
      sources,
    });
    if (before.kind === "oversized" || after.kind === "oversized") {
      return list({ added: 0, deleted: 0, binary: false, oversized: true }, { refusal: "oversized" });
    }
    if (isBinary(before) || isBinary(after)) {
      return list({ added: 0, deleted: 0, binary: true }, { refusal: "binary" });
    }
    const text = async (side: Capture): Promise<string | null> =>
      side.kind === "file" ? readFile(side.file, "utf8") : null;
    const { added, deleted } = compareText(await text(before), await text(after), this.env.diffTimeoutMs);
    return list({ added, deleted, binary: false }, { before, after });
  }
}

/**
 * Cho biết một phía đã capture có nội dung nhị phân hay không.
 * Nhận: bản capture của một phía.
 * Trả: true khi đó là tệp và được đánh dấu nhị phân.
 */
function isBinary(capture: Capture): boolean {
  return capture.kind === "file" && capture.binary;
}

/**
 * Dựng dòng mô tả một tệp đã đổi từ đường dẫn tuyệt đối và số dòng.
 * Nhận: đường dẫn chuẩn của phiên (cwd + home), gốc workspace, đường dẫn tuyệt đối, và số dòng.
 * Trả: tệp đã đổi với `path`, `display` và cờ binary/oversized khi có.
 */
function changedFile(
  { cwd, home }: Pick<CanonicalPaths, "cwd" | "home">,
  root: string,
  absolute: string,
  counts: ChangeCounts,
): ChangedFile {
  return {
    path: durablePathOf(absolute, cwd),
    display: displayPathOf(absolute, cwd, root, home),
    added: counts.added,
    deleted: counts.deleted,
    ...(counts.binary ? { binary: true } : {}),
    ...(counts.oversized === true ? { oversized: true } : {}),
  };
}
