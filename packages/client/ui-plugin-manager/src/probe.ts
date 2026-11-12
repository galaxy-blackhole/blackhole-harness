/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa host 1:1 của row ui-plugin-manager: pluginRegistryProbe dò nhanh registry npm/npmmirror
 *      cho hộp thoại cài plugin (đua 2 ping HTTPS qua proxy fetch của Host, có cache + hoãn khi unload)
 */

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

/** Cấu hình dò registry — NGUYÊN VĂN ba trường + ràng buộc của bản gốc. */
export interface Config {
  /** Có bật dò registry không (mặc định bật). */
  registryProbeEnabled: boolean;
  /** Hạn chót cho cả lượt đua ping, mặc định 1500 ms. */
  registryProbeTimeoutMs: number;
  /** Thời gian sống của kết quả đã cache, mặc định 5 phút. */
  registryProbeCacheTtlMs: number;
}

/** Kết quả đã cache: registry thắng (hoặc null) + mốc hết hạn. */
interface ProbeCache {
  /** Registry thắng, hoặc null khi cả hai đều hỏng. */
  registry: string | null;
  /** Mốc hết hạn (ms since epoch). */
  expiresAt: number;
}

/**
 * Service Remote pluginRegistryProbe — dò nhanh registry npm/npmmirror cho hộp thoại cài plugin.
 *
 * Peer @deepseek-ai/dsh-typert-protocol thuộc seam RPC của kernel: lớp PHẢI kế thừa đúng base class đó
 * để Gateway discovery được (cùng khuôn row account-controller / cot-translation của ta).
 */
export default class PluginRegistryProbe extends TypertRemoteService {
  /** Schema cấu hình: bật/tắt, hạn chót, TTL — nguyên văn bản gốc. */
  static Config = z.object({
    registryProbeEnabled: z.boolean().default(true),
    registryProbeTimeoutMs: z.natural().min(1).max(MAX_TIMER_DELAY_MS).default(1500),
    registryProbeCacheTtlMs: z.natural().default(3e5),
  });

  /** Cấu hình đã chuẩn hoá. */
  private readonly config: Config;

  /** Vòng đời service: unload sẽ abort mọi request đang bay (bản gốc: lifetime + pending). */
  private readonly lifetime = new AbortController();

  /** Lượt dò đang chạy mà nhiều người đọc dùng chung. */
  private pending: Promise<string | null> | undefined;

  /** Kết quả đã cache. */
  private cached: ProbeCache | undefined;

  /**
   * Đăng ký service pluginRegistryProbe và nối vòng đời unload (abort + chờ lượt dò đang chạy xong).
   * @param ctx - context của plugin.
   * @param config - cấu hình đã chuẩn hoá.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "pluginRegistryProbe");
    this.config = config;
    ctx.effect(() => async () => {
      this.lifetime.abort();
      await this.pending;
    });
  }

  /**
   * Đua ping HTTPS của npm và npmmirror qua proxy fetch của Host; người đọc đồng thời dùng chung một lượt dò.
   * @returns registry đầu tiên trả lời thành công, hoặc null khi bị tắt / cả hai đều hỏng; kết quả được cache.
   * @throws khi service đã bị unload (AbortError) — nguyên văn hành vi bản gốc.
   */
  @Remote
  async fastest(): Promise<string | null> {
    this.lifetime.signal.throwIfAborted();
    if (!this.config.registryProbeEnabled) return null;
    if (this.cached !== undefined && this.cached.expiresAt > Date.now()) return this.cached.registry;
    this.pending ??= this.probe().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  /**
   * Một lượt đua ping: request nào thành công trước thì thắng; request còn lại bị huỷ và chờ đóng.
   * @returns registry thắng hoặc null; kết quả được cache khi service còn sống.
   */
  private async probe(): Promise<string | null> {
    const finished = new AbortController();
    const signal = AbortSignal.any([this.lifetime.signal, finished.signal, AbortSignal.timeout(this.config.registryProbeTimeoutMs)]);
    const requests = ["https://registry.npmjs.org/-/ping", "https://registry.npmmirror.com/-/ping"].map(async (endpoint) => ({
      registry: new URL("/", endpoint).href,
      response: await fetch(endpoint, { signal, redirect: "error" }),
    }));
    const successful = requests.map(async (request) => {
      const { registry, response } = await request;
      if (!response.ok) throw new Error("Registry ping returned HTTP " + response.status);
      return registry;
    });
    let registry: string | null;
    try {
      registry = await Promise.any(successful);
    } catch (_unavailableRegistries) {
      registry = null;
    } finally {
      finished.abort();
      const responses = await Promise.allSettled(requests);
      await Promise.allSettled(
        responses.map(async (result) => {
          if (result.status === "fulfilled") await result.value.response.body?.cancel();
        }),
      );
    }
    if (!this.lifetime.signal.aborted) {
      this.cached = { registry, expiresAt: Date.now() + this.config.registryProbeCacheTtlMs };
    }
    return registry;
  }
}
