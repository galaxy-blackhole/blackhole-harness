<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-tool-schedule — port NGUYEN VAN TUNG BYTE bundle 661 dong
      (4 tool schedule_create/list/delete/update); row chi NAM LONG trong 3 preset => chi khai gbh.nested,
      KHONG khai gbh.row/row_unmounted_ly_do, CHUA mount/flip
-->

# @galaxy-blackhole/gbh-tool-schedule

Bản viết lại Galaxy Blackhole cho @deepseek-ai/dsh-tool-schedule (0.2.1-alpha.4) — plugin `tool-schedule` cấp cho agent
**4 tool quản lý nhắc hẹn**: `schedule_create` · `schedule_list` · `schedule_delete` · `schedule_update` (kèm kiểu kết quả
`schedule_conflict` / `schedule_ended`).

Vì sao gói này quan trọng: row `schedule` đã mount trong app, nhưng **4 tool nằm ở gói RIÊNG này** ⇒ nếu không port, agent
không có công cụ quản lý nhắc hẹn (đúng cảnh báo trong báo cáo của tm-host-core).

## 1. Đo 4 bước TRƯỚC khi viết (19/10/2026)

| phép đo | kết quả | hệ quả |
|---|---|---|
| gói hai mặt? | **KHÔNG** — chỉ lib/index.js 661 dòng; manifest gốc không có dsh.client | một mặt ⇒ không nợ nửa client |
| **trùng TÊN TOOL toàn repo** | grep `schedule_create/list/delete/update` trong packages/, apps/cli/src/, tools/: chỉ thấy **chú thích/kiểu** trong packages/host/schedule và **schema remote sinh tự động** trong packages/host/api-remotes/lib/client.js — **không nơi nào ĐĂNG KÝ tool cùng tên** | an toàn, không trùng |
| row trong dump | `- id: tool-schedule` xuất hiện **ĐÚNG 3 lần, TẤT CẢ ở depth 6** trong `config.plugins` của preset: **preset-standard dòng 865** · **preset-ptc dòng 1029** · **preset-cordis dòng 1296**; **preset-minimal KHÔNG có**. **KHÔNG có entry ở depth 0** ⇒ không có row top-level | **KHÔNG khai `gbh.row` / `gbh.row_unmounted_ly_do`**; chỉ khai `gbh.nested` (bảng §5) |
| bề mặt export | { apply, inject, name }; `name = 'tool-schedule'`; `inject = ['tools']` | artefact giữ đúng 3 tên |
| vendor | bundle 1 vùng duy nhất 656 dòng, không có khối vendor nhúng | không cần tách vendor |
| peer | cordis · dsh-llm · dsh-schedule · dsh-subagent · dsh-tools (đủ trong apps/host) | khai peer + symlink |

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | packages/host/tool-schedule/ (src 3 lát + build + tools) |
| nguồn | chỉ trong bundle stock | **artefact 661 dòng · 19.293 B · sha256 172100bf8a53e45ce3cb8fb476bf8bdd51c208e28135ceca59897fab4edc7929 = gốc** (cmp identical; build DỪNG nếu lệch 1 byte) |
| bề mặt kiểu | lib/types/* của stock | chép nguyên cây (diff -r identical) + lib/index.d.ts 1 dòng (không default) |
| 4 tool cho agent | **không có** (chỉ bản stock) | có bản của ta, byte-identical; test A/B chứng minh đăng ký đúng 4 tool + spec trùng |
| row `tool-schedule` | stock (lồng trong 3 preset) | **không đổi, CHƯA mount/flip** — chỉ khai `gbh.nested` để tầng preset biết specifier cần thay khi có task mount riêng |

## 3. De-bundle: 3 lát NGUYÊN VĂN (0 lát gãy)

| lát | dòng nguyên văn | dòng tệp |
|---|---:|---:|
| part-00-head.ts | 3 | 14 |
| part-01-index.ts | 657 | 668 |
| part-02-tail.ts | 2 | 13 |

Bundle chỉ có MỘT vùng `//#region` (656 dòng) < ngân sách 700 ⇒ không phải cắt mảnh, không cần vỏ hàm.

## 4. Test A/B (tests/host/tool-schedule.test.ts)

Kết quả: **26 ca / 154 expect / 0 fail** (`tests/host/tool-schedule.test.ts`, 3–4 s). Mỗi ca A–E chạy CẢ artefact ta và
bundle gốc trên cùng đầu vào rồi so kết quả/mã lỗi/thông điệp y hệt; dựng **Context cordis THẬT** + dịch vụ
`tools`/`schedule` GIẢ để đo ĐÚNG 4 tool được đăng ký + spec từng tool.

Nhóm ca: A artefact byte-identical · B bề mặt plugin (name/inject/apply) · C apply trên Context thật + `tools` giả
(đúng 4 tool, đúng tên/thứ tự, spec trùng) · D nhánh lỗi (Context trống, dispose, thiếu service) · E hành vi 4 handler
với dịch vụ `schedule` giả (`create`/`list`/`delete`/`update`, kể cả `schedule_conflict`/`schedule_not_found`/
`schedule_ended`, invalid_rule, lỗi lạ ⇒ internal_error, thiếu exec.agent / delegationDepth>0 / signal aborted) ·
F manifest + metadata (`gbh.nested` đúng 3 preset, KHÔNG `gbh.row`/`gbh.row_unmounted_ly_do`, README ghi đúng dòng đo).

Trung thực: ca nào cần dịch vụ THẬT không dựng nổi (subagent thật, schedule engine thật) đều chọn nhánh A/B
"cùng ném cùng thông điệp" và ghi lý do ngay trong tên ca; không ca nào bịa hành vi; không gọi mạng.

## 5. Vị trí đo được trong dump-now2 (19/10/2026) — khai `gbh.nested`, CHƯA mount/flip

Nguồn: `/tmp/dump-now2.txt` (2.298 dòng) — đo bằng **script bun cắt block theo depth** (không grep-suông, không đoán).
Preset là item depth 0; entry nằm trong `config.plugins` ở depth 6.

| preset (dòng mở) | `config.id` / `order` | entry `tool-schedule` | depth | khối đo | `config` | `inject` | `disabled` |
|---|---|---:|---:|---|---|---|---|
| preset-standard (835) | `standard` / 1 | **dòng 865** | 6 | 2 dòng (865–866) | KHÔNG | KHÔNG | KHÔNG |
| preset-ptc (999) | `ptc` / 2 | **dòng 1029** | 6 | 2 dòng (1029–1030) | KHÔNG | KHÔNG | KHÔNG |
| preset-cordis (1266) | `cordis` / 4 | **dòng 1296** | 6 | 2 dòng (1296–1297) | KHÔNG | KHÔNG | KHÔNG |
| preset-minimal (1169) | `minimal` / 3 | **KHÔNG có** | — | — | — | — | — |

- Mỗi entry chỉ có `id` + `name: '@deepseek-ai/dsh-tool-schedule'`. **Không `disabled`** (kể cả biểu thức `!!js`)
  ⇒ **3 preset KHÔNG khác nhau về disabled**; cũng không có `config`/`inject` riêng.
- **Không có `- id: tool-schedule` ở depth 0** trong toàn dump ⇒ **không có row top-level**. Theo §4f: chỉ khai
  `gbh.nested`; **không** khai `gbh.row`, **không** khai `gbh.row_unmounted_ly_do` (khai row sẽ thay cả preset
  và làm mất các entry anh em).
- Metadata đã khai trong `package.json`:

```json
"nested": {
  "kind": "preset",
  "pluginId": "tool-schedule",
  "stockId": "@deepseek-ai/dsh-tool-schedule",
  "presets": ["preset-standard", "preset-ptc", "preset-cordis"]
}
```

- **CHƯA mount/flip**: không có `gbh.row`, không sửa `app.patch.yml`, không đổi specifier lúc chạy. Muốn mount phải
  đi qua cơ chế redirect row lồng của `agent-preset-registry` + lab:row/boot-smoke (task riêng, Lead boot một row/lượt).

## 6. Ghi chú vận hành

- Symlink 5 peer trong node_modules/@deepseek-ai/ (5 cấp ../../../../../apps/host/node_modules/@deepseek-ai/...).
- `tools/check/rows.ts` là tool dùng chung ĐANG được worker khác sửa (đo trong lượt này: 1.000–1.001 dòng,
  sát/vượt ngưỡng ≤1000) — không thuộc phạm vi gói này; mọi tệp của gói đều ≤810 dòng.
