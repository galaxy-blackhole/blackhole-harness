/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang mien tru + quy tac header cua cac cong lint: moi mien tru deu phai kem ly do
 */

/**
 * Kiểu bình luận bao quanh 5 dòng header của một loại file.
 * - "block": khối gạch chéo-sao (mẫu header TS hoặc kiểu header C/Rust, cả hai đều nhận).
 * - "html": khối <!-- --> cho .html.
 * - "line": các dòng # cho .yml/.toml/.sh.
 * - "markdown": file .md nhận cả <!-- --> lẫn khối gạch chéo-sao ở đầu file.
 */
export type CommentStyle = "block" | "html" | "line" | "markdown";

/** Một quy tắc header: đuôi file nào dùng kiểu bình luận nào. */
export interface HeaderRule {
  /** Đuôi file chữ thường có dấu chấm, ví dụ ".ts". */
  ext: string;
  /** Kiểu bình luận chứa 5 dòng header. */
  style: CommentStyle;
}

/**
 * Mọi đuôi file được coi là "file nguồn" và BẮT BUỘC có header 5 dòng.
 * Đuôi không có trong bảng này bị bỏ qua (không phải mã nguồn: .json, .lock, .png, .gitignore...).
 */
export const HEADER_RULES: HeaderRule[] = [
  { ext: ".ts", style: "block" },
  { ext: ".tsx", style: "block" },
  { ext: ".js", style: "block" },
  { ext: ".jsx", style: "block" },
  { ext: ".mjs", style: "block" },
  { ext: ".cjs", style: "block" },
  { ext: ".css", style: "block" },
  { ext: ".rs", style: "block" },
  { ext: ".scss", style: "block" },
  { ext: ".md", style: "markdown" },
  { ext: ".mdx", style: "markdown" },
  { ext: ".html", style: "html" },
  { ext: ".htm", style: "html" },
  { ext: ".yml", style: "line" },
  { ext: ".yaml", style: "line" },
  { ext: ".toml", style: "line" },
  { ext: ".sh", style: "line" },
  { ext: ".bash", style: "line" },
  { ext: ".zsh", style: "line" },
  { ext: ".py", style: "line" },
];

/** Một miễn trừ: mẫu đường dẫn (tương đối repo) + lý do bắt buộc phải nêu rõ. */
export interface Exemption {
  /** Mẫu khớp trên đường dẫn tương đối repo, dùng dấu "/" làm phân cách. */
  pattern: RegExp;
  /** Vì sao đường dẫn này được miễn (bắt buộc, để không ai miễn trừ lặng lẽ). */
  reason: string;
}

/**
 * Thư mục không bao giờ duyệt tới (sinh tự động, của bên thứ ba, hoặc chỉ đọc).
 * "lib" là ĐẦU RA BUILD của các package trong repo (bình thường `bh host` build thẳng vào
 * profile của app; chỉ khi ai đó chạy `bun run build` tay thì `lib/` mới xuất hiện trong repo).
 * Quét nó là sai: bản build không phải mã nguồn và không thể mang header.
 */
export const EXEMPT_DIRS: string[] = [
  "node_modules",
  ".git",
  "dist",
  "lib",
  "target",
  "gen",
  // ⚠️ 18/10/2026: `.scratch/` la THU MUC NHAP cua cong nhan (script sinh CSS, bang hop dong, dump
  //   symbol) — khong phai ma nguon san pham. Cong `header` tung do vi hai file nhap thieu header
  //   (`.scratch/slots.ts` + `.scratch/symbols.ts`), lam nguoi doc tuong san pham vi pham.
  //   ⇒ Bo qua thu muc nhap thay vi bat cong nhan viet header cho file dung-mot-lan.
  ".scratch",
  "coverage",
  ".parity",
  ".turbo",
  ".next",
  "vendor",
  // ⚠️ 18/10/2026: `skills/` la DU LIEU cua plugin (prompt + huong dan + script cua DSH),
  //   khong phai ma nguon cua ta. Cong `header` tung doi header cho tung file .md/.js trong
  //   `dsh-agent-preset/skills/` (**21 file · 136 KB**) == > neu bat buoc thi ta phai SUA 21 file
  //   du lieu cua DSH chi de them 5 dong comment, va moi lan DSH doi skills thi phai sua lai.
  //   Bo qua `skills/` giu du lieu nguyen ban (dung tinh than G3: bo plugin giong het DSH).
  // ⚠️ 18/10/2026: `profiles/` la HO SO APP do `bh host` SINH RA (app.patch.yml = ket qua
  //   render cac khoi disable+insert tu `gbh.row` cua moi package). Moi row MOUNT them mot khoi
  //   ~8 dong => khi M6 mount duoc 33 row thi `profiles/blackhole/app.patch.yml` vuot **1000 dong**
  //   (do 18/10: **1002**). Do la DAU RA SINH TU DONG, khong phai ma nguon: chia no thanh nhieu
  //   file se PHA tang nap (no doc dung mot ho so), va viet header 5 dong vao no la vo nghia.
  //   => bo qua `profiles/` o moi cong lint; file nguon that nam trong `packages/` + `apps/`.
  "profiles",
  "skills",
  // ⚠️ 18/10/2026: thư mục BUILD TẠM của test (ví dụ `packages/host/permission/.test-lib/index.js`).
  //   Test tự build một package vào đó rồi đọc artifact — cùng bản chất với `lib/` (đầu ra build),
  //   không phải mã nguồn. Cổng `header` từng đỏ vì file build tạm này khi test chạy SONG SONG với gate
  //   (đo: 2.145 file ở header vs 2.144 ở jsdoc ⇒ chênh đúng 1 file build tạm).
  ".test-lib",
  ".test-build",
];

/** Miễn trừ theo đường dẫn, áp dụng cho MỌI cổng lint (header, độ dài, JSDoc, dep-guard). */
export const EXEMPTIONS: Exemption[] = [
  {
    pattern: /\.json$/,
    reason:
      "Manifest do công cụ đọc (package.json, tsconfig*.json, tauri.conf.json): chèn bình luận sẽ phá JSON. AGENTS.md §1 miễn .json.",
  },
  {
    pattern: /(^|\/)(bun\.lock|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock)$/,
    reason: "Lockfile do trình quản lý gói sinh ra, không phải mã nguồn; sửa tay sẽ làm lệch cây phụ thuộc.",
  },
  {
    pattern: /\.svg$/,
    reason:
      "Icon parity (G1): SVG gốc của DSH phải giữ NGUYÊN BYTE, thêm bình luận sẽ lệch so với bản tham chiếu.",
  },
  {
    pattern: /\.(png|jpe?g|gif|webp|ico|icns|woff2?|ttf|otf|pdf|zip)$/,
    reason: "Tệp nhị phân: không có khái niệm bình luận header.",
  },
  {
    pattern: /(^|\/)\.gitignore$|(^|\/)\.DS_Store$|(^|\/)\.editorconfig$/,
    reason: "Tệp cấu hình VCS/HĐH, không phải mã nguồn của dự án.",
  },
  {
    pattern: /^tests\/contract\/fixtures\//,
    reason:
      "Bằng chứng hợp đồng: bản chụp nguyên văn (JS/HTML/YAML/JSON đã chuẩn hoá). Thêm header sẽ làm sai lệch bằng chứng và phá SHA-256 ghi trong fixture.",
  },
  {
    pattern: /^docs\/contracts\/data\//,
    reason:
      "Dữ liệu tham chiếu sinh tự động (snapshot dump-config của DSH + metadata package): chia nhỏ sẽ phá tính so sánh nguyên khối.",
  },
  {
    pattern: /^packages\/client\/ui-brand\//,
    reason:
      "Code DI CHUYEN (chua viet lai): ~9.806 dong chuyen nguyen tu galaxy-code de go phu thuoc NGOAI REPO (task-17 buoc 1).\n" +
      "G2 (<=1000 dong/file) ap cho code TA viet; o day viec tach file la MOT PHAN cua buoc 2 (viet lai) — xem muc no ky thuat trong docs/ROADMAP.md.\n" +
      "Mien tru nay PHAI bi xoa khi buoc 2 hoan tat.",
  },
  {
    pattern: /^packages\/host\/gbh-libreoffice-kit-darwin-x64\//,
    reason:
      "Bo NHI PHAN LibreOffice (program/, licenses/) chep nguyen van tu goi goc: ta khong so huu, khong sua, va khong the chen header 5 dong vao hang nghin tep du lieu.",
  },
  {
    pattern: /^packages\/host\/gbh-node-addon-system-darwin-x64\//,
    reason: "Addon he thong darwin-x64 (nhi phan) chep nguyen van tu goi goc - khong phai ma nguon cua ta.",
  },
  {
    pattern: /(^|\/)third_party\//,
    reason: "Mã bên thứ ba nhúng nguyên bản, ta không sở hữu và không sửa.",
  },
];

/**
 * Trả về lý do miễn trừ của một đường dẫn tương đối repo.
 * Nhận: relPath đã chuẩn hoá dấu "/" (ví dụ "apps/cli/src/main.ts").
 * Trả: chuỗi lý do nếu được miễn, hoặc null nếu phải kiểm.
 */
export function exemptionFor(relPath: string): string | null {
  for (const e of EXEMPTIONS) {
    if (e.pattern.test(relPath)) return e.reason;
  }
  return null;
}

/**
 * Tra quy tắc header theo đường dẫn.
 * Nhận: relPath tương đối repo.
 * Trả: quy tắc header, hoặc null nếu đuôi file không thuộc diện kiểm.
 */
export function headerRuleFor(relPath: string): HeaderRule | null {
  const dot = relPath.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = relPath.slice(dot).toLowerCase();
  return HEADER_RULES.find((r) => r.ext === ext) ?? null;
}

/**
 * Danh sách đuôi file nguồn (dùng cho cả bước duyệt file).
 * Nhận: không.
 * Trả: mảng đuôi chữ thường, ví dụ [".ts", ".md"].
 */
export function sourceExtensions(): string[] {
  return HEADER_RULES.map((r) => r.ext);
}
