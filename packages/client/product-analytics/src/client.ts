/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao nua client — chi xuat factory createPlugin cho build.ts bundle, va be mat service cho test
 */

export { applyInner, createAnalyticsService, createPlugin } from "./plugin.ts";
export type { ClientAnalyticsService, ClientContext, RequireFn } from "./plugin.ts";
