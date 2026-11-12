/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Theo doi CHINH XAC mot tep patch cua profile (ke ca cha chua ton tai), khong dang ky anh em.
 */
import { realpath, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { watch } from "chokidar";
import { type ChokidarOptions } from "chokidar";

/** Context toi thieu ma watcher can: ghi canh bao va so huu disposer. */
export interface WatchContext {
  /** Logger cua kernel — chi dung `warn`, y ban goc. */
  readonly logger: { warn(...args: unknown[]): void };
  /**
   * Dang ky mot hieu ung co the don: cordis goi ham tra ve khi context bi huy.
   * @param effect - ham tra ve disposer.
   * @param label - nhan hieu ung (ban goc dung `"hmr.watchConfig()"`).
   */
  effect(effect: () => () => Promise<void>, label: string): () => Promise<void>;
}

/** Duong dan da giai that + goc watch + do sau can theo doi. */
interface WatchRoot {
  /** Duong dan tuyet doi cua tep, da o dang that. */
  filename: string;
  /** Thu muc goc that su ton tai. */
  root: string;
  /** Do sau tu goc toi tep. */
  depth: number;
}

/** Moi context mot tap duong dan da dang ky — chan dang ky trung. */
const registrations = new WeakMap<WatchContext, Set<string>>();

/**
 * Tim thu muc goc CON TON TAI gan nhat cua mot tep, va do sau tu goc do toi tep.
 * @param filename - duong dan tep (co the chua ton tai).
 * @returns Goc that su + duong dan da chuan hoa + do sau.
 * @throws Khi gap loi he thong khac ENOENT, hoac khi len toi goc dia ma van khong thay.
 */
async function findWatchRoot(filename: string): Promise<WatchRoot> {
  let root = dirname(filename);
  let depth = 0;
  while (true) {
    try {
      if (!(await stat(root)).isDirectory()) throw new Error(`config watch parent is not a directory: ${root}`);
      const canonicalRoot = await realpath(root);
      return { filename: resolve(canonicalRoot, relative(root, filename)), root: canonicalRoot, depth };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(root);
      if (parent === root) throw error;
      root = parent;
      depth += 1;
    }
  }
}

/**
 * Theo doi MOT duong dan patch va chuoi cha cua no, khong dang ky tep/anh em cung thu muc.
 * Cha chua ton tai duoc theo doi luc xuat hien; callback refresh chay TUAN TU (khong chong nhau).
 * @param ctx - context so huu disposer va nhan loi refresh.
 * @param filename - duong dan tuyet doi cua tep patch.
 * @param options - tuy chon watcher cua deployment (watch cau hinh bat on dinh ghi mac dinh).
 * @param refresh - callback cho add/change/unlink.
 * @param inTransaction - dang don dep trong chinh luot refresh bi go hay khong.
 * @returns Disposer dong watcher va doi luot refresh dang chay.
 * @throws Khi giai duong dan, khoi dong watcher, hoac dang ky hieu ung that bai.
 */
export async function watchConfig(
  ctx: WatchContext,
  filename: string,
  options: ChokidarOptions,
  refresh: () => Promise<void>,
  inTransaction: () => boolean = () => false,
): Promise<() => Promise<void>> {
  const target = await findWatchRoot(filename);
  const paths = registrations.get(ctx) ?? new Set<string>();
  registrations.set(ctx, paths);
  if (paths.has(target.filename)) throw new Error(`config path already registered: ${filename}`);
  const { cwd: _cwd, ignored: _ignored, ...watchOptions } = options;
  const watcher = watch(target.root, {
    awaitWriteFinish: true,
    ...watchOptions,
    depth: target.depth,
    ignoreInitial: false,
    ignored: (path: string) => {
      const remainder = relative(resolve(path), target.filename);
      return remainder === ".." || remainder.startsWith(`..${sep}`);
    },
  });
  paths.add(target.filename);
  const state = { dirty: false };
  let running: Promise<void> | undefined;
  const onChange = (path: string) => {
    const observed = resolve(path);
    if (observed !== filename && observed !== target.filename) return;
    state.dirty = true;
    if (running) return;
    running = (async () => {
      while (state.dirty) {
        state.dirty = false;
        try {
          await refresh();
        } catch (reason) {
          const error = reason instanceof Error ? reason : new Error(String(reason), { cause: reason });
          ctx.logger.warn("config reload at %C failed", filename);
          ctx.logger.warn(error);
        }
      }
    })().finally(() => {
      running = undefined;
    });
  };
  watcher.on("add", onChange);
  watcher.on("change", onChange);
  watcher.on("unlink", onChange);
  const ready = Promise.withResolvers<void>();
  let pending = true;
  let disposed = false;
  watcher.once("ready", () => {
    pending = false;
    ready.resolve();
  });
  const onError = (error: unknown) => {
    if (disposed) return;
    if (pending) {
      pending = false;
      ready.reject(error);
    } else ctx.logger.warn(error);
  };
  watcher.on("error", onError);
  const dispose = async () => {
    disposed = true;
    const closing = watcher.close();
    watcher.on("error", onError);
    await closing;
    paths.delete(target.filename);
    if (!inTransaction()) await running;
  };
  try {
    await ready.promise;
    return ctx.effect(() => dispose, "hmr.watchConfig()");
  } catch (error) {
    await dispose();
    throw error;
  }
}
