/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào tiến trình con REPL của PTC node — port 1:1 lib/types/persistent-process-entry.js: mở kênh
 *      điều khiển kế thừa fd 7 rồi phục vụ runPersistentMain với hạn khung tin host truyền qua argv[2]
 */

import { openInheritedControlChannel } from "./persistent-process-protocol.ts";
import { runPersistentMain } from "./persistent-process-runner.ts";

/* Private built entry for the persistent Node REPL. */
runPersistentMain(openInheritedControlChannel(), Number(process.argv[2]), process);
