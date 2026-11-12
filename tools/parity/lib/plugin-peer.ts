/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Phép so HAI PHÍA cho plugin ngoài: cài CÙNG plugin, cùng phiên bản vào oracle B (home tạm,
 *      cùng slug workspace) rồi so hành vi với app — để câu hỏi 'trang UI không hiện' có kết luận
 *      bằng dữ liệu (lỗi của ta hay hành vi chung), không bằng suy đoán
 */

import { type CommandRun, type PnpmInfo, EXTERNAL_PLUGIN, runDshPlugin } from "./plugin-npm.ts";
import { type DumpRowCheck, type ProfileSnapshot, dumpHasPluginRow, readProfileSnapshot, restoreProfile } from "./plugin-profile.ts";
import { type ClientProof, captureClientProof, cookieForHomeFirst, pageBytes, probeRoute } from "./plugin-ui.ts";
import { type ChromeSession } from "./browser.ts";
import { STOCK_PORT, stockHome } from "./paths.ts";
import { ensureStockServer, stopChild } from "./runner.ts";

/** Kết quả phép so phía oracle B. */
export interface PeerComparison {
  /** Cổng của oracle B. */
  port: number;
  /** Home của oracle B. */
  home: string;
  /** Tên profile của oracle B. */
  profile: string;
  /** true khi oracle B do chính phép đo này boot (cần dừng sau khi xong). */
  bootedHere: boolean;
  /** Row plugin trong cây dump của oracle B khi đã cài. */
  dumpRow: DumpRowCheck;
  /** Route riêng của plugin trên oracle B (404 khi chưa cài, 200 khi đã cài). */
  routeBefore: Awaited<ReturnType<typeof probeRoute>> | null;
  /** Route riêng của plugin trên oracle B sau khi cài. */
  routeDuring: Awaited<ReturnType<typeof probeRoute>> | null;
  /** Bằng chứng phía trình duyệt của oracle B (boot entry, bundle, mục Settings). */
  client: ClientProof | null;
  /** Số byte trang chủ oracle B trước/sau khi cài. */
  pageBytes: { before: number | null; during: number | null };
  /** Lệnh cài/gỡ trên oracle B. */
  commands: { install: CommandRun | null; uninstall: CommandRun | null };
  /** true khi profile oracle B đã được khôi phục nguyên byte. */
  restored: boolean;
  /** Ghi chú. */
  notes: string[];
}

/**
 * Cài cùng plugin vào oracle B rồi so hành vi với app: row trong cây, route riêng, boot graph, mục Settings.
 * @param session phiên Chrome dùng chung với phép đo app.
 * @param pnpm thông tin pnpm để cài.
 * @param shotFile đường dẫn ảnh chụp Settings của oracle B.
 * @returns kết quả so hai phía; mọi thay đổi trên oracle B đều được gỡ và khôi phục.
 */
export async function compareWithPeer(session: ChromeSession, pnpm: PnpmInfo, shotFile: string): Promise<PeerComparison> {
  const home = stockHome();
  const profile = "web";
  const notes: string[] = [];
  const server = await ensureStockServer(STOCK_PORT);
  notes.push(server.note);
  // Kho credentials của chính oracle B đứng trước: home tạm sinh secret riêng.
  const cookie = cookieForHomeFirst(STOCK_PORT, home);
  const snapshot: ProfileSnapshot = readProfileSnapshot(home, profile);
  let install: CommandRun | null = null;
  let uninstall: CommandRun | null = null;
  let client: ClientProof | null = null;
  let routeBefore = null as Awaited<ReturnType<typeof probeRoute>> | null;
  let routeDuring = null as Awaited<ReturnType<typeof probeRoute>> | null;
  let bytesBefore: number | null = null;
  let bytesDuring: number | null = null;
  let dumpRow: DumpRowCheck = { has: false, rows: 0, lines: 0 };
  try {
    routeBefore = await probeRoute(STOCK_PORT, EXTERNAL_PLUGIN.route, cookie).catch(() => null);
    bytesBefore = await pageBytes(STOCK_PORT, cookie);
    install = pnpm.ok ? runDshPlugin(home, profile, ["add", "-w", EXTERNAL_PLUGIN.name], pnpm.bin) : null;
    notes.push(install === null ? "không có pnpm: bỏ qua phép so phía oracle B" : "cài vào oracle B exit=" + String(install.exitCode));
    if (install !== null && install.ok) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      dumpRow = dumpHasPluginRow(home, profile, EXTERNAL_PLUGIN.dumpRowId, EXTERNAL_PLUGIN.name);
      routeDuring = await probeRoute(STOCK_PORT, EXTERNAL_PLUGIN.route, cookie).catch(() => null);
      client = await captureClientProof(session, STOCK_PORT, cookie, shotFile, []);
      bytesDuring = await pageBytes(STOCK_PORT, cookie);
    }
  } finally {
    if (install !== null && install.ok) {
      uninstall = runDshPlugin(home, profile, ["remove", "-w", EXTERNAL_PLUGIN.name], pnpm.bin);
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
    const restored = restoreProfile(home, snapshot);
    notes.push("khôi phục oracle B: byte khớp=" + String(restored.files.every((file) => file.before === file.after && file.before !== "")));
    if (server.bootedHere) stopChild(server.child);
    return {
      port: STOCK_PORT,
      home,
      profile,
      bootedHere: server.bootedHere,
      dumpRow,
      routeBefore,
      routeDuring,
      client,
      pageBytes: { before: bytesBefore, during: bytesDuring },
      commands: { install, uninstall },
      restored: restored.files.every((file) => file.before === file.after && file.before !== ""),
      notes,
    };
  }
}
