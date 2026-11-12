> ⚠️ **Ghi chú 18/10/2026 (Lead):** các đường dẫn trong ADR này là **bản ghi LỊCH SỬ** tại thời điểm quyết định
> — nhiều đường dẫn trỏ tới layout **trước khi đổi tên** (`galaxy-code/…`) nên **KHÔNG còn tồn tại**.
> Đây **không phải dẫn chiếu chết cần sửa**: ADR là **ảnh chụp quyết định**, không phải tài liệu hướng dẫn hiện hành.
> Tài liệu hiện hành: `docs/ARCHITECTURE.md` · `docs/recipes/*` · `docs/M6-REMAINING.md`.

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc ADR 0001: tach runtime cua host khoi bun workspace de tranh tron version DSH
-->

# ADR 0001 — Runtime của host là một bản cài TÁCH BIỆT khỏi bun workspace

- **Ngày**: 17/10/2026 · **Trạng thái**: đã chốt
- **Người quyết**: Lead

## Bối cảnh

`apps/host` pin `@deepseek-ai/dsh*` ở bản `0.2.1-alpha.4` (khớp oracle 4001). Nhưng khi `apps/host` nằm trong
`workspaces` của repo, bun hoist mọi thứ vào `node_modules/.bun` ở **root** và `apps/host/node_modules/*`
chỉ là symlink vào store chung đó. Store chung khi ấy chứa **cả hai** dòng version:

```text
node_modules/.bun/@deepseek-ai+dsh-session-title-llm@0.2.0-rc.2+…      (chỉ có bản này)
node_modules/.bun/@deepseek-ai+dsh-session-title@0.2.1-alpha.4+…      (bản alpha.4)
```

Hệ quả thật đã gặp khi boot:

```text
SyntaxError: The requested module '@deepseek-ai/dsh-session-title-llm' does not provide an export named
'executeSessionTitleLlm'   →  host chết giữa lúc dựng cây plugin
```

Nguyên nhân sâu: npm/bun coi dải prerelease là **không khớp nhau giữa các tuple version khác nhau** —
`^0.2.0-rc.2` **không** bao gồm `0.2.1-alpha.4`. Khi có cả hai dòng trong cùng một store, package plugin
của alpha.4 có thể resolve sang bản rc.2 của package khác → API lệch nhau.

## Quyết định

1. `apps/host` **không** là thành viên của bun workspace: bỏ khỏi `workspaces` ở `package.json` gốc,
   cài bằng `bun install` riêng trong `apps/host` (có `bun.lock` riêng, `node_modules` riêng).
2. Không dùng `overrides` toàn cục để ép version: nó che mất sự lệch thay vì cô lập nó.
3. Script gốc: `bun run setup` = `bun install` (workspace) + `bun run host:install` (runtime tách biệt).

## Lý do

- Đúng nguyên tắc DSH đã chọn cho desktop của chính họ: *desktop và npm CLI chia sẻ dữ liệu sản phẩm nhưng
  **giữ package, activation và lockfile tách biệt***.
- Runtime của app là **sản phẩm đi kèm** (giống `host/cli` trong bản Electron trước đây), không phải dependency
  phát triển — trộn nó vào store của workspace là tự tạo ra lớp lỗi khó tìm.

## Hệ quả

- `bun install` ở root sẽ **không** cài runtime; phải chạy `bun run host:install` (đã có trong `setup`).
- `bh doctor` phải báo được version runtime đang dùng **và** version của oracle để lệch version lộ ra ngay.
- Nếu về sau cần nhiều runtime song song (ví dụ lane nâng cấp `0.2.1-rc.1`), mỗi runtime là một thư mục
  tách biệt dưới `apps/` hoặc `vendor/runtimes/<version>` với lockfile riêng.
