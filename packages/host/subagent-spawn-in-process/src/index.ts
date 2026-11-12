/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Spawn-in-process: backend SPAWN trong
 *      cùng tiến trình — đăng ký một SubagentProvider tên `spawn` trên seam `ctx.subagents`.
 *      Nguồn đối chiếu: xem README.md của package (G4).
 */
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { SubagentProvider } from "@galaxy-blackhole/gbh-subagent";

/**
 * Mặt cấu trúc của seam `subagents` — CHỈ phần plugin này tiêu thụ (ADR 000d, 08/11/2026 dev-1, Lead chỉ định).
 * Bản port của `gbh-subagent` không tái khai augmentation `Context.subagents` của bản gốc nên ta đọc seam qua
 * `ctx.get("subagents")`; thiếu seam là lỗi cấu hình nên ném NGAY.
 */
interface SubagentsSeamLike {
  /** Đăng ký một backend vào sổ provider của seam; trả hàm gỡ. */
  registerProvider(provider: SubagentProvider): () => void;
}

/**
 * Lấy seam `subagents` từ context; thiếu thì ném ngay thay vì chạy tiếp với `undefined`.
 * Nhận: `ctx` — context host. Trả: mặt cấu trúc của sổ provider subagent.
 */
function subagentsOf(ctx: Context): SubagentsSeamLike {
  // Kernel công bố service theo HAI đường cùng nghĩa: `ctx.get(name)` và thuộc tính `ctx.<name>`.
  const viaGet = typeof ctx.get === "function" ? (ctx.get("subagents") as SubagentsSeamLike | undefined) : undefined;
  const viaProperty = (ctx as unknown as { readonly subagents?: SubagentsSeamLike }).subagents;
  const seam = viaGet ?? viaProperty;
  if (seam === undefined) {
    throw new TypeError("subagent-spawn-in-process requires the subagents seam (ctx.get(\"subagents\"))");
  }
  return seam;
}

import { SpawnInProcessProvider } from "./provider.ts";

/** Tên plugin cordis — NGUYÊN VĂN bản gốc (`subagent-spawn-in-process`). */
export const name = "subagent-spawn-in-process";

/** Seam bắt buộc: sổ backend subagent của kernel (`ctx.subagents`) — chờ tới khi row `subagent` cấp nó. */
export const inject: string[] = ["subagents"];

/** Cấu hình của row: chỉ có tên đăng ký provider trong sổ `ctx.subagents`. */
export interface Config {
  /** Tên provider trong sổ `ctx.subagents` (mặc định `spawn`). */
  providerName: string;
}

/**
 * Schema cấu hình (schemastery) — để Settings/config-editor của kernel render được field, và để tầng nạp
 * điền mặc định `spawn` khi patch không khai `providerName`.
 */
export const Config: z<Config> = z.object({
  providerName: z.string().default("spawn"),
}) as unknown as z<Config>;

/**
 * Đăng ký backend SPAWN vào sổ provider của seam `subagents`. Không giữ tham chiếu nào: seam tự bind
 * vòng đời (nó dùng `ctx.effect` bên trong `registerProvider`), nên hàm này KHÔNG trả disposer.
 * Nhận: context host đã có seam `subagents`, và cấu hình đã qua schema.
 * Trả: không trả gì; hiệu ứng là một provider tên `config.providerName` nằm trong sổ provider.
 */
export function apply(ctx: Context, config: Config): void {
  subagentsOf(ctx).registerProvider(new SpawnInProcessProvider(config.providerName));
}
