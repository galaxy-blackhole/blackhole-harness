<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ghim ban DSH tham chieu: commit, ngay, cach tai lap, va quy tac chi-doc
-->

# Upstream reference pin

Dự án này **không fork** DSH. Bản upstream chỉ được dùng làm **nguồn đối chiếu** để viết lại và để chạy oracle.

| Hạng mục | Giá trị |
|---|---|
| Repo | https://github.com/deepseek-ai/deepseek-harness |
| License | MIT (giữ thông báo bản quyền khi dẫn xuất — xem `THIRD_PARTY_NOTICES.md`) |
| **Commit đã pin** | `1517a4dbca0a2789ff1d41ba439600f8547d23fa` |
| Ngày commit | 2026-10-16 |
| Nhánh | `master` (upstream chỉ có một nhánh) |
| Bản đang chạy ở oracle 4001 | `@deepseek-ai/dsh` **0.2.1-alpha.4** |
| Bản app của ta pin | xem `apps/host/package.json` |

## Tái lập bản tham chiếu

```bash
bun run scripts/upstream.ts      # clone đúng commit vào vendor/dsh-reference (chỉ đọc)
```

## Quy tắc

1. `vendor/dsh-reference/` là **chỉ đọc** — không sửa, không build từ đó, đã nằm trong `.gitignore` vì dung lượng (~205MB).
2. Nâng pin = sửa commit ở file này + chạy lại **toàn bộ** `bun run parity:report` trước khi merge (DSH là developer preview, breaking changes liên tục).
3. Bản cài để chạy oracle là `~/tmp/galaxy-blackhole/dsh-upstream` (clone shallow cùng commit) — không dùng chung với `vendor/`.
