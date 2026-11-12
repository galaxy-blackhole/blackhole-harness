/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Mặt vào của gói cordis-host-runner: export ĐÚNG như bản gốc
 *      (default DynamicCordisRunnerService · named DynamicCordisRunnerService · CordisInspectRegistryService · 4 brand function mang tên id)
 */

export { DynamicCordisRunnerService } from "./service.ts";
export { default } from "./service.ts";
export { CordisInspectRegistryService } from "./service.ts";
export {
  brandApprovalRequestId as ApprovalRequestId,
  brandCordisDynamicPackageId as CordisDynamicPackageId,
  brandCordisDynamicPluginId as CordisDynamicPluginId,
  brandCordisDynamicPluginRunId as CordisDynamicPluginRunId,
} from "./service-support.ts";
export type * from "./types.ts";
export type {
  DynamicCordisDefineReceipt,
  DynamicCordisDefineRequest,
  DynamicCordisDefinition,
  DynamicCordisHandler,
  DynamicCordisPackageInspection,
  DynamicCordisPlugin,
  DynamicCordisPluginInspection,
  DynamicCordisReference,
  DynamicCordisRun,
} from "./registry.ts";
export type { HostCordisInspectProviderRegistration } from "./inspect-registry.ts";
export type { Config, DynamicCordisSnapshotRow } from "./service.ts";
