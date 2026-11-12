<!--
author Bùi Trọng Hiếu
email kevinbui210191@gmail.com
create date 15/10/2026
modify date 06/11/2026 (cập nhật chặng 116)
desc TRẠNG THÁI CUỐI của P1b (đổi tên DSH → GBH): đã đạt gì, còn gì, vì sao, và cách kiểm chứng.
-->

# P1b — TRẠNG THÁI CUỐI (đo ngày 06/11/2026)

## 1. Đã đạt

| Yêu cầu | Bằng chứng |
|---|---|
| `bun run gate` XANH | **8/8 cổng đạt** (header · file-length · jsdoc · dep-guard · parity-matrix · typecheck · hygiene · test) |
| App LÀNH | `bun run check:app` → **11/11 chỉ số ĐẠT** (+ chỉ số 12 đo bản cài) |
| Test đỏ: 0 | `bun test --max-concurrency=2` → **0 fail** (baseline đầu dự án: 170 đỏ sau install) |
| Bản CHẠY mang tên GBH | profile: **~4 700 lượt id GBH**; id stock còn **284–600** tuỳ thời điểm (xem §3) |
| Artefact trong REPO đã đổi tên | **19 gói** có ≥2 id GBH |
| Không phụ thuộc DSH khi chạy | 3 id kernel giữ nguyên CÓ CHỦ Ý (ADR-0030), phần còn lại là gói chưa port + tự tham chiếu |

## 2. Đường chạy (tự động, không cần ai nhớ lệnh riêng)

```
bash scripts/restart-host.sh
  → xoá bản mount cũ, build lại gói có src mới hơn lib
  → scripts/sync-lib-to-profile.sh   (chép lib/assets/locale/presets/types vào profile)
  → tools/p1b/denta-profile.ts       (đổi id stock → id GBH trong BẢN CÀI; lặp tới hội tụ)
  → boot host, chờ sẵn sàng
  → chạy lại sync một lượt (hội tụ SAU boot — vì mount ghi đè artefact repo lên profile)
```

Kết quả: `KẾT LUẬN: app LANH — mount duoc phep` + URL `http://127.0.0.1:5439/?token=…`.

## 3. Vì sao KHÔNG thể về 0 tham chiếu (và con số thật)

| Nhóm | Số lượt | Vì sao giữ |
|---|---|---|
| 3 id kernel (`cordis`, `schemastery`, `cosmokit`) | — | ADR-0030: phải là MỘT thể hiện kernel duy nhất |
| Tự tham chiếu (id trần của chính gói trong artefact của nó) | ~231 | Đổi là artefact import lại entry ⇒ `Detected cycle`, app không boot (Luật #32/#45) |
| Gói CHƯA có bản port (`dsh-client-store`, `dsh-typert-generator`, `dsh-app-boot`, addon gốc) | ~25 | Không có gói tương ứng trong repo để trỏ tới (Luật #46) |
| Cross-package còn sót | ~13 | Trỏ tới gói không được mount vào profile |

**Hạn chế đã biết:** mỗi lần app boot, `mountRewritePackage` chép artefact repo (id stock) vào profile ⇒
số id stock tăng tạm thời (~447). `restart-host.sh` chạy sync sau boot nên trạng thái TRÊN ĐĨA hội tụ lại
(284). Đã thử đổi id NGAY TRONG mount (chặng 111) và **thất bại có bằng chứng** — xem logbook §81, Luật #47.

## 4. Cách kiểm chứng (ba lệnh)

```bash
bun run gate            # phải in: KẾT LUẬN: XANH — 8/8 cổng đạt
bun run check:app       # phải in: KẾT LUẬN: app LANH — mount duoc phep
bash scripts/restart-host.sh   # phải in: XONG — URL: http://127.0.0.1:5439/?token=…
```

Đo mức đổi tên của bản cài:

```bash
P="$HOME/.galaxy/blackhole/profiles/node_modules/@galaxy-blackhole"
grep -rho '@galaxy-blackhole/gbh-[a-z0-9.-]*' "$P" --include='*.js' | wc -l      # ~4700
grep -rho '@deepseek-ai/[a-z0-9.-]*' "$P" --include='*.js' | wc -l              # ~284 + kernel
```

⚠️ Khi đếm, KHÔNG lọc bằng chuỗi con (`cordis`, `scope`) — sẽ xoá oan id hợp lệ (Luật #40).

## 5. Bản đồ mã nguồn của cơ chế đổi tên

| Tệp | Vai trò |
|---|---|
| `tools/lib/id-normalize.ts` | `denTa()` — đổi id theo `gbh.provenance.stock`; giữ 3 id kernel |
| `tools/p1b/denta-profile.ts` | Đổi id trong BẢN CÀI (profile) + hoàn trả id thiếu + manifest |
| `scripts/sync-lib-to-profile.sh` | Chép bản chạy vào profile, gọi denta lặp tới hội tụ |
| `scripts/restart-host.sh` | Đường chạy chuẩn: sync → boot → sync (hội tụ sau boot) |
| `tests/lib/artefact-normalize.ts` | `chuanHoaHost()` — chuẩn hoá id khi so artefact với bản gốc |
| `tools/check/app-health.ts` | Chỉ số (12): bản cài mang id GBH |
| `docs/GBH-P1B-RUNBOOK.md` | Quy trình chuyển MỘT gói (dùng cho người/agent sau) |
| `docs/GBH-P3-VIRTUAL-IDS-LOGBOOK*.md` | Nhật ký + 47 luật rút ra |

## 6. Việc còn lại (nếu muốn đi tiếp)

1. Chuyển artefact trong REPO sang id GBH cho 212 gói (dùng runbook) ⇒ khi đó mount chép thẳng bản đã đổi tên,
   hết trôi sau boot. Đây là việc LỚN (20–40 phút/gói).
2. Port 3 gói còn thiếu (`dsh-client-store`, `dsh-typert-generator`, `dsh-app-boot`) — gói đầu và thứ hai
   KHÔNG có trong oracle nên phải viết từ đầu.
3. Bỏ 6 gói còn là symlink trong profile (nếu muốn profile tự chứa 100%).

## 7. Nhật ký số đo theo chặng (đo lại 06/11/2026, chặng 116)

| Chỉ số | Số |
|---|---|
| Gói có artefact mang ≥2 id GBH (chuyển thật) | **19** |
| Gói có ít nhất 1 id GBH (gồm cả id brand tự khai) | 41 |
| Tổng lượt id GBH trong artefact các gói đó | 905 |
| Gói lớn nhất về số id | `host/plugin-manager` 768 (danh mục plugin — dữ liệu, không phải import) |
| `bun run gate` | **XANH 8/8** |
| `bun test` | **0 fail** |

Danh sách 19 gói đã chuyển thật: `api-gateway`, `api-session-controller`, `api-terminal-controller`, `compaction-basic`,
`compaction-tool-result-pruner`, `host-frontend-static`, `llm-deepseek-adapter`, `session`, `tool-cordis`,
`tool-fs`, `tool-fs-search`, `tool-pwsh-persistent`, `tool-ralph`, `tool-schedule`, `tool-session-query`,
`typert-gateway`, `workflow-ptc`, `client/modules`, `plugin-manager`.

## 8. Nếu tiếp tục: thứ tự nên làm

1. Sửa **mô hình `PAIR_*`** của các test `-halves` (5 tệp) — mở khoá `api-job-controller`, `terminal`, …
2. `api-workspace-files`: type-symbol đổi theo id gói ⇒ sửa kỳ vọng literal trong test.
3. `command-compact`: 4 ca hành vi (Config qua `ctx.plugin`, `ManualCompactionError`) — cần lớp lỗi theo bên.
4. Mỗi gói xong: `bun run gate` phải XANH trước khi sang gói kế (Luật #37: chờ máy yên 2 phút).

## 9. CHỐT (chặng 120 — chặng cuối của gói goal này)

Đo lại toàn bộ ngay trước khi bàn giao:

| Phép đo | Kết quả |
|---|---|
| `bun run gate` | **XANH 8/8** (261 063 ms) |
| `bun run check:app` | **app LÀNH — mount duoc phep** |
| Gói đã chuyển thật (≥2 id GBH) | **19** |
| Test đỏ | **0** (baseline đầu dự án: 170) |
| Commit/push | **không có** |

Việc còn lại (theo thứ tự, xem §8): sửa mô hình `PAIR_*` của 5 tệp `-halves` → mở khoá thêm gói;
cập nhật kỳ vọng type-symbol cho `api-workspace-files`; xử lý 4 ca hành vi của `command-compact`;
port 3 gói chưa có bản (`dsh-client-store`, `dsh-typert-generator`, `dsh-app-boot`).
