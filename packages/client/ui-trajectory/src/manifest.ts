/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Manifest ban bien dich ui-trajectory: thu tu ghep 12 lat + bang thay the bon module CSS (build.ts doc)
 */

/**
 * Thu tu ghep cac lat cua ban bien dich, dung NGUYEN VAN thu tu region cua bundle goc
 * (lib/types/client/duration-store.js … lib/types/client/index.js).
 * ⚠️ MOT LAN NUA: moi lat trong mang nay la NGUYEN VAN 100% ban goc — khong mot dong viet tay nao.
 * Cong chong cai hai lan + bang tieng Viet nam o HANDWRITTEN_PARTS (lat viet tay rieng).
 * Nhan: khong.
 * Tra: mang duong dan tuong doi so voi src/.
 */
export const PART_FILES: readonly string[] = [
  "parts/part-01.ts",
  "parts/part-02.ts",
  "parts/part-03.ts",
  "parts/part-04.ts",
  "parts/part-05.ts",
  "parts/part-06.ts",
  "parts/part-07.ts",
  "parts/part-08.ts",
  "parts/part-09.ts",
  "parts/part-10.ts",
  "parts/part-11.ts",
  "parts/part-12.ts",
];

/** Mot cho thay the CSS trong ban bien dich. */
export interface CssReplacement {
  /** Diem thay the xuat hien trong lat ma nguon (build.ts thay bang chuoi CSS da ma hoa JSON). */
  readonly placeholder: string;
  /** Duong dan file .module.css tuong doi so voi src/ — nguon su thuat cua CSS. */
  readonly file: string;
}

/**
 * Bang thay the CSS: moi diem thay the trong lat ung voi dung mot file .module.css.
 * Bon module nay la NGUYEN VAN ban goc (giu nguyen hash lop Y0dWHa_* / qBU-ya_*);
 * tools/extract-css.ts la ben sinh ra chung, kem ca SHA-256 de test doi chung lai.
 * Nhan: khong.
 * Tra: mang cac cap diem thay the ↔ file CSS, theo thu tu xuat hien trong bundle.
 */
export const CSS_REPLACEMENTS: readonly CssReplacement[] = [
  { placeholder: "__GBH_UI_TRAJECTORY_CSS_TrajectoryTable__", file: "styles/TrajectoryTable.module.css" },
  { placeholder: "__GBH_UI_TRAJECTORY_CSS_TrajectoryToolbar__", file: "styles/TrajectoryToolbar.module.css" },
  { placeholder: "__GBH_UI_TRAJECTORY_CSS_TrajectoryTimeline__", file: "styles/TrajectoryTimeline.module.css" },
  { placeholder: "__GBH_UI_TRAJECTORY_CSS_views__", file: "styles/views.module.css" },
];

/**
 * Hai dong EXPORTS cuoi cua than bundle goc (sau //#endregion cuoi cung) — NGUYEN VAN.
 * Dat TRUOC khoi viet tay de khoi do boc duoc dung ham `apply` vua duoc gan vao exports.
 */
export const CLIENT_EXPORT_LINES: readonly string[] = [
  "\t\texports.apply = apply;",
  "\t\texports.inject = inject;",
];

/**
 * Cac lat VIET TAY cua goi — moi thu KHONG co trong bundle goc nam o day, va chi o day.
 * Thu tu ghep: PART_FILES (nguyen van) → CLIENT_EXPORT_LINES → HANDWRITTEN_PARTS → CLIENT_TAIL_LINES.
 * Test parity doi chung bo dung van ban cac lat nay theo VI TRI MANIFEST (khong do chuoi noi dung)
 * de khang dinh phan con lai la NGUYEN VAN ban goc.
 */
export const HANDWRITTEN_PARTS: readonly string[] = [
  "parts/plugin-surface.ts",
];

/**
 * Dong cuoi cung cua than bundle goc — NGUYEN VAN, dat SAU khoi viet tay.
 * Factory tra ve dung the module ma ban goc tra ve ({ apply, inject }).
 */
export const CLIENT_TAIL_LINES: readonly string[] = [
  "\t\treturn module.exports;",
];
/**
 * Dòng đánh dấu vỏ của một mảnh bị cắt giữa câu lệnh — NGUỒN SỰ THẬT DUY NHẤT.
 *
 * tools/split-stock-bundle.ts in hai dòng này vào mỗi lát (kèm phần ngoặc phải mở/đóng lại để lát là cú
 * pháp hợp lệ); assemble.ts GỠ đúng những dòng khớp khuôn này khi ghép, nên bản chạy vẫn NGUYÊN VĂN.
 * Dấu đánh dấu luôn nằm CUỐI dòng (sau phần ngoặc) — nếu đặt trước thì nó là bình luận dòng và nuốt
 * luôn phần ngoặc (lỗi có thật, đã làm mọi lát mất cân bằng ngày 18/10/2026).
 */
export const FRAGMENT_BEGIN_MARKER = "// __DSH_FRAGMENT_BEGIN__";

/** Dòng đánh dấu ĐÓNG vỏ của một mảnh bị cắt giữa câu lệnh. */
export const FRAGMENT_END_MARKER = "// __DSH_FRAGMENT_END__";

/** Khuôn nhận diện dòng đánh dấu vỏ: dòng KẾT THÚC bằng một trong hai dấu. */
export const FRAGMENT_MARKER_LINE = /\/\/ __DSH_FRAGMENT_(?:BEGIN|END)__\s*$/;
