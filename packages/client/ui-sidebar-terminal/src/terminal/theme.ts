/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bảng màu terminal: theo dõi OSC 4/10/11/12 của ứng dụng mà không giành xử lý với xterm
 */

/** Tám màu ANSI thường và tám màu sáng, theo thứ tự chỉ số OSC. */
const ANSI_KEYS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
] as const;

/** Ba màu đặc biệt mà OSC 10/11/12 đặt được. */
const SPECIAL_KEYS = ["foreground", "background", "cursor"] as const;

/** Emulator tối thiểu mà bảng màu này cần. */
export interface TerminalLike {
  /** Tuỳ chọn của emulator (đổi theme ở đây). */
  options: Record<string, unknown>;
  /** Bộ phân tích chuỗi điều khiển của terminal. */
  parser: {
    /** Theo dõi một mã OSC; trả hàm huỷ. */
    registerOscHandler(code: number, handler: (data: string) => boolean): { dispose(): void };
  };
}

/** Một màu theo chỉ số ANSI. */
type TermColor = string;

/**
 * Chỉ số bảng màu từ tham số OSC, hoặc undefined nếu không phải số 0..255.
 * Nhận: tham số dạng chuỗi.
 * Trả: chỉ số, hoặc undefined.
 */
function colorIndex(value: string): number | undefined {
  return /^\d+$/u.test(value) && Number(value) < 256 ? Number(value) : undefined;
}

/**
 * Đổi một màu OSC thành #rrggbb.
 * Nhận: chuỗi dạng rgb:r/g/b (mỗi kênh cùng độ dài) hoặc #rgb/#rrggbb/#rrrrggggbbbb.
 * Trả: màu đã chuẩn hoá, hoặc undefined nếu không hợp lệ.
 */
function oscColor(value: string): TermColor | undefined {
  const rgb = /^rgb:([\da-f]{1,4})\/([\da-f]{1,4})\/([\da-f]{1,4})$/iu.exec(value);
  let channels: string[];
  if (rgb !== null) {
    channels = rgb.slice(1) as string[];
    if (!channels.every((channel) => channel.length === channels[0]?.length)) return undefined;
  } else {
    if (!/^#(?:[\da-f]{3}){1,4}$/iu.test(value)) return undefined;
    const width = (value.length - 1) / 3;
    channels = [
      value.slice(1, width + 1),
      value.slice(width + 1, 2 * width + 1),
      value.slice(2 * width + 1),
    ];
  }
  return (
    "#" +
    channels
      .map((channel) => {
        const scaled =
          rgb === null
            ? Number.parseInt(channel.padEnd(2, "0").slice(0, 2), 16)
            : Math.round((Number.parseInt(channel, 16) * 255) / (16 ** channel.length - 1));
        return scaled.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

/**
 * Giữ màu do chương trình đặt tách khỏi mặc định của DSH, để OSC reset trả về đúng mặc định.
 */
export class TerminalTheme {
  /** Emulator đang được gắn theme. */
  private readonly terminal: TerminalLike;
  /** Màu mặc định lấy từ DSH. */
  private defaults: Record<string, string> = {};
  /** Màu theo chỉ số bảng màu do ứng dụng đặt. */
  private readonly indexed = new Map<number, TermColor>();
  /** Màu đặc biệt (foreground · background · cursor) do ứng dụng đặt. */
  private readonly special = new Map<string, TermColor>();
  /** Các đăng ký OSC để huỷ khi tháo. */
  private readonly subscriptions: { dispose(): void }[];

  /**
   * Theo dõi các lệnh OSC trọn vẹn mà không tiêu thụ truy vấn hay phần xử lý màu của xterm.
   * Nhận: emulator đã mở của màn đang gắn.
   * Trả: đối tượng bảng màu dùng được ngay.
   */
  constructor(terminal: TerminalLike) {
    this.terminal = terminal;
    const observe = (code: number, change: (data: string) => void): { dispose(): void } =>
      terminal.parser.registerOscHandler(code, (data: string) => {
        change(data);
        return false;
      });
    this.subscriptions = [
      observe(4, (data) => {
        const parts = data.split(";");
        for (let index = 0; index + 1 < parts.length; index += 2) {
          const slot = colorIndex(parts[index] as string);
          const color = oscColor(parts[index + 1] as string);
          if (slot !== undefined && color !== undefined) this.indexed.set(slot, color);
        }
      }),
      observe(104, (data) => {
        if (data === "") this.indexed.clear();
        else {
          for (const part of data.split(";")) {
            const slot = colorIndex(part);
            if (slot !== undefined) this.indexed.delete(slot);
          }
        }
        this.apply();
      }),
      ...SPECIAL_KEYS.flatMap((key, offset): { dispose(): void }[] => [
        observe(10 + offset, (data) => {
          for (const [index, part] of data.split(";").entries()) {
            const target = SPECIAL_KEYS[offset + index];
            const color = oscColor(part);
            if (target !== undefined && color !== undefined) this.special.set(target, color);
          }
        }),
        observe(110 + offset, () => {
          this.special.delete(key);
          this.apply();
        }),
      ]),
    ];
  }

  /**
   * Áp màu DSH mới mà không ghi đè các mục bảng màu do ứng dụng đặt.
   * Nhận: nền và màu chữ đã phân giải của DSH.
   * Trả: không.
   */
  update(background: string, foreground: string): void {
    if (this.defaults.background === background && this.defaults.foreground === foreground) return;
    this.defaults = {
      background,
      foreground,
      cursor: foreground,
      cursorAccent: background,
      selectionBackground: foreground,
      selectionForeground: background,
      selectionInactiveBackground: foreground,
    };
    this.apply();
  }

  /** Màu con trỏ đang dùng, kể cả khi ứng dụng ghi đè bằng OSC 12. */
  get cursor(): string | undefined {
    return this.special.get("cursor") ?? this.defaults.cursor;
  }

  /**
   * Gỡ các bộ theo dõi trước khi emulator bị tháo.
   * Nhận: không.
   * Trả: không.
   */
  dispose(): void {
    for (const subscription of this.subscriptions) subscription.dispose();
  }

  /**
   * Ghép mặc định + màu đặc biệt + bảng màu chỉ số rồi gán vào tuỳ chọn của emulator.
   * Nhận: không.
   * Trả: không.
   */
  private apply(): void {
    const theme: Record<string, unknown> = { ...this.defaults, ...Object.fromEntries(this.special) };
    for (const [index, color] of this.indexed) {
      if (index < ANSI_KEYS.length) theme[ANSI_KEYS[index] as string] = color;
      else {
        const extended = (theme.extendedAnsi as TermColor[] | undefined) ?? [];
        extended[index - ANSI_KEYS.length] = color;
        theme.extendedAnsi = extended;
      }
    }
    this.terminal.options.theme = theme;
  }
}
