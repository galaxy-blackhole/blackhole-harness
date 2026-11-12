/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cài service connection trong trang: đọc thành phần trang, mở vòng đời thế hệ, phơi ctx.connection
 */

import { RECOVERY_GLOBAL, TRANSPORT_GLOBAL } from "../ids.ts";
import { resolveConnectionConfig } from "../recovery-config.ts";
import { isLoopbackHostname } from "../host/loopback.ts";
import { ConnectionController, type ConnectionGeneration, type ConnectionGenerationSource, type ConnectionHostInfo, type ConnectionSinks, type ConnectionState } from "./connection.ts";
import { createWebConnectionRpc, type ClientConnectionRpc, type RpcFetch, type RpcStreamOpen } from "./rpc.ts";
import { openConnectionWebSocket, type ConnectionWebSocket, type ConnectionWebSocketFactory } from "./socket.ts";

/** Mức tham gia sự kiện chuyển tiếp của một trang. */
export type ConnectionInteractions = "answer" | "none";

/** Giao vận vật lý do vỏ tự dựng; trang được phục vụ thì bỏ trống và nhận HTTP + WebSocket. */
export interface ClientTransportHooks {
  /** Giao vận RPC logic đã giải mã: có nó thì bỏ hẳn phong bì, fetch và openStream. */
  rpc?: ClientConnectionRpc;
  /** Giao vận cho các channel RPC một chiều (Typert gateway). */
  fetch?: RpcFetch;
  /** Giao vận luồng cục bộ của worker. */
  openStream?: RpcStreamOpen;
  /** Vỏ khai trang này SỞ HỮU Host (Host chạy trong worker của chính nó). */
  ownsHost?: boolean;
  /** Factory WebSocket có xác thực; bỏ trống thì dùng API của trình duyệt. */
  createWebSocket?: ConnectionWebSocketFactory;
  /** Base URL của Host cho socket; bỏ trống thì dùng base của tài liệu. */
  streamBaseUrl?: string;
}

/** Trường vị trí trang dùng để phân loại authority loopback. */
export interface ConnectionLocation {
  /** Hostname của trang. */
  readonly hostname: string;
}

/** Tham số cài đặt service Connection. */
export interface ConnectionInstallOptions {
  /** Tham gia sự kiện chuyển tiếp; bỏ trống thì trang trả lời, còn lại là none. */
  readonly interactions?: ConnectionInteractions;
  /** Giao vận vật lý tường minh; bỏ trống thì dùng HTTP + WebSocket của trình duyệt. */
  readonly transport?: ClientTransportHooks;
  /** Ghi đè nhịp nối lại; trường bỏ trống dùng mặc định của controller. */
  readonly recovery?: Record<string, unknown>;
  /** Vị trí trang; bỏ trống khi không phải trình duyệt. */
  readonly location?: ConnectionLocation;
}

/** Nguồn trạng thái chỉ đọc của một thế hệ. */
export interface ConnectionGenerationState {
  /** Thế hệ đang hoạt động, hoặc undefined trước khi sẵn sàng và trong lúc nối lại. */
  getSnapshot(): ConnectionGeneration | undefined;
  /** Đăng ký nghe thay đổi thế hệ. */
  subscribe(listener: () => void): () => void;
}

/** Nguồn trạng thái chỉ đọc của vòng đời phục hồi. */
export interface ConnectionStateSource {
  /** Trạng thái hiện tại, hoặc undefined trước kết cục đầu tiên. */
  getSnapshot(): ConnectionState | undefined;
  /** Đăng ký nghe thay đổi trạng thái. */
  subscribe(listener: () => void): () => void;
}

/** Service ctx.connection mà các row khác tiêu thụ. */
export interface ConnectionHandle {
  /** Mức tham gia sự kiện chuyển tiếp đã chọn lúc cài đặt. */
  readonly interactions: ConnectionInteractions;
  /** Bề mặt đặc quyền có tới được hay không (authority loopback, hoặc trang sở hữu Host, hoặc không phải trình duyệt). */
  readonly isLoopback: boolean;
  /** Thế hệ sự kiện Remote hiện tại và sự thật về Host mà khung mở của nó mang theo. */
  readonly generation: ConnectionGenerationState;
  /** Vòng đời phục hồi cho bên tiêu thụ riêng của connection. */
  readonly state: ConnectionStateSource;
  /** Các channel RPC logic chung trên cùng giao vận. */
  readonly rpc: ClientConnectionRpc;
  /**
   * Mở một socket trên giao vận đã chọn; channel sở hữu việc đóng khung và đóng kết nối.
   * @param path - đường dẫn channel logic tuyệt đối, giải bên dưới mount của Host.
   * @returns socket mới đang kết nối, dùng factory xác thực đã cài.
   */
  openWebSocket(path: string): ConnectionWebSocket;
  /** Xoá tiến trình thử lại và thay thế lần thử hiện tại ngay lập tức. */
  reconnect(): void;
  /**
   * Đăng ký nguồn DUY NHẤT định nghĩa các thế hệ Host.
   * @param source - nguồn thế hệ sống lâu, do giao vận đẩy sở hữu.
   * @returns hàm gỡ, rút nguồn và dừng vòng lặp đang chạy.
   */
  registerGenerationSource(source: ConnectionGenerationSource): () => void;
  /**
   * Bắt đầu vòng lặp nối/phục hồi với điểm nhận sự kiện của bên tiêu thụ.
   * @param sinks - điểm nhận sự kiện.
   * @param config - ghi đè nhịp phục hồi cho riêng vòng lặp này.
   * @returns tay nắm dừng vòng lặp.
   * @throws Error khi đã có bên tiêu thụ khác sở hữu vòng lặp.
   */
  start(sinks: ConnectionSinks, config?: Record<string, unknown>): { stop(): void };
}

/**
 * Theo dõi trạng thái mạng của trình duyệt và báo cho controller.
 * @param controller - controller cần báo.
 * @returns hàm gỡ listener.
 */
function watchBrowserNetwork(controller: ConnectionController): () => void {
  const browser = (globalThis as { window?: Window }).window;
  const initiallyAvailable = browser?.navigator?.onLine;
  if (browser === undefined || initiallyAvailable === undefined) return () => {};
  const online = (): void => controller.setNetworkAvailable(true);
  const offline = (): void => controller.setNetworkAvailable(false);
  controller.setNetworkAvailable(initiallyAvailable);
  browser.addEventListener("online", online);
  browser.addEventListener("offline", offline);
  return () => {
    browser.removeEventListener("online", online);
    browser.removeEventListener("offline", offline);
  };
}

/**
 * Cài một service Connection thuộc Context từ thành phần tường minh.
 * @param ctx - context cordis phía client.
 * @param options - tham gia sự kiện, giao vận vật lý, nhịp nối lại và vị trí trang.
 */
export function installConnection(ctx: { provide(name: string, value: unknown): void; effect?(run: () => () => void, label?: string): unknown }, options: ConnectionInstallOptions = {}): ConnectionHandle {
  const pageLocation = options.location;
  const transport = options.transport;
  const recovery = options.recovery ?? {};
  const interactions: ConnectionInteractions = options.interactions ?? (pageLocation === undefined ? "none" : "answer");
  const rpc = transport?.rpc ?? createWebConnectionRpc(transport?.fetch, transport?.openStream);
  let generationSource: ConnectionGenerationSource | undefined;
  let owner: { token: object; source: ConnectionGenerationSource; controller: ConnectionController; stopNetworkWatch: () => void } | undefined;
  let generationId = 0;
  let generation: ConnectionGeneration | undefined;
  let state: ConnectionState | undefined;
  const generationListeners = new Set<() => void>();
  const stateListeners = new Set<() => void>();
  const publishGeneration = (next: ConnectionGeneration | undefined): void => {
    if (Object.is(generation, next)) return;
    generation = next;
    for (const listener of [...generationListeners]) {
      try {
        listener();
      } catch (error) {
        console.error("[connection] generation listener threw:", error);
      }
    }
  };
  const publishState = (next: ConnectionState | undefined): void => {
    if (state === next) return;
    state = next;
    for (const listener of [...stateListeners]) {
      try {
        listener();
      } catch (error) {
        console.error("[connection] state listener threw:", error);
      }
    }
  };
  const releaseOwner = (current: NonNullable<typeof owner>): void => {
    if (owner !== current) return;
    owner = undefined;
    current.stopNetworkWatch();
    current.controller.stop();
    publishGeneration(undefined);
    publishState(undefined);
  };
  const handle: ConnectionHandle = {
    interactions,
    openWebSocket: (path) => openConnectionWebSocket(path, transport?.createWebSocket, transport?.streamBaseUrl),
    isLoopback: transport?.ownsHost === true || pageLocation === undefined || isLoopbackHostname(pageLocation.hostname),
    generation: {
      getSnapshot: () => generation,
      subscribe: (listener) => {
        generationListeners.add(listener);
        return () => {
          generationListeners.delete(listener);
        };
      },
    },
    state: {
      getSnapshot: () => state,
      subscribe: (listener) => {
        stateListeners.add(listener);
        return () => {
          stateListeners.delete(listener);
        };
      },
    },
    rpc,
    reconnect(): void {
      owner?.controller.reconnect();
    },
    registerGenerationSource(source): () => void {
      if (generationSource !== undefined) throw new Error("connection: a generation source is already registered");
      generationSource = source;
      return () => {
        if (generationSource !== source) return;
        generationSource = undefined;
        const current = owner;
        if (current?.source === source) releaseOwner(current);
      };
    },
    start(sinks, config): { stop(): void } {
      if (owner !== undefined) throw new Error("connection: the stream loop is already owned by another consumer");
      const source = generationSource;
      if (source === undefined) throw new Error("connection: no generation source is registered");
      const token = {};
      const ownsGeneration = (): boolean => owner?.token === token;
      const controller = new ConnectionController(source, {
        ...sinks,
        onConnected: (host: ConnectionHostInfo) => {
          const nextGeneration: ConnectionGeneration = { id: ++generationId, host };
          publishGeneration(nextGeneration);
          if (!ownsGeneration() || !Object.is(generation, nextGeneration)) return;
          sinks.onConnected?.(host);
        },
        onStateChange: (next: ConnectionState) => {
          if (next !== "connected") publishGeneration(undefined);
          if (!ownsGeneration()) return;
          publishState(next);
          sinks.onStateChange?.(next);
        },
      }, { ...recovery, ...config });
      const current = { token, source, controller, stopNetworkWatch: watchBrowserNetwork(controller) };
      owner = current;
      controller.start();
      return {
        stop: () => {
          releaseOwner(current);
        },
      };
    },
  };
  ctx.provide("connection", handle);
  return handle;
}

/**
 * Cờ "đã cài" ở PHẠM VI MODULE (không phải trong `apply`).
 *
 * Vì sao cần: bundle hai id (id của ta + id gốc) làm loader gọi factory hai lần ⇒ HAI plugin instance ⇒ `apply`
 * chạy lần thứ hai ⇒ đăng ký lại service/slot ⇒ cordis ném lỗi ⇒ row kẹt `loading` ⇒ mọi row stock inject nó
 * cũng kẹt. Cờ này chặn lần cài thứ hai (tm-host-api đã chứng minh bằng đối chứng trước/sau: 3 row của họ
 * activate, 17 row hai-id khác vẫn `loading`). Khi tầng nạp dùng lại CÙNG plugin instance (tm-client đang sửa
 * gốc) thì đây là phòng thủ nhiều lớp — vẫn giữ vì nó rẻ.
 */
let bundleInstalled = false;

/**
 * Thân plugin client: đọc thành phần trang rồi cài service Connection của nó.
 * @param ctx - context cordis phía client.
 */
export function apply(ctx: { provide(name: string, value: unknown): void }): void {
  if (bundleInstalled) {
    console.warn("gbh-client-connection: bundle da duoc cai, bo qua lan thu hai");
    return;
  }
  try {
    applyInner(ctx);
    /* CHỈ bật sau khi đăng ký XONG: nếu applyInner ném giữa đường thì cờ KHÔNG được khoá,
       nếu không lần cài thứ hai sẽ không đăng ký gì ⇒ slot rỗng ⇒ renderer gặp undefined ⇒ React #130. */
    bundleInstalled = true;
  } catch (error) {
    /* Cordis NUỐT lỗi trong apply ⇒ không có dòng này thì không ai biết vì sao row kẹt loading. Vẫn ném lại. */
    console.error("gbh-client-connection: apply nem loi", error);
    throw error;
  }
}

/**
 * Thân thật của lần cài ĐẦU TIÊN.
 * @param ctx - context cordis phía client.
 */
function applyInner(ctx: { provide(name: string, value: unknown): void }): void {
  const globals = globalThis as { [TRANSPORT_GLOBAL]?: ClientTransportHooks; [RECOVERY_GLOBAL]?: unknown };
  const pageLocation = typeof location === "undefined" ? undefined : { hostname: location.hostname };
  const transport = globals[TRANSPORT_GLOBAL];
  installConnection(ctx, {
    ...(transport === undefined ? {} : { transport }),
    recovery: resolveConnectionConfig(globals[RECOVERY_GLOBAL]),
    ...(pageLocation === undefined ? {} : { location: pageLocation }),
  });
}
