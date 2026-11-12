<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Ke hoach dong M5 — 5 viec con lai, dieu kien nghiem thu tung viec, va thu tu
-->

# Kế hoạch đóng M5

## Số hiện tại (đo lúc 04:16, 18/10/2026)

| chỉ số | giá trị |
|---|---|
| `docs/M5-STATUS.md` | 59 row · **đang chạy thật 43** (từ 30 đầu đợt) |
| gói `client` trong repo | **55** |
| `(6)` gói của ta đang chạy | **47** |
| `#root` | **68.760** (bản lành — **mốc nghiệm thu**) |
| lỗi console | **0** |
| `check:rows` | **0 CHẶN** |
| `bun test` toàn repo | **861 pass · 0 fail** |

## 5 việc còn lại

| # | việc | trạng thái | điều kiện nghiệm thu |
|---|---|---|---|
| 1 | **`ui-sidebar-right`** | đã sửa (`TabDomain` — chứng minh bằng **tiêm lỗi tái hiện**), test 13/158 · chờ boot | `(8) #root` **≥ 68.760** · 0 lỗi console · `(5)` 0 |
| 2 | **`ui-trajectory`** | thiếu slot `conversation.view` — đang sửa | `check:rows` **0 `chan`** · rồi boot **riêng** |
| 3 | **`ui-workspace`** | gỡ mount **4 lần**; người hoàn tất đã sửa `primitives.MenuItem` + port (a)(b)(c) | **đo trên lab cách ly** (đổi bundle gốc vào cùng home) ⇒ ba số **bằng nhau**, rồi `#root` **≥ 68.760** |
| 4 | **`ui-conversation`** (20.064 dòng) | đang de-bundle (kế hoạch 3 lượt ở `docs/recipes/ROW-UI-CONVERSATION-PLAN.md`) | **parity từng byte** thân factory + CSS · 11 slot đủ · rồi boot |
| 5 | **`gbh-brand`** (shim) | đã **nhả row**, **không còn entry** | chờ **quyết định xoá của chủ dự án**; trước khi xoá phải sửa 2 ánh xạ vai trò (**đã sửa**) |

## Luật bắt buộc trước MỌI lượt boot (đã trả giá 3 lần)

1. **Không có writer nào chạy trong 2 phút gần nhất** — vì một lượt boot **build TẤT CẢ** gói có `gbh.row`,
   nên row của người khác đang viết dở **cũng bị build và mount** (đúng cơ chế sự cố 03:52).
2. **Tối đa 2 row mới mỗi lượt**; row **rủi ro** (nhiều slot · **đã từng làm vỡ app**) boot **riêng**.
3. **`check:rows` = 0 CHẶN** — cổng này **giải được hằng số**, là **phép DUY NHẤT** bắt được lớp *thiếu slot*.
4. **Nghiệm thu bằng `(8) #root` ≥ 68.760**, KHÔNG bằng *'0 lỗi console'* — lớp *mất nội dung âm thầm*
   có **0 lỗi console** và chỉ **kích thước** bắt được.

## Ba lớp lỗi và phép đo bắt được chúng (không phép nào thay được phép nào)

| lớp lỗi | lỗi console `(8)` | `#root` `(8)` | `check:rows` | `(9)` |
|---|---|---|---|---|
| sập (`apply` ném) | **bắt** | **bắt** | — | **bắt** |
| mất nội dung âm thầm | không | **bắt** | — | có thể |
| **thiếu slot** | **KHÔNG** | **KHÔNG** | **bắt** | **KHÔNG** |

## Sau khi 5 việc trên đóng

1. `gate` **8/8 XANH** đo lúc **0 writer** (hiện 7/8: `typecheck` 732 file · 0 vi phạm).
2. `parity:report` — lưu ý **đọc SỐ, không đọc verdict**: `(9)` lệch **2 span brand** là **hệ quả của việc oracle
   còn chạy shim `gbh-brand`** (wordmark 149px) trong khi ta chạy bản viết lại trung thành DSH (188px) —
   **chờ chủ dự án chốt (i)/(ii)/(iii)**.
3. **Báo cáo tiến độ M5 cho chủ dự án**, rồi mở **M6 (tool/LLM/sandbox)** — M3 (kernel/core) **làm cuối**.
