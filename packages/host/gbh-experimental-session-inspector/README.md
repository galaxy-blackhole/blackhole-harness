<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc Ban sao 1:1 cua goi goc DSH tuong ung (P1b: doi ten, giu nguyen hanh vi)
-->

# gbh-experimental-session-inspector

Ban sao 1:1 cua `@deepseek-ai/dsh-experimental-session-inspector` (nua host + nua client).
Khong khai `gbh.row` vi day la goi thu vien/nen tang.

⚠️ **Chưa có khối `dsh.client` — KHÔNG mount được nửa client.** Gói đang `gbh.draft` (không khai `gbh.row`) nên KHÔNG mount; nửa client hiện là mã chết, không gây lỗi runtime. Muốn bật phải làm trọn gói ở lô Phase C (xem `docs/tien-do/PHASE-B-R6A-BYTE-GATE.md` §7.4).
