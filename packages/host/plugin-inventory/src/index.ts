/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Diem vao cua package plugin-inventory: xuat gateway remote + ham doc inventory.
 */
export { default, PluginInventoryGateway, pluginEntryId } from "./gateway.ts";
export { readPluginInventory } from "./inventory.ts";
export type * from "./types.ts";
