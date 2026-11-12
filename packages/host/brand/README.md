<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-brand — ban viet lai cua @deepseek-ai/dsh-brand (goi THU VIEN 32 dong)
-->

# @galaxy-blackhole/gbh-brand

Bản viết lại 1:1 của `@deepseek-ai/dsh-brand` (**32 dòng, zero-dependency**).

## 0. Vì sao KHÔNG khai `gbh.row`

Gói **thư viện thuần hàm**: bản gốc không có `apply`, không có entry trong cây plugin (`grep` trong
`.parity/dumps/2026-10-18T01-31-57/ours.yml` = 0) ⇒ không có row nào để thay. Consumer **inline** khi tới lượt.

## 1. Ghi chú port

- `brandString`/`brandNumber` chỉ là **ép kiểu compile-time**, thân hàm trả nguyên giá trị ⇒ không thể khác bản gốc.
- Gói **không giữ danh tính/trạng thái** nên hai bản cài độc lập cho giá trị dùng lẫn nhau được (đúng ghi chú của bản gốc).
