/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Mat bootstrap phia browser cua row resources: cong bo ctx.resources + dong gop hook resource cho slots
 */

import { ResourceRegistry, type ResourceContext } from "./resources.ts";

export { ResourceRegistry, protocolOf } from "./resources.ts";
export {
  RESOURCE_SCHEME,
  LEGACY_RESOURCE_SCHEME,
  RESOURCE_SCHEME_PREFIX,
  LEGACY_RESOURCE_SCHEME_PREFIX,
  ACCEPTED_RESOURCE_SCHEMES,
  isResourceScheme,
  isResourceAddress,
  resourceAddress,
  resourcePatterns,
  resourceAddressPattern,
} from "../scheme.ts";
export type { ResourceFrame, ResourceOpenContext, ResourceProvider, ResourceSnapshot, ResourceStatus, Resources } from "./resources.ts";
export { createSnapshotStore } from "./store.ts";
export type { SnapshotStore } from "./store.ts";

/** Service phía browser mà plugin này cần: tầng slots của vỏ (nơi hook gốc §resource§ được đóng góp). */
export const inject = ["slots"];

/**
 * Thân plugin phía client: công bố §ctx.resources§ và đóng góp hook gốc §resource§ để mọi slot component
 * đọc được qua §useResource§.
 * Nhận: context gốc phía client.
 * Trả: không.
 */
/**
 * Cờ "đã cài" ở PHẠM VI MODULE (không phải trong `apply`).
 *
 * Row hai id làm loader có thể gọi factory hai lần ⇒ hai plugin instance ⇒ `ctx.reflect.provide("resources")`
 * và `ctx.slots.provideRoot(...)` chạy lần hai ⇒ cordis ném "already registered" ⇒ row kẹt `loading` ⇒
 * mọi row stock inject `resources` (5 row) cũng kẹt. Cờ này chặn lần cài thứ hai.
 */
let bundleInstalled = false;

/**
 * Thân plugin phía client: công bố §ctx.resources§ và đóng góp hook gốc §resource§.
 * @param ctx - context gốc phía client.
 */
export function apply(ctx: ResourceContext): void {
  if (bundleInstalled) {
    console.warn("gbh-client-resources: bundle da duoc cai, bo qua lan thu hai");
    return;
  }
  try {
    applyInner(ctx);
    /* CHỈ bật sau khi đăng ký XONG: nếu applyInner ném giữa đường thì cờ KHÔNG được khoá,
       nếu không lần cài thứ hai sẽ không đăng ký gì ⇒ slot rỗng ⇒ renderer gặp undefined ⇒ React #130. */
    bundleInstalled = true;
  } catch (error) {
    /* Cordis NUỐT lỗi trong apply ⇒ không có dòng này thì không ai biết vì sao row kẹt loading. Vẫn ném lại. */
    console.error("gbh-client-resources: apply nem loi", error);
    throw error;
  }
}

/**
 * Thân cài đặt thật của lần cài ĐẦU TIÊN.
 * @param ctx - context gốc phía client.
 */
function applyInner(ctx: ResourceContext): void {
  const resources = new ResourceRegistry(ctx);
  const disposeService = ctx.reflect.provide("resources", resources);
  ctx.effect(
    () => () => {
      disposeService();
    },
    "client-resources: service face",
  );
  ctx.slots.provideRoot({ keyedHooks: { resource: (address: string) => resources.source(address) } });
}

