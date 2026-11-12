/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khai bao mau wildcard cho import KEM TRUY VAN cua Bun (?partial, ?display-title...) — tsc khong giai duoc
 */

// Vi sao can: Bun cho phep `import(".../x.ts?tag")` de nap mot THE HIEN MODULE MOI (bo nho dem cua
// module bi vo theo truy van). `tsc` khong biet luat do ⇒ bao TS2307 o bon cho trong
// tests/client/ui-workspace.test.ts (dong 447 · 455 · 738 · 811 — do bang
// `grep -o '?[a-z-]*' tests/client/ui-workspace.test.ts`; do la BON truy van DUY NHAT dang dung that).
//
// Vi sao khong the khai theo duong dan cu the: TS2436 — ambient module KHONG nhan ten tuong doi.
// ⇒ Phai dung MAU WILDCARD. TypeScript cho phep DUNG MOT dau `*` moi mau, va mau phai khop TRON
//   chuoi, nen binh hoa nay khong the no ra cho khac:
//     "*?partial"        khop ...partial-json.ts?partial        (KHONG khop ?partial-stream: duoi khac)
//     "*?partial-stream" khop ...partial-json.ts?partial-stream
//     "*?actions-activity" khop ...locales.ts?actions-activity
//     "*?display-title"  khop ...views.ts?display-title
//   Da kiem toan repo (grep moi specifier chua `?`): bon dong test nay la NHUNG CHO DUY NHAT ⇒ khong
//   che kieu cua bat ky module that nao. TUYET DOI khong khai `declare module "*";` (qua rong).
//
// Kieu cua gia tri: `any` — va day la ket qua DO, khong phai suy dien. Do bang tsc that (dung bo co
// cua gate, co doi chung am) tren dung bon phep ep kieu nay:
//   · `const value: unknown; export = value;` ⇒ import() tra { default: unknown } ⇒ BON cho ep kieu
//     vo voi TS2352 ("neither type sufficiently overlaps") ⇒ 4 vi pham MOI thay cho 4 vi pham cu.
//   · khong co `export` (chi `const value: unknown;`) ⇒ cung 4× TS2352.
//   · `const value: any; export = value;` ⇒ 0 loi.
// `any` o day KHONG che bot kieu nao: truoc ban khai nay, chinh bon specifier do da la TS2307, tuc
// kieu cua chung da la `any` cua loi; va moi cho dung deu ep kieu ngay tai cho (xem bon dong test).

/** Nạp lại module với truy vấn `?partial` (thể hiện mới) — Bun hiểu, tsc cần mẫu này. */
declare module "*?partial" {
  /** Giá trị module cho thể hiện mới; kiểu thật do chỗ gọi ép ngay sau lời gọi. */
  const value: any;
  export = value;
}

/** Nạp lại module với truy vấn `?partial-stream` (thể hiện mới) — Bun hiểu, tsc cần mẫu này. */
declare module "*?partial-stream" {
  /** Giá trị module cho thể hiện mới; kiểu thật do chỗ gọi ép ngay sau lời gọi. */
  const value: any;
  export = value;
}

/** Nạp lại module với truy vấn `?actions-activity` (thể hiện mới) — Bun hiểu, tsc cần mẫu này. */
declare module "*?actions-activity" {
  /** Giá trị module cho thể hiện mới; kiểu thật do chỗ gọi ép ngay sau lời gọi. */
  const value: any;
  export = value;
}

/** Nạp lại module với truy vấn `?display-title` (thể hiện mới) — Bun hiểu, tsc cần mẫu này. */
declare module "*?display-title" {
  /** Giá trị module cho thể hiện mới; kiểu thật do chỗ gọi ép ngay sau lời gọi. */
  const value: any;
  export = value;
}
