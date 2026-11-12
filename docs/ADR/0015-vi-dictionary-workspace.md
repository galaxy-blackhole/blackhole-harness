<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 24/10/2026
 desc ADR 0015 — bù từ điển tiếng Việt cho namespace workspace (menu ngữ cảnh phiên ở sidebar)
-->

# ADR 0015 — Bù từ điển tiếng Việt cho namespace `workspace`

## Bối cảnh

Menu ngữ cảnh của phiên ở sidebar ("Pin session", "Rename", "Fork session", "Archive session",
"Copy Session ID") hiện tiếng Anh trong khi các nhãn khác của sidebar đã tiếng Việt.

Điều tra (24/10/2026):

- Chuỗi nằm ở gói `gbh-client-ui-workspace`, namespace `workspace` (`menu.pinSession`, `menu.archiveSession`, …).
- Gói này đã **de-bundle**: `build.ts` TỪ CHỐI build đè khi có `src/parts/`, và `buildPackage` chỉ **copy**
  `lib/client.js` ⇒ sửa nguồn TS (`src/locales-vi.ts`) **không** tới được artefact đang phục vụ.
- Artefact de-bundle chỉ có **13 khoá** vi (bản "chrome" cũ); nguồn đã có **121 khoá**.
- Không thể bù từ tầng gói locale: `locale.register` **ném** khi namespace đã có `vi`, làm sập cả UI
  (đã đo: `#root` từ 56.184 xuống 1.993 ký tự, 3 lỗi console). Đã revert.

## Quyết định

Dùng đúng công cụ của repo: **`tools/inject-vi-dictionary.ts`** (chèn/ghép từ điển vi vào artefact
de-bundle, từ điển là DỮ LIỆU nên vẫn giữ canon 1:1).

1. Gộp 121 khoá từ `packages/client/ui-workspace/src/locales-vi.ts` vào
   `packages/client/ui-workspace/locale/vi-chrome.json` (nguồn override của công cụ; bản dịch đã có được ưu tiên).
2. Chạy `bun run tools/inject-vi-dictionary.ts packages/client/ui-workspace` → `da chen` (232.912 B → 240.129 B).
3. Kiểm: artefact có `Ghim phiên` · `Lưu trữ phiên`; `tests/client/ui-workspace.test.ts` **23/23 ĐẠT**;
   `check:app` (8) **ĐẠT** — 56.172 ký tự `#root`, 48 slot, **0 lỗi console**.

## Hệ quả

- Artefact lệch gói gốc đúng phần **dữ liệu từ điển** (Δ ≈ 7,2 KB), không đổi mã/hành vi.
- Muốn bổ sung bản dịch về sau: thêm khoá vào `locale/vi-chrome.json` rồi chạy lại công cụ (idempotent —
  công cụ chỉ ghép khoá CÒN THIẾU, không ghi đè bản dịch đã có).
- Khi gói `ui-workspace` được tái sinh bằng `tools/debundle-client.ts`, phải chạy lại công cụ này
  (artefact mới sinh từ bundle gốc sẽ mất phần vi).
