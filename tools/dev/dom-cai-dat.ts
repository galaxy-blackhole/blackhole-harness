/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc In cấu trúc DOM của panel Cài đặt (class + chữ) để kiểm chứng hàng/cột THẬT trên màn hình.
 *
 *      CÁCH DÙNG: bun run tools/dev/dom-cai-dat.ts <url>
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
  const call = (m: string, p: Record<string, unknown> = {}): Promise<any> => gui(ws, ++id, m, p);
  await call("Page.navigate", { url });
  await new Promise((ok) => setTimeout(ok, 9000));
  const bam = "(() => { const ds=[...document.querySelectorAll('button,[role=button],div,span')]; const t=ds.filter(e=>(e.textContent||'').trim()==='Thêm'); if(!t.length) return false; t[t.length-1].click(); return true; })()";
  await call("Runtime.evaluate", { expression: bam, returnByValue: true });
  await new Promise((ok) => setTimeout(ok, 1200));
  const bam2 = "(() => { const ds=[...document.querySelectorAll('button,[role=button],div,span')]; const t=ds.filter(e=>(e.textContent||'').trim()==='Cài đặt'); if(!t.length) return false; t[t.length-1].click(); return true; })()";
  await call("Runtime.evaluate", { expression: bam2, returnByValue: true });
  await new Promise((ok) => setTimeout(ok, 2500));
  const doc = "JSON.stringify([...document.querySelectorAll('[class*=row],[class*=Row]')].map(e => e.className + ' :: ' + (e.textContent||'').trim().slice(0,60)).slice(0, 40))";
  const r = await call("Runtime.evaluate", { expression: doc, returnByValue: true });
  const ds2 = JSON.parse(String(r.result?.value ?? "[]")) as string[];
  for (const d of ds2) console.log(d);
  ws.close();
}

await main();

export {};
