/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Giữ con trỏ terminal nhìn thấy được trên mọi nền ô: mặc định, theo chỉ số, true-color và ô đảo màu
 */

import type { TerminalLike } from "./theme.ts";

/** Emulator có sự kiện vẽ, đủ để theo dõi con trỏ. */
export interface RenderingTerminalLike extends TerminalLike {
  /** Gọi lại sau mỗi lần vẽ; trả hàm huỷ. */
  onRender(handler: () => void): { dispose(): void };
}

/**
 * Độ sáng tương đối của một màu (WCAG).
 * Nhận: màu #rrggbb hoặc rgb()/rgba().
 * Trả: độ sáng 0..1.
 */
function luminance(color: string): number {
  const [r, g, b] = colorChannels(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Ba (hoặc bốn) kênh số của một màu.
 * Nhận: #rrggbb hoặc chuỗi rgb()/rgba().
 * Trả: mảng kênh.
 */
function colorChannels(color: string): number[] {
  return color.startsWith("#")
    ? [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map((value) => Number.parseInt(value, 16))
    : (color.match(/[\d.]+/gu) ?? []).map(Number);
}

/**
 * Trộn một màu có thể trong suốt lên nền để được màu đục.
 * Nhận: màu cần trộn và hàm lấy màu nền.
 * Trả: màu đục dạng #... hoặc rgb(...).
 */
function opaqueColor(color: string, background: () => string): string {
  const channels = colorChannels(color);
  const alpha = channels[3] ?? 1;
  if (alpha === 1) return color;
  const surface = colorChannels(background());
  return (
    "rgb(" +
    channels
      .slice(0, 3)
      .map((channel, index) => Math.round(channel * alpha + (surface[index] as number) * (1 - alpha)))
      .join(", ") +
    ")"
  );
}

/**
 * Giữ con trỏ nhìn thấy được trên mọi loại nền ô.
 * Nhận: emulator đã mở, phần tử gốc của màn (nơi đặt biến CSS) và hàm lấy màu con trỏ ưu tiên.
 * Trả: hàm huỷ; không phát sự kiện nhập liệu hay đổi bảng màu.
 */
export function observeTerminalCursor(
  terminal: RenderingTerminalLike,
  node: HTMLElement,
  preferredCursor: () => string | undefined,
): { dispose(): void } {
  return terminal.onRender(() => {
    const cursor = node.querySelector(".xterm-cursor");
    if (cursor === null) return;
    cursor.classList.remove("xterm-cursor");
    let background: string;
    let foreground: string;
    try {
      const style = getComputedStyle(cursor);
      foreground = style.color;
      const scrollable = node.querySelector(".xterm-scrollable-element");
      background = opaqueColor(style.backgroundColor, () =>
        scrollable === null ? "rgb(0, 0, 0)" : getComputedStyle(scrollable).backgroundColor,
      );
    } finally {
      cursor.classList.add("xterm-cursor");
    }
    const preferred = opaqueColor(preferredCursor() ?? background, () => background);
    const backgroundLuminance = luminance(background);
    const preferredLuminance = luminance(preferred);
    // Giữ con trỏ nổi khỏi nền theo tỉ lệ tương phản WCAG 3:1, nếu không thì dùng chính nền.
    const fill =
      (Math.max(backgroundLuminance, preferredLuminance) + 0.05) /
        (Math.min(backgroundLuminance, preferredLuminance) + 0.05) >=
      3
        ? preferred
        : backgroundLuminance > 0.5
          ? "#000000"
          : "#ffffff";
    node.style.setProperty("--terminal-cursor", fill);
    node.style.setProperty("--terminal-cursor-accent", luminance(fill) > 0.179 ? "#000000" : "#ffffff");
    node.style.setProperty("--terminal-cursor-cell-background", background);
    node.style.setProperty("--terminal-cursor-cell-foreground", foreground);
  });
}
