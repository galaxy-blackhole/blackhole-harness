/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tang van chuyen OTLP JSON cho kenh log phien: do cach rieng, khong thua huong header/TLS cua collector khac.
 */
import { OTLPExporterBase, createOtlpNetworkExportDelegate, getSharedConfigurationDefaults, mergeOtlpSharedConfigurationWithDefaults } from "@opentelemetry/otlp-exporter-base";
import type { ExporterMetrics, OTLPExporterNodeConfigBase } from "@opentelemetry/otlp-exporter-base";
import { JsonLogsSerializer, LogsExporterMetricsHelper } from "@opentelemetry/otlp-transformer";
import { createOtlpHttpExportDelegate, createOtlpHttpExporterMetrics, getSharedConfigurationFromEnvironment, httpAgentFactoryFromOptions } from "@opentelemetry/otlp-exporter-base/node-http";
import type { LogRecordExporter, ReadableLogRecord } from "@opentelemetry/sdk-logs";

/** `otel.component.type` ma chinh exporter OTLP HTTP bao len cho metrics tu-quan-sat cua no. */
export const OTLP_HTTP_LOG_EXPORTER_COMPONENT_TYPE = "otlp_http_log_exporter";

/**
 * Cau hinh collector + HTTP ma exporter log cua package nay nhan.
 *
 * `OTLPExporterConfigBase.selfObsMeterProvider` bi loai: moi kenh o day truyen `undefined` cho
 * bo ghi metrics cua exporter, nen no khong ghi gi.
 */
export type LogExporterOptions = Omit<OTLPExporterNodeConfigBase, "selfObsMeterProvider"> & {
  /** Diem den log HTTP(S) day du (vi du `http://127.0.0.1:4318/v1/logs`). */
  url: string;
};

/**
 * Tao exporter JSON cua SDK ma KHONG thua huong header hay danh tinh TLS cua mot collector khac.
 * @param options - diem den, header, agent va cac thiet lap HTTP cua SDK do ben goi chon.
 * @returns exporter thuoc so huu cua dung mot duong ong log.
 */
export function createLogExporter(options: LogExporterOptions): LogRecordExporter {
  return new OTLPExporterBase(
    createOtlpHttpExportDelegate(logTransportOptions(options), JsonLogsSerializer, OTLP_HTTP_LOG_EXPORTER_COMPONENT_TYPE, LogsExporterMetricsHelper, void 0),
  );
}

/**
 * Tao bo ghi metrics tu-quan-sat cua mot exporter log; khong co meter provider thi no khong ghi gi.
 * @param url - diem den collector, duoc ghi lam dia chi va cong cua metrics.
 * @returns bo ghi metrics ma delegate export log OTLP HTTP yeu cau.
 */
export function createLogExporterMetrics(url: string): ExporterMetrics<ReadableLogRecord[]> {
  return createOtlpHttpExporterMetrics(OTLP_HTTP_LOG_EXPORTER_COMPONENT_TYPE, LogsExporterMetricsHelper, url, void 0);
}

/**
 * Gop header va agent CUC BO cua collector voi mac dinh timeout/compression dung chung cua SDK.
 * @param options - diem den va thiet lap HTTP cua SDK do ben goi chon.
 * @returns thiet lap van chuyen da resolve, KHONG mang credential ambient.
 */
export function logTransportOptions(options: LogExporterOptions): Parameters<typeof createOtlpHttpExportDelegate>[0] {
  const headers = async (): Promise<Record<string, string>> => ({
    "Content-Type": "application/json",
    ...(typeof options.headers === "function" ? await options.headers() : options.headers),
  });
  const agentFactory =
    typeof options.httpAgentOptions === "function"
      ? options.httpAgentOptions
      : httpAgentFactoryFromOptions({ keepAlive: options.keepAlive ?? true, ...options.httpAgentOptions });
  return {
    ...mergeOtlpSharedConfigurationWithDefaults(options, getSharedConfigurationFromEnvironment("LOGS"), getSharedConfigurationDefaults()),
    url: options.url,
    headers,
    agentFactory,
    ...(options.userAgent === void 0 ? {} : { userAgent: options.userAgent }),
  };
}
