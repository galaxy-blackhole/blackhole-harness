/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Icon plugin của sidebar — port 1:1 vùng PluginsPanelIcon của bundle gốc
 *      (@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js dòng 4283-4292)
 */

import type { PluginManagerModules } from "./runtime.ts";

/** Props icon mà sidebar trao (bản gốc chỉ dùng `size`). */
export interface PanelIconProps {
  /** Cạnh icon mà sidebar yêu cầu. */
  readonly size?: number;
}

/** Nguyên liệu primitive mà icon cần. */
interface IconPrimitives {
  /** Icon bánh xe plugin. */
  readonly IconPluginPinwheelOutlineRegular: unknown;
}

/**
 * Dựng component icon từ bảng module của loader.
 * Nhận: modules — bảng module (jsx + primitive).
 * Trả: component icon.
 */
export function createPluginsPanelIcon(modules: PluginManagerModules): (props: PanelIconProps) => unknown {
  const primitives = modules.primitives as unknown as IconPrimitives;
  return function PluginsPanelIcon({ size }: PanelIconProps): unknown {
    return modules.jsxRuntime.jsx(primitives.IconPluginPinwheelOutlineRegular, { size });
  };
}
