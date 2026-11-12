/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao cordis cua row `desktop-product-telemetry`: bo phan phoi su kien san pham qua kenh OTLP do row `otel` cap.
 */
import { validateHeaderValue } from "node:http";
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { CompressionAlgorithm } from "@opentelemetry/otlp-exporter-base";

declare module "@deepseek-ai/cordis" {
  /** Bo sung dich vu `productTelemetry` vao Context cua kernel. */
  interface Context {
    /** Kenh bao su kien san pham do row nay cap. */
    productTelemetry: ProductTelemetry;
  }
}

/** Gia tri vo huong ma thuoc tinh su kien san pham chap nhan (kieu Arrow cua collector). */
export type ProductTelemetryScalar = string | number | boolean;

/**
 * Ban ghi su kien do ben goi CHON TUONG MINH; khop tung truong voi ban ghi ma row `otel` nhan.
 * Khong co truong danh tinh thiet bi hay tai khoan: chinh sach tiet lo thuoc ben goi.
 */
export interface ProductTelemetryRecord {
  /** Ten su kien do ben san pham/DA so huu. */
  eventName: string;
  /** Tom tat nguoi doc duoc; khong bao gio la prompt, phan hoi, credential hay noi dung tep. */
  body: string;
  /** Thoi diem su kien xay ra, tinh bang mili-giay Unix; thoi diem quan sat do kenh gan luc xep hang doi. */
  timestamp: number;
  /** Do nghiem trong OTel; bo qua thi kenh dung INFO. */
  severityNumber?: number;
  /** Truong nghiep vu do ben goi chon, chi gom vo huong hoac mot cap doi tuong vo huong. */
  attributes?: Record<string, ProductTelemetryScalar | Record<string, ProductTelemetryScalar>>;
}

/** Diem den collector, danh tinh ung dung va cac tran gom lo trong bo nho. */
export interface Config {
  /** URL log HTTP(S) day du. */
  endpoint: string;
  /** Header dinh tuyen cua collector (`x-channel`). */
  channel: string;
  /** Resource `service.name` do composition cua ung dung cap. */
  serviceName: string;
  /** Resource `service.version` do composition cua ung dung cap. */
  serviceVersion: string;
  /** Bo qua de ton trong OTEL_EXPORTER_OTLP_LOGS_COMPRESSION / OTEL_EXPORTER_OTLP_COMPRESSION. */
  compression?: "none" | "gzip";
  /** So ban ghi toi da moi lan export; khong duoc vuot `maxQueueSize`. */
  maxExportBatchSize: number;
  /** So ban ghi toi da trong hang doi; SDK bo ban ghi MOI khi day. */
  maxQueueSize: number;
  /** Tre truoc khi export mot lo chua day. */
  scheduledDelayMillis: number;
  /** Han HTTP cua exporter, gom ca cac lan thu loi tam thoi cua SDK. */
  timeoutMillis: number;
  /** Han cua mot lan export lo phia processor. */
  exportTimeoutMillis: number;
  /** Han rut sach; het han se huy cac lan export dang cho truoc khi disposal xong. */
  shutdownTimeoutMillis: number;
}

/**
 * Schema so nguyen duong co tran 2147483647 (gioi han hen gio cua setTimeout).
 * @returns schema so nguyen duong, buoc 1.
 */
const positiveInteger = () => z.number().step(1).min(1).max(2147483647);

/** Kiem tra va mac dinh cho composition cua ung dung. */
export const Config = z.object({
  endpoint: z.string().default("https://dsh-otel-collector.deepseeksvc.com/v1/logs"),
  channel: z.string().min(1).default("dsh_otel_report"),
  serviceName: z.string().required(),
  serviceVersion: z.string().required(),
  compression: z.union(["none", "gzip"]),
  maxExportBatchSize: positiveInteger().default(512),
  maxQueueSize: positiveInteger().default(2048),
  scheduledDelayMillis: positiveInteger().default(3e4),
  timeoutMillis: positiveInteger().default(15e3),
  exportTimeoutMillis: positiveInteger().default(2e4),
  shutdownTimeoutMillis: positiveInteger().default(21e3),
});

/** Mot kenh su kien thuong do row `otel` cap; fiber cua ben goi so huu vong doi cua no. */
interface ProductEventChannel {
  /** Xep hang doi mot ban ghi, khong cho mang. */
  emit(record: ProductTelemetryRecord): void;
  /** Rut sach hang doi va don van chuyen; `signal` huy cac lan gui dang cho. */
  shutdown: (signal?: AbortSignal) => Promise<void>;
}

/** Bo phan phoi su kien san pham. Mount len KHONG gui gi; fiber so huu rut sach no khi unload. */
export default class ProductTelemetry extends Service {
  /** Seam bat buoc: kenh OTLP do row `otel` cap (kernel cap MOT the hien). */
  static inject = ["otel"];

  /** Schema Loader dung cho composition cua ung dung. */
  static Config = Config;

  /** Kenh su kien thuoc so huu cua fiber nay. */
  private readonly reporter: ProductEventChannel;

  /**
   * Kiem cau hinh van chuyen roi mo MOT kenh su kien thuong qua row `otel`.
   * @param ctx - context cua kernel; dich vu duoc dang ky duoi ten `productTelemetry`.
   * @param config - diem den, danh tinh ung dung va cac tran gom lo trong bo nho.
   * @throws khi endpoint hoac channel khong hop le, giao thuc khong phai HTTP(S), hay batch vuot queue.
   */
  constructor(ctx: Context, config: Config) {
    let endpoint: URL;
    try {
      endpoint = new URL(config.endpoint);
    } catch (cause) {
      throw new Error("product-telemetry-otel: endpoint must be a valid HTTP(S) URL", { cause });
    }
    try {
      validateHeaderValue("x-channel", config.channel);
    } catch (cause) {
      throw new Error("product-telemetry-otel: channel must be a valid HTTP header value", { cause });
    }
    if (!["http:", "https:"].includes(endpoint.protocol)) throw new Error("product-telemetry-otel: endpoint must use HTTP or HTTPS");
    if (config.maxExportBatchSize > config.maxQueueSize) throw new Error("product-telemetry-otel: maxExportBatchSize must not exceed maxQueueSize");
    super(ctx, "productTelemetry");
    const reporter = ctx.otel.createEventReporter({
      exporter: {
        url: config.endpoint,
        headers: { "x-channel": config.channel },
        timeoutMillis: config.timeoutMillis,
        ...(config.compression === void 0
          ? {}
          : { compression: config.compression === "gzip" ? CompressionAlgorithm.GZIP : CompressionAlgorithm.NONE }),
      },
      resourceAttributes: {
        "service.name": config.serviceName,
        "service.version": config.serviceVersion,
      },
      scope: { name: "@deepseek-ai/dsh-host-product-telemetry-otel" },
      processor: {
        maxExportBatchSize: config.maxExportBatchSize,
        maxQueueSize: config.maxQueueSize,
        scheduledDelayMillis: config.scheduledDelayMillis,
        exportTimeoutMillis: config.exportTimeoutMillis,
      },
      onFailure: (message, error) => {
        ctx.logger.warn(message, error);
      },
    });
    this.reporter = reporter;
    ctx.effect(() => async () => {
      const cancellation = new AbortController();
      const timer = setTimeout(() => {
        ctx.logger.warn("Product telemetry shutdown deadline exceeded; pending events may be lost");
        cancellation.abort(new Error("Product telemetry shutdown deadline exceeded"));
      }, config.shutdownTimeoutMillis);
      try {
        await reporter.shutdown(cancellation.signal);
      } finally {
        clearTimeout(timer);
      }
    });
  }

  /**
   * Xep hang doi MOT su kien san pham da chon, KHONG cho mang.
   * Hang doi duoc nhan va shutdown hoan tat deu KHONG phai xac nhan cua collector hay kho du lieu.
   * @param record - su kien do ben goi so huu, chi chua truong phan tich da duoc duyet.
   */
  emit(record: ProductTelemetryRecord): void {
    this.reporter.emit(record);
  }
}
