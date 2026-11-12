<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 04/11/2026
 desc Bàn giao chặng 39: trạng thái xanh, bản đồ việc còn lại của P3/P1b, và các luật rút ra
-->

# Bàn giao — chặng 39 (04/11/2026)

## 1. Trạng thái đã đo

| Phép đo | Kết quả |
|---|---|
| `bun run gate` | **8/8 XANH** |
| `bun test` | **0 fail** (5.394 pass / 350 tệp) |
| `bun run check:app` | **11/11 LÀNH** — 57.080 ký tự `#root` · 48 slot · 0 lỗi console · bố cục **0/80** |
| Phủ gói stock | **304/304 = 100%** |

## 2. Đã xong trong phiên này

1. **Phủ gói 100%**: 5 gói cuối (`dsh`, `dsh-experimental-session-inspector`,
   `dsh-tool-call-timeout-policy`, `libreoffice-kit-darwin-x64`, `node-addon-system-darwin-x64`).
2. **ADR-0030** — một thể hiện kernel ở tầng KIỂU: mặt kiểu kernel của ta = mặt kiểu gốc
   ⇒ quét 275 tệp/404 chỗ đổi tên kernel mà `typecheck` vẫn **0 vi phạm**.
3. **P3 chứng minh khả thi**: đổi `@deepseek-ai/dsh-client-store` → `@galaxy-blackhole/gbh-client-store`
   chạy được thật (app 48 slot, 0 lỗi console) khi đổi **đủ bốn nơi** — xem §3.
4. **Token CSS**: bật lại bước đổi `--dsh-*` → `--gbh-*` trong `ui-layout/build.ts`
   (trước đó bị tắt ⇒ font không áp ⇒ cả UI lệch 1–2 px).
5. **Cờ phạm vi module** cho `ui-goal` (cổng chống cài hai lần) — sửa đúng hành vi bản gốc.

## 3. Bốn nơi chứa ID ẢO (bắt buộc đổi ĐỒNG THỜI)

| # | Nơi | Ghi chú |
|---|---|---|
| 1 | `packages/client/*/src` + `packages/*/*/lib` | consumer `require("<id>")` |
| 2 | `packages/host/web-frontend/dist/assets/index-*.js` | bảng module của vỏ |
| 3 | `packages/host/host-frontend-static/dist/assets/index-*.js` | bản sao thứ hai |
| 4 | `~/.galaxy/blackhole/profiles/blackhole/dist/assets/index-*.js` | **bản THẬT SỰ được phục vụ** |

Thiếu nơi 4 ⇒ `require("<id mới>") missed the module table` ⇒ UI trắng.

## 4. Việc còn lại của P3 (5 id ảo)

| id | tệp `src` | tệp `lib` |
|---|---|---|
| `dsh-client-store` | 116 | 93 |
| `dsh-client-ui-primitives` | 130 | 81 |
| `dsh-client-ui-slots` | 16 | 85 |
| `dsh-client-ui-dockkit` | 9 | 1 |
| `dsh-typert-generator` | 26 | 44 |

**Quy trình cho MỘT id (đã kiểm chứng):**

1. `cp -a` sao lưu `packages/` (có cả `lib/`) — bài học: backup chỉ `.ts` là KHÔNG đủ.
2. Đổi tên **thuần văn bản** ở cả 4 nơi; **không** rebuild artefact.
3. Dạy `build.ts`: `quyNguocIdAo()` cho cổng ownership + 5 cặp id trong chuỗi `const expected`.
4. Sửa test: stub `require` nhận id theo **hậu tố**; mảng kỳ vọng dùng **id mới**;
   **tuyệt đối không sửa test bằng regex diện rộng** (đã làm hỏng cú pháp 3 tệp ở chặng 38).
5. `bash scripts/sync-lib-to-profile.sh` → boot → `bun run check:app` → `bun test` → `bun run gate`.
6. **Chạy `gate` TRƯỚC**, rồi mới chụp lại đường nền bố cục (`probe-once --save`) — vì test có dựng lại artefact.

## 5. Việc còn lại của P1b (đổi tên gói)

| Hạng mục | Số lượng |
|---|---|
| Tham chiếu trong `packages/*/*/src` | 3.628 |
| Tham chiếu trong manifest | 4.049 |
| Tệp artefact còn id stock | 731 |

Tầng **kiểu** đã sẵn (ADR-0030). Tầng **runtime của test** cần `tests/setup/kernel-alias.ts`
(đã có: ép `gbh-cordis/schemastery/cosmokit` về một thể hiện) — nhưng khi quét `src` thì
nhiều test so artefact với bundle gốc; dùng `normalizePackageNames()` (đã có trong `tests/lib/brand-parity.ts`).

## 6. Luật rút ra trong phiên (đọc trước khi làm tiếp)

1. **KHÔNG BAO GIỜ** `git checkout -- packages/...` khi đang có thay đổi chưa commit.
2. **KHÔNG BAO GIỜ** `rmtree` thư mục `src` — mất CSS/parts/JSON không nằm trong backup `.ts`.
3. **KHÔNG** rebuild artefact hàng loạt: gói de-bundle **không** dựng bằng `build.ts`.
4. `tools/debundle-client.ts` cần **đường dẫn đầy đủ** `packages/client/<pkg>`.
5. Backup phải chứa **cả `lib/`** (`/tmp/gbh-green-r39` = bản đầy đủ đầu tiên, 306 MB).
6. Không sửa test bằng regex diện rộng; mỗi lượt một lớp lỗi, chạy test ngay.

## 7. Sự cố node_modules (04/11/2026) — cách chữa ĐÚNG

Tôi dùng `rsync -a --delete /tmp/gbh-green-final/packages/ packages/` để khôi phục nhanh ⇒ **xoá sạch
`packages/*/*/node_modules`**; sau đó `rm -rf node_modules apps/*/node_modules tools/*/node_modules`
để "cài lại cho sạch" ⇒ **xoá luôn oracle** `apps/host/node_modules` (304 gói stock).

**Triệu chứng:** `TS2307 Cannot find module 'zod'` · `@deepseek-ai/schemastery` · `playwright-core`;
sau đó test parity chết vì không có oracle.

**Cách chữa (theo đúng thứ tự, đã kiểm chứng):**

```bash
bun run host:install                 # cài lại ORACLE apps/host/node_modules (304 gói, ~2 s từ cache)
bun install --force                  # liên kết workspace + store
# nếu thiếu gói stock ở gốc: symlink từ oracle
python3 - <<'PY'
import pathlib, os
src = pathlib.Path('apps/host/node_modules/@deepseek-ai'); dst = pathlib.Path('node_modules/@deepseek-ai')
dst.mkdir(parents=True, exist_ok=True)
for d in sorted(src.iterdir()):
    t = dst / d.name
    if d.is_dir() and not (t.exists() or t.is_symlink()): os.symlink(os.path.relpath(d, dst), t)
PY
mkdir -p tools/node_modules           # tools/features import 'playwright-core'
for p in playwright-core pixelmatch pngjs; do ln -sf "../parity/node_modules/$p" "tools/node_modules/$p"; done
bun add -d zod@4.4.3                 # root cần zod cho typecheck của vài gói client
```

**Luật mới (bổ sung §6):**

7. **KHÔNG BAO GIỜ** `rsync --delete` vào `packages/` (nó xoá `node_modules` con).
8. **KHÔNG BAO GIỜ** `rm -rf apps/*/node_modules` — đó là **oracle**; mất là mọi phép parity vô nghĩa.
9. Sao lưu/khôi phục **chỉ** dùng `--exclude node_modules`, hoặc `git checkout`/`tar` cho tệp cụ thể.
