/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Do nhanh BAN KINH NO cua vai row de doi chieu voi diem chi phi
 */
import { blastRadius } from "./row-cost.ts";
const pkgs = ["@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-ui-sidebar", "@deepseek-ai/dsh-client-ui-goal", "@deepseek-ai/dsh-client-ui-jobs"];
for (const p of pkgs) console.log("  " + p.padEnd(46) + " -> " + (await blastRadius(p)) + " row inject");