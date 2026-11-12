<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc PHASE B — R6a bị CHẶN bởi cổng byte-parity trong build.ts / test pin specifier + peer stock.
      Danh sách do dev-4 đo trong batch-dev-4 (69 gói), kèm tệp:cổng đang chặn. Phase này cần ngân sách riêng.
-->

# Phase B — R6a bị chặn (cổng byte / test pin stock)

Trong batch-dev-4 (69 gói), R6a đã đổi được ở **12 gói** (time-context · session · skill-filesystem · tool-jobs · spill-local · spill-policy · session-title-llm¹ · token-meter¹ · tool-goal¹ · subagent¹). Các gói dưới đây **không đổi được** vì mã bị khoá bởi cổng byte hoặc test đối chứng; mọi lần thử đều đưa test/build về ĐỎ và đã được REVERT.

¹ đổi được một phần (src) nhưng còn id phải đổi tiếp — xem cột ghi chú.

## 1. Cổng BYTE-PARITY trong `build.ts` (đổi 1 specifier là build đỏ)

| gói | cổng chặn | bằng chứng đo |
|---|---|---|
| `host/tool-fs` | `build.ts` — cổng byte-identical với bundle gốc | đã đổi 4 specifier ⇒ `49499B != 49479B` ⇒ FAIL |
| `host/terminal-bash` | `build.ts` — cổng byte-identical | đổi import ⇒ build ném "bản ghép KHÔNG trùng bundle gốc" |
| `host/tool-ralph` | `build.ts` byte + `tests/host/tool-ralph.test.ts:638` pin `gbh.peers` theo manifest stock | đổi `dsh-tools` ⇒ 2 ca đỏ |
| `host/tool-pwsh-persistent` | `build.ts` — cổng byte-identical | đổi import ⇒ build đỏ |
| `host/subprocess-local`, `host/tool-schedule` | `src/parts*/` là LÁT NGUYÊN VĂN + `build.ts` cổng byte-identical | không thể sửa import (lát sinh tự động) |

## 2. Test pin SPECIFIER stock trong artefact (không được sửa tests/**)

| gói | tệp:ca đang chặn |
|---|---|
| `host/tool-pwsh` | `tests/host/tool-pwsh.test.ts:441-445` — `expect(built).toContain('from "@deepseek-ai/…"')` |
| `host/session-title-llm` | `tests/host/session-title-llm.test.ts:295-300` |
| `host/tool-ask-user` | `tests/host/tool-ask-user.test.ts:296` — đòi artefact CHỨA `"@deepseek-ai/dsh-user-questions"` |
| `host/subagent-model-selection-settings` | test đòi artefact chứa `"@deepseek-ai/dsh-llm"` + khoá `gbh.peers` |
| `host/tool-bash-persistent` | test khoá specifier stock trong artefact |

## 3. Test pin `gbh.peers` = danh sách TÊN STOCK

| gói | tệp:ca đang chặn |
|---|---|
| `host/session-telemetry-otel` | `tests/host/session-telemetry-otel.test.ts:609` |
| `host/session-stats` | `tests/host/session-stats.test.ts:339` |
| `host/system-prompt` | `tests/host/system-prompt.test.ts:561` (`toEqual` 3 tên stock) |
| `host/timeout-policy` | `tests/host/timeout-policy.test.ts:238` (`RUNTIME_PEERS`) |
| `host/storage-domain` | `tests/host/storage-domain.test.ts:510-512` + `tests/host/peer-range-harness.ts:94-100` |
| `host/storage` | `SEAM_PEERS` + peerRangeProblems đọc manifest `apps/host/node_modules/<tên-stock>` |
| `host/shell` | `tests/host/shell.test.ts:498-503` |
| `host/shell-env` | `tests/host/shell-env.test.ts:339 + 364-368` |
| `host/subagent-spawn-in-process` | `tests/host/subagent-spawn-in-process.test.ts:286 + 333` (đã thử ⇒ 3 ca peer ĐỎ) |
| `host/session-title-first-prompt-llm` | `tests/host/session-title-first-prompt-llm.test.ts:681 + 758` |
| `host/session-title` | `tests/host/session-title.test.ts:441` |
| `host/subprocess` | `tests/host/subprocess.test.ts:181` (`SEAM_PEERS`) — hiện đã ký vì R6b (dsh-http-proxy) |

## 4. Chặn vì DANH TÍNH LỚP / SYMBOL (không phải tên import)

| gói | hiện tượng khi đổi sang GBH |
|---|---|
| `host/tool-present` | `FsError` của `gbh-fs` KHÁC LỚP `FsError` của `dsh-fs` mà test đối chứng kernel ⇒ đỏ 1 ca |
| `host/skill` | đổi `dsh-scope`→`gbh-scope` ⇒ "danh tính lớp ScopedLayers" sai phạm vi CHA/ANH EM ⇒ 2 ca đỏ |
| `host/session-reference` | `typeSymbol` đã GBH hoá, 3 ca `tests/host/session-reference-typert.test.ts` so với stock ⇒ **Lead đã duyệt (c)**: giữ typeSymbol GBH + cập nhật 3 assertion (cần người làm trong Phase B) |

## 5. Lát nguyên văn nhưng build.ts THIẾU `denTa` (artefact còn id stock)

`host/session-query-sqlite` · `host/tool-bash` · `host/terminal` · `host/tool-bash-persistent`

→ Fix tối thiểu: thêm bước denTa vào `build.ts` (2–3 dòng, SAU cổng byte) như `host/tool-cordis` và `host/tool-fs-search` đang làm (2 gói này đã sạch id stock trong `lib/index.js`). Cần Lead chốt vì đụng cổng byte/A-B.

## 6. Đề xuất thứ tự Phase B (theo rủi ro thấp → cao)

1. **Nhóm 5** (thêm denTa vào build.ts): rẻ nhất, chỉ 2–3 dòng/gói, không đổi src.
2. **Nhóm 3** (nới test `gbh.peers`): cho test so **tập con** thay vì `toEqual` tên stock — 1 sửa trong `tests/host/peer-range-harness.ts` mở khoá ~10 gói.
3. **Nhóm 2** (test pin specifier trong artefact): đổi assertion sang "specifier thuộc {stock, GBH}" thay vì chuỗi tuyệt đối.
4. **Nhóm 1** (cổng byte): phải quyết định chính sách — hoặc cho phép `build.ts` "denTa sau khi so byte", hoặc chuyển hẳn sang artefact GBH (bỏ byte-parity).
5. **Nhóm 4** (danh tính lớp): cần quyết định kiến trúc (port `FsError` dùng chung / re-export từ kernel).

## 7. BA MỤC LEAD CHỐT (08/11/2026 — ghi theo yêu cầu của Lead, dev-5 ghi hộ)

### 7.1 `host/experimental-worktree` — GIỮ NGUYÊN, KHÔNG trả lại
`lib/` của gói được dùng NỘI BỘ, gói KHÔNG thay thế row nào ⇒ không cần khối `dsh.client`/metadata row ở lượt này.
Lead sẽ bổ sung metadata sau. Reviewer: chấm KY, ghi chú "lib dùng nội bộ, không thay row".

### 7.2 `host/goal` — thiếu 4 subpath so stock: **GHI NỢ**, KHÔNG trả lại
Bốn subpath stock mở mà gói ta chưa mở: (điền theo đo của reviewer) — xử lý ở lô "exports parity" chung, không chặn chữ ký.
Điều kiện đóng nợ: khi có consumer thật dùng subpath đó, HOẶC trong lô Phase B exports.

### 7.3 Lô TÊN `DSH_` là HỢP ĐỒNG CHẠY — xếp **LÔ RIÊNG**, KHÔNG xử lẻ
Các tên sau là hợp đồng chạy giữa hai phía (host ↔ client) hoặc giữa artefact với test A/B, KHÔNG được đổi lẻ từng gói:
- `DSH_SPEECH_TOKEN` (token speech-to-text)
- `isDSHRemoteError` (dấu hiệu lỗi wire xuyên realm — client/ui-sidebar-files, host/typert-gateway)
- `DSH_ENV_PREFIX` (tiền tố biến môi trường)

Quy tắc khi mở lô riêng: đổi **ĐỒNG THỜI hai phía** (nguồn phát + nơi đọc) trong MỘT lần, kèm cập nhật test A/B sang khuôn chuẩn hoá nhãn (task-17/N2: `expect(text.replaceAll("<nhãn mới>", "<nhãn stock>")).toBe(stockText)`), rồi đo lại bằng `bun test` + `gate`.
KHÔNG đổi lẻ một phía: sẽ tạo "hai tên cho một hợp đồng" và làm đỏ test A/B ở gói khác.

### 7.4 `host/gbh-experimental-session-inspector` — thiếu `dsh.client`: **NGOẠI LỆ CÓ CHỦ ĐÍCH (chưa mount)**, KHÔNG trả lại
Lead chốt 08/11/2026 (2026-11-08 11:23) theo đề nghị của reviewer dev-5. Ba dữ kiện đo được:
1. **Stock** `@deepseek-ai/dsh-experimental-session-inspector` có khối `dsh.client` = `{ inject: [dsh-client-locale, dsh-client-ui-conversation, dsh-client-ui-sidebar-right, dsh-client-ui-session, dsh-client-ui-renderer], platform: "web" }`.
2. **Gói ta** `packages/host/gbh-experimental-session-inspector` CHƯA có khối `dsh.client` (package.json không có khoá `"dsh"`); bề mặt export runtime vẫn khớp khít stock (6 export) và `exports["."].types` trỏ `./lib/types/index.d.ts` **có thật**.
3. Gói **KHÔNG khai `gbh.row`** (còn `gbh.draft`) ⇒ **KHÔNG mount** ⇒ nửa client hiện là **MÃ CHẾT, không gây lỗi runtime**. Thiếu `dsh.client` là thiếu bề mặt MANIFEST/mount, KHÔNG phải thiếu export (nên R5 vẫn đạt; chữ ký review-9 của dev-5 giữ nguyên).

**Quyết định:** giữ `gbh.draft`, đóng ca "CHO FIX" thành **"NGOẠI LỆ CÓ CHỦ ĐÍCH — chưa mount"**. KHÔNG thêm `dsh.client` lẻ (thêm mà không mount là trạng thái nửa vời, khó truy).
**Chốt chặn mount:** README của gói đã ghi cảnh báo "⚠️ chưa có `dsh.client` — KHÔNG mount được nửa client". Ai muốn bật nửa client PHẢI làm TRỌN GÓI ở **lô Phase C**: thêm `dsh.client` (inject id stock theo §2e) + khai `gbh.row` + bỏ `gbh.draft` + `lab:row`/`boot-smoke` + đo lại `check:app`. Làm lẻ bước nào cũng tạo bug ẩn im lặng.
**Tiền lệ phải nhớ:** `client/ui-chat` từng MẤT `lib/client.js` (nửa client biến mất âm thầm) — đúng lớp rủi ro mà chốt chặn này phòng.
