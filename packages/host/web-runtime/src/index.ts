/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Runtime` (@deepseek-ai/dsh-web-app) — phần "keo"
 *      runtime của bề mặt web: mount chủ sở hữu fallback dist, cấp service `webApp`, biến bash
 *      `DSH_WEB_URL`, dòng URL lúc khởi động, và bàn giao cho trình duyệt mặc định. Nguồn đối chiếu: README.md (G4).
 */
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { auditStartupEntries } from "@deepseek-ai/dsh-app-boot";
import * as FrontendStatic from "@deepseek-ai/dsh-host-frontend-static";
import { bindUrlHost, isLoopbackHost } from "@galaxy-blackhole/gbh-host-webserver";
import { launchEnvironmentOf, launchedThroughSsh } from "@deepseek-ai/dsh-launch-environment";
import { openBrowser } from "./browser.ts";
import { resolveDistIndex } from "./dist.ts";
import { parsePublicUrl } from "./public-url.ts";

/** Tên plugin cordis ổn định — NGUYÊN VĂN tên của bundle gốc (`web-app`, KHÔNG phải id row `web-runtime`). */
export const name = "web-app";

/** Service phải có trước khi runtime web mount được: cổng HTTP đã bind (host + port + protocol). */
export const inject: string[] = ["webServer"];

/** Cấu hình: thiết lập triển khai + giá trị dòng lệnh do row `web-startup` cấp qua config lười của row. */
export interface Config {
  /** Cho phép bàn giao trình duyệt sau khi cây Loader yên; lượt chạy qua SSH triệt tiêu cờ này. */
  openBrowser: boolean;
  /** In dòng URL lúc activate; một lớp không tương tác có thể tắt. */
  printUrl: boolean;
  /** Đăng ký biến bash `DSH_WEB_URL` chỉ đúng GUI này; lớp không tương tác có thể tắt. */
  surfaceContext: boolean;
  /** Gốc HTTP(S) chuẩn để quảng bá, đã chuẩn hoá kết thúc bằng `/`; vắng mặt thì quảng bá origin của listener. */
  publicUrl?: string;
}

/** Bề mặt service `webApp` mà row này cấp cho phần còn lại của cây plugin. */
export interface WebApp {
  /**
   * URL mà GUI này quảng bá — cũng là giá trị của `DSH_WEB_URL` và dòng URL lúc khởi động.
   * @returns `publicUrl` đã cấu hình, ngược lại là origin của listener.
   */
  getAdvertisedUrl(): string;
}

/** Schema cấu hình — cùng khoá, cùng mặc định, cùng phép biến đổi `publicUrl` như bundle gốc. */
export const Config = z.object({
  openBrowser: z.boolean().default(true),
  printUrl: z.boolean().default(true),
  surfaceContext: z.boolean().default(true),
  publicUrl: z.transform(z.string(), (value: string) => parsePublicUrl(value).href),
});

/** Biến môi trường đặt tên URL được quảng bá của GUI Web này. */
const DSH_WEB_URL = "DSH_WEB_URL";

/** Tập `root` đã in dòng "ready" — bảo đảm mỗi cây plugin chỉ in MỘT lần. */
const ANNOUNCED_ROOTS = /* @__PURE__ */ new WeakSet<object>();

/** Một biến do seam `shellEnv` công bố cho bash. */
interface ShellEnvVariable {
  /** Mô tả người/agent đọc được về biến. */
  description: string;
}

/** Seam `shellEnv` của DSH — chỉ phần row này gọi. */
interface ShellEnvRegistrar {
  /**
   * Đăng ký một nhóm biến có giá trị tính tại thời điểm hỏi.
   * @param registration - tên nhóm, bảng biến, và hàm phân giải giá trị.
   * @returns không dùng tới giá trị trả về.
   */
  register(registration: {
    /** Tên nhóm biến (trùng tên row `web-runtime` như bản gốc). */
    name: string;
    /** Bảng biến công bố, kèm mô tả. */
    variables: Record<string, ShellEnvVariable>;
    /** Tính giá trị hiện tại của từng biến. */
    resolve: () => Record<string, string>;
  }): unknown;
}

/** Seam `connection` của DSH — chỉ phần row này gọi. */
interface Connection {
  /**
   * Đổi URL công khai thành URL đã kèm token của lượt chạy này.
   * @param url - URL gốc cần ký.
   * @returns URL đã kèm token.
   */
  authenticatedUrl(url: string): string;
}

/** Bộ nạp plugin — chỉ dùng để chờ cây yên trước khi báo "ready". */
interface Loader {
  /**
   * Chờ cây plugin yên (hoặc trả `undefined` khi seam không cấp lời hứa).
   * @returns lời hứa hoàn tất khi cây yên, hoặc undefined.
   */
  await(): Promise<void> | undefined;
}

/**
 * Mount runtime web: phục vụ dist, biến bash runtime, dòng URL, và bàn giao trình duyệt mặc định.
 *
 * Thứ tự cố ý giống bản gốc: kiểm bind ⇒ cảnh báo phơi HTTP ⇒ cấp `webApp` ⇒ mount chủ sở hữu
 * fallback ⇒ (tuỳ cờ) đăng ký biến bash ⇒ (tuỳ cờ) in URL/bàn giao SAU khi cây Loader yên.
 * @param ctx - context plugin mang service `webServer`.
 * @param config - {@link Config} đã được schema xác thực.
 * @returns không trả gì; toàn bộ tác dụng phụ nằm trên `ctx` và console.
 * @throws khi bind mang zone id của interface mà không có `publicUrl` — không URL nào diễn đạt được nó.
 */
export function apply(ctx: Context, config: Config): void {
  const publicUrl = config.publicUrl ?? undefined;
  const boundHost = ctx.webServer.host;
  if (publicUrl === undefined && bindUrlHost(boundHost) === undefined) {
    throw new Error(
      `web-app: bind address ${JSON.stringify(boundHost)} carries an interface zone id, which no URL can express; pass --public-url with the root browsers actually reach it through`,
    );
  }
  if (ctx.webServer.protocol === "http:" && !isLoopbackHost(boundHost)) {
    console.warn(`dsh web: listening on ${boundHost} over plain HTTP; restrict this port to a trusted proxy or network`);
  }
  const handoffBrowser = config.openBrowser && !launchedThroughSsh(launchEnvironmentOf(ctx));
  /** Gốc được quảng bá: `publicUrl` chuẩn, hoặc origin của chính listener. */
  const appRootUrl = (): string => publicUrl ?? ctx.webServer.getOrigin();
  // Vật thể service là MỚI mỗi lượt cài — không chia sẻ tham chiếu giữa hai thực thể (C6).
  ctx.provide("webApp", { getAdvertisedUrl: appRootUrl } satisfies WebApp);
  ctx.plugin(FrontendStatic, { distIndex: internals.resolveDistIndex() });
  if (config.surfaceContext) {
    ctx.inject(["shellEnv"], (runtimeCtx) => {
      const shellEnv = (runtimeCtx as unknown as { shellEnv: ShellEnvRegistrar }).shellEnv;
      shellEnv.register({
        name: "web-runtime",
        variables: {
          [DSH_WEB_URL]: { description: "Advertised URL of the Galaxy Blackhole Web GUI serving this session." },
        },
        resolve: () => ({ [DSH_WEB_URL]: appRootUrl() }),
      });
    });
  }
  if (config.printUrl || handoffBrowser) {
    ctx.inject(["connection"], (connectionCtx) => {
      const connection = (connectionCtx as unknown as { connection: Connection }).connection;
      const announceReady = (): void => {
        if (ANNOUNCED_ROOTS.has(connectionCtx.root)) return;
        const authenticatedUrl = connection.authenticatedUrl(appRootUrl());
        ANNOUNCED_ROOTS.add(connectionCtx.root);
        if (config.printUrl) console.log(`dsh web: ${authenticatedUrl}`);
        if (handoffBrowser) {
          console.log("dsh web: opening the default browser; pass --no-open to disable");
          internals.openBrowser(authenticatedUrl).catch((error: unknown) => {
            const reason = error instanceof Error ? error.message : String(error);
            console.error(`web-app: could not open the default browser because ${reason}; use the dsh web URL printed at startup`);
          });
        }
      };
      const settled = (connectionCtx.get("loader") as Loader | undefined)?.await();
      if (settled === undefined) announceReady();
      else {
        settled
          .then(async () => {
            await auditStartupEntries(connectionCtx.root, "dsh web", () => {});
            if (connectionCtx.get("webServer") !== undefined && connectionCtx.get("connection") !== undefined) {
              announceReady();
            }
          })
          .catch(() => {});
      }
    });
  }
}

/** Móc thử cho dist đã build và bàn giao trình duyệt; production KHÔNG BAO GIỜ sửa chúng. */
export const internals = {
  resolveDistIndex,
  openBrowser,
};