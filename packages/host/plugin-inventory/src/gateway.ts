/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Gateway remote cua inventory plugin: ke thua TypertRemoteService, endpoint list.
 */
import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@galaxy-blackhole/gbh-typert-protocol";
import { readPluginInventory } from "./inventory.ts";
import { pluginEntryId, type PluginInventorySnapshot } from "./types.ts";

/**
 * Service chi danh cho remote: phoi trang thai entry hien tai cua Loader.
 *
 * Peer `@galaxy-blackhole/gbh-typert-protocol` la seam RPC cua kernel (luat §3b cua packages/README.md): lop nay phai
 * ke thua dung base class do de Gateway cua kernel discovery duoc, va o M3 kernel cua ta phoi cung ten goi do.
 */
export class PluginInventoryGateway extends TypertRemoteService {
  /** Seam can co: cay Loader. */
  static inject = ["loader"];

  /**
   * Dang ky service `pluginInventory` va bind cung key vao Typert Gateway.
   * @param ctx - context cua plugin.
   */
  constructor(ctx: Context) {
    super(ctx, "pluginInventory");
  }

  /**
   * Doc Loader truc tiep moi lan goi (khong cache).
   * @returns anh chup inventory hien tai, kem composition tung preset khi co roster.
   */
  @Remote("list")
  async list(): Promise<PluginInventorySnapshot> {
    return readPluginInventory((this as unknown as { ctx: Context }).ctx);
  }
}

export default PluginInventoryGateway;
export { pluginEntryId };
