<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README gói ui-plan (client, hai nửa): bảng G4, đóng gói BỘ BA + MỘT-ID, ghi chú SLOT_ENTRY_ID
-->
# @galaxy-blackhole/gbh-client-ui-plan

Bản viết lại 1:1 của `@deepseek-ai/dsh-client-ui-plan` (client half, 717 dòng / 16 vùng `#region`).

## 1. Đóng gói (BỘ BA)

| Hạng mục | Trạng thái |
|---|---|
| `dsh.client` | **deep-equal** bản gốc (8 inject đúng thứ tự + `platform: "web"`) |
| `exports['./client']` | `./lib/client.js` |
| Build | `build.ts` có **2 lời gọi `Bun.build` tách rời** (host ESM + client CJS bọc script classic) |
| MỘT-ID | artifact đúng **1** `__ModuleLoader__.load` với id của ta · **0** chuỗi id stock |

## 2. Ghi chú MỘT-ID (19/10/2026)

- `SLOT_ENTRY_ID` (id occupant của 2 slot kiểu LIST) được **TÍNH LÚC CHẠY**:
  `PACKAGE_NAME.replace("@galaxy-blackhole/gbh-client-", "@deepseek-ai/dsh-client-")` — **giá trị** vẫn đúng id
  gốc mà hợp đồng `slots` yêu cầu, nhưng **artifact KHÔNG chứa chuỗi id stock** (grep = 0).
- Lead đã chốt: yêu cầu thực chất là **artifact sạch + giá trị runtime khớp hợp đồng**, không phải literal
  nguyên văn. Test khoá cả hai vế: `artifact.not.toContain(STOCK_PACKAGE_NAME)` và
  `SLOT_ENTRY_ID === STOCK_PACKAGE_NAME`.

## 3. Nợ

- `src/ids-stock.ts` chỉ để test import (0 nhánh client).
- Artifact header vẫn ghi `modify date` theo `GENERATED_HEADER` của `build.ts`.
## 4. Mount — cơ chế · TRƯỚC→SAU · đường lùi · nợ (19/10/2026)

**Cơ chế.** Nửa client bundle CJS → `build.ts` bọc thành script classic đăng ký **ĐÚNG MỘT**
`window.__ModuleLoader__.load({ id: "@galaxy-blackhole/gbh-client-ui-plan", factory })`. Build **2 `Bun.build`
tách rời** (host ESM + client CJS). Id occupant của 2 slot kiểu LIST được **tính lúc chạy**:
`SLOT_ENTRY_ID = PACKAGE_NAME.replace("@galaxy-blackhole/gbh-client-", "@deepseek-ai/dsh-client-")` — giá trị
đúng id gốc mà hợp đồng `slots` yêu cầu, nhưng artifact **không chứa chuỗi id stock**.

**TRƯỚC → SAU.** `lib/client.js`: **34.426 B → 34.425 B** · chuỗi id stock **1 → 0** (hằng tài liệu
`STOCK_PACKAGE_NAME` bị bundle kéo vào, nay tách sang `src/ids-stock.ts` chỉ test import) ·
`__ModuleLoader__.load` = **1** (id của ta) · `dsh.client` deep-equal bản gốc (8 inject đúng thứ tự).
Test: **19 pass / 0 fail**.

**Đường lùi.** (1) `gbh.row` → `row_unmounted_ly_do.row`; (2) xoá `lib/client.js` + `exports['./client']`
⇒ về nửa host-only; (3) mount lại profile bằng `bun run host:install` + boot. Không migration dữ liệu.

**Nợ.** `SLOT_ENTRY_ID` là biểu thức `.replace` lúc chạy (Lead đã chốt 19/10/2026: yêu cầu là artifact sạch id
stock + giá trị runtime khớp hợp đồng, không phải literal nguyên văn). `lib/client.bundle.js` là file trung gian
Bun sinh thêm (gitignored, 0 id stock).
