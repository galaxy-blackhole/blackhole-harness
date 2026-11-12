/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc RÚT TOÀN BỘ CHUỖI ĐANG HIỂN THỊ của app đang chạy qua CDP (Chrome headless cổng 9222) — dùng để
 *   RÀ CHUỖI TIẾNG ANH bằng dữ liệu THẬT thay vì đoán từ mã nguồn.
 *
 *      CÁCH DÙNG: bun run tools/dev/dom-text.ts <url> <thư-mục-ra>
 *      Kết quả: <thư-mục-ra>/dom-text.json  — { trang: [...], caiDat: { <tab>: [...] } }
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

/**
 * Rút chuỗi đang hiển thị trong một vùng (text node không nằm trong <script>/<style>).
 * Nhận: không (chạy trong trang).
 * Trả: mảng chuỗi đã trim, bỏ rỗng, đã khử trùng.
 */
const RUT_CHUOI = `(() => {
  const scope = document.querySelector('[role="dialog"]') ?? document.body;
  const out = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node !== null) {
    const text = String(node.textContent ?? "").replace(/\\s+/gu, " ").trim();
    if (text.length > 0) out.push(text);
    node = walker.nextNode();
  }
  return [...new Set(out)];
})()`;

/**
 * Bấm phần tử có nhãn chữ đúng bằng chuỗi cho trước (phần tử cuối cùng khớp).
 * Nhận: nhãn — chuỗi cần bấm.
 * Trả: true khi bấm được.
 */
function bamBieu(nhan: string): string {
  return "(() => { const ds = [...document.querySelectorAll('button,[role=button],div,span,a')]; " +
    "const t = ds.filter(e => (e.textContent||'').trim() === " + JSON.stringify(nhan) + "); " +
    "if (!t.length) return false; const e = t[t.length-1]; e.click(); return true; })()";
}

/** Điểm vào CLI. */
async function main(): Promise<void> {
  const url = process.argv[2] ?? "";
  const ra = process.argv[3] ?? "/tmp/dom";
  const ds = (await (await fetch(CDP + "/json/list")).json()) as Array<{ webSocketDebuggerUrl: string; type: string }>;
  const tab = ds.find((t) => t.type === "page");
  if (tab === undefined) throw new Error("khong thay tab");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));
  let id = 0;
  const call = (m: string, p: Record<string, unknown> = {}): Promise<any> => gui(ws, ++id, m, p);
  await call("Page.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url });
  await ngu(9000);
  const doc = async (bieu: string): Promise<unknown> => {
    const r = await call("Runtime.evaluate", { expression: bieu, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  };
  const ketQua: Record<string, unknown> = { trang: await doc(RUT_CHUOI), caiDat: {} };
  const moDuoc = await doc(bamBieu("Thêm"));
  if (moDuoc === true) {
    await ngu(1200);
    const moCaiDat = await doc(bamBieu("Cài đặt"));
    if (moCaiDat === true) {
      await ngu(2500);
      const caiDat: Record<string, string[]> = {};
      // Nhãn tab đọc từ cột điều hướng của modal Settings.
      const nhan = (await doc("(() => [...document.querySelectorAll('[role=dialog] button')].map(e => (e.textContent||'').trim()).filter(Boolean))()")) as string[] | undefined;
      for (const tab of Array.isArray(nhan) ? nhan : []) {
        if (tab === "Cài đặt" || tab.length === 0) continue;
        const bam = await doc(bamBieu(tab));
        if (bam !== true) continue;
        await ngu(1500);
        caiDat[tab] = (await doc(RUT_CHUOI)) as string[];
      }
      ketQua.caiDat = caiDat;
    }
  }
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(ra, { recursive: true });
  writeFileSync(ra + "/dom-text.json", JSON.stringify(ketQua, null, 1));
  console.log("ghi:", ra + "/dom-text.json");
  ws.close();
}

await main();

export {};
