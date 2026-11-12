/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Bảng VÁ trên artefact nửa browser (`lib/client.js`) của gói này. Vì sao cần: nửa browser đã de-bundle
 *      thành 12 lát nguyên văn trong `src/parts/` (task-203) và `build.ts` CHỈ CHÉP artefact, nên mọi thay đổi
 *      hành vi của trang phải phát biểu thành phép vá CHUỖI ở đây — có tên, idempotent, kiểm khớp đúng 1 lần.
 *      11/11/2026: nhóm "Plugin đã cài" liệt kê gói lõi stock `@deepseek-ai/dsh-terminal` kèm badge đỏ
 *      "Trục trặc". Các phép vá cuối tách thành phần LÕI (cờ `origin` do Host trả) ra nhóm riêng và bỏ badge đỏ.
 *      Nhãn nhóm/thẻ đi qua `resolveText` (không thêm khoá vào từ điển: cổng A/B đòi zh/en ĐÚNG 221 khoá như gốc).
 */

/** Một phép vá: tên để báo lỗi, chuỗi gốc trong artefact, chuỗi thay thế. */
export type ArtefactPatch = readonly [name: string, from: string, to: string];

/**
 * Các phép vá áp lên `lib/client.js` sau khi chép artefact, theo thứ tự.
 * Bất biến: `to` đã có ⇒ bỏ qua (đã vá); ngược lại `from` phải xuất hiện ĐÚNG MỘT lần.
 */
export const ARTEFACT_PATCHES: readonly ArtefactPatch[] = [
  ["package-status",
    "\t\tfunction packageStatus(pkg) {\n\t\t\tif (pkg.error !== void 0) return \"problem\";\n\t\t\treturn pkg.enabled ? \"running\" : \"disabled\";\n\t\t}",
    "\t\tfunction packageStatus(pkg) {\n\t\t\t// 11/11/2026 (Lead đo: nhóm \"Plugin đã cài\" hiện gói lõi stock @deepseek-ai/dsh-terminal kèm badge đỏ\n\t\t\t//   \"Trục trặc\"): thành phần LÕI không phải plugin người dùng cài nên KHÔNG bao giờ mang trạng thái trục trặc;\n\t\t\t//   chẩn đoán của Host vẫn hiện dạng chữ ở trang chi tiết.\n\t\t\tif (pkg.origin === \"core\") return pkg.enabled ? \"running\" : \"disabled\";\n\t\t\tif (pkg.error !== void 0) return \"problem\";\n\t\t\treturn pkg.enabled ? \"running\" : \"disabled\";\n\t\t}"],
  ["grouping-origin",
    "\t\t\tconst listed = state.packages.filter((pkg) => !BUILTIN_PROFILE_BUNDLES.has(pkg.name) && (pkg.installed || pkg.official || pkg.error !== void 0));\n\t\t\tconst mine = listed.filter((pkg) => !pkg.official);",
    "\t\t\t// 11/11/2026: Host trả cờ origin trên từng gói. core = thành phần LÕI đi kèm bản cài DSH (không phải\n\t\t\t//   plugin người dùng) ⇒ KHÔNG vào nhóm \"Plugin đã cài\", hiện ở nhóm riêng \"Thành phần lõi\". Gói thiếu cờ\n\t\t\t//   (Host cũ) giữ nguyên cách xếp theo tên như trước.\n\t\t\tconst originOf = (pkg) => pkg.origin === \"core\" ? \"core\" : \"user\";\n\t\t\tconst listed = state.packages.filter((pkg) => (pkg.installed || pkg.official || pkg.error !== void 0 || originOf(pkg) === \"core\") && (originOf(pkg) === \"core\" || !BUILTIN_PROFILE_BUNDLES.has(pkg.name)));\n\t\t\tconst coreRows = listed.filter((pkg) => originOf(pkg) === \"core\");\n\t\t\tconst mine = listed.filter((pkg) => !pkg.official && originOf(pkg) !== \"core\");"],
  ["card-tag-core",
    "\t\t\t\t\t\tstatus === \"problem\" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {\n\t\t\t\t\t\t\tclassName: PluginManagerPage_module_css_default.statusTag,\n\t\t\t\t\t\t\ttone: \"danger\",\n\t\t\t\t\t\t\tchildren: t(\"statusProblem\")\n\t\t\t\t\t\t}) : null,",
    "\t\t\t\t\t\tstatus === \"problem\" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {\n\t\t\t\t\t\t\tclassName: PluginManagerPage_module_css_default.statusTag,\n\t\t\t\t\t\t\ttone: \"danger\",\n\t\t\t\t\t\t\tchildren: t(\"statusProblem\")\n\t\t\t\t\t\t}) : null,\n\t\t\t\t\t\tpkg.origin === \"core\" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {\n\t\t\t\t\t\t\tclassName: PluginManagerPage_module_css_default.statusTag,\n\t\t\t\t\t\t\tchildren: resolveText({ en: \"Core\", zh: \"核心\", vi: \"Lõi\" })\n\t\t\t\t\t\t}) : null,"],
  ["detail-tag-core",
    "\t\t\t\t\t\tstatus === \"problem\" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {\n\t\t\t\t\t\t\t\t\t\tclassName: PluginManagerPage_module_css_default.statusTag,\n\t\t\t\t\t\t\t\t\t\ttone: \"danger\",\n\t\t\t\t\t\t\t\t\t\tchildren: t(\"statusProblem\")\n\t\t\t\t\t\t\t\t\t}) : null,",
    "\t\t\t\t\t\tstatus === \"problem\" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {\n\t\t\t\t\t\t\t\t\t\tclassName: PluginManagerPage_module_css_default.statusTag,\n\t\t\t\t\t\t\t\t\t\ttone: \"danger\",\n\t\t\t\t\t\t\t\t\t\tchildren: t(\"statusProblem\")\n\t\t\t\t\t\t\t\t\t}) : null,\n\t\t\t\t\t\t\t\t\tpkg.origin === \"core\" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {\n\t\t\t\t\t\t\t\t\t\tclassName: PluginManagerPage_module_css_default.statusTag,\n\t\t\t\t\t\t\t\t\t\tchildren: resolveText({ en: \"Core\", zh: \"核心\", vi: \"Lõi\" })\n\t\t\t\t\t\t\t\t\t}) : null,"],
  ["core-group",
    "\t\t\t\t\t\t\trenderGroup(\"bundles\", t(\"bundlesTitle\"), mine.map(packageCard))",
    "\t\t\t\t\t\t\trenderGroup(\"bundles\", t(\"bundlesTitle\"), mine.map(packageCard)),\n\t\t\t\t\t\t\trenderGroup(\"core\", resolveText({ en: \"Core components\", zh: \"核心组件\", vi: \"Thành phần lõi\" }), coreRows.map(packageCard))"],
];
