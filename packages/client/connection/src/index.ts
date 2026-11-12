/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Điểm vào nửa HOST: xuất ĐÚNG bề mặt bản gốc (apply, inject, name, Config, service, schema)
 */
export { API_PATH, CONNECT_PATH, Config, HostConnectionService, Peer, RpcId, apply, clientRequestSchema, inject, name, rpcErrorSchema, rpcIdSchema, rpcMessageSchema, rpcResultSchema, serverResponseSchema, transportError } from "./host/index.ts";
export type { ConnectionConfig } from "./host/index.ts";
export type { ConnectionRpcHandlerResult, PeerOptions, PeerPrincipal } from "./host/rpc-host.ts";
export type { ConnectionRecoveryConfig } from "./recovery-config.ts";
