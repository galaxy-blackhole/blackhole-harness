/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao cordis cua row `otel`: dich vu `otel` tao hai loai kenh OTLP doc lap (su kien thuong + log phien).
 */
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import { EventLogReporter, type EventLogOptions } from "./event-log.ts";
import { SessionLogReporter, type SessionLogOptions } from "./session-log.ts";

declare module "@deepseek-ai/cordis" {
  /** Bo sung dich vu `otel` vao Context cua kernel. */
  interface Context {
    /** Kenh bao su kien thuong + log phien qua OTLP. */
    otel: OTel;
  }
}

/** Nha cung cap van chuyen dung chung. Mount len KHONG tao hang doi, danh tinh hay ket noi mang nao. */
export default class OTel extends Service {
  /** @param ctx - context cua kernel; dich vu duoc dang ky ngay duoi ten `otel`. */
  constructor(ctx: Context) {
    super(ctx, "otel");
  }

  /**
   * Tao mot kenh su kien thuong doc lap, gom lo theo SO LUONG.
   * Ben goi inject phai rut sach kenh nay trong luc huy fiber cua no.
   * @param options - van chuyen, scope, resource, hang doi va chan doan do ben goi chon.
   * @returns kenh thuoc so huu cua ben goi; khong chia se trang thai voi kenh nao khac.
   */
  createEventReporter(options: EventLogOptions): EventLogReporter {
    return new EventLogReporter(options);
  }

  /**
   * Tao mot kenh log phien doc lap, gom lo theo BYTE.
   * Cap phep va lam sach duoc lam TRUOC khi bao; ben goi so huu shutdown va han chot ngoai cua no.
   * @param options - van chuyen, scope, resource, hang doi va chan doan do ben goi chon.
   * @returns kenh thuoc so huu cua ben goi, giu NGUYEN VE su kien da nhan trong tran byte cua request.
   */
  createSessionLogReporter(options: SessionLogOptions): SessionLogReporter {
    return new SessionLogReporter(options);
  }
}

export type { EventLogOptions, OTelEventRecord, OTelEventScalar, EventLogReporter } from "./event-log.ts";
export type { SessionLogProcessorOptions, SessionLogRecord, SessionLogOptions, SessionLogReporter } from "./session-log.ts";
export type { LogExporterOptions } from "./transport.ts";
