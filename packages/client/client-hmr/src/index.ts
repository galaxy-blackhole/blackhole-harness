/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua host cua row client-hmr: theo doi bundle cua moi row bang stat poll, bao build lai qua clientModules.rebuilt, va mo kenh SSE /plugins/events cho nua browser.
 */

import { statSync } from "node:fs";

import z from "@deepseek-ai/schemastery";

import { sseData } from "./frames.ts";
import { EVENTS_ENDPOINT, type BundleStat } from "./ids.ts";

export { EVENTS_ENDPOINT };

/** Cordis plugin name (giu nguyen ten ban goc). */
export const name = "client-hmr";

/** Dich vu bat buoc: do thi client va so dang ky route cua web server. */
export const inject = ["clientModules", "webServer"];

/** Cau hinh cua row; nguong mac dinh 500 ms theo nhip poll cua watcher ben build. */
export interface Config {
  /** Chu ky poll bundle (ms), mac dinh 500. */
  pollIntervalMs?: number;
}

/** Schema kiem tra cau hinh (cung ten voi interface {@link Config}). */
export const Config = z.object({ pollIntervalMs: z.number().step(1).min(1).default(500) });

/** Mot bundle dang duoc theo doi, kem co `dirty` cho lan stat loi. */
interface Watch extends BundleStat {
  /** true khi lan stat truoc do loi (ENOENT) nen phai publish lai. */
  dirty: boolean;
}

/** Phan response toi thieu ma kenh SSE can (khong keo type cua node http vao bundle). */
interface SseResponse {
  /** Ghi header. */
  writeHead(status: number, headers?: Record<string, string>): void;
  /** Ghi mot doan than. */
  write(chunk: string): void;
  /** Ket thuc phan hoi. */
  end(): void;
  /** Dang ky su kien dong ket noi. */
  on(event: "close", handler: () => void): void;
  /** Huy ket noi. */
  destroy(): void;
}

/** Context cordis toi thieu ma row nay dung. */
export interface HmrContext {
  /** Do thi bundle client + thong bao build lai. */
  clientModules: {
    /** Do thi hien tai. */
    graph(): { entries: { id: string }[] };
    /** Chu ky bundle cua mot row, hoac undefined khi row khong co bundle. */
    artifactBaseline(id: string): BundleStat | undefined;
    /** Bao cho tang tren rang bundle cua row vua doi. */
    rebuilt(id: string): void;
    /** Dang ky nhan thay doi do thi. */
    onGraphChanged(handler: () => void): () => void;
    /** Dang ky nhan thong bao build lai. */
    onRebuilt(handler: (id: string, rev: string) => void): () => void;
  };
  /** So dang ky route cua web server. */
  webServer: {
    /** Dang ky mot route tuyet doi; tra ve ham go. */
    register(route: { kind: "exact"; path: string; handler: (req: { method?: string }, res: SseResponse) => void }): () => void;
  };
  /** Dang ky mot hieu ung co the go. */
  effect(callback: () => () => void, label: string): void;
  /** Logger cua cordis. */
  logger: { warn(error: unknown): void };
}

/**
 * Doc chu ky bundle tu dia.
 * @param path - duong dan bundle.
 * @returns chu ky `{mtimeMs, ctimeMs, size}`.
 * @throws khi file khong ton tai hoac khong doc duoc.
 */
export function bundleStat(path: string): Omit<BundleStat, "path"> {
  const bundle = statSync(path);
  return { mtimeMs: bundle.mtimeMs, ctimeMs: bundle.ctimeMs, size: bundle.size };
}

/**
 * Hai chu ky bundle co giong nhau khong.
 * @param left - chu ky thu nhat.
 * @param right - chu ky thu hai.
 * @returns true khi ca ba truong deu bang nhau.
 */
export function sameBundleStat(left: Omit<BundleStat, "path">, right: Omit<BundleStat, "path">): boolean {
  return left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs && left.size === right.size;
}

/**
 * Ma loi cua mot gia tri nem ra (khong tin vao kieu).
 * @param error - gia tri bat duoc.
 * @returns ma loi, hoac chuoi rong.
 */
export function errorCode(error: unknown): string {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

/**
 * Mount theo doi bundle va kenh SSE `/plugins/events`.
 * @param ctx - context cordis co `clientModules` va `webServer`.
 * @param config - cau hinh da kiem tra.
 * @returns khong tra gi.
 */
export function apply(ctx: HmrContext, config: Config): void {
  const pollIntervalMs = config.pollIntervalMs ?? 500;
  const watched = new Map<string, Watch>();

  /** Public mot lan build lai: goi clientModules.rebuilt va cap nhat chu ky da biet. */
  const publish = (id: string, watch: Watch, current: Omit<BundleStat, "path">): void => {
    try {
      ctx.clientModules.rebuilt(id);
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        watch.dirty = true;
        return;
      }
      ctx.logger.warn(error);
    }
    watch.mtimeMs = current.mtimeMs;
    watch.ctimeMs = current.ctimeMs;
    watch.size = current.size;
    watch.dirty = false;
  };

  /** Bat dau theo doi mot bundle; neu da lech ngay tu dau thi publish luon. */
  const watchRow = (id: string, baseline: BundleStat): void => {
    const watch: Watch = { ...baseline, dirty: false };
    watched.set(id, watch);
    let current: Omit<BundleStat, "path">;
    try {
      current = bundleStat(baseline.path);
    } catch (error) {
      watch.dirty = true;
      if (errorCode(error) !== "ENOENT") ctx.logger.warn(error);
      return;
    }
    if (!sameBundleStat(current, watch)) publish(id, watch, current);
  };

  /** Mot vong poll: chi publish khi chu ky doi hoac lan truoc do loi. */
  const pollWatches = (): void => {
    for (const [id, watch] of watched) {
      let current: Omit<BundleStat, "path">;
      try {
        current = bundleStat(watch.path);
      } catch (error) {
        watch.dirty = true;
        if (errorCode(error) !== "ENOENT") ctx.logger.warn(error);
        continue;
      }
      if (!watch.dirty && sameBundleStat(current, watch)) continue;
      publish(id, watch, current);
    }
  };

  /** Dong bo danh sach theo doi voi do thi hien tai cua clientModules. */
  const syncWatches = (): void => {
    const rows = new Map<string, BundleStat>();
    for (const row of ctx.clientModules.graph().entries) {
      const baseline = ctx.clientModules.artifactBaseline(row.id);
      if (baseline !== undefined) rows.set(row.id, baseline);
    }
    for (const [id, watch] of watched) {
      if (rows.get(id)?.path === watch.path) continue;
      watched.delete(id);
    }
    for (const [id, baseline] of rows) if (!watched.has(id)) watchRow(id, baseline);
  };

  ctx.effect(() => {
    syncWatches();
    const unsubscribe = ctx.clientModules.onGraphChanged(syncWatches);
    const timer = setInterval(pollWatches, pollIntervalMs);
    timer.unref();
    return () => {
      unsubscribe();
      clearInterval(timer);
      watched.clear();
    };
  }, "client-hmr: bundle watches");

  const connections = new Set<SseResponse>();

  /** Gui anh chup do thi hien tai cho moi ket noi dang mo. */
  const publishGraph = (): void => {
    const line = sseData({ type: "graph", graph: ctx.clientModules.graph() });
    for (const res of connections) res.write(line);
  };

  /** Mo mot ket noi SSE: header dung chuan, loi chao, roi anh chup do thi dau tien. */
  const connect = (res: SseResponse): void => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(": connected\n\n");
    connections.add(res);
    res.write(sseData({ type: "graph", graph: ctx.clientModules.graph() }));
    res.on("close", () => {
      connections.delete(res);
    });
  };

  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register({
      kind: "exact",
      path: EVENTS_ENDPOINT,
      handler: (req, res) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.writeHead(405);
          res.end();
          return;
        }
        connect(res);
      },
    });
    const unsubscribeGraph = ctx.clientModules.onGraphChanged(publishGraph);
    const unsubscribe = ctx.clientModules.onRebuilt((id, rev) => {
      const line = sseData({ type: "rebuilt", id, rev });
      for (const res of connections) res.write(line);
    });
    return () => {
      unsubscribeGraph();
      unsubscribe();
      disposeRoute();
      for (const res of connections) res.destroy();
      connections.clear();
    };
  }, "client-hmr: /plugins/events channel");
}
