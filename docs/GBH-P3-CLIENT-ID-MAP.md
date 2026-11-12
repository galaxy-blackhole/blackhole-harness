<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 03/11/2026
 desc Kiểm kê và kế hoạch đổi tên ID ẢO của client (P3) — nhóm KHÔNG phải gói npm
-->

# P3 — Bản đồ ID ảo của client

## Vì sao phải tách khỏi P1b

P1b đổi tên **specifier gói npm** (`@deepseek-ai/dsh-x` → `@galaxy-blackhole/gbh-x`) bằng bản đồ
`gbh.provenance.stock`. Nhưng client còn một lớp **ID ẢO** do vỏ SPA cấp phát trong *bảng module*:
chúng **không phải gói npm**, không có trong `apps/host/node_modules`, nên bản đồ gói không phủ.
Đổi tên chúng phải sửa **đồng thời** artefact client + bảng đăng ký của vỏ, nếu lệch một bên là
`client-modules: could not load …` ⇒ UI trắng.

## Số đo (03/11/2026)

| ID ảo gốc | Tham chiếu trong `src` | Lần xuất hiện trong artefact `lib/client.js` |
|---|---|---|
| `dsh-client-store` | 129 | 46 |
| `dsh-client-ui-primitives` | 138 | 59 |
| `dsh-client-ui-slots` | 21 | 7 |
| `dsh-client-ui-dockkit` | 9 | 6 |
| `dsh-typert-generator` | 26 | 0 |
| **cộng** | **323** | **118** |

Ngoài ra, toàn bộ `@deepseek-ai/*` còn lại (03/11/2026): **4.032** trong `src`, **3.956** trong manifest,
**731** tệp artefact.

## Cách làm đúng (một lô nguyên tử)

1. Chọn id mới theo quy ước: `dsh-client-store` → `gbh-client-store`, `dsh-client-ui-primitives` →
   `gbh-client-ui-primitives`, … (giữ hậu tố, đổi tiền tố).
2. Sửa **cùng một commit**: (a) mọi `src` của gói client, (b) mọi artefact `lib/client.js`,
   (c) mọi `gbh.client.inject` / `dsh.client.inject` trong manifest, (d) bảng id của vỏ
   (`packages/client/modules` + bất kỳ chỗ nào khai `MODULE_IDS`).
3. Kiểm: `bun test` 0 đỏ → `bun run check:app` phải **11/11** (đây là phép đo bắt được lệch id).
4. Nếu `check:app` báo 0 slot: **revert ngay** cả lô (đã có tiền lệ: id lệch làm trắng UI).

## Luật

- KHÔNG đổi riêng `src` (artefact sẽ lệch) và KHÔNG đổi riêng artefact (test khuôn bundle sẽ đỏ).
- Mỗi lô ≤ 2 id, chạy `check:app` sau mỗi lô.
- Ghi lại số đo trước/sau vào tệp này.
