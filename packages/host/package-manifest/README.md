<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói KHAI BÁO KIỂU của @deepseek-ai/dsh-package-manifest (bản gốc không có mã chạy)
-->

# @galaxy-blackhole/gbh-package-manifest (type-only)

Bản gốc: `@deepseek-ai/dsh-package-manifest` @0.2.1-alpha.4 — **`lib/index.js` CHỈ là `export {}`**, toàn bộ giá trị nằm ở `lib/types/index.d.ts` (khai báo kiểu cho các trường `package.json.dsh`).

⇒ Bản của ta chép **nguyên bộ .d.ts** sang `src/index.ts` (đổi `export declare` → `export`), build ra `lib/index.js` rỗng y bản gốc. Test: export runtime RỖNG + tập tên kiểu khớp gốc.
