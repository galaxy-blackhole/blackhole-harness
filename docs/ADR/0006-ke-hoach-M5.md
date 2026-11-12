> ⚠️ **Ghi chú 18/10/2026 (Lead):** các đường dẫn trong ADR này là **bản ghi LỊCH SỬ** tại thời điểm quyết định
> — nhiều đường dẫn trỏ tới layout **trước khi đổi tên** (`galaxy-code/…`) nên **KHÔNG còn tồn tại**.
> Đây **không phải dẫn chiếu chết cần sửa**: ADR là **ảnh chụp quyết định**, không phải tài liệu hướng dẫn hiện hành.
> Tài liệu hiện hành: `docs/ARCHITECTURE.md` · `docs/recipes/*` · `docs/M6-REMAINING.md`.

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc ADR 0006: ke hoach M5 — viet lai client shell + 49-60 plugin UI, thu tu, cach do, rui ro
-->

# ADR 0006 — Kế hoạch M5: viết lại client shell + 49–60 plugin UI

- **Ngày**: 17/10/2026 · **Trạng thái**: dự thảo đã chốt · **Người quyết**: Lead
- **Căn cứ**: [PARITY-MATRIX.md](../PARITY-MATRIX.md) (60 row tầng T3) · fixture C1 `tests/contract/fixtures/c1-boot-graph.json` (72 entry, 3 batch)

## 1. Phạm vi đo được (không phỏng đoán)

| Hạng mục | Số liệu thật |
|---|---|
| Entry trong đồ thị boot | **72** |
| Batch khởi động | **3** — `bootstrap` (nạp `client-modules`), `application`, và batch còn lại |
| Row tầng T3 trong ma trận | **60** |
| Gói `ui-*` | 49 (cộng client infra: connection, modules, hmr, locale, resources, store, shortcuts…) |
| Cấu trúc đồ thị | **không phải DAG**: 1 id mồ côi (`ui-primitives` do bundle gộp) + **2 chu trình** (conversation↔workspace, …) |

## 2. Thứ tự viết lại (theo mức rủi ro giảm dần)

| # | Nhóm | Vì sao thứ tự này | Đo bằng |
|---|---|---|---|
| 1 | **`client-modules`** (bộ nạp module phía browser) + `client-connection` | Là *xương sống*: nạp mọi thứ khác, giữ hợp đồng C2. Sai ở đây thì mọi plugin sau đều vô nghĩa | test hợp đồng C2 (thực thi loader thật trong `window` giả) + hash `__DSH_BOOT__` + ảnh A/B |
| 2 | **`ui-theme` + `ui-layout` + `ui-slots`/`ui-primitives`** | Chủ sở hữu token `--dsw-*` và khe cắm; mọi plugin sau dùng lại | ảnh A/B chế độ sáng/tối + `gate:style` (không màu literal) |
| 3 | **Shell**: `ui-sidebar`, `ui-sidebar-right`, `ui-conversation`, `ui-chat`, `ui-session`, `ui-workspace` | Khung nhìn thấy ngay; đã có ảnh A/B cho từng màn | ma trận ảnh (24 màn hiện có) |
| 4 | **Feature**: composer (`ui-commands`, `ui-input-trigger`, `ui-model-selection`, `ui-permission-presets`), tool (`ui-tool`, `ui-trajectory`), `ui-jobs`, `ui-plan`, `ui-goal`, `ui-subagent` | Nhiều hành vi, ít rủi ro cấu trúc | ảnh A/B + test hành vi riêng |
| 5 | **Bảng/khung phải**: `ui-deliverables`, `ui-sidebar-files`, `ui-sidebar-documentpreview`, `ui-schedule`, `ui-workflow-run`, `ui-user-questions`, `ui-approval` | Phụ thuộc dữ liệu phiên; đo sau khi state đã chuẩn hoá | ảnh A/B + `parity:dom` |
| 6 | **Settings**: 6 tab (`general`, `models`, `plugins`, `plugin-inventory`, `subagent`, `agent-loop`, `web-search`, `shell`, `session-log`) | Số lượng nhiều nhưng mẫu giống nhau | ảnh A/B từng tab |
| 7 | **Brand + locale cuối cùng**: thay `@galaxy-stack/gbh-brand` bằng **`@galaxy-blackhole/gbh-brand`** do ta viết | Đây là món nợ tạm của M1; viết sau cùng vì nó phụ thuộc mọi slot đã có | ảnh A/B + soát chuỗi thương hiệu (đã phát hiện lệch 'GALAXY BLACKHOLE' vs 'Galaxy Blackhole') |

## 3. Cách làm mỗi plugin (khuôn bắt buộc)

1. **Đối chiếu**: đọc `.d.ts` + `lib/client.js` của gói gốc trong `apps/host/node_modules/@deepseek-ai/*` (chỉ đọc) và README upstream trong `vendor/dsh-reference`.
2. **Viết lại**: React 19 + **CSS Modules + `clsx`**, chỉ token `--dsw-*`, **không Tailwind**, **giữ SVG gốc của DSH cho icon parity** (lucide chỉ cho UI mới của Blackhole).
3. **Không chép code**: ghi bảng nguồn đối chiếu trong README của package (như [gói webserver](../../packages/host/webserver/README.md) đã làm).
4. **Cặp mount**: `disabled: true` row stock + `insert` row của ta (id riêng) — vì `name` là GUARD ([ADR 0005](0005-parity-do-hanh-vi-chu-khong-do-ten-goi.md)).
5. **Bằng chứng bắt buộc**: (a) dump-config: row vào chỉ số `đã thay N row` với test hành vi trỏ đúng; (b) ảnh A/B cho mọi màn hình plugin đó sở hữu; (c) test hành vi của package; (d) gate xanh.

## 4. Rủi ro đặc thù của M5 (khác M4)

| # | Rủi ro | Đối sách |
|---|---|---|
| R1 | **Loader client (`client-modules`) là mảnh khó nhất** — nửa Node dựng đồ thị, nửa browser là bảng CJS lười; phải chịu được chu trình + id mồ côi | Làm ĐẦU TIÊN; test bằng chính fixture C1 (đã có sẵn đồ thị thật 72 entry) |
| R2 | **Slot/inject semantics** quyết định plugin bên thứ ba có cắm được hay không (G1) | Giữ nguyên tên slot + thứ tự ưu tiên; test bằng một plugin UI tự viết cắm vào khe của ta |
| R3 | **Ảnh A/B nhiễu do state** (đã gặp: hàng chip workspace, danh sách session) | Chuẩn hoá state trước khi chụp; mask `state-*` chỉ là nợ tạm, phải gỡ dần |
| R4 | **Nhiều màn cần RPC** (plugin inventory, terminal) — bài học từ 5 màn FAIL ở M1c | Cổng trạng thái trước khi chụp + network capture khi FAIL |
| R5 | Khối lượng: 60 row × (viết + test + ảnh) | Chia theo nhóm ở §2, mỗi nhóm một task có write scope riêng; không mở hai nhóm cùng lúc trên cùng package |

## 5. Điều kiện vào M5

- M4 xong (host/API đã thay hết) **hoặc** ít nhất `webserver` + các controller chính đã xanh trace.
- `parity:trace` chạy được và sạch với các route đã thay.
- Ma trận ảnh UI có ≥24 màn với số đo (hiện: 24 màn, 19 PASS 0 px).
