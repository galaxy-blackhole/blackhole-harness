<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo chuyển đổi row schedule — nhắc hẹn bền theo host, chia vendor (domain codec/recurrence/records) khỏi
      service/runtime/update; 5 subagent port theo vùng tệp rời nhau
-->

# @galaxy-blackhole/gbh-schedule — row `schedule`

Bản viết lại 1:1 của `@deepseek-ai/dsh-schedule` (2.302 dòng bundle host + `lib/types/*.js` không bundle):
**nhắc hẹn bền theo Host**, quản lý chung + giao lại đúng Session gốc khi tới hạn, lịch sử giao nhận, và
service `schedule` có RPC `schedule/list` · `schedule/catalog` cho API remotes.

## 0. Năm câu hỏi bắt buộc (§4f)

1. **Row này làm gì?** Cấp service `schedule`: lưu task bền (storage-domain), hẹn giờ bằng
   `setTimeout` theo mốc kế tiếp, giao nhắc vào Session gốc, giữ lịch sử giao nhận (ngày + trần bản ghi),
   phát `schedule/change` vào log phiên, và phục vụ RPC `schedule/list` + `schedule/catalog`.
2. **Row nằm ở đâu?** TOP-LEVEL · `- id: schedule` · name `@deepseek-ai/dsh-schedule` · **không config, không disabled**
   (dumps `ours.yml` 557–558).
3. **Hai mặt?** **KHÔNG**: package.json gốc không có khoá `dsh`; `./client` chỉ là module RỖNG (`export {}`) ⇒
   không có nửa browser; `./typert` + `./remote` là descriptor RPC, đo kernel **0** consumer `require` lúc chạy.
4. **Trùng service?** `super(ctx, 'schedule')` — chưa gói GBH nào cấp tên này. Consumer: kernel
   `dsh-tool-schedule` import 5 symbol runtime (`MAX_TITLE_LENGTH` · `MIN_EVERY_INTERVAL_SECONDS` ·
   `REQUIRED_TITLE_MESSAGE` · `ScheduleId` · `scheduleView`); `dsh-api-remotes` client khai typeSymbol
   `schedule/catalog` + `schedule/list`.
5. **Khai `gbh.row`?** CHƯA — đang **PARKED** đúng quy trình mới:
   `gbh.row_unmounted_ly_do = { ly_do, row: { id: 'schedule', tests: ['tests/host/schedule.test.ts'] } }`.
   Chỉ flip sau khi (1) test A/B xanh, (2) Lead chạy `boot-smoke schedule` ĐẠT, (3) Lead thêm dòng
   `packages/README.md` §4.

## 1. Tách VENDOR khỏi code thật (5 vùng tệp rời nhau, 5 subagent)

| Lớp | Tệp (dòng) | Nguồn gốc | Nội dung |
|---|---|---|---|
| VENDOR | `src/types.ts` (657) | `lib/types/*.d.ts` | 66 kiểu: bản ghi 7 loại + legacy, input, giao nhận, thay đổi bền, khung nhìn, 10 lỗi công cụ, yêu cầu/giá trị, `ScheduleTask`/`ScheduleDomain`/`Config` cấu trúc |
| VENDOR | `src/codec.ts` (893) | `domain.js` 1–642 | hằng + `ScheduleLogError`/`ScheduleInputError` + `ScheduleId` + title codec + timezone/instant + `decodeScheduleRecord`/`decodeScheduleChange` + helper |
| VENDOR | `src/occurrence.ts` (573) | `domain.js` 643–1046 | `resolveEvery/Daily/Weekly/CronOccurrence` · `resolveRecurringOccurrence` · `foldScheduleEvents` · `applyScheduleChanges` |
| VENDOR | `src/records.ts` (670) | `domain.js` 1047–1546 | `create*`/`parse*` record + toàn bộ máy parse cron 5 trường + `canonicalizeCronExpression` |
| VENDOR | `src/framing.ts` (65) · `delivery-history.ts` (95) · `storage.ts` (81) | `domain.js` 1547+ · `delivery-history.js` · `storage.js` | `scheduleView`/render framing · lịch sử giao · `scheduleDomain` |
| CODE THẬT | `src/runtime.ts` (247) · `update.ts` (212) · `service.ts` (632) · `index.ts` (54) | `runtime.js` · `update.js` · `index.js` | hẹn giờ/giao nhận · `resolveScheduleUpdate` · class `ScheduleService` (static inject 5, Config z.object, storage-domain, RPC) · barrel |

**Export runtime đo trên ARTIFACT = gốc**: **34/34 khoá** (không thiếu, không thừa), `default === ScheduleService`,
`static inject = ['agents','sessions','storageDomain','sessionController','sessionPersistence']`,
`String(Config)` khớp từng ký tự.

## 2. Peer + phụ thuộc

`peerDependencies` = 13 gói kernel runtime (`cordis`, `dsh-agent`, `dsh-api-session-controller`, `dsh-brand`,
`dsh-llm`, `dsh-session`, `dsh-session-persistence`, `dsh-session-projection`, `dsh-storage-domain`, `dsh-subagent`,
`dsh-tools`, `dsh-typert-protocol`, `dsh-workspace`). `dependencies`: `schemastery` · `@js-temporal/polyfill` 0.5.1 ·
`zod` 4.4.3 (import `zod/v4`). Locale `en`/`zh` **byte-for-byte** (sha 12adfe5… / dc0dec3…).

## 3. Tác động nếu mount (nêu trước reviewer)

Row này cấp service `schedule` + giữ hẹn giờ và giao nhắc vào Session; `dsh-tool-schedule` (gói RIÊNG, không phải
row này) mới là nơi có 4 tool `schedule_create/list/delete/update`. Mount sai ⇒ task không được giao, hẹn giờ
treo, hoặc app chết như sự cố vừa rồi — vì vậy row PARKED tới khi boot-smoke ĐẠT.

## 4. Số đo TRƯỚC → SAU

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| gói GBH cho row `schedule` | 0 | **1** (11 tệp, 4.161 dòng src) |
| export runtime artifact | — | **34/34 khớp gốc**, `default===class`, inject + String(Config) khớp |
| tsc strict toàn gói + build | — | **0 lỗi** |
| test A/B ĐỒNG HỒ GIẢ (không chờ thật) | 0 ca | **28 ca · 28 pass · 495 expect** (976 dòng, <2s) |
| gate lint vùng này | — | **0 vi phạm** (header/file-length/jsdoc/dep-guard XANH) |
| `gbh.row` | — | **PARKED** (`row_unmounted_ly_do`) — chờ boot-smoke + README §4 của Lead |

## 5. Nợ kỹ thuật (nói thẳng)

- `runtime.ts` ép kiểu MỘT lần khi dựng message `source: {kind:"schedule"}` (bản gốc augment `MessageSourceMap`;
  luật repo cấm augment) — giá trị lúc chạy đã đo đúng.
- `types.ts` khai `ScheduleTask`/`ScheduleDomain` theo CẤU TRÚC thay `z.infer` của storage schema (schema nằm ở
  `storage.ts`) — hình dạng so khớp qua test A/B.
- Chưa ship `./typert`/`./remote`/`./client` (descriptor + module rỗng; 0 consumer runtime).
- Row chưa flip: cần Lead `boot-smoke schedule` + dòng `packages/README.md` §4.