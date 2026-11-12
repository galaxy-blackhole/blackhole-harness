/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào tiến trình con MỘT LẦN của PTC node — port 1:1 lib/types/process-entry.js: mở kênh điều
 *      khiển kế thừa fd 7 rồi chạy runNodeMain với hạn khung tin host truyền qua argv[2]
 */

import { openInheritedControlChannel } from "./process-protocol.ts";
import { runNodeMain } from "./process-runner.ts";

/* Private built Node-runtime child entry; source execution calls runNodeMain directly. */
runNodeMain(openInheritedControlChannel(), Number(process.argv[2]), process);
