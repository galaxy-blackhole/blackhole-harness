<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc ADR 0011: cơ chế mount row NHÓM (cordis:group) — viết lại con của MỘT row nhóm theo gbh.nested, nhận cả
      config MẢNG (optional-session-search) và ĐỐI TƯỢNG (config.plugins của preset); kèm số đo TRƯỚC/SAU
-->

# ADR 0011 — Mount row NHÓM (`cordis:group`)

- **Trạng thái:** ĐỀ XUẤT 19/10/2026 — người viết: tm-host-session (task-114)
- **Chặn gì:** 2 gói tool (`tool-session-query`, `session-query-sqlite`) đã port xong nhưng **không mount được**
  vì row thật của chúng nằm **BÊN TRONG một `cordis:group`** top-level (`optional-session-search`), không phải
  row top-level ⇒ trình sinh patch (chỉ xử lý row top-level, ADR 0007) không có chỗ để thay.

## 1. Số đo (dữ liệu THẬT, không suy đoán)

| sự thật | số đo |
|---|---|
| `cordis:group` là **row nhóm của Loader** (không phải gói plugin) | `tools/lint/parity-roles.ts:213`; hạng **T0** ở `tools/lint/parity-matrix.ts:191` |
| Row nhóm THẬT `optional-session-search` | `.parity/dumps/2026-10-17T05-02-00/oracleA_nopatch.yml` dòng **1272–1281**: `name: cordis:group` · `group: true` · `isolate: { sessionQuery: true }` · `config:` là **MẢNG** 2 con |
| Con cần thay | `optional-session-query-sqlite` → `@deepseek-ai/dsh-session-query-sqlite`; `optional-tool-session-query` → `@deepseek-ai/dsh-tool-session-query` |
| Nhóm LỒNG trong preset (hình dạng thứ hai) | `planning` (dòng 670/834) · `compaction` (731/895) · `delegation` (748) — `config.plugins[]` là **ĐỐI TƯỢNG** |
| Trước thay đổi: hàm viết lại chỉ dùng cho PRESET | `packages/host/agent-preset-registry/src/mount.ts:412–440` gọi `rewriteNestedNames` khi mount **preset**; **0** đường cho row nhóm top-level |
| Harness trước thay đổi | `tools/nested-mount/check.ts`: **9** phép kiểm (đều về preset) |

## 2. Quyết định

Thêm **API viết lại cho row NHÓM** trong `packages/host/agent-preset-registry/src/nested-mount.ts` (thuần, không IO):

| hàm | làm gì |
|---|---|
| `isGroupRow(row)` | nhận diện nhóm theo cờ `group: true` **hoặc** `name: cordis:group` |
| `rewriteGroupChildren(row, redirects)` | viết lại `name` của các CON theo bản đồ `gbh.nested`, giữ `id`/`group`/`isolate`/`disabled`/`config` của con; nhận **cả hai** hình dạng `config` (MẢNG và ĐỐI TƯỢNG) |
| `rewriteGroupRows(rows, redirects)` | áp cho danh sách row của cây cấu hình; bản đồ RỖNG ⇒ trả bản sao nông |

Nguyên tắc giữ nguyên: **không sửa tham số vào** (walker trả bản sao), **idempotent** (chạy 2 lần cùng kết quả),
**fail-soft** (gói khai `gbh.nested` mà thiếu `lib/index.js` ⇒ cảnh báo, không ném).

## 3. Bằng chứng TRƯỚC → SAU

| phép đo | TRƯỚC | SAU |
|---|---|---|
| `tools/nested-mount/check.ts` | 9 phép kiểm (chỉ preset) | **20** phép kiểm — thêm **11** ca nhóm (giữ `id`/`group`/`isolate` · con có/không khai `nested` · `config` của con nguyên vẹn · row không phải nhóm không bị đụng · `isGroupRow` · idempotent · không sửa tham số vào) — **ĐẠT** |
| `tests/host/nested-mount.test.ts` | **chưa có** | **8 pass / 0 fail / 29 expect** |
| Ca chứng minh ROW LỒNG THẬT đổi bundle | — | cấu trúc inline được **neo vào dump thật** (5 assertion trên `oracleA_nopatch.yml`), rồi áp bản đồ ⇒ con `optional-tool-session-query` thành **`@galaxy-blackhole/gbh-tool-session-query`** — đúng specifier mà Loader sẽ nạp |

## 4. Hệ quả & phần CÒN LẠI (nói thẳng)

- Cơ chế đã có, kiểm được, **không** đổi hành vi boot hiện tại (chưa nối vào đường sinh patch).
- **Nối vào boot cần thêm 1 bước ở `apps/cli/src/profile.ts`** (file của Lead, ngoài vùng ghi của tôi):
  khi ghi `app.patch.yml`, với mỗi gói khai `gbh.nested` mà row stock của nó là CON của một row nhóm top-level ⇒
  phát khối patch **thay cả row nhóm** (`- id: <groupId>`, `disabled: true`) + `- insert:` một bản sao nhóm
  (`name: 'cordis:group'`, `group: true`, `isolate:` giữ nguyên) với `config` đã viết lại bằng `rewriteGroupRows`.
  Lý do KHÔNG tự làm: cần đọc row nhóm GỐC từ profile đang chạy (không có trong repo), và `profile.ts` không thuộc
  vùng ghi được cấp.
- Rủi ro nếu nối sai: thay row nhóm là **thay cả cây con** ⇒ phải giữ `isolate` (nếu mất, `sessionQuery` không
  còn cách ly ⇒ `optional-session-query-sqlite` ghi vào store chung). Đây là lý do ADR yêu cầu **lab:row/boot-smoke
  do Lead chạy** trước khi bật.

## 5. Phương án bị loại

| phương án | vì sao loại |
|---|---|
| Sửa tay `app.patch.yml` | mất tính sinh tự động; mỗi lượt mount lại phải sửa tay, không kiểm được bằng cổng |
| Thêm row top-level riêng cho `tool-session-query` | Loader sẽ nạp **hai** thể hiện (nhóm + top-level) ⇒ trùng đăng ký slot/tool |
| `declare module` để merge | repo cấm (luật 000d) và không liên quan cơ chế mount |
| Nới `check:rows` cho gói nested | che mất ca thật; `check:rows` phải tiếp tục là cổng chặn |
