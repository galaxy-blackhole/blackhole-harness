/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Chụp từng tab của Cài đặt để tự kiểm chứng bản dịch (không đoán).
 *
 *      CÁCH DÙNG: bun run tools/dev/shot-tab.ts <url> <thư-mục-ra> [nhãn-tab ...]
 */

const CDP = "http://127.0.0.1:9222";

/**
 * Gửi một lệnh CDP.
 * Nhận: ws — WebSocket; id — số lệnh; method — tên lệnh; params — tham số.
 * Trả: promise kết quả.
 */
function gui(ws: WebSocket, id: number, method: string, params: Record<string, unknown> = {}): Promise<any> {
  return new Promise((ok) => {
    const nghe = (e: MessageEvent): void => {
      const d = JSON.parse(String(e.data)) as { id?: number; result?: any };
      if (d.id === id) {
        ws.removeEventListener("message", nghe);
        ok(d.result);
      }
    };
    ws.addEventListener("message", nghe);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

/** Điểm vào CLI. */
async function main(): Promise<void> {
  const url = process.argv[2] ?? "";
  const ra = process.argv[3] ?? "/tmp/shot";
  const nhan = process.argv.slice(4);
  const ds = (await (await fetch(CDP + "/json/list")).json()) as Array<{ webSocketDebuggerUrl: string; type: string }>;
  const tab = ds.find((t) => t.type === "page");
  if (tab === undefined) throw new Error("khong thay tab");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));
  let id = 0;
  const call = (m: string, p: Record<string, unknown> = {}): Promise<any> => gui(ws, ++id, m, p);
  await call("Page.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1100, deviceScaleFactor: 2, mobile: false });
  await call("Page.navigate", { url });
  await new Promise((ok) => setTimeout(ok, 9000));
  const bieu = (n: string): string => "(() => { const ds=[...document.querySelectorAll('button,[role=button],div,span,a')]; " +
    "const t=ds.filter(e => (e.textContent||'').trim() === " + JSON.stringify(n) + "); " +
    "if (!t.length) return false; t[t.length-1].click(); return true; })()";
  await call("Runtime.evaluate", { expression: bieu("Thêm"), returnByValue: true });
  await new Promise((ok) => setTimeout(ok, 1200));
  await call("Runtime.evaluate", { expression: bieu("Cài đặt"), returnByValue: true });
  await new Promise((ok) => setTimeout(ok, 2500));
  const { writeFileSync } = await import("node:fs");
  for (const n of nhan) {
    const bam = await call("Runtime.evaluate", { expression: bieu(n), returnByValue: true });
    await new Promise((ok) => setTimeout(ok, 1800));
    const r = await call("Page.captureScreenshot", { format: "png" });
    const ten = ra + "/tab-" + n.replace(/[^\p{L}\p{N}]+/gu, "-") + ".png";
    writeFileSync(ten, Buffer.from(r.data as string, "base64"));
    console.log("chup", n, "->", ten, "bam-duoc:", String(bam.result?.value));
  }
  ws.close();
}

await main();

export {};
