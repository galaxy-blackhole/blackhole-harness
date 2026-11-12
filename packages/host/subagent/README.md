<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port row subagent (hạ tầng spawn/điều phối subagent): service subagents, 3 event, 2 manifest typert;
      ĐƯỜNG LÙI TỨC THỜI + cảnh báo KHÔNG lab/boot khi teammate đang chạy
-->

# @galaxy-blackhole/gbh-subagent — row `subagent`

Port 1:1 @deepseek-ai/dsh-subagent (`lib/index.js` 3.332 dòng + **nguồn typed không bundle `lib/types/*.js` 19 module / 3.691 dòng**)
+ 2 artefact typert (`typert.host.js` 1.134 dòng, `typert.remote-client.js` 168 dòng).

## ⚠️ CẢNH BÁO AN TOÀN (đọc trước khi boot/lab)
Đây là **hạ tầng spawn/điều phối subagent** — chính service mà phiên này dùng để tạo teammate. Nếu mount hỏng khi đội đang chạy,
**cả đội mất khả năng spawn ⇒ không ai sửa được**. Vì vậy Lead đã chốt:
1. **boot-smoke trước** trên home CÁCH LY (`$GBH_HOME` temp, harness trực tiếp) — không ảnh hưởng app 5439.
2. **KHÔNG chạy `lab:row subagent` / boot thật** khi đang có teammate active; chỉ chạy khi Lead điều phối đội RẢNH.
3. Row giữ **PARKED** (`gbh.row_unmounted_ly_do`) tới khi đủ: test A/B xanh · boot-smoke ĐẠT · dòng `packages/README.md` §4 · boot thật 11/11.

## 🚨 ĐƯỜNG LÙI TỨC THỜI (≤2 phút, Lead dùng khi app đỏ)
```bash
# 1) Trong packages/host/subagent/package.json: chuyển khối gbh.row → gbh.row_unmounted_ly_do (giữ nguyên id/tests),
#    hoặc: park row bằng đúng quy ước: { "ly_do": "...", "row": { "id": "subagent", "tests": [...] } }
cd <repo> && bun run apps/cli/src/main.ts host --dump-config   # patch sinh lại: row stock subagent BẬT lại
scripts/restart-host.sh                                         # boot lại, app trở về row stock
```
`--dump-config` là bắt buộc — nếu chỉ sửa package.json mà không regen patch thì overlay insert-only sẽ khiến **trùng service `subagents`**.

## Cấu trúc port
| Hạng mục | Kết quả |
|---|---|
| Service | `subagents` — **provider DUY NHẤT** trong toàn repo (0 gói GBH khác cấp) |
| Event | `subagent/start` · `subagent/end` · `subagent/provider-added` (giữ nguyên tên + payload) |
| Typed modules | **24 tệp typed** (19 module nguồn + control-types/projection-types/out-of-process + index/internal/client) · ~7.369 dòng src · tsc strict **0 lỗi** |
| Typert host | slice nguyên văn ghép 2 phần · ownership thay **2 lần** → id của ta · cổng byte + cổng ownership · **83.449 B** (gốc 83.439, +10) · sha256 `0b228536…` |
| Typert remote | slice nguyên văn · ownership thay **1 lần** · cổng byte + cổng ownership · **13.672 B** (gốc 13.667, +5) · sha256 `1e60b453…` |
| `./client` | vocabulary rỗng (`export {}`) — KHÔNG có client runtime, package.json không có `dsh.client` |

| Export surface | **25/25 khớp stock** · `default` = `SubagentRuntime` · `String(Config)` + `inject` khớp từng ký tự |
| Ownership artefact | `package: '@galaxy-blackhole/gbh-subagent'` ×2 (host) / ×1 (remote) · **0** ownership stock · còn **6+6 typeSymbol** giữ nguyên (hợp đồng dây với consumer, cùng lớp ngoại lệ `api-workspace-controller`) |

## Số đo TRƯỚC → SAU

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| port typed | 0 | **28 tệp · ~7.369 dòng src** (24 tệp typed + 2 slice typert + ids) |
| tsc strict | — | **0 lỗi** (toàn gói) |
| build | — | 3 artefact typed (index/internal/client) + 2 typert **cổng byte + cổng ownership** |
| typert host | — | **83.449 B** (gốc 83.439, +10) · sha256 0b228536… |
| typert remote | — | **13.672 B** (gốc 13.667, +5) · sha256 1e60b453… |
| bề mặt export | — | **25/25 khớp stock** · default = SubagentRuntime · Config/inject khớp |
| test A/B | 0 ca | **43 ca · 442 expect · 0 fail**: typed 22/163 · faces 13/116 · spawn/fork THẬT 8/163 |
| gate lint | — | header/file-length/jsdoc/dep-guard **XANH 4/4** |
| check:rows | — | **154 gói · TẤT CẢ đạt** |

## Test A/B (yêu cầu Lead)
- `tests/host/subagent.test.ts` — typed A/B với source stock: descriptor/child-agent/lifecycle/catalog/activation/structured/projection/list-children/archive-admission/control/continuation; so từng giá trị + chuỗi lỗi.
- `tests/host/subagent-faces.test.ts` — 2 artefact: **cổng byte** (sha256 + byte) và **cổng ownership** (id của ta ×2/×1, 0 id stock); `grep` id stock trong `lib/*.js` = 0.
- `tests/host/subagent-spawn-ab.test.ts` — **spawn/fork THẬT** trên Context cordis thật với `llm`+`tools`+`session` đã mount: A stock vs B ta; **3 event payload khớp**; và ca **chống trùng service** (`subagents` chỉ 1 provider).

## Nợ kỹ thuật
- `./client` chỉ là vocabulary rỗng ⇒ artifact `client.js` build từ `src/client.ts` (`export {}`), không port UI.
- Peer 21 gói kernel; 2 provider spawn/fork của ta (`subagent-spawn-in-process`, `subagent-fork-in-process`) vẫn là consumer của service này.
- Row chưa flip: chờ boot-smoke + đội rảnh theo điều phối của Lead.