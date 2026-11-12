/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Startup`: bộ cấp cờ dòng lệnh của app web
 *      (`--host` · `--port` · `--public-url` · `--trusted-host` · `--no-open` · TLS) và văn bản `--help`,
 *      rồi công bố giá trị BẤT BIẾN thành service cordis `webStartup` để các row đọc qua config lười.
 */
import { Command } from "commander";
import { parseCmdline } from "@deepseek-ai/dsh-cmdline";
import { isWildcardHost, type TlsConfig } from "@galaxy-blackhole/gbh-host-webserver";
import type { Context } from "@deepseek-ai/cordis";
import { parsePublicUrl } from "./public-url.ts";

/** Tên plugin cordis ổn định — nguyên văn tên của row gốc. */
export const name = "web-startup";

/** Service phải có trước khi giải được cờ: chuỗi đối số launcher chuyển vào. */
export const inject: string[] = ["cmdlineArgs"];

/** Tên service mà plugin này cấp; các row cấu hình bằng cờ sẽ inject nó. */
export const WEB_STARTUP_SERVICE = "webStartup";

/** Những gì các row web đọc từ {@link WEB_STARTUP_SERVICE}. */
export interface WebStartupValues {
  /** Có mở trình duyệt mặc định sau khi khởi động không (`--no-open` đặt false). */
  readonly openBrowser: boolean;
  /** `--host`, VẮNG MẶT khi lệnh không nêu. */
  readonly host?: string;
  /** `--port`, VẮNG MẶT khi lệnh không nêu. */
  readonly port?: number;
  /** `--public-url`: gốc HTTP(S) công khai mà lượt gọi quảng bá; vắng mặt khi không nêu. */
  readonly publicUrl?: string;
  /** Các authority của `--trusted-host`, theo đúng thứ tự đối số. */
  readonly trustedHosts: string[];
  /** Chuỗi chứng chỉ máy chủ + khoá riêng không mật khẩu, chỉ có khi nêu ĐỦ cả hai cờ. */
  readonly tls?: TlsConfig;
}

/**
 * Văn bản trợ giúp in SAU danh sách cờ (kể cả dòng trống đầu và cuối).
 * 08/11/2026 — GIỮ NGUYÊN `dsh --profile web` (kể cả tên lệnh trong `.name()`): đây là chuỗi bị test
 * A/B ĐÓNG BĂNG ("--help in NGUYÊN VĂN văn bản trợ giúp gốc", tests/host/web-startup.test.ts:235); đổi
 * sang cú pháp `bh host` làm đỏ 7 dòng diff ⇒ xếp lớp "R4 (hoãn — test A/B pin chuỗi gốc)" như Lead đã chốt.
 */
const HELP_EXAMPLES = `
Examples:
  dsh --profile web                          serve on the composed host and port
  dsh --profile web --no-open                serve without opening a browser
  dsh --profile web --port 8080              serve on another port
  dsh --profile web --host 10.0.0.7          bind one local interface address
  dsh --profile web --public-url https://app.example/ui/ --trusted-host app.example
                                             advertise a prefix-stripping HTTPS proxy entry and admit its authority
  dsh --profile web --tls-cert ./server-chain.pem --tls-key ./server-key.pem
                                             serve HTTPS with an existing certificate and key
`;

/**
 * Dựng chương trình commander của app web: cờ, mô tả và văn bản trợ giúp.
 * Nhận: không.
 * Trả: một `Command` MỚI mỗi lần gọi, để một tiến trình parse được nhiều lần (test).
 */
function webCommand(): Command {
  return new Command()
    .name("dsh --profile web")
    .description("Serve the Galaxy Blackhole browser UI.")
    .helpOption("-h, --help", "show this help")
    .option("--host <host>", "bind address: one concrete IPv4 or IPv6 literal of a local interface; wildcard addresses are rejected")
    .option("--no-open", "do not open the Web UI in the default browser")
    .option("--port <port>", "listen port; pass 0 to let the OS pick a free one")
    .option("--public-url <url>", "advertise this HTTP(S) root in the printed, opened, runtime-context, and DSH_WEB_URL forms; grants no trust")
    .option("--trusted-host <authority...>", "extra authority the /api browser-trust fence accepts (host or host:port; repeatable)")
    .option("--tls-cert <file>", "PEM server certificate chain; requires --tls-key")
    .option("--tls-key <file>", "unencrypted PEM private key; requires --tls-cert")
    .addHelpText("after", HELP_EXAMPLES);
}

/**
 * Parse cờ của lượt gọi rồi cấp chúng thành service cordis thường.
 *
 * Hành động của lệnh công bố ĐÚNG những cờ lượt gọi này nêu. Cờ sai — kể cả chứng chỉ/khoá TLS
 * không đi thành cặp — là lỗi cách dùng; khi bị từ chối (và khi `--help`) KHÔNG có gì được cấp.
 * @param ctx - context plugin mang dòng lệnh (`cmdlineArgs`) và yêu cầu thoát của launcher (`appExit`).
 * @returns không trả gì; tác dụng phụ là `ctx.provide("webStartup", …)` khi parse thành công.
 */
export function apply(ctx: Context): void {
  const program = webCommand();
  program.action(() => {
    const options = program.opts();
    if (options.host !== undefined && isWildcardHost(options.host)) {
      program.error(
        "error: --host " +
          options.host +
          " is an unspecified (wildcard) address, which is not supported: binding every interface would expose remote code execution to the network; bind one concrete IPv4 or IPv6 address instead",
      );
    }
    if (options.port !== undefined && !/^\d+$/.test(options.port)) {
      program.error("error: --port must be a number, got " + JSON.stringify(options.port));
    }
    let tls: TlsConfig | undefined;
    if (options.tlsCert !== undefined && options.tlsKey !== undefined) {
      tls = { certFile: options.tlsCert, keyFile: options.tlsKey };
    } else if (options.tlsCert !== undefined || options.tlsKey !== undefined) {
      program.error("error: --tls-cert and --tls-key must be supplied together");
    }
    if (options.publicUrl !== undefined) {
      try {
        parsePublicUrl(options.publicUrl, "--public-url");
      } catch (error) {
        program.error("error: " + (error as Error).message);
      }
    }
    // Vật thể cấp cho service là MỚI mỗi lượt cài — không chia sẻ mảng/tham chiếu giữa hai thực thể.
    const values: WebStartupValues = {
      openBrowser: options.open,
      ...(options.host !== undefined ? { host: options.host } : {}),
      ...(options.port !== undefined ? { port: Number(options.port) } : {}),
      ...(options.publicUrl !== undefined ? { publicUrl: options.publicUrl } : {}),
      ...(tls !== undefined ? { tls } : {}),
      trustedHosts: options.trustedHost ?? [],
    };
    ctx.provide(WEB_STARTUP_SERVICE, values);
  });
  parseCmdline(ctx, program);
}
