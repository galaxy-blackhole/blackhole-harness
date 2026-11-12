/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Ban viet lai cua Galaxy Blackhole cho row open-in-app: 3 route (apps, icon, open) tren seam webServer cua kernel.
 */
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { IncomingMessage, ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { scrubbedParentEnv } from "@deepseek-ai/dsh-subprocess";
import { resolveCatalog, openCommand, type OpenInAppLauncher } from "./catalog.ts";
import { extractBundleIconPng } from "./icons.ts";

/** Ten plugin (cordis function plugin) — giu nguyen ten seam cua row goc. */
export const name = "open-in-app";

/** Seam can co: noi dang route, hang rao tin cay, va capability phan giai executable. */
export const inject = ["webServer", "connection", "subprocess"];

/** Cau hinh cua row open-in-app. */
export interface Config {
  /** Han chot moi lenh he thong khi do catalog (xcode-select…). */
  readonly probeTimeoutMs: number;
  /** Han chot moi lenh he thong khi trich icon (plutil/sips). */
  readonly iconTimeoutMs: number;
  /** Cua so bat loi som moi lan mo: qua cua so ma tien trinh con van chay thi tinh la da mo. */
  readonly launchWatchMs: number;
}

/** Schema cau hinh — schemastery, de Settings/config-editor cua kernel render duoc field. */
export const Config: z<Config> = z
  .object({
    probeTimeoutMs: z.natural().default(10000),
    iconTimeoutMs: z.natural().default(10000),
    launchWatchMs: z.natural().default(1000),
  }) as unknown as z<Config>;

/** Route dang ky duoc (seam webServer cua kernel). */
interface WebServerLike {
  register(route: {
    kind: "exact" | "prefix";
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
  }): () => void;
}

/** Hang rao tin cay (seam connection cua kernel): tra 401/403 truoc khi dispatch, hoac undefined. */
interface ConnectionLike {
  requestRejection(request: { headers: IncomingMessage["headers"] }): 401 | 403 | undefined;
}

/** Tran body cho route mo ung dung. */
const OPEN_BODY_LIMIT = 64 * 1024;

/**
 * Gui JSON (luon la Buffer — bai hoc ADR 0004 §8: tang van chuyen phai coi than phan hoi la BYTE).
 * @param res - response.
 * @param status - ma trang thai.
 * @param payload - du lieu se duoc JSON.stringify.
 */
function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": String(body.length) });
  res.end(body);
}

/**
 * Doc het body voi tran byte.
 * @param req - request.
 * @param limit - so byte toi da.
 * @returns body, hoac null khi vuot tran.
 */
async function readBody(req: IncomingMessage, limit: number): Promise<Buffer | null> {
  const parts: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buffer.length;
    if (total > limit) return null;
    parts.push(buffer);
  }
  return Buffer.concat(parts);
}

/**
 * Kiem tra mot duong dan la thu muc ton tai.
 * @param path - duong dan tuyet doi.
 * @returns true khi la thu muc.
 */
async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Mo ung dung voi duong dan, bat loi som trong cua so launchWatchMs.
 * @param launcher - muc catalog.
 * @param path - duong dan nguoi dung chon.
 * @param watchMs - cua so bat loi som.
 * @returns null khi da mo, hoac thong bao loi.
 */
function launch(
  launcher: OpenInAppLauncher,
  path: string,
  watchMs: number,
  phanGiai?: (ten: string) => Promise<string | undefined>,
): Promise<string | null> {
  const { command, args } = openCommand(launcher, path);
  return new Promise<string | null>((resolve) => {
    /**
     * Mo tien trinh va theo doi cua so bat loi som.
     * @param lenh - lenh se chay (da phan giai neu la ten tran).
     */
    const chay = (lenh: string): void => {
      // 09/11/2026 (Lead duyệt, P0 'open-in-app'): KHỬ CREDENTIAL khỏi env tiến trình con + windowsHide như stock
      //   (stock lib/index.js:349-357 dùng scrubbedParentEnv()) — thiếu env khử là lỗ hổng an ninh, không phải khác biệt cố ý.
      const child = spawn(lenh, args, { stdio: "ignore", detached: true, windowsHide: true, env: { ...scrubbedParentEnv() } });
      // 08/11/2026 (Phase C, đối chiếu stock lib/index.js:363): tiến trình con phải TÁCH khỏi vòng lặp sự kiện,
      //   nếu không host giữ con sống và lệnh mở app không bao giờ "trả quyền" cho người dùng.
      child.unref();
      let settled = false;
      const finish = (error: string | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(error);
      };
      const timer = setTimeout(() => finish(null), watchMs);
      child.on("error", (error) => finish(error.message));
      child.on("exit", (code) => {
        if (code !== 0 && code !== null) finish("lenh open ket thuc voi ma " + String(code));
        else finish(null);
      });
    };
    // Ten lenh tran thi hoi seam subprocess cua kernel (dung cong sandbox cua host), roi moi spawn.
    if (phanGiai !== undefined && !isAbsolute(command)) {
      void phanGiai(command).then(
        (daPhanGiai) => chay(daPhanGiai ?? command),
        () => chay(command),
      );
      return;
    }
    chay(command);
  });
}

/** Seam `subprocess` mà kernel cấp cho row (chỉ cần `resolveExecutable`). */
export interface SubprocessInternals {
  /** Phân giải tên lệnh trần thành đường dẫn tuyệt đối qua cổng sandbox của host. */
  readonly resolveExecutable?: (ten: string) => Promise<string>;
}

/** Internals đã kiểm xong — chắc chắn có `resolveExecutable`. */
export interface ResolvedInternals {
  /** Phân giải tên lệnh trần (đã chắc chắn có mặt). */
  readonly resolveExecutable: (ten: string) => Promise<string>;
}

/**
 * Kiểm + chuẩn hoá internals của row — ĐỐI CHIẾU stock `lib/index.js:391-392` (`resolveInternals`):
 * stock ném trong HÀM THUẦN này khi thiếu `resolveExecutable`, KHÔNG ném trong `apply()`.
 * Nhận: internals — seam kernel cấp (có thể thiếu).
 * Trả: internals đã chắc chắn có `resolveExecutable`.
 * @throws Error khi thiếu `resolveExecutable` — fail-loud, không hạ cấp im lặng.
 */
export function resolveInternals(internals: { readonly subprocess?: SubprocessInternals }): ResolvedInternals {
  const seam = internals.subprocess;
  const resolveExecutable = seam?.resolveExecutable;
  if (resolveExecutable === undefined) {
    throw new Error("open-in-app: thieu seam subprocess.resolveExecutable (subprocess capability bat buoc)");
  }
  return { resolveExecutable: (ten: string) => resolveExecutable(ten) };
}

/**
 * Dang ky 3 route cua open-in-app tren seam webServer.
 * @param ctx - context cua plugin (co webServer, connection, subprocess).
 * @param config - cau hinh da chuan hoa.
 */
export function apply(ctx: Context, config: Config): void {
  // 08/11/2026 (Lead chốt cách (a) — KHỚP DSH): việc kiểm seam `subprocess.resolveExecutable` nằm ở
  //   HÀM THUẦN `resolveInternals()` (như stock `lib/index.js:391-392`), KHÔNG ném trong `apply()`.
  //   Lý do: ném ở đây làm plugin không activate ⇒ 3 route không đăng ký được. Nơi thực sự cần phân giải
  //   lệnh (route `open`) mới gọi `resolveInternals()` ⇒ vẫn fail-loud nhưng đúng chỗ như DSH.
  const webServer = ctx.get("webServer") as WebServerLike | undefined;
  const connection = ctx.get("connection") as ConnectionLike | undefined;
  if (webServer === undefined) {
    ctx.logger.error("open-in-app: thieu seam webServer");
    return;
  }
  let catalog: Promise<OpenInAppLauncher[]> | undefined;
  const icons = new Map<string, Buffer | null>();

  /**
   * Catalog da resolve, GIU LAI de khoi do lai moi lan click — nhung KHONG phai cache vinh vien:
   * khi mot launcher bao thieu (ENOENT) thi `quenCatalog()` xoa cache de lan sau do lai.
   * @returns danh sach launcher da resolve.
   */
  const catalogOnce = (): Promise<OpenInAppLauncher[]> => (catalog ??= resolveCatalog());

  /**
   * Xoa cache catalog (goi khi phat hien ung dung vua duoc cai/chuyen cho).
   * Nhan: khong. Tra: khong.
   */
  const quenCatalog = (): void => {
    catalog = undefined;
  };

  /**
   * Hang rao tin cay: goi connection truoc moi route.
   * @param req - request.
   * @param res - response.
   * @returns true khi da bi chan (response da ket thuc).
   */
  const fenced = (req: IncomingMessage, res: ServerResponse): boolean => {
    if (connection === undefined) return false;
    const rejection = connection.requestRejection({ headers: req.headers });
    if (rejection === undefined) return false;
    res.writeHead(rejection);
    res.end();
    return true;
  };

  const disposers = [
    webServer.register({
      kind: "exact",
      path: "/open-in-app/apps",
      handler: async (req, res) => {
        if (fenced(req, res)) return;
        const found = await catalogOnce();
        sendJson(res, 200, { apps: found.map((launcher) => launcher.id) });
      },
    }),
    webServer.register({
      kind: "prefix",
      path: "/open-in-app/icon",
      handler: async (req, res) => {
        if (fenced(req, res)) return;
        const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
        const id = pathname.slice("/open-in-app/icon/".length);
        const found = await catalogOnce();
        const launcher = found.find((entry) => entry.id === id);
        if (launcher === undefined) {
          res.writeHead(404);
          res.end();
          return;
        }
        if (!icons.has(id)) icons.set(id, extractBundleIconPng(launcher.bundle, config.iconTimeoutMs));
        const png = icons.get(id) ?? null;
        if (png === null) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { "content-type": "image/png", "content-length": String(png.length) });
        res.end(png);
      },
    }),
    webServer.register({
      kind: "exact",
      path: "/open-in-app/open",
      handler: async (req, res) => {
        if (fenced(req, res)) return;
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: { code: "open-in-app/method", message: "chi nhan POST" } });
          return;
        }
        const mediaType = (req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
        if (mediaType !== "application/json") {
          sendJson(res, 415, { ok: false, error: { code: "open-in-app/media-type", message: "can application/json" } });
          return;
        }
        const body = await readBody(req, OPEN_BODY_LIMIT);
        if (body === null) {
          sendJson(res, 413, { ok: false, error: { code: "open-in-app/too-large", message: "body vuot 64 KiB" } });
          return;
        }
        let parsed: { app?: unknown; path?: unknown };
        try {
          parsed = JSON.parse(body.toString("utf8")) as { app?: unknown; path?: unknown };
        } catch {
          sendJson(res, 400, { ok: false, error: { code: "open-in-app/body", message: "JSON khong hop le" } });
          return;
        }
        const found = await catalogOnce();
        const launcher = found.find((entry) => entry.id === parsed.app);
        if (launcher === undefined || typeof parsed.path !== "string" || !isAbsolute(parsed.path)) {
          sendJson(res, 400, { ok: false, error: { code: "open-in-app/request", message: "app hoac path khong hop le" } });
          return;
        }
        if (!(await isDirectory(parsed.path))) {
          sendJson(res, 400, { ok: false, error: { code: "open-in-app/request", message: "path khong phai thu muc ton tai" } });
          return;
        }
        let phanGiaiLenh: (ten: string) => Promise<string>;
        try {
          phanGiaiLenh = resolveInternals({ subprocess: ctx.get("subprocess") as SubprocessInternals | undefined }).resolveExecutable;
        } catch (error) {
          sendJson(res, 500, { ok: false, error: { code: "open-in-app/subprocess", message: (error as Error).message } });
          return;
        }
        const failure = await launch(launcher, parsed.path, config.launchWatchMs, phanGiaiLenh);
        if (failure !== null) {
          // 08/11/2026 (Phase C, đối chiếu stock lib/index.js:896,1155): app vừa được CÀI/CHUYỂN CHỖ thì lần mở đầu
          //   sẽ hỏng (ENOENT). Stock xoá catalog rồi dò LẠI MỘT LẦN trước khi báo lỗi — ta làm đúng như vậy.
          if (failure.includes("ENOENT")) {
            quenCatalog();
            const launcherMoi = (await catalogOnce()).find((muc) => muc.id === parsed.app);
            if (launcherMoi !== undefined && launcherMoi !== launcher) {
              const thuLai = await launch(launcherMoi, parsed.path, config.launchWatchMs, phanGiaiLenh);
              if (thuLai === null) {
                sendJson(res, 200, { ok: true });
                return;
              }
            }
          }
          sendJson(res, 500, { ok: false, error: { code: "open-in-app/launch", message: failure } });
          return;
        }
        sendJson(res, 200, { ok: true });
      },
    }),
  ];

  ctx.effect(() => () => {
    for (const dispose of disposers) dispose();
  });
  ctx.logger.info("open-in-app: san sang voi 3 route tren " + join("webServer"));
}