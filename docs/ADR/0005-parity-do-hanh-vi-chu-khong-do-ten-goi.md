> ⚠️ **Ghi chú 18/10/2026 (Lead):** các đường dẫn trong ADR này là **bản ghi LỊCH SỬ** tại thời điểm quyết định
> — nhiều đường dẫn trỏ tới layout **trước khi đổi tên** (`galaxy-code/…`) nên **KHÔNG còn tồn tại**.
> Đây **không phải dẫn chiếu chết cần sửa**: ADR là **ảnh chụp quyết định**, không phải tài liệu hướng dẫn hiện hành.
> Tài liệu hiện hành: `docs/ARCHITECTURE.md` · `docs/recipes/*` · `docs/M6-REMAINING.md`.

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc ADR 0005: parity do HANH VI chu khong do ten goi — bang tuong duong + rao chan + rang buoc G4
-->

# ADR 0005 — Parity đo HÀNH VI, không đo tên gói

- **Ngày**: 17/10/2026 · **Trạng thái**: đã chốt · **Người quyết**: Lead

## Bối cảnh

Bước 2 thay từng row plugin của DSH bằng package của ta (`@deepseek-ai/dsh-<x>` → `@galaxy-blackhole/gbh-<x>`).
Bộ diff của giàn parity so **cả lá `name`** trong dump-config, nên:

```text
IDENTICAL  → { added: 0, missing: 0, changed: 0 }
NAME-SWAP  → { added: 0, missing: 0, changed: 1, changedSample: [webserver.name] }
```

Nếu giữ nguyên cách so, **mỗi lần thay một row là parity đỏ**, và tới M3 (thay hết) thì parity trở thành vô nghĩa —
đúng lúc nó cần có giá trị nhất.

## Quyết định

**Parity chứng minh hành vi tương đương, không phải tên gói giống nhau.** Tên gói là *danh tính*, không phải *hành vi*.
Nhưng việc thay gói **không được phép trở nên vô hình** — nó được tách thành hai chỉ số riêng:

| Chỉ số | Ý nghĩa | Ngưỡng |
|---|---|---|
| `THÊM / THIẾU / ĐỔI` | khác biệt **hành vi + cấu hình** | phải **0** |
| `đã thay N row` | tiến độ thay implementation của ta (G3/G4) | **không phải lỗi**, phải liệt kê đủ N row |

### Cơ chế

1. **Bảng tương đương** đọc từ [`docs/PARITY-MATRIX.md`](../PARITY-MATRIX.md) (cột *gói DSH → gói ta*) — một nguồn sự thật duy nhất,
   không hard-code ở hai nơi.
2. Khi so lá `name`: nếu tên **của ta** là bản tương ứng **đã khai** của tên tham chiếu → tính `unchanged`, tăng `swappedRows`.
3. **Rào chắn (bắt buộc, có test hồi quy):**
   - Tên của ta **không có trong bảng** → vẫn tính là **ĐỔI** (không thể vô tình che một gói lạ).
   - **Row `id` đổi** → vẫn tính là **ĐỔI** (ta chỉ thay implementation, không đổi danh tính row).
4. Báo cáo in `THÊM · THIẾU · ĐỔI · đã thay N row` kèm danh sách N row đó.

### Ràng buộc G4 đi kèm (quan trọng nhất)

Việc bỏ qua khác biệt `name` **chỉ hợp lệ khi có bằng chứng hành vi thay thế**:

> Mỗi row đã thay **phải có test hành vi tương ứng** (đường dẫn test của chính package đó).
> Row đã thay mà chưa có test → đánh dấu **CHƯA ĐẠT**, không được tính PASS.

Lý do: dump-config chỉ chứng minh **cấu trúc cây và cấu hình** khớp; hành vi được chứng minh bởi các cổng khác
(unit/integration của package, `parity:dom`, `parity:trace`, session round-trip, ảnh A/B). Nếu không ràng buộc,
việc "thay gói" có thể trượt thành "đổi hành vi mà không ai biết".

## Phụ lục — khuôn viết package của ta (chốt cùng ngày)

Package của ta khai `@deepseek-ai/cordis` và `@deepseek-ai/schemastery` là **peerDependencies** (đúng khuôn upstream),
không phải dependencies. Hệ quả:

1. **Chỉ có một instance cordis** — do kernel cấp; không có chuyện "hai bản cordis".
2. Giữ được **schema** cho config editor (Settings) — M5/M6 cần, và mất schema là lệch hợp đồng C7.
3. Ở **M3**, gói tương thích của ta phơi dưới đúng tên `@deepseek-ai/cordis` (§4.6, hướng K1) nên các import này
   tự nhiên trỏ về kernel của ta — **không phải viết lại gì thêm**.

Song song, package vẫn phải **seam-true**: chỉ nói chuyện qua seam của kernel (`ctx.provide`/`ctx.effect`),
không kéo khái niệm harness vào thân package.
---

## Phụ lục 2 — `name` là GUARD, nên việc thay gói có dạng CẶP (đo 17/10/2026)

Khi làm M4a, một phát hiện làm đổi cách làm của cả M4/M5/M6:

```js
// apps/host/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js — applyEntryPatches
const { id, insert, name, ...overrides } = patch;
if (name && name !== target.name) { warn("patch: name mismatch ..."); continue; }
```

**`name` trong patch là cái GUARD (phải KHỚP thì patch mới áp), không phải setter.** Ghi tên gói của ta vào `name`
bị bỏ qua âm thầm (chỉ một dòng cảnh báo). Vì vậy một lần thay implementation **luôn là một cặp**:

1. `- id: <row stock>` + `disabled: true`
2. `- insert:` row của ta với **id riêng** (`webserver-ours`), giữ nguyên `inject` + `config`

(Đúng khuôn `gbh-brand` đã dùng với `ui-brand-official`.)

### Hệ quả cho bảng tương đương (bổ sung cho §Cơ chế ở trên)

Quy tắc khớp là **2-đổi-1**, không phải 1-đổi-1:

> Cặp (`id=X` bị `disabled: true` ở bên ta) + (`id=X-ours` được `insert`, tên gói là bản tương ứng đã khai
> trong ma trận) ≡ 1 row `X` của tham chiếu ⇒ `swappedRows += 1`, **không** tính là THÊM + ĐỔI.

Rào chắn giữ nguyên và siết thêm:
- Tên gói của row `X-ours` phải có trong bảng tương đương; không có → vẫn tính THÊM.
- `inject` và `config` của row `X-ours` phải khớp row `X` của tham chiếu; khác → vẫn tính ĐỔI.
- Row stock bị disable mà **không** có row `X-ours` tương ứng → vẫn tính ĐỔI (tắt plugin là thay đổi hành vi thật).

### Hệ quả cho M7 (độc lập hoàn toàn)

Cây plugin cuối cùng sẽ có dạng *N row stock bị disable + N row của ta*. Đó là hình dạng đúng trong lúc chuyển tiếp,
nhưng ở M7 profile/bundle của ta phải **thay hẳn lớp bundle của DSH** để cây trở lại sạch, không còn row disable nào.

### Bài học về đo lường đi kèm

Cùng lúc đó, một bug thật trong package mới được tìm ra nhờ đo **kích thước phản hồi** thay vì chỉ đo HTTP status:
`installGzip` phải **hoãn `writeHead`** (node đánh dấu header đã gửi ngay khi handler gọi `writeHead`), nếu không thì
nén im lặng không chạy. Sau khi sửa: **48.882 B → 13.036 B** với `content-encoding: gzip`.
Vì vậy `parity:trace` của một row đã thay **phải so cả kích thước và encoding của phản hồi**, không chỉ so mã trạng thái.
