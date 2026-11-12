/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Chụp ảnh app đang chạy bằng Chrome headless + CDP để TỰ KIỂM CHỨNG giao diện (không đoán).
 *
 *      CÁCH DÙNG: bun run tools/dev/shot.ts <url> <thư-mục-ra>
 */

const CDP = "http://127.0.0.1:9222";

/**
 * Gửi một lệnh CDP và chờ kết quả.
 * Nhận: ws — WebSocket; id — số lệnh; method — tên lệnh; params — tham số.
 * Trả: promise kết quả.
 */
function gui(ws: WebSocket, id: number, method: string, params: Record<string, unknown> = {}): Promise<any> {
  return new Promise((ok, loi) => {
    const hen = setTimeout(() => loi(new Error("timeout " + method)), 30000);
    const nghe = (e: MessageEvent): void => {
      const d = JSON.parse(String(e.data)) as { id?: number; result?: any; error?: any };
      if (d.id === id) {
        clearTimeout(hen);
        ws.removeEventListener("message", nghe);
        d.error ? loi(new Error(JSON.stringify(d.error))) : ok(d.result);
      }
    };
    ws.addEventListener("message", nghe);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

/**
 * Ngủ một lúc.
 * Nhận: ms — mili giây.
 * Trả: promise.
 */
const ngu = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

/** Điểm vào CLI. */
async function main(): Promise<void> {
  const url = process.argv[2] ?? "";
  const ra = process.argv[3] ?? "/tmp/shot";
  const ds = (await (await fetch(CDP + "/json/list")).json()) as Array<{ webSocketDebuggerUrl: string; type: string }>;
  const tab = ds.find((t) => t.type === "page");
  if (tab === undefined) throw new Error("khong thay tab");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));
  let id = 0;
  const call = (m: string, p: Record<string, unknown> = {}): Promise<any> => gui(ws, ++id, m, p);
  await call("Page.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false });
  await call("Page.navigate", { url });
  await ngu(9000);
  const { writeFileSync } = await import("node:fs");
  const chup = async (ten: string): Promise<void> => {
    const r = await call("Page.captureScreenshot", { format: "png" });
    writeFileSync(ra + "/" + ten + ".png", Buffer.from(r.data as string, "base64"));
    console.log("chup:", ra + "/" + ten + ".png");
  };
  const bam = async (nhan: string): Promise<boolean> => {
    const bieu = "(() => { const ds = [...document.querySelectorAll('button,[role=button],div,span')]; " +
      "const t = ds.filter(e => (e.textContent||'').trim() === " + JSON.stringify(nhan) + "); " +
      "if (!t.length) return false; const e = t[t.length-1]; e.click(); return true; })()";
    const r = await call("Runtime.evaluate", { expression: bieu, returnByValue: true });
    return r.result?.value === true;
  };
  await chup("01-trang-chu");
  if (await bam("Thêm")) {
    await ngu(1200);
    await chup("02-menu-them");
    if (await bam("Cài đặt")) {
      await ngu(2500);
      await chup("03-cai-dat");
    }
  }
  ws.close();
}

await main();

export {};
