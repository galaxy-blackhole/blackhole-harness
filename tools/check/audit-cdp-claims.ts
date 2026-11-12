/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc TASK-194: probe CDP do reviewer tu viet (khong dung lai script cua Lead) — kiem 3 tuyen bo: tab Trajectory hien, cong tac Show coding view luu duoc, so entry/ten stock trong payload boot.
 */
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Duong dan Chrome tren may nay. */
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
/** Cong remote debugging rieng cua audit (khong dung 9231 cua host). */
const PORT = 9333;

/** Cho HTTP endpoint cua Chrome san sang. */
async function waitVersion(ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch("http://127.0.0.1:" + PORT + "/json/version");
      if (res.ok) return true;
    } catch { /* chua san sang */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/** Mot ket noi CDP toi thieu: goi method va doi ket qua. */
class Cdp {
  private ws: WebSocket;
  private seq = 0;
  private waiters = new Map<number, (v: unknown) => void>();
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown };
      if (msg.id !== undefined && this.waiters.has(msg.id)) {
        this.waiters.get(msg.id)?.(msg.result ?? {});
        this.waiters.delete(msg.id);
      }
    };
  }
  /** Doi WebSocket mo xong. */
  async open(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("ws error"));
    });
  }
  /** Goi mot method CDP va tra ket qua JSON. */
  async send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const id = ++this.seq;
    const result = new Promise<unknown>((resolve) => this.waiters.set(id, resolve));
    this.ws.send(JSON.stringify({ id, method, params }));
    return (await result) as Record<string, unknown>;
  }
  /** Danh gia bieu thuc trong trang va tra gia tri JSON. */
  async evalExpr(expression: string): Promise<unknown> {
    const res = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    const out = res as { result?: { value?: unknown } };
    return out.result?.value;
  }
  /** Dong ket noi. */
  close(): void { this.ws.close(); }
}

/**
 * Diem vao: mo app 5439 bang Chrome headless, kiem 3 tuyen bo cua Lead.
 * @returns ma thoat (0 = chay xong, khong ham y dat/khong dat).
 */
async function main(): Promise<number> {
  const ready = readFileSync(join(process.env.HOME ?? "", ".galaxy/blackhole/ready-url.txt"), "utf8").trim();
  const profile = mkdtempSync(join(tmpdir(), "audit-cdp-"));
  const chrome: ChildProcess = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--user-data-dir=" + profile, "--remote-debugging-port=" + PORT, "about:blank"], { stdio: "ignore" });
  try {
    if (!(await waitVersion(15000))) { console.log("KHONG MO DUOC CHROME (audit-cdp)"); return 0; }
    const res = await fetch("http://127.0.0.1:" + PORT + "/json/new?" + encodeURIComponent(ready), { method: "PUT" });
    const target = (await res.json()) as { webSocketDebuggerUrl?: string };
    if (target.webSocketDebuggerUrl === undefined) { console.log("KHONG TAO DUOC TAB"); return 0; }
    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: ready });
    await new Promise((r) => setTimeout(r, 6000));
    const state1 = await cdp.evalExpr("JSON.stringify({ txt: document.body.innerText.slice(0,400), boot: (()=>{const p=window.__GBH_BOOT__; return p? {entries:(p.entries||[]).length, stock:(p.entries||[]).filter(e=>String(e.name||'').startsWith('@deepseek-ai/')).length, sample:(p.entries||[]).slice(0,5).map(e=>e.name)} : null})() })");
    console.log("STATE1 " + String(state1));
    const clicked = await cdp.evalExpr("(()=>{const all=[...document.querySelectorAll('button,[role=tab],a,div,span')];const t=all.find(e=>e.children.length===0 && e.textContent.trim()==='Trajectory');if(!t) return 'NOT_FOUND'; t.click(); return 'CLICKED';})()");
    console.log("TRAJECTORY_CLICK " + String(clicked));
    await new Promise((r) => setTimeout(r, 1500));
    const after = await cdp.evalExpr("JSON.stringify({ hasTrajectoryPanel: document.body.innerText.includes('Trajectory') && (document.querySelectorAll('[data-slot]').length>0), body: document.body.innerText.slice(0,500) })");
    console.log("AFTER_TRAJECTORY " + String(after));
    const toggle = await cdp.evalExpr("(()=>{const all=[...document.querySelectorAll('*')];const el=all.find(e=>e.children.length===0 && /coding view/i.test(e.textContent||''));if(!el) return 'NOT_FOUND'; const sw=el.closest('label,button,[role=switch]')||el; return JSON.stringify({tag:el.tagName, txt:el.textContent.trim(), aria:sw.getAttribute('aria-checked'), cls:sw.className}); })()");
    console.log("TOGGLE_BEFORE " + String(toggle));
    const toggled = await cdp.evalExpr("(()=>{const all=[...document.querySelectorAll('*')];const el=all.find(e=>e.children.length===0 && /coding view/i.test(e.textContent||''));if(!el) return 'NOT_FOUND'; const sw=el.closest('label,button,[role=switch]')||el; sw.click(); const after=sw.getAttribute('aria-checked'); return JSON.stringify({after, ls: Object.keys(localStorage).slice(0,10)});})()");
    console.log("TOGGLE_AFTER_CLICK " + String(toggled));
    await cdp.send("Page.reload", {});
    await new Promise((r)=>setTimeout(r,6000));
    const persisted = await cdp.evalExpr("(()=>{const all=[...document.querySelectorAll('*')];const el=all.find(e=>e.children.length===0 && /coding view/i.test(e.textContent||''));if(!el) return 'NOT_FOUND'; const sw=el.closest('label,button,[role=switch]')||el; return JSON.stringify({aria: sw.getAttribute('aria-checked'), ls: Object.keys(localStorage).slice(0,10)});})()");
    console.log("TOGGLE_AFTER_RELOAD " + String(persisted));
    cdp.close();
    return 0;
  } finally {
    chrome.kill("SIGKILL");
  }
}
process.exit(await main());
