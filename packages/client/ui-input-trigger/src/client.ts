/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào nửa client — chỉ xuất factory createPlugin cho build.ts bundle; kèm vùng partial-json nguyên văn
 */

// Vùng ../../util/values/src/partial-json.ts của artifact gốc không được module nào tham chiếu, nhưng vẫn
// nằm trong bundle gốc (lớp có static field nên bundler giữ lại). Import tác dụng phụ để artifact của ta
// giữ đúng vùng đó; xem bảng G4 trong README.
import "./partial-json.ts";

export { createPlugin } from "./plugin.ts";
