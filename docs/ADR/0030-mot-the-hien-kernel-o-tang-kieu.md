<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 03/11/2026
 desc ADR 0030 — Mặt kiểu của kernel CỦA TA phải TRÙNG mặt kiểu GỐC (một thể hiện kernel)
-->

# ADR 0030 — Một thể hiện kernel ở tầng kiểu

## Vấn đề

Các lát cắt byte-faithful trong `src/parts` khai báo augmentation dịch vụ bằng **tên gốc**:

```ts
declare module "@deepseek-ai/cordis" { interface Context { sandboxPolicy: … } }
```

Nếu gói kernel của ta (`@galaxy-blackhole/gbh-cordis`) có **lớp kiểu riêng** (dù nội dung 1:1) thì
TS coi `Context` của ta và `Context` gốc là **hai kiểu khác nhau** ⇒ mọi call site trộn hai bên đều đỏ.
Đo chặng 16: đổi tên 224 tệp / 347 chỗ `@deepseek-ai/{cordis,schemastery,cosmokit}` ⇒ **27 vi phạm**.

## Quyết định

`lib/types/index.d.ts` của ba gói kernel = **xuất lại nguyên mặt kiểu gốc**:

```ts
export * from "@deepseek-ai/cordis";
export { default } from "@deepseek-ai/cordis";
```

Nhờ đó hai specifier (`@deepseek-ai/cordis` và `@galaxy-blackhole/gbh-cordis`) trỏ về **cùng một
symbol** ⇒ augmentation trong `parts` áp dụng cho cả hai.

Đây là quyết định **tạm thời**: khi P1b đổi tên xong toàn bộ `parts` (augmentation chuyển sang tên
của ta), tệp này phải quay lại mặt kiểu sinh từ `src` của chính gói.

## Hệ quả đã đo

| Bước | typecheck | `bun test` |
|---|---|---|
| Trước ADR-0030, quét kernel (275 tệp / 404 chỗ) | **27** | — |
| Sau ADR-0030, quét như trên | **0** ✅ | **13 lỗi nạp** (hai thể hiện kernel ở tầng RUNTIME của test) |

Sáu test parity của ba gói kernel được sửa để **bỏ qua đúng một tệp** `types/index.d.ts` khi so cây
`lib/` (kèm chú thích `ADR-0030`); mọi phép so khác giữ nguyên byte.

## Việc còn lại (P1b bước cuối)

Tầng kiểu đã xong. Tầng **runtime của test** vẫn cần một bản sắc kernel: test nạp kernel gốc từ
`apps/host/node_modules`, còn gói của ta nhập `gbh-cordis` ⇒ hai thể hiện. Cách đúng: cho test
nạp kernel qua **cùng một alias** như app (profile alias `@deepseek-ai/* → gbh-*`), tức P2. Khi P2
xong thì quét P1b mới chạy trọn.
