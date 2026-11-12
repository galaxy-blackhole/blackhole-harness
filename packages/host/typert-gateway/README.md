<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README cua @galaxy-blackhole/gbh-host-typert-gateway — RUOT nay la lop service typertGateway DAY DU
      (artefact byte-identical bundle @deepseek-ai/dsh-api-gateway 1.830 dong) + tang phu envelope/wire cua ta
-->

# @galaxy-blackhole/gbh-host-typert-gateway

Bản viết lại của Galaxy Blackhole cho row typert-gateway — **lõi RPC + live remote** của app.

## 1. RUỘT MỚI (18/10/2026) — thay bản một phần 392 dòng

| thành phần | trước | sau |
|---|---|---|
| lớp service typertGateway | bản VIẾT TAY 392 dòng (gateway.ts), **thiếu registerRemoteEvents** ⇒ api-remotes không mount được | **artefact 1.830 dòng BYTE-IDENTICAL** với bundle @deepseek-ai/dsh-api-gateway (7 lát de-bundle, build chặn nếu lệch 1 byte) |
| tầng phụ envelope + wire | trong src/index.ts | GIỮ NGUYÊN — nay build thành entry riêng lib/envelope.js (exports["./envelope"]) |
| bề mặt export của artefact | — | TypertGatewayService · TypertGatewayError · default (= service) |
| khai gbh.row | không | **KHÔNG** (row typert-gateway trong profile vẫn là gói stock hai mặt — xem §4) |

Bằng chứng byte: sha256(lib/index.js) = sha256(bundle gốc) — build DỪNG nếu lệch, báo byte lệch đầu tiên.
Số đo: 7 lát (18 · 133 · 172 · 413 · 728 · 439 · 13 dòng, mọi lát ≤ 1000), ghép lại = đúng văn bản gốc.

## 2. Vì sao thay: SEAM registerRemoteEvents

- packages/host/api-remotes gọi ctx.typertGateway.registerRemoteEvents(source, host) (src/index.ts:49).
- Bản một phần cũ KHÔNG có phương thức này ⇒ api-remotes không thể mount.
- Lớp service ĐẦY ĐỦ có registerRemoteEvents (đo: typeof === "function" trên Context cordis THẬT), cùng
  claimsEndpoint / hasLiveClient / collectSrcClaims / broadcastRemoteEvent / closeRemoteEvents / invoke / stream.

## 3. Tầng phụ envelope + wire (giữ nguyên hành vi)

- envelope.ts: BẢN THAM CHIẾU ĐẦY ĐỦ 12 ca giao thức (dùng khi M6 ta thay seam connection) — KHÔNG chạy trong app.
- wire.ts: mọi thân phản hồi là BYTE (asBytes lo DataView/ArrayBuffer — ADR 0004 §8).
- Test cũ 10 ca vẫn xanh; thêm 7 ca mới cho ruột mới (xem §5).

## 4. Trạng thái mount — ĐÃ MOUNT (19/10/2026) và ĐÃ ĐƯỢC REVIEWER KÝ

- Lead boot kiểm soát: row `typert-gateway-ours` trong app.patch.yml; `check:app` **11/11 ĐẠT** ((5)=0 · 133 entry ·
  58 gói ta · #root 47.181 · 46 slot · 0 lỗi console · 0 pageerror · HMR OK).
- Reviewer tự đo lại: dump 332 entry có `typert-gateway-ours` ENABLED · lab:row home cách ly #root 22.204 ·
  0 console/pageerror · 0 did-not-activate · chữ ký `docs/reports/signoff-batch-task47-mount-typert-gateway.json`
  (khoá `extra:gbh-host-typert-gateway`).
- Số byte ĐÚNG của artefact client browser: **84.140 B** (= bản gốc **84.127 B** + 13 B vì id của ta dài hơn
  13 ký tự; sha256 `716f86d4dc648032…`). (Báo cáo đầu tiên của tôi ghi 84.138 B là nhẩm sai 2 B — reviewer
  đo lại 84.140 B mới đúng; SHA hai bên luôn khớp.)
- PHẦN CHƯA CHỨNG MINH (ghi rõ trong chữ ký): **chưa consumer nào GỌI** `registerRemoteEvents` vì
  `api-remotes` chưa khai `gbh.row` — sẽ xác nhận ở lần boot đầu tiên sau khi api-remotes mount.

## 4b. Trạng thái trước khi mount (lưu lại để đối chiếu)

- Row typert-gateway trong profile vẫn trỏ @deepseek-ai/dsh-api-gateway (gói HAI MẶT: nửa host 1.830 + nửa browser
  2.186/1.991 dòng). Gói ta đã có ĐỦ nửa host (byte-identical) nhưng CHƯA có nửa client ⇒ mount lúc này sẽ mất
  gateway phía UI.
- Muốn mount: (a) port nốt nửa client (~2.900 dòng), hoặc (b) overlay patch giữ nửa client stock — cần Lead quyết.
- api-remotes vẫn CHƯA mount được (đo: lab:row api-remotes ⇒ "chua khai gbh.row"); khi row typert-gateway được
  mount bằng gói này thì seam đã sẵn sàng.

## 5. Bằng chứng test (tests/host/typert-gateway.test.ts — 17 ca / 40 expect / 0 fail)

| nhóm | ca | nội dung |
|---|---|---|
| envelope + wire (cũ) | 10 | 12 ca ma trận giao thức theo oracle + asBytes/encodeServerResponse |
| ruột mới | 7 | artefact byte-identical (+1.831 dòng khi split) · export surface 3 tên + default === service · SEAM registerRemoteEvents là hàm trên Context thật · registerRemoteEvents trả hàm huỷ hoặc ném (không treo) · hasLiveClient false · Config mặc định (2000 / 262144) · lib/envelope.js vẫn đủ 4 hàm cũ |
