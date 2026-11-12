/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Do hinh hoc vai phan tu thanh ben de kiem hoi quy bo cuc (Plugins/Automation tasks phai o 2 dong)
 */
import { probeGeometry } from "./page-probe.ts";
const url = process.argv[2];
if (url === undefined) { console.log("thieu URL"); process.exit(2); }
const geo = await probeGeometry(url, process.cwd());
console.log("tong so hop: " + geo.length);
for (const g of geo.slice(0, 22)) console.log("  " + g.k.padEnd(26) + " x=" + g.x + " y=" + g.y + " " + g.w + "x" + g.h);