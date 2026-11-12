<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Bảng tiến độ M5 — SINH TỰ ĐỘNG bởi bun run m5:status, đừng sửa tay.
-->

# Tiến độ M5 — 59 row client (tier T3)

Sinh tự động bởi bun run m5:status. Cột 'Đang chạy' đọc từ **patch của lượt boot đang phục vụ** (`<home>/app.patch.yml`): row đã bị `disabled: true` ⇒ đã thay.

| # | Row | Dòng gốc | Package của ta | Trong repo | Nguồn | Test | **Artifact** | README | Đang chạy |
|---|---|---|---|---|---|---|---|---|---|
| 97 | product-analytics | 1314 | @galaxy-blackhole/gbh-client-product-analytics | có | 7 | có | **có** | có | CÓ |
| 102 | ui-open-in-app | 909 | @galaxy-blackhole/gbh-client-ui-open-in-app | có | 14 | có | **có** | — | CÓ |
| 115 | ui-settings-account | 4842 | @galaxy-blackhole/gbh-client-ui-settings-account | có | 44 | có | **có** | — | CÓ |
| 125 | client-hmr | 489 | @galaxy-blackhole/gbh-client-hmr | có | 5 | có | **có** | có | CÓ |
| 126 | modules | 2020 | @galaxy-blackhole/gbh-client-modules | có | 8 | có | **có** | có | CÓ |
| 127 | connection | 3220 | @galaxy-blackhole/gbh-client-connection | có | 16 | có | — | có | CÓ |
| 128 | file-upload | 1548 | @galaxy-blackhole/gbh-client-file-upload | có | 9 | có | **có** | có | CÓ |
| 131 | ui-theme | 2301 | @galaxy-blackhole/gbh-client-ui-theme | có | 13 | có | **có** | có | CÓ |
| 132 | locale | 1602 | @galaxy-blackhole/gbh-client-locale | có | 11 | có | **có** | có | CÓ |
| 133 | shortcuts | 3182 | @galaxy-blackhole/gbh-client-shortcuts | có | 17 | có | **có** | có | CÓ |
| 134 | ui-shortcuts | 1172 | @galaxy-blackhole/gbh-client-ui-shortcuts | có | 16 | có | **có** | có | CÓ |
| 135 | ui-layout | 727 | @galaxy-blackhole/gbh-client-ui-layout | có | 14 | có | — | có | CÓ |
| 136 | ui-renderer | 1891 | @galaxy-blackhole/gbh-client-ui-renderer | có | 13 | có | **có** | có | CÓ |
| 137 | ui-session | 1148 | @galaxy-blackhole/gbh-client-ui-session | có | 8 | có | — | có | CÓ |
| 138 | resources | 192 | @galaxy-blackhole/gbh-client-resources | có | 6 | có | **có** | có | CÓ |
| 139 | ui-sidebar | 543 | @galaxy-blackhole/gbh-client-ui-sidebar | có | 10 | có | **có** | có | CÓ |
| 140 | ui-sidebar-right | 5021 | @galaxy-blackhole/gbh-client-ui-sidebar-right | có | 32 | có | **có** | có | CÓ |
| 142 | ui-sidebar-documentpreview | 179542 | @galaxy-blackhole/gbh-client-ui-sidebar-documentpreview | có | 68 | có | **có** | — | CÓ |
| 143 | ui-sidebar-browser | 1655 | @galaxy-blackhole/gbh-client-ui-sidebar-browser | có | 25 | có | **có** | có | CÓ |
| 144 | ui-sidebar-terminal | 14022 | @galaxy-blackhole/gbh-client-ui-sidebar-terminal | có | 18 | có | — | có | CÓ |
| 145 | ui-sidebar-files | 1033 | @galaxy-blackhole/gbh-client-ui-sidebar-files | có | 16 | có | **có** | có | CÓ |
| 146 | ui-settings | 1532 | @galaxy-blackhole/gbh-client-ui-settings | có | 9 | có | **có** | có | CÓ |
| 147 | ui-settings-general | 1343 | @galaxy-blackhole/gbh-client-ui-settings-general | có | 21 | có | — | có | CÓ |
| 148 | ui-settings-models | 4554 | @galaxy-blackhole/gbh-client-ui-settings-models | có | 34 | có | **có** | có | CÓ |
| 149 | ui-plugin-manager | 4729 | @galaxy-blackhole/gbh-client-ui-plugin-manager | có | 24 | có | **có** | có | CÓ |
| 150 | ui-settings-plugin-inventory | 781 | @galaxy-blackhole/gbh-client-ui-settings-plugin-inventory | có | 10 | có | — | có | CÓ |
| 151 | ui-conversation | 20094 | @galaxy-blackhole/gbh-client-ui-conversation | có | 120 | có | **có** | có | CÓ |
| 152 | ui-approval | 373 | @galaxy-blackhole/gbh-client-ui-approval | có | 9 | có | — | có | CÓ |
| 153 | ui-chat | 13410 | @galaxy-blackhole/gbh-client-ui-chat | có | 25 | có | **có** | có | CÓ |
| 154 | ui-brand-official | 58 | @galaxy-blackhole/gbh-client-ui-brand-official | có | 4 | có | **có** | — | CÓ |
| 155 | ui-attachment | 936 | @galaxy-blackhole/gbh-client-ui-attachment | có | 5 | có | — | có | CÓ |
| 156 | ui-tool | 4644 | @galaxy-blackhole/gbh-client-ui-tool | có | 24 | có | **có** | có | CÓ |
| 158 | ui-deliverables | 2614 | @galaxy-blackhole/gbh-client-ui-deliverables | có | 35 | có | **có** | — | CÓ |
| 160 | ui-workspace | 5367 | @galaxy-blackhole/gbh-client-ui-workspace | có | 27 | có | **có** | có | CÓ |
| 161 | ui-workflow-run | 678 | @galaxy-blackhole/gbh-client-ui-workflow-run | có | 10 | có | **có** | có | CÓ |
| 162 | ui-input-trigger | 1963 | @galaxy-blackhole/gbh-client-ui-input-trigger | có | 17 | có | **có** | có | — (19/10/2026: đã port nửa client 1:1 — artifact 1.853 dòng, MỘT id của ta; row PARKED chờ boot-smoke) |
| 163 | ui-commands | 2116 | @galaxy-blackhole/gbh-client-ui-commands | có | 19 | có | **có** | có | CÓ |
| 164 | ui-skill | 511 | @galaxy-blackhole/gbh-client-ui-skill | có | 8 | có | **có** | có | CÓ |
| 165 | ui-subagent | 1016 | @galaxy-blackhole/gbh-client-ui-subagent | có | 14 | có | **có** | có | CÓ |
| 166 | ui-reference | 477 | @galaxy-blackhole/gbh-client-ui-reference | có | 10 | có | **có** | có | CÓ |
| 167 | ui-secret-mask | 711 | @galaxy-blackhole/gbh-client-ui-secret-mask | có | 12 | có | — | có | CÓ |
| 168 | ui-jobs | 659 | @galaxy-blackhole/gbh-client-ui-jobs | có | 6 | có | **có** | có | CÓ |
| 169 | ui-schedule | 7560 | @galaxy-blackhole/gbh-client-ui-schedule | có | 64 | có | **có** | có | CÓ |
| 170 | ui-goal | 674 | @galaxy-blackhole/gbh-client-ui-goal | có | 13 | có | — | có | CÓ |
| 171 | ui-message-feedback | 894 | @galaxy-blackhole/gbh-client-ui-message-feedback | có | 13 | có | **có** | — | CÓ |
| 172 | ui-model-selection | 1921 | @galaxy-blackhole/gbh-client-ui-model-selection | có | 18 | có | **có** | có | — <!-- 19/10/2026: nửa client đã port 1:1 (lib/client.js 1.946 dòng / 78.965 B, đủ 11 vùng G4, một id của ta) — row vẫn PARKED, chờ boot-smoke --> |
| 173 | ui-permission | 844 | @galaxy-blackhole/gbh-client-ui-permission | có | 14 | có | — | có | CÓ |
| 174 | ui-agent-preset | 2485 | @galaxy-blackhole/gbh-client-ui-agent-preset | có | 25 | có | **có** | có | CÓ |
| 175 | ui-settings-session-log | 187 | @galaxy-blackhole/gbh-client-ui-settings-session-log | có | 5 | có | **có** | có | CÓ |
| 176 | ui-settings-plugins | 235 | @galaxy-blackhole/gbh-client-ui-settings-plugins | có | 4 | có | **có** | có | CÓ |
| 177 | ui-settings-shell | 212 | @galaxy-blackhole/gbh-client-ui-settings-shell | có | 8 | có | — | có | CÓ |
| 178 | ui-settings-agent-loop | 188 | @galaxy-blackhole/gbh-client-ui-settings-agent-loop | có | 6 | có | — | có | CÓ |
| 179 | ui-settings-subagent | 871 | @galaxy-blackhole/gbh-client-ui-settings-subagent | có | 18 | có | — | có | CÓ |
| 180 | ui-settings-web-search | 338 | @galaxy-blackhole/gbh-client-ui-settings-web-search | có | 4 | có | **có** | có | CÓ |
| 181 | ui-plan | 732 | @galaxy-blackhole/gbh-client-ui-plan | có | 18 | có | — | — | CÓ |
| 182 | ui-user-questions | 1957 | @galaxy-blackhole/gbh-client-ui-user-questions | có | 22 | có | **có** | có | — (19/10/2026: nửa client đã port, chưa mount) |
| 183 | ui-trajectory | 8254 | @galaxy-blackhole/gbh-client-ui-trajectory | có | 22 | có | **có** | có | CÓ |
| 190 | ui-plugin-market | 1644 | @galaxy-blackhole/gbh-client-ui-plugin-market | có | 12 | có | **có** | có | CÓ |
| 205 | gbh-brand | 0 | @galaxy-blackhole/gbh-client-gbh-brand | — | — | — | — | — | — |
<!-- 19/10/2026: ui-cordis (T4, row #157) KHÔNG nằm trong bảng T3 này — nửa host nguyên vẹn + nửa client đã port 1:1 (lib/client.js MỘT id của ta, dsh.client deep-equal bản gốc); row vẫn PARKED, chờ Lead boot-smoke trước khi khai gbh.row. -->

**Đang chạy thật: 55/59 row.**

**Bằng chứng tầng ARTIFACT: 43/55 row đang chạy** — tức test có ĐỌC file đã build (`readFileSync` vào `lib/*.js`), thường kèm đọc bundle GỐC để đối chiếu (G4). Test chỉ import `src/` vẫn XANH kể cả khi bundle build ra sai (ESM thay vì CJS · thiếu id literal · hỏng ở bước đóng gói) — đó là lớp lỗi mà `gate` không thấy. **— KHÔNG phải cổng chặn**: row thiếu cột này vẫn hợp lệ nếu đã có lab + `check:app`; nhưng khi sửa row đó thì nên bổ sung.

## Hàng đợi theo CHI PHÍ THẬT (rẻ trước — không xếp theo số dòng)

| # | Row | Dòng ROW | Primitive | Khoá | Sống | Điểm | **Nổ** |
|---|---|---|---|---|---|---|---|
| 205 | gbh-brand | 0 | 0 | 0 | — | 0 | ? |

Điểm = primitive + khoá từ điển + 8 nếu có trạng thái sống. **Nổ** = số row khác inject package này.
**Dòng ROW** = dòng code của CHÍNH row; `(+N TV)` = chunk lazy chứa thư viện bên thứ ba — **KHÔNG tính vào công viết lại**.

**Xếp lịch theo HAI trục**: *điểm* = công viết lại · *nổ* = hậu quả nếu sai. Một row điểm thấp mà nổ lớn
(ví dụ `locale`: điểm 13 nhưng **48 row** phụ thuộc, entry `immediately`) thì phải làm CẨN THẬN, không phải làm nhanh.
