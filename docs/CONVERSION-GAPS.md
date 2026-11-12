<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 20/10/2026
 desc Audit do day du cua ban port (client bundle nho hon bundle goc > 3KB = thieu noi dung) — sinh bang script
-->

# Audit độ đầy đủ bản port (client bundle)

Tiêu chí: `lib/client.js` của ta **nhỏ hơn** bundle gốc quá 3KB ⇒ thiếu nội dung (không phải do đổi brand).
Loại trừ **có chủ đích**: `client/modules` — chứa logic riêng của ta nên nhỏ hơn gốc là đúng.

| # | gói | ta (B) | gốc (B) | thiếu (B) |
|---|---|---:|---:|---:|
| 1 | client/client-hmr | 6476 | 13248 | 6772 |

Tổng: **1 gói**. Lịch sử: 20/10/2026 sáng là **25 gói**; sau khi de-bundle (cắt lát nguyên văn từ bundle gốc) còn lại danh sách trên.
