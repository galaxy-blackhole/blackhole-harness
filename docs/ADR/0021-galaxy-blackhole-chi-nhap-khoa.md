<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 25/10/2026
 desc ADR 0021 — provider Galaxy Blackhole (route `auto`) chỉ nhập KHOÁ API; ẩn "Cài đặt tuỳ chỉnh" và tooltip "?"
-->

# ADR 0021 — Galaxy Blackhole chỉ nhập khoá API

## Bối cảnh

Sau khi trả lại nút "Sửa" (ADR 0019), bảng soạn của provider Galaxy Blackhole hiện **đủ** các trường của bản
DSH gốc: Khoá API · "Cài đặt tuỳ chỉnh" (Tên hiển thị, URL gốc, API protocol) · nút "?" trợ giúp.

Nhưng route `auto` là **route đặc biệt của Galaxy Blackhole**: khoá mặc định là của **Ollama**, route được
ngầm hiểu là `deepseek-v4.1-flash`. Các trường kia **không có nghĩa**; còn tooltip "?" lại nhắc đường dẫn env
của bản DSH (`$DSH_HOME/.env`) — sai thương hiệu.

## Quyết định

1. `models-section.ts`: hai chỗ gọi `renderProviderEditor` truyền `credentialOnly: target.provider === "auto"`
   ⇒ với route `auto` bảng soạn **chỉ còn ô "Khoá API"** (khối "Cài đặt tuỳ chỉnh" bị bỏ, cờ này đã có sẵn
   trong bản gốc và đang dùng cho luồng onboarding).
2. `provider-editor.ts`: `authHelp` = `null` khi `credentialOnly === true` ⇒ **ẩn nút "?"** cho route `auto`.
3. `locales.ts` / `locales-vi.ts`: câu trợ giúp đổi `$DSH_HOME/.env` → **`GBH_HOME/.env`** (chuỗi vẫn còn
   cho các provider khác).

## Hệ quả

- Provider khác **không đổi gì**: vẫn đủ trường và tooltip.
- Bản mount dựng từ `src/` (artefact trong repo là bản de-bundle để test parity) nên thay đổi này hiện ra sau
  một lượt restart host.
