/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua browser cua row client-hmr: doc luong SSE /plugins/events (qua transport cua vo hoac EventSource) va noi graph/rebuilt vao bo dieu khien module cua trang.
 */

import { createSseDecoder, parsePluginsEventFrame } from "./frames.ts";
import { EVENTS_ROUTE, ROW_NAME } from "./ids.ts";

/** Ham `require` ma bo nap module truyen vao factory. */
export type RequireFn = (id: string) => unknown;

/** Bo dieu khien module cua trang (chi hai ham row nay dung). */
export interface ClientEntries {
  /** Cap nhat chi muc theo anh chup do thi. */
  sync(graph: unknown): Promise<void> | void;
  /** Nap lai mot bundle da build lai. */
  reload(id: string, rev: string): Promise<void> | void;
}

/** Context cordis phia browser. */
export interface ClientContext {
  /** He module cua trang. */
  modules: { entries: ClientEntries };
  /** Dang ky hieu ung co the go. */
  effect(callback: () => () => void, label: string): void;
  /** Logger cua cordis. */
  logger: { warn(message: string): void; error(error: unknown): void };
}

/** Transport do vo (shell) so huu, neu trang co. */
export interface ShellTransport {
  /** Ham fetch cua vo. */
  fetch(
    input: string,
    init: { method: string; headers: Record<string, string>; signal: AbortSignal },
  ): Promise<{ ok: boolean; status: number; body: { getReader(): { read(): Promise<{ done: boolean; value?: { data?: string } }> } } | null }>;
}

/** Doi tuong toan cuc ma vo tiem vao trang (khong bat buoc). */
interface GlobalWithTransport {
  /** Transport cua vo. */
  __GBH_TRANSPORT__?: ShellTransport;
  /** Trinh gui su kien cua trinh duyet. */
  EventSource?: new (url: string) => {
    /** Lang nghe message. */
    addEventListener(type: "message", handler: (event: { data: string }) => void): void;
    /** Dong ket noi. */
    close(): void;
  };
}

/**
 * Doc route su kien qua transport cua vo cho toi khi dong hoac `signal` bi huy.
 * @param fetchFn - ham fetch cua vo.
 * @param signal - huy luong khi plugin bi go.
 * @param receive - xu ly mot payload `data` cua SSE.
 * @returns promise ket thuc khi luong dong.
 * @throws khi host tu choi luong, hoac luong dong trong khi plugin con hoat dong.
 */
export async function readPageTransportEvents(
  fetchFn: ShellTransport["fetch"],
  signal: AbortSignal,
  receive: (data: string) => void,
): Promise<void> {
  const response = await fetchFn(EVENTS_ROUTE, {
    method: "GET",
    headers: { accept: "text/event-stream" },
    signal,
  });
  if (!response.ok || response.body === null) {
    throw new Error(ROW_NAME + ": " + EVENTS_ROUTE + " tra ve " + String(response.status));
  }
  const reader = response.body.getReader();
  const decoder = createSseDecoder();
  const text = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const payload = typeof value?.data === "string" ? value.data : text.decode(value as unknown as Uint8Array, { stream: true });
    for (const frame of decoder.feed(payload)) receive(frame);
  }
  if (!signal.aborted) {
    throw new Error(ROW_NAME + ": " + EVENTS_ROUTE + " da dong; thay doi do thi client dung cho toi khi nap lai trang");
  }
}

/**
 * Tao plugin phia browser: noi tung khung nhan duoc vao bo dieu khien module cua trang.
 * @param _require - ham require cua bo nap (row nay khong dung module ngoai).
 * @returns plugin cordis phia browser.
 */
export function createPlugin(_require: RequireFn): { name: string; inject: string[]; apply(ctx: ClientContext): void } {
  return {
    name: ROW_NAME,
    inject: ["modules"],
    apply(ctx: ClientContext): void {
      // CHAN LAN CAI THU HAI (co pham vi MODULE, khong phai trong apply): row hai id => loader goi factory
      // hai lan => HAI plugin instance => apply chay lan hai => dang ky lai service/slot => nem loi => row
      // ket "loading". Do luong 17/10 cua tm-host-api: tuong quan 100% giua row ket loading va row HAI ID.
      // Chuan 17/10 (Lead chot): chan bang SO IDENTITY cua ctx — cung ctx cai hai lan thi NO-OP, ctx KHAC
      // (entry khac, vi du entry alias) van duoc cai binh thuong. KHONG chan o factory: hai entry la hai
      // fiber => hai ctx HOP LE, chan o factory se tra plugin rong => entry thu hai khong bao gio activate.
      if (bundleInstalled) {
        console.warn("gbh-client-hmr: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
        /* CHỈ bật sau khi đăng ký XONG: nếu applyInner ném giữa đường thì cờ KHÔNG được khoá,
           nếu không lần cài thứ hai sẽ không đăng ký gì ⇒ slot rỗng ⇒ renderer gặp undefined ⇒ React #130. */
        bundleInstalled = true;
      } catch (error) {
        // Cordis nuot loi cua apply nen khong ai biet vi sao row ket: in ra roi VAN nem tiep (khong nuot loi).
        console.error(ROW_NAME + ": apply nem loi", error);
        throw error;
      }
    },
  };
}

/** Context CUOI CUNG da cai (so identity) — dây lưng cho WeakSet, phạm vi MODULE. */
/* Cờ PHẠM VI MODULE (luật nhóm 18/10/2026): hai entry ⇒ hai ctx ⇒ cổng khoá-theo-ctx KHÔNG BAO GIỜ kích ⇒ apply
   chạy hai lần ⇒ "service … has been registered". Giá phải trả: boolean rò giữa các ca test ⇒ nạp module tươi/ca. */
let bundleInstalled = false;

/** Lưới trong: mỗi ctx đã cài một lần, phạm vi MODULE. */
/* (đã xoá WeakSet: cổng khoá-theo-ctx không kích được trong ca hai entry — xem cờ ở trên) */

/**
 * Phan than cua apply: noi tung khung nhan duoc vao bo dieu khien module cua trang.
 * @param ctx - context cordis phia browser.
 * @returns khong tra gi.
 */
export function applyInner(ctx: ClientContext): void {
  {
    {
      const entries = ctx.modules.entries;

      /** Xu ly mot khung da kiem tra. */
      const handle = (frame: { type: "graph"; graph: unknown } | { type: "rebuilt"; id: string; rev: string }): void => {
        const task =
          frame.type === "graph"
            ? Promise.resolve().then(() => entries.sync(frame.graph))
            : Promise.resolve().then(() => entries.reload(frame.id, frame.rev));
        task.catch((error: unknown) => {
          ctx.logger.error(error);
        });
      };

      /** Nhan mot payload tho: parse JSON, kiem vo khung, roi chuyen tiep. */
      const receive = (data: string): void => {
        let value: unknown;
        try {
          value = JSON.parse(data);
        } catch {
          ctx.logger.warn(ROW_NAME + ": khung su kien khong parse duoc: " + data);
          return;
        }
        const parsed = parsePluginsEventFrame(value);
        if (parsed.kind === "invalid") ctx.logger.warn(ROW_NAME + ": khung su kien sai dinh dang: " + data);
        else if (parsed.kind === "frame") handle(parsed.frame);
      };

      ctx.effect(() => {
        const global = globalThis as unknown as GlobalWithTransport;
        const transport = global.__GBH_TRANSPORT__;
        if (transport !== undefined && typeof transport.fetch === "function") {
          const controller = new AbortController();
          readPageTransportEvents(transport.fetch, controller.signal, receive).catch((error: unknown) => {
            if (!controller.signal.aborted) ctx.logger.error(error);
          });
          return () => {
            controller.abort();
          };
        }
        if (typeof global.EventSource !== "function") {
          ctx.logger.warn(ROW_NAME + ": khong co transport cua vo lan EventSource; bo qua luong su kien");
          return () => undefined;
        }
        const source = new global.EventSource(EVENTS_ROUTE);
        source.addEventListener("message", (event) => {
          receive(event.data);
        });
        return () => {
          source.close();
        };
      }, "client-hmr: event source");
    }
  }
}
