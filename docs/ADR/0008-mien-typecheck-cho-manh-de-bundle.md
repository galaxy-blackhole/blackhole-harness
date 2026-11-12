<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc ADR 0008: miễn typecheck cho MẢNH DE-BUNDLE (src/parts/*) — vì mảnh không phải module và được
      kiểm bằng BYTE-PARITY với bundle gốc; kèm số đo TRƯỚC/SAU của cổng typecheck
-->

# ADR 0008 — Miễn typecheck cho MẢNH DE-BUNDLE (`src/parts/*`)

- **Trạng thái:** ĐỀ XUẤT 19/10/2026 (chờ Lead duyệt) — người viết: tm-host-session (task-106)
- **Chặn gì:** cổng `typecheck` đỏ **102 vi phạm** chỉ vì các mảnh de-bundle, dù không có lỗi kiểu thật nào
  (đo 19/10/2026 06:2x: `checked=2247 · total=102 · fragment=102 · real=0`).

## 1. Bối cảnh (số đo)

15 gói dùng chiến lược **de-bundle**: `src/parts/part-NN-*.ts` là **lát NGUYÊN VĂN** của bundle gốc
(`lib/index.js`), được `build.ts` (13 gói kèm `src/assemble.ts`) nối lại và **so BYTE** với bundle gốc.

| sự thật | số đo (19/10/2026) |
|---|---|
| Số gói có `src/parts/` | **15** (`ls -d packages/*/*/src/parts`) — 100 % có `build.ts` |
| Vi phạm typecheck TRƯỚC khi sửa | **102**, **toàn bộ** thuộc `packages/host/session-persistence-jsonl/src/parts/*` |
| Loại lỗi | **TS1005/TS1128/TS1434** = lỗi **CÚ PHÁP** (không phải lỗi kiểu) |
| Vi phạm KHÔNG thuộc mảnh | **0** ⇒ không có lỗi kiểu thật nào bị che |
| File trong chương trình tsc | **2247 → 1963** (−284 mảnh) sau khi sửa |

Vì sao lỗi cú pháp: mảnh cắt **ngang ranh giới cú pháp** của bundle (ví dụ phần thân class
`JsonlSessionPersistence` bắt đầu giữa danh sách thuộc tính) nên **không parse được như một module độc lập**.
`// @ts-nocheck` KHÔNG cứu được: nó chỉ tắt lỗi **ngữ nghĩa**, còn TS1005 là lỗi **parse**.

## 2. Quyết định

**Loại MẢNH DE-BUNDLE khỏi CHƯƠNG TRÌNH typecheck**, tại **MỘT chỗ duy nhất**:
`tools/lint/gate.ts` → `typecheckFiles()` lọc qua `isGeneratedFragment()`.

Điều kiện miễn (chặt, không miễn tràn lan): file khớp **MỘT TRONG HAI** quy ước đặt tên đang dùng trong repo —
(1) `/src/parts/<tệp>.ts(x)` (15 gói de-bundle chia `parts`), (2) `/src/<tên>-slice[-N].ts(x)` (lát nguyên văn
manifest typert, vd `packages/host/subagent/src/typert-host-slice-b.ts`) — **VÀ** gói chứa nó có `build.ts`
(tức tồn tại pipeline artifact thật để kiểm thay). Gói không có `build.ts` thì **vẫn bị typecheck**.

**Bổ sung 19/10/2026 07:1x** — ca thật thứ hai: `packages/host/subagent/src/typert-host-slice-{a,b}.ts`
(mtime 07:02, `// @ts-nocheck`, "Lát NGUYÊN VĂN … build.ts ghép rồi cổng byte") sinh **369** vi phạm cú pháp
ngay sau khi được ghi. Quy ước (2) ra đời từ ca này; kiểm lại: `typecheckFiles()` còn **0** tệp `-slice`.

## 3. Bằng chứng thay thế (mạnh hơn tsc cho mảnh)

| cổng | mảnh được kiểm thế nào |
|---|---|
| `build.ts` của gói | nối mảnh → so **BYTE** với bundle gốc (`lib/index.js`); lệch 1 byte là build đỏ |
| `check:rows` | gói de-bundle (không có `src/index.ts`) được đối chiếu **export trên artifact đã build** với bản gốc (bản vá 19/10/2026) |
| `header` · `file-length` · `jsdoc` | **vẫn kiểm bình thường** trên mảnh (miễn trừ CHỈ áp cho typecheck) |
| `gate` cổng `test` | test của gói chạy trên artifact/API, không trên mảnh |

## 4. Hệ quả

- `gate --no-tests --only typecheck`: **102 → 0 vi phạm**; file trong chương trình **2247 → 1963**.
- Rủi ro còn lại: một mảnh có **lỗi kiểu** (không phải lỗi cú pháp) sẽ không bị tsc bắt. Chấp nhận vì mảnh là
  bản sao 1:1 của bundle gốc **đã chạy production**, và byte-parity chặn mọi sửa đổi tay.
- Không thêm `@ts-ignore`, không nới `skipLibCheck`, không đổi ngưỡng cổng nào khác.

## 5. Phương án bị loại

| phương án | vì sao loại |
|---|---|
| `// @ts-nocheck` từng mảnh | **không tắt được lỗi cú pháp** (TS1005) — đã có sẵn trong mảnh mà vẫn đỏ |
| Bọc mỗi mảnh vào `function`/`namespace` cho parse được | phá **byte-parity** (thêm chữ vào bản sao) và làm build.ts so byte thất bại |
| `skipLibCheck` toàn cục / nới `strict` | che lỗi thật ở toàn repo — luật repo cấm |
| Chuyển mảnh sang `.js` để tsc bỏ qua | mất `@ts-nocheck`/`allowJs` ngữ nghĩa, và vẫn lẫn với mã nguồn thật khi grep/đếm dòng |
