<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-util-time — ban viet lai cua @deepseek-ai/dsh-util-time (goi THU VIEN 31 dong)
-->

# @galaxy-blackhole/gbh-util-time

Bản viết lại 1:1 của `@deepseek-ai/dsh-util-time` (**31 dòng, zero-dependency**).

## 0. Vì sao KHÔNG khai `gbh.row`

Gói **thư viện thuần hàm**: bản gốc không có `apply`, không có entry trong cây plugin (`grep` trong
`.parity/dumps/2026-10-18T01-31-57/ours.yml` = 0) ⇒ không có row nào để thay. Consumer **inline** khi tới lượt.

## 1. Ghi chú port

- Khuôn `IANA_TIME_ZONE` giữ **nguyên văn** từ bản gốc (không nới, không thu).
- Trả **tên CHUẨN** do `Intl.DateTimeFormat(...).resolvedOptions().timeZone` sinh ra — lý do bản gốc nêu: danh tính múi giờ được ghi trên bản ghi bền và tiến trình khác phân giải lại, nên chấp nhận alias sẽ làm giá trị so sánh KHÔNG bằng.
- Bản gốc có một nhánh `/* v8 ignore */` cho trường hợp Intl trả về UTC hoặc IANA chuẩn; bản ta giữ **cùng logic** nhưng không cần chú thích coverage của bản gốc.
