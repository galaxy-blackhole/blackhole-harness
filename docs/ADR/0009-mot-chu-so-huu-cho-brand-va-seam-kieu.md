<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc ADR 0009: MỘT chủ sở hữu cho brand + seam kiểu — cách sửa gốc TS2717/TS2322 giữa gói ta và d.ts stock
-->

# ADR 0009 — MỘT chủ sở hữu cho brand và seam kiểu (sửa gốc TS2717/TS2322)

- **Trạng thái:** ĐỀ XUẤT 19/10/2026 — người viết: tm-host-session (task-106)
- **Chặn gì:** `gate` đỏ hàng chục vi phạm **TS2717** (`Subsequent property declarations must have the same type`)
  và **TS2322** ở các gói `approval` · `authorization` · `llm` · `storage` · `storage-domain` · `tools`.

## 1. Nguyên nhân gốc (đo được, không suy đoán)

Hai nguyên nhân, cùng bản chất **hai bên cùng khai một thứ với hai kiểu KHÁC NHAU**:

**(a) Brand tự chế bằng `unique symbol` tại chỗ.** Bản gốc khai `export type ApprovalRequestId = Branded<'ApprovalRequestId'>`
với `declare const BRAND: unique symbol` **trong `@deepseek-ai/dsh-brand`**. Gói ta tự khai
`declare const APPROVAL_REQUEST_BRAND: unique symbol` rồi `string & { readonly [APPROVAL_REQUEST_BRAND]: "ApprovalRequestId" }`.
Hai `unique symbol` khác nhau ⇒ hai kiểu **in ra y hệt nhưng không gán được cho nhau** ⇒ khi cả hai bên khai cùng
một khoá `SessionEventMap`, tsc báo TS2717 dù thông điệp in ra hai kiểu trông giống hệt.

**(b) Seam `Context` bị khai lại.** Gói ta khai
`declare module "@deepseek-ai/cordis" { interface Context { authorization: AuthorizationService } }`
trong khi `@deepseek-ai/dsh-authorization/lib/types/index.d.ts:35` **đã khai đúng property đó** với LỚP của nó.
Hai lớp `AuthorizationService` khác nhau về cấu trúc ⇒ TS2717 (`Property 'authorization' must be of type …`).
Đo được ở `authorization:297` · `llm:981` · `storage:100` · `storage-domain:215` · (và `approval:177`).

## 2. Quyết định

**Một thứ chỉ có MỘT chủ sở hữu kiểu, và chủ đó là bản gốc (stock d.ts).**

| loại | luật |
|---|---|
| Brand | Khai bằng `Branded<"…">` **import từ `@deepseek-ai/dsh-brand`** (peer, CHỈ KIỂU). **CẤM** `declare const X: unique symbol` trong gói ta. |
| Seam `Context` | Property mà stock **đã** khai ⇒ gói ta **KHÔNG khai lại**; chỉ `import type {} from "<gói stock>"` để augmentation của stock có mặt trong chương trình. Property mà stock **chưa** khai mới được khai (kèm JSDoc). |
| Hệ quả tích cực | Lớp của ta bị tsc kiểm **cấu trúc** với kiểu stock ⇒ parity kiểu được ép tự động thay vì bị che bởi khai báo riêng. |

## 3. Bằng chứng TRƯỚC → SAU (pilot, đo 19/10/2026)

| gói | vi phạm TRƯỚC | cách sửa | SAU (tsc trên gói) |
|---|---|---|---|
| `approval` | **5** (TS2717 ×3 + TS2322 ×2) | brand → `Branded<"ApprovalRequestId">` của stock | **0** |
| `authorization` | **1** (TS2717 `:297`) | bỏ khai lại `Context.authorization` + `import type {} from "@deepseek-ai/dsh-authorization"` | **0** |
| `llm` | **1** (TS2717 `:981`) | bỏ khai lại `Context.llm` + `import type {} from "@deepseek-ai/dsh-llm"` | **0** |
| `storage` | **1** (TS2717 `:100`) | bỏ khai lại `Context.storage` + `import type {} from "@deepseek-ai/dsh-storage"` | **0** |
| `storage-domain` | **1** (TS2717 `:215`) | bỏ khai lại `Context.storageDomain` + `import type {} from "@deepseek-ai/dsh-storage-domain"` | **0** |

Mỗi gói cần thêm gói stock tương ứng vào `peerDependencies` + `devDependencies` + `gbh.peers` (CHỈ KIỂU, không
kéo mã lúc chạy: import dạng `import type {}`, bị xoá sạch khi build).

## 4. Hệ quả & rủi ro

- Không `@ts-ignore`, không nới `skipLibCheck`, không đổi ngưỡng cổng.
- Rủi ro: gói stock **biến mất** khỏi `apps/host/node_modules` (khi gỡ oracle) thì `import type {}` mất nguồn ⇒
  lúc đó phải chuyển sang một gói seam do TA sở hữu (`gbh-*-types`) và khai 1 lần cho toàn bộ khoá. Ghi nhận
  làm nợ kỹ thuật, không chặn hôm nay.
- `tools` (TS2339 ×10) KHÔNG thuộc phạm vi ADR này: lỗi phát sinh do tệp đang được agent khác ghi (`mtime` = giờ đo).

## 5. Phương án bị loại

| phương án | vì sao loại |
|---|---|
| `@ts-ignore` từng dòng TS2717 | che lỗi thật, luật repo cấm |
| Thêm `declare module` để "khai đè" | chính là nguyên nhân gốc; repo còn cấm `declare module` (luật 000d) |
| Nới `skipLibCheck`/`strict` | che toàn repo |
| Đổi tên property của ta (`authorizationOurs`) | phá parity hợp đồng với app đang chạy (row mount dùng đúng tên khoá) |
