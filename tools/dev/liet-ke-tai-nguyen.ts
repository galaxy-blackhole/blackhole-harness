/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Liệt kê tài nguyên app đã nạp (để biết host phục vụ bundle từ đâu) rồi in ra.
 *
 *      CÁCH DÙNG: bun run tools/dev/liet-ke-tai-nguyen.ts <url>
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
  const ds = (await (await fetch(CDP + "/json/list")).json()) as Array<{ webSocketDebuggerUrl: string; type: string }>;
  const tab = ds.find((t) => t.type === "page");
  if (tab === undefined) throw new Error("khong thay tab");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));
  let id = 0;
  await gui(ws, ++id, "Page.enable");
  await gui(ws, ++id, "Page.navigate", { url });
  await new Promise((ok) => setTimeout(ok, 9000));
  const bieu = "JSON.stringify(performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('.js')))";
  const r = await gui(ws, ++id, "Runtime.evaluate", { expression: bieu, returnByValue: true });
  const ds2 = JSON.parse(String(r.result?.value ?? "[]")) as string[];
  for (const n of ds2) console.log(n);
  ws.close();
}

await main();

export {};
