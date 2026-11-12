<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi shell-identity: lop vo L3 — route de favicon/manifest GBH + tapIndex title, KHONG cham bootstrap
-->

# `@galaxy-blackhole/gbh-host-shell-identity`

Lớp **vỏ L3** của Galaxy Blackhole (xem `docs/reports/shell-identity-plan.md`, đường A): đè 3 asset của vỏ DSH
bằng asset GBH **ngay trên HTTP đang phục vụ**, không thay dist frontend, không chạm bootstrap/module-loader.

| # | việc | cơ chế | bằng chứng |
|---|---|---|---|
| 1 | `/favicon.svg` + `/favicon-dark.svg` trả **favicon GBH** | route đặt tên thắng fallback dist | test HTTP thật: `sha256(body) === 105ca4ce…` |
| 2 | `/manifest.webmanifest` trả **manifest GBH** (`name: Galaxy Blackhole`, `short_name: GBH`) | route đặt tên | test HTTP thật: JSON đọc được, 0 chuỗi DSH |
| 3 | `<title>DeepSeek Harness</title>` → `<title>Galaxy Blackhole</title>` | `webServer.tapIndex` (tap chuỗi **chỉ** thay đúng thẻ title) | test: mọi byte khác title giữ nguyên, idempotent |

## 1. Ràng buộc thiết kế (đo được)

- **KHÔNG chạm bootstrap/module-loader**: artifact `lib/index.js` không chứa `__ModuleLoader__`, `staticModules`,
  `__DSH_BOOT__` (test canh) ⇒ không đổi cách nạp plugin, không đụng 53 bundle client đang `require` module DSH.
- **Thiếu seam `webServer` ⇒ log lỗi rồi thoát, KHÔNG ném** ⇒ app vẫn chạy (rollback an toàn).
- **Rollback**: xoá 2 khối `shell-identity` trong `<home>/app.patch.yml` rồi boot lại.

## 2. Manifest

```json
"gbh": { "row": { "id": "shell-identity", "insertAs": "shell-identity", "disabled": false, "tests": ["tests/host/shell-identity.test.ts"] },
         "rollback": { "cachGo": "xoa khoi trong <home>/app.patch.yml roi boot lai" } }
```

## 3. Kiểm

```bash
bun test tests/host/shell-identity.test.ts   # 6 ca: metadata/rollback · sha256 asset · 3 route + tap · HTTP thật · 405
bun run packages/host/shell-identity/build.ts
```
