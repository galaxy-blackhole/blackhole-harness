<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README goi workspace-changes: port 1:1 host-only 1.097 dong + 7 module phu — TRUOC/SAU, bang chung A/B, no ky thuat
-->

# `@galaxy-blackhole/gbh-host-workspace-changes`

Bản viết lại **1:1** của `@deepseek-ai/dsh-workspace-changes` — *ghi nhận thay đổi tệp trong workspace theo
từng lượt* (snapshot git + capture toàn tệp quanh lời gọi tool tệp, so sánh từng tệp, phục vụ UI workspace).

## 1. Phân loại row (đo trước khi viết)

| phép đo | kết quả |
|---|---|
| row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | `- id: workspace-changes` ở **thụt lề 0**, KHÔNG `disabled` — row TOP-LEVEL |
| mặt phải | **MỘT MẶT** (`dsh.client` vắng, không có `lib/client.js`) ⇒ **được phép khai `gbh.row`** |
| kích thước gốc | `lib/index.js` **1.097 dòng** + 7 module: `git` 223 · `recorder` 328 · `paths` 105 · `capture` 79 · `compare` 55 · `numstat` 44 · `index` 156 · `types` 1 |
| phụ thuộc | `schemastery` + `diff` (dependencies); peer: cordis · dsh-agent · dsh-session · dsh-subprocess · dsh-tools · dsh-fs |

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC (bản DSH) | SAU (gói của ta) |
|---|---|---|
| host plugin | `class` ẩn trong bundle 1.097 dòng | `src/plugin.ts` **459 dòng** (name · inject · Config · apply) |
| module trong bundle | 7 khối `#region` trong một tệp | 7 tệp rời: `git.ts` 423 · `recorder.ts` 589 · `paths.ts` 108 · `capture.ts` 94 · `compare.ts` 115 · `numstat.ts` 64 · `types.ts` 145 |
| mặt `./types` | `lib/types/types.js` = `export {};` + 8 tệp `.d.ts` | `src/types.ts` (khai báo kiểu 1:1) + artifact `lib/types.js` rỗng |
| export công khai | `Config · apply · inject · name` | **giống hệt** (đo bằng regex trên `lib/index.js` hai bên) |
| `String(Config)` | 5 trường mặc định 30_000 · 8 MiB · 500 · 2 MiB · 100 | **trùng từng ký tự** (ca test A/B) |
| locale | `en.json` 53 B · `zh.json` 137 B | **chép byte-for-byte** (ca test A/B) |
| test | — | **18 ca / 70 expect, 0 fail** (mọi module so TRỰC TIẾP với module gốc trong kernel) |

## 3. Bằng chứng A/B (mỗi ca so cùng input → cùng output với bản gốc)

- **numstat**: record thường · rename (`\t\t\0old\0new\0`) · binary `-` · rỗng · added không phải số ⇒ `NaN`; output hỏng ⇒ **cùng thông điệp** `numstat output is not NUL-terminated` / `malformed numstat record: …`.
- **paths**: `toPosix` · `isInside` · `isTemporaryPath` · `compareDisplay` · `displayPathOf`/`durablePathOf` (trong/ngoài workspace, dưới home, thư mục tạm) · `canonicalPath` · `temporaryRoots`.
- **capture**: tệp thường / nhị phân / thiếu / quá cỡ ⇒ cùng `kind` + cờ `binary` + **cùng hash sha1**; `sameCapture` đủ 7 cặp (oversized **không bao giờ** khớp).
- **compare**: giống nhau · đổi · hai phía null · 4.000 dòng với `timeout=0` ⇒ cùng hunks/tổng/`coarse`.
- **GitRunner**: cùng spec spawn (argv · cwd · env `GIT_CONFIG_COUNT=0` … · graceMs) + cùng kết quả đọc luồng + `truncated`; git thoát 128 ⇒ **cùng thông điệp stderr**.
- **TurnRecorder**: `start → capture → observe → stopping` trên thư mục KHÔNG git ⇒ cùng danh sách sự kiện + cùng summary (1 tệp, +1 dòng, `cwd` đã chuẩn hoá); `diff()` seq lạ ⇒ `undefined` cả hai.
- **plugin**: `String(Config)` · `name` · `inject` trùng.

## 4. Kiểm

```bash
bun test tests/host/workspace-changes.test.ts     # 18 pass / 70 expect
bun run packages/host/workspace-changes/build.ts  # lib/index.js + lib/types.js
```

## 5. Nợ kỹ thuật (ghi rõ để người sau không tưởng đã xong)

1. `compare.ts` khai `interface DiffHunk` CỤC BỘ (không export) thay vì `import type` từ `./types.ts` như bản gốc — hành vi không đổi; khi cần thì đổi sang import type.
2. `types.ts` **không** khai báo cộng gộp `SessionEventMap` / `Context.workspaceChanges` như `.d.ts` gốc (ADR 000d: khai lại kiểu stock sinh TS2664/TS2717) — `plugin.ts` tự khai seam theo CẤU TRÚC.
3. `plugin.ts` ép `ctx.subprocess` về `SubprocessRuntimeLike` của `git.ts`: thuần KIỂU (runtime là seam thật của kernel).
4. Chưa port `.d.ts` (không ship kiểu) — như các gói khác của repo.
