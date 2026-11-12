<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo hoàn tất port row session (gói LÕI event-sourced): 13 module từ lib/types/*.js, 30 export runtime,
      test A/B + replay dữ liệu THẬT + consumer Session value import + kiểm alias resolution
-->

# @galaxy-blackhole/gbh-session — row session (gói LÕI)

Port 1:1 @deepseek-ai/dsh-session (lib/index.js 2.052 dòng, không bundle lib/types/*.js 2.422 dòng) thành 13 module
TypeScript. Row oracle: TOP-LEVEL id session, KHÔNG config, KHÔNG disabled (dumps 25–26). Đây là **provider duy nhất**
của service sessions (SessionStore extends Service, super(ctx,"sessions")) — thay lớp cấp session ảnh hưởng TOÀN BỘ app.

## 0. Năm câu hỏi bắt buộc (§4f)

1. Row này làm gì? Cấp service sessions (event-sourced store): tạo/khôi phục/fork session, append/adopt event, surface
   projection (acceptance/eligibility/replacement), seq ranges, request header, tool history, repair interrupted turn,
   bàn giao persistence.
2. Row nằm ở đâu? TOP-LEVEL id session (stock đang bật) — gói ta thay toàn bộ lớp cấp.
3. Hai mặt? KHÔNG — package stock không có khoá dsh/client; exports chỉ "." "./types" "./fork" "./surface" "./locale".
4. Trùng service/event? KHÔNG — 0 gói GBH nào provide sessions/super(ctx,"sessions"); 4 gói session-query-sqlite ·
   session-reference · workspace-changes · attachment-local đều đã mount và chỉ TIÊU THỤ seam.
5. Khai gbh.row? CHƯA — PARKED: gbh.row_unmounted_ly_do = { ly_do, row: { id: 'session', tests: [4 tệp] } }.

## 1. 13 module đã port

| Module | Nguồn | Dòng |
|---|---|---|
| types.ts | lib/types/types.d.ts 556 + types.js | 675 |
| known-event-types.ts | known-event-types.js 88 | 78 |
| seq-ranges.ts | seq-ranges.js 73 | 72 |
| preparation.ts | preparation.js 36 | 46 |
| surface.ts | surface.js 574 | 777 |
| repair.ts | repair.js 189 | 242 |
| tool-history.ts | tool-history.js 75 | 103 |
| request-header.ts | request-header.js 62 | 93 |
| fork.ts | fork.js 27 | 46 |
| events.ts | lib/index.js 1031–1323 | 535 |
| session.ts | lib/index.js 1324–1713 (Session + SessionForkError) | 524 |
| store.ts | lib/index.js 1714–2050 (SessionStore) | 482 |
| index.ts | barrel đúng câu export cuối index.js | 43 |

## 2. Số đo TRƯỚC → SAU

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| module port | 0 | 13 (tổng 3.720 dòng src) |
| export runtime | 0 | 30/30 khớp stock từng tên + default === SessionStore (+ type `SessionForkErrorCode` như index.d.ts gốc) |
| tsc strict | — | 0 lỗi (index.ts + build.ts) |
| build | — | lib/index.js 1.617 dòng |
| test A/B | 0 ca | 23 ca · 283 expect (main 14/98 · replay 4/172 · telemetry 4/10 · alias 1/3) |
| replay dữ liệu THẬT | — | 11/11 phiên .jsonl.zstd trong ~/.galaxy/blackhole/sessions (CHỈ ĐỌC) |
| gate lint | — | header/file-length/jsdoc/dep-guard 0 vi phạm vùng này |
| check:rows | — | xem báo cáo Lead (row PARKED nên không chặn) |

## 3. Ba bằng chứng bắt buộc của Lead

1. **Alias resolution cho runtime value import**: 20+ gói import SessionSeq/SessionId/KNOWN_SESSION_EVENT_TYPES/Session từ
   @deepseek-ai/dsh-session. Đo thật: mount.ts:320–352 chỉ copy lib+package.json+locale vào profile node_modules/<TÊN TA>
   và symlink PEER về kernel; profile hiện trỏ @deepseek-ai/dsh-session → kernel stock. gbh.row.aliases là id module CLIENT,
   KHÔNG tạo mapping host ⇒ sau mount các import đó vẫn resolve stock (HAI bản cùng tên). Test tests/host/session-alias.test.ts
   kiểm: (a) khi chưa mount → manifest PARKED đúng; (b) khi mount → createRequire từ consumer
   profile/node_modules/@galaxy-blackhole/gbh-session-reference phải resolve ĐÚNG lib/index.js của ta; (c) patch có aliases.
   CHỜ LEAD QUYẾT: (A) cho phép sửa apps/cli/src/mount.ts + rewrite-metadata.ts thêm host alias; (B) Lead tự làm; (C) chấp nhận
   nợ + 3 test chứng minh (đã có 2/3: không có instanceof nào trong repo; A/B hành vi trùng khớp).
2. **Session value import (session-telemetry-otel)**: consumer dùng Session.fromRestore (index.ts:318) + lọc isFeedback
   (index.ts:59). Test chứng minh A/B: static surface khớp, fromRestore/create cho cùng log/surface trên phiên THẬT, lọc
   isFeedback cho cùng tập event ⇒ hành vi consumer KHÔNG đổi. Không có instanceof Session/SessionStore trong repo.
3. **Replay dữ liệu THẬT**: đọc 11 phiên .jsonl.zstd (READ-ONLY), giải nén bằng Bun.zstdDecompressSync, bỏ trường type khỏi
   header, fold bằng stock.Session.create và ours.Session.create ⇒ so id/inheritedEventCount/log/surface từng event; thêm
   snapshotSessionEvent cho MỌI event + canonicalHeader mọi header. Chuẩn hoá duy nhất: time của event tổng hợp
   "session/end-seed" (do chính bước create/adopt sinh ra bằng đồng hồ thực) đặt 0.

## 4. Nợ kỹ thuật

- **NỢ đã biết — hai bản cùng tên (chấp nhận có kiểm chứng):** host alias ĐÃ thi công trong `apps/cli/src/mount.ts`
  (`gbh.row.hostAliases` → symlink `<profile>/node_modules/<stock>` → gói ta, tạo sau vòng peer) nhưng **harness tự link
  kernel deps trong profile và ghi đè** ⇒ `readlink` sau boot vẫn trỏ kernel. Hướng xử lý = **host alias sau bước link
  kernel** (task riêng). Kiểm chứng đi kèm: (a) test alias assert thật profile trỏ KERNEL khi đã mount (không skip im
  lặng), (b) 0 `instanceof Session/SessionStore` trong src của mọi package ta, (c) A/B hành vi TRÙNG giữa hai bản cùng tên
  (brand/version/tập event/foldSurface).
- types.ts thay khối declare module typert-protocol bằng 2 interface CẤU TRÚC (SessionTypertResourceMap +
  SessionRemoteErrorDetailsMap) — luật ADR 000d cấm augment module.
- seq-ranges/preparation đã chỉnh bề mặt kiểu đúng .d.ts (EncodedSeq, SessionSeqType[], SessionPreparation implements
  Disposable, session: Session).
- Row chưa flip: cần Lead boot-smoke session + dòng packages/README.md §4.