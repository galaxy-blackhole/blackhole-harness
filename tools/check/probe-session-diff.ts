/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 23/10/2026
 * desc Tìm ĐIỂM LỆCH ĐẦU TIÊN giữa Session của ta và bản gốc khi replay phiên thật lớn nhất —
 *      in ra chỉ số event + hai đoạn JSON quanh chỗ khác để biết phải sửa gì.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const REPO = join(import.meta.dir, "..", "..");
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session", "lib", "index.js");
const OUR = join(REPO, "packages", "host", "session", "lib", "index.js");
const SESSIONS = join(process.env.HOME ?? "", ".galaxy", "blackhole", "sessions");

/** Duyệt tìm tệp phiên lớn nhất. */
function biggest(root: string): string {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith(".jsonl.zstd")) files.push(p);
    }
  };
  walk(root);
  return files.sort((a, b) => statSync(b).size - statSync(a).size)[0] as string;
}

const stock = (await import(pathToFileURL(STOCK).href)) as any;
const ours = (await import(pathToFileURL(OUR).href)) as any;

const file = biggest(SESSIONS);
const text = new TextDecoder().decode(Bun.zstdDecompressSync(readFileSync(file)));
const lines = text.split(String.fromCharCode(10)).filter((l) => l.trim() !== "");
const header = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
const events = lines.slice(1).map((l) => JSON.parse(l) as Record<string, unknown>);
const id = header["id"] as string;
delete header["type"];

const a = stock.Session.create(id, events, header);
const b = ours.Session.create(id, events, header);
const la = JSON.stringify(a.log);
const lb = JSON.stringify(b.log);
console.log("tep:", file.split("/").pop(), "| event:", events.length, "| log dai:", la.length, lb.length);
if (la === lb) {
  const sa = JSON.stringify(a.surface);
  const sb = JSON.stringify(b.surface);
  console.log("log GIONG nhau; surface:", sa === sb ? "GIONG" : "KHAC " + sa.length + " vs " + sb.length);
  let i = 0;
  while (i < Math.min(sa.length, sb.length) && sa[i] === sb[i]) i++;
  console.log("lech tai ky tu", i);
  console.log("goc :", sa.slice(Math.max(0, i - 120), i + 160));
  console.log("cua ta:", sb.slice(Math.max(0, i - 120), i + 160));
} else {
  let i = 0;
  while (i < Math.min(la.length, lb.length) && la[i] === lb[i]) i++;
  console.log("log lech tai ky tu", i);
  console.log("goc :", la.slice(Math.max(0, i - 160), i + 200));
  console.log("cua ta:", lb.slice(Math.max(0, i - 160), i + 200));
}
