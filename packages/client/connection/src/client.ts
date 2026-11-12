/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Điểm vào nửa CLIENT: tự đăng ký HAI id module với __ModuleLoader__, xuất ĐÚNG bề mặt bản gốc
 */

import { apply, installConnection } from "./client/plugin.ts";
import { PACKAGE_NAME } from "./ids.ts";
import { RpcId, transportError } from "./rpc-id.ts";

/** Service bắt buộc của nửa client: không có (đây là gốc của dây). */
export const inject: string[] = [];

/** Bề mặt module mà factory trả về cho Loader — đúng năm tên bản gốc xuất. */
const moduleExports = { apply, inject, installConnection, RpcId, transportError };

/** Hình dạng tối thiểu của Loader trong trang. */
interface ModuleLoaderGlobal {
  /** Đăng ký một factory theo id module; thân module chỉ chạy ở lần vạt chất hoá đầu tiên. */
  load(registration: { id: string; factory: (require: unknown) => unknown }): void;
}

/**
 * Đăng ký bundle dưới HAI id trong MỘT lần thực thi: id của ta và id gói gốc DSH.
 *
 * Vì sao hai id: các entry STOCK khác `inject` id gốc của row này, và tầng nạp phân giải dependency bằng
 * `graphRows.get(id)` (packages/client/modules/src/client/system.ts:348) — thiếu graph row mang id stock thì
 * chúng chờ mãi ở `loading`. Row này có BA gói phụ thuộc như vậy: `locale`, `ui-permission`, `ui-reference`.
 *
 * Vì sao MỘT lần thực thi là đủ và AN TOÀN: từ bản A+B của `gbh-client-modules` (17/10/2026), entry alias do
 * host phát dùng ĐÚNG URL của row sở hữu, và nửa browser khử trùng theo URL đã thực thi
 * (`executedBundleUrls.has(url) && factories.has(ownerOf(id))` ⇒ coi như registered). Trước A+B, hai id ⇒
 * bundle chạy hai lần ⇒ `duplicate factory registration` (sự cố app trắng lần hai). Vì vậy THỨ TỰ BẮT BUỘC:
 * loader A+B phải được mount TRƯỚC, rồi mới bật đăng ký id thứ hai — xem `gbh.row.aliases` trong package.json.
 */
function registerBundle(): void {
  const loader = (globalThis as { __ModuleLoader__?: ModuleLoaderGlobal }).__ModuleLoader__;
  if (loader === undefined) throw new Error("client-connection: window.__ModuleLoader__ chua san sang");
  const factory = (): unknown => moduleExports;
  /* ĐÚNG MỘT id: id của ta. Id gốc KHÔNG đăng ký ở bundle — nó chỉ khai ở `gbh.row.aliases`, và tầng nạp
     (A+B, 17/10/2026) tự sinh entry alias dùng CÙNG URL rồi trả bản sao có `apply` no-op ⇒ một bundle ⇒ một
     plugin. Đăng ký id gốc ở đây là dạng cũ: bundle chạy hai lần ⇒ `duplicate factory registration`. */
  loader.load({ id: PACKAGE_NAME, factory });
}

registerBundle();

export { apply, installConnection, RpcId, transportError };
export type { ConnectionHandle, ConnectionInstallOptions, ConnectionInteractions, ClientTransportHooks, ConnectionLocation } from "./client/plugin.ts";
export type { ConnectionGeneration, ConnectionGenerationSource, ConnectionHostInfo, ConnectionSinks, ConnectionState } from "./client/connection.ts";
export type { ClientConnectionRpc, RpcFetch, RpcStreamOpen } from "./client/rpc.ts";
export type { ConnectionWebSocket, ConnectionWebSocketFactory } from "./client/socket.ts";
export type { RpcResult } from "./client/api.ts";
