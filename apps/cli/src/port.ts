/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Kiem tra cong trong truoc khi boot va goi y tien trinh dang giu cong (khong bao gio doat cong)
 */

import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { LOOPBACK_HOST } from "./paths.ts";

/**
 * Checks whether a TCP port can be bound right now.
 * @param port - port to test; 0 always counts as free because the OS picks one.
 * @param host - bind host, defaults to loopback.
 * @returns true when this process can bind the port.
 */
export function isPortAvailable(port: number, host: string = LOOPBACK_HOST): Promise<boolean> {
  if (port === 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => {
      probe.close();
      resolve(false);
    });
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, host);
  });
}

/**
 * Best-effort hint naming whoever holds a busy port, so the error message is actionable.
 * @param port - the busy TCP port.
 * @returns a one-line hint, or advice when `lsof` is unavailable.
 */
export function portOwnerHint(port: number): string {
  const probe = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8", timeout: 5000 });
  const row = (probe.stdout ?? "").split("\n").find((line, index) => index > 0 && line.trim() !== "");
  if (probe.status !== 0 || row === undefined) return `stop the process holding ${port}, or pass --auto-port`;
  const columns = row.trim().split(/\s+/u);
  return `held by pid ${columns[1] ?? "?"} (${columns[0] ?? "?"}); stop it or pass --auto-port`;
}
