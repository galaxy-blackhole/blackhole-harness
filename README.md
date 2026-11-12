<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Gioi thieu repo Galaxy Blackhole Desktop (Tauri)
-->

# Galaxy Blackhole Desktop (Tauri)

App desktop **độc lập** viết lại kernel/core/ui/plugin theo tư tưởng của DSH (DeepSeek Harness).
Bản thiết kế đầy đủ: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Tiến độ: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Chạy nhanh

```bash
bun run setup      # bun install + cài runtime harness pin vào apps/host (apps/host KHÔNG thuộc workspace)
bun run dev        # app Tauri + host ở 127.0.0.1:5439 + HMR
scripts/restart-host.sh    # chỉ host + web (không cửa sổ) — dùng để chụp ảnh so sánh
bun run gate       # toàn bộ cổng kiểm tra
```

Host in ra hai dòng cho vỏ Tauri: `dsh web: http://127.0.0.1:5439/?token=…` (của harness) và
`[bh] ready <url>` (marker ổn định của app). Runtime harness chỉ cài/đổi version bằng
`bun run host:install`; xem [ADR 0001](docs/ADR/0001-host-runtime-isolated-install.md).

## Nguồn tham chiếu

1. GitHub: https://github.com/deepseek-ai/deepseek-harness (MIT) — pin commit trong `vendor/dsh-reference`.
2. `~/.galaxy/gbh/profiles/node_modules/@deepseek-ai/*` (bản 0.2.0-rc.2 đang chạy).