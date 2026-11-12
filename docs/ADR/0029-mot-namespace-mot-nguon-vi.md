<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 02/11/2026
 desc ADR 0029 — LUẬT ĐĂNG KÝ TỪ ĐIỂN VI: một namespace chỉ được MỘT nguồn đăng ký "vi"
-->

# ADR 0029 — Một namespace, một nguồn từ điển VI

## Bối cảnh

Ngày 02/11/2026, app trắng UI (0 slot, `client-modules: apply for … threw`) với lỗi lặp lại:

```
locale namespace "slash.menu" already has locale "vi"
locale namespace "question" already has locale "vi"
locale namespace "settings.account" already has locale "vi"
```

Nguyên nhân: **HAI nguồn** cùng đăng ký `vi` cho một namespace —

1. gói trung tâm `@galaxy-blackhole/gbh-client-locale` (bảng `src/locales-vi.ts`), và
2. chính artefact của gói sở hữu namespace (`register(NS, { zh, en, vi })` do
   `tools/inject-vi-dictionary.ts` chèn vào).

Harness coi đây là lỗi: mỗi namespace chỉ được đăng ký MỘT lần cho mỗi locale ⇒ plugin ném ⇒
plugin không kích hoạt ⇒ UI trắng.

## Luật

| Namespace | Nguồn `vi` DUY NHẤT |
|---|---|
| `slash.menu` | gói trung tâm `gbh-client-locale` |
| `question` | gói trung tâm |
| `settings.account` | gói trung tâm |
| `session-delete` | gói trung tâm (`viSessionDelete`) |
| `shortcuts` | gói trung tâm |
| các namespace còn lại | artefact của gói sở hữu (`inject-vi-dictionary`) |

⇒ **Trước khi chạy `tools/inject-vi-dictionary.ts` cho một gói, phải kiểm namespace của gói đó
có nằm trong bảng trung tâm hay không.** Nếu có ⇒ KHÔNG chèn.

## Hệ quả đã đo

- Chèn `vi` cho `ui-input-trigger` (namespace `slash.menu`) và `ui-user-questions`
  (`question`) ⇒ app trắng (0 slot, 5 lỗi console).
- Bỏ `vi` ở đúng hai gói đó, giữ `vi` cho 10 gói còn lại ⇒ app **LÀNH 11/11**
  (57.083 ký tự `#root`, 48 slot, 0 lỗi console, bố cục **0/80** lệch).

## Không được làm

- `tools/locale/gen-vi.ts --write` ghi đè `packages/client/locale/src/locales-vi.ts` ⇒ **mất** các
  export viết tay (`viSessionDelete`, `viSettingsAccount`). Tệp đó là nguồn viết tay: chỉ `wire-vi`
  được nối, KHÔNG được sinh đè.
