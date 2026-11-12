/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Exporter cua kenh su kien THUONG: HTTP co the huy (got), retry va watchdog byte giong ban goc.
 */
import { gzipSync } from "node:zlib";
import got from "got";
import { OTLPExporterBase, OTLPExporterError, createOtlpNetworkExportDelegate } from "@opentelemetry/otlp-exporter-base";
import { JsonLogsSerializer } from "@opentelemetry/otlp-transformer";
import type { LogRecordExporter } from "@opentelemetry/sdk-logs";
import type { Agent } from "node:http";
import type { ExportResponse } from "@opentelemetry/otlp-exporter-base";
import { createLogExporterMetrics, logTransportOptions, type LogExporterOptions } from "./transport.ts";

/** Tran byte cua than phan hoi: vuot thi huy request (ban goc: 4 MiB). */
const RESPONSE_BYTE_CEILING = 4 * 1024 * 1024;

/** So lan retry toi da cua got, va cac ma trang thai duoc coi la dang retry. */
const RETRY_LIMIT = 5;
/** Cac ma HTTP duoc retry (giong ban goc). */
const RETRY_STATUS_CODES = [429, 502, 503, 504];
/** Tran backoff cua got (ms). */
const RETRY_BACKOFF_LIMIT_MS = 5_000;

/**
 * Tao exporter thuoc so huu cua MOT kenh, huy duoc: abort se tra request va bo hen retry.
 * @param options - diem den collector va thiet lap HTTP cua SDK.
 * @param signal - tin hieu huy cua kenh, dung chung cho ca lo hien tai lan cac lo sau.
 * @returns exporter cua SDK; shutdown cung huy luon HTTP agent ma no so huu.
 */
export function createEventLogExporter(options: LogExporterOptions, signal: AbortSignal): LogRecordExporter {
  const config = logTransportOptions(options);
  const agentFactory = config.agentFactory;
  let agent: Agent | Promise<Agent> | undefined;
  const exporter = new OTLPExporterBase(
    createOtlpNetworkExportDelegate(
      config,
      JsonLogsSerializer,
      createLogExporterMetrics(config.url),
      {
        async send(data, timeoutMillis): Promise<ExportResponse> {
          signal.throwIfAborted();
          const protocol = new URL(config.url).protocol;
          agent ??= agentFactory(protocol);
          const selectedAgent = await agent;
          const headers = await config.headers();
          signal.throwIfAborted();
          const compressed = config.compression === "gzip";
          const request = got.post(config.url, {
            body: compressed ? gzipSync(data) : Buffer.from(data),
            headers: {
              ...headers,
              ...(compressed ? { "content-encoding": "gzip" } : {}),
              ...(config.userAgent === void 0 ? {} : { "user-agent": config.userAgent }),
            },
            ...(protocol === "https:"
              ? { agent: { https: selectedAgent as import("node:https").Agent } }
              : { agent: { http: selectedAgent as Agent } }),
            signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMillis)]),
            followRedirect: false,
            retry: {
              limit: RETRY_LIMIT,
              methods: ["POST"],
              statusCodes: RETRY_STATUS_CODES,
              errorCodes: [],
              backoffLimit: RETRY_BACKOFF_LIMIT_MS,
            },
            responseType: "buffer",
          });
          request.on("downloadProgress", ({ transferred }) => {
            if (transferred > RESPONSE_BYTE_CEILING) request.cancel();
          });
          const response = await request;
          // CUNG loai loi nhu van chuyen HTTP cua SDK (OTLPExporterError: message + statusCode + than loi)
          // de `onFailure` cua ben goi van doc duoc MA TRANG THAI, khong bi got boc thanh "Internal Server Error".
          if (response.statusCode >= 300) {
            const body: string | Uint8Array = response.body;
            const text = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
            throw new OTLPExporterError(response.statusMessage, response.statusCode, text);
          }
          // Van chuyen cua SDK doi `data` la BYTE (serializer JSON tu giai ma thanh `IExportLogsServiceResponse`).
          return { status: "success", data: new Uint8Array(response.body) };
        },
        shutdown() {
          // Agent thuoc so huu cua kenh: huy o `shutdown` ben ngoai, khong phai o day.
        },
      },
    ),
  );
  let shutdown: Promise<void> | undefined;
  return {
    export: (records, callback) => {
      exporter.export(records, callback);
    },
    forceFlush: () => exporter.forceFlush(),
    shutdown() {
      shutdown ??= (async () => {
        try {
          await exporter.shutdown();
        } finally {
          (await agent)?.destroy();
        }
      })();
      return shutdown;
    },
  };
}
